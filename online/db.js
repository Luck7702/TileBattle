
const { Pool } = require("pg");


function getPool() {
  //
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required (Railway Postgres).");
  }
  
  return new Pool({
    connectionString,
    ssl:
      process.env.NODE_ENV === "production"
        ? { rejectUnauthorized: false }
        : undefined,
  });
}

async function migrate(pool) {
  await pool.query(`
    create table if not exists users (
      id bigserial primary key,
      username varchar(16) not null unique,
      password_hash text not null,
      created_at timestamptz not null default now()
    );
  `);

  // Ensure stats columns exist for game logic and profile dashboard
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS wins INTEGER DEFAULT 0;`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS losses INTEGER DEFAULT 0;`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS rank_points INTEGER DEFAULT 1000;`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_user_rank ON users (rank_points DESC, wins DESC);`);

  await pool.query(`
    create table if not exists admins (
      id serial primary key,
      username varchar(32) not null unique,
      password_hash text not null,
      created_at timestamptz not null default now()
    );
  `);

  await pool.query(`
    create table if not exists rooms (
      id bigserial primary key,
      code text unique not null,
      owner_user_id bigint not null references users(id) on delete cascade,
      created_at timestamptz not null default now()
    );
  `);
}

module.exports = { getPool, migrate };
