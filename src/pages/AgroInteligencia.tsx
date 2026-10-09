import { useState } from "react";
import type { FormEvent } from "react";
import {
  CloudRain,
  Droplets,
  MapPin,
  RefreshCw,
  Satellite,
  Thermometer,
  Wind,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type WeatherDay = {
  time: string[];
  weather_code: number[];
  temperature_2m_max: number[];
  temperature_2m_min: number[];
  precipitation_sum: number[];
  precipitation_probability_max: number[];
  wind_speed_10m_max: number[];
  et0_fao_evapotranspiration: number[];
};

type WeatherCurrent = {
  time: string;
  temperature_2m: number;
  relative_humidity_2m: number;
  precipitation: number;
  weather_code: number;
  wind_speed_10m: number;
};

type ForecastResponse = {
  provider: string;
  attribution: string;
  fetchedAt: string;
  location: { latitude: number; longitude: number };
  forecast: {
    timezone: string;
    current: WeatherCurrent;
    daily: WeatherDay;
    daily_units?: Record<string, string>;
  };
  advisory: string;
};

function weatherLabel(code: number): string {
  if (code === 0) return "Céu limpo";
  if ([1, 2].includes(code)) return "Pouco nublado";
  if (code === 3) return "Nublado";
  if ([45, 48].includes(code)) return "Nevoeiro";
  if ([51, 53, 55, 56, 57].includes(code)) return "Chuvisco";
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "Chuva";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "Neve";
  if ([95, 96, 99].includes(code)) return "Trovoada";
  return "Condição variável";
}

function formatDay(value: string): string {
  const date = new Date(`${value}T12:00:00`);
  return new Intl.DateTimeFormat("pt-PT", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    timeZone: "Africa/Luanda",
  }).format(date);
}

function formatFetchedAt(value: string): string {
  return new Intl.DateTimeFormat("pt-PT", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Africa/Luanda",
  }).format(new Date(value));
}

export default function AgroInteligencia() {
  // Luanda is only a sample location. Replace these with the farm's GPS coordinates.
  const [latitude, setLatitude] = useState("-8.8390");
  const [longitude, setLongitude] = useState("13.2894");
  const [locationLabel, setLocationLabel] = useState("Luanda (exemplo)");
  const [result, setResult] = useState<ForecastResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const getForecast = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const lat = Number(latitude);
    const lon = Number(longitude);
    if (!latitude.trim() || !longitude.trim() || !Number.isFinite(lat) || !Number.isFinite(lon)) {
      setError("Introduza uma latitude e longitude válidas.");
      return;
    }
    if (lat < -18.05 || lat > -4.2 || lon < 11.5 || lon > 24.1) {
      setError("Esta versão piloto aceita coordenadas dentro dos limites geográficos aproximados de Angola.");
      return;
    }

    setLoading(true);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke("agro-weather", {
        body: { latitude: lat, longitude: lon },
      });
      if (invokeError) throw invokeError;
      if (!data?.forecast?.current || !data?.forecast?.daily || !data?.provider) {
        throw new Error("O serviço devolveu dados meteorológicos incompletos. Tente novamente.");
      }
      setResult(data as ForecastResponse);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Não foi possível obter a previsão.";
      setError(
        message.toLowerCase().includes("fetch")
          ? "Não foi possível contactar o serviço meteorológico. Verifique a ligação e tente novamente."
          : message,
      );
    } finally {
      setLoading(false);
    }
  };

  const current = result?.forecast.current;
  const daily = result?.forecast.daily;

  return (
    <main className="container mx-auto max-w-6xl space-y-6 px-4 py-6 md:py-8">
      <header className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium text-primary">
          <Satellite className="h-4 w-4" aria-hidden="true" />
          AgriLink AgroInteligência
        </div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Previsão meteorológica agrícola</h1>
        <p className="max-w-3xl text-muted-foreground">
          Consulte a previsão de sete dias para a localização de uma exploração. Use as coordenadas GPS da
          parcela para que a informação seja relevante para o seu cultivo.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <MapPin className="h-5 w-5 text-primary" aria-hidden="true" />
            Localização da exploração
          </CardTitle>
          <CardDescription>
            Luanda está preenchida apenas como exemplo. Pode substituir pelas coordenadas da sua parcela.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-4" onSubmit={getForecast}>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="farm-location-label">Nome da localização (opcional)</Label>
              <Input
                id="farm-location-label"
                value={locationLabel}
                maxLength={80}
                onChange={(event) => setLocationLabel(event.target.value)}
                placeholder="Ex.: Fazenda no Huambo"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="farm-latitude">Latitude</Label>
              <Input
                id="farm-latitude"
                inputMode="decimal"
                value={latitude}
                onChange={(event) => setLatitude(event.target.value)}
                placeholder="-8.8390"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="farm-longitude">Longitude</Label>
              <Input
                id="farm-longitude"
                inputMode="decimal"
                value={longitude}
                onChange={(event) => setLongitude(event.target.value)}
                placeholder="13.2894"
                required
              />
            </div>
            <div className="md:col-span-4">
              <Button type="submit" disabled={loading} className="w-full md:w-auto">
                <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
                {loading ? "A consultar previsão..." : result ? "Atualizar previsão" : "Consultar previsão"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive" role="alert">
          <AlertTitle>Não foi possível obter a previsão</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading && !result && (
        <div className="grid gap-4 md:grid-cols-3" aria-label="A carregar previsão" aria-live="polite">
          {[1, 2, 3].map((item) => (
            <Card key={item} className="h-32 animate-pulse bg-muted/40" />
          ))}
        </div>
      )}

      {result && current && daily && (
        <section className="space-y-4" aria-live="polite">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold">{locationLabel.trim() || "Localização selecionada"}</h2>
              <p className="text-sm text-muted-foreground">
                {result.location.latitude.toFixed(4)}, {result.location.longitude.toFixed(4)} · Hora local de Angola
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              Atualizado em {formatFetchedAt(result.fetchedAt)} · Fonte: {result.provider}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <Thermometer className="h-8 w-8 text-primary" aria-hidden="true" />
                <div>
                  <p className="text-sm text-muted-foreground">Temperatura atual</p>
                  <p className="text-2xl font-semibold">{Math.round(current.temperature_2m)}°C</p>
                  <p className="text-xs text-muted-foreground">{weatherLabel(current.weather_code)}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <Droplets className="h-8 w-8 text-primary" aria-hidden="true" />
                <div>
                  <p className="text-sm text-muted-foreground">Humidade relativa</p>
                  <p className="text-2xl font-semibold">{Math.round(current.relative_humidity_2m)}%</p>
                  <p className="text-xs text-muted-foreground">Do ar, não do solo</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <CloudRain className="h-8 w-8 text-primary" aria-hidden="true" />
                <div>
                  <p className="text-sm text-muted-foreground">Precipitação atual</p>
                  <p className="text-2xl font-semibold">{Number(current.precipitation).toFixed(1)} mm</p>
                  <p className="text-xs text-muted-foreground">Estimativa horária</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <Wind className="h-8 w-8 text-primary" aria-hidden="true" />
                <div>
                  <p className="text-sm text-muted-foreground">Velocidade do vento</p>
                  <p className="text-2xl font-semibold">{Math.round(current.wind_speed_10m)} km/h</p>
                  <p className="text-xs text-muted-foreground">A 10 metros de altura</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Próximos sete dias</CardTitle>
              <CardDescription>
                Previsão de modelo meteorológico para apoiar o planeamento. Não é uma garantia das condições no terreno.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
                {daily.time.map((day, index) => (
                  <div key={day} className="rounded-lg border p-3">
                    <p className="font-medium capitalize">{formatDay(day)}</p>
                    <p className="mt-2 text-sm">{weatherLabel(daily.weather_code[index])}</p>
                    <p className="mt-1 text-lg font-semibold">
                      {Math.round(daily.temperature_2m_max[index])}° / {Math.round(daily.temperature_2m_min[index])}°
                    </p>
                    <p className="mt-2 flex items-center gap-1 text-sm text-muted-foreground">
                      <CloudRain className="h-4 w-4" aria-hidden="true" />
                      {Math.round(daily.precipitation_probability_max[index] ?? 0)}% prob. chuva
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {Number(daily.precipitation_sum[index] ?? 0).toFixed(1)} mm previstos
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Vento até {Math.round(daily.wind_speed_10m_max[index] ?? 0)} km/h
                    </p>
                    <p className="text-xs text-muted-foreground">
                      ET₀ {Number(daily.et0_fao_evapotranspiration[index] ?? 0).toFixed(1)} mm/dia
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Alert>
            <AlertTitle>Como interpretar estes dados</AlertTitle>
            <AlertDescription>
              A probabilidade de chuva e a evapotranspiração são estimativas. Use-as como apoio, não como uma ordem
              automática para irrigar ou aplicar produtos. A necessidade real depende da cultura, do solo e das
              observações locais. {result.advisory}
            </AlertDescription>
          </Alert>

          <p className="text-xs text-muted-foreground">
            {result.attribution} · A previsão meteorológica é fornecida por modelos; não é uma análise direta de imagens de satélite.
          </p>
        </section>
      )}
    </main>
  );
}
