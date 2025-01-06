-- Erstelle Bucket-Policies für 'musik'

-- Nur Admins können Dateien hochladen
CREATE POLICY "Allow admin uploads" 
ON storage.objects FOR INSERT 
TO authenticated 
USING (
    bucket_id = 'musik' 
    AND auth.uid() IN (
        SELECT id FROM auth.users WHERE is_admin = true
    )
);

-- Authentifizierte Benutzer können Dateien lesen
CREATE POLICY "Allow authenticated read" 
ON storage.objects FOR SELECT 
TO authenticated 
USING (bucket_id = 'musik');

-- Keine DELETE-Policy - nur über Admin-Panel/Backend möglich 