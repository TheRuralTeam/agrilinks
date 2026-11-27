import React, { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../integrations/supabase/client";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";
import { Input } from "../ui/input";
import Loader from "../ui/Loader";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { toast } from "sonner";
import { Activity, AlertTriangle, CheckCircle2, Clock3, MapPin, Package, RefreshCw, Truck } from "lucide-react";

type Load = {
  id: string;
  driver_id: string | null;
  vehicle_id: string | null;
  product_name: string;
  weight_kg: number;
  origin_label: string;
  origin_lat: number | null;
  origin_lng: number | null;
  destination_label: string;
  destination_lat: number | null;
  destination_lng: number | null;
  pickup_date: string | null;
  offered_price: number | null;
  currency: string;
  status: string;
  accepted_at: string | null;
  driver_commitment_confirmed_at: string | null;
  in_transit_at: string | null;
  delivered_at: string | null;
  created_at: string;
  updated_at: string;
  pre_order_id: string | null;
  driver_offered_price: number | null;
  driver_quote_status: string;
  route_distance_km: number | null;
  route_duration_minutes: number | null;
  supplier_id: string | null;
  buyer_id: string | null;
  supplier_handover_confirmed_at: string | null;
  driver_pickup_confirmed_at: string | null;
  driver_delivery_confirmed_at: string | null;
  buyer_receipt_confirmed_at: string | null;
  driver_arrived_at: string | null;
};

type Person = { id: string; full_name: string | null; phone: string | null; email: string | null };
type Vehicle = {
  id: string; driver_id: string; vehicle_type: string; make: string; model: string;
  plate_number: string; capacity_kg: number; brakes_ok: boolean; tires_ok: boolean;
  lights_ok: boolean; body_condition: string; verification_status: string; is_active: boolean;
  inspection_valid_until: string | null; insurance_valid_until: string | null; maintenance_valid_until: string | null;
};
type LoadEvent = { id: number; freight_load_id: string; actor_id: string; event_type: string; created_at: string };
type Location = { freight_load_id: string; latitude: number; longitude: number; recorded_at: string; accuracy_m: number | null; speed_mps: number | null; heading_deg: number | null };
type PreOrder = { id: string; payment_status: string | null; requested_delivery_date: string | null; location: string | null };
type Settlement = { id: string; freight_load_id: string; gross_amount: number; agrilink_commission: number; driver_amount: number; status: string; paid_at: string | null };

const STATUS: Record<string, string> = {
  available: "Disponível", open: "Disponível", agendado: "Agendado",
  accepted: "Motorista atribuído", at_pickup: "No local de recolha",
  in_transit: "Em trânsito", delivered: "Entregue", cancelled: "Cancelada",
};
const QUOTE: Record<string, string> = {
  not_offered: "Sem proposta", pending_buyer_approval: "Aguarda comprador",
  approved: "Aprovada", rejected: "Recusada",
};
const EVENT: Record<string, string> = {
  accepted: "Motorista aceitou a carga", driver_pickup: "Motorista chegou à recolha",
  supplier_handover: "Entrega ao motorista / recolha confirmada",
  buyer_received: "Comprador confirmou recepção", driver_delivery: "Motorista confirmou entrega",
  quote_submitted: "Proposta de frete enviada", quote_approved: "Proposta aprovada",
};

const dateTime = (value: string | null | undefined) => value
  ? new Intl.DateTimeFormat("pt-AO", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Luanda" }).format(new Date(value))
  : "—";
const dateOnly = (value: string | null | undefined) => value
  ? new Intl.DateTimeFormat("pt-AO", { dateStyle: "medium", timeZone: "Africa/Luanda" }).format(new Date(value + (value.length === 10 ? "T12:00:00" : "")))
  : "Não registada";
const money = (value: number | null | undefined, currency = "Kz") => value == null
  ? "—"
  : new Intl.NumberFormat("pt-AO", { maximumFractionDigits: 2 }).format(Number(value)) + " " + currency;
const mapUrl = (lat: number, lng: number) => "https://www.google.com/maps?q=" + encodeURIComponent(lat + "," + lng);

const AdminFreightOperations: React.FC = () => {
  const [loads, setLoads] = useState<Load[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [events, setEvents] = useState<LoadEvent[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [preOrders, setPreOrders] = useState<PreOrder[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selected, setSelected] = useState<Load | null>(null);

  const fetchData = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true); else setLoading(true);
    try {
      const loadResult = await (supabase as any).from("freight_loads")
        .select("id,driver_id,vehicle_id,product_name,weight_kg,origin_label,origin_lat,origin_lng,destination_label,destination_lat,destination_lng,pickup_date,offered_price,currency,status,accepted_at,driver_commitment_confirmed_at,in_transit_at,delivered_at,created_at,updated_at,pre_order_id,driver_offered_price,driver_quote_status,route_distance_km,route_duration_minutes,supplier_id,buyer_id,supplier_handover_confirmed_at,driver_pickup_confirmed_at,driver_delivery_confirmed_at,buyer_receipt_confirmed_at,driver_arrived_at")
        .order("created_at", { ascending: false }).limit(250);
      if (loadResult.error) throw loadResult.error;
      const rows = (loadResult.data || []) as Load[];
      setLoads(rows);
      const userIds = [...new Set(rows.flatMap(row => [row.driver_id, row.supplier_id, row.buyer_id]).filter(Boolean))] as string[];
      const vehicleIds = [...new Set(rows.map(row => row.vehicle_id).filter(Boolean))] as string[];
      const preOrderIds = [...new Set(rows.map(row => row.pre_order_id).filter(Boolean))] as string[];
      const loadIds = rows.map(row => row.id);
      const [peopleResult, vehicleResult, eventResult, locationResult, orderResult, settlementResult] = await Promise.all([
        userIds.length ? (supabase as any).from("users").select("id,full_name,phone,email").in("id", userIds) : Promise.resolve({ data: [], error: null }),
        vehicleIds.length ? (supabase as any).from("driver_vehicles").select("id,driver_id,vehicle_type,make,model,plate_number,capacity_kg,brakes_ok,tires_ok,lights_ok,body_condition,verification_status,is_active,inspection_valid_until,insurance_valid_until,maintenance_valid_until").in("id", vehicleIds) : Promise.resolve({ data: [], error: null }),
        loadIds.length ? (supabase as any).from("freight_load_events").select("id,freight_load_id,actor_id,event_type,created_at").in("freight_load_id", loadIds).order("created_at", { ascending: false }) : Promise.resolve({ data: [], error: null }),
        loadIds.length ? (supabase as any).from("freight_load_locations").select("freight_load_id,latitude,longitude,recorded_at,accuracy_m,speed_mps,heading_deg").in("freight_load_id", loadIds).order("recorded_at", { ascending: false }) : Promise.resolve({ data: [], error: null }),
        preOrderIds.length ? (supabase as any).from("pre_orders").select("id,payment_status,requested_delivery_date,location").in("id", preOrderIds) : Promise.resolve({ data: [], error: null }),
        loadIds.length ? (supabase as any).from("freight_settlements").select("id,freight_load_id,gross_amount,agrilink_commission,driver_amount,status,paid_at").in("freight_load_id", loadIds) : Promise.resolve({ data: [], error: null }),
      ]);
      if (peopleResult.error) throw peopleResult.error;
      if (vehicleResult.error) throw vehicleResult.error;
      if (eventResult.error) throw eventResult.error;
      if (locationResult.error) throw locationResult.error;
      setPeople((peopleResult.data || []) as Person[]);
      setVehicles((vehicleResult.data || []) as Vehicle[]);
      setEvents((eventResult.data || []) as LoadEvent[]);
      setLocations((locationResult.data || []) as Location[]);
      setPreOrders((orderResult.data || []) as PreOrder[]);
      setSettlements((settlementResult.data || []) as Settlement[]);
      if (orderResult.error) console.warn("[AdminFreightOperations] Não foi possível carregar os estados de pagamento.", orderResult.error);
      if (settlementResult.error) console.warn("[AdminFreightOperations] Não foi possível carregar as liquidações.", settlementResult.error);
    } catch (error: any) {
      console.error("[AdminFreightOperations] Falha ao carregar operações de frete:", error);
      toast.error(error?.message || "Não foi possível carregar o controlo de entregas.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void fetchData(); }, [fetchData]);

  useEffect(() => {
    const channel = supabase.channel("admin-freight-operations")
      .on("postgres_changes", { event: "*", schema: "public", table: "freight_load_events" }, () => void fetchData(true))
      .on("postgres_changes", { event: "*", schema: "public", table: "freight_load_locations" }, () => void fetchData(true))
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [fetchData]);

  const personById = useMemo(() => new Map<string, Person>(people.map(person => [person.id, person] as const)), [people]);
  const vehicleById = useMemo(() => new Map<string, Vehicle>(vehicles.map(vehicle => [vehicle.id, vehicle] as const)), [vehicles]);
  const orderById = useMemo(() => new Map<string, PreOrder>(preOrders.map(order => [order.id, order] as const)), [preOrders]);
  const latestLocationByLoad = useMemo(() => {
    const map = new Map<string, Location>();
    locations.forEach(point => { if (!map.has(point.freight_load_id)) map.set(point.freight_load_id, point); });
    return map;
  }, [locations]);
  const settlementByLoad = useMemo(() => new Map<string, Settlement>(settlements.map(item => [item.freight_load_id, item] as const)), [settlements]);
  const visibleLoads = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("pt-AO");
    return loads.filter(load => {
      const driver = load.driver_id ? personById.get(load.driver_id) : null;
      const vehicle = load.vehicle_id ? vehicleById.get(load.vehicle_id) : null;
      const matchesText = !term || [load.product_name, load.origin_label, load.destination_label, driver?.full_name, vehicle?.plate_number, load.id]
        .some(value => String(value || "").toLocaleLowerCase("pt-AO").includes(term));
      return matchesText && (statusFilter === "all" || load.status === statusFilter);
    });
  }, [loads, query, statusFilter, personById, vehicleById]);

  const activeCount = loads.filter(load => !["delivered", "cancelled"].includes(load.status) && Boolean(load.driver_id)).length;
  const transitCount = loads.filter(load => load.status === "in_transit").length;
  const pendingQuoteCount = loads.filter(load => load.driver_quote_status === "pending_buyer_approval").length;
  const awaitingReceiptCount = loads.filter(load => load.status === "delivered" && (!load.driver_delivery_confirmed_at || !load.buyer_receipt_confirmed_at || !load.supplier_handover_confirmed_at)).length;

  const getCompletion = (load: Load) => {
    const checks = [load.driver_delivery_confirmed_at, load.supplier_handover_confirmed_at, load.buyer_receipt_confirmed_at];
    return checks.every(Boolean);
  };
  const loadEvents = (loadId: string) => events.filter(event => event.freight_load_id === loadId);
  const currentLocation = (loadId: string) => latestLocationByLoad.get(loadId);
  const relatedOrder = (load: Load) => load.pre_order_id ? orderById.get(load.pre_order_id) : null;
  const selectedVehicle = selected?.vehicle_id ? vehicleById.get(selected.vehicle_id) : null;
  const selectedDriver = selected?.driver_id ? personById.get(selected.driver_id) : null;
  const selectedSupplier = selected?.supplier_id ? personById.get(selected.supplier_id) : null;
  const selectedBuyer = selected?.buyer_id ? personById.get(selected.buyer_id) : null;
  const selectedOrder = selected ? relatedOrder(selected) : null;
  const selectedSettlement = selected ? settlementByLoad.get(selected.id) : null;
  const selectedLocation = selected ? currentLocation(selected.id) : null;

  return (
    <div className="space-y-5">
      <Card className="border-0 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2"><Truck className="h-5 w-5 text-primary" /> Operações de transporte</CardTitle>
            <CardDescription>Monitorização das cargas, motoristas, veículos, confirmações e localização real</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => void fetchData(true)} disabled={refreshing}>
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} /> Actualizar
          </Button>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <Card><CardContent className="pt-5"><div className="flex items-center gap-3"><Package className="h-5 w-5 text-blue-600" /><div><p className="text-2xl font-bold">{activeCount}</p><p className="text-xs text-muted-foreground">Cargas activas atribuídas</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-5"><div className="flex items-center gap-3"><Truck className="h-5 w-5 text-violet-600" /><div><p className="text-2xl font-bold">{transitCount}</p><p className="text-xs text-muted-foreground">Em trânsito</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-5"><div className="flex items-center gap-3"><Clock3 className="h-5 w-5 text-amber-600" /><div><p className="text-2xl font-bold">{pendingQuoteCount}</p><p className="text-xs text-muted-foreground">Propostas à espera do comprador</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-5"><div className="flex items-center gap-3"><AlertTriangle className="h-5 w-5 text-orange-600" /><div><p className="text-2xl font-bold">{awaitingReceiptCount}</p><p className="text-xs text-muted-foreground">Entregues sem todas as confirmações</p></div></div></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Cargas e entregas</CardTitle><CardDescription>Os estados apresentados vêm directamente dos registos operacionais. GPS e confirmações só aparecem quando foram efectivamente registados.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <Input value={query} onChange={event => setQuery(event.target.value)} placeholder="Pesquisar produto, motorista, matrícula ou código da carga…" className="sm:max-w-md" />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="sm:w-56"><SelectValue placeholder="Filtrar por estado" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os estados</SelectItem>
                {Object.entries(STATUS).map(([value,label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {loading ? <div className="flex justify-center py-12"><Loader compact /></div> : visibleLoads.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Não existem cargas para os filtros seleccionados.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Carga</TableHead><TableHead>Motorista / veículo</TableHead><TableHead>Percurso</TableHead>
                  <TableHead>Estado</TableHead><TableHead>Proposta / pagamento</TableHead><TableHead>GPS</TableHead><TableHead />
                </TableRow></TableHeader>
                <TableBody>
                  {visibleLoads.map(load => {
                    const driver = load.driver_id ? personById.get(load.driver_id) : null;
                    const vehicle = load.vehicle_id ? vehicleById.get(load.vehicle_id) : null;
                    const order = relatedOrder(load);
                    const point = currentLocation(load.id);
                    const settlement = settlementByLoad.get(load.id);
                    return <TableRow key={load.id}>
                      <TableCell className="min-w-44">
                        <div className="font-semibold">{load.product_name}</div>
                        <div className="text-xs text-muted-foreground">{new Intl.NumberFormat("pt-AO").format(Number(load.weight_kg))} kg · {load.id.slice(0,8)}</div>
                      </TableCell>
                      <TableCell className="min-w-44">
                        <div className="font-medium">{driver?.full_name || (load.driver_id ? "Motorista não identificado" : "Por atribuir")}</div>
                        <div className="text-xs text-muted-foreground">{vehicle ? vehicle.plate_number + " · " + vehicle.make + " " + vehicle.model : "Sem veículo associado"}</div>
                      </TableCell>
                      <TableCell className="min-w-52">
                        <div className="text-xs">{load.origin_label}</div><div className="text-xs text-muted-foreground">↓ {load.destination_label}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={load.status === "in_transit" ? "default" : load.status === "delivered" ? "secondary" : "outline"}>{STATUS[load.status] || load.status}</Badge>
                        {load.status === "delivered" && <div className="mt-1 text-[11px]">{getCompletion(load) ? "Confirmações completas" : "Confirmações pendentes"}</div>}
                      </TableCell>
                      <TableCell className="min-w-44">
                        <div className="text-xs">{QUOTE[load.driver_quote_status] || load.driver_quote_status}</div>
                        <div className="text-xs font-medium">{money(load.driver_offered_price, load.currency)}</div>
                        <div className="text-[11px] text-muted-foreground">Pagamento: {order?.payment_status || "Sem pré-compra"}</div>
                        {settlement && <div className="text-[11px] text-muted-foreground">Liquidação: {settlement.status}</div>}
                      </TableCell>
                      <TableCell>
                        {point ? <a className="inline-flex items-center gap-1 text-xs text-primary underline" href={mapUrl(point.latitude, point.longitude)} target="_blank" rel="noreferrer"><MapPin className="h-3 w-3" /> Abrir posição</a> : <span className="text-xs text-muted-foreground">Sem GPS</span>}
                      </TableCell>
                      <TableCell><Button variant="outline" size="sm" onClick={() => setSelected(load)}>Detalhes</Button></TableCell>
                    </TableRow>;
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(selected)} onOpenChange={open => !open && setSelected(null)}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          {selected && <>
            <DialogHeader>
              <DialogTitle>{selected.product_name} · {STATUS[selected.status] || selected.status}</DialogTitle>
              <DialogDescription>Carga {selected.id} · criada em {dateTime(selected.created_at)}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Motorista</p><p className="font-semibold">{selectedDriver?.full_name || "Por atribuir"}</p><p className="text-xs text-muted-foreground">{selectedDriver?.phone || selectedDriver?.email || "Contacto não disponível"}</p></div>
              <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Fornecedor</p><p className="font-semibold">{selectedSupplier?.full_name || "Não identificado"}</p><p className="text-xs text-muted-foreground">{selectedSupplier?.phone || "Contacto não disponível"}</p></div>
              <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Comprador</p><p className="font-semibold">{selectedBuyer?.full_name || "Não identificado"}</p><p className="text-xs text-muted-foreground">{selectedBuyer?.phone || "Contacto não disponível"}</p></div>
              <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Veículo</p><p className="font-semibold">{selectedVehicle ? `${selectedVehicle.make} ${selectedVehicle.model} · ${selectedVehicle.plate_number}` : "Não associado"}</p><p className="text-xs text-muted-foreground">{selectedVehicle ? `${selectedVehicle.vehicle_type} · capacidade ${selectedVehicle.capacity_kg} kg` : "—"}</p></div>
              <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Origem</p><p className="font-medium">{selected.origin_label}</p>{selected.origin_lat != null && selected.origin_lng != null && <a className="text-xs text-primary underline" href={mapUrl(selected.origin_lat,selected.origin_lng)} target="_blank" rel="noreferrer">Abrir origem no mapa</a>}</div>
              <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Destino</p><p className="font-medium">{selected.destination_label}</p>{selected.destination_lat != null && selected.destination_lng != null && <a className="text-xs text-primary underline" href={mapUrl(selected.destination_lat,selected.destination_lng)} target="_blank" rel="noreferrer">Abrir destino no mapa</a>}</div>
              <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Recolha prevista</p><p className="font-semibold">{dateOnly(selectedOrder?.requested_delivery_date || selected.pickup_date)}</p><p className="text-xs text-muted-foreground">Rota: {selected.route_distance_km ?? "—"} km · {selected.route_duration_minutes ?? "—"} min</p></div>
              <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Proposta de frete</p><p className="font-semibold">{money(selected.driver_offered_price,selected.currency)}</p><p className="text-xs text-muted-foreground">{QUOTE[selected.driver_quote_status] || selected.driver_quote_status}</p></div>
            </div>
            {selectedVehicle && <section className="space-y-2 rounded-lg border p-3">
              <h3 className="font-semibold text-sm">Segurança e manutenção do veículo</h3>
              <div className="grid gap-2 sm:grid-cols-2 text-sm">
                <p>Travões: {selectedVehicle.brakes_ok ? "OK" : "Reprovado"}</p><p>Pneus: {selectedVehicle.tires_ok ? "OK" : "Reprovado"}</p>
                <p>Luzes: {selectedVehicle.lights_ok ? "OK" : "Reprovado"}</p><p>Carroçaria: {selectedVehicle.body_condition}</p>
                <p>Manutenção válida até: {dateOnly(selectedVehicle.maintenance_valid_until)}</p><p>Inspecção válida até: {dateOnly(selectedVehicle.inspection_valid_until)}</p>
                <p>Seguro válido até: {dateOnly(selectedVehicle.insurance_valid_until)}</p><p>Revisão administrativa: {selectedVehicle.verification_status}</p>
              </div>
            </section>}
            <section className="space-y-2 rounded-lg border p-3">
              <h3 className="font-semibold text-sm">Controlo de entrega e confirmações</h3>
              {[
                ["Motorista assumiu compromisso de entrega", selected.driver_commitment_confirmed_at],
                ["Motorista chegou à recolha", selected.driver_arrived_at],
                ["Motorista confirmou recolha", selected.driver_pickup_confirmed_at],
                ["Fornecedor confirmou entrega ao motorista", selected.supplier_handover_confirmed_at],
                ["Motorista confirmou entrega", selected.driver_delivery_confirmed_at || selected.delivered_at],
                ["Comprador confirmou recepção", selected.buyer_receipt_confirmed_at],
              ].map(([label,value]) => <div key={String(label)} className="flex items-center justify-between gap-3 border-b py-2 last:border-0 text-sm">
                <span>{label}</span><span className="text-right text-xs text-muted-foreground">{value ? dateTime(String(value)) : "Pendente"}</span>
              </div>)}
              <div className="pt-1 text-sm font-semibold">{getCompletion(selected) ? <span className="inline-flex items-center gap-2 text-green-700"><CheckCircle2 className="h-4 w-4" /> Entrega com confirmações completas</span> : <span className="inline-flex items-center gap-2 text-amber-700"><AlertTriangle className="h-4 w-4" /> Aguardando confirmações das partes</span>}</div>
            </section>
            <section className="space-y-2 rounded-lg border p-3">
              <h3 className="font-semibold text-sm">Localização GPS</h3>
              {selectedLocation ? <div className="flex items-center justify-between gap-3 text-sm"><div><p>{selectedLocation.latitude.toFixed(6)}, {selectedLocation.longitude.toFixed(6)}</p><p className="text-xs text-muted-foreground">Registada em {dateTime(selectedLocation.recorded_at)}</p></div><a className="text-primary underline" href={mapUrl(selectedLocation.latitude,selectedLocation.longitude)} target="_blank" rel="noreferrer">Ver mapa</a></div> : <p className="text-sm text-muted-foreground">Ainda não existem posições GPS registadas para esta carga.</p>}
            </section>
            <section className="space-y-2 rounded-lg border p-3">
              <h3 className="font-semibold text-sm">Histórico de eventos</h3>
              {loadEvents(selected.id).length ? loadEvents(selected.id).map(event => <div key={event.id} className="flex items-start justify-between gap-3 border-b py-2 last:border-0 text-sm"><span>{EVENT[event.event_type] || event.event_type}</span><span className="shrink-0 text-xs text-muted-foreground">{dateTime(event.created_at)}</span></div>) : <p className="text-sm text-muted-foreground">Sem eventos registados.</p>}
            </section>
            {selectedSettlement && <section className="rounded-lg border p-3">
              <h3 className="font-semibold text-sm">Liquidação</h3>
              <div className="grid grid-cols-2 gap-2 text-sm"><p>Valor bruto: {money(selectedSettlement.gross_amount,selected.currency)}</p><p>Comissão AgriLink: {money(selectedSettlement.agrilink_commission,selected.currency)}</p><p>Motorista: {money(selectedSettlement.driver_amount,selected.currency)}</p><p>Estado: {selectedSettlement.status}</p><p>Pago em: {dateTime(selectedSettlement.paid_at)}</p></div>
            </section>}
          </>}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminFreightOperations;
