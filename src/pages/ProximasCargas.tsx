import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarDays,
  Check,
  Clock3,
  CloudRain,
  MapPin,
  Navigation,
  PackageCheck,
  Plus,
  Route,
  Weight,
  X,
  Download,
} from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import { FreightRouteMap, FreightPointSelection } from '../components/FreightRouteMap';
import { supabase } from '../integrations/supabase/client';
import { useAuth } from '../contexts/AuthContext';
import { useCanAct } from '../hooks/useCanAct';
import { T, FONT } from '../lib/brand';
import {
  calculateFreightRoute,
  DestinationWeather,
  fetchDestinationWeather,
  FreightCoordinate,
  FreightRoute,
} from '../lib/freightGeo';
import { toast } from 'sonner';
import { downloadFreightLoadPdf } from '../lib/freightPdf';
import Loader from '../components/ui/Loader';

interface FreightLoad {
  id: string;
  qr_token: string;
  pre_order_id: string | null;
  created_by: string;
  product_name: string;
  weight_kg: number;
  origin_label: string;
  destination_label: string;
  pickup_date: string | null;
  offered_price: number | null;
  currency: string;
  status: string;
  driver_id: string | null;
  notes: string | null;
  origin_lat: number | null;
  origin_lng: number | null;
  destination_lat: number | null;
  destination_lng: number | null;
  in_transit_at: string | null;
}

interface FreightLoadLocation {
  freight_load_id: string;
  latitude: number;
  longitude: number;
  accuracy_m: number | null;
  speed_mps: number | null;
  heading_deg: number | null;
  recorded_at: string;
}

const STATUS_LABEL: Record<string, string> = {
  available: 'Disponível',
  open: 'Disponível',
  agendado: 'Agendada',
  accepted: 'Aceite',
  in_transit: 'Em trânsito',
  delivered: 'Entregue',
  cancelled: 'Cancelada',
};

const money = (v: number | null, c: string) =>
  v == null ? '—' : `${new Intl.NumberFormat('pt-AO').format(v)} ${c || 'Kz'}`;

const formatCoordinateLabel = ([latitude, longitude]: FreightCoordinate) =>
  `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;

const formatDuration = (minutes: number) => {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (!hours) return `${remainingMinutes} min`;
  return remainingMinutes ? `${hours} h ${remainingMinutes} min` : `${hours} h`;
};

const formInputStyle: React.CSSProperties = {
  width: '100%',
  minHeight: 42,
  boxSizing: 'border-box',
  padding: '9px 11px',
  border: `1px solid ${T.rule}`,
  borderRadius: 6,
  background: T.white,
  color: T.ink,
  fontFamily: FONT,
  fontSize: 13,
};

const ProximasCargas = () => {
  const navigate = useNavigate();
  const { user, userProfile } = useAuth();
  const { requireAct } = useCanAct();
  const [loads, setLoads] = useState<FreightLoad[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [tab, setTab] = useState<'disponiveis' | 'minhas'>('disponiveis');
  const [createOpen, setCreateOpen] = useState(false);
  const [productName, setProductName] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [originLabel, setOriginLabel] = useState('');
  const [destinationLabel, setDestinationLabel] = useState('');
  const [origin, setOrigin] = useState<FreightCoordinate | null>(null);
  const [destination, setDestination] = useState<FreightCoordinate | null>(null);
  const [pickupDate, setPickupDate] = useState('');
  const [offeredPrice, setOfferedPrice] = useState('');
  const [notes, setNotes] = useState('');
  const [pointSelection, setPointSelection] = useState<FreightPointSelection>('origin');
  const [routePreview, setRoutePreview] = useState<FreightRoute | null>(null);
  const [destinationWeather, setDestinationWeather] = useState<DestinationWeather | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [savingLoad, setSavingLoad] = useState(false);
  const [loadRoute, setLoadRoute] = useState<{
    id: string;
    route: FreightRoute | null;
    weather: DestinationWeather | null;
    error: string | null;
    loading: boolean;
  } | null>(null);
  const [driverLocations, setDriverLocations] = useState<Record<string, FreightLoadLocation>>({});
  const [sharingLocationFor, setSharingLocationFor] = useState<string | null>(null);
  const locationWatchId = useRef<number | null>(null);
  const lastLocationWriteAt = useRef(0);

  const capacity = (userProfile as any)?.load_capacity_kg as number | null | undefined;

  useEffect(() => {
    if (!origin || !destination) {
      setRoutePreview(null);
      setDestinationWeather(null);
      setRouteError(null);
      setWeatherError(null);
      return;
    }

    const controller = new AbortController();
    setRouteLoading(true);
    setRouteError(null);
    setWeatherError(null);
    setRoutePreview(null);
    setDestinationWeather(null);

    void Promise.allSettled([
      calculateFreightRoute(origin, destination, controller.signal),
      fetchDestinationWeather(destination, pickupDate || null, controller.signal),
    ])
      .then(([routeResult, weatherResult]) => {
        if (controller.signal.aborted) return;
        if (routeResult.status === 'fulfilled') setRoutePreview(routeResult.value);
        else
          setRouteError(
            routeResult.reason instanceof Error ? routeResult.reason.message : 'Rota indisponível.'
          );
        if (weatherResult.status === 'fulfilled') setDestinationWeather(weatherResult.value);
        else
          setWeatherError(
            weatherResult.reason instanceof Error
              ? weatherResult.reason.message
              : 'Previsão indisponível.'
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setRouteLoading(false);
      });

    return () => controller.abort();
  }, [destination, origin, pickupDate]);

  const fetchLoads = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('freight_loads')
        .select('*')
        .order('pickup_date', { ascending: true, nullsFirst: false })
        .limit(80);
      if (error) throw error;
      setLoads((data || []) as unknown as FreightLoad[]);
    } catch (e: any) {
      toast.error('Não foi possível carregar as cargas.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchLoads();
  }, [fetchLoads, user?.id]);

  const handlePointSelection = (coordinate: FreightCoordinate) => {
    const coordinateLabel = formatCoordinateLabel(coordinate);
    if (pointSelection === 'origin') {
      setOrigin(coordinate);
      setOriginLabel(`Origem · ${coordinateLabel}`);
      setPointSelection('destination');
      return;
    }
    setDestination(coordinate);
    setDestinationLabel(`Destino · ${coordinateLabel}`);
  };

  const publishLoad = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!requireAct('publicar uma carga')) return;
    if (!user?.id) return;
    if (!origin || !destination) {
      toast.error('Marque a origem e o destino no mapa.');
      return;
    }
    const numericWeight = Number(weightKg);
    if (
      !productName.trim() ||
      !originLabel.trim() ||
      !destinationLabel.trim() ||
      !Number.isFinite(numericWeight) ||
      numericWeight <= 0
    ) {
      toast.error('Preencha produto, peso e os dois locais da carga.');
      return;
    }

    setSavingLoad(true);
    const { error } = await supabase.from('freight_loads').insert({
      created_by: user.id,
      product_name: productName.trim(),
      weight_kg: numericWeight,
      origin_label: originLabel.trim(),
      origin_lat: origin[0],
      origin_lng: origin[1],
      destination_label: destinationLabel.trim(),
      destination_lat: destination[0],
      destination_lng: destination[1],
      pickup_date: pickupDate || null,
      offered_price: offeredPrice ? Number(offeredPrice) : null,
      currency: 'Kz',
      status: 'available',
      notes: notes.trim() || null,
    });
    setSavingLoad(false);

    if (error) {
      toast.error('Não foi possível publicar a carga.');
      return;
    }

    toast.success('Carga publicada para motoristas.');
    setCreateOpen(false);
    setProductName('');
    setWeightKg('');
    setOriginLabel('');
    setDestinationLabel('');
    setOrigin(null);
    setDestination(null);
    setPickupDate('');
    setOfferedPrice('');
    setNotes('');
    setRoutePreview(null);
    setDestinationWeather(null);
    void fetchLoads();
  };

  const showLoadRoute = async (load: FreightLoad) => {
    if (loadRoute?.id === load.id) {
      setLoadRoute(null);
      return;
    }
    if (
      load.origin_lat == null ||
      load.origin_lng == null ||
      load.destination_lat == null ||
      load.destination_lng == null
    ) {
      toast.error('Esta carga ainda não tem coordenadas para calcular a rota.');
      return;
    }

    setLoadRoute({ id: load.id, route: null, weather: null, error: null, loading: true });
    const [routeResult, weatherResult] = await Promise.allSettled([
      calculateFreightRoute(
        [load.origin_lat, load.origin_lng],
        [load.destination_lat, load.destination_lng]
      ),
      fetchDestinationWeather([load.destination_lat, load.destination_lng], load.pickup_date),
    ]);
    const route = routeResult.status === 'fulfilled' ? routeResult.value : null;
    const weather = weatherResult.status === 'fulfilled' ? weatherResult.value : null;
    const errors = [routeResult, weatherResult]
      .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
      .map((result) =>
        result.reason instanceof Error ? result.reason.message : 'Informação indisponível.'
      );
    setLoadRoute({ id: load.id, route, weather, error: errors.join(' '), loading: false });
  };

  const relevantTransitIds = loads
    .filter(
      (load) =>
        load.status === 'in_transit' &&
        (load.created_by === user?.id || load.driver_id === user?.id)
    )
    .map((load) => load.id)
    .sort()
    .join(',');

  useEffect(() => {
    if (!relevantTransitIds) {
      setDriverLocations({});
      return;
    }

    let cancelled = false;
    const loadLocations = async () => {
      const ids = relevantTransitIds.split(',');
      const { data, error } = await supabase
        .from('freight_load_locations')
        .select('*')
        .in('freight_load_id', ids);
      if (cancelled || error || !data) return;
      setDriverLocations(
        Object.fromEntries(data.map((location) => [location.freight_load_id, location]))
      );
    };

    void loadLocations();
    const intervalId = window.setInterval(() => {
      void loadLocations();
    }, 15000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [relevantTransitIds]);

  const stopLocationSharing = () => {
    if (locationWatchId.current != null && navigator.geolocation) {
      navigator.geolocation.clearWatch(locationWatchId.current);
    }
    locationWatchId.current = null;
    setSharingLocationFor(null);
  };

  useEffect(
    () => () => {
      if (locationWatchId.current != null && navigator.geolocation) {
        navigator.geolocation.clearWatch(locationWatchId.current);
      }
    },
    []
  );

  const downloadLoadPdf = useCallback(async (load: FreightLoad) => {
    try {
      const { data, error } = await supabase.rpc(
        'get_freight_load_qr_details' as never,
        { p_qr_token: load.qr_token } as never,
      );

      if (error) throw error;

      const details = (Array.isArray(data) ? data[0] : data) as
        | (FreightLoad & { buyer_name?: string | null })
        | null;

      if (!details) throw new Error('Não foi possível validar esta carga.');

      await downloadFreightLoadPdf({
        ...load,
        client_name: details.buyer_name ?? null,
      });
      toast.success('PDF da carga preparado com sucesso.');
    } catch (error) {
      console.error('Erro ao gerar PDF da carga:', error);
      toast.error('Não foi possível gerar o PDF desta carga.');
    }
  }, []);

  const startLocationSharing = (load: FreightLoad) => {
    if (!requireAct('partilhar a localização desta carga')) return;
    if (load.driver_id !== user?.id || load.status !== 'in_transit') {
      toast.error('A localização só pode ser partilhada pelo motorista durante o transporte.');
      return;
    }
    if (!navigator.geolocation) {
      toast.error('Este dispositivo não disponibiliza localização GPS.');
      return;
    }

    stopLocationSharing();
    lastLocationWriteAt.current = 0;
    setSharingLocationFor(load.id);
    locationWatchId.current = navigator.geolocation.watchPosition(
      async (position) => {
        if (Date.now() - lastLocationWriteAt.current < 15000) return;
        lastLocationWriteAt.current = Date.now();
        const location: FreightLoadLocation = {
          freight_load_id: load.id,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy_m: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : null,
          speed_mps:
            position.coords.speed != null && position.coords.speed >= 0
              ? position.coords.speed
              : null,
          heading_deg:
            position.coords.heading != null && position.coords.heading >= 0
              ? position.coords.heading
              : null,
          recorded_at: new Date().toISOString(),
        };
        const { error } = await supabase
          .from('freight_load_locations')
          .upsert(location, { onConflict: 'freight_load_id' });
        if (error) {
          toast.error(
            'Não foi possível partilhar a localização. Verifique a ligação ou a migração do GPS.'
          );
          stopLocationSharing();
          return;
        }
        setDriverLocations((previous) => ({ ...previous, [load.id]: location }));
      },
      (error) => {
        toast.error(
          error.code === error.PERMISSION_DENIED
            ? 'Permita o acesso à localização para partilhar o trajeto.'
            : 'Não foi possível obter a localização do motorista.'
        );
        stopLocationSharing();
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
    );
  };

  const submitQuote = async (load: FreightLoad) => {
    if (!requireAct('propor o preço de uma carga')) return;
    if (!user?.id || load.created_by === user.id) return;
    if (!load.origin_lat || !load.origin_lng || !load.destination_lat || !load.destination_lng) {
      toast.error('Esta carga não tem uma rota GPS válida.'); return;
    }
    setBusyId(load.id);
    try {
      const route = await calculateFreightRoute([load.origin_lat,load.origin_lng],[load.destination_lat,load.destination_lng]);
      const { error } = await supabase.rpc('submit_freight_quote', {
        p_freight_load_id: load.id,
        p_price_method: 'suggested',
        p_manual_price: null,
        p_route_distance_km: route.distanceKm,
        p_route_duration_minutes: route.durationMinutes,
      });
      if (error) throw error;
      toast.success('Preço de transporte enviado ao comprador para aprovação.');
      await fetchLoads();
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível enviar a proposta de transporte.');
    } finally { setBusyId(null); }
  };

  const accept = async (load: FreightLoad) => {
    if (!requireAct('aceitar uma carga')) return;
    if (capacity && load.weight_kg > capacity) {
      toast.error(`Carga acima da sua capacidade (${capacity} kg).`);
      return;
    }
    setBusyId(load.id);
    const { error } = await supabase.rpc('accept_freight_load', { p_freight_load_id: load.id });
    setBusyId(null);
    if (error) {
      toast.error('Não foi possível aceitar esta carga.');
      return;
    }
    toast.success('Carga aceite. Boa viagem!');
    fetchLoads();
  };

  const advance = async (load: FreightLoad) => {
    if (!requireAct('actualizar a carga')) return;
    if (load.driver_id !== user?.id) {
      toast.error('Só o motorista atribuído pode atualizar esta carga.');
      return;
    }
    const nextStatus = load.status === 'accepted' ? 'in_transit' : 'delivered';
    setBusyId(load.id);
    const { error } = await supabase.rpc('advance_freight_load_status', { p_freight_load_id: load.id, p_status: nextStatus });
    setBusyId(null);
    if (error) {
      toast.error(error?.message || 'Não foi possível actualizar.');
      return;
    }
    if (nextStatus === 'delivered' && sharingLocationFor === load.id) stopLocationSharing();
    fetchLoads();
  };

  const visible = loads.filter((load) => {
    if (tab === 'minhas') return load.driver_id === user?.id || load.created_by === user?.id;
    return (
      ['available', 'open', 'agendado'].includes(load.status) &&
      !load.driver_id &&
      load.created_by !== user?.id
    );
  });

  return (
    <div style={{ minHeight: '100vh', background: T.canvas, fontFamily: FONT, paddingBottom: 120 }}>
      <header
        style={{
          background: T.white,
          borderBottom: `1px solid ${T.rule}`,
          padding: '14px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          position: 'sticky',
          top: 0,
          zIndex: 20,
        }}
      >
        <button
          aria-label="Voltar"
          onClick={() => navigate(-1)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: T.mid,
            display: 'flex',
            padding: 4,
          }}
        >
          <ArrowLeft size={20} />
        </button>
        <div style={{ flex: 1 }}>
          <h1
            style={{
              margin: 0,
              fontSize: 17,
              fontWeight: 800,
              color: T.ink,
              letterSpacing: '-0.02em',
            }}
          >
            Próximas Cargas
          </h1>
          <p style={{ margin: 0, fontSize: 12, color: T.muted, fontWeight: 600 }}>
            {capacity
              ? `Capacidade: ${new Intl.NumberFormat('pt-AO').format(capacity)} kg`
              : 'Fretes disponíveis na AgriLink'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen((open) => !open)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 7,
            minHeight: 40,
            padding: '0 12px',
            border: 'none',
            borderRadius: 8,
            background: T.green,
            color: T.white,
            fontFamily: FONT,
            fontSize: 12,
            fontWeight: 800,
            cursor: 'pointer',
          }}
        >
          {createOpen ? <X size={16} /> : <Plus size={16} />}
          {createOpen ? 'Fechar' : 'Publicar carga'}
        </button>
      </header>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 8,
          padding: '14px 16px',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {(['disponiveis', 'minhas'] as const).map((key) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              style={{
                padding: '9px 16px',
                borderRadius: 8,
                cursor: 'pointer',
                fontFamily: FONT,
                fontSize: 13,
                fontWeight: 800,
                border: `1px solid ${tab === key ? T.green : T.rule}`,
                background: tab === key ? T.green : T.white,
                color: tab === key ? T.white : T.mid,
              }}
            >
              {key === 'disponiveis' ? 'Disponíveis' : 'As minhas cargas'}
            </button>
          ))}
        </div>
      </div>

      {createOpen && (
        <section
          aria-label="Publicar carga"
          style={{
            margin: '0 16px 16px',
            padding: 16,
            background: T.white,
            border: `1px solid ${T.rule}`,
            borderRadius: 8,
          }}
        >
          <form onSubmit={publishLoad}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))',
                gap: 20,
              }}
            >
              <div style={{ display: 'grid', alignContent: 'start', gap: 12 }}>
                <h2 style={{ margin: 0, color: T.ink, fontSize: 17, fontWeight: 800 }}>
                  Nova carga
                </h2>
                <label
                  style={{ display: 'grid', gap: 5, color: T.mid, fontSize: 12, fontWeight: 700 }}
                >
                  Produto
                  <input
                    required
                    value={productName}
                    onChange={(event) => setProductName(event.target.value)}
                    placeholder="Ex.: Tomate"
                    style={formInputStyle}
                  />
                </label>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                    gap: 10,
                  }}
                >
                  <label
                    style={{ display: 'grid', gap: 5, color: T.mid, fontSize: 12, fontWeight: 700 }}
                  >
                    Peso (kg)
                    <input
                      required
                      min="1"
                      step="0.1"
                      type="number"
                      value={weightKg}
                      onChange={(event) => setWeightKg(event.target.value)}
                      style={formInputStyle}
                    />
                  </label>
                  <label
                    style={{ display: 'grid', gap: 5, color: T.mid, fontSize: 12, fontWeight: 700 }}
                  >
                    Valor oferecido (Kz)
                    <input
                      min="0"
                      step="1"
                      type="number"
                      value={offeredPrice}
                      onChange={(event) => setOfferedPrice(event.target.value)}
                      style={formInputStyle}
                    />
                  </label>
                </div>
                <label
                  style={{ display: 'grid', gap: 5, color: T.mid, fontSize: 12, fontWeight: 700 }}
                >
                  Data de recolha
                  <input
                    type="date"
                    value={pickupDate}
                    onChange={(event) => setPickupDate(event.target.value)}
                    style={formInputStyle}
                  />
                </label>
                <label
                  style={{ display: 'grid', gap: 5, color: T.mid, fontSize: 12, fontWeight: 700 }}
                >
                  Origem
                  <input
                    required
                    value={originLabel}
                    onChange={(event) => setOriginLabel(event.target.value)}
                    placeholder="Marque a origem no mapa"
                    style={formInputStyle}
                  />
                </label>
                <label
                  style={{ display: 'grid', gap: 5, color: T.mid, fontSize: 12, fontWeight: 700 }}
                >
                  Destino
                  <input
                    required
                    value={destinationLabel}
                    onChange={(event) => setDestinationLabel(event.target.value)}
                    placeholder="Marque o destino no mapa"
                    style={formInputStyle}
                  />
                </label>
                <label
                  style={{ display: 'grid', gap: 5, color: T.mid, fontSize: 12, fontWeight: 700 }}
                >
                  Observações
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    style={{ ...formInputStyle, resize: 'vertical' }}
                  />
                </label>
              </div>

              <div style={{ display: 'grid', alignContent: 'start', gap: 10, minWidth: 0 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 8,
                  }}
                >
                  <strong style={{ color: T.ink, fontSize: 13 }}>Selecionar pontos</strong>
                  <div
                    role="group"
                    aria-label="Ponto a selecionar"
                    style={{ display: 'flex', gap: 6 }}
                  >
                    {(['origin', 'destination'] as const).map((point) => (
                      <button
                        key={point}
                        type="button"
                        aria-pressed={pointSelection === point}
                        onClick={() => setPointSelection(point)}
                        style={{
                          padding: '7px 10px',
                          border: `1px solid ${pointSelection === point ? T.green : T.rule}`,
                          borderRadius: 6,
                          background: pointSelection === point ? T.green : T.white,
                          color: pointSelection === point ? T.white : T.mid,
                          fontFamily: FONT,
                          fontSize: 11,
                          fontWeight: 800,
                          cursor: 'pointer',
                        }}
                      >
                        {point === 'origin' ? 'Marcar origem' : 'Marcar destino'}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ overflow: 'hidden', border: `1px solid ${T.rule}`, borderRadius: 6 }}>
                  <FreightRouteMap
                    origin={origin}
                    destination={destination}
                    route={routePreview}
                    activeSelection={pointSelection}
                    onSelectPoint={handlePointSelection}
                    height={300}
                  />
                </div>
                <div
                  aria-live="polite"
                  style={{
                    minHeight: 42,
                    display: 'grid',
                    alignContent: 'center',
                    gap: 5,
                    color: T.mid,
                    fontSize: 12,
                  }}
                >
                  {routeLoading ? <span>Calculando rota e previsão…</span> : null}
                  {routePreview ? (
                    <span
                      style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}
                    >
                      <Route size={15} color={T.green} /> {routePreview.distanceKm.toFixed(1)} km
                      <Clock3 size={15} color={T.green} />{' '}
                      {formatDuration(routePreview.durationMinutes)} estimados
                    </span>
                  ) : null}
                  {destinationWeather ? (
                    <span
                      style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}
                    >
                      <CloudRain size={15} color={T.green} /> {destinationWeather.description},{' '}
                      {destinationWeather.minimumTemperature ?? '—'}–
                      {destinationWeather.maximumTemperature ?? '—'} °C · chuva{' '}
                      {destinationWeather.precipitationProbability == null
                        ? '—'
                        : `${destinationWeather.precipitationProbability}%`}
                    </span>
                  ) : null}
                  {routeError ? (
                    <span style={{ color: T.gold }}>
                      {routeError} A carga poderá ser publicada com os pontos escolhidos.
                    </span>
                  ) : null}
                  {weatherError ? <span style={{ color: T.muted }}>{weatherError}</span> : null}
                  {!routeLoading && !routePreview && !origin && !destination ? (
                    <span>Escolha origem ou destino e toque no mapa.</span>
                  ) : null}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
              <button
                type="submit"
                disabled={savingLoad}
                style={{
                  minHeight: 42,
                  padding: '0 18px',
                  border: 'none',
                  borderRadius: 6,
                  background: T.green,
                  color: T.white,
                  fontFamily: FONT,
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: savingLoad ? 'wait' : 'pointer',
                  opacity: savingLoad ? 0.65 : 1,
                }}
              >
                {savingLoad ? 'A publicar…' : 'Publicar carga'}
              </button>
            </div>
          </form>
        </section>
      )}

      <main style={{ padding: '0 16px', display: 'grid', gap: 12 }}>
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 48, color: T.muted }}>
            <Loader compact />
          </div>
        )}

        {!loading && visible.length === 0 && (
          <div
            style={{
              background: T.white,
              border: `1px solid ${T.rule}`,
              borderRadius: 18,
              padding: 32,
              textAlign: 'center',
            }}
          >
            <PackageCheck size={28} color={T.faint} />
            <p style={{ marginTop: 12, fontSize: 14, fontWeight: 700, color: T.mid }}>
              {tab === 'minhas'
                ? 'Ainda não publicou nem aceitou cargas.'
                : 'Sem cargas disponíveis de momento.'}
            </p>
          </div>
        )}

        {!loading &&
          visible.map((load) => {
            const tooHeavy = !!capacity && load.weight_kg > capacity;
            const isAssignedDriver = load.driver_id === user?.id;
            const latestDriverLocation = driverLocations[load.id];
            const hasCoordinates =
              load.origin_lat != null &&
              load.origin_lng != null &&
              load.destination_lat != null &&
              load.destination_lng != null;
            return (
              <article
                key={load.id}
                style={{
                  background: T.white,
                  border: `1px solid ${T.rule}`,
                  borderRadius: 18,
                  padding: 16,
                  boxShadow: `0 6px 20px ${T.shadow}`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 13,
                      background: T.g50,
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <PackageCheck size={19} color={T.green} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h2
                      style={{
                        margin: 0,
                        fontSize: 15.5,
                        fontWeight: 800,
                        color: T.ink,
                        letterSpacing: '-0.01em',
                      }}
                    >
                      {load.product_name}
                    </h2>
                    <span
                      style={{
                        display: 'inline-block',
                        marginTop: 4,
                        padding: '3px 9px',
                        borderRadius: 999,
                        background: T.g50,
                        color: T.green,
                        fontSize: 11,
                        fontWeight: 800,
                      }}
                    >
                      {STATUS_LABEL[load.status] || load.status}
                    </span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: T.green }}>
                      {money(load.offered_price, load.currency)}
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    marginTop: 14,
                    display: 'grid',
                    gap: 8,
                    fontSize: 13,
                    color: T.mid,
                    fontWeight: 600,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <MapPin size={15} color={T.faint} />
                    <span>
                      {load.origin_label} → {load.destination_label}
                    </span>
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
                  <p style={{ marginTop: 10, fontSize: 12.5, color: T.muted, lineHeight: 1.5 }}>
                    {load.notes}
                  </p>
                )}

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                  <button
                    type="button"
                    onClick={() => void downloadLoadPdf(load)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 7,
                      minHeight: 38,
                      padding: '0 11px',
                      border: `1px solid ${T.rule}`,
                      borderRadius: 6,
                      background: T.white,
                      color: T.green,
                      fontFamily: FONT,
                      fontSize: 12,
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                    title="Descarregar documento da carga"
                  >
                    <Download size={15} /> PDF
                  </button>
                  {hasCoordinates && (
                    <button
                      type="button"
                      onClick={() => void showLoadRoute(load)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 7,
                        minHeight: 38,
                        padding: '0 11px',
                        border: `1px solid ${T.rule}`,
                        borderRadius: 6,
                        background: T.white,
                        color: T.green,
                        fontFamily: FONT,
                        fontSize: 12,
                        fontWeight: 800,
                        cursor: 'pointer',
                      }}
                    >
                      <Route size={15} />{' '}
                      {loadRoute?.id === load.id ? 'Ocultar mapa' : 'Ver rota e clima'}
                    </button>
                  )}
                  {load.status === 'in_transit' && isAssignedDriver && (
                    <button
                      type="button"
                      onClick={() =>
                        sharingLocationFor === load.id
                          ? stopLocationSharing()
                          : startLocationSharing(load)
                      }
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 7,
                        minHeight: 38,
                        padding: '0 11px',
                        border: 'none',
                        borderRadius: 6,
                        background: sharingLocationFor === load.id ? T.gold : T.green,
                        color: T.white,
                        fontFamily: FONT,
                        fontSize: 12,
                        fontWeight: 800,
                        cursor: 'pointer',
                      }}
                    >
                      <Navigation size={15} />{' '}
                      {sharingLocationFor === load.id
                        ? 'Parar partilha GPS'
                        : 'Partilhar localização'}
                    </button>
                  )}
                </div>

                {loadRoute?.id === load.id && (
                  <section
                    aria-label={`Mapa da carga ${load.product_name}`}
                    style={{ display: 'grid', gap: 9, marginTop: 12 }}
                  >
                    {loadRoute.loading ? (
                      <p style={{ margin: 0, color: T.muted, fontSize: 12 }}>
                        A calcular rota e previsão…
                      </p>
                    ) : null}
                    {loadRoute.error ? (
                      <p style={{ margin: 0, color: T.gold, fontSize: 12 }}>{loadRoute.error}</p>
                    ) : null}
                    <div
                      style={{ overflow: 'hidden', border: `1px solid ${T.rule}`, borderRadius: 6 }}
                    >
                      <FreightRouteMap
                        origin={
                          load.origin_lat == null || load.origin_lng == null
                            ? null
                            : [load.origin_lat, load.origin_lng]
                        }
                        destination={
                          load.destination_lat == null || load.destination_lng == null
                            ? null
                            : [load.destination_lat, load.destination_lng]
                        }
                        route={loadRoute.route}
                        driverLocation={
                          latestDriverLocation
                            ? [latestDriverLocation.latitude, latestDriverLocation.longitude]
                            : null
                        }
                        height={240}
                      />
                    </div>
                    {loadRoute.route && (
                      <div
                        style={{
                          display: 'flex',
                          gap: 14,
                          flexWrap: 'wrap',
                          color: T.mid,
                          fontSize: 12,
                          fontWeight: 700,
                        }}
                      >
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <Route size={14} color={T.green} />{' '}
                          {loadRoute.route.distanceKm.toFixed(1)} km
                        </span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <Clock3 size={14} color={T.green} />{' '}
                          {formatDuration(loadRoute.route.durationMinutes)} estimados
                        </span>
                      </div>
                    )}
                    {loadRoute.weather && (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          color: T.mid,
                          fontSize: 12,
                        }}
                      >
                        <CloudRain size={14} color={T.green} /> Destino em{' '}
                        {new Date(`${loadRoute.weather.date}T00:00:00`).toLocaleDateString('pt-AO')}
                        : {loadRoute.weather.description},{' '}
                        {loadRoute.weather.minimumTemperature ?? '—'}–
                        {loadRoute.weather.maximumTemperature ?? '—'} °C, chuva{' '}
                        {loadRoute.weather.precipitationProbability == null
                          ? '—'
                          : `${loadRoute.weather.precipitationProbability}%`}
                      </span>
                    )}
                    {load.status === 'in_transit' && latestDriverLocation && (
                      <span style={{ color: T.muted, fontSize: 11 }}>
                        Última posição compartilhada:{' '}
                        {new Date(latestDriverLocation.recorded_at).toLocaleTimeString('pt-AO', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    )}
                  </section>
                )}

                {tab === 'disponiveis' ? (
                  <button
                    disabled={busyId === load.id || tooHeavy}
                    onClick={() => submitQuote(load)}
                    style={{
                      marginTop: 14,
                      width: '100%',
                      padding: '12px 16px',
                      borderRadius: 14,
                      border: 'none',
                      background: tooHeavy ? T.rule : T.green,
                      color: tooHeavy ? T.muted : T.white,
                      fontFamily: FONT,
                      fontSize: 14,
                      fontWeight: 800,
                      cursor: tooHeavy ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {busyId === load.id
                      ? 'A calcular…'
                      : tooHeavy
                        ? 'Capacidade insuficiente'
                        : 'Calcular e propor preço'}
                  </button>
                ) : load.status === 'accepted' || load.status === 'in_transit' ? (
                  <button
                    disabled={busyId === load.id}
                    onClick={() => advance(load)}
                    style={{
                      marginTop: 14,
                      width: '100%',
                      padding: '12px 16px',
                      borderRadius: 14,
                      border: `1.5px solid ${T.green}`,
                      background: T.white,
                      color: T.green,
                      fontFamily: FONT,
                      fontSize: 14,
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    {load.status === 'accepted' ? 'Iniciar transporte' : 'Marcar como entregue'}
                  </button>
                ) : null}
              </article>
            );
          })}
      </main>
    </div>
  );
};

export default ProximasCargas;
