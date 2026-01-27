-- backend\src\db\migrations\001_auth.sql

-- ==========================================
-- Migration: 004_auth.sql
-- Purpose: Authentication base tables
-- ==========================================

BEGIN;

-- -------------------------------------
-- REFRESH TOKENS / SESSIONS
----------------------------------------
CREATE TABLE IF NOT EXISTS refresh_tokens (
 token_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

 user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,

 token TEXT NOT NULL UNIQUE,
 expiration_date TIMESTAMPTZ NOT NULL,

 revoked BOOLEAN DEFAULT FALSE,

 user_agent TEXT,

 ip_address TEXT, 

 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMIT;
