const cron = require('node-cron');
const pool = require('../db/pool');

function getWeekBounds(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return { start: monday, end: sunday };
}

async function generateWeeklySnapshot() {
  console.log('📊 Generating weekly analytics snapshots...');

  const { start, end } = getWeekBounds();

  try {
    const teams = await pool.query('SELECT id FROM teams');

    for (const team of teams.rows) {
      try {
        const result = await pool.query(
          `SELECT u.id, u.display_name, tm.xp, tm.tasks_completed,
                  COUNT(t.id) FILTER (WHERE t.completed = true AND t.completed_at BETWEEN $1 AND $2) as period_tasks
           FROM users u
           JOIN team_members tm ON u.id = tm.user_id
           LEFT JOIN tasks t ON t.assigned_to = u.id AND t.completed = true AND t.completed_at BETWEEN $1 AND $2
           WHERE tm.team_id = $3
           GROUP BY u.id, u.display_name, tm.xp, tm.tasks_completed
           ORDER BY period_tasks DESC, tm.xp DESC`,
          [start, end, team.id]
        );

        const sorted = result.rows;
        const mvp = sorted[0];

        const dataJson = {
          members: sorted.map(m => ({
            userId: m.id,
            name: m.display_name,
            tasksCompleted: m.tasks_completed,
            xpEarned: m.xp,
            periodTasks: parseInt(m.period_tasks)
          })),
          totalTasks: sorted.reduce((sum, m) => sum + parseInt(m.period_tasks), 0),
          totalXP: sorted.reduce((sum, m) => sum + m.xp, 0),
          teamSize: sorted.length,
          mvpUserId: mvp?.id,
          period: 'weekly',
          periodStart: start,
          periodEnd: end
        };

        await pool.query(
          `INSERT INTO analytics_snapshots (team_id, period, period_start, period_end, mvp_user_id, mvp_tasks_completed, data_json)
           VALUES ($1, 'weekly', $2, $3, $4, $5, $6)
           ON CONFLICT DO NOTHING`,
          [team.id, start, end, mvp?.id || null, parseInt(mvp?.period_tasks) || 0, JSON.stringify(dataJson)]
        );

        if (mvp) {
          console.log(`  ✅ Team ${team.id}: MVP is ${mvp.display_name} with ${mvp.period_tasks} tasks`);
        }
      } catch (err) {
        console.error(`  ❌ Error generating snapshot for team ${team.id}:`, err.message);
      }
    }

    console.log('✅ Weekly snapshots complete');
  } catch (err) {
    console.error('❌ Error in weekly snapshot job:', err.message);
  }
}

function startScheduler() {
  // Run weekly snapshot every Sunday at midnight
  cron.schedule('0 0 * * 0', async () => {
    console.log('🕛 Sunday midnight - Running weekly snapshot...');
    await generateWeeklySnapshot();
  });

  console.log('📅 Analytics snapshot scheduler started');
}

module.exports = { startScheduler, generateWeeklySnapshot };