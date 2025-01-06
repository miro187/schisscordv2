-- Create voice_channel_members table
CREATE TABLE IF NOT EXISTS voice_channel_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid REFERENCES channels(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at timestamptz DEFAULT now(),
  UNIQUE(channel_id, user_id)
);

-- Enable RLS
ALTER TABLE voice_channel_members ENABLE ROW LEVEL SECURITY;

-- Policies for voice channel members
CREATE POLICY "Users can join voice channels they have access to"
  ON voice_channel_members
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM channels c
      JOIN channel_members cm ON cm.channel_id = c.id
      WHERE c.id = channel_id
      AND cm.user_id = auth.uid()
      AND c.type = 'voice'
    )
  );

CREATE POLICY "Users can view voice channel members"
  ON voice_channel_members
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM channels c
      JOIN channel_members cm ON cm.channel_id = c.id
      WHERE c.id = channel_id
      AND cm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can leave voice channels"
  ON voice_channel_members
  FOR DELETE
  USING (auth.uid() = user_id);

-- Enable realtime for voice channel members
ALTER PUBLICATION supabase_realtime ADD TABLE voice_channel_members; 