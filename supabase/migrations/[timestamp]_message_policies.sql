-- Channel Messages Tabelle erstellen
CREATE TABLE IF NOT EXISTS channel_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid REFERENCES channels(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS aktivieren
ALTER TABLE channel_messages ENABLE ROW LEVEL SECURITY;

-- Policies für Channel Messages
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

-- Indizes für bessere Performance
CREATE INDEX channel_messages_channel_id_idx ON channel_messages(channel_id);
CREATE INDEX channel_messages_user_id_idx ON channel_messages(user_id);

-- Realtime aktivieren
ALTER PUBLICATION supabase_realtime ADD TABLE channel_messages;