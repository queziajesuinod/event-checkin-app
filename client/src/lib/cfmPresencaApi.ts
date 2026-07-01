import api from './api';

export interface CfmMateria {
  turmaMateriaId: string;
  nome: string;
}

export interface CfmScanResult {
  inscricaoId: string;
  nome: string;
  turma: string;
  materias: CfmMateria[];
  requiresSelection: boolean;
}

export interface CfmMarcarResult {
  jaRegistrado: boolean;
  presente: boolean;
}

export const cfmPresencaAPI = {
  scan: (tokenQr: string) =>
    api.post<CfmScanResult>('/api/cfm/checkin/scan', { tokenQr }),

  marcar: (tokenQr: string, turmaMateriaId: string) =>
    api.post<CfmMarcarResult>('/api/cfm/checkin/marcar', { tokenQr, turmaMateriaId }),
};
