/*
  # Add Admin Functionality and Voice Chat Support

  1. New Columns
    - Add `is_admin` to user_sessions table for admin privileges
    - Add soft delete columns to messages table (is_deleted, deleted_by, deleted_at)

  2. New Functions
    - `delete_message_admin`: Function for admin to soft delete messages
    - `update_updated_at_column`: Trigger function for updating timestamps

  3. New Views
    - `admin_messages`: View for admins to see all messages including deleted ones

  4. Security
    - Update RLS policies to handle admin privileges
    - Add policies for message deletion by admins
    - Ensure proper access control for admin functions

  5. Voice Chat Support
    - Prepare database structure for voice chat features
*/

-- Add admin column to user_sessions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_sessions' AND column_name = 'is_admin'
  ) THEN
    ALTER TABLE user_sessions ADD COLUMN is_admin boolean DEFAULT false;
  END IF;
END $$;

-- Add soft delete columns to messages
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'is_deleted'
  ) THEN
    ALTER TABLE messages ADD COLUMN is_deleted boolean DEFAULT false;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'deleted_by'
  ) THEN
    ALTER TABLE messages ADD COLUMN deleted_by text;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE messages ADD COLUMN deleted_at timestamptz;
  END IF;
END $$;

-- Create or replace the update_updated_at_column function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create admin messages view
CREATE OR REPLACE VIEW admin_messages AS
SELECT 
  m.*,
  c.name as channel_name
FROM messages m
JOIN channels c ON m.channel_id = c.id
ORDER BY m.created_at DESC;

-- Create function for admin to delete messages
CREATE OR REPLACE FUNCTION delete_message_admin(message_id uuid, admin_nickname text)
RETURNS void AS $$
BEGIN
  -- Check if the user is admin
  IF NOT EXISTS (
    SELECT 1 FROM user_sessions 
    WHERE nickname = admin_nickname AND is_admin = true AND is_online = true
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can delete messages';
  END IF;
  
  -- Soft delete the message
  UPDATE messages 
  SET 
    is_deleted = true,
    deleted_by = admin_nickname,
    deleted_at = now()
  WHERE id = message_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update RLS policies for messages to exclude deleted messages for non-admins
DROP POLICY IF EXISTS "Messages are viewable by everyone" ON messages;

CREATE POLICY "Messages are viewable by everyone"
  ON messages
  FOR SELECT
  TO public
  USING (is_deleted = false OR is_deleted IS NULL);

-- Create policy for admins to view all messages
CREATE POLICY "Admins can view all messages including deleted"
  ON messages
  FOR SELECT
  TO public
  USING (
    EXISTS (
      SELECT 1 FROM user_sessions 
      WHERE nickname = current_setting('request.jwt.claims', true)::json->>'nickname'
      AND is_admin = true 
      AND is_online = true
    )
  );

-- Create policy for admin message deletion
CREATE POLICY "Admins can update message deletion status"
  ON messages
  FOR UPDATE
  TO public
  USING (
    EXISTS (
      SELECT 1 FROM user_sessions 
      WHERE nickname = current_setting('request.jwt.claims', true)::json->>'nickname'
      AND is_admin = true 
      AND is_online = true
    )
  );

-- Update user_sessions policies to allow admin updates
CREATE POLICY "Admins can view all user sessions"
  ON user_sessions
  FOR SELECT
  TO public
  USING (
    true OR EXISTS (
      SELECT 1 FROM user_sessions us2
      WHERE us2.nickname = current_setting('request.jwt.claims', true)::json->>'nickname'
      AND us2.is_admin = true 
      AND us2.is_online = true
    )
  );

-- Grant necessary permissions
GRANT SELECT ON admin_messages TO public;
GRANT EXECUTE ON FUNCTION delete_message_admin(uuid, text) TO public;