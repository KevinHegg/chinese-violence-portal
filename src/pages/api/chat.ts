import type { APIRoute } from 'astro';
import { marked } from 'marked';

// Configure marked for better markdown parsing
marked.setOptions({
  breaks: true,
  gfm: true
});

// Simple rate limiting - store in memory (for production, use Redis or similar)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 10; // 10 requests per minute

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const limit = rateLimitMap.get(ip);
  
  if (!limit || now > limit.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }
  
  if (limit.count >= RATE_LIMIT_MAX) {
    return false;
  }
  
  limit.count++;
  return true;
}

export const POST: APIRoute = async ({ request }) => {
  try {
    // Rate limiting
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 
               request.headers.get('x-real-ip') || 
               'unknown';
    
    if (!checkRateLimit(ip)) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded. Please try again in a minute.' }),
        {
          status: 429,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Dev-only logging
    if (import.meta.env.DEV) {
      console.log('Chat API called');
    }
    
    const body = await request.text();
    let message;
    
    try {
      const parsed = JSON.parse(body);
      message = parsed.message;
    } catch (parseError) {
      if (import.meta.env.DEV) {
        console.error('JSON parse error:', parseError);
      }
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'Message is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Sanitize input - limit length
    if (message.length > 2000) {
      return new Response(JSON.stringify({ error: 'Message too long' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Sanitize input - remove potentially dangerous characters and normalize
    // Remove null bytes, control characters, and excessive whitespace
    let sanitizedMessage = message
      .replace(/\0/g, '') // Remove null bytes
      .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters except newlines/tabs
      .replace(/\n{3,}/g, '\n\n') // Limit consecutive newlines
      .trim();
    
    // Validate after sanitization
    if (sanitizedMessage.length === 0) {
      return new Response(JSON.stringify({ error: 'Message is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Use sanitized message
    message = sanitizedMessage;

    const openaiApiKey = import.meta.env.OPENAI_API_KEY;
    const assistantId = import.meta.env.ASSISTANT_ID;

    if (!openaiApiKey || !assistantId) {
      if (import.meta.env.DEV) {
        console.error('Missing environment variables');
      }
      return new Response(JSON.stringify({ error: 'OpenAI configuration missing' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Create a thread
    const threadResponse = await fetch('https://api.openai.com/v1/threads', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'assistants=v2'
      }
    });

    if (!threadResponse.ok) {
      const errorText = await threadResponse.text();
      if (import.meta.env.DEV) {
        console.error('Thread creation error response:', errorText);
      }
      throw new Error(`Failed to create thread: ${threadResponse.statusText}`);
    }

    const thread = await threadResponse.json();

    // Add the message to the thread
    const messageResponse = await fetch(`https://api.openai.com/v1/threads/${thread.id}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'assistants=v2'
      },
      body: JSON.stringify({
        role: 'user',
        content: message.trim()
      })
    });

    if (!messageResponse.ok) {
      throw new Error(`Failed to add message: ${messageResponse.statusText}`);
    }

    // Run the assistant
    const runResponse = await fetch(`https://api.openai.com/v1/threads/${thread.id}/runs`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'assistants=v2'
      },
      body: JSON.stringify({
        assistant_id: assistantId
      })
    });

    if (!runResponse.ok) {
      throw new Error(`Failed to start run: ${runResponse.statusText}`);
    }

    const run = await runResponse.json();

    // Poll for completion with exponential backoff
    let runStatus = run.status;
    let pollDelay = 500; // Start with 500ms
    const maxDelay = 5000; // Max 5 seconds
    const maxPollTime = 60000; // Max 60 seconds total
    const startTime = Date.now();
    let pollCount = 0;

    while (runStatus === 'queued' || runStatus === 'in_progress') {
      // Check timeout
      if (Date.now() - startTime > maxPollTime) {
        throw new Error('Request timeout - assistant took too long to respond');
      }

      await new Promise(resolve => setTimeout(resolve, pollDelay));

      const statusResponse = await fetch(`https://api.openai.com/v1/threads/${thread.id}/runs/${run.id}`, {
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'OpenAI-Beta': 'assistants=v2'
        }
      });

      if (!statusResponse.ok) {
        throw new Error(`Failed to check run status: ${statusResponse.statusText}`);
      }

      const runData = await statusResponse.json();
      runStatus = runData.status;
      pollCount++;

      // Exponential backoff: increase delay after each poll, but cap at maxDelay
      pollDelay = Math.min(pollDelay * 1.5, maxDelay);

      if (runStatus === 'failed') {
        throw new Error('Assistant run failed');
      }
    }

    // Get the messages
    const messagesResponse = await fetch(`https://api.openai.com/v1/threads/${thread.id}/messages`, {
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'OpenAI-Beta': 'assistants=v2'
      }
    });

    if (!messagesResponse.ok) {
      throw new Error(`Failed to get messages: ${messagesResponse.statusText}`);
    }

    const messages = await messagesResponse.json();
    const assistantMessage = messages.data.find((msg: any) => msg.role === 'assistant');

    if (!assistantMessage) {
      throw new Error('No assistant response found');
    }

    let response = assistantMessage.content[0]?.text?.value || 'Sorry, I couldn\'t generate a response.';

    // Convert markdown to HTML first
    try {
      response = marked(response);
    } catch (markdownError) {
      if (import.meta.env.DEV) {
        console.error('Markdown parsing error:', markdownError);
      }
      // If markdown parsing fails, return the original text
    }

    // Remove content in brackets like "【4:1†bundle_03.pdf】" from the HTML
    response = response.replace(/【[^】]*】/g, '');
    
    // Remove other bracket patterns like [text] or (text) that might be file references
    // But be more careful not to remove legitimate HTML attributes
    response = response.replace(/\[([^\]]*\.pdf|[^\]]*\.txt|[^\]]*\.doc)\]/g, '');
    response = response.replace(/\(([^)]*\.pdf|[^)]*\.txt|[^)]*\.doc)\)/g, '');
    
    // Clean up extra whitespace
    response = response.replace(/\s+/g, ' ').trim();

    return new Response(JSON.stringify({ response }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('Chat API error:', error);
    }
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}; 