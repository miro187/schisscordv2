/*
  # Initial Schema Setup for Chat App

  1. New Tables
    - profiles
      - id (uuid, primary key)
      - username (text)
      - avatar_url (text)
      - status (text)
      - created_at (timestamp)
      - updated_at (timestamp)
    
    - channels
      - id (uuid, primary key)
      - name (text)
      - description (text)
      - created_at (timestamp)
      - created_by (uuid, references profiles)
    
    - messages
      - id (uuid, primary key)
      - channel_id (uuid, references channels)
      - user_id (uuid, references profiles)
      - content (text)
      - created_at (timestamp)
      - updated_at (timestamp)
    
    - channel_members
      - channel_id (uuid, references channels)
      - user_id (uuid, references profiles)
      - role (text)
      - joined_at (timestamp)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users
*/

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  username text UNIQUE NOT NULL,
  avatar_url text,
  status text DEFAULT 'offline',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create channels table
CREATE TABLE IF NOT EXISTS channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL
);

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid REFERENCES channels(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create channel_members table
CREATE TABLE IF NOT EXISTS channel_members (
  channel_id uuid REFERENCES channels(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  role text DEFAULT 'member',
  joined_at timestamptz DEFAULT now(),
  PRIMARY KEY (channel_id, user_id)
);

-- Create channel_messages table
CREATE TABLE IF NOT EXISTS channel_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid REFERENCES channels(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_messages ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Public profiles are viewable by everyone"
  ON profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Channels policies
CREATE POLICY "Channels are viewable by members"
  ON channels FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM channel_members
      WHERE channel_id = channels.id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Authenticated users can create channels"
  ON channels FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Messages policies
CREATE POLICY "Messages are viewable by channel members"
  ON messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM channel_members
      WHERE channel_id = messages.channel_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Channel members can insert messages"
  ON messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM channel_members
      WHERE channel_id = messages.channel_id
      AND user_id = auth.uid()
    )
  );

-- Channel members policies
CREATE POLICY "Channel members are viewable by other members"
  ON channel_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM channel_members cm
      WHERE cm.channel_id = channel_members.channel_id
      AND cm.user_id = auth.uid()
    )
  );

-- Channel messages policies
CREATE POLICY "Channel members can view messages"
  ON channel_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM channel_members
      WHERE channel_id = channel_messages.channel_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Channel members can insert messages"
  ON channel_messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM channel_members
      WHERE channel_id = channel_messages.channel_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own messages"
  ON channel_messages FOR DELETE
  USING (auth.uid() = user_id);

-- Create index for better query performance
CREATE INDEX channel_messages_channel_id_idx ON channel_messages(channel_id);
CREATE INDEX channel_messages_user_id_idx ON channel_messages(user_id);

-- Enable realtime for channel_messages
ALTER PUBLICATION supabase_realtime ADD TABLE channel_messages;