import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import EmojiPicker, { Theme, Categories } from 'emoji-picker-react';
import { Image, Smile, MoreVertical, Trash, Copy } from 'lucide-react';
import { createPortal } from 'react-dom';

interface ChatProps {
  friendId: string;
  friendUsername: string;
  onClose: () => void;
}

interface Message {
  id: string;
  content: string;
  sender_id: string;
  receiver_id: string;
  created_at: string;
  image_url?: string;
  file_url?: string;
  file_name?: string;
  file_type?: string;
  file_size?: number;
}

interface MessageMenuProps {
  message: Message;
  onDelete: () => Promise<void>;
  onCopy: () => void;
  isOwner: boolean;
}

const MessageMenu = ({ message, onDelete, onCopy, isOwner }: MessageMenuProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const renderDropdown = () => {
    if (!isOpen || !buttonRef.current) return null;

    const rect = buttonRef.current.getBoundingClientRect();
    
    return createPortal(
      <div 
        className="fixed bg-gray-700 rounded shadow-lg py-1 min-w-[120px] z-[9999]"
        style={{
          top: `${rect.bottom + 5}px`,
          left: `${rect.right - 120}px` // 120px ist die min-width
        }}
      >
        <button
          onClick={() => {
            onCopy();
            setIsOpen(false);
          }}
          className="w-full px-3 py-1.5 text-left text-sm text-gray-200 hover:bg-gray-600 flex items-center gap-2"
        >
          <Copy size={14} />
          Kopieren
        </button>
        
        {isOwner && (
          <button
            onClick={() => {
              onDelete();
              setIsOpen(false);
            }}
            className="w-full px-3 py-1.5 text-left text-sm text-red-400 hover:bg-gray-600 flex items-center gap-2"
          >
            <Trash size={14} />
            Löschen
          </button>
        )}
      </div>,
      document.body
    );
  };

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className="p-1 hover:bg-black/20 rounded absolute -right-2 -top-2 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <MoreVertical size={16} className="text-gray-300" />
      </button>
      {renderDropdown()}
    </div>
  );
};

// Hilfsfunktion zum Erkennen und Umwandeln von URLs in Links
const parseMessageContent = (content: string) => {
  // Regex für URL-Erkennung (http, https, www)
  const urlRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)/g;
  
  // Teile den Text in Stücke auf, wobei URLs separat behandelt werden
  const parts = content.split(urlRegex);
  
  return parts.map((part, index) => {
    if (!part) return null;
    
    // Prüfe ob der Teil eine URL ist
    if (urlRegex.test(part)) {
      const href = part.startsWith('www.') ? `https://${part}` : part;
      return (
        <a
          key={index}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-400 hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {part}
        </a>
      );
    }
    
    return <span key={index}>{part}</span>;
  });
};

const formatTimestamp = (timestamp: string) => {
  const date = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  // Formatiere das Datum
  let dateStr = '';
  if (date.toDateString() === today.toDateString()) {
    dateStr = 'Heute';
  } else if (date.toDateString() === yesterday.toDateString()) {
    dateStr = 'Gestern';
  } else {
    dateStr = date.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit'
    });
  }

  // Formatiere die Uhrzeit
  const timeStr = date.toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit'
  });

  return `${dateStr} ${timeStr}`;
};

const Chat = ({ friendId, friendUsername, onClose }: ChatProps) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [showEmojis, setShowEmojis] = useState(false);
  const [uploading, setUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isScrolling, setIsScrolling] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [deletingMessageIds, setDeletingMessageIds] = useState<string[]>([]);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);

  const isNearBottom = () => {
    if (messagesContainerRef.current) {
      const container = messagesContainerRef.current;
      const threshold = 100; // Pixel-Schwelle zum unteren Rand
      return container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
    }
    return false;
  };

  const handleScroll = () => {
    if (messagesContainerRef.current) {
      setShouldAutoScroll(isNearBottom());
    }
  };

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, []);

  const scrollToBottom = (smooth = true) => {
    if (messagesContainerRef.current && shouldAutoScroll) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto'
      });
    }
  };

  // Scroll wenn neue Nachrichten hinzugefügt werden
  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom();
    }
  }, [messages]);

  // Initial scroll ohne Animation
  useEffect(() => {
    scrollToBottom(false);
  }, []);

  useEffect(() => {
    loadMessages();

    // Realtime subscription für Nachrichten
    const channel = supabase
      .channel('messages')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages'
        },
        async (payload) => {
          // Handle DELETE event
          if (payload.eventType === 'DELETE') {
            const deletedMessage = payload.old as Message;
            // Nur relevante Nachrichten für diesen Chat filtern
            if (
              (deletedMessage.sender_id === user?.id && deletedMessage.receiver_id === friendId) ||
              (deletedMessage.sender_id === friendId && deletedMessage.receiver_id === user?.id)
            ) {
              // Starte die Lösch-Animation
              setDeletingMessageIds(prev => [...prev, deletedMessage.id]);
              
              // Entferne die Nachricht nach der Animation
              setTimeout(() => {
                setMessages(prev => prev.filter(msg => msg.id !== deletedMessage.id));
                setDeletingMessageIds(prev => prev.filter(id => id !== deletedMessage.id));
              }, 300); // Entspricht der Animationsdauer
            }
            return;
          }

          // Handle INSERT event
          if (payload.eventType === 'INSERT') {
            const newMessage = payload.new as Message;
            
            // Prüfen ob die Nachricht für diesen Chat relevant ist
            if (
              (newMessage.sender_id === user?.id && newMessage.receiver_id === friendId) ||
              (newMessage.sender_id === friendId && newMessage.receiver_id === user?.id)
            ) {
              setMessages(prev => {
                if (prev.some(msg => msg.id === newMessage.id)) {
                  return prev;
                }
                const newMessages = [...prev, newMessage];
                setTimeout(() => scrollToBottom(), 100);
                return newMessages;
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [friendId, user?.id]);

  const loadMessages = async () => {
    // Zuerst prüfen ob eine akzeptierte Freundschaft besteht
    const { data: friendship } = await supabase
      .from('friends')
      .select('status')
      .or(`and(sender_id.eq.${user?.id},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${user?.id})`)
      .eq('status', 'accepted')
      .single();

    if (!friendship) {
      console.log('Keine akzeptierte Freundschaft gefunden');
      return;
    }

    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .or(
        `and(sender_id.eq.${user?.id},receiver_id.eq.${friendId}),` +
        `and(sender_id.eq.${friendId},receiver_id.eq.${user?.id})`
      )
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error loading messages:', error);
      return;
    }

    setMessages(data || []);
    scrollToBottom();
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() && !uploading) return;

    try {
      // Prüfen ob eine akzeptierte Freundschaft besteht
      const { data: friendship } = await supabase
        .from('friends')
        .select('status')
        .or(`and(sender_id.eq.${user?.id},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${user?.id})`)
        .eq('status', 'accepted')
        .single();

      if (!friendship) {
        console.error('Keine akzeptierte Freundschaft gefunden');
        return;
      }

      const messageData = {
        sender_id: user?.id,
        receiver_id: friendId,
        content: newMessage.trim()
      };

      const { error } = await supabase
        .from('messages')
        .insert(messageData);

      if (error) {
        console.error('Error sending message:', error);
        return;
      }

      setNewMessage('');
    } catch (err) {
      console.error('Unexpected error:', err);
    }
  };

  const handleEmojiClick = (emojiData: any) => {
    setNewMessage(prev => prev + emojiData.emoji);
  };

  const uploadImage = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Bitte wähle ein Bild aus');
      return;
    }

    setUploading(true);
    try {
      // Prüfe Dateigröße (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        throw new Error('Datei darf nicht größer als 5MB sein');
      }

      // Generiere einen einzigartigen Dateinamen
      const fileName = `${Date.now()}-${file.name}`;
      const filePath = `${user?.id}/${fileName}`;

      // Lade das Bild hoch
      const { error: uploadError } = await supabase.storage
        .from('chat-images')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Hole die öffentliche URL
      const { data } = supabase.storage
        .from('chat-images')
        .getPublicUrl(filePath);

      // Optimistische UI-Aktualisierung
      const optimisticMessage: Message = {
        id: crypto.randomUUID(),
        content: `📎 ${file.name}`,
        sender_id: user?.id || '',
        receiver_id: friendId,
        created_at: new Date().toISOString(),
        image_url: data.publicUrl
      };

      setMessages(prev => [...prev, optimisticMessage]);

      // Sende die Nachricht mit dem Bild
      const { error: messageError } = await supabase
        .from('messages')
        .insert({
          sender_id: user?.id,
          receiver_id: friendId,
          content: `📎 ${file.name}`,
          image_url: data.publicUrl
        });

      if (messageError) throw messageError;

    } catch (error: any) {
      console.error('Error uploading image:', error);
      alert(error.message || 'Fehler beim Hochladen des Bildes');
    } finally {
      setUploading(false);
    }
  };

  const uploadFile = async (file: File) => {
    if (file.type.startsWith('image/')) {
      alert('Bitte nutze den Bild-Upload-Button für Bilder');
      return;
    }

    setUploading(true);
    try {
      // Prüfe Dateigröße (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        throw new Error('Datei darf nicht größer als 5MB sein');
      }

      // Generiere einen einzigartigen Dateinamen
      const fileName = `${Date.now()}-${file.name}`;
      const filePath = `${user?.id}/${fileName}`;

      // Lade die Datei hoch
      const { error: uploadError } = await supabase.storage
        .from('chat-files')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Hole die öffentliche URL
      const { data } = supabase.storage
        .from('chat-files')
        .getPublicUrl(filePath);

      // Optimistische UI-Aktualisierung
      const optimisticMessage: Message = {
        id: crypto.randomUUID(),
        content: `📎 ${file.name}`,
        sender_id: user?.id || '',
        receiver_id: friendId,
        created_at: new Date().toISOString(),
        file_url: data.publicUrl,
        file_name: file.name,
        file_type: file.type,
        file_size: file.size
      };

      setMessages(prev => [...prev, optimisticMessage]);

      // Sende die Nachricht mit der Datei
      const { error: messageError } = await supabase
        .from('messages')
        .insert({
          sender_id: user?.id,
          receiver_id: friendId,
          content: `📎 ${file.name}`,
          file_url: data.publicUrl,
          file_name: file.name,
          file_type: file.type,
          file_size: file.size
        });

      if (messageError) throw messageError;

    } catch (error: any) {
      console.error('Error uploading file:', error);
      alert(error.message || 'Fehler beim Hochladen der Datei');
    } finally {
      setUploading(false);
    }
  };

  const deleteMessage = async (messageId: string) => {
    try {
      // Starte die Lösch-Animation
      setDeletingMessageIds(prev => [...prev, messageId]);

      const { error } = await supabase
        .from('messages')
        .delete()
        .eq('id', messageId)
        .eq('sender_id', user?.id)
        .single();

      if (error) {
        // Bei Fehler Animation rückgängig machen
        setDeletingMessageIds(prev => prev.filter(id => id !== messageId));
        if (error.code === 'PGRST116') {
          console.error('Message not found or not authorized to delete');
        } else {
          console.error('Error deleting message:', error);
        }
        return;
      }

      // Nachricht wird durch Realtime-Event entfernt
    } catch (err) {
      console.error('Unexpected error:', err);
      // Bei Fehler Animation rückgängig machen
      setDeletingMessageIds(prev => prev.filter(id => id !== messageId));
    }
  };

  const copyMessage = (content: string) => {
    navigator.clipboard.writeText(content);
  };

  // Funktion zum Synchronisieren der Nachrichten
  const syncMessages = async () => {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .or(
        `and(sender_id.eq.${user?.id},receiver_id.eq.${friendId}),` +
        `and(sender_id.eq.${friendId},receiver_id.eq.${user?.id})`
      )
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error syncing messages:', error);
      return;
    }

    // Finde gelöschte Nachrichten
    const currentMessageIds = new Set(data?.map(msg => msg.id) || []);
    const deletedMessages = messages.filter(msg => !currentMessageIds.has(msg.id));

    // Animiere und entferne gelöschte Nachrichten
    deletedMessages.forEach(msg => {
      if (!deletingMessageIds.includes(msg.id)) {
        setDeletingMessageIds(prev => [...prev, msg.id]);
        setTimeout(() => {
          setMessages(prev => prev.filter(m => m.id !== msg.id));
          setDeletingMessageIds(prev => prev.filter(id => id !== msg.id));
        }, 300);
      }
    });

    // Aktualisiere die Nachrichtenliste
    setMessages(data || []);
  };

  // Regelmäßige Synchronisation
  useEffect(() => {
    const syncInterval = setInterval(syncMessages, 3000);
    return () => clearInterval(syncInterval);
  }, [messages, user?.id, friendId]);

  // Verbesserte Animation-Styles
  const getMessageClassName = (message: Message) => {
    const baseClasses = "p-3 rounded break-words relative group transition-all duration-300 inline-block";
    const alignmentClasses = message.sender_id === user?.id 
      ? "bg-indigo-600" 
      : "bg-gray-700";
    const animationClasses = deletingMessageIds.includes(message.id) 
      ? "opacity-0 transform translate-y-2" 
      : "opacity-100 transform translate-y-0";
    
    return `${baseClasses} ${alignmentClasses} ${animationClasses} max-w-[75%]`;
  };

  const renderFilePreview = (message: Message) => {
    if (!message.file_url || !message.file_type) return null;

    if (message.file_type.startsWith('image/')) {
      return (
        <img 
          src={message.file_url} 
          alt={message.file_name} 
          className="max-w-xs rounded-lg cursor-pointer hover:opacity-90"
          onClick={() => window.open(message.file_url, '_blank')}
        />
      );
    }

    if (message.file_type === 'text/plain') {
      return (
        <div className="max-w-xs p-3 bg-gray-700 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-300">{message.file_name}</span>
            <button
              onClick={() => message.file_url && downloadFile(message.file_url, message.file_name || 'file.txt')}
              className="text-blue-400 hover:text-blue-300"
            >
              ⬇️
            </button>
          </div>
          <div className="text-xs text-gray-400">
            {formatFileSize(message.file_size || 0)}
          </div>
        </div>
      );
    }

    return (
      <div className="max-w-xs p-3 bg-gray-700 rounded-lg">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-300">{message.file_name}</span>
          <button
            onClick={() => message.file_url && downloadFile(message.file_url, message.file_name || 'file')}
            className="text-blue-400 hover:text-blue-300"
          >
            ⬇️
          </button>
        </div>
        <div className="text-xs text-gray-400 mt-1">
          {formatFileSize(message.file_size || 0)}
        </div>
      </div>
    );
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const downloadFile = async (fileUrl: string, fileName: string) => {
    try {
      const response = await fetch(fileUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading file:', error);
      alert('Fehler beim Herunterladen der Datei');
    }
  };

  return (
    <div className="w-[800px] h-[500px] bg-gray-800 rounded-lg shadow-lg flex flex-col">
      {/* Chat Header */}
      <div className="flex justify-between items-center p-3 border-b border-gray-700 shrink-0">
        <h3 className="text-white font-medium text-lg">{friendUsername}</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-white text-xl">×</button>
      </div>

      {/* Messages Container */}
      <div 
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto p-3 space-y-2 scroll-smooth min-h-0"
        onScroll={handleScroll}
      >
        {messages.map(message => (
          <div key={message.id} className="flex flex-col space-y-1 mb-2">
            {/* Absender Name und Timestamp */}
            <div className="flex justify-between items-center w-full">
              <span className="text-xs text-gray-400">
                {message.sender_id === user?.id ? 'Du' : friendUsername}
              </span>
              <span className="text-xs text-gray-500">
                {formatTimestamp(message.created_at)}
              </span>
            </div>

            {/* Nachricht */}
            <div className="w-full flex">
              <div className={`group relative flex ${getMessageClassName(message)}`}>
                <div className="flex-1 break-words">
                  {message.file_url ? (
                    renderFilePreview(message)
                  ) : message.image_url ? (
                    <img src={message.image_url} alt="Uploaded" className="max-w-md rounded-lg" />
                  ) : (
                    <p className="text-gray-100 whitespace-pre-wrap">
                      {parseMessageContent(message.content)}
                    </p>
                  )}
                </div>
                <MessageMenu
                  message={message}
                  onDelete={() => deleteMessage(message.id)}
                  onCopy={() => copyMessage(message.content)}
                  isOwner={message.sender_id === user?.id}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Message Input */}
      <form onSubmit={sendMessage} className="p-3 border-t border-gray-700 shrink-0">
        <div className="flex gap-3 items-center relative">
          {showEmojis && (
            <div className="absolute bottom-full left-0 right-0 mb-2">
              <div className="bg-gray-800 rounded-lg shadow-lg border border-gray-700 overflow-hidden">
                <EmojiPicker 
                  onEmojiClick={handleEmojiClick}
                  theme={Theme.DARK}
                  searchPlaceholder="Emoji suchen..."
                  width="100%"
                  height={300}
                  lazyLoadEmojis
                  skinTonesDisabled
                  categories={[
                    {
                      name: "Smileys & Emotion",
                      category: Categories.SMILEYS_PEOPLE
                    },
                    {
                      name: "Symbols",
                      category: Categories.SYMBOLS
                    }
                  ]}
                  style={{
                    backgroundColor: '#1F2937',
                    border: '1px solid #374151'
                  }}
                />
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowEmojis(!showEmojis)}
            className={`text-gray-400 hover:text-white transition-colors ${showEmojis ? 'text-indigo-400' : ''}`}
          >
            <Smile size={22} />
          </button>
          
          <button
            type="button"
            onClick={() => imageInputRef.current?.click()}
            className="text-gray-400 hover:text-white"
            disabled={uploading}
          >
            <Image size={22} />
          </button>
          
          <input
            type="file"
            ref={imageInputRef}
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) uploadImage(file);
            }}
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="text-gray-400 hover:text-white"
            disabled={uploading}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
              <polyline points="13 2 13 9 20 9"></polyline>
            </svg>
          </button>
          
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) uploadFile(file);
            }}
          />
          
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Nachricht..."
            className="flex-1 p-3 rounded bg-gray-700 text-white text-[15px]"
          />
          
          <button
            type="submit"
            disabled={uploading}
            className="px-5 py-3 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 text-[15px]"
          >
            {uploading ? 'Lädt...' : 'Senden'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default Chat; 