import { useRef, useState } from 'react';
import { supabase } from '../integrations/supabase/client';

type Props = {
  freightLoadId: string;
  driverId: string;
  onCancel: () => void;
  onSubmitted: () => void;
};

const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Este dispositivo não disponibiliza localização GPS.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
    });
  });
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Não foi possível preparar a assinatura.'));
    }, 'image/png');
  });
}

export default function FreightDeliveryEvidenceForm({
  freightLoadId,
  driverId,
  onCancel,
  onSubmitted,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const hasSignatureRef = useRef(false);
  const [recipientName, setRecipientName] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [hasSignature, setHasSignature] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const point = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (canvas.width / rect.width),
      y: (event.clientY - rect.top) * (canvas.height / rect.height),
    };
  };

  const startSignature = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const position = point(event);
    const context = canvas?.getContext('2d');
    if (!canvas || !context || !position) return;
    canvas.setPointerCapture(event.pointerId);
    context.beginPath();
    context.moveTo(position.x, position.y);
    context.lineWidth = 5;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.strokeStyle = '#17251b';
    drawingRef.current = true;
  };

  const drawSignature = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const position = point(event);
    const context = canvasRef.current?.getContext('2d');
    if (!context || !position) return;
    context.lineTo(position.x, position.y);
    context.stroke();
    hasSignatureRef.current = true;
    setHasSignature(true);
  };

  const stopSignature = () => {
    drawingRef.current = false;
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    hasSignatureRef.current = false;
    setHasSignature(false);
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (recipientName.trim().length < 2) {
      setError('Indique o nome de quem recebeu a mercadoria.');
      return;
    }
    if (!photo) {
      setError('A fotografia do produto entregue é obrigatória.');
      return;
    }
    if (!ALLOWED_IMAGE_TYPES.has(photo.type) || photo.size > MAX_PHOTO_BYTES) {
      setError('A fotografia deve ser JPG, PNG ou WebP e não pode exceder 8 MB.');
      return;
    }
    if (!hasSignatureRef.current || !canvasRef.current) {
      setError('A assinatura do destinatário é obrigatória.');
      return;
    }

    setSubmitting(true);
    let photoPath: string | null = null;
    let signaturePath: string | null = null;

    try {
      const position = await getCurrentPosition();
      const signatureBlob = await canvasToBlob(canvasRef.current);
      const evidenceFolder = `${freightLoadId}/${driverId}`;
      const evidenceId = crypto.randomUUID();
      photoPath = `${evidenceFolder}/${evidenceId}-delivery-photo.${photo.type === 'image/png' ? 'png' : photo.type === 'image/webp' ? 'webp' : 'jpg'}`;
      signaturePath = `${evidenceFolder}/${evidenceId}-recipient-signature.png`;

      const bucket = supabase.storage.from('freight-delivery-evidence');
      const photoUpload = await bucket.upload(photoPath, photo, {
        contentType: photo.type,
        upsert: false,
      });
      if (photoUpload.error) throw photoUpload.error;

      const signatureUpload = await bucket.upload(signaturePath, signatureBlob, {
        contentType: 'image/png',
        upsert: false,
      });
      if (signatureUpload.error) throw signatureUpload.error;

      const { error: submitError } = await supabase.rpc('submit_freight_delivery_evidence', {
        p_freight_load_id: freightLoadId,
        p_recipient_name: recipientName.trim(),
        p_photo_path: photoPath,
        p_signature_path: signaturePath,
        p_latitude: position.coords.latitude,
        p_longitude: position.coords.longitude,
        p_accuracy_m: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : null,
      });
      if (submitError) throw submitError;

      onSubmitted();
    } catch (cause) {
      if (photoPath || signaturePath) {
        await supabase.storage.from('freight-delivery-evidence').remove(
          [photoPath, signaturePath].filter((path): path is string => Boolean(path)),
        ).catch(() => undefined);
      }
      const message = cause instanceof Error ? cause.message : 'Não foi possível registar as evidências da entrega.';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-black/55 p-3" role="presentation">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="delivery-evidence-title"
        className="my-auto w-full max-w-xl rounded-xl border bg-background p-4 shadow-xl sm:p-6"
      >
        <header className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">AgriLink · Prova de entrega</p>
          <h2 id="delivery-evidence-title" className="mt-1 text-lg font-semibold">Registar entrega ao comprador</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            A entrega só será confirmada depois de guardar a fotografia, a assinatura e a localização GPS.
          </p>
        </header>

        <form onSubmit={(event) => void submit(event)} className="space-y-4">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Nome de quem recebeu</span>
            <input
              value={recipientName}
              onChange={(event) => setRecipientName(event.target.value)}
              maxLength={160}
              required
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              placeholder="Nome completo do destinatário"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Fotografia do produto entregue</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              required
              onChange={(event) => setPhoto(event.target.files?.[0] ?? null)}
              className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-2"
            />
            <span className="text-xs text-muted-foreground">JPG, PNG ou WebP · máximo 8 MB.</span>
          </label>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium">Assinatura do destinatário</span>
              <button type="button" onClick={clearSignature} className="text-xs font-semibold text-primary">Limpar assinatura</button>
            </div>
            <canvas
              ref={canvasRef}
              width={1120}
              height={360}
              onPointerDown={startSignature}
              onPointerMove={drawSignature}
              onPointerUp={stopSignature}
              onPointerCancel={stopSignature}
              onPointerLeave={stopSignature}
              className="h-36 w-full touch-none rounded-md border bg-white"
              aria-label="Área para assinatura do destinatário"
            />
            <span className="text-xs text-muted-foreground">{hasSignature ? 'Assinatura capturada.' : 'O destinatário deve assinar no espaço acima.'}</span>
          </div>

          <div className="rounded-md border bg-muted/30 p-3 text-xs leading-relaxed text-muted-foreground">
            A aplicação irá solicitar a localização GPS actual e registar automaticamente a data e hora do servidor. Sem GPS, fotografia ou assinatura, a entrega não será concluída.
          </div>

          {error && <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={onCancel} disabled={submitting} className="rounded-md border px-4 py-2 text-sm font-medium disabled:opacity-50">Cancelar</button>
            <button type="submit" disabled={submitting} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
              {submitting ? 'A guardar evidências…' : 'Guardar evidências e confirmar entrega'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
