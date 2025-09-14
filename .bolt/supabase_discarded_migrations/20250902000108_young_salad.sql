/*
  # Add Missing Admin and Message Deletion Columns

  1. Table Updates
    - Add `is_admin` column to `user_sessions` table
    - Add `is_deleted`, `deleted_by`, `deleted_at` columns to `messages` table
  
  2. Security
    - Update RLS policies to handle new columns
    - Add admin message deletion function
    - Create admin view for monitoring deleted messages
  
  3. Functions
    - `delete_message_admin`: Function for admin to soft delete messages
    - `update_updated_at_column`: Trigger function for timestamp updates
*/

-- Add missing columns to user_sessions table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_sessions' AND column_name = 'is_admin'
  ) THEN
    ALTER TABLE user_sessions ADD COLUMN is_admin boolean DEFAULT false;
  END IF;
END $$;

-- Add missing columns to messages table
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

-- Create admin view for monitoring all messages including deleted ones
CREATE OR REPLACE VIEW admin_messages AS
SELECT 
  m.id,
  m.channel_id,
  m.nickname,
  m.content,
  m.created_at,
  m.is_deleted,
  m.deleted_by,
  m.deleted_at,
  c.name as channel_name
FROM messages m
JOIN channels c ON m.channel_id = c.id
ORDER BY m.created_at DESC;

-- Create function for admin to delete messages
CREATE OR REPLACE FUNCTION delete_message_admin(
  message_id uuid,
  admin_nickname text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if the user is admin
  IF NOT EXISTS (
    SELECT 1 FROM user_sessions 
    WHERE nickname = admin_nickname 
    AND is_admin = true 
    AND is_online = true
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
$$;

-- Grant necessary permissions
GRANT SELECT ON admin_messages TO anon, authenticated;
GRANT EXECUTE ON FUNCTION delete_message_admin TO anon, authenticated;