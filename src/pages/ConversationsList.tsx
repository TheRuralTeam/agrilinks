import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Search, Plus, MessageSquare, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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

interface Conversation {
  id: string;
  title: string;
  last_message: string | null;
  last_timestamp: string;
  unread_count: number;
  avatar: string | null;
  participant_id: string;
}

interface UserProfile {
  id: string;
  full_name: string;
  avatar_url: string | null;
}

// --- Funções Auxiliares ---

const highlightText = (text: string, term: string) => {
  if (!term) return text;
  const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escapedTerm})`, "gi");
  const parts = text.split(regex);
  
  return parts.map((part, i) =>
    regex.test(part) ? <strong key={i} style={{ color: T.g600 }}>{part}</strong> : part
  );
};

const debounce = (func: Function, delay = 300) => {
  let timer: NodeJS.Timeout;
  return (...args: any[]) => {
    clearTimeout(timer);
    timer = setTimeout(() => func(...args), delay);
  };
};

// --- Componente Principal ---

const ConversationsList = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [searchTerm, setSearchTerm] = useState("");
  const [userResults, setUserResults] = useState<UserProfile[]>([]);
  const [allConversations, setAllConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [newConversationOpen, setNewConversationOpen] = useState(false);
  const [newConvSearchTerm, setNewConvSearchTerm] = useState("");
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);

  const loadConversations = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("conversations")
        .select("*")
        .or(`user_id.eq.${user.id},participant_id.eq.${user.id}`)
        .order("last_timestamp", { ascending: false });

      if (error) throw error;
      setAllConversations((data as Conversation[]) || []);
    } catch (error) {
      console.error("Erro ao carregar conversas:", error);
      toast({
        title: t('common.error'),
        description: t('messages.noMessages'),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [user, toast, t]);

  useEffect(() => {
    loadConversations();
    if (!user) return;

    const channel = supabase
      .channel("conversations-updates")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "conversations",
          filter: `user_id=eq.${user.id},participant_id=eq.${user.id}`, 
        },
        () => {
          loadConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, loadConversations]);

  const search = useCallback(
    debounce(async (term: string) => {
      if (!user || term.trim() === "") {
        setUserResults([]);
        return;
      }
      setLoading(true);
      try {
        const { data: users, error: usersError } = await supabase
          .from("users")
          .select("id, full_name, avatar_url")
          .ilike("full_name", `%${term}%`)
          .neq("id", user.id)
          .limit(10);

        if (usersError) {
          console.error("Erro ao buscar usuários:", usersError);
        } else {
          setUserResults((users as UserProfile[]) || []);
        }
      } catch (err) {
        console.error("Erro na busca:", err);
        toast({
          title: t('common.error'),
          description: t('messages.noResults'),
          variant: "destructive"
        });
      }
      setLoading(false);
    }, 300),
    [user, toast, t]
  );

  useEffect(() => {
    search(searchTerm);
  }, [searchTerm, search]);

  const conversationResults = useMemo(() => {
    if (searchTerm.trim() === "") return allConversations;
    return allConversations.filter(conv =>
      conv.title.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [allConversations, searchTerm]);

  const startConversation = useCallback(async (
    participantId: string, 
    participantName: string, 
    participantAvatar: string | null
  ) => {
    if (!user) return;
    const { data: existingConv, error: searchError } = await supabase
      .from("conversations")
      .select("id")
      .or(`and(user_id.eq.${user.id},participant_id.eq.${participantId}),and(user_id.eq.${participantId},participant_id.eq.${user.id})`)
      .limit(1);

    if (searchError) {
      console.error("Erro ao buscar conversa existente:", searchError);
      toast({
        title: t('common.error'),
        description: t('messages.noResults'),
        variant: "destructive"
      });
      return;
    }

    if (existingConv && existingConv.length > 0) {
      navigate(`/messages/${existingConv[0].id}`);
      return;
    }

    try {
      const newConvData = {
        user_id: user.id,
        participant_id: participantId,
        title: participantName,
        avatar: participantAvatar,
        last_message: null,
        last_timestamp: new Date().toISOString(),
        unread_count: 0,
      };

      const { data: createdConv, error: createError } = await supabase
        .from("conversations")
        .insert([newConvData])
        .select("id")
        .single();

      if (createError) throw createError;
      navigate(`/messages/${createdConv.id}`);
    } catch (error) {
      console.error("Erro ao criar nova conversa:", error);
      toast({
        title: t('common.error'),
        description: t('messages.noResults'),
        variant: "destructive"
      });
    }
  }, [user, navigate, toast, t]);

  const formatTime = (timestamp: string) => {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    } else if (days === 1) {
      return t('messages.yesterday');
    } else if (days < 7) {
      return `${days}${t('messages.daysAgo')}`;
    } else {
      return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    }
  };

  const openNewConversationDialog = async () => {
    if (!user) return;
    setNewConversationOpen(true);
    setNewConvSearchTerm("");
    try {
      const { data: users, error } = await supabase
        .from("users")
        .select("id, full_name, avatar_url")
        .neq("id", user.id)
        .order("full_name", { ascending: true })
        .limit(50);
      
      if (error) {
        console.error("Erro ao buscar usuários:", error);
        toast({
          title: t('common.error'),
          description: t('messages.noUserFound'),
          variant: "destructive"
        });
      } else {
        setAllUsers((users as UserProfile[]) || []);
      }
    } catch (err) {
      console.error("Erro ao carregar usuários:", err);
    }
  };

  const filteredUsers = useMemo(() => {
    return allUsers.filter(usr =>
      usr.full_name.toLowerCase().includes(newConvSearchTerm.toLowerCase())
    );
  }, [allUsers, newConvSearchTerm]);

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: T.canvas }}>
        <p style={{ color: T.muted }}>{t('common.loading')}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: T.canvas, color: T.ink }}>
      {/* Cabeçalho */}
      <header 
        className="sticky top-0 z-10 px-6 py-5 border-b shadow-sm backdrop-blur-md"
        style={{ 
          backgroundColor: 'rgba(247, 249, 247, 0.8)', 
          borderColor: T.rule 
        }}
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-2xl font-bold tracking-tight" style={{ color: T.ink }}>
              {t('messages.title')}
            </h1>
            <p className="text-xs font-medium uppercase tracking-widest mt-1" style={{ color: T.muted }}>
              {allConversations.length} {t('messages.conversations').toLowerCase()}
            </p>
          </div>
          <Button
            onClick={openNewConversationDialog}
            className="rounded-full h-12 w-12 shadow-lg transition-transform hover:scale-105 active:scale-95"
            style={{ backgroundColor: T.g600, color: T.white }}
          >
            <Plus className="h-6 w-6" />
          </Button>
        </div>
        <div className="relative group">
          <Search 
            className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 transition-colors group-focus-within:text-g600" 
            style={{ color: T.faint }} 
          />
          <Input
            placeholder={t('messages.searchConversations')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-11 h-12 bg-white border-none rounded-xl shadow-sm focus-visible:ring-2"
            style={{ 
              '--tw-ring-color': T.gBorder,
              color: T.ink
            } as React.CSSProperties}
          />
        </div>
      </header>

      {/* Lista de Conversas */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
        {loading && searchTerm.trim() !== "" && (
          <div className="flex justify-center py-4">
            <div className="animate-pulse text-sm font-medium" style={{ color: T.g600 }}>
              {t('messages.searching')}...
            </div>
          </div>
        )}

        {/* Resultados de Usuários */}
        {userResults.length > 0 && searchTerm.trim() !== "" && (
          <section className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] mb-3 px-2" style={{ color: T.muted }}>
              {t('messages.users')}
            </h2>
            <div className="space-y-2">
              {userResults.map((usr) => (
                <Card
                  key={usr.id}
                  onClick={() => startConversation(usr.id, usr.full_name, usr.avatar_url)}
                  className="border-none shadow-sm hover:shadow-md transition-all cursor-pointer overflow-hidden group"
                  style={{ backgroundColor: T.white }}
                >
                  <CardContent className="flex items-center gap-4 p-4">
                    <div className="relative">
                      <Avatar className="h-12 w-12 border-2 transition-transform group-hover:scale-105" style={{ borderColor: T.g50 }}>
                        <AvatarImage src={usr.avatar_url || "/default-avatar.png"} />
                        <AvatarFallback style={{ backgroundColor: T.g100, color: T.g700 }}>
                          {usr.full_name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="absolute -bottom-1 -right-1 bg-white p-1 rounded-full shadow-sm">
                        <UserPlus className="h-3 w-3" style={{ color: T.g600 }} />
                      </div>
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-sm" style={{ color: T.ink }}>
                        {highlightText(usr.full_name, searchTerm)}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: T.muted }}>
                        {t('messages.clickToStart')}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* Lista de Conversas */}
        {conversationResults.length > 0 && (
          <section className="animate-in fade-in duration-500">
            {userResults.length > 0 && searchTerm.trim() !== "" && (
              <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] mb-3 mt-6 px-2" style={{ color: T.muted }}>
                {t('messages.conversations')}
              </h2>
            )}
            <div className="space-y-3">
              {conversationResults.map((conv) => (
                <Card
                  key={conv.id}
                  onClick={() => navigate(`/messages/${conv.id}`)}
                  className="border-none shadow-sm hover:shadow-md transition-all cursor-pointer group relative overflow-hidden"
                  style={{ backgroundColor: T.white }}
                >
                  {conv.unread_count > 0 && (
                    <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: T.g500 }} />
                  )}
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <Avatar className="h-14 w-14 border-2 transition-transform group-hover:scale-105" style={{ borderColor: T.g50 }}>
                        <AvatarImage src={conv.avatar || "/default-avatar.png"} />
                        <AvatarFallback style={{ backgroundColor: T.ePale, color: T.e700 }}>
                          {conv.title.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-[15px] truncate" style={{ color: T.ink }}>
                            {highlightText(conv.title, searchTerm)}
                          </span>
                          <span className="text-[10px] font-medium" style={{ color: T.faint }}>
                            {formatTime(conv.last_timestamp)}
                          </span>
                        </div>
                        <p className={`text-sm truncate ${conv.unread_count > 0 ? 'font-semibold' : 'font-normal'}`} 
                           style={{ color: conv.unread_count > 0 ? T.mid : T.muted }}>
                          {conv.last_message || t('messages.noMessageYet')}
                        </p>
                      </div>
                    </div>
                    {conv.unread_count > 0 && (
                      <div className="ml-4 flex-shrink-0">
                        <span 
                          className="flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full text-[10px] font-black shadow-sm"
                          style={{ backgroundColor: T.g600, color: T.white }}
                        >
                          {conv.unread_count}
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* Estados Vazios */}
        {!loading && searchTerm.trim() !== "" && userResults.length === 0 && conversationResults.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in zoom-in-95">
            <div className="bg-white p-6 rounded-full shadow-sm mb-6">
              <Search className="h-10 w-10" style={{ color: T.faint }} />
            </div>
            <p className="font-bold text-lg" style={{ color: T.ink }}>{t('messages.noResults')}</p>
            <p className="text-sm mt-2 max-w-[200px]" style={{ color: T.muted }}>
              {t('messages.tryAnotherName')}
            </p>
          </div>
        )}

        {!loading && searchTerm.trim() === "" && conversationResults.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in zoom-in-95">
            <div className="bg-white p-8 rounded-full shadow-sm mb-6">
              <MessageSquare className="h-12 w-12" style={{ color: T.g100 }} />
            </div>
            <p className="font-bold text-lg" style={{ color: T.ink }}>{t('messages.noConversations')}</p>
            <p className="text-sm mt-2 max-w-[240px]" style={{ color: T.muted }}>
              {t('messages.startWithButton')}
            </p>
            <Button 
              onClick={openNewConversationDialog}
              className="mt-8 rounded-xl px-8 font-bold shadow-md"
              style={{ backgroundColor: T.g600, color: T.white }}
            >
              {t('messages.newConversation')}
            </Button>
          </div>
        )}
      </div>

      {/* Modal Nova Conversa (Modal Mail) */}
      <Dialog open={newConversationOpen} onOpenChange={setNewConversationOpen}>
        <DialogContent 
          className="sm:max-w-md border-none p-0 overflow-hidden rounded-3xl shadow-2xl"
          style={{ backgroundColor: T.canvas }}
        >
          <div className="p-8">
            <DialogHeader className="mb-6">
              <DialogTitle className="text-2xl font-black tracking-tight" style={{ color: T.ink }}>
                {t('messages.newConversation')}
              </DialogTitle>
              <p className="text-sm font-medium" style={{ color: T.muted }}>
                Selecione um contacto para iniciar a conversa
              </p>
            </DialogHeader>
            
            <div className="relative mb-6">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: T.faint }} />
              <Input
                placeholder={t('messages.searchUser')}
                value={newConvSearchTerm}
                onChange={(e) => setNewConvSearchTerm(e.target.value)}
                className="pl-11 h-12 bg-white border-none rounded-2xl shadow-sm focus-visible:ring-2"
                style={{ '--tw-ring-color': T.gBorder } as React.CSSProperties}
              />
            </div>

            <div className="max-h-[350px] overflow-y-auto pr-2 space-y-2 custom-scrollbar">
              {filteredUsers.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-sm font-medium" style={{ color: T.muted }}>
                    {newConvSearchTerm ? t('messages.noUserFound') : 'Nenhum contacto disponível'}
                  </p>
                </div>
              ) : (
                filteredUsers.map((usr) => (
                  <div
                    key={usr.id}
                    onClick={() => {
                      startConversation(usr.id, usr.full_name, usr.avatar_url);
                      setNewConversationOpen(false);
                    }}
                    className="flex items-center gap-4 p-3 rounded-2xl cursor-pointer transition-all hover:bg-white hover:shadow-sm group"
                  >
                    <Avatar className="h-12 w-12 border-2 border-transparent group-hover:border-g100 transition-all">
                      <AvatarImage src={usr.avatar_url || "/default-avatar.png"} />
                      <AvatarFallback style={{ backgroundColor: T.g100, color: T.g700 }}>
                        {usr.full_name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="font-bold text-sm" style={{ color: T.ink }}>{usr.full_name}</p>
                      <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: T.g600 }}>
                        Disponível
                      </p>
                    </div>
                    <div 
                      className="h-8 w-8 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ backgroundColor: T.g50 }}
                    >
                      <Plus className="h-4 w-4" style={{ color: T.g600 }} />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          
          <div className="px-8 py-4 border-t flex justify-end" style={{ borderColor: T.rule, backgroundColor: T.white }}>
            <Button 
              variant="ghost" 
              onClick={() => setNewConversationOpen(false)}
              className="rounded-xl font-bold"
              style={{ color: T.muted }}
            >
              Cancelar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: ${T.rule};
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: ${T.faint};
        }
      `}} />
    </div>
  );
};

export default ConversationsList;
