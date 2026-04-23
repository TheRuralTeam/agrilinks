import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, BarChart3, Truck, ArrowRight, Package, Globe, ShieldCheck, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import orbisLinkLogo from "@/assets/orbislink-logo.png";
import supplyChainHero from "@/assets/supply-chain-hero.jpg";

// --- Branding Tokens ---
const T = {
  /* Greens */
  g900:   '#2c863b',
  g700:   '#1A5C24',
  g600:   '#2D7D3A',
  g500:   '#3D9A48',
  g400:   '#4CAF50',
  g100:   '#E8F5E9',
  g50:    '#F2FAF3',
  gBorder:'#C8E6CA',

  /* Earth */
  e700:   '#5C3317',
  e500:   '#7B4F2E',
  e300:   '#A0522D',
  ePale:  '#FDF5EE',
  eBorder:'#EDD9C6',

  /* Neutrals */
  ink:    '#111714',
  mid:    '#3D4D40',
  muted:  '#758A79',
  faint:  '#A8BAA9',
  canvas: '#F7F9F7',
  white:  '#FFFFFF',
  rule:   '#E5EDE6',

  /* Accents */
  gold:   '#B07D0A',
  goldL:  '#E5A020',

  /* Shadow */
  shadow: 'rgba(13,43,18,0.10)',
  shadowMd:'rgba(13,43,18,0.15)',
}

const Login = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col lg:flex-row" style={{ backgroundColor: T.canvas }}>
      {/* Left Side - Hero Section */}
      <div className="relative lg:w-5/12 h-80 lg:h-auto overflow-hidden">
        <img 
          src={supplyChainHero} 
          alt="Supply Chain Operations" 
          className="w-full h-full object-cover scale-105 animate-pulse-slow"
          style={{ animationDuration: '10s' }}
        />
        {/* Overlay com gradiente usando as cores da marca */}
        <div 
          className="absolute inset-0" 
          style={{ 
            background: `linear-gradient(to bottom, rgba(26, 92, 36, 0.4), ${T.g900} 95%)` 
          }} 
        />
        
        {/* Overlay Content */}
        <div className="absolute inset-0 flex flex-col justify-end p-8 lg:p-16">
          <div className="max-w-md animate-in fade-in slide-in-from-left-8 duration-1000">
            <div className="h-1 w-12 mb-6 rounded-full" style={{ backgroundColor: T.goldL }} />
            <h2 className="text-3xl lg:text-5xl font-black mb-6 leading-tight text-white">
              Conectando a terra ao mercado global
            </h2>
            <p className="text-base lg:text-lg font-medium text-white/90 leading-relaxed">
              A infraestrutura B2B que organiza cadeias de abastecimento, valoriza a produção e elimina barreiras comerciais.
            </p>
          </div>
        </div>
      </div>

      {/* Right Side - Login Options */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-20 relative overflow-hidden">
        {/* Elementos decorativos de fundo */}
        <div className="absolute top-[-10%] right-[-10%] w-64 h-64 rounded-full blur-3xl opacity-20" style={{ backgroundColor: T.g100 }} />
        <div className="absolute bottom-[-5%] left-[-5%] w-96 h-96 rounded-full blur-3xl opacity-10" style={{ backgroundColor: T.eBorder }} />

        <div className="w-full max-w-2xl z-10">
          {/* Logo & Tagline */}
          <div className="text-center mb-12 animate-in fade-in zoom-in-95 duration-700">
            <img 
              src={orbisLinkLogo} 
              alt="OrbisLink" 
              className="h-20 lg:h-24 mx-auto mb-6 drop-shadow-sm"
            />
            <h3 className="text-xl lg:text-2xl font-black tracking-tight" style={{ color: T.ink }}>
              Bem-vindo ao OrbisLink
            </h3>
            <p className="text-sm lg:text-base font-bold uppercase tracking-[0.2em] mt-2" style={{ color: T.g600 }}>
              Seu elo com os mercados globais
            </p>
          </div>

          {/* Cards Grid */}
          <div className="grid gap-6 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-200">
            {/* Fornecedor/Agente Card */}
            <Card 
              className="group border-none shadow-sm hover:shadow-xl transition-all duration-500 rounded-[2rem] overflow-hidden cursor-pointer"
              style={{ backgroundColor: T.white }}
              onClick={() => navigate('/cadastro')}
            >
              <div className="flex flex-col sm:flex-row h-full">
                <div className="sm:w-1/3 p-8 flex items-center justify-center transition-transform group-hover:scale-110 duration-500" style={{ backgroundColor: T.g50 }}>
                  <div className="relative">
                    <div className="absolute inset-0 rounded-full blur-xl opacity-40" style={{ backgroundColor: T.g400 }} />
                    <Package className="h-16 w-16 relative z-10" style={{ color: T.g700 }} />
                  </div>
                </div>
                <div className="flex-1 p-8 flex flex-col justify-center">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: T.gold }} />
                    <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: T.muted }}>Produtores & Agentes</span>
                  </div>
                  <CardTitle className="text-2xl font-black mb-3" style={{ color: T.ink }}>
                    Fornecedor / Agente
                  </CardTitle>
                  <CardDescription className="text-sm font-medium mb-6 leading-relaxed" style={{ color: T.mid }}>
                    Publique os seus produtos, gira o seu stock e conecte-se diretamente com grandes compradores internacionais.
                  </CardDescription>
                  <div className="flex gap-3">
                    <Button 
                      className="flex-1 h-12 font-black rounded-2xl shadow-lg transition-all group-hover:translate-x-1"
                      style={{ backgroundColor: T.g600, color: T.white }}
                    >
                      Começar Agora
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </div>
                </div>
              </div>
            </Card>

            {/* Equipa OrbisLink Card */}
            <Card 
              className="group border-none shadow-sm hover:shadow-xl transition-all duration-500 rounded-[2rem] overflow-hidden cursor-pointer"
              style={{ backgroundColor: T.white }}
              onClick={() => navigate('/dashboard')}
            >
              <div className="flex flex-col sm:flex-row h-full">
                <div className="sm:w-1/3 p-8 flex items-center justify-center transition-transform group-hover:scale-110 duration-500" style={{ backgroundColor: T.ePale }}>
                  <div className="relative">
                    <div className="absolute inset-0 rounded-full blur-xl opacity-40" style={{ backgroundColor: T.e500 }} />
                    <BarChart3 className="h-16 w-16 relative z-10" style={{ color: T.e700 }} />
                  </div>
                </div>
                <div className="flex-1 p-8 flex flex-col justify-center">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: T.e500 }} />
                    <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: T.muted }}>Administração</span>
                  </div>
                  <CardTitle className="text-2xl font-black mb-3" style={{ color: T.ink }}>
                    Equipa OrbisLink
                  </CardTitle>
                  <CardDescription className="text-sm font-medium mb-6 leading-relaxed" style={{ color: T.mid }}>
                    Aceda ao painel de controlo central para gerir operações, logística e inteligência de mercado.
                  </CardDescription>
                  <Button 
                    variant="outline"
                    className="w-full h-12 font-black rounded-2xl border-2 transition-all"
                    style={{ borderColor: T.rule, color: T.ink }}
                  >
                    Aceder Dashboard
                    <ArrowRight className="h-4 w-4 ml-2" style={{ color: T.e700 }} />
                  </Button>
                </div>
              </div>
            </Card>
          </div>

          {/* Features Strip */}
          <div className="mt-12 grid grid-cols-3 gap-6">
            <div className="flex flex-col items-center text-center group">
              <div className="h-12 w-12 rounded-2xl flex items-center justify-center mb-3 transition-colors group-hover:bg-g100" style={{ backgroundColor: T.white, border: `1px solid ${T.rule}` }}>
                <Globe className="h-5 w-5" style={{ color: T.g600 }} />
              </div>
              <div className="text-[10px] font-black uppercase tracking-widest" style={{ color: T.ink }}>Global</div>
              <div className="text-[9px] font-bold" style={{ color: T.muted }}>Mercados B2B</div>
            </div>
            <div className="flex flex-col items-center text-center group">
              <div className="h-12 w-12 rounded-2xl flex items-center justify-center mb-3 transition-colors group-hover:bg-g100" style={{ backgroundColor: T.white, border: `1px solid ${T.rule}` }}>
                <ShieldCheck className="h-5 w-5" style={{ color: T.g600 }} />
              </div>
              <div className="text-[10px] font-black uppercase tracking-widest" style={{ color: T.ink }}>Seguro</div>
              <div className="text-[9px] font-bold" style={{ color: T.muted }}>Verificado</div>
            </div>
            <div className="flex flex-col items-center text-center group">
              <div className="h-12 w-12 rounded-2xl flex items-center justify-center mb-3 transition-colors group-hover:bg-g100" style={{ backgroundColor: T.white, border: `1px solid ${T.rule}` }}>
                <Zap className="h-5 w-5" style={{ color: T.g600 }} />
              </div>
              <div className="text-[10px] font-black uppercase tracking-widest" style={{ color: T.ink }}>Rápido</div>
              <div className="text-[9px] font-bold" style={{ color: T.muted }}>Digital 24/7</div>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center mt-16 pt-8 border-t" style={{ borderColor: T.rule }}>
            <p className="text-[10px] font-bold uppercase tracking-[0.3em]" style={{ color: T.faint }}>
              Conectando mercados • Movendo economias
            </p>
            <p className="text-[10px] mt-4" style={{ color: T.muted }}>
              © <span className="font-black" style={{ color: T.g700 }}>OrbisLink Lda</span> 2025
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
