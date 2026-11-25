import { useNavigate } from "react-router-dom";
import { ArrowLeft, Landmark } from "lucide-react";
import { Button } from "../components/ui/button";
import AdminPaymentRecipients from "../components/admin/AdminPaymentRecipients";

export default function AdminPaymentMethods() {
  const navigate = useNavigate();

  return (
    <main className="min-h-screen bg-[#F7F9F7] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-col gap-4 border-b border-[#E3EAE4] pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Button variant="ghost" size="sm" className="-ml-2 mb-2" onClick={() => navigate("/admindashboard")}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Voltar ao painel
            </Button>
            <div className="flex items-center gap-2 text-sm font-semibold text-[#47724F]">
              <Landmark className="h-4 w-4" /> Administração financeira
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#17251A]">Coordenadas bancárias</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Gerir as contas oficiais da AgriLink utilizadas para receber pagamentos de produtos e transporte.
            </p>
          </div>
        </header>
        <AdminPaymentRecipients />
      </div>
    </main>
  );
}
