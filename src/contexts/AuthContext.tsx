import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/integrations/supabase/client'
import { User as UserProfile, RegisterData } from '@/types/database'

type AuthActionError = {
  message: string
  needsEmailConfirmation?: boolean
}

type LoginResult = {
  error: AuthActionError | null
}

type RegisterResult = {
  error: AuthActionError | null
  data?: {
    user: User | null
  } | null
}

export type PendingGoogleOnboarding = {
  user_type: 'agricultor' | 'agente' | 'comprador'
  phone: string
  province_id: string
  municipality_id: string
}

const PENDING_GOOGLE_ONBOARDING_KEY = 'pendingGoogleOnboarding'
export const GOOGLE_DEVICE_HISTORY_KEY = 'googleDeviceHistory'
export const GOOGLE_PASSWORD_SETUP_REQUIRED_KEY = 'googlePasswordSetupRequired'

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) {
    return error.message
  }

  return 'Ocorreu um erro inesperado. Tente novamente.'
}

interface AuthContextType {
  user: User | null
  userProfile: UserProfile | null
  loading: boolean
  profileLoading: boolean
  isAdmin: boolean
  isRootAdmin: boolean
  isSuperRoot: boolean
  isSupportAgent: boolean
  login: (email: string, password: string) => Promise<LoginResult>
  signInWithGoogle: (mode?: 'login' | 'signup', onboarding?: PendingGoogleOnboarding | null) => Promise<{ error: AuthActionError | null }>
  completePendingGoogleOnboarding: (authUser?: User | null) => Promise<{ error: AuthActionError | null; completed: boolean }>
  setGooglePassword: (password: string) => Promise<{ error: AuthActionError | null }>
  register: (userData: RegisterData) => Promise<RegisterResult>
  logout: () => Promise<void>
  verifyEmail: (token: string) => Promise<{ error: AuthActionError | null }>
  resendVerification: () => Promise<{ error: AuthActionError | null }>
  resetPassword: (email: string) => Promise<{ error: AuthActionError | null }>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const savePendingGoogleOnboarding = (onboarding: PendingGoogleOnboarding | null | undefined) => {
  if (!onboarding) {
    localStorage.removeItem(PENDING_GOOGLE_ONBOARDING_KEY)
    return
  }

  localStorage.setItem(PENDING_GOOGLE_ONBOARDING_KEY, JSON.stringify(onboarding))
}

const readPendingGoogleOnboarding = (): PendingGoogleOnboarding | null => {
  try {
    const raw = localStorage.getItem(PENDING_GOOGLE_ONBOARDING_KEY)
    if (!raw) return null

    const parsed = JSON.parse(raw) as Partial<PendingGoogleOnboarding>
    if (!parsed.user_type || !parsed.phone || !parsed.province_id || !parsed.municipality_id) {
      return null
    }

    return {
      user_type: parsed.user_type,
      phone: parsed.phone,
      province_id: parsed.province_id,
      municipality_id: parsed.municipality_id,
    }
  } catch {
    return null
  }
}

const markGoogleDeviceUsed = () => {
  localStorage.setItem(GOOGLE_DEVICE_HISTORY_KEY, '1')
}

const setGooglePasswordSetupRequired = (required: boolean) => {
  if (required) {
    localStorage.setItem(GOOGLE_PASSWORD_SETUP_REQUIRED_KEY, '1')
    return
  }

  localStorage.removeItem(GOOGLE_PASSWORD_SETUP_REQUIRED_KEY)
}

// eslint-disable-next-line react-refresh/only-export-components
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
  const [profileLoading, setProfileLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [isRootAdmin, setIsRootAdmin] = useState(false)
  const [isSuperRoot, setIsSuperRoot] = useState(false)
  const [isSupportAgent, setIsSupportAgent] = useState(false)

  const checkAdminRole = async (userId: string) => {
    try {
      // Check if user has admin role
      const { data: hasAdminRole, error: roleError } = await supabase.rpc('has_role', { 
        _user_id: userId, 
        _role: 'admin' 
      })
      
      // Check if user is root admin
      const { data: rootAdminData, error: rootError } = await supabase.rpc('is_root_admin', { 
        _user_id: userId 
      })

      // Check if user is super root
      const { data: superRootData, error: superRootError } = await supabase.rpc('is_super_root', { 
        _user_id: userId 
      })

      // Check if user is support agent
      const { data: isSupportAgentData, error: supportError } = await supabase.rpc('is_support_agent', { 
        _user_id: userId 
      })
      
      if (!roleError) {
        setIsAdmin(hasAdminRole === true || rootAdminData === true)
      }
      
      if (!rootError) {
        setIsRootAdmin(rootAdminData === true)
      }

      if (!superRootError) {
        setIsSuperRoot(superRootData === true)
      }

      if (!supportError) {
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
    setProfileLoading(true)
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .maybeSingle()

      if (error) {
        console.error('Error fetching user profile:', error)
        setProfileLoading(false)
        return
      }

      const profile = data ? {
        ...data,
        user_type: data.user_type as 'agricultor' | 'agente' | 'comprador'
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
    } finally {
      setProfileLoading(false)
    }
  }

  useEffect(() => {
    // Listen for auth changes FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session)
        setUser(session?.user ?? null)
        if (session?.user?.app_metadata?.provider === 'google') {
          markGoogleDeviceUsed()
          if (session.user.user_metadata?.google_password_set === true) {
            setGooglePasswordSetupRequired(false)
          }
        }
        if (session?.user) {
          setTimeout(() => {
            fetchUserProfile(session.user.id)
            checkAdminRole(session.user.id)
          }, 0)
        } else {
          setUserProfile(null)
          setIsAdmin(false)
          setProfileLoading(false)
          setIsRootAdmin(false)
          setIsSuperRoot(false)
          setIsSupportAgent(false)
        }
        setLoading(false)
      }
    )

    // THEN get existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user?.app_metadata?.provider === 'google') {
        markGoogleDeviceUsed()
        if (session.user.user_metadata?.google_password_set === true) {
          setGooglePasswordSetupRequired(false)
        }
      }
      if (session?.user) {
        fetchUserProfile(session.user.id)
        checkAdminRole(session.user.id)
      }
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const login = async (email: string, password: string): Promise<LoginResult> => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      })
      
      if (error) {
        let message = 'Erro ao fazer login'
        let needsEmailConfirmation = false
        if (error.message === 'Invalid login credentials') {
          message = 'Email ou senha incorretos'
        } else if (error.message.includes('User not found')) {
          message = 'Usuário não encontrado'
        } else if (error.message.includes('Email not confirmed') || error.message.includes('email not confirmed')) {
          message = 'Email não confirmado. Por favor, verifique sua caixa de entrada.'
          needsEmailConfirmation = true
        } else {
          message = error.message
        }

        return {
          error: {
            message,
            needsEmailConfirmation,
          }
        }
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
    } catch (error: unknown) {
      console.error('Erro no login:', error)
      return {
        error: {
          message: getErrorMessage(error),
        }
      }
    }
  }

  const signInWithGoogle = async (
    mode: 'login' | 'signup' = 'login',
    onboarding: PendingGoogleOnboarding | null = null,
  ) => {
    try {
      savePendingGoogleOnboarding(onboarding)
      setGooglePasswordSetupRequired(mode === 'signup')

      const queryParams = mode === 'signup'
        ? {
            // Force account chooser and consent screen when onboarding is required.
            prompt: 'consent select_account',
          }
        : undefined

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/`,
          queryParams,
        },
      })

      if (error) {
        return { error: { message: error.message } }
      }

      return { error: null }
    } catch (error: unknown) {
      return {
        error: {
          message: getErrorMessage(error),
        },
      }
    }
  }

  const completePendingGoogleOnboarding = async (authUser: User | null = user) => {
    if (!authUser) {
      return { completed: false, error: null }
    }

    const onboarding = readPendingGoogleOnboarding()
    if (!onboarding) {
      return { completed: false, error: null }
    }

    setProfileLoading(true)
    try {
      await supabase.rpc('sync_user_email_verified', { p_user_id: authUser.id })

      const { error } = await supabase.from('users').upsert(
        {
          id: authUser.id,
          email: authUser.email,
          full_name: authUser.user_metadata?.full_name ?? authUser.email?.split('@')[0] ?? 'Utilizador',
          identity_document: '',
          user_type: onboarding.user_type,
          province_id: onboarding.province_id,
          municipality_id: onboarding.municipality_id,
          phone: onboarding.phone,
          email_verified: true,
          phone_verified: false,
        },
        { onConflict: 'id' }
      )

      if (error) {
        throw error
      }

      savePendingGoogleOnboarding(null)
      await fetchUserProfile(authUser.id)

      return { completed: true, error: null }
    } catch (error: unknown) {
      return {
        completed: false,
        error: {
          message: getErrorMessage(error),
        },
      }
    } finally {
      setProfileLoading(false)
    }
  }

  const setGooglePassword = async (password: string) => {
    if (!user) {
      return { error: { message: 'Utilizador não autenticado.' } }
    }

    try {
      const { data, error } = await supabase.auth.updateUser({
        password,
        data: {
          ...(user.user_metadata ?? {}),
          google_password_set: true,
        },
      })

      if (error) {
        return { error: { message: error.message } }
      }

      if (data.user?.app_metadata?.provider === 'google') {
        markGoogleDeviceUsed()
      }

      setGooglePasswordSetupRequired(false)

      return { error: null }
    } catch (error: unknown) {
      return {
        error: {
          message: getErrorMessage(error),
        },
      }
    }
  }

  const register = async (userData: RegisterData): Promise<RegisterResult> => {
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
          emailRedirectTo: `${window.location.origin}/confirmar-email`,
          data: {
            full_name,
            user_type,
            province_id,
            municipality_id,
            identity_document,
            phone,
            referred_by_agent_id: referredByAgentId
          }
        }
      })

      if (error) {
        return { error: { message: error.message }, data: null }
      }

      // Triggers automáticos criam: perfil, carteira, código agente, referral

      return { error: null, data: data ? { user: data.user } : null }
    } catch (error: unknown) {
      console.error('Erro no registro:', error)
      return { error: { message: getErrorMessage(error) }, data: null }
    }
  }

  const logout = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setUserProfile(null)
    // Clear localStorage on logout
    localStorage.removeItem('userProfile')
  }

  const verifyEmail = async (token: string) => {
    // For email confirmation, Supabase handles this automatically via the callback URL
    // This function is deprecated - email confirmation happens in EmailConfirmation page
    return { error: null }
  }

  const resendVerification = async () => {
    if (!user?.email) {
      return { error: { message: 'No email found' } }
    }

    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: user.email,
      options: {
        emailRedirectTo: `${window.location.origin}/confirmar-email`
      }
    })
    return { error }
  }

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`
    })
    return { error }
  }

  const value = {
    user,
    userProfile,
    loading,
    profileLoading,
    isAdmin,
    isRootAdmin,
    isSuperRoot,
    isSupportAgent,
    login,
    signInWithGoogle,
    completePendingGoogleOnboarding,
    setGooglePassword,
    register,
    logout,
    verifyEmail,
    resendVerification,
    resetPassword
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}