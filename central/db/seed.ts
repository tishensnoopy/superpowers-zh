import { pool } from '@/lib/db';
import { hashPassword } from '@/lib/auth';

async function seed() {
  const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@yousen.local';
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe123!';
  const hash = await hashPassword(password);
  await pool.query(
    `INSERT INTO admin_users (email, password_hash, role)
     VALUES ($1, $2, 'superadmin')
     ON CONFLICT (email) DO NOTHING`,
    [email, hash]
  );
  console.log(`[seed] superadmin ensured: ${email}`);
  await pool.end();
}

seed().catch((err) => {
  console.error('[seed] failed:', err);
  process.exit(1);
});
