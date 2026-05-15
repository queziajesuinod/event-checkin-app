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
  permissoes?: string[];
}

export interface EventSummary {
  id: string;
  title?: string;
  name?: string;
  imageUrl?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  date?: string | null;
  isActive?: boolean;
  active?: boolean;
  ativo?: boolean;
  status?: string | null;
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

export interface AreaVoluntariado {
  id: string;
  nome: string;
}

export interface VoluntariadoEntrada {
  areaVoluntariadoId: string;
  campusId?: string;
  ministerioId?: string;
  dataInicio: string;
  observacao?: string;
}

export interface VoluntariadoInput {
  memberId: string;
  areaVoluntariadoId: string;
  dataInicio: string;
  campusId?: string;
  ministerioId?: string;
  observacao?: string;
}

export interface Voluntariado {
  id: string;
  memberId: string;
  areaVoluntariadoId: string;
  campusId?: string;
  ministerioId?: string;
  dataInicio: string;
  dataFim?: string;
  status: string;
  observacao?: string;
  membro?: { id: string; nome: string; email?: string };
  area?: AreaVoluntariado;
  campus?: { id: string; nome: string };
  ministerio?: { id: string; nome: string };
}

export interface VoluntariadoPublicPayload {
  fullName: string;
  preferredName?: string;
  email: string;
  cpf: string;
  phone: string;
  birthDate: string;
  voluntariados: VoluntariadoEntrada[];
}

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

const publicApi = axios.create({
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

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("authToken");
      localStorage.removeItem("user");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

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

export const voluntariadoPublicAPI = {
  listarAreas: () => publicApi.get<AreaVoluntariado[]>("/api/public/voluntariado/areas"),
  listarCampi: () => publicApi.get<Campus[]>("/api/public/voluntariado/campus"),
  listarMinisteriosPorCampus: (campusId: string) =>
    publicApi.get<{ id: string; nome: string }[]>(
      `/api/public/voluntariado/campus/${campusId}/ministerios`,
    ),
  cadastrar: (payload: VoluntariadoPublicPayload) =>
    publicApi.post("/api/public/voluntariado", payload),
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
  userId?: string;
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

// ── Interfaces para Célula ──────────────────────────────────────────────────

export interface MinhacelulInfo {
  id: string;
  nome: string;
  diaSemana?: string;
  horario?: string;
  lider?: { id: string; nome: string };
}

export interface CelulaMembro {
  id: string;
  papel: string;
  dataEntrada: string;
  membro: {
    id: string;
    fullName: string;
    preferredName?: string;
    phone?: string;
    whatsapp?: string;
    photoUrl?: string;
    status?: string;
  };
}

export interface CelulaMemboCandidato {
  id: string;
  fullName: string;
  preferredName?: string;
  phone?: string;
  photoUrl?: string;
  celulaAtual?: { id: string; celula: string; lider: string } | null;
}

export interface CelulaReuniaoItem {
  id: string;
  data: string;
  status: string;
  origem: string;
  observacoes?: string;
}

export interface CelulaPresencaItem {
  tipo: "membro" | "avulso";
  membroId?: string;
  preCadastroId?: string;
  nome: string;
  fotoUrl?: string;
  papel?: string;
  tipoPessoa?: string;
  telefone?: string;
  presente: boolean | null;
  presencaId?: string;
  totalPresencas?: number;
  promotable?: boolean;
}

export interface CelulaRelatorio {
  lider: string;
  discipulos: number;
  visitantes: number;
  total: number;
  paraPromover: Array<{ id: string; nome: string; tipo: string; totalPresencas: number }>;
}

export interface CelulaPresencaData {
  reuniao: { id: string; data: string; status: string; celulaId: string };
  membros: CelulaPresencaItem[];
  avulsos: CelulaPresencaItem[];
}

export const celulaAPI = {
  minhacelula: () =>
    api.get<MinhacelulInfo>("/api/admin/celulas-presenca/minha-celula"),

  listarMembros: (celulaId: string) =>
    api.get<CelulaMembro[]>(`/api/admin/celulas-presenca/${celulaId}/membros`),

  buscarCandidatos: (celulaId: string, q: string) =>
    api.get<CelulaMemboCandidato[]>(
      `/api/admin/celulas-presenca/${celulaId}/membros-candidatos`,
      { params: { q } }
    ),

  vincularMembro: (
    celulaId: string,
    payload: { membroId: string; papel: string; dataEntrada: string }
  ) =>
    api.post<{
      id: string;
      celulaId: string;
      membroId: string;
      papel: string;
      dataEntrada: string;
      aviso?: { celulaAnteriorId: string; celulaAnteriorNome: string; liderAnterior: string } | null;
    }>(`/api/admin/celulas-presenca/${celulaId}/membros`, payload),

  cadastrarEVincular: (
    celulaId: string,
    payload: {
      fullName: string;
      preferredName?: string;
      phone?: string;
      whatsapp?: string;
      email?: string;
      gender?: string;
      birthDate?: string;
      papel: string;
    }
  ) =>
    api.post<{ membro: { id: string; fullName: string }; vinculo: { id: string } }>(
      `/api/admin/celulas-presenca/${celulaId}/membros/cadastrar`,
      payload
    ),

  desvincularMembro: (celulaId: string, membroId: string) =>
    api.delete<{ mensagem: string }>(
      `/api/admin/celulas-presenca/${celulaId}/membros/${membroId}`
    ),

  editarMembro: (
    celulaId: string,
    membroId: string,
    payload: { fullName: string; preferredName?: string; phone?: string; whatsapp?: string; papel?: string }
  ) =>
    api.patch<{ mensagem: string; membro: { id: string; fullName: string; preferredName?: string; phone?: string; whatsapp?: string }; papel?: string }>(
      `/api/admin/celulas-presenca/${celulaId}/membros/${membroId}`,
      payload
    ),

  statsMembro: (celulaId: string, membroId: string) =>
    api.get(`/api/admin/celulas-presenca/${celulaId}/membros/${membroId}/stats`),

  listarReunioes: (
    celulaId: string,
    params?: { status?: string; limit?: number; offset?: number }
  ) =>
    api.get<{ total: number; reunioes: CelulaReuniaoItem[] }>(
      `/api/admin/celulas-presenca/${celulaId}/reunioes`,
      { params }
    ),

  criarReuniao: (celulaId: string, payload: { data: string; observacoes?: string }) =>
    api.post<CelulaReuniaoItem>(
      `/api/admin/celulas-presenca/${celulaId}/reunioes`,
      payload
    ),

  sugerirReunioes: (celulaId: string, semanas?: number) =>
    api.get<Array<{ data: string; diaSemana: string; horario: string; jaExiste: boolean }>>(
      `/api/admin/celulas-presenca/${celulaId}/reunioes/sugestoes`,
      { params: { semanas } }
    ),

  confirmarSugestoes: (celulaId: string, datas: string[]) =>
    api.post<{ mensagem: string; criadas: number }>(
      `/api/admin/celulas-presenca/${celulaId}/reunioes/confirmar`,
      { datas }
    ),

  excluirReuniao: (reuniaoId: string) =>
    api.delete<{
      mensagem: string;
      presencasRemovidas: number;
      pontosRemovidos: number;
      foiEncerrada: boolean;
    }>(`/api/admin/celulas-presenca/reunioes/${reuniaoId}`),

  cancelarReuniao: (reuniaoId: string, motivo?: string) =>
    api.patch(`/api/admin/celulas-presenca/reunioes/${reuniaoId}/cancelar`, { motivo }),

  reabrirReuniao: (reuniaoId: string) =>
    api.patch<CelulaReuniaoItem>(
      `/api/admin/celulas-presenca/reunioes/${reuniaoId}/reabrir`
    ),

  editarReuniao: (reuniaoId: string, payload: { data?: string }) =>
    api.patch<CelulaReuniaoItem>(
      `/api/admin/celulas-presenca/reunioes/${reuniaoId}`,
      payload
    ),

  obterPresenca: (reuniaoId: string) =>
    api.get<CelulaPresencaData>(
      `/api/admin/celulas-presenca/reunioes/${reuniaoId}/presenca`
    ),

  salvarPresencas: (
    reuniaoId: string,
    presencas: Array<{ membroId?: string; preCadastroId?: string; presente: boolean }>
  ) =>
    api.post<{ mensagem: string; relatorio: CelulaRelatorio }>(
      `/api/admin/celulas-presenca/reunioes/${reuniaoId}/presenca`,
      { presencas }
    ),

  adicionarAvulso: (
    reuniaoId: string,
    payload: { nome: string; telefone?: string; whatsapp?: string; tipo: string }
  ) =>
    api.post(`/api/admin/celulas-presenca/reunioes/${reuniaoId}/presenca/avulso`, payload),

  promoverPreCadastro: (celulaId: string, preCadastroId: string) =>
    api.post<{ membro: { id: string; fullName: string }; mensagem: string }>(
      `/api/admin/celulas-presenca/${celulaId}/pre-cadastros/${preCadastroId}/promover`
    ),

  atualizarTipoAvulso: (celulaId: string, preCadastroId: string, tipo: string) =>
    api.patch<{ mensagem: string; tipo: string }>(
      `/api/admin/celulas-presenca/${celulaId}/pre-cadastros/${preCadastroId}`,
      { tipo }
    ),
};

export { checkInAPI, cultosAPI };

export default api;
