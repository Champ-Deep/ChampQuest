const cron = require('node-cron');
const pool = require('../db/pool');
const { dispatchWebhook } = require('./webhooks');

/**
 * Cron-based reminder system for overdue tasks, stale tasks, and daily digests.
 * Respects per-team settings in settings_json.reminders.
 */
function startReminders() {
  // Daily digest at 9:00 AM UTC
  cron.schedule('0 9 * * *', async () => {
    console.log('Running daily digest...');
    await sendDailyDigest();
  });

  // Stale task check every 6 hours
  cron.schedule('0 */6 * * *', async () => {
    console.log('Checking for stale tasks...');
    await checkStaleTasks();
  });

  // Priority task reminders at 10 AM UTC (P0/P1 approaching or past due)
  cron.schedule('0 10 * * *', async () => {
    console.log('Checking priority task reminders...');
    await checkPriorityReminders();
  });

  console.log('📅 Reminder system started');
}

async function sendDailyDigest() {
  try {
    const teams = await pool.query('SELECT id, name, settings_json FROM teams');
    for (const team of teams.rows) {
      const settings = team.settings_json || {};
      if (!settings.reminders?.dailyDigest) continue;

      const overdue = await pool.query(
        `SELECT COUNT(*)::int as count FROM tasks WHERE team_id = $1 AND due_date < CURRENT_DATE AND COALESCE(status, 'todo') != 'done' AND completed = false`,
        [team.id]
      );
      const dueToday = await pool.query(
        `SELECT COUNT(*)::int as count FROM tasks WHERE team_id = $1 AND due_date = CURRENT_DATE AND COALESCE(status, 'todo') != 'done' AND completed = false`,
        [team.id]
      );
      const stale = await pool.query(
        `SELECT COUNT(*)::int as count FROM tasks WHERE team_id = $1 AND COALESCE(status, 'todo') = 'in_progress' AND status_updated_at < NOW() - INTERVAL '3 days'`,
        [team.id]
      );

      const overdueCount = overdue.rows[0].count;
      const dueTodayCount = dueToday.rows[0].count;
      const staleCount = stale.rows[0].count;

      if (overdueCount > 0 || dueTodayCount > 0 || staleCount > 0) {
        dispatchWebhook(team.id, 'daily_digest', {
          teamName: team.name,
          overdueCount,
          dueTodayCount,
          staleCount
        });
      }
    }
  } catch (err) {
    console.error('Daily digest error:', err.message);
  }
}

async function checkStaleTasks() {
  try {
    const teams = await pool.query('SELECT id, name, settings_json FROM teams');
    for (const team of teams.rows) {
      const settings = team.settings_json || {};
      const threshold = settings.staleThresholdDays || 3;

      const stale = await pool.query(
        `SELECT t.title, u.display_name as assigned_to_name FROM tasks t
         LEFT JOIN users u ON t.assigned_to = u.id
         WHERE t.team_id = $1 AND COALESCE(t.status, 'todo') = 'in_progress'
         AND t.status_updated_at < NOW() - INTERVAL '1 day' * $2`,
        [team.id, threshold]
      );

      if (stale.rows.length > 0) {
        dispatchWebhook(team.id, 'stale_tasks', {
          count: stale.rows.length,
          threshold,
          tasks: stale.rows.map(t => ({ title: t.title, assignee: t.assigned_to_name }))
        });
      }
    }
  } catch (err) {
    console.error('Stale task check error:', err.message);
  }
}

async function checkPriorityReminders() {
  try {
    const teams = await pool.query('SELECT id, name, settings_json FROM teams');
    for (const team of teams.rows) {
      const settings = team.settings_json || {};
      if (!settings.reminders?.priorityAlerts) continue;

      // P0/P1 tasks that are overdue or due within 1 day
      const urgent = await pool.query(
        `SELECT t.title, t.priority, t.due_date, u.display_name as assigned_to_name FROM tasks t
         LEFT JOIN users u ON t.assigned_to = u.id
         WHERE t.team_id = $1 AND t.priority IN ('P0', 'P1')
         AND COALESCE(t.status, 'todo') != 'done' AND t.completed = false
         AND t.due_date IS NOT NULL AND t.due_date <= CURRENT_DATE + INTERVAL '1 day'
         ORDER BY t.due_date ASC`,
        [team.id]
      );

      for (const task of urgent.rows) {
        const isOverdue = new Date(task.due_date) < new Date(new Date().toDateString());
        dispatchWebhook(team.id, 'priority_reminder', {
          taskTitle: task.title,
          priority: task.priority,
          dueDate: new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          assignee: task.assigned_to_name,
          isOverdue
        });
      }
    }
  } catch (err) {
    console.error('Priority reminder error:', err.message);
  }
}

module.exports = { startReminders };
