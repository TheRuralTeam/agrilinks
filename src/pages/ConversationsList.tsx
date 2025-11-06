import React, { useEffect, useState, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { useNavigate } from "react-router-dom"
import { useAuth } from "@/contexts/AuthContext"
import { Search, Plus } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

interface Conversation {
  id: string
  title: string
  last_message: string | null
  last_timestamp: string
  unread_count: number
  avatar?: string | null
}

interface UserProfile {
  id: string
  full_name: string
  avatar_url?: string | null
}

// Função para realçar o termo pesquisado
const highlightText = (text: string, term: string) => {
  if (!term) return text
  const regex = new RegExp(`(${term})`, "gi")
  const parts = text.split(regex)
  return parts.map((part, i) =>
    regex.test(part) ? <strong key={i}>{part}</strong> : part
  )
}

const ConversationsList = () => {
  const { user } = useAuth()
  const [searchTerm, setSearchTerm] = useState("")
  const [userResults, setUserResults] = useState<UserProfile[]>([])
  const [conversationResults, setConversationResults] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(false)
  const [newConversationOpen, setNewConversationOpen] = useState(false)
  const [newConvSearchTerm, setNewConvSearchTerm] = useState("")
  const [allUsers, setAllUsers] = useState<UserProfile[]>([])
  const navigate = useNavigate()

  const debounce = (func: Function, delay = 300) => {
    let timer: any
    return (...args: any) => {
      clearTimeout(timer)
      timer = setTimeout(() => func(...args), delay)
    }
  }

  const search = useCallback(
    debounce(async (term: string) => {
      if (!user || term.trim() === "") {
        setUserResults([])
        setConversationResults([])
        return
      }

      setLoading(true)

      try {
        // Buscar usuários
        const { data: users, error: usersError } = await supabase
          .from("users")
          .select("id, full_name, avatar_url")
          .ilike("full_name", `%${term}%`)
          .neq("id", user.id)

        if (usersError) console.error("Erro ao buscar usuários:", usersError)
        else setUserResults((users as UserProfile[]) || [])

        // Buscar conversas existentes
        const { data: conversations, error: convError } = await supabase
          .from("conversations")
          .select("*")
          .eq("user_id", user.id)
          .ilike("title", `%${term}%`)
          .order("last_timestamp", { ascending: false })

        if (convError) console.error("Erro ao buscar conversas:", convError)
        else setConversationResults((conversations as Conversation[]) || [])

      } catch (err) {
        console.error("Erro na busca:", err)
      }

      setLoading(false)
    }, 300),
    [user]
  )

  useEffect(() => {
    search(searchTerm)
  }, [searchTerm, search])

  const startConversation = async (otherUserId: string, otherUserName: string) => {
    if (!user) return
    try {
      const { data: existing } = await supabase
        .from("conversations")
        .select("id")
        .eq("user_id", user.id)
        .eq("title", otherUserName)
        .maybeSingle()

      if (existing) {
        navigate(`/messages/${existing.id}`)
        return
      }

      const { data: created, error } = await supabase
        .from("conversations")
        .insert([{
          user_id: user.id,
          title: otherUserName,
          last_message: null,
          last_timestamp: new Date().toISOString(),
          unread_count: 0,
        }])
        .select()
        .single()

      if (error) throw error
      navigate(`/messages/${created.id}`)
    } catch (err) {
      console.error("Erro ao iniciar conversa:", err)
    }
  }

  const formatTime = (timestamp: string) => {
    if (!timestamp) return ""
    return new Date(timestamp).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
  }

  const openNewConversationDialog = async () => {
    if (!user) return
    setNewConversationOpen(true)
    setNewConvSearchTerm("")
    
    try {
      const { data: users, error } = await supabase
        .from("users")
        .select("id, full_name, avatar_url")
        .neq("id", user.id)
        .order("full_name", { ascending: true })
      
      if (error) console.error("Erro ao buscar usuários:", error)
      else setAllUsers((users as UserProfile[]) || [])
    } catch (err) {
      console.error("Erro ao carregar usuários:", err)
    }
  }

  const filteredUsers = allUsers.filter(usr =>
    usr.full_name.toLowerCase().includes(newConvSearchTerm.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Cabeçalho fixo */}
      <div className="sticky top-0 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3 z-10 flex-shrink-0">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-xl font-semibold">Mensagens</h1>
          <Button
            size="icon"
            variant="default"
            onClick={openNewConversationDialog}
            className="rounded-full"
          >
            <Plus className="h-5 w-5" />
          </Button>
        </div>
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Procurar conversas..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      {/* Lista scrollável */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4 scroll-smooth">
        {loading && <p className="text-sm text-muted-foreground">Buscando...</p>}

        {/* Usuários */}
        {userResults.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-2 font-semibold">Usuários encontrados</p>
            {userResults.map((usr) => (
              <Card
                key={usr.id}
                onClick={() => startConversation(usr.id, usr.full_name)}
                className="cursor-pointer transition hover:bg-muted/50 mb-2"
              >
                <CardContent className="flex items-center gap-3 p-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={usr.avatar_url || "/default-avatar.png"} />
                    <AvatarFallback>{usr.full_name.charAt(0) || "?"}</AvatarFallback>
                  </Avatar>
                  <span className="font-medium text-sm">
                    {highlightText(usr.full_name, searchTerm)}
                  </span>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Conversas */}
        {conversationResults.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-2 font-semibold">Conversas existentes</p>
            {conversationResults.map((conv) => (
              <Card
                key={conv.id}
                onClick={() => navigate(`/messages/${conv.id}`)}
                className="cursor-pointer transition hover:bg-muted/50 mb-2"
              >
                <CardContent className="flex items-center justify-between p-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={conv.avatar || "/default-avatar.png"} />
                      <AvatarFallback>{conv.title.charAt(0) || "?"}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <span className="font-semibold text-sm">
                        {highlightText(conv.title, searchTerm)}
                      </span>
                      <span className="text-xs text-muted-foreground line-clamp-1">
                        {conv.last_message || "Sem mensagens ainda"}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-xs text-muted-foreground">{formatTime(conv.last_timestamp)}</span>
                    {conv.unread_count > 0 && (
                      <span className="bg-primary text-white text-[10px] font-medium px-2 py-0.5 rounded-full mt-1">
                        {conv.unread_count}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {!loading && searchTerm && userResults.length === 0 && conversationResults.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhum resultado encontrado</p>
        )}
      </div>

      {/* Modal Nova Conversa */}
      <Dialog open={newConversationOpen} onOpenChange={setNewConversationOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Conversa</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar usuário..."
                value={newConvSearchTerm}
                onChange={(e) => setNewConvSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
            <div className="max-h-[400px] overflow-y-auto space-y-2">
              {filteredUsers.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {newConvSearchTerm ? "Nenhum usuário encontrado" : "Nenhum usuário disponível"}
                </p>
              ) : (
                filteredUsers.map((usr) => (
                  <Card
                    key={usr.id}
                    onClick={() => {
                      startConversation(usr.id, usr.full_name)
                      setNewConversationOpen(false)
                    }}
                    className="cursor-pointer transition hover:bg-muted/50"
                  >
                    <CardContent className="flex items-center gap-3 p-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={usr.avatar_url || "/default-avatar.png"} />
                        <AvatarFallback>{usr.full_name.charAt(0) || "?"}</AvatarFallback>
                      </Avatar>
                      <span className="font-medium text-sm">{usr.full_name}</span>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default ConversationsList