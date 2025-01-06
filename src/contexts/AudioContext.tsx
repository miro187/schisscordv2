import React, { createContext, useContext, useState } from 'react';

interface AudioContextType {
  currentTrack: Track | null;
  setCurrentTrack: (track: Track | null) => void;
  isPlaying: boolean;
  setIsPlaying: (isPlaying: boolean) => void;
  nextTrack: () => void;
  previousTrack: () => void;
  tracks: Track[];
  setTracks: (tracks: Track[]) => void;
  currentTrackIndex: number;
  playTrack: (track: Track) => void;
  pauseTrack: () => void;
  playerMode: 'main' | 'mini';
  setPlayerMode: (mode: 'main' | 'mini') => void;
  shuffle: boolean;
  setShuffle: (shuffle: boolean) => void;
}

interface Track {
  id: string;
  name: string;
  url: string;
  created_at: string;
}

const AudioContext = createContext<AudioContextType | undefined>(undefined);

export function AudioProvider({ children }: { children: React.ReactNode }) {
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(-1);
  const [playerMode, setPlayerMode] = useState<'main' | 'mini'>('main');
  const [shuffle, setShuffle] = useState(false);

  const playTrack = (track: Track) => {
    const index = tracks.findIndex(t => t.id === track.id);
    setCurrentTrackIndex(index);
    setCurrentTrack(track);
    setIsPlaying(true);
  };

  const pauseTrack = () => {
    setIsPlaying(false);
  };

  const getRandomTrack = (excludeIndex: number) => {
    if (tracks.length <= 1) return excludeIndex;
    let randomIndex;
    do {
      randomIndex = Math.floor(Math.random() * tracks.length);
    } while (randomIndex === excludeIndex);
    return randomIndex;
  };

  const nextTrack = () => {
    if (tracks.length === 0) return;
    let nextIndex;
    
    if (shuffle) {
      nextIndex = getRandomTrack(currentTrackIndex);
    } else {
      nextIndex = (currentTrackIndex + 1) % tracks.length;
    }
    
    setCurrentTrackIndex(nextIndex);
    setCurrentTrack(tracks[nextIndex]);
    setIsPlaying(true);
  };

  const previousTrack = () => {
    if (tracks.length === 0) return;
    let prevIndex;
    
    if (shuffle) {
      prevIndex = getRandomTrack(currentTrackIndex);
    } else {
      prevIndex = currentTrackIndex <= 0 ? tracks.length - 1 : currentTrackIndex - 1;
    }
    
    setCurrentTrackIndex(prevIndex);
    setCurrentTrack(tracks[prevIndex]);
    setIsPlaying(true);
  };

  return (
    <AudioContext.Provider 
      value={{ 
        currentTrack, 
        setCurrentTrack, 
        isPlaying, 
        setIsPlaying,
        nextTrack,
        previousTrack,
        tracks,
        setTracks,
        currentTrackIndex,
        playTrack,
        pauseTrack,
        playerMode,
        setPlayerMode,
        shuffle,
        setShuffle
      }}
    >
      {children}
    </AudioContext.Provider>
  );
}

export function useAudio() {
  const context = useContext(AudioContext);
  if (context === undefined) {
    throw new Error('useAudio must be used within an AudioProvider');
  }
  return context;
} 