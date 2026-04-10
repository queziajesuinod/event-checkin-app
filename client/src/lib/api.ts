import axios from "axios";

const rawApiUrl = import.meta.env.VITE_API_URL;
const API_BASE_URL = rawApiUrl
  ? rawApiUrl.replace(/^['"]|['"]$/g, '').replace(/\/+$/, '')
  : 'http://localhost:3005';

export interface LoginResponse {
  accessToken?: string;
  userId?: string;
  id?: string;
  nome?: string;
  name?: string;
}

export interface EventSummary {
  id: string;
  title?: string;
  name?: string;
  imageUrl?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  date?: string | null;
  location?: string;
  description?: string;
}

export interface CheckInSchedulePayload {
  eventId: string;
  name: string;
  startTime: string;
  endTime: string;
  isActive: boolean;
}

export interface UpdateCheckInSchedulePayload {
  eventId?: string;
  name?: string;
  startTime?: string;
  endTime?: string;
  isActive?: boolean;
}

export interface CheckInStationPayload {
  eventId: string;
  name: string;
  latitude: number;
  longitude: number;
  nfcTagId: string;
  isActive: boolean;
}

export interface UpdateCheckInStationPayload {
  eventId?: string;
  name?: string;
  latitude?: number;
  longitude?: number;
  nfcTagId?: string;
  isActive?: boolean;
}

export interface ManualCheckInPayload {
  orderCode: string;
  eventId: string;
  attendeeId?: string;
  stationId?: string;
  notes?: string;
}

export interface CodeCheckInPayload {
  eventId?: string;
  event_id?: string;
  attendeeId?: string;
  notes?: string;
  orderCode?: string;
  qrcode?: string;
  qrCode?: string;
  nfcTagId?: string;
  tagId?: string;
  registrationId?: string;
}

export interface CheckInListParams {
  scheduleId?: string;
  stationId?: string;
  checkInMethod?: string;
  dataInicio?: string;
  dataFim?: string;
  page?: number;
  pageSize?: number;
  limit?: number;
  offset?: number;
}

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("authToken");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const authAPI = {
  login: (email: string, password: string) => api.post<LoginResponse>("/auth/login", { email, password }),
  logout: () => {
    localStorage.removeItem("authToken");
    localStorage.removeItem("user");
  },
};

export const eventsAPI = {
  list: () => api.get<EventSummary[]>("/api/admin/events"),
  getById: (id: string) => api.get(`/api/admin/events/${id}`),
  getTicketsSummary: (eventId: string) => api.get(`/api/admin/events/${eventId}/tickets-summary`),
};

const checkInAPI = {
  createSchedule: (payload: CheckInSchedulePayload) => api.post("/api/admin/checkin/schedules", payload),
  listSchedules: (eventId: string) => api.get(`/api/admin/checkin/events/${eventId}/schedules`),
  updateSchedule: (id: string, payload: UpdateCheckInSchedulePayload) =>
    api.put(`/api/admin/checkin/schedules/${id}`, payload),
  deleteSchedule: (id: string) => api.delete(`/api/admin/checkin/schedules/${id}`),
  createStation: (payload: CheckInStationPayload) => api.post("/api/admin/checkin/stations", payload),
  listStations: (eventId: string) => api.get(`/api/admin/checkin/events/${eventId}/stations`),
  updateStation: (id: string, payload: UpdateCheckInStationPayload) =>
    api.put(`/api/admin/checkin/stations/${id}`, payload),
  deleteStation: (id: string) => api.delete(`/api/admin/checkin/stations/${id}`),
  manual: (payload: ManualCheckInPayload) => api.post("/api/admin/checkin/manual", payload),
  qrcode: (payload: CodeCheckInPayload) => api.post("/api/public/checkin/qrcode", payload),
  nfc: (payload: CodeCheckInPayload) => api.post("/api/public/checkin/nfc", payload),
  listByEvent: (eventId: string, params?: CheckInListParams) =>
    api.get(`/api/admin/checkin/events/${eventId}/list`, { params }),
  stats: (eventId: string) => api.get(`/api/admin/checkin/events/${eventId}/stats`),
};

// Interfaces para Cultos
export interface Ministerio {
  id: string;
  nome: string;
  apeloDefault?: boolean;
  exibeCriancas?: boolean;
  exibeBebes?: boolean;
  exibeOnline?: boolean;
}

export interface TipoEvento {
  id: string;
  nome: string;
}

export interface Ministro {
  id: string;
  nome: string;
  ativo?: boolean;
}

export interface RegistroCulto {
  id?: string;
  data: string;
  horario: string;
  campusId: string;
  ministerioId: string;
  tipoEventoId: string;
  tituloMensagem: string;
  eSerie: boolean;
  nomeSerie?: string;
  qtdHomens: number;
  qtdMulheres: number;
  qtdCriancas?: number;
  qtdBebes?: number;
  qtdVoluntarios: number;
  qtdOnline?: number;
  teveApelo: boolean;
  qtdApelo?: number;
  comentarios?: string;
  ministros?: Ministro[];
  campus?: { id: string; nome: string };
}

export interface Campus {
  id: string;
  nome: string;
  transmiteOnline?: boolean;
}

const cultosAPI = {
  listarMinisteriosPorCampus: (campusId: string) => api.get(`/api/admin/cultos/campus/${campusId}/ministerios`),
  listarTiposEvento: (ativo?: boolean) => api.get('/api/admin/cultos/tipos-evento', { params: { ativo } }),
  criarRegistro: (dados: Omit<RegistroCulto, 'id'>) => api.post('/api/admin/cultos/registros', dados),
  buscarRegistro: (id: string) => api.get(`/api/admin/cultos/registros/${id}`),
  atualizarRegistro: (id: string, dados: Partial<RegistroCulto>) => api.put(`/api/admin/cultos/registros/${id}`, dados),
  deletarRegistro: (id: string) => api.delete(`/api/admin/cultos/registros/${id}`),
  listarMinistros: (ativo?: boolean) => api.get('/api/admin/cultos/ministros', { params: { ativo } }),
  criarMinistro: (dados: Omit<Ministro, 'id'>) => api.post('/api/admin/cultos/ministros', dados),
  listarRegistros: (filtros?: Record<string, any>) => api.get('/api/admin/cultos/registros', { params: filtros }),
  buscarDashboard: (filtros?: Record<string, any>) => api.get('/api/admin/cultos/registros/dashboard', { params: filtros }),

  // Ministros adicionais
  atualizarMinistro: (id: string, dados: Partial<Ministro>) => api.put(`/api/admin/cultos/ministros/${id}`, dados),
  alternarAtivoMinistro: (id: string) => api.patch(`/api/admin/cultos/ministros/${id}/ativo`),

  // Ministérios
  listarMinisterios: (apenasAtivos?: boolean) => api.get('/api/admin/cultos/ministerios', { params: apenasAtivos ? { ativo: true } : {} }),
  criarMinisterio: (dados: any) => api.post('/api/admin/cultos/ministerios', dados),
  atualizarMinisterio: (id: string, dados: any) => api.put(`/api/admin/cultos/ministerios/${id}`, dados),
  alternarAtivoMinisterio: (id: string) => api.patch(`/api/admin/cultos/ministerios/${id}/ativo`),

  // Tipos de Evento
  criarTipoEvento: (dados: any) => api.post('/api/admin/cultos/tipos-evento', dados),
  atualizarTipoEvento: (id: string, dados: any) => api.put(`/api/admin/cultos/tipos-evento/${id}`, dados),
  alternarAtivoTipoEvento: (id: string) => api.patch(`/api/admin/cultos/tipos-evento/${id}/ativo`),

  // Vínculos Campus × Ministério
  listarVinculosPorCampus: (campusId: string) => api.get(`/api/admin/cultos/campus/${campusId}/vinculos`),
  salvarVinculos: (campusId: string, ministerioIds: string[]) => api.put(`/api/admin/cultos/campus/${campusId}/vinculos`, { ministerioIds }),

  // Legacy (para compatibilidade)
  listarCampi: () => api.get('/start/campus'),
};

export { checkInAPI, cultosAPI };

export default api;
