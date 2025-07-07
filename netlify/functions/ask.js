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
  