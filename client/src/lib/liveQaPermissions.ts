import { useAuth } from "@/contexts/AuthContext";

export const PERM_GERENCIAR = "PERGUNTAS_AO_VIVO_GERENCIAR";
export const PERM_MODERAR = "PERGUNTAS_AO_VIVO_MODERAR";

export function useLiveQaPermissions() {
  const { user } = useAuth();
  const perfis = (user?.perfis ?? []).map((p) => p.toLowerCase());
  const permissoes = (user?.permissoes ?? []).map((p) => p.toUpperCase());

  const isAdmin =
    perfis.some((p) => p === "administrador" || p === "admin") ||
    permissoes.includes("ADMIN_FULL_ACCESS");

  const canManage = isAdmin || permissoes.includes(PERM_GERENCIAR);
  const canModerate = canManage || permissoes.includes(PERM_MODERAR);

  return { isAdmin, canManage, canModerate };
}
