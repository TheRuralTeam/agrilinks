import React, { useMemo, useState } from "react";
import {
  ArrowLeft, ArrowRight, BookOpen, Building2, CheckCircle2, ChevronDown,
  Clipboard, Copy, Download, Handshake, Headphones, Leaf, Menu, Search,
  ShieldCheck, ShoppingBasket, Sprout, Target, Truck, Users, Wallet,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Separator } from "../components/ui/separator";
import { toast } from "sonner";

const sections = [
  { id: "mentalidade", title: "1. Mentalidade comercial", description: "Vender benefícios e resolver necessidades, não apenas apresentar uma aplicação." },
  { id: "personalidades", title: "2. Estilos comportamentais", description: "Adaptar a comunicação sem rotular ou manipular pessoas." },
  { id: "abordagem", title: "3. Abordagem de desconhecidos", description: "Conquistar autorização para conversar e descobrir necessidades." },
  { id: "segmentos", title: "4. Argumentos por segmento", description: "Agricultores, fazendas, cooperativas, compradores, restaurantes, motoristas e consumidores." },
  { id: "confianca", title: "5. Pessoas desconfiadas e objecções", description: "Responder com respeito, transparência e sem promessas impossíveis." },
  { id: "custos", title: "6. Custos e condições comerciais", description: "Explicar taxas e pagamentos antes de qualquer adesão." },
  { id: "persuasao", title: "7. Persuasão consultiva", description: "Perguntar, demonstrar, contextualizar e propor pequenos passos." },
  { id: "guiões", title: "8. Guiões de conversa", description: "Textos prontos para abordagens presenciais e institucionais." },
  { id: "conversao", title: "9. Conversão e activação", description: "Do primeiro contacto à primeira operação e recorrência." },
  { id: "situacoes", title: "10. Situações difíceis", description: "Respostas práticas para dúvidas e resistências comuns." },
  { id: "terreno", title: "11. Prospecção no terreno", description: "Onde procurar cada público e como organizar as visitas." },
  { id: "rede", title: "12. Crescimento por recomendações", description: "Equilibrar produtores, compradores e capacidade logística." },
  { id: "plano", title: "13. Plano de execução de 30 dias", description: "Transformar o manual em actividade e indicadores." },
  { id: "ficha", title: "14. Ficha de prospecção", description: "Registar contactos, necessidades, objecções e próximos passos." },
  { id: "conduta", title: "15. Código de conduta", description: "Padrões mínimos de ética e profissionalismo." },
  { id: "visao", title: "16. Visão da AgriLink", description: "Explicar o valor da rede agroalimentar." },
  { id: "discurso", title: "17. Discurso institucional", description: "Apresentação-base para toda a equipa." },
  { id: "referencias", title: "18. Referências operacionais", description: "Canais oficiais e verificação de informação." },
];

const styles = [
  { name: "Dominante", tag: "Directo e orientado para resultados", need: "Resultados, rapidez, controlo e rentabilidade.", approach: "Apresente vantagens concretas, próximos passos e informação objectiva.", phrase: "Temos uma rede que pode aproximar a sua produção de novos compradores. Vamos verificar como podemos apresentar os seus produtos." },
  { name: "Influente", tag: "Comunicativo e entusiasta", need: "Relações, oportunidades, expansão e reconhecimento.", approach: "Mostre a dimensão da rede e as possibilidades de criar novas relações comerciais.", phrase: "Imagine a sua actividade ligada a produtores, compradores e parceiros de várias regiões. É uma oportunidade para ampliar a sua rede comercial." },
  { name: "Estável", tag: "Calmo e orientado para confiança", need: "Segurança, acompanhamento, previsibilidade e tempo para decidir.", approach: "Explique com calma, demonstre o processo e acompanhe o primeiro registo sem pressionar.", phrase: "Podemos conhecer a plataforma com calma. Explicamos como funciona e acompanhamos os primeiros passos." },
  { name: "Conforme", tag: "Analítico e criterioso", need: "Precisão, regras, números, provas e transparência.", approach: "Apresente condições, taxas, etapas operacionais e uma demonstração real.", phrase: "Vou mostrar como são publicados os produtos, como funciona a negociação e quais são as condições de cada operação." },
];

const audiences = [
  { title: "Agricultores e pequenos produtores", icon: Sprout, seek: ["Encontrar compradores e novas oportunidades.", "Reduzir o risco de perdas por falta de escoamento.", "Apresentar produtos, quantidades, preços e localização.", "Diversificar os canais de comercialização."], pitch: "O senhor já faz a parte mais difícil: produzir. A AgriLink quer ajudá-lo a aproximar essa produção de quem precisa de comprar.", example: "Um agricultor produz tomate, cebola e repolho, mas vende apenas no mercado local. Pode apresentar esses produtos na AgriLink com fotografias, quantidade, preço e localização, para que potenciais compradores os possam consultar.", close: "Que produtos tem disponíveis neste momento? Podemos começar por registar um deles e mostrar-lhe como funciona." },
  { title: "Grandes fazendeiros e produtores comerciais", icon: Building2, seek: ["Escoamento de grandes quantidades.", "Compradores comerciais e fornecimento recorrente.", "Planeamento de vendas e encomendas.", "Organização da logística."], pitch: "A AgriLink pretende aproximar a produção agrícola da procura comercial e criar oportunidades para que fazendas e compradores estabeleçam relações de fornecimento mais organizadas.", example: "Uma fazenda produz 20 toneladas de batata por ciclo. Em vez de falar apenas de publicação, descubra o volume mensal, produtos, quantidade disponível, compradores actuais, capacidade de transporte e antecedência necessária.", close: "Gostaríamos de conhecer a capacidade produtiva da fazenda e avaliar como integrar as suas ofertas na rede. Podemos começar com um produto e uma quantidade disponíveis." },
  { title: "Cooperativas e associações agrícolas", icon: Users, seek: ["Criar oportunidades para os membros.", "Organizar ofertas e volumes colectivos.", "Aumentar o acesso ao mercado.", "Dar visibilidade à produção da comunidade."], pitch: "A AgriLink pode ajudar a aproximar a produção dos membros da cooperativa dos compradores, tornando as ofertas mais acessíveis e organizadas.", example: "Uma cooperativa reúne 35 agricultores que produzem milho, feijão e mandioca. Comece por identificar produtos, volumes, responsáveis pelas ofertas e produtores interessados.", close: "Podemos marcar uma apresentação para a direcção e explicar aos membros como participar na rede." },
  { title: "Comerciantes, grossistas e compradores", icon: ShoppingBasket, seek: ["Encontrar novos fornecedores.", "Comprar quantidades adequadas a preços competitivos.", "Reduzir dificuldades de abastecimento.", "Comparar ofertas, qualidade, origem e transporte."], pitch: "Em vez de depender apenas dos fornecedores que já conhece, pode utilizar a AgriLink para descobrir novas ofertas agrícolas e estabelecer contacto comercial com produtores.", example: "Um grossista precisa de 500 kg de tomate por semana. Descubra volume, qualidade pretendida, local de entrega, frequência e orçamento antes de apresentar a plataforma.", close: "Vamos registar a sua necessidade de compra e verificar as ofertas disponíveis na rede." },
  { title: "Restaurantes, hotéis e empresas de alimentação", icon: Building2, seek: ["Produtos frescos e fornecimento regular.", "Preços e quantidades previsíveis.", "Menos dificuldades na aquisição.", "Fornecedores com capacidade de atender a procura."], pitch: "A AgriLink aproxima o seu negócio da origem dos produtos agrícolas, permitindo consultar ofertas e negociar com fornecedores.", example: "Um restaurante consome semanalmente 100 kg de batata, 50 kg de tomate e 30 kg de cebola. Identifique os produtos prioritários e procure produtores com capacidade para atender a necessidade.", close: "Podemos começar pelos três produtos que mais utiliza e procurar ofertas adequadas às suas necessidades." },
  { title: "Motoristas e transportadores", icon: Truck, seek: ["Consultar oportunidades de carga.", "Avaliar origem, destino, distância e frete.", "Encontrar operações compatíveis com a viatura.", "Evitar aceitar serviços que não consegue cumprir."], pitch: "A AgriLink liga motoristas a necessidades de transporte de produtos agrícolas. Pode consultar cargas disponíveis e aceitar aquelas que se adequam à sua viatura, rota e disponibilidade.", example: "Um motorista trabalha entre Luanda e Cuanza Sul. Conheça tipo de viatura, capacidade de carga, rotas, disponibilidade e condições para viagens interprovinciais.", close: "Vamos conhecer a sua viatura e integrar o seu perfil para que possa consultar oportunidades compatíveis." },
  { title: "Consumidores finais e pequenos compradores", icon: ShoppingBasket, seek: ["Produtos frescos e preços acessíveis.", "Facilidade de aquisição.", "Proximidade e confiança.", "Opções adequadas a pequenas compras."], pitch: "Não precisa de ser comerciante nem comprar grandes quantidades. A AgriLink também procura facilitar o acesso a produtos agrícolas através dos pontos de agregação.", example: "Uma família pretende comprar batata, tomate, cebola e banana para a semana. Mostre como consultar produtos e ofertas e como identificar uma modalidade de aquisição adequada.", close: "Vamos mostrar-lhe como consultar os produtos e identificar o ponto de agregação mais conveniente." },
];

const objections = [
  ["Não conheço essa plataforma.", "Falta de familiaridade ou confiança.", "É compreensível. Posso mostrar-lhe o site oficial e explicar como funciona a plataforma."],
  ["Não gosto dessas coisas de Internet.", "Receio de tecnologia ou dificuldade de utilização.", "Não há problema. Posso explicar pessoalmente e acompanhar os primeiros passos."],
  ["Já tenho compradores.", "Não identifica uma necessidade imediata.", "Isso é positivo. Não queremos substituir relações que já funcionam. Podemos ser um canal complementar para novas oportunidades."],
  ["Isso é mesmo gratuito?", "Receio de custos escondidos.", "O registo e a publicação são apresentados como gratuitos. Existem condições comerciais por operação que explicamos antes de avançar."],
  ["E se não vender?", "Receio de perder tempo ou criar expectativas.", "Não podemos garantir uma venda. Podemos ajudar a apresentar correctamente a oferta e ampliar a exposição a potenciais compradores."],
  ["Vou pensar.", "Precisa de mais informação ou tempo.", "Claro. Qual é o principal ponto que gostaria de esclarecer antes de decidir?"],
  ["Não tenho tempo.", "Está ocupado ou não é o momento adequado.", "Compreendo. Qual seria um momento conveniente para voltarmos a falar?"],
];

const scripts = [
  { title: "Abordagem rápida — 30 segundos", text: "Bom dia! Fazemos parte da equipa AgriLink, uma plataforma que aproxima produtores agrícolas, compradores e transportadores. Estamos a construir uma rede que facilita a comercialização de produtos agrícolas, permitindo que os fornecedores apresentem a sua produção e encontrem novas oportunidades de negócio. Gostaríamos de conhecer a sua actividade e mostrar-lhe como pode fazer parte desta rede. Posso explicar-lhe brevemente como funciona?" },
  { title: "Abordagem a um fazendeiro", text: "Bom dia, senhor. Estamos a contactar produtores e fazendeiros para apresentar a AgriLink, uma plataforma criada para aproximar a produção agrícola dos compradores. Sabemos que produzir é apenas uma parte do negócio. Encontrar compradores, organizar encomendas e garantir que a produção chega ao destino também são desafios importantes. A AgriLink procura facilitar essa ligação, permitindo que a sua fazenda apresente produtos, quantidades e preços numa rede comercial. Gostaríamos de conhecer melhor a capacidade produtiva da sua fazenda e avaliar uma possível integração." },
  { title: "Abordagem a um motorista", text: "Bom dia, chefe! Estamos a apresentar a AgriLink, uma plataforma que liga produtores, compradores e transportadores. A nossa intenção é aproximar motoristas de oportunidades de transporte de produtos agrícolas, permitindo-lhes consultar cargas disponíveis, avaliar os percursos e aceitar as operações que correspondem à sua viatura e disponibilidade. Gostaríamos de conhecer o tipo de viatura que utiliza e as rotas em que costuma trabalhar para explicar como pode integrar a rede." },
  { title: "Abordagem a um consumidor", text: "Já imaginou conseguir consultar produtos agrícolas e ter acesso a ofertas provenientes dos fornecedores? A AgriLink aproxima quem produz de quem compra, facilitando o acesso a produtos agrícolas e permitindo diferentes modalidades de aquisição, incluindo pontos de agregação para pequenas compras. Gostaríamos de lhe mostrar como pode utilizar a plataforma nas suas compras do dia-a-dia." },
  { title: "Convite a uma cooperativa", text: "A AgriLink está a desenvolver uma rede de comercialização agrícola que procura aproximar produtores e compradores. Acreditamos que as cooperativas têm um papel fundamental nesta transformação, porque representam produtores, organizam a produção e ajudam a fortalecer a economia local. Gostaríamos de apresentar a plataforma à vossa direcção e avaliar uma forma de integrar os membros interessados na rede AgriLink." },
];

const objectionsAdvanced = [
  ["O agricultor não possui smartphone", "Não há problema. Podemos explicar-lhe como funciona e identificar uma forma prática de o ajudar a integrar-se na plataforma, respeitando os procedimentos de segurança da sua conta. Não recolha nem guarde credenciais pessoais."],
  ["O agricultor não sabe utilizar aplicações", "Não precisa de conhecer tecnologia para começar. A nossa equipa pode acompanhar o primeiro registo e explicar cada etapa."],
  ["O fazendeiro já trabalha com grandes compradores", "Isso é positivo. A AgriLink não precisa de substituir os seus contratos actuais. Pode funcionar como um canal complementar para encontrar novas oportunidades e diversificar os compradores."],
  ["O motorista pergunta se terá trabalho todos os dias", "Não podemos garantir uma carga diária. A disponibilidade depende das necessidades de transporte registadas na plataforma."],
  ["O comprador diz que os mercados tradicionais são mais baratos", "Compare não apenas o preço do produto, mas também a qualidade, quantidade, origem e custo total de aquisição e transporte. Consulte diferentes ofertas antes de decidir."],
  ["A pessoa diz que vai aderir mais tarde", "Compreendo. Posso deixar-lhe os nossos contactos e voltar a falar consigo numa altura mais conveniente. Há alguma dúvida específica que gostaria de esclarecer?"],
];

const conduct = [
  "Respeito: tratar todos os interlocutores com dignidade, independentemente da dimensão do negócio ou escolaridade.",
  "Honestidade: não prometer resultados que não pode controlar.",
  "Transparência: explicar taxas, comissões e condições antes da adesão.",
  "Conhecimento: conhecer a plataforma e não inventar funcionalidades.",
  "Paciência: compreender que nem todas as pessoas aderem no primeiro contacto.",
  "Confidencialidade: proteger os dados dos potenciais parceiros.",
  "Profissionalismo: cumprir os compromissos assumidos durante a prospecção.",
  "Acompanhamento: não abandonar um parceiro depois de criar a conta.",
  "Inclusão: não excluir pessoas por idade, escolaridade, localização ou familiaridade com tecnologia.",
  "Responsabilidade: priorizar negócios reais, sustentáveis e mutuamente vantajosos.",
];

const copyText = async (value: string) => {
  try {
    await navigator.clipboard.writeText(value);
    toast.success("Texto copiado.");
  } catch {
    toast.error("Não foi possível copiar automaticamente. Seleccione e copie o texto.");
  }
};

const SectionHeading = ({ id, eyebrow, title, children }: { id: string; eyebrow?: string; title: string; children?: React.ReactNode }) => (
  <div id={id} className="scroll-mt-24 space-y-2">
    {eyebrow && <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">{eyebrow}</p>}
    <h2 className="text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl">{title}</h2>
    {children && <p className="max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">{children}</p>}
  </div>
);

const SalesPlaybook = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [activeSection, setActiveSection] = useState("mentalidade");
  const [contactType, setContactType] = useState("Agricultor / Fornecedor");
  const [observedStyle, setObservedStyle] = useState("Ainda não identificado");
  const [need, setNeed] = useState("");
  const [objection, setObjection] = useState("");
  const [stage, setStage] = useState("Novo contacto");
  const [nextStep, setNextStep] = useState("");

  const filteredSections = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-AO");
    if (!term) return sections;
    return sections.filter((section) => `${section.title} ${section.description}`.toLocaleLowerCase("pt-AO").includes(term));
  }, [search]);

  const jumpTo = (id: string) => {
    setActiveSection(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const copyProspect = () => copyText(
    `FICHA DE PROSPECÇÃO AGRILINK\nTipo: ${contactType}\nEstilo observado: ${observedStyle}\nNecessidade: ${need || "Não registada"}\nObjecção: ${objection || "Não registada"}\nEstado: ${stage}\nPróximo passo: ${nextStep || "Não definido"}`
  );

  return (
    <div className="min-h-screen bg-[#f5f8f5] text-slate-900">
      <header className="sticky top-0 z-40 border-b border-emerald-100 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Voltar"><ArrowLeft className="h-4 w-4" /></Button>
            <div className="min-w-0">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-emerald-700">AgriLink · Formação interna</p>
              <p className="truncate text-sm font-bold sm:text-base">Manual de vendas e prospecção</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Badge className="hidden border-emerald-200 bg-emerald-50 text-emerald-800 sm:inline-flex">Equipa comercial</Badge>
            <Button variant="outline" size="sm" className="gap-2" onClick={() => window.print()}><Download className="h-4 w-4" /><span className="hidden sm:inline">Imprimir / PDF</span><span className="sm:hidden">PDF</span></Button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-8 px-4 py-6 sm:px-6 lg:grid-cols-[270px_minmax(0,1fr)] lg:py-10">
        <aside className="h-fit space-y-4 lg:sticky lg:top-24 print:hidden">
          <div className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2 text-sm font-bold"><BookOpen className="h-4 w-4 text-emerald-700" /> Índice do manual</div>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Localizar secção..." className="pl-9" />
            </div>
            <nav className="max-h-[55vh] space-y-1 overflow-y-auto">
              {filteredSections.map((section) => (
                <button key={section.id} onClick={() => jumpTo(section.id)} className={`w-full rounded-lg px-3 py-2 text-left text-xs font-semibold transition ${activeSection === section.id ? "bg-emerald-50 text-emerald-800" : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"}`}>
                  {section.title}
                </button>
              ))}
              {filteredSections.length === 0 && <p className="px-3 py-2 text-xs text-slate-500">Nenhuma secção encontrada.</p>}
            </nav>
          </div>
          <div className="rounded-2xl bg-emerald-950 p-4 text-white">
            <Target className="mb-3 h-5 w-5 text-emerald-300" />
            <p className="text-sm font-bold">Objectivo comercial</p>
            <p className="mt-2 text-xs leading-5 text-emerald-100">Construir uma rede activa e equilibrada de fornecedores, compradores e transportadores — não apenas acumular cadastros.</p>
          </div>
        </aside>

        <article className="min-w-0 space-y-12">
          <section className="overflow-hidden rounded-3xl bg-emerald-950 text-white shadow-lg print:bg-white print:text-slate-900 print:shadow-none">
            <div className="grid gap-6 p-6 sm:p-10 lg:grid-cols-[1.3fr_0.7fr] lg:items-center">
              <div>
                <Badge className="border-emerald-400/30 bg-emerald-400/10 text-emerald-200">DOCUMENTO DE FORMAÇÃO · ANGOLA</Badge>
                <h1 className="mt-5 max-w-3xl text-3xl font-black leading-tight tracking-tight sm:text-5xl">Guia comercial AgriLink</h1>
                <p className="mt-4 max-w-2xl text-base leading-7 text-emerald-100 sm:text-lg">Manual prático de vendas, prospecção e conquista de parceiros para toda a cadeia agroalimentar.</p>
                <p className="mt-6 text-sm font-semibold text-emerald-300">AGRILINK — CONEXÃO DE MERCADO</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  [Sprout, "Produtores", "Apresentar produção"],
                  [ShoppingBasket, "Compradores", "Encontrar ofertas"],
                  [Truck, "Motoristas", "Aceder a cargas"],
                  [Handshake, "Parceiros", "Criar relações"],
                ].map(([Icon, title, caption]: any) => <div key={title} className="rounded-2xl border border-white/10 bg-white/5 p-4"><Icon className="mb-4 h-6 w-6 text-emerald-300" /><p className="font-bold">{title}</p><p className="mt-1 text-xs text-emerald-100">{caption}</p></div>)}
              </div>
            </div>
          </section>

          <section className="grid gap-4 sm:grid-cols-3">
            <Card className="rounded-2xl border-emerald-100 shadow-sm"><CardContent className="p-5"><Target className="mb-3 h-5 w-5 text-emerald-700" /><p className="text-sm font-bold">Descobrir</p><p className="mt-1 text-xs leading-5 text-slate-600">Compreender a necessidade real antes de apresentar a solução.</p></CardContent></Card>
            <Card className="rounded-2xl border-emerald-100 shadow-sm"><CardContent className="p-5"><ShieldCheck className="mb-3 h-5 w-5 text-emerald-700" /><p className="text-sm font-bold">Demonstrar</p><p className="mt-1 text-xs leading-5 text-slate-600">Mostrar a plataforma e explicar condições sem exageros.</p></CardContent></Card>
            <Card className="rounded-2xl border-emerald-100 shadow-sm"><CardContent className="p-5"><Handshake className="mb-3 h-5 w-5 text-emerald-700" /><p className="text-sm font-bold">Activar</p><p className="mt-1 text-xs leading-5 text-slate-600">Acompanhar o parceiro até à primeira utilização efectiva.</p></CardContent></Card>
          </section>

          <section className="space-y-5">
            <SectionHeading id="mentalidade" eyebrow="Fundamentos" title="1. A mentalidade correcta de um vendedor" >As pessoas não compram funcionalidades. Compram benefícios que resolvem problemas reais. O vendedor deve falar primeiro da realidade do interlocutor e só depois da AgriLink.</SectionHeading>
            <div className="grid gap-3 md:grid-cols-2">
              <Card className="rounded-2xl"><CardHeader><CardTitle className="text-base">Evite começar por</CardTitle></CardHeader><CardContent className="space-y-2 text-sm text-slate-600"><p>“Temos uma aplicação.”</p><p>“Temos tecnologia moderna.”</p><p>“Estamos a recrutar fornecedores.”</p><p>“Faça o seu cadastro.”</p></CardContent></Card>
              <Card className="rounded-2xl border-emerald-200 bg-emerald-50/60"><CardHeader><CardTitle className="text-base text-emerald-900">Comece por perguntar</CardTitle></CardHeader><CardContent className="space-y-2 text-sm text-emerald-950"><p>“Como costuma vender a sua produção?”</p><p>“Quais são as maiores dificuldades para encontrar fornecedores?”</p><p>“Como organiza as suas entregas?”</p><p>“O que gostaria de melhorar no seu negócio?”</p></CardContent></Card>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5"><p className="font-bold">Regra de referência 70/30</p><p className="mt-2 text-sm leading-6 text-slate-600">Procure dedicar aproximadamente 70% da conversa a ouvir, perguntar e compreender e 30% a explicar, demonstrar e propor. É uma disciplina de comunicação, não uma regra matemática.</p></div>
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="grid grid-cols-2 gap-0 sm:grid-cols-4">{[["Agricultor","Vender a produção"],["Fazendeiro","Escoar volume"],["Motorista","Encontrar cargas"],["Consumidor","Comprar com facilidade"]].map(([a,b])=><div key={a} className="border-b border-r border-slate-100 p-4 last:border-r-0"><p className="text-xs font-bold text-emerald-800">{a}</p><p className="mt-1 text-sm text-slate-600">{b}</p></div>)}</div>
            </div>
          </section>

          <Separator />
          <section className="space-y-5">
            <SectionHeading id="personalidades" eyebrow="Psicologia comportamental aplicada" title="2. Como adaptar a comunicação aos diferentes estilos">Modelo de referência inspirado no DISC. São tendências observáveis, não diagnósticos psicológicos. Uma pessoa pode apresentar estilos diferentes consoante o contexto.</SectionHeading>
            <div className="grid gap-4 md:grid-cols-2">
              {styles.map((style, index) => <Card key={style.name} className="rounded-2xl shadow-sm"><CardHeader><div className="flex items-center justify-between gap-3"><CardTitle className="text-lg">{style.name}</CardTitle><Badge variant="outline">Estilo {index + 1}</Badge></div><CardDescription>{style.tag}</CardDescription></CardHeader><CardContent className="space-y-3 text-sm"><div><p className="font-bold text-slate-800">Valoriza</p><p className="mt-1 leading-6 text-slate-600">{style.need}</p></div><div><p className="font-bold text-slate-800">Como abordar</p><p className="mt-1 leading-6 text-slate-600">{style.approach}</p></div><div className="rounded-xl bg-emerald-50 p-3 text-emerald-950"><p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700">Exemplo de frase</p><p className="mt-1 leading-6">“{style.phrase}”</p></div></CardContent></Card>)}
            </div>
            <p className="text-sm leading-6 text-slate-600">A mensagem muda; a honestidade, as funcionalidades reais e as condições comerciais não mudam. Não use estes estilos para classificar definitivamente uma pessoa nem para a pressionar.</p>
          </section>

          <Separator />
          <section className="space-y-5">
            <SectionHeading id="abordagem" eyebrow="Primeiro contacto" title="3. Como abordar desconhecidos sem criar resistência">O primeiro objectivo não é fechar a venda. É conquistar autorização para conversar e compreender a realidade da pessoa.</SectionHeading>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                ["1. Aproximação respeitosa","Cumprimente, apresente-se e respeite o tempo: “Bom dia, senhor. O meu nome é [nome]. Faço parte da equipa AgriLink.”"],
                ["2. Contextualização","Explique por que está ali: “Estamos a aproximar produtores, compradores e transportadores numa rede comercial.”"],
                ["3. Pergunta de descoberta","“Actualmente, como costuma vender ou comercializar a sua produção?”"],
                ["4. Identificação do problema","Escute sem interromper. Procure perceber a dificuldade principal e confirme se compreendeu."],
                ["5. Apresentação personalizada","Mostre apenas as funcionalidades que respondem à necessidade e proponha um próximo passo simples."],
              ].map(([title,body])=><div key={title} className="rounded-2xl border border-slate-200 bg-white p-5"><p className="font-bold">{title}</p><p className="mt-2 text-sm leading-6 text-slate-600">{body}</p></div>)}
            </div>
            <Card className="rounded-2xl border-emerald-200"><CardHeader><CardTitle className="text-base">Exemplo de conversa real</CardTitle><CardDescription>Abordagem a um agricultor que tem dificuldade em escoar a produção.</CardDescription></CardHeader><CardContent className="space-y-3 text-sm leading-6">
              <p><strong>Vendedor:</strong> Bom dia, chefe. Como está a correr a produção?</p><p><strong>Agricultor:</strong> Está a correr bem, graças a Deus.</p><p><strong>Vendedor:</strong> Como faz para vender quando chega a altura da colheita?</p><p><strong>Agricultor:</strong> Tenho alguns compradores, mas às vezes demoram.</p><p><strong>Vendedor:</strong> E quando não aparecem, o que acontece à produção?</p><p><strong>Agricultor:</strong> Às vezes temos de baixar o preço.</p><p><strong>Vendedor:</strong> A AgriLink permite apresentar a sua produção numa rede onde potenciais compradores podem consultar as ofertas. Posso mostrar-lhe como funciona?</p><p><strong>Agricultor:</strong> Mas isso funciona mesmo?</p><p><strong>Vendedor:</strong> Posso mostrar a plataforma e explicar o processo. Não vou prometer uma venda imediata, mas podemos apresentar correctamente a sua oferta e ampliar a exposição comercial.</p>
            </CardContent></Card>
          </section>

          <Separator />
          <section className="space-y-5">
            <SectionHeading id="segmentos" eyebrow="Argumentos por público" title="4. Como vender a AgriLink a cada segmento">A necessidade e a linguagem mudam conforme a actividade. Descubra primeiro o contexto e adapte o argumento.</SectionHeading>
            <div className="space-y-4">
              {audiences.map((audience) => { const Icon = audience.icon; return <Card key={audience.title} className="overflow-hidden rounded-2xl"><CardHeader className="bg-white"><div className="flex items-start gap-3"><div className="rounded-xl bg-emerald-50 p-3"><Icon className="h-5 w-5 text-emerald-700" /></div><div><CardTitle className="text-lg">{audience.title}</CardTitle><CardDescription className="mt-1">Necessidades, argumento, exemplo e fecho.</CardDescription></div></div></CardHeader><CardContent className="grid gap-5 border-t border-slate-100 bg-white p-5 md:grid-cols-2"><div><p className="text-xs font-extrabold uppercase tracking-wider text-slate-500">O que procura</p><ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-slate-600">{audience.seek.map((item)=><li key={item}>{item}</li>)}</ul><p className="mt-4 text-xs font-extrabold uppercase tracking-wider text-emerald-700">Argumento principal</p><p className="mt-2 text-sm font-medium leading-6 text-slate-800">“{audience.pitch}”</p></div><div className="space-y-4"><div><p className="text-xs font-extrabold uppercase tracking-wider text-slate-500">Exemplo prático</p><p className="mt-2 text-sm leading-6 text-slate-600">{audience.example}</p></div><div className="rounded-xl bg-emerald-50 p-4"><p className="text-xs font-extrabold uppercase tracking-wider text-emerald-700">Fecho sugerido</p><p className="mt-2 text-sm font-semibold leading-6 text-emerald-950">“{audience.close}”</p></div></div></CardContent></Card> }) }
            </div>
          </section>

          <Separator />
          <section className="space-y-5">
            <SectionHeading id="confianca" eyebrow="Objecções" title="5. Como conquistar pessoas desconfiadas">A desconfiança pode resultar de experiências anteriores com burlas, promessas falsas ou serviços digitais pouco claros. Não discuta: esclareça.</SectionHeading>
            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white"><table className="w-full min-w-[680px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="p-4">O que diz</th><th className="p-4">Possível preocupação</th><th className="p-4">Resposta recomendada</th></tr></thead><tbody>{objections.map((row)=><tr key={row[0]} className="border-t border-slate-100 align-top"><td className="p-4 font-semibold text-slate-800">“{row[0]}”</td><td className="p-4 text-slate-600">{row[1]}</td><td className="p-4 leading-6 text-slate-700">{row[2]}</td></tr>)}</tbody></table></div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5"><p className="font-bold text-amber-950">Regra de ouro</p><p className="mt-2 text-sm leading-6 text-amber-900">Nunca discutir, ridicularizar dúvidas, criar urgência artificial ou garantir resultados que dependem de terceiros.</p></div>
          </section>

          <Separator />
          <section className="space-y-5">
            <SectionHeading id="custos" eyebrow="Transparência" title="6. Como explicar custos e condições comerciais">O agente deve consultar as condições comerciais oficiais em vigor antes de cada campanha. Nunca esconda custos nem apresente uma condição antiga como se fosse garantidamente actual.</SectionHeading>
            <Card className="rounded-2xl"><CardHeader><CardTitle className="text-base">Condições comerciais referidas no material de formação</CardTitle><CardDescription>Valores indicativos a confirmar na política comercial actualmente aprovada pela AgriLink antes de os comunicar ao público.</CardDescription></CardHeader><CardContent className="space-y-3"><div className="grid gap-2 sm:grid-cols-2">{[["Criar conta","Gratuito, conforme a condição apresentada"],["Publicar produtos","Gratuito, conforme a condição apresentada"],["Mensalidade","Sem mensalidade, conforme a condição apresentada"],["Comissão do fornecedor","8,9% por venda confirmada — confirmar vigência"],["Taxa do comprador","2.500 Kz por encomenda — confirmar vigência"],["Entrega","Conforme valor e condições apresentados na operação"],["Pagamento protegido","Retenção e libertação conforme regras de confirmação da entrega"]].map(([k,v])=><div key={k} className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-bold text-slate-500">{k}</p><p className="mt-1 text-sm font-semibold text-slate-800">{v}</p></div>)}</div><Separator /><p className="text-sm leading-6 text-slate-600"><strong>Ao fornecedor:</strong> “O registo e a publicação não têm custo segundo as condições actuais apresentadas. A comissão aplicável é explicada antes da operação; confirme o valor líquido a receber antes de aceitar.”</p><p className="text-sm leading-6 text-slate-600"><strong>Ao comprador:</strong> “Consulte o preço dos produtos, a taxa de plataforma e o custo de entrega aplicável. O valor e as regras de retenção/libertação são apresentados segundo as condições da encomenda.”</p></CardContent></Card>
            <p className="text-sm font-semibold text-rose-700">Não prometa lucro garantido, venda garantida, pagamento imediato garantido, clientes garantidos ou transporte gratuito.</p>
          </section>

          <Separator />
          <section className="space-y-5">
            <SectionHeading id="persuasao" eyebrow="Venda consultiva" title="7. Técnicas de persuasão que a equipa deve dominar">Persuadir é ajudar alguém a compreender o valor de uma solução e a tomar uma decisão informada.</SectionHeading>
            <div className="grid gap-3 md:grid-cols-2">{[
              ["1. Fazer reconhecer o problema","Pergunte o que acontece quando a produção está pronta e não aparece comprador. Deixe a pessoa explicar a dificuldade."],
              ["2. Demonstrar, não apenas explicar","Mostre criação de conta, selecção de perfil, consulta de produtos, publicação e acompanhamento da operação."],
              ["3. Usar exemplos próximos","Fale de uma fazenda no Huambo e de um comprador em Luanda como cenário ilustrativo, sem afirmar que a operação já aconteceu."],
              ["4. Reduzir o esforço inicial","Proponha começar com um produto, uma necessidade de compra ou o preenchimento do perfil do motorista."],
              ["5. Utilizar prova social verdadeira","Use apenas operações, parceiros, números e depoimentos reais, verificáveis e autorizados."],
              ["6. Fazer perguntas de compromisso","“Podemos fazer o registo agora?”, “Qual é o primeiro produto?” ou “Quando estará disponível a colheita?”"],
            ].map(([title,body])=><div key={title} className="rounded-2xl border border-slate-200 bg-white p-5"><p className="font-bold">{title}</p><p className="mt-2 text-sm leading-6 text-slate-600">{body}</p></div>)}</div>
          </section>

          <Separator />
          <section className="space-y-5">
            <SectionHeading id="guiões" eyebrow="Ferramentas de campo" title="8. Guiões prontos para situações reais">Adapte o tratamento, o nome e o contexto. Não leia mecanicamente: converse.</SectionHeading>
            <div className="space-y-3">{scripts.map((script)=><Card key={script.title} className="rounded-2xl"><CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0"><CardTitle className="text-base">{script.title}</CardTitle><Button variant="outline" size="sm" className="shrink-0 gap-2" onClick={()=>void copyText(script.text)}><Copy className="h-3.5 w-3.5" /> Copiar</Button></CardHeader><CardContent><p className="text-sm leading-7 text-slate-600">{script.text}</p></CardContent></Card>)}</div>
          </section>

          <Separator />
          <section className="space-y-5">
            <SectionHeading id="conversao" eyebrow="Activação" title="9. Como transformar uma conversa numa adesão">O sucesso não é apenas o cadastro. É a utilização efectiva e a criação de condições para a primeira operação.</SectionHeading>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{[
              ["1. Contacto","A pessoa foi abordada e identificada."],["2. Qualificação","Actividade, necessidade e interesse compreendidos."],["3. Apresentação","Benefícios e funcionalidades demonstrados."],["4. Registo","Conta criada e perfil correcto seleccionado."],["5. Verificação","Procedimentos de validação concluídos, quando aplicáveis."],["6. Activação","Primeira oferta, necessidade ou perfil operacional concluído."],["7. Acompanhamento","Dificuldades resolvidas e utilização acompanhada."],
            ].map(([title,body])=><div key={title} className="rounded-2xl border border-slate-200 bg-white p-4"><CheckCircle2 className="mb-3 h-5 w-5 text-emerald-700" /><p className="font-bold">{title}</p><p className="mt-1 text-xs leading-5 text-slate-600">{body}</p></div>)}</div>
            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white"><table className="w-full text-left text-sm"><thead className="bg-slate-50"><tr><th className="p-3">Resultado</th><th className="p-3">Significado</th></tr></thead><tbody>{[["Contacto realizado","A pessoa foi abordada."],["Interessado","Demonstrou curiosidade."],["Cadastro iniciado","Começou a criar a conta."],["Cadastro concluído","Criou a conta."],["Perfil verificado","Concluiu a validação necessária."],["Utilizador activo","Executou uma acção útil na plataforma."],["Primeiro negócio","Concretizou a primeira operação."],["Parceiro recorrente","Continua a utilizar a plataforma."]].map(([a,b])=><tr key={a} className="border-t border-slate-100"><td className="p-3 font-semibold">{a}</td><td className="p-3 text-slate-600">{b}</td></tr>)}</tbody></table></div>
          </section>

          <Separator />
          <section className="space-y-5">
            <SectionHeading id="situacoes" eyebrow="Resolução de problemas" title="10. Respostas para situações difíceis">Mantenha o foco na segurança, na realidade operacional e nas condições efectivamente disponíveis.</SectionHeading>
            <div className="space-y-3">{objectionsAdvanced.map(([title,body])=><div key={title} className="rounded-2xl border border-slate-200 bg-white p-5"><p className="font-bold">{title}</p><p className="mt-2 text-sm leading-6 text-slate-600">“{body}”</p></div>)}</div>
          </section>

          <Separator />
          <section className="space-y-5">
            <SectionHeading id="terreno" eyebrow="Prospecção presencial" title="11. Estratégia de prospecção no terreno">A equipa deve sair com uma estratégia de cobertura de mercado, não apenas para distribuir contactos ou pedir cadastros.</SectionHeading>
            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white"><table className="w-full min-w-[500px] text-left text-sm"><thead className="bg-slate-50"><tr><th className="p-4">Local</th><th className="p-4">Público prioritário</th></tr></thead><tbody>{[["Fazendas e quintas","Agricultores e fazendeiros"],["Cooperativas agrícolas","Grupos de produtores"],["Mercados grossistas","Comerciantes e compradores"],["Mercados municipais","Pequenos comerciantes"],["Restaurantes e hotéis","Compradores profissionais"],["Terminais e zonas logísticas","Motoristas e transportadores"],["Associações empresariais","Parceiros comerciais"],["Comunidades rurais","Pequenos produtores"]].map(([a,b])=><tr key={a} className="border-t border-slate-100"><td className="p-4 font-semibold">{a}</td><td className="p-4 text-slate-600">{b}</td></tr>)}</tbody></table></div>
            <Card className="rounded-2xl"><CardHeader><CardTitle className="text-base">Método de trabalho: uma zona de cada vez</CardTitle></CardHeader><CardContent><ol className="list-decimal space-y-2 pl-5 text-sm leading-6 text-slate-600"><li>Escolher uma zona geográfica.</li><li>Identificar produtores, comerciantes e compradores.</li><li>Mapear produtos e volumes relevantes.</li><li>Identificar potenciais compradores.</li><li>Identificar motoristas disponíveis.</li><li>Realizar contactos e demonstrações.</li><li>Acompanhar registos e primeiras ofertas.</li><li>Regressar aos contactos interessados.</li></ol></CardContent></Card>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5"><p className="font-bold text-amber-950">Equilíbrio da rede</p><p className="mt-2 text-sm leading-6 text-amber-900">Não adianta conquistar muitos fornecedores numa região sem compradores, nem muitos compradores sem produtos disponíveis. O crescimento deve equilibrar oferta, procura e capacidade logística.</p></div>
          </section>

          <Separator />
          <section className="space-y-5">
            <SectionHeading id="rede" eyebrow="Efeito de rede" title="12. Como construir uma rede que se alimenta a si própria">Cada parceiro satisfeito pode apresentar outros intervenientes. A recomendação deve surgir de uma experiência real e positiva.</SectionHeading>
            <div className="grid gap-3 sm:grid-cols-2">{[
              ["Produtor","Apresenta uma cooperativa ou outros agricultores."],["Cooperativa","Apresenta os seus membros e produtores associados."],["Grossista","Apresenta outros comerciantes e compradores."],["Motorista","Apresenta outros transportadores com capacidade."],["Restaurante","Apresenta outros estabelecimentos com necessidades semelhantes."],
            ].map(([a,b])=><div key={a} className="rounded-xl border border-slate-200 bg-white p-4"><p className="font-bold text-emerald-800">{a}</p><p className="mt-1 text-sm text-slate-600">{b}</p></div>)}</div>
            <div className="rounded-2xl bg-emerald-950 p-5 text-white"><p className="text-xs font-bold uppercase tracking-wider text-emerald-300">Pergunta de recomendação</p><p className="mt-2 text-lg font-semibold leading-7">“Conhece outros produtores, comerciantes ou transportadores que poderiam beneficiar desta rede? Gostaríamos de lhes apresentar a AgriLink.”</p><p className="mt-3 text-xs text-emerald-200">Não ofereça benefícios financeiros por recomendações sem existir um programa formalmente aprovado.</p></div>
          </section>

          <Separator />
          <section className="space-y-5">
            <SectionHeading id="plano" eyebrow="Execução" title="13. Plano de execução comercial de 30 dias">Metas de referência para organizar o trabalho. Não são resultados históricos nem garantias de desempenho.</SectionHeading>
            <div className="grid gap-3 md:grid-cols-2">{[
              ["Semana 1 — Preparação e prospecção",["Estudar os argumentos comerciais.","Dominar a plataforma.","Identificar zonas agrícolas e comerciais.","Criar lista de potenciais parceiros.","Iniciar os primeiros contactos."]],
              ["Semana 2 — Conquista de fornecedores",["Visitar fazendas e pequenas propriedades.","Contactar cooperativas.","Registar produtores interessados.","Ajudar a publicar as primeiras ofertas.","Identificar produtos com maior disponibilidade."]],
              ["Semana 3 — Compradores e motoristas",["Visitar grossistas.","Contactar restaurantes e hotéis.","Identificar necessidades de abastecimento.","Integrar motoristas.","Cruzar oferta, procura e transporte."]],
              ["Semana 4 — Activação e acompanhamento",["Rever os perfis criados.","Resolver dificuldades de utilização.","Acompanhar primeiras negociações.","Identificar operações reais.","Avaliar resultados e preparar a próxima zona."]],
            ].map(([title,items]: any)=><Card key={title} className="rounded-2xl"><CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader><CardContent><ul className="list-disc space-y-2 pl-5 text-sm text-slate-600">{items.map((item:string)=><li key={item}>{item}</li>)}</ul></CardContent></Card>)}</div>
            <Card className="rounded-2xl"><CardHeader><CardTitle className="text-base">Indicadores de referência por agente / mês</CardTitle><CardDescription>Metas ilustrativas para calibrar após o primeiro ciclo de execução.</CardDescription></CardHeader><CardContent><div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{[["100","Contactos qualificados"],["40","Demonstrações"],["20","Fornecedores registados"],["15","Fornecedores com oferta"],["10","Compradores registados"],["5","Motoristas integrados"],["5","Primeiras operações"]].map(([value,label])=><div key={label} className="rounded-xl bg-slate-50 p-4"><p className="text-2xl font-black text-emerald-800">{value}</p><p className="mt-1 text-xs leading-5 text-slate-600">{label}</p></div>)}</div><p className="mt-4 text-sm leading-6 text-slate-600">A qualidade importa mais do que o volume: 15 fornecedores com produtos, quantidades e preços actualizados podem ser mais valiosos do que 100 contas sem ofertas publicadas.</p></CardContent></Card>
          </section>

          <Separator />
          <section className="space-y-5">
            <SectionHeading id="ficha" eyebrow="Ferramenta de registo" title="14. Ficha prática de prospecção">Registe cada contacto e defina sempre um próximo passo. Não recolha dados pessoais desnecessários.</SectionHeading>
            <Card className="rounded-2xl"><CardHeader><CardTitle className="text-base">Ficha de contacto AgriLink</CardTitle><CardDescription>Preencha durante ou logo após a conversa e copie o resumo para o registo comercial autorizado.</CardDescription></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 text-sm font-semibold">Tipo de parceiro<select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm font-normal" value={contactType} onChange={(e)=>setContactType(e.target.value)}>{["Agricultor / Fornecedor","Fazendeiro","Cooperativa","Comprador / Comerciante","Restaurante / Hotel","Motorista","Consumidor final"].map(v=><option key={v}>{v}</option>)}</select></label>
              <label className="space-y-2 text-sm font-semibold">Estilo observado<select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm font-normal" value={observedStyle} onChange={(e)=>setObservedStyle(e.target.value)}>{["Ainda não identificado","Directo / Orientado para resultados","Comunicativo / Entusiasta","Calmo / Orientado para confiança","Analítico / Criterioso","Misto"].map(v=><option key={v}>{v}</option>)}</select></label>
              <label className="space-y-2 text-sm font-semibold sm:col-span-2">Necessidade identificada<textarea className="min-h-20 w-full rounded-md border border-input bg-background p-3 text-sm font-normal" value={need} onChange={(e)=>setNeed(e.target.value)} placeholder="Ex.: precisa vender 2 toneladas de tomate..." /></label>
              <label className="space-y-2 text-sm font-semibold sm:col-span-2">Principal objecção<textarea className="min-h-20 w-full rounded-md border border-input bg-background p-3 text-sm font-normal" value={objection} onChange={(e)=>setObjection(e.target.value)} placeholder="Ex.: tem dúvidas sobre pagamentos digitais..." /></label>
              <label className="space-y-2 text-sm font-semibold">Estado comercial<select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm font-normal" value={stage} onChange={(e)=>setStage(e.target.value)}>{["Novo contacto","Interessado","Demonstração realizada","Cadastro iniciado","Cadastro concluído","Perfil verificado","Oferta publicada / Perfil activo","Primeira operação","Parceiro recorrente","Sem interesse"].map(v=><option key={v}>{v}</option>)}</select></label>
              <label className="space-y-2 text-sm font-semibold">Próximo passo<textarea className="min-h-10 w-full rounded-md border border-input bg-background p-3 text-sm font-normal" value={nextStep} onChange={(e)=>setNextStep(e.target.value)} placeholder="Ex.: voltar a contactar na próxima terça-feira..." /></label>
              <div className="sm:col-span-2"><Button onClick={copyProspect} className="w-full gap-2 bg-emerald-700 hover:bg-emerald-800"><Clipboard className="h-4 w-4" /> Copiar ficha preenchida</Button></div>
            </CardContent></Card>
          </section>

          <Separator />
          <section className="space-y-5">
            <SectionHeading id="conduta" eyebrow="Padrão profissional" title="15. Código de conduta da equipa comercial">Cada representante é responsável pela confiança que a AgriLink constrói no terreno.</SectionHeading>
            <div className="grid gap-3 sm:grid-cols-2">{conduct.map((item,index)=><div key={item} className="flex gap-3 rounded-xl border border-slate-200 bg-white p-4"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" /><p className="text-sm leading-6 text-slate-600">{item}</p></div>)}</div>
          </section>

          <Separator />
          <section className="space-y-5">
            <SectionHeading id="visao" eyebrow="Mensagem central" title="16. A visão que a equipa deve saber vender">A AgriLink não pretende retirar o lugar de todos os mercados, comerciantes ou relações comerciais existentes. Pretende acrescentar uma infraestrutura de ligação e organização à cadeia agroalimentar.</SectionHeading>
            <div className="grid gap-3 sm:grid-cols-2">{[
              [Sprout,"Quem produz","Pode apresentar a sua produção a potenciais compradores."],
              [ShoppingBasket,"Quem compra","Pode descobrir ofertas e novas fontes de abastecimento."],
              [Truck,"Quem transporta","Pode consultar oportunidades de cargas compatíveis."],
              [Users,"Quem comercializa e consome","Pode desenvolver relações e aceder a produtos por diferentes modalidades."],
            ].map(([Icon,title,body]:any)=><div key={title} className="rounded-2xl border border-emerald-100 bg-white p-5"><Icon className="mb-3 h-6 w-6 text-emerald-700" /><p className="font-bold">{title}</p><p className="mt-2 text-sm leading-6 text-slate-600">{body}</p></div>)}</div>
          </section>

          <Separator />
          <section className="space-y-5">
            <SectionHeading id="discurso" eyebrow="Discurso institucional" title="17. Apresentação-base da AgriLink">Este texto pode ser utilizado em reuniões, visitas, apresentações e formação de novos agentes.</SectionHeading>
            <Card className="rounded-2xl border-emerald-200"><CardHeader><div className="flex items-center justify-between gap-3"><CardTitle className="text-lg">AgriLink — Conexão de mercado</CardTitle><Button variant="outline" size="sm" className="gap-2" onClick={()=>void copyText("A agricultura é uma das actividades fundamentais para o desenvolvimento de Angola. Porém, produzir não é suficiente. É igualmente importante conseguir comercializar, encontrar compradores, organizar o transporte e fazer chegar os produtos a quem precisa deles.\n\nÉ neste contexto que surge a AgriLink. Somos uma plataforma que aproxima produtores, fazendeiros, cooperativas, compradores, agentes e transportadores numa rede de oportunidades comerciais.\n\nSe é agricultor, queremos ajudá-lo a apresentar a sua produção e aproximá-la de potenciais compradores. Se é fazendeiro, queremos proporcionar-lhe um canal complementar para comercializar a sua produção. Se é comerciante, restaurante ou empresa, queremos facilitar o acesso a ofertas agrícolas e a novos fornecedores. Se é motorista, queremos aproximá-lo das oportunidades de transporte. Se é consumidor, queremos facilitar o acesso a produtos agrícolas através de diferentes modalidades de aquisição.\n\nA AgriLink procura tornar as operações mais organizadas, aproximar os intervenientes e promover maior confiança nas transacções. Não importa se possui uma grande fazenda, uma pequena produção, uma viatura de transporte ou se simplesmente pretende comprar produtos agrícolas. Existe um lugar para si nesta rede.\n\nAgriLink — Conexão de mercado. Juntos, aproximamos quem produz de quem compra e construímos novas oportunidades para o agronegócio angolano.")}><Copy className="h-3.5 w-3.5" /> Copiar discurso</Button></div></CardHeader><CardContent className="space-y-4 text-sm leading-7 text-slate-600"><p>A agricultura é uma das actividades fundamentais para o desenvolvimento de Angola. Porém, produzir não é suficiente. É igualmente importante conseguir comercializar, encontrar compradores, organizar o transporte e fazer chegar os produtos a quem precisa deles.</p><p>É neste contexto que surge a AgriLink. Somos uma plataforma que aproxima produtores, fazendeiros, cooperativas, compradores, agentes e transportadores numa rede de oportunidades comerciais.</p><p>Se é agricultor, queremos ajudá-lo a apresentar a sua produção e aproximá-la de potenciais compradores. Se é fazendeiro, queremos proporcionar-lhe um canal complementar para comercializar a sua produção. Se é comerciante, restaurante ou empresa, queremos facilitar o acesso a ofertas agrícolas e a novos fornecedores. Se é motorista, queremos aproximá-lo das oportunidades de transporte. Se é consumidor, queremos facilitar o acesso a produtos agrícolas através de diferentes modalidades de aquisição.</p><p>A AgriLink procura tornar as operações mais organizadas, aproximar os intervenientes e promover maior confiança nas transacções.</p><p>Não importa se possui uma grande fazenda, uma pequena produção, uma viatura de transporte ou se simplesmente pretende comprar produtos agrícolas. Existe um lugar para si nesta rede.</p><p className="font-extrabold text-emerald-800">AgriLink — Conexão de mercado. Juntos, aproximamos quem produz de quem compra e construímos novas oportunidades para o agronegócio angolano.</p></CardContent></Card>
          </section>

          <Separator />
          <section className="space-y-5">
            <SectionHeading id="referencias" eyebrow="Fontes e controlo" title="18. Referências operacionais">Antes de cada campanha, confirme a informação oficial e a disponibilidade real das funcionalidades.</SectionHeading>
            <Card className="rounded-2xl"><CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-bold">Plataforma oficial AgriLink</p><p className="mt-1 text-sm text-slate-600">Consultar a experiência real e verificar o funcionamento antes de demonstrar.</p></div><Button variant="outline" onClick={()=>window.open("https://www.agrilink.ao/","_blank","noopener,noreferrer")} className="gap-2">Abrir AgriLink <ArrowRight className="h-4 w-4" /></Button></CardContent></Card>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5"><p className="font-bold text-amber-950">Controlo de versão e rigor</p><p className="mt-2 text-sm leading-6 text-amber-900">Este manual é material interno de formação. Confirme sempre taxas, comissões, modalidades de entrega, pagamentos, elegibilidade, disponibilidade de funcionalidades e contactos nos canais oficiais antes de os comunicar. Exemplos numéricos de produção são cenários didácticos, não resultados de clientes. Nunca apresente uma simulação como operação concluída.</p></div>
          </section>

          <section className="rounded-3xl bg-emerald-950 p-6 text-white sm:p-9">
            <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-emerald-300">Filosofia comercial AgriLink</p>
            <h2 className="mt-3 text-2xl font-black leading-tight sm:text-3xl">Não procuramos apenas contas. Construímos relações comerciais activas.</h2>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-emerald-100">Um excelente vendedor compreende pessoas diferentes, comunica valor com clareza, conquista confiança e transforma oportunidades em relações duradouras. O objectivo é construir uma rede agroalimentar activa, equilibrada e sustentável em Angola.</p>
            <p className="mt-6 font-extrabold text-emerald-300">AGRILINK — CONEXÃO DE MERCADO</p>
          </section>

          <footer className="border-t border-slate-200 py-6 text-center text-xs text-slate-500">Manual interno de formação comercial AgriLink · Utilize sempre a informação operacional mais recente aprovada pela empresa.</footer>
        </article>
      </main>
      <style>{`@media print { header, aside, button { display: none !important; } main { display: block !important; max-width: none !important; padding: 0 !important; } article { gap: 1.5rem !important; } section, .rounded-2xl, .rounded-3xl { break-inside: avoid; } body { background: white !important; } }`}</style>
    </div>
  );
};

export default SalesPlaybook;
