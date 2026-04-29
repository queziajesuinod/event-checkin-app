import {
  type AreaVoluntariado,
  type Campus,
  type VoluntariadoPublicPayload,
  voluntariadoPublicAPI,
} from "@/lib/api";
import axios from "axios";
import { AlertCircle, ArrowLeft, Loader2, Plus, Send, Trash2 } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

const LOGO =
  "https://images.squarespace-cdn.com/content/v1/5bc9186e34c4e27773d92870/1546175613378-UHI78Z3KGSEOFFJEAP0B/logo-site.png";

const C = {
  navy: "#0A1F3F",
  gold: "#C9A84C",
  white: "#FFFFFF",
};

function getTodayDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatCpf(value: string): string {
  const d = value.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9, 11)}`;
}

function formatPhone(value: string): string {
  const d = value.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7, 11)}`;
}

function getErrorMessage(error: unknown): string {
  if (!axios.isAxiosError(error)) {
    return "Não foi possível concluir o cadastro. Tente novamente.";
  }
  const data = error.response?.data;
  if (typeof data === "string" && data.trim()) return data;
  if (data && typeof data === "object") {
    const d = data as { message?: unknown; error?: unknown };
    if (typeof d.message === "string" && d.message.trim()) return d.message;
    if (typeof d.error === "string" && d.error.trim()) return d.error;
  }
  return "Não foi possível concluir o cadastro. Verifique os dados e tente novamente.";
}

interface EntradaForm {
  id: string;
  areaVoluntariadoId: string;
  campusId: string;
  ministerioId: string;
  dataInicio: string;
  observacao: string;
}

function makeEntrada(): EntradaForm {
  return {
    id: Math.random().toString(36).slice(2),
    areaVoluntariadoId: "",
    campusId: "",
    ministerioId: "",
    dataInicio: getTodayDate(),
    observacao: "",
  };
}

interface FormState {
  fullName: string;
  email: string;
  cpf: string;
  phone: string;
  birthDate: string;
  entradas: EntradaForm[];
}

const INITIAL_FORM: FormState = {
  fullName: "",
  email: "",
  cpf: "",
  phone: "",
  birthDate: "",
  entradas: [makeEntrada()],
};

export default function VoluntariadoPublico() {
  const [, setLocation] = useLocation();
  const [formData, setFormData] = useState<FormState>(INITIAL_FORM);
  const [areas, setAreas] = useState<AreaVoluntariado[]>([]);
  const [campi, setCampi] = useState<Campus[]>([]);
  const [ministeriosPorCampus, setMinisteriosPorCampus] = useState<
    Record<string, { id: string; nome: string }[]>
  >({});
  const [loadingMinisterios, setLoadingMinisterios] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setIsLoading(true);
      const [areasRes, campiRes] = await Promise.allSettled([
        voluntariadoPublicAPI.listarAreas(),
        voluntariadoPublicAPI.listarCampi(),
      ]);
      if (!mounted) return;

      if (areasRes.status === "fulfilled") {
        const raw = areasRes.value.data;
        setAreas(
          Array.isArray(raw)
            ? raw.filter((a): a is AreaVoluntariado =>
                Boolean(a && typeof a.id === "string" && typeof a.nome === "string"),
              )
            : [],
        );
      } else {
        setError("Não foi possível carregar as áreas de voluntariado.");
      }

      if (campiRes.status === "fulfilled") {
        const raw = campiRes.value.data;
        console.log("[voluntariado] campus response:", raw);
        // aceita array direto ou payload aninhado { data: [] } / { campi: [] }
        const list = Array.isArray(raw)
          ? raw
          : Array.isArray((raw as Record<string, unknown>)?.data)
            ? ((raw as Record<string, unknown>).data as Campus[])
            : [];
        setCampi(list);
      } else {
        console.error("[voluntariado] campus error:", campiRes.reason);
      }

      if (mounted) setIsLoading(false);
    };

    void load();
    return () => {
      mounted = false;
    };
  }, []);

  const updateField = <K extends keyof Omit<FormState, "entradas">>(
    field: K,
    value: FormState[K],
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const addEntrada = () => {
    setFormData((prev) => ({ ...prev, entradas: [...prev.entradas, makeEntrada()] }));
  };

  const removeEntrada = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      entradas: prev.entradas.filter((e) => e.id !== id),
    }));
  };

  const updateEntrada = (id: string, field: keyof Omit<EntradaForm, "id">, value: string) => {
    setFormData((prev) => ({
      ...prev,
      entradas: prev.entradas.map((e) => (e.id === id ? { ...e, [field]: value } : e)),
    }));
  };

  const handleCampusChange = async (entradaId: string, campusId: string) => {
    setFormData((prev) => ({
      ...prev,
      entradas: prev.entradas.map((e) =>
        e.id === entradaId ? { ...e, campusId, ministerioId: "" } : e,
      ),
    }));

    if (campusId && !ministeriosPorCampus[campusId]) {
      setLoadingMinisterios((prev) => ({ ...prev, [campusId]: true }));
      try {
        const res = await voluntariadoPublicAPI.listarMinisteriosPorCampus(campusId);
        if (Array.isArray(res.data)) {
          setMinisteriosPorCampus((prev) => ({ ...prev, [campusId]: res.data }));
        }
      } catch {
        // ministerios ficam vazios para este campus
      } finally {
        setLoadingMinisterios((prev) => ({ ...prev, [campusId]: false }));
      }
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (formData.entradas.some((e) => !e.areaVoluntariadoId || !e.dataInicio)) {
      setError("Cada entrada deve ter uma área e data de início.");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const payload: VoluntariadoPublicPayload = {
        fullName: formData.fullName,
        email: formData.email,
        cpf: formData.cpf,
        phone: formData.phone,
        birthDate: formData.birthDate,
        voluntariados: formData.entradas.map((e) => ({
          areaVoluntariadoId: e.areaVoluntariadoId,
          ...(e.campusId ? { campusId: e.campusId } : {}),
          ...(e.ministerioId ? { ministerioId: e.ministerioId } : {}),
          dataInicio: e.dataInicio,
          ...(e.observacao ? { observacao: e.observacao } : {}),
        })),
      };

      await voluntariadoPublicAPI.cadastrar(payload);
      toast.success("Cadastro realizado com sucesso. Redirecionando para o login...");
      window.setTimeout(() => setLocation("/login"), 1600);
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    } finally {
      setIsSubmitting(false);
    }
  };

  const disableSubmit = isSubmitting || isLoading || areas.length === 0;

  return (
    <div className="min-h-screen px-4 py-8 sm:px-6" style={{ backgroundColor: C.navy }}>
      <div className="mx-auto w-full max-w-2xl animate-in fade-in duration-500">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setLocation("/login")}
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-90"
            style={{ backgroundColor: "rgba(255,255,255,0.12)", color: C.white }}
          >
            <ArrowLeft className="h-4 w-4" />
            Ir para login
          </button>
          <img src={LOGO} alt="IECG" className="h-10 w-auto" style={{ filter: "brightness(0) invert(1)" }} />
        </div>

        <div
          className="rounded-3xl p-5 shadow-xl sm:p-8"
          style={{ backgroundColor: C.white, boxShadow: "0 16px 40px rgba(0,0,0,0.20)" }}
        >
          <div className="mb-6 border-b pb-4" style={{ borderColor: "#E5E7EB" }}>
            <h1 className="text-2xl font-extrabold" style={{ color: C.navy }}>
              Cadastro de Voluntários
            </h1>
            <p className="mt-1 text-sm" style={{ color: "#6B7280" }}>
              Preencha o formulário para iniciar seu cadastro de voluntariado.
            </p>
          </div>

          {error && (
            <div
              className="mb-5 flex items-start gap-2 rounded-2xl px-4 py-3 text-sm"
              style={{
                backgroundColor: "rgba(220,38,38,0.08)",
                border: "1px solid rgba(220,38,38,0.25)",
              }}
            >
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" style={{ color: "#DC2626" }} />
              <p style={{ color: "#7F1D1D" }}>{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Dados pessoais */}
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-semibold" style={{ color: C.navy }}>
                Nome completo
                <input
                  type="text"
                  value={formData.fullName}
                  onChange={(e) => updateField("fullName", e.target.value)}
                  required
                  disabled={isSubmitting}
                  className="mt-1 h-11 w-full rounded-xl border px-3 text-sm outline-none focus:ring-2"
                  style={{ borderColor: "#D1D5DB", color: C.navy }}
                />
              </label>

              <label className="text-sm font-semibold" style={{ color: C.navy }}>
                E-mail
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => updateField("email", e.target.value)}
                  required
                  disabled={isSubmitting}
                  className="mt-1 h-11 w-full rounded-xl border px-3 text-sm outline-none focus:ring-2"
                  style={{ borderColor: "#D1D5DB", color: C.navy }}
                />
              </label>

              <label className="text-sm font-semibold" style={{ color: C.navy }}>
                CPF
                <input
                  type="text"
                  value={formData.cpf}
                  onChange={(e) => updateField("cpf", formatCpf(e.target.value))}
                  required
                  disabled={isSubmitting}
                  maxLength={14}
                  className="mt-1 h-11 w-full rounded-xl border px-3 text-sm outline-none focus:ring-2"
                  style={{ borderColor: "#D1D5DB", color: C.navy }}
                />
              </label>

              <label className="text-sm font-semibold" style={{ color: C.navy }}>
                Telefone
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => updateField("phone", formatPhone(e.target.value))}
                  required
                  disabled={isSubmitting}
                  maxLength={15}
                  className="mt-1 h-11 w-full rounded-xl border px-3 text-sm outline-none focus:ring-2"
                  style={{ borderColor: "#D1D5DB", color: C.navy }}
                />
              </label>

              <label className="text-sm font-semibold sm:col-span-2" style={{ color: C.navy }}>
                Data de nascimento
                <input
                  type="date"
                  value={formData.birthDate}
                  onChange={(e) => updateField("birthDate", e.target.value)}
                  required
                  disabled={isSubmitting}
                  className="mt-1 h-11 w-full rounded-xl border px-3 text-sm outline-none focus:ring-2"
                  style={{ borderColor: "#D1D5DB", color: C.navy }}
                />
              </label>
            </div>

            {/* Entradas de voluntariado */}
            <div>
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold" style={{ color: C.navy }}>
                    Áreas de voluntariado
                  </p>
                  <p className="text-xs" style={{ color: "#6B7280" }}>
                    Adicione uma entrada para cada área, campus ou ministério desejado.
                  </p>
                </div>
                {formData.entradas.length > 1 && (
                  <span
                    className="rounded-full px-2 py-0.5 text-xs font-semibold"
                    style={{ backgroundColor: "rgba(201,168,76,0.15)", color: C.gold }}
                  >
                    {formData.entradas.length} entradas
                  </span>
                )}
              </div>

              {isLoading ? (
                <div
                  className="flex items-center gap-2 rounded-xl border px-4 py-4 text-sm"
                  style={{ borderColor: "#D1D5DB", color: "#6B7280" }}
                >
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Carregando opções...
                </div>
              ) : (
                <div className="space-y-3">
                  {formData.entradas.map((entrada, index) => (
                    <div
                      key={entrada.id}
                      className="rounded-xl border p-4"
                      style={{
                        borderColor: entrada.areaVoluntariadoId ? C.gold : "#D1D5DB",
                        backgroundColor: entrada.areaVoluntariadoId ? "#FBF5E6" : "#FAFAFA",
                      }}
                    >
                      <div className="mb-3 flex items-center justify-between">
                        <span
                          className="text-xs font-bold uppercase tracking-wider"
                          style={{ color: "#9CA3AF" }}
                        >
                          Entrada {index + 1}
                        </span>
                        {formData.entradas.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeEntrada(entrada.id)}
                            disabled={isSubmitting}
                            className="rounded-full p-1 transition-colors hover:bg-red-50"
                            style={{ color: "#DC2626" }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="text-xs font-semibold" style={{ color: C.navy }}>
                          Área *
                          <select
                            value={entrada.areaVoluntariadoId}
                            onChange={(e) =>
                              updateEntrada(entrada.id, "areaVoluntariadoId", e.target.value)
                            }
                            required
                            disabled={isSubmitting || areas.length === 0}
                            className="mt-1 h-10 w-full rounded-lg border px-2 text-sm outline-none focus:ring-2"
                            style={{
                              borderColor: "#D1D5DB",
                              color: C.navy,
                              backgroundColor: C.white,
                            }}
                          >
                            <option value="">Selecione a área...</option>
                            {areas.map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.nome}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="text-xs font-semibold" style={{ color: C.navy }}>
                          Data de início *
                          <input
                            type="date"
                            value={entrada.dataInicio}
                            onChange={(e) =>
                              updateEntrada(entrada.id, "dataInicio", e.target.value)
                            }
                            required
                            disabled={isSubmitting}
                            className="mt-1 h-10 w-full rounded-lg border px-2 text-sm outline-none focus:ring-2"
                            style={{ borderColor: "#D1D5DB", color: C.navy }}
                          />
                        </label>

                        <label className="text-xs font-semibold" style={{ color: C.navy }}>
                          Campus
                          <select
                            value={entrada.campusId}
                            onChange={(e) =>
                              void handleCampusChange(entrada.id, e.target.value)
                            }
                            disabled={isSubmitting}
                            className="mt-1 h-10 w-full rounded-lg border px-2 text-sm outline-none focus:ring-2"
                            style={{
                              borderColor: "#D1D5DB",
                              color: C.navy,
                              backgroundColor: C.white,
                            }}
                          >
                            <option value="">Selecione o campus...</option>
                            {campi.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.nome}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="text-xs font-semibold" style={{ color: C.navy }}>
                          Ministério
                          {entrada.campusId && loadingMinisterios[entrada.campusId] ? (
                            <div
                              className="mt-1 flex h-10 items-center gap-2 rounded-lg border px-2 text-xs"
                              style={{ borderColor: "#D1D5DB", color: "#6B7280" }}
                            >
                              <Loader2 className="h-3 w-3 animate-spin" />
                              Carregando...
                            </div>
                          ) : (
                            <select
                              value={entrada.ministerioId}
                              onChange={(e) =>
                                updateEntrada(entrada.id, "ministerioId", e.target.value)
                              }
                              disabled={isSubmitting || !entrada.campusId}
                              className="mt-1 h-10 w-full rounded-lg border px-2 text-sm outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-50"
                              style={{
                                borderColor: "#D1D5DB",
                                color: C.navy,
                                backgroundColor: C.white,
                              }}
                            >
                              <option value="">
                                {entrada.campusId
                                  ? "Selecione o ministério..."
                                  : "Selecione o campus primeiro"}
                              </option>
                              {(ministeriosPorCampus[entrada.campusId] ?? []).map((m) => (
                                <option key={m.id} value={m.id}>
                                  {m.nome}
                                </option>
                              ))}
                            </select>
                          )}
                        </label>

                        <label
                          className={`text-xs font-semibold ${
                            campi.length === 0 ? "sm:col-span-2" : ""
                          }`}
                          style={{ color: C.navy }}
                        >
                          Observação
                          <input
                            type="text"
                            value={entrada.observacao}
                            onChange={(e) =>
                              updateEntrada(entrada.id, "observacao", e.target.value)
                            }
                            placeholder="Opcional"
                            disabled={isSubmitting}
                            className="mt-1 h-10 w-full rounded-lg border px-2 text-sm outline-none focus:ring-2"
                            style={{ borderColor: "#D1D5DB", color: C.navy }}
                          />
                        </label>
                      </div>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={addEntrada}
                    disabled={isSubmitting || areas.length === 0}
                    className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
                    style={{ backgroundColor: "rgba(10,31,63,0.07)", color: C.navy }}
                  >
                    <Plus className="h-4 w-4" />
                    Adicionar outra área
                  </button>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={disableSubmit}
              className="mt-2 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-sm font-bold transition-opacity disabled:cursor-not-allowed disabled:opacity-70"
              style={{ backgroundColor: C.gold, color: C.navy }}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Enviando cadastro...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Finalizar cadastro
                </>
              )}
            </button>

            <p className="text-center text-xs" style={{ color: "#6B7280" }}>
              Ao concluir, você será notificado e redirecionado para o login.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
