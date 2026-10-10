export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      admin_permissions: {
        Row: {
          granted_at: string | null
          granted_by: string | null
          id: string
          permission: Database["public"]["Enums"]["admin_permission"]
          user_id: string
        }
        Insert: {
          granted_at?: string | null
          granted_by?: string | null
          id?: string
          permission: Database["public"]["Enums"]["admin_permission"]
          user_id: string
        }
        Update: {
          granted_at?: string | null
          granted_by?: string | null
          id?: string
          permission?: Database["public"]["Enums"]["admin_permission"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_permissions_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_permissions_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "users_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_permissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_permissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_public"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_referrals: {
        Row: {
          agent_id: string
          created_at: string | null
          id: string
          points: number
          referred_user_id: string
        }
        Insert: {
          agent_id: string
          created_at?: string | null
          id?: string
          points?: number
          referred_user_id: string
        }
        Update: {
          agent_id?: string
          created_at?: string | null
          id?: string
          points?: number
          referred_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_referrals_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_referrals_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "users_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_referrals_referred_user_id_fkey"
            columns: ["referred_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_referrals_referred_user_id_fkey"
            columns: ["referred_user_id"]
            isOneToOne: false
            referencedRelation: "users_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_agent_referrals_agent"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_agent_referrals_agent"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "users_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_agent_referrals_referred_user"
            columns: ["referred_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_agent_referrals_referred_user"
            columns: ["referred_user_id"]
            isOneToOne: false
            referencedRelation: "users_public"
            referencedColumns: ["id"]
          },
        ]
      }
      agrilink_ad_ratings: {
        Row: {
          ad_id: string
          created_at: string
          rating: number
          updated_at: string
          user_id: string
        }
        Insert: {
          ad_id: string
          created_at?: string
          rating: number
          updated_at?: string
          user_id: string
        }
        Update: {
          ad_id?: string
          created_at?: string
          rating?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agrilink_ad_ratings_ad_id_fkey"
            columns: ["ad_id"]
            isOneToOne: false
            referencedRelation: "agrilink_ads"
            referencedColumns: ["id"]
          },
        ]
      }
      agrilink_ads: {
        Row: {
          created_at: string
          created_by: string
          description: string
          id: string
          image_urls: string[]
          rating_average: number
          rating_count: number
          rating_sum: number
          status: string
          target_url: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description: string
          id?: string
          image_urls: string[]
          rating_average?: number
          rating_count?: number
          rating_sum?: number
          status?: string
          target_url: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string
          id?: string
          image_urls?: string[]
          rating_average?: number
          rating_count?: number
          rating_sum?: number
          status?: string
          target_url?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      api_rate_limits: {
        Row: {
          bucket_key: string
          request_count: number
          updated_at: string
          window_started: string
        }
        Insert: {
          bucket_key: string
          request_count?: number
          updated_at?: string
          window_started?: string
        }
        Update: {
          bucket_key?: string
          request_count?: number
          updated_at?: string
          window_started?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          details: Json | null
          event_type: string | null
          id: string
          ip_address: string | null
          log_time: string | null
          user_email: string | null
          user_id: string
          user_type: string | null
        }
        Insert: {
          action: string
          details?: Json | null
          event_type?: string | null
          id?: string
          ip_address?: string | null
          log_time?: string | null
          user_email?: string | null
          user_id: string
          user_type?: string | null
        }
        Update: {
          action?: string
          details?: Json | null
          event_type?: string | null
          id?: string
          ip_address?: string | null
          log_time?: string | null
          user_email?: string | null
          user_id?: string
          user_type?: string | null
        }
        Relationships: []
      }
      chat_encryption_keys: {
        Row: {
          key_version: number
          public_key: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          key_version?: number
          public_key: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          key_version?: number
          public_key?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      comment_likes: {
        Row: {
          comment_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comment_likes_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "product_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      comment_replies: {
        Row: {
          comment_id: string
          created_at: string
          id: string
          reply_text: string
          user_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string
          id?: string
          reply_text: string
          user_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string
          id?: string
          reply_text?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comment_replies_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "product_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      commissions: {
        Row: {
          amount: number
          created_at: string
          id: string
          percentage: number
          transaction_id: string
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          percentage: number
          transaction_id: string
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          percentage?: number
          transaction_id?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "commissions_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_commissions_transaction"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_commissions_user"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_commissions_user"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_public"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          avatar: string | null
          created_at: string | null
          id: string
          last_message: string | null
          last_timestamp: string | null
          participant_id: string | null
          peer_user_id: string | null
          title: string
          unread_count: number | null
          user_id: string
        }
        Insert: {
          avatar?: string | null
          created_at?: string | null
          id?: string
          last_message?: string | null
          last_timestamp?: string | null
          participant_id?: string | null
          peer_user_id?: string | null
          title: string
          unread_count?: number | null
          user_id: string
        }
        Update: {
          avatar?: string | null
          created_at?: string | null
          id?: string
          last_message?: string | null
          last_timestamp?: string | null
          participant_id?: string | null
          peer_user_id?: string | null
          title?: string
          unread_count?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_conversations_participant"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_conversations_participant"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "users_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_conversations_user"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_conversations_user"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_public"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_tracking: {
        Row: {
          assigned_at: string
          assistant_id: string
          created_at: string
          delivered_at: string | null
          id: string
          in_transit_at: string | null
          notes: string | null
          order_id: string
          pickup_at: string | null
          status: string
          total_duration_minutes: number | null
          updated_at: string
        }
        Insert: {
          assigned_at?: string
          assistant_id: string
          created_at?: string
          delivered_at?: string | null
          id?: string
          in_transit_at?: string | null
          notes?: string | null
          order_id: string
          pickup_at?: string | null
          status?: string
          total_duration_minutes?: number | null
          updated_at?: string
        }
        Update: {
          assigned_at?: string
          assistant_id?: string
          created_at?: string
          delivered_at?: string | null
          id?: string
          in_transit_at?: string | null
          notes?: string | null
          order_id?: string
          pickup_at?: string | null
          status?: string
          total_duration_minutes?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_tracking_assistant_id_fkey"
            columns: ["assistant_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_tracking_assistant_id_fkey"
            columns: ["assistant_id"]
            isOneToOne: false
            referencedRelation: "users_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_tracking_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      digital_contracts: {
        Row: {
          admin_notes: string | null
          agent_id: string | null
          approved_at: string | null
          approved_by: string | null
          buyer_id: string | null
          conditions: string | null
          created_at: string
          currency: string
          delivery_terms: string | null
          driver_id: string | null
          id: string
          price: number | null
          product_name: string
          quantity: number | null
          requested_by: string
          source_id: string
          source_type: string
          status: string
          supplier_id: string | null
          unit: string
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          agent_id?: string | null
          approved_at?: string | null
          approved_by?: string | null
          buyer_id?: string | null
          conditions?: string | null
          created_at?: string
          currency?: string
          delivery_terms?: string | null
          driver_id?: string | null
          id?: string
          price?: number | null
          product_name: string
          quantity?: number | null
          requested_by: string
          source_id: string
          source_type: string
          status?: string
          supplier_id?: string | null
          unit?: string
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          agent_id?: string | null
          approved_at?: string | null
          approved_by?: string | null
          buyer_id?: string | null
          conditions?: string | null
          created_at?: string
          currency?: string
          delivery_terms?: string | null
          driver_id?: string | null
          id?: string
          price?: number | null
          product_name?: string
          quantity?: number | null
          requested_by?: string
          source_id?: string
          source_type?: string
          status?: string
          supplier_id?: string | null
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "digital_contracts_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "digital_contracts_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "users_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "digital_contracts_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "digital_contracts_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "users_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "digital_contracts_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "digital_contracts_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "users_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "digital_contracts_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "digital_contracts_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "users_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "digital_contracts_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "digital_contracts_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "users_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "digital_contracts_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "digital_contracts_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "users_public"
            referencedColumns: ["id"]
          },
        ]
      }
      email_outbox: {
        Row: {
          attempts: number
          available_at: string
          created_at: string
          dedupe_key: string
          id: string
          last_error: string | null
          locked_at: string | null
          payload: Json
          priority: number
          provider_id: string | null
          recipient: string
          scheduled_at: string
          sent_at: string | null
          status: string
          subject: string
          template: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          available_at?: string
          created_at?: string
          dedupe_key: string
          id?: string
          last_error?: string | null
          locked_at?: string | null
          payload?: Json
          priority?: number
          provider_id?: string | null
          recipient: string
          scheduled_at?: string
          sent_at?: string | null
          status?: string
          subject: string
          template?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          available_at?: string
          created_at?: string
          dedupe_key?: string
          id?: string
          last_error?: string | null
          locked_at?: string | null
          payload?: Json
          priority?: number
          provider_id?: string | null
          recipient?: string
          scheduled_at?: string
          sent_at?: string | null
          status?: string
          subject?: string
          template?: string
          updated_at?: string
        }
        Relationships: []
      }
      email_verification_codes: {
        Row: {
          code: string
          created_at: string
          email: string
          expires_at: string
          id: string
          user_id: string
          verified: boolean | null
        }
        Insert: {
          code: string
          created_at?: string
          email: string
          expires_at: string
          id?: string
          user_id: string
          verified?: boolean | null
        }
        Update: {
          code?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          user_id?: string
          verified?: boolean | null
        }
        Relationships: []
      }
      fichas_recebimento: {
        Row: {
          created_at: string | null
          descricao_final: string | null
          embalagem: string | null
          id: string
          locais_entrega: Json | null
          nome_ficha: string
          observacoes: string | null
          produto: string
          qualidade: string | null
          telefone: string | null
          tipo_negocio: string
          transporte: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          descricao_final?: string | null
          embalagem?: string | null
          id?: string
          locais_entrega?: Json | null
          nome_ficha: string
          observacoes?: string | null
          produto: string
          qualidade?: string | null
          telefone?: string | null
          tipo_negocio: string
          transporte?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          descricao_final?: string | null
          embalagem?: string | null
          id?: string
          locais_entrega?: Json | null
          nome_ficha?: string
          observacoes?: string | null
          produto?: string
          qualidade?: string | null
          telefone?: string | null
          tipo_negocio?: string
          transporte?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      freight_load_location_history: {
        Row: {
          accuracy_m: number | null
          freight_load_id: string
          heading_deg: number | null
          id: string
          latitude: number
          longitude: number
          recorded_at: string
          speed_mps: number | null
        }
        Insert: {
          accuracy_m?: number | null
          freight_load_id: string
          heading_deg?: number | null
          id?: string
          latitude: number
          longitude: number
          recorded_at?: string
          speed_mps?: number | null
        }
        Update: {
          accuracy_m?: number | null
          freight_load_id?: string
          heading_deg?: number | null
          id?: string
          latitude?: number
          longitude?: number
          recorded_at?: string
          speed_mps?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "freight_load_location_history_freight_load_id_fkey"
            columns: ["freight_load_id"]
            isOneToOne: false
            referencedRelation: "freight_loads"
            referencedColumns: ["id"]
          },
        ]
      }
      freight_load_locations: {
        Row: {
          accuracy_m: number | null
          freight_load_id: string
          heading_deg: number | null
          latitude: number
          longitude: number
          recorded_at: string
          speed_mps: number | null
        }
        Insert: {
          accuracy_m?: number | null
          freight_load_id: string
          heading_deg?: number | null
          latitude: number
          longitude: number
          recorded_at?: string
          speed_mps?: number | null
        }
        Update: {
          accuracy_m?: number | null
          freight_load_id?: string
          heading_deg?: number | null
          latitude?: number
          longitude?: number
          recorded_at?: string
          speed_mps?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "freight_load_locations_freight_load_id_fkey"
            columns: ["freight_load_id"]
            isOneToOne: true
            referencedRelation: "freight_loads"
            referencedColumns: ["id"]
          },
        ]
      }
      freight_loads: {
        Row: {
          accepted_at: string | null
          contract_id: string | null
          created_at: string
          created_by: string
          currency: string
          delivered_at: string | null
          destination_label: string
          destination_lat: number | null
          destination_lng: number | null
          driver_id: string | null
          driver_offered_price: number | null
          driver_price_method: string | null
          driver_quote_status: string
          id: string
          in_transit_at: string | null
          notes: string | null
          offered_price: number | null
          order_id: string | null
          origin_label: string
          origin_lat: number | null
          origin_lng: number | null
          pickup_date: string | null
          pre_order_id: string | null
          product_id: string | null
          product_name: string
          qr_token: string
          route_distance_km: number | null
          route_duration_minutes: number | null
          status: string
          updated_at: string
          weight_kg: number
        }
        Insert: {
          accepted_at?: string | null
          contract_id?: string | null
          created_at?: string
          created_by: string
          currency?: string
          delivered_at?: string | null
          destination_label: string
          destination_lat?: number | null
          destination_lng?: number | null
          driver_id?: string | null
          driver_offered_price?: number | null
          driver_price_method?: string | null
          driver_quote_status?: string
          id?: string
          in_transit_at?: string | null
          notes?: string | null
          offered_price?: number | null
          order_id?: string | null
          origin_label: string
          origin_lat?: number | null
          origin_lng?: number | null
          pickup_date?: string | null
          pre_order_id?: string | null
          product_id?: string | null
          product_name: string
          qr_token?: string
          route_distance_km?: number | null
          route_duration_minutes?: number | null
          status?: string
          updated_at?: string
          weight_kg?: number
        }
        Update: {
          accepted_at?: string | null
          contract_id?: string | null
          created_at?: string
          created_by?: string
          currency?: string
          delivered_at?: string | null
          destination_label?: string
          destination_lat?: number | null
          destination_lng?: number | null
          driver_id?: string | null
          driver_offered_price?: number | null
          driver_price_method?: string | null
          driver_quote_status?: string
          id?: string
          in_transit_at?: string | null
          notes?: string | null
          offered_price?: number | null
          order_id?: string | null
          origin_label?: string
          origin_lat?: number | null
          origin_lng?: number | null
          pickup_date?: string | null
          pre_order_id?: string | null
          product_id?: string | null
          product_name?: string
          qr_token?: string
          route_distance_km?: number | null
          route_duration_minutes?: number | null
          status?: string
          updated_at?: string
          weight_kg?: number
        }
        Relationships: [
          {
            foreignKeyName: "freight_loads_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "digital_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "freight_loads_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "freight_loads_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "freight_loads_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "freight_loads_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "users_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "freight_loads_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "freight_loads_pre_order_id_fkey"
            columns: ["pre_order_id"]
            isOneToOne: false
            referencedRelation: "pre_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "freight_loads_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      freight_pricing_settings: {
        Row: {
          base_fare_kz: number | null
          category_multipliers: Json
          id: boolean
          rate_per_100kg_kz: number | null
          rate_per_km_kz: number | null
          rate_per_km_per_100kg: number | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          base_fare_kz?: number | null
          category_multipliers?: Json
          id?: boolean
          rate_per_100kg_kz?: number | null
          rate_per_km_kz?: number | null
          rate_per_km_per_100kg?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          base_fare_kz?: number | null
          category_multipliers?: Json
          id?: boolean
          rate_per_100kg_kz?: number | null
          rate_per_km_kz?: number | null
          rate_per_km_per_100kg?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "freight_pricing_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "freight_pricing_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users_public"
            referencedColumns: ["id"]
          },
        ]
      }
      futures_contracts: {
        Row: {
          admin_notes: string | null
          agreed_price: number | null
          buyer_id: string
          buyer_signature_name: string | null
          cancelled_at: string | null
          created_at: string
          currency: string
          delivery_date: string
          delivery_location: string | null
          description: string | null
          ficha_id: string | null
          fulfilled_at: string | null
          id: string
          match_notes: string | null
          municipality_id: string | null
          packaging: string | null
          penalty_percentage: number
          producer_confirmed_at: string | null
          producer_id: string | null
          product_id: string | null
          product_name: string
          proposed_price: number
          province_id: string | null
          quality_specs: string | null
          quantity: number
          status: string
          terms_accepted_at: string | null
          terms_version: string
          transport: string | null
          unit: string
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          agreed_price?: number | null
          buyer_id: string
          buyer_signature_name?: string | null
          cancelled_at?: string | null
          created_at?: string
          currency?: string
          delivery_date: string
          delivery_location?: string | null
          description?: string | null
          ficha_id?: string | null
          fulfilled_at?: string | null
          id?: string
          match_notes?: string | null
          municipality_id?: string | null
          packaging?: string | null
          penalty_percentage?: number
          producer_confirmed_at?: string | null
          producer_id?: string | null
          product_id?: string | null
          product_name: string
          proposed_price: number
          province_id?: string | null
          quality_specs?: string | null
          quantity: number
          status?: string
          terms_accepted_at?: string | null
          terms_version?: string
          transport?: string | null
          unit?: string
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          agreed_price?: number | null
          buyer_id?: string
          buyer_signature_name?: string | null
          cancelled_at?: string | null
          created_at?: string
          currency?: string
          delivery_date?: string
          delivery_location?: string | null
          description?: string | null
          ficha_id?: string | null
          fulfilled_at?: string | null
          id?: string
          match_notes?: string | null
          municipality_id?: string | null
          packaging?: string | null
          penalty_percentage?: number
          producer_confirmed_at?: string | null
          producer_id?: string | null
          product_id?: string | null
          product_name?: string
          proposed_price?: number
          province_id?: string | null
          quality_specs?: string | null
          quantity?: number
          status?: string
          terms_accepted_at?: string | null
          terms_version?: string
          transport?: string | null
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "futures_contracts_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "futures_contracts_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "users_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "futures_contracts_ficha_id_fkey"
            columns: ["ficha_id"]
            isOneToOne: false
            referencedRelation: "fichas_recebimento"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "futures_contracts_producer_id_fkey"
            columns: ["producer_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "futures_contracts_producer_id_fkey"
            columns: ["producer_id"]
            isOneToOne: false
            referencedRelation: "users_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "futures_contracts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      green_point_order_items: {
        Row: {
          created_at: string
          id: string
          order_id: string
          product_id: string
          product_name: string
          quantity: number
          subtotal: number
          unit: string
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          product_id: string
          product_name: string
          quantity: number
          subtotal: number
          unit: string
          unit_price: number
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          product_id?: string
          product_name?: string
          quantity?: number
          subtotal?: number
          unit?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "green_point_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "green_point_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "green_point_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "green_point_products"
            referencedColumns: ["id"]
          },
        ]
      }
      green_point_orders: {
        Row: {
          buyer_id: string
          created_at: string
          id: string
          payment_method: string
          pickup_date: string
          point_id: string
          status: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          buyer_id: string
          created_at?: string
          id?: string
          payment_method?: string
          pickup_date: string
          point_id: string
          status?: string
          total_amount: number
          updated_at?: string
        }
        Update: {
          buyer_id?: string
          created_at?: string
          id?: string
          payment_method?: string
          pickup_date?: string
          point_id?: string
          status?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "green_point_orders_point_id_fkey"
            columns: ["point_id"]
            isOneToOne: false
            referencedRelation: "green_points"
            referencedColumns: ["id"]
          },
        ]
      }
      green_point_products: {
        Row: {
          description: string | null
          id: string
          is_available: boolean
          market_price: number
          point_id: string
          price: number
          product_name: string
          stock_quantity: number
          unit: string
          updated_at: string
        }
        Insert: {
          description?: string | null
          id?: string
          is_available?: boolean
          market_price: number
          point_id: string
          price: number
          product_name: string
          stock_quantity?: number
          unit?: string
          updated_at?: string
        }
        Update: {
          description?: string | null
          id?: string
          is_available?: boolean
          market_price?: number
          point_id?: string
          price?: number
          product_name?: string
          stock_quantity?: number
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "green_point_products_point_id_fkey"
            columns: ["point_id"]
            isOneToOne: false
            referencedRelation: "green_points"
            referencedColumns: ["id"]
          },
        ]
      }
      green_points: {
        Row: {
          address: string
          created_at: string
          id: string
          is_active: boolean
          municipality: string
          name: string
          phone: string | null
          province: string
          updated_at: string
        }
        Insert: {
          address: string
          created_at?: string
          id?: string
          is_active?: boolean
          municipality: string
          name: string
          phone?: string | null
          province: string
          updated_at?: string
        }
        Update: {
          address?: string
          created_at?: string
          id?: string
          is_active?: boolean
          municipality?: string
          name?: string
          phone?: string | null
          province?: string
          updated_at?: string
        }
        Relationships: []
      }
      map_geocoding_cache: {
        Row: {
          cached_at: string
          query_key: string
          results: Json
        }
        Insert: {
          cached_at?: string
          query_key: string
          results: Json
        }
        Update: {
          cached_at?: string
          query_key?: string
          results?: Json
        }
        Relationships: []
      }
      map_geocoding_state: {
        Row: {
          last_requested_at: string | null
          singleton: boolean
        }
        Insert: {
          last_requested_at?: string | null
          singleton?: boolean
        }
        Update: {
          last_requested_at?: string | null
          singleton?: boolean
        }
        Relationships: []
      }
      market_prices: {
        Row: {
          created_at: string
          created_by: string | null
          date: string
          id: string
          market_location: string
          market_type: string
          price_change_pct: number
          price_kz: number
          product: string
          published: boolean
          unit: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          date?: string
          id?: string
          market_location: string
          market_type?: string
          price_change_pct?: number
          price_kz: number
          product: string
          published?: boolean
          unit?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          date?: string
          id?: string
          market_location?: string
          market_type?: string
          price_change_pct?: number
          price_kz?: number
          product?: string
          published?: boolean
          unit?: string
          updated_at?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          conversation_id: string | null
          created_at: string | null
          files: Json | null
          id: string
          read: boolean | null
          receiver_id: string
          sender_id: string | null
        }
        Insert: {
          content: string
          conversation_id?: string | null
          created_at?: string | null
          files?: Json | null
          id?: string
          read?: boolean | null
          receiver_id: string
          sender_id?: string | null
        }
        Update: {
          content?: string
          conversation_id?: string | null
          created_at?: string | null
          files?: Json | null
          id?: string
          read?: boolean | null
          receiver_id?: string
          sender_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_messages_conversation"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_messages_receiver"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_messages_receiver"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "users_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_messages_sender"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_messages_sender"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "users_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "users_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "users_public"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_push_queue: {
        Row: {
          attempts: number
          created_at: string
          dispatch_token: string
          dispatched_at: string | null
          id: string
          last_error: string | null
          locked_at: string | null
          next_attempt_at: string
          notification_id: string
          status: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          dispatch_token?: string
          dispatched_at?: string | null
          id?: string
          last_error?: string | null
          locked_at?: string | null
          next_attempt_at?: string
          notification_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          dispatch_token?: string
          dispatched_at?: string | null
          id?: string
          last_error?: string | null
          locked_at?: string | null
          next_attempt_at?: string
          notification_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_push_queue_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: true
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          message: string
          metadata: Json | null
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          metadata?: Json | null
          read?: boolean
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          metadata?: Json | null
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_notifications_user"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_notifications_user"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_public"
            referencedColumns: ["id"]
          },
        ]
      }
      order_transaction_events: {
        Row: {
          actor_id: string | null
          created_at: string
          event_type: string
          freight_load_id: string | null
          from_status: string | null
          id: string
          metadata: Json
          order_id: string | null
          pre_order_id: string | null
          to_status: string | null
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          event_type: string
          freight_load_id?: string | null
          from_status?: string | null
          id?: string
          metadata?: Json
          order_id?: string | null
          pre_order_id?: string | null
          to_status?: string | null
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          event_type?: string
          freight_load_id?: string | null
          from_status?: string | null
          id?: string
          metadata?: Json
          order_id?: string | null
          pre_order_id?: string | null
          to_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_transaction_events_freight_load_id_fkey"
            columns: ["freight_load_id"]
            isOneToOne: false
            referencedRelation: "freight_loads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_transaction_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_transaction_events_pre_order_id_fkey"
            columns: ["pre_order_id"]
            isOneToOne: false
            referencedRelation: "pre_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string | null
          delivery_lat: number | null
          delivery_lng: number | null
          id: string
          location: string
          paid_amount: number
          paid_at: string | null
          payment_status: string
          pre_order_id: string | null
          product_id: string
          quantity: number
          status: string
          total_price: number
          transport_fee: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          delivery_lat?: number | null
          delivery_lng?: number | null
          id?: string
          location: string
          paid_amount?: number
          paid_at?: string | null
          payment_status?: string
          pre_order_id?: string | null
          product_id: string
          quantity: number
          status?: string
          total_price: number
          transport_fee?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          delivery_lat?: number | null
          delivery_lng?: number | null
          id?: string
          location?: string
          paid_amount?: number
          paid_at?: string | null
          payment_status?: string
          pre_order_id?: string | null
          product_id?: string
          quantity?: number
          status?: string
          total_price?: number
          transport_fee?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_orders_pre_order"
            columns: ["pre_order_id"]
            isOneToOne: false
            referencedRelation: "pre_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_orders_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_orders_user"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_orders_user"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_pre_order_id_fkey"
            columns: ["pre_order_id"]
            isOneToOne: false
            referencedRelation: "pre_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_public"
            referencedColumns: ["id"]
          },
        ]
      }
      p2p_audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          beneficiary_id: string | null
          created_at: string
          id: string
          metadata: Json
          p2p_order_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          beneficiary_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          p2p_order_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          beneficiary_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          p2p_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "p2p_audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "p2p_audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "users_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "p2p_audit_logs_beneficiary_id_fkey"
            columns: ["beneficiary_id"]
            isOneToOne: false
            referencedRelation: "p2p_beneficiaries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "p2p_audit_logs_p2p_order_id_fkey"
            columns: ["p2p_order_id"]
            isOneToOne: false
            referencedRelation: "p2p_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      p2p_beneficiaries: {
        Row: {
          application_id: string | null
          approved_at: string | null
          approved_by: string | null
          availability_status: string
          average_completion_seconds: number
          cancelled_count: number
          completed_count: number
          completion_rate: number
          created_at: string
          daily_limit: number
          dispute_count: number
          id: string
          monthly_limit: number
          per_transaction_limit: number
          simultaneous_limit: number
          status: string
          updated_at: string
          user_id: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          application_id?: string | null
          approved_at?: string | null
          approved_by?: string | null
          availability_status?: string
          average_completion_seconds?: number
          cancelled_count?: number
          completed_count?: number
          completion_rate?: number
          created_at?: string
          daily_limit?: number
          dispute_count?: number
          id?: string
          monthly_limit?: number
          per_transaction_limit?: number
          simultaneous_limit?: number
          status?: string
          updated_at?: string
          user_id: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          application_id?: string | null
          approved_at?: string | null
          approved_by?: string | null
          availability_status?: string
          average_completion_seconds?: number
          cancelled_count?: number
          completed_count?: number
          completion_rate?: number
          created_at?: string
          daily_limit?: number
          dispute_count?: number
          id?: string
          monthly_limit?: number
          per_transaction_limit?: number
          simultaneous_limit?: number
          status?: string
          updated_at?: string
          user_id?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "p2p_beneficiaries_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "p2p_beneficiary_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "p2p_beneficiaries_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "p2p_beneficiaries_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "users_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "p2p_beneficiaries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "p2p_beneficiaries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "p2p_beneficiaries_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "p2p_beneficiaries_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "users_public"
            referencedColumns: ["id"]
          },
        ]
      }
      p2p_beneficiary_accounts: {
        Row: {
          account_holder: string
          account_identifier: string
          active: boolean
          beneficiary_id: string
          channel: string
          created_at: string
          currency: string
          id: string
          instructions: string | null
          max_amount: number
          updated_at: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          account_holder: string
          account_identifier: string
          active?: boolean
          beneficiary_id: string
          channel: string
          created_at?: string
          currency?: string
          id?: string
          instructions?: string | null
          max_amount?: number
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          account_holder?: string
          account_identifier?: string
          active?: boolean
          beneficiary_id?: string
          channel?: string
          created_at?: string
          currency?: string
          id?: string
          instructions?: string | null
          max_amount?: number
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "p2p_beneficiary_accounts_beneficiary_id_fkey"
            columns: ["beneficiary_id"]
            isOneToOne: false
            referencedRelation: "p2p_beneficiaries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "p2p_beneficiary_accounts_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "p2p_beneficiary_accounts_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "users_public"
            referencedColumns: ["id"]
          },
        ]
      }
      p2p_beneficiary_applications: {
        Row: {
          created_at: string
          id: string
          legal_name: string
          notes: string | null
          phone: string | null
          rejection_reason: string | null
          requested_channels: string[]
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          legal_name: string
          notes?: string | null
          phone?: string | null
          rejection_reason?: string | null
          requested_channels?: string[]
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          legal_name?: string
          notes?: string | null
          phone?: string | null
          rejection_reason?: string | null
          requested_channels?: string[]
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "p2p_beneficiary_applications_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "p2p_beneficiary_applications_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "users_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "p2p_beneficiary_applications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "p2p_beneficiary_applications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_public"
            referencedColumns: ["id"]
          },
        ]
      }
      p2p_disputes: {
        Row: {
          created_at: string
          id: string
          opened_by: string
          p2p_order_id: string
          reason: string
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          opened_by: string
          p2p_order_id: string
          reason: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          opened_by?: string
          p2p_order_id?: string
          reason?: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "p2p_disputes_opened_by_fkey"
            columns: ["opened_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "p2p_disputes_opened_by_fkey"
            columns: ["opened_by"]
            isOneToOne: false
            referencedRelation: "users_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "p2p_disputes_p2p_order_id_fkey"
            columns: ["p2p_order_id"]
            isOneToOne: false
            referencedRelation: "p2p_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "p2p_disputes_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "p2p_disputes_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "users_public"
            referencedColumns: ["id"]
          },
        ]
      }
      p2p_limits: {
        Row: {
          beneficiary_id: string
          daily: number
          id: string
          monthly: number
          per_transaction: number
          simultaneous: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          beneficiary_id: string
          daily?: number
          id?: string
          monthly?: number
          per_transaction?: number
          simultaneous?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          beneficiary_id?: string
          daily?: number
          id?: string
          monthly?: number
          per_transaction?: number
          simultaneous?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "p2p_limits_beneficiary_id_fkey"
            columns: ["beneficiary_id"]
            isOneToOne: true
            referencedRelation: "p2p_beneficiaries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "p2p_limits_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "p2p_limits_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users_public"
            referencedColumns: ["id"]
          },
        ]
      }
      p2p_matches: {
        Row: {
          beneficiary_id: string
          created_at: string
          id: string
          offered_at: string
          p2p_order_id: string
          responded_at: string | null
          score: number
          status: string
        }
        Insert: {
          beneficiary_id: string
          created_at?: string
          id?: string
          offered_at?: string
          p2p_order_id: string
          responded_at?: string | null
          score?: number
          status?: string
        }
        Update: {
          beneficiary_id?: string
          created_at?: string
          id?: string
          offered_at?: string
          p2p_order_id?: string
          responded_at?: string | null
          score?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "p2p_matches_beneficiary_id_fkey"
            columns: ["beneficiary_id"]
            isOneToOne: false
            referencedRelation: "p2p_beneficiaries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "p2p_matches_p2p_order_id_fkey"
            columns: ["p2p_order_id"]
            isOneToOne: false
            referencedRelation: "p2p_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      p2p_orders: {
        Row: {
          accepted_at: string | null
          amount: number
          beneficiary_account_id: string | null
          beneficiary_id: string | null
          beneficiary_note: string | null
          buyer_id: string
          cancelled_at: string | null
          completed_at: string | null
          created_at: string
          currency: string
          expires_at: string
          id: string
          payer_note: string | null
          payment_channel: string
          payment_intent_id: string | null
          pre_order_id: string | null
          status: string
          submitted_at: string | null
          transfer_reference: string | null
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          amount: number
          beneficiary_account_id?: string | null
          beneficiary_id?: string | null
          beneficiary_note?: string | null
          buyer_id: string
          cancelled_at?: string | null
          completed_at?: string | null
          created_at?: string
          currency?: string
          expires_at: string
          id?: string
          payer_note?: string | null
          payment_channel: string
          payment_intent_id?: string | null
          pre_order_id?: string | null
          status?: string
          submitted_at?: string | null
          transfer_reference?: string | null
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          amount?: number
          beneficiary_account_id?: string | null
          beneficiary_id?: string | null
          beneficiary_note?: string | null
          buyer_id?: string
          cancelled_at?: string | null
          completed_at?: string | null
          created_at?: string
          currency?: string
          expires_at?: string
          id?: string
          payer_note?: string | null
          payment_channel?: string
          payment_intent_id?: string | null
          pre_order_id?: string | null
          status?: string
          submitted_at?: string | null
          transfer_reference?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "p2p_orders_beneficiary_account_id_fkey"
            columns: ["beneficiary_account_id"]
            isOneToOne: false
            referencedRelation: "p2p_beneficiary_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "p2p_orders_beneficiary_id_fkey"
            columns: ["beneficiary_id"]
            isOneToOne: false
            referencedRelation: "p2p_beneficiaries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "p2p_orders_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "p2p_orders_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "users_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "p2p_orders_payment_intent_id_fkey"
            columns: ["payment_intent_id"]
            isOneToOne: false
            referencedRelation: "payment_intents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "p2p_orders_pre_order_id_fkey"
            columns: ["pre_order_id"]
            isOneToOne: false
            referencedRelation: "pre_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      p2p_reputation: {
        Row: {
          avg_completion_seconds: number
          beneficiary_id: string
          cancelled_count: number
          completed_count: number
          dispute_count: number
          id: string
          score: number
          updated_at: string
        }
        Insert: {
          avg_completion_seconds?: number
          beneficiary_id: string
          cancelled_count?: number
          completed_count?: number
          dispute_count?: number
          id?: string
          score?: number
          updated_at?: string
        }
        Update: {
          avg_completion_seconds?: number
          beneficiary_id?: string
          cancelled_count?: number
          completed_count?: number
          dispute_count?: number
          id?: string
          score?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "p2p_reputation_beneficiary_id_fkey"
            columns: ["beneficiary_id"]
            isOneToOne: true
            referencedRelation: "p2p_beneficiaries"
            referencedColumns: ["id"]
          },
        ]
      }
      p2p_transaction_events: {
        Row: {
          actor_id: string | null
          created_at: string
          event_type: string
          from_status: string | null
          id: string
          metadata: Json
          p2p_order_id: string
          to_status: string | null
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          event_type: string
          from_status?: string | null
          id?: string
          metadata?: Json
          p2p_order_id: string
          to_status?: string | null
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          event_type?: string
          from_status?: string | null
          id?: string
          metadata?: Json
          p2p_order_id?: string
          to_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "p2p_transaction_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "p2p_transaction_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "users_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "p2p_transaction_events_p2p_order_id_fkey"
            columns: ["p2p_order_id"]
            isOneToOne: false
            referencedRelation: "p2p_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_allocations: {
        Row: {
          allocation_type: string
          amount: number
          created_at: string
          currency: string
          id: string
          metadata: Json
          order_id: string | null
          payment_intent_id: string
          recipient_user_id: string
          released_at: string | null
          status: string
          wallet_transaction_id: string | null
        }
        Insert: {
          allocation_type: string
          amount: number
          created_at?: string
          currency?: string
          id?: string
          metadata?: Json
          order_id?: string | null
          payment_intent_id: string
          recipient_user_id: string
          released_at?: string | null
          status?: string
          wallet_transaction_id?: string | null
        }
        Update: {
          allocation_type?: string
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          metadata?: Json
          order_id?: string | null
          payment_intent_id?: string
          recipient_user_id?: string
          released_at?: string | null
          status?: string
          wallet_transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_allocations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_allocations_payment_intent_id_fkey"
            columns: ["payment_intent_id"]
            isOneToOne: false
            referencedRelation: "payment_intents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_allocations_recipient_user_id_fkey"
            columns: ["recipient_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_allocations_recipient_user_id_fkey"
            columns: ["recipient_user_id"]
            isOneToOne: false
            referencedRelation: "users_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_allocations_wallet_transaction_id_fkey"
            columns: ["wallet_transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_attempts: {
        Row: {
          attempt_number: number
          completed_at: string | null
          created_at: string
          failure_code: string | null
          failure_message: string | null
          id: string
          payment_intent_id: string
          provider_id: string
          provider_reference: string | null
          request_payload: Json
          response_payload: Json
          status: string
          updated_at: string
        }
        Insert: {
          attempt_number: number
          completed_at?: string | null
          created_at?: string
          failure_code?: string | null
          failure_message?: string | null
          id?: string
          payment_intent_id: string
          provider_id: string
          provider_reference?: string | null
          request_payload?: Json
          response_payload?: Json
          status?: string
          updated_at?: string
        }
        Update: {
          attempt_number?: number
          completed_at?: string | null
          created_at?: string
          failure_code?: string | null
          failure_message?: string | null
          id?: string
          payment_intent_id?: string
          provider_id?: string
          provider_reference?: string | null
          request_payload?: Json
          response_payload?: Json
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_attempts_payment_intent_id_fkey"
            columns: ["payment_intent_id"]
            isOneToOne: false
            referencedRelation: "payment_intents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_attempts_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "payment_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_authorized_recipients: {
        Row: {
          account_holder: string
          account_identifier: string
          active: boolean
          channel: string
          created_at: string
          currency: string
          display_name: string
          id: string
          instructions: string | null
          max_amount: number | null
          updated_at: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          account_holder: string
          account_identifier: string
          active?: boolean
          channel: string
          created_at?: string
          currency?: string
          display_name: string
          id?: string
          instructions?: string | null
          max_amount?: number | null
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          account_holder?: string
          account_identifier?: string
          active?: boolean
          channel?: string
          created_at?: string
          currency?: string
          display_name?: string
          id?: string
          instructions?: string | null
          max_amount?: number | null
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: []
      }
      payment_idempotency_keys: {
        Row: {
          created_at: string
          expires_at: string
          idempotency_key: string
          payment_intent_id: string | null
          request_hash: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          idempotency_key: string
          payment_intent_id?: string | null
          request_hash: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          idempotency_key?: string
          payment_intent_id?: string | null
          request_hash?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_idempotency_keys_payment_intent_id_fkey"
            columns: ["payment_intent_id"]
            isOneToOne: false
            referencedRelation: "payment_intents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_idempotency_keys_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_idempotency_keys_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_public"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_intent_rate_limits: {
        Row: {
          request_count: number
          updated_at: string
          user_id: string
          window_started_at: string
        }
        Insert: {
          request_count: number
          updated_at?: string
          user_id: string
          window_started_at: string
        }
        Update: {
          request_count?: number
          updated_at?: string
          user_id?: string
          window_started_at?: string
        }
        Relationships: []
      }
      payment_intents: {
        Row: {
          amount: number
          checkout_url: string | null
          completed_at: string | null
          created_at: string
          currency: string
          description: string | null
          expires_at: string | null
          failure_code: string | null
          failure_message: string | null
          id: string
          idempotency_key: string
          last_status_check_at: string | null
          order_id: string | null
          payer_phone: string | null
          pre_order_id: string | null
          provider_id: string
          provider_payload: Json
          provider_reference: string | null
          purpose: string
          qr_code_payload: string | null
          refunded_amount: number
          status: string
          succeeded_at: string | null
          updated_at: string
          user_id: string
          wallet_id: string | null
        }
        Insert: {
          amount: number
          checkout_url?: string | null
          completed_at?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          expires_at?: string | null
          failure_code?: string | null
          failure_message?: string | null
          id?: string
          idempotency_key: string
          last_status_check_at?: string | null
          order_id?: string | null
          payer_phone?: string | null
          pre_order_id?: string | null
          provider_id: string
          provider_payload?: Json
          provider_reference?: string | null
          purpose?: string
          qr_code_payload?: string | null
          refunded_amount?: number
          status?: string
          succeeded_at?: string | null
          updated_at?: string
          user_id: string
          wallet_id?: string | null
        }
        Update: {
          amount?: number
          checkout_url?: string | null
          completed_at?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          expires_at?: string | null
          failure_code?: string | null
          failure_message?: string | null
          id?: string
          idempotency_key?: string
          last_status_check_at?: string | null
          order_id?: string | null
          payer_phone?: string | null
          pre_order_id?: string | null
          provider_id?: string
          provider_payload?: Json
          provider_reference?: string | null
          purpose?: string
          qr_code_payload?: string | null
          refunded_amount?: number
          status?: string
          succeeded_at?: string | null
          updated_at?: string
          user_id?: string
          wallet_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_intents_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_intents_pre_order_id_fkey"
            columns: ["pre_order_id"]
            isOneToOne: false
            referencedRelation: "pre_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_intents_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "payment_providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_intents_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_providers: {
        Row: {
          created_at: string
          display_name: string
          enabled: boolean
          id: string
          test_mode: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name: string
          enabled?: boolean
          id: string
          test_mode?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string
          enabled?: boolean
          id?: string
          test_mode?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      payment_refunds: {
        Row: {
          amount: number
          completed_at: string | null
          created_at: string
          created_by: string | null
          currency: string
          failure_code: string | null
          failure_message: string | null
          id: string
          idempotency_key: string
          metadata: Json
          order_id: string | null
          payment_intent_id: string
          provider_id: string
          provider_reference: string | null
          reason: string | null
          status: string
        }
        Insert: {
          amount: number
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          failure_code?: string | null
          failure_message?: string | null
          id?: string
          idempotency_key?: string
          metadata?: Json
          order_id?: string | null
          payment_intent_id: string
          provider_id: string
          provider_reference?: string | null
          reason?: string | null
          status?: string
        }
        Update: {
          amount?: number
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          failure_code?: string | null
          failure_message?: string | null
          id?: string
          idempotency_key?: string
          metadata?: Json
          order_id?: string | null
          payment_intent_id?: string
          provider_id?: string
          provider_reference?: string | null
          reason?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_refunds_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_refunds_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_refunds_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_refunds_payment_intent_id_fkey"
            columns: ["payment_intent_id"]
            isOneToOne: false
            referencedRelation: "payment_intents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_refunds_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "payment_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_webhook_events: {
        Row: {
          body_sha256: string
          error_code: string | null
          event_type: string
          headers: Json
          id: string
          outcome: string
          payment_intent_id: string | null
          processed_at: string | null
          provider_event_id: string
          provider_id: string
          raw_body: string | null
          received_at: string
          received_ip: unknown
          signature_valid: boolean | null
        }
        Insert: {
          body_sha256: string
          error_code?: string | null
          event_type: string
          headers?: Json
          id?: string
          outcome?: string
          payment_intent_id?: string | null
          processed_at?: string | null
          provider_event_id: string
          provider_id: string
          raw_body?: string | null
          received_at?: string
          received_ip?: unknown
          signature_valid?: boolean | null
        }
        Update: {
          body_sha256?: string
          error_code?: string | null
          event_type?: string
          headers?: Json
          id?: string
          outcome?: string
          payment_intent_id?: string | null
          processed_at?: string | null
          provider_event_id?: string
          provider_id?: string
          raw_body?: string | null
          received_at?: string
          received_ip?: unknown
          signature_valid?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_webhook_events_payment_intent_id_fkey"
            columns: ["payment_intent_id"]
            isOneToOne: false
            referencedRelation: "payment_intents"
            referencedColumns: ["id"]
          },
        ]
      }
      pre_orders: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          deleted_by: string | null
          deleted_until: string | null
          deletion_reason: string | null
          destination_lat: number | null
          destination_lng: number | null
          id: string
          idempotency_key: string | null
          location: string
          payment_status: string
          product_id: string
          quantity: number
          reservation_expires_at: string | null
          status: string
          stock_fully_requested: boolean
          stock_reserved: boolean
          total_price: number
          unit_price: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          deleted_until?: string | null
          deletion_reason?: string | null
          destination_lat?: number | null
          destination_lng?: number | null
          id?: string
          idempotency_key?: string | null
          location: string
          payment_status?: string
          product_id: string
          quantity: number
          reservation_expires_at?: string | null
          status?: string
          stock_fully_requested?: boolean
          stock_reserved?: boolean
          total_price: number
          unit_price?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          deleted_until?: string | null
          deletion_reason?: string | null
          destination_lat?: number | null
          destination_lng?: number | null
          id?: string
          idempotency_key?: string | null
          location?: string
          payment_status?: string
          product_id?: string
          quantity?: number
          reservation_expires_at?: string | null
          status?: string
          stock_fully_requested?: boolean
          stock_reserved?: boolean
          total_price?: number
          unit_price?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_pre_orders_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_pre_orders_user"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_pre_orders_user"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pre_orders_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pre_orders_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "users_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pre_orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pre_orders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pre_orders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_public"
            referencedColumns: ["id"]
          },
        ]
      }
      product_comments: {
        Row: {
          comment_text: string
          created_at: string
          id: string
          product_id: string
          user_id: string
        }
        Insert: {
          comment_text: string
          created_at?: string
          id?: string
          product_id: string
          user_id: string
        }
        Update: {
          comment_text?: string
          created_at?: string
          id?: string
          product_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_product_comments_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_product_comments_user"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_product_comments_user"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_comments_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_likes: {
        Row: {
          created_at: string
          id: string
          product_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_product_likes_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_product_likes_user"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_product_likes_user"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_likes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_verifications: {
        Row: {
          ai_analysis: Json | null
          buyer_id: string
          created_at: string
          ficha_id: string
          id: string
          issues: string[] | null
          match_score: number
          producer_id: string
          product_id: string
          status: string
        }
        Insert: {
          ai_analysis?: Json | null
          buyer_id: string
          created_at?: string
          ficha_id: string
          id?: string
          issues?: string[] | null
          match_score?: number
          producer_id: string
          product_id: string
          status?: string
        }
        Update: {
          ai_analysis?: Json | null
          buyer_id?: string
          created_at?: string
          ficha_id?: string
          id?: string
          issues?: string[] | null
          match_score?: number
          producer_id?: string
          product_id?: string
          status?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          category: string | null
          contact: string
          created_at: string | null
          description: string | null
          farmer_name: string
          harvest_date: string
          id: string
          likes_count: number
          location_lat: number | null
          location_lng: number | null
          logistics_access: string
          municipality_id: string
          photos: string[] | null
          price: number
          product_type: string
          province_id: string
          quantity: number
          reserved_quantity: number
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          category?: string | null
          contact: string
          created_at?: string | null
          description?: string | null
          farmer_name: string
          harvest_date: string
          id?: string
          likes_count?: number
          location_lat?: number | null
          location_lng?: number | null
          logistics_access: string
          municipality_id: string
          photos?: string[] | null
          price: number
          product_type: string
          province_id: string
          quantity: number
          reserved_quantity?: number
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          category?: string | null
          contact?: string
          created_at?: string | null
          description?: string | null
          farmer_name?: string
          harvest_date?: string
          id?: string
          likes_count?: number
          location_lat?: number | null
          location_lng?: number | null
          logistics_access?: string
          municipality_id?: string
          photos?: string[] | null
          price?: number
          product_type?: string
          province_id?: string
          quantity?: number
          reserved_quantity?: number
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_products_user"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_products_user"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_public"
            referencedColumns: ["id"]
          },
        ]
      }
      public_user_profiles: {
        Row: {
          avatar_url: string | null
          full_name: string | null
          id: string
          user_type: Database["public"]["Enums"]["user_type_enum"] | null
          verified: boolean
        }
        Insert: {
          avatar_url?: string | null
          full_name?: string | null
          id: string
          user_type?: Database["public"]["Enums"]["user_type_enum"] | null
          verified?: boolean
        }
        Update: {
          avatar_url?: string | null
          full_name?: string | null
          id?: string
          user_type?: Database["public"]["Enums"]["user_type_enum"] | null
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "public_user_profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "public_user_profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "users_public"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth_key: string
          created_at: string | null
          endpoint: string
          id: string
          p256dh_key: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          auth_key: string
          created_at?: string | null
          endpoint: string
          id?: string
          p256dh_key: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          auth_key?: string
          created_at?: string | null
          endpoint?: string
          id?: string
          p256dh_key?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      sourcing_requests: {
        Row: {
          admin_notes: string | null
          created_at: string
          delivery_date: string
          description: string | null
          id: string
          product_name: string
          quantity: number
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          delivery_date: string
          description?: string | null
          id?: string
          product_name: string
          quantity: number
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          delivery_date?: string
          description?: string | null
          id?: string
          product_name?: string
          quantity?: number
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sourcing_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sourcing_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_public"
            referencedColumns: ["id"]
          },
        ]
      }
      support_messages: {
        Row: {
          created_at: string | null
          email: string
          id: string
          message: string
          name: string
          phone: string | null
          status: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          message: string
          name: string
          phone?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          message?: string
          name?: string
          phone?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_support_messages_user"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_support_messages_user"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_public"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          completed_at: string | null
          created_at: string
          description: string | null
          id: string
          metadata: Json | null
          operation_id: string | null
          payment_intent_id: string | null
          reference_id: string | null
          related_user_id: string | null
          status: Database["public"]["Enums"]["transaction_status"]
          type: Database["public"]["Enums"]["transaction_type"]
          wallet_id: string
        }
        Insert: {
          amount: number
          completed_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          operation_id?: string | null
          payment_intent_id?: string | null
          reference_id?: string | null
          related_user_id?: string | null
          status?: Database["public"]["Enums"]["transaction_status"]
          type: Database["public"]["Enums"]["transaction_type"]
          wallet_id: string
        }
        Update: {
          amount?: number
          completed_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          operation_id?: string | null
          payment_intent_id?: string | null
          reference_id?: string | null
          related_user_id?: string | null
          status?: Database["public"]["Enums"]["transaction_status"]
          type?: Database["public"]["Enums"]["transaction_type"]
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_transactions_related_user"
            columns: ["related_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_transactions_related_user"
            columns: ["related_user_id"]
            isOneToOne: false
            referencedRelation: "users_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_transactions_wallet"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_payment_intent_id_fkey"
            columns: ["payment_intent_id"]
            isOneToOne: false
            referencedRelation: "payment_intents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_user_roles_user"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_user_roles_user"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_public"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          agent_code: string | null
          auth_provider: string | null
          avatar_url: string | null
          created_at: string | null
          email: string | null
          email_provider: string | null
          email_verified: boolean | null
          full_name: string
          id: string
          identity_document: string | null
          is_root_admin: boolean | null
          is_super_root: boolean | null
          load_capacity_kg: number | null
          municipality_id: string | null
          phone: string | null
          phone_verified: boolean | null
          province_id: string | null
          referred_by_agent_id: string | null
          updated_at: string | null
          user_type: Database["public"]["Enums"]["user_type_enum"] | null
          verified: boolean
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          agent_code?: string | null
          auth_provider?: string | null
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          email_provider?: string | null
          email_verified?: boolean | null
          full_name: string
          id: string
          identity_document?: string | null
          is_root_admin?: boolean | null
          is_super_root?: boolean | null
          load_capacity_kg?: number | null
          municipality_id?: string | null
          phone?: string | null
          phone_verified?: boolean | null
          province_id?: string | null
          referred_by_agent_id?: string | null
          updated_at?: string | null
          user_type?: Database["public"]["Enums"]["user_type_enum"] | null
          verified?: boolean
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          agent_code?: string | null
          auth_provider?: string | null
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          email_provider?: string | null
          email_verified?: boolean | null
          full_name?: string
          id?: string
          identity_document?: string | null
          is_root_admin?: boolean | null
          is_super_root?: boolean | null
          load_capacity_kg?: number | null
          municipality_id?: string | null
          phone?: string | null
          phone_verified?: boolean | null
          province_id?: string | null
          referred_by_agent_id?: string | null
          updated_at?: string | null
          user_type?: Database["public"]["Enums"]["user_type_enum"] | null
          verified?: boolean
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_referred_by_agent_id_fkey"
            columns: ["referred_by_agent_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_referred_by_agent_id_fkey"
            columns: ["referred_by_agent_id"]
            isOneToOne: false
            referencedRelation: "users_public"
            referencedColumns: ["id"]
          },
        ]
      }
      wallets: {
        Row: {
          available_balance: number
          blocked_balance: number
          created_at: string
          id: string
          total_earned: number
          total_spent: number
          total_withdrawn: number
          updated_at: string
          user_id: string
        }
        Insert: {
          available_balance?: number
          blocked_balance?: number
          created_at?: string
          id?: string
          total_earned?: number
          total_spent?: number
          total_withdrawn?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          available_balance?: number
          blocked_balance?: number
          created_at?: string
          id?: string
          total_earned?: number
          total_spent?: number
          total_withdrawn?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_wallets_user"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_wallets_user"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users_public"
            referencedColumns: ["id"]
          },
        ]
      }
      work_sessions: {
        Row: {
          created_at: string
          duration_minutes: number | null
          ended_at: string | null
          id: string
          is_active: boolean
          started_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          duration_minutes?: number | null
          ended_at?: string | null
          id?: string
          is_active?: boolean
          started_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          duration_minutes?: number | null
          ended_at?: string | null
          id?: string
          is_active?: boolean
          started_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_public"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      users_public: {
        Row: {
          agent_code: string | null
          avatar_url: string | null
          created_at: string | null
          full_name: string | null
          id: string | null
          municipality_id: string | null
          province_id: string | null
          user_type: Database["public"]["Enums"]["user_type_enum"] | null
        }
        Insert: {
          agent_code?: string | null
          avatar_url?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string | null
          municipality_id?: string | null
          province_id?: string | null
          user_type?: Database["public"]["Enums"]["user_type_enum"] | null
        }
        Update: {
          agent_code?: string | null
          avatar_url?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string | null
          municipality_id?: string | null
          province_id?: string | null
          user_type?: Database["public"]["Enums"]["user_type_enum"] | null
        }
        Relationships: []
      }
    }
    Functions: {
      accept_freight_load: {
        Args: { p_freight_load_id: string }
        Returns: {
          accepted_at: string
          driver_id: string
          id: string
          status: string
        }[]
      }
      accept_p2p_match: { Args: { p_match_id: string }; Returns: string }
      admin_add_p2p_beneficiary_account: {
        Args: {
          p_account_holder: string
          p_account_identifier: string
          p_beneficiary_id: string
          p_channel: string
          p_instructions?: string
          p_max_amount?: number
        }
        Returns: string
      }
      admin_approve_product: {
        Args: { p_product_id: string }
        Returns: boolean
      }
      admin_bulk_delete_fichas_recebimento: {
        Args: { p_ficha_ids: string[] }
        Returns: number
      }
      admin_bulk_delete_products: {
        Args: { p_product_ids: string[] }
        Returns: number
      }
      admin_bulk_delete_users: {
        Args: { p_user_ids: string[] }
        Returns: number
      }
      admin_complete_p2p_order: {
        Args: { p_note?: string; p_p2p_order_id: string }
        Returns: string
      }
      admin_delete_ficha_recebimento: {
        Args: { p_ficha_id: string }
        Returns: boolean
      }
      admin_delete_product: { Args: { p_product_id: string }; Returns: boolean }
      admin_delete_user: { Args: { p_user_id: string }; Returns: boolean }
      admin_reject_product: {
        Args: { p_product_id: string; p_reason?: string }
        Returns: boolean
      }
      admin_remove_pre_order: {
        Args: { p_order_id: string; p_reason?: string }
        Returns: {
          deleted_at: string
          deleted_until: string
          id: string
        }[]
      }
      admin_restore_pre_order: {
        Args: { p_order_id: string }
        Returns: {
          deleted_at: string
          deleted_until: string
          id: string
          status: string
        }[]
      }
      admin_review_p2p_beneficiary_application: {
        Args: {
          p_application_id: string
          p_daily?: number
          p_decision: string
          p_monthly?: number
          p_per_transaction?: number
          p_reason?: string
          p_simultaneous?: number
        }
        Returns: string
      }
      admin_send_notification: {
        Args: {
          p_message: string
          p_metadata?: Json
          p_title: string
          p_type: string
          p_user_id: string
        }
        Returns: string
      }
      admin_set_user_type: {
        Args: {
          p_user_id: string
          p_user_type: Database["public"]["Enums"]["user_type_enum"]
        }
        Returns: {
          agent_code: string
          full_name: string
          id: string
          updated_at: string
          user_type: Database["public"]["Enums"]["user_type_enum"]
        }[]
      }
      admin_update_pre_order_status: {
        Args: { p_order_id: string; p_status: string }
        Returns: {
          id: string
          status: string
          updated_at: string
        }[]
      }
      advance_freight_load_status: {
        Args: { p_freight_load_id: string; p_status: string }
        Returns: {
          delivered_at: string
          driver_id: string
          id: string
          in_transit_at: string
          status: string
        }[]
      }
      apply_wallet_payment_webhook: {
        Args: {
          p_amount: number
          p_body_sha256: string
          p_currency: string
          p_event_type: string
          p_provider_event_id: string
          p_provider_id: string
          p_provider_reference: string
          p_provider_status: string
        }
        Returns: string
      }
      block_funds: {
        Args: {
          p_amount: number
          p_description?: string
          p_reference_id: string
          p_user_id: string
        }
        Returns: string
      }
      cancel_pre_order: {
        Args: { p_order_id: string }
        Returns: {
          id: string
          status: string
          updated_at: string
        }[]
      }
      claim_email_outbox: {
        Args: { p_limit?: number }
        Returns: {
          attempts: number
          available_at: string
          created_at: string
          dedupe_key: string
          id: string
          last_error: string | null
          locked_at: string | null
          payload: Json
          priority: number
          provider_id: string | null
          recipient: string
          scheduled_at: string
          sent_at: string | null
          status: string
          subject: string
          template: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "email_outbox"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      claim_map_geocoding_request: {
        Args: { p_query_key: string }
        Returns: {
          cached_results: Json
          request_allowed: boolean
        }[]
      }
      claim_notification_push_queue: {
        Args: { p_limit?: number }
        Returns: {
          attempts: number
          created_at: string
          dispatch_token: string
          dispatched_at: string | null
          id: string
          last_error: string | null
          locked_at: string | null
          next_attempt_at: string
          notification_id: string
          status: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "notification_push_queue"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      classify_email_provider: { Args: { p_email: string }; Returns: string }
      cleanup_unverified_users: { Args: never; Returns: undefined }
      complete_email_outbox: {
        Args: { p_id: string; p_provider_id: string }
        Returns: undefined
      }
      complete_notification_push_queue: {
        Args: { p_id: string }
        Returns: undefined
      }
      complete_user_profile: {
        Args: {
          p_full_name: string
          p_identity_document: string
          p_load_capacity_kg?: number
          p_municipality_id: string
          p_phone: string
          p_province_id: string
          p_user_type: Database["public"]["Enums"]["user_type_enum"]
        }
        Returns: boolean
      }
      confirm_p2p_payment_received: {
        Args: { p_note?: string; p_p2p_order_id: string }
        Returns: string
      }
      consume_api_rate_limit: {
        Args: {
          p_bucket_key: string
          p_max_requests: number
          p_window_seconds: number
        }
        Returns: boolean
      }
      consume_payment_intent_rate_limit: {
        Args: {
          p_max_requests: number
          p_user_id: string
          p_window_seconds: number
        }
        Returns: boolean
      }
      create_admin_notifications: {
        Args: {
          p_message: string
          p_metadata?: Json
          p_title: string
          p_type: string
        }
        Returns: undefined
      }
      create_authorized_recipient_payment_intent: {
        Args: {
          p_idempotency_key: string
          p_pre_order_id: string
          p_recipient_id: string
        }
        Returns: {
          account_identifier: string
          amount: number
          currency: string
          intent_id: string
          pre_order_id: string
          recipient_id: string
          recipient_name: string
          status: string
        }[]
      }
      create_green_point_order: {
        Args: {
          p_pickup_date: string
          p_point_id: string
          p_product_id: string
          p_quantity: number
        }
        Returns: {
          buyer_id: string
          created_at: string
          id: string
          payment_method: string
          pickup_date: string
          point_id: string
          status: string
          total_amount: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "green_point_orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_marketplace_pre_order: {
        Args: {
          p_delivery_lat?: number
          p_delivery_lng?: number
          p_idempotency_key?: string
          p_location: string
          p_product_id: string
          p_quantity: number
        }
        Returns: {
          id: string
          product_id: string
          quantity: number
          reservation_expires_at: string
          status: string
          total_price: number
          unit_price: number
        }[]
      }
      create_notification: {
        Args: {
          p_message: string
          p_metadata?: Json
          p_title: string
          p_type: string
          p_user_id: string
        }
        Returns: string
      }
      create_p2p_order: {
        Args: { p_payment_channel: string; p_pre_order_id: string }
        Returns: string
      }
      dispatch_notification_push_queue: {
        Args: { p_limit?: number }
        Returns: number
      }
      expire_marketplace_reservations: { Args: never; Returns: number }
      expire_p2p_orders: { Args: never; Returns: number }
      fail_email_outbox: {
        Args: { p_error: string; p_id: string; p_retry?: boolean }
        Returns: undefined
      }
      fail_notification_push_queue: {
        Args: { p_error: string; p_id: string; p_retry?: boolean }
        Returns: undefined
      }
      firewall_consume: {
        Args: {
          p_bucket_key: string
          p_max_requests: number
          p_window_seconds: number
        }
        Returns: boolean
      }
      firewall_is_blocked: {
        Args: { p_identifier: string; p_identifier_type: string }
        Returns: boolean
      }
      firewall_record_event: {
        Args: {
          p_action: string
          p_identifier: string
          p_identifier_type: string
          p_metadata: Json
          p_method: string
          p_reason: string
          p_risk_score: number
          p_route: string
          p_status_code: number
          p_user_agent: string
          p_user_id: string
        }
        Returns: undefined
      }
      generate_agent_code: { Args: never; Returns: string }
      generate_email_otp: {
        Args: { p_email: string; p_user_id: string }
        Returns: string
      }
      get_admin_operational_metrics: {
        Args: never
        Returns: {
          created_last_30_days: number
          metric_group: string
          status: string
          total_count: number
        }[]
      }
      get_admin_user_metrics: {
        Args: never
        Returns: {
          registered_last_30_days: number
          user_count: number
          user_type: string
          verified_count: number
        }[]
      }
      get_agent_id_by_code: { Args: { p_code: string }; Returns: string }
      get_agent_referral_stats: {
        Args: { agent_user_id: string }
        Returns: {
          recent_referrals: Json
          total_points: number
          total_referrals: number
        }[]
      }
      get_freight_load_qr_details: {
        Args: { p_qr_token: string }
        Returns: {
          buyer_name: string
          buyer_phone: string
          currency: string
          destination_label: string
          display_id: string
          driver_name: string
          driver_phone: string
          id: string
          notes: string
          offered_price: number
          order_display_id: string
          order_status: string
          origin_label: string
          payment_status: string
          pickup_date: string
          pre_order_id: string
          product_name: string
          qr_token: string
          route_distance_km: number
          route_duration_minutes: number
          status: string
          weight_kg: number
        }[]
      }
      get_freight_pricing_settings: {
        Args: never
        Returns: {
          base_fare_kz: number
          category_multipliers: Json
          rate_per_100kg_kz: number
          rate_per_km_kz: number
          rate_per_km_per_100kg: number
          updated_at: string
        }[]
      }
      get_marketplace_checkout_summary: {
        Args: { p_pre_order_id: string }
        Returns: {
          currency: string
          freight_total: number
          payment_ready: boolean
          pre_order_id: string
          product_total: number
          reason: string
          total: number
        }[]
      }
      get_marketplace_payment_recipients: {
        Args: { p_pre_order_id: string }
        Returns: {
          account_holder: string
          account_identifier: string
          channel: string
          currency: string
          display_name: string
          id: string
          instructions: string
        }[]
      }
      get_marketplace_transaction_history: {
        Args: { p_pre_order_id: string }
        Returns: {
          actor_id: string
          actor_role: string
          created_at: string
          event_id: string
          event_type: string
          from_status: string
          metadata: Json
          to_status: string
        }[]
      }
      get_marketplace_transaction_receipt: {
        Args: { p_pre_order_id: string }
        Returns: Json
      }
      get_marketplace_transaction_receipt_internal: {
        Args: { p_pre_order_id: string }
        Returns: Json
      }
      get_my_p2p_operations: {
        Args: never
        Returns: {
          actor_role: string
          amount: number
          beneficiary_account_id: string
          beneficiary_id: string
          buyer_id: string
          created_at: string
          currency: string
          expires_at: string
          id: string
          payment_channel: string
          pre_order_id: string
          status: string
          transfer_reference: string
        }[]
      }
      get_or_create_conversation: {
        Args: { p_other_user_id: string; p_user_id: string }
        Returns: string
      }
      get_order_buyer_contact: {
        Args: { p_pre_order_id: string }
        Returns: {
          email: string
          full_name: string
          phone: string
        }[]
      }
      get_p2p_transaction_history: {
        Args: { p_p2p_order_id: string }
        Returns: {
          actor_id: string
          actor_role: string
          created_at: string
          event_id: string
          event_type: string
          from_status: string
          metadata: Json
          to_status: string
        }[]
      }
      get_p2p_transaction_receipt: {
        Args: { p_p2p_order_id: string }
        Returns: Json
      }
      get_product_contact: {
        Args: { p_product_id: string }
        Returns: {
          contact: string
          farmer_name: string
        }[]
      }
      get_public_user_profile: {
        Args: { p_user_id: string }
        Returns: {
          avatar_url: string
          created_at: string
          full_name: string
          id: string
          municipality_id: string
          province_id: string
          user_type: Database["public"]["Enums"]["user_type_enum"]
        }[]
      }
      get_top_agents_by_referrals: {
        Args: { limit_count?: number }
        Returns: {
          agent_avatar: string
          agent_id: string
          agent_name: string
          total_points: number
          total_referrals: number
        }[]
      }
      get_work_session_stats: {
        Args: { p_end_date?: string; p_start_date?: string; p_user_id: string }
        Returns: {
          avg_session_minutes: number
          total_minutes: number
          total_sessions: number
        }[]
      }
      has_admin_permission: {
        Args: {
          _permission: Database["public"]["Enums"]["admin_permission"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_agrilink_admin: { Args: never; Returns: boolean }
      is_root_admin: { Args: { _user_id: string }; Returns: boolean }
      is_super_root: { Args: { _user_id: string }; Returns: boolean }
      is_support_agent: { Args: { _user_id: string }; Returns: boolean }
      is_valid_email_outbox_worker_secret: {
        Args: { p_candidate: string }
        Returns: boolean
      }
      open_p2p_dispute: {
        Args: { p_p2p_order_id: string; p_reason: string }
        Returns: string
      }
      p2p_actor_can_view_order: {
        Args: { p_order_id: string; p_user_id: string }
        Returns: boolean
      }
      payment_status_transition_allowed: {
        Args: { new_status: string; old_status: string }
        Returns: boolean
      }
      process_deposit: {
        Args: { p_amount: number; p_description?: string; p_user_id: string }
        Returns: string
      }
      process_internal_transfer:
        | {
            Args: {
              p_amount: number
              p_description?: string
              p_from_user_id: string
              p_to_user_id: string
            }
            Returns: string
          }
        | {
            Args: {
              p_amount: number
              p_description: string
              p_from_user_id: string
              p_operation_id: string
              p_to_user_id: string
            }
            Returns: string
          }
      purge_expired_pre_order_trash: { Args: never; Returns: number }
      rate_agrilink_ad: {
        Args: { p_ad_id: string; p_rating: number }
        Returns: {
          rating_average: number
          rating_count: number
        }[]
      }
      record_freight_load_location: {
        Args: {
          p_accuracy_m: number
          p_freight_load_id: string
          p_heading_deg: number
          p_latitude: number
          p_longitude: number
          p_record_history: boolean
          p_speed_mps: number
        }
        Returns: string
      }
      record_order_transaction_event: {
        Args: {
          p_actor_id?: string
          p_event_type: string
          p_freight_load_id?: string
          p_from_status?: string
          p_metadata?: Json
          p_order_id?: string
          p_pre_order_id?: string
          p_to_status?: string
        }
        Returns: string
      }
      register_push_subscription: {
        Args: { p_auth_key: string; p_endpoint: string; p_p256dh_key: string }
        Returns: boolean
      }
      release_blocked_funds: {
        Args: {
          p_commission_percentage?: number
          p_seller_user_id: string
          p_transaction_id: string
        }
        Returns: boolean
      }
      release_marketplace_reservation: {
        Args: { p_expired?: boolean; p_order_id: string }
        Returns: undefined
      }
      request_email_confirmation: {
        Args: { user_email: string }
        Returns: Json
      }
      resolve_p2p_dispute: {
        Args: {
          p_dispute_id: string
          p_refund_reference?: string
          p_resolution: string
          p_resolution_note?: string
        }
        Returns: string
      }
      respond_to_freight_quote: {
        Args: { p_approved: boolean; p_freight_load_id: string }
        Returns: {
          driver_offered_price: number
          driver_quote_status: string
          id: string
          status: string
        }[]
      }
      respond_to_pre_order: {
        Args: { p_order_id: string; p_status: string }
        Returns: {
          id: string
          status: string
          updated_at: string
        }[]
      }
      send_message:
        | {
            Args: {
              p_content: string
              p_files?: Json
              p_receiver: string
              p_sender: string
            }
            Returns: string
          }
        | {
            Args: {
              p_content: string
              p_conversation: string
              p_receiver: string
              p_sender: string
            }
            Returns: undefined
          }
      set_freight_pricing_model: {
        Args: {
          p_base_fare_kz: number
          p_category_multipliers: Json
          p_rate_per_100kg_kz: number
          p_rate_per_km_kz: number
        }
        Returns: {
          base_fare_kz: number
          category_multipliers: Json
          rate_per_100kg_kz: number
          rate_per_km_kz: number
          updated_at: string
        }[]
      }
      set_freight_pricing_rate: {
        Args: { p_rate: number }
        Returns: {
          rate_per_km_per_100kg: number
          updated_at: string
        }[]
      }
      set_my_identity_document: {
        Args: { p_identity_document: string }
        Returns: {
          agent_code: string | null
          auth_provider: string | null
          avatar_url: string | null
          created_at: string | null
          email: string | null
          email_provider: string | null
          email_verified: boolean | null
          full_name: string
          id: string
          identity_document: string | null
          is_root_admin: boolean | null
          is_super_root: boolean | null
          load_capacity_kg: number | null
          municipality_id: string | null
          phone: string | null
          phone_verified: boolean | null
          province_id: string | null
          referred_by_agent_id: string | null
          updated_at: string | null
          user_type: Database["public"]["Enums"]["user_type_enum"] | null
          verified: boolean
          verified_at: string | null
          verified_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "users"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_p2p_beneficiary_availability: {
        Args: { p_status: string }
        Returns: boolean
      }
      submit_authorized_recipient_payment_proof: {
        Args: {
          p_intent_id: string
          p_note?: string
          p_transfer_reference: string
        }
        Returns: boolean
      }
      submit_freight_quote: {
        Args: {
          p_freight_load_id: string
          p_manual_price: number
          p_price_method: string
          p_route_distance_km: number
          p_route_duration_minutes: number
        }
        Returns: {
          driver_id: string
          driver_offered_price: number
          driver_price_method: string
          driver_quote_status: string
          id: string
          route_distance_km: number
          route_duration_minutes: number
          status: string
        }[]
      }
      submit_p2p_beneficiary_application: {
        Args: {
          p_legal_name: string
          p_notes?: string
          p_phone: string
          p_requested_channels: string[]
        }
        Returns: string
      }
      submit_p2p_payment_proof: {
        Args: {
          p_note?: string
          p_p2p_order_id: string
          p_transfer_reference: string
        }
        Returns: string
      }
      submit_public_contact: {
        Args: {
          p_email: string
          p_message: string
          p_name: string
          p_phone: string
        }
        Returns: string
      }
      sync_user_email_verified: {
        Args: { p_user_id: string }
        Returns: boolean
      }
      update_green_point_order_status: {
        Args: { p_order_id: string; p_status: string }
        Returns: {
          buyer_id: string
          created_at: string
          id: string
          payment_method: string
          pickup_date: string
          point_id: string
          status: string
          total_amount: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "green_point_orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      validate_agent_code: { Args: { p_code: string }; Returns: boolean }
      verify_authorized_recipient_payment: {
        Args: { p_intent_id: string }
        Returns: boolean
      }
      verify_email_otp: {
        Args: { p_code: string; p_email: string }
        Returns: boolean
      }
    }
    Enums: {
      admin_permission:
        | "manage_users"
        | "manage_products"
        | "manage_orders"
        | "manage_support"
        | "manage_sourcing"
        | "view_analytics"
        | "manage_admins"
      app_role: "admin" | "moderator" | "user" | "support_agent"
      transaction_status:
        | "pending"
        | "blocked"
        | "completed"
        | "cancelled"
        | "disputed"
      transaction_type:
        | "purchase_payment"
        | "freight_payment"
        | "sale_receipt"
        | "internal_transfer"
        | "bank_withdrawal"
        | "deposit"
        | "commission"
        | "refund"
      user_type_enum: "agente" | "agricultor" | "comprador" | "motorista"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      admin_permission: [
        "manage_users",
        "manage_products",
        "manage_orders",
        "manage_support",
        "manage_sourcing",
        "view_analytics",
        "manage_admins",
      ],
      app_role: ["admin", "moderator", "user", "support_agent"],
      transaction_status: [
        "pending",
        "blocked",
        "completed",
        "cancelled",
        "disputed",
      ],
      transaction_type: [
        "purchase_payment",
        "freight_payment",
        "sale_receipt",
        "internal_transfer",
        "bank_withdrawal",
        "deposit",
        "commission",
        "refund",
      ],
      user_type_enum: ["agente", "agricultor", "comprador", "motorista"],
    },
  },
} as const
