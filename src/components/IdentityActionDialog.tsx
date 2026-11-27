import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "../integrations/supabase/client";
import agrilinkLogo from "../assets/agrilink-logo.png";

export interface IdentityActionDialogProps {
  open: boolean;
  actionLabel: string;
  onOpenChange: (open: boolean) => void;
  onCompleted?: () => void;
}

export default function IdentityActionDialog({
  open,
  actionLabel,
  onOpenChange,
  onCompleted,
}: IdentityActionDialogProps) {
  const [identityDocument, setIdentityDocument] = useState("");
  const [saving, setSaving] = useState(false);

  const close = () => {
    if (!saving) onOpenChange(false);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const value = identityDocument.trim().toUpperCase();
    if (!value) {
      toast.error("Informe o número do Bilhete de Identidade ou NIF.");
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase.rpc("set_my_identity_document", {
        p_identity_document: value,
      });
      if (error) throw error;
      if (!data) throw new Error("Não foi possível atualizar os seus dados de identificação.");
      toast.success("Identificação registada com segurança.");
      setIdentityDocument("");
      onOpenChange(false);
      onCompleted?.();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível registar a identificação.";
      toast.error(message.replace(/^IDENTITY_INVALID:\s*/i, ""));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(value) => !saving && onOpenChange(value)}>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-md overflow-hidden rounded-2xl border-[#DCE8DE] p-0">
        <div className="h-1.5 bg-[#2c863b]" />
        <form onSubmit={submit}>
          <div className="p-5 sm:p-6">
            <DialogHeader>
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#DCE8DE] bg-[#F4FAF5] p-2">
                  <img src={agrilinkLogo} alt="AgriLink" className="h-full w-full object-contain" />
                </div>
                <div>
                  <div className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#2c863b]">
                    Identificação necessária
                  </div>
                  <DialogTitle className="mt-1 text-lg font-extrabold text-[#111714]">
                    Continuar com {actionLabel}
                  </DialogTitle>
                </div>
              </div>
              <DialogDescription className="text-sm leading-6 text-[#5f7163]">
                Para esta operação, a AgriLink precisa apenas do seu número de Bilhete de Identidade (BI) ou NIF.
                Não é necessário completar todo o perfil para continuar a utilizar a plataforma.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-5 rounded-xl border border-[#E5EDE6] bg-[#F7FBF7] p-4">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#2c863b]" />
                <p className="text-xs leading-5 text-[#5f7163]">
                  O dado é guardado no seu perfil e usado para operações que exigem representação ou documentação legal.
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-2">
              <Label htmlFor="agrilink-identity-document" className="text-xs font-bold uppercase tracking-[0.08em] text-[#5f7163]">
                BI ou NIF
              </Label>
              <Input
                id="agrilink-identity-document"
                value={identityDocument}
                onChange={(event) => setIdentityDocument(event.target.value)}
                placeholder="Ex.: 000000000LA000"
                autoComplete="off"
                inputMode="text"
                maxLength={32}
                disabled={saving}
                className="h-12 rounded-xl border-[#DCE8DE] focus-visible:ring-[#2c863b]"
              />
            </div>
          </div>

          <DialogFooter className="border-t border-[#E5EDE6] bg-white px-5 py-4 sm:px-6">
            <Button type="button" variant="ghost" onClick={close} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving} className="rounded-full bg-[#2c863b] px-5 text-white hover:bg-[#246f32]">
              {saving ? "A guardar…" : "Continuar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
