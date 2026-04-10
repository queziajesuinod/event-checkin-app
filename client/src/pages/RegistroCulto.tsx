import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { UserMenu } from '@/components/UserMenu';
import { cultosAPI, type Campus, type Ministerio, type TipoEvento, type Ministro, type RegistroCulto } from '@/lib/api';
import { BookOpen, CalendarDays, Check, ChevronDown, CloudOff, Download, Loader2, MapPin, MessageSquare, Minus, Plus, Users, Wifi, WifiOff, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLocation, useParams } from 'wouter';
import { toast } from 'sonner';
import { Command, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

const C = {
  navy: '#0A1F3F',
  blue: '#1B4D8E',
  sky: '#4A90D9',
  surface: '#F0F2F5',
  gold: '#C9A84C',
  white: '#FFFFFF',
};

// ── Seção card ────────────────────────────────────────────────────────────────
function Section({
  icon,
  title,
  step,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  step: number;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500"
      style={{ backgroundColor: C.white, boxShadow: '0 4px 20px rgba(10,31,63,0.08)' }}
    >
      {/* Cabeçalho da seção */}
      <div
        className="px-5 py-4 flex items-center gap-3"
        style={{ borderBottom: '1px solid #F0F2F5' }}
      >
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-white text-xs font-bold"
          style={{ backgroundColor: C.blue }}
        >
          {step}
        </div>
        <div className="flex items-center gap-2">
          <span style={{ color: C.sky }}>{icon}</span>
          <span className="font-semibold text-sm" style={{ color: C.navy }}>{title}</span>
        </div>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

// ── Field wrapper ─────────────────────────────────────────────────────────────
function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#6B7280' }}>
        {label}{required && <span className="ml-0.5" style={{ color: C.gold }}>*</span>}
      </label>
      {children}
    </div>
  );
}

// ── Counter input ─────────────────────────────────────────────────────────────
function Counter({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div
      className="flex flex-col gap-2 rounded-xl p-3"
      style={{ backgroundColor: C.surface }}
    >
      <span className="text-xs font-semibold uppercase tracking-wide text-center" style={{ color: '#6B7280' }}>
        {label}
      </span>
      <div className="flex items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => onChange(Math.max(0, value - 1))}
          className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-150 active:scale-90"
          style={{ backgroundColor: C.white, border: `1.5px solid #E5E7EB` }}
        >
          <Minus className="w-3.5 h-3.5" style={{ color: C.blue }} />
        </button>
        <input
          type="number"
          min={0}
          value={value}
          onChange={(e) => onChange(parseInt(e.target.value) || 0)}
          className="w-14 text-center text-lg font-bold border-0 bg-transparent outline-none"
          style={{ color: C.navy }}
        />
        <button
          type="button"
          onClick={() => onChange(value + 1)}
          className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-150 active:scale-90"
          style={{ backgroundColor: C.blue }}
        >
          <Plus className="w-3.5 h-3.5 text-white" />
        </button>
      </div>
    </div>
  );
}

// ── Toggle ────────────────────────────────────────────────────────────────────
function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm font-medium" style={{ color: C.navy }}>{label}</span>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className="relative w-11 h-6 rounded-full transition-all duration-200 flex-shrink-0"
        style={{ backgroundColor: value ? C.blue : '#D1D5DB' }}
      >
        <span
          className="absolute top-0.5 w-5 h-5 rounded-full transition-all duration-200"
          style={{
            backgroundColor: C.white,
            left: value ? '22px' : '2px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
          }}
        />
      </button>
    </div>
  );
}

// ── Offline queue ─────────────────────────────────────────────────────────────
const CULTOS_OFFLINE_QUEUE_KEY = 'cultos:offline:queue';

interface OfflineQueuedCulto {
  localId: string;
  payload: Record<string, unknown>;
  createdAt: string;
  campusNome: string;
  ministerioNome: string;
  tipoNome: string;
  ministrosNomes: string[];
}

const readCultosQueue = (): OfflineQueuedCulto[] => {
  try {
    const raw = localStorage.getItem(CULTOS_OFFLINE_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as OfflineQueuedCulto[]) : [];
  } catch {
    return [];
  }
};

const writeCultosQueue = (queue: OfflineQueuedCulto[]) => {
  localStorage.setItem(CULTOS_OFFLINE_QUEUE_KEY, JSON.stringify(queue));
};

const hoje = () => new Date().toISOString().slice(0, 10);

const FORM_INICIAL: Omit<RegistroCulto, 'id' | 'ministros' | 'campus'> = {
  data: hoje(),
  horario: '',
  campusId: '',
  ministerioId: '',
  tipoEventoId: '',
  tituloMensagem: '',
  eSerie: false,
  nomeSerie: '',
  qtdHomens: 0,
  qtdMulheres: 0,
  qtdCriancas: 0,
  qtdBebes: 0,
  qtdVoluntarios: 0,
  qtdOnline: 0,
  teveApelo: false,
  qtdApelo: 0,
  comentarios: '',
};

const RegistroCulto = () => {
  const [location, setLocation] = useLocation();
  const params = useParams();
  const isEditing = Boolean(params.id);

  const [form, setForm] = useState(FORM_INICIAL);
  const [campi, setCampi] = useState<Campus[]>([]);
  const [ministerios, setMinisterios] = useState<Ministerio[]>([]);
  const [tiposEvento, setTiposEvento] = useState<TipoEvento[]>([]);
  const [ministros, setMinistros] = useState<Ministro[]>([]);
  const [selectedMinistros, setSelectedMinistros] = useState<Ministro[]>([]);

  const [loadingInit, setLoadingInit] = useState(true);
  const [loading, setLoading] = useState(false);
  const [newMinistroName, setNewMinistroName] = useState('');
  const [openMinistros, setOpenMinistros] = useState(false);
  const [loadingMinistro, setLoadingMinistro] = useState(false);
  const [searchValue, setSearchValue] = useState('');

  interface SavedSnapshot {
    form: typeof FORM_INICIAL;
    ministros: Ministro[];
    campusNome: string;
    ministerioNome: string;
    tipoNome: string;
    savedOffline?: boolean;
  }
  const [savedSnapshot, setSavedSnapshot] = useState<SavedSnapshot | null>(null);

  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );
  const [offlineQueue, setOfflineQueue] = useState<OfflineQueuedCulto[]>([]);
  const [offlineExpanded, setOfflineExpanded] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        const [campiRes, tipos, ministrosRes] = await Promise.all([
          cultosAPI.listarCampi(),
          cultosAPI.listarTiposEvento(true),
          cultosAPI.listarMinistros(true),
        ]);
        setCampi(Array.isArray(campiRes.data) ? campiRes.data : []);
        setTiposEvento(tipos.data || []);
        setMinistros(ministrosRes.data || []);
      } catch {
        toast.error('Erro ao carregar dados iniciais');
      } finally {
        setLoadingInit(false);
      }
    };
    init();
  }, []);

  useEffect(() => {
    if (!isEditing) {
      setLoadingInit(false);
      return;
    }
    cultosAPI.buscarRegistro(params.id!)
      .then((response) => {
        const registro = response.data;
        setForm({
          data: registro.data || hoje(),
          horario: registro.horario || '',
          campusId: registro.campusId || '',
          ministerioId: registro.ministerioId || '',
          tipoEventoId: registro.tipoEventoId || '',
          tituloMensagem: registro.tituloMensagem || '',
          eSerie: registro.eSerie || false,
          nomeSerie: registro.nomeSerie || '',
          qtdHomens: registro.qtdHomens ?? 0,
          qtdMulheres: registro.qtdMulheres ?? 0,
          qtdCriancas: registro.qtdCriancas ?? 0,
          qtdBebes: registro.qtdBebes ?? 0,
          qtdVoluntarios: registro.qtdVoluntarios ?? 0,
          qtdOnline: registro.qtdOnline ?? 0,
          teveApelo: registro.teveApelo || false,
          qtdApelo: registro.qtdApelo ?? 0,
          comentarios: registro.comentarios || '',
        });
        if (registro.ministros) {
          setSelectedMinistros(registro.ministros);
        }
        if (registro.campusId) {
          cultosAPI.listarMinisteriosPorCampus(registro.campusId)
            .then((res) => setMinisterios(res.data || []));
        }
      })
      .catch(() => toast.error('Erro ao carregar registro'))
      .finally(() => setLoadingInit(false));
  }, [params.id]);

  useEffect(() => {
    const update = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    setOfflineQueue(readCultosQueue());
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  const syncOfflineQueue = async () => {
    if (!isOnline || isSyncing) return;
    const queue = readCultosQueue();
    if (queue.length === 0) return;
    setIsSyncing(true);
    let remaining = [...queue];
    let synced = 0;
    for (const item of queue) {
      try {
        await cultosAPI.criarRegistro(item.payload as Parameters<typeof cultosAPI.criarRegistro>[0]);
        remaining = remaining.filter((q) => q.localId !== item.localId);
        synced++;
      } catch {
        // mantém na fila
      }
    }
    writeCultosQueue(remaining);
    setOfflineQueue(remaining);
    setIsSyncing(false);
    if (synced > 0) toast.success(`${synced} culto${synced > 1 ? 's' : ''} sincronizado${synced > 1 ? 's' : ''}!`);
    if (remaining.length > 0) toast.error(`${remaining.length} culto${remaining.length > 1 ? 's' : ''} não pôde ser sincronizado.`);
  };

  const handleChange = (name: string, value: any) => {
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleCampusChange = async (campusId: string) => {
    setForm((prev) => ({ ...prev, campusId, ministerioId: '', qtdOnline: 0 }));
    if (!campusId) {
      setMinisterios([]);
      return;
    }
    try {
      const res = await cultosAPI.listarMinisteriosPorCampus(campusId);
      setMinisterios(res.data || []);
    } catch {
      toast.error('Erro ao carregar ministérios do campus');
      setMinisterios([]);
    }
  };

  const handleMinisterioChange = (ministerioId: string) => {
    const min = ministerios.find((m) => m.id === ministerioId);
    setForm((prev) => ({
      ...prev,
      ministerioId,
      teveApelo: min ? min.apeloDefault || false : false,
      qtdApelo: min && !min.apeloDefault ? 0 : prev.qtdApelo,
    }));
  };

  const handleMinistroToggle = (ministro: Ministro) => {
    setSelectedMinistros((prev) =>
      prev.some((m) => m.id === ministro.id)
        ? prev.filter((m) => m.id !== ministro.id)
        : [...prev, ministro]
    );
  };

  const handleMinistroSelect = async (value: string) => {
    if (value === 'create-new') {
      // Lidar com criação será feito no onSelect
      return;
    }

    const ministro = ministros.find((m) => m.id === value);
    if (ministro) {
      handleMinistroToggle(ministro);
    }
    setOpenMinistros(false);
  };

  const handleCreateMinistro = async (nome: string) => {
    if (!nome.trim()) return;

    setLoadingMinistro(true);
    try {
      const resp = await cultosAPI.criarMinistro({ nome: nome.trim(), ativo: true });
      const criado: Ministro = resp.data;
      setMinistros((prev) => [...prev, criado]);
      setSelectedMinistros((prev) => [...prev, criado]);
      toast.success('Ministro criado com sucesso!');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao criar ministro');
    } finally {
      setLoadingMinistro(false);
    }
  };

  const montarPayload = () => {
    const payload = { ...form };
    const min = ministerios.find((m) => m.id === form.ministerioId);
    if (min && !min.exibeCriancas) payload.qtdCriancas = null;
    if (min && !min.exibeBebes) payload.qtdBebes = null;
    const campus = campi.find((c) => c.id === form.campusId);
    if (!(campus?.transmiteOnline && min?.exibeOnline !== false)) payload.qtdOnline = null;
    if (!form.teveApelo) payload.qtdApelo = null;
    if (!form.eSerie) payload.nomeSerie = null;
    ['qtdHomens', 'qtdMulheres', 'qtdCriancas', 'qtdBebes', 'qtdVoluntarios', 'qtdOnline', 'qtdApelo']
      .forEach((k) => { if (payload[k] != null) payload[k] = parseInt(payload[k], 10) || 0; });
    payload.ministroIds = selectedMinistros.map((m) => m.id);
    return payload;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedMinistros.length === 0) {
      toast.error('Selecione ao menos um ministro');
      return;
    }
    setLoading(true);
    try {
      const payload = montarPayload();
      const snapshot = {
        form: { ...form },
        ministros: [...selectedMinistros],
        campusNome: campi.find((c) => c.id === form.campusId)?.nome ?? '',
        ministerioNome: ministerios.find((m) => m.id === form.ministerioId)?.nome ?? '',
        tipoNome: tiposEvento.find((t) => t.id === form.tipoEventoId)?.nome ?? '',
      };

      if (!isOnline && !isEditing) {
        const item: OfflineQueuedCulto = {
          localId: `local-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          payload: payload as Record<string, unknown>,
          createdAt: new Date().toISOString(),
          campusNome: snapshot.campusNome,
          ministerioNome: snapshot.ministerioNome,
          tipoNome: snapshot.tipoNome,
          ministrosNomes: selectedMinistros.map((m) => m.nome),
        };
        const newQueue = [...offlineQueue, item];
        writeCultosQueue(newQueue);
        setOfflineQueue(newQueue);
        setSavedSnapshot({ ...snapshot, savedOffline: true });
      } else if (isEditing) {
        await cultosAPI.atualizarRegistro(params.id!, payload);
        toast.success('Registro atualizado com sucesso!');
      } else {
        await cultosAPI.criarRegistro(payload);
        setSavedSnapshot({ ...snapshot, savedOffline: false });
      }
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar');
    } finally {
      setLoading(false);
    }
  };

  const handleNovoRegistro = () => {
    setSavedSnapshot(null);
    setForm(FORM_INICIAL);
    setSelectedMinistros([]);
  };

  if (loadingInit) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (savedSnapshot) {
    const s = savedSnapshot;
    const totalPresenca =
      s.form.qtdHomens + s.form.qtdMulheres + (s.form.qtdCriancas ?? 0) + (s.form.qtdBebes ?? 0);

    const rows: { label: string; value: string }[] = [
      { label: 'Data', value: new Date(s.form.data + 'T00:00:00').toLocaleDateString('pt-BR') },
      { label: 'Horário', value: s.form.horario },
      { label: 'Campus', value: s.campusNome },
      { label: 'Ministério', value: s.ministerioNome },
      { label: 'Tipo de Evento', value: s.tipoNome },
      { label: 'Título da Mensagem', value: s.form.tituloMensagem },
      ...(s.form.eSerie ? [{ label: 'Série', value: s.form.nomeSerie ?? '' }] : []),
      { label: 'Quem ministrou', value: s.ministros.map((m) => m.nome).join(', ') },
      { label: 'Homens', value: String(s.form.qtdHomens) },
      { label: 'Mulheres', value: String(s.form.qtdMulheres) },
      ...(s.form.qtdCriancas ? [{ label: 'Crianças', value: String(s.form.qtdCriancas) }] : []),
      ...(s.form.qtdBebes ? [{ label: 'Bebês', value: String(s.form.qtdBebes) }] : []),
      { label: 'Total de Presença', value: String(totalPresenca) },
      { label: 'Voluntários', value: String(s.form.qtdVoluntarios) },
      ...(s.form.qtdOnline ? [{ label: 'Online', value: String(s.form.qtdOnline) }] : []),
      ...(s.form.teveApelo ? [{ label: 'Apelo', value: String(s.form.qtdApelo ?? 0) + ' pessoa(s)' }] : []),
      ...(s.form.comentarios ? [{ label: 'Comentários', value: s.form.comentarios }] : []),
    ];

    return (
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: C.surface }}>
        <header style={{ backgroundColor: C.navy, borderBottomLeftRadius: '20px', borderBottomRightRadius: '20px' }}>
          <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
            <div>
              <img
                src="https://images.squarespace-cdn.com/content/v1/5bc9186e34c4e27773d92870/1546175613378-UHI78Z3KGSEOFFJEAP0B/logo-site.png"
                alt="IECG"
                className="h-7 w-auto"
                style={{ filter: 'brightness(0) invert(1)' }}
              />
              <p className="text-xs" style={{ color: C.sky }}>Registro de Cultos</p>
            </div>
            <UserMenu showBackButton backTo="/home" backLabel="← Início" />
          </div>
        </header>

        <div className="flex-1 w-full max-w-2xl mx-auto px-4 pt-8 pb-10">
          {/* Ícone de sucesso */}
          <div className="flex flex-col items-center mb-8 animate-in fade-in zoom-in-50 duration-500">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center mb-4"
              style={{ backgroundColor: s.savedOffline ? '#FEF3C7' : '#DCFCE7' }}
            >
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center"
                style={{ backgroundColor: s.savedOffline ? '#D97706' : '#16A34A' }}
              >
                {s.savedOffline
                  ? <CloudOff className="w-8 h-8 text-white" />
                  : <Check className="w-8 h-8 text-white" strokeWidth={3} />}
              </div>
            </div>
            <h2 className="text-2xl font-extrabold mb-1" style={{ color: C.navy }}>
              {s.savedOffline ? 'Salvo offline!' : 'Culto registrado!'}
            </h2>
            <p className="text-sm text-center" style={{ color: '#6B7280' }}>
              {s.savedOffline
                ? 'Registro salvo na fila. Sincronize quando tiver conexão.'
                : 'Os dados foram salvos com sucesso.'}
            </p>
          </div>

          {/* Resumo dos dados */}
          <div
            className="rounded-2xl overflow-hidden mb-6 animate-in fade-in slide-in-from-bottom-4 duration-500"
            style={{ backgroundColor: C.white, boxShadow: '0 4px 20px rgba(10,31,63,0.08)' }}
          >
            <div className="px-5 py-3" style={{ backgroundColor: C.navy }}>
              <span className="text-sm font-semibold text-white">Resumo do Registro</span>
            </div>
            <div className="divide-y" style={{ borderColor: C.surface }}>
              {rows.map((row) => (
                <div key={row.label} className="flex items-start justify-between px-5 py-3 gap-4">
                  <span className="text-xs font-semibold uppercase tracking-wide flex-shrink-0" style={{ color: '#9CA3AF' }}>
                    {row.label}
                  </span>
                  <span className="text-sm font-medium text-right uppercase" style={{ color: C.navy }}>
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Botão sincronizar — só aparece quando salvo offline e há conexão */}
          {s.savedOffline && isOnline && (
            <button
              onClick={syncOfflineQueue}
              disabled={isSyncing}
              className="w-full h-12 rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-2 mb-3 transition-all duration-200 active:scale-[0.98] disabled:opacity-60"
              style={{ backgroundColor: '#D97706' }}
            >
              {isSyncing
                ? <><Loader2 className="w-4 h-4 animate-spin" />Sincronizando...</>
                : <><Download className="w-4 h-4" />Sincronizar agora</>}
            </button>
          )}

          {/* Botões */}
          <div className="flex gap-3">
            <button
              onClick={() => setLocation('/home')}
              className="flex-1 h-12 rounded-xl text-sm font-semibold transition-all duration-200 active:scale-[0.98]"
              style={{ backgroundColor: C.surface, color: C.blue, border: `1.5px solid ${C.blue}` }}
            >
              Ir para Início
            </button>
            <button
              onClick={handleNovoRegistro}
              className="flex-[2] h-12 rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.98]"
              style={{ backgroundColor: C.blue }}
            >
              <Plus className="w-4 h-4" />
              Novo Registro
            </button>
          </div>
        </div>
      </div>
    );
  }

  const min = ministerios.find((m) => m.id === form.ministerioId);
  const exibeCriancas = min ? min.exibeCriancas !== false : true;
  const exibeBebes = min ? min.exibeBebes !== false : true;
  const campus = campi.find((c) => c.id === form.campusId);
  const exibeOnline = campus?.transmiteOnline && min?.exibeOnline !== false;

  return (
    <div className="min-h-screen pb-28" style={{ backgroundColor: C.surface }}>
      {/* Header */}
      <header style={{ backgroundColor: C.navy, borderBottomLeftRadius: '20px', borderBottomRightRadius: '20px' }}>
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <img
                src="https://images.squarespace-cdn.com/content/v1/5bc9186e34c4e27773d92870/1546175613378-UHI78Z3KGSEOFFJEAP0B/logo-site.png"
                alt="IECG"
                className="h-7 w-auto"
                style={{ filter: 'brightness(0) invert(1)' }}
              />
            <p className="text-xs" style={{ color: C.sky }}>Registro de Cultos</p>
          </div>
          <UserMenu showBackButton backTo="/home" backLabel="← Início" />
        </div>
      </header>

      {/* ── Barra offline colapsável ── */}
      <div style={{
        backgroundColor: isOnline ? '#EBF2FB' : '#FEF3C7',
        borderBottom: `1px solid ${isOnline ? '#BFDBFE' : '#FDE68A'}`,
      }}>
        <div className="max-w-2xl mx-auto px-4">
          <button
            type="button"
            onClick={() => setOfflineExpanded((v) => !v)}
            className="w-full flex items-center justify-between py-2 text-xs font-medium"
            style={{ color: isOnline ? '#1B4D8E' : '#92400E' }}
          >
            <span className="flex items-center gap-1.5">
              {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
              {isOnline ? 'Online' : 'Offline'}
              {offlineQueue.length > 0 && (
                <span
                  className="ml-1 px-1.5 py-0.5 rounded-full text-white text-[10px] font-bold"
                  style={{ backgroundColor: '#D97706' }}
                >
                  {offlineQueue.length} pendente{offlineQueue.length > 1 ? 's' : ''}
                </span>
              )}
            </span>
            <span style={{ color: '#9CA3AF' }}>{offlineExpanded ? '▲' : '▼'}</span>
          </button>

          {offlineExpanded && (
            <div className="pb-3 space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
              {offlineQueue.length === 0 ? (
                <p className="text-xs" style={{ color: '#6B7280' }}>Nenhum culto na fila offline.</p>
              ) : (
                <div className="space-y-1.5">
                  {offlineQueue.map((item) => (
                    <div
                      key={item.localId}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
                      style={{ backgroundColor: '#FFF7ED', border: '1px solid #FDE68A' }}
                    >
                      <CloudOff className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#D97706' }} />
                      <span style={{ color: '#92400E' }}>
                        {item.campusNome || 'Campus'} · {item.ministerioNome || 'Ministério'} ·{' '}
                        {new Date(item.createdAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <button
                type="button"
                onClick={syncOfflineQueue}
                disabled={!isOnline || isSyncing || offlineQueue.length === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all active:scale-95 disabled:opacity-50"
                style={{ backgroundColor: '#fff', border: '1px solid #BFDBFE', color: '#1B4D8E' }}
              >
                {isSyncing
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Sincronizando...</>
                  : <><Download className="w-3.5 h-3.5" />Sincronizar agora</>}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="w-full max-w-2xl mx-auto px-4 pt-6">
        {/* Título da página */}
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: C.gold }}>
            {isEditing ? 'Editando registro' : 'Novo registro'}
          </p>
          <h1 className="text-2xl font-extrabold" style={{ color: C.navy }}>
            {isEditing ? 'Editar Culto' : 'Registrar Culto'}
          </h1>
        </div>

        <form id="form-culto" onSubmit={handleSubmit} className="space-y-4">

          {/* ── Seção 1: Data & Local ── */}
          <Section step={1} icon={<CalendarDays className="w-4 h-4" />} title="Data & Local">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Data" required>
                <Input
                  type="date"
                  value={form.data}
                  onChange={(e) => handleChange('data', e.target.value)}
                  required
                  className="h-11 rounded-xl"
                />
              </Field>
              <Field label="Horário" required>
                <Input
                  type="time"
                  value={form.horario}
                  onChange={(e) => handleChange('horario', e.target.value)}
                  required
                  className="h-11 rounded-xl"
                />
              </Field>
            </div>
            <div className="mt-4">
              <Field label="Campus" required>
                <Select value={form.campusId} onValueChange={handleCampusChange}>
                  <SelectTrigger className="h-11 rounded-xl">
                    <SelectValue placeholder="Selecione o campus" />
                  </SelectTrigger>
                  <SelectContent>
                    {campi.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </Section>

          {/* ── Seção 2: Ministério ── */}
          <Section step={2} icon={<MapPin className="w-4 h-4" />} title="Ministério & Tipo">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Ministério" required>
                <Select
                  value={form.ministerioId}
                  onValueChange={handleMinisterioChange}
                  disabled={!form.campusId}
                >
                  <SelectTrigger className="h-11 rounded-xl w-full min-w-0">
                    <SelectValue placeholder={form.campusId ? 'Selecione' : '—'} className="truncate" />
                  </SelectTrigger>
                  <SelectContent>
                    {ministerios.map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Tipo de Evento" required>
                <Select value={form.tipoEventoId} onValueChange={(v) => handleChange('tipoEventoId', v)}>
                  <SelectTrigger className="h-11 rounded-xl w-full min-w-0">
                    <SelectValue placeholder="Selecione" className="truncate" />
                  </SelectTrigger>
                  <SelectContent>
                    {tiposEvento.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            {!form.campusId && (
              <p className="text-xs mt-2" style={{ color: '#9CA3AF' }}>
                Selecione o campus primeiro para habilitar o ministério.
              </p>
            )}
          </Section>

          {/* ── Seção 3: Mensagem ── */}
          <Section step={3} icon={<BookOpen className="w-4 h-4" />} title="Mensagem">
            <div className="space-y-4">
              <Field label="Título da Mensagem" required>
                <Input
                  value={form.tituloMensagem}
                  onChange={(e) => handleChange('tituloMensagem', e.target.value.toUpperCase())}
                  required
                  placeholder="EX: A GRAÇA DE DEUS"
                  className="h-11 rounded-xl uppercase"
                />
              </Field>
              <div
                className="flex items-center justify-between rounded-xl px-4 py-3"
                style={{ backgroundColor: C.surface }}
              >
                <Toggle
                  label="É uma série?"
                  value={form.eSerie}
                  onChange={(v) => handleChange('eSerie', v)}
                />
              </div>
              {form.eSerie && (
                <Field label="Nome da Série" required>
                  <Input
                    value={form.nomeSerie ?? ''}
                    onChange={(e) => handleChange('nomeSerie', e.target.value.toUpperCase())}
                    required
                    placeholder="EX: FUNDAMENTOS DA FÉ"
                    className="h-11 rounded-xl uppercase"
                  />
                </Field>
              )}
            </div>
          </Section>

          {/* ── Seção 4: Ministros ── */}
          <Section step={4} icon={<Users className="w-4 h-4" />} title="Quem Ministrou">
            <Field label="Ministros" required>
              <Popover open={openMinistros} onOpenChange={setOpenMinistros}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    role="combobox"
                    className="w-full h-11 rounded-xl px-4 flex items-center justify-between text-sm transition-all duration-150"
                    style={{
                      backgroundColor: C.white,
                      border: `1.5px solid #E5E7EB`,
                      color: selectedMinistros.length ? C.navy : '#9CA3AF',
                    }}
                  >
                    {selectedMinistros.length > 0
                      ? `${selectedMinistros.length} ministro${selectedMinistros.length > 1 ? 's' : ''} selecionado${selectedMinistros.length > 1 ? 's' : ''}`
                      : 'Selecione os ministros...'}
                    <ChevronDown className="w-4 h-4 ml-2 flex-shrink-0" style={{ color: '#9CA3AF' }} />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-0">
                  <Command shouldFilter={false}>
                    <CommandInput
                      placeholder="BUSCAR MINISTRO..."
                      value={searchValue}
                      onValueChange={(v) => setSearchValue(v.toUpperCase())}
                      className="uppercase"
                    />
                    <CommandList>
                      {/* Resultados filtrados */}
                      {ministros
                        .filter(
                          (m) =>
                            m.nome.toLowerCase().includes(searchValue.toLowerCase()) &&
                            !selectedMinistros.some((s) => s.id === m.id),
                        )
                        .map((m) => (
                          <CommandItem
                            key={m.id}
                            value={m.id}
                            onSelect={() => handleMinistroSelect(m.id)}
                          >
                            {m.nome}
                          </CommandItem>
                        ))}

                      {/* Sem resultados */}
                      {ministros.filter(
                        (m) =>
                          m.nome.toLowerCase().includes(searchValue.toLowerCase()) &&
                          !selectedMinistros.some((s) => s.id === m.id),
                      ).length === 0 && !searchValue.trim() && (
                        <p className="py-6 text-center text-sm" style={{ color: '#9CA3AF' }}>
                          Digite para buscar um ministro.
                        </p>
                      )}

                      {/* Opção de adicionar — aparece sempre que há texto sem match exato */}
                      {searchValue.trim() &&
                        !ministros.some(
                          (m) => m.nome.toLowerCase() === searchValue.trim().toLowerCase(),
                        ) && (
                          <CommandItem
                            value="__add__"
                            onSelect={() => {
                              handleCreateMinistro(searchValue.trim());
                              setSearchValue('');
                            }}
                            className="border-t mt-1"
                          >
                            <div
                              className="flex items-center gap-2 w-full py-0.5"
                              style={{ color: C.blue }}
                            >
                              <div
                                className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                                style={{ backgroundColor: '#EBF2FB' }}
                              >
                                <Plus className="w-3 h-3" style={{ color: C.blue }} />
                              </div>
                              <span className="text-sm font-medium">
                                Adicionar "{searchValue.trim()}"
                              </span>
                              {loadingMinistro && (
                                <Loader2 className="w-3 h-3 animate-spin ml-auto" />
                              )}
                            </div>
                          </CommandItem>
                        )}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </Field>

            {selectedMinistros.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {selectedMinistros.map((m) => (
                  <span
                    key={m.id}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium"
                    style={{ backgroundColor: '#EBF2FB', color: C.blue }}
                  >
                    {m.nome}
                    <button
                      type="button"
                      onClick={() => handleMinistroToggle(m)}
                      className="w-4 h-4 rounded-full flex items-center justify-center transition-colors"
                      style={{ backgroundColor: C.blue, color: C.white }}
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </Section>

          {/* ── Seção 5: Presença ── */}
          <Section step={5} icon={<Users className="w-4 h-4" />} title="Presença">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Counter label="Homens" value={form.qtdHomens} onChange={(v) => handleChange('qtdHomens', v)} />
              <Counter label="Mulheres" value={form.qtdMulheres} onChange={(v) => handleChange('qtdMulheres', v)} />
              <Counter label="Voluntários" value={form.qtdVoluntarios} onChange={(v) => handleChange('qtdVoluntarios', v)} />
              {exibeCriancas && (
                <Counter label="Crianças" value={form.qtdCriancas ?? 0} onChange={(v) => handleChange('qtdCriancas', v)} />
              )}
              {exibeBebes && (
                <Counter label="Bebês" value={form.qtdBebes ?? 0} onChange={(v) => handleChange('qtdBebes', v)} />
              )}
              {exibeOnline && (
                <Counter label="Online" value={form.qtdOnline ?? 0} onChange={(v) => handleChange('qtdOnline', v)} />
              )}
            </div>
          </Section>

          {/* ── Seção 6: Apelo ── */}
          <Section step={6} icon={<MessageSquare className="w-4 h-4" />} title="Apelo">
            <div
              className="flex items-center justify-between rounded-xl px-4 py-3"
              style={{ backgroundColor: C.surface }}
            >
              <Toggle
                label="Teve apelo?"
                value={form.teveApelo}
                onChange={(v) => handleChange('teveApelo', v)}
              />
            </div>
            {form.teveApelo && (
              <div className="mt-4 flex justify-center">
                <div className="w-48">
                  <Counter
                    label="Pessoas no apelo"
                    value={form.qtdApelo ?? 0}
                    onChange={(v) => handleChange('qtdApelo', v)}
                  />
                </div>
              </div>
            )}
          </Section>

          {/* ── Seção 7: Comentários ── */}
          <Section step={7} icon={<MessageSquare className="w-4 h-4" />} title="Comentários">
            <Field label="Observações adicionais">
              <Textarea
                value={form.comentarios}
                onChange={(e) => handleChange('comentarios', e.target.value.toUpperCase())}
                placeholder="ALGUMA OBSERVAÇÃO SOBRE O CULTO..."
                rows={3}
                className="rounded-xl resize-none uppercase"
              />
            </Field>
          </Section>

        </form>
      </div>

      {/* ── Barra de ação flutuante ── */}
      <div
        className="fixed bottom-0 left-0 right-0 px-4 py-4 flex gap-3"
        style={{
          backgroundColor: C.white,
          boxShadow: '0 -4px 20px rgba(10,31,63,0.10)',
        }}
      >
        <button
          type="button"
          onClick={() => setLocation('/cultos')}
          className="flex-1 h-12 rounded-xl text-sm font-semibold transition-all duration-200 active:scale-[0.98]"
          style={{ backgroundColor: C.surface, color: C.blue, border: `1.5px solid ${C.blue}` }}
        >
          Cancelar
        </button>
        <button
          type="submit"
          form="form-culto"
          disabled={loading}
          className="flex-[2] h-12 rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.98]"
          style={{ backgroundColor: loading ? '#6B7280' : C.blue }}
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {isEditing ? 'Salvar alterações' : 'Registrar culto'}
        </button>
      </div>
    </div>
  );
};

export default RegistroCulto;