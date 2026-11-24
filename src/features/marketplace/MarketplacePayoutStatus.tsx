import { useCallback, useEffect, useState } from "react";
import { Clock3, RefreshCw, Wallet } from "lucide-react";
import { supabase } from "../../integrations/supabase/client";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";

type PayoutStatus =
  | "awaiting_beneficiary_verification"
  | "awaiting_manual_payout"
  | "processing"
  | "paid"
  | "failed"
  | "blocked"
  | "cancelled";

interface OwnPayout {
  id: string;
  payout_type: string;
  amount: number;
  currency: string;
  status: PayoutStatus;
  payout_reference: string | null;
  created_at: string;
  paid_at: string | null;
}

const statusLabels: Record<PayoutStatus, string> = {
  awaiting_beneficiary_verification: "A aguardar validação do beneficiário",
  awaiting_manual_payout: "A aguardar liquidação",
  processing: "Em processamento",
  paid: "Pago",
  failed: "Pagamento não concluído",
  blocked: "Em análise",
  cancelled: "Cancelado",
};

const statusVariants: Record<PayoutStatus, "default" | "secondary" | "destructive" | "outline"> = {
  awaiting_beneficiary_verification: "outline",
  awaiting_manual_payout: "secondary",
  processing: "default",
  paid: "default",
  failed: "destructive",
  blocked: "destructive",
  cancelled: "outline",
};

const formatMoney = (amount: number, currency: string) =>
  new Intl.NumberFormat("pt-AO", {
    style: "currency",
    currency: currency || "AOA",
    maximumFractionDigits: 2,
  }).format(amount);

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("pt-AO", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

export function MarketplacePayoutStatus({ userId }: { userId: string }) {
  const [payouts, setPayouts] = useState<OwnPayout[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError(false);

    try {
      // Explicit recipient filter plus database RLS: the user can only read their own payout records.
      // Sensitive provider references, beneficiary tokens and private proof paths are never selected.
      const { data, error: queryError } = await (supabase as any)
        .from("marketplace_payouts")
        .select("id,payout_type,amount,currency,status,payout_reference,created_at,paid_at")
        .eq("recipient_user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (queryError) throw queryError;
      setPayouts((data ?? []) as OwnPayout[]);
    } catch (queryError) {
      console.error("[AgriLink] Não foi possível carregar o estado dos pagamentos do utilizador.", queryError);
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <Wallet className="h-4 w-4" /> Os meus pagamentos
        </CardTitle>
        <Button type="button" size="sm" variant="ghost" onClick={() => void load(true)} disabled={refreshing || loading} aria-label="Actualizar pagamentos">
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <p className="py-4 text-center text-sm text-muted-foreground">A consultar os teus pagamentos…</p>
        ) : error ? (
          <div role="alert" className="space-y-2 py-3 text-center">
            <p className="text-sm text-muted-foreground">Não foi possível consultar os pagamentos.</p>
            <Button type="button" size="sm" variant="outline" onClick={() => void load()}>Tentar novamente</Button>
          </div>
        ) : payouts.length === 0 ? (
          <div className="py-5 text-center">
            <Clock3 className="mx-auto mb-2 h-5 w-5 text-muted-foreground" />
            <p className="text-sm font-medium">Ainda não existem liquidações associadas à tua conta.</p>
            <p className="mt-1 text-xs text-muted-foreground">Quando uma venda ou entrega elegível for concluída, o respectivo estado aparecerá aqui.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {payouts.map((payout) => {
              const status = statusLabels[payout.status] ? payout.status : "blocked";
              return (
                <li key={payout.id} className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold">{payout.payout_type === "driver" ? "Serviço de transporte" : "Venda de produto"}</span>
                      <Badge variant={statusVariants[status]}>{statusLabels[status]}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">Registado em {formatDate(payout.created_at)}</p>
                    {status === "paid" && payout.paid_at && (
                      <p className="text-xs text-muted-foreground">
                        Liquidado em {formatDate(payout.paid_at)}
                        {payout.payout_reference ? ` · Referência: ${payout.payout_reference}` : ""}
                      </p>
                    )}
                  </div>
                  <p className="shrink-0 text-base font-bold tabular-nums">{formatMoney(Number(payout.amount), payout.currency)}</p>
                </li>
              );
            })}
          </ul>
        )}
        <p className="border-t pt-3 text-xs text-muted-foreground">
          Os estados reflectem os registos de liquidação confirmados pela AgriLink. A apresentação desta informação não inicia uma transferência bancária.
        </p>
      </CardContent>
    </Card>
  );
}

export default MarketplacePayoutStatus;
