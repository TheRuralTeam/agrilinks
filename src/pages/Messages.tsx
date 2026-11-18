import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { 
  Send, 
  ArrowLeft, 
  MessageSquare, 
  Clock,
  CheckCheck,
  Smile
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../integrations/supabase/client";
import { useToast } from "../hooks/use-toast";
import Loader from "../components/ui/Loader";
import { decryptChatMessage, encryptChatMessage, ensureChatEncryptionKey } from "../lib/chatEncryption";

// --- Branding Tokens ---
import { T } from '../lib/brand';

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

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  senderName: string;
  isSent: boolean;
  showAvatar: boolean;
  avatarUrl?: string | null;
}

interface Conversation {
  id: string;
  title: string;
  avatar: string | null;
  user_id?: string;
  participant_id: string;
  peer_user_id?: string | null;
  last_message?: string;
  last_timestamp?: string;
}

// --- Constantes ---

const MAX_FILE_SIZE = 35 * 1024 * 1024; // 35MB
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
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [sentMessageIds, setSentMessageIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [isSending, setIsSending] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!id || !user) return;
    const loadConversation = async () => {
      try {
        const { data, error } = await supabase.from("conversations").select("*").eq("id", id).single();
        if (error) throw error;
        if (!data) throw new Error("Conversa não encontrada.");

        const peerId = data.user_id === user.id
          ? (data.participant_id || data.peer_user_id || null)
          : (data.user_id || data.peer_user_id || data.participant_id || null);
        let conversationTitle = data.title || "Conversa AgriLink";
        let conversationAvatar = data.avatar || null;
        if (peerId && peerId !== user.id) {
          const { data: peerProfile, error: peerProfileError } = await supabase
            .from("public_user_profiles")
            .select("full_name, avatar_url")
            .eq("id", peerId)
            .maybeSingle();
          if (peerProfileError) {
            console.error("Não foi possível actualizar o nome público da conversa:", peerProfileError);
          } else if (peerProfile) {
            conversationTitle = peerProfile.full_name?.trim() || conversationTitle;
            conversationAvatar = peerProfile.avatar_url || conversationAvatar;
          }
        }
        setConversation({ ...data, title: conversationTitle, avatar: conversationAvatar } as Conversation);
      } catch (err) {
        console.error("Erro ao carregar conversa:", err);
        toast({ title: "Erro", description: "Não foi possível carregar a conversa", variant: "destructive" });
        navigate(-1);
      }
    };
    loadConversation();
  }, [id, user, navigate, toast]);

  // Presença real no chat: só considera online quem está ligado ao canal desta conversa.
  // Se a ligação de presença falhar, mostramos estado desconhecido em vez de afirmar offline.
  useEffect(() => {
    if (!user?.id || !conversation || !id) {
      setIsOnline(null);
      return;
    }

    const otherParticipantId =
      conversation.user_id === user.id
        ? (conversation.participant_id || conversation.peer_user_id || null)
        : (conversation.user_id || conversation.peer_user_id || conversation.participant_id || null);

    if (!otherParticipantId || otherParticipantId === user.id) {
      setIsOnline(false);
      return;
    }

    let active = true;
    const presenceChannel = supabase.channel(`chat-presence:${id}`, {
      config: { presence: { key: user.id }, private: true },
    });

    const refreshPresence = () => {
      const presenceState = presenceChannel.presenceState();
      const peerIsPresent = Object.prototype.hasOwnProperty.call(presenceState, otherParticipantId);
      if (active) setIsOnline(peerIsPresent);
    };

    presenceChannel
      .on("presence", { event: "sync" }, refreshPresence)
      .on("presence", { event: "join" }, refreshPresence)
      .on("presence", { event: "leave" }, refreshPresence)
      .subscribe(async (status) => {
        if (!active) return;
        if (status === "SUBSCRIBED") {
          try {
            await presenceChannel.track({
              user_id: user.id,
              online_at: new Date().toISOString(),
            });
            refreshPresence();
          } catch (error) {
            console.error("Não foi possível publicar a presença do chat:", error);
            if (active) setIsOnline(null);
          }
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          setIsOnline(null);
        }
      });

    return () => {
      active = false;
      void supabase.removeChannel(presenceChannel);
      setIsOnline(null);
    };
  }, [user?.id, conversation, id]);

  useEffect(() => {
    if (!user || !id) return;
    setIsLoading(true);
    setLoadError(null);
    const fetchMessages = async () => {
      try {
        await ensureChatEncryptionKey(user.id);
        const { data, error } = await supabase.from("messages").select("*").eq("conversation_id", id).order("created_at", { ascending: true });
        if (error) throw error;
        if (data) {
          const formattedMsgs = await Promise.all(data.map(async (msg) => ({
            ...msg,
            content: await decryptChatMessage(msg.content, id, user.id),
            files: msg.files ? (Array.isArray(msg.files) ? msg.files : []) : []
          }))) as Message[];
          setMessages(formattedMsgs);
          const unread = formattedMsgs.filter(m => m.receiver_id === user.id && !m.read);
          if (unread.length > 0) {
            await supabase.from("messages").update({ read: true }).in("id", unread.map(m => m.id));
          }
        }
      } catch (err) {
        console.error("Erro ao carregar mensagens:", err);
        setLoadError("Não foi possível consultar as mensagens. Verifique a ligação e tente novamente.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchMessages();

    const channel = supabase.channel(`conversation-${id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${id}` },
        (payload) => {
          const rawMessage = payload.new as Message;
          void (async () => {
            const newMsg: Message = {
              ...rawMessage,
              content: await decryptChatMessage(rawMessage.content, id, user.id),
              files: rawMessage.files ? (Array.isArray(rawMessage.files) ? rawMessage.files : []) : [],
            };
            setMessages((prev) => prev.some((message) => message.id === newMsg.id) ? prev : [...prev, newMsg]);
            if (newMsg.sender_id !== user.id) {
              await supabase.from("messages").update({ read: true }).eq("id", newMsg.id);
            }
          })().catch((error) => console.error("Não foi possível processar a mensagem recebida:", error));
        }
      ).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, id, reloadToken]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = useCallback(async () => {
    if (!user || !conversation || !id) return;
    const recipientId = conversation.user_id === user.id
      ? (conversation.participant_id || conversation.peer_user_id || null)
      : (conversation.user_id || conversation.peer_user_id || conversation.participant_id || null);
    if (!recipientId) {
      toast({ title: "Destinatário indisponível", description: "Não foi possível identificar o outro participante desta conversa.", variant: "destructive" });
      return;
    }
    if (!newMessage.trim()) return;
    setIsSending(true);
    try {
      const plainContent = newMessage.trim();
      const encryptedContent = await encryptChatMessage(plainContent, id, user.id, recipientId);
      const { data, error } = await supabase.from("messages").insert([{
        conversation_id: id, sender_id: user.id, receiver_id: recipientId,
        content: encryptedContent, read: false
      }]).select().single();
      if (error) throw error;
      setSentMessageIds((prev) => new Set([...prev, data.id]));
      setMessages((previous) => previous.some((message) => message.id === data.id)
        ? previous
        : [...previous, { ...data, content: plainContent, files: [] } as Message]);
      const { error: conversationUpdateError } = await supabase.from("conversations")
        .update({ last_message: "🔒 Mensagem encriptada", last_timestamp: new Date().toISOString() })
        .eq("id", id);
      if (conversationUpdateError) console.error("Mensagem enviada, mas a lista de conversas não foi actualizada:", conversationUpdateError);
      setNewMessage("");
    } catch (err) {
      console.error("Erro ao enviar mensagem segura:", err);
      toast({
        title: "Não foi possível enviar a mensagem",
        description: err instanceof Error ? err.message : "Verifique a ligação e tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  }, [user, conversation, id, newMessage, toast]);

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
                <span className={`h-1.5 w-1.5 rounded-full ${isOnline === true ? "animate-pulse" : ""}`} style={{ backgroundColor: isOnline === true ? T.g500 : T.faint }} />
                <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: T.muted }}>
                  {isOnline === null ? "A verificar" : isOnline ? "Online" : "Offline"}
                </p>
              </div>
            </div>
          </div>

        </div>
      </header>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8 space-y-6 custom-scrollbar">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-full py-20">
            <Loader compact />
          </div>
        ) : loadError ? (
          <div role="alert" className="flex h-full flex-col items-center justify-center py-20 text-center">
            <MessageSquare className="mb-4 h-10 w-10" style={{ color: T.faint }} />
            <p className="font-bold text-lg" style={{ color: T.ink }}>Não foi possível carregar as mensagens</p>
            <p className="mt-2 max-w-sm break-words text-sm" style={{ color: T.muted }}>{loadError}</p>
            <Button variant="outline" className="mt-4" onClick={() => setReloadToken((value) => value + 1)}>Tentar novamente</Button>
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
          <div className="flex items-end gap-2 bg-white rounded-2xl p-2 shadow-lg border transition-all focus-within:ring-2" style={{ borderColor: T.rule, '--tw-ring-color': T.gBorder } as any}>
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
              <Button onClick={sendMessage} size="icon" disabled={!newMessage.trim() || isSending} className="rounded-xl h-10 w-10 shadow-md transition-transform active:scale-95" style={{ backgroundColor: T.g600, color: T.white }}>
                {isSending ? <Loader compact className="[&_svg]:text-white" /> : <Send className="h-4 w-4" />}
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
