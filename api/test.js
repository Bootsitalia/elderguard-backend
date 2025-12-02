// api/test.js
// Simple debug endpoint to check if OPENAI_API_KEY is visible

export default function handler(req, res) {
  const hasKey = !!process.env.OPENAI_API_KEY;
  res.status(200).json({
    hasKey,
  });
}