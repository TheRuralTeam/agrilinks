import { ArrowLeft, Shield } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";

const PrivacyPolicy = () => {
  const navigate = useNavigate();

  return (
    <main className="min-h-screen bg-white px-4 py-8 text-slate-800">
      <article className="mx-auto max-w-3xl space-y-8">
        <header className="flex items-center gap-4">
          <Button type="button" variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
          <h1 className="text-2xl font-bold">Política de Privacidade</h1>
        </header>

        <section className="space-y-4 rounded-xl bg-slate-50 p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Shield className="h-5 w-5 text-emerald-700" />
            Como tratamos os seus dados
          </h2>
          <p>
            A AgriLink utiliza os dados necessários para criar e proteger a sua conta,
            disponibilizar o mercado, gerir pedidos e entregas e prestar apoio.
          </p>
          <p>
            Esses dados podem incluir informações de contacto e perfil, anúncios,
            pedidos, mensagens e dados de localização quando utiliza funcionalidades
            de logística, como a partilha do percurso de uma carga.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Utilização e partilha</h2>
          <p>
            Utilizamos as informações para operar a plataforma, ligar as partes de uma
            transação, acompanhar entregas solicitadas, proteger contas e responder a
            pedidos de suporte. Partilhamos apenas os dados necessários com as pessoas
            envolvidas numa transação, com serviços que ajudam a operar a plataforma
            ou quando a lei o exigir.
          </p>
          <p>
            Os pagamentos seguem o método disponibilizado para cada operação. Não
            envie palavras-passe, códigos de autenticação ou credenciais financeiras
            por mensagens ou canais de suporte.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Acesso e contacto</h2>
          <p>
            Pode solicitar ajuda para consultar ou corrigir os dados do seu perfil
            através do suporte da plataforma. As informações são mantidas pelo tempo
            necessário para prestar os serviços, proteger a plataforma e cumprir
            obrigações aplicáveis.
          </p>
          <p>
            Para questões sobre privacidade, contacte{" "}
            <a className="font-semibold text-emerald-700 underline" href="mailto:contacto@agrilink.ao">
              contacto@agrilink.ao
            </a>
            .
          </p>
        </section>

        <footer className="border-t pt-5 text-sm text-slate-500">
          Consulte também os{" "}
          <a className="font-semibold text-emerald-700 underline" href="/termos-publicidade">
            Termos de Publicação
          </a>
          .
        </footer>
      </article>
    </main>
  );
};

export default PrivacyPolicy;
