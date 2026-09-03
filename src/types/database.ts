// Tipos temporários para o banco de dados AgriLink
export interface User {
  id: string
  email: string | null
  phone: string | null
  full_name: string
  identity_document: string
  user_type: 'agricultor' | 'agente' | 'comprador' | 'motorista'
  province_id: string
  municipality_id: string
  email_verified: boolean
  phone_verified: boolean
  avatar_url?: string
  load_capacity_kg?: number | null
  created_at: string
  updated_at: string
}

export interface Product {
  id: string
  user_id: string
  product_type: string
  quantity: number
  harvest_date: string
  price: number
  province_id: string
  municipality_id: string
  logistics_access: 'sim' | 'nao' | 'parcial'
  farmer_name: string
  contact: string
  photos: string[] | null
  description?: string
  status: 'active' | 'inactive' | 'removed'
  created_at: string
  updated_at: string
}

export interface RegisterData {
  email: string
  phone?: string
  full_name: string
  identity_document: string
  user_type: 'agricultor' | 'agente' | 'comprador' | 'motorista'
  province_id: string
  municipality_id: string
  password: string
  load_capacity_kg?: number | null
  referred_by_agent_id?: string | null
}