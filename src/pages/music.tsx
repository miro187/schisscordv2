import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAudio } from '../contexts/AudioContext';

interface Track {
  id: string;
  name: string;
  url: string;
  created_at: string;
}

export default function MusicPage() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const { setCurrentTrack, setTracks: setAudioTracks, playTrack, pauseTrack, nextTrack, playerMode, setPlayerMode } = useAudio();

  useEffect(() => {
    loadTracks();
  }, []);

  const loadTracks = async () => {
    try {
      const { data, error } = await supabase.storage
        .from('musik')
        .list();

      if (error) throw error;
      if (!data || data.length === 0) {
        setTracks([]);
        setAudioTracks([]);
        return;
      }

      const tracksWithUrls = await Promise.all(
        data.filter(file => file.name.endsWith('.mp4')).map(async (file) => {
          const baseName = file.name.replace('.mp4', '');
          
          const { data: videoData } = await supabase.storage
            .from('musik')
            .createSignedUrl(file.name, 3600);

          return {
            id: file.id,
            name: baseName,
            url: videoData?.signedUrl || '',
            created_at: file.created_at
          };
        })
      );

      setTracks(tracksWithUrls);
      setAudioTracks(tracksWithUrls);
    } catch (error) {
      console.error('Error loading tracks:', error);
      setTracks([]);
      setAudioTracks([]);
    }
  };

  const filteredTracks = tracks.filter(track =>
    track.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex-1 p-6 relative bg-gray-900">
      <div className="relative z-10">
        <div className="flex flex-col items-center mb-6 space-y-4">
          <h1 className="text-2xl font-bold"></h1>
          <div className="w-full max-w-md">
            <input
              type="text"
              placeholder="Nach Songs suchen..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 bg-gray-800/50 rounded-lg border border-gray-700/50 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-center"
            />
          </div>
          
          <div className="flex items-center gap-3 bg-gray-800/50 p-2 rounded-lg">
            <button
              className={`px-4 py-2 rounded-lg transition-all ${
                playerMode === 'main'
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
              onClick={() => setPlayerMode('main')}
            >
              Hauptplayer
            </button>
            <button
              className={`px-4 py-2 rounded-lg transition-all ${
                playerMode === 'mini'
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
              onClick={() => setPlayerMode('mini')}
            >
              Mini-Player
            </button>
          </div>
        </div>
        
        {playerMode === 'main' && (
          <div className="h-[calc(100vh-8rem)] overflow-y-auto scroll-smooth pr-2">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-8">
              {filteredTracks.length === 0 ? (
                <div className="text-center text-gray-500 py-8 col-span-full">
                  {searchQuery ? 'Keine Ergebnisse gefunden' : 'Keine Musik verfügbar'}
                </div>
              ) : (
                filteredTracks.map((track) => (
                  <div 
                    key={track.id}
                    className="bg-gray-800/30 rounded-xl p-3 flex flex-col hover:bg-gray-700 transition-all hover:shadow-xl hover:scale-[1.02] group"
                  >
                    <div className="aspect-square mb-3 bg-indigo-600/10 rounded-lg overflow-hidden">
                      <video 
                        src={track.url}
                        className="w-full h-full object-cover"
                        id={`video-${track.id}`}
                        muted
                      />
                    </div>
                    
                    <div className="mb-3">
                      <h3 className="font-medium text-white text-base mb-1 truncate">
                        {track.name}
                      </h3>
                      <p className="text-xs text-gray-400">
                        {new Date(track.created_at).toLocaleDateString()}
                      </p>
                    </div>

                    <div className="mt-auto">
                      <audio 
                        controls 
                        src={track.url} 
                        className="w-full audio-player"
                        onPlay={() => {
                          playTrack(track);
                          const video = document.getElementById(`video-${track.id}`) as HTMLVideoElement;
                          if (video) {
                            video.play();
                          }
                        }}
                        onPause={() => {
                          pauseTrack();
                          const video = document.getElementById(`video-${track.id}`) as HTMLVideoElement;
                          if (video) {
                            video.pause();
                          }
                        }}
                        onEnded={() => {
                          const video = document.getElementById(`video-${track.id}`) as HTMLVideoElement;
                          if (video) {
                            video.pause();
                          }
                          nextTrack();
                        }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {playerMode === 'mini' && (
          <div className="flex flex-col items-center justify-center h-[calc(100vh-12rem)]">
            <div className="text-gray-400 text-center">
              <p className="text-xl mb-2">Mini-Player Modus aktiv</p>
              <p className="text-sm">Steuerung erfolgt über den Mini-Player</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 