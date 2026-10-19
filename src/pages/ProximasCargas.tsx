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
  Search,
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
import { enqueueFreightLocation, getQueuedFreightLocations, removeQueuedFreightLocation } from '../lib/freightLocationQueue';
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
  buyer_id: string | null;
  supplier_id: string | null;
  supplier_handover_confirmed_at: string | null;
  buyer_receipt_confirmed_at: string | null;
  driver_delivery_confirmed_at?: string | null;
  notes: string | null;
  origin_lat: number | null;
  origin_lng: number | null;
  destination_lat: number | null;
  destination_lng: number | null;
  in_transit_at: string | null;
}

interface RouteLocationSuggestion {
  label: string;
  point: FreightCoordinate | null;
  source: 'mapa' | 'pre-compra' | 'geocoding';
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
  accepted: 'Aceite · a caminho da recolha',
  at_pickup: 'No local de recolha · aguarda confirmação do fornecedor',
  in_transit: 'Em trânsito · GPS',
  delivered: 'A aguardar confirmação do comprador',
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
  const [routeSetupLoadId, setRouteSetupLoadId] = useState<string | null>(null);
  const [routeSetupOrigin, setRouteSetupOrigin] = useState<FreightCoordinate | null>(null);
  const [routeSetupDestination, setRouteSetupDestination] = useState<FreightCoordinate | null>(null);
  const [routeSetupSelection, setRouteSetupSelection] = useState<FreightPointSelection>('destination');
  const [routeSetupDestinationLabel, setRouteSetupDestinationLabel] = useState('');
  const [routeSetupDestinationSearch, setRouteSetupDestinationSearch] = useState('');
  const [routeSetupSuggestions, setRouteSetupSuggestions] = useState<RouteLocationSuggestion[]>([]);
  const [routeSetupGeocodedSuggestions, setRouteSetupGeocodedSuggestions] = useState<RouteLocationSuggestion[]>([]);
  const [routeSetupSearchingPlaces, setRouteSetupSearchingPlaces] = useState(false);
  const locationWatchId = useRef<number | null>(null);
  const lastLocationWriteAt = useRef(0);
  const onlineFlushHandlerRef = useRef<(() => void) | null>(null);
  const queueFlushInProgress = useRef<Set<string>>(new Set());
  const locationRetryNoticeShown = useRef(false);

  const capacity = (userProfile as any)?.load_capacity_kg as number | null | undefined;

  // The route-repair search must query the geocoder, not only filter previously saved places.
  useEffect(() => {
    const query = routeSetupDestinationSearch.trim();
    if (!routeSetupLoadId || query.length < 3 || !navigator.onLine) {
      setRouteSetupGeocodedSuggestions([]);
      setRouteSetupSearchingPlaces(false);
      return;
    }

    let active = true;
    const timer = window.setTimeout(async () => {
      setRouteSetupSearchingPlaces(true);
      try {
        const { data, error } = await supabase.functions.invoke('geocoding-search', {
          body: { query },
        });
        if (error) throw error;
        const results: RouteLocationSuggestion[] = (Array.isArray(data?.results) ? data.results : [])
          .flatMap((item: any) => {
            const latitude = Number(item?.lat);
            const longitude = Number(item?.lon);
            const label = typeof item?.display_name === 'string' ? item.display_name.trim() : '';
            if (!label || !Number.isFinite(latitude) || !Number.isFinite(longitude) ||
                latitude < -18.5 || latitude > -4.2 || longitude < 11.4 || longitude > 24.2) return [];
            return [{ label, point: [latitude, longitude] as FreightCoordinate, source: 'geocoding' as const }];
          });
        if (active) {
          setRouteSetupGeocodedSuggestions(results.filter((item, index, all) =>
            all.findIndex((candidate) => candidate.label.toLocaleLowerCase('pt-AO') === item.label.toLocaleLowerCase('pt-AO')) === index
          ).slice(0, 8));
        }
      } catch (error) {
        console.warn('[AgriLink] Geocodificação indisponível ao corrigir rota GPS.', error);
        if (active) setRouteSetupGeocodedSuggestions([]);
      } finally {
        if (active) setRouteSetupSearchingPlaces(false);
      }
    }, 350);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [routeSetupDestinationSearch, routeSetupLoadId]);

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
        ['accepted', 'at_pickup', 'in_transit'].includes(load.status) &&
        (load.created_by === user?.id || load.driver_id === user?.id || load.buyer_id === user?.id)
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
    if (onlineFlushHandlerRef.current) {
      window.removeEventListener('online', onlineFlushHandlerRef.current);
      onlineFlushHandlerRef.current = null;
    }
    setSharingLocationFor(null);
  };

  const startLocationSharing = (load: FreightLoad) => {
    if (!requireAct('partilhar a localização desta carga')) return;
    if (load.driver_id !== user?.id || !['accepted', 'at_pickup', 'in_transit'].includes(load.status)) {
      toast.error('A localização só pode ser partilhada pelo motorista atribuído, desde a aceitação até à entrega.');
      return;
    }
    if (!navigator.geolocation) {
      toast.error('Este dispositivo não disponibiliza localização GPS.');
      return;
    }

    stopLocationSharing();
    lastLocationWriteAt.current = 0;
    locationRetryNoticeShown.current = false;
    setSharingLocationFor(load.id);

    const syncQueuedLocations = async () => {
      if (!navigator.onLine || queueFlushInProgress.current.has(load.id)) return;
      queueFlushInProgress.current.add(load.id);
      try {
        const queued = await getQueuedFreightLocations(load.id);
        for (const location of queued) {
          const { error } = await supabase.rpc('record_freight_load_location', {
            p_freight_load_id: load.id,
            p_latitude: location.latitude,
            p_longitude: location.longitude,
            p_accuracy_m: location.accuracy_m,
            p_speed_mps: location.speed_mps,
            p_heading_deg: location.heading_deg,
            p_record_history: true,
          });

          if (error) {
            if (error.code === '42501' || error.code === '22023') {
              toast.error('O servidor recusou a sincronização GPS. Confirme a atribuição e o estado da carga.');
              stopLocationSharing();
            } else if (!locationRetryNoticeShown.current) {
              toast.error('Há posições GPS guardadas neste dispositivo. Serão reenviadas quando o servidor estiver acessível.');
              locationRetryNoticeShown.current = true;
            }
            break;
          }

          await removeQueuedFreightLocation(location.id);
          setDriverLocations((previous) => ({ ...previous, [load.id]: location }));
        }

        const remaining = await getQueuedFreightLocations(load.id);
        if (remaining.length === 0 && locationRetryNoticeShown.current) {
          toast.success('Posições GPS sincronizadas com sucesso.');
          locationRetryNoticeShown.current = false;
        }
      } catch (error) {
        console.warn('[AgriLink] Não foi possível sincronizar a fila GPS offline.', error);
        if (!locationRetryNoticeShown.current) {
          toast.error('As posições estão pendentes. A sincronização será tentada novamente quando a ligação regressar.');
          locationRetryNoticeShown.current = true;
        }
      } finally {
        queueFlushInProgress.current.delete(load.id);
      }
    };

    const persistLocation = async (location: FreightLoadLocation) => {
      // Guardar primeiro no IndexedDB evita perder a posição se a rede cair
      // durante o pedido ou se o servidor não responder.
      try {
        await enqueueFreightLocation(location);
        setDriverLocations((previous) => ({ ...previous, [load.id]: location }));
      } catch (error) {
        console.error('[AgriLink] Falha ao guardar a posição GPS offline.', error);
        toast.error('Não foi possível guardar esta posição no dispositivo. Verifique o armazenamento disponível.');
        return;
      }

      if (!navigator.onLine) {
        if (!locationRetryNoticeShown.current) {
          toast.warning('Sem Internet. O GPS continuará a guardar posições neste dispositivo para sincronização posterior.');
          locationRetryNoticeShown.current = true;
        }
        return;
      }

      await syncQueuedLocations();
    };

    const flushPending = () => {
      void syncQueuedLocations();
    };
    onlineFlushHandlerRef.current = flushPending;
    window.addEventListener('online', flushPending);
    window.addEventListener('focus', flushPending);

    locationWatchId.current = navigator.geolocation.watchPosition(
      async (position) => {
        if (Date.now() - lastLocationWriteAt.current < 15000) return;
        lastLocationWriteAt.current = Date.now();
        const location: FreightLoadLocation = {
          freight_load_id: load.id,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy_m: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : null,
          speed_mps: position.coords.speed != null && position.coords.speed >= 0 ? position.coords.speed : null,
          heading_deg: position.coords.heading != null && position.coords.heading >= 0 ? position.coords.heading : null,
          recorded_at: new Date().toISOString(),
        };
        if (!Number.isFinite(location.latitude) || !Number.isFinite(location.longitude) ||
            location.latitude < -90 || location.latitude > 90 ||
            location.longitude < -180 || location.longitude > 180) {
          toast.error('O dispositivo devolveu coordenadas GPS inválidas. A partilha foi interrompida.');
          stopLocationSharing();
          return;
        }
        await persistLocation(location);
      },
      (error) => {
        toast.error(
          error.code === error.PERMISSION_DENIED
            ? 'Permita o acesso à localização para partilhar o trajeto.'
            : error.code === error.TIMEOUT
              ? 'A leitura GPS demorou demasiado. Verifique o sinal e tente novamente.'
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
    setBusyId(load.id);
    try {
      let originPoint: FreightCoordinate | null =
        load.origin_lat != null && load.origin_lng != null &&
        Number.isFinite(load.origin_lat) && Number.isFinite(load.origin_lng) &&
        Math.abs(load.origin_lat) <= 90 && Math.abs(load.origin_lng) <= 180
          ? [load.origin_lat, load.origin_lng]
          : null;
      let destinationPoint: FreightCoordinate | null =
        load.destination_lat != null && load.destination_lng != null &&
        Number.isFinite(load.destination_lat) && Number.isFinite(load.destination_lng) &&
        Math.abs(load.destination_lat) <= 90 && Math.abs(load.destination_lng) <= 180
          ? [load.destination_lat, load.destination_lng]
          : null;
      let destinationText = load.destination_label?.trim() || '';

      // Recover the buyer's original delivery details before geocoding, without asking the driver to fix the map.
      if (load.pre_order_id && (!destinationPoint || !destinationText)) {
        const { data, error } = await supabase
          .from('pre_orders')
          .select('location,destination_lat,destination_lng')
          .eq('id', load.pre_order_id)
          .maybeSingle();
        if (error) throw error;
        if (data) {
          if (typeof data.location === 'string' && data.location.trim()) destinationText = data.location.trim();
          const latitude = Number(data.destination_lat);
          const longitude = Number(data.destination_lng);
          if (data.destination_lat != null && data.destination_lng != null &&
              Number.isFinite(latitude) && Number.isFinite(longitude) &&
              Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180) {
            destinationPoint = [latitude, longitude];
          }
        }
      }

      const geocodeLabel = async (label: string): Promise<{ point: FreightCoordinate; label: string } | null> => {
        if (!label.trim()) return null;
        const { data, error } = await supabase.functions.invoke('geocoding-search', {
          body: { query: label.trim() },
        });
        if (error) throw error;
        const item = Array.isArray(data?.results) ? data.results.find((candidate: any) => {
          const latitude = Number(candidate?.lat);
          const longitude = Number(candidate?.lon);
          return Number.isFinite(latitude) && Number.isFinite(longitude) &&
            latitude >= -18.5 && latitude <= -4.2 && longitude >= 11.4 && longitude <= 24.2 &&
            typeof candidate?.display_name === 'string' && candidate.display_name.trim();
        }) : null;
        if (!item) return null;
        return { point: [Number(item.lat), Number(item.lon)], label: String(item.display_name).trim() };
      };

      let resolvedOriginLabel = load.origin_label?.trim() || '';
      if (!originPoint) {
        const resolved = await geocodeLabel(resolvedOriginLabel);
        if (resolved) {
          originPoint = resolved.point;
          resolvedOriginLabel = resolvedOriginLabel || resolved.label;
        }
      }
      if (!destinationPoint) {
        const resolved = await geocodeLabel(destinationText);
        if (resolved) {
          destinationPoint = resolved.point;
          destinationText = destinationText || resolved.label;
        }
      }

      if (!originPoint || !destinationPoint) {
        toast.error('Não foi possível localizar automaticamente a origem ou o destino. Confirme se o endereço do comprador está completo.');
        return;
      }

      // Persist coordinates recovered from the buyer's saved address, so the map and later tracking use the same route.
      if (
        load.origin_lat !== originPoint[0] || load.origin_lng !== originPoint[1] ||
        load.destination_lat !== destinationPoint[0] || load.destination_lng !== destinationPoint[1]
      ) {
        const { error } = await supabase.rpc('set_freight_load_route_details' as never, {
          p_freight_load_id: load.id,
          p_origin_lat: originPoint[0],
          p_origin_lng: originPoint[1],
          p_destination_lat: destinationPoint[0],
          p_destination_lng: destinationPoint[1],
          p_destination_label: (destinationText || load.destination_label || 'Destino do comprador').slice(0, 180),
        } as never);
        if (error) throw error;
      }

      const route = await calculateFreightRoute(originPoint, destinationPoint);
      const { error } = await supabase.rpc('submit_freight_quote', {
        p_freight_load_id: load.id,
        p_price_method: 'suggested',
        p_manual_price: null as unknown as number,
        p_route_distance_km: route.distanceKm,
        p_route_duration_minutes: route.durationMinutes,
      });
      if (error) throw error;
      toast.success('Carga aceite. O preço de transporte foi enviado ao comprador para aprovação.');
      await fetchLoads();
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível aceitar a carga e calcular o frete.');
    } finally { setBusyId(null); }
  };

  const openRouteSetup = async (load: FreightLoad) => {
    setRouteSetupLoadId(load.id);
    setRouteSetupOrigin(load.origin_lat == null || load.origin_lng == null ? null : [load.origin_lat, load.origin_lng]);
    setRouteSetupDestination(load.destination_lat == null || load.destination_lng == null ? null : [load.destination_lat, load.destination_lng]);
    setRouteSetupSelection(load.origin_lat == null || load.origin_lng == null ? 'origin' : 'destination');

    const suggestions: RouteLocationSuggestion[] = loads.flatMap((item) => {
      const points: RouteLocationSuggestion[] = [];
      if (item.origin_label?.trim()) points.push({
        label: item.origin_label.trim(),
        point: item.origin_lat != null && item.origin_lng != null ? [item.origin_lat, item.origin_lng] : null,
        source: 'mapa',
      });
      if (item.destination_label?.trim()) points.push({
        label: item.destination_label.trim(),
        point: item.destination_lat != null && item.destination_lng != null ? [item.destination_lat, item.destination_lng] : null,
        source: 'mapa',
      });
      return points;
    });

    let buyerDestination = load.destination_label?.trim() || '';
    let buyerPoint: FreightCoordinate | null = load.destination_lat != null && load.destination_lng != null
      ? [load.destination_lat, load.destination_lng]
      : null;
    if (load.pre_order_id) {
      const { data, error } = await supabase
        .from('pre_orders')
        .select('location,destination_lat,destination_lng')
        .eq('id', load.pre_order_id)
        .maybeSingle();
      if (!error && data) {
        if (typeof data.location === 'string' && data.location.trim()) buyerDestination = data.location.trim();
        if (data.destination_lat != null && data.destination_lng != null) {
          buyerPoint = [Number(data.destination_lat), Number(data.destination_lng)];
          setRouteSetupDestination(buyerPoint);
        }
      }
    }
    if (buyerDestination) suggestions.unshift({ label: buyerDestination, point: buyerPoint, source: 'pre-compra' });
    const uniqueSuggestions = suggestions.filter((item, index, all) =>
      all.findIndex((candidate) => candidate.label.toLocaleLowerCase('pt-AO') === item.label.toLocaleLowerCase('pt-AO')) === index
    );
    setRouteSetupSuggestions(uniqueSuggestions);
    setRouteSetupGeocodedSuggestions([]);
    setRouteSetupDestinationLabel(buyerDestination);
    setRouteSetupDestinationSearch(buyerDestination);
  };

  const saveRouteCoordinates = async (load: FreightLoad) => {
    if (!requireAct('confirmar a rota GPS da carga')) return;
    if (!routeSetupOrigin || !routeSetupDestination) {
      toast.error('Marque a origem e o destino reais no mapa.');
      return;
    }
    setBusyId(load.id);
    const { error } = await supabase.rpc('set_freight_load_route_details' as never, {
      p_freight_load_id: load.id,
      p_origin_lat: routeSetupOrigin[0],
      p_origin_lng: routeSetupOrigin[1],
      p_destination_lat: routeSetupDestination[0],
      p_destination_lng: routeSetupDestination[1],
      p_destination_label: routeSetupDestinationLabel.trim() || load.destination_label,
    } as never);
    setBusyId(null);
    if (error) {
      toast.error(error.message || 'Não foi possível guardar as coordenadas GPS.');
      return;
    }
    setRouteSetupLoadId(null);
    toast.success('Rota GPS guardada. Já pode calcular e propor o frete.');
    await fetchLoads();
  };

  const accept = async (load: FreightLoad) => {
    const driverId = user?.id;
    if (!driverId) {
      toast.error('Inicie sessão para aceitar esta carga.');
      return;
    }
    if (!requireAct('aceitar uma carga')) return;
    if (capacity && load.weight_kg > capacity) {
      toast.error(`Carga acima da sua capacidade (${capacity} kg).`);
      return;
    }
    setBusyId(load.id);
    const { error } = await supabase.rpc('accept_freight_load', { p_freight_load_id: load.id });
    setBusyId(null);
    if (error) {
      toast.error(error.message || 'Não foi possível aceitar esta carga.');
      return;
    }
    toast.success('Carga aceite. O GPS pode acompanhar o percurso até ao fornecedor; a viagem com a mercadoria só começa após a confirmação da entrega pelo fornecedor.');
    void showLoadRoute({ ...load, status: 'accepted', driver_id: driverId });
    startLocationSharing({ ...load, status: 'accepted', driver_id: driverId });
    await fetchLoads();
  };

  const advance = async (load: FreightLoad) => {
    if (!requireAct('actualizar a carga')) return;
    if (load.driver_id !== user?.id) {
      toast.error('Só o motorista atribuído pode atualizar esta carga.');
      return;
    }
    const nextStatus = load.status === 'accepted' ? 'at_pickup' : load.status === 'at_pickup' ? 'in_transit' : 'delivered';
    setBusyId(load.id);
    const { error } = await supabase.rpc('advance_freight_load_status', { p_freight_load_id: load.id, p_status: nextStatus });
    setBusyId(null);
    if (error) {
      toast.error(error?.message || 'Não foi possível actualizar.');
      return;
    }
    if (nextStatus === 'delivered' && sharingLocationFor === load.id) stopLocationSharing();
    if (nextStatus === 'in_transit' && sharingLocationFor !== load.id) startLocationSharing({ ...load, status: 'in_transit' });
    await fetchLoads();
  };

  const confirmSupplierHandover = async (load: FreightLoad) => {
    if (!requireAct('confirmar a entrega da mercadoria ao motorista')) return;
    if (!user?.id || load.supplier_id !== user.id || load.status !== 'at_pickup') {
      toast.error('Só o fornecedor desta carga pode confirmar a entrega da mercadoria no ponto de recolha.');
      return;
    }
    if (load.supplier_handover_confirmed_at) {
      toast.info('A entrega ao motorista já foi confirmada.');
      return;
    }
    setBusyId(load.id);
    const { error } = await supabase.rpc('confirm_supplier_handover', { p_freight_load_id: load.id });
    setBusyId(null);
    if (error) {
      toast.error(error.message || 'Não foi possível confirmar a entrega da mercadoria ao motorista.');
      return;
    }
    toast.success('Entrega ao motorista confirmada. O motorista já pode iniciar a viagem.');
    await fetchLoads();
  };

  const confirmBuyerReceipt = async (load: FreightLoad) => {
    if (!requireAct('confirmar o recebimento da encomenda')) return;
    if (!user?.id || load.buyer_id !== user.id || load.status !== 'delivered') {
      toast.error('Só o comprador desta encomenda pode confirmar o recebimento após a entrega do motorista.');
      return;
    }
    if (load.buyer_receipt_confirmed_at) {
      toast.info('O recebimento desta encomenda já foi confirmado.');
      return;
    }
    setBusyId(load.id);
    const { error } = await supabase.rpc('confirm_freight_receipt', { p_freight_load_id: load.id });
    setBusyId(null);
    if (error) {
      toast.error(error.message || 'Não foi possível confirmar o recebimento.');
      return;
    }
    toast.success('Recebimento confirmado. A encomenda foi registada como recebida.');
    await fetchLoads();
  };

  const visible = loads.filter((load) => {
    if (tab === 'minhas') return load.driver_id === user?.id || load.created_by === user?.id || load.buyer_id === user?.id || load.supplier_id === user?.id;
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
              {key === 'disponiveis' ? 'Disponíveis' : 'As minhas cargas e compras'}
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
                ? 'Ainda não tem cargas, compras ou entregas.'
                : 'Sem cargas disponíveis de momento.'}
            </p>
          </div>
        )}

        {!loading &&
          visible.map((load) => {
            const tooHeavy = !!capacity && load.weight_kg > capacity;
            const isAssignedDriver = load.driver_id === user?.id;
            const isBuyer = load.buyer_id === user?.id;
            const isSupplier = load.supplier_id === user?.id;
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
                    onClick={() => void downloadFreightLoadPdf(load)}
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
                  {['accepted', 'at_pickup', 'in_transit'].includes(load.status) && isAssignedDriver && (
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
                    {['accepted', 'at_pickup', 'in_transit'].includes(load.status) && latestDriverLocation && (
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

                {tab === 'disponiveis' && !hasCoordinates && (
                  <section style={{ marginTop: 12, padding: 12, border: `1px solid ${T.rule}`, borderRadius: 12, display: 'grid', gap: 8 }}>
                    <p style={{ margin: 0, fontSize: 12, color: T.mid, lineHeight: 1.5 }}>
                      Esta pré-compra não tem a rota GPS completa. Pode pesquisar locais já usados no mapa ou recuperar o destino original informado pelo comprador. Confirme a posição real no mapa antes de guardar.
                    </p>
                    <div style={{ display: 'grid', gap: 4, fontSize: 12, color: T.ink }}>
                      <div><strong>Recolha:</strong> {load.origin_label}</div>
                      <div><strong>Destino registado:</strong> {load.destination_label}</div>
                    </div>
                    {routeSetupLoadId !== load.id ? (
                      <button type="button" onClick={() => void openRouteSetup(load)} style={{ padding: '10px 12px', border: `1px solid ${T.green}`, borderRadius: 10, background: T.white, color: T.green, fontFamily: FONT, fontWeight: 800, cursor: 'pointer' }}>
                        Corrigir rota GPS
                      </button>
                    ) : (
                      <>
                        <label style={{ display: 'grid', gap: 6, fontSize: 12, color: T.ink, fontWeight: 800 }}>
                          Pesquisar ponto de entrega
                          <div style={{ position: 'relative' }}>
                            <Search size={15} style={{ position: 'absolute', left: 10, top: 13, color: T.muted }} />
                            <input
                              value={routeSetupDestinationSearch}
                              onChange={(event) => {
                                const value = event.target.value;
                                setRouteSetupDestinationSearch(value);
                                setRouteSetupDestinationLabel(value);
                                setRouteSetupDestination(null);
                              }}
                              placeholder="Pesquisar localizações do mapa ou destino da pré-compra"
                              style={{ ...formInputStyle, paddingLeft: 32 }}
                              maxLength={180}
                              aria-label="Pesquisar ponto de entrega"
                              aria-autocomplete="list"
                            />
                          </div>
                        </label>
                        <div role="listbox" aria-label="Sugestões de pontos de entrega" style={{ display: 'grid', gap: 4, maxHeight: 180, overflowY: 'auto' }}>
                          {([...routeSetupGeocodedSuggestions, ...routeSetupSuggestions])
                            .filter((item) => !routeSetupDestinationSearch.trim() || item.label.toLocaleLowerCase('pt-AO').includes(routeSetupDestinationSearch.trim().toLocaleLowerCase('pt-AO')))
                            .slice(0, 8)
                            .map((item, index) => (
                              <button
                                key={item.source + item.label + index}
                                type="button"
                                role="option"
                                onClick={() => {
                                  setRouteSetupDestinationLabel(item.label);
                                  setRouteSetupDestinationSearch(item.label);
                                  if (item.point) setRouteSetupDestination(item.point);
                                  else setRouteSetupDestination(null);
                                  setRouteSetupSelection('destination');
                                }}
                                style={{ textAlign: 'left', padding: '9px 10px', border: `1px solid ${T.rule}`, borderRadius: 8, background: routeSetupDestinationLabel === item.label ? T.g50 : T.white, color: T.ink, cursor: 'pointer', fontFamily: FONT, fontSize: 12 }}
                              >
                                <span style={{ display: 'block', fontWeight: 800 }}>{item.label}</span>
                                <span style={{ display: 'block', marginTop: 3, color: T.muted, fontSize: 10 }}>{item.source === 'geocoding' ? 'Resultado geográfico · ajuste o ponto exacto no mapa' : item.source === 'pre-compra' ? 'Localização original do comprador' : item.point ? 'Local já marcado no mapa · coordenadas disponíveis' : 'Local registado sem coordenadas GPS'}</span>
                              </button>
                            ))}
                          {([...routeSetupGeocodedSuggestions, ...routeSetupSuggestions]).filter((item) => !routeSetupDestinationSearch.trim() || item.label.toLocaleLowerCase('pt-AO').includes(routeSetupDestinationSearch.trim().toLocaleLowerCase('pt-AO'))).length === 0 && !routeSetupSearchingPlaces && (
                            <p style={{ margin: 0, padding: 8, fontSize: 11, color: T.muted }}>Sem sugestões correspondentes. Pode continuar a escrever o nome do local e marcar o ponto exacto no mapa.</p>
                          )}
                          {routeSetupSearchingPlaces && <p style={{ margin: 0, padding: 8, fontSize: 11, color: T.muted }}>A pesquisar locais em Angola…</p>}
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button type="button" onClick={() => setRouteSetupSelection('origin')} style={{ flex: 1, padding: 8, borderRadius: 8, border: `1px solid ${T.rule}`, background: routeSetupSelection === 'origin' ? T.g50 : T.white, color: T.green, fontFamily: FONT, fontWeight: 800 }}>
                            {routeSetupOrigin ? 'Alterar origem' : 'Marcar origem'}
                          </button>
                          <button type="button" onClick={() => setRouteSetupSelection('destination')} style={{ flex: 1, padding: 8, borderRadius: 8, border: `1px solid ${T.rule}`, background: routeSetupSelection === 'destination' ? T.g50 : T.white, color: T.green, fontFamily: FONT, fontWeight: 800 }}>
                            {routeSetupDestination ? 'Alterar destino' : 'Marcar destino'}
                          </button>
                        </div>
                        <p style={{ margin: 0, fontSize: 11, color: T.muted }}>Os resultados da pesquisa ajudam a centrar o ponto, mas podem representar uma zona ampla. Ajuste sempre o marcador ao local exacto no mapa antes de guardar.</p>
                        <div style={{ overflow: 'hidden', border: `1px solid ${T.rule}`, borderRadius: 8 }}>
                          <FreightRouteMap
                            origin={routeSetupOrigin}
                            destination={routeSetupDestination}
                            activeSelection={routeSetupSelection}
                            onSelectPoint={(coordinate) => {
                              if (routeSetupSelection === 'origin') {
                                setRouteSetupOrigin(coordinate);
                              } else {
                                setRouteSetupDestination(coordinate);
                                if (!routeSetupDestinationLabel.trim()) setRouteSetupDestinationLabel(formatCoordinateLabel(coordinate));
                              }
                            }}
                            height={250}
                          />
                        </div>
                        <div style={{ display: 'grid', gap: 4, fontSize: 12, color: T.ink }}>
                          <div><strong>Destino seleccionado:</strong> {routeSetupDestinationLabel || 'Ainda não definido'}</div>
                          <div><strong>Coordenadas:</strong> {routeSetupDestination ? formatCoordinateLabel(routeSetupDestination) : 'Por confirmar no mapa'}</div>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button type="button" onClick={() => setRouteSetupLoadId(null)} style={{ flex: 1, padding: 10, border: `1px solid ${T.rule}`, borderRadius: 8, background: T.white, color: T.mid, fontFamily: FONT, fontWeight: 800 }}>Cancelar</button>
                          <button type="button" disabled={busyId === load.id || !routeSetupOrigin || !routeSetupDestination} onClick={() => void saveRouteCoordinates(load)} style={{ flex: 1, padding: 10, border: 'none', borderRadius: 8, background: T.green, color: T.white, fontFamily: FONT, fontWeight: 800, opacity: !routeSetupOrigin || !routeSetupDestination ? 0.5 : 1 }}>
                            {busyId === load.id ? 'A guardar…' : 'Guardar rota GPS'}
                          </button>
                        </div>
                      </>
                    )}
                  </section>
                )}

{tab === 'disponiveis' ? (
                  <button
                    disabled={busyId === load.id || tooHeavy}
                    onClick={() => load.pre_order_id ? void submitQuote(load) : void accept(load)}
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
                      ? (load.pre_order_id ? 'A aceitar e calcular frete…' : 'A aceitar…')
                      : tooHeavy
                        ? 'Capacidade insuficiente'
                        : load.pre_order_id ? 'Aceitar carga e propor frete' : 'Aceitar carga'}
                  </button>
                ) : isAssignedDriver && load.status === 'accepted' ? (
                  <div style={{ display: 'grid', gap: 8, marginTop: 14 }}>
                    <button
                      type="button"
                      onClick={() => {
                        if (load.origin_lat == null || load.origin_lng == null) {
                          toast.error('Esta carga não tem coordenadas GPS de recolha.');
                          return;
                        }
                        const url = `https://www.google.com/maps/dir/?api=1&destination=${load.origin_lat},${load.origin_lng}&travelmode=driving`;
                        window.open(url, '_blank', 'noopener,noreferrer');
                      }}
                      style={{
                        width: '100%', padding: '11px 14px', borderRadius: 12,
                        border: `1px solid ${T.rule}`, background: T.white, color: T.green,
                        fontFamily: FONT, fontSize: 13, fontWeight: 800, cursor: 'pointer',
                      }}
                    >
                      <Navigation size={15} style={{ verticalAlign: 'middle', marginRight: 7 }} />
                      Navegar até à recolha
                    </button>
                    <button
                      disabled={busyId === load.id}
                      onClick={() => void advance(load)}
                      style={{
                        width: '100%', padding: '12px 16px', borderRadius: 12,
                        border: 'none', background: T.green, color: T.white,
                        fontFamily: FONT, fontSize: 14, fontWeight: 800, cursor: 'pointer',
                      }}
                    >
                      {busyId === load.id ? 'A actualizar…' : 'Confirmar chegada à recolha'}
                    </button>
                  </div>
                 ) : isAssignedDriver && load.status === 'at_pickup' ? (
                  <button
                    disabled={busyId === load.id || !load.supplier_handover_confirmed_at}
                    onClick={() => void advance(load)}
                    style={{
                      marginTop: 14, width: '100%', padding: '12px 16px',
                      borderRadius: 14, border: 'none', background: load.supplier_handover_confirmed_at ? T.green : T.rule,
                      color: load.supplier_handover_confirmed_at ? T.white : T.mid, fontFamily: FONT, fontSize: 14,
                      fontWeight: 800, cursor: load.supplier_handover_confirmed_at ? 'pointer' : 'not-allowed',
                    }}
                  >
                    {busyId === load.id ? 'A iniciar viagem…' : load.supplier_handover_confirmed_at ? 'Confirmar que recebi a carga · iniciar viagem' : 'A aguardar confirmação do fornecedor'}
                  </button>
                ) : isAssignedDriver && load.status === 'in_transit' ? (
                  <button
                    disabled={busyId === load.id}
                    onClick={() => void advance(load)}
                    style={{
                      marginTop: 14, width: '100%', padding: '12px 16px',
                      borderRadius: 14, border: `1.5px solid ${T.green}`,
                      background: T.white, color: T.green, fontFamily: FONT,
                      fontSize: 14, fontWeight: 800, cursor: 'pointer',
                    }}
                  >
                    {busyId === load.id ? 'A confirmar entrega…' : 'Confirmar entrega ao comprador'}
                  </button>
                ) : isSupplier && load.status === 'at_pickup' ? (
                  <section aria-label="Confirmação de entrega do fornecedor" style={{ display: 'grid', gap: 8, marginTop: 14, padding: 12, border: '1px solid #d5ded8', borderRadius: 12, background: '#f6faf7' }}>
                    <strong style={{ color: T.ink, fontSize: 13 }}>Entrega da mercadoria ao motorista</strong>
                    {load.supplier_handover_confirmed_at ? (
                      <p style={{ margin: 0, color: T.green, fontSize: 12, fontWeight: 800 }}>Entrega confirmada em {new Date(load.supplier_handover_confirmed_at).toLocaleString('pt-AO')}.</p>
                    ) : (
                      <>
                        <p style={{ margin: 0, color: T.mid, fontSize: 12, lineHeight: 1.5 }}>Confirme apenas depois de entregar fisicamente os produtos ao motorista. A viagem só poderá começar após esta confirmação.</p>
                        <button type="button" disabled={busyId === load.id} onClick={() => void confirmSupplierHandover(load)} style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: 'none', background: T.green, color: T.white, fontFamily: FONT, fontSize: 14, fontWeight: 800, cursor: 'pointer' }}>
                          {busyId === load.id ? 'A confirmar entrega…' : 'Confirmar entrega ao motorista'}
                        </button>
                      </>
                    )}
                  </section>
                ) : isBuyer && load.status === 'delivered' ? (
                  <section aria-label="Confirmação de recebimento" style={{ display: 'grid', gap: 8, marginTop: 14, padding: 12, border: '1px solid #d5ded8', borderRadius: 12, background: '#f6faf7' }}>
                    <strong style={{ color: T.ink, fontSize: 13 }}>Confirmação de recebimento</strong>
                    {load.buyer_receipt_confirmed_at ? (
                      <p style={{ margin: 0, color: T.green, fontSize: 12, fontWeight: 800 }}>
                        Recebimento confirmado em {new Date(load.buyer_receipt_confirmed_at).toLocaleString('pt-AO')}.
                      </p>
                    ) : (
                      <>
                        <p style={{ margin: 0, color: T.mid, fontSize: 12, lineHeight: 1.5 }}>
                          O motorista marcou esta carga como entregue. Confirme apenas depois de verificar que recebeu os produtos.
                        </p>
                        <button type="button" disabled={busyId === load.id} onClick={() => void confirmBuyerReceipt(load)} style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: 'none', background: T.green, color: T.white, fontFamily: FONT, fontSize: 14, fontWeight: 800, cursor: busyId === load.id ? 'wait' : 'pointer', opacity: busyId === load.id ? 0.65 : 1 }}>
                          {busyId === load.id ? 'A confirmar recebimento…' : 'Confirmar que recebi a encomenda'}
                        </button>
                      </>
                    )}
                  </section>
                ) : null}
              </article>
            );
          })}
      </main>
    </div>
  );
};

export default ProximasCargas;
