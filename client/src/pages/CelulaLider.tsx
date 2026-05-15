import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import {
  Plus,
  Users,
  Calendar,
  Search,
  X,
  ChevronRight,
  Loader2,
  UserPlus,
  AlertCircle,
  CalendarDays,
  Check,
  User,
  Pencil,
  Trash2,
  RotateCcw,
} from "lucide-react";
import {
  celulaAPI,
  CelulaMembro,
  CelulaMemboCandidato,
  CelulaReuniaoItem,
  MinhacelulInfo,
} from "@/lib/api";
import { useHeader } from "@/contexts/HeaderContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

const C = {
  navy: "#0A1F3F",
  blue: "#1B4D8E",
  sky: "#4A90D9",
  surface: "#F0F2F5",
  white: "#FFFFFF",
  gold: "#C9A84C",
  green: "#16A34A",
  orange: "#F97316",
  red: "#DC2626",
};

const PAPEL_LABELS: Record<string, string> = {
  membro: "Membro",
  auxiliar: "Auxiliar",
  anfitria: "Anfitriã",
  lider: "Líder",
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  aberta: { label: "Aberta", color: "#16A34A" },
  agendada: { label: "Agendada", color: "#1B4D8E" },
  encerrada: { label: "Encerrada", color: "#64748B" },
  cancelada: { label: "Cancelada", color: "#DC2626" },
};

const DIAS_SEMANA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

function formatDate(dateStr: string) {
  const d = dateStr.split("T")[0];
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

function diaSemanaName(s: string) {
  const n = parseInt(s, 10);
  return isNaN(n) ? s : (DIAS_SEMANA[n] ?? s);
}

export default function CelulaLider() {
  const [, setLocation] = useLocation();
  useHeader({ backTo: "/home", title: "Minha Célula" });

  const [celula, setCelula] = useState<MinhacelulInfo | null>(null);
  const [membros, setMembros] = useState<CelulaMembro[]>([]);
  const [reunioes, setReunioes] = useState<CelulaReuniaoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("membros");

  // Adicionar membro
  const [addOpen, setAddOpen] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [candidates, setCandidates] = useState<CelulaMemboCandidato[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newMemberForm, setNewMemberForm] = useState({
    fullName: "",
    phone: "",
    papel: "membro",
  });
  const [linking, setLinking] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Nova reunião
  const [newReuniaoOpen, setNewReuniaoOpen] = useState(false);
  const [newData, setNewData] = useState("");
  const [creatingReuniao, setCreatingReuniao] = useState(false);

  // Editar membro
  const [editMembro, setEditMembro] = useState<CelulaMembro | null>(null);
  const [editMembroForm, setEditMembroForm] = useState({
    fullName: "", preferredName: "", phone: "", whatsapp: "", papel: "membro",
  });
  const [editMembroSaving, setEditMembroSaving] = useState(false);

  // Editar / excluir reunião
  const [editReuniao, setEditReuniao] = useState<CelulaReuniaoItem | null>(null);
  const [editData, setEditData] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editStatusSaving, setEditStatusSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Sugestões automáticas
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<
    Array<{ data: string; diaSemana: string; horario: string; jaExiste: boolean }>
  >([]);
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [confirmingDates, setConfirmingDates] = useState(false);

  const loadCelula = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await celulaAPI.minhacelula();
      setCelula(res.data);
      const [membrosRes, reunioesRes] = await Promise.all([
        celulaAPI.listarMembros(res.data.id),
        celulaAPI.listarReunioes(res.data.id, { limit: 30 }),
      ]);
      setMembros(membrosRes.data);
      setReunioes(reunioesRes.data.reunioes);
    } catch (err: any) {
      setError(
        err?.response?.data?.erro ??
          "Não foi possível carregar sua célula. Verifique se você possui uma célula vinculada."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCelula();
  }, [loadCelula]);

  // Busca de candidatos com debounce
  useEffect(() => {
    if (!celula || searchQ.length < 2) {
      setCandidates([]);
      setSearchLoading(false);
      return;
    }
    setSearchLoading(true);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      try {
        const res = await celulaAPI.buscarCandidatos(celula.id, searchQ);
        setCandidates(res.data);
      } catch {
        setCandidates([]);
      } finally {
        setSearchLoading(false);
      }
    }, 350);
    return () => clearTimeout(searchTimer.current);
  }, [searchQ, celula]);

  function resetAddDialog() {
    setSearchQ("");
    setCandidates([]);
    setShowNewForm(false);
    setNewMemberForm({ fullName: "", phone: "", papel: "membro" });
  }

  const vincularMembro = async (membroId: string) => {
    if (!celula) return;
    setLinking(true);
    try {
      const res = await celulaAPI.vincularMembro(celula.id, {
        membroId,
        papel: "membro",
        dataEntrada: new Date().toISOString().split("T")[0],
      });
      if (res.data.aviso) {
        toast.warning(
          `Este membro estava na célula "${res.data.aviso.celulaAnteriorNome}". Verifique a transferência com o líder anterior.`
        );
      } else {
        toast.success("Membro vinculado com sucesso!");
      }
      setAddOpen(false);
      resetAddDialog();
      const updated = await celulaAPI.listarMembros(celula.id);
      setMembros(updated.data);
    } catch (err: any) {
      toast.error(err?.response?.data?.erro ?? "Erro ao vincular membro.");
    } finally {
      setLinking(false);
    }
  };

  const cadastrarEVincular = async () => {
    if (!celula || !newMemberForm.fullName.trim()) return;
    setLinking(true);
    try {
      await celulaAPI.cadastrarEVincular(celula.id, {
        fullName: newMemberForm.fullName.trim(),
        phone: newMemberForm.phone.trim() || undefined,
        papel: newMemberForm.papel,
      });
      toast.success("Membro cadastrado e vinculado!");
      setAddOpen(false);
      resetAddDialog();
      const updated = await celulaAPI.listarMembros(celula.id);
      setMembros(updated.data);
    } catch (err: any) {
      toast.error(err?.response?.data?.erro ?? "Erro ao cadastrar membro.");
    } finally {
      setLinking(false);
    }
  };

  const abrirEdicaoMembro = (m: CelulaMembro) => {
    setEditMembro(m);
    setEditMembroForm({
      fullName: m.membro.fullName,
      preferredName: m.membro.preferredName ?? "",
      phone: m.membro.phone ?? "",
      whatsapp: m.membro.whatsapp ?? "",
      papel: m.papel,
    });
  };

  const salvarEdicaoMembro = async () => {
    if (!celula || !editMembro || !editMembroForm.fullName.trim()) return;
    setEditMembroSaving(true);
    try {
      const res = await celulaAPI.editarMembro(celula.id, editMembro.membro.id, {
        fullName: editMembroForm.fullName.trim(),
        preferredName: editMembroForm.preferredName.trim() || undefined,
        phone: editMembroForm.phone.trim() || undefined,
        whatsapp: editMembroForm.whatsapp.trim() || undefined,
        papel: editMembroForm.papel,
      });
      toast.success("Dados atualizados!");
      setMembros((prev) =>
        prev.map((m) =>
          m.membro.id === editMembro.membro.id
            ? {
                ...m,
                papel: res.data.papel ?? m.papel,
                membro: { ...m.membro, ...res.data.membro },
              }
            : m
        )
      );
      setEditMembro(null);
    } catch (err: any) {
      toast.error(err?.response?.data?.erro ?? "Erro ao atualizar dados.");
    } finally {
      setEditMembroSaving(false);
    }
  };

  const desvincularMembro = async (membroId: string, nome: string) => {
    if (!celula) return;
    if (!window.confirm(`Desvincular ${nome} desta célula?`)) return;
    try {
      await celulaAPI.desvincularMembro(celula.id, membroId);
      toast.success("Membro desvinculado.");
      setMembros((prev) => prev.filter((m) => m.membro.id !== membroId));
    } catch (err: any) {
      toast.error(err?.response?.data?.erro ?? "Erro ao desvincular membro.");
    }
  };

  const abrirEdicao = (r: CelulaReuniaoItem) => {
    setEditReuniao(r);
    setEditData(r.data.split("T")[0]);
  };

  const salvarEdicaoData = async () => {
    if (!editReuniao || !editData) return;
    setEditSaving(true);
    try {
      const res = await celulaAPI.editarReuniao(editReuniao.id, { data: editData });
      toast.success("Data atualizada!");
      setEditReuniao(null);
      setReunioes((prev) => prev.map((r) => (r.id === editReuniao.id ? { ...r, data: res.data.data } : r)));
    } catch (err: any) {
      toast.error(err?.response?.data?.erro ?? "Erro ao atualizar data.");
    } finally {
      setEditSaving(false);
    }
  };

  const cancelarReuniaoEdit = async () => {
    if (!editReuniao) return;
    if (!window.confirm("Cancelar esta reunião?")) return;
    setEditStatusSaving(true);
    try {
      await celulaAPI.cancelarReuniao(editReuniao.id);
      toast.success("Reunião cancelada.");
      setEditReuniao(null);
      setReunioes((prev) => prev.map((r) => (r.id === editReuniao.id ? { ...r, status: "cancelada" } : r)));
    } catch (err: any) {
      toast.error(err?.response?.data?.erro ?? "Erro ao cancelar.");
    } finally {
      setEditStatusSaving(false);
    }
  };

  const reabrirReuniaoEdit = async () => {
    if (!editReuniao) return;
    setEditStatusSaving(true);
    try {
      await celulaAPI.reabrirReuniao(editReuniao.id);
      toast.success("Reunião reaberta!");
      setEditReuniao(null);
      setReunioes((prev) => prev.map((r) => (r.id === editReuniao.id ? { ...r, status: "aberta" } : r)));
    } catch (err: any) {
      toast.error(err?.response?.data?.erro ?? "Erro ao reabrir.");
    } finally {
      setEditStatusSaving(false);
    }
  };

  const excluirReuniaoItem = async (r: CelulaReuniaoItem) => {
    const isEncerrada = r.status === "encerrada";
    const confirmMsg = isEncerrada
      ? `Excluir a reunião de ${formatDate(r.data)}?\n\nEsta reunião já foi finalizada. Todos os registros de presença serão desfeitos. Esta ação não pode ser desfeita.`
      : `Excluir a reunião do dia ${formatDate(r.data)}? Esta ação não pode ser desfeita.`;
    if (!window.confirm(confirmMsg)) return;

    setDeletingId(r.id);
    try {
      const res = await celulaAPI.excluirReuniao(r.id);
      const { presencasRemovidas, foiEncerrada } = res.data;
      if (foiEncerrada && presencasRemovidas > 0) {
        toast.success(`Reunião excluída — ${presencasRemovidas} presença(s) desfeita(s).`, { duration: 5000 });
      } else {
        toast.success("Reunião excluída.");
      }
      setReunioes((prev) => prev.filter((x) => x.id !== r.id));
    } catch (err: any) {
      toast.error(err?.response?.data?.erro ?? "Erro ao excluir reunião.");
    } finally {
      setDeletingId(null);
    }
  };

  const criarReuniao = async () => {
    if (!celula || !newData) return;
    setCreatingReuniao(true);
    try {
      await celulaAPI.criarReuniao(celula.id, { data: newData });
      toast.success("Reunião criada!");
      setNewReuniaoOpen(false);
      setNewData("");
      const updated = await celulaAPI.listarReunioes(celula.id, { limit: 30 });
      setReunioes(updated.data.reunioes);
    } catch (err: any) {
      toast.error(err?.response?.data?.erro ?? "Erro ao criar reunião.");
    } finally {
      setCreatingReuniao(false);
    }
  };

  const carregarSugestoes = async () => {
    if (!celula) return;
    setLoadingSuggestions(true);
    setSuggestOpen(true);
    try {
      const res = await celulaAPI.sugerirReunioes(celula.id, 8);
      setSuggestions(res.data);
      setSelectedDates(res.data.filter((s) => !s.jaExiste).map((s) => s.data));
    } catch {
      toast.error("Erro ao buscar sugestões.");
      setSuggestOpen(false);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const confirmarSugestoes = async () => {
    if (!celula || selectedDates.length === 0) return;
    setConfirmingDates(true);
    try {
      const res = await celulaAPI.confirmarSugestoes(celula.id, selectedDates);
      toast.success(res.data.mensagem ?? `${selectedDates.length} reunião(ões) criada(s)!`);
      setSuggestOpen(false);
      const updated = await celulaAPI.listarReunioes(celula.id, { limit: 30 });
      setReunioes(updated.data.reunioes);
    } catch {
      toast.error("Erro ao confirmar sugestões.");
    } finally {
      setConfirmingDates(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen p-5" style={{ backgroundColor: C.surface }}>
        <Skeleton className="h-36 rounded-3xl mb-5" />
        <Skeleton className="h-10 rounded-2xl mb-4" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !celula) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center p-5"
        style={{ backgroundColor: C.surface }}
      >
        <AlertCircle className="w-14 h-14 mb-3" style={{ color: C.red }} />
        <p className="text-center font-medium mb-2" style={{ color: C.navy }}>
          {error ?? "Célula não encontrada."}
        </p>
        <p className="text-sm text-center mb-6" style={{ color: "#94A3B8" }}>
          Entre em contato com o administrador caso precise de acesso.
        </p>
        <Button onClick={() => setLocation("/home")} variant="outline" className="rounded-2xl px-6">
          Voltar ao início
        </Button>
      </div>
    );
  }

  const reunioesAbertas = reunioes.filter((r) => r.status === "aberta");

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: C.surface }}>
      {/* Card da célula */}
      <div className="px-5 pt-6 pb-4">
        <div
          className="rounded-3xl p-5"
          style={{
            background: `linear-gradient(135deg, ${C.blue}, ${C.sky})`,
            boxShadow: `0 8px 24px ${C.blue}44`,
          }}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium mb-1" style={{ color: "rgba(255,255,255,0.7)" }}>
                Minha Célula
              </p>
              <h1 className="text-xl font-bold text-white leading-tight truncate">
                {celula.nome}
              </h1>
              {celula.diaSemana && (
                <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.8)" }}>
                  {diaSemanaName(celula.diaSemana)}
                  {celula.horario ? ` · ${celula.horario}` : ""}
                </p>
              )}
            </div>
            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 ml-3"
              style={{ backgroundColor: "rgba(255,255,255,0.2)" }}
            >
              <Users className="w-5 h-5 text-white" />
            </div>
          </div>

          <div className="flex items-center gap-6 mt-4 pt-3 border-t" style={{ borderColor: "rgba(255,255,255,0.2)" }}>
            <div>
              <p className="text-2xl font-bold text-white">{membros.length}</p>
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.7)" }}>membros</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{reunioesAbertas.length}</p>
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.7)" }}>abertas</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{reunioes.length}</p>
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.7)" }}>reuniões</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex-1 px-5 pb-10">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full mb-4 rounded-2xl" style={{ backgroundColor: C.white }}>
            <TabsTrigger value="membros" className="flex-1 rounded-xl gap-1.5">
              <Users className="w-4 h-4" /> Membros
            </TabsTrigger>
            <TabsTrigger value="reunioes" className="flex-1 rounded-xl gap-1.5">
              <Calendar className="w-4 h-4" /> Reuniões
            </TabsTrigger>
          </TabsList>

          {/* ── Tab Membros ── */}
          <TabsContent value="membros">
            <Button
              onClick={() => {
                resetAddDialog();
                setAddOpen(true);
              }}
              className="w-full mb-4 rounded-2xl h-12 font-semibold gap-2"
              style={{ backgroundColor: C.blue, color: C.white }}
            >
              <Plus className="w-4 h-4" /> Adicionar membro
            </Button>

            <div className="space-y-3">
              {membros.length === 0 && (
                <div className="text-center py-10" style={{ color: "#94A3B8" }}>
                  <User className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Nenhum membro vinculado ainda.</p>
                  <p className="text-xs mt-1">Clique em "Adicionar membro" para começar.</p>
                </div>
              )}
              {membros.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center gap-3 rounded-2xl p-4"
                  style={{
                    backgroundColor: C.white,
                    boxShadow: "0 2px 8px rgba(10,31,63,0.06)",
                  }}
                >
                  <Avatar className="w-11 h-11 flex-shrink-0">
                    <AvatarImage src={m.membro.photoUrl ?? undefined} />
                    <AvatarFallback style={{ backgroundColor: C.blue, color: C.white }}>
                      {initials(m.membro.preferredName ?? m.membro.fullName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate" style={{ color: C.navy }}>
                      {m.membro.preferredName ?? m.membro.fullName}
                    </p>
                    <p className="text-xs" style={{ color: "#94A3B8" }}>
                      {PAPEL_LABELS[m.papel] ?? m.papel} · desde {formatDate(m.dataEntrada)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => abrirEdicaoMembro(m)}
                      className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors hover:bg-slate-100"
                      title="Editar"
                    >
                      <Pencil className="w-3.5 h-3.5" style={{ color: "#64748B" }} />
                    </button>
                    <button
                      onClick={() =>
                        desvincularMembro(
                          m.membro.id,
                          m.membro.preferredName ?? m.membro.fullName
                        )
                      }
                      className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors hover:bg-red-50"
                      title="Desvincular"
                    >
                      <X className="w-4 h-4" style={{ color: C.red }} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* ── Tab Reuniões ── */}
          <TabsContent value="reunioes">
            <div className="flex gap-2 mb-4">
              <Button
                onClick={() => {
                  setNewData("");
                  setNewReuniaoOpen(true);
                }}
                className="flex-1 rounded-2xl h-12 font-semibold gap-1.5"
                style={{ backgroundColor: C.blue, color: C.white }}
              >
                <Plus className="w-4 h-4" /> Criar
              </Button>
              <Button
                onClick={carregarSugestoes}
                variant="outline"
                className="flex-1 rounded-2xl h-12 font-semibold gap-1.5"
              >
                <CalendarDays className="w-4 h-4" /> Gerar sugestões
              </Button>
            </div>

            <div className="space-y-3">
              {reunioes.length === 0 && (
                <div className="text-center py-10" style={{ color: "#94A3B8" }}>
                  <Calendar className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Nenhuma reunião cadastrada.</p>
                  <p className="text-xs mt-1">Crie manualmente ou gere sugestões automáticas.</p>
                </div>
              )}
              {reunioes.map((r) => {
                const st = STATUS_CONFIG[r.status] ?? { label: r.status, color: "#64748B" };
                const isAberta = r.status === "aberta";
                const isDeleting = deletingId === r.id;
                return (
                  <div
                    key={r.id}
                    className="flex items-center gap-3 rounded-2xl p-4"
                    style={{
                      backgroundColor: C.white,
                      boxShadow: "0 2px 8px rgba(10,31,63,0.06)",
                      opacity: isDeleting ? 0.5 : 1,
                    }}
                  >
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: `${st.color}18` }}
                    >
                      <Calendar className="w-5 h-5" style={{ color: st.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm" style={{ color: C.navy }}>
                        {formatDate(r.data)}
                      </p>
                      <span
                        className="inline-block text-xs font-medium px-2 py-0.5 rounded-full mt-0.5"
                        style={{ backgroundColor: `${st.color}18`, color: st.color }}
                      >
                        {st.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {isAberta && (
                        <button
                          onClick={() => setLocation(`/celula/presenca/${r.id}`)}
                          className="flex items-center gap-1 px-3 py-2 rounded-xl font-semibold text-xs transition-all active:scale-95"
                          style={{ backgroundColor: C.blue, color: C.white }}
                        >
                          Abrir <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => abrirEdicao(r)}
                        disabled={isDeleting}
                        className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors hover:bg-slate-100"
                        title="Editar"
                      >
                        <Pencil className="w-4 h-4" style={{ color: "#64748B" }} />
                      </button>
                      <button
                        onClick={() => excluirReuniaoItem(r)}
                        disabled={isDeleting}
                        className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors hover:bg-red-50"
                        title="Excluir"
                      >
                        {isDeleting
                          ? <Loader2 className="w-4 h-4 animate-spin" style={{ color: C.red }} />
                          : <Trash2 className="w-4 h-4" style={{ color: C.red }} />
                        }
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Dialog: Adicionar membro ── */}
      <Dialog
        open={addOpen}
        onOpenChange={(o) => {
          setAddOpen(o);
          if (!o) resetAddDialog();
        }}
      >
        <DialogContent className="rounded-3xl max-w-md mx-4">
          <DialogHeader>
            <DialogTitle style={{ color: C.navy }}>
              {showNewForm ? "Cadastrar novo membro" : "Adicionar membro"}
            </DialogTitle>
          </DialogHeader>

          {!showNewForm ? (
            <div>
              <div className="relative mb-3">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
                  style={{ color: "#94A3B8" }}
                />
                <Input
                  className="pl-9 rounded-xl"
                  placeholder="Buscar por nome..."
                  value={searchQ}
                  onChange={(e) => setSearchQ(e.target.value)}
                  autoFocus
                />
              </div>

              {searchLoading && (
                <div className="flex justify-center py-5">
                  <Loader2 className="w-5 h-5 animate-spin" style={{ color: C.sky }} />
                </div>
              )}

              {!searchLoading && candidates.length > 0 && (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {candidates.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center gap-3 p-3 rounded-xl border"
                      style={{ borderColor: "#E2E8F0" }}
                    >
                      <Avatar className="w-9 h-9 flex-shrink-0">
                        <AvatarImage src={c.photoUrl ?? undefined} />
                        <AvatarFallback style={{ backgroundColor: C.sky, color: C.white }}>
                          {initials(c.preferredName ?? c.fullName)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: C.navy }}>
                          {c.preferredName ?? c.fullName}
                        </p>
                        {c.celulaAtual && (
                          <p className="text-xs" style={{ color: C.orange }}>
                            ⚠ Em outra célula: {c.celulaAtual.celula}
                          </p>
                        )}
                      </div>
                      <Button
                        size="sm"
                        disabled={linking}
                        onClick={() => vincularMembro(c.id)}
                        className="rounded-xl text-xs flex-shrink-0"
                        style={{ backgroundColor: C.blue, color: C.white }}
                      >
                        {linking ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          "Vincular"
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {!searchLoading && searchQ.length >= 2 && candidates.length === 0 && (
                <p className="text-sm text-center py-4" style={{ color: "#94A3B8" }}>
                  Nenhum resultado para "{searchQ}".
                </p>
              )}

              <button
                className="w-full flex items-center justify-center gap-1.5 text-sm font-medium mt-5 py-2"
                style={{ color: C.blue }}
                onClick={() => setShowNewForm(true)}
              >
                <UserPlus className="w-4 h-4" />
                Não encontrou? Cadastrar novo membro
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <button
                className="flex items-center gap-1 text-sm"
                style={{ color: C.sky }}
                onClick={() => setShowNewForm(false)}
              >
                ← Voltar à busca
              </button>
              <div>
                <Label className="text-xs font-medium mb-1.5 block">Nome completo *</Label>
                <Input
                  className="rounded-xl"
                  placeholder="Nome completo"
                  value={newMemberForm.fullName}
                  onChange={(e) =>
                    setNewMemberForm((p) => ({ ...p, fullName: e.target.value }))
                  }
                  autoFocus
                />
              </div>
              <div>
                <Label className="text-xs font-medium mb-1.5 block">Telefone / WhatsApp</Label>
                <Input
                  className="rounded-xl"
                  placeholder="67912345678"
                  value={newMemberForm.phone}
                  onChange={(e) =>
                    setNewMemberForm((p) => ({ ...p, phone: e.target.value }))
                  }
                />
              </div>
              <DialogFooter>
                <Button
                  disabled={linking || !newMemberForm.fullName.trim()}
                  onClick={cadastrarEVincular}
                  className="w-full rounded-2xl h-11 font-semibold gap-2"
                  style={{ backgroundColor: C.blue, color: C.white }}
                >
                  {linking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Cadastrar e vincular
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Editar membro ── */}
      <Dialog open={!!editMembro} onOpenChange={(o) => { if (!o) setEditMembro(null); }}>
        <DialogContent className="rounded-3xl max-w-sm mx-4">
          <DialogHeader>
            <DialogTitle style={{ color: C.navy }}>Editar membro</DialogTitle>
          </DialogHeader>
          {editMembro && (
            <div className="space-y-4">
              <div>
                <Label className="text-xs font-medium mb-1.5 block">Nome completo *</Label>
                <Input
                  className="rounded-xl"
                  value={editMembroForm.fullName}
                  onChange={(e) => setEditMembroForm((p) => ({ ...p, fullName: e.target.value }))}
                  autoFocus
                />
              </div>
              <div>
                <Label className="text-xs font-medium mb-1.5 block">Nome preferido</Label>
                <Input
                  className="rounded-xl"
                  placeholder="Como prefere ser chamado(a)"
                  value={editMembroForm.preferredName}
                  onChange={(e) => setEditMembroForm((p) => ({ ...p, preferredName: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-xs font-medium mb-1.5 block">Telefone / WhatsApp</Label>
                <Input
                  className="rounded-xl"
                  placeholder="67912345678"
                  value={editMembroForm.phone}
                  onChange={(e) => setEditMembroForm((p) => ({ ...p, phone: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-xs font-medium mb-2 block">Função na célula</Label>
                <div className="flex gap-2 flex-wrap">
                  {[
                    { value: "membro", label: "Membro" },
                    { value: "auxiliar", label: "Auxiliar" },
                    { value: "anfitria", label: "Anfitriã" },
                  ].map((p) => (
                    <button
                      key={p.value}
                      onClick={() => setEditMembroForm((prev) => ({ ...prev, papel: p.value }))}
                      className="flex-1 py-2 rounded-xl text-xs font-semibold transition-all"
                      style={{
                        backgroundColor: editMembroForm.papel === p.value ? C.blue : "#F1F5F9",
                        color: editMembroForm.papel === p.value ? C.white : "#64748B",
                      }}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
              <DialogFooter>
                <Button
                  disabled={editMembroSaving || !editMembroForm.fullName.trim()}
                  onClick={salvarEdicaoMembro}
                  className="w-full rounded-2xl h-11 font-semibold gap-2"
                  style={{ backgroundColor: C.blue, color: C.white }}
                >
                  {editMembroSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Salvar
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Editar reunião ── */}
      <Dialog open={!!editReuniao} onOpenChange={(o) => { if (!o) setEditReuniao(null); }}>
        <DialogContent className="rounded-3xl max-w-sm mx-4">
          <DialogHeader>
            <DialogTitle style={{ color: C.navy }}>Editar reunião</DialogTitle>
          </DialogHeader>

          {editReuniao && (
            <div className="space-y-5">
              {/* Alterar data */}
              <div>
                <Label className="text-xs font-medium mb-1.5 block">Data</Label>
                <Input
                  type="date"
                  className="rounded-xl"
                  value={editData}
                  onChange={(e) => setEditData(e.target.value)}
                />
              </div>
              <Button
                disabled={editSaving || !editData || editData === editReuniao.data.split("T")[0]}
                onClick={salvarEdicaoData}
                className="w-full rounded-2xl h-11 font-semibold gap-2"
                style={{ backgroundColor: C.blue, color: C.white }}
              >
                {editSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Salvar data
              </Button>

              {/* Ações de status */}
              {(editReuniao.status === "agendada" || editReuniao.status === "aberta") && (
                <button
                  disabled={editStatusSaving}
                  onClick={cancelarReuniaoEdit}
                  className="w-full flex items-center justify-center gap-2 rounded-2xl h-11 font-semibold text-sm border transition-colors hover:bg-red-50"
                  style={{ borderColor: C.red, color: C.red }}
                >
                  {editStatusSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                  Cancelar reunião
                </button>
              )}
              {editReuniao.status === "encerrada" && (
                <button
                  disabled={editStatusSaving}
                  onClick={reabrirReuniaoEdit}
                  className="w-full flex items-center justify-center gap-2 rounded-2xl h-11 font-semibold text-sm border transition-colors hover:bg-blue-50"
                  style={{ borderColor: C.blue, color: C.blue }}
                >
                  {editStatusSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                  Reabrir reunião
                </button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Nova reunião ── */}
      <Dialog open={newReuniaoOpen} onOpenChange={setNewReuniaoOpen}>
        <DialogContent className="rounded-3xl max-w-sm mx-4">
          <DialogHeader>
            <DialogTitle style={{ color: C.navy }}>Nova reunião</DialogTitle>
          </DialogHeader>
          <div>
            <Label htmlFor="data-avulsa" className="text-xs font-medium mb-1.5 block">
              Data avulsa
            </Label>
            <Input
              id="data-avulsa"
              type="date"
              className="rounded-xl"
              value={newData}
              onChange={(e) => setNewData(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              disabled={creatingReuniao || !newData}
              onClick={criarReuniao}
              className="w-full rounded-2xl h-11 font-semibold gap-2"
              style={{ backgroundColor: C.blue, color: C.white }}
            >
              {creatingReuniao ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Sugestões automáticas ── */}
      <Dialog open={suggestOpen} onOpenChange={setSuggestOpen}>
        <DialogContent className="rounded-3xl max-w-md mx-4">
          <DialogHeader>
            <DialogTitle style={{ color: C.navy }}>Sugestões de reuniões</DialogTitle>
          </DialogHeader>

          {loadingSuggestions ? (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <Loader2 className="w-6 h-6 animate-spin" style={{ color: C.sky }} />
              <p className="text-sm" style={{ color: "#94A3B8" }}>Gerando sugestões...</p>
            </div>
          ) : (
            <div>
              <p className="text-xs mb-3" style={{ color: "#94A3B8" }}>
                Baseadas no dia/horário da sua célula. Selecione as que deseja criar:
              </p>
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {suggestions.map((s) => (
                  <label
                    key={s.data}
                    className="flex items-center gap-3 p-3 rounded-xl border cursor-pointer hover:bg-slate-50 transition-colors"
                    style={{ borderColor: "#E2E8F0", opacity: s.jaExiste ? 0.6 : 1 }}
                  >
                    <Checkbox
                      checked={selectedDates.includes(s.data)}
                      disabled={s.jaExiste}
                      onCheckedChange={(checked) => {
                        setSelectedDates((prev) =>
                          checked
                            ? [...prev, s.data]
                            : prev.filter((d) => d !== s.data)
                        );
                      }}
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium" style={{ color: C.navy }}>
                        {formatDate(s.data)}
                      </p>
                      <p className="text-xs" style={{ color: "#94A3B8" }}>
                        {s.diaSemana} · {s.horario}
                      </p>
                    </div>
                    {s.jaExiste && (
                      <span
                        className="text-xs px-2 py-0.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: "#F1F5F9", color: "#64748B" }}
                      >
                        Já criada
                      </span>
                    )}
                  </label>
                ))}
                {suggestions.length === 0 && (
                  <p className="text-sm text-center py-4" style={{ color: "#94A3B8" }}>
                    Nenhuma sugestão disponível.
                  </p>
                )}
              </div>
              <DialogFooter className="mt-4">
                <Button
                  disabled={confirmingDates || selectedDates.length === 0}
                  onClick={confirmarSugestoes}
                  className="w-full rounded-2xl h-11 font-semibold gap-2"
                  style={{ backgroundColor: C.blue, color: C.white }}
                >
                  {confirmingDates ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  Confirmar{selectedDates.length > 0 ? ` (${selectedDates.length})` : ""}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
