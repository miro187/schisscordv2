import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import Channels from './pages/Channels';
import Friends from './pages/Friends';
import Settings from './pages/Settings';
import MusicPage from './pages/music';
import MusicUpload from './pages/admin/music-upload';
import Login from './pages/Login';
import Register from './pages/Register';
import ProtectedRoute from './components/ProtectedRoute';
import { useAuth } from './lib/auth';
import ServerInvites from './components/ServerInvites';
import { AudioProvider } from './contexts/AudioContext';
import { MiniPlayer } from './components/MiniPlayer';

function App() {
  const { initialize } = useAuth();

  useEffect(() => {
    initialize();
  }, [initialize]);

  return (
    <AudioProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          
          <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route path="/" element={<Home />} />
            <Route path="/channels" element={<Channels />} />
            <Route path="/friends" element={<Friends />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/music" element={<MusicPage />} />
            <Route path="/admin/music-upload" element={<MusicUpload />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <ServerInvites />
        <MiniPlayer />
      </BrowserRouter>
    </AudioProvider>
  );
}

export default App;