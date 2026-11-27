import { useRef, useState } from 'react';
import type { FormEvent, PointerEvent } from 'react';
import { Loader2, RotateCcw, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../integrations/supabase/client';
type Props = { freightLoadId: string; supplierId: string; driverId: string; expectedQuantityKg: number; onSubmitted: () => void };
const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
function currentPosition(): Promise<GeolocationPosition | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(resolve, () => resolve(null), { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 });
  });
}
function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Não foi possível preparar a assinatura.')), 'image/png'));
}
export default function SupplierHandoverEvidenceForm({ freightLoadId, supplierId, driverId, expectedQuantityKg, onSubmitted }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null), drawingRef = useRef(false), signedRef = useRef(false);
  const [recipientName, setRecipientName] = useState(''), [quantityKg, setQuantityKg] = useState(String(expectedQuantityKg || ''));
  const [conditionNotes, setConditionNotes] = useState(''), [photo, setPhoto] = useState<File | null>(null);
  const [signed, setSigned] = useState(false), [submitting, setSubmitting] = useState(false), [error, setError] = useState<string | null>(null);
  const point = (event: PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current; if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return { x: (event.clientX - rect.left) * canvas.width / rect.width, y: (event.clientY - rect.top) * canvas.height / rect.height };
  };
  const begin = (event: PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current, p = point(event), ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !p) return;
    canvas.setPointerCapture(event.pointerId); ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#17251b'; drawingRef.current = true;
  };
  const draw = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const p = point(event), ctx = canvasRef.current?.getContext('2d'); if (!ctx || !p) return;
    ctx.lineTo(p.x, p.y); ctx.stroke(); signedRef.current = true; setSigned(true);
  };
  const end = () => { drawingRef.current = false; };
  const clearSignature = () => {
    const canvas = canvasRef.current, ctx = canvas?.getContext('2d'); if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height); signedRef.current = false; setSigned(false);
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError(null);
    const quantity = Number(quantityKg);
    if (recipientName.trim().length < 2) return setError('Indique o nome completo do motorista que recebe a carga.');
    if (!Number.isFinite(quantity) || quantity <= 0) return setError('Indique uma quantidade válida em quilogramas.');
    if (!photo || !ALLOWED_IMAGE_TYPES.has(photo.type) || photo.size > MAX_PHOTO_BYTES) return setError('Anexe uma fotografia JPG, PNG ou WebP até 8 MB.');
    if (!signedRef.current || !canvasRef.current) return setError('A assinatura do fornecedor é obrigatória.');
    setSubmitting(true);
    let photoPath: string | null = null, signaturePath: string | null = null, rpcStarted = false, rpcReturned = false;
    try {
      const position = await currentPosition(), signature = await canvasBlob(canvasRef.current);
      const folder = freightLoadId + '/' + supplierId, proofId = crypto.randomUUID();
      const ext = photo.type === 'image/png' ? 'png' : photo.type === 'image/webp' ? 'webp' : 'jpg';
      photoPath = folder + '/' + proofId + '-handover.' + ext;
      signaturePath = folder + '/' + proofId + '-supplier-signature.png';
      const bucket = supabase.storage.from('freight-handover-evidence');
      const photoUpload = await bucket.upload(photoPath, photo, { contentType: photo.type, upsert: false });
      if (photoUpload.error) throw photoUpload.error;
      const signatureUpload = await bucket.upload(signaturePath, signature, { contentType: 'image/png', upsert: false });
      if (signatureUpload.error) throw signatureUpload.error;
      rpcStarted = true;
      const { data, error: rpcError } = await supabase.rpc('submit_supplier_handover_evidence', {
        p_freight_load_id: freightLoadId, p_recipient_name: recipientName.trim(), p_product_quantity_kg: quantity,
        p_condition_notes: conditionNotes.trim() || null, p_photo_path: photoPath, p_supplier_signature_path: signaturePath,
        p_latitude: position?.coords.latitude ?? null, p_longitude: position?.coords.longitude ?? null,
        p_accuracy_m: position?.coords.accuracy ?? null,
      });
      rpcReturned = true; if (rpcError) throw rpcError;
      if (!data) throw new Error('O servidor não devolveu o identificador do comprovativo.');
      toast.success('Nota de entrega emitida. Aguarda a confirmação do motorista.'); onSubmitted();
    } catch (cause) {
      if (!rpcStarted || rpcReturned) await supabase.storage.from('freight-handover-evidence').remove([photoPath, signaturePath].filter((path): path is string => Boolean(path))).catch(() => undefined);
      setError(cause instanceof Error ? cause.message : 'Não foi possível emitir a nota de entrega.');
    } finally { setSubmitting(false); }
  };
  return (
    <section className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 dark:border-emerald-900 dark:bg-emerald-950/10">
      <div className="mb-3"><p className="text-xs font-bold uppercase tracking-wide text-emerald-800 dark:text-emerald-300">AgriLink · Custódia da carga</p><h4 className="mt-1 font-semibold">Emitir nota de entrega ao motorista</h4><p className="mt-1 text-sm text-muted-foreground">Registe quantidade, estado, fotografia e assinatura. O motorista confirma a recepção na própria conta antes do transporte.</p></div>
      <form onSubmit={(event) => void submit(event)} className="space-y-3">
        <label className="block space-y-1"><span className="text-sm font-medium">Nome do motorista que recebe</span><input value={recipientName} onChange={(event) => setRecipientName(event.target.value)} maxLength={160} required className="w-full rounded-md border bg-background px-3 py-2 text-sm" placeholder="Nome completo conforme o perfil" /></label>
        <label className="block space-y-1"><span className="text-sm font-medium">Quantidade entregue (kg)</span><input type="number" min="0.01" step="0.01" value={quantityKg} onChange={(event) => setQuantityKg(event.target.value)} required className="w-full rounded-md border bg-background px-3 py-2 text-sm" /></label>
        <label className="block space-y-1"><span className="text-sm font-medium">Estado e observações da mercadoria</span><textarea value={conditionNotes} onChange={(event) => setConditionNotes(event.target.value)} maxLength={1200} rows={3} className="w-full rounded-md border bg-background px-3 py-2 text-sm" placeholder="Embalagens, qualidade visível, diferenças de quantidade…" /></label>
        <label className="block space-y-1"><span className="text-sm font-medium">Fotografia da carga no momento da entrega</span><input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={(event) => setPhoto(event.target.files?.[0] || null)} className="block w-full text-sm" /></label>
        <div><div className="mb-1 flex items-center justify-between"><span className="text-sm font-medium">Assinatura do fornecedor</span><button type="button" onClick={clearSignature} className="inline-flex items-center gap-1 text-xs text-muted-foreground"><RotateCcw size={13} /> Limpar</button></div><canvas ref={canvasRef} width={640} height={180} onPointerDown={begin} onPointerMove={draw} onPointerUp={end} onPointerCancel={end} onPointerLeave={end} className="h-32 w-full touch-none rounded-md border bg-white" aria-label="Área para assinatura do fornecedor" /><p className="mt-1 text-xs text-muted-foreground">{signed ? 'Assinatura capturada.' : 'Assine dentro da área acima.'}</p></div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <button type="submit" disabled={submitting} className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 text-sm font-semibold text-white disabled:opacity-60">{submitting ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}{submitting ? 'A emitir nota…' : 'Emitir nota e aguardar confirmação'}</button>
      </form>
    </section>
  );
}
