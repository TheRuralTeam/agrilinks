import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Save, Truck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "../../integrations/supabase/client";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";

type FreightPricingSettings = {
  base_fare_kz: number | string | null;
  rate_per_km_kz: number | string | null;
  rate_per_100kg_kz: number | string | null;
  category_multipliers: Record<string, number>;
  updated_at: string | null;
};

const formatValue = (value: number | string | null | undefined) =>
  value == null ? "" : String(value);

const FreightPricingSettings = () => {
  const [settings, setSettings] = useState<FreightPricingSettings | null>(null);
  const [baseFare, setBaseFare] = useState("");
  const [ratePerKm, setRatePerKm] = useState("");
  const [ratePer100Kg, setRatePer100Kg] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("get_freight_pricing_settings");

    if (error) {
      toast.error("Não foi possível carregar as tarifas do frete.");
      console.error("Erro ao carregar configuração de frete:", error);
      setLoading(false);
      return;
    }

    const row = (Array.isArray(data) ? data[0] : data) as FreightPricingSettings | null;
    if (!row) {
      toast.error("A configuração de frete não foi encontrada.");
      setLoading(false);
      return;
    }

    setSettings(row);
    setBaseFare(formatValue(row.base_fare_kz));
    setRatePerKm(formatValue(row.rate_per_km_kz));
    setRatePer100Kg(formatValue(row.rate_per_100kg_kz));
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const saveSettings = async () => {
    const base = Number(baseFare);
    const km = Number(ratePerKm);
    const weight = Number(ratePer100Kg);

    if (
      !baseFare.trim() ||
      !ratePerKm.trim() ||
      !ratePer100Kg.trim() ||
      !Number.isFinite(base) ||
      !Number.isFinite(km) ||
      !Number.isFinite(weight) ||
      base < 0 ||
      km <= 0 ||
      weight < 0
    ) {
      toast.error("Introduza uma tarifa base e por 100 kg não negativas e uma tarifa por km superior a zero.");
      return;
    }

    if (!settings?.category_multipliers) {
      toast.error("Não foi possível validar os multiplicadores de categoria existentes.");
      return;
    }

    setSaving(true);
    const { data, error } = await supabase.rpc("set_freight_pricing_model", {
      p_base_fare_kz: base,
      p_rate_per_km_kz: km,
      p_rate_per_100kg_kz: weight,
      p_category_multipliers: settings.category_multipliers,
    });
    setSaving(false);

    if (error) {
      console.error("Erro ao guardar configuração de frete:", error);
      toast.error(
        error.message.includes("administrator")
          ? "Apenas um administrador autorizado pode alterar estas tarifas."
          : "Não foi possível guardar as tarifas. Verifique os valores e tente novamente.",
      );
      return;
    }

    const row = (Array.isArray(data) ? data[0] : data) as Partial<FreightPricingSettings> | null;
    if (row) {
      setSettings((current) => current ? { ...current, ...row } : current);
    }
    toast.success("Tarifas do frete actualizadas. Os novos cálculos usarão estes valores.");
    await loadSettings();
  };

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-primary/10 p-3 text-primary">
          <Truck className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">Configuração do frete</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Defina as tarifas usadas pelo cálculo automático de transporte. As alterações ficam guardadas na base de dados.
          </p>
        </div>
      </div>

      <Card className="rounded-2xl border-gray-200 shadow-sm">
        <CardHeader>
          <CardTitle>Tarifas de transporte</CardTitle>
          <CardDescription>
            Os valores são expressos em kwanzas (Kz). Os multiplicadores por categoria existentes são preservados ao guardar.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <label htmlFor="freight-base-fare" className="text-sm font-medium">Tarifa base (Kz)</label>
              <Input
                id="freight-base-fare"
                type="number"
                min="0"
                step="1"
                value={baseFare}
                onChange={(event) => setBaseFare(event.target.value)}
                disabled={loading || saving}
                placeholder="50000"
              />
              <p className="text-xs text-muted-foreground">Valor fixo inicial por transporte.</p>
            </div>
            <div className="space-y-2">
              <label htmlFor="freight-rate-km" className="text-sm font-medium">Tarifa por quilómetro (Kz/km)</label>
              <Input
                id="freight-rate-km"
                type="number"
                min="0.01"
                step="1"
                value={ratePerKm}
                onChange={(event) => setRatePerKm(event.target.value)}
                disabled={loading || saving}
                placeholder="900"
              />
              <p className="text-xs text-muted-foreground">Aplicada à distância da rota calculada.</p>
            </div>
            <div className="space-y-2">
              <label htmlFor="freight-rate-weight" className="text-sm font-medium">Tarifa por 100 kg (Kz)</label>
              <Input
                id="freight-rate-weight"
                type="number"
                min="0"
                step="1"
                value={ratePer100Kg}
                onChange={(event) => setRatePer100Kg(event.target.value)}
                disabled={loading || saving}
                placeholder="40000"
              />
              <p className="text-xs text-muted-foreground">Proporcional ao peso total da carga.</p>
            </div>
          </div>

          <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4 text-sm text-emerald-950">
            <p className="font-semibold">Fórmula utilizada</p>
            <p className="mt-1">Tarifa base + (distância em km × tarifa por km) + (peso em kg ÷ 100 × tarifa por 100 kg), antes do multiplicador da categoria do produto.</p>
          </div>

          {settings?.updated_at && (
            <p className="text-xs text-muted-foreground">
              Última actualização: {new Date(settings.updated_at).toLocaleString("pt-AO")}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void loadSettings()} disabled={loading || saving}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Recarregar
            </Button>
            <Button onClick={() => void saveSettings()} disabled={loading || saving}>
              <Save className="mr-2 h-4 w-4" />
              {saving ? "A guardar…" : "Guardar tarifas"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default FreightPricingSettings;
