import { pool } from '../lib/db';
import { hashPassword } from '../lib/auth';

async function seed() {
  const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@yousen.local';
  // 优先读取 INITIAL_ADMIN_PASSWORD（与 README / .env.example / docker-compose.yml 保持一致），
  // 回退到 SEED_ADMIN_PASSWORD（向后兼容旧脚本），最终默认值用于本地开发。
  const password =
    process.env.INITIAL_ADMIN_PASSWORD ||
    process.env.SEED_ADMIN_PASSWORD ||
    'ChangeMe123!';
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
