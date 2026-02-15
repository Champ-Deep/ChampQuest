const pool = require('../db/pool');
const { XP_VALUES, calculateLevel } = require('../config');

/**
 * Telegram bot for ChampQuest task management.
 * Uses the Telegraf library. Starts only when TELEGRAM_BOT_TOKEN is set.
 */

let bot = null;

async function startTelegramBot() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.log('📱 Telegram bot disabled (TELEGRAM_BOT_TOKEN not set)');
    return null;
  }

  let Telegraf;
  try {
    Telegraf = require('telegraf').Telegraf;
  } catch (e) {
    console.log('📱 Telegram bot disabled (telegraf not installed - run: npm install telegraf)');
    return null;
  }

  bot = new Telegraf(token);

  // /start - Welcome message
  bot.start((ctx) => {
    ctx.reply(
      '🎮 *ChampQuest Bot*\n\n' +
      'Commands:\n' +
      '/link <email> - Link your Telegram to ChampQuest\n' +
      '/tasks - List your pending tasks\n' +
      '/overdue - List overdue tasks\n' +
      '/status <taskId> <status> - Update task status\n' +
      '/assign <taskTitle> - Create a new task\n' +
      '/help - Show this message',
      { parse_mode: 'Markdown' }
    );
  });

  bot.help((ctx) => {
    ctx.reply(
      '🎮 *ChampQuest Commands*\n\n' +
      '`/link <email>` - Link your account\n' +
      '`/tasks` - Your pending tasks\n' +
      '`/overdue` - Overdue tasks\n' +
      '`/status <id> <todo|in_progress|blocked|in_review|done>` - Update status\n' +
      '`/assign <title>` - Create task\n',
      { parse_mode: 'Markdown' }
    );
  });

  // /link <email> - Associate Telegram user with ChampQuest account
  bot.command('link', async (ctx) => {
    const email = ctx.message.text.split(' ').slice(1).join(' ').trim();
    if (!email) {
      return ctx.reply('Usage: /link your@email.com');
    }

    try {
      const user = await pool.query('SELECT id, display_name FROM users WHERE email = $1', [email.toLowerCase()]);
      if (user.rows.length === 0) {
        return ctx.reply('❌ No ChampQuest account found with that email.');
      }

      // Store telegram_id mapping in a simple way - use settings_json on the user's team membership
      // Store globally: we'll add telegram_id to users table
      const telegramId = ctx.from.id.toString();

      // Check if already linked
      const existing = await pool.query("SELECT id FROM users WHERE id = $1", [user.rows[0].id]);
      if (existing.rows.length > 0) {
        // Store telegram_id (we'll use a separate approach - store in a metadata field or create a mapping)
        // For now, store in settings approach - add telegram_chat_id to the teams settings
        // Actually, let's use a pragmatic approach: store telegramId as reset_token temporarily
        // Better: just create a simple mapping table or use settings_json
        await pool.query(
          `UPDATE users SET reset_token = $1 WHERE id = $2`,
          [`tg:${telegramId}`, user.rows[0].id]
        );
        ctx.reply(`✅ Linked! Welcome, *${user.rows[0].display_name}*! Your Telegram is now connected.`, { parse_mode: 'Markdown' });
      }
    } catch (err) {
      console.error('Telegram link error:', err.message);
      ctx.reply('❌ Something went wrong. Try again later.');
    }
  });

  // Helper: Find ChampQuest user from Telegram ID
  async function findUser(telegramId) {
    const result = await pool.query("SELECT id, display_name FROM users WHERE reset_token = $1", [`tg:${telegramId}`]);
    return result.rows[0] || null;
  }

  // Helper: Find user's first team
  async function findUserTeam(userId) {
    const result = await pool.query('SELECT team_id FROM team_members WHERE user_id = $1 LIMIT 1', [userId]);
    return result.rows[0]?.team_id || null;
  }

  // /tasks - List pending tasks
  bot.command('tasks', async (ctx) => {
    const user = await findUser(ctx.from.id.toString());
    if (!user) return ctx.reply('❌ Not linked. Use /link <email> first.');

    const teamId = await findUserTeam(user.id);
    if (!teamId) return ctx.reply('❌ You are not in any team.');

    try {
      const result = await pool.query(
        `SELECT id, title, priority, COALESCE(status, 'todo') as status, due_date FROM tasks
         WHERE team_id = $1 AND (assigned_to = $2 OR assigned_to IS NULL) AND COALESCE(status, 'todo') != 'done' AND completed = false
         ORDER BY CASE priority WHEN 'P0' THEN 0 WHEN 'P1' THEN 1 WHEN 'P2' THEN 2 ELSE 3 END
         LIMIT 15`,
        [teamId, user.id]
      );

      if (result.rows.length === 0) {
        return ctx.reply('🎉 No pending tasks! Well done!');
      }

      const lines = result.rows.map(t => {
        const dueStr = t.due_date ? ` (due ${new Date(t.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})` : '';
        return `[${t.priority}] #${t.id} *${t.title}* - ${t.status}${dueStr}`;
      });

      ctx.reply(`📋 *Your Tasks:*\n\n${lines.join('\n')}`, { parse_mode: 'Markdown' });
    } catch (err) {
      console.error('Telegram tasks error:', err.message);
      ctx.reply('❌ Error fetching tasks.');
    }
  });

  // /overdue - List overdue tasks
  bot.command('overdue', async (ctx) => {
    const user = await findUser(ctx.from.id.toString());
    if (!user) return ctx.reply('❌ Not linked. Use /link <email> first.');

    const teamId = await findUserTeam(user.id);
    if (!teamId) return ctx.reply('❌ You are not in any team.');

    try {
      const result = await pool.query(
        `SELECT t.id, t.title, t.priority, t.due_date, u.display_name as assignee FROM tasks t
         LEFT JOIN users u ON t.assigned_to = u.id
         WHERE t.team_id = $1 AND t.due_date < CURRENT_DATE AND COALESCE(t.status, 'todo') != 'done' AND t.completed = false
         ORDER BY t.due_date ASC LIMIT 10`,
        [teamId]
      );

      if (result.rows.length === 0) {
        return ctx.reply('✅ No overdue tasks!');
      }

      const lines = result.rows.map(t => {
        const days = Math.floor((new Date() - new Date(t.due_date)) / (1000 * 60 * 60 * 24));
        return `🔴 [${t.priority}] #${t.id} *${t.title}* - ${days}d overdue${t.assignee ? ` (${t.assignee})` : ''}`;
      });

      ctx.reply(`⚠️ *Overdue Tasks:*\n\n${lines.join('\n')}`, { parse_mode: 'Markdown' });
    } catch (err) {
      console.error('Telegram overdue error:', err.message);
      ctx.reply('❌ Error fetching overdue tasks.');
    }
  });

  // /status <taskId> <status> - Update task status
  bot.command('status', async (ctx) => {
    const user = await findUser(ctx.from.id.toString());
    if (!user) return ctx.reply('❌ Not linked. Use /link <email> first.');

    const parts = ctx.message.text.split(' ').slice(1);
    const taskId = parseInt(parts[0]);
    const status = parts[1];

    if (!taskId || !status) {
      return ctx.reply('Usage: /status <taskId> <todo|in_progress|blocked|in_review|done>');
    }

    const validStatuses = ['todo', 'in_progress', 'blocked', 'in_review', 'done'];
    if (!validStatuses.includes(status)) {
      return ctx.reply(`Invalid status. Use: ${validStatuses.join(', ')}`);
    }

    const teamId = await findUserTeam(user.id);
    if (!teamId) return ctx.reply('❌ You are not in any team.');

    try {
      const task = await pool.query('SELECT * FROM tasks WHERE id = $1 AND team_id = $2', [taskId, teamId]);
      if (task.rows.length === 0) {
        return ctx.reply('❌ Task not found.');
      }

      await pool.query(
        `UPDATE tasks SET status = $1, status_updated_at = NOW() ${status === 'blocked' ? '' : ', blocker_note = NULL, blocker_since = NULL'} WHERE id = $2`,
        [status, taskId]
      );

      if (status === 'done') {
        await pool.query('UPDATE tasks SET completed = true, completed_by = $1, completed_at = NOW() WHERE id = $2', [user.id, taskId]);
      } else {
        await pool.query('UPDATE tasks SET completed = false, completed_by = NULL, completed_at = NULL WHERE id = $2', [taskId]);
      }

      ctx.reply(`✅ Task #${taskId} updated to *${status}*`, { parse_mode: 'Markdown' });
    } catch (err) {
      console.error('Telegram status error:', err.message);
      ctx.reply('❌ Error updating task status.');
    }
  });

  // /assign <title> - Create a task
  bot.command('assign', async (ctx) => {
    const user = await findUser(ctx.from.id.toString());
    if (!user) return ctx.reply('❌ Not linked. Use /link <email> first.');

    const title = ctx.message.text.split(' ').slice(1).join(' ').trim();
    if (!title) {
      return ctx.reply('Usage: /assign <task title>');
    }

    const teamId = await findUserTeam(user.id);
    if (!teamId) return ctx.reply('❌ You are not in any team.');

    try {
      const result = await pool.query(
        `INSERT INTO tasks (team_id, title, priority, owner, owner_id, created_by, completed, created_at) VALUES ($1, $2, 'P2', $3, $4, $4, false, NOW()) RETURNING id`,
        [teamId, title, user.display_name, user.id]
      );

      await pool.query(
        `INSERT INTO activity_log (user_id, team_id, action, task_id, task_title) VALUES ($1, $2, 'task_created', $3, $4)`,
        [user.id, teamId, result.rows[0].id, title]
      );

      ctx.reply(`✅ Task created: *${title}* (#${result.rows[0].id})`, { parse_mode: 'Markdown' });
    } catch (err) {
      console.error('Telegram assign error:', err.message);
      ctx.reply('❌ Error creating task.');
    }
  });

  // In-memory store for pending AI-parsed tasks awaiting confirmation
  const pendingTasks = new Map();

  // /confirm - Confirm AI-parsed tasks
  bot.command('confirm', async (ctx) => {
    const user = await findUser(ctx.from.id.toString());
    if (!user) return ctx.reply('❌ Not linked. Use /link <email> first.');

    const chatId = ctx.chat.id.toString();
    const pending = pendingTasks.get(chatId);
    if (!pending || pending.userId !== user.id) {
      return ctx.reply('❌ No pending tasks to confirm.');
    }

    const teamId = await findUserTeam(user.id);
    if (!teamId) return ctx.reply('❌ You are not in any team.');

    try {
      const created = [];
      for (const task of pending.tasks) {
        // Resolve assignee name to user ID
        let assignedTo = null;
        if (task.assignedTo) {
          const assignee = await pool.query(
            `SELECT u.id FROM users u JOIN team_members tm ON u.id = tm.user_id WHERE tm.team_id = $1 AND LOWER(u.display_name) = LOWER($2)`,
            [teamId, task.assignedTo]
          );
          assignedTo = assignee.rows[0]?.id || null;
        }

        const result = await pool.query(
          `INSERT INTO tasks (team_id, title, priority, assigned_to, owner, owner_id, due_date, created_by, completed, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $6, false, NOW()) RETURNING id`,
          [teamId, task.title, task.priority || 'P2', assignedTo, user.display_name, user.id, task.dueDate || null]
        );

        await pool.query(
          `INSERT INTO activity_log (user_id, team_id, action, task_id, task_title) VALUES ($1, $2, 'task_created', $3, $4)`,
          [user.id, teamId, result.rows[0].id, task.title]
        );

        created.push(`#${result.rows[0].id} ${task.title}`);
      }

      pendingTasks.delete(chatId);
      ctx.reply(`✅ Created ${created.length} task(s):\n${created.join('\n')}`, { parse_mode: 'Markdown' });
    } catch (err) {
      console.error('Telegram confirm error:', err.message);
      ctx.reply('❌ Error creating tasks.');
    }
  });

  // /cancel - Cancel pending AI-parsed tasks
  bot.command('cancel', async (ctx) => {
    const chatId = ctx.chat.id.toString();
    if (pendingTasks.has(chatId)) {
      pendingTasks.delete(chatId);
      ctx.reply('🚫 Pending tasks cancelled.');
    } else {
      ctx.reply('No pending tasks to cancel.');
    }
  });

  // Natural language handler (AI parsing)
  bot.on('text', async (ctx) => {
    // Skip commands
    if (ctx.message.text.startsWith('/')) return;
    // Only process if AI_API_KEY is set
    if (!process.env.AI_API_KEY) return;

    const user = await findUser(ctx.from.id.toString());
    if (!user) return; // Don't respond to unlinked users for non-commands

    const teamId = await findUserTeam(user.id);
    if (!teamId) return;

    try {
      const { parseMessageToTasks } = require('./ai-parser');
      const members = await pool.query(
        'SELECT u.display_name FROM users u JOIN team_members tm ON u.id = tm.user_id WHERE tm.team_id = $1',
        [teamId]
      );

      const tasks = await parseMessageToTasks(ctx.message.text, members.rows);
      if (!tasks || tasks.length === 0) return; // No tasks detected, stay silent

      // Store pending tasks
      const chatId = ctx.chat.id.toString();
      pendingTasks.set(chatId, { userId: user.id, tasks, timestamp: Date.now() });

      // Auto-expire after 5 minutes
      setTimeout(() => {
        if (pendingTasks.has(chatId) && pendingTasks.get(chatId).timestamp === Date.now()) {
          pendingTasks.delete(chatId);
        }
      }, 5 * 60 * 1000);

      const preview = tasks.map((t, i) =>
        `${i + 1}. [${t.priority || 'P2'}] *${t.title}*${t.assignedTo ? ` → ${t.assignedTo}` : ''}${t.dueDate ? ` (due ${t.dueDate})` : ''}`
      ).join('\n');

      ctx.reply(
        `🤖 I detected ${tasks.length} task(s):\n\n${preview}\n\nReply /confirm to create or /cancel to discard.`,
        { parse_mode: 'Markdown' }
      );
    } catch (err) {
      console.error('AI parse error in bot:', err.message);
    }
  });

  // Start bot
  try {
    await bot.launch();
    console.log('📱 Telegram bot started');
  } catch (err) {
    console.error('Telegram bot launch error:', err.message);
    bot = null;
  }

  return bot;
}

function stopTelegramBot() {
  if (bot) {
    bot.stop('SIGTERM');
    bot = null;
  }
}

module.exports = { startTelegramBot, stopTelegramBot };
