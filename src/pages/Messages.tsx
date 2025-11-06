import React, { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Send, Paperclip, Phone, Video, MoreVertical, MessageSquare } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/integrations/supabase/client'

interface Message {
  id: string
  conversation_id: string
  sender_id: string
  content: string
  created_at: string
}

type MessageDisplay = {
  id: string
  conversation_id: string
  sender_id: string
  text: string
  created_at: string
  files?: { url: string; name: string; type: string }[]
}

const MAX_FILE_SIZE = 35 * 1024 * 1024 // 35MB
const BUCKET_NAME = 'chat-files'

const Messages = () => {
  const { user } = useAuth()
  const { id } = useParams<{ id: string }>()
  const [messages, setMessages] = useState<MessageDisplay[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [conversationTitle, setConversationTitle] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (id) setConversationId(id) }, [id])

  // Load or create "Equipe AgriLink" conversation
  useEffect(() => {
    const loadOrCreateEquipe = async () => {
      if (!user || id) return
      const { data: existing } = await supabase
        .from('conversations')
        .select('*')
        .eq('user_id', user.id)
        .eq('title', 'Equipe AgriLink')
        .single()

      if (existing) {
        setConversationId(existing.id)
        setConversationTitle(existing.title)
      } else {
        const { data: created } = await supabase
          .from('conversations')
          .insert([
            {
              user_id: user.id,
              title: 'Equipe AgriLink',
              last_message: 'Bem-vindo ao suporte do AgriLink!',
              avatar: 'https://cdn-icons-png.flaticon.com/512/906/906349.png',
              unread_count: 0,
              last_timestamp: new Date().toISOString(),
            },
          ])
          .select()
          .single()
        if (created) {
          setConversationId(created.id)
          setConversationTitle(created.title)
        }
      }
    }
    loadOrCreateEquipe()
  }, [user, id])

  // Load messages
  useEffect(() => {
    if (!conversationId) return

    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })

      if (!error && data) {
        setMessages(
          data.map((m) => ({ ...m, text: m.content }))
        )
      }
    }

    const fetchConversationTitle = async () => {
      const { data } = await supabase
        .from('conversations')
        .select('title')
        .eq('id', conversationId)
        .single()
      if (data) setConversationTitle(data.title)
    }

    fetchMessages()
    fetchConversationTitle()

    const subscription = supabase
      .channel('messages-channel')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const newMsg = payload.new as Message
          if (newMsg.conversation_id === conversationId) {
            setMessages((prev) => [
              ...prev,
              { ...newMsg, text: newMsg.content },
            ])
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(subscription) }
  }, [conversationId])

  const formatTime = (timestamp: string) =>
    new Date(timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

  const handleFilesChange = (files: FileList) => {
    const newFiles: File[] = []
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      if (file.size > MAX_FILE_SIZE) {
        alert(`Arquivo ${file.name} muito grande! Máximo 35MB.`)
        continue
      }
      newFiles.push(file)
    }
    setSelectedFiles((prev) => [...prev, ...newFiles])
  }

  const handleFileUpload = async (file: File) => {
    const fileExt = file.name.split('.').pop()
    const fileName = `${crypto.randomUUID()}.${fileExt}`
    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(fileName, file, { cacheControl: '3600', upsert: false })

    if (uploadError) {
      console.error(uploadError)
      alert('Erro ao enviar arquivo.')
      return null
    }

    const { data: signedUrlData } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(fileName, 3600)

    return signedUrlData?.signedUrl
  }

  const sendMessage = async () => {
    if (!newMessage.trim() && selectedFiles.length === 0) return
    if (!user || !conversationId) return

    let filesData: { url: string; name: string; type: string }[] = []
    for (const file of selectedFiles) {
      const url = await handleFileUpload(file)
      if (url) filesData.push({ url, name: file.name, type: file.type })
    }

    const messageContent = newMessage || (filesData.length > 0 ? `[${filesData.length} arquivo(s)]` : '')

    const message = {
      conversation_id: conversationId,
      sender_id: user.id,
      content: messageContent,
      created_at: new Date().toISOString(),
    }

    setMessages((prev) => [
      ...prev,
      { ...message, id: crypto.randomUUID(), text: messageContent, files: filesData },
    ])

    setNewMessage('')
    setSelectedFiles([])

    await supabase.from('messages').insert([message])
    await supabase
      .from('conversations')
      .update({
        last_message: message.content,
        last_timestamp: new Date().toISOString(),
      })
      .eq('id', conversationId)
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  return (
    <div className="pb-32 bg-gray-50 min-h-screen flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src="https://cdn-icons-png.flaticon.com/512/906/906349.png" />
              <AvatarFallback>AG</AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-lg font-semibold">{conversationTitle}</h1>
              <p className="text-xs text-gray-400">Online agora</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon"><Phone className="h-5 w-5" /></Button>
            <Button variant="ghost" size="icon"><Video className="h-5 w-5" /></Button>
            <Button variant="ghost" size="icon"><MoreVertical className="h-5 w-5" /></Button>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 p-4 space-y-3 overflow-y-auto">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center text-gray-400">
            <MessageSquare className="h-12 w-12 mb-4 opacity-50" />
            <p>Nenhuma mensagem ainda</p>
          </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}>
            <div className={`flex items-start gap-2 max-w-[75%] ${msg.sender_id === user?.id ? 'flex-row-reverse' : 'flex-row'}`}>
              <Avatar className="h-8 w-8 flex-shrink-0">
                <AvatarFallback className={`text-xs ${msg.sender_id === user?.id ? 'bg-blue-500 text-white' : 'bg-gray-300 text-gray-800'}`}>
                  {msg.sender_id === user?.id ? 'EU' : 'AG'}
                </AvatarFallback>
              </Avatar>
              <div className={`flex flex-col ${msg.sender_id === user?.id ? 'items-end' : 'items-start'}`}>
                <div className={`px-4 py-2 rounded-2xl ${msg.sender_id === user?.id ? 'bg-blue-500 text-white rounded-br-md shadow-md' : 'bg-gray-200 text-gray-800 rounded-bl-md shadow-sm'} animate-fade-in`}>
                  {msg.files && msg.files.length > 0
                    ? msg.files.map((file) => {
                        const isImage = file.type.startsWith('image')
                        return isImage ? <img key={file.url} src={file.url} alt={file.name} className="max-w-xs rounded-md mb-1" /> : <a key={file.url} href={file.url} target="_blank" rel="noopener noreferrer" className="underline text-sm">{file.name}</a>
                      })
                    : <p className="text-sm leading-relaxed">{msg.text}</p>}
                </div>
                <span className="text-xs text-gray-400 mt-1">{formatTime(msg.created_at)}</span>
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input + File Previews */}
      <div className="fixed bottom-16 left-0 right-0 px-4">
        <div className="flex flex-col gap-2">
          {selectedFiles.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selectedFiles.map((file, index) => (
                <div key={index} className="flex items-center gap-2 bg-white border border-gray-300 rounded-2xl px-3 py-2 shadow-sm">
                  {file.type.startsWith('image') && <img src={URL.createObjectURL(file)} alt={file.name} className="w-16 h-16 object-cover rounded" />}
                  {!file.type.startsWith('image') && <div className="w-16 h-16 flex items-center justify-center bg-gray-100 rounded">{file.name.split('.').pop()?.toUpperCase()}</div>}
                  <div className="flex flex-col">
                    <span className="text-sm font-medium truncate max-w-[100px]">{file.name}</span>
                    <Button size="icon" variant="ghost" type="button" onClick={() => setSelectedFiles(selectedFiles.filter((_, i) => i !== index))}>✕</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2 bg-white border border-gray-300 rounded-3xl px-4 py-3 shadow-lg">
            <Button variant="ghost" size="icon" type="button" onClick={() => fileInputRef.current?.click()}>
              <Paperclip className="h-5 w-5 text-gray-400" />
            </Button>
            <input type="file" ref={fileInputRef} className="hidden" multiple onChange={(e) => e.target.files && handleFilesChange(e.target.files)} />
            <Input
              placeholder="Digite sua mensagem..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  sendMessage()
                }
              }}
              className="flex-1 border-none focus:ring-0 bg-transparent px-2 py-1 text-sm"
            />
            <Button type="button" onClick={sendMessage} size="icon" disabled={!newMessage.trim() && selectedFiles.length === 0} className="bg-blue-500 hover:bg-blue-600 text-white">
              <Send className="h-5 w-5 rotate-45" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Messages