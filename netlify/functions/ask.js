/**
 * LEGACY: Assistant-backed chat route. No longer used by the live /chat page.
 * The production chat uses netlify/functions/chat-response.js (Responses API + search_archive).
 * Kept only for rollback; not wired to the UI.
 */
export async function handler(event) {
    const { question } = JSON.parse(event.body || '{}');
  
    const response = await fetch("https://api.openai.com/v1/assistants/YOUR_ASSISTANT_ID/threads", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messages: [{ role: "user", content: question }]
      })
    });
  
    const result = await response.json();
    return {
      statusCode: 200,
      body: JSON.stringify(result)
    };
  }
  