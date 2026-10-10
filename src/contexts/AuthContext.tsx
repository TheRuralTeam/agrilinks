import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from '../integrations/supabase/client'
import { User as UserProfile, RegisterData } from '../types/database'
import { toast } from '../hooks/use-toast'
import { buildAuthRedirectUrl, sendConfirmationEmail, sendPasswordResetEmail } from '../features/auth/email'
import { AdminPermission, isAdminPermission } from '../features/auth/authorization'

interface AuthContextType {
  user: User | null
  userProfile: UserProfile | null
  loading: boolean
  isAdmin: boolean
  isRootAdmin: boolean
  isSuperRoot: boolean
  isSupportAgent: boolean
  permissions: AdminPermission[]
  hasPermission: (permission: AdminPermission) => boolean
  hasAnyPermission: (permissions: AdminPermission[]) => boolean
  hasAllPermissions: (permissions: AdminPermission[]) => boolean
  login: (email: string, password: string) => Promise<{ error: any }>
  register: (userData: RegisterData) => Promise<{ error: any; data?: any }>
  registerSimple: (data: { email: string; phone: string; password: string; user_type: 'agricultor' | 'agente' | 'comprador' | 'motorista' }) => Promise<{ error: any; data?: any }>
  registerWithOtp: (data: { full_name: string; email: string; phone: string }) => Promise<{ error: any; data?: any }>
  signInWithGoogle: (next?: string) => Promise<{ error: any }>
  logout: () => Promise<void>
  verifyEmail: (token: string) => Promise<{ error: any }>
  resendVerification: () => Promise<{ error: any }>
  resendSignupConfirmation: (email: string) => Promise<{ error: any }>
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
  const [permissions, setPermissions] = useState<AdminPermission[]>([])
  const appliedSessionRef = useRef<string | null>(null)

  const checkAdminRole = async (userId: string) => {
    try {
      const [admin, root, superRoot, support, permissionRows] = await Promise.all([
        supabase.rpc('has_role', { _user_id: userId, _role: 'admin' }),
        supabase.rpc('is_root_admin', { _user_id: userId }),
        supabase.rpc('is_super_root', { _user_id: userId }),
        supabase.rpc('is_support_agent', { _user_id: userId }),
        supabase.from('admin_permissions').select('permission').eq('user_id', userId),
      ])

      const hasAdminRole = admin.data
      const rootAdminData = root.data
      const superRootData = superRoot.data
      const isSupportAgentData = support.data
      const nextPermissions = (permissionRows.data ?? []).map((row) => row.permission).filter((p): p is AdminPermission => typeof p === 'string' && isAdminPermission(p))
      
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
      setPermissions(permissionRows.error ? [] : nextPermissions)
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

      const profile = data

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
        setPermissions([])
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

      // Defesa adicional: nenhuma sessão deve permanecer activa sem email confirmado.
      if (data?.user && !data.user.email_confirmed_at) {
        await supabase.auth.signOut({ scope: 'local' })
        return { error: { message: 'Email ainda não confirmado. Abra o link enviado para a sua caixa de entrada antes de iniciar sessão.' } }
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

  const createAccountWithAgriLinkEmail = async (payload: Record<string, unknown>) => {
    try {
      const { data, error } = await supabase.functions.invoke('register-user', { body: payload })
      if (error) {
        const details = error?.context ? await error.context.json().catch(() => null) : null
        return { error: { message: details?.error || error.message || 'Não foi possível criar a conta.' }, data: null }
      }
      if (!data?.success || !data?.user?.id) {
        return { error: { message: data?.error || 'Não foi possível criar a conta.' }, data: null }
      }
      return {
        error: null,
        data: {
          user: data.user,
          session: null,
          confirmation_sent: data.confirmation_sent === true,
          message: data.message,
        },
      }
    } catch (error: any) {
      return { error: { message: error?.message || 'Não foi possível contactar o serviço de registo.' }, data: null }
    }
  }

  const register = async (userData: RegisterData) => {
    const email = userData.email.trim().toLowerCase()
    const password = userData.password
    if (!email) return { error: { message: 'Email é obrigatório.' }, data: null }
    if (!password || password.length < 8) {
      return { error: { message: 'A palavra-passe deve ter pelo menos 8 caracteres.' }, data: null }
    }

    return createAccountWithAgriLinkEmail({
      email,
      password,
      full_name: userData.full_name.trim(),
      phone: userData.phone?.trim() || '',
      user_type: userData.user_type,
      identity_document: userData.identity_document?.trim() || null,
      province_id: userData.province_id || null,
      municipality_id: userData.municipality_id || null,
      load_capacity_kg: userData.load_capacity_kg ?? null,
      referred_by_agent_code: userData.referred_by_agent_id?.trim().toUpperCase() || null,
    })
  }

  const registerSimple = async ({ email, phone, password, user_type }: { email: string; phone: string; password: string; user_type: 'agricultor' | 'agente' | 'comprador' | 'motorista' }) => {
    const normalizedEmail = email.trim().toLowerCase()
    const normalizedPhone = phone.trim()
    if (!normalizedEmail || !normalizedPhone || !password || !user_type) {
      return { error: { message: 'Email, telefone, palavra-passe e tipo de utilizador são obrigatórios.' }, data: null }
    }
    if (!['agricultor', 'agente', 'comprador', 'motorista'].includes(user_type)) {
      return { error: { message: 'Seleccione um tipo de utilizador válido.' }, data: null }
    }
    if (password.length < 8) {
      return { error: { message: 'A palavra-passe deve ter pelo menos 8 caracteres.' }, data: null }
    }

    const emailName = normalizedEmail.split('@')[0] || ''
    const fullName = emailName.length >= 2 ? emailName : 'Utilizador AgriLink'
    return createAccountWithAgriLinkEmail({
      email: normalizedEmail,
      phone: normalizedPhone,
      password,
      full_name: fullName,
      user_type,
    })
  }

  const registerWithOtp = async ({ full_name, email, phone }: { full_name: string; email: string; phone: string }) => {
    const normalizedEmail = email.trim().toLowerCase()
    const normalizedName = full_name.trim()
    const normalizedPhone = phone.trim()
    if (!normalizedEmail || normalizedName.length < 2 || !normalizedPhone) {
      return { error: { message: 'Nome, email e telefone são obrigatórios.' }, data: null }
    }

    return createAccountWithAgriLinkEmail({
      email: normalizedEmail,
      full_name: normalizedName,
      phone: normalizedPhone,
    })
  }

  const signInWithGoogle = async (next = '/app') => {
    try {
      // O Supabase trata o callback OAuth internamente e depois devolve o utilizador
      // para este URL da aplicação. Não devemos apontar redirectTo para o endpoint
      // /auth/v1/callback do Supabase, nem enviar parâmetros extra para o Google
      // (isso provoca erro 400 "invalid_request" no ecrã de consentimento).
      const appRedirectUrl = buildAuthRedirectUrl(next)

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
      setPermissions([])
      localStorage.removeItem('userProfile')
    }
  }

  const verifyEmail = async (_token: string) => {
    // A confirmação é concluída exclusivamente em /auth/callback.
    return { error: null }
  }

  const resendSignupConfirmation = async (email: string) => {
    const normalizedEmail = email.trim().toLowerCase()
    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return { error: { message: 'Introduza um endereço de email válido.' } }
    }

    try {
      await sendConfirmationEmail({ email: normalizedEmail, next: '/app' })
      return { error: null }
    } catch (error: any) {
      return { error }
    }
  }

  const resendVerification = async () => {
    const email = user?.email
    if (!email) return { error: { message: 'Email do utilizador não está disponível no momento.' } }
    return resendSignupConfirmation(email)
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
    permissions,
    hasPermission: (permission) => isRootAdmin || isSuperRoot || permissions.includes(permission),
    hasAnyPermission: (required) => isRootAdmin || isSuperRoot || required.some((permission) => permissions.includes(permission)),
    hasAllPermissions: (required) => isRootAdmin || isSuperRoot || required.every((permission) => permissions.includes(permission)),
    login,
    register,
    registerSimple,
    registerWithOtp,
    signInWithGoogle,
    logout,
    verifyEmail,
    resendVerification,
    resendSignupConfirmation,
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