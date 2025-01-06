import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';
import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/Layout/AppLayout';

interface Track {
  id: string;
  title: string;
  artist: string;
  duration: number;
  file_url: string;
}

export default function MusicPage() {
  const supabase = useSupabaseClient();
  const user = useUser();
  const [tracks, setTracks] = useState<Track[]>([]);

  useEffect(() => {
    loadTracks();
  }, []);

  const loadTracks = async () => {
    const { data, error } = await supabase
      .from('music_tracks')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading tracks:', error);
      return;
    }

    const tracksWithSignedUrls = await Promise.all(
      data.map(async (track) => {
        const { data: { signedUrl } } = await supabase.storage
          .from('musik')
          .createSignedUrl(track.file_url, 3600);

        return {
          ...track,
          file_url: signedUrl
        };
      })
    );

    setTracks(tracksWithSignedUrls || []);
  };

  return (
    <AppLayout>
      <div className="flex-1 p-6">
        <h1 className="text-2xl font-bold mb-6">Musik</h1>
        
        <div className="grid gap-4">
          {tracks.map((track) => (
            <div 
              key={track.id}
              className="bg-gray-800 p-4 rounded-lg flex items-center justify-between"
            >
              <div>
                <h3 className="font-medium">{track.title}</h3>
                <p className="text-sm text-gray-400">{track.artist}</p>
              </div>
              <audio controls src={track.file_url} className="max-w-[300px]" />
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  );
} 