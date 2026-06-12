import api from "./api";

// Origem pública (portal-iecg) onde ficam as telas /qa/:code e /qa/:code/ao-vivo
const rawApiUrl = import.meta.env.VITE_API_URL as string | undefined;
export const LIVE_QA_PUBLIC_BASE = rawApiUrl
  ? rawApiUrl.replace(/^['"]|['"]$/g, "").replace(/\/+$/, "")
  : "http://localhost:3005";

export interface LiveQaSession {
  id: string;
  code: string;
  title: string;
  description?: string | null;
  status: "open" | "closed";
  questionsLocked?: boolean;
  liveTheme?: unknown;
  createdAt?: string;
}

export interface LiveQaQuestion {
  id: string;
  sessionId: string;
  text: string;
  authorName?: string | null;
  status: "active" | "archived";
  isLive: boolean;
  answered: boolean;
  likesCount: number;
  createdAt?: string;
}

export interface QuestionsResponse {
  questions: LiveQaQuestion[];
  liveQuestionId: string | null;
}

export interface ModeratePayload {
  isLive?: boolean;
  answered?: boolean;
  status?: "active" | "archived";
}

export const liveQaAPI = {
  // Salas
  listSessions: () => api.get<LiveQaSession[]>("/api/admin/qa/sessions"),
  createSession: (data: { title: string; description?: string }) =>
    api.post<LiveQaSession>("/api/admin/qa/sessions", data),
  updateSession: (
    id: string,
    data: { title?: string; description?: string; status?: "open" | "closed"; questionsLocked?: boolean },
  ) => api.put<LiveQaSession>(`/api/admin/qa/sessions/${id}`, data),
  deleteSession: (id: string) => api.delete(`/api/admin/qa/sessions/${id}`),

  // Perguntas
  listQuestions: (sessionId: string) =>
    api.get<QuestionsResponse>(`/api/admin/qa/sessions/${sessionId}/questions`),
  moderateQuestion: (questionId: string, data: ModeratePayload) =>
    api.patch<LiveQaQuestion>(`/api/admin/qa/questions/${questionId}`, data),
  deleteQuestion: (questionId: string) => api.delete(`/api/admin/qa/questions/${questionId}`),
};

export const publicRoomUrl = (code: string) => `${LIVE_QA_PUBLIC_BASE}/qa/${code}`;
export const liveScreenUrl = (code: string) => `${LIVE_QA_PUBLIC_BASE}/qa/${code}/ao-vivo`;
