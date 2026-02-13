/**
 * Migration script - imports existing JSON data into PostgreSQL
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/champquest'
});

async function migrate() {
  console.log('🚀 Starting migration from JSON files...\n');

  try {
    // Read JSON files
    const basePath = path.join(__dirname, '..', '..', '..');
    const dbTasksPath = path.join(basePath, 'champ-quest-database.json');
    const importedTasksPath = path.join(basePath, 'imported-tasks.json');

    let dbTasks = [];
    let importedTasks = [];

    if (fs.existsSync(dbTasksPath)) {
      const data = JSON.parse(fs.readFileSync(dbTasksPath, 'utf8'));
      dbTasks = Array.isArray(data) ? data : (data.tasks || []);
      console.log(`📄 Loaded ${dbTasks.length} tasks from champ-quest-database.json`);
    }

    if (fs.existsSync(importedTasksPath)) {
      const data = JSON.parse(fs.readFileSync(importedTasksPath, 'utf8'));
      importedTasks = Array.isArray(data) ? data : (data.tasks || []);
      console.log(`📄 Loaded ${importedTasks.length} tasks from imported-tasks.json`);
    }

    // Check or create Champions Accelerator team
    console.log('\n🏆 Creating/verifying Champions Accelerator team...');
    let team = await pool.query('SELECT id FROM teams WHERE name = $1', ['Champions Accelerator']);

    if (team.rows.length === 0) {
      const result = await pool.query(
        `INSERT INTO teams (name, code, created_by) VALUES ($1, $2, 1)
         RETURNING id, name, code`,
        ['Champions Accelerator', 'CHAMP2026']
      );
      team = result;
      console.log(`   Created team: ${team.rows[0].name} (code: ${team.rows[0].code})`);
    } else {
      console.log(`   Team already exists: Champions Accelerator (ID: ${team.rows[0].id})`);
    }

    const teamId = team.rows[0].id;

    // Ensure admin user exists (user ID 1)
    const adminCheck = await pool.query('SELECT id FROM users WHERE id = 1');
    if (adminCheck.rows.length === 0) {
      console.log('   ⚠️  Admin user (ID 1) not found. Run server first to create admin.');
    }

    // Import all tasks
    const allTasks = [...dbTasks, ...importedTasks];
    let imported = 0;
    let duplicates = 0;

    for (const task of allTasks) {
      const existing = await pool.query(
        'SELECT id FROM tasks WHERE team_id = $1 AND title = $2',
        [teamId, task.title]
      );

      if (existing.rows.length === 0) {
        await pool.query(
          `INSERT INTO tasks (team_id, title, priority, category, completed, created_by, created_at)
           VALUES ($1, $2, $3, $4, $5, 1, NOW())`,
          [teamId, task.title, task.priority || 'P2', task.category || null, task.completed || false]
        );
        imported++;
      } else {
        duplicates++;
      }
    }

    console.log(`\n📊 Migration complete!`);
    console.log(`   Imported: ${imported} tasks`);
    console.log(`   Skipped (duplicates): ${duplicates}`);
    console.log(`   Team: Champions Accelerator (ID: ${teamId})`);

    // Verify counts
    const taskCount = await pool.query('SELECT COUNT(*) FROM tasks WHERE team_id = $1', [teamId]);
    console.log(`   Total tasks in team: ${taskCount.rows[0].count}`);

    await pool.end();
    console.log('\n✅ Migration completed successfully!');

  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    await pool.end();
    process.exit(1);
  }
}

migrate();