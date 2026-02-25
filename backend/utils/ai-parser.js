/**
 * AI-powered message parser for extracting tasks from natural language.
 * Uses OpenRouter API. Fully optional - disabled when OPENROUTER_API_KEY not set.
 */

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

async function parseMessageToTasks(message, teamMembers) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;

  try {
    const memberNames = teamMembers.map(m => m.display_name).join(', ');

    const systemPrompt = `You extract tasks from natural language messages for a team task tracker.
Team members: ${memberNames}.

Rules:
- Only extract actionable tasks (not greetings, questions, or casual chat)
- If no tasks are found, return an empty array []
- For each task, determine: title (concise), priority (P0=critical, P1=high, P2=normal, P3=low), assignedTo (exact member name or null), dueDate (ISO format or null)
- Return ONLY valid JSON array, no other text

Example: "John needs to finish the design doc by Friday, and someone should fix the login bug ASAP"
Result: [{"title":"Finish the design doc","priority":"P2","assignedTo":"John","dueDate":"2026-02-20"},{"title":"Fix the login bug","priority":"P0","assignedTo":null,"dueDate":null}]`;

    const response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://champquest-production.up.railway.app',
        'X-Title': 'ChampQuest',
      },
      body: JSON.stringify({
        model: 'deepseek/deepseek-r1:free',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
        max_tokens: 1024,
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenRouter error: ${response.status}`);
    }

    const data = await response.json();
    let text = data.choices?.[0]?.message?.content?.trim() || '';

    // Remove reasoning blocks from reasoning models (like deepseek-r1)
    text = text.replace(/<think>[\s\S]*?<\/think>/g, '');

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
