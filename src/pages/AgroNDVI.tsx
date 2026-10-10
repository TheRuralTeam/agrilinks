import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Interval = { from: string | null; to: string | null; mean: number | null; min: number | null; max: number | null; standardDeviation: number | null; validPixelCount: number; maskedOrNoDataPixelCount: number; validPixelPercent: number | null };
type Result = { provider: string; resolutionMeters: number; aggregationDays: number; area: { approximateWidthMeters: number; note: string }; quality: { validIntervals: number; returnedIntervals: number }; intervals: Interval[]; advisory: string; fetchedAt: string };
const dateLabel = (s: string | null) => s ? new Intl.DateTimeFormat("pt-PT", { dateStyle: "medium", timeZone: "Africa/Luanda" }).format(new Date(s)) : "Data indisponível";
const val = (n: number | null) => n === null ? "Sem dados" : n.toFixed(3);

export default function AgroNDVI() {
  const [latitude, setLatitude] = useState("-8.8390");
  const [longitude, setLongitude] = useState("13.2894");
  const [daysBack, setDaysBack] = useState("90");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const analyze = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError(null);
    const lat = Number(latitude), lon = Number(longitude);
    if (!latitude.trim() || !longitude.trim() || !Number.isFinite(lat) || !Number.isFinite(lon)) { setError("Introduza coordenadas válidas."); return; }
    if (lat < -18.05 || lat > -4.2 || lon < 11.5 || lon > 24.1) { setError("Esta versão piloto aceita coordenadas dentro dos limites aproximados de Angola."); return; }
    setLoading(true);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke("agro-ndvi", { body: { latitude: lat, longitude: lon, daysBack: Number(daysBack) } });
      if (invokeError) throw invokeError;
      if (!data || !Array.isArray(data.intervals) || !data.provider) throw new Error(data?.error || "Resposta incompleta do serviço NDVI.");
      setResult(data as Result);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Não foi possível analisar a vegetação.";
      setError(message.toLowerCase().includes("fetch") ? "Não foi possível contactar o serviço de satélite. Tente novamente." : message);
    } finally { setLoading(false); }
  };
  const valid = result?.intervals.filter(x => x.mean !== null && x.validPixelCount > 0) ?? [];
  const first = valid[0], last = valid[valid.length - 1];
  const delta = first?.mean != null && last?.mean != null ? last.mean - first.mean : null;

  return <main className="container mx-auto max-w-6xl space-y-6 px-4 py-6 md:py-8">
    <p><Link to="/agro-satelite" className="text-sm underline">Voltar ao catálogo de satélites</Link></p>
    <header className="space-y-2"><p className="text-sm font-medium text-primary">AgriLink AgroInteligência</p><h1 className="text-2xl font-bold md:text-3xl">NDVI calculado com Sentinel-2</h1><p className="max-w-3xl text-muted-foreground">Estatísticas reais das bandas B04 (vermelho) e B08 (infravermelho próximo), processadas pelo serviço Copernicus com máscara de qualidade SCL.</p></header>
    <Card><CardHeader><CardTitle>Localização e período</CardTitle><p className="text-sm text-muted-foreground">Área quadrada aproximada de 1,1 km à volta do ponto; não é o limite cadastral da exploração.</p></CardHeader><CardContent><form className="grid gap-4 md:grid-cols-4" onSubmit={analyze}>
      <div className="space-y-2"><Label htmlFor="ndvi-lat">Latitude</Label><Input id="ndvi-lat" value={latitude} onChange={e=>setLatitude(e.target.value)} required inputMode="decimal" /></div>
      <div className="space-y-2"><Label htmlFor="ndvi-lon">Longitude</Label><Input id="ndvi-lon" value={longitude} onChange={e=>setLongitude(e.target.value)} required inputMode="decimal" /></div>
      <div className="space-y-2"><Label htmlFor="ndvi-days">Período</Label><Select value={daysBack} onValueChange={setDaysBack}><SelectTrigger id="ndvi-days"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="30">30 dias</SelectItem><SelectItem value="60">60 dias</SelectItem><SelectItem value="90">90 dias</SelectItem><SelectItem value="180">180 dias</SelectItem></SelectContent></Select></div>
      <div className="flex items-end"><Button className="w-full" type="submit" disabled={loading}>{loading ? "A calcular..." : "Calcular NDVI"}</Button></div>
    </form></CardContent></Card>
    {error && <Alert variant="destructive" role="alert"><AlertTitle>Análise não concluída</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
    {result && <section className="space-y-4" aria-live="polite">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card><CardHeader><p className="text-sm text-muted-foreground">NDVI médio mais recente</p><CardTitle>{val(last?.mean ?? null)}</CardTitle></CardHeader><CardContent className="text-xs text-muted-foreground">{last ? dateLabel(last.from) : "Sem observações válidas"}</CardContent></Card>
        <Card><CardHeader><p className="text-sm text-muted-foreground">Variação no período</p><CardTitle>{delta === null ? "—" : (delta > 0 ? "+" : "") + delta.toFixed(3)}</CardTitle></CardHeader><CardContent className="text-xs text-muted-foreground">Última média menos primeira média válida</CardContent></Card>
        <Card><CardHeader><p className="text-sm text-muted-foreground">Intervalos válidos</p><CardTitle>{result.quality.validIntervals}/{result.quality.returnedIntervals}</CardTitle></CardHeader><CardContent className="text-xs text-muted-foreground">Agregação de 10 dias</CardContent></Card>
        <Card><CardHeader><p className="text-sm text-muted-foreground">Resolução nominal</p><CardTitle>{result.resolutionMeters} m</CardTitle></CardHeader><CardContent className="text-xs text-muted-foreground">Sentinel-2 Level-2A</CardContent></Card>
      </div>
      <Card><CardHeader><CardTitle>Série temporal NDVI</CardTitle><p className="text-sm text-muted-foreground">Períodos sem pixels válidos aparecem sem valor, nunca como zero.</p></CardHeader><CardContent className="space-y-3">
        {result.intervals.map((item,i)=><div key={item.from ?? i} className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-medium">{dateLabel(item.from)} – {dateLabel(item.to)}</p><p className="text-xs text-muted-foreground">Mín. {val(item.min)} · Máx. {val(item.max)} · Desvio-padrão {val(item.standardDeviation)}</p><p className="text-xs text-muted-foreground">{item.validPixelCount.toLocaleString("pt-PT")} pixels válidos · {item.validPixelPercent === null ? "qualidade indisponível" : item.validPixelPercent.toFixed(1)+"% de pixels válidos aproximados"}</p></div><p className="text-xl font-semibold tabular-nums">{val(item.mean)}</p></div>)}
      </CardContent></Card>
      <Alert><AlertTitle>Limites da interpretação</AlertTitle><AlertDescription>{result.advisory} NDVI pode variar com estação, fase da cultura, solo exposto, irrigação, sombras e mistura de culturas; não diagnostica doenças nem estima rendimento por si só.</AlertDescription></Alert>
      <p className="text-xs text-muted-foreground">Fonte: {result.provider} · Calculado em {dateLabel(result.fetchedAt)} · Área aproximada de {result.area.approximateWidthMeters.toLocaleString("pt-PT")} m de largura.</p>
    </section>}
  </main>;
}
