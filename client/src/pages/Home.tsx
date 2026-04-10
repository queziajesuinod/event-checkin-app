import { useAuth } from "@/contexts/AuthContext";
import { Calendar, ChevronRight, Church, LogOut } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";

const C = {
  navy: "#0A1F3F",
  blue: "#1B4D8E",
  sky: "#4A90D9",
  surface: "#F0F2F5",
  white: "#FFFFFF",
  gold: "#C9A84C",
};

interface ModuleCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  delay?: string;
}

function ModuleCard({ title, description, icon, label, onClick, delay = "0ms" }: ModuleCardProps) {
  const [pressed, setPressed] = useState(false);

  return (
    <div
      onClick={onClick}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      onTouchStart={() => setPressed(true)}
      onTouchEnd={() => setPressed(false)}
      className="animate-in fade-in slide-in-from-bottom-6 duration-500 cursor-pointer"
      style={{ animationDelay: delay }}
    >
      <div
        className="rounded-2xl overflow-hidden transition-all duration-200"
        style={{
          backgroundColor: C.white,
          transform: pressed ? "scale(0.975)" : "scale(1)",
          boxShadow: pressed
            ? "0 2px 8px rgba(10,31,63,0.08)"
            : "0 4px 20px rgba(10,31,63,0.12)",
        }}
      >
        {/* Barra superior */}
        <div className="h-1 w-full" style={{ backgroundColor: C.blue }} />

        <div className="p-5">
          <div className="flex items-start gap-4">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: "#EBF2FB" }}
            >
              {icon}
            </div>

            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-lg leading-tight mb-1" style={{ color: C.navy }}>
                {title}
              </h3>
              <p className="text-sm leading-relaxed" style={{ color: "#6B7280" }}>
                {description}
              </p>
            </div>
          </div>

          <div
            className="mt-4 pt-4 flex items-center justify-between"
            style={{ borderTop: "1px solid #F0F2F5" }}
          >
            <span className="text-sm font-semibold" style={{ color: C.blue }}>
              {label}
            </span>
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center transition-colors duration-200"
              style={{ backgroundColor: pressed ? C.gold : "#FBF5E6" }}
            >
              <ChevronRight
                className="w-4 h-4 transition-colors duration-200"
                style={{ color: pressed ? C.white : C.gold }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [, setLocation] = useLocation();
  const { user, logout } = useAuth();

  const perfis = user?.perfis ?? [];
  const isAdmin = perfis.includes("Administrador");
  const showEventos = isAdmin || perfis.includes("EVENTOS");
  const showCultos = isAdmin || perfis.includes("BACKSTAGE");

  const handleLogout = () => {
    logout();
    setLocation("/login");
  };

  const initial = (user?.name ?? "U")[0].toUpperCase();
  const firstName = user?.name?.split(" ")[0] ?? "Usuário";

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: C.surface }}>
      {/* Header */}
      <header
        className="px-4 py-3 flex items-center justify-between"
        style={{ backgroundColor: C.navy }}
      >
        <div className="animate-in fade-in slide-in-from-left-4 duration-500">
          <img
            src="https://images.squarespace-cdn.com/content/v1/5bc9186e34c4e27773d92870/1546175613378-UHI78Z3KGSEOFFJEAP0B/logo-site.png"
            alt="IECG"
            className="h-8 w-auto"
            style={{ filter: 'brightness(0) invert(1)' }}
          />
        </div>

        <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-4 duration-500">
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-full"
            style={{ backgroundColor: "rgba(255,255,255,0.1)" }}
          >
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
              style={{ backgroundColor: C.gold }}
            >
              {initial}
            </div>
          </div>

          <button
            onClick={handleLogout}
            title="Sair"
            className="w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 active:scale-95"
            style={{ backgroundColor: "rgba(255,255,255,0.1)" }}
          >
            <LogOut className="w-4 h-4 text-white" />
          </button>
        </div>
      </header>

      {/* Saudação */}
      <div
        className="px-4 pt-6 pb-12 text-center"
        style={{ backgroundColor: C.navy, borderBottomLeftRadius: '24px', borderBottomRightRadius: '24px' }}
      >
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-600">
          <p
            className="text-xs font-semibold uppercase tracking-widest mb-1"
            style={{ color: C.gold }}
          >
            Bem-vindo de volta
          </p>
          <h2 className="text-xl font-extrabold text-white tracking-tight">{firstName}</h2>
        </div>
      </div>

      {/* Cards */}
      <main className="flex-1 px-4 -mt-6 pb-10 w-full max-w-md mx-auto space-y-4">
        {showEventos && (
          <ModuleCard
            title="Eventos"
            description="Gerencie eventos e realize check-ins de participantes"
            icon={<Calendar className="w-6 h-6" style={{ color: C.blue }} />}
            label="Acessar Eventos"
            onClick={() => setLocation("/events")}
            delay="100ms"
          />
        )}

        {showCultos && (
          <ModuleCard
            title="Cultos"
            description="Registre cultos e acompanhe presença e ministérios"
            icon={<Church className="w-6 h-6" style={{ color: C.blue }} />}
            label="Registrar Cultos"
            onClick={() => setLocation("/cultos")}
            delay="200ms"
          />
        )}

        {!showEventos && !showCultos && (
          <div
            className="rounded-2xl p-6 text-center animate-in fade-in duration-500"
            style={{
              backgroundColor: C.white,
              boxShadow: "0 4px 20px rgba(10,31,63,0.08)",
            }}
          >
            <p className="text-sm" style={{ color: "#9CA3AF" }}>
              Nenhum módulo disponível para o seu perfil.
            </p>
          </div>
        )}
      </main>

      <footer className="text-center pb-6">
        <p className="text-xs" style={{ color: "#B0B7C3" }}>
          IECG · Portal Gerencial
        </p>
      </footer>
    </div>
  );
}
