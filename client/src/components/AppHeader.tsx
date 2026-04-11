import { useAuth } from '@/contexts/AuthContext';
import { useHeader } from '@/contexts/HeaderContext';
import { useProfileSheet } from '@/contexts/ProfileSheetContext';
import api from '@/lib/api';
import { getUserIdFromToken } from '@/lib/jwt';
import { ChevronLeft, LogOut } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';

const LOGO =
  'https://images.squarespace-cdn.com/content/v1/5bc9186e34c4e27773d92870/1546175613378-UHI78Z3KGSEOFFJEAP0B/logo-site.png';

export default function AppHeader() {
  const { user, logout } = useAuth();
  const { config } = useHeader();
  const { openProfile } = useProfileSheet();
  const [, setLocation] = useLocation();
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

  /* ── não renderiza nas páginas que pedem esconder (login, public) ── */
  if (config.hide || !user) return null;

  const initial = (user.name ?? 'U')[0].toUpperCase();

  const handleLogout = () => {
    logout();
    setLocation('/login');
  };

  return (
    <header
      className="sticky top-0 z-40 w-full"
      style={{
        backgroundColor: '#0A1F3F',
        borderBottomLeftRadius: '20px',
        borderBottomRightRadius: '20px',
        paddingTop: 'max(12px, env(safe-area-inset-top))',
      }}
    >
      <div className="max-w-2xl mx-auto px-4 pb-3 flex items-center gap-3">

        {/* ── Botão voltar (opcional) ── */}
        {config.backTo && (
          <button
            onClick={() => setLocation(config.backTo!)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium flex-shrink-0 transition-all active:scale-95"
            style={{ backgroundColor: 'rgba(255,255,255,0.12)', color: '#fff' }}
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="hidden sm:inline">{config.backLabel ?? 'Voltar'}</span>
          </button>
        )}

        {/* ── Logo + título ── */}
        <div className="flex-1 min-w-0">
          <img
            src={LOGO}
            alt="IECG"
            className="h-7 w-auto"
            style={{ filter: 'brightness(0) invert(1)' }}
          />
          {config.subtitle && (
            <p className="text-xs truncate mt-0.5" style={{ color: '#4A90D9' }}>
              {config.subtitle}
            </p>
          )}
        </div>

        {/* ── Avatar → abre perfil ── */}
        <button
          onClick={openProfile}
          title="Meu Perfil"
          className="flex items-center justify-center rounded-full transition-all active:scale-95 flex-shrink-0"
          style={{ backgroundColor: 'rgba(255,255,255,0.1)', padding: '4px' }}
        >
          <div
            className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center text-white text-xs font-bold"
            style={{ backgroundColor: '#C9A84C' }}
          >
            {avatarImage
              ? <img src={avatarImage} alt="avatar" className="w-full h-full object-cover" />
              : initial}
          </div>
        </button>

        {/* ── Logout ── */}
        <button
          onClick={handleLogout}
          title="Sair"
          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all active:scale-95"
          style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
        >
          <LogOut className="w-4 h-4 text-white" />
        </button>
      </div>
    </header>
  );
}
