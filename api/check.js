// api/check.js
// Production scam analysis backend using OpenAI gpt-4.1-mini

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed, use POST.' });
  }

  try {
    const { message, sender } = req.body || {};

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Missing \"message\" in body.' });
    }

    const senderText =
      sender && typeof sender === 'string' && sender.trim().length > 0
        ? `Sender: \"${sender.trim()}\".`
        : 'Sender: not provided.';

    const prompt = `
You are an AI assistant that evaluates whether messages are likely scams, especially targeting older adults.

Here is the sender and message:

${senderText}

Message:
"${message}"

You must:
- Consider the content AND the sender.
- Look for signs of phishing, impersonation of banks, PayPal, Amazon, IRS, tech support, or family.
- Be conservative (better to call something risky than safe).
- Explain things in very simple language suitable for a senior.

Respond in EXACTLY this JSON format, and only JSON, no extra text:

{
  "risk": "high" | "medium" | "low",
  "summary": "one sentence summary of what the message is about",
  "reason": "short explanation in plain language suitable for a senior",
  "advice": "one or two short sentences telling the senior what to do next"
}
    `.trim();

    const apiKey = process.env.OPENAI_API_KEY;

    // If for some reason the key isn't there, fail clearly.
    if (!apiKey) {
      console.error('OPENAI_API_KEY is missing in environment.');
      return res.status(500).json({ error: 'Server configuration error.' });
    }

    const openaiResponse = await fetch(
      'https://api.openai.com/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4.1-mini',
          messages: [
            {
              role: 'system',
              content:
                'You are a scam-detection assistant helping seniors avoid fraud. Always err on the side of caution.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.1,
        }),
      }
    );

    if (!openaiResponse.ok) {
      const text = await openaiResponse.text();
      console.error('OpenAI error:', openaiResponse.status, text);
      return res.status(500).json({
        error: 'OpenAI API error.',
        details: text.slice(0, 200),
      });
    }

    const data = await openaiResponse.json();
    const content = data?.choices?.[0]?.message?.content;

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (e) {
      console.error('Failed to parse AI JSON:', content);
      return res
        .status(500)
        .json({ error: 'Failed to parse AI response JSON.' });
    }

    if (
      !parsed ||
      !parsed.risk ||
      !parsed.summary ||
      !parsed.reason ||
      !parsed.advice
    ) {
      console.error('AI response missing fields:', parsed);
      return res
        .status(500)
        .json({ error: 'AI response missing required fields.' });
    }

    return res.status(200).json({
      risk: parsed.risk,
      summary: parsed.summary,
      reason: parsed.reason,
      advice: parsed.advice,
    });
  } catch (err) {
    console.error('Handler error:', err);
    return res.status(500).json({ error: 'Unexpected server error.' });
  }
}