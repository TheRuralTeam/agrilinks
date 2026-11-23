import { useEffect, useState } from 'react';
import { supabase } from '../integrations/supabase/client';

type DeliveryEvidence = {
  id: string;
  freight_load_id: string;
  driver_id: string;
  recipient_name: string;
  photo_path: string;
  signature_path: string;
  latitude: number;
  longitude: number;
  accuracy_m: number | null;
  delivered_at: string;
};

type Props = {
  freightLoadId: string;
  onClose: () => void;
};

export default function FreightDeliveryEvidenceViewer({ freightLoadId, onClose }: Props) {
  const [evidence, setEvidence] = useState<DeliveryEvidence | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const loadEvidence = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data, error: rpcError } = await supabase.rpc('get_freight_delivery_evidence', {
          p_freight_load_id: freightLoadId,
        });
        if (rpcError) throw rpcError;
        if (!data || typeof data !== 'object' || Array.isArray(data)) {
          throw new Error('Ainda não existem evidências de entrega disponíveis.');
        }

        const record = data as unknown as DeliveryEvidence;
        const bucket = supabase.storage.from('freight-delivery-evidence');
        const [{ data: photo, error: photoError }, { data: signature, error: signatureError }] =
          await Promise.all([
            bucket.createSignedUrl(record.photo_path, 600),
            bucket.createSignedUrl(record.signature_path, 600),
          ]);

        if (photoError) throw photoError;
        if (signatureError) throw signatureError;
        if (!photo?.signedUrl || !signature?.signedUrl) {
          throw new Error('Não foi possível abrir os comprovativos privados.');
        }

        if (active) {
          setEvidence(record);
          setPhotoUrl(photo.signedUrl);
          setSignatureUrl(signature.signedUrl);
        }
      } catch (cause) {
        if (active) {
          setError(cause instanceof Error ? cause.message : 'Não foi possível carregar as evidências.');
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadEvidence();
    return () => {
      active = false;
    };
  }, [freightLoadId]);

  return (
    <div className="fixed inset-0 z-[110] grid place-items-center overflow-y-auto bg-black/55 p-3" role="presentation">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="delivery-evidence-viewer-title"
        className="my-auto max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-xl border bg-background p-4 shadow-xl sm:p-6"
      >
        <header className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">AgriLink · Auditoria da entrega</p>
            <h2 id="delivery-evidence-viewer-title" className="mt-1 text-lg font-semibold">Comprovativos do motorista</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-md border px-3 py-1.5 text-sm font-medium">Fechar</button>
        </header>

        {loading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">A carregar evidências seguras…</p>
        ) : error ? (
          <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>
        ) : evidence && photoUrl && signatureUrl ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <figure className="space-y-2">
                <figcaption className="text-sm font-semibold">Produto entregue</figcaption>
                <img src={photoUrl} alt="Fotografia do produto entregue" className="max-h-72 w-full rounded-lg border object-contain" />
              </figure>
              <figure className="space-y-2">
                <figcaption className="text-sm font-semibold">Assinatura do destinatário</figcaption>
                <img src={signatureUrl} alt="Assinatura digital do destinatário" className="max-h-72 w-full rounded-lg border bg-white object-contain" />
              </figure>
            </div>

            <dl className="grid gap-3 rounded-lg border p-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-muted-foreground">Recebido por</dt>
                <dd className="font-medium">{evidence.recipient_name}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Data e hora do servidor</dt>
                <dd className="font-medium">{new Date(evidence.delivered_at).toLocaleString('pt-AO')}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Coordenadas GPS</dt>
                <dd className="font-medium">{evidence.latitude.toFixed(6)}, {evidence.longitude.toFixed(6)}</dd>
                {Number.isFinite(evidence.latitude) && Number.isFinite(evidence.longitude) && (
                  <a
                    className="mt-1 inline-block text-primary underline"
                    href={`https://www.google.com/maps?q=${evidence.latitude},${evidence.longitude}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Ver localização no mapa
                  </a>
                )}
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Precisão GPS</dt>
                <dd className="font-medium">{evidence.accuracy_m == null ? 'Não disponibilizada' : `±${Math.round(evidence.accuracy_m)} m`}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs text-muted-foreground">Identificador da evidência</dt>
                <dd className="break-all font-mono text-xs">{evidence.id}</dd>
              </div>
            </dl>
          </div>
        ) : null}
      </section>
    </div>
  );
}
