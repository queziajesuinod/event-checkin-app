import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useRoute } from "wouter";
import { toast } from "sonner";
import {
  ThumbsUp, Tv, Square, CheckCircle2, RotateCcw, Archive, ArchiveRestore,
  Trash2, ExternalLink, Copy, Loader2, ChevronDown, ChevronUp,
} from "lucide-react";
import { useHeader } from "@/contexts/HeaderContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  liveQaAPI, publicRoomUrl, liveScreenUrl,
  type LiveQaQuestion, type LiveQaSession, type ModeratePayload,
} from "@/lib/liveQaApi";
import { useLiveQaPermissions } from "@/lib/liveQaPermissions";

const MEDAL: Record<number, string> = { 1: "bg-amber-400", 2: "bg-slate-400", 3: "bg-orange-400" };

export default function PerguntasAoVivoSala() {
  const [, params] = useRoute("/perguntas/:id");
  const sessionId = (params?.id ?? "") as string;
  const { canManage } = useLiveQaPermissions();

  const [sala, setSala] = useState<LiveQaSession | null>(null);
  const [questions, setQuestions] = useState<LiveQaQuestion[]>([]);
  const [liveId, setLiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const busy = useRef(false);

  useHeader({ title: sala?.title ?? "Sala", backTo: "/perguntas" });

  const carregarSala = useCallback(async () => {
    try {
      const { data } = await liveQaAPI.listSessions();
      setSala(data.find((s) => s.id === sessionId) ?? null);
    } catch {
      /* silencioso */
    }
  }, [sessionId]);

  const carregarPerguntas = useCallback(async () => {
    if (!sessionId || busy.current) return;
    try {
      const { data } = await liveQaAPI.listQuestions(sessionId);
      setQuestions(data.questions);
      setLiveId(data.liveQuestionId);
    } catch {
      /* silencioso no polling */
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    carregarSala();
    carregarPerguntas();
    const t = setInterval(carregarPerguntas, 3000);
    return () => clearInterval(t);
  }, [carregarSala, carregarPerguntas]);

  const grupos = useMemo(() => {
    const liveQuestion = questions.find((q) => q.id === liveId && q.status !== "archived");
    const fila = questions.filter((q) => q.status !== "archived" && !q.answered && q.id !== liveId);
    const respondidas = questions.filter((q) => q.status !== "archived" && q.answered && q.id !== liveId);
    const arquivadas = questions.filter((q) => q.status === "archived");
    return { liveQuestion, fila, respondidas, arquivadas };
  }, [questions, liveId]);

  const moderar = async (id: string, payload: ModeratePayload) => {
    busy.current = true;
    try {
      await liveQaAPI.moderateQuestion(id, payload);
      await carregarPerguntas();
    } catch {
      toast.error("Erro ao moderar.");
    } finally {
      busy.current = false;
    }
  };

  const excluir = async (id: string) => {
    if (!window.confirm("Excluir esta pergunta?")) return;
    busy.current = true;
    try {
      await liveQaAPI.deleteQuestion(id);
      setQuestions((prev) => prev.filter((q) => q.id !== id));
    } catch {
      toast.error("Erro ao excluir.");
    } finally {
      busy.current = false;
    }
  };

  const toggleSala = async () => {
    if (!sala) return;
    try {
      await liveQaAPI.updateSession(sala.id, { status: sala.status === "open" ? "closed" : "open" });
      carregarSala();
      toast.success(sala.status === "open" ? "Sala fechada." : "Sala reaberta.");
    } catch {
      toast.error("Erro ao atualizar sala.");
    }
  };

  const Card = ({ q, rank, variant }: { q: LiveQaQuestion; rank?: number; variant?: string }) => {
    const isLive = variant === "live";
    const accent = isLive ? "border-l-purple-500" : variant === "answered" ? "border-l-emerald-500" : "border-l-indigo-500";
    return (
      <div
        className={`bg-white rounded-xl border border-slate-200 border-l-4 ${accent} p-3 flex items-center gap-3 ${variant === "archived" ? "opacity-60" : ""} ${isLive ? "shadow-md ring-1 ring-purple-200" : ""}`}
      >
        <div className="flex flex-col items-center w-12 flex-shrink-0">
          {typeof rank === "number" && (
            <span className={`w-6 h-6 mb-0.5 rounded-full grid place-items-center text-xs font-extrabold text-white ${MEDAL[rank] ?? "bg-slate-300"}`}>
              {rank}
            </span>
          )}
          <div className="flex items-center gap-0.5 text-slate-700">
            <ThumbsUp className="w-4 h-4" />
            <span className="font-extrabold">{q.likesCount}</span>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-slate-800 break-words font-medium">{q.text}</p>
          <p className="text-xs text-slate-400">{q.authorName || "Anônimo"}</p>
        </div>

        <div className="flex items-center gap-0.5 flex-shrink-0">
          {isLive ? (
            <Button size="icon" variant="ghost" className="text-purple-600" title="Tirar do ao vivo"
              onClick={() => moderar(q.id, { isLive: false })}
            >
              <Square className="w-5 h-5" />
            </Button>
          ) : (
            <Button size="icon" variant="ghost" className="text-indigo-600" title="Responder agora (ao vivo)"
              onClick={() => moderar(q.id, { isLive: true })}
            >
              <Tv className="w-5 h-5" />
            </Button>
          )}
          <Button size="icon" variant="ghost" className={q.answered ? "text-amber-500" : "text-emerald-600"}
            title={q.answered ? "Reabrir" : "Marcar respondida"}
            onClick={() => moderar(q.id, { answered: !q.answered })}
          >
            {q.answered ? <RotateCcw className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
          </Button>
          <Button size="icon" variant="ghost" className="text-slate-500"
            title={q.status === "archived" ? "Restaurar" : "Arquivar"}
            onClick={() => moderar(q.id, { status: q.status === "archived" ? "active" : "archived" })}
          >
            {q.status === "archived" ? <ArchiveRestore className="w-5 h-5" /> : <Archive className="w-5 h-5" />}
          </Button>
          <Button size="icon" variant="ghost" className="text-red-500" title="Excluir"
            onClick={() => excluir(q.id)}
          >
            <Trash2 className="w-5 h-5" />
          </Button>
        </div>
      </div>
    );
  };

  const SectionTitle = ({ children }: { children: React.ReactNode }) => (
    <div className="flex items-center gap-2 mt-5 mb-2 first:mt-0">{children}</div>
  );

  return (
    <div className="min-h-screen bg-slate-50 pb-10">
      <div className="px-4 pt-4 max-w-2xl mx-auto">
        {/* Barra de ações */}
        {sala && (
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <Badge className="bg-indigo-600 hover:bg-indigo-600 font-bold tracking-widest">{sala.code}</Badge>
            <Badge className={sala.status === "open" ? "bg-emerald-500 hover:bg-emerald-500" : "bg-slate-400 hover:bg-slate-400"}>
              {sala.status === "open" ? "Aberta" : "Fechada"}
            </Badge>
            <div className="flex-1" />
            <Button variant="outline" size="sm" className="gap-1"
              onClick={() => { navigator.clipboard?.writeText(publicRoomUrl(sala.code)); toast.success("Link copiado!"); }}
            >
              <Copy className="w-4 h-4" /> Link
            </Button>
            <Button variant="outline" size="sm" className="gap-1"
              onClick={() => window.open(liveScreenUrl(sala.code), "_blank")}
            >
              <ExternalLink className="w-4 h-4" /> Ao vivo
            </Button>
            {canManage && (
              <Button size="sm"
                className={sala.status === "open" ? "bg-amber-500 hover:bg-amber-600" : "bg-emerald-500 hover:bg-emerald-600"}
                onClick={toggleSala}
              >
                {sala.status === "open" ? "Fechar sala" : "Reabrir sala"}
              </Button>
            )}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : questions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center text-slate-500">
            Nenhuma pergunta ainda. Compartilhe o código <b>{sala?.code}</b> com o público.
          </div>
        ) : (
          <>
            {grupos.liveQuestion && (
              <>
                <SectionTitle>
                  <Tv className="w-5 h-5 text-purple-600" />
                  <span className="font-bold text-purple-700">Respondendo agora</span>
                </SectionTitle>
                <Card q={grupos.liveQuestion} variant="live" />
              </>
            )}

            {grupos.fila.length > 0 && (
              <>
                <SectionTitle>
                  <ThumbsUp className="w-5 h-5 text-indigo-600" />
                  <span className="font-bold text-slate-700">Fila de perguntas</span>
                  <Badge variant="secondary">{grupos.fila.length}</Badge>
                </SectionTitle>
                <div className="space-y-2">
                  {grupos.fila.map((q, i) => <Card key={q.id} q={q} rank={i + 1} />)}
                </div>
              </>
            )}

            {grupos.respondidas.length > 0 && (
              <>
                <SectionTitle>
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <span className="font-bold text-emerald-700">Respondidas</span>
                  <Badge variant="secondary">{grupos.respondidas.length}</Badge>
                </SectionTitle>
                <div className="space-y-2">
                  {grupos.respondidas.map((q) => <Card key={q.id} q={q} variant="answered" />)}
                </div>
              </>
            )}

            {grupos.arquivadas.length > 0 && (
              <>
                <Button variant="ghost" size="sm" className="mt-5 gap-1 text-slate-500"
                  onClick={() => setShowArchived((v) => !v)}
                >
                  <Archive className="w-4 h-4" /> Arquivadas ({grupos.arquivadas.length})
                  {showArchived ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </Button>
                {showArchived && (
                  <div className="space-y-2 mt-2">
                    {grupos.arquivadas.map((q) => <Card key={q.id} q={q} variant="archived" />)}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
