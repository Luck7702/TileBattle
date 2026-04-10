
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
      username text not null unique,
      password_hash text not null,
      created_at timestamptz not null default now()
    );
  `);

  await pool.query(`
    create table if not exists rooms (
      id bigserial primary key,
      code text not null unique,
      owner_user_id bigint not null references users(id) on delete cascade,
      created_at timestamptz not null default now()
    );
  `);
}

module.exports = { getPool, migrate };

