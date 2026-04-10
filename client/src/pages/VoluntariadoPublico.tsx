import { type AreaVoluntariado, type VoluntariadoPublicPayload, voluntariadoPublicAPI } from "@/lib/api";
import axios from "axios";
import { AlertCircle, ArrowLeft, Loader2, Send } from "lucide-react";
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
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatCpf(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
}

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
}

function getErrorMessage(error: unknown): string {
  if (!axios.isAxiosError(error)) {
    return "Nao foi possivel concluir o cadastro. Tente novamente.";
  }

  const responseData = error.response?.data;
  if (typeof responseData === "string" && responseData.trim()) {
    return responseData;
  }

  if (responseData && typeof responseData === "object") {
    const maybeData = responseData as { message?: unknown; error?: unknown };
    if (typeof maybeData.message === "string" && maybeData.message.trim()) {
      return maybeData.message;
    }
    if (typeof maybeData.error === "string" && maybeData.error.trim()) {
      return maybeData.error;
    }
  }

  return "Nao foi possivel concluir o cadastro. Verifique os dados e tente novamente.";
}

const INITIAL_FORM: VoluntariadoPublicPayload = {
  fullName: "",
  email: "",
  cpf: "",
  phone: "",
  birthDate: "",
  areaVoluntariadoIds: [],
  dataInicio: getTodayDate(),
};

export default function VoluntariadoPublico() {
  const [, setLocation] = useLocation();
  const [formData, setFormData] = useState<VoluntariadoPublicPayload>(INITIAL_FORM);
  const [areas, setAreas] = useState<AreaVoluntariado[]>([]);
  const [isLoadingAreas, setIsLoadingAreas] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    let mounted = true;

    const loadAreas = async () => {
      setIsLoadingAreas(true);
      setError("");
      try {
        const response = await voluntariadoPublicAPI.listarAreas();
        const parsedAreas = Array.isArray(response.data)
          ? response.data.filter((item): item is AreaVoluntariado => {
              return Boolean(item && typeof item.id === "string" && typeof item.nome === "string");
            })
          : [];

        if (!mounted) return;

        setAreas(parsedAreas);
      } catch (loadError) {
        if (!mounted) return;
        setError(getErrorMessage(loadError));
      } finally {
        if (mounted) {
          setIsLoadingAreas(false);
        }
      }
    };

    void loadAreas();

    return () => {
      mounted = false;
    };
  }, []);

  const updateField = <K extends keyof VoluntariadoPublicPayload>(
    field: K,
    value: VoluntariadoPublicPayload[K],
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleAreaToggle = (areaId: string) => {
    setFormData((prev) => {
      const alreadySelected = prev.areaVoluntariadoIds.includes(areaId);
      return {
        ...prev,
        areaVoluntariadoIds: alreadySelected
          ? prev.areaVoluntariadoIds.filter((id) => id !== areaId)
          : [...prev.areaVoluntariadoIds, areaId],
      };
    });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (formData.areaVoluntariadoIds.length === 0) {
      setError("Selecione pelo menos uma area de voluntariado.");
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
        areaVoluntariadoIds: formData.areaVoluntariadoIds,
        dataInicio: formData.dataInicio,
      };

      await voluntariadoPublicAPI.cadastrar(payload);

      toast.success("Cadastro realizado com sucesso. Redirecionando para o login...");
      window.setTimeout(() => {
        setLocation("/login");
      }, 1600);
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    } finally {
      setIsSubmitting(false);
    }
  };

  const disableSubmit = isSubmitting || isLoadingAreas || areas.length === 0;

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
          style={{ backgroundColor: C.white, boxShadow: "0 16px 40px rgba(0, 0, 0, 0.20)" }}
        >
          <div className="mb-6 border-b pb-4" style={{ borderColor: "#E5E7EB" }}>
            <h1 className="text-2xl font-extrabold" style={{ color: C.navy }}>
              Cadastro de Voluntarios
            </h1>
            <p className="mt-1 text-sm" style={{ color: "#6B7280" }}>
              Preencha o formulario para iniciar seu cadastro de voluntariado.
            </p>
          </div>

          {error && (
            <div
              className="mb-5 flex items-start gap-2 rounded-2xl px-4 py-3 text-sm"
              style={{ backgroundColor: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.25)" }}
            >
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" style={{ color: "#DC2626" }} />
              <p style={{ color: "#7F1D1D" }}>{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-semibold" style={{ color: C.navy }}>
                Nome completo
                <input
                  type="text"
                  value={formData.fullName}
                  onChange={(event) => updateField("fullName", event.target.value)}
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
                  onChange={(event) => updateField("email", event.target.value)}
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
                  onChange={(event) => updateField("cpf", formatCpf(event.target.value))}
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
                  onChange={(event) => updateField("phone", formatPhone(event.target.value))}
                  required
                  disabled={isSubmitting}
                  maxLength={15}
                  className="mt-1 h-11 w-full rounded-xl border px-3 text-sm outline-none focus:ring-2"
                  style={{ borderColor: "#D1D5DB", color: C.navy }}
                />
              </label>

              <label className="text-sm font-semibold" style={{ color: C.navy }}>
                Data de nascimento
                <input
                  type="date"
                  value={formData.birthDate}
                  onChange={(event) => updateField("birthDate", event.target.value)}
                  required
                  disabled={isSubmitting}
                  className="mt-1 h-11 w-full rounded-xl border px-3 text-sm outline-none focus:ring-2"
                  style={{ borderColor: "#D1D5DB", color: C.navy }}
                />
              </label>

              <fieldset className="text-sm font-semibold sm:col-span-2" style={{ color: C.navy }}>
                <legend className="mb-2">Areas de voluntariado</legend>
                <div
                  className="rounded-xl border p-3"
                  style={{ borderColor: "#D1D5DB", backgroundColor: "#FAFAFA" }}
                >
                  {isLoadingAreas && (
                    <p className="text-sm font-normal" style={{ color: "#6B7280" }}>
                      Carregando areas...
                    </p>
                  )}

                  {!isLoadingAreas && areas.length === 0 && (
                    <p className="text-sm font-normal" style={{ color: "#6B7280" }}>
                      Nenhuma area disponivel
                    </p>
                  )}

                  {!isLoadingAreas && areas.length > 0 && (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {areas.map((area) => {
                        const checked = formData.areaVoluntariadoIds.includes(area.id);
                        return (
                          <label
                            key={area.id}
                            className="flex items-center gap-2 rounded-lg border px-3 py-2 font-medium"
                            style={{
                              borderColor: checked ? C.gold : "#E5E7EB",
                              backgroundColor: checked ? "#FBF5E6" : C.white,
                              color: C.navy,
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => handleAreaToggle(area.id)}
                              disabled={isSubmitting || isLoadingAreas}
                              className="h-4 w-4"
                            />
                            <span className="text-sm">{area.nome}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              </fieldset>

              <label className="text-sm font-semibold" style={{ color: C.navy }}>
                Data de inicio
                <input
                  type="date"
                  value={formData.dataInicio}
                  onChange={(event) => updateField("dataInicio", event.target.value)}
                  required
                  disabled={isSubmitting}
                  className="mt-1 h-11 w-full rounded-xl border px-3 text-sm outline-none focus:ring-2"
                  style={{ borderColor: "#D1D5DB", color: C.navy }}
                />
              </label>
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
              Ao concluir, voce sera notificado e redirecionado para o login.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
