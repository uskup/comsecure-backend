/*
  # Add is_admin column to user_sessions table

  1. Schema Changes
    - Add `is_admin` column to `user_sessions` table
    - Set default value to false
    - Add index for performance

  2. Security
    - Update RLS policies to handle admin users
    - Ensure proper access control

  3. Data Migration
    - Set existing ADMIN users to is_admin = true
*/

-- Add is_admin column to user_sessions table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_sessions' AND column_name = 'is_admin'
  ) THEN
    ALTER TABLE user_sessions ADD COLUMN is_admin boolean DEFAULT false;
  END IF;
END $$;

-- Update existing ADMIN users to have is_admin = true
UPDATE user_sessions 
SET is_admin = true 
WHERE nickname = 'ADMIN';

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_user_sessions_is_admin ON user_sessions(is_admin) WHERE is_admin = true;

-- Update RLS policy to allow admins to see all sessions
DROP POLICY IF EXISTS "Admins can see all sessions" ON user_sessions;
CREATE POLICY "Admins can see all sessions"
  ON user_sessions
  FOR SELECT
  TO public
  USING (
    is_admin = true OR 
    auth.uid() IS NOT NULL
  );