-- TileBattle Database Schema

-- Users table for account management
CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    username VARCHAR(16) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    rank_points INTEGER DEFAULT 1000,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Separate entity for Administrators
CREATE TABLE IF NOT EXISTS admins (
    id SERIAL PRIMARY KEY,
    username VARCHAR(32) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for high-performance ranking subqueries
CREATE INDEX IF NOT EXISTS idx_user_rank ON users (rank_points DESC, wins DESC);

-- Rooms table for tracking active game sessions
CREATE TABLE IF NOT EXISTS rooms (
    id BIGSERIAL PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    owner_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);