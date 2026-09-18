import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from '../integrations/supabase/client'
import { User as UserProfile, RegisterData } from '../types/database'
import { toast } from '../hooks/use-toast'
import { buildAuthRedirectUrl, sendConfirmationEmail, sendPasswordResetEmail } from '../features/auth/email'

interface AuthContextType {
  user: User | null
  userProfile: UserProfile | null
  loading: boolean
  isAdmin: boolean
  isRootAdmin: boolean
  isSuperRoot: boolean
  isSupportAgent: boolean
  login: (email: string, password: string) => Promise<{ error: any }>
  register: (userData: RegisterData) => Promise<{ error: any; data?: any }>
  registerWithOtp: (data: { full_name: string; email: string; phone: string }) => Promise<{ error: any; data?: any }>
  signInWithGoogle: () => Promise<{ error: any }>
  logout: () => Promise<void>
  verifyEmail: (token: string) => Promise<{ error: any }>
  resendVerification: () => Promise<{ error: any }>
  resetPassword: (email: string) => Promise<{ error: any }>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(() => {
    // Load userProfile from localStorage on initialization
    try {
      const saved = localStorage.getItem('userProfile')
      return saved ? JSON.parse(saved) : null
    } catch (error) {
      console.error('Error loading userProfile from localStorage:', error)
      return null
    }
  })
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [isRootAdmin, setIsRootAdmin] = useState(false)
  const [isSuperRoot, setIsSuperRoot] = useState(false)
  const [isSupportAgent, setIsSupportAgent] = useState(false)
  const appliedSessionRef = useRef<string | null>(null)

  const checkAdminRole = async (userId: string) => {
    try {
      const [admin, root, superRoot, support] = await Promise.all([
        supabase.rpc('has_role', { _user_id: userId, _role: 'admin' }),
        supabase.rpc('is_root_admin', { _user_id: userId }),
        supabase.rpc('is_super_root', { _user_id: userId }),
        supabase.rpc('is_support_agent', { _user_id: userId }),
      ])

      const hasAdminRole = admin.data
      const rootAdminData = root.data
      const superRootData = superRoot.data
      const isSupportAgentData = support.data
      
      if (!admin.error) {
        setIsAdmin(hasAdminRole === true || rootAdminData === true)
      }
      
      if (!root.error) {
        setIsRootAdmin(rootAdminData === true)
      }

      if (!superRoot.error) {
        setIsSuperRoot(superRootData === true)
      }

      if (!support.error) {
        setIsSupportAgent(isSupportAgentData === true)
      }
    } catch (error) {
      console.error('Error checking admin role:', error)
      setIsAdmin(false)
      setIsRootAdmin(false)
      setIsSuperRoot(false)
      setIsSupportAgent(false)
    }
  }

  const fetchUserProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .maybeSingle()

      if (error) {
        console.error('Error fetching user profile:', error)
        return
      }

      const profile = data ? {
        ...data,
        user_type: data.user_type as 'agricultor' | 'agente' | 'comprador' | 'motorista'
      } : null

      setUserProfile(profile)

      // Save to localStorage
      if (profile) {
        localStorage.setItem('userProfile', JSON.stringify(profile))
      } else {
        localStorage.removeItem('userProfile')
      }
    } catch (error) {
      console.error('Error fetching user profile:', error)
    }
  }

  useEffect(() => {
    let mounted = true

    const applySession = async (nextSession: Session | null) => {
      const sessionKey = nextSession
        ? `${nextSession.user.id}:${nextSession.expires_at ?? ''}`
        : 'signed-out'

      if (appliedSessionRef.current === sessionKey) return
      appliedSessionRef.current = sessionKey

      setSession(nextSession)
      setUser(nextSession?.user ?? null)

      if (nextSession?.user) {
        await Promise.allSettled([
          fetchUserProfile(nextSession.user.id),
          checkAdminRole(nextSession.user.id),
        ])
      } else {
        setUserProfile(null)
        setIsAdmin(false)
        setIsRootAdmin(false)
        setIsSuperRoot(false)
        setIsSupportAgent(false)
        localStorage.removeItem('userProfile')
      }

      if (mounted) setLoading(false)
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        void applySession(session)
      }
    )

    supabase.auth.getSession().then(({ data: { session } }) => {
      void applySession(session)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const login = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      })
      
      if (error) {
        let message = 'Erro ao fazer login'
        if (error.message === 'Invalid login credentials') {
          message = 'Email ou senha incorretos'
        } else if (error.message.includes('User not found')) {
          message = 'Usuário não encontrado'
        } else if (error.message.includes('Email not confirmed') || error.message.includes('email not confirmed')) {
          // Tentar confirmar automaticamente se o usuário existir
          message = 'Email não confirmado. Por favor, verifique sua caixa de entrada.'
        } else {
          message = error.message
        }
        
        toast({
          title: "Erro no Login",
          description: message,
          variant: "destructive",
        })
        
        return { error }
      }

      // Se login bem-sucedido, sincronizar email_verified na tabela public.users
      if (data?.user) {
        try {
          await supabase.rpc('sync_user_email_verified', { p_user_id: data.user.id })
        } catch (syncError) {
          console.log('Sync email verified:', syncError)
        }
      }

      return { error: null }
    } catch (err: any) {
      console.error('Erro no login:', err)
      toast({
        title: "Erro no Login",
        description: 'Ocorreu um erro inesperado. Tente novamente.',
        variant: "destructive",
      })
      return { error: err }
    }
  }

  const register = async (userData: RegisterData) => {
    const { user_type, province_id, municipality_id, full_name, identity_document, phone, password, email, referred_by_agent_id } = userData
    
    if (!email) {
      return { error: { message: 'Email é obrigatório' } }
    }
    
    try {
      // Buscar ID do agente usando RPC segura
      let referredByAgentId = null;
      if (referred_by_agent_id) {
        const { data: agentId } = await supabase.rpc('get_agent_id_by_code', { p_code: referred_by_agent_id });
        referredByAgentId = agentId || null;
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: buildAuthRedirectUrl('/app'),
          data: {
            full_name,
            user_type,
            province_id,
            municipality_id,
            identity_document,
            phone,
            load_capacity_kg: (userData as any).load_capacity_kg ?? null,
            referred_by_agent_id: referredByAgentId
          }
        }
      })

      if (error) return { error, data: null }

      if (data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        return { error: { message: 'Este email já está registrado. Faça login ou reenvie o código de confirmação.' }, data: null }
      }

      // Triggers automáticos criam: perfil, carteira, código agente, referral

      return { error: null, data }
    } catch (err: any) {
      console.error('Erro no registro:', err)
      return { error: err, data: null }
    }
  }

  const registerWithOtp = async ({ full_name, email, phone }: { full_name: string; email: string; phone: string }) => {
    const normalizedEmail = email.trim().toLowerCase()
    if (!normalizedEmail || !full_name.trim() || !phone.trim()) {
      return { error: { message: 'Nome, email e telefone são obrigatórios.' }, data: null }
    }

    try {
      const { data, error } = await supabase.auth.signInWithOtp({
        email: normalizedEmail,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: buildAuthRedirectUrl('/app'),
          data: {
            full_name: full_name.trim(),
            phone: phone.trim(),
          },
        },
      })
      return { error, data }
    } catch (error: any) {
      return { error, data: null }
    }
  }

  const signInWithGoogle = async () => {
    try {
      // O Supabase trata o callback OAuth internamente e depois devolve o utilizador
      // para este URL da aplicação. Não devemos apontar redirectTo para o endpoint
      // /auth/v1/callback do Supabase, nem enviar parâmetros extra para o Google
      // (isso provoca erro 400 "invalid_request" no ecrã de consentimento).
      const appRedirectUrl = buildAuthRedirectUrl('/app')

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: appRedirectUrl,
        },
      })
      if (error) {
        toast({ title: 'Erro Google', description: error.message, variant: 'destructive' })
      }
      return { error }
    } catch (err: any) {
      return { error: err }
    }
  }


  const logout = async () => {
    try {
      await supabase.auth.signOut({ scope: 'local' })
    } finally {
      setSession(null)
      setUser(null)
      setUserProfile(null)
      setIsAdmin(false)
      setIsRootAdmin(false)
      setIsSuperRoot(false)
      setIsSupportAgent(false)
      localStorage.removeItem('userProfile')
    }
  }

  const verifyEmail = async (_token: string) => {
    // A confirmação é concluída exclusivamente em /auth/callback.
    return { error: null }
  }

  const resendVerification = async () => {
    const email = user?.email
    if (!email) {
      return { error: { message: 'Email do utilizador não está disponível no momento.' } }
    }

    try {
      await sendConfirmationEmail({
        email,
        full_name: userProfile?.full_name || email,
        next: '/app',
      })
      return { error: null }
    } catch (error: any) {
      return { error }
    }
  }

  const resetPassword = async (email: string) => {
    try {
      await sendPasswordResetEmail({ email, next: '/reset-password' })
      return { error: null }
    } catch (error: any) {
      return { error }
    }
  }

  const value = {
    user,
    userProfile,
    loading,
    isAdmin,
    isRootAdmin,
    isSuperRoot,
    isSupportAgent,
    login,
    register,
    registerWithOtp,
    signInWithGoogle,
    logout,
    verifyEmail,
    resendVerification,
    resetPassword,
    refreshProfile: async () => {
      const { data } = await supabase.auth.getUser()
      if (data.user) await fetchUserProfile(data.user.id)
    }
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}