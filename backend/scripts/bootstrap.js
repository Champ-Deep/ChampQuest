/**
 * Bootstrap script - ensures superadmin exists
 * Run this once on first deployment to create initial admin
 */

require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/champquest',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function bootstrap() {
  console.log('🚀 Running bootstrap...\n');

  try {
    // Check if any superadmin exists
    const superadminCheck = await pool.query(
      "SELECT id FROM users WHERE global_role = 'superadmin'"
    );

    if (superadminCheck.rows.length > 0) {
      console.log(`✅ Found ${superadminCheck.rows.length} superadmin(s). No bootstrap needed.`);
      await pool.end();
      return;
    }

    console.log('⚠️  No superadmin found. Creating default admin...\n');

    // Create default admin account
    const defaultEmail = process.env.SUPERADMIN_EMAIL || 'admin@champquest.local';
    const defaultPassword = process.env.SUPERADMIN_PASSWORD || 'ChampQuestAdmin2026!';
    const defaultName = process.env.SUPERADMIN_NAME || 'Admin';

    const passwordHash = await bcrypt.hash(defaultPassword, 10);

    const result = await pool.query(
      `INSERT INTO users (email, password_hash, display_name, global_role)
       VALUES ($1, $2, $3, 'superadmin')
       RETURNING id, email, display_name`,
      [defaultEmail, passwordHash, defaultName]
    );

    const admin = result.rows[0];

    console.log('✅ Superadmin created successfully!');
    console.log(`   Email: ${admin.email}`);
    console.log(`   Name: ${admin.display_name}`);
    console.log(`   Password: ${defaultPassword}`);
    console.log('\n⚠️  IMPORTANT: Change the default password after first login!');
    console.log('   Set SUPERADMIN_PASSWORD env var for future deployments.\n');

    // Create default team for this admin
    const teamResult = await pool.query(
      `INSERT INTO teams (name, code, created_by)
       VALUES ($1, $2, $3)
       RETURNING id, name, code`,
      ['Champions Accelerator', 'CHAMP2026', admin.id]
    );

    const team = teamResult.rows[0];

    // Add admin as team admin
    await pool.query(
      `INSERT INTO team_members (user_id, team_id, role, xp, streak, tasks_completed, mascot_color, joined_at)
       VALUES ($1, $2, 'admin', 0, 0, 0, 'red', NOW())`,
      [admin.id, team.id]
    );

    console.log(`✅ Default team created: ${team.name} (code: ${team.code})`);
    console.log(`   Admin has been added as team admin.\n`);

    await pool.end();
    console.log('✅ Bootstrap complete!');

  } catch (err) {
    console.error('❌ Bootstrap failed:', err.message);
    await pool.end();
    process.exit(1);
  }
}

bootstrap();