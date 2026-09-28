import { type CSSProperties } from 'react';
import { useAuth } from "@/contexts/AuthContext";
import { useHeader } from "@/contexts/HeaderContext";
import { Calendar, Church, ChevronRight, Users, MessageCircleQuestion, QrCode } from "lucide-react";
import { useLocation } from "wouter";

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
}

export default function Home() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  useHeader({});

  const perfis = (user?.perfis ?? []).map((p) => p.toLowerCase());
  const permissoes = (user?.permissoes ?? []).map((p) => p.toUpperCase());
  const isAdmin = perfis.some((p) => p === "administrador" || p === "admin");
  const showEventos =
    isAdmin ||
    perfis.includes("eventos") ||
    perfis.includes("coordenador_evento") ||
    perfis.includes("colaborador_evento") ||
    permissoes.includes("EVENTS_ACESS") ||
    permissoes.includes("EVENTS_ACCESS") ||
    permissoes.includes("EVENTS_VIEW_ALL") ||
    permissoes.includes("EVENTS_COORDINATOR_MANAGE") ||
    permissoes.includes("EVENTS_CHECKIN");
  const showCultos = isAdmin || perfis.includes("backstage");
  const showCelula =
    isAdmin ||
    perfis.includes("lider_celula") ||
    perfis.includes("celula") ||
    permissoes.includes("LIDER_CELULA_PRESENCA");
  const showPerguntas =
    isAdmin ||
    permissoes.includes("PERGUNTAS_AO_VIVO_GERENCIAR") ||
    permissoes.includes("PERGUNTAS_AO_VIVO_MODERAR");
  const showCfm = isAdmin || permissoes.includes("CFM_ADMIN");

  const firstName = user?.name?.split(" ")[0] ?? "Usuário";
  const hasAny = showEventos || showCultos || showCelula || showPerguntas || showCfm;

  const modules = [
    { visible: showEventos, title: 'Eventos', description: 'Inscrições, check-in e gestão.', icon: Calendar, color: '#244ac0', href: '/events' },
    { visible: showCultos, title: 'Cultos', description: 'Registros e presença da igreja.', icon: Church, color: '#8c672b', href: '/cultos' },
    { visible: showCelula, title: 'Minha célula', description: 'Membros, encontros e presença.', icon: Users, color: '#28745f', href: '/celula' },
    { visible: showPerguntas, title: 'Perguntas ao vivo', description: 'Salas e moderação de perguntas.', icon: MessageCircleQuestion, color: '#695592', href: '/perguntas' },
    { visible: showCfm, title: 'Presença CFM', description: 'Leitura de ingressos por QR Code.', icon: QrCode, color: '#9a592c', href: '/cfm/presenca' },
  ].filter(module => module.visible);

  return (
    <div className="portal-page">
      <main className="portal-home">
        <header className="portal-home-intro">
          <div>
            <span className="portal-eyebrow">{greeting()}</span>
            <h1>{firstName}.</h1>
            <p>O que vamos organizar hoje?</p>
          </div>
        </header>
        {hasAny ? (
          <div className="portal-module-grid">
            {modules.map(({ title, description, icon: Icon, color, href }) => (
              <button key={href} type="button" className="portal-module" style={{ '--module-color': color } as CSSProperties} onClick={() => setLocation(href)}>
                <span className="portal-module-icon"><Icon size={23} strokeWidth={1.6} aria-hidden="true" /></span>
                <div className="portal-module-copy"><strong>{title}</strong><p>{description}</p></div>
                <ChevronRight className="portal-module-arrow" size={20} aria-hidden="true" />
              </button>
            ))}
          </div>
        ) : (
          <div className="portal-panel p-8 text-center">
            <p className="font-semibold">Nenhum módulo disponível para o seu perfil.</p>
            <p className="text-sm text-muted-foreground mt-2">Fale com a equipe responsável para verificar seu acesso.</p>
          </div>
        )}
        <footer className="portal-home-footer"><span>IECG · Portal Gerencial</span></footer>
      </main>
    </div>
  );
}
