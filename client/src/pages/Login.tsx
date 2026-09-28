import { useAuth } from '@/contexts/AuthContext';
import { BrandMark } from '@/components/BrandMark';
import { authAPI } from '@/lib/api';
import { AlertCircle, ArrowRight, Loader2, Mail, Wifi, WifiOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';

/** Converte qualquer erro de login numa mensagem amigável em português. */
function resolveLoginError(err: unknown): string {
  const anyErr = err as {
    response?: { status?: number; data?: { erro?: string; message?: string; mensagem?: string } };
    message?: string;
  };
  const status = anyErr?.response?.status;
  const data = anyErr?.response?.data;

  if (status === 401 || status === 403) {
    return 'E-mail ou senha incorretos. Verifique e tente novamente.';
  }
  if (status === 429) {
    return 'Muitas tentativas. Aguarde alguns instantes e tente de novo.';
  }
  if (status && status >= 500) {
    return 'Nosso servidor está com instabilidade. Tente novamente em instantes.';
  }
  const backendMsg = data?.erro || data?.mensagem || data?.message;
  if (backendMsg) return backendMsg;

  // Erro de rede (sem response) já vem com mensagem amigável do AuthContext.
  if (anyErr?.message && !anyErr.message.startsWith('Request failed')) {
    return anyErr.message;
  }
  return 'Não foi possível entrar. Verifique sua conexão e suas credenciais.';
}

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [forgotMsg, setForgotMsg] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [showRecover, setShowRecover] = useState(false);
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
    const saved = localStorage.getItem('savedCredentials');
    const wasExplicitLogout = sessionStorage.getItem('explicitLogout') === '1';
    if (wasExplicitLogout) {
      sessionStorage.removeItem('explicitLogout');
    }
    if (saved) {
      try {
        const { email: savedEmail, password: savedPassword } = JSON.parse(saved);
        if (savedEmail) setEmail(savedEmail);
        if (savedPassword) setPassword(savedPassword);
        setRememberMe(true);

        // auto-login silencioso — pula se foi um logout explícito
        if (savedEmail && savedPassword && !wasExplicitLogout) {
          setIsLoading(true);
          login(savedEmail, savedPassword)
            .then(() => setLocation('/home'))
            .catch(() => {
              // falhou (ex: offline ou senha mudou) — mostra o form preenchido
              setIsLoading(false);
            });
        }
      } catch {
        // ignore
      }
    } else if (offlineSessionEmail) {
      setEmail(offlineSessionEmail);
    }
  }, []);

  useEffect(() => {
    if (!email && offlineSessionEmail) setEmail(offlineSessionEmail);
  }, [offlineSessionEmail, email]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      await login(email, password);
      if (rememberMe) {
        localStorage.setItem('savedCredentials', JSON.stringify({ email, password }));
      } else {
        localStorage.removeItem('savedCredentials');
      }
      setLocation('/home');
    } catch (err) {
      setError(resolveLoginError(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    setError('');
    setForgotMsg('');
    const emailTrim = email.trim();
    if (!emailTrim) {
      setError('Informe seu e-mail para receber uma nova senha.');
      return;
    }
    setForgotLoading(true);
    try {
      const { data } = await authAPI.forgotPassword(emailTrim);
      setForgotMsg(data?.message || 'Se o e-mail estiver cadastrado, enviaremos uma nova senha em instantes.');
    } catch {
      // Mensagem genérica mesmo em erro (não revela se o e-mail existe)
      setForgotMsg('Se o e-mail estiver cadastrado, enviaremos uma nova senha em instantes.');
    } finally {
      setForgotLoading(false);
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
    <main className="portal-login">
      <div className="portal-login-shell">
      <header className="portal-login-story">
        <div className="portal-login-brand-row">
          <BrandMark />
          <span className="portal-login-status" role="status">
            {isOnline ? <Wifi size={14} aria-hidden="true" /> : <WifiOff size={14} aria-hidden="true" />}
            {isOnline ? 'Online' : 'Offline'}
          </span>
        </div>
        <div className="portal-login-welcome">
          <span className="portal-eyebrow">Portal Gerencial</span>
          <p>IECG.<br /><span>Até os Confins da Terra</span></p>
        </div>
        <div className="portal-login-doorway" aria-hidden="true"><i /><i /><i /></div>
      </header>
      <section className="portal-login-main" aria-labelledby="login-title">
        <div className="portal-login-form">
          <span className="portal-login-section-label">{showRecover ? 'Recuperação de conta' : 'Seu acesso'}</span>
          <h1 id="login-title">{showRecover ? 'Recupere seu acesso.' : 'Bom ter você aqui.'}</h1>
          <p className="portal-login-lead">{showRecover ? 'Informe seu e-mail para receber uma nova senha.' : 'Entre com sua conta para acessar o portal.'}</p>

          {!isOnline && !showRecover && (
            <div className="portal-login-offline">
              <p>{hasOfflineSession ? 'Use a sessão salva neste dispositivo para continuar sem internet.' : 'Para usar offline, faça login com internet uma primeira vez neste dispositivo.'}</p>
              {hasOfflineSession && <button type="button" onClick={handleOfflineLogin} disabled={isLoading} className="portal-action portal-action-secondary"><WifiOff size={16} aria-hidden="true" />Entrar offline</button>}
            </div>
          )}
          {error && <div className="portal-login-message" role="alert"><AlertCircle size={17} aria-hidden="true" /><p>{error}</p></div>}
          {forgotMsg && <div className="portal-login-message portal-login-message-success" role="status"><Mail size={17} aria-hidden="true" /><p>{forgotMsg}</p></div>}

          {!showRecover ? (
            <form onSubmit={handleSubmit}>
              <label className="portal-login-field" htmlFor="login-email"><span>E-mail</span>
                <input id="login-email" className="portal-input" type="email" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={isLoading} autoComplete="email" />
              </label>
              <div className="portal-login-field">
                <label htmlFor="login-password" className="block text-[13px] font-semibold mb-2">Senha</label>
                <div className="portal-password">
                  <input id="login-password" className="portal-input" type={showPassword ? 'text' : 'password'} placeholder="Sua senha" value={password} onChange={(e) => setPassword(e.target.value)} required disabled={isLoading} autoComplete="current-password" />
                  <button type="button" aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'} aria-pressed={showPassword} onClick={() => setShowPassword(v => !v)}>{showPassword ? 'Ocultar' : 'Mostrar'}</button>
                </div>
              </div>
              <div className="portal-login-options">
                <label><input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)} />Lembrar senha</label>
                <button type="button" className="portal-link" disabled={isLoading} onClick={() => { setError(''); setForgotMsg(''); setShowRecover(true); }}>Esqueci minha senha</button>
              </div>
              <button type="submit" disabled={isLoading} className="portal-action">
                {isLoading && <Loader2 size={18} className="animate-spin" aria-hidden="true" />}
                {isLoading ? 'Entrando…' : isOnline ? 'Entrar no portal' : 'Tentar mesmo assim'}
                {!isLoading && <ArrowRight size={17} aria-hidden="true" />}
              </button>
            </form>
          ) : (
            <form onSubmit={e => { e.preventDefault(); void handleForgotPassword(); }}>
              <label className="portal-login-field" htmlFor="recover-email"><span>E-mail da sua conta</span>
                <input id="recover-email" className="portal-input" type="email" placeholder="seu@email.com" value={email} onChange={e => setEmail(e.target.value)} required disabled={forgotLoading} autoComplete="email" />
              </label>
              <button type="submit" className="portal-action" disabled={forgotLoading}>{forgotLoading && <Loader2 size={18} className="animate-spin" aria-hidden="true" />}{forgotLoading ? 'Enviando…' : 'Enviar nova senha'}</button>
              <button type="button" className="portal-link mt-5 w-full text-center" disabled={forgotLoading} onClick={() => { setError(''); setForgotMsg(''); setShowRecover(false); }}>Voltar ao login</button>
            </form>
          )}
          {isOnline && hasOfflineSession && !showRecover && (
            <div className="portal-login-saved">
              <button type="button" onClick={handleOfflineLogin} disabled={isLoading} className="portal-action portal-action-secondary">Entrar com sessão salva</button>
              {offlineSessionEmail && <small>{offlineSessionEmail}</small>}
            </div>
          )}
        </div>
      </section>
      <footer className="portal-login-footer"><span>IECG</span>Igreja Evangélica Comunidade Global</footer>
      </div>
    </main>
  );
}
