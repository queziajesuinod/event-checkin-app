import { AlertCircle, Home } from "lucide-react";
import { useLocation } from "wouter";

const C = {
  navy: "#172b46",
  blue: "#244ac0",
  surface: "#f1f4f7",
  gold: "#C9A84C",
};

export default function NotFound() {
  const [, setLocation] = useLocation();

  return (
    <div
      className="portal-page min-h-screen flex flex-col items-center justify-center px-4"
      style={{ backgroundColor: C.surface }}
    >
      <div
        className="portal-panel w-full max-w-md p-10 text-center"
        style={{ backgroundColor: "#fff", boxShadow: "none" }}
      >
        <div className="flex justify-center mb-6">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center"
            style={{ backgroundColor: "#FEF2F2" }}
          >
            <AlertCircle className="w-8 h-8" style={{ color: "#DC2626" }} />
          </div>
        </div>

        <h1 className="text-5xl font-extrabold mb-2" style={{ color: C.navy }}>
          404
        </h1>
        <h2 className="text-lg font-semibold mb-3" style={{ color: C.blue }}>
          Página não encontrada
        </h2>
        <p className="text-sm mb-8" style={{ color: "#6B7280" }}>
          A página que você está procurando não existe ou foi removida.
        </p>

        <button
          onClick={() => setLocation("/")}
          className="w-full h-11 rounded-xl text-white font-semibold text-sm transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-2"
          style={{ backgroundColor: C.blue }}
        >
          <Home className="w-4 h-4" />
          Ir para o início
        </button>
      </div>

      <p className="text-xs mt-8" style={{ color: "#58697d" }}>
        IECG · Portal Gerencial
      </p>
    </div>
  );
}
