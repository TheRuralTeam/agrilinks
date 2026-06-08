import React, { useEffect, useRef } from 'react';

declare global { interface Window { L?: any } }

let loaderPromise: Promise<any> | null = null;
function loadLeaflet(): Promise<any> {
  if (window.L) return Promise.resolve(window.L);
  if (loaderPromise) return loaderPromise;
  loaderPromise = new Promise((resolve, reject) => {
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }
    const existing = document.getElementById('leaflet-js') as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', () => resolve(window.L));
      existing.addEventListener('error', reject);
      return;
    }
    const s = document.createElement('script');
    s.id = 'leaflet-js';
    s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    s.async = true;
    s.onload = () => resolve(window.L);
    s.onerror = reject;
    document.head.appendChild(s);
  });
  return loaderPromise;
}

export interface LeafletMarker {
  lat: number;
  lng: number;
  color?: string;
  popupHtml?: string;
}

interface Props {
  center?: { lat: number; lng: number };
  zoom?: number;
  markers?: LeafletMarker[];
  onClick?: (coords: { lat: number; lng: number }) => void;
  height?: number | string;
  className?: string;
  style?: React.CSSProperties;
  clickMarkerColor?: string;
}

const SimpleLeafletMap: React.FC<Props> = ({
  center = { lat: -11.2, lng: 17.8 },
  zoom = 6,
  markers = [],
  onClick,
  height = 280,
  className,
  style,
  clickMarkerColor = '#1A5C24',
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const layerRef = useRef<any>(null);
  const clickMarkerRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;
    loadLeaflet().then(L => {
      if (cancelled || !ref.current || mapRef.current) return;
      const m = L.map(ref.current, { center: [center.lat, center.lng], zoom });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap', maxZoom: 19,
      }).addTo(m);
      mapRef.current = m;
      layerRef.current = L.layerGroup().addTo(m);
      if (onClick) {
        m.on('click', (e: any) => {
          const c = { lat: e.latlng.lat, lng: e.latlng.lng };
          if (clickMarkerRef.current) clickMarkerRef.current.setLatLng([c.lat, c.lng]);
          else clickMarkerRef.current = L.circleMarker([c.lat, c.lng], {
            radius: 9, fillColor: clickMarkerColor, fillOpacity: 0.95, color: '#fff', weight: 2,
          }).addTo(m);
          onClick(c);
        });
      }
      // initial markers
      renderMarkers(L);
      setTimeout(() => m.invalidateSize(), 100);
    }).catch(() => {/* noop */});
    return () => {
      cancelled = true;
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
      layerRef.current = null;
      clickMarkerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const renderMarkers = (L: any) => {
    if (!layerRef.current) return;
    layerRef.current.clearLayers();
    markers.forEach(mk => {
      const marker = L.circleMarker([mk.lat, mk.lng], {
        radius: 10, fillColor: mk.color || '#1A5C24', fillOpacity: 0.95, color: '#fff', weight: 2,
      }).addTo(layerRef.current);
      if (mk.popupHtml) marker.bindPopup(mk.popupHtml);
    });
  };

  useEffect(() => {
    if (!window.L || !mapRef.current) return;
    renderMarkers(window.L);
    if (markers.length === 1) {
      mapRef.current.setView([markers[0].lat, markers[0].lng], zoom);
    } else if (markers.length > 1) {
      const b = window.L.latLngBounds(markers.map(m => [m.lat, m.lng]));
      mapRef.current.fitBounds(b, { padding: [30, 30] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(markers)]);

  return <div ref={ref} className={className} style={{ width: '100%', height, ...style }} />;
};

export default SimpleLeafletMap;
