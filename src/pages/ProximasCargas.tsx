import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, PackageCheck, MapPin, CalendarDays, Weight, Loader2 } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { useCanAct } from '@/hooks/useCanAct'
import { T, FONT } from '@/lib/brand'
import { toast } from 'sonner'

interface FreightLoad {
  id: string
  product_name: string
  weight_kg: number
  origin_label: string
  destination_label: string
  pickup_date: string | null
  offered_price: number | null
  currency: string
  status: string
  driver_id: string | null
  notes: string | null
}

const STATUS_LABEL: Record<string, string> = {
  open: 'Disponível',
  accepted: 'Aceite',
  in_transit: 'Em trânsito',
  delivered: 'Entregue',
  cancelled: 'Cancelada',
}

const money = (v: number | null, c: string) =>
  v == null ? '—' : `${new Intl.NumberFormat('pt-AO').format(v)} ${c || 'Kz'}`

const ProximasCargas = () => {
  const navigate = useNavigate()
  const { user, userProfile } = useAuth()
  const { requireAct } = useCanAct()
  const [loads, setLoads] = useState<FreightLoad[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [tab, setTab] = useState<'disponiveis' | 'minhas'>('disponiveis')

  const capacity = (userProfile as any)?.load_capacity_kg as number | null | undefined

  const fetchLoads = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('freight_loads')
        .select('*')
        .order('pickup_date', { ascending: true, nullsFirst: false })
        .limit(80)
      if (error) throw error
      setLoads((data || []) as unknown as FreightLoad[])
    } catch (e: any) {
      toast.error('Não foi possível carregar as cargas.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchLoads() }, [user?.id])

  const accept = async (load: FreightLoad) => {
    if (!requireAct('aceitar uma carga')) return
    if (capacity && load.weight_kg > capacity) {
      toast.error(`Carga acima da sua capacidade (${capacity} kg).`)
      return
    }
    setBusyId(load.id)
    const { error } = await supabase
      .from('freight_loads')
      .update({ driver_id: user!.id, status: 'accepted', accepted_at: new Date().toISOString() })
      .eq('id', load.id)
      .is('driver_id', null)
    setBusyId(null)
    if (error) { toast.error('Não foi possível aceitar esta carga.'); return }
    toast.success('Carga aceite. Boa viagem!')
    fetchLoads()
  }

  const advance = async (load: FreightLoad) => {
    if (!requireAct('actualizar a carga')) return
    const next = load.status === 'accepted'
      ? { status: 'in_transit', in_transit_at: new Date().toISOString() }
      : { status: 'delivered', delivered_at: new Date().toISOString() }
    setBusyId(load.id)
    const { error } = await supabase.from('freight_loads').update(next).eq('id', load.id)
    setBusyId(null)
    if (error) { toast.error('Não foi possível actualizar.'); return }
    fetchLoads()
  }

  const visible = loads.filter(l =>
    tab === 'minhas' ? l.driver_id === user?.id : l.status === 'open' && !l.driver_id
  )

  return (
    <div style={{ minHeight: '100vh', background: T.canvas, fontFamily: FONT, paddingBottom: 120 }}>
      <header style={{
        background: T.white, borderBottom: `1px solid ${T.rule}`,
        padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12,
        position: 'sticky', top: 0, zIndex: 20,
      }}>
        <button
          aria-label="Voltar"
          onClick={() => navigate(-1)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.mid, display: 'flex', padding: 4 }}
        >
          <ArrowLeft size={20} />
        </button>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: T.ink, letterSpacing: '-0.02em' }}>
            Próximas Cargas
          </h1>
          <p style={{ margin: 0, fontSize: 12, color: T.muted, fontWeight: 600 }}>
            {capacity ? `Capacidade: ${new Intl.NumberFormat('pt-AO').format(capacity)} kg` : 'Fretes disponíveis na AgriLink'}
          </p>
        </div>
      </header>

      <div style={{ display: 'flex', gap: 8, padding: '14px 16px' }}>
        {(['disponiveis', 'minhas'] as const).map(k => (
          <button
            key={k}
            onClick={() => setTab(k)}
            style={{
              padding: '9px 16px', borderRadius: 999, cursor: 'pointer', fontFamily: FONT,
              fontSize: 13, fontWeight: 800,
              border: `1.5px solid ${tab === k ? T.green : T.rule}`,
              background: tab === k ? T.green : T.white,
              color: tab === k ? T.white : T.mid,
            }}
          >
            {k === 'disponiveis' ? 'Disponíveis' : 'As minhas cargas'}
          </button>
        ))}
      </div>

      <main style={{ padding: '0 16px', display: 'grid', gap: 12 }}>
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 48, color: T.muted }}>
            <Loader2 className="animate-spin" size={24} />
          </div>
        )}

        {!loading && visible.length === 0 && (
          <div style={{
            background: T.white, border: `1px solid ${T.rule}`, borderRadius: 18,
            padding: 32, textAlign: 'center',
          }}>
            <PackageCheck size={28} color={T.faint} />
            <p style={{ marginTop: 12, fontSize: 14, fontWeight: 700, color: T.mid }}>
              {tab === 'minhas' ? 'Ainda não aceitou nenhuma carga.' : 'Sem cargas disponíveis de momento.'}
            </p>
          </div>
        )}

        {!loading && visible.map(load => {
          const tooHeavy = !!capacity && load.weight_kg > capacity
          return (
            <article key={load.id} style={{
              background: T.white, border: `1px solid ${T.rule}`, borderRadius: 18,
              padding: 16, boxShadow: `0 6px 20px ${T.shadow}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{
                  width: 42, height: 42, borderRadius: 13, background: T.g50, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <PackageCheck size={19} color={T.green} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h2 style={{ margin: 0, fontSize: 15.5, fontWeight: 800, color: T.ink, letterSpacing: '-0.01em' }}>
                    {load.product_name}
                  </h2>
                  <span style={{
                    display: 'inline-block', marginTop: 4, padding: '3px 9px', borderRadius: 999,
                    background: T.g50, color: T.green, fontSize: 11, fontWeight: 800,
                  }}>
                    {STATUS_LABEL[load.status] || load.status}
                  </span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: T.green }}>
                    {money(load.offered_price, load.currency)}
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 14, display: 'grid', gap: 8, fontSize: 13, color: T.mid, fontWeight: 600 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <MapPin size={15} color={T.faint} />
                  <span>{load.origin_label} → {load.destination_label}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Weight size={15} color={T.faint} />
                  <span style={{ color: tooHeavy ? T.gold : T.mid }}>
                    {new Intl.NumberFormat('pt-AO').format(load.weight_kg)} kg
                    {tooHeavy ? ' · acima da sua capacidade' : ''}
                  </span>
                </div>
                {load.pickup_date && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <CalendarDays size={15} color={T.faint} />
                    <span>Recolha: {new Date(load.pickup_date).toLocaleDateString('pt-AO')}</span>
                  </div>
                )}
              </div>

              {load.notes && (
                <p style={{ marginTop: 10, fontSize: 12.5, color: T.muted, lineHeight: 1.5 }}>{load.notes}</p>
              )}

              {tab === 'disponiveis' ? (
                <button
                  disabled={busyId === load.id || tooHeavy}
                  onClick={() => accept(load)}
                  style={{
                    marginTop: 14, width: '100%', padding: '12px 16px', borderRadius: 14, border: 'none',
                    background: tooHeavy ? T.rule : T.green, color: tooHeavy ? T.muted : T.white,
                    fontFamily: FONT, fontSize: 14, fontWeight: 800,
                    cursor: tooHeavy ? 'not-allowed' : 'pointer',
                  }}
                >
                  {busyId === load.id ? 'A aceitar…' : tooHeavy ? 'Capacidade insuficiente' : 'Aceitar carga'}
                </button>
              ) : load.status === 'accepted' || load.status === 'in_transit' ? (
                <button
                  disabled={busyId === load.id}
                  onClick={() => advance(load)}
                  style={{
                    marginTop: 14, width: '100%', padding: '12px 16px', borderRadius: 14,
                    border: `1.5px solid ${T.green}`, background: T.white, color: T.green,
                    fontFamily: FONT, fontSize: 14, fontWeight: 800, cursor: 'pointer',
                  }}
                >
                  {load.status === 'accepted' ? 'Iniciar transporte' : 'Marcar como entregue'}
                </button>
              ) : null}
            </article>
          )
        })}
      </main>
    </div>
  )
}

export default ProximasCargas
