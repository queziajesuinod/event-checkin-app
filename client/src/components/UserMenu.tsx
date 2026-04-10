import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { ChevronLeft, LogOut, User } from "lucide-react";
import { useLocation } from "wouter";

interface UserMenuProps {
  showBackButton?: boolean;
  backTo?: string;
  backLabel?: string;
}

export const UserMenu: React.FC<UserMenuProps> = ({
  showBackButton = false,
  backTo = "/",
  backLabel = "← Início",
}) => {
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();

  const handleLogout = () => {
    logout();
    setLocation("/login");
  };

  const initial = (user?.name ?? "U")[0].toUpperCase();

  return (
    <div className="flex items-center gap-2">
      {showBackButton && (
        <button
          onClick={() => setLocation(backTo)}
          className="flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 active:scale-95"
          style={{ backgroundColor: "rgba(255,255,255,0.12)", color: "#fff" }}
        >
          <ChevronLeft className="w-4 h-4" />
          <span className="hidden sm:inline">{backLabel}</span>
        </button>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="flex items-center gap-2 px-3 py-1.5 rounded-full transition-all duration-200 active:scale-95"
            style={{ backgroundColor: "rgba(255,255,255,0.12)" }}
          >
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
              style={{ backgroundColor: "#C9A84C" }}
            >
              {initial}
            </div>
            <span className="text-white text-sm font-medium hidden sm:block max-w-[120px] truncate">
              {user?.name ?? "Usuário"}
            </span>
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none">{user?.name}</p>
              <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={handleLogout}
            className="text-red-600 focus:text-red-600"
          >
            <LogOut className="mr-2 h-4 w-4" />
            <span>Sair</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};
