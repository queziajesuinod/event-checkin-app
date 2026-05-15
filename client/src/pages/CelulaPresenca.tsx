import { useCallback, useEffect, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { toast } from "sonner";
import {
  Check,
  X,
  Plus,
  Loader2,
  AlertCircle,
  User,
  Share2,
  Copy,
  CheckCheck,
  Star,
} from "lucide-react";
import { celulaAPI, CelulaPresencaData, CelulaRelatorio } from "@/lib/api";
import { useHeader } from "@/contexts/HeaderContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

const C = {
  navy: "#0A1F3F",
  blue: "#1B4D8E",
  sky: "#4A90D9",
  surface: "#F0F2F5",
  white: "#FFFFFF",
  green: "#16A34A",
  red: "#DC2626",
  orange: "#F97316",
  gold: "#C9A84C",
};

const TIPO_LABELS: Record<string, string> = {
  visitante: "Visitante",
  frequentador: "Frequentador",
  novo_integrante: "Novo integrante",
};

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

type PresencaMap = Record<string, boolean | null>;

export default function CelulaPresenca() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/celula/presenca/:reuniaoId");
  const reuniaoId = (params?.reuniaoId ?? "") as string;

  useHeader({ backTo: "/celula", title: "Registrar Presença" });

  const [data, setData] = useState<CelulaPresencaData | null>(null);
  const [celulaId, setCelulaId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [presencas, setPresencas] = useState<PresencaMap>({});
  const [saving, setSaving] = useState(false);

  // Pessoa avulsa
  const [avulsoOpen, setAvulsoOpen] = useState(false);
  const [avulsoForm, setAvulsoForm] = useState({ nome: "", telefone: "", tipo: "visitante" });
  const [addingAvulso, setAddingAvulso] = useState(false);

  // Promover membro
  const [promotingId, setPromotingId] = useState<string | null>(null);

  // Tipo dos avulsos (editável inline)
  const [tiposAvulso, setTiposAvulso] = useState<Record<string, string>>({});
  const [updatingTipoId, setUpdatingTipoId] = useState<string | null>(null);

  // Relatório WhatsApp
  const [relatorio, setRelatorio] = useState<CelulaRelatorio | null>(null);
  const [relatorioOpen, setRelatorioOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const loadPresenca = useCallback(async () => {
    if (!reuniaoId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await celulaAPI.obterPresenca(reuniaoId);
      setData(res.data);
      setCelulaId(res.data.reuniao.celulaId);
      const map: PresencaMap = {};
      const tipos: Record<string, string> = {};
      for (const m of res.data.membros) {
        map[`m_${m.membroId}`] = m.presente;
      }
      for (const a of res.data.avulsos) {
        map[`a_${a.preCadastroId}`] = a.presente;
        tipos[a.preCadastroId!] = a.tipoPessoa ?? "visitante";
      }
      setPresencas(map);
      setTiposAvulso(tipos);
    } catch (err: any) {
      setError(err?.response?.data?.erro ?? "Não foi possível carregar a lista de presença.");
    } finally {
      setLoading(false);
    }
  }, [reuniaoId]);

  useEffect(() => {
    loadPresenca();
  }, [loadPresenca]);

  const togglePresenca = (key: string) => {
    setPresencas((prev) => ({
      ...prev,
      [key]: prev[key] === true ? false : true,
    }));
  };

  const gerarTextoWhatsApp = (rel: CelulaRelatorio) =>
    `📊 *Relatório de Célula*\n👤 Líder: ${rel.lider || "—"}\n🙏 Discípulos: ${rel.discipulos}\n👥 Visitantes: ${rel.visitantes}\n✅ Total: ${rel.total}`;

  const copiarTexto = async (texto: string) => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error("Não foi possível copiar automaticamente. Selecione o texto manualmente.");
    }
  };

  const salvarPresencas = async () => {
    if (!data) return;
    setSaving(true);
    try {
      const payload: Array<{ membroId?: string; preCadastroId?: string; presente: boolean }> = [];
      for (const m of data.membros) {
        payload.push({ membroId: m.membroId, presente: presencas[`m_${m.membroId}`] ?? false });
      }
      for (const a of data.avulsos) {
        payload.push({ preCadastroId: a.preCadastroId, presente: presencas[`a_${a.preCadastroId}`] ?? false });
      }

      const res = await celulaAPI.salvarPresencas(reuniaoId, payload);
      const rel = res.data.relatorio;
      setRelatorio(rel);
      setRelatorioOpen(true);

      // Copia automaticamente
      await copiarTexto(gerarTextoWhatsApp(rel));

      if (rel.paraPromover.length > 0) {
        toast.success(
          `${rel.paraPromover.length} pessoa(s) com 3+ presenças! Veja no relatório.`,
          { duration: 5000 }
        );
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.erro ?? "Erro ao salvar presenças.");
    } finally {
      setSaving(false);
    }
  };

  const adicionarAvulso = async () => {
    if (!avulsoForm.nome.trim() || !reuniaoId) return;
    setAddingAvulso(true);
    try {
      await celulaAPI.adicionarAvulso(reuniaoId, {
        nome: avulsoForm.nome.trim(),
        telefone: avulsoForm.telefone.trim() || undefined,
        tipo: avulsoForm.tipo,
      });
      toast.success("Pessoa adicionada!");
      setAvulsoOpen(false);
      setAvulsoForm({ nome: "", telefone: "", tipo: "visitante" });
      await loadPresenca();
    } catch (err: any) {
      toast.error(err?.response?.data?.erro ?? "Erro ao adicionar pessoa.");
    } finally {
      setAddingAvulso(false);
    }
  };

  const alterarTipoAvulso = async (preCadastroId: string, novoTipo: string) => {
    if (!celulaId || updatingTipoId === preCadastroId) return;
    setTiposAvulso((prev) => ({ ...prev, [preCadastroId]: novoTipo }));
    setUpdatingTipoId(preCadastroId);
    try {
      await celulaAPI.atualizarTipoAvulso(celulaId, preCadastroId, novoTipo);
    } catch (err: any) {
      toast.error(err?.response?.data?.erro ?? "Erro ao atualizar tipo.");
      setTiposAvulso((prev) => ({ ...prev, [preCadastroId]: prev[preCadastroId] }));
    } finally {
      setUpdatingTipoId(null);
    }
  };

  const promoverMembro = async (preCadastroId: string, nome: string) => {
    if (!celulaId) return;
    if (!window.confirm(`Promover ${nome} a membro da célula?`)) return;
    setPromotingId(preCadastroId);
    try {
      await celulaAPI.promoverPreCadastro(celulaId, preCadastroId);
      toast.success(`${nome} promovido(a) a membro!`);
      await loadPresenca();
    } catch (err: any) {
      toast.error(err?.response?.data?.erro ?? "Erro ao promover.");
    } finally {
      setPromotingId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen p-5" style={{ backgroundColor: C.surface }}>
        <Skeleton className="h-32 rounded-3xl mb-5" />
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-16 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-5" style={{ backgroundColor: C.surface }}>
        <AlertCircle className="w-14 h-14 mb-3" style={{ color: C.red }} />
        <p className="text-center font-medium mb-4" style={{ color: C.navy }}>
          {error ?? "Reunião não encontrada."}
        </p>
        <Button onClick={() => setLocation("/celula")} variant="outline" className="rounded-2xl px-6">
          Voltar
        </Button>
      </div>
    );
  }

  const totalLista = data.membros.length + data.avulsos.length;
  const presentes = Object.values(presencas).filter((v) => v === true).length;

  return (
    <div className="min-h-screen flex flex-col pb-28" style={{ backgroundColor: C.surface }}>
      {/* Header */}
      <div className="px-5 pt-6 pb-4">
        <div
          className="rounded-3xl p-5"
          style={{ background: "linear-gradient(135deg, #16A34A, #22C55E)", boxShadow: "0 8px 24px #16A34A44" }}
        >
          <p className="text-xs font-medium mb-1" style={{ color: "rgba(255,255,255,0.7)" }}>
            Reunião do dia
          </p>
          <h1 className="text-2xl font-bold text-white">{formatDate(data.reuniao.data)}</h1>
          <div className="flex items-center gap-6 mt-4 pt-3 border-t" style={{ borderColor: "rgba(255,255,255,0.2)" }}>
            <div>
              <p className="text-2xl font-bold text-white">{presentes}</p>
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.7)" }}>presentes</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{totalLista - presentes}</p>
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.7)" }}>ausentes</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{totalLista}</p>
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.7)" }}>na lista</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 px-5">
        {/* Membros */}
        {data.membros.length > 0 && (
          <>
            <p className="text-xs font-semibold tracking-wide mb-3" style={{ color: "#94A3B8" }}>
              MEMBROS ({data.membros.length})
            </p>
            <div className="space-y-2 mb-6">
              {data.membros.map((m) => {
                const key = `m_${m.membroId}`;
                const presente = presencas[key];
                return (
                  <div
                    key={m.membroId}
                    className="flex items-center gap-3 rounded-2xl p-4 transition-all"
                    style={{
                      backgroundColor: C.white,
                      boxShadow: "0 2px 8px rgba(10,31,63,0.06)",
                      borderLeft: `4px solid ${presente === true ? C.green : presente === false ? C.red : "#E2E8F0"}`,
                    }}
                  >
                    <Avatar className="w-10 h-10 flex-shrink-0">
                      <AvatarImage src={m.fotoUrl ?? undefined} />
                      <AvatarFallback style={{ backgroundColor: C.blue, color: C.white }}>
                        {initials(m.nome)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate" style={{ color: C.navy }}>{m.nome}</p>
                      {m.papel && (
                        <p className="text-xs capitalize" style={{ color: "#94A3B8" }}>{m.papel}</p>
                      )}
                    </div>
                    <button
                      onClick={() => togglePresenca(key)}
                      className="w-11 h-11 rounded-xl flex items-center justify-center transition-all active:scale-90 flex-shrink-0"
                      style={{
                        backgroundColor: presente === true ? C.green : presente === false ? "#FEE2E2" : "#F1F5F9",
                        color: presente === true ? C.white : presente === false ? C.red : "#CBD5E1",
                      }}
                    >
                      {presente === true ? <Check className="w-5 h-5" /> : presente === false ? <X className="w-5 h-5" /> : <span className="text-xl font-bold">·</span>}
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Visitantes / Frequentadores */}
        {data.avulsos.length > 0 && (
          <>
            <p className="text-xs font-semibold tracking-wide mb-3" style={{ color: "#94A3B8" }}>
              VISITANTES / FREQUENTADORES ({data.avulsos.length})
            </p>
            <div className="space-y-2 mb-4">
              {data.avulsos.map((a) => {
                const key = `a_${a.preCadastroId}`;
                const presente = presencas[key];
                const totalP = a.totalPresencas ?? 0;
                const isPromotable = a.promotable;
                const isPromoting = promotingId === a.preCadastroId;
                return (
                  <div
                    key={a.preCadastroId}
                    className="rounded-2xl overflow-hidden"
                    style={{ backgroundColor: C.white, boxShadow: "0 2px 8px rgba(10,31,63,0.06)" }}
                  >
                    <div
                      className="flex items-center gap-3 p-4"
                      style={{ borderLeft: `4px solid ${presente === true ? C.green : presente === false ? C.red : "#E2E8F0"}` }}
                    >
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 relative"
                        style={{ backgroundColor: "#F1F5F9" }}
                      >
                        <User className="w-5 h-5" style={{ color: "#64748B" }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="font-semibold text-sm" style={{ color: C.navy }}>{a.nome}</p>
                          {isPromotable && (
                            <span
                              className="text-xs px-1.5 py-0.5 rounded-full font-semibold flex items-center gap-0.5"
                              style={{ backgroundColor: "#FEF3C7", color: "#92400E" }}
                            >
                              <Star className="w-3 h-3" /> Promover
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {/* Seletor de tipo inline */}
                          {["visitante", "frequentador"].map((t) => {
                            const tipoAtual = tiposAvulso[a.preCadastroId!] ?? a.tipoPessoa ?? "visitante";
                            const ativo = tipoAtual === t;
                            const atualizando = updatingTipoId === a.preCadastroId;
                            return (
                              <button
                                key={t}
                                disabled={atualizando}
                                onClick={() => alterarTipoAvulso(a.preCadastroId!, t)}
                                className="text-xs px-2 py-0.5 rounded-full font-medium transition-all"
                                style={{
                                  backgroundColor: ativo ? C.blue : "#F1F5F9",
                                  color: ativo ? C.white : "#64748B",
                                  opacity: atualizando ? 0.6 : 1,
                                }}
                              >
                                {TIPO_LABELS[t]}
                              </button>
                            );
                          })}
                          {totalP > 0 && (
                            <span
                              className="text-xs px-1.5 py-0.5 rounded-full"
                              style={{
                                backgroundColor: totalP >= 2 ? "#DCFCE7" : "#F1F5F9",
                                color: totalP >= 2 ? "#166534" : "#64748B",
                              }}
                            >
                              {totalP}ª vez
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => togglePresenca(key)}
                        className="w-11 h-11 rounded-xl flex items-center justify-center transition-all active:scale-90 flex-shrink-0"
                        style={{
                          backgroundColor: presente === true ? C.green : presente === false ? "#FEE2E2" : "#F1F5F9",
                          color: presente === true ? C.white : presente === false ? C.red : "#CBD5E1",
                        }}
                      >
                        {presente === true ? <Check className="w-5 h-5" /> : presente === false ? <X className="w-5 h-5" /> : <span className="text-xl font-bold">·</span>}
                      </button>
                    </div>
                    <div
                      className="px-4 pb-3"
                      style={{ borderLeft: `4px solid ${presente === true ? C.green : presente === false ? C.red : "#E2E8F0"}` }}
                    >
                      <button
                        onClick={() => promoverMembro(a.preCadastroId!, a.nome)}
                        disabled={isPromoting}
                        className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl transition-all"
                        style={
                          isPromotable
                            ? { backgroundColor: "#FEF3C7", color: "#92400E" }
                            : { backgroundColor: "#F1F5F9", color: "#475569" }
                        }
                      >
                        {isPromoting ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Star className="w-3 h-3" style={{ color: isPromotable ? "#92400E" : "#94A3B8" }} />
                        )}
                        {isPromotable ? "Vincular como membro" : "Promover a membro"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {data.membros.length === 0 && data.avulsos.length === 0 && (
          <div className="text-center py-10" style={{ color: "#94A3B8" }}>
            <User className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Nenhum membro na lista ainda.</p>
          </div>
        )}

        <Button
          variant="outline"
          onClick={() => { setAvulsoForm({ nome: "", telefone: "", tipo: "visitante" }); setAvulsoOpen(true); }}
          className="w-full rounded-2xl h-11 border-dashed font-medium gap-2 mb-2"
          style={{ color: C.blue, borderColor: C.blue }}
        >
          <Plus className="w-4 h-4" /> Pessoa avulsa
        </Button>
      </div>

      {/* Botão salvar fixo */}
      <div
        className="fixed bottom-0 left-0 right-0 px-5 pb-6 pt-4"
        style={{ background: "linear-gradient(to top, rgba(240,242,245,1) 75%, rgba(240,242,245,0))" }}
      >
        <Button
          disabled={saving}
          onClick={salvarPresencas}
          className="w-full rounded-2xl h-14 font-bold text-base gap-2"
          style={{ backgroundColor: C.green, color: C.white, boxShadow: `0 8px 24px ${C.green}55` }}
        >
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
          Salvar presenças e encerrar
        </Button>
      </div>

      {/* ── Dialog: Pessoa avulsa ── */}
      <Dialog open={avulsoOpen} onOpenChange={setAvulsoOpen}>
        <DialogContent className="rounded-3xl max-w-sm mx-4">
          <DialogHeader>
            <DialogTitle style={{ color: C.navy }}>Adicionar pessoa avulsa</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs font-medium mb-1.5 block">Nome *</Label>
              <Input
                className="rounded-xl"
                placeholder="Nome completo"
                value={avulsoForm.nome}
                onChange={(e) => setAvulsoForm((p) => ({ ...p, nome: e.target.value }))}
                autoFocus
              />
            </div>
            <div>
              <Label className="text-xs font-medium mb-1.5 block">Telefone / WhatsApp</Label>
              <Input
                className="rounded-xl"
                placeholder="67912345678"
                value={avulsoForm.telefone}
                onChange={(e) => setAvulsoForm((p) => ({ ...p, telefone: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-xs font-medium mb-2 block">Tipo</Label>
              <div className="flex gap-2">
                {[
                  { value: "visitante", label: "Visitante" },
                  { value: "frequentador", label: "Frequentador" },
                ].map((t) => (
                  <button
                    key={t.value}
                    onClick={() => setAvulsoForm((p) => ({ ...p, tipo: t.value }))}
                    className="flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all"
                    style={{
                      backgroundColor: avulsoForm.tipo === t.value ? C.blue : "#F1F5F9",
                      color: avulsoForm.tipo === t.value ? C.white : "#64748B",
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              disabled={addingAvulso || !avulsoForm.nome.trim()}
              onClick={adicionarAvulso}
              className="w-full rounded-2xl h-11 font-semibold gap-2"
              style={{ backgroundColor: C.blue, color: C.white }}
            >
              {addingAvulso ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Relatório WhatsApp ── */}
      <Dialog open={relatorioOpen} onOpenChange={(o) => { setRelatorioOpen(o); if (!o) setLocation("/celula"); }}>
        <DialogContent className="rounded-3xl max-w-sm mx-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2" style={{ color: C.navy }}>
              <Share2 className="w-5 h-5" style={{ color: C.green }} />
              Relatório da Célula
            </DialogTitle>
          </DialogHeader>

          {relatorio && (
            <div className="space-y-4">
              {/* Texto do relatório */}
              <div
                className="rounded-2xl p-4 font-mono text-sm leading-relaxed whitespace-pre-line"
                style={{ backgroundColor: "#F0FDF4", color: C.navy, border: "1px solid #BBF7D0" }}
              >
                {gerarTextoWhatsApp(relatorio)}
              </div>

              {/* Status da cópia */}
              <div
                className="flex items-center gap-2 text-sm font-medium rounded-xl p-3"
                style={{
                  backgroundColor: copied ? "#F0FDF4" : "#F1F5F9",
                  color: copied ? C.green : "#64748B",
                }}
              >
                {copied ? <CheckCheck className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? "Texto copiado! Cole no WhatsApp." : "Clique para copiar"}
              </div>

              {/* Para promover */}
              {relatorio.paraPromover.length > 0 && (
                <div
                  className="rounded-2xl p-3"
                  style={{ backgroundColor: "#FEF3C7", border: "1px solid #FDE68A" }}
                >
                  <p className="text-xs font-bold mb-2 flex items-center gap-1.5" style={{ color: "#92400E" }}>
                    <Star className="w-3.5 h-3.5" /> {relatorio.paraPromover.length} pessoa(s) prontas para virar membro:
                  </p>
                  {relatorio.paraPromover.map((p) => (
                    <p key={p.id} className="text-xs" style={{ color: "#92400E" }}>
                      • {p.nome} ({p.totalPresencas} presenças)
                    </p>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  onClick={() => copiarTexto(gerarTextoWhatsApp(relatorio!))}
                  variant="outline"
                  className="flex-1 rounded-2xl h-11 gap-2"
                >
                  {copied ? <CheckCheck className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? "Copiado!" : "Copiar"}
                </Button>
                <Button
                  onClick={() => { setRelatorioOpen(false); setLocation("/celula"); }}
                  className="flex-1 rounded-2xl h-11 font-semibold"
                  style={{ backgroundColor: C.green, color: C.white }}
                >
                  Concluir
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
