import { env } from '@docuchat/config';
import { createPool } from '@docuchat/db';
import argon2 from 'argon2';

const slugify = (value: string) => {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
};

const main = async () => {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const tenantName = process.env.ADMIN_TENANT_NAME ?? 'DocuChat';

  if (!email || !password) {
    throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD are required');
  }

  const pool = createPool(env.databaseUrl);

  try {
    const existing = await pool.query('select id from users where email = $1', [email.toLowerCase()]);
    if (existing.rowCount > 0) {
      console.log('Admin user already exists');
      return;
    }

    const client = await pool.connect();
    try {
      await client.query('begin');

      const slugBase = slugify(tenantName) || 'docuchat';
      const tenantResult = await client.query(
        `insert into tenants (name, slug)
         values ($1, $2)
         returning id`,
        [tenantName, slugBase],
      );

      const tenantId = tenantResult.rows[0].id;
      const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

      const userResult = await client.query(
        `insert into users (email, password_hash, email_verified_at)
         values ($1, $2, now())
         returning id`,
        [email.toLowerCase(), passwordHash],
      );

      const userId = userResult.rows[0].id;

      await client.query(
        `insert into tenant_memberships (tenant_id, user_id, role)
         values ($1, $2, 'owner')`,
        [tenantId, userId],
      );

      await client.query('commit');
      console.log('Admin user seeded');
    } catch (err) {
      await client.query('rollback');
      throw err;
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
};

void main();
