-- Create voice_signals table for WebRTC signaling
CREATE TABLE IF NOT EXISTS voice_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid REFERENCES channels(id) ON DELETE CASCADE,
  from_user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  to_user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  signal jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE voice_signals ENABLE ROW LEVEL SECURITY;

-- Policies for voice signals
CREATE POLICY "Users can insert their own signals"
  ON voice_signals
  FOR INSERT
  WITH CHECK (auth.uid() = from_user_id);

CREATE POLICY "Users can read signals addressed to them"
  ON voice_signals
  FOR SELECT
  USING (auth.uid() = to_user_id);

-- Add cleanup trigger to automatically delete old signals
CREATE OR REPLACE FUNCTION delete_old_voice_signals() RETURNS trigger AS $$
BEGIN
  DELETE FROM voice_signals
  WHERE created_at < NOW() - INTERVAL '5 minutes';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER cleanup_old_voice_signals
  AFTER INSERT ON voice_signals
  EXECUTE FUNCTION delete_old_voice_signals();

-- Enable realtime for voice signals
ALTER PUBLICATION supabase_realtime ADD TABLE voice_signals; 