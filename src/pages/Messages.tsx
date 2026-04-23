import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Send, 
  Paperclip, 
  ArrowLeft, 
  MessageSquare, 
  X,
  Clock,
  CheckCheck,
  Download,
  MoreVertical,
  Smile,
  Phone,
  Video,
  User
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

// --- Branding Tokens ---
const T = {
  /* Greens */
  g900:   '#2c863b',
  g700:   '#1A5C24',
  g600:   '#2D7D3A',
  g500:   '#3D9A48',
  g400:   '#4CAF50',
  g100:   '#E8F5E9',
  g50:    '#F2FAF3',
  gBorder:'#C8E6CA',

  /* Earth */
  e700:   '#5C3317',
  e500:   '#7B4F2E',
  e300:   '#A0522D',
  ePale:  '#FDF5EE',
  eBorder:'#EDD9C6',

  /* Neutrals */
  ink:    '#111714',
  mid:    '#3D4D40',
  muted:  '#758A79',
  faint:  '#A8BAA9',
  canvas: '#F7F9F7',
  white:  '#FFFFFF',
  rule:   '#E5EDE6',

  /* Accents */
  gold:   '#B07D0A',
  goldL:  '#E5A020',

  /* Shadow */
  shadow: 'rgba(13,43,18,0.10)',
  shadowMd:'rgba(13,43,18,0.15)',
}

// --- Tipos ---

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
  read: boolean;
  files?: { url: string; name: string; size?: number }[] | null;
}

interface Conversation {
  id: string;
  title: string;
  avatar: string | null;
  participant_id: string;
  last_message?: string;
  last_timestamp?: string;
}

// --- Constantes ---

const MAX_FILE_SIZE = 35 * 1024 * 1024; // 35MB
const BUCKET_NAME = "chatfiles";
const MAX_MESSAGE_LENGTH = 5000;

const AGRO_EMOJIS = [
  "🌾", "🌽", "🍅", "🥕", "🥬", "🥦", "🍆", "🥒", 
  "🌱", "🌿", "🍃", "🌻", "🌳", "🍎", "🍊", "🍋",
  "🍇", "🍉", "🍌", "🥭", "🍍", "🥥", "🥑", "🧅",
  "🥔", "🌶️", "🧄", "🥜", "🌰", "🍞", "🥚", "🧈",
  "🐄", "🐖", "🐔", "🐑", "🐐", "🚜", "🌦️", "💧",
  "☀️", "🌈", "👨‍🌾", "👩‍🌾", "🏡", "🛒", "📦", "✅"
];

// --- Componentes Auxiliares ---

interface FilePreviewProps {
  file: { url: string; name: string; size?: number };
  onRemove?: () => void;
  isPreview?: boolean;
  isOwn?: boolean;
}

const FilePreview: React.FC<FilePreviewProps> = ({ file, onRemove, isPreview = false, isOwn = false }) => {
  const getFileIcon = (name: string) => {
    const ext = name.split(".").pop()?.toLowerCase();
    if (["pdf", "doc", "docx", "txt"].includes(ext || "")) return "📄";
    if (["jpg", "jpeg", "png", "gif"].includes(ext || "")) return "🖼️";
    return "📎";
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  return (
    <div
      className="flex items-center gap-3 px-3 py-2 rounded-xl border transition-all"
      style={{ 
        backgroundColor: isPreview ? T.g50 : (isOwn ? 'rgba(255,255,255,0.1)' : T.canvas),
        borderColor: isPreview ? T.gBorder : (isOwn ? 'rgba(255,255,255,0.2)' : T.rule)
      }}
    >
      <span className="text-lg">{getFileIcon(file.name)}</span>
      <div className="flex-1 min-w-0">
        <p className={`text-xs font-bold truncate ${isOwn ? 'text-white' : ''}`} style={{ color: isOwn ? T.white : T.ink }}>
          {file.name}
        </p>
        {file.size && (
          <p className="text-[10px]" style={{ color: isOwn ? 'rgba(255,255,255,0.7)' : T.muted }}>
            {formatFileSize(file.size)}
          </p>
        )}
      </div>
      {isPreview && onRemove && (
        <button
          onClick={onRemove}
          className="p-1 rounded-full transition-colors hover:bg-white/50"
        >
          <X size={14} style={{ color: T.g600 }} />
        </button>
      )}
      {!isPreview && (
        <a
          href={file.url}
          download={file.name}
          className="p-1 rounded-full transition-colors hover:bg-black/5"
        >
          <Download size={14} style={{ color: isOwn ? T.white : T.muted }} />
        </a>
      )}
    </div>
  );
};

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  senderName: string;
  isSent: boolean;
  showAvatar: boolean;
  avatarUrl?: string | null;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isOwn,
  senderName,
  isSent,
  showAvatar,
  avatarUrl
}) => {
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className={`flex ${isOwn ? "justify-end" : "justify-start"} mb-1 animate-in fade-in slide-in-from-bottom-1 duration-300`}>
      <div className={`flex items-end gap-2 max-w-[85%] md:max-w-[70%] ${isOwn ? "flex-row-reverse" : "flex-row"}`}>
        <div className="w-8 flex-shrink-0">
          {showAvatar && !isOwn && (
            <Avatar className="h-8 w-8 border shadow-sm" style={{ borderColor: T.g50 }}>
              <AvatarImage src={avatarUrl || "/default-avatar.png"} />
              <AvatarFallback style={{ backgroundColor: T.ePale, color: T.e700, fontSize: '10px' }}>
                {senderName.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          )}
        </div>

        <div className={`flex flex-col ${isOwn ? "items-end" : "items-start"}`}>
          <div
            className={`px-4 py-2.5 shadow-sm transition-all ${
              isOwn
                ? "rounded-2xl rounded-tr-none"
                : "rounded-2xl rounded-tl-none"
            }`}
            style={{ 
              backgroundColor: isOwn ? T.g600 : T.white,
              color: isOwn ? T.white : T.ink,
              border: isOwn ? 'none' : `1px solid ${T.rule}`
            }}
          >
            <p className="text-[14px] leading-relaxed break-words font-medium">{message.content}</p>

            {message.files && message.files.length > 0 && (
              <div className="mt-3 space-y-2 pt-2 border-t" style={{ borderColor: isOwn ? 'rgba(255,255,255,0.1)' : T.rule }}>
                {message.files.map((file, idx) => (
                  <FilePreview key={idx} file={file} isPreview={false} isOwn={isOwn} />
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5 mt-1 px-1">
            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: T.faint }}>
              {formatTime(message.created_at)}
            </span>
            {isOwn && (
              <span className="flex items-center">
                {isSent ? (
                  <CheckCheck size={12} style={{ color: T.g500 }} />
                ) : (
                  <Clock size={10} style={{ color: T.faint }} />
                )}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Componente Principal ---

const Messages = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [sentMessageIds, setSentMessageIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!id || !user) return;
    const loadConversation = async () => {
      try {
        const { data, error } = await supabase.from("conversations").select("*").eq("id", id).single();
        if (error || !data) throw error;
        setConversation(data as Conversation);
      } catch (err) {
        console.error("Erro ao carregar conversa:", err);
        toast({ title: "Erro", description: "Não foi possível carregar a conversa", variant: "destructive" });
        navigate(-1);
      }
    };
    loadConversation();
  }, [id, user, navigate, toast]);

  useEffect(() => {
    if (!user || !id) return;
    setIsLoading(true);
    const fetchMessages = async () => {
      try {
        const { data, error } = await supabase.from("messages").select("*").eq("conversation_id", id).order("created_at", { ascending: true });
        if (error) throw error;
        if (data) {
          const formattedMsgs = data.map(msg => ({
            ...msg,
            files: msg.files ? (Array.isArray(msg.files) ? msg.files : []) : []
          })) as Message[];
          setMessages(formattedMsgs);
          const unread = formattedMsgs.filter(m => m.receiver_id === user.id && !m.read);
          if (unread.length > 0) {
            await supabase.from("messages").update({ read: true }).in("id", unread.map(m => m.id));
          }
        }
      } catch (err) {
        console.error("Erro ao carregar mensagens:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchMessages();

    const channel = supabase.channel(`conversation-${id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${id}` },
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages((prev) => [...prev, newMsg]);
          if (newMsg.sender_id !== user.id) {
            supabase.from("messages").update({ read: true }).eq("id", newMsg.id);
          }
        }
      ).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, id, toast]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleFilesChange = useCallback((files: FileList) => {
    const newFiles: File[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.size > MAX_FILE_SIZE) {
        toast({ title: "Arquivo muito grande", description: `${file.name} excede o limite de 35MB`, variant: "destructive" });
        continue;
      }
      newFiles.push(file);
    }
    setSelectedFiles((prev) => [...prev, ...newFiles]);
  }, [toast]);

  const removeFile = useCallback((index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const sendMessage = useCallback(async () => {
    if (!user || !conversation?.participant_id || !id) return;
    if (!newMessage.trim() && selectedFiles.length === 0) return;
    setIsSending(true);
    try {
      const filesData = [];
      for (const file of selectedFiles) {
        const ext = file.name.split(".").pop();
        const fileName = `${crypto.randomUUID()}.${ext}`;
        const { error: uploadError } = await supabase.storage.from(BUCKET_NAME).upload(fileName, file);
        if (!uploadError) {
          const { data } = await supabase.storage.from(BUCKET_NAME).createSignedUrl(fileName, 3600);
          if (data) filesData.push({ url: data.signedUrl, name: file.name, size: file.size });
        }
      }
      const messageContent = newMessage.trim() || (filesData.length > 0 ? `📎 ${filesData.length} arquivo(s)` : "");
      const { data, error } = await supabase.from("messages").insert([{
        conversation_id: id, sender_id: user.id, receiver_id: conversation.participant_id,
        content: messageContent, read: false, files: filesData.length > 0 ? filesData : undefined
      }]).select().single();
      if (error) throw error;
      setSentMessageIds((prev) => new Set([...prev, data.id]));
      await supabase.from("conversations").update({ last_message: messageContent, last_timestamp: new Date().toISOString() }).eq("id", id);
      setNewMessage("");
      setSelectedFiles([]);
    } catch (err) {
      console.error("Erro ao enviar:", err);
    } finally {
      setIsSending(false);
    }
  }, [user, conversation, id, newMessage, selectedFiles, toast]);

  const groupedMessages = useMemo(() => {
    const groups: { messages: Message[]; sender: string }[] = [];
    messages.forEach((msg) => {
      const lastGroup = groups[groups.length - 1];
      if (lastGroup && lastGroup.sender === msg.sender_id) {
        lastGroup.messages.push(msg);
      } else {
        groups.push({ messages: [msg], sender: msg.sender_id });
      }
    });
    return groups;
  }, [messages]);

  if (!user) return null;

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: T.canvas }}>
      {/* Header */}
      <header className="sticky top-0 z-20 border-b backdrop-blur-md" style={{ backgroundColor: 'rgba(247, 249, 247, 0.8)', borderColor: T.rule }}>
        <div className="flex items-center justify-between px-4 py-3 md:px-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-full hover:bg-white/50">
              <ArrowLeft className="h-5 w-5" style={{ color: T.ink }} />
            </Button>
            <Avatar className="h-10 w-10 border-2" style={{ borderColor: T.g50 }}>
              <AvatarImage src={conversation?.avatar || "/default-avatar.png"} />
              <AvatarFallback style={{ backgroundColor: T.ePale, color: T.e700 }}>
                {conversation?.title.charAt(0).toUpperCase() || "?"}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <h1 className="text-sm font-black tracking-tight" style={{ color: T.ink }}>{conversation?.title || "Conversa"}</h1>
              <div className="flex items-center gap-1.5">
                <span className={`h-1.5 w-1.5 rounded-full ${isOnline ? "animate-pulse" : ""}`} style={{ backgroundColor: isOnline ? T.g500 : T.faint }} />
                <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: T.muted }}>{isOnline ? "Online" : "Offline"}</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="rounded-full hover:bg-white/50"><Phone className="h-4 w-4" style={{ color: T.muted }} /></Button>
            <Button variant="ghost" size="icon" className="rounded-full hover:bg-white/50"><Video className="h-4 w-4" style={{ color: T.muted }} /></Button>
            <Button variant="ghost" size="icon" className="rounded-full hover:bg-white/50"><MoreVertical className="h-4 w-4" style={{ color: T.muted }} /></Button>
          </div>
        </div>
      </header>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8 space-y-6 custom-scrollbar">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-full py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 mb-4" style={{ borderColor: T.g600 }} />
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: T.muted }}>Sincronizando...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-20">
            <div className="bg-white rounded-full p-8 shadow-sm mb-6">
              <MessageSquare className="h-10 w-10" style={{ color: T.faint }} />
            </div>
            <p className="font-bold text-lg" style={{ color: T.ink }}>Inicie a conversa</p>
            <p className="text-sm mt-2 max-w-[200px]" style={{ color: T.muted }}>Envie uma mensagem para começar a negociar.</p>
          </div>
        ) : (
          groupedMessages.map((group, gIdx) => (
            <div key={gIdx} className="space-y-1">
              {group.messages.map((msg, mIdx) => (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  isOwn={msg.sender_id === user.id}
                  senderName={conversation?.title || "Usuário"}
                  isSent={sentMessageIds.has(msg.id) || msg.read}
                  showAvatar={mIdx === group.messages.length - 1}
                  avatarUrl={conversation?.avatar}
                />
              ))}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Footer */}
      <footer className="p-4 md:p-6" style={{ backgroundColor: T.canvas }}>
        <div className="max-w-4xl mx-auto flex flex-col gap-3">
          {selectedFiles.length > 0 && (
            <div className="flex gap-2 flex-wrap p-3 rounded-2xl border animate-in slide-in-from-bottom-2" style={{ backgroundColor: T.white, borderColor: T.gBorder }}>
              {selectedFiles.map((file, idx) => (
                <FilePreview key={idx} file={{ url: "", name: file.name, size: file.size }} onRemove={() => removeFile(idx)} isPreview={true} />
              ))}
            </div>
          )}

          <div className="flex items-end gap-2 bg-white rounded-2xl p-2 shadow-lg border transition-all focus-within:ring-2" style={{ borderColor: T.rule, '--tw-ring-color': T.gBorder } as any}>
            <Button variant="ghost" size="icon" onClick={() => fileInputRef.current?.click()} className="rounded-xl hover:bg-g50" disabled={isSending}>
              <Paperclip className="h-5 w-5" style={{ color: T.muted }} />
            </Button>
            <input type="file" ref={fileInputRef} className="hidden" multiple onChange={(e) => e.target.files && handleFilesChange(e.target.files)} />
            
            <textarea
              placeholder="Escreva a sua mensagem..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value.slice(0, MAX_MESSAGE_LENGTH))}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && !isSending && (e.preventDefault(), sendMessage())}
              className="flex-1 resize-none border-none focus:ring-0 bg-transparent text-sm py-2.5 px-2 max-h-32 outline-none font-medium"
              rows={1}
              style={{ color: T.ink }}
            />

            <div className="flex items-center gap-1">
              <div className="relative">
                <Button variant="ghost" size="icon" className="rounded-xl hover:bg-g50" onClick={() => setShowEmojiPicker(!showEmojiPicker)}>
                  <Smile className="h-5 w-5" style={{ color: T.muted }} />
                </Button>
                {showEmojiPicker && (
                  <div className="absolute bottom-14 right-0 bg-white rounded-2xl shadow-2xl border p-4 w-72 z-50 animate-in zoom-in-95" style={{ borderColor: T.rule }}>
                    <p className="text-[10px] font-black uppercase tracking-widest mb-3" style={{ color: T.muted }}>Emojis Agrícolas 🌾</p>
                    <div className="grid grid-cols-7 gap-1">
                      {AGRO_EMOJIS.map((emoji, idx) => (
                        <button key={idx} onClick={() => { setNewMessage(p => p + emoji); setShowEmojiPicker(false); }} className="text-xl hover:bg-g50 rounded-lg p-1.5 transition-all">{emoji}</button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <Button onClick={sendMessage} size="icon" disabled={(!newMessage.trim() && selectedFiles.length === 0) || isSending} className="rounded-xl h-10 w-10 shadow-md transition-transform active:scale-95" style={{ backgroundColor: T.g600, color: T.white }}>
                {isSending ? <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>
      </footer>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: ${T.rule}; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: ${T.faint}; }
      `}} />
    </div>
  );
};

export default Messages;
