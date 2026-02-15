/**
 * AI-powered message parser for extracting tasks from natural language.
 * Uses the Anthropic Claude API. Fully optional - disabled when AI_API_KEY not set.
 */

async function parseMessageToTasks(message, teamMembers) {
  const apiKey = process.env.AI_API_KEY;
  if (!apiKey) return null;

  let Anthropic;
  try {
    Anthropic = require('@anthropic-ai/sdk');
  } catch (e) {
    console.log('AI parser disabled (@anthropic-ai/sdk not installed)');
    return null;
  }

  try {
    const client = new Anthropic({ apiKey });
    const memberNames = teamMembers.map(m => m.display_name).join(', ');

    const response = await client.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 1024,
      system: `You extract tasks from natural language messages for a team task tracker.
Team members: ${memberNames}.

Rules:
- Only extract actionable tasks (not greetings, questions, or casual chat)
- If no tasks are found, return an empty array []
- For each task, determine: title (concise), priority (P0=critical, P1=high, P2=normal, P3=low), assignedTo (exact member name or null), dueDate (ISO format or null)
- Return ONLY valid JSON array, no other text

Example: "John needs to finish the design doc by Friday, and someone should fix the login bug ASAP"
Result: [{"title":"Finish the design doc","priority":"P2","assignedTo":"John","dueDate":"2026-02-20"},{"title":"Fix the login bug","priority":"P0","assignedTo":null,"dueDate":null}]`,
      messages: [{ role: 'user', content: message }]
    });

    const text = response.content[0].text.trim();
    // Extract JSON from response (may have markdown code fences)
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const tasks = JSON.parse(jsonMatch[0]);
    return Array.isArray(tasks) ? tasks : [];
  } catch (err) {
    console.error('AI parser error:', err.message);
    return null;
  }
}

module.exports = { parseMessageToTasks };
