import { Download, Share, X } from 'lucide-react';
import { useEffect, useState } from 'react';

type Platform = 'android' | 'ios' | null;

function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  if (/iphone|ipad|ipod/i.test(ua)) return 'ios';
  if (/android/i.test(ua)) return 'android';
  return null;
}

function isInStandaloneMode(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true
  );
}

export default function InstallPWA() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [show, setShow] = useState(false);
  const [platform, setPlatform] = useState<Platform>(null);
  const [iosStep, setIosStep] = useState(false);

  useEffect(() => {
    // Não mostra se já está instalado
    if (isInStandaloneMode()) return;

    // Não mostra se já foi dispensado nesta sessão
    if (sessionStorage.getItem('pwa-dismissed')) return;

    const detected = detectPlatform();
    setPlatform(detected);

    if (detected === 'android') {
      const handler = (e: Event) => {
        e.preventDefault();
        setDeferredPrompt(e);
        setShow(true);
      };
      window.addEventListener('beforeinstallprompt', handler as EventListener);
      return () => window.removeEventListener('beforeinstallprompt', handler as EventListener);
    }

    if (detected === 'ios') {
      // iOS não dispara beforeinstallprompt — mostra instrução manual
      const timer = setTimeout(() => setShow(true), 3000);
      return () => clearTimeout(timer);
    }
  }, []);

  const dismiss = () => {
    setShow(false);
    sessionStorage.setItem('pwa-dismissed', '1');
  };

  const installAndroid = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setShow(false);
    setDeferredPrompt(null);
  };

  if (!show) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-safe-bottom animate-in slide-in-from-bottom-4 duration-300"
      style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
    >
      <div
        className="rounded-2xl p-4 shadow-2xl"
        style={{
          backgroundColor: '#0A1F3F',
          border: '1px solid rgba(201,168,76,0.3)',
        }}
      >
        {/* Cabeçalho */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <img
              src="/pwa-192x192.png"
              alt="IECG"
              className="w-10 h-10 rounded-xl object-cover"
            />
            <div>
              <p className="text-white font-bold text-sm leading-tight">Portal IECG</p>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
                Adicionar à tela inicial
              </p>
            </div>
          </div>
          <button
            onClick={dismiss}
            className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* Android: botão nativo */}
        {platform === 'android' && (
          <button
            onClick={installAndroid}
            className="w-full h-11 rounded-xl flex items-center justify-center gap-2 font-bold text-sm transition-all active:scale-95"
            style={{ backgroundColor: '#C9A84C', color: '#0A1F3F' }}
          >
            <Download className="w-4 h-4" />
            Instalar aplicativo
          </button>
        )}

        {/* iOS: instrução manual */}
        {platform === 'ios' && !iosStep && (
          <button
            onClick={() => setIosStep(true)}
            className="w-full h-11 rounded-xl flex items-center justify-center gap-2 font-bold text-sm transition-all active:scale-95"
            style={{ backgroundColor: '#C9A84C', color: '#0A1F3F' }}
          >
            <Share className="w-4 h-4" />
            Como instalar no iPhone
          </button>
        )}

        {platform === 'ios' && iosStep && (
          <div
            className="rounded-xl px-4 py-3 space-y-2"
            style={{ backgroundColor: 'rgba(255,255,255,0.07)' }}
          >
            <p className="text-xs font-semibold text-white">Para instalar no iPhone / iPad:</p>
            <ol className="space-y-1.5">
              {[
                <>Toque em <Share className="inline w-3.5 h-3.5 mx-0.5 -mt-0.5" style={{ color: '#C9A84C' }} /> <strong style={{ color: '#C9A84C' }}>Compartilhar</strong> na barra do Safari</>,
                <>Role e toque em <strong style={{ color: '#C9A84C' }}>"Adicionar à Tela de Início"</strong></>,
                <>Confirme tocando em <strong style={{ color: '#C9A84C' }}>"Adicionar"</strong></>,
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-2 text-xs" style={{ color: 'rgba(255,255,255,0.75)' }}>
                  <span
                    className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold mt-0.5"
                    style={{ backgroundColor: 'rgba(201,168,76,0.2)', color: '#C9A84C' }}
                  >
                    {i + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}
