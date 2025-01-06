import { useAudio } from '../contexts/AudioContext';
import { useRef, useEffect, useState } from 'react';
import { Shuffle, SkipBack, SkipForward, Search, Settings, Minimize, Maximize, Pause, Play, Volume } from 'lucide-react';

// Neue Interfaces für die Einstellungen
interface PlayerSettings {
  size: 'medium' | 'large';
  opacity: number;
}

const PLAYER_SIZES = {
  medium: {
    width: '300px',
    videoSize: 'w-16 h-16',
    containerClass: 'w-[300px]',
    controlSize: 18,
    playButtonSize: 22,
    timeTextClass: 'text-xs',
    titleTextClass: 'text-sm',
    volumeSliderWidth: 'w-14',
    volumeIconSize: 14
  },
  large: {
    width: '400px',
    videoSize: 'w-24 h-24',
    containerClass: 'w-[400px]',
    controlSize: 24,
    playButtonSize: 24,
    timeTextClass: 'text-sm',
    titleTextClass: 'text-base',
    volumeSliderWidth: 'w-20',
    volumeIconSize: 16
  }
};

// Neue Custom Controls Komponente
function CustomControls({ 
  audioRef, 
  isPlaying, 
  onPlayPause, 
  onPrevious, 
  onNext,
  shuffle,
  onShuffle,
  size = 'medium'
}: { 
  audioRef: React.RefObject<HTMLAudioElement>;
  isPlaying: boolean;
  onPlayPause: () => void;
  onPrevious: () => void;
  onNext: () => void;
  shuffle: boolean;
  onShuffle: () => void;
  size?: 'medium' | 'large'
}) {
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => setDuration(audio.duration);

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
    };
  }, [audioRef]);

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = Number(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = Number(e.target.value);
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
  };

  return (
    <div className="flex flex-col gap-1 w-full px-2">
      <div className="flex items-center gap-2">
        <span className={`${PLAYER_SIZES[size].timeTextClass} text-gray-400 min-w-[32px] text-right`}>
          {formatTime(currentTime)}
        </span>
        <input
          type="range"
          min={0}
          max={duration || 100}
          value={currentTime}
          onChange={handleSeek}
          className="flex-1 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer"
        />
        <span className={`${PLAYER_SIZES[size].timeTextClass} text-gray-400 min-w-[32px] text-left`}>
          {formatTime(duration)}
        </span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button 
            className={`p-1 rounded-full hover:bg-gray-700/50 ${shuffle ? 'text-indigo-400' : 'text-gray-400'} hover:text-white`}
            onClick={onShuffle}
          >
            <Shuffle size={PLAYER_SIZES[size].controlSize} />
          </button>
          <button 
            className="p-1 rounded-full hover:bg-gray-700/50 text-gray-400 hover:text-white"
            onClick={onPrevious}
          >
            <SkipBack size={PLAYER_SIZES[size].controlSize} />
          </button>
          <button 
            className="p-1.5 rounded-full hover:bg-gray-700/50 text-white hover:text-white bg-indigo-600/50 hover:bg-indigo-600"
            onClick={onPlayPause}
          >
            {isPlaying ? (
              <Pause size={PLAYER_SIZES[size].playButtonSize} />
            ) : (
              <Play size={PLAYER_SIZES[size].playButtonSize} />
            )}
          </button>
          <button 
            className="p-1 rounded-full hover:bg-gray-700/50 text-gray-400 hover:text-white"
            onClick={onNext}
          >
            <SkipForward size={PLAYER_SIZES[size].controlSize} />
          </button>
        </div>
        <div className={`flex items-center gap-1 ${PLAYER_SIZES[size].volumeSliderWidth}`}>
          <Volume 
            size={PLAYER_SIZES[size].volumeIconSize} 
            className="text-gray-400 flex-shrink-0" 
          />
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={handleVolumeChange}
            className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
}

export function MiniPlayer() {
  const { 
    currentTrack, 
    isPlaying, 
    setIsPlaying,
    nextTrack,
    previousTrack,
    playerMode,
    tracks,
    playTrack,
    shuffle,
    setShuffle
  } = useAudio();
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 16, y: window.innerHeight - 400 });
  const [isDragging, setIsDragging] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<PlayerSettings>({
    size: 'medium',
    opacity: 0.95
  });

  useEffect(() => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.play();
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying, currentTrack]);

  useEffect(() => {
    if (currentTrack && isPlaying && audioRef.current) {
      audioRef.current.play();
      if (videoRef.current) videoRef.current.play();
    }
  }, [currentTrack]);

  // Neue Funktion zum Prüfen, ob der Klick im draggable Bereich ist
  const isDraggableArea = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    
    // Prüfen, ob der Klick im Header-Bereich ist
    const isHeader = target.closest('.player-header') !== null;
    
    // Prüfen, ob der Klick NICHT in den Kontrollbereichen ist
    const isNotControls = 
      target.closest('.player-controls') === null && 
      target.closest('.player-settings') === null && 
      target.closest('.player-search') === null;

    return isHeader || (isNotControls && !showSettings);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (containerRef.current && isDraggableArea(e)) {
      setIsDragging(true);
      const startX = e.pageX - position.x;
      const startY = e.pageY - position.y;

      const handleMouseMove = (e: MouseEvent) => {
        const newX = Math.max(0, Math.min(window.innerWidth - 350, e.pageX - startX));
        const newY = Math.max(0, Math.min(window.innerHeight - 150, e.pageY - startY));
        setPosition({ x: newX, y: newY });
      };

      const handleMouseUp = () => {
        setIsDragging(false);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
  };

  const toggleSize = () => {
    const newSize = settings.size === 'medium' ? 'large' : 'medium';
    setSettings({ ...settings, size: newSize });
  };

  if (playerMode !== 'mini') return null;

  const filteredTracks = tracks.filter(track =>
    track.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div 
      ref={containerRef}
      className={`fixed z-50 select-none ${isDragging ? 'cursor-grabbing' : ''}`}
      style={{
        left: position.x,
        top: position.y,
        touchAction: 'none'
      }}
      onMouseDown={handleMouseDown}
    >
      <div 
        className={`bg-gray-800 rounded-xl shadow-lg p-4 ${PLAYER_SIZES[settings.size].containerClass}`}
        style={{ backgroundColor: `rgba(31, 41, 55, ${settings.opacity})` }}
      >
        {/* Header - draggable */}
        <div className="player-header cursor-grab">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => setShowSearch(!showSearch)}
              className="p-2 rounded-lg hover:bg-gray-700/50 text-gray-400 hover:text-white"
            >
              <Search size={20} />
            </button>
            <div className="text-sm font-medium text-gray-400">Mini Player</div>
            <button
              className="p-2 rounded-lg hover:bg-gray-700/50 text-gray-400 hover:text-white"
              onClick={() => setShowSettings(!showSettings)}
            >
              <Settings size={20} />
            </button>
          </div>
        </div>

        {/* Settings - nicht draggable */}
        {showSettings && (
          <div className="player-settings mb-4 p-3 bg-gray-700/30 rounded-lg">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-300">Größe</span>
                <button
                  onClick={toggleSize}
                  className="flex items-center gap-1 px-3 py-1 rounded bg-gray-600/50 hover:bg-gray-600 text-sm text-gray-300"
                >
                  {settings.size === 'medium' ? <Minimize size={16} /> : <Maximize size={16} />}
                  {settings.size.charAt(0).toUpperCase() + settings.size.slice(1)}
                </button>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-sm text-gray-300">Transparenz</span>
                <input
                  type="range"
                  min="50"
                  max="100"
                  value={settings.opacity * 100}
                  onChange={(e) => setSettings({ ...settings, opacity: Number(e.target.value) / 100 })}
                  className="w-full accent-indigo-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* Search - nicht draggable */}
        {showSearch && (
          <div className="player-search mb-4">
            <input
              type="text"
              placeholder="Nach Songs suchen..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
            />
          </div>
        )}

        {/* Main Content - teilweise draggable */}
        <div className="flex items-center gap-4 mb-4">
          <div className={`${PLAYER_SIZES[settings.size].videoSize} rounded-lg overflow-hidden bg-indigo-600/10`}>
            <video
              ref={videoRef}
              src={currentTrack?.url}
              className="w-full h-full object-cover pointer-events-none"
              muted
            />
          </div>
          
          {/* Controls - nicht draggable */}
          <div className="flex-1 min-w-0 player-controls">
            <h4 className={`${PLAYER_SIZES[settings.size].titleTextClass} font-medium text-white truncate mb-1`}>
              {currentTrack?.name || 'Kein Track ausgewählt'}
            </h4>
            <audio
              ref={audioRef}
              src={currentTrack?.url}
              className="hidden"
              onPlay={() => {
                setIsPlaying(true);
                if (videoRef.current) videoRef.current.play();
              }}
              onPause={() => {
                setIsPlaying(false);
                if (videoRef.current) videoRef.current.pause();
              }}
              onEnded={() => {
                if (videoRef.current) videoRef.current.pause();
                nextTrack();
              }}
            />
            <CustomControls 
              audioRef={audioRef}
              isPlaying={isPlaying}
              shuffle={shuffle}
              onShuffle={() => setShuffle(!shuffle)}
              onPlayPause={() => {
                if (audioRef.current) {
                  if (isPlaying) {
                    audioRef.current.pause();
                  } else {
                    audioRef.current.play();
                  }
                }
              }}
              onPrevious={previousTrack}
              onNext={nextTrack}
              size={settings.size}
            />
          </div>
        </div>

        {/* Search Results - nicht draggable */}
        {showSearch && (
          <div className="player-search max-h-[200px] overflow-y-auto custom-scrollbar">
            {filteredTracks.map((track) => (
              <div
                key={track.id}
                className={`flex items-center gap-2 p-2 rounded-lg hover:bg-gray-700/50 cursor-pointer ${
                  currentTrack?.id === track.id ? 'bg-gray-700/50' : ''
                }`}
                onClick={() => playTrack(track)}
              >
                <div className="w-8 h-8 rounded overflow-hidden bg-indigo-600/10">
                  <video
                    src={track.url}
                    className="w-full h-full object-cover"
                    muted
                  />
                </div>
                <span className="text-sm text-white truncate">{track.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
} 