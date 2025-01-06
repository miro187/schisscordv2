import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';
import { useState } from 'react';
import Layout from '../../../components/Layout';

export default function MusicUpload() {
  const supabase = useSupabaseClient();
  const user = useUser();
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      
      if (!e.target.files || !e.target.files[0]) return;
      
      const file = e.target.files[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;

      // Upload zur Musik bucket
      const { error: uploadError } = await supabase.storage
        .from('musik')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // URL der Datei holen
      const { data: { signedUrl } } = await supabase.storage
        .from('musik')
        .createSignedUrl(filePath, 3600);

      // Track in der Datenbank speichern
      const { error: dbError } = await supabase
        .from('music_tracks')
        .insert({
          title: file.name.replace(`.${fileExt}`, ''),
          file_url: filePath,
          uploaded_by: user?.id
        });

      if (dbError) throw dbError;

    } catch (error) {
      console.error('Error uploading:', error);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex-1 p-6">
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">Musik hochladen</h1>
        
        <input
          type="file"
          accept=".mp3"
          onChange={handleUpload}
          disabled={uploading}
          className="block w-full text-sm text-gray-500
            file:mr-4 file:py-2 file:px-4
            file:rounded-full file:border-0
            file:text-sm file:font-semibold
            file:bg-violet-50 file:text-violet-700
            hover:file:bg-violet-100"
        />
        
        {uploading && <p>Wird hochgeladen...</p>}
      </div>
    </div>
  );
} 