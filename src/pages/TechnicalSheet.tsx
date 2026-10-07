import { useEffect, useState } from "react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Separator } from "../components/ui/separator";
import { ArrowLeft, Download, Phone, MapPin, Calendar, Package, DollarSign, Truck, BadgeCheck } from "lucide-react";
import { toast } from "sonner";
import Loader from "../components/ui/Loader";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../integrations/supabase/client";
import { downloadTechnicalSheetPdf } from "../lib/technicalSheetPdf";

interface Product {
  id: string;
  product_type: string;
  province_id: string;
  municipality_id: string;
  farmer_name: string;
  quantity: number;
  harvest_date: string;
  price: number;
  logistics_access: string;
  contact: string;
  description?: string;
  created_at: string;
  updated_at?: string | null;
  status?: string | null;
  category?: string | null;
  location_lat?: number | null;
  location_lng?: number | null;
}

const TechnicalSheet = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const fetchProduct = async () => {
      if (!id) {
        if (active) {
          setError("ID do produto não fornecido");
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      try {
        const { data, error: fetchError } = await supabase
          .from("products")
          .select("*")
          .eq("id", id)
          .maybeSingle();

        if (fetchError) throw fetchError;
        if (!active) return;

        if (!data) {
          setError("Produto não encontrado");
          setProduct(null);
        } else {
          setError(null);
          setProduct(data as Product);
        }
      } catch (err) {
        console.error("[AgriLink] Erro ao carregar ficha técnica:", err);
        if (active) {
          setError("Não foi possível carregar a ficha técnica.");
          setProduct(null);
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    void fetchProduct();
    return () => {
      active = false;
    };
  }, [id]);

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return "Não indicada";
    const value = new Date(dateString);
    return Number.isNaN(value.getTime())
      ? "Não indicada"
      : value.toLocaleDateString("pt-AO", { day: "2-digit", month: "long", year: "numeric" });
  };

  const formatDateTime = (dateString?: string | null) => {
    if (!dateString) return "—";
    const value = new Date(dateString);
    return Number.isNaN(value.getTime()) ? "—" : value.toLocaleString("pt-AO");
  };

  const formatPrice = (price?: number | null) => {
    if (price == null || !Number.isFinite(Number(price))) return "Não indicado";
    return `${Number(price).toLocaleString("pt-AO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Kz/kg`;
  };

  const handleExportPDF = async () => {
    if (!product || pdfLoading) return;
    setPdfLoading(true);
    try {
      await downloadTechnicalSheetPdf(product);
      toast.success("Ficha técnica baixada em PDF.");
    } catch (error) {
      console.error("[AgriLink] Erro ao gerar ficha técnica PDF:", error);
      toast.error("Não foi possível gerar o PDF. Tente novamente.");
    } finally {
      setPdfLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader />
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md rounded-2xl border-[#DCE8DE]">
          <CardHeader>
            <CardTitle className="text-[#111714]">Ficha técnica indisponível</CardTitle>
            <CardDescription>{error || "A ficha técnica solicitada não existe."}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate("/app")} className="w-full rounded-full bg-[#2c863b] hover:bg-[#246f32]">
              Voltar ao início
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const locationLabel = [product.municipality_id, product.province_id].filter(Boolean).join(" — ") || "Localização não indicada";

  return (
    <div className="min-h-screen bg-[#F7F9F7]">
      <header className="sticky top-0 z-40 border-b border-[#E5EDE6] bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="shrink-0 rounded-full hover:bg-[#F2FAF3]">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0">
              <div className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#2c863b]">AgriLink · Ficha técnica</div>
              <h1 className="truncate text-lg font-extrabold tracking-tight text-[#111714] sm:text-xl">{product.product_type}</h1>
            </div>
          </div>
          <Button onClick={() => void handleExportPDF()} disabled={pdfLoading} className="w-full gap-2 rounded-full bg-[#2c863b] text-white hover:bg-[#246f32] sm:w-auto">
            <Download className="h-4 w-4" />
            {pdfLoading ? "A preparar PDF…" : "Baixar PDF"}
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl space-y-5 px-3 py-4 sm:px-6 sm:py-8">
        <Card className="overflow-hidden rounded-2xl border-[#DCE8DE] bg-white shadow-[0_14px_45px_rgba(13,43,18,0.07)]">
          <CardHeader className="border-b border-[#E5EDE6] bg-[#F4FAF5] px-4 py-6 sm:px-7">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-[#DCE8DE] bg-white px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.13em] text-[#2c863b]">
                  <BadgeCheck className="h-3.5 w-3.5" /> Documento digital
                </div>
                <CardTitle className="break-words text-2xl font-extrabold text-[#111714] sm:text-4xl">{product.product_type}</CardTitle>
                <CardDescription className="mt-2 text-sm text-[#758A79]">{locationLabel}</CardDescription>
              </div>
              <div className="shrink-0 rounded-xl border border-[#DCE8DE] bg-white px-3 py-2 text-xs font-bold text-[#2c863b]">
                ID · {product.id}
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-full bg-[#2c863b] px-3 py-1 text-[11px] font-bold text-white">{product.status || "Estado não indicado"}</span>
              {product.category && <span className="rounded-full border border-[#DCE8DE] bg-white px-3 py-1 text-[11px] font-bold text-[#3D4D40]">{product.category}</span>}
              <span className="rounded-full border border-[#DCE8DE] bg-white px-3 py-1 text-[11px] font-bold text-[#3D4D40]">Disponibilidade · {Number(product.quantity || 0).toLocaleString("pt-AO")} kg</span>
            </div>
          </CardHeader>

          <CardContent className="space-y-5 px-4 py-5 sm:space-y-6 sm:px-7 sm:py-7">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-[#E5EDE6] bg-white p-4">
                <div className="mb-1 text-[10px] font-extrabold uppercase tracking-[0.11em] text-[#758A79]">Fornecedor / produtor</div>
                <div className="break-words text-sm font-semibold text-[#111714]">{product.farmer_name || "Não indicado"}</div>
              </div>
              <div className="rounded-xl border border-[#E5EDE6] bg-white p-4">
                <div className="mb-1 text-[10px] font-extrabold uppercase tracking-[0.11em] text-[#758A79]">Contacto</div>
                <div className="break-words text-sm font-semibold text-[#111714]">{product.contact || "Não indicado"}</div>
              </div>
              <div className="rounded-xl border border-[#E5EDE6] bg-white p-4">
                <div className="mb-1 text-[10px] font-extrabold uppercase tracking-[0.11em] text-[#758A79]">Quantidade disponível</div>
                <div className="text-xl font-extrabold text-[#2c863b]">{Number(product.quantity || 0).toLocaleString("pt-AO")} kg</div>
              </div>
              <div className="rounded-xl border border-[#E5EDE6] bg-white p-4">
                <div className="mb-1 text-[10px] font-extrabold uppercase tracking-[0.11em] text-[#758A79]">Preço</div>
                <div className="text-xl font-extrabold text-[#2c863b]">{formatPrice(product.price)}</div>
              </div>
              <div className="rounded-xl border border-[#E5EDE6] bg-white p-4">
                <div className="mb-1 text-[10px] font-extrabold uppercase tracking-[0.11em] text-[#758A79]">Data de colheita</div>
                <div className="text-sm font-semibold text-[#111714]">{formatDate(product.harvest_date)}</div>
              </div>
              <div className="rounded-xl border border-[#E5EDE6] bg-white p-4">
                <div className="mb-1 text-[10px] font-extrabold uppercase tracking-[0.11em] text-[#758A79]">Região</div>
                <div className="break-words text-sm font-semibold text-[#111714]">{locationLabel}</div>
              </div>
            </div>

            <div className="rounded-xl border border-[#E5EDE6] bg-[#F7FBF7] p-4 sm:p-5">
              <div className="mb-2 flex items-center gap-2 text-sm font-extrabold text-[#111714]">
                <Truck className="h-4 w-4 text-[#2c863b]" /> Acesso logístico
              </div>
              <p className="break-words text-sm leading-6 text-[#5f7163]">{product.logistics_access || "Não indicado"}</p>
            </div>

            {product.location_lat != null && product.location_lng != null && (
              <div className="rounded-xl border border-[#E5EDE6] bg-white p-4 sm:p-5">
                <div className="mb-2 flex items-center gap-2 text-sm font-extrabold text-[#111714]">
                  <MapPin className="h-4 w-4 text-[#2c863b]" /> Coordenadas de origem
                </div>
                <p className="font-mono text-xs text-[#5f7163]">{Number(product.location_lat).toFixed(6)}, {Number(product.location_lng).toFixed(6)}</p>
              </div>
            )}

            {product.description && (
              <div className="rounded-xl border border-[#E5EDE6] bg-white p-4 sm:p-5">
                <div className="mb-2 text-sm font-extrabold text-[#111714]">Descrição</div>
                <p className="whitespace-pre-wrap break-words text-sm leading-6 text-[#5f7163]">{product.description}</p>
              </div>
            )}

            <div className="grid gap-3 border-t border-[#E5EDE6] pt-5 sm:grid-cols-2">
              <div className="rounded-xl bg-[#F7F9F7] p-4">
                <div className="text-[10px] font-extrabold uppercase tracking-[0.11em] text-[#758A79]">Criado em</div>
                <div className="mt-1 text-sm font-semibold text-[#111714]">{formatDateTime(product.created_at)}</div>
              </div>
              <div className="rounded-xl bg-[#F7F9F7] p-4">
                <div className="text-[10px] font-extrabold uppercase tracking-[0.11em] text-[#758A79]">Atualizado em</div>
                <div className="mt-1 text-sm font-semibold text-[#111714]">{formatDateTime(product.updated_at)}</div>
              </div>
            </div>

            <Separator />
            <div className="text-center">
              <p className="text-xs text-[#758A79]">Ficha técnica oficial AgriLink para consulta e partilha digital.</p>
              <p className="mt-1 text-sm font-extrabold text-[#2c863b]">Conexão de mercado</p>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default TechnicalSheet;
