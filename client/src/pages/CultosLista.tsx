import { useHeader } from '@/contexts/HeaderContext';
import { cultosAPI, type Campus, type Ministerio, type RegistroCulto, type TipoEvento } from '@/lib/api';
import { CalendarDays, ChevronRight, Clock, Loader2, MapPin, Pencil, Plus, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'wouter';
import { toast } from 'sonner';

const C = {
  navy: '#172b46',
  blue: '#244ac0',
  sky: '#55739a',
  surface: '#f1f4f7',
  gold: '#C9A84C',
  white: '#FFFFFF',
};

// Mês vigente no formato YYYY-MM usando a data LOCAL. Não usar toISOString()
// (converte para UTC e, em fusos a oeste, à noite pode pular para o mês seguinte).
const mesVigente = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

// Verdadeiro quando a data "YYYY-MM-DD" pertence ao mês vigente.
export const isMesVigente = (data?: string) => Boolean(data) && data!.slice(0, 7) === mesVigente();

const CultosLista = () => {
  const [, setLocation] = useLocation();
  useHeader({ backTo: '/home', backLabel: 'Início', subtitle: 'Registro de Cultos' });

  const [registros, setRegistros] = useState<RegistroCulto[]>([]);
  const [tiposEvento, setTiposEvento] = useState<TipoEvento[]>([]);
  const [campi, setCampi] = useState<Campus[]>([]);
  const [ministerios, setMinisterios] = useState<Ministerio[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      try {
        const [regRes, tiposRes, campiRes, minRes] = await Promise.all([
          cultosAPI.listarRegistros(),
          cultosAPI.listarTiposEvento(),
          cultosAPI.listarCampi(),
          cultosAPI.listarMinisterios(),
        ]);
        const lista: RegistroCulto[] = Array.isArray(regRes.data) ? regRes.data : [];
        setRegistros(lista);
        setTiposEvento(Array.isArray(tiposRes.data) ? tiposRes.data : []);
        setCampi(Array.isArray(campiRes.data) ? campiRes.data : []);
        setMinisterios(Array.isArray(minRes.data) ? minRes.data : []);
      } catch {
        toast.error('Erro ao carregar os registros do mês');
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const tipoNome = (id?: string) => tiposEvento.find((t) => t.id === id)?.nome ?? '';
  const campusNome = (r: RegistroCulto) => r.campus?.nome ?? campi.find((c) => c.id === r.campusId)?.nome ?? '';
  const ministerioNome = (r: RegistroCulto) => ministerios.find((m) => m.id === r.ministerioId)?.nome ?? '';

  // Só os cultos do mês vigente, ordenados do mais recente para o mais antigo.
  const doMes = useMemo(
    () =>
      registros
        .filter((r) => isMesVigente(r.data))
        .sort((a, b) => (b.data + (b.horario || '')).localeCompare(a.data + (a.horario || ''))),
    [registros],
  );

  const tituloMes = useMemo(() => {
    const d = new Date();
    const label = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    return label.charAt(0).toUpperCase() + label.slice(1);
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: C.blue }} />
      </div>
    );
  }

  return (
    <div className="portal-page min-h-screen pb-28" style={{ backgroundColor: C.surface }}>
      <div className="w-full max-w-2xl mx-auto px-4 pt-6">
        {/* Título da página */}
        <div className="portal-heading">
          <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: C.gold }}>
            Cultos de {tituloMes}
          </p>
          <h1 className="text-2xl font-extrabold" style={{ color: C.navy }}>
            Registros do mês
          </h1>
          <p className="text-sm mt-1" style={{ color: C.sky }}>
            Apenas os cultos do mês vigente podem ser editados.
          </p>
        </div>

        {/* Lista */}
        {doMes.length === 0 ? (
          <div
            className="portal-panel flex flex-col items-center text-center px-6 py-12 mt-2"
            style={{ backgroundColor: C.white, boxShadow: 'none' }}
          >
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center mb-4"
              style={{ backgroundColor: C.surface }}
            >
              <CalendarDays className="w-7 h-7" style={{ color: C.sky }} />
            </div>
            <p className="font-semibold text-sm" style={{ color: C.navy }}>
              Nenhum culto registrado neste mês
            </p>
            <p className="text-xs mt-1" style={{ color: '#9CA3AF' }}>
              Toque em "Registrar culto" para adicionar o primeiro.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {doMes.map((r) => {
              const total =
                (r.qtdHomens ?? 0) + (r.qtdMulheres ?? 0) + (r.qtdVoluntarios ?? 0);
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setLocation(`/cultos/${r.id}`)}
                  className="portal-panel w-full text-left overflow-hidden transition-all duration-150 active:scale-[0.99]"
                  style={{ backgroundColor: C.white, boxShadow: 'none' }}
                >
                  <div className="p-4 flex items-center gap-3">
                    {/* Dia */}
                    <div
                      className="w-12 h-12 rounded-xl flex flex-col items-center justify-center flex-shrink-0 leading-none"
                      style={{ backgroundColor: C.surface }}
                    >
                      <span className="text-lg font-extrabold" style={{ color: C.blue }}>
                        {r.data?.slice(8, 10)}
                      </span>
                      <span className="text-[10px] font-semibold uppercase mt-0.5" style={{ color: C.sky }}>
                        {new Date(r.data + 'T00:00:00')
                          .toLocaleDateString('pt-BR', { weekday: 'short' })
                          .replace('.', '')}
                      </span>
                    </div>

                    {/* Conteúdo */}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm uppercase truncate" style={{ color: C.navy }}>
                        {r.tituloMensagem || 'Sem título'}
                      </p>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                        {r.horario && (
                          <span className="flex items-center gap-1 text-xs" style={{ color: C.sky }}>
                            <Clock className="w-3 h-3" />
                            {r.horario}
                          </span>
                        )}
                        {campusNome(r) && (
                          <span className="flex items-center gap-1 text-xs truncate" style={{ color: C.sky }}>
                            <MapPin className="w-3 h-3 flex-shrink-0" />
                            {campusNome(r)}
                          </span>
                        )}
                        {total > 0 && (
                          <span className="flex items-center gap-1 text-xs" style={{ color: C.sky }}>
                            <Users className="w-3 h-3" />
                            {total}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {ministerioNome(r) && (
                          <span
                            className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide"
                            style={{ backgroundColor: '#EBF2FB', color: C.blue }}
                          >
                            {ministerioNome(r)}
                          </span>
                        )}
                        {tipoNome(r.tipoEventoId) && (
                          <span
                            className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide"
                            style={{ backgroundColor: C.surface, color: C.sky }}
                          >
                            {tipoNome(r.tipoEventoId)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Ação */}
                    <div className="flex items-center gap-1 flex-shrink-0" style={{ color: C.blue }}>
                      <Pencil className="w-4 h-4" />
                      <ChevronRight className="w-4 h-4" style={{ color: '#C7CDD6' }} />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Barra de ação flutuante */}
      <div
        className="fixed bottom-0 left-0 right-0 px-4 py-4"
        style={{ backgroundColor: C.white, boxShadow: '0 -4px 20px rgba(10,31,63,0.10)' }}
      >
        <div className="w-full max-w-2xl mx-auto">
          <button
            type="button"
            onClick={() => setLocation('/cultos')}
            className="w-full h-12 rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.98]"
            style={{ backgroundColor: C.blue }}
          >
            <Plus className="w-4 h-4" />
            Registrar culto
          </button>
        </div>
      </div>
    </div>
  );
};

export default CultosLista;
