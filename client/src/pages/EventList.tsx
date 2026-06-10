import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Calendar, MapPin, Search, Tag, X, ChevronRight } from 'lucide-react';
import { listarEventosPublicos, listarLotesPublicos, type Event } from '@/lib/eventsApi';
import { getActiveBatches, sumAvailableSeats } from '@/lib/eventUtils';

type BatchAvailability = {
  hasActiveBatch: boolean;
  availableSeats: number | null;
  activeBatchNames: string[];
};

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const handler = () => setReduced(mq.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return reduced;
}

function EventsHeroBanner({
  events,
  onSelect,
}: {
  events: Event[];
  onSelect: (id: string) => void;
}) {
  const [index, setIndex] = useState(0);
  const [scrollY, setScrollY] = useState(0);
  const reducedMotion = usePrefersReducedMotion();

  // Avança automaticamente os slides
  useEffect(() => {
    if (events.length <= 1) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % events.length);
    }, 5000);
    return () => clearInterval(id);
  }, [events.length]);

  // Garante índice válido se a lista mudar
  useEffect(() => {
    if (index >= events.length) setIndex(0);
  }, [events.length, index]);

  // Parallax no scroll
  useEffect(() => {
    if (reducedMotion) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setScrollY(window.scrollY));
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(raf);
    };
  }, [reducedMotion]);

  if (events.length === 0) return null;

  const atual = events[Math.min(index, events.length - 1)];
  const parallax = reducedMotion ? 0 : Math.min(scrollY * 0.4, 220);
  const formatarData = (data: string) =>
    new Date(data).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });

  return (
    <section className="relative h-[58vh] min-h-[360px] max-h-[560px] w-full overflow-hidden">
      {/* Slides com parallax + crossfade */}
      {events.map((ev, i) => (
        <div
          key={ev.id}
          className={`absolute inset-0 transition-opacity duration-1000 ease-out ${
            i === index ? 'opacity-100' : 'opacity-0'
          }`}
          aria-hidden={i !== index}
        >
          {ev.imageUrl ? (
            <div className={`w-full h-full ${i === index ? 'animate-ken-burns' : ''}`}>
              <img
                src={ev.imageUrl}
                alt={ev.title}
                style={{ transform: `translate3d(0, ${parallax}px, 0) scale(1.2)` }}
                className="w-full h-full object-cover will-change-transform"
              />
            </div>
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-orange-400 to-amber-500" />
          )}
        </div>
      ))}

      {/* Overlay para legibilidade */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/25" />

      {/* Legenda */}
      <div className="absolute inset-x-0 bottom-0">
        <div key={atual.id} className="container max-w-6xl mx-auto px-4 pb-10 sm:pb-12 animate-fade-in-up">
          <span className="inline-flex items-center gap-1.5 bg-green-500/90 text-white text-xs font-semibold uppercase tracking-wide px-3 py-1 rounded-full">
            <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
            Inscrições abertas
            {atual.eventType ? ` · ${atual.eventType}` : ''}
          </span>

          <h2 className="mt-3 text-3xl sm:text-4xl font-extrabold text-white leading-tight drop-shadow-md max-w-3xl">
            {atual.title}
          </h2>

          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-white/90 text-sm">
            <span className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4 text-white/70" />
              {formatarData(atual.startDate)}
            </span>
            {(atual.location || atual.city) && (
              <span className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-white/70" />
                {atual.location || atual.city}
              </span>
            )}
          </div>

          <Button
            onClick={() => onSelect(atual.id)}
            className="mt-5 h-11 px-6 font-semibold"
            size="lg"
          >
            Ver detalhes
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>

      {/* Indicadores (dots) */}
      {events.length > 1 && (
        <div className="absolute bottom-5 right-4 sm:right-8 flex gap-2">
          {events.map((ev, i) => (
            <button
              key={ev.id}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Ir para ${ev.title}`}
              className={`h-2 rounded-full transition-all cursor-pointer ${
                i === index ? 'w-6 bg-white' : 'w-2 bg-white/50 hover:bg-white/80'
              }`}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export default function EventList() {
  const [, setLocation] = useLocation();
  const [eventos, setEventos] = useState<Event[]>([]);
  const [batchAvailability, setBatchAvailability] = useState<Record<string, BatchAvailability>>({});
  const [loadingBatchAvailability, setLoadingBatchAvailability] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [tipoSelecionado, setTipoSelecionado] = useState<string>('todos');

  // Tipos de evento disponíveis (derivados dinamicamente dos eventos carregados)
  const tiposDisponiveis = useMemo(() => {
    const set = new Set<string>();
    for (const evento of eventos) {
      if (evento.eventType) set.add(evento.eventType);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [eventos]);

  const eventoEstaAberto = (evento: Event) => {
    const vagas = evento.maxRegistrations
      ? evento.maxRegistrations - evento.currentRegistrations
      : null;
    const esgotado = vagas !== null && vagas <= 0;
    const availability = batchAvailability[evento.id];
    const carregando = loadingBatchAvailability[evento.id] ?? true;
    // Enquanto carrega, trata como aberto (otimista) para evitar "pulo" para encerrados.
    if (carregando) return true;
    return Boolean(availability?.hasActiveBatch) && !esgotado;
  };

  const eventosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return eventos.filter((evento) => {
      const matchTipo = tipoSelecionado === 'todos' || evento.eventType === tipoSelecionado;
      const matchBusca =
        !termo ||
        evento.title.toLowerCase().includes(termo) ||
        (evento.location || '').toLowerCase().includes(termo) ||
        (evento.city || '').toLowerCase().includes(termo);
      return matchTipo && matchBusca;
    });
  }, [eventos, busca, tipoSelecionado]);

  const eventosAbertos = useMemo(
    () => eventosFiltrados.filter(eventoEstaAberto),
    [eventosFiltrados, batchAvailability, loadingBatchAvailability]
  );
  const eventosEncerrados = useMemo(
    () => eventosFiltrados.filter((evento) => !eventoEstaAberto(evento)),
    [eventosFiltrados, batchAvailability, loadingBatchAvailability]
  );
  const temFiltroAtivo = busca.trim() !== '' || tipoSelecionado !== 'todos';

  const verificarDisponibilidadeLotes = async (listaEventos: Event[]) => {
    if (!listaEventos.length) {
      setBatchAvailability({});
      setLoadingBatchAvailability({});
      return;
    }

    setLoadingBatchAvailability(
      Object.fromEntries(listaEventos.map((evento) => [evento.id, true]))
    );

    const hoje = new Date();
    const availabilityEntries = await Promise.all(
      listaEventos.map(async (evento) => {
        try {
          const lotes = await listarLotesPublicos(evento.id, { skipCache: true });
          const activeBatches = getActiveBatches(lotes, hoje);
          return {
            id: evento.id,
            hasActiveBatch: activeBatches.length > 0,
            availableSeats: sumAvailableSeats(activeBatches),
            activeBatchNames: activeBatches.map((batch) => batch.name).filter(Boolean),
          };
        } catch (batchError) {
          console.error('Erro ao verificar lotes do evento:', evento.id, batchError);
          return {
            id: evento.id,
            hasActiveBatch: false,
            availableSeats: null,
            activeBatchNames: [],
          };
        }
      })
    );

    const availabilityByEvent: Record<string, BatchAvailability> = {};
    availabilityEntries.forEach((entry) => {
      availabilityByEvent[entry.id] = {
        hasActiveBatch: entry.hasActiveBatch,
        availableSeats: entry.availableSeats,
        activeBatchNames: entry.activeBatchNames,
      };
    });

    setBatchAvailability(availabilityByEvent);
    setLoadingBatchAvailability(
      Object.fromEntries(listaEventos.map((evento) => [evento.id, false]))
    );
  };

  const agendarVerificacaoLotes = (listaEventos: Event[]) => {
    if (!listaEventos.length) {
      setBatchAvailability({});
      setLoadingBatchAvailability({});
      return;
    }

    // Yield para permitir paint inicial antes da verificacao de disponibilidade.
    setTimeout(() => {
      void verificarDisponibilidadeLotes(listaEventos);
    }, 0);
  };

  useEffect(() => {
    let mounted = true;

    const carregar = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await listarEventosPublicos();
        if (!mounted) return;
        setEventos(data);
        setBatchAvailability({});
        setLoadingBatchAvailability({});
        setLoading(false);
        agendarVerificacaoLotes(data);
      } catch (err) {
        if (!mounted) return;
        console.error('Erro ao carregar eventos:', err);
        setError('Erro ao carregar eventos. Tente novamente mais tarde.');
        setLoading(false);
      }
    };

    void carregar();

    return () => {
      mounted = false;
    };
  }, []);

  const carregarEventos = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await listarEventosPublicos();
      setEventos(data);
      setBatchAvailability({});
      setLoadingBatchAvailability({});
      setLoading(false);
      agendarVerificacaoLotes(data);
    } catch (err) {
      console.error('Erro ao carregar eventos:', err);
      setError('Erro ao carregar eventos. Tente novamente mais tarde.');
    } finally {
      setLoading(false);
    }
  };

  const formatarData = (data: string) => {
    return new Date(data).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  };

  const calcularVagasDisponiveis = (evento: Event) => {
    if (!evento.maxRegistrations) return null;
    return evento.maxRegistrations - evento.currentRegistrations;
  };

  const renderCard = (evento: Event, index = 0) => {
    const vagasDisponiveis = calcularVagasDisponiveis(evento);
    const esgotado = vagasDisponiveis !== null && vagasDisponiveis <= 0;
    const availability = batchAvailability[evento.id];
    const availabilityLoading = loadingBatchAvailability[evento.id] ?? true;
    const possuiLoteAtivo = availability?.hasActiveBatch ?? false;
    const podeIrDetalhes = !availabilityLoading && possuiLoteAtivo && !esgotado;
    const encerrado = !availabilityLoading && (!possuiLoteAtivo || esgotado);
    const botaoLabel = availabilityLoading
      ? 'Verificando...'
      : esgotado
        ? 'Esgotado'
        : possuiLoteAtivo
          ? 'Ver detalhes'
          : 'Encerrado';

    return (
      <div
        key={evento.id}
        style={{ animationDelay: `${Math.min(index, 8) * 70}ms` }}
        className={`animate-fade-in-up group flex flex-col bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm transition-all duration-300 ${
          encerrado
            ? 'opacity-75 hover:opacity-100 hover:shadow-md'
            : 'hover:shadow-xl hover:-translate-y-1.5 hover:ring-1 hover:ring-primary/20'
        }`}
      >
        <div className="aspect-[16/9] overflow-hidden bg-slate-100 relative">
          {evento.imageUrl ? (
            <>
              <img
                src={evento.imageUrl}
                alt={evento.title}
                loading="lazy"
                decoding="async"
                className={`w-full h-full object-cover transition-transform duration-500 ease-out ${
                  encerrado ? 'grayscale-[35%]' : 'group-hover:scale-110'
                }`}
              />
              {esgotado && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <span className="bg-white/20 backdrop-blur text-white font-semibold text-sm px-4 py-1.5 rounded-full">
                    Esgotado
                  </span>
                </div>
              )}
            </>
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-orange-100 to-amber-200 flex items-center justify-center">
              <Calendar className="h-10 w-10 text-orange-400" />
            </div>
          )}

          {/* Badge do tipo de evento */}
          {evento.eventType && (
            <span className="absolute top-3 left-3 inline-flex items-center gap-1 bg-black/55 backdrop-blur-sm text-white text-[11px] font-semibold uppercase tracking-wide px-2.5 py-1 rounded-full">
              <Tag className="h-3 w-3" />
              {evento.eventType}
            </span>
          )}
        </div>

        <div className="flex flex-col flex-1 p-5 gap-3">
          <div>
            <h3 className="font-semibold text-slate-900 text-base leading-snug line-clamp-2">
              {evento.title}
            </h3>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <span>{formatarData(evento.startDate)}</span>
            </div>
            {(evento.location || evento.city) && (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                <span className="line-clamp-1">{evento.location || evento.city}</span>
              </div>
            )}
          </div>

          {availabilityLoading ? (
            <div className="h-5 w-28 animate-pulse rounded-full bg-slate-100" />
          ) : availability?.activeBatchNames && availability.activeBatchNames.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {availability.activeBatchNames.map((name) => (
                <span
                  key={name}
                  className="text-xs bg-orange-50 text-orange-600 font-medium px-2.5 py-0.5 rounded-full border border-orange-100"
                >
                  {name}
                </span>
              ))}
            </div>
          ) : null}

          <div className="mt-auto pt-1">
            <Button
              onClick={() => setLocation(`/eventos/${evento.id}`)}
              disabled={!podeIrDetalhes}
              className="w-full"
              variant={encerrado ? 'secondary' : 'default'}
            >
              {botaoLabel}
            </Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-b from-orange-50/70 via-slate-50 to-slate-100">
      {/* Blobs decorativos desfocados — dão profundidade ao fundo */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-28 -left-24 h-80 w-80 rounded-full bg-orange-300/30 blur-3xl" />
        <div className="absolute top-24 -right-24 h-80 w-80 rounded-full bg-amber-300/25 blur-3xl" />
        <div className="absolute bottom-10 left-1/3 h-72 w-72 rounded-full bg-blue-300/20 blur-3xl" />
      </div>

      {/* Banner parallax com os eventos ativos */}
      {!loading && !error && eventosAbertos.length > 0 && (
        <EventsHeroBanner
          key={eventosAbertos.map((e) => e.id).join('|')}
          events={eventosAbertos}
          onSelect={(id) => setLocation(`/eventos/${id}`)}
        />
      )}

      {/* Header + toolbar */}
      <div className="relative bg-white/70 backdrop-blur-md border-b border-white/60 shadow-sm">
        <div className="container max-w-6xl mx-auto px-4 py-6 space-y-5">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
              Eventos
            </h1>
            <p className="text-slate-500 text-sm mt-1">Escolha um evento e garanta sua vaga</p>
          </div>

          {!loading && !error && eventos.length > 0 && (
            <div className="space-y-3">
              {/* Busca */}
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar por nome, local ou cidade..."
                  className="w-full h-11 pl-10 pr-10 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-700 placeholder:text-slate-400 focus:bg-white focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-colors"
                />
                {busca && (
                  <button
                    type="button"
                    onClick={() => setBusca('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    aria-label="Limpar busca"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Chips de tipo de evento */}
              {tiposDisponiveis.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setTipoSelecionado('todos')}
                    className={`px-3.5 py-1.5 rounded-full text-sm font-medium border transition-colors cursor-pointer ${
                      tipoSelecionado === 'todos'
                        ? 'bg-primary text-white border-primary'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    Todos
                  </button>
                  {tiposDisponiveis.map((tipo) => (
                    <button
                      key={tipo}
                      type="button"
                      onClick={() => setTipoSelecionado(tipo)}
                      className={`px-3.5 py-1.5 rounded-full text-sm font-medium border transition-colors cursor-pointer ${
                        tipoSelecionado === tipo
                          ? 'bg-primary text-white border-primary'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      {tipo}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="relative container max-w-6xl mx-auto px-4 py-8">
        {error ? (
          <div className="max-w-md mx-auto bg-white rounded-2xl border border-red-200 p-6 text-center space-y-4">
            <p className="text-red-700 font-medium">{error}</p>
            <Button onClick={carregarEventos} variant="outline" className="w-full">
              Tentar novamente
            </Button>
          </div>
        ) : loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={`sk-${i}`} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div className="aspect-[16/9] w-full animate-pulse bg-slate-200" />
                <div className="p-5 space-y-3">
                  <div className="h-5 w-3/4 animate-pulse rounded bg-slate-200" />
                  <div className="h-4 w-full animate-pulse rounded bg-slate-200" />
                  <div className="h-4 w-2/3 animate-pulse rounded bg-slate-200" />
                  <div className="h-9 w-full animate-pulse rounded-lg bg-slate-200 mt-2" />
                </div>
              </div>
            ))}
          </div>
        ) : eventos.length === 0 ? (
          <div className="max-w-sm mx-auto text-center py-16">
            <Calendar className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <p className="font-medium text-slate-600">Nenhum evento disponível</p>
            <p className="text-sm text-slate-400 mt-1">Volte em breve para conferir novidades.</p>
          </div>
        ) : eventosFiltrados.length === 0 ? (
          <div className="max-w-sm mx-auto text-center py-16">
            <Search className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <p className="font-medium text-slate-600">Nenhum evento encontrado</p>
            <p className="text-sm text-slate-400 mt-1">Tente ajustar a busca ou os filtros.</p>
            {temFiltroAtivo && (
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => {
                  setBusca('');
                  setTipoSelecionado('todos');
                }}
              >
                Limpar filtros
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-10">
            {/* Inscrições abertas */}
            {eventosAbertos.length > 0 && (
              <section>
                <div className="flex items-center gap-2.5 mb-4">
                  <span className="h-2.5 w-2.5 rounded-full bg-green-500" />
                  <h2 className="text-lg font-bold text-slate-900">Inscrições abertas</h2>
                  <span className="text-xs font-semibold text-green-700 bg-green-50 border border-green-100 px-2 py-0.5 rounded-full">
                    {eventosAbertos.length}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {eventosAbertos.map(renderCard)}
                </div>
              </section>
            )}

            {/* Encerrados */}
            {eventosEncerrados.length > 0 && (
              <section>
                <div className="flex items-center gap-2.5 mb-4">
                  <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
                  <h2 className="text-lg font-bold text-slate-500">Encerrados</h2>
                  <span className="text-xs font-semibold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
                    {eventosEncerrados.length}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {eventosEncerrados.map(renderCard)}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
