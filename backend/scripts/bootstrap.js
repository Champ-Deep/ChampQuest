/**
 * Bootstrap module - ensures superadmin exists
 * Called from server.js after schema is applied to guarantee tables exist
 */

const bcrypt = require('bcrypt');

async function bootstrap(pool) {
  console.log('🚀 Running bootstrap...');

  try {
    // Check if any superadmin exists
    const superadminCheck = await pool.query(
      "SELECT id FROM users WHERE global_role = 'superadmin'"
    );

    if (superadminCheck.rows.length > 0) {
      console.log(`✅ Found ${superadminCheck.rows.length} superadmin(s). No bootstrap needed.`);
      return;
    }

    console.log('⚠️  No superadmin found. Creating default admin...');

    // Create default admin account
    const defaultEmail = process.env.SUPERADMIN_EMAIL || 'admin@champquest.local';
    const defaultPassword = process.env.SUPERADMIN_PASSWORD || 'ChampQuestAdmin2026!';
    const defaultName = process.env.SUPERADMIN_NAME || 'Admin';

    const passwordHash = await bcrypt.hash(defaultPassword, 10);

    const result = await pool.query(
      `INSERT INTO users (email, password_hash, display_name, global_role)
       VALUES ($1, $2, $3, 'superadmin')
       ON CONFLICT (email) DO NOTHING
       RETURNING id, email, display_name`,
      [defaultEmail, passwordHash, defaultName]
    );

    if (result.rows.length === 0) {
      console.log('✅ Superadmin email already exists. Skipping bootstrap.');
      return;
    }

    const admin = result.rows[0];

    console.log('✅ Superadmin created successfully!');
    console.log(`   Email: ${admin.email}`);
    console.log(`   Name: ${admin.display_name}`);

    // Create default team for this admin
    const teamResult = await pool.query(
      `INSERT INTO teams (name, code, created_by)
       VALUES ($1, $2, $3)
       ON CONFLICT (code) DO NOTHING
       RETURNING id, name, code`,
      ['Champions Accelerator', 'CHAMP2026', admin.id]
    );

    if (teamResult.rows.length > 0) {
      const team = teamResult.rows[0];

      // Add admin as team admin
      await pool.query(
        `INSERT INTO team_members (user_id, team_id, role, xp, streak, tasks_completed, mascot_color, joined_at)
         VALUES ($1, $2, 'admin', 0, 0, 0, 'red', NOW())
         ON CONFLICT (user_id, team_id) DO NOTHING`,
        [admin.id, team.id]
      );

      console.log(`✅ Default team created: ${team.name} (code: ${team.code})`);
    }

    console.log('✅ Bootstrap complete!');

  } catch (err) {
    // Bootstrap failure should not prevent server from starting
    console.error('⚠️  Bootstrap warning:', err.message || err);
    console.error('   Server will continue without bootstrap. Run manually later if needed.');
  }
}

module.exports = { bootstrap };