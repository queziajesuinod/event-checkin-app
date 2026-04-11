import { useAuth } from "@/contexts/AuthContext";
import { useHeader } from "@/contexts/HeaderContext";
import { Calendar, Church, ChevronRight } from "lucide-react";
import { useLocation } from "wouter";

const C = {
  navy: "#0A1F3F",
  blue: "#1B4D8E",
  sky: "#4A90D9",
  surface: "#F0F2F5",
  white: "#FFFFFF",
  gold: "#C9A84C",
};

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

interface TileProps {
  icon: React.ReactNode;
  label: string;
  sublabel: string;
  gradient: [string, string];
  onClick: () => void;
  delay?: string;
}

function Tile({ icon, label, sublabel, gradient, onClick, delay = "0ms" }: TileProps) {
  return (
    <button
      onClick={onClick}
      className="relative flex flex-col justify-between rounded-3xl p-5 text-left w-full overflow-hidden transition-all duration-200 active:scale-95"
      style={{
        background: `linear-gradient(135deg, ${gradient[0]}, ${gradient[1]})`,
        minHeight: 160,
        animationDelay: delay,
        boxShadow: `0 8px 24px ${gradient[0]}55`,
      }}
    >
      {/* Círculo decorativo */}
      <div
        className="absolute -top-6 -right-6 w-28 h-28 rounded-full opacity-20"
        style={{ backgroundColor: '#fff' }}
      />
      <div
        className="absolute -bottom-8 -right-2 w-20 h-20 rounded-full opacity-10"
        style={{ backgroundColor: '#fff' }}
      />

      {/* Ícone */}
      <div
        className="w-12 h-12 rounded-2xl flex items-center justify-center"
        style={{ backgroundColor: 'rgba(255,255,255,0.22)' }}
      >
        {icon}
      </div>

      {/* Texto + seta */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-white font-bold text-lg leading-tight">{label}</p>
          <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.7)' }}>{sublabel}</p>
        </div>
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: 'rgba(255,255,255,0.22)' }}
        >
          <ChevronRight className="w-4 h-4 text-white" />
        </div>
      </div>
    </button>
  );
}

export default function Home() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  useHeader({});

  const perfis = user?.perfis ?? [];
  const isAdmin = perfis.includes("Administrador");
  const showEventos = isAdmin || perfis.includes("EVENTOS");
  const showCultos = isAdmin || perfis.includes("BACKSTAGE");

  const firstName = user?.name?.split(" ")[0] ?? "Usuário";
  const hasAny = showEventos || showCultos;

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: C.surface }}>

      {/* ── Saudação ── */}
      <div className="px-5 pt-6 pb-8">
        <p className="text-sm font-medium" style={{ color: C.sky }}>
          {greeting()},
        </p>
        <h1 className="text-3xl font-extrabold tracking-tight mt-0.5" style={{ color: C.navy }}>
          {firstName}
        </h1>
        <p className="text-sm mt-1" style={{ color: '#94A3B8' }}>
          O que você quer acessar hoje?
        </p>
      </div>

      {/* ── Grid de módulos ── */}
      <main className="flex-1 px-5 pb-10">
        {hasAny ? (
          <div className="grid grid-cols-2 gap-4 max-w-md mx-auto">
            {showEventos && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: '100ms' }}>
                <Tile
                  icon={<Calendar className="w-6 h-6 text-white" />}
                  label="Eventos"
                  sublabel="Check-in e gestão"
                  gradient={["#1B4D8E", "#4A90D9"]}
                  onClick={() => setLocation("/events")}
                />
              </div>
            )}

            {showCultos && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: '200ms' }}>
                <Tile
                  icon={<Church className="w-6 h-6 text-white" />}
                  label="Cultos"
                  sublabel="Registros e presença"
                  gradient={["#C9A84C", "#E8C46A"]}
                  onClick={() => setLocation("/cultos")}
                />
              </div>
            )}
          </div>
        ) : (
          <div
            className="rounded-3xl p-6 text-center animate-in fade-in duration-500 max-w-md mx-auto"
            style={{ backgroundColor: C.white, boxShadow: "0 4px 20px rgba(10,31,63,0.06)" }}
          >
            <p className="text-sm" style={{ color: "#94A3B8" }}>
              Nenhum módulo disponível para o seu perfil.
            </p>
          </div>
        )}
      </main>

      <footer className="text-center pb-6">
        <p className="text-xs" style={{ color: "#CBD5E1" }}>IECG · Portal Gerencial</p>
      </footer>
    </div>
  );
}
