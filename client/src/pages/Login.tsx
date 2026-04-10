import { useAuth } from '@/contexts/AuthContext';
import { AlertCircle, Lock, Loader2, Mail, Wifi, WifiOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';

const LOGO =
  'https://images.squarespace-cdn.com/content/v1/5bc9186e34c4e27773d92870/1546175613378-UHI78Z3KGSEOFFJEAP0B/logo-site.png';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );
  const {
    user,
    isLoading: isAuthLoading,
    login,
    loginOffline,
    hasOfflineSession,
    offlineSessionEmail,
  } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    const update = () => setIsOnline(navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  useEffect(() => {
    if (!isAuthLoading && user) setLocation('/home');
  }, [isAuthLoading, user, setLocation]);

  useEffect(() => {
    if (!email && offlineSessionEmail) setEmail(offlineSessionEmail);
  }, [offlineSessionEmail, email]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      await login(email, password);
      setLocation('/home');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha no login. Verifique suas credenciais.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOfflineLogin = () => {
    try {
      setError('');
      loginOffline(email || undefined);
      setLocation('/events');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao entrar offline.');
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col relative overflow-hidden"
      style={{ backgroundColor: '#0A1F3F' }}
    >
      {/* ── Círculos decorativos ── */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: -100, right: -100,
          width: 320, height: 320, borderRadius: '50%',
          backgroundColor: 'rgba(255,255,255,0.04)',
        }}
      />
      <div
        className="absolute pointer-events-none"
        style={{
          top: 80, right: -50,
          width: 180, height: 180, borderRadius: '50%',
          backgroundColor: 'rgba(74,144,217,0.07)',
        }}
      />
      <div
        className="absolute pointer-events-none"
        style={{
          bottom: -80, left: -80,
          width: 280, height: 280, borderRadius: '50%',
          backgroundColor: 'rgba(201,168,76,0.07)',
        }}
      />
      <div
        className="absolute pointer-events-none"
        style={{
          bottom: 120, right: -30,
          width: 120, height: 120, borderRadius: '50%',
          backgroundColor: 'rgba(255,255,255,0.03)',
        }}
      />

      {/* ── Status online/offline (pill) ── */}
      <div className="absolute top-4 left-4 z-10">
        <span
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
          style={{
            backgroundColor: 'rgba(255,255,255,0.08)',
            color: isOnline ? '#4ADE80' : '#FCD34D',
          }}
        >
          {isOnline
            ? <Wifi className="w-3 h-3" />
            : <WifiOff className="w-3 h-3" />}
          {isOnline ? 'Online' : 'Offline'}
        </span>
      </div>

      {/* ── Área do logo ── */}
      <div className="flex flex-col items-center justify-center px-8 pt-24 pb-10 animate-in fade-in slide-in-from-top-4 duration-600">
        <img
          src={LOGO}
          alt="IECG"
          className="h-16 w-auto mb-8"
          style={{ filter: 'brightness(0) invert(1)' }}
        />
        <h1 className="text-3xl font-extrabold text-white text-center leading-tight mb-2">
          Bem-vindo
        </h1>
        <p className="text-sm text-center" style={{ color: 'rgba(255,255,255,0.45)' }}>
          Faça login para acessar o portal
        </p>
      </div>

      {/* ── Formulário ── */}
      <div
        className="flex-1 px-6 pb-10 animate-in fade-in slide-in-from-bottom-6 duration-600"
        style={{ animationDelay: '100ms' }}
      >
        <div className="space-y-3 max-w-sm mx-auto">

          {/* ── Bloco offline ── aparece quando sem conexão */}
          {!isOnline && (
            <div className="animate-in fade-in slide-in-from-top-3 duration-400 space-y-3">
              {hasOfflineSession ? (
                /* Sessão disponível → botão principal destacado */
                <button
                  type="button"
                  onClick={handleOfflineLogin}
                  disabled={isLoading}
                  className="w-full rounded-2xl text-left px-5 py-4 transition-all duration-200 active:scale-[0.98] disabled:opacity-60"
                  style={{
                    backgroundColor: 'rgba(201,168,76,0.15)',
                    border: '1.5px solid rgba(201,168,76,0.5)',
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: 'rgba(201,168,76,0.2)' }}
                    >
                      <WifiOff className="w-5 h-5" style={{ color: '#C9A84C' }} />
                    </div>
                    <div>
                      <p className="text-sm font-bold" style={{ color: '#C9A84C' }}>
                        Entrar offline
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.45)' }}>
                        Sessão salva{offlineSessionEmail ? ` · ${offlineSessionEmail}` : ''}
                      </p>
                    </div>
                  </div>
                </button>
              ) : (
                /* Sem sessão → aviso */
                <div
                  className="rounded-2xl px-5 py-4 flex items-start gap-3"
                  style={{
                    backgroundColor: 'rgba(252,165,165,0.1)',
                    border: '1px solid rgba(252,165,165,0.25)',
                  }}
                >
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#FCA5A5' }} />
                  <div>
                    <p className="text-sm font-semibold" style={{ color: '#FCA5A5' }}>
                      Sem sessão offline
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
                      Para usar offline, faça login com internet uma primeira vez neste dispositivo.
                    </p>
                  </div>
                </div>
              )}

              {/* Divisor */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }} />
                <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  ou tente com credenciais
                </span>
                <div className="flex-1 h-px" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }} />
              </div>
            </div>
          )}

          {/* ── Erro ── */}
          {error && (
            <div
              className="flex items-start gap-2.5 px-4 py-3 rounded-2xl text-sm"
              style={{ backgroundColor: 'rgba(220,38,38,0.15)', border: '1px solid rgba(220,38,38,0.3)' }}
            >
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#FCA5A5' }} />
              <p style={{ color: '#FCA5A5' }}>{error}</p>
            </div>
          )}

          {/* ── Form e-mail + senha ── */}
          <form onSubmit={handleSubmit} className="space-y-3">
            {/* Campo e-mail */}
            <div className="relative">
              <Mail
                className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
                style={{ color: 'rgba(255,255,255,0.35)' }}
              />
              <input
                type="email"
                placeholder="E-mail"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
                autoComplete="email"
                className="w-full h-14 pl-11 pr-4 rounded-2xl text-white text-sm outline-none transition-all duration-200 disabled:opacity-60"
                style={{
                  backgroundColor: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}
                onFocus={(e) => (e.currentTarget.style.border = '1px solid rgba(201,168,76,0.6)')}
                onBlur={(e) => (e.currentTarget.style.border = '1px solid rgba(255,255,255,0.1)')}
              />
            </div>

            {/* Campo senha */}
            <div className="relative">
              <Lock
                className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
                style={{ color: 'rgba(255,255,255,0.35)' }}
              />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
                autoComplete="current-password"
                className="w-full h-14 pl-11 pr-12 rounded-2xl text-white text-sm outline-none transition-all duration-200 disabled:opacity-60"
                style={{
                  backgroundColor: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}
                onFocus={(e) => (e.currentTarget.style.border = '1px solid rgba(201,168,76,0.6)')}
                onBlur={(e) => (e.currentTarget.style.border = '1px solid rgba(255,255,255,0.1)')}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold transition-opacity hover:opacity-80"
                style={{ color: 'rgba(255,255,255,0.4)' }}
                tabIndex={-1}
              >
                {showPassword ? 'OCULTAR' : 'VER'}
              </button>
            </div>

            {/* Botão entrar */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-14 rounded-2xl font-bold text-base flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.98] disabled:opacity-70 mt-2"
              style={{
                backgroundColor: isOnline ? '#C9A84C' : 'rgba(201,168,76,0.4)',
                color: '#0A1F3F',
              }}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Entrando...
                </>
              ) : isOnline ? (
                'Entrar'
              ) : (
                'Tentar mesmo assim'
              )}
            </button>
          </form>

          {/* Sessão salva — só aparece quando online */}
          {isOnline && hasOfflineSession && (
            <button
              type="button"
              onClick={handleOfflineLogin}
              disabled={isLoading}
              className="w-full h-12 rounded-2xl text-sm font-semibold transition-all duration-200 active:scale-[0.98] disabled:opacity-60"
              style={{
                backgroundColor: 'transparent',
                border: '1px solid rgba(255,255,255,0.18)',
                color: 'rgba(255,255,255,0.7)',
              }}
            >
              Entrar com sessão salva
              {offlineSessionEmail && (
                <span className="block text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  {offlineSessionEmail}
                </span>
              )}
            </button>
          )}
        </div>

        {/* Rodapé */}
        <p className="text-center text-xs mt-8" style={{ color: 'rgba(255,255,255,0.2)' }}>
          IECG · Portal Gerencial · v1.0
        </p>
      </div>
    </div>
  );
}
