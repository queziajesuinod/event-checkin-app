import { useEffect, useState, useCallback } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import {
  MessageCircleQuestion, Plus, Copy, ExternalLink, Trash2, ChevronRight, Loader2,
} from "lucide-react";
import { useHeader } from "@/contexts/HeaderContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  liveQaAPI, publicRoomUrl, liveScreenUrl, type LiveQaSession,
} from "@/lib/liveQaApi";
import { useLiveQaPermissions } from "@/lib/liveQaPermissions";

export default function PerguntasAoVivo() {
  const [, setLocation] = useLocation();
  const { canManage } = useLiveQaPermissions();
  useHeader({ title: "Perguntas ao Vivo", backTo: "/home" });

  const [salas, setSalas] = useState<LiveQaSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const { data } = await liveQaAPI.listSessions();
      setSalas(data);
    } catch {
      toast.error("Não foi possível carregar as salas.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const criar = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await liveQaAPI.createSession({ title: title.trim(), description: description.trim() || undefined });
      setTitle("");
      setDescription("");
      setOpen(false);
      toast.success("Sala criada!");
      carregar();
    } catch {
      toast.error("Erro ao criar sala.");
    } finally {
      setSaving(false);
    }
  };

  const excluir = async (sala: LiveQaSession, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm("Excluir esta sala e todas as perguntas?")) return;
    try {
      await liveQaAPI.deleteSession(sala.id);
      toast.success("Sala excluída.");
      setSalas((prev) => prev.filter((s) => s.id !== sala.id));
    } catch {
      toast.error("Erro ao excluir.");
    }
  };

  const copiarLink = (code: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard?.writeText(publicRoomUrl(code));
    toast.success("Link público copiado!");
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-10">
      <div className="px-4 pt-4 max-w-xl mx-auto">
        {canManage && (
          <Button onClick={() => setOpen(true)} className="w-full mb-4 gap-2">
            <Plus className="w-4 h-4" /> Nova sala
          </Button>
        )}

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : salas.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center">
            <MessageCircleQuestion className="w-12 h-12 mx-auto text-slate-300 mb-2" />
            <p className="font-medium text-slate-600">Nenhuma sala ainda</p>
            {canManage && <p className="text-sm text-slate-400">Clique em “Nova sala” para começar.</p>}
          </div>
        ) : (
          <div className="space-y-3">
            {salas.map((sala) => (
              <div
                key={sala.id}
                role="button"
                tabIndex={0}
                onClick={() => setLocation(`/perguntas/${sala.id}`)}
                className="group bg-white rounded-2xl border border-slate-200 p-4 cursor-pointer transition hover:shadow-md hover:border-indigo-300"
              >
                <div className="flex items-center justify-between gap-2">
                  <Badge className="bg-indigo-600 hover:bg-indigo-600 font-bold tracking-widest">
                    {sala.code}
                  </Badge>
                  <Badge variant={sala.status === "open" ? "default" : "secondary"}
                    className={sala.status === "open" ? "bg-emerald-500 hover:bg-emerald-500" : ""}
                  >
                    {sala.status === "open" ? "Aberta" : "Fechada"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-800 truncate">{sala.title}</p>
                    {sala.description && (
                      <p className="text-sm text-slate-500 truncate">{sala.description}</p>
                    )}
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-indigo-400 flex-shrink-0" />
                </div>

                <div className="flex items-center gap-1 mt-3 pt-3 border-t border-slate-100">
                  <Button variant="ghost" size="sm" className="gap-1 text-slate-600"
                    onClick={(e) => copiarLink(sala.code, e)}
                  >
                    <Copy className="w-4 h-4" /> Link
                  </Button>
                  <Button variant="ghost" size="sm" className="gap-1 text-slate-600"
                    onClick={(e) => { e.stopPropagation(); window.open(liveScreenUrl(sala.code), "_blank"); }}
                  >
                    <ExternalLink className="w-4 h-4" /> Ao vivo
                  </Button>
                  <div className="flex-1" />
                  {canManage && (
                    <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600"
                      onClick={(e) => excluir(sala, e)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Dialog nova sala */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova sala de perguntas</DialogTitle>
            <DialogDescription>Crie uma sala e compartilhe o código com o público.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              autoFocus
              placeholder="Título da sala"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <Textarea
              placeholder="Descrição (opcional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={criar} disabled={!title.trim() || saving}>
              {saving ? "Criando..." : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
