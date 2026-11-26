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
import Loader from '../components/ui/Loader';

interface FreightLoad {
  id: string;
  vehicle_id?: string | null;
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
  driver_quote_status: string;
  driver_offered_price: number | null;
  buyer_quote_approved: boolean;
  supplier_quote_approved: boolean;
  notes: string | null;
  origin_lat: number | null;
  origin_lng: number | null;
  destination_lat: number | null;
  destination_lng: number | null;
  in_transit_at: string | null;
}

interface DriverVehicle {
  id: string;
  driver_id: string;
  vehicle_type: string;
  make: string;
  model: string;
  plate_number: string;
  color: string;
  manufacture_year: number | null;
  capacity_kg: number;
  condition_notes: string;
  brakes_ok: boolean;
  tires_ok: boolean;
  lights_ok: boolean;
  body_condition: 'good' | 'fair' | 'needs_attention';
  registration_document_number: string | null;
  inspection_valid_until: string | null;
  insurance_valid_until: string | null;
  maintenance_valid_until: string | null;
  verification_status: 'pending_review' | 'approved' | 'rejected';
  is_active: boolean;
}

interface DriverVehicleDraft {
  vehicle_type: string;
  make: string;
  model: string;
  plate_number: string;
  color: string;
  manufacture_year: string;
  capacity_kg: string;
  condition_notes: string;
  brakes_ok: boolean;
  tires_ok: boolean;
  lights_ok: boolean;
  body_condition: 'good' | 'fair' | 'needs_attention';
  registration_document_number: string;
  inspection_valid_until: string;
  insurance_valid_until: string;
  maintenance_valid_until: string;
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
  at_pickup: 'No local de recolha · confirmar carga',
  in_transit: 'Em trânsito · GPS',
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
  borderRadius: 12,
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
  const [quoteDraftLoadId, setQuoteDraftLoadId] = useState<string | null>(null);
  const [quotePriceMethod, setQuotePriceMethod] = useState<'suggested' | 'manual'>('suggested');
  const [driverVehicles, setDriverVehicles] = useState<DriverVehicle[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [driverLicenseReady, setDriverLicenseReady] = useState(false);
  const [driverLicenseChecked, setDriverLicenseChecked] = useState(false);
  const [deliveryCommitmentAccepted, setDeliveryCommitmentAccepted] = useState(false);
  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null);
  const [vehicleDraftLoadId, setVehicleDraftLoadId] = useState<string | null>(null);
  const [vehicleDraftAction, setVehicleDraftAction] = useState<'accept' | 'quote' | null>(null);
  const [showNewVehicle, setShowNewVehicle] = useState(false);
  const [savingVehicle, setSavingVehicle] = useState(false);
  const [vehicleDraft, setVehicleDraft] = useState<DriverVehicleDraft>({
    vehicle_type: 'Camião',
    make: '',
    model: '',
    plate_number: '',
    color: '',
    manufacture_year: '',
    capacity_kg: '',
    condition_notes: '',
    brakes_ok: false,
    tires_ok: false,
    lights_ok: false,
    body_condition: 'good',
    registration_document_number: '',
    inspection_valid_until: '',
    insurance_valid_until: '',
    maintenance_valid_until: '',
  });
  const [manualQuotePrice, setManualQuotePrice] = useState('');
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
  const pendingLocationRef = useRef<Record<string, FreightLoadLocation>>({});
  const onlineFlushHandlerRef = useRef<(() => void) | null>(null);
  const locationRetryNoticeShown = useRef(false);

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

  useEffect(() => {
    if (!user?.id || userProfile?.user_type !== 'motorista') {
      setDriverLicenseReady(false);
      setDriverLicenseChecked(true);
      return;
    }
    let active = true;
    setDriverLicenseChecked(false);
    void supabase
      .from('driver_licenses')
      .select('verification_status, issued_at, expires_at')
      .eq('driver_id', user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        const today = new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Africa/Luanda',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).format(new Date());
        setDriverLicenseReady(!error && Boolean(data) &&
          data!.verification_status !== 'rejected' &&
          data!.issued_at <= today &&
          data!.expires_at >= today);
        setDriverLicenseChecked(true);
      });
    return () => { active = false; };
  }, [user?.id, userProfile?.user_type]);


  useEffect(() => {
    if (!user?.id) {
      setDriverVehicles([]);
      setSelectedVehicleId('');
      return;
    }
    let active = true;
    void supabase
      .from('driver_vehicles')
      .select('*')
      .eq('driver_id', user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          console.warn('[AgriLink] Não foi possível carregar os veículos do motorista.', error);
          return;
        }
        const rows = (data || []) as DriverVehicle[];
        setDriverVehicles(rows);
        setSelectedVehicleId((current) => current || rows[0]?.id || '');
      });
    return () => { active = false; };
  }, [user?.id]);

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
    if (onlineFlushHandlerRef.current) {
      window.removeEventListener('online', onlineFlushHandlerRef.current);
      onlineFlushHandlerRef.current = null;
    }
    setSharingLocationFor(null);
  };

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
    locationRetryNoticeShown.current = false;
    setSharingLocationFor(load.id);

    const persistLocation = async (location: FreightLoadLocation) => {
      if (!navigator.onLine) {
        pendingLocationRef.current[load.id] = location;
        setDriverLocations((previous) => ({ ...previous, [load.id]: location }));
        return;
      }

      const { error } = await supabase.rpc('record_freight_load_location', {
        p_freight_load_id: load.id,
        p_latitude: location.latitude,
        p_longitude: location.longitude,
        p_accuracy_m: location.accuracy_m as number,
        p_speed_mps: location.speed_mps as number,
        p_heading_deg: location.heading_deg as number,
        p_record_history: true,
      });

      if (error) {
        if (error.code === '42501' || error.code === '22023') {
          toast.error('A partilha GPS foi recusada pelo servidor. Confirme que esta carga está atribuída a si e em trânsito.');
          stopLocationSharing();
          return;
        }
        pendingLocationRef.current[load.id] = location;
        setDriverLocations((previous) => ({ ...previous, [load.id]: location }));
        if (!locationRetryNoticeShown.current) {
          toast.error('Sem confirmação do servidor. A última posição será reenviada quando a ligação voltar.');
          locationRetryNoticeShown.current = true;
        }
        return;
      }

      delete pendingLocationRef.current[load.id];
      setDriverLocations((previous) => ({ ...previous, [load.id]: location }));
      if (locationRetryNoticeShown.current) {
        toast.success('Ligação restabelecida. A posição GPS voltou a ser sincronizada.');
        locationRetryNoticeShown.current = false;
      }
    };

    const flushPending = () => {
      const pending = pendingLocationRef.current[load.id];
      if (pending) void persistLocation(pending);
    };
    onlineFlushHandlerRef.current = flushPending;
    window.addEventListener('online', flushPending);

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
    if (!deliveryCommitmentAccepted) {
      toast.error('Confirma que tens disponibilidade para cumprir esta entrega e as restantes que aceitares.');
      return;
    }

    const selectedVehicle = driverVehicles.find((vehicle) => vehicle.id === selectedVehicleId && vehicle.is_active);
    if (!selectedVehicle) {
      setVehicleDraftLoadId(load.id);
      setVehicleDraftAction('quote');
      return;
    }
    if (selectedVehicle.capacity_kg < load.weight_kg) {
      toast.error('A capacidade do veículo selecionado é insuficiente para esta carga.');
      setVehicleDraftLoadId(load.id);
      setVehicleDraftAction('quote');
      return;
    }
    if (!selectedVehicle.brakes_ok || !selectedVehicle.tires_ok || !selectedVehicle.lights_ok || selectedVehicle.body_condition === 'needs_attention') {
      toast.error('Este veículo não está em condições de segurança para transporte.');
      setVehicleDraftLoadId(load.id);
      setVehicleDraftAction('quote');
      return;
    }
    const todayAngola = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Luanda', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    if (!selectedVehicle.maintenance_valid_until || selectedVehicle.maintenance_valid_until < todayAngola ||
      !selectedVehicle.inspection_valid_until || selectedVehicle.inspection_valid_until < todayAngola ||
      !selectedVehicle.insurance_valid_until || selectedVehicle.insurance_valid_until < todayAngola) {
      toast.error('Actualize a manutenção preventiva, a inspecção e o seguro do veículo antes de propor esta entrega.');
      setVehicleDraftLoadId(load.id);
      setVehicleDraftAction('quote');
      setEditingVehicleId(selectedVehicle.id);
      setVehicleDraft({ vehicle_type: selectedVehicle.vehicle_type, make: selectedVehicle.make, model: selectedVehicle.model,
        plate_number: selectedVehicle.plate_number, color: selectedVehicle.color, manufacture_year: selectedVehicle.manufacture_year?.toString() || '',
        capacity_kg: String(selectedVehicle.capacity_kg), condition_notes: selectedVehicle.condition_notes, brakes_ok: selectedVehicle.brakes_ok,
        tires_ok: selectedVehicle.tires_ok, lights_ok: selectedVehicle.lights_ok, body_condition: selectedVehicle.body_condition,
        registration_document_number: selectedVehicle.registration_document_number || '', inspection_valid_until: selectedVehicle.inspection_valid_until || '',
        insurance_valid_until: selectedVehicle.insurance_valid_until || '', maintenance_valid_until: selectedVehicle.maintenance_valid_until || '' });
      setShowNewVehicle(true);
      return;
    }
    if (quotePriceMethod === 'manual' && (!Number.isFinite(Number(manualQuotePrice)) || Number(manualQuotePrice) <= 0)) {
      toast.error('Introduza um preço de transporte válido em Kz.');
      return;
    }
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
      if (route.originSnapDistanceKm > 25 || route.destinationSnapDistanceKm > 25) {
        throw new Error('A estrada mais próxima está a mais de 25 km de um dos pontos GPS. Corrija a localização da recolha ou do destino antes de enviar a proposta.');
      }
      const { error } = await supabase.rpc('submit_freight_quote' as never, {
        p_freight_load_id: load.id,
        p_price_method: quotePriceMethod,
        p_manual_price: quotePriceMethod === 'manual' ? Number(manualQuotePrice) : null as unknown as number,
        p_route_distance_km: route.distanceKm,
        p_route_duration_minutes: route.durationMinutes,
        p_vehicle_id: selectedVehicle.id,
        p_snapped_origin_lat: route.snappedOrigin[0],
        p_snapped_origin_lng: route.snappedOrigin[1],
        p_snapped_destination_lat: route.snappedDestination[0],
        p_snapped_destination_lng: route.snappedDestination[1],
      } as never);
      if (error) throw error;
      setDriverDailyLoadStatus('limit_reached');
      toast.success('Proposta enviada ao comprador. O pagamento só será liberado depois da aprovação do preço.');
      setQuoteDraftLoadId(null);
      setManualQuotePrice('');
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
    if (!requireAct('aceitar uma carga')) return;

    setDeliveryCommitmentAccepted(false);
    setEditingVehicleId(null);
    setVehicleDraftLoadId(load.id);
    setVehicleDraftAction('accept');
    setShowNewVehicle(false);
  };

  const confirmVehicleForLoad = async () => {
    if (!vehicleDraftLoadId || !vehicleDraftAction || !user?.id) return;
    if (!deliveryCommitmentAccepted) {
      toast.error('Confirma que tens disponibilidade para cumprir todas as entregas que aceitares.');
      return;
    }
    setSavingVehicle(true);
    try {
      let vehicleId = selectedVehicleId;
      let savedVehicle: DriverVehicle | null = null;
      if (showNewVehicle || driverVehicles.length === 0) {
        const plate = vehicleDraft.plate_number.trim().toUpperCase();
        const capacityKg = Number(vehicleDraft.capacity_kg);
        const todayAngola = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Luanda', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
        if (!vehicleDraft.vehicle_type.trim() || !vehicleDraft.make.trim() ||
          !vehicleDraft.model.trim() || !plate || !vehicleDraft.color.trim() ||
          !Number.isFinite(capacityKg) || capacityKg <= 0 ||
          vehicleDraft.condition_notes.trim().length < 10 ||
          !vehicleDraft.maintenance_valid_until || vehicleDraft.maintenance_valid_until < todayAngola ||
          !vehicleDraft.inspection_valid_until || vehicleDraft.inspection_valid_until < todayAngola ||
          !vehicleDraft.insurance_valid_until || vehicleDraft.insurance_valid_until < todayAngola) {
          toast.error('Preencha os dados do veículo e indique manutenção preventiva, inspecção e seguro válidos.');
          return;
        }
        if (!vehicleDraft.brakes_ok || !vehicleDraft.tires_ok || !vehicleDraft.lights_ok ||
          vehicleDraft.body_condition === 'needs_attention') {
          toast.error('O veículo não pode ser usado enquanto travões, pneus, iluminação ou carroçaria apresentarem problemas.');
          return;
        }
        const vehiclePayload = {
          vehicle_type: vehicleDraft.vehicle_type.trim(),
          make: vehicleDraft.make.trim(),
          model: vehicleDraft.model.trim(),
          plate_number: plate,
          color: vehicleDraft.color.trim(),
          manufacture_year: vehicleDraft.manufacture_year ? Number(vehicleDraft.manufacture_year) : null,
          capacity_kg: capacityKg,
          condition_notes: vehicleDraft.condition_notes.trim(),
          brakes_ok: vehicleDraft.brakes_ok,
          tires_ok: vehicleDraft.tires_ok,
          lights_ok: vehicleDraft.lights_ok,
          body_condition: vehicleDraft.body_condition,
          registration_document_number: vehicleDraft.registration_document_number.trim() || null,
          inspection_valid_until: vehicleDraft.inspection_valid_until,
          insurance_valid_until: vehicleDraft.insurance_valid_until,
          maintenance_valid_until: vehicleDraft.maintenance_valid_until,
        };
        const vehicleResult = editingVehicleId
          ? await (supabase as any).from('driver_vehicles').update(vehiclePayload).eq('id', editingVehicleId).eq('driver_id', user.id).select('*').single()
          : await supabase.from('driver_vehicles').insert({ driver_id: user.id, ...vehiclePayload }).select('*').single();
        if (vehicleResult.error) throw vehicleResult.error;
        savedVehicle = vehicleResult.data as DriverVehicle;
        vehicleId = savedVehicle.id;
        setDriverVehicles((previous) => editingVehicleId
          ? previous.map((vehicle) => vehicle.id === savedVehicle!.id ? savedVehicle! : vehicle)
          : [savedVehicle!, ...previous]);
        setSelectedVehicleId(savedVehicle.id);
      }
      const chosen = savedVehicle || driverVehicles.find((vehicle) => vehicle.id === vehicleId) ||
        (vehicleId ? ({ ...vehicleDraft, id: vehicleId, capacity_kg: Number(vehicleDraft.capacity_kg) } as unknown as DriverVehicle) : null);
      if (!vehicleId || (!showNewVehicle && !chosen)) {
        toast.error('Selecione um veículo ou registe um novo veículo.');
        return;
      }
      const todayAngola = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Luanda', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
      if (chosen && (!chosen.brakes_ok || !chosen.tires_ok || !chosen.lights_ok || chosen.body_condition === 'needs_attention')) {
        toast.error('O veículo selecionado não cumpre os requisitos mínimos de segurança.');
        return;
      }
      if (chosen && (!chosen.maintenance_valid_until || chosen.maintenance_valid_until < todayAngola ||
        !chosen.inspection_valid_until || chosen.inspection_valid_until < todayAngola ||
        !chosen.insurance_valid_until || chosen.insurance_valid_until < todayAngola)) {
        if (!showNewVehicle) {
          setEditingVehicleId(chosen.id);
          setVehicleDraft({ vehicle_type: chosen.vehicle_type, make: chosen.make, model: chosen.model,
            plate_number: chosen.plate_number, color: chosen.color, manufacture_year: chosen.manufacture_year?.toString() || '',
            capacity_kg: String(chosen.capacity_kg), condition_notes: chosen.condition_notes, brakes_ok: chosen.brakes_ok,
            tires_ok: chosen.tires_ok, lights_ok: chosen.lights_ok, body_condition: chosen.body_condition,
            registration_document_number: chosen.registration_document_number || '',
            inspection_valid_until: chosen.inspection_valid_until || '', insurance_valid_until: chosen.insurance_valid_until || '',
            maintenance_valid_until: chosen.maintenance_valid_until || '' });
          setShowNewVehicle(true);
        }
        toast.error('Actualize a manutenção preventiva, a inspecção e o seguro do veículo antes de aceitar esta carga.');
        return;
      }
      const selectedCapacity = Number(chosen?.capacity_kg ?? vehicleDraft.capacity_kg);
      if (selectedCapacity < (loads.find((load) => load.id === vehicleDraftLoadId)?.weight_kg || 0)) {
        toast.error('A capacidade do veículo é inferior ao peso desta carga.');
        return;
      }
      if (vehicleDraftAction === 'accept') {
        const load = loads.find((item) => item.id === vehicleDraftLoadId);
        if (!load) throw new Error('Carga já não encontrada. Atualize a lista e tente novamente.');
        setBusyId(load.id);
        const { error } = await supabase.rpc('accept_freight_load' as never, {
          p_freight_load_id: load.id,
          p_vehicle_id: vehicleId,
        } as never);
        setBusyId(null);
        if (error) throw error;
        toast.success('Carga aceite com o veículo registado.');
        await fetchLoads();
      } else {
        toast.success('Veículo associado ao seu perfil. Já pode enviar a proposta de transporte.');
      }
      setVehicleDraftLoadId(null);
      setVehicleDraftAction(null);
      setShowNewVehicle(false);
      setEditingVehicleId(null);
      setDeliveryCommitmentAccepted(false);
    } catch (error: any) {
      setBusyId(null);
      toast.error(error?.message || 'Não foi possível guardar os dados do veículo.');
    } finally {
      setSavingVehicle(false);
    }
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
    if (nextStatus === 'in_transit') startLocationSharing({ ...load, status: 'in_transit' });
    await fetchLoads();
  };

  const selectedVehicleSummary = driverVehicles.find((vehicle) => vehicle.id === selectedVehicleId && vehicle.is_active);
  const activeDriverCommitments = loads.filter((load) => load.driver_id === user?.id && !['delivered', 'cancelled'].includes(load.status)).length;

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
            {selectedVehicleSummary
              ? `Veículo: ${selectedVehicleSummary.make} ${selectedVehicleSummary.model} · ${new Intl.NumberFormat('pt-AO').format(selectedVehicleSummary.capacity_kg)} kg`
              : 'Registe um veículo para começar a aceitar cargas'}
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
            borderRadius: 12,
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

      {driverLicenseChecked && userProfile?.user_type === 'motorista' && !driverLicenseReady && (
        <div style={{ margin: '12px 16px 0', padding: '13px 14px', border: '1px solid #F59E0B55', borderRadius: 12, background: '#FFFBEB', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0 }}>
            <strong style={{ display: 'block', color: '#92400E', fontSize: 13 }}>Carta de condução em falta ou inválida</strong>
            <span style={{ color: '#92400E', fontSize: 11 }}>Actualiza os dados da tua carta no perfil para poderes aceitar cargas e propor fretes.</span>
          </div>
          <button type="button" onClick={() => navigate('/perfil')} style={{ border: 0, borderRadius: 9, background: '#92400E', color: '#FFFFFF', padding: '9px 12px', fontSize: 12, fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            Completar perfil
          </button>
        </div>
      )}

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
                borderRadius: 12,
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
            borderRadius: 12,
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
                          borderRadius: 12,
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
                <div style={{ overflow: 'hidden', border: `1px solid ${T.rule}`, borderRadius: 12 }}>
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
                  borderRadius: 12,
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

      <main className="grid grid-cols-1 gap-3 px-4 lg:grid-cols-2" style={{ paddingBottom: 16 }}>
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
              borderRadius: 12,
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
            const selectedVehicle = driverVehicles.find((vehicle) => vehicle.id === selectedVehicleId && vehicle.is_active);
            const capacityUnavailable = !selectedVehicle;
            const tooHeavy = Boolean(selectedVehicle && load.weight_kg > Number(selectedVehicle.capacity_kg));
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
                  borderRadius: 12,
                  padding: 16,
                  boxShadow: `0 6px 20px ${T.shadow}`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 12,
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
                      borderRadius: 12,
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
                        borderRadius: 12,
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
                        borderRadius: 12,
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
                      style={{ overflow: 'hidden', border: `1px solid ${T.rule}`, borderRadius: 12 }}
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
                      <button type="button" onClick={() => void openRouteSetup(load)} style={{ padding: '10px 12px', border: `1px solid ${T.green}`, borderRadius: 12, background: T.white, color: T.green, fontFamily: FONT, fontWeight: 800, cursor: 'pointer' }}>
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
                                style={{ textAlign: 'left', padding: '9px 10px', border: `1px solid ${T.rule}`, borderRadius: 12, background: routeSetupDestinationLabel === item.label ? T.g50 : T.white, color: T.ink, cursor: 'pointer', fontFamily: FONT, fontSize: 12 }}
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
                          <button type="button" onClick={() => setRouteSetupSelection('origin')} style={{ flex: 1, padding: 8, borderRadius: 12, border: `1px solid ${T.rule}`, background: routeSetupSelection === 'origin' ? T.g50 : T.white, color: T.green, fontFamily: FONT, fontWeight: 800 }}>
                            {routeSetupOrigin ? 'Alterar origem' : 'Marcar origem'}
                          </button>
                          <button type="button" onClick={() => setRouteSetupSelection('destination')} style={{ flex: 1, padding: 8, borderRadius: 12, border: `1px solid ${T.rule}`, background: routeSetupSelection === 'destination' ? T.g50 : T.white, color: T.green, fontFamily: FONT, fontWeight: 800 }}>
                            {routeSetupDestination ? 'Alterar destino' : 'Marcar destino'}
                          </button>
                        </div>
                        <p style={{ margin: 0, fontSize: 11, color: T.muted }}>Os resultados da pesquisa ajudam a centrar o ponto, mas podem representar uma zona ampla. Ajuste sempre o marcador ao local exacto no mapa antes de guardar.</p>
                        <div style={{ overflow: 'hidden', border: `1px solid ${T.rule}`, borderRadius: 12 }}>
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
                          <button type="button" onClick={() => setRouteSetupLoadId(null)} style={{ flex: 1, padding: 10, border: `1px solid ${T.rule}`, borderRadius: 12, background: T.white, color: T.mid, fontFamily: FONT, fontWeight: 800 }}>Cancelar</button>
                          <button type="button" disabled={busyId === load.id || !routeSetupOrigin || !routeSetupDestination} onClick={() => void saveRouteCoordinates(load)} style={{ flex: 1, padding: 10, border: 'none', borderRadius: 12, background: T.green, color: T.white, fontFamily: FONT, fontWeight: 800, opacity: !routeSetupOrigin || !routeSetupDestination ? 0.5 : 1 }}>
                            {busyId === load.id ? 'A guardar…' : 'Guardar rota GPS'}
                          </button>
                        </div>
                      </>
                    )}
                  </section>
                )}

{(tab === 'disponiveis' && Boolean(load.pre_order_id)) || (tab === 'minhas' && isAssignedDriver && load.status === 'accepted' && load.driver_quote_status === 'rejected') ? (
                  <section style={{ marginTop: 14, display: 'grid', gap: 10, padding: 12, border: `1px solid ${T.rule}`, borderRadius: 12, background: T.canvas }}>
                    {quoteDraftLoadId !== load.id ? (
                      <>
                        {load.driver_quote_status === 'rejected' && load.driver_offered_price != null && (
                          <p style={{ margin: 0, fontSize: 12, color: T.danger }}>A proposta anterior de {money(load.driver_offered_price, load.currency)} foi recusada. Podes rever o preço e enviar outra proposta.</p>
                        )}
                        <button
                          type="button"
                          disabled={busyId === load.id}
                          onClick={() => { setDeliveryCommitmentAccepted(false); setEditingVehicleId(null); setQuoteDraftLoadId(load.id); setQuotePriceMethod('suggested'); setManualQuotePrice(''); setVehicleDraftLoadId(load.id); setVehicleDraftAction('quote'); setShowNewVehicle(false); }}
                          style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: 'none', background: tooHeavy ? T.rule : T.green, color: tooHeavy ? T.muted : T.white, fontFamily: FONT, fontSize: 14, fontWeight: 800, cursor: 'pointer' }}
                        >
                          {capacityUnavailable ? 'Regista ou selecciona o veículo' : tooHeavy ? 'Capacidade insuficiente' : load.driver_quote_status === 'rejected' ? 'Rever preço e enviar proposta' : 'Propor preço do transporte'}
                        </button>
                      </>
                    ) : (
                      <>
                        <div style={{ display: 'grid', gap: 5 }}>
                          <label htmlFor={`quote-method-${load.id}`} style={{ fontSize: 12, fontWeight: 800, color: T.ink }}>O teu preço de transporte</label>
                          <select id={`quote-method-${load.id}`} value={quotePriceMethod} onChange={(event) => setQuotePriceMethod(event.target.value as 'suggested' | 'manual')} style={formInputStyle}>
                            <option value="suggested">Usar preço calculado pela rota</option>
                            <option value="manual">Apresentar o meu preço</option>
                          </select>
                        </div>
                        {quotePriceMethod === 'suggested' ? (
                          <p style={{ margin: 0, fontSize: 11, color: T.muted, lineHeight: 1.5 }}>O preço será calculado com base na rota, distância, peso e tarifas activas. A AgriLink retém 8% do frete e o teu líquido será 92% após a liquidação. Se quiseres negociar outro valor, escolhe “Apresentar o meu preço”.</p>
                        ) : (
                          <div style={{ display: 'grid', gap: 5 }}>
                            <label htmlFor={`manual-price-${load.id}`} style={{ fontSize: 12, fontWeight: 800, color: T.ink }}>Valor da tua proposta (Kz)</label>
                            <input id={`manual-price-${load.id}`} type="number" min="0.01" max="1000000000000" step="0.01" inputMode="decimal" value={manualQuotePrice} onChange={(event) => setManualQuotePrice(event.target.value)} placeholder="Ex.: 25 000" style={formInputStyle} />
                            {Number(manualQuotePrice) > 0 && <p style={{ margin: 0, fontSize: 11, color: T.muted }}>Comissão AgriLink (8%): {money(Number(manualQuotePrice) * 0.08, load.currency)} · líquido estimado: {money(Number(manualQuotePrice) * 0.92, load.currency)}.</p>}
                          </div>
                        )}
                        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 9, padding: 10, border: `1px solid ${T.rule}`, borderRadius: 10, background: T.white, fontSize: 11, lineHeight: 1.5, color: T.ink }}>
                          <input type="checkbox" checked={deliveryCommitmentAccepted} onChange={(event) => setDeliveryCommitmentAccepted(event.target.checked)} style={{ marginTop: 2 }} />
                          <span>Confirmo que tenho disponibilidade para cumprir esta entrega e todas as que aceitar. Comprometo-me a utilizar apenas veículos com manutenção, inspecção, seguro e condições de segurança válidas.</span>
                        </label>
                        <p style={{ margin: 0, fontSize: 11, color: T.muted, lineHeight: 1.5 }}>A proposta será enviada ao comprador. O pagamento só será liberado depois da aprovação dele.</p>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button type="button" onClick={() => setQuoteDraftLoadId(null)} style={{ flex: 1, padding: 10, border: `1px solid ${T.rule}`, borderRadius: 12, background: T.white, color: T.mid, fontFamily: FONT, fontWeight: 800 }}>Cancelar</button>
                          <button type="button" disabled={busyId === load.id || !deliveryCommitmentAccepted || (quotePriceMethod === 'manual' && (!Number.isFinite(Number(manualQuotePrice)) || Number(manualQuotePrice) <= 0))} onClick={() => void submitQuote(load)} style={{ flex: 1, padding: 10, border: 'none', borderRadius: 12, background: T.green, color: T.white, fontFamily: FONT, fontWeight: 800, opacity: busyId === load.id ? 0.6 : 1 }}>
                            {busyId === load.id ? 'A calcular e enviar…' : 'Enviar proposta'}
                          </button>
                        </div>
                      </>
                    )}
                  </section>
                ) : tab === 'disponiveis' ? (
                  <button
                    disabled={busyId === load.id}
                    onClick={() => void accept(load)}
                    style={{
                      marginTop: 14,
                      width: '100%',
                      padding: '12px 16px',
                      borderRadius: 12,
                      border: 'none',
                      background: tooHeavy ? T.rule : T.green,
                      color: tooHeavy ? T.muted : T.white,
                      fontFamily: FONT,
                      fontSize: 14,
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    {busyId === load.id ? 'A aceitar…' : capacityUnavailable ? 'Regista ou selecciona o veículo' : tooHeavy ? 'Capacidade insuficiente' : 'Aceitar carga'}
                  </button>
                ) : isAssignedDriver && load.status === 'accepted' && load.pre_order_id && load.driver_quote_status !== 'approved' ? (
                  <section role="status" style={{ display: 'grid', gap: 5, marginTop: 14, padding: 12, border: `1px solid ${T.gold}`, borderRadius: 12, background: T.goldBg }}>
                    <strong style={{ fontSize: 12, color: T.ink }}>
                      {load.driver_quote_status === 'rejected'
                        ? 'A proposta foi recusada. Reveja o preço para continuar.'
                        : load.buyer_quote_approved
                          ? 'Preço aprovado pelo comprador. Aguardando a etapa de pagamento.'
                          : 'A aguardar decisão do comprador.'}
                    </strong>
                    <span style={{ fontSize: 11, color: T.muted }}>Não inicies a viagem até o acordo estar fechado na AgriLink.</span>
                  </section>
                ) : isAssignedDriver && load.status === 'accepted' ? (
                  <div style={{ display: 'grid', gap: 8, marginTop: 14 }}>
                    <button
                      type="button"
                      onClick={() => {
                        if (load.origin_lat == null || load.origin_lng == null) {
                          toast.error('Esta carga não tem coordenadas GPS de recolha.');
                          return;
                        }
                        navigate('/mapa-app', { state: { freightLoad: load } });
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
                    disabled={busyId === load.id}
                    onClick={() => void advance(load)}
                    style={{
                      marginTop: 14, width: '100%', padding: '12px 16px',
                      borderRadius: 12, border: 'none', background: T.green,
                      color: T.white, fontFamily: FONT, fontSize: 14,
                      fontWeight: 800, cursor: 'pointer',
                    }}
                  >
                    {busyId === load.id ? 'A confirmar…' : 'Confirmar que estou com a carga · iniciar GPS'}
                  </button>
                ) : isAssignedDriver && load.status === 'in_transit' ? (
                  <button
                    disabled={busyId === load.id}
                    onClick={() => void advance(load)}
                    style={{
                      marginTop: 14, width: '100%', padding: '12px 16px',
                      borderRadius: 12, border: `1.5px solid ${T.green}`,
                      background: T.white, color: T.green, fontFamily: FONT,
                      fontSize: 14, fontWeight: 800, cursor: 'pointer',
                    }}
                  >
                    {busyId === load.id ? 'A actualizar…' : 'Marcar como entregue'}
                  </button>
                ) : null}
              </article>
            );
          })}
      </main>
      {vehicleDraftLoadId && (
        <div role="dialog" aria-modal="true" aria-labelledby="driver-vehicle-title" style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(15,23,42,.58)', display: 'grid', placeItems: 'center', padding: 16 }}>
          <section style={{ width: 'min(100%, 620px)', maxHeight: '90vh', overflowY: 'auto', background: T.white, borderRadius: 18, padding: 20, boxShadow: '0 24px 80px rgba(0,0,0,.24)', display: 'grid', gap: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
              <div>
                <h2 id="driver-vehicle-title" style={{ margin: 0, color: T.ink, fontSize: 18, fontWeight: 900 }}>{editingVehicleId ? 'Actualizar veículo e manutenção' : 'Identificação do veículo'}</h2>
                <p style={{ margin: '5px 0 0', color: T.muted, fontSize: 12, lineHeight: 1.5 }}>A AgriLink associa estes dados à carga para manter o registo do veículo utilizado na operação.</p>
              </div>
              <button type="button" aria-label="Fechar" onClick={() => { setVehicleDraftLoadId(null); setVehicleDraftAction(null); setEditingVehicleId(null); setDeliveryCommitmentAccepted(false); }} style={{ border: 0, background: 'transparent', color: T.muted, fontSize: 22, cursor: 'pointer' }}>×</button>
            </div>
            {!showNewVehicle && driverVehicles.length > 0 && (
              <div style={{ display: 'grid', gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 800, color: T.ink }}>Usar veículo já registado</label>
                <select value={selectedVehicleId} onChange={(event) => setSelectedVehicleId(event.target.value)} style={formInputStyle}>
                  <option value="">Seleccione um veículo</option>
                  {driverVehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.vehicle_type} · {vehicle.make} {vehicle.model} · {vehicle.plate_number} · {vehicle.capacity_kg} kg</option>)}
                </select>
                <button type="button" onClick={() => { setEditingVehicleId(null); setShowNewVehicle(true); setVehicleDraft({ vehicle_type: 'Camião', make: '', model: '', plate_number: '', color: '', manufacture_year: '', capacity_kg: '', condition_notes: '', brakes_ok: false, tires_ok: false, lights_ok: false, body_condition: 'good', registration_document_number: '', inspection_valid_until: '', insurance_valid_until: '', maintenance_valid_until: '' }); }} style={{ justifySelf: 'start', border: 0, background: 'transparent', color: T.green, fontWeight: 800, cursor: 'pointer' }}>+ Registar outro veículo</button>
                {selectedVehicleId && driverVehicles.some(vehicle => vehicle.id === selectedVehicleId) && (
                  <button type="button" onClick={() => { const vehicle = driverVehicles.find(item => item.id === selectedVehicleId)!; setEditingVehicleId(vehicle.id); setVehicleDraft({ vehicle_type: vehicle.vehicle_type, make: vehicle.make, model: vehicle.model, plate_number: vehicle.plate_number, color: vehicle.color, manufacture_year: vehicle.manufacture_year?.toString() || '', capacity_kg: String(vehicle.capacity_kg), condition_notes: vehicle.condition_notes, brakes_ok: vehicle.brakes_ok, tires_ok: vehicle.tires_ok, lights_ok: vehicle.lights_ok, body_condition: vehicle.body_condition, registration_document_number: vehicle.registration_document_number || '', inspection_valid_until: vehicle.inspection_valid_until || '', insurance_valid_until: vehicle.insurance_valid_until || '', maintenance_valid_until: vehicle.maintenance_valid_until || '' }); setShowNewVehicle(true); }} style={{ justifySelf: 'start', border: 0, background: 'transparent', color: T.green, fontWeight: 800, cursor: 'pointer' }}>Actualizar manutenção e documentos do veículo seleccionado</button>
                )}
              </div>
            )}
            {(showNewVehicle || driverVehicles.length === 0) && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 10 }}>
                <div style={{ display: 'grid', gap: 5 }}>
                  <label style={{ fontSize: 12, fontWeight: 800 }}>Tipo de veículo *</label>
                  <select value={vehicleDraft.vehicle_type} onChange={(e) => setVehicleDraft(v => ({...v, vehicle_type:e.target.value}))} style={formInputStyle}>
                    {['Camião','Camião basculante','Carrinha','Camião frigorífico','Tractor com reboque','Reboque','Outro'].map(type => <option key={type}>{type}</option>)}
                  </select>
                </div>
                {([
                  ['make','Marca *','Ex.: Toyota'],
                  ['model','Modelo *','Ex.: Dyna'],
                  ['plate_number','Matrícula *','Ex.: LD-00-00-XX'],
                  ['color','Cor *','Ex.: Branco'],
                  ['manufacture_year','Ano de fabrico','Ex.: 2018'],
                  ['capacity_kg','Capacidade (kg) *','Ex.: 5000'],
                  ['registration_document_number','N.º do documento do veículo','Opcional'],
                ] as const).map(([key,label,placeholder]) => (
                  <div key={key} style={{ display: 'grid', gap: 5 }}>
                    <label style={{ fontSize: 12, fontWeight: 800, color: T.ink }}>{label}</label>
                    <input type={key === 'manufacture_year' ? 'number' : 'text'} min={key === 'manufacture_year' ? 1950 : undefined} max={key === 'manufacture_year' ? new Date().getFullYear()+1 : undefined} value={vehicleDraft[key]} onChange={(e) => setVehicleDraft(v => ({...v,[key]:e.target.value}))} placeholder={placeholder} style={formInputStyle} />
                  </div>
                ))}
                <div style={{ display: 'grid', gap: 5, gridColumn: '1 / -1' }}>
                  <label style={{ fontSize: 12, fontWeight: 800, color: T.ink }}>Condições gerais do veículo *</label>
                  <textarea value={vehicleDraft.condition_notes} onChange={(e) => setVehicleDraft(v => ({...v,condition_notes:e.target.value}))} rows={3} placeholder="Descreva o estado mecânico, conservação, eventuais danos e condições para transportar a carga." style={{...formInputStyle, resize:'vertical'}} />
                </div>
                <div style={{ display: 'grid', gap: 8, gridColumn: '1 / -1', padding: 12, border: `1px solid ${T.rule}`, borderRadius: 12 }}>
                  <strong style={{ fontSize: 12, color: T.ink }}>Verificação de segurança (obrigatória)</strong>
                  {([
                    ['brakes_ok','Travões em boas condições'],
                    ['tires_ok','Pneus em boas condições'],
                    ['lights_ok','Luzes e sinalização funcionais'],
                  ] as const).map(([key,label]) => (
                    <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: T.ink }}>
                      <input type="checkbox" checked={vehicleDraft[key]} onChange={(e) => setVehicleDraft(v => ({...v,[key]:e.target.checked}))} /> {label}
                    </label>
                  ))}
                  <label style={{ fontSize: 12, fontWeight: 800 }}>Estado da carroçaria</label>
                  <select value={vehicleDraft.body_condition} onChange={(e) => setVehicleDraft(v => ({...v,body_condition:e.target.value as DriverVehicleDraft['body_condition']}))} style={formInputStyle}>
                    <option value="good">Bom</option><option value="fair">Razoável</option><option value="needs_attention">Precisa de reparação</option>
                  </select>
                </div>
                <div style={{ display: 'grid', gap: 5 }}>
                  <label style={{ fontSize: 12, fontWeight: 800 }}>Inspecção válida até *</label>
                  <input required type="date" value={vehicleDraft.inspection_valid_until} onChange={(e) => setVehicleDraft(v => ({...v,inspection_valid_until:e.target.value}))} style={formInputStyle} />
                </div>
                <div style={{ display: 'grid', gap: 5 }}>
                  <label style={{ fontSize: 12, fontWeight: 800 }}>Seguro válido até *</label>
                  <input required type="date" value={vehicleDraft.insurance_valid_until} onChange={(e) => setVehicleDraft(v => ({...v,insurance_valid_until:e.target.value}))} style={formInputStyle} />
                </div>
                <div style={{ display: 'grid', gap: 5 }}>
                  <label style={{ fontSize: 12, fontWeight: 800 }}>Manutenção preventiva válida até *</label>
                  <input required type="date" value={vehicleDraft.maintenance_valid_until} onChange={(e) => setVehicleDraft(v => ({...v,maintenance_valid_until:e.target.value}))} style={formInputStyle} />
                </div>
                {driverVehicles.length > 0 && <button type="button" onClick={() => { setShowNewVehicle(false); setEditingVehicleId(null); }} style={{ justifySelf: 'start', border: 0, background: 'transparent', color: T.green, fontWeight: 800, cursor: 'pointer' }}>Voltar aos veículos registados</button>}
              </div>
            )}
            {activeDriverCommitments > 0 && <p style={{ margin: 0, padding: 10, borderRadius: 10, background: T.goldBg, color: T.ink, fontSize: 11 }}>Tens actualmente {activeDriverCommitments} entrega(s) atribuída(s) por concluir. Considera estes compromissos antes de aceitar outra carga.</p>}
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 9, padding: 10, border: `1px solid ${T.rule}`, borderRadius: 10, background: T.canvas, fontSize: 11, lineHeight: 1.5, color: T.ink }}>
              <input type="checkbox" checked={deliveryCommitmentAccepted} onChange={(event) => setDeliveryCommitmentAccepted(event.target.checked)} style={{ marginTop: 2 }} />
              <span>Comprometo-me a cumprir esta entrega e as restantes que aceitar. Declaro que o veículo será utilizado apenas com manutenção preventiva, inspecção, seguro e condições de segurança válidas.</span>
            </label>
            <p style={{ margin: 0, color: T.muted, fontSize: 11, lineHeight: 1.5 }}>Os dados do veículo ficam associados à operação. O registo pendente de revisão administrativa não substitui a verificação dos documentos originais.</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" disabled={savingVehicle} onClick={() => { setVehicleDraftLoadId(null); setVehicleDraftAction(null); setEditingVehicleId(null); setDeliveryCommitmentAccepted(false); }} style={{ flex: 1, padding: 11, border: `1px solid ${T.rule}`, borderRadius: 12, background: T.white, color: T.mid, fontWeight: 800 }}>Cancelar</button>
              <button type="button" disabled={savingVehicle} onClick={() => void confirmVehicleForLoad()} style={{ flex: 1, padding: 11, border: 0, borderRadius: 12, background: T.green, color: T.white, fontWeight: 800, opacity: savingVehicle ? .6 : 1 }}>{savingVehicle ? 'A guardar…' : editingVehicleId ? 'Guardar actualizações' : vehicleDraftAction === 'accept' ? 'Guardar e aceitar carga' : 'Confirmar veículo'}</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};

export default ProximasCargas;
