-- ============================================================================
-- JWT TOKEN REVOCATION TABLE
-- ============================================================================
-- This table stores revoked JWT tokens (e.g., after logout)
-- 
-- When a user logs out, their JWT's jti (JWT ID) is added to this table
-- The AuthGuard will check this table on each request to reject revoked tokens
-- ============================================================================

-- Create the revoked_tokens table
CREATE TABLE IF NOT EXISTS revoked_tokens (
  id SERIAL PRIMARY KEY,
  jti VARCHAR(255) NOT NULL UNIQUE,           -- JWT ID (UUID) - unique identifier for the token
  user_id INTEGER,                            -- Optional: reference to users table for tracking
  revoked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,  -- When the token was revoked
  expires_at TIMESTAMP NOT NULL,              -- When the token would have expired (matches JWT exp)
  reason VARCHAR(255),                        -- Optional: reason for revocation (e.g., 'logout', 'security')
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_revoked_tokens_jti ON revoked_tokens(jti);
CREATE INDEX IF NOT EXISTS idx_revoked_tokens_expires_at ON revoked_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_revoked_tokens_user_id ON revoked_tokens(user_id);

-- Optional: Create a function to clean up expired revoked tokens (run periodically)
-- This keeps the table from growing indefinitely
CREATE OR REPLACE FUNCTION cleanup_expired_revoked_tokens()
RETURNS void AS $$
BEGIN
  DELETE FROM revoked_tokens WHERE expires_at < CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- USAGE EXAMPLES
-- ============================================================================

-- Insert a revoked token when user logs out:
-- INSERT INTO revoked_tokens (jti, user_id, expires_at, reason)
-- VALUES ('550e8400-e29b-41d4-a716-446655440000', 1, '2025-11-18 10:30:00', 'logout');

-- Check if a token is revoked (used in AuthGuard):
-- SELECT EXISTS(SELECT 1 FROM revoked_tokens WHERE jti = $1);

-- Clean up expired tokens (run daily via cron job):
-- SELECT cleanup_expired_revoked_tokens();

-- ============================================================================
-- NOTES
-- ============================================================================
-- 1. The jti column must be UNIQUE because each JWT has one unique jti
-- 2. The expires_at should match the JWT's exp claim (typically 7 days from issue)
-- 3. Expired entries can be deleted periodically using the cleanup function
-- 4. For performance, consider archiving old entries to a separate table before deletion
-- 5. Add user_id foreign key constraint if you want referential integrity:
--    ALTER TABLE revoked_tokens ADD CONSTRAINT fk_user_id 
--    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
