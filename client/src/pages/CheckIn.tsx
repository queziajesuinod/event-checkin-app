import { Input } from '@/components/ui/input';
import { UserMenu } from '@/components/UserMenu';
import api, { checkInAPI, eventsAPI } from '@/lib/api';
import axios from 'axios';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle,
  Download,
  Loader2,
  MapPin,
  QrCode,
  Smartphone,
  Trash2,
  Type,
  Upload,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useLocation, useRoute } from 'wouter';

type CheckInMethod = 'qrcode' | 'nfc' | 'manual' | null;
type OnlineCheckInMethod = Exclude<CheckInMethod, null>;
const OFFLINE_QUEUE_KEY = 'checkin:offline:queue';
const getOfflineEventCacheKey = (eventId: string) => `checkin:offline:event:${eventId}`;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const asText = (value: unknown) => (typeof value === 'string' ? value : undefined);
const asMethod = (value: unknown): OnlineCheckInMethod | undefined =>
  value === 'qrcode' || value === 'nfc' || value === 'manual' ? value : undefined;

const asNumber = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

interface CheckInResult {
  success: boolean;
  message: string;
  attendee?: {
    name: string;
    email: string;
  };
}

interface CheckInKpis {
  done: number;
  pending: number;
}

interface OfflineQueuedCheckIn {
  localId: string;
  eventId: string;
  registrationId: string;
  method?: OnlineCheckInMethod;
  attendeeId?: string;
  stationId?: string;
  notes?: string;
  createdAt: string;
}

interface OfflineSyncedRecord {
  registrationKey: string;
  attendeeName?: string;
}

interface OfflineEventCache {
  eventId: string;
  eventTitle?: string;
  eventLocation?: string;
  stats?: CheckInKpis;
  syncedRecords: OfflineSyncedRecord[];
  syncedAt: string;
}

const readOfflineQueue = () => {
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    if (!raw) return [] as OfflineQueuedCheckIn[];

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [] as OfflineQueuedCheckIn[];

    return parsed.filter(isRecord).map((item) => ({
      localId: asText(item.localId) || '',
      eventId: asText(item.eventId) || '',
      registrationId: asText(item.registrationId) || '',
      method: asMethod(item.method),
      attendeeId: asText(item.attendeeId),
      stationId: asText(item.stationId),
      notes: asText(item.notes),
      createdAt: asText(item.createdAt) || new Date().toISOString(),
    }));
  } catch {
    return [] as OfflineQueuedCheckIn[];
  }
};

const writeOfflineQueue = (queue: OfflineQueuedCheckIn[]) => {
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
};

const extractEventMeta = (payload: unknown) => {
  if (!isRecord(payload)) {
    return { title: undefined, location: undefined };
  }

  const source = isRecord(payload.data) ? payload.data : payload;
  const title = asText(source.title) || asText(source.name);
  const location = asText(source.location) || asText(source.local);
  return { title, location };
};

const normalizeKpis = (payload: unknown): CheckInKpis => {
  const root = isRecord(payload) ? payload : undefined;
  const data = root && isRecord(root.data) ? root.data : root;

  const done =
    asNumber(data?.done) ||
    asNumber(data?.completed) ||
    asNumber(data?.checkedIn) ||
    asNumber(data?.checkedInCount) ||
    asNumber(data?.totalCheckIns) ||
    asNumber(data?.totalCheckedIn) ||
    asNumber(data?.feitos);

  const pendingFromPayload =
    asNumber(data?.pending) ||
    asNumber(data?.pendingCount) ||
    asNumber(data?.totalPending) ||
    asNumber(data?.pendentes);

  const total =
    asNumber(data?.total) ||
    asNumber(data?.totalCount) ||
    asNumber(data?.totalRegistrations) ||
    asNumber(data?.totalInscricoes) ||
    asNumber(data?.totalInscritos);

  const pending = pendingFromPayload || Math.max(total - done, 0);
  return { done, pending };
};

const extractRegistrationKey = (record: Record<string, unknown>) => {
  const direct =
    asText(record.registrationId) ||
    asText(record.inscricaoId) ||
    asText(record.orderCode) ||
    asText(record.code) ||
    asText(record.ticketCode);

  if (direct) {
    return direct.trim();
  }

  if (isRecord(record.registration)) {
    const nested = asText(record.registration.id) || asText(record.registration.code);
    return nested ? nested.trim() : '';
  }

  return '';
};

const extractListRecords = (payload: unknown) => {
  if (Array.isArray(payload)) {
    return payload.filter(isRecord);
  }

  if (!isRecord(payload)) {
    return [] as Record<string, unknown>[];
  }

  if (Array.isArray(payload.data)) {
    return payload.data.filter(isRecord);
  }

  if (isRecord(payload.data) && Array.isArray(payload.data.items)) {
    return payload.data.items.filter(isRecord);
  }

  if (Array.isArray(payload.items)) {
    return payload.items.filter(isRecord);
  }

  return [] as Record<string, unknown>[];
};

const extractPaginationMeta = (payload: unknown) => {
  if (!isRecord(payload)) return null as { totalPages: number; currentPage: number } | null;

  const data = isRecord(payload.data) ? payload.data : payload;
  const totalPages =
    asNumber(data.totalPages) || asNumber(data.pages) || asNumber(data.lastPage) || asNumber(data.total_pages);
  const currentPage =
    asNumber(data.page) || asNumber(data.currentPage) || asNumber(data.current_page) || 1;

  if (totalPages <= 1) return null;
  return { totalPages, currentPage };
};

const normalizeSyncedRecords = (payloadOrRecords: unknown): OfflineSyncedRecord[] => {
  const seen = new Set<string>();
  const records =
    Array.isArray(payloadOrRecords) && payloadOrRecords.every(isRecord)
      ? payloadOrRecords
      : extractListRecords(payloadOrRecords);
  const normalized: OfflineSyncedRecord[] = [];

  for (const record of records) {
    const registrationKey = extractRegistrationKey(record);
    if (!registrationKey || seen.has(registrationKey)) {
      continue;
    }

    seen.add(registrationKey);
    const attendeeName =
      asText(record.attendeeName) ||
      (isRecord(record.attendee) ? asText(record.attendee.name) : undefined);

    normalized.push({
      registrationKey,
      attendeeName,
    });
  }

  return normalized;
};

const SCANNED_CODE_DUPLICATE_WINDOW_MS = 2500;
const JSQR_SCAN_INTERVAL_MS = 140;
const isUuid = (value: string) => UUID_PATTERN.test(value);
const normalizeMessageForMatch = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
const isRecentlyCheckedInMessage = (message: string) => {
  const normalized = normalizeMessageForMatch(message);
  return (
    normalized.includes('check-in ja realizado recentemente') ||
    normalized.includes('checkin ja realizado recentemente')
  );
};

interface ScannedCheckInData {
  registrationId: string;
  eventId?: string;
  attendeeId?: string;
}

interface ManualOrderAttendee {
  attendeeId: string;
  name: string;
  email?: string;
  orderCode: string;
}

const normalizeOrderAttendees = (payload: unknown, fallbackOrderCode: string): ManualOrderAttendee[] => {
  const seen = new Set<string>();
  const normalized: ManualOrderAttendee[] = [];
  const root = isRecord(payload) && isRecord(payload.data) ? payload.data : payload;
  const candidateArrays: unknown[] = [];

  if (Array.isArray(root)) {
    candidateArrays.push(root);
  }

  if (isRecord(root)) {
    const topLevelKeys = ['attendees', 'inscritos', 'registrations', 'items', 'results', 'data'];
    for (const key of topLevelKeys) {
      const value = root[key];
      if (Array.isArray(value)) {
        candidateArrays.push(value);
      }
      if (isRecord(value)) {
        const nested = value.attendees;
        if (Array.isArray(nested)) {
          candidateArrays.push(nested);
        }
      }
    }
  }

  for (const arrayValue of candidateArrays) {
    if (!Array.isArray(arrayValue)) continue;

    for (const item of arrayValue) {
      if (!isRecord(item)) continue;

      const attendee = isRecord(item.attendee) ? item.attendee : item;
      const attendeeId =
        asText(item.attendeeId) ||
        asText(item.attendee_id) ||
        asText(attendee.id) ||
        asText(item.id);

      if (!attendeeId || seen.has(attendeeId)) {
        continue;
      }

      seen.add(attendeeId);
      normalized.push({
        attendeeId,
        name:
          asText(item.attendeeName) ||
          asText(item.name) ||
          asText(attendee.name) ||
          `Inscrito ${normalized.length + 1}`,
        email: asText(item.email) || asText(item.attendeeEmail) || asText(attendee.email) || undefined,
        orderCode: asText(item.orderCode) || fallbackOrderCode,
      });
    }
  }

  return normalized;
};

const extractScannedCheckInData = (rawValue: string): ScannedCheckInData => {
  const trimmed = rawValue.trim();
  if (!trimmed) {
    return { registrationId: '' };
  }

  const readFirstValue = (value: Record<string, unknown>, keys: string[]) => {
    for (const key of keys) {
      const direct = asText(value[key]);
      if (direct && direct.trim()) {
        return direct.trim();
      }
    }
    return '';
  };

  const parseRecord = (value: unknown) => {
    if (!isRecord(value)) {
      return { registrationId: '' } as ScannedCheckInData;
    }

    const registrationId = readFirstValue(value, [
      'registrationId',
      'inscricaoId',
      'orderCode',
      'ticketCode',
      'codigo',
      'code',
      'id',
    ]);
    const eventId = readFirstValue(value, ['eventId', 'event_id']);
    const attendeeId = readFirstValue(value, ['attendeeId', 'attendee_id']);

    return {
      registrationId,
      eventId: eventId || undefined,
      attendeeId: attendeeId || undefined,
    };
  };

  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      const fromRoot = parseRecord(parsed);
      if (fromRoot.registrationId) return fromRoot;
      if (isRecord(parsed)) {
        const fromData = parseRecord(parsed.data);
        if (fromData.registrationId) return fromData;
      }
    } catch {
      // Ignore JSON parse errors and fallback to text/url parsing.
    }
  }

  try {
    const url = new URL(trimmed);
    const knownQueryKeys = [
      'registrationId',
      'inscricaoId',
      'orderCode',
      'ticketCode',
      'codigo',
      'code',
      'id',
    ];
    const knownEventKeys = ['eventId', 'event_id'];
    const knownAttendeeKeys = ['attendeeId', 'attendee_id'];

    const registrationId = knownQueryKeys
      .map((key) => url.searchParams.get(key)?.trim() || '')
      .find(Boolean);
    const eventId = knownEventKeys
      .map((key) => url.searchParams.get(key)?.trim() || '')
      .find(Boolean);
    const attendeeId = knownAttendeeKeys
      .map((key) => url.searchParams.get(key)?.trim() || '')
      .find(Boolean);

    if (registrationId) {
      return {
        registrationId,
        eventId: eventId || undefined,
        attendeeId: attendeeId || undefined,
      };
    }
  } catch {
    // Not an URL, use plain value.
  }

  return { registrationId: trimmed };
};

const decodeNfcRecordText = (record: unknown) => {
  if (!isRecord(record)) return '';
  const data = record.data;
  if (!(data instanceof DataView)) return '';

  const bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  if (bytes.length === 0) return '';

  const recordType = asText(record.recordType);
  if (recordType === 'text') {
    const isUtf16 = (bytes[0] & 0x80) !== 0;
    const langLength = bytes[0] & 0x3f;
    const payload = bytes.slice(1 + langLength);
    const decoder = new TextDecoder(isUtf16 ? 'utf-16' : 'utf-8');
    return decoder.decode(payload).trim();
  }

  return new TextDecoder('utf-8').decode(bytes).trim();
};

const extractNfcPayload = (event: unknown) => {
  if (!isRecord(event)) return '';

  const serialNumber = asText(event.serialNumber);
  if (serialNumber && serialNumber.trim()) {
    return serialNumber.trim();
  }

  const message = isRecord(event.message) ? event.message : undefined;
  const records = Array.isArray(message?.records) ? message.records : [];
  for (const record of records) {
    const decoded = decodeNfcRecordText(record);
    if (decoded) {
      return decoded;
    }
  }

  return '';
};

export default function CheckIn() {
  const [, params] = useRoute('/checkin/:eventId');
  const eventId = (params?.eventId || '') as string;
  const [, setLocation] = useLocation();

  const [method, setMethod] = useState<CheckInMethod>(null);
  const [manualCode, setManualCode] = useState('');
  const [manualAttendees, setManualAttendees] = useState<ManualOrderAttendee[]>([]);
  const [selectedManualAttendeeId, setSelectedManualAttendeeId] = useState('');
  const [isLoadingManualAttendees, setIsLoadingManualAttendees] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<CheckInResult | null>(null);
  const [error, setError] = useState('');
  const [eventTitle, setEventTitle] = useState('Evento');
  const [eventLocation, setEventLocation] = useState('');
  const [kpis, setKpis] = useState<CheckInKpis>({ done: 0, pending: 0 });
  const [isLoadingKpis, setIsLoadingKpis] = useState(false);
  const [isOnline, setIsOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  const [isSyncingData, setIsSyncingData] = useState(false);
  const [isSyncingQueue, setIsSyncingQueue] = useState(false);
  const [hasOfflineCache, setHasOfflineCache] = useState(false);
  const [offlineSyncedAt, setOfflineSyncedAt] = useState<string | null>(null);
  const [offlineRecordsCount, setOfflineRecordsCount] = useState(0);
  const [pendingToSyncCount, setPendingToSyncCount] = useState(0);
  const [scanStatus, setScanStatus] = useState('');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isNfcActive, setIsNfcActive] = useState(false);
  const [isQrSupported, setIsQrSupported] = useState(true);
  const [isQrFallbackMode, setIsQrFallbackMode] = useState(false);
  const [isNfcSupported, setIsNfcSupported] = useState(true);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const qrFrameRef = useRef<number | null>(null);
  const qrStreamRef = useRef<MediaStream | null>(null);
  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const qrCanvasContextRef = useRef<CanvasRenderingContext2D | null>(null);
  const jsQrRef = useRef<null | ((data: Uint8ClampedArray, width: number, height: number) => { data: string } | null)>(null);
  const nfcReaderRef = useRef<{ onreading: ((event: unknown) => void) | null; onreadingerror: (() => void) | null } | null>(null);
  const nfcAbortControllerRef = useRef<AbortController | null>(null);
  const isSubmittingScanRef = useRef(false);
  const lastScannedRef = useRef<{ value: string; at: number }>({ value: '', at: 0 });

  const stopQrReader = () => {
    if (qrFrameRef.current !== null) {
      cancelAnimationFrame(qrFrameRef.current);
      qrFrameRef.current = null;
    }

    if (qrStreamRef.current) {
      qrStreamRef.current.getTracks().forEach((track) => track.stop());
      qrStreamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    qrCanvasRef.current = null;
    qrCanvasContextRef.current = null;
    setIsCameraActive(false);
  };

  const stopNfcReader = () => {
    if (nfcAbortControllerRef.current) {
      nfcAbortControllerRef.current.abort();
      nfcAbortControllerRef.current = null;
    }

    if (nfcReaderRef.current) {
      nfcReaderRef.current.onreading = null;
      nfcReaderRef.current.onreadingerror = null;
      nfcReaderRef.current = null;
    }

    setIsNfcActive(false);
  };

  const getApiErrorMessage = (err: unknown) => {
    if (axios.isAxiosError(err)) {
      const data = err.response?.data as
        | { message?: string; error?: string; erro?: string }
        | string
        | undefined;

      if (typeof data === 'string' && data.trim()) {
        return data;
      }

      if (data && typeof data === 'object') {
        const apiMessage = data.message || data.error || data.erro;
        if (apiMessage) {
          return apiMessage;
        }
      }

      return err.message || 'Erro ao realizar check-in';
    }

    return err instanceof Error ? err.message : 'Erro ao realizar check-in';
  };

  const loadOfflineCache = () => {
    if (!eventId) return null as OfflineEventCache | null;

    try {
      const raw = localStorage.getItem(getOfflineEventCacheKey(eventId));
      if (!raw) return null;

      const parsed = JSON.parse(raw) as OfflineEventCache;
      if (!parsed || parsed.eventId !== eventId) return null;

      return {
        ...parsed,
        syncedRecords: Array.isArray(parsed.syncedRecords) ? parsed.syncedRecords : [],
      };
    } catch {
      return null;
    }
  };

  const persistOfflineCache = (patch: Partial<OfflineEventCache>) => {
    if (!eventId) return;

    const current = loadOfflineCache();
    const next: OfflineEventCache = {
      eventId,
      eventTitle: patch.eventTitle ?? current?.eventTitle ?? eventTitle,
      eventLocation: patch.eventLocation ?? current?.eventLocation ?? eventLocation,
      stats: patch.stats ?? current?.stats ?? kpis,
      syncedRecords: patch.syncedRecords ?? current?.syncedRecords ?? [],
      syncedAt: new Date().toISOString(),
    };

    localStorage.setItem(getOfflineEventCacheKey(eventId), JSON.stringify(next));
    setHasOfflineCache(true);
    setOfflineSyncedAt(next.syncedAt);
    setOfflineRecordsCount(next.syncedRecords.length);
  };

  const refreshPendingToSync = () => {
    if (!eventId) {
      setPendingToSyncCount(0);
      return;
    }

    const queue = readOfflineQueue();
    const total = queue.filter((item) => item.eventId === eventId).length;
    setPendingToSyncCount(total);
  };

  const loadStats = async () => {
    if (!eventId) return;

    setIsLoadingKpis(true);
    try {
      const response = await checkInAPI.stats(eventId);
      const normalized = normalizeKpis(response.data);
      setKpis(normalized);
      persistOfflineCache({ stats: normalized });
    } catch {
      // Keep current values (possibly from offline cache)
    } finally {
      setIsLoadingKpis(false);
    }
  };

  const loadEventDetail = async () => {
    if (!eventId) return;

    try {
      const response = await eventsAPI.getById(eventId);
      const meta = extractEventMeta(response.data);

      if (meta.title) {
        setEventTitle(meta.title);
      }

      setEventLocation(meta.location || '');
      persistOfflineCache({
        eventTitle: meta.title,
        eventLocation: meta.location,
      });
    } catch {
      // Keep current values (possibly from offline cache)
    }
  };

  useEffect(() => {
    const updateNetworkStatus = () => {
      setIsOnline(navigator.onLine);
    };

    updateNetworkStatus();
    window.addEventListener('online', updateNetworkStatus);
    window.addEventListener('offline', updateNetworkStatus);
    return () => {
      window.removeEventListener('online', updateNetworkStatus);
      window.removeEventListener('offline', updateNetworkStatus);
    };
  }, []);

  useEffect(() => {
    if (!eventId) return;

    const cached = loadOfflineCache();
    if (cached) {
      setHasOfflineCache(true);
      setOfflineSyncedAt(cached.syncedAt);
      setOfflineRecordsCount(cached.syncedRecords.length);

      if (cached.eventTitle) {
        setEventTitle(cached.eventTitle);
      }
      setEventLocation(cached.eventLocation || '');

      if (cached.stats) {
        setKpis(cached.stats);
      }
    } else {
      setHasOfflineCache(false);
      setOfflineSyncedAt(null);
      setOfflineRecordsCount(0);
    }

    refreshPendingToSync();
    void loadEventDetail();
    void loadStats();
  }, [eventId]);

  const fetchAllCheckInRecords = async () => {
    if (!eventId) return [] as Record<string, unknown>[];

    const firstResponse = await checkInAPI.listByEvent(eventId, {
      page: 1,
      pageSize: 500,
      limit: 500,
    });

    const firstPayload = firstResponse.data;
    const records = [...extractListRecords(firstPayload)];
    const pagination = extractPaginationMeta(firstPayload);

    if (!pagination || pagination.totalPages <= 1) {
      return records;
    }

    const requests = [];
    for (let page = 2; page <= pagination.totalPages; page += 1) {
      requests.push(
        checkInAPI.listByEvent(eventId, {
          page,
          pageSize: 500,
          limit: 500,
        }),
      );
    }

    const responses = await Promise.all(requests);
    for (const response of responses) {
      records.push(...extractListRecords(response.data));
    }

    return records;
  };

  const syncEventForOffline = async () => {
    if (!eventId) return;
    if (!isOnline) {
      setError('Sem conexao. Conecte-se para sincronizar os registros do evento.');
      return;
    }

    setIsSyncingData(true);
    setError('');
    try {
      const [eventResponse, statsResponse, allRecords] = await Promise.all([
        eventsAPI.getById(eventId),
        checkInAPI.stats(eventId),
        fetchAllCheckInRecords(),
      ]);

      const meta = extractEventMeta(eventResponse.data);
      const stats = normalizeKpis(statsResponse.data);
      const syncedRecords = normalizeSyncedRecords(allRecords);

      if (meta.title) {
        setEventTitle(meta.title);
      }
      setEventLocation(meta.location || '');
      setKpis(stats);

      persistOfflineCache({
        eventTitle: meta.title,
        eventLocation: meta.location,
        stats,
        syncedRecords,
      });

      setResult({
        success: true,
        message: `Dados sincronizados para offline. ${syncedRecords.length} registros atualizados.`,
      });
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setIsSyncingData(false);
    }
  };

  const queueOfflineCheckIn = (
    registrationId: string,
    options?: {
      eventIdOverride?: string;
      attendeeId?: string;
      methodOverride?: OnlineCheckInMethod;
    },
  ) => {
    const targetEventId = options?.eventIdOverride || eventId;
    if (!targetEventId) {
      throw new Error('Evento invalido para check-in offline.');
    }

    const normalizedRegistrationId = registrationId.trim();
    const normalizedAttendeeId = options?.attendeeId?.trim();
    const selectedMethod = options?.methodOverride || method || 'manual';
    if (!normalizedRegistrationId) {
      throw new Error('Informe o codigo da inscricao para check-in.');
    }

    const queue = readOfflineQueue();
    const alreadyQueued = queue.some(
      (item) => item.eventId === targetEventId && item.registrationId === normalizedRegistrationId,
    );
    if (alreadyQueued) {
      throw new Error('Esse check-in ja esta pendente de sincronizacao.');
    }

    const cached = targetEventId === eventId ? loadOfflineCache() : null;
    const alreadyCheckedIn = cached?.syncedRecords.some(
      (record) => record.registrationKey === normalizedRegistrationId,
    );
    if (alreadyCheckedIn) {
      throw new Error('Esse registro ja consta como check-in sincronizado.');
    }

    queue.push({
      localId: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      eventId: targetEventId,
      registrationId: normalizedRegistrationId,
      attendeeId: normalizedAttendeeId || undefined,
      method: selectedMethod,
      notes: `Check-in offline via ${selectedMethod}`,
      createdAt: new Date().toISOString(),
    });

    writeOfflineQueue(queue);
    refreshPendingToSync();

    setKpis((prev) => {
      const next = {
        done: prev.done + 1,
        pending: Math.max(prev.pending - 1, 0),
      };
      persistOfflineCache({ stats: next });
      return next;
    });
  };

  const resolveOnlineMethod = (preferred?: CheckInMethod | string | null): OnlineCheckInMethod => {
    if (preferred === 'qrcode' || preferred === 'nfc' || preferred === 'manual') {
      return preferred;
    }
    if (method === 'qrcode' || method === 'nfc' || method === 'manual') {
      return method;
    }
    return 'manual';
  };

  const shouldTryNextMethodAttempt = (err: unknown) => {
    if (!axios.isAxiosError(err)) return false;

    const apiMessage = getApiErrorMessage(err);
    if (isRecentlyCheckedInMessage(apiMessage)) {
      return false;
    }

    const status = err.response?.status;
    return status === 400 || status === 404 || status === 405 || status === 422;
  };

  const runUntilFirstSuccess = async <T,>(requests: Array<() => Promise<T>>) => {
    let lastError: unknown = null;

    for (const request of requests) {
      try {
        return await request();
      } catch (err) {
        lastError = err;
        if (!shouldTryNextMethodAttempt(err)) {
          throw err;
        }
      }
    }

    throw lastError || new Error('Nao foi possivel processar o check-in.');
  };

  const performOnlineCheckIn = async (
    registrationCode: string,
    options?: {
      preferredMethod?: CheckInMethod | string | null;
      notes?: string;
      eventIdOverride?: string;
      attendeeId?: string;
    },
  ) => {
    const targetMethod = resolveOnlineMethod(options?.preferredMethod);
    const targetEventId = options?.eventIdOverride || eventId;
    const attendeeId = options?.attendeeId?.trim();

    if (!targetEventId) {
      throw new Error('Evento invalido para check-in.');
    }

    const notes = options?.notes ?? `Check-in realizado via ${targetMethod}`;
    const manualPayload = {
      orderCode: registrationCode,
      eventId: targetEventId,
      attendeeId: attendeeId || undefined,
      notes,
    };

    if (targetMethod === 'manual' || isUuid(registrationCode)) {
      return checkInAPI.manual(manualPayload);
    }

    if (targetMethod === 'qrcode') {
      return runUntilFirstSuccess([
        () =>
          checkInAPI.qrcode({
            eventId: targetEventId,
            orderCode: registrationCode,
            attendeeId,
            notes,
          }),
        () =>
          checkInAPI.qrcode({
            event_id: targetEventId,
            orderCode: registrationCode,
            attendeeId,
            notes,
          }),
        () =>
          checkInAPI.qrcode({
            eventId: targetEventId,
            qrCode: registrationCode,
            attendeeId,
            notes,
          }),
        () =>
          checkInAPI.qrcode({
            eventId: targetEventId,
            qrcode: registrationCode,
            attendeeId,
            notes,
          }),
      ]);
    }

    return runUntilFirstSuccess([
      () =>
        checkInAPI.nfc({
          eventId: targetEventId,
          orderCode: registrationCode,
          attendeeId,
          notes,
        }),
      () =>
        checkInAPI.nfc({
          event_id: targetEventId,
          orderCode: registrationCode,
          attendeeId,
          notes,
        }),
      () =>
        checkInAPI.nfc({
          eventId: targetEventId,
          nfcTagId: registrationCode,
          attendeeId,
          notes,
        }),
      () =>
        checkInAPI.nfc({
          eventId: targetEventId,
          tagId: registrationCode,
          attendeeId,
          notes,
        }),
    ]);
  };

  const syncPendingCheckIns = async () => {
    if (!eventId) return;
    if (!isOnline) {
      setError('Sem conexao. Conecte-se para sincronizar check-ins pendentes.');
      return;
    }

    const queue = readOfflineQueue();
    const eventQueue = queue.filter((item) => item.eventId === eventId);

    if (eventQueue.length === 0) {
      setResult({ success: true, message: 'Nao ha check-ins pendentes para sincronizar.' });
      return;
    }

    setIsSyncingQueue(true);
    setError('');
    setResult(null);

    let syncedCount = 0;
    const failed: OfflineQueuedCheckIn[] = [];

    for (const item of eventQueue) {
      try {
        await performOnlineCheckIn(item.registrationId, {
          preferredMethod: item.method,
          notes: item.notes,
          eventIdOverride: item.eventId,
          attendeeId: item.attendeeId,
        });
        syncedCount += 1;
      } catch {
        failed.push(item);
      }
    }

    const remainingFromOtherEvents = queue.filter((item) => item.eventId !== eventId);
    writeOfflineQueue([...remainingFromOtherEvents, ...failed]);
    refreshPendingToSync();

    await loadStats();
    if (syncedCount > 0) {
      await syncEventForOffline();
    }

    if (failed.length === 0) {
      setResult({
        success: true,
        message: `${syncedCount} check-in(s) sincronizado(s) com sucesso.`,
      });
    } else {
      setError(
        `Sincronizados ${syncedCount} check-in(s). ${failed.length} ainda pendente(s), tente novamente.`,
      );
    }

    setIsSyncingQueue(false);
  };

  const clearOfflineData = () => {
    if (!eventId) return;

    const queue = readOfflineQueue();
    const remainingQueue = queue.filter((item) => item.eventId !== eventId);
    const removedPending = queue.length - remainingQueue.length;

    writeOfflineQueue(remainingQueue);
    localStorage.removeItem(getOfflineEventCacheKey(eventId));

    setHasOfflineCache(false);
    setOfflineSyncedAt(null);
    setOfflineRecordsCount(0);
    setError('');
    refreshPendingToSync();

    setResult({
      success: true,
      message: `Dados offline removidos. ${removedPending} pendencia(s) apagada(s).`,
    });
  };

  const handleCheckIn = async (
    code: string,
    options?: {
      eventIdOverride?: string;
      attendeeId?: string;
      preferredMethod?: OnlineCheckInMethod;
    },
  ) => {
    setIsLoading(true);
    setError('');
    setResult(null);

    try {
      const normalizedCode = code.trim();
      if (!normalizedCode) {
        throw new Error('Informe o codigo da inscricao.');
      }

      if (!isOnline) {
        if (!hasOfflineCache) {
          throw new Error(
            'Sem dados offline sincronizados. Clique em "Sincronizar dados offline" quando estiver online.',
          );
        }

        queueOfflineCheckIn(normalizedCode, {
          eventIdOverride: options?.eventIdOverride,
          attendeeId: options?.attendeeId,
          methodOverride: options?.preferredMethod,
        });
        setResult({
          success: true,
          message: 'Check-in salvo offline. Sincronize pendencias quando houver conexao.',
        });
        setManualCode('');
        setTimeout(() => {
          setResult(null);
          setMethod(null);
        }, 3000);
        return;
      }

      const response = await performOnlineCheckIn(normalizedCode, {
        preferredMethod: options?.preferredMethod || method,
        eventIdOverride: options?.eventIdOverride,
        attendeeId: options?.attendeeId,
      });
      const data = response.data as { message?: string; attendee?: { name: string; email: string } };

      setResult({
        success: true,
        message: data.message || 'Check-in realizado com sucesso!',
        attendee: data.attendee,
      });

      await loadStats();
      if (hasOfflineCache) {
        await syncEventForOffline();
      }

      // Reset form after success
      setManualCode('');
      setTimeout(() => {
        setResult(null);
        setMethod(null);
      }, 3000);
    } catch (err) {
      const shouldQueueOffline =
        !isOnline || (axios.isAxiosError(err) && !err.response && Boolean(hasOfflineCache));

      if (shouldQueueOffline) {
        try {
          queueOfflineCheckIn(code, {
            eventIdOverride: options?.eventIdOverride,
            attendeeId: options?.attendeeId,
            methodOverride: options?.preferredMethod,
          });
          setResult({
            success: true,
            message: 'Conexao indisponivel. Check-in salvo offline para sincronizacao futura.',
          });
          setManualCode('');
          setTimeout(() => {
            setResult(null);
            setMethod(null);
          }, 3000);
        } catch (queueErr) {
          setError(getApiErrorMessage(queueErr));
        }
      } else {
        setError(getApiErrorMessage(err));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const submitScannedCode = async (rawValue: string, source: 'qrcode' | 'nfc') => {
    const scannedData = extractScannedCheckInData(rawValue);
    const registrationId = scannedData.registrationId;
    if (!registrationId) {
      setError('Nao foi possivel identificar o codigo da inscricao no dado lido.');
      return;
    }

    const now = Date.now();
    const duplicateWindow =
      lastScannedRef.current.value === registrationId &&
      now - lastScannedRef.current.at < SCANNED_CODE_DUPLICATE_WINDOW_MS;
    if (duplicateWindow || isSubmittingScanRef.current) {
      return;
    }

    isSubmittingScanRef.current = true;
    lastScannedRef.current = { value: registrationId, at: now };
    setScanStatus(source === 'qrcode' ? 'QR detectado. Enviando check-in...' : 'Tag NFC detectada. Enviando check-in...');

    try {
      await handleCheckIn(registrationId, {
        preferredMethod: source,
        eventIdOverride: scannedData.eventId,
        attendeeId: scannedData.attendeeId,
      });
    } finally {
      isSubmittingScanRef.current = false;
    }
  };

  const startQrReader = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setIsQrSupported(false);
      setIsQrFallbackMode(false);
      setError('Leitura de camera nao suportada neste dispositivo.');
      return;
    }

    setIsQrSupported(true);
    setIsQrFallbackMode(false);

    const BarcodeDetectorCtor = (window as Window & {
      BarcodeDetector?: new (options?: { formats?: string[] }) => {
        detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>>;
      };
    }).BarcodeDetector;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });

      qrStreamRef.current = stream;
      const videoElement = videoRef.current;
      if (!videoElement) {
        stopQrReader();
        setError('Nao foi possivel iniciar o preview da camera.');
        return;
      }

      videoElement.srcObject = stream;
      await videoElement.play();
      setIsCameraActive(true);
      setScanStatus('Aponte a camera para o QR Code do participante.');

      const detectWithNative = BarcodeDetectorCtor
        ? new BarcodeDetectorCtor({ formats: ['qr_code'] })
        : null;
      let lastJsQrScanAt = 0;

      const loadJsQr = async () => {
        if (jsQrRef.current) {
          return jsQrRef.current;
        }

        const module = await import('jsqr');
        const parser = module.default as (data: Uint8ClampedArray, width: number, height: number) => { data: string } | null;
        jsQrRef.current = parser;
        return parser;
      };

      const detectWithJsQr = async (video: HTMLVideoElement) => {
        const now = Date.now();
        if (now - lastJsQrScanAt < JSQR_SCAN_INTERVAL_MS) {
          return '';
        }
        lastJsQrScanAt = now;

        const parser = await loadJsQr();
        const width = video.videoWidth;
        const height = video.videoHeight;
        if (!width || !height) {
          return '';
        }

        const canvas = qrCanvasRef.current || document.createElement('canvas');
        qrCanvasRef.current = canvas;
        if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width;
          canvas.height = height;
        }

        const context = qrCanvasContextRef.current || canvas.getContext('2d', { willReadFrequently: true });
        if (!context) {
          return '';
        }
        qrCanvasContextRef.current = context;

        context.drawImage(video, 0, 0, width, height);
        const imageData = context.getImageData(0, 0, width, height);
        const code = parser(imageData.data, width, height);
        return code?.data?.trim() || '';
      };

      if (!detectWithNative) {
        try {
          await loadJsQr();
          setIsQrFallbackMode(true);
          setScanStatus('Aponte a camera para o QR Code do participante (modo compatibilidade).');
        } catch {
          stopQrReader();
          setIsQrSupported(false);
          setIsQrFallbackMode(false);
          setError('Leitor de QR indisponivel neste navegador. Use Chrome/Edge atual para PWA.');
          return;
        }
      }

      const scanFrame = async () => {
        const activeVideo = videoRef.current;
        if (!activeVideo || !qrStreamRef.current) {
          return;
        }

        try {
          if (detectWithNative) {
            const codes = await detectWithNative.detect(activeVideo);
            const firstCode = codes.find((item) => typeof item.rawValue === 'string' && item.rawValue.trim());
            if (firstCode?.rawValue) {
              void submitScannedCode(firstCode.rawValue, 'qrcode');
            }
          } else {
            const jsQrCode = await detectWithJsQr(activeVideo);
            if (jsQrCode) {
              void submitScannedCode(jsQrCode, 'qrcode');
            }
          }
        } catch {
          // Ignore frame-level detection errors and keep scanning.
        } finally {
          qrFrameRef.current = requestAnimationFrame(() => {
            void scanFrame();
          });
        }
      };

      void scanFrame();
    } catch (err) {
      stopQrReader();
      const message = err instanceof Error ? err.message : 'Nao foi possivel acessar a camera.';
      if (message.includes("Failed to fetch dynamically imported module")) {
        setIsQrSupported(false);
        setIsQrFallbackMode(false);
        setError('Leitor de QR indisponivel neste navegador. Use Chrome/Edge atual para PWA.');
      } else {
        setError(message);
      }
    }
  };

  const startNfcReader = async () => {
    const NdefCtor = (window as Window & { NDEFReader?: new () => { scan: (options?: { signal?: AbortSignal }) => Promise<void>; onreading: ((event: unknown) => void) | null; onreadingerror: (() => void) | null } }).NDEFReader;
    if (!NdefCtor) {
      setIsNfcSupported(false);
      setError('NFC nao suportado neste navegador/dispositivo.');
      return;
    }

    if (!window.isSecureContext) {
      setError('NFC no navegador requer contexto seguro (HTTPS ou localhost).');
      return;
    }

    try {
      const abortController = new AbortController();
      const reader = new NdefCtor();
      nfcAbortControllerRef.current = abortController;
      nfcReaderRef.current = reader;

      await reader.scan({ signal: abortController.signal });
      setIsNfcActive(true);
      setScanStatus('Aproxime a tag NFC do dispositivo.');

      reader.onreading = (event: unknown) => {
        const payload = extractNfcPayload(event);
        if (!payload) {
          setError('Tag NFC lida sem conteudo utilizavel.');
          return;
        }
        void submitScannedCode(payload, 'nfc');
      };

      reader.onreadingerror = () => {
        setError('Falha ao ler a tag NFC. Tente aproximar novamente.');
      };
    } catch (err) {
      const error = err as { name?: string; message?: string } | undefined;
      if (error?.name === 'NotAllowedError') {
        setError('Permissao de NFC negada. Habilite e tente novamente.');
      } else if (error?.name !== 'AbortError') {
        setError(error?.message || 'Nao foi possivel iniciar a leitura NFC.');
      }
      stopNfcReader();
    }
  };

  useEffect(() => {
    if (!method) {
      setScanStatus('');
      stopQrReader();
      stopNfcReader();
      setManualAttendees([]);
      setSelectedManualAttendeeId('');
      return;
    }

    setError('');
    setScanStatus('');

    if (method === 'manual') {
      setManualAttendees([]);
      setSelectedManualAttendeeId('');
    }

    if (method === 'qrcode') {
      stopNfcReader();
      void startQrReader();
      return;
    }

    if (method === 'nfc') {
      stopQrReader();
      void startNfcReader();
      return;
    }

    stopQrReader();
    stopNfcReader();
  }, [method]);

  useEffect(() => {
    return () => {
      stopQrReader();
      stopNfcReader();
    };
  }, []);

  const loadManualAttendees = async () => {
    if (!eventId) {
      throw new Error('Evento invalido para listar inscritos.');
    }

    const orderCode = manualCode.trim();
    if (!orderCode) {
      throw new Error('Informe o orderCode para listar os inscritos.');
    }

    const response = await api.get('/api/public/checkin/attendees', { params: { orderCode } });

    const attendees = normalizeOrderAttendees(response.data, orderCode);
    if (attendees.length === 0) {
      throw new Error('Nenhum inscrito encontrado para este orderCode.');
    }

    return attendees;
  };

  const handleLoadManualAttendees = async () => {
    if (!manualCode.trim()) {
      setError('Informe o orderCode para listar os inscritos.');
      return;
    }
    if (!isOnline) {
      setError('Sem conexao. A listagem de inscritos requer internet.');
      return;
    }

    setError('');
    setResult(null);
    setIsLoadingManualAttendees(true);
    setManualAttendees([]);
    setSelectedManualAttendeeId('');

    try {
      const attendees = await loadManualAttendees();
      setManualAttendees(attendees);
      setSelectedManualAttendeeId(attendees[0].attendeeId);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setIsLoadingManualAttendees(false);
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!manualAttendees.length) {
      await handleLoadManualAttendees();
      return;
    }

    const attendeeToCheckIn = manualAttendees.length === 1 ? manualAttendees[0] : manualAttendees.find((attendee) => attendee.attendeeId === selectedManualAttendeeId);

    if (!attendeeToCheckIn) {
      setError('Selecione um inscrito para realizar o check-in.');
      return;
    }

    await handleCheckIn(attendeeToCheckIn.orderCode, {
      preferredMethod: 'manual',
      attendeeId: attendeeToCheckIn.attendeeId || undefined,
      eventIdOverride: eventId,
    });
  };

  const isDuplicateCheckInError = isRecentlyCheckedInMessage(error);

  const [offlineExpanded, setOfflineExpanded] = useState(false);

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F0F2F5' }}>

      {/* ── Header ── */}
      <header className="sticky top-0 z-20" style={{ backgroundColor: '#0A1F3F', borderBottomLeftRadius: '20px', borderBottomRightRadius: '20px' }}>
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setLocation('/events')}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium flex-shrink-0 transition-all duration-200 active:scale-95"
              style={{ backgroundColor: 'rgba(255,255,255,0.12)', color: '#fff' }}
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Eventos</span>
            </button>
            <div className="min-w-0">
              <img
                src="https://images.squarespace-cdn.com/content/v1/5bc9186e34c4e27773d92870/1546175613378-UHI78Z3KGSEOFFJEAP0B/logo-site.png"
                alt="IECG"
                className="h-6 w-auto"
                style={{ filter: 'brightness(0) invert(1)' }}
              />
              {eventTitle && (
                <p className="text-xs truncate" style={{ color: '#4A90D9' }}>{eventTitle}</p>
              )}
              {eventLocation && (
                <p className="text-xs flex items-center gap-1 truncate" style={{ color: '#4A90D9' }}>
                  <MapPin className="w-3 h-3 flex-shrink-0" />
                  {eventLocation}
                </p>
              )}
            </div>
          </div>
          <UserMenu showBackButton={false} />
        </div>
      </header>

      {/* ── Barra offline compacta ── */}
      <div
        style={{
          backgroundColor: isOnline ? '#EBF2FB' : '#FEF3C7',
          borderBottom: `1px solid ${isOnline ? '#BFDBFE' : '#FDE68A'}`,
        }}
      >
        <div className="max-w-lg mx-auto px-4">
          <button
            type="button"
            onClick={() => setOfflineExpanded((v) => !v)}
            className="w-full flex items-center justify-between py-2 text-xs font-medium"
            style={{ color: isOnline ? '#1B4D8E' : '#92400E' }}
          >
            <span className="flex items-center gap-1.5">
              {isOnline
                ? <Wifi className="w-3.5 h-3.5" />
                : <WifiOff className="w-3.5 h-3.5" />}
              {isOnline ? 'Online' : 'Offline'}
              {pendingToSyncCount > 0 && (
                <span
                  className="ml-1 px-1.5 py-0.5 rounded-full text-white text-[10px] font-bold"
                  style={{ backgroundColor: '#D97706' }}
                >
                  {pendingToSyncCount} pendente{pendingToSyncCount > 1 ? 's' : ''}
                </span>
              )}
            </span>
            <span style={{ color: '#9CA3AF' }}>{offlineExpanded ? '▲' : '▼'}</span>
          </button>

          {offlineExpanded && (
            <div className="pb-3 space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
              <p className="text-xs" style={{ color: '#6B7280' }}>
                {hasOfflineCache && offlineSyncedAt
                  ? `Última sinc.: ${new Date(offlineSyncedAt).toLocaleString('pt-BR')} · ${offlineRecordsCount} registros`
                  : 'Sem dados offline para este evento'}
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={syncEventForOffline}
                  disabled={!isOnline || isSyncingData}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all active:scale-95 disabled:opacity-50"
                  style={{ backgroundColor: '#fff', border: '1px solid #BFDBFE', color: '#1B4D8E' }}
                >
                  {isSyncingData ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                  Sincronizar dados
                </button>
                <button
                  type="button"
                  onClick={syncPendingCheckIns}
                  disabled={!isOnline || isSyncingQueue || pendingToSyncCount === 0}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-all active:scale-95 disabled:opacity-50"
                  style={{ backgroundColor: '#1B4D8E' }}
                >
                  {isSyncingQueue ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                  Enviar pendentes
                </button>
                <button
                  type="button"
                  onClick={clearOfflineData}
                  disabled={isSyncingData || isSyncingQueue}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all active:scale-95 disabled:opacity-50"
                  style={{ backgroundColor: '#fff', border: '1px solid #FECACA', color: '#DC2626' }}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Limpar cache
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <main className="max-w-lg mx-auto px-4 pt-4 pb-8">

        {/* ── KPIs ── */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          <div
            className="rounded-2xl p-4"
            style={{ backgroundColor: '#fff', boxShadow: '0 2px 12px rgba(10,31,63,0.08)' }}
          >
            <p className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: '#9CA3AF' }}>
              Feitos
            </p>
            <p className="text-4xl font-extrabold leading-none" style={{ color: '#16A34A' }}>
              {isLoadingKpis ? <Loader2 className="w-6 h-6 animate-spin" /> : kpis.done}
            </p>
          </div>
          <div
            className="rounded-2xl p-4"
            style={{ backgroundColor: '#fff', boxShadow: '0 2px 12px rgba(10,31,63,0.08)' }}
          >
            <p className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: '#9CA3AF' }}>
              Pendentes
            </p>
            <p className="text-4xl font-extrabold leading-none" style={{ color: '#D97706' }}>
              {isLoadingKpis ? <Loader2 className="w-6 h-6 animate-spin" /> : kpis.pending}
            </p>
          </div>
        </div>

        {/* ── Feedback de sucesso ── */}
        {result?.success && (
          <div
            className="mb-4 rounded-2xl p-4 flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-300"
            style={{ backgroundColor: '#DCFCE7', border: '1px solid #86EFAC' }}
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: '#16A34A' }}
            >
              <CheckCircle className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: '#14532D' }}>{result.message}</p>
              {result.attendee && (
                <p className="text-xs mt-0.5" style={{ color: '#166534' }}>
                  {result.attendee.name}
                </p>
              )}
            </div>
          </div>
        )}

        {/* ── Feedback de erro ── */}
        {error && (
          <div
            className="mb-4 rounded-2xl p-4 flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-300"
            style={{
              backgroundColor: isDuplicateCheckInError ? '#FFFBEB' : '#FEF2F2',
              border: `1px solid ${isDuplicateCheckInError ? '#FDE68A' : '#FECACA'}`,
            }}
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: isDuplicateCheckInError ? '#D97706' : '#DC2626' }}
            >
              <AlertCircle className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: isDuplicateCheckInError ? '#78350F' : '#7F1D1D' }}>
                {isDuplicateCheckInError ? 'Check-in já registrado' : 'Erro no Check-in'}
              </p>
              <p className="text-xs mt-0.5" style={{ color: isDuplicateCheckInError ? '#92400E' : '#991B1B' }}>
                {error}
              </p>
            </div>
          </div>
        )}

        {/* ── Seleção de método ── */}
        {!method ? (
          <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-400">
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#C9A84C' }}>
              Método de check-in
            </p>
            <h2 className="text-xl font-extrabold -mt-1 mb-4" style={{ color: '#0A1F3F' }}>
              Como deseja registrar?
            </h2>

            {[
              { key: 'qrcode' as const, icon: <QrCode className="w-6 h-6" />, title: 'QR Code', desc: 'Escaneie o código QR do participante' },
              { key: 'nfc'    as const, icon: <Smartphone className="w-6 h-6" />, title: 'NFC', desc: 'Aproxime o cartão NFC do dispositivo' },
              { key: 'manual' as const, icon: <Type className="w-6 h-6" />, title: 'Manual', desc: 'Digite o código de inscrição' },
            ].map(({ key, icon, title, desc }) => (
              <button
                key={key}
                onClick={() => setMethod(key)}
                disabled={isLoading}
                className="w-full flex items-center gap-4 rounded-2xl p-4 text-left transition-all duration-200 active:scale-[0.98] disabled:opacity-50"
                style={{ backgroundColor: '#fff', boxShadow: '0 4px 16px rgba(10,31,63,0.09)' }}
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: '#EBF2FB', color: '#1B4D8E' }}
                >
                  {icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-base" style={{ color: '#0A1F3F' }}>{title}</p>
                  <p className="text-sm" style={{ color: '#6B7280' }}>{desc}</p>
                </div>
                <ArrowLeft className="w-5 h-5 rotate-180 flex-shrink-0" style={{ color: '#C9A84C' }} />
              </button>
            ))}
          </div>

        ) : (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">

            {/* Cabeçalho do método ativo */}
            <div className="flex items-center gap-3 mb-5">
              <button
                type="button"
                onClick={() => setMethod(null)}
                className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-all active:scale-90"
                style={{ backgroundColor: '#EBF2FB' }}
              >
                <ArrowLeft className="w-4 h-4" style={{ color: '#1B4D8E' }} />
              </button>
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#C9A84C' }}>
                  {method === 'qrcode' ? 'QR Code' : method === 'nfc' ? 'NFC' : 'Manual'}
                </p>
                <h2 className="text-lg font-extrabold leading-tight" style={{ color: '#0A1F3F' }}>
                  {method === 'qrcode' ? 'Escanear código' : method === 'nfc' ? 'Ler tag NFC' : 'Inserir código'}
                </h2>
              </div>
            </div>

            {/* ── Manual ── */}
            {method === 'manual' && (
              <form onSubmit={handleManualSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#6B7280' }}>
                    Código de inscrição
                  </label>
                  <Input
                    type="text"
                    placeholder="Digite o orderCode..."
                    value={manualCode}
                    onChange={(e) => {
                      setManualCode(e.target.value);
                      setManualAttendees([]);
                      setSelectedManualAttendeeId('');
                    }}
                    disabled={isLoading || isLoadingManualAttendees}
                    autoFocus
                    className="h-12 rounded-xl text-base"
                  />
                </div>

                {manualAttendees.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#6B7280' }}>
                      Selecione o inscrito
                    </p>
                    <div className="rounded-xl overflow-hidden" style={{ border: '1.5px solid #E5E7EB' }}>
                      {manualAttendees.map((attendee) => {
                        const isSelected = selectedManualAttendeeId === attendee.attendeeId;
                        return (
                          <button
                            key={attendee.attendeeId}
                            type="button"
                            onClick={() => setSelectedManualAttendeeId(attendee.attendeeId)}
                            className="w-full text-left px-4 py-3 flex items-center gap-3 transition-colors"
                            style={{
                              backgroundColor: isSelected ? '#EBF2FB' : '#fff',
                              borderLeft: isSelected ? '3px solid #1B4D8E' : '3px solid transparent',
                            }}
                          >
                            <div>
                              <p className="text-sm font-semibold" style={{ color: '#0A1F3F' }}>{attendee.name}</p>
                              {attendee.email && <p className="text-xs" style={{ color: '#9CA3AF' }}>{attendee.email}</p>}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => void handleLoadManualAttendees()}
                  disabled={isLoading || isLoadingManualAttendees || !manualCode.trim()}
                  className="w-full h-12 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50"
                  style={{ backgroundColor: '#F0F2F5', color: '#1B4D8E', border: '1.5px solid #1B4D8E' }}
                >
                  {isLoadingManualAttendees
                    ? <><Loader2 className="w-4 h-4 animate-spin" />Buscando...</>
                    : 'Listar inscritos'}
                </button>

                <button
                  type="submit"
                  disabled={
                    isLoading || isLoadingManualAttendees || !manualCode.trim() ||
                    manualAttendees.length === 0 ||
                    (manualAttendees.length > 1 && !selectedManualAttendeeId)
                  }
                  className="w-full h-12 rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50"
                  style={{ backgroundColor: '#1B4D8E' }}
                >
                  {isLoading
                    ? <><Loader2 className="w-4 h-4 animate-spin" />Processando...</>
                    : <><CheckCircle className="w-4 h-4" />Confirmar check-in</>}
                </button>
              </form>
            )}

            {/* ── QR Code ── */}
            {method === 'qrcode' && (
              <div className="space-y-4">
                <div
                  className="overflow-hidden rounded-2xl bg-black"
                  style={{ boxShadow: '0 4px 20px rgba(10,31,63,0.15)' }}
                >
                  <video ref={videoRef} className="w-full aspect-square object-cover" muted playsInline autoPlay />
                </div>

                <div
                  className="rounded-xl px-4 py-3 text-center text-sm"
                  style={{ backgroundColor: '#EBF2FB', color: '#1B4D8E' }}
                >
                  {scanStatus || 'Aguardando leitura do QR Code...'}
                </div>

                {!isQrSupported && (
                  <p className="text-xs text-center px-2" style={{ color: '#D97706' }}>
                    Leitura QR indisponível neste navegador/dispositivo.
                  </p>
                )}

                <button
                  type="button"
                  onClick={() => setMethod('manual')}
                  disabled={isLoading}
                  className="w-full h-12 rounded-xl text-sm font-semibold transition-all active:scale-[0.98]"
                  style={{ backgroundColor: '#F0F2F5', color: '#1B4D8E', border: '1.5px solid #1B4D8E' }}
                >
                  Digitar código manualmente
                </button>
              </div>
            )}

            {/* ── NFC ── */}
            {method === 'nfc' && (
              <div className="space-y-4">
                <div
                  className="rounded-2xl flex flex-col items-center justify-center py-12 text-center"
                  style={{ backgroundColor: '#EBF2FB' }}
                >
                  <div className="relative mb-4">
                    <div
                      className="absolute inset-0 rounded-full animate-ping opacity-25"
                      style={{ backgroundColor: '#1B4D8E' }}
                    />
                    <div
                      className="relative w-20 h-20 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: '#1B4D8E' }}
                    >
                      <Smartphone className="w-9 h-9 text-white" />
                    </div>
                  </div>
                  <p className="text-sm font-semibold" style={{ color: '#0A1F3F' }}>
                    {isNfcActive ? 'NFC ativo' : 'Aguardando NFC...'}
                  </p>
                  <p className="text-xs mt-1" style={{ color: '#6B7280' }}>
                    {scanStatus || 'Aproxime a credencial do participante'}
                  </p>
                  {!isNfcSupported && (
                    <p className="text-xs mt-2 px-4" style={{ color: '#D97706' }}>
                      NFC não suportado neste dispositivo.
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setMethod('manual')}
                  disabled={isLoading}
                  className="w-full h-12 rounded-xl text-sm font-semibold transition-all active:scale-[0.98]"
                  style={{ backgroundColor: '#F0F2F5', color: '#1B4D8E', border: '1.5px solid #1B4D8E' }}
                >
                  Digitar código manualmente
                </button>
              </div>
            )}

          </div>
        )}
      </main>
    </div>
  );
}


