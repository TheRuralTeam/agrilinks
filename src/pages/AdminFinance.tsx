import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Download, Lock, Search, Truck, Wallet, Receipt, RotateCcw, Landmark } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { supabase } from "../integrations/supabase/client";
import { toast } from "sonner";

/* ════════════════════════════════════════════════════════════════════════════
   CONTRATO DE DADOS — é isto que o backend precisa devolver.
   Quando o back existir, só `fetchFinanceOverview` muda. A UI não toca em mais nada.
   ════════════════════════════════════════════════════════════════════════════ */
export type FinanceRange = 7 | 30 | 90;
export type FlowKind = "sale" | "freight" | "commission" | "payout" | "refund";
export type FlowStatus = "settled" | "escrow" | "pending" | "failed";

export interface LedgerEntry {
  id: string;
  date: string; // ISO
  kind: FlowKind;
  status: FlowStatus;
  direction: "in" | "out";
  amount: number; // Kz, sempre positivo
  counterparty: string;
  reference: string; // ex.: id da pré-compra
}
export interface SplitItem { key: "suppliers" | "freight" | "commission" | "fees"; label: string; value: number }
export interface FinanceOverview {
  gmv: number; // total pago pelos compradores no período
  netRevenue: number; // comissão + taxas AgriLink
  escrowHeld: number;
  pendingPayouts: number;
  cashflow: { date: string; inflow: number; outflow: number }[];
  split: SplitItem[];
  pipeline: { key: string; label: string; value: number; count: number }[];
  ledger: LedgerEntry[];
}

export const FINANCE_IS_DEMO = false;

export async function fetchFinanceOverview(days: FinanceRange): Promise<FinanceOverview> {
  const start = new Date(Date.now() - (days - 1) * 864e5).toISOString();
  const { data, error } = await (supabase as any)
    .from('commissions')
    .select('id,pre_order_id,user_id,commission_role,amount,gross_amount,net_amount,settlement_status,created_at,settled_at')
    .not('pre_order_id', 'is', null)
    .not('commission_role', 'is', null)
    .gte('created_at', start)
    .order('created_at', { ascending: false })
    .limit(1500);
  if (error) throw error;

  const records = (data || []) as Array<{
    id: string; pre_order_id: string; user_id: string; commission_role: 'supplier' | 'driver';
    amount: number; gross_amount: number; net_amount: number; settlement_status: string;
    created_at: string; settled_at: string | null;
  }>;
  const userIds = [...new Set(records.map((record) => record.user_id).filter(Boolean))];
  let userNames = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: users } = await supabase.from('users').select('id,full_name').in('id', userIds);
    userNames = new Map((users || []).map((user) => [user.id, user.full_name]));
  }

  const sum = (pick: (record: typeof records[number]) => number) => records.reduce((total, record) => total + pick(record), 0);
  const supplierNet = sum((record) => record.commission_role === 'supplier' ? Number(record.net_amount) : 0);
  const driverNet = sum((record) => record.commission_role === 'driver' ? Number(record.net_amount) : 0);
  const platformCommission = sum((record) => Number(record.amount));
  const gmv = sum((record) => Number(record.gross_amount));
  const pendingPayouts = sum((record) => record.settlement_status === 'pending_payout' ? Number(record.net_amount) : 0);

  const daily = new Map<string, { inflow: number; outflow: number }>();
  for (let offset = 0; offset < days; offset += 1) {
    const date = new Date(Date.now() - (days - 1 - offset) * 864e5).toISOString().slice(0, 10);
    daily.set(date, { inflow: 0, outflow: 0 });
  }
  for (const record of records) {
    const incoming = daily.get(record.created_at.slice(0, 10));
    if (incoming) incoming.inflow += Number(record.gross_amount);
    if (record.settlement_status === 'paid' && record.settled_at) {
      const outgoing = daily.get(record.settled_at.slice(0, 10));
      if (outgoing) outgoing.outflow += Number(record.net_amount);
    }
  }

  const ledger: LedgerEntry[] = records.flatMap((record) => {
    const partyName = userNames.get(record.user_id) || (record.commission_role === 'supplier' ? 'Fornecedor' : 'Motorista');
    const reference = `PC-${record.pre_order_id.slice(0, 8)}`;
    const settled = record.settlement_status === 'paid';
    const feeEntry: LedgerEntry = {
      id: `${record.id}:fee`, date: record.created_at, kind: 'commission', status: 'settled',
      direction: 'in', amount: Number(record.amount), counterparty: `AgriLink · ${partyName}`, reference,
    };
    const payoutEntry: LedgerEntry = {
      id: `${record.id}:net`, date: record.settled_at || record.created_at, kind: 'payout',
      status: settled ? 'settled' : 'pending', direction: 'out', amount: Number(record.net_amount),
      counterparty: partyName, reference,
    };
    return [feeEntry, payoutEntry];
  }).sort((a, b) => +new Date(b.date) - +new Date(a.date));

  const orderCount = new Set(records.map((record) => record.pre_order_id)).size;
  const pendingCount = records.filter((record) => record.settlement_status === 'pending_payout').length;
  return {
    gmv,
    netRevenue: platformCommission,
    escrowHeld: 0,
    pendingPayouts,
    cashflow: [...daily.entries()].map(([date, value]) => ({ date: new Date(`${date}T00:00:00`).toISOString(), ...value })),
    split: [
      { key: 'suppliers', label: 'Líquido fornecedor', value: supplierNet },
      { key: 'freight', label: 'Líquido motorista', value: driverNet },
      { key: 'commission', label: 'Comissões AgriLink', value: platformCommission },
      { key: 'fees', label: 'Taxas de processamento', value: 0 },
    ],
    pipeline: [
      { key: 'paid', label: 'Pago pelo comprador', value: gmv, count: orderCount },
      { key: 'held', label: 'Retido em escrow', value: 0, count: 0 },
      { key: 'transit', label: 'Em entrega', value: 0, count: 0 },
      { key: 'release', label: 'Repasses pendentes', value: pendingPayouts, count: pendingCount },
    ],
    ledger,
  };
}

function useFinanceOverview(days: FinanceRange) {
  const [data, setData] = useState<FinanceOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  useEffect(() => {
    let alive = true;
    setLoading(true); setError(null);
    fetchFinanceOverview(days)
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(e instanceof Error ? e.message : "Não foi possível carregar os dados financeiros."))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [days, retryCount]);
  return { data, loading, error, retry: () => setRetryCount((count) => count + 1) };
}

/* ── apresentação ──────────────────────────────────────────────────────────── */
const INK = "#12301F", GREEN = "#2c863b", OCHRE = "#C8892B", SLATE = "#8A9A8F";
const SPLIT_COLOR: Record<SplitItem["key"], string> = { suppliers: GREEN, freight: OCHRE, commission: INK, fees: SLATE };

const kz = (v: number) => `${new Intl.NumberFormat("pt-AO", { maximumFractionDigits: 0 }).format(v)} Kz`;
const kzShort = (v: number) => `${new Intl.NumberFormat("pt-AO", { notation: "compact", maximumFractionDigits: 1 }).format(v)} Kz`;
const day = (iso: string) => new Date(iso).toLocaleDateString("pt-AO", { day: "2-digit", month: "short" });

const KIND: Record<FlowKind, { label: string; icon: ReactNode }> = {
  sale: { label: "Venda", icon: <Wallet className="h-3.5 w-3.5" /> },
  freight: { label: "Frete", icon: <Truck className="h-3.5 w-3.5" /> },
  commission: { label: "Comissão", icon: <Landmark className="h-3.5 w-3.5" /> },
  payout: { label: "Repasse", icon: <Receipt className="h-3.5 w-3.5" /> },
  refund: { label: "Reembolso", icon: <RotateCcw className="h-3.5 w-3.5" /> },
};
const STATUS: Record<FlowStatus, { label: string; cls: string }> = {
  settled: { label: "Liquidado", cls: "bg-emerald-50 text-emerald-800" },
  escrow: { label: "Em escrow", cls: "bg-sky-50 text-sky-800" },
  pending: { label: "Pendente", cls: "bg-amber-50 text-amber-800" },
  failed: { label: "Falhou", cls: "bg-red-50 text-red-700" },
};

/** Fluxo do dinheiro: quanto entra e para onde cada parte segue. A espessura é proporcional ao valor. */
function MoneyFlow({ split, total }: { split: SplitItem[]; total: number }) {
  if (total <= 0) {
    return <p className="py-10 text-center text-sm text-gray-500">Ainda não há compras pagas no período selecionado.</p>;
  }
  const H = 200, top = 28, gap = 16, w = 14, xR = 560, x1 = w, xm = (x1 + xR) / 2;
  const n = split.length;
  let ly = top + (gap * (n - 1)) / 2, ry = top;
  const rows = split.map((it) => {
    const t = Math.max((it.value / total) * H, 6);
    const row = { ...it, t, l: ly, r: ry };
    ly += t; ry += t + gap;
    return row;
  });
  const leftTop = rows[0].l, leftH = rows[n - 1].l + rows[n - 1].t - leftTop;
  return (
    <svg viewBox={`0 0 860 ${top + H + gap * (n - 1) + 24}`} className="w-full" role="img" aria-label="Distribuição do dinheiro recebido">
      <text x={0} y={16} fontSize={12} fill={SLATE}>Pago pelos compradores · {kzShort(total)}</text>
      {rows.map((r) => (
        <g key={r.key}>
          <path d={`M${x1},${r.l} C${xm},${r.l} ${xm},${r.r} ${xR},${r.r} L${xR},${r.r + r.t} C${xm},${r.r + r.t} ${xm},${r.l + r.t} ${x1},${r.l + r.t} Z`} fill={SPLIT_COLOR[r.key]} fillOpacity={0.22} />
          <rect x={xR} y={r.r} width={w} height={r.t} rx={3} fill={SPLIT_COLOR[r.key]} />
          <text x={xR + w + 14} y={r.r + r.t / 2 - 2} fontSize={13} fontWeight={600} fill={INK}>{r.label}</text>
          <text x={xR + w + 14} y={r.r + r.t / 2 + 14} fontSize={12} fill={SLATE}>{kzShort(r.value)} · {((r.value / total) * 100).toFixed(1)}%</text>
        </g>
      ))}
      <rect x={0} y={leftTop} width={w} height={leftH} rx={3} fill={INK} />
    </svg>
  );
}

export default function AdminFinance({ canManageViewers = false }: { canManageViewers?: boolean }) {
  const [days, setDays] = useState<FinanceRange>(30);
  const [kind, setKind] = useState<"all" | FlowKind>("all");
  const [q, setQ] = useState("");
  const [visible, setVisible] = useState(12);
  const [financeViewers, setFinanceViewers] = useState<Array<{ user_id: string; full_name: string; email: string; created_at: string }>>([]);
  const [financeCandidates, setFinanceCandidates] = useState<Array<{ user_id: string; full_name: string; email: string; user_type: string; is_viewer: boolean }>>([]);
  const [selectedFinanceViewer, setSelectedFinanceViewer] = useState("");
  const [viewerActionLoading, setViewerActionLoading] = useState(false);
  const { data, loading, error, retry } = useFinanceOverview(days);

  const loadFinanceViewers = useCallback(async () => {
    const [{ data: viewers, error: viewersError }, { data: candidates, error: candidatesError }] = await Promise.all([
      (supabase as any).rpc('list_admin_finance_viewers'),
      (supabase as any).rpc('list_admin_finance_candidates'),
    ]);
    if (viewersError) throw viewersError;
    if (candidatesError) throw candidatesError;
    setFinanceViewers((viewers || []) as typeof financeViewers);
    setFinanceCandidates((candidates || []) as typeof financeCandidates);
  }, []);

  useEffect(() => {
    if (!canManageViewers) return;
    void loadFinanceViewers().catch((loadError) => {
      toast.error(loadError instanceof Error ? loadError.message : 'Não foi possível carregar os visualizadores financeiros.');
    });
  }, [canManageViewers, loadFinanceViewers]);

  const setFinanceViewerAccess = async (userId: string, enabled: boolean) => {
    setViewerActionLoading(true);
    try {
      const { error: accessError } = await (supabase as any).rpc('set_admin_finance_viewer', {
        p_user_id: userId,
        p_enabled: enabled,
      });
      if (accessError) throw accessError;
      toast.success(enabled ? 'Visualizador financeiro autorizado.' : 'Acesso financeiro removido.');
      await loadFinanceViewers();
      setSelectedFinanceViewer('');
    } catch (accessError) {
      toast.error(accessError instanceof Error ? accessError.message : 'Não foi possível actualizar o acesso financeiro.');
    } finally {
      setViewerActionLoading(false);
    }
  };

  const rows = useMemo(() => {
    if (!data) return [];
    const term = q.trim().toLowerCase();
    return data.ledger.filter((e) => (kind === "all" || e.kind === kind) && (!term || e.counterparty.toLowerCase().includes(term) || e.reference.toLowerCase().includes(term)));
  }, [data, kind, q]);

  const exportCsv = () => {
    const head = "id,data,tipo,estado,sentido,valor_kz,contraparte,referencia";
    const body = rows.map((e) => [e.id, e.date, KIND[e.kind].label, STATUS[e.status].label, e.direction === "in" ? "entrada" : "saida", e.amount, `"${e.counterparty}"`, e.reference].join(","));
    const url = URL.createObjectURL(new Blob([[head, ...body].join("\n")], { type: "text/csv;charset=utf-8" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `agrilink-financeiro-${days}d.csv` });
    a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-[#12301F]">Fluxo financeiro</h2>
          <p className="mt-1 text-sm text-gray-500">
            Compras pagas, comissões de 8% do fornecedor e 10% do motorista, e líquidos a repassar.
            {FINANCE_IS_DEMO && <span className="ml-2 rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">Dados de demonstração</span>}
          </p>
        </div>
        <div className="inline-flex rounded-lg bg-gray-100 p-0.5" role="group" aria-label="Período">
          {([7, 30, 90] as const).map((d) => (
            <button key={d} onClick={() => { setDays(d); setVisible(12); }} aria-pressed={days === d}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${days === d ? "bg-white text-[#12301F] shadow-sm" : "text-gray-500 hover:text-gray-800"}`}>
              {d} dias
            </button>
          ))}
        </div>
      </div>

      {canManageViewers && (
        <section className="rounded-xl border border-[#DCE8DE] bg-white p-4 sm:p-5" aria-labelledby="finance-viewers-title">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 id="finance-viewers-title" className="font-semibold text-[#12301F]">Acesso ao Financeiro</h3>
              <p className="mt-1 text-sm text-gray-500">Só este utilizador pode gerir quem consulta o painel.</p>
            </div>
            <div className="flex w-full flex-wrap gap-2 sm:w-auto">
              <select aria-label="Seleccionar visualizador financeiro" value={selectedFinanceViewer} onChange={(event) => setSelectedFinanceViewer(event.target.value)} className="h-9 min-w-56 flex-1 rounded-md border border-input bg-background px-2 text-sm sm:flex-none">
                <option value="">Adicionar visualizador…</option>
                {financeCandidates.filter((candidate) => !candidate.is_viewer).map((candidate) => (
                  <option key={candidate.user_id} value={candidate.user_id}>{candidate.full_name} · {candidate.email}</option>
                ))}
              </select>
              <Button size="sm" disabled={!selectedFinanceViewer || viewerActionLoading} onClick={() => void setFinanceViewerAccess(selectedFinanceViewer, true)}>
                Autorizar
              </Button>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {financeViewers.map((viewer) => (
              <div key={viewer.user_id} className="inline-flex items-center gap-2 rounded-lg border border-[#E5EDE6] px-3 py-2 text-sm">
                <span>{viewer.full_name} <span className="text-gray-500">· {viewer.email}</span></span>
                <button type="button" className="font-semibold text-red-700 hover:underline" disabled={viewerActionLoading} onClick={() => void setFinanceViewerAccess(viewer.user_id, false)}>
                  Remover
                </button>
              </div>
            ))}
            {financeViewers.length === 0 && <p className="text-xs text-gray-500">Ainda não há visualizadores adicionais.</p>}
          </div>
        </section>
      )}

      {error && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error} <button className="ml-2 font-semibold underline" onClick={retry}>Tentar novamente</button>
        </div>
      )}

      {!data ? (
        <div className="h-96 animate-pulse rounded-2xl bg-gray-100" aria-busy="true" />
      ) : (
        <div className={loading ? "opacity-60 transition-opacity" : "transition-opacity"}>
          {/* Fluxo */}
          <section className="rounded-2xl border border-[#DCE8DE] bg-white p-5 sm:p-6">
            <MoneyFlow split={data.split} total={data.gmv} />
          </section>

          {/* Indicadores numa só faixa */}
          <section className="mt-6 grid grid-cols-2 divide-x divide-y divide-[#E5EDE6] overflow-hidden rounded-2xl border border-[#DCE8DE] bg-white lg:grid-cols-4 lg:divide-y-0">
            {[
              { label: "Volume transacionado", value: data.gmv, note: "Total pago pelos compradores" },
              { label: "Comissões AgriLink", value: data.netRevenue, note: `${data.gmv > 0 ? ((data.netRevenue / data.gmv) * 100).toFixed(1) : '0.0'}% do volume pago` },
              { label: "Retido em escrow", value: data.escrowHeld, note: "O fluxo actual não usa escrow", icon: <Lock className="h-3.5 w-3.5" /> },
              { label: "Repasses pendentes", value: data.pendingPayouts, note: "Líquido de fornecedores e motoristas" },
            ].map((k) => (
              <div key={k.label} className="p-4 sm:p-5">
                <p className="flex items-center gap-1.5 text-sm text-gray-500">{k.icon}{k.label}</p>
                <p className="mt-1.5 text-2xl font-semibold tabular-nums tracking-tight text-[#12301F]">{kzShort(k.value)}</p>
                <p className="mt-1 text-xs text-gray-400">{k.note}</p>
              </div>
            ))}
          </section>

          {/* Entradas vs saídas + escrow */}
          <div className="mt-6 grid gap-6 lg:grid-cols-5">
            <section className="rounded-2xl border border-[#DCE8DE] bg-white p-5 lg:col-span-3">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-semibold text-[#12301F]">Entradas e saídas por dia</h3>
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full" style={{ background: GREEN }} />Entradas</span>
                  <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full" style={{ background: OCHRE }} />Saídas</span>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={data.cashflow} margin={{ left: -12, right: 4, top: 6 }}>
                  <defs>
                    <linearGradient id="fin-in" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={GREEN} stopOpacity={0.28} /><stop offset="100%" stopColor={GREEN} stopOpacity={0} /></linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="#E9EFEA" />
                  <XAxis dataKey="date" tickFormatter={day} tick={{ fontSize: 11, fill: SLATE }} tickLine={false} axisLine={false} minTickGap={28} />
                  <YAxis tickFormatter={(v) => kzShort(v).replace(" Kz", "")} tick={{ fontSize: 11, fill: SLATE }} tickLine={false} axisLine={false} />
                  <Tooltip formatter={(v: number, name) => [kz(v), name === "inflow" ? "Entradas" : "Saídas"]} labelFormatter={day} contentStyle={{ borderRadius: 10, border: "1px solid #DCE8DE", fontSize: 12 }} />
                  <Area type="monotone" dataKey="inflow" stroke={GREEN} strokeWidth={2} fill="url(#fin-in)" />
                  <Area type="monotone" dataKey="outflow" stroke={OCHRE} strokeWidth={2} fill="none" />
                </AreaChart>
              </ResponsiveContainer>
            </section>

            <section className="rounded-2xl border border-[#DCE8DE] bg-white p-5 lg:col-span-2">
              <h3 className="font-semibold text-[#12301F]">Onde está o dinheiro agora</h3>
              <p className="mt-1 text-sm text-gray-500">Da compra até ao repasse ao fornecedor.</p>
              {(() => {
                const sum = data.pipeline.reduce((a, p) => a + p.value, 0) || 1;
                const shades = ["#BFD9C5", "#8DBF98", GREEN, INK];
                return (
                  <>
                    <div className="mt-5 flex h-3 overflow-hidden rounded-full bg-gray-100">
                      {data.pipeline.map((p, i) => <div key={p.key} style={{ width: `${(p.value / sum) * 100}%`, background: shades[i] }} title={p.label} />)}
                    </div>
                    <ul className="mt-5 space-y-3">
                      {data.pipeline.map((p, i) => (
                        <li key={p.key} className="flex items-center justify-between gap-3 text-sm">
                          <span className="flex items-center gap-2 text-gray-700"><i className="h-2.5 w-2.5 rounded-sm" style={{ background: shades[i] }} />{p.label}</span>
                          <span className="text-right tabular-nums"><b className="font-semibold text-[#12301F]">{kzShort(p.value)}</b><span className="ml-2 text-xs text-gray-400">{p.count} pedidos</span></span>
                        </li>
                      ))}
                    </ul>
                  </>
                );
              })()}
            </section>
          </div>

          {/* Livro de movimentos */}
          <section className="mt-6 rounded-2xl border border-[#DCE8DE] bg-white">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E5EDE6] p-4 sm:p-5">
              <h3 className="font-semibold text-[#12301F]">Movimentos <span className="font-normal text-gray-400">({rows.length})</span></h3>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <Input value={q} onChange={(e) => { setQ(e.target.value); setVisible(12); }} placeholder="Contraparte ou pedido" className="h-9 w-52 pl-9" aria-label="Pesquisar movimentos" />
                </div>
                <select value={kind} onChange={(e) => { setKind(e.target.value as "all" | FlowKind); setVisible(12); }} className="h-9 rounded-md border border-input bg-background px-2 text-sm" aria-label="Filtrar por tipo">
                  <option value="all">Todos os tipos</option>
                  {(Object.keys(KIND) as FlowKind[]).map((k) => <option key={k} value={k}>{KIND[k].label}</option>)}
                </select>
                <Button variant="outline" size="sm" className="h-9 gap-2" onClick={exportCsv} disabled={rows.length === 0}><Download className="h-4 w-4" />Exportar CSV</Button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500">
                    <th className="px-5 py-2.5 font-medium">Data</th><th className="px-3 py-2.5 font-medium">Tipo</th><th className="px-3 py-2.5 font-medium">Contraparte</th>
                    <th className="px-3 py-2.5 font-medium">Estado</th><th className="px-5 py-2.5 text-right font-medium">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EEF3EF]">
                  {rows.slice(0, visible).map((e) => (
                    <tr key={e.id} className="hover:bg-[#F7FAF7]">
                      <td className="whitespace-nowrap px-5 py-3 text-gray-500">{day(e.date)}</td>
                      <td className="px-3 py-3"><span className="inline-flex items-center gap-1.5 text-gray-800">{KIND[e.kind].icon}{KIND[e.kind].label}</span></td>
                      <td className="px-3 py-3"><span className="text-gray-900">{e.counterparty}</span><span className="ml-2 text-xs text-gray-400">{e.reference}</span></td>
                      <td className="px-3 py-3"><span className={`rounded-md px-2 py-0.5 text-xs font-medium ${STATUS[e.status].cls}`}>{STATUS[e.status].label}</span></td>
                      <td className={`whitespace-nowrap px-5 py-3 text-right font-medium tabular-nums ${e.direction === "in" ? "text-emerald-700" : "text-gray-900"}`}>{e.direction === "in" ? "+" : "−"}{kz(e.amount)}</td>
                    </tr>
                  ))}
                  {rows.length === 0 && <tr><td colSpan={5} className="px-5 py-10 text-center text-gray-500">Nenhum movimento com estes filtros. Limpe a pesquisa ou escolha outro tipo.</td></tr>}
                </tbody>
              </table>
            </div>
            {rows.length > visible && (
              <div className="border-t border-[#E5EDE6] p-3 text-center">
                <Button variant="ghost" size="sm" onClick={() => setVisible((v) => v + 20)}>Mostrar mais movimentos</Button>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}