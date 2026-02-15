const pool = require('../db/pool');

/**
 * Fire-and-forget webhook dispatch.
 * Reads team settings, checks if webhook is enabled for the event,
 * and POSTs to the configured URL (Slack/Discord compatible).
 */
async function dispatchWebhook(teamId, event, payload) {
  try {
    const team = await pool.query('SELECT settings_json, name FROM teams WHERE id = $1', [teamId]);
    const settings = team.rows[0]?.settings_json || {};
    const webhooks = settings.webhooks;

    if (!webhooks || !webhooks.enabled || !webhooks.url) return;
    if (webhooks.events && !webhooks.events.includes(event)) return;

    const text = formatWebhookMessage(event, payload, team.rows[0].name);

    fetch(webhooks.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    }).catch(err => {
      console.error(`Webhook dispatch error for team ${teamId}:`, err.message);
    });
  } catch (err) {
    console.error(`Webhook lookup error for team ${teamId}:`, err.message);
  }
}

function formatWebhookMessage(event, payload, teamName) {
  const prefix = `[${teamName}]`;
  switch (event) {
    case 'task_completed':
      return `${prefix} ${payload.userName} completed "${payload.taskTitle}" (+${payload.xpEarned} XP)`;
    case 'task_created':
      return `${prefix} ${payload.userName} created a new task: "${payload.taskTitle}"`;
    case 'level_up':
      return `${prefix} ${payload.userName} leveled up to Level ${payload.newLevel} - ${payload.newRank}!`;
    case 'kudos_given':
      return `${prefix} ${payload.fromUserName} sent kudos to ${payload.toUserName}: "${payload.message}"`;
    default:
      return `${prefix} ${event}: ${JSON.stringify(payload)}`;
  }
}

module.exports = { dispatchWebhook };
