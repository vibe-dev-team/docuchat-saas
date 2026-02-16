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
  const email = process.env.SMOKE_EMAIL;
  const password = process.env.SMOKE_PASSWORD;
  const tenantName = process.env.SMOKE_TENANT_NAME ?? 'DocuChat';

  if (!email || !password) {
    throw new Error('SMOKE_EMAIL and SMOKE_PASSWORD are required');
  }

  const pool = createPool(env.databaseUrl);
  const normalizedEmail = email.toLowerCase();

  try {
    const client = await pool.connect();
    try {
      await client.query('begin');

      const slugBase = slugify(tenantName) || 'docuchat';
      let tenantId: string | undefined;
      const tenantResult = await client.query('select id from tenants where slug = $1', [slugBase]);
      if (tenantResult.rowCount > 0) {
        tenantId = tenantResult.rows[0].id;
      } else {
        const created = await client.query(
          `insert into tenants (name, slug)
           values ($1, $2)
           returning id`,
          [tenantName, slugBase],
        );
        tenantId = created.rows[0].id;
      }

      const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

      const existingUser = await client.query('select id from users where email = $1', [normalizedEmail]);
      let userId: string;
      if (existingUser.rowCount > 0) {
        userId = existingUser.rows[0].id;
        await client.query(
          `update users set password_hash = $2, email_verified_at = now(), updated_at = now()
           where id = $1`,
          [userId, passwordHash],
        );
      } else {
        const createdUser = await client.query(
          `insert into users (email, password_hash, email_verified_at)
           values ($1, $2, now())
           returning id`,
          [normalizedEmail, passwordHash],
        );
        userId = createdUser.rows[0].id;
      }

      await client.query(
        `insert into tenant_memberships (tenant_id, user_id, role)
         values ($1, $2, 'owner')
         on conflict (tenant_id, user_id) do nothing`,
        [tenantId, userId],
      );

      await client.query('commit');
      console.log('Smoke user ready');
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
