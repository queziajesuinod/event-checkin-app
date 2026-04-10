import { UserMenu } from '@/components/UserMenu';
import { useAuth } from '@/contexts/AuthContext';
import { eventsAPI, type EventSummary } from '@/lib/api';
import { Calendar, ChevronRight, Download, Loader2, MapPin, Users, Wifi, WifiOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';

const EVENTS_CACHE_KEY = 'events:offline:list';
const MAX_OFFLINE_IMAGE_CHARS = 120000;

interface EventsOfflineCache {
  syncedAt: string;
  events: EventSummary[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const asText = (value: unknown) => (typeof value === 'string' ? value : undefined);
const isEventSummary = (value: unknown): value is EventSummary =>
  isRecord(value) && typeof value.id === 'string';
const ACTIVE_STATUSES = new Set([
  'active',
  'ativo',
  'open',
  'opened',
  'aberto',
  'ongoing',
  'running',
  'published',
  'publicado',
]);
const INACTIVE_STATUSES = new Set([
  'inactive',
  'inativo',
  'closed',
  'encerrado',
  'finished',
  'finalizado',
  'cancelled',
  'cancelado',
  'disabled',
  'desativado',
  'archived',
  'arquivado',
  'draft',
  'rascunho',
]);
const BOOLEANISH_TRUE = new Set(['1', 'true', 'yes', 'sim', 'y', 's']);
const BOOLEANISH_FALSE = new Set(['0', 'false', 'no', 'nao', 'n', 'off']);

const parseEventDate = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const normalizeStatusText = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const parseBooleanish = (value: unknown): boolean | null => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (value === 1) return true;
    if (value === 0) return false;
    return null;
  }
  if (typeof value !== 'string') return null;

  const normalized = normalizeStatusText(value);
  if (BOOLEANISH_TRUE.has(normalized)) return true;
  if (BOOLEANISH_FALSE.has(normalized)) return false;
  return null;
};

const resolveStatusActiveFlag = (status: unknown) => {
  const fromBooleanish = parseBooleanish(status);
  if (fromBooleanish !== null) return fromBooleanish;
  if (typeof status !== 'string') return null;

  const normalized = normalizeStatusText(status);
  if (ACTIVE_STATUSES.has(normalized)) return true;
  if (INACTIVE_STATUSES.has(normalized)) return false;
  return null;
};

const isEventActive = (event: EventSummary, now = new Date()) => {
  const eventData = event as EventSummary & Record<string, unknown>;
  const explicitCandidates: unknown[] = [
    event.isActive,
    event.active,
    event.ativo,
    eventData.is_active,
    eventData.enabled,
    eventData.isEnabled,
    eventData.is_enabled,
  ];

  for (const candidate of explicitCandidates) {
    const parsed = parseBooleanish(candidate);
    if (parsed !== null) {
      return parsed;
    }
  }

  const statusCandidates: unknown[] = [
    event.status,
    eventData.status,
    eventData.state,
    eventData.situacao,
  ];
  for (const statusCandidate of statusCandidates) {
    const statusFlag = resolveStatusActiveFlag(statusCandidate);
    if (statusFlag !== null) {
      return statusFlag;
    }
  }

  const endDate = parseEventDate(event.endDate);
  if (endDate) {
    return endDate.getTime() >= now.getTime();
  }

  const startDate = parseEventDate(event.startDate || event.date);
  if (startDate) {
    const endOfDay = new Date(startDate);
    endOfDay.setHours(23, 59, 59, 999);
    return endOfDay.getTime() >= now.getTime();
  }

  return true;
};

const filterActiveEvents = (events: EventSummary[]) => {
  const now = new Date();
  return events.filter((event) => isEventActive(event, now));
};

const normalizeEventsPayload = (payload: unknown) => {
  if (Array.isArray(payload)) {
    return payload.filter(isEventSummary);
  }

  if (isRecord(payload) && Array.isArray(payload.data)) {
    return payload.data.filter(isEventSummary);
  }

  if (isRecord(payload) && isRecord(payload.data) && Array.isArray(payload.data.items)) {
    return payload.data.items.filter(isEventSummary);
  }

  return [] as EventSummary[];
};

const sanitizeEventForOffline = (event: EventSummary): EventSummary => {
  const imageUrl = event.imageUrl || null;
  const keepImage =
    typeof imageUrl === 'string' &&
    (imageUrl.startsWith('http://') ||
      imageUrl.startsWith('https://') ||
      (imageUrl.startsWith('data:image/') && imageUrl.length <= MAX_OFFLINE_IMAGE_CHARS));

  return {
    id: event.id,
    title: event.title,
    name: event.name,
    description: event.description,
    imageUrl: keepImage ? imageUrl : null,
    location: event.location,
    startDate: event.startDate,
    endDate: event.endDate,
    date: event.date,
    isActive: event.isActive,
    active: event.active,
    ativo: event.ativo,
    status: event.status,
  };
};

const readEventsCache = () => {
  try {
    const raw = localStorage.getItem(EVENTS_CACHE_KEY);
    if (!raw) {
      return null as EventsOfflineCache | null;
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed) || !Array.isArray(parsed.events)) {
      return null;
    }

    return {
      syncedAt: asText(parsed.syncedAt) || '',
      events: parsed.events.filter(isEventSummary),
    };
  } catch {
    return null as EventsOfflineCache | null;
  }
};

export default function Events() {
  const { user } = useAuth();
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  const [error, setError] = useState('');
  const [offlineSyncedAt, setOfflineSyncedAt] = useState<string | null>(null);
  const [loadedFromCache, setLoadedFromCache] = useState(false);
  const [, setLocation] = useLocation();

  const persistEventsCache = (eventList: EventSummary[]) => {
    const basePayload: EventsOfflineCache = {
      syncedAt: new Date().toISOString(),
      events: eventList.map(sanitizeEventForOffline),
    };

    try {
      localStorage.setItem(EVENTS_CACHE_KEY, JSON.stringify(basePayload));
      setOfflineSyncedAt(basePayload.syncedAt);
    } catch {
      const noImagePayload: EventsOfflineCache = {
        syncedAt: new Date().toISOString(),
        events: basePayload.events.map((event) => ({
          ...event,
          imageUrl: null,
        })),
      };
      localStorage.setItem(EVENTS_CACHE_KEY, JSON.stringify(noImagePayload));
      setOfflineSyncedAt(noImagePayload.syncedAt);
    }
  };

  const loadEventsFromCache = () => {
    const cached = readEventsCache();
    if (!cached) {
      return false;
    }

    setEvents(filterActiveEvents(cached.events));
    setOfflineSyncedAt(cached.syncedAt || null);
    setLoadedFromCache(true);
    return true;
  };

  const syncEvents = async () => {
    setIsSyncing(true);
    setError('');

    try {
      const response = await eventsAPI.list();
      const data = filterActiveEvents(normalizeEventsPayload(response.data));
      setEvents(data);
      setLoadedFromCache(false);
      persistEventsCache(data);
    } catch (err) {
      const loadedCache = loadEventsFromCache();
      if (loadedCache) {
        setError('Sem conexao. Exibindo eventos sincronizados offline.');
      } else {
        setError(err instanceof Error ? err.message : 'Erro ao carregar eventos');
      }
    } finally {
      setIsSyncing(false);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const updateNetworkStatus = () => {
      setIsOnline(navigator.onLine);
    };

    updateNetworkStatus();
    window.addEventListener('online', updateNetworkStatus);
    window.addEventListener('offline', updateNetworkStatus);

    const hasCache = loadEventsFromCache();
    if (!hasCache) {
      setIsLoading(true);
    } else {
      setIsLoading(false);
    }

    void syncEvents();

    return () => {
      window.removeEventListener('online', updateNetworkStatus);
      window.removeEventListener('offline', updateNetworkStatus);
    };
  }, []);

  const resolveEventImageSrc = (imageUrl?: string | null) => {
    if (!imageUrl) return null;

    const value = imageUrl.trim();
    if (!value) return null;

    if (value.startsWith('data:image/')) {
      return value;
    }

    if (value.startsWith('http://') || value.startsWith('https://')) {
      return value;
    }

    const normalized = value.replace(/\s/g, '');
    if (normalized.startsWith('base64,')) {
      return `data:image/png;base64,${normalized.replace(/^base64,/, '')}`;
    }

    const mimeType = normalized.startsWith('/9j/')
      ? 'image/jpeg'
      : normalized.startsWith('R0lGOD')
      ? 'image/gif'
      : normalized.startsWith('UklGR')
      ? 'image/webp'
      : 'image/png';

    return `data:${mimeType};base64,${normalized}`;
  };

  const formatEventPeriod = (event: EventSummary) => {
    const startRaw = event.startDate || event.date;
    const endRaw = event.endDate;

    if (!startRaw) {
      return null;
    }

    const start = new Date(startRaw);
    if (Number.isNaN(start.getTime())) {
      return null;
    }

    if (endRaw) {
      const end = new Date(endRaw);
      if (!Number.isNaN(end.getTime())) {
        const sameDay = start.toDateString() === end.toDateString();
        if (sameDay) {
          return `${start.toLocaleDateString('pt-BR')} ${start.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} - ${end.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
        }
        return `${start.toLocaleDateString('pt-BR')} - ${end.toLocaleDateString('pt-BR')}`;
      }
    }

    return start.toLocaleDateString('pt-BR');
  };

  const [offlineExpanded, setOfflineExpanded] = useState(false);

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F0F2F5' }}>

      {/* ── Header ── */}
      <header className="sticky top-0 z-20" style={{ backgroundColor: '#0A1F3F', borderBottomLeftRadius: '20px', borderBottomRightRadius: '20px' }}>
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <img
            src="https://images.squarespace-cdn.com/content/v1/5bc9186e34c4e27773d92870/1546175613378-UHI78Z3KGSEOFFJEAP0B/logo-site.png"
            alt="IECG"
            className="h-7 w-auto"
            style={{ filter: 'brightness(0) invert(1)' }}
          />
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
            onClick={() => setOfflineExpanded(v => !v)}
            className="w-full flex items-center justify-between py-2 text-xs font-medium"
            style={{ color: isOnline ? '#1B4D8E' : '#92400E' }}
          >
            <span className="flex items-center gap-1.5">
              {isOnline
                ? <Wifi className="w-3.5 h-3.5" />
                : <WifiOff className="w-3.5 h-3.5" />}
              {isOnline ? 'Online' : 'Offline'}
              {loadedFromCache && (
                <span
                  className="ml-1 px-1.5 py-0.5 rounded-full text-white text-[10px] font-bold"
                  style={{ backgroundColor: '#D97706' }}
                >
                  cache
                </span>
              )}
            </span>
            <span style={{ color: '#9CA3AF' }}>{offlineExpanded ? '▲' : '▼'}</span>
          </button>

          {offlineExpanded && (
            <div className="pb-3 space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
              <p className="text-xs" style={{ color: '#6B7280' }}>
                {offlineSyncedAt
                  ? `Última sinc.: ${new Date(offlineSyncedAt).toLocaleString('pt-BR')}`
                  : 'Nenhum evento sincronizado para offline'}
              </p>
              <button
                type="button"
                onClick={syncEvents}
                disabled={!isOnline || isSyncing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all active:scale-95 disabled:opacity-50"
                style={{ backgroundColor: '#fff', border: '1px solid #BFDBFE', color: '#1B4D8E' }}
              >
                {isSyncing
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Sincronizando...</>
                  : <><Download className="w-3.5 h-3.5" />Sincronizar eventos offline</>}
              </button>
            </div>
          )}
        </div>
      </div>

      <main className="max-w-2xl mx-auto px-4 pt-5 pb-8">

        {/* ── Título ── */}
        <div className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-widest mb-0.5" style={{ color: '#C9A84C' }}>
            Disponíveis
          </p>
          <div className="flex items-end justify-between">
            <h2 className="text-2xl font-extrabold" style={{ color: '#0A1F3F' }}>Eventos</h2>
            {!isLoading && events.length > 0 && (
              <span className="text-xs font-medium mb-1" style={{ color: '#9CA3AF' }}>
                {events.length} evento{events.length > 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>

        {/* ── Erro ── */}
        {error && (
          <div
            className="mb-4 rounded-xl p-3 flex items-center gap-2 text-sm"
            style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626' }}
          >
            {error}
          </div>
        )}

        {/* ── Loading ── */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#1B4D8E' }} />
            <p className="text-sm" style={{ color: '#9CA3AF' }}>Carregando eventos...</p>
          </div>

        ) : events.length === 0 ? (
          <div
            className="text-center py-16 rounded-2xl"
            style={{ backgroundColor: '#fff', boxShadow: '0 2px 12px rgba(10,31,63,0.08)' }}
          >
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ backgroundColor: '#EBF2FB' }}
            >
              <Calendar className="w-8 h-8" style={{ color: '#4A90D9' }} />
            </div>
            <p className="font-semibold mb-1" style={{ color: '#0A1F3F' }}>Nenhum evento</p>
            <p className="text-sm" style={{ color: '#9CA3AF' }}>Não há eventos disponíveis no momento</p>
          </div>

        ) : (
          /* ── Lista de eventos ── */
          <div className="space-y-3">
            {events.map((event, i) => {
              const eventImageSrc = resolveEventImageSrc(event.imageUrl);
              const eventPeriod = formatEventPeriod(event);
              const title = event.title || event.name || 'Evento sem título';

              return (
                <button
                  key={event.id}
                  onClick={() => setLocation(`/checkin/${event.id}`)}
                  className="w-full text-left rounded-2xl overflow-hidden flex transition-all duration-200 active:scale-[0.98] animate-in fade-in slide-in-from-bottom-3 duration-400"
                  style={{
                    backgroundColor: '#fff',
                    boxShadow: '0 4px 16px rgba(10,31,63,0.09)',
                    animationDelay: `${i * 60}ms`,
                  }}
                >
                  {/* Imagem ou placeholder */}
                  <div
                    className="w-24 flex-shrink-0 flex items-center justify-center"
                    style={{ backgroundColor: '#EBF2FB', minHeight: '96px' }}
                  >
                    {eventImageSrc ? (
                      <img
                        src={eventImageSrc}
                        alt={title}
                        className="w-full h-full object-cover"
                        style={{ minHeight: '96px' }}
                      />
                    ) : (
                      <Calendar className="w-8 h-8" style={{ color: '#4A90D9' }} />
                    )}
                  </div>

                  {/* Conteúdo */}
                  <div className="flex-1 min-w-0 px-4 py-3 flex flex-col justify-between">
                    <div>
                      <h3 className="text-sm font-bold leading-snug line-clamp-2 mb-1.5" style={{ color: '#0A1F3F' }}>
                        {title}
                      </h3>
                      <div className="space-y-0.5">
                        {eventPeriod && (
                          <p className="flex items-center gap-1.5 text-xs" style={{ color: '#6B7280' }}>
                            <Calendar className="w-3 h-3 flex-shrink-0" style={{ color: '#1B4D8E' }} />
                            {eventPeriod}
                          </p>
                        )}
                        {event.location && (
                          <p className="flex items-center gap-1.5 text-xs" style={{ color: '#6B7280' }}>
                            <MapPin className="w-3 h-3 flex-shrink-0" style={{ color: '#1B4D8E' }} />
                            <span className="truncate">{event.location}</span>
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Rodapé do card */}
                    <div className="flex items-center justify-between mt-2.5">
                      <span
                        className="text-xs font-semibold flex items-center gap-1"
                        style={{ color: '#1B4D8E' }}
                      >
                        <Users className="w-3.5 h-3.5" />
                        Check-in
                      </span>
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: '#FBF5E6' }}
                      >
                        <ChevronRight className="w-3.5 h-3.5" style={{ color: '#C9A84C' }} />
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
