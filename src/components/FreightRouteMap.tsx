import { useEffect } from 'react';
import L from 'leaflet';
import {
  CircleMarker,
  MapContainer,
  Polyline,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import { MAP_TILE_LAYERS } from '../lib/mapTiles';
import type { FreightCoordinate, FreightRoute } from '../lib/freightGeo';

export type FreightPointSelection = 'origin' | 'destination';

interface FreightRouteMapProps {
  origin: FreightCoordinate | null;
  destination: FreightCoordinate | null;
  route?: FreightRoute | null;
  driverLocation?: FreightCoordinate | null;
  activeSelection?: FreightPointSelection | null;
  onSelectPoint?: (coordinate: FreightCoordinate) => void;
  height?: number;
}

const luandaCenter: FreightCoordinate = [-8.8383, 13.2344];

function MapPointSelector({
  activeSelection,
  onSelectPoint,
}: Pick<FreightRouteMapProps, 'activeSelection' | 'onSelectPoint'>) {
  useMapEvents({
    click(event) {
      if (activeSelection) onSelectPoint?.([event.latlng.lat, event.latlng.lng]);
    },
  });

  return null;
}

function FitFreightBounds({
  origin,
  destination,
  route,
  driverLocation,
}: Pick<FreightRouteMapProps, 'origin' | 'destination' | 'route' | 'driverLocation'>) {
  const map = useMap();

  useEffect(() => {
    const points = route?.coordinates.length
      ? route.coordinates
      : [origin, destination, driverLocation].filter(
          (coordinate): coordinate is FreightCoordinate => coordinate !== null
        );

    if (points.length > 1) {
      const bounds = L.latLngBounds(
        points.map(([latitude, longitude]) => L.latLng(latitude, longitude))
      );
      map.fitBounds(bounds, { padding: [28, 28], maxZoom: 12 });
    } else if (points.length === 1) {
      map.setView(points[0], 13);
    }
  }, [destination, driverLocation, map, origin, route]);

  return null;
}

export function FreightRouteMap({
  origin,
  destination,
  route = null,
  driverLocation = null,
  activeSelection = null,
  onSelectPoint,
  height = 320,
}: FreightRouteMapProps) {
  return (
    <MapContainer
      center={origin ?? destination ?? luandaCenter}
      zoom={10}
      scrollWheelZoom={false}
      style={{ width: '100%', height }}
    >
      <TileLayer
        url={MAP_TILE_LAYERS.light.url}
        attribution={MAP_TILE_LAYERS.light.attribution}
        subdomains={MAP_TILE_LAYERS.subdomains}
        maxZoom={MAP_TILE_LAYERS.maxZoom}
      />
      <MapPointSelector activeSelection={activeSelection} onSelectPoint={onSelectPoint} />
      <FitFreightBounds
        origin={origin}
        destination={destination}
        route={route}
        driverLocation={driverLocation}
      />
      {route?.coordinates.length ? (
        <Polyline
          positions={route.coordinates}
          pathOptions={{ color: '#2c863b', weight: 5, opacity: 0.85 }}
        />
      ) : null}
      {origin ? (
        <CircleMarker
          center={origin}
          radius={8}
          pathOptions={{ color: '#ffffff', weight: 3, fillColor: '#2c863b', fillOpacity: 1 }}
        >
          <Tooltip>Origem</Tooltip>
        </CircleMarker>
      ) : null}
      {destination ? (
        <CircleMarker
          center={destination}
          radius={8}
          pathOptions={{ color: '#ffffff', weight: 3, fillColor: '#d18b16', fillOpacity: 1 }}
        >
          <Tooltip>Destino</Tooltip>
        </CircleMarker>
      ) : null}
      {driverLocation ? (
        <CircleMarker
          center={driverLocation}
          radius={9}
          pathOptions={{ color: '#ffffff', weight: 3, fillColor: '#1769aa', fillOpacity: 1 }}
        >
          <Tooltip>Motorista · posição mais recente</Tooltip>
        </CircleMarker>
      ) : null}
    </MapContainer>
  );
}
