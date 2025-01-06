import { useAuth } from '../lib/auth';
import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Camera } from 'lucide-react';

const Settings = () => {
  const { user } = useAuth();
  const [username, setUsername] = useState('');
  const [editingUsername, setEditingUsername] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function fetchProfile() {
      if (user?.id) {
        const { data, error } = await supabase
          .from('profiles')
          .select('username, avatar_url')
          .eq('id', user.id)
          .single();
        
        if (error) {
          console.error('Error fetching profile:', error);
          return;
        }
        
        if (data) {
          setUsername(data.username);
          setNewUsername(data.username);
          setAvatarUrl(data.avatar_url);
        }
      }
    }
    
    fetchProfile();
  }, [user]);

  const updateUsername = async () => {
    if (!user) return;
    if (!newUsername.trim()) {
      setError('Benutzername darf nicht leer sein');
      return;
    }

    try {
      // Prüfe ob der Benutzername bereits existiert
      const { data: existingUser } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', newUsername)
        .neq('id', user.id)
        .single();

      if (existingUser) {
        setError('Dieser Benutzername ist bereits vergeben');
        return;
      }

      const { error } = await supabase
        .from('profiles')
        .update({ username: newUsername })
        .eq('id', user.id);

      if (error) throw error;

      setUsername(newUsername);
      setEditingUsername(false);
      setError('');
      setSuccess('Benutzername erfolgreich geändert');
      
      // Success Message nach 3 Sekunden ausblenden
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error updating username:', err);
      setError('Fehler beim Aktualisieren des Benutzernamens');
    }
  };

  const uploadAvatar = async (file: File) => {
    if (!user) return;
    
    try {
      setUploading(true);
      setError('');

      // Prüfe Dateigröße (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError('Bild darf nicht größer als 5MB sein');
        return;
      }

      // Prüfe Dateityp
      if (!file.type.startsWith('image/')) {
        setError('Nur Bilddateien sind erlaubt');
        return;
      }

      // Generiere einen einzigartigen Dateinamen
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;

      // Lösche altes Avatar falls vorhanden
      if (avatarUrl) {
        try {
          const oldFileName = avatarUrl.split('/').pop();
          if (oldFileName) {
            await supabase.storage
              .from('avatars')
              .remove([oldFileName]);
          }
        } catch (err) {
          console.error('Error deleting old avatar:', err);
        }
      }

      // Lade das neue Bild hoch
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, {
          cacheControl: '0',
          upsert: false
        });

      if (uploadError) {
        throw uploadError;
      }

      // Hole die öffentliche URL
      const { data } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      const publicUrl = data.publicUrl;

      // Update das Profil mit der neuen Avatar-URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ 
          avatar_url: publicUrl,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (updateError) {
        throw updateError;
      }

      setAvatarUrl(publicUrl);
      setSuccess('Profilbild erfolgreich aktualisiert');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      console.error('Error uploading avatar:', err);
      setError(err.message || 'Fehler beim Hochladen des Profilbilds');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold text-white mb-6">Benutzereinstellungen</h2>
      
      <div className="bg-gray-800 rounded-lg shadow-md p-6 space-y-6">
        {/* Avatar Section */}
        <div className="flex items-center space-x-4">
          <div className="relative group">
            <div className="w-24 h-24 rounded-full bg-gray-700 overflow-hidden">
              {avatarUrl ? (
                <img 
                  src={avatarUrl} 
                  alt="Avatar" 
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-3xl font-bold text-white">
                  {username.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity rounded-full"
            >
              <Camera className="text-white" size={24} />
            </button>
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadAvatar(file);
              }}
            />
          </div>
          <div>
            <h3 className="text-lg font-medium text-white">Profilbild</h3>
            <p className="text-sm text-gray-400">
              Klicke auf das Bild, um es zu ändern
            </p>
          </div>
        </div>

        {/* Username Section */}
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1">
            Benutzername
          </label>
          {editingUsername ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                className="flex-1 p-2 bg-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Neuer Benutzername"
              />
              <button
                onClick={updateUsername}
                className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
              >
                Speichern
              </button>
              <button
                onClick={() => {
                  setEditingUsername(false);
                  setNewUsername(username);
                  setError('');
                }}
                className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600"
              >
                Abbrechen
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div className="flex-1 p-2 bg-gray-700 rounded-md text-white">
                {username}
              </div>
              <button
                onClick={() => setEditingUsername(true)}
                className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
              >
                Ändern
              </button>
            </div>
          )}
        </div>

        {/* Email Section */}
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1">
            Email
          </label>
          <div className="p-2 bg-gray-700 rounded-md text-white">
            {user?.email}
          </div>
        </div>

        {/* Error/Success Messages */}
        {error && (
          <div className="p-2 bg-red-500 bg-opacity-20 border border-red-500 rounded text-red-500">
            {error}
          </div>
        )}
        {success && (
          <div className="p-2 bg-green-500 bg-opacity-20 border border-green-500 rounded text-green-500">
            {success}
          </div>
        )}
      </div>
    </div>
  );
};

export default Settings;