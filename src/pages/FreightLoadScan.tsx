import { useEffect, useState } from 'react';
import { AlertTriangle, ArrowLeft, CheckCircle2, Clock3, MapPin, PackageCheck, Phone, Route, Truck } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../integrations/supabase/client';
import { useAuth } from '../contexts/AuthContext';
import Loader from '../components/ui/Loader';
import { maskUuid } from '../lib/freightPdf';
import { T, FONT } from '../lib/brand';

type ScanDetails = {
  id: string;
  display_id: string;
  product_name: string;
  weight_kg: number;
  origin_label: string;
  destination_label: string;
  pickup_date: string | null;
  offered_price: number | null;
  currency: string;
  status: string;
  notes: string | null;
  route_distance_km: number | null;
  route_duration_minutes: number | null;
  order_display_id: string | null;
  order_status: string | null;
  payment_status: string | null;
  buyer_name: string | null;
  buyer_phone: string | null;
  driver_name: string | null;
  driver_phone: string | null;
};

const statusLabel: Record<string, string> = {
  available: 'Disponível',
  open: 'Disponível',
  agendado: 'Agendada',
  accepted: 'Aceite',
  in_transit: 'Em trânsito',
  delivered: 'Entregue',
  cancelled: 'Cancelada',
};

const ScanRow = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 0', borderBottom: `1px solid ${T.rule}` }}>
    <div style={{ color: T.green, marginTop: 1 }}>{icon}</div>
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 10, color: T.muted, fontFamily: FONT, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
      <div style={{ marginTop: 2, fontSize: 14, color: T.ink, fontFamily: FONT, fontWeight: 700, wordBreak: 'break-word' }}>{value}</div>
    </div>
  </div>
);

const FreightLoadScan = () => {
  const navigate = useNavigate();
  const { token } = useParams<{ token: string }>();
  const { user, loading: authLoading } = useAuth();
  const [data, setData] = useState<ScanDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setMessage('Inicie sessão na AgriLink para validar o acesso ao documento.');
      setLoading(false);
      return;
    }
    if (!token) {
      setMessage('QR inválido ou incompleto.');
      setLoading(false);
      return;
    }

    const load = async () => {
      setLoading(true);
      setMessage(null);
      const { data: result, error } = await supabase.rpc(
        'get_freight_load_qr_details' as never,
        { p_qr_token: decodeURIComponent(token) } as never,
      );

      if (error) {
        console.error(error);
        setMessage(error.code === '42501' ? 'Esta carga não está associada ao seu perfil.' : 'Não foi possível validar este QR.');
        setLoading(false);
        return;
      }

      setData((Array.isArray(result) ? result[0] : result) as ScanDetails | null);
      setLoading(false);
    };

    void load();
  }, [authLoading, token, user]);

  if (authLoading || loading) {
    return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: T.bg }}><Loader /></div>;
  }

  if (message || !data) {
    return (
      <div style={{ minHeight: '100vh', background: T.bg, padding: 18, fontFamily: FONT }}>
        <div style={{ maxWidth: 560, margin: '60px auto', background: T.white, border: `1px solid ${T.rule}`, borderRadius: 20, padding: 28, textAlign: 'center' }}>
          <AlertTriangle size={34} color={T.gold} />
          <h1 style={{ color: T.ink, fontSize: 20, margin: '14px 0 8px' }}>Acesso não autorizado</h1>
          <p style={{ color: T.mid, lineHeight: 1.6, fontSize: 13 }}>{message || 'Carga não encontrada.'}</p>
          <button onClick={() => navigate(-1)} style={{ marginTop: 14, minHeight: 42, padding: '0 16px', border: 'none', borderRadius: 10, background: T.green, color: T.white, fontFamily: FONT, fontWeight: 800 }}>
            Voltar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: T.bg, padding: 16, fontFamily: FONT }}>
      <div style={{ maxWidth: 680, margin: '0 auto' }}>
        <button onClick={() => navigate(-1)} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, border: 'none', background: 'transparent', color: T.mid, fontFamily: FONT, fontWeight: 700, cursor: 'pointer', marginBottom: 12 }}>
          <ArrowLeft size={16} /> Voltar
        </button>

        <article style={{ background: T.white, border: `1px solid ${T.rule}`, borderRadius: 22, overflow: 'hidden', boxShadow: `0 10px 30px ${T.shadow}` }}>
          <header style={{ padding: 22, borderBottom: `1px solid ${T.rule}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
              <div>
                <div style={{ color: T.green, fontSize: 11, fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase' }}>AgriLink · Carga verificada</div>
                <h1 style={{ margin: '8px 0 5px', fontSize: 24, color: T.ink }}>{data.product_name}</h1>
                <div style={{ color: T.muted, fontSize: 12, fontFamily: 'monospace' }}>ID: {maskUuid(data.id)}</div>
              </div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 10px', borderRadius: 999, background: T.g50, color: T.green, fontSize: 11, fontWeight: 900 }}>
                <CheckCircle2 size={14} /> {statusLabel[data.status] || data.status}
              </div>
            </div>
          </header>

          <div style={{ padding: '8px 22px 22px' }}>
            <ScanRow icon={<PackageCheck size={17} />} label="Quantidade / peso" value={`${new Intl.NumberFormat('pt-AO').format(data.weight_kg)} kg`} />
            <ScanRow icon={<MapPin size={17} />} label="Percurso" value={`${data.origin_label} → ${data.destination_label}`} />
            <ScanRow icon={<Truck size={17} />} label="Recolha" value={data.pickup_date ? new Date(`${data.pickup_date}T00:00:00`).toLocaleDateString('pt-AO') : 'Não definida'} />
            <ScanRow icon={<Route size={17} />} label="Rota estimada" value={data.route_distance_km != null ? `${data.route_distance_km.toFixed(1)} km · ${data.route_duration_minutes ?? '—'} min` : 'Não calculada'} />
            <ScanRow icon={<Clock3 size={17} />} label="Pedido" value={data.order_display_id ? `#${data.order_display_id} · ${data.order_status || '—'}` : 'Sem pedido associado'} />
            {data.payment_status && <ScanRow icon={<CheckCircle2 size={17} />} label="Pagamento" value={data.payment_status} />}
            {data.buyer_name && <ScanRow icon={<PackageCheck size={17} />} label="Cliente" value={data.buyer_phone ? `${data.buyer_name} · ${data.buyer_phone}` : data.buyer_name} />}
            {data.driver_name && <ScanRow icon={<Phone size={17} />} label="Transportador" value={data.driver_phone ? `${data.driver_name} · ${data.driver_phone}` : data.driver_name} />}
            {data.notes && <ScanRow icon={<AlertTriangle size={17} />} label="Observações" value={data.notes} />}
          </div>

          <footer style={{ padding: '13px 22px', background: T.g50, color: T.mid, fontSize: 11, lineHeight: 1.5 }}>
            O ID completo não é exibido. Os detalhes acima foram liberados apenas porque a sua conta está associada à carga.
          </footer>
        </article>
      </div>
    </div>
  );
};

export default FreightLoadScan;