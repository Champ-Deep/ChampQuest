/**
 * Bootstrap module - ensures superadmin exists and credentials stay in sync
 * Called from server.js after schema is applied to guarantee tables exist
 */

const bcrypt = require('bcrypt');

async function bootstrap(pool) {
  console.log('🚀 Running bootstrap...');

  try {
    const envEmail = process.env.SUPERADMIN_EMAIL;
    const envPassword = process.env.SUPERADMIN_PASSWORD;
    const envName = process.env.SUPERADMIN_NAME || 'Admin';

    if (envEmail) {
      // --- Env-var-driven sync mode ---

      // Check if this email is already a superadmin
      const exactMatch = await pool.query(
        "SELECT id FROM users WHERE email = $1 AND global_role = 'superadmin'",
        [envEmail]
      );

      if (exactMatch.rows.length > 0) {
        // Email matches — sync password to handle rotations
        if (envPassword) {
          const passwordHash = await bcrypt.hash(envPassword, 10);
          await pool.query(
            'UPDATE users SET password_hash = $1, display_name = $2 WHERE id = $3',
            [passwordHash, envName, exactMatch.rows[0].id]
          );
        }
        console.log(`✅ Superadmin verified and credentials synced: ${envEmail}`);
        return;
      }

      // Check if a non-superadmin user already has this email (avoid unique constraint violation)
      const emailTaken = await pool.query(
        "SELECT id, global_role FROM users WHERE email = $1",
        [envEmail]
      );

      if (emailTaken.rows.length > 0) {
        // Promote existing user to superadmin
        const passwordHash = await bcrypt.hash(envPassword || 'ChampQuestAdmin2026!', 10);
        await pool.query(
          "UPDATE users SET global_role = 'superadmin', password_hash = $1, display_name = $2 WHERE email = $3",
          [passwordHash, envName, envEmail]
        );
        console.log(`✅ Existing user promoted to superadmin: ${envEmail}`);
        return;
      }

      // Check if any other superadmin exists that needs updating
      const anySuperadmin = await pool.query(
        "SELECT id, email FROM users WHERE global_role = 'superadmin' ORDER BY id ASC LIMIT 1"
      );

      if (anySuperadmin.rows.length > 0) {
        // Update the existing superadmin's credentials to match env vars
        const oldEmail = anySuperadmin.rows[0].email;
        const passwordHash = await bcrypt.hash(envPassword || 'ChampQuestAdmin2026!', 10);
        await pool.query(
          'UPDATE users SET email = $1, password_hash = $2, display_name = $3 WHERE id = $4',
          [envEmail, passwordHash, envName, anySuperadmin.rows[0].id]
        );
        console.log(`✅ Superadmin credentials updated: ${oldEmail} -> ${envEmail}`);
        return;
      }

      // No superadmin exists — fall through to creation below

    } else {
      // --- Legacy mode: no SUPERADMIN_EMAIL env var ---
      const superadminCheck = await pool.query(
        "SELECT id FROM users WHERE global_role = 'superadmin'"
      );

      if (superadminCheck.rows.length > 0) {
        console.log(`✅ Found ${superadminCheck.rows.length} superadmin(s). No bootstrap needed.`);
        return;
      }
    }

    // --- Create new superadmin ---
    console.log('⚠️  No superadmin found. Creating default admin...');

    const defaultEmail = envEmail || 'admin@champquest.local';
    const defaultPassword = envPassword || 'ChampQuestAdmin2026!';
    const passwordHash = await bcrypt.hash(defaultPassword, 10);

    const result = await pool.query(
      `INSERT INTO users (email, password_hash, display_name, global_role)
       VALUES ($1, $2, $3, 'superadmin')
       ON CONFLICT (email) DO NOTHING
       RETURNING id, email, display_name`,
      [defaultEmail, passwordHash, envName]
    );

    if (result.rows.length === 0) {
      console.log('✅ Superadmin email already exists. Skipping bootstrap.');
      return;
    }

    const admin = result.rows[0];
    console.log(`✅ Superadmin created: ${admin.email} (${admin.display_name})`);

    // Create default team
    const teamResult = await pool.query(
      `INSERT INTO teams (name, code, created_by)
       VALUES ($1, $2, $3)
       ON CONFLICT (code) DO NOTHING
       RETURNING id, name, code`,
      ['Champions Accelerator', 'CHAMP2026', admin.id]
    );

    if (teamResult.rows.length > 0) {
      const team = teamResult.rows[0];
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
