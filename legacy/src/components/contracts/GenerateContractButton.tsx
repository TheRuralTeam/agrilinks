import React, { useState } from 'react'
import { FileSignature } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { useGuestGate } from '@/contexts/GuestGateContext'
import { T, FONT } from '@/lib/brand'

interface Props {
  sourceType: 'ficha' | 'product'
  sourceId: string
  productName: string
  quantity?: number | null
  unit?: string | null
  price?: number | null
  buyerId?: string | null
  supplierId?: string | null
  deliveryTerms?: string | null
  compact?: boolean
}

/**
 * Pede a geração de um contrato digital. O pedido fica pendente
 * até um administrador AgriLink o aprovar.
 */
const GenerateContractButton = ({
  sourceType, sourceId, productName, quantity, unit, price,
  buyerId, supplierId, deliveryTerms, compact,
}: Props) => {
  const { user } = useAuth()
  const { requireAuth } = useGuestGate()
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handleClick = async () => {
    if (!requireAuth('Precisas de uma conta para gerar um contrato digital com a outra parte.')) return
    if (!user) return
    setLoading(true)
    try {
      const { error } = await (supabase.from('digital_contracts' as any) as any).insert({
        source_type: sourceType,
        source_id: sourceId,
        requested_by: user.id,
        buyer_id: buyerId ?? (sourceType === 'ficha' ? user.id : null),
        supplier_id: supplierId ?? (sourceType === 'product' ? user.id : null),
        product_name: productName,
        quantity: quantity ?? null,
        unit: unit || 'kg',
        price: price ?? null,
        delivery_terms: deliveryTerms || null,
        status: 'pending_admin',
      })
      if (error) throw error

      await supabase.rpc('create_admin_notifications', {
        p_type: 'contract',
        p_title: 'Pedido de contrato digital',
        p_message: `Novo pedido de contrato digital para "${productName}". Requer aprovação.`,
        p_metadata: { source_type: sourceType, source_id: sourceId, requested_by: user.id },
      })

      setSent(true)
      toast.success('Pedido enviado', {
        description: 'Um administrador AgriLink vai validar e disponibilizar o contrato no teu perfil.',
      })
    } catch (e: any) {
      console.error(e)
      toast.error('Não foi possível pedir o contrato', { description: e?.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading || sent}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        padding: compact ? '7px 12px' : '10px 16px',
        borderRadius: 12, border: `1px solid ${T.gBorder}`,
        background: sent ? T.g50 : T.white, color: T.green,
        fontFamily: FONT, fontSize: compact ? 12 : 13.5, fontWeight: 700,
        cursor: loading || sent ? 'default' : 'pointer', opacity: loading ? 0.6 : 1,
      }}
    >
      <FileSignature size={compact ? 14 : 16} />
      {sent ? 'Contrato pendente de aprovação' : loading ? 'A enviar…' : 'Gerar contrato digital'}
    </button>
  )
}

export default GenerateContractButton
