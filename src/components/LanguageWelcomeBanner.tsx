import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from './ui/button';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGlobe, faCheck, faChevronRight, faSeedling, faHandshake, faChartColumn } from '@fortawesome/free-solid-svg-icons';
import orbisLinkLogo from '../assets/orbislink-logo.png';

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

const languages = [
  { code: 'pt', name: 'Português', flag: 'PT', greeting: 'Bem-vindo!' },
  { code: 'en', name: 'English', flag: 'EN', greeting: 'Welcome!' },
  { code: 'fr', name: 'Français', flag: 'FR', greeting: 'Bienvenue!' },
];

export const LanguageWelcomeBanner = () => {
  const { i18n } = useTranslation();
  const [showBanner, setShowBanner] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState(i18n.language || 'pt');
  const [step, setStep] = useState<'language' | 'welcome'>('language');

  useEffect(() => {
    const hasSeenWelcome = localStorage.getItem('agrilink_welcome_seen');
    if (!hasSeenWelcome) {
      setShowBanner(true);
    }
  }, []);

  const handleSelectLanguage = (code: string) => {
    setSelectedLanguage(code);
    i18n.changeLanguage(code);
  };

  const handleContinue = () => {
    if (step === 'language') {
      setStep('welcome');
    } else {
      localStorage.setItem('agrilink_language', selectedLanguage);
      localStorage.setItem('agrilink_welcome_seen', 'true');
      setShowBanner(false);
    }
  };

  if (!showBanner) return null;

  const selectedLang = languages.find(l => l.code === selectedLanguage);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md p-4">
      <div 
        className="rounded-[2.5rem] shadow-2xl max-w-sm w-full overflow-hidden animate-in fade-in zoom-in duration-500"
        style={{ backgroundColor: T.canvas }}
      >
        {/* Header with logo */}
        <div className="px-8 py-10 flex flex-col items-center text-center relative overflow-hidden" style={{ backgroundColor: T.g900 }}>
          {/* Decorative element */}
          <div className="absolute top-[-20%] right-[-10%] w-32 h-32 rounded-full blur-2xl opacity-20" style={{ backgroundColor: T.goldL }} />
          
          <img src={orbisLinkLogo} alt="AgriLink" className="h-16 mb-4 relative z-10 drop-shadow-md" />
          <div className="flex items-center gap-2 relative z-10">
            <div className="h-px w-4" style={{ backgroundColor: T.goldL }} />
            <p className="text-[10px] font-black tracking-[0.3em] uppercase" style={{ color: T.goldL }}>
              Marketplace Agrícola
            </p>
            <div className="h-px w-4" style={{ backgroundColor: T.goldL }} />
          </div>
        </div>

        {step === 'language' ? (
          <div className="p-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-xl" style={{ backgroundColor: T.g50 }}>
                <FontAwesomeIcon icon={faGlobe} className="h-5 w-5" style={{ color: T.g600 }} />
              </div>
              <h2 className="text-xl font-black tracking-tight" style={{ color: T.ink }}>
                Escolha o idioma
              </h2>
            </div>
            <p className="text-xs font-bold uppercase tracking-wider mb-6" style={{ color: T.muted }}>
              Select your language
            </p>

            <div className="space-y-3 mb-8">
              {languages.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => handleSelectLanguage(lang.code)}
                  className="w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all duration-300 group"
                  style={{ 
                    borderColor: selectedLanguage === lang.code ? T.g600 : T.rule,
                    backgroundColor: selectedLanguage === lang.code ? T.white : 'transparent',
                    boxShadow: selectedLanguage === lang.code ? `0 10px 20px ${T.shadow}` : 'none'
                  }}
                >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-black border-2 transition-transform group-hover:scale-110"
                        style={{ 
                          borderColor: selectedLanguage === lang.code ? T.g600 : T.rule,
                          backgroundColor: selectedLanguage === lang.code ? T.white : 'transparent',
                          color: selectedLanguage === lang.code ? T.g600 : T.muted
                        }}>
                        {lang.flag}
                      </div>
                      <div className="text-left">
                      <span className="font-black block text-sm" style={{ color: T.ink }}>{lang.name}</span>
                      <span className="text-[10px] font-bold uppercase tracking-tight" style={{ color: T.muted }}>{lang.greeting}</span>
                    </div>
                  </div>
                  {selectedLanguage === lang.code && (
                    <div className="h-6 w-6 rounded-full flex items-center justify-center shadow-sm" style={{ backgroundColor: T.g600 }}>
                      <FontAwesomeIcon icon={faCheck} className="h-3.5 w-3.5 text-white" />
                    </div>
                  )}
                </button>
              ))}
            </div>

            <Button 
              onClick={handleContinue} 
              className="w-full h-14 font-black rounded-2xl shadow-lg transition-all active:scale-95 gap-2"
              style={{ backgroundColor: T.g600, color: T.white }}
            >
              {selectedLanguage === 'pt' && 'Continuar'}
              {selectedLanguage === 'en' && 'Continue'}
              {selectedLanguage === 'fr' && 'Continuer'}
              <FontAwesomeIcon icon={faChevronRight} className="h-5 w-5" />
            </Button>
          </div>
        ) : (
          <div className="p-8 text-center">
            <div className="relative inline-block mb-6">
              <div className="absolute inset-0 rounded-full blur-2xl opacity-30" style={{ backgroundColor: T.g400 }} />
              <div className="w-16 h-16 rounded-full flex items-center justify-center text-sm font-black border-2 relative z-10 animate-bounce-slow" style={{ animationDuration: '3s', backgroundColor: T.white, borderColor: T.g600, color: T.g600 }}>{selectedLang?.flag}</div>
            </div>
            
            <h2 className="text-3xl font-black mb-3 tracking-tight" style={{ color: T.ink }}>
              {selectedLang?.greeting} <FontAwesomeIcon icon={faSeedling} className="text-2xl" style={{ color: T.g600 }} />
            </h2>
            <p className="text-sm font-medium mb-8 leading-relaxed" style={{ color: T.mid }}>
              {selectedLanguage === 'pt' && 'O AgriLink conecta a terra ao mercado global de forma simples e segura. Vamos começar!'}
              {selectedLanguage === 'en' && 'AgriLink connects the land to the global market simply and securely. Let\'s get started!'}
              {selectedLanguage === 'fr' && 'AgriLink connecte la terre au marché mondial simplement et en toute sécurité. Commençons !'}
            </p>

            <div className="grid grid-cols-3 gap-3 mb-8">
              <div className="flex flex-col items-center p-3 rounded-2xl border transition-colors hover:bg-white" style={{ backgroundColor: T.g50, borderColor: T.gBorder }}>
                <FontAwesomeIcon icon={faSeedling} className="h-5 w-5 mb-2" style={{ color: T.g600 }} />
                <p className="text-[9px] font-black uppercase tracking-tighter" style={{ color: T.ink }}>
                  {selectedLanguage === 'pt' ? 'Produção' : selectedLanguage === 'en' ? 'Production' : 'Production'}
                </p>
              </div>
              <div className="flex flex-col items-center p-3 rounded-2xl border transition-colors hover:bg-white" style={{ backgroundColor: T.ePale, borderColor: T.eBorder }}>
                <FontAwesomeIcon icon={faHandshake} className="h-5 w-5 mb-2" style={{ color: T.e700 }} />
                <p className="text-[9px] font-black uppercase tracking-tighter" style={{ color: T.ink }}>
                  {selectedLanguage === 'pt' ? 'Negócio' : selectedLanguage === 'en' ? 'Business' : 'Commerce'}
                </p>
              </div>
              <div className="flex flex-col items-center p-3 rounded-2xl border transition-colors hover:bg-white" style={{ backgroundColor: T.g50, borderColor: T.gBorder }}>
                <FontAwesomeIcon icon={faChartColumn} className="h-5 w-5 mb-2" style={{ color: T.g600 }} />
                <p className="text-[9px] font-black uppercase tracking-tighter" style={{ color: T.ink }}>
                  {selectedLanguage === 'pt' ? 'Mercado' : selectedLanguage === 'en' ? 'Market' : 'Marché'}
                </p>
              </div>
            </div>

            <Button 
              onClick={handleContinue} 
              className="w-full h-14 font-black rounded-2xl shadow-lg transition-all active:scale-95 gap-2"
              style={{ backgroundColor: T.g900, color: T.white }}
            >
              {selectedLanguage === 'pt' && 'Começar a explorar'}
              {selectedLanguage === 'en' && 'Start exploring'}
              {selectedLanguage === 'fr' && 'Commencer à explorer'}
              <FontAwesomeIcon icon={faChevronRight} className="h-5 w-5" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
