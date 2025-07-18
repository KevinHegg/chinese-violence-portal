import type { APIRoute } from 'astro';
import { marked } from 'marked';

// Configure marked for better markdown parsing
marked.setOptions({
  breaks: true,
  gfm: true
});

export const POST: APIRoute = async ({ request }) => {
  try {
    console.log('Chat API called');
    const body = await request.text();
    console.log('Request body:', body);
    let message;
    
    try {
      const parsed = JSON.parse(body);
      message = parsed.message;
      console.log('Parsed message:', message);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!message) {
      return new Response(JSON.stringify({ error: 'Message is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const openaiApiKey = import.meta.env.OPENAI_API_KEY;
    const assistantId = import.meta.env.ASSISTANT_ID;

    console.log('Environment check:');
    console.log('- OPENAI_API_KEY:', openaiApiKey ? 'Present' : 'Missing');
    console.log('- ASSISTANT_ID:', assistantId ? 'Present' : 'Missing');

    if (!openaiApiKey || !assistantId) {
      console.error('Missing environment variables');
      return new Response(JSON.stringify({ error: 'OpenAI configuration missing' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Create a thread
    console.log('Creating thread with API key:', openaiApiKey ? 'Present' : 'Missing');
    const threadResponse = await fetch('https://api.openai.com/v1/threads', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'assistants=v2'
      }
    });

    console.log('Thread response status:', threadResponse.status);
    console.log('Thread response status text:', threadResponse.statusText);

    if (!threadResponse.ok) {
      const errorText = await threadResponse.text();
      console.error('Thread creation error response:', errorText);
      throw new Error(`Failed to create thread: ${threadResponse.statusText} - ${errorText}`);
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
        content: message
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

    // Poll for completion
    let runStatus = run.status;
    while (runStatus === 'queued' || runStatus === 'in_progress') {
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second

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
      console.error('Markdown parsing error:', markdownError);
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
    console.error('Chat API error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}; 