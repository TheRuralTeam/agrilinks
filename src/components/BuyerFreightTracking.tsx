import { useEffect, useState } from 'react';
import { AlertTriangle, Clock3, MapPin, RadioTower } from 'lucide-react';
import { supabase } from '../integrations/supabase/client';
import { FreightRouteMap } from './FreightRouteMap';

type Load = {
  id: string;
  status: string;
  origin_label: string | null;
  destination_label: string | null;
  origin_lat: number | null;
  origin_lng: number | null;
  destination_lat: number | null;
  destination_lng: number | null;
};
type Position = {
  latitude: number;
  longitude: number;
  accuracy_m: number | null;
  speed_mps: number | null;
  heading_deg: number | null;
  recorded_at: string;
  captured_at?: string;
  received_at?: string;
};

const statusLabel: Record<string, string> = {
  accepted: 'Motorista atribuído · a preparar recolha',
  at_pickup: 'Motorista no local de recolha',
  in_transit: 'Em transporte',
  delivered: 'Entrega declarada pelo motorista',
  cancelled: 'Transporte cancelado',
};

export default function BuyerFreightTracking({ load }: { load: Load }) {
  const [position, setPosition] = useState<Position | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastCheck, setLastCheck] = useState<string | null>(null);
  const [readError, setReadError] = useState(false);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      const { data, error } = await (supabase as any).from('freight_load_locations')
        .select('latitude,longitude,accuracy_m,speed_mps,heading_deg,recorded_at,captured_at,received_at')
        .eq('freight_load_id', load.id)
        .maybeSingle();
      if (!active) return;
      if (error) {
        setReadError(true);
      } else {
        setReadError(false);
        setPosition(data as Position | null);
      }
      setLastCheck(new Date().toISOString());
      setLoading(false);
    };
    void refresh();
    const channel = supabase.channel('buyer-freight-location-' + load.id)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'freight_load_locations',
        filter: 'freight_load_id=eq.' + load.id,
      }, (payload) => {
        if (payload.new && typeof payload.new === 'object' && 'latitude' in payload.new) {
          setPosition(payload.new as Position);
          setReadError(false);
        }
      })
      .subscribe();
    const timer = window.setInterval(() => void refresh(), 30000);
    return () => {
      active = false;
      window.clearInterval(timer);
      void supabase.removeChannel(channel);
    };
  }, [load.id]);

  const capturedAt = position ? new Date(position.captured_at || position.recorded_at) : null;
  const receivedAt = position ? new Date(position.received_at || position.recorded_at) : null;
  const ageMs = capturedAt ? Math.max(0, Date.now() - capturedAt.getTime()) : null;
  const stale = ageMs != null && ageMs > 120000;
  const driverPoint: [number, number] | null = position ? [position.latitude, position.longitude] : null;
  const origin: [number, number] | null = load.origin_lat != null && load.origin_lng != null ? [load.origin_lat, load.origin_lng] : null;
  const destination: [number, number] | null = load.destination_lat != null && load.destination_lng != null ? [load.destination_lat, load.destination_lng] : null;

  return (
    <section className="mt-4 space-y-3 rounded-xl border p-4" aria-label="Acompanhamento do transporte">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><p className="text-xs font-bold uppercase tracking-wide text-primary">Acompanhamento AgriLink</p><h3 className="mt-1 font-semibold">Localização do motorista</h3></div>
        <span className="rounded-full border px-2.5 py-1 text-xs font-semibold">{statusLabel[load.status] || load.status}</span>
      </div>
      {load.status === 'in_transit' && (
        <div className="flex items-start gap-2 rounded-lg bg-muted/60 p-3 text-sm">
          {stale ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" /> : <RadioTower className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />}
          <div>
            <p className="font-semibold">{!position ? 'A aguardar primeira posição GPS' : stale ? 'Sem atualização recente' : 'Posição recebida recentemente'}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {!position ? 'O mapa será atualizado assim que o dispositivo do motorista enviar uma posição válida.' :
                'Última captura: ' + capturedAt?.toLocaleString('pt-AO') + '. Recebida pelo servidor: ' + receivedAt?.toLocaleString('pt-AO') + '.'}
            </p>
          </div>
        </div>
      )}
      {origin || destination || driverPoint ? (
        <FreightRouteMap origin={origin} destination={destination} driverLocation={driverPoint} height={300} />
      ) : (
        <div className="grid min-h-36 place-items-center rounded-lg bg-muted/40 text-center text-sm text-muted-foreground"><MapPin className="mb-2 h-5 w-5" />Coordenadas da rota ainda não disponíveis.</div>
      )}
      {position && (
        <div className="grid gap-2 text-sm sm:grid-cols-3">
          <div className="rounded-lg bg-muted/40 p-3"><p className="text-xs text-muted-foreground">Última posição</p><p className="mt-1 font-medium tabular-nums">{position.latitude.toFixed(5)}, {position.longitude.toFixed(5)}</p></div>
          <div className="rounded-lg bg-muted/40 p-3"><p className="text-xs text-muted-foreground">Precisão GPS</p><p className="mt-1 font-medium">{position.accuracy_m != null ? '±' + Math.round(position.accuracy_m) + ' m' : 'Não informada'}</p></div>
          <div className="rounded-lg bg-muted/40 p-3"><p className="text-xs text-muted-foreground">Velocidade reportada</p><p className="mt-1 font-medium">{position.speed_mps != null ? (position.speed_mps * 3.6).toFixed(0) + ' km/h' : 'Não disponível'}</p></div>
        </div>
      )}
      {readError && <p role="status" className="text-xs text-amber-700">Não foi possível atualizar a posição agora. A última posição apresentada, se existir, não deve ser considerada atual.</p>}
      {loading && <p className="text-xs text-muted-foreground">A consultar posição do motorista…</p>}
      {lastCheck && <p className="flex items-center gap-1 text-[11px] text-muted-foreground"><Clock3 size={12} /> Consulta verificada: {new Date(lastCheck).toLocaleTimeString('pt-AO')}</p>}
      {load.status === 'delivered' && <p className="text-xs text-muted-foreground">A entrega foi declarada pelo motorista. A confirmação de recepção pelo comprador continua a ser uma etapa independente.</p>}
    </section>
  );
}
