import { useState } from "react";
import { Link } from "react-router-dom";
import type { FormEvent } from "react";
import { CalendarDays, Cloud, ExternalLink, Image as ImageIcon, MapPin, RefreshCw, Satellite } from "lucide-react";
import SimpleLeafletMap from "@/components/SimpleLeafletMap";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type SatelliteCollection = "sentinel-2-l2a" | "sentinel-1-grd";

type SatelliteScene = {
  id: string | null;
  acquiredAt: string | null;
  cloudCover: number | null;
  platform: string;
  processingLevel: string;
  thumbnailUrl: string | null;
  previewUrl: string | null;
};

type CatalogResponse = {
  provider: string;
  collection: SatelliteCollection;
  catalogUrl: string;
  searchedAt: string;
  location: { latitude: number; longitude: number };
  search: { cloudCoverMax: number; daysBack: number };
  scenes: SatelliteScene[];
  count: number;
  advisory: string;
};

function formatDate(value: string | null): string {
  if (!value) return "Data não indicada";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Data não indicada";
  return new Intl.DateTimeFormat("pt-PT", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Luanda",
  }).format(date);
}

export default function AgroSatelite() {
  const [latitude, setLatitude] = useState("-8.8390");
  const [longitude, setLongitude] = useState("13.2894");
  const [collection, setCollection] = useState<SatelliteCollection>("sentinel-2-l2a");
  const [daysBack, setDaysBack] = useState("90");
  const [cloudCoverMax, setCloudCoverMax] = useState("35");
  const [result, setResult] = useState<CatalogResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const searchScenes = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    setError(null);
    const lat = Number(latitude);
    const lon = Number(longitude);
    if (!latitude.trim() || !longitude.trim() || !Number.isFinite(lat) || !Number.isFinite(lon)) {
      setError("Selecione no mapa ou introduza coordenadas válidas.");
      return;
    }
    if (lat < -18.05 || lat > -4.2 || lon < 11.5 || lon > 24.1) {
      setError("Esta versão piloto aceita coordenadas dentro dos limites geográficos aproximados de Angola.");
      return;
    }

    setLoading(true);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke("agro-satellite-catalog", {
        body: { latitude: lat, longitude: lon, collection, daysBack: Number(daysBack), cloudCoverMax: Number(cloudCoverMax) },
      });
      if (invokeError) throw invokeError;
      if (!data || !Array.isArray(data.scenes) || !data.provider) {
        throw new Error("O catálogo devolveu uma resposta incompleta.");
      }
      setResult(data as CatalogResponse);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Não foi possível pesquisar o catálogo.";
      setError(message.toLowerCase().includes("fetch")
        ? "Não foi possível contactar o catálogo de satélites. Verifique a ligação e tente novamente."
        : message);
    } finally {
      setLoading(false);
    }
  };

  const center = { lat: Number(latitude) || -8.839, lng: Number(longitude) || 13.2894 };

  return (
    <main className="container mx-auto max-w-6xl space-y-6 px-4 py-6 md:py-8">
      <header className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium text-primary">
          <Satellite className="h-4 w-4" aria-hidden="true" />
          AgriLink AgroInteligência
        </div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Observação da Terra e satélites</h1>
        <p className="max-w-3xl text-muted-foreground">
          Pesquise cenas Sentinel-2 Level-2A perto de uma exploração, compare datas de aquisição e filtre por cobertura
          de nuvens. Esta etapa pesquisa o catálogo; não calcula ainda índices de vegetação.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg"><MapPin className="h-5 w-5 text-primary" />Selecionar zona agrícola</CardTitle>
            <CardDescription>Clique no mapa para selecionar o centro aproximado da zona. A área pesquisada é um quadrado de cerca de 10 km de lado.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <SimpleLeafletMap
              center={center}
              zoom={11}
              height={330}
              markers={[{ lat: center.lat, lng: center.lng }]}
              onClick={(coords) => {
                setLatitude(coords.lat.toFixed(5));
                setLongitude(coords.lng.toFixed(5));
              }}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="sat-latitude">Latitude</Label>
                <Input id="sat-latitude" value={latitude} onChange={(event) => setLatitude(event.target.value)} inputMode="decimal" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sat-longitude">Longitude</Label>
                <Input id="sat-longitude" value={longitude} onChange={(event) => setLongitude(event.target.value)} inputMode="decimal" required />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Filtros de pesquisa</CardTitle>
            <CardDescription>As imagens recentes podem estar ocultas por nuvens. Amplie o período quando não houver resultados.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={searchScenes}>
              <div className="space-y-2">
                <Label htmlFor="sat-collection">Tipo de satélite</Label>
                <Select value={collection} onValueChange={(value) => setCollection(value as SatelliteCollection)}>
                  <SelectTrigger id="sat-collection"><SelectValue placeholder="Selecionar satélite" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sentinel-2-l2a">Sentinel-2 — ótico (vegetação)</SelectItem>
                    <SelectItem value="sentinel-1-grd">Sentinel-1 — radar (nuvens)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="sat-days">Período histórico</Label>
                <Select value={daysBack} onValueChange={setDaysBack}>
                  <SelectTrigger id="sat-days"><SelectValue placeholder="Selecionar período" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">Últimos 30 dias</SelectItem>
                    <SelectItem value="90">Últimos 90 dias</SelectItem>
                    <SelectItem value="180">Últimos 180 dias</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="sat-cloud">Cobertura máxima de nuvens</Label>
                <Select value={cloudCoverMax} onValueChange={setCloudCoverMax} disabled={collection === "sentinel-1-grd"}>
                  <SelectTrigger id="sat-cloud"><SelectValue placeholder="Selecionar cobertura" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10% — mais restritivo</SelectItem>
                    <SelectItem value="20">20%</SelectItem>
                    <SelectItem value="35">35% — equilibrado</SelectItem>
                    <SelectItem value="50">50%</SelectItem>
                    <SelectItem value="80">80% — mais resultados</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {collection === "sentinel-1-grd" && <p className="text-xs text-muted-foreground">O radar Sentinel-1 não usa o filtro de cobertura de nuvens.</p>}
              <Button type="submit" disabled={loading} className="w-full">
                <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                {loading ? "A pesquisar catálogo..." : collection === "sentinel-1-grd" ? "Pesquisar cenas Sentinel-1" : "Pesquisar imagens Sentinel-2"}
              </Button>
            </form>
            <div className="mt-4 rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
              <p className="flex items-center gap-2 font-medium text-foreground"><ImageIcon className="h-4 w-4" />Fonte: Copernicus Data Space</p>
              <p className="mt-1">Pesquisa de metadados através do catálogo STAC oficial. A disponibilidade de imagens e ativos de pré-visualização varia por cena.</p>
              <a className="mt-2 inline-flex items-center gap-1 underline underline-offset-4" href="https://browser.stac.dataspace.copernicus.eu" target="_blank" rel="noreferrer">
                Abrir navegador de satélites <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </CardContent>
        </Card>
      </div>

      {error && (
        <Alert variant="destructive" role="alert">
          <AlertTitle>Pesquisa não concluída</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {result && (
        <section className="space-y-4" aria-live="polite">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold">{result.collection === "sentinel-1-grd" ? "Cenas Sentinel-1 encontradas" : "Cenas Sentinel-2 encontradas"}: {result.count}</h2>
              <p className="text-sm text-muted-foreground">
                {result.location.latitude.toFixed(5)}, {result.location.longitude.toFixed(5)} · Últimos {result.search.daysBack} dias{result.collection === "sentinel-2-l2a" ? ` · Nuvens até ${result.search.cloudCoverMax}%` : " · Radar: nuvens não aplicável"}
              </p>
            </div>
            <p className="text-xs text-muted-foreground">Pesquisa em {formatDate(result.searchedAt)} · {result.provider}</p>
          </div>

          {result.scenes.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {result.scenes.map((scene, index) => (
                <Card key={scene.id ?? scene.acquiredAt ?? `scene-${index}`} className="overflow-hidden">
                  {scene.thumbnailUrl ? (
                    <img src={scene.thumbnailUrl} alt={`Pré-visualização da cena ${scene.id ?? "Sentinel-2"}`} className="h-44 w-full bg-muted object-cover" loading="lazy" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="flex h-44 items-center justify-center bg-muted text-muted-foreground">
                      <Satellite className="h-10 w-10" aria-hidden="true" />
                    </div>
                  )}
                  <CardHeader className="pb-2">
                    <CardTitle className="break-all text-sm">{scene.id ?? "Cena Sentinel-2"}</CardTitle>
                    <CardDescription>{formatDate(scene.acquiredAt)}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <p className="flex items-center gap-2"><Cloud className="h-4 w-4 text-primary" />{result.collection === "sentinel-1-grd" ? "Observação por radar" : `Cobertura de nuvens: ${scene.cloudCover === null ? "Não indicada" : `${Math.round(scene.cloudCover)}%`}`}</p>
                    <p className="text-muted-foreground">{scene.platform} · {scene.processingLevel}</p>
                    {scene.previewUrl && (
                      <a href={scene.previewUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline underline-offset-4">
                        Abrir ativo da cena <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card><CardContent className="flex items-start gap-3 p-5">
              <CalendarDays className="mt-1 h-5 w-5 text-muted-foreground" />
              <div><p className="font-medium">Sem cenas com estes filtros</p><p className="text-sm text-muted-foreground">Aumente o período ou aceite maior cobertura de nuvens e volte a pesquisar.</p></div>
            </CardContent></Card>
          )}

          <Alert>
            <AlertTitle>Limites da análise</AlertTitle>
            <AlertDescription>{result.advisory} Os resultados não são um diagnóstico agronómico nem uma medição de rendimento.</AlertDescription>
          </Alert>
        </section>
      )}
    </main>
  );
}
