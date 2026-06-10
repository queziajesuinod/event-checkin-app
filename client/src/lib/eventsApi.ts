import axios from 'axios';

// URL da API do portal-iecg
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3005';

const api = axios.create({
  baseURL: API_URL,
});

// ============= SISTEMA DE CACHE =============

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const CACHE_TTL = 5 * 60 * 1000; // 5 minutos
const FORM_FIELDS_CACHE_TTL = 30 * 1000; // 30 segundos
const cache = new Map<string, CacheEntry<any>>();

function getCached<T>(key: string, ttl = CACHE_TTL): T | null {
  const entry = cache.get(key);
  if (!entry) return null;

  const now = Date.now();
  if (now - entry.timestamp > ttl) {
    cache.delete(key);
    return null;
  }

  console.log('[CACHE HIT]', key);
  return entry.data as T;
}

function setCache<T>(key: string, data: T): void {
  cache.set(key, { data, timestamp: Date.now() });
}

// Função para limpar cache manualmente (útil para testes)
export function clearCache(): void {
  cache.clear();
  console.log('[CACHE] Cache limpo');
}

// ============= EVENTOS PÚBLICOS =============

export interface Event {
  id: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  location: string;
  imageUrl?: string;
  maxRegistrations?: number;
  currentRegistrations: number;
  maxPerBuyer?: number;
  isActive: boolean;
  registrationPaymentMode?: 'SINGLE' | 'BALANCE_DUE';
  depositAmount?: number;
  eventType?: string;
  city?: string;
  neighborhood?: string;
  cep?: string;
  addressNumber?: number;
  latitude?: number;
  longitude?: number;
}

export interface EventBatch {
  id: string;
  eventId: string;
  name: string;
  price: number;
  startDate: string;
  endDate: string;
  maxQuantity?: number;
  currentQuantity: number;
  isActive: boolean;
  vagasDisponiveis?: number | null;
  inscritosOcupados?: number;
}

export interface FormField {
  id: string;
  eventId: string;
  section: 'buyer' | 'attendee';
  fieldName: string;
  fieldType: string;
  label: string;
  placeholder?: string;
  isRequired: boolean;
  options?: string[];
  orderIndex: number;
}

export interface PaymentOption {
  id: string;
  eventId: string;
  paymentType: 'credit_card' | 'pix' | 'boleto';
  maxInstallments: number;
  interestRate: number;
  interestType: 'percentage' | 'fixed';
  installmentInterestRates?:
    | Record<string, number>
    | Array<{
        installments: number;
        interestRate: number;
        interestType?: 'percentage' | 'fixed';
      }>;
  isActive: boolean;
}

export interface CouponValidation {
  valido: boolean;
  coupon?: {
    code: string;
    discountType: 'percentage' | 'fixed';
    discountValue: number;
  };
  message?: string;
}

export interface CouponValidationRequest {
  code: string;
  eventId: string;
  batchId: string;
  quantity?: number;
  attendees?: Array<{ batchId: string; data?: Record<string, unknown> }>;
  attendeesData?: Array<{ batchId: string; data: Record<string, unknown> }>;
}

export interface RegistrationData {
  eventId: string;
  batchId?: string;  // Opcional (retrocompatibilidade)
  quantity: number;
  buyerData: Record<string, any>;
  attendeesData: Array<{
    batchId: string;  // Lote específico do inscrito
    data: Record<string, any>;
  }>;
  couponCode?: string;
  paymentOptionId?: string;
  paymentData?: {
    cardNumber?: string;
    cardHolder?: string;
    expirationDate?: string;
    securityCode?: string;
    installments?: number;
    amount?: number;
    feeAmount?: number;
    taxAmount?: number;
    interestAmount?: number;
    totalAmount?: number;
  };
}

export interface RegistrationResponse {
  success: boolean;
  orderCode: string;
  registration: {
    id: number;
    orderCode: string;
    finalPrice: number;
    paymentStatus: string;
  };
  message: string;
  pagamento?: {
    qrCodeString?: string;
    qrCodeBase64?: string;
  };
}

export interface RegistrationPayment {
  id: string;
  amount: number;
  method: 'pix' | 'credit_card' | 'cash';
  channel: 'ONLINE' | 'OFFLINE';
  status: 'pending' | 'confirmed' | 'failed' | 'canceled';
  createdAt: string;
  notes?: string | null;
  pixQrCode?: string | null;
  pixQrCodeBase64?: string | null;
}

export interface RegistrationPaymentData {
  cardNumber?: string;
  cardHolder?: string;
  expirationDate?: string;
  securityCode?: string;
  installments?: number;
  amount?: number;
  feeAmount?: number;
  taxAmount?: number;
  interestAmount?: number;
  totalAmount?: number;
}

export interface RegistrationDetails {
  id: string;
  orderCode?: string;
  event: {
    id?: string;
    title: string;
    name?: string;
    location?: string;
    imageUrl?: string;
    startDate?: string | null;
    eventDate?: string | null;
    registrationPaymentMode: 'SINGLE' | 'BALANCE_DUE';
    minDepositAmount?: string;
    maxPaymentCount?: number;
  };
  finalPrice: number;
  paidTotal: number;
  remaining: number;
  paymentStatus: 'pending' | 'partial' | 'paid' | 'confirmed' | 'canceled' | 'cancelled';
  payments: RegistrationPayment[];
  attendees?: Array<{
    id: string;
    attendeeNumber: number;
    attendeeData: Record<string, string>;
    batch?: {
      id: string;
      name: string;
      price: string;
    } | null;
  }>;
  pixQrCode?: string | null;
  pixQrCodeBase64?: string | null;
  checkinQrCode?: string | null;
}

export interface CreateRegistrationPaymentPayload {
  amount: number;
  feeAmount?: number;
  taxAmount?: number;
  interestAmount?: number;
  totalAmount?: number;
  method: 'pix' | 'credit_card';
  paymentOptionId: string;
  paymentData?: RegistrationPaymentData;
}

interface PublicListOptions {
  skipCache?: boolean;
}

const normalizePublicEventId = (eventId: string) =>
  (eventId || '').trim().replace(/\/+$/, '');

// Listar eventos públicos ativos
export const listarEventosPublicos = async (): Promise<Event[]> => {
  const response = await api.get('/api/public/events');
  return response.data;
};

// Buscar detalhes de um evento
export const buscarEventoPublico = async (id: string): Promise<Event> => {
  const cacheKey = `event-${id}`;
  
  // Tentar cache primeiro
  const cached = getCached<Event>(cacheKey);
  if (cached) {
    return cached;
  }
  
  // Se não tem cache, buscar da API
  const response = await api.get(`/api/public/events/${id}`);
  setCache(cacheKey, response.data);
  
  return response.data;
};

// Listar lotes de um evento
export const listarLotesPublicos = async (
  eventId: string,
  options?: PublicListOptions
): Promise<EventBatch[]> => {
  const normalizedEventId = normalizePublicEventId(eventId);
  if (!normalizedEventId) {
    throw new Error('EventId invalido para listar lotes.');
  }

  const cacheKey = `batches-${normalizedEventId}`;

  if (!options?.skipCache) {
    const cached = getCached<EventBatch[]>(cacheKey);
    if (cached) {
      return cached;
    }
  }

  try {
    const response = await api.get(`/api/public/events/${normalizedEventId}/batches`);
    setCache(cacheKey, response.data);
    return response.data;
  } catch (error) {
    cache.delete(cacheKey);
    throw error;
  }
};

// Listar campos do formulário
export const listarCamposFormulario = async (eventId: string): Promise<FormField[]> => {
  const cacheKey = `fields-${eventId}`;
  const cached = getCached<FormField[]>(cacheKey, FORM_FIELDS_CACHE_TTL);
  if (cached) return cached;

  const response = await api.get(`/api/public/events/${eventId}/form-fields`);
  setCache(cacheKey, response.data);
  return response.data;
};

// Validar cupom de desconto
export const validarCupom = async (
  payload: CouponValidationRequest
): Promise<CouponValidation> => {
  const response = await api.post('/api/public/events/coupons/validate', payload);
  return response.data;
};

// Verificar disponibilidade de lote
export const verificarDisponibilidade = async (
  batchId: string,
  quantity: number
): Promise<{ available: boolean; message?: string }> => {
  const response = await api.get('/api/public/events/batches/check-availability', {
    params: { batchId, quantity },
  });
  return response.data;
};

// Processar inscrição
export const processarInscricao = async (
  data: RegistrationData
): Promise<RegistrationResponse> => {
  const response = await api.post('/api/public/events/register', data);
  return response.data;
};

// Consultar inscrição por código
export const consultarInscricao = async (orderCode: string) => {
  const response = await api.get(`/api/public/events/registrations/${orderCode}`);
  return response.data;
};

export const buscarInscricaoPorId = async (id: string): Promise<RegistrationDetails> => {
  const response = await api.get(`/registrations/${id}`);
  return response.data;
};

export const criarPagamentoInscricao = async (
  id: string,
  payload: CreateRegistrationPaymentPayload
): Promise<RegistrationDetails> => {
  const response = await api.post(`/api/public/events/registrations/${id}/payments`, payload);
  return response.data;
};

// Buscar formas de pagamento do evento
export const buscarFormasPagamento = async (eventId: string): Promise<PaymentOption[]> => {
  const cacheKey = `payment-options-${eventId}`;
  
  // Tentar cache primeiro
  const cached = getCached<PaymentOption[]>(cacheKey);
  if (cached) {
    return cached;
  }
  
  // Se não tem cache, buscar da API
  const response = await api.get(`/api/public/events/${eventId}/payment-options`);
  setCache(cacheKey, response.data);
  
  return response.data;
};

export default api;

