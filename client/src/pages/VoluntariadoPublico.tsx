import {
  type AreaVoluntariado,
  type Campus,
  voluntariadoPublicAPI,
} from "@/lib/api";
import axios from "axios";
import { AlertCircle, ArrowLeft, ArrowRight, Check, CheckCircle2, Loader2, Plus } from "lucide-react";
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

const isValidEmail = (value: string) => /^\S+@\S+\.\S+$/.test(value.trim());

function getErrorMessage(error: unknown): string {
  if (!axios.isAxiosError(error)) {
    return "Não foi possível concluir. Tente novamente.";
  }
  if (error.code === "ECONNABORTED" || /timeout/i.test(error.message)) {
    return "O servidor demorou para responder. Tente novamente em instantes.";
  }
  const data = error.response?.data;
  if (typeof data === "string" && data.trim()) return data;
  if (data && typeof data === "object") {
    const d = data as { message?: unknown; error?: unknown; erro?: unknown };
    if (typeof d.erro === "string" && d.erro.trim()) return d.erro;
    if (typeof d.message === "string" && d.message.trim()) return d.message;
    if (typeof d.error === "string" && d.error.trim()) return d.error;
  }
  return "Não foi possível concluir. Verifique os dados e tente novamente.";
}

interface PessoaForm {
  fullName: string;
  email: string;
  cpf: string;
  phone: string;
  birthDate: string;
}

const INITIAL_PESSOA: PessoaForm = {
  fullName: "",
  email: "",
  cpf: "",
  phone: "",
  birthDate: "",
};

interface EntradaForm {
  areaVoluntariadoId: string;
  campusId: string;
  ministerioId: string;
  dataInicio: string;
  observacao: string;
}

const emptyEntrada = (): EntradaForm => ({
  areaVoluntariadoId: "",
  campusId: "",
  ministerioId: "",
  dataInicio: getTodayDate(),
  observacao: "",
});

interface VinculoAdicionado {
  id: string;
  area: string;
  campus?: string;
  ministerio?: string;
  status: string;
  jaExistia?: boolean;
}

const inputClass =
  "mt-1 h-11 w-full rounded-xl border px-3 text-sm outline-none focus:ring-2";
const selectClass =
  "mt-1 h-11 w-full rounded-xl border px-3 text-sm outline-none focus:ring-2";
const inputStyle = { borderColor: "#D1D5DB", color: C.navy, backgroundColor: C.white };

export default function VoluntariadoPublico() {
  const [, setLocation] = useLocation();

  const [step, setStep] = useState<1 | 2>(1);
  const [pessoa, setPessoa] = useState<PessoaForm>(INITIAL_PESSOA);
  const [memberId, setMemberId] = useState<string>("");
  const [memberFound, setMemberFound] = useState(false);
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [savingPessoa, setSavingPessoa] = useState(false);

  const [areas, setAreas] = useState<AreaVoluntariado[]>([]);
  const [campi, setCampi] = useState<Campus[]>([]);
  const [ministeriosPorCampus, setMinisteriosPorCampus] = useState<
    Record<string, { id: string; nome: string }[]>
  >({});
  const [loadingMinisterios, setLoadingMinisterios] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);

  const [entrada, setEntrada] = useState<EntradaForm>(emptyEntrada());
  const [savingVinculo, setSavingVinculo] = useState(false);
  const [vinculos, setVinculos] = useState<VinculoAdicionado[]>([]);

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
                Boolean(a && typeof a.id === "string" && typeof a.nome === "string"))
            : [],
        );
      }

      if (campiRes.status === "fulfilled") {
        const raw = campiRes.value.data;
        const list = Array.isArray(raw)
          ? raw
          : Array.isArray((raw as Record<string, unknown>)?.data)
            ? ((raw as Record<string, unknown>).data as Campus[])
            : [];
        setCampi(list);
      }

      if (mounted) setIsLoading(false);
    };
    void load();
    return () => {
      mounted = false;
    };
  }, []);

  const updatePessoa = <K extends keyof PessoaForm>(field: K, value: PessoaForm[K]) => {
    setPessoa((prev) => ({ ...prev, [field]: value }));
  };

  // Etapa 0: ao sair do e-mail, verifica se já existe cadastro e pré-preenche
  const verificarEmail = async () => {
    const email = pessoa.email.trim();
    if (!isValidEmail(email)) return;
    setCheckingEmail(true);
    try {
      const { data } = await voluntariadoPublicAPI.buscarMembro({ email });
      if (data.exists && data.member) {
        setMemberFound(true);
        setPessoa((prev) => ({
          ...prev,
          fullName: data.member?.fullName || prev.fullName,
          cpf: data.member?.cpf ? formatCpf(data.member.cpf) : prev.cpf,
          phone: data.member?.phone ? formatPhone(data.member.phone) : prev.phone,
          birthDate: (data.member?.birthDate || prev.birthDate || "").slice(0, 10),
        }));
        toast.success("Encontramos seu cadastro. Confira os dados e continue.");
      } else {
        setMemberFound(false);
      }
    } catch {
      /* silencioso — não bloqueia o preenchimento */
    } finally {
      setCheckingEmail(false);
    }
  };

  // Etapa 1: salvar/atualizar a pessoa e ir para as áreas
  const continuarParaAreas = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!pessoa.fullName || !pessoa.email || !pessoa.cpf || !pessoa.phone || !pessoa.birthDate) {
      setError("Preencha todos os dados pessoais.");
      return;
    }
    if (!isValidEmail(pessoa.email)) {
      setError("Informe um e-mail válido.");
      return;
    }
    setSavingPessoa(true);
    setError("");
    try {
      const { data } = await voluntariadoPublicAPI.salvarPessoa({
        fullName: pessoa.fullName,
        email: pessoa.email,
        cpf: pessoa.cpf,
        phone: pessoa.phone,
        birthDate: pessoa.birthDate,
      });
      setMemberId(data.memberId);
      setStep(2);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    } finally {
      setSavingPessoa(false);
    }
  };

  const handleCampusChange = async (campusId: string) => {
    setEntrada((prev) => ({ ...prev, campusId, ministerioId: "" }));
    if (campusId && !ministeriosPorCampus[campusId]) {
      setLoadingMinisterios((prev) => ({ ...prev, [campusId]: true }));
      try {
        const res = await voluntariadoPublicAPI.listarMinisteriosPorCampus(campusId);
        if (Array.isArray(res.data)) {
          setMinisteriosPorCampus((prev) => ({ ...prev, [campusId]: res.data }));
        }
      } catch {
        /* ministérios ficam vazios */
      } finally {
        setLoadingMinisterios((prev) => ({ ...prev, [campusId]: false }));
      }
    }
  };

  // Etapa 2: adiciona UMA área por vez (grava individualmente)
  const adicionarVoluntariado = async () => {
    if (!entrada.areaVoluntariadoId || !entrada.dataInicio) {
      setError("Escolha a área e a data de início.");
      return;
    }
    setSavingVinculo(true);
    setError("");
    try {
      const { data } = await voluntariadoPublicAPI.adicionarVinculo({
        memberId,
        areaVoluntariadoId: entrada.areaVoluntariadoId,
        dataInicio: entrada.dataInicio,
        ...(entrada.campusId ? { campusId: entrada.campusId } : {}),
        ...(entrada.ministerioId ? { ministerioId: entrada.ministerioId } : {}),
        ...(entrada.observacao ? { observacao: entrada.observacao } : {}),
      });
      const areaNome = areas.find((a) => a.id === entrada.areaVoluntariadoId)?.nome || data.area;
      const campusNome = campi.find((c) => c.id === entrada.campusId)?.nome;
      const ministerioNome = (ministeriosPorCampus[entrada.campusId] ?? []).find(
        (m) => m.id === entrada.ministerioId,
      )?.nome;

      setVinculos((prev) => [
        ...prev,
        {
          id: data.voluntariadoId,
          area: areaNome,
          campus: campusNome,
          ministerio: ministerioNome,
          status: data.status,
          jaExistia: data.jaExistia,
        },
      ]);
      if (data.jaExistia) {
        toast.info("Você já possuía esse voluntariado.");
      } else {
        toast.success("Voluntariado adicionado!");
      }
      // limpa a entrada mantendo a data
      setEntrada((prev) => ({ ...emptyEntrada(), dataInicio: prev.dataInicio }));
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    } finally {
      setSavingVinculo(false);
    }
  };

  const concluir = () => {
    toast.success("Cadastro concluído! Redirecionando para o login...");
    window.setTimeout(() => setLocation("/login"), 1400);
  };

  return (
    <div className="min-h-screen px-4 py-8 sm:px-6" style={{ backgroundColor: C.navy }}>
      <div className="mx-auto w-full max-w-2xl animate-in fade-in duration-500">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => (step === 2 ? setStep(1) : setLocation("/login"))}
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-90"
            style={{ backgroundColor: "rgba(255,255,255,0.12)", color: C.white }}
          >
            <ArrowLeft className="h-4 w-4" />
            {step === 2 ? "Voltar aos dados" : "Ir para login"}
          </button>
          <img src={LOGO} alt="IECG" className="h-10 w-auto" style={{ filter: "brightness(0) invert(1)" }} />
        </div>

        {/* Timeline / stepper */}
        <div className="mb-5 flex items-center gap-3">
          {[
            { n: 1, label: "Seus dados" },
            { n: 2, label: "Voluntariado" },
          ].map((s, i) => (
            <div key={s.n} className="flex flex-1 items-center gap-3">
              <div className="flex items-center gap-2">
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold"
                  style={
                    step >= (s.n as 1 | 2)
                      ? { backgroundColor: C.gold, color: C.navy }
                      : { backgroundColor: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.6)" }
                  }
                >
                  {step > s.n ? <Check className="h-4 w-4" /> : s.n}
                </div>
                <span
                  className="text-sm font-semibold"
                  style={{ color: step >= (s.n as 1 | 2) ? C.white : "rgba(255,255,255,0.5)" }}
                >
                  {s.label}
                </span>
              </div>
              {i === 0 && (
                <div
                  className="h-0.5 flex-1 rounded-full"
                  style={{ backgroundColor: step >= 2 ? C.gold : "rgba(255,255,255,0.15)" }}
                />
              )}
            </div>
          ))}
        </div>

        <div
          className="rounded-3xl p-5 shadow-xl sm:p-8"
          style={{ backgroundColor: C.white, boxShadow: "0 16px 40px rgba(0,0,0,0.20)" }}
        >
          {error && (
            <div
              className="mb-5 flex items-start gap-2 rounded-2xl px-4 py-3 text-sm"
              style={{ backgroundColor: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.25)" }}
            >
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" style={{ color: "#DC2626" }} />
              <p style={{ color: "#7F1D1D" }}>{error}</p>
            </div>
          )}

          {/* ETAPA 1 — DADOS PESSOAIS */}
          {step === 1 && (
            <form onSubmit={continuarParaAreas} className="space-y-5">
              <div className="border-b pb-4" style={{ borderColor: "#E5E7EB" }}>
                <h1 className="text-2xl font-extrabold" style={{ color: C.navy }}>
                  Cadastro de Voluntários
                </h1>
                <p className="mt-1 text-sm" style={{ color: "#6B7280" }}>
                  Comece pelo seu e-mail. Se você já tem cadastro, seus dados aparecem para conferência.
                </p>
              </div>

              <label className="block text-sm font-semibold" style={{ color: C.navy }}>
                E-mail
                <div className="relative">
                  <input
                    type="email"
                    value={pessoa.email}
                    onChange={(e) => updatePessoa("email", e.target.value)}
                    onBlur={verificarEmail}
                    required
                    disabled={savingPessoa}
                    placeholder="seu@email.com"
                    className={inputClass}
                    style={inputStyle}
                  />
                  {checkingEmail && (
                    <Loader2
                      className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin"
                      style={{ color: C.gold }}
                    />
                  )}
                </div>
                {memberFound && (
                  <span className="mt-1 flex items-center gap-1 text-xs font-medium" style={{ color: "#059669" }}>
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Cadastro encontrado — confira e atualize se precisar.
                  </span>
                )}
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-semibold sm:col-span-2" style={{ color: C.navy }}>
                  Nome completo
                  <input
                    type="text"
                    value={pessoa.fullName}
                    onChange={(e) => updatePessoa("fullName", e.target.value)}
                    required
                    disabled={savingPessoa}
                    className={inputClass}
                    style={inputStyle}
                  />
                </label>

                <label className="text-sm font-semibold" style={{ color: C.navy }}>
                  CPF
                  <input
                    type="text"
                    value={pessoa.cpf}
                    onChange={(e) => updatePessoa("cpf", formatCpf(e.target.value))}
                    required
                    disabled={savingPessoa}
                    maxLength={14}
                    className={inputClass}
                    style={inputStyle}
                  />
                </label>

                <label className="text-sm font-semibold" style={{ color: C.navy }}>
                  Telefone
                  <input
                    type="text"
                    value={pessoa.phone}
                    onChange={(e) => updatePessoa("phone", formatPhone(e.target.value))}
                    required
                    disabled={savingPessoa}
                    maxLength={15}
                    className={inputClass}
                    style={inputStyle}
                  />
                </label>

                <label className="text-sm font-semibold sm:col-span-2" style={{ color: C.navy }}>
                  Data de nascimento
                  <input
                    type="date"
                    value={pessoa.birthDate}
                    onChange={(e) => updatePessoa("birthDate", e.target.value)}
                    required
                    disabled={savingPessoa}
                    className={inputClass}
                    style={inputStyle}
                  />
                </label>
              </div>

              <button
                type="submit"
                disabled={savingPessoa}
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-sm font-bold transition-opacity disabled:cursor-not-allowed disabled:opacity-70"
                style={{ backgroundColor: C.gold, color: C.navy }}
              >
                {savingPessoa ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />Salvando...</>
                ) : (
                  <>Continuar<ArrowRight className="h-4 w-4" /></>
                )}
              </button>
            </form>
          )}

          {/* ETAPA 2 — ÁREAS DE VOLUNTARIADO */}
          {step === 2 && (
            <div className="space-y-5">
              <div className="border-b pb-4" style={{ borderColor: "#E5E7EB" }}>
                <h1 className="text-2xl font-extrabold" style={{ color: C.navy }}>
                  Áreas de voluntariado
                </h1>
                <p className="mt-1 text-sm" style={{ color: "#6B7280" }}>
                  Adicione uma área por vez — cada uma é salva na hora.
                </p>
              </div>

              {/* Já adicionados */}
              {vinculos.length > 0 && (
                <div className="space-y-2">
                  {vinculos.map((v) => (
                    <div
                      key={v.id}
                      className="flex items-center gap-3 rounded-xl border px-4 py-3"
                      style={{ borderColor: "#BBF7D0", backgroundColor: "#F0FDF4" }}
                    >
                      <CheckCircle2 className="h-5 w-5 flex-shrink-0" style={{ color: "#16A34A" }} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold" style={{ color: C.navy }}>{v.area}</p>
                        <p className="truncate text-xs" style={{ color: "#6B7280" }}>
                          {[v.campus, v.ministerio].filter(Boolean).join(" · ") || "Sem campus/ministério"}
                        </p>
                      </div>
                      <span
                        className="rounded-full px-2 py-0.5 text-xs font-semibold"
                        style={{ backgroundColor: "rgba(201,168,76,0.15)", color: C.gold }}
                      >
                        {v.jaExistia ? "Já existia" : "Pendente"}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Formulário de nova área */}
              {isLoading ? (
                <div
                  className="flex items-center gap-2 rounded-xl border px-4 py-4 text-sm"
                  style={{ borderColor: "#D1D5DB", color: "#6B7280" }}
                >
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Carregando opções...
                </div>
              ) : (
                <div
                  className="rounded-xl border p-4"
                  style={{
                    borderColor: entrada.areaVoluntariadoId ? C.gold : "#D1D5DB",
                    backgroundColor: entrada.areaVoluntariadoId ? "#FBF5E6" : "#FAFAFA",
                  }}
                >
                  <p className="mb-3 text-xs font-bold uppercase tracking-wider" style={{ color: "#9CA3AF" }}>
                    Nova área
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="text-xs font-semibold" style={{ color: C.navy }}>
                      Área *
                      <select
                        value={entrada.areaVoluntariadoId}
                        onChange={(e) => setEntrada((p) => ({ ...p, areaVoluntariadoId: e.target.value }))}
                        disabled={savingVinculo || areas.length === 0}
                        className={selectClass}
                        style={inputStyle}
                      >
                        <option value="">Selecione a área...</option>
                        {areas.map((a) => (
                          <option key={a.id} value={a.id}>{a.nome}</option>
                        ))}
                      </select>
                    </label>

                    <label className="text-xs font-semibold" style={{ color: C.navy }}>
                      Data de início *
                      <input
                        type="date"
                        value={entrada.dataInicio}
                        onChange={(e) => setEntrada((p) => ({ ...p, dataInicio: e.target.value }))}
                        disabled={savingVinculo}
                        className={inputClass}
                        style={inputStyle}
                      />
                    </label>

                    <label className="text-xs font-semibold" style={{ color: C.navy }}>
                      Campus
                      <select
                        value={entrada.campusId}
                        onChange={(e) => void handleCampusChange(e.target.value)}
                        disabled={savingVinculo}
                        className={selectClass}
                        style={inputStyle}
                      >
                        <option value="">Selecione o campus...</option>
                        {campi.map((c) => (
                          <option key={c.id} value={c.id}>{c.nome}</option>
                        ))}
                      </select>
                    </label>

                    <label className="text-xs font-semibold" style={{ color: C.navy }}>
                      Ministério
                      {entrada.campusId && loadingMinisterios[entrada.campusId] ? (
                        <div
                          className="mt-1 flex h-11 items-center gap-2 rounded-xl border px-3 text-xs"
                          style={{ borderColor: "#D1D5DB", color: "#6B7280" }}
                        >
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Carregando...
                        </div>
                      ) : (
                        <select
                          value={entrada.ministerioId}
                          onChange={(e) => setEntrada((p) => ({ ...p, ministerioId: e.target.value }))}
                          disabled={savingVinculo || !entrada.campusId}
                          className={`${selectClass} disabled:cursor-not-allowed disabled:opacity-50`}
                          style={inputStyle}
                        >
                          <option value="">
                            {entrada.campusId ? "Selecione o ministério..." : "Selecione o campus primeiro"}
                          </option>
                          {(ministeriosPorCampus[entrada.campusId] ?? []).map((m) => (
                            <option key={m.id} value={m.id}>{m.nome}</option>
                          ))}
                        </select>
                      )}
                    </label>

                    <label className="text-xs font-semibold sm:col-span-2" style={{ color: C.navy }}>
                      Observação
                      <input
                        type="text"
                        value={entrada.observacao}
                        onChange={(e) => setEntrada((p) => ({ ...p, observacao: e.target.value }))}
                        placeholder="Opcional"
                        disabled={savingVinculo}
                        className={inputClass}
                        style={inputStyle}
                      />
                    </label>
                  </div>

                  <button
                    type="button"
                    onClick={adicionarVoluntariado}
                    disabled={savingVinculo || !entrada.areaVoluntariadoId}
                    className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-bold transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                    style={{ backgroundColor: "rgba(10,31,63,0.9)", color: C.white }}
                  >
                    {savingVinculo ? (
                      <><Loader2 className="h-4 w-4 animate-spin" />Adicionando...</>
                    ) : (
                      <><Plus className="h-4 w-4" />Adicionar voluntariado</>
                    )}
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={concluir}
                disabled={vinculos.length === 0}
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-sm font-bold transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
                style={{ backgroundColor: C.gold, color: C.navy }}
              >
                <Check className="h-4 w-4" />
                Concluir cadastro
              </button>
              {vinculos.length === 0 && (
                <p className="text-center text-xs" style={{ color: "#9CA3AF" }}>
                  Adicione ao menos uma área para concluir.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
