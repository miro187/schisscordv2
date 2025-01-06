import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import EmojiPicker from 'emoji-picker-react';
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

const Chat = ({ friendId, friendUsername, onClose }: ChatProps) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [showEmojis, setShowEmojis] = useState(false);
  const [uploading, setUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isScrolling, setIsScrolling] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [deletingMessageIds, setDeletingMessageIds] = useState<string[]>([]);

  const scrollToBottom = (smooth = true) => {
    if (messagesContainerRef.current && !isScrolling) {
      setIsScrolling(true);
      
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto'
      });

      // Reset scrolling state after animation
      setTimeout(() => setIsScrolling(false), 300);
    }
  };

  // Scroll wenn neue Nachrichten hinzugefügt werden
  useEffect(() => {
    scrollToBottom();
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
    setUploading(true);
    try {
      // Generiere einen einzigartigen Dateinamen
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${user?.id}/${fileName}`; // Speichere in Benutzer-spezifischem Ordner

      // Lade das Bild hoch
      const { error: uploadError } = await supabase.storage
        .from('chat-images')
        .upload(filePath, file);

      if (uploadError) {
        console.error('Error uploading image:', uploadError);
        return;
      }

      // Hole die öffentliche URL des Bildes
      const { data: { publicUrl } } = supabase.storage
        .from('chat-images')
        .getPublicUrl(filePath);

      // Sende die Nachricht mit dem Bild
      await supabase
        .from('messages')
        .insert({
          sender_id: user?.id,
          receiver_id: friendId,
          content: '📷 Bild gesendet',
          image_url: publicUrl
        });

    } catch (error) {
      console.error('Error handling image upload:', error);
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
      >
        {messages.map(message => (
          <div key={message.id} className="flex flex-col space-y-1 mb-2">
            {/* Absender Name - immer links ausgerichtet */}
            <span className="text-xs text-gray-400 text-left w-full">
              {message.sender_id === user?.id ? 'Du' : friendUsername}
            </span>

            {/* Nachricht - immer links ausgerichtet */}
            <div className="w-full flex">
              <div className={getMessageClassName(message)}>
                <MessageMenu
                  message={message}
                  onDelete={() => deleteMessage(message.id)}
                  onCopy={() => copyMessage(message.content)}
                  isOwner={message.sender_id === user?.id}
                />
                
                {message.image_url ? (
                  <div className="max-w-[300px] max-h-[300px] overflow-hidden">
                    <img 
                      src={message.image_url} 
                      alt="Geteiltes Bild"
                      className="rounded w-full h-full object-contain"
                      onLoad={scrollToBottom}
                    />
                  </div>
                ) : (
                  <p className="text-white text-[15px] whitespace-pre-wrap overflow-hidden">
                    {message.content}
                  </p>
                )}
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
                  theme="dark"
                  searchPlaceHolder="Emoji suchen..."
                  width="100%"
                  height={300}
                  previewConfig={{
                    showPreview: false
                  }}
                  skinTonesDisabled
                  categories={[
                    {
                      name: "Smileys & Emotion",
                      category: "smileys_people"
                    },
                    {
                      name: "Symbols",
                      category: "symbols"
                    }
                  ]}
                  lazyLoadEmojis
                  customStyles={{
                    input: {
                      backgroundColor: '#374151',
                      borderColor: '#4B5563',
                      color: 'white',
                      padding: '8px 12px'
                    },
                    emojiButton: {
                      background: 'transparent',
                      hover: '#374151'
                    },
                    searchWrapper: {
                      backgroundColor: 'transparent',
                      padding: '8px',
                      borderBottom: '1px solid #4B5563'
                    },
                    categoryButton: {
                      backgroundColor: 'transparent',
                      hover: '#374151'
                    },
                    emojiList: {
                      backgroundColor: 'transparent'
                    }
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
            onClick={() => fileInputRef.current?.click()}
            className="text-gray-400 hover:text-white"
          >
            <Image size={22} />
          </button>
          
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) uploadImage(file);
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