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
    const telegram = settings.telegram;

    const text = formatWebhookMessage(event, payload, team.rows[0].name);

    // Slack/Discord webhook
    if (webhooks && webhooks.enabled && webhooks.url) {
      if (!webhooks.events || webhooks.events.includes(event)) {
        fetch(webhooks.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text })
        }).catch(err => {
          console.error(`Webhook dispatch error for team ${teamId}:`, err.message);
        });
      }
    }

    // Telegram channel notification
    if (telegram && telegram.chatId) {
      const botToken = telegram.botToken || process.env.TELEGRAM_BOT_TOKEN;
      if (botToken) {
        fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: telegram.chatId, text, parse_mode: 'Markdown' })
        }).catch(err => {
          console.error(`Telegram dispatch error for team ${teamId}:`, err.message);
        });
      }
    }
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
    case 'status_changed':
      return `${prefix} ${payload.userName} changed "${payload.taskTitle}" from ${payload.fromStatus} → ${payload.toStatus}`;
    case 'daily_digest':
      return `${prefix} Daily Digest: ${payload.overdueCount} overdue, ${payload.dueTodayCount} due today, ${payload.staleCount} stale tasks`;
    case 'stale_tasks':
      return `${prefix} ${payload.count} stale task(s) — no status change in ${payload.threshold}+ days`;
    case 'priority_reminder':
      return `${prefix} P0/P1 task "${payload.taskTitle}" is ${payload.isOverdue ? 'OVERDUE' : 'due soon'} (due: ${payload.dueDate})`;
    default:
      return `${prefix} ${event}: ${JSON.stringify(payload)}`;
  }
}

module.exports = { dispatchWebhook };
