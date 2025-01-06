-- Füge neue Spalten zur servers Tabelle hinzu
ALTER TABLE servers
ADD COLUMN IF NOT EXISTS description text,
ADD COLUMN IF NOT EXISTS is_private boolean DEFAULT false;

-- Aktualisiere die Berechtigungen
CREATE POLICY "Server owners can update their servers"
  ON servers FOR UPDATE
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Server owners can delete their servers"
  ON servers FOR DELETE
  USING (auth.uid() = owner_id); 