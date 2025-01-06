import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Mic, MicOff, Volume2, VolumeX, Settings } from 'lucide-react';

interface VoiceChatProps {
  channelId: string;
  userId: string;
  channelName: string;
}

interface VoiceState {
  isMuted: boolean;
  isDeafened: boolean;
  noiseCancellation: number;
}

interface VoiceUser {
  id: string;
  username: string;
  isSpeaking: boolean;
  avatar_url?: string | null;
  isMuted?: boolean;
}

interface AudioDevice {
  deviceId: string;
  label: string;
}

interface PeerConnection {
  connection: RTCPeerConnection;
  stream: MediaStream;
  audioElement?: HTMLAudioElement;
  senders: RTCRtpSender[];
}

export default function VoiceChat({ channelId, userId, channelName }: VoiceChatProps) {
  const [voiceState, setVoiceState] = useState<VoiceState>({
    isMuted: false,
    isDeafened: false,
    noiseCancellation: 50
  });
  const [users, setUsers] = useState<VoiceUser[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [inputDevices, setInputDevices] = useState<AudioDevice[]>([]);
  const [outputDevices, setOutputDevices] = useState<AudioDevice[]>([]);
  const [selectedInputDevice, setSelectedInputDevice] = useState<string>('');
  const [selectedOutputDevice, setSelectedOutputDevice] = useState<string>('');
  const [inputVolume, setInputVolume] = useState(100);
  const [outputVolume, setOutputVolume] = useState(100);
  const [isJoined, setIsJoined] = useState(false);

  const audioContext = useRef<AudioContext | null>(null);
  const mediaStream = useRef<MediaStream | null>(null);
  const audioAnalyser = useRef<AnalyserNode | null>(null);
  const animationFrame = useRef<number>();
  const peerConnections = useRef<{ [key: string]: PeerConnection }>({});
  const noiseFilterNode = useRef<BiquadFilterNode | null>(null);
  const dynamicsNode = useRef<DynamicsCompressorNode | null>(null);

  useEffect(() => {
    const setupVoiceChat = async () => {
      try {
        // Audio Context erstellen
        audioContext.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        
        // Mikrofon-Zugriff anfordern
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });
        
        mediaStream.current = stream;

        // Audio Analyse für Spracherkennung einrichten
        if (audioContext.current) {
          const source = audioContext.current.createMediaStreamSource(stream);
          const analyser = audioContext.current.createAnalyser();
          analyser.fftSize = 2048;
          source.connect(analyser);
          audioAnalyser.current = analyser;

          // Spracherkennung starten
          detectSpeaking();
        }

        // Dem Channel beitreten
        await joinChannel();
        setIsConnected(true);
      } catch (err) {
        console.error('Error setting up voice chat:', err);
        setError('Mikrofonzugriff fehlgeschlagen');
      }
    };

    setupVoiceChat();

    return () => {
      // Cleanup
      if (animationFrame.current) {
        cancelAnimationFrame(animationFrame.current);
      }
      if (mediaStream.current) {
        mediaStream.current.getTracks().forEach(track => track.stop());
      }
      if (audioContext.current) {
        audioContext.current.close();
      }
      leaveChannel();
    };
  }, []);

  const detectSpeaking = () => {
    if (!audioAnalyser.current) return;

    const dataArray = new Uint8Array(audioAnalyser.current.frequencyBinCount);
    
    const checkAudioLevel = () => {
      audioAnalyser.current?.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
      const isSpeaking = average > 30;

      setUsers(prev => {
        const userIndex = prev.findIndex(u => u.id === userId);
        if (userIndex === -1) return prev;

        const newUsers = [...prev];
        if (newUsers[userIndex].isSpeaking !== isSpeaking) {
          newUsers[userIndex] = { ...newUsers[userIndex], isSpeaking };
        }
        return newUsers;
      });

      animationFrame.current = requestAnimationFrame(checkAudioLevel);
    };

    checkAudioLevel();
  };

  const createVoiceDetector = (stream: MediaStream, targetUserId: string) => {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    source.connect(analyser);

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    
    const checkAudioLevel = () => {
      analyser.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
      const isSpeaking = average > 30;

      setUsers(prev => {
        const userIndex = prev.findIndex(u => u.id === targetUserId);
        if (userIndex === -1) return prev;

        const newUsers = [...prev];
        if (newUsers[userIndex].isSpeaking !== isSpeaking) {
          newUsers[userIndex] = { ...newUsers[userIndex], isSpeaking };
        }
        return newUsers;
      });

      requestAnimationFrame(checkAudioLevel);
    };

    checkAudioLevel();
    return audioContext;
  };

  const createPeerConnection = async (targetUserId: string) => {
    try {
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          { urls: 'stun:stun3.l.google.com:19302' },
          { urls: 'stun:stun4.l.google.com:19302' }
        ]
      });

      const senders: RTCRtpSender[] = [];

      // Lokalen Stream hinzufügen
      if (mediaStream.current) {
        mediaStream.current.getTracks().forEach(track => {
          if (mediaStream.current) {
            const sender = pc.addTrack(track, mediaStream.current);
            senders.push(sender);
          }
        });
      }

      // Event Handler für Remote Streams
      pc.ontrack = (event) => {
        const [remoteStream] = event.streams;
        
        // Erstelle Audio-Element für den Remote-Stream
        const audioElement = new Audio();
        audioElement.srcObject = remoteStream;
        audioElement.autoplay = true;
        audioElement.volume = outputVolume / 100;

        // Speichere die Referenz
        if (peerConnections.current[targetUserId]) {
          peerConnections.current[targetUserId].stream = remoteStream;
          peerConnections.current[targetUserId].audioElement = audioElement;
          peerConnections.current[targetUserId].senders = senders;
          
          // Erstelle Spracherkennung für den Remote-Stream
          const remoteAudioContext = createVoiceDetector(remoteStream, targetUserId);
          
          // Cleanup beim Schließen der Verbindung
          pc.addEventListener('connectionstatechange', () => {
            if (pc.connectionState === 'closed') {
              remoteAudioContext.close();
              audioElement.remove();
            }
          });
        }
      };

      // Event Handler für ICE candidates
      pc.onicecandidate = async (event) => {
        if (event.candidate) {
          // Sende ICE candidate über Supabase Realtime
          const channel = supabase.channel(`voice_${channelId}`);
          await channel.send({
            type: 'broadcast',
            event: 'ice-candidate',
            payload: {
              candidate: event.candidate,
              from: userId,
              to: targetUserId
            }
          });
        }
      };

      return pc;
    } catch (err) {
      console.error('Error creating peer connection:', err);
      throw err;
    }
  };

  const updateRemoteAudioState = (userId: string, isMuted: boolean) => {
    const peerConnection = peerConnections.current[userId];
    if (peerConnection?.audioElement) {
      peerConnection.audioElement.muted = isMuted;
    }
  };

  const joinChannel = async () => {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('username, avatar_url')
        .eq('id', userId)
        .single();

      const channel = supabase.channel(`voice_${channelId}`);

      // Zuerst alle Event Handler registrieren
      channel.on('broadcast', { event: 'offer' }, async ({ payload }) => {
        if (payload.to === userId) {
          try {
            const pc = await createPeerConnection(payload.from);
            await pc.setRemoteDescription(new RTCSessionDescription(payload.offer));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            peerConnections.current[payload.from] = { 
              connection: pc, 
              stream: new MediaStream(),
              senders: []
            };

            await channel.send({
              type: 'broadcast',
              event: 'answer',
              payload: {
                answer,
                from: userId,
                to: payload.from
              }
            });
          } catch (err) {
            console.error('Error handling offer:', err);
          }
        }
      });

      channel.on('broadcast', { event: 'answer' }, async ({ payload }) => {
        if (payload.to === userId) {
          const pc = peerConnections.current[payload.from]?.connection;
          if (pc) {
            await pc.setRemoteDescription(new RTCSessionDescription(payload.answer));
          }
        }
      });

      channel.on('broadcast', { event: 'ice-candidate' }, async ({ payload }) => {
        if (payload.to === userId) {
          const pc = peerConnections.current[payload.from]?.connection;
          if (pc) {
            await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
          }
        }
      });

      // Füge Event-Handler für Mute-Status hinzu
      channel.on('broadcast', { event: 'mute-status' }, ({ payload }) => {
        setUsers(prev => prev.map(user => 
          user.id === payload.userId 
            ? { ...user, isMuted: payload.isMuted }
            : user
        ));
        
        // Aktualisiere den Audio-Status für den Remote-User
        updateRemoteAudioState(payload.userId, payload.isMuted);
      });

      // Update presence sync handler
      channel.on('presence', { event: 'sync' }, async () => {
        const state = channel.presenceState();
        const channelUsers = Object.values(state).flat().map((user: any) => ({
          id: user.user_id,
          username: user.username,
          avatar_url: user.avatar_url,
          isSpeaking: false,
          isMuted: user.isMuted || false
        }));
        setUsers(channelUsers);

        // Erstelle Peer Connections für neue Benutzer
        for (const user of channelUsers) {
          if (user.id !== userId && !peerConnections.current[user.id]) {
            try {
              const pc = await createPeerConnection(user.id);
              const offer = await pc.createOffer();
              await pc.setLocalDescription(offer);

              peerConnections.current[user.id] = { 
                connection: pc, 
                stream: new MediaStream(),
                senders: []
              };

              await channel.send({
                type: 'broadcast',
                event: 'offer',
                payload: {
                  offer,
                  from: userId,
                  to: user.id
                }
              });
            } catch (err) {
              console.error('Error creating offer:', err);
            }
          }
        }
      });

      channel.on('presence', { event: 'join' }, ({ newPresences }) => {
        setUsers(prev => [
          ...prev,
          ...newPresences.map((user: any) => ({
            id: user.user_id,
            username: user.username,
            avatar_url: user.avatar_url,
            isSpeaking: false,
            isMuted: user.isMuted || false
          }))
        ]);
      });

      channel.on('presence', { event: 'leave' }, ({ leftPresences }) => {
        setUsers(prev => 
          prev.filter(user => !leftPresences.some((p: any) => p.user_id === user.id))
        );
      });

      // Zuerst subscriben
      await new Promise((resolve, reject) => {
        channel.subscribe((status: 'SUBSCRIBED' | 'TIMED_OUT' | 'CLOSED' | 'CHANNEL_ERROR') => {
          if (status === 'SUBSCRIBED') {
            resolve(status);
          } else {
            reject(new Error(`Failed to subscribe to channel: ${status}`));
          }
        });
      });

      // Dann erst presence tracking starten
      await channel.track({
        user_id: userId,
        username: profile?.username || 'Unknown User',
        avatar_url: profile?.avatar_url,
        isMuted: voiceState.isMuted,
        joined_at: new Date().toISOString()
      });

      return channel;
    } catch (err) {
      console.error('Error joining channel:', err);
      setError('Fehler beim Beitreten des Channels');
      throw err;
    }
  };

  const leaveChannel = async () => {
    // Schließe alle Peer Connections
    Object.values(peerConnections.current).forEach(({ connection }) => {
      connection.close();
    });
    peerConnections.current = {};

    const channel = supabase.channel(`voice_${channelId}`);
    await channel.untrack();
    await channel.unsubscribe();
  };

  const toggleMute = () => {
    if (mediaStream.current) {
      const isMuted = !voiceState.isMuted;
      
      // Alle Audio-Tracks stummschalten
      mediaStream.current.getAudioTracks().forEach(track => {
        track.enabled = !isMuted;
      });
      
      // Aktualisiere auch die Sender in allen Peer Connections
      Object.values(peerConnections.current).forEach(({ senders }) => {
        senders.forEach(sender => {
          const track = sender.track;
          if (track && track.kind === 'audio') {
            track.enabled = !isMuted;
          }
        });
      });
      
      setVoiceState(prev => ({ ...prev, isMuted }));

      // Informiere andere Teilnehmer über den Mute-Status
      const channel = supabase.channel(`voice_${channelId}`);
      channel.send({
        type: 'broadcast',
        event: 'mute-status',
        payload: {
          userId,
          isMuted
        }
      });
    }
  };

  const toggleDeafen = () => {
    setVoiceState(prev => ({ ...prev, isDeafened: !prev.isDeafened }));
    // Audio Output stummschalten könnte hier implementiert werden
  };

  // Funktion zum Laden der verfügbaren Audiogeräte
  const loadAudioDevices = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      
      const inputs = devices
        .filter(device => device.kind === 'audioinput')
        .map(device => ({
          deviceId: device.deviceId,
          label: device.label || 'Mikrofon ' + (inputDevices.length + 1)
        }));
      
      const outputs = devices
        .filter(device => device.kind === 'audiooutput')
        .map(device => ({
          deviceId: device.deviceId,
          label: device.label || 'Lautsprecher ' + (outputDevices.length + 1)
        }));

      setInputDevices(inputs);
      setOutputDevices(outputs);

      // Setze Standardgeräte wenn noch keine ausgewählt sind
      if (!selectedInputDevice && inputs.length > 0) {
        setSelectedInputDevice(inputs[0].deviceId);
      }
      if (!selectedOutputDevice && outputs.length > 0) {
        setSelectedOutputDevice(outputs[0].deviceId);
      }
    } catch (err) {
      console.error('Error loading audio devices:', err);
      setError('Fehler beim Laden der Audiogeräte');
    }
  };

  // Funktion zum Ändern des Eingabegeräts
  const changeInputDevice = async (deviceId: string) => {
    try {
      if (mediaStream.current) {
        mediaStream.current.getTracks().forEach(track => track.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          deviceId: { exact: deviceId },
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      mediaStream.current = stream;
      setSelectedInputDevice(deviceId);

      // Audio Analyse neu einrichten
      if (audioContext.current) {
        const source = audioContext.current.createMediaStreamSource(stream);
        const analyser = audioContext.current.createAnalyser();
        analyser.fftSize = 2048;
        source.connect(analyser);
        audioAnalyser.current = analyser;
        detectSpeaking();
      }
    } catch (err) {
      console.error('Error changing input device:', err);
      setError('Fehler beim Ändern des Mikrofons');
    }
  };

  // Funktion zum Ändern des Ausgabegeräts
  const changeOutputDevice = async (deviceId: string) => {
    try {
      // @ts-ignore - setSinkId ist noch nicht im TypeScript-Typ definiert
      const audioElements = document.querySelectorAll('audio');
      for (const audio of audioElements) {
        if (audio.setSinkId) {
          await audio.setSinkId(deviceId);
        }
      }
      setSelectedOutputDevice(deviceId);
    } catch (err) {
      console.error('Error changing output device:', err);
      setError('Fehler beim Ändern des Ausgabegeräts');
    }
  };

  // Lade Audiogeräte beim Start
  useEffect(() => {
    loadAudioDevices();
    // Überwache Änderungen an den Audiogeräten
    navigator.mediaDevices.addEventListener('devicechange', loadAudioDevices);
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', loadAudioDevices);
    };
  }, []);

  // Funktion zum Aktualisieren der Noise Cancellation
  const updateNoiseCancellation = (level: number) => {
    if (!audioContext.current || !noiseFilterNode.current || !dynamicsNode.current) return;

    // Aktualisiere den State
    setVoiceState(prev => ({ ...prev, noiseCancellation: level }));

    // Noise Filter (High-Pass Filter)
    // Level 0-100 zu Frequenz 0-2000Hz mapping
    const frequency = (level / 100) * 2000;
    noiseFilterNode.current.frequency.setValueAtTime(frequency, audioContext.current.currentTime);

    // Dynamics Compressor für zusätzliche Rauschunterdrückung
    // Level 0-100 zu Threshold -100 bis 0 dB mapping
    const threshold = -100 + level;
    dynamicsNode.current.threshold.setValueAtTime(threshold, audioContext.current.currentTime);
    
    // Knee und Ratio basierend auf Level anpassen
    const knee = 40 - (level / 100) * 30;
    const ratio = 1 + (level / 100) * 19;
    dynamicsNode.current.knee.setValueAtTime(knee, audioContext.current.currentTime);
    dynamicsNode.current.ratio.setValueAtTime(ratio, audioContext.current.currentTime);
  };

  // Modifiziere die Audio-Setup-Funktion
  const setupAudioNodes = (stream: MediaStream) => {
    if (!audioContext.current) return;

    const source = audioContext.current.createMediaStreamSource(stream);
    
    // Erstelle Noise Filter
    noiseFilterNode.current = audioContext.current.createBiquadFilter();
    noiseFilterNode.current.type = 'highpass';
    noiseFilterNode.current.frequency.setValueAtTime(1000, audioContext.current.currentTime);
    noiseFilterNode.current.Q.setValueAtTime(0.7, audioContext.current.currentTime);

    // Erstelle Dynamics Compressor
    dynamicsNode.current = audioContext.current.createDynamicsCompressor();
    dynamicsNode.current.threshold.setValueAtTime(-50, audioContext.current.currentTime);
    dynamicsNode.current.knee.setValueAtTime(25, audioContext.current.currentTime);
    dynamicsNode.current.ratio.setValueAtTime(10, audioContext.current.currentTime);
    dynamicsNode.current.attack.setValueAtTime(0, audioContext.current.currentTime);
    dynamicsNode.current.release.setValueAtTime(0.25, audioContext.current.currentTime);

    // Erstelle Analyser für Spracherkennung
    const analyser = audioContext.current.createAnalyser();
    analyser.fftSize = 2048;
    audioAnalyser.current = analyser;

    // Verbinde die Nodes
    source
      .connect(noiseFilterNode.current)
      .connect(dynamicsNode.current)
      .connect(analyser);

    // Setze initiale Noise Cancellation
    updateNoiseCancellation(voiceState.noiseCancellation);

    return analyser;
  };

  // Modifiziere die joinVoiceChannel Funktion
  const joinVoiceChannel = async () => {
    try {
      audioContext.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          deviceId: selectedInputDevice ? { exact: selectedInputDevice } : undefined,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      mediaStream.current = stream;

      if (audioContext.current) {
        const analyser = setupAudioNodes(stream);
        if (analyser) {
          detectSpeaking();
        }
      }

      await joinChannel();
      setIsConnected(true);
      setIsJoined(true);
      setError(null);
    } catch (err) {
      console.error('Error joining voice channel:', err);
      setError('Fehler beim Beitreten des Voice-Channels');
    }
  };

  // Funktion zum expliziten Verlassen
  const leaveVoiceChannel = async () => {
    try {
      // 1. Stoppe zuerst alle Audio-Tracks
      if (mediaStream.current) {
        mediaStream.current.getTracks().forEach(track => {
          track.enabled = false; // Deaktiviere zuerst
          track.stop(); // Dann stoppe komplett
        });
        mediaStream.current = null;
      }

      // 2. Beende alle Peer Connections
      Object.values(peerConnections.current).forEach(({ connection, stream }) => {
        // Stoppe alle Remote-Tracks
        stream.getTracks().forEach(track => {
          track.enabled = false;
          track.stop();
        });
        // Schließe die Verbindung
        connection.close();
      });
      peerConnections.current = {};

      // 3. Cleanup Audio Context und Analyser
      if (audioAnalyser.current) {
        audioAnalyser.current.disconnect();
        audioAnalyser.current = null;
      }

      if (audioContext.current) {
        audioContext.current.close();
        audioContext.current = null;
      }

      // 4. Stoppe Animation Frame
      if (animationFrame.current) {
        cancelAnimationFrame(animationFrame.current);
        animationFrame.current = undefined;
      }

      // 5. Channel verlassen
      const channel = supabase.channel(`voice_${channelId}`);
      await channel.unsubscribe();

      // 6. Entferne alle Audio-Elemente
      document.querySelectorAll('audio').forEach(audio => {
        audio.srcObject = null;
        audio.remove();
      });

      // 7. Reset States
      setIsJoined(false);
    setIsConnected(false);
      setUsers([]);
      setError(null);
      setVoiceState({ isMuted: false, isDeafened: false, noiseCancellation: 50 });
    } catch (err) {
      console.error('Error leaving voice channel:', err);
      setError('Fehler beim Verlassen des Voice-Channels');
    }
  };

  // Cleanup beim Unmount
  useEffect(() => {
    return () => {
      if (isJoined) {
        leaveVoiceChannel();
      }
    };
  }, [isJoined]);

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4">
        <h2 className="text-lg font-semibold text-white mb-4">{channelName}</h2>
        {error ? (
          <div className="text-red-500 mb-4">{error}</div>
        ) : (
          <div className="text-gray-400">Verbinde mit Voice-Chat...</div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">{channelName}</h2>
        <div className="flex items-center space-x-2">
          {isJoined ? (
            <>
              <button
                onClick={toggleMute}
                className={`p-2 rounded-full ${voiceState.isMuted ? 'bg-red-500' : 'bg-green-500'}`}
              >
                {voiceState.isMuted ? <MicOff className="text-white" /> : <Mic className="text-white" />}
              </button>
              <button
                onClick={toggleDeafen}
                className={`p-2 rounded-full ${voiceState.isDeafened ? 'bg-red-500' : 'bg-green-500'}`}
              >
                {voiceState.isDeafened ? <VolumeX className="text-white" /> : <Volume2 className="text-white" />}
              </button>
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="p-2 rounded-full bg-gray-700 hover:bg-gray-600"
              >
                <Settings className="text-white" />
              </button>
              <button
                onClick={leaveVoiceChannel}
                className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
              >
                Verlassen
              </button>
            </>
          ) : (
            <button
              onClick={joinVoiceChannel}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
            >
              Beitreten
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-500 bg-opacity-20 text-red-100 px-4 py-2 rounded">
          {error}
        </div>
      )}
      
      {isJoined && (
        <>
          {showSettings && (
            <div className="bg-gray-800 rounded-lg p-4 space-y-4">
              <div className="space-y-2">
                <label className="text-white text-sm">Mikrofon</label>
                <select
                  value={selectedInputDevice}
                  onChange={(e) => changeInputDevice(e.target.value)}
                  className="w-full bg-gray-700 text-white rounded p-2"
                >
                  {inputDevices.map(device => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label}
                    </option>
                  ))}
                </select>
                <div className="flex items-center space-x-2">
                  <span className="text-white text-sm">Mikrofonlautstärke</span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={inputVolume}
                    onChange={(e) => setInputVolume(Number(e.target.value))}
                    className="flex-1"
                  />
                  <span className="text-white text-sm">{inputVolume}%</span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-white text-sm">Ausgabegerät</label>
                <select
                  value={selectedOutputDevice}
                  onChange={(e) => changeOutputDevice(e.target.value)}
                  className="w-full bg-gray-700 text-white rounded p-2"
                >
                  {outputDevices.map(device => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label}
                    </option>
                  ))}
                </select>
                <div className="flex items-center space-x-2">
                  <span className="text-white text-sm">Ausgabelautstärke</span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={outputVolume}
                    onChange={(e) => setOutputVolume(Number(e.target.value))}
                    className="flex-1"
                  />
                  <span className="text-white text-sm">{outputVolume}%</span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-white text-sm">Noise Cancellation</label>
                <div className="flex items-center space-x-2">
                  <span className="text-white text-sm">Schwach</span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={voiceState.noiseCancellation}
                    onChange={(e) => updateNoiseCancellation(Number(e.target.value))}
                    className="flex-1"
                  />
                  <span className="text-white text-sm">Stark</span>
                </div>
                <div className="text-gray-400 text-xs">
                  Stärkere Noise Cancellation kann die Sprachqualität beeinflussen
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {users.map(user => (
              <div
                key={user.id}
                className={`flex items-center justify-between p-2 rounded ${
                  user.isSpeaking ? 'bg-green-500 bg-opacity-20' : 'bg-gray-700'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div className="relative">
                    <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center overflow-hidden">
                      {user.avatar_url ? (
                        <img 
                          src={user.avatar_url} 
                          alt={user.username} 
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-sm font-bold text-white">
                          {user.username.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    {user.isSpeaking && !user.isMuted && (
                      <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-gray-800" />
                    )}
                  </div>
                  <span className="text-white">{user.username}</span>
                </div>
                {user.isMuted && (
                  <MicOff className="text-red-500" size={16} />
                )}
              </div>
            ))}
          </div>
        </>
        )}
    </div>
  );
} 