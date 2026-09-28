import { useAuth } from '@/contexts/AuthContext';
import { BrandMark } from '@/components/BrandMark';
import { useHeader } from '@/contexts/HeaderContext';
import { useProfileSheet } from '@/contexts/ProfileSheetContext';
import api from '@/lib/api';
import { getUserIdFromToken } from '@/lib/jwt';
import { ChevronLeft, LogOut } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';

// Rotas públicas (sem ProtectedRoute em App.tsx). Nelas o topo com avatar/logout
// nunca aparece, mesmo com o usuário autenticado — a página fica idêntica para
// quem está logado e para o visitante anônimo. Mantenha em sincronia com App.tsx.
const PUBLIC_ROUTE_PATTERNS: RegExp[] = [
  /^\/$/,
  /^\/login$/,
  /^\/eventos$/,
  /^\/eventos\/[^/]+$/,
  /^\/inscricao\/[^/]+$/,
  /^\/inscricao\/[^/]+\/visualizacao$/,
  /^\/inscricao\/[^/]+\/sucesso$/,
  /^\/pix-confirmacao$/,
  /^\/ticket\/[^/]+$/,
  /^\/kit\/[^/]+$/,
  /^\/etiquetas\/[^/]+$/,
  /^\/voluntariado(?:\/.*)?$/,
  /^\/cadastro-voluntariado$/,
  /^\/404$/,
];

export default function AppHeader() {
  const { user, logout } = useAuth();
  const { config } = useHeader();
  const { openProfile } = useProfileSheet();
  const [location, setLocation] = useLocation();
  const [avatarImage, setAvatarImage] = useState<string | null>(null);

  /* ── busca foto do perfil uma vez ── */
  useEffect(() => {
    if (!user?.accessToken) return;
    const id = getUserIdFromToken(user.accessToken) ?? user.id;
    if (!id) return;
    api.get(`/users/${id}`)
      .then(({ data }) => { if (data.image) setAvatarImage(data.image); })
      .catch(() => {});
  }, [user?.accessToken]);

  /* ── não renderiza nas páginas que pedem esconder, nas rotas públicas
     (mesmo autenticado) ou quando não há usuário ── */
  const isPublicRoute = PUBLIC_ROUTE_PATTERNS.some((re) => re.test(location));
  if (config.hide || isPublicRoute || !user) return null;

  const initial = (user.name ?? 'U')[0].toUpperCase();

  const handleLogout = () => {
    logout();
    setLocation('/login');
  };

  return (
    <header className="portal-header no-print">
      <div className="portal-header-inner">
        {config.backTo && (
          <button type="button" onClick={() => setLocation(config.backTo!)} className="portal-icon-button" aria-label={config.backLabel ?? 'Voltar'}>
            <ChevronLeft size={18} aria-hidden="true" />
          </button>
        )}
        <button type="button" className="portal-header-brand" onClick={() => setLocation('/home')} aria-label="Ir para o início">
          <BrandMark />
          <div><strong>{config.title || 'Portal Gerencial'}</strong><p>{config.subtitle || 'Gerenciamento IECG'}</p></div>
        </button>
        <button type="button" onClick={openProfile} title="Meu perfil" aria-label="Abrir meu perfil" className="portal-avatar">
          {avatarImage ? <img src={avatarImage} alt="" /> : initial}
        </button>
        <button type="button" onClick={handleLogout} title="Sair" aria-label="Sair da conta" className="portal-icon-button"><LogOut size={17} aria-hidden="true" /></button>
      </div>
    </header>
  );
}
