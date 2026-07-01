import { useEffect, useRef, useState } from 'react';
import { useHeader } from '@/contexts/HeaderContext';
import { cfmPresencaAPI, CfmScanResult } from '@/lib/cfmPresencaApi';
import { CheckCircle, AlertCircle, AlertTriangle, Loader2, QrCode, ChevronLeft, GraduationCap, ScanLine } from 'lucide-react';
import { useLocation } from 'wouter';

const JSQR_SCAN_INTERVAL_MS = 140;

const AMBER = '#D97706';
const NAVY  = '#0A1F3F';

const CORNER_CLASSES = [
  { pos: 'top-0 left-0',     borders: 'border-t-[3px] border-l-[3px] rounded-tl-xl' },
  { pos: 'top-0 right-0',    borders: 'border-t-[3px] border-r-[3px] rounded-tr-xl' },
  { pos: 'bottom-0 left-0',  borders: 'border-b-[3px] border-l-[3px] rounded-bl-xl' },
  { pos: 'bottom-0 right-0', borders: 'border-b-[3px] border-r-[3px] rounded-br-xl' },
];

type State =
  | { kind: 'idle' }
  | { kind: 'scanned'; rawToken: string; result: CfmScanResult }
  | { kind: 'marking'; rawToken: string; result: CfmScanResult; turmaMateriaId: string }
  | { kind: 'success'; nome: string; materia: string; jaRegistrado: boolean }
  | { kind: 'error'; message: string };

export default function CfmPresenca() {
  useHeader({ hide: true });
  const [, setLocation] = useLocation();
  const [state, setState] = useState<State>({ kind: 'idle' });
  const [cameraError, setCameraError] = useState('');
  const [isCameraActive, setIsCameraActive] = useState(false);

  const videoRef   = useRef<HTMLVideoElement>(null);
  const streamRef  = useRef<MediaStream | null>(null);
  const frameRef   = useRef<number>(0);
  const canvasRef  = useRef<HTMLCanvasElement | null>(null);
  const canvasCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const jsQrRef    = useRef<((data: Uint8ClampedArray, w: number, h: number) => { data: string } | null) | null>(null);
  const lastScanRef = useRef<{ raw: string; at: number }>({ raw: '', at: 0 });
  const isScanning  = useRef(false);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (state.kind === 'idle' && !isCameraActive) startCamera();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.kind]);

  const stopCamera = () => {
    cancelAnimationFrame(frameRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
    isScanning.current = false;
  };

  const startCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Câmera não suportada neste dispositivo.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setIsCameraActive(true);
      setCameraError('');
      isScanning.current = true;
      void scanLoop();
    } catch (_e) {
      setCameraError('Não foi possível acessar a câmera.');
    }
  };

  const scanLoop = async () => {
    const BDCtor = (window as Window & {
      BarcodeDetector?: new (opts?: { formats?: string[] }) => {
        detect: (src: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>>;
      };
    }).BarcodeDetector;

    const detector = BDCtor ? new BDCtor({ formats: ['qr_code'] }) : null;

    if (!detector) {
      try {
        const m = await import('jsqr');
        jsQrRef.current = m.default as (data: Uint8ClampedArray, w: number, h: number) => { data: string } | null;
      } catch (_e) {
        setCameraError('Leitor de QR indisponível. Use Chrome ou Edge.');
        return;
      }
    }

    let lastJsQrAt = 0;

    const frame = async () => {
      if (!isScanning.current || !videoRef.current || !streamRef.current) return;
      try {
        let raw = '';
        const video = videoRef.current;
        if (detector) {
          const codes = await detector.detect(video);
          raw = codes.find(c => c.rawValue)?.rawValue || '';
        } else if (jsQrRef.current) {
          const now = Date.now();
          if (now - lastJsQrAt >= JSQR_SCAN_INTERVAL_MS) {
            lastJsQrAt = now;
            const w = video.videoWidth;
            const h = video.videoHeight;
            if (w && h) {
              const canvas = canvasRef.current || document.createElement('canvas');
              canvasRef.current = canvas;
              if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
              const ctx = canvasCtxRef.current || canvas.getContext('2d', { willReadFrequently: true });
              if (ctx) {
                canvasCtxRef.current = ctx;
                ctx.drawImage(video, 0, 0, w, h);
                const imgData = ctx.getImageData(0, 0, w, h);
                raw = jsQrRef.current(imgData.data, w, h)?.data?.trim() || '';
              }
            }
          }
        }
        if (raw) {
          const now = Date.now();
          if (raw === lastScanRef.current.raw && now - lastScanRef.current.at < 2500) {
            // debounce duplicate
          } else {
            lastScanRef.current = { raw, at: now };
            await handleScan(raw);
          }
        }
      } catch (_e) { /* ignore frame errors */ }
      frameRef.current = requestAnimationFrame(() => { void frame(); });
    };
    frameRef.current = requestAnimationFrame(() => { void frame(); });
  };

  const handleScan = async (rawToken: string) => {
    if (!isScanning.current) return;
    isScanning.current = false;
    stopCamera();
    try {
      const { data } = await cfmPresencaAPI.scan(rawToken);
      if (data.materias.length === 1) {
        setState({ kind: 'marking', rawToken, result: data, turmaMateriaId: data.materias[0].turmaMateriaId });
        await doMarcar(rawToken, data, data.materias[0].turmaMateriaId, data.materias[0].nome);
      } else {
        setState({ kind: 'scanned', rawToken, result: data });
      }
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { erro?: string } }; message?: string })?.response?.data?.erro
        || (e as { message?: string })?.message
        || 'Erro ao ler QR Code';
      setState({ kind: 'error', message: msg });
      setTimeout(() => { setState({ kind: 'idle' }); }, 3000);
    }
  };

  const doMarcar = async (rawToken: string, result: CfmScanResult, turmaMateriaId: string, materiaNome: string) => {
    try {
      const { data } = await cfmPresencaAPI.marcar(rawToken, turmaMateriaId);
      setState({ kind: 'success', nome: result.nome, materia: materiaNome, jaRegistrado: data.jaRegistrado });
      setTimeout(() => { setState({ kind: 'idle' }); }, 2500);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { erro?: string } }; message?: string })?.response?.data?.erro
        || (e as { message?: string })?.message
        || 'Erro ao marcar presença';
      setState({ kind: 'error', message: msg });
      setTimeout(() => { setState({ kind: 'idle' }); }, 3000);
    }
  };

  const handleSelectMateria = (turmaMateriaId: string, materiaNome: string) => {
    if (state.kind !== 'scanned') return;
    const { rawToken, result } = state;
    setState({ kind: 'marking', rawToken, result, turmaMateriaId });
    void doMarcar(rawToken, result, turmaMateriaId, materiaNome);
  };

  const cancelar = () => setState({ kind: 'idle' });

  return (
    <div className="flex flex-col" style={{ minHeight: '100dvh', backgroundColor: '#F0F2F5' }}>

      {/* ── Header ── */}
      <div
        className="flex items-center gap-3 px-4 flex-shrink-0"
        style={{
          backgroundColor: NAVY,
          borderBottomLeftRadius: 20,
          borderBottomRightRadius: 20,
          paddingTop: 'max(14px, env(safe-area-inset-top))',
          paddingBottom: 14,
        }}
      >
        <button
          onClick={() => setLocation('/home')}
          aria-label="Voltar para início"
          className="rounded-2xl flex items-center justify-center flex-shrink-0 transition-all active:scale-90"
          style={{ width: 44, height: 44, backgroundColor: 'rgba(255,255,255,0.08)', touchAction: 'manipulation' }}
        >
          <ChevronLeft size={20} className="text-white" />
        </button>

        <div
          className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: 'rgba(217,119,6,0.18)' }}
        >
          <QrCode size={18} style={{ color: AMBER }} />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-white font-bold text-base leading-tight">Presença CFM</p>
          <p className="text-xs leading-tight" style={{ color: 'rgba(217,119,6,0.9)' }}>
            Centro de Formação Ministerial
          </p>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex-1 flex flex-col px-4 pt-5 pb-6 gap-4">

        {/* Camera card */}
        <div
          className="w-full rounded-3xl overflow-hidden"
          style={{ boxShadow: '0 4px 20px rgba(10,31,63,0.10)', backgroundColor: '#000' }}
        >
          <div className="relative">
            <video
              ref={videoRef}
              className="w-full object-cover bg-black"
              style={{ aspectRatio: '1 / 1', display: 'block' }}
              muted
              playsInline
            />

            {/* Scanner frame overlay */}
            {state.kind === 'idle' && isCameraActive && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div
                  className="absolute inset-0"
                  style={{ background: 'radial-gradient(ellipse at center, transparent 32%, rgba(0,0,0,0.5) 68%)' }}
                />
                <div className="relative z-10" style={{ width: 180, height: 180 }}>
                  {CORNER_CLASSES.map(({ pos, borders }, i) => (
                    <div
                      key={i}
                      className={`absolute ${pos} ${borders} w-8 h-8`}
                      style={{ borderColor: AMBER }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Scanning / initializing badge */}
            {state.kind === 'idle' && (
              <div
                className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 rounded-full px-3 py-1.5"
                style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
              >
                <ScanLine size={13} style={{ color: AMBER }} />
                <span className="text-xs font-medium text-white">
                  {isCameraActive ? 'Aguardando QR Code…' : 'Iniciando câmera…'}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Camera error */}
        {cameraError && (
          <div
            className="rounded-2xl p-4 flex items-center gap-3"
            style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }}
          >
            <AlertCircle size={20} style={{ color: '#DC2626', flexShrink: 0 }} />
            <p className="text-sm font-medium" style={{ color: '#991B1B' }}>{cameraError}</p>
          </div>
        )}

        {/* Instruction card */}
        {state.kind === 'idle' && !cameraError && (
          <div
            className="rounded-2xl p-4 flex items-center gap-3"
            style={{ backgroundColor: '#fff', boxShadow: '0 2px 8px rgba(10,31,63,0.06)' }}
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: 'rgba(217,119,6,0.1)' }}
            >
              <QrCode size={18} style={{ color: AMBER }} />
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: NAVY }}>
                {isCameraActive ? 'Aponte para o QR Code do cartão' : 'Iniciando câmera…'}
              </p>
              {isCameraActive && (
                <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>
                  Mantenha o código dentro da moldura dourada
                </p>
              )}
            </div>
          </div>
        )}

        {/* ── SCANNED: matéria selection ── */}
        {state.kind === 'scanned' && (
          <div
            className="rounded-3xl p-5"
            style={{ backgroundColor: '#fff', boxShadow: '0 4px 20px rgba(10,31,63,0.08)' }}
          >
            {/* Student */}
            <div
              className="flex items-center gap-3 pb-4 mb-4"
              style={{ borderBottom: '1px solid #F1F5F9' }}
            >
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: 'rgba(217,119,6,0.1)' }}
              >
                <GraduationCap size={22} style={{ color: AMBER }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-lg leading-tight" style={{ color: NAVY }}>{state.result.nome}</p>
                <p className="text-sm mt-0.5 truncate" style={{ color: '#94A3B8' }}>{state.result.turma}</p>
              </div>
            </div>

            <p className="text-xs font-semibold tracking-widest mb-3" style={{ color: '#94A3B8' }}>
              SELECIONE A MATÉRIA
            </p>

            <div className="flex flex-col gap-2.5">
              {state.result.materias.map(m => (
                <button
                  key={m.turmaMateriaId}
                  onClick={() => handleSelectMateria(m.turmaMateriaId, m.nome)}
                  className="w-full rounded-2xl text-sm font-bold transition-all active:scale-95 active:brightness-90"
                  style={{ height: 52, backgroundColor: AMBER, color: '#fff', touchAction: 'manipulation' }}
                >
                  {m.nome}
                </button>
              ))}
              <button
                onClick={cancelar}
                className="w-full rounded-2xl text-sm font-medium transition-all active:scale-95"
                style={{
                  height: 48,
                  backgroundColor: '#F1F5F9',
                  color: '#64748B',
                  touchAction: 'manipulation',
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* ── MARKING: loading ── */}
        {state.kind === 'marking' && (
          <div
            className="rounded-3xl p-6 flex flex-col items-center gap-4"
            style={{ backgroundColor: '#fff', boxShadow: '0 4px 20px rgba(10,31,63,0.08)' }}
          >
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{ backgroundColor: 'rgba(217,119,6,0.1)', border: '1.5px solid rgba(217,119,6,0.25)' }}
            >
              <Loader2 size={28} style={{ color: AMBER }} className="animate-spin" />
            </div>
            <div className="text-center">
              <p className="font-bold text-lg" style={{ color: NAVY }}>{state.result.nome}</p>
              <p className="text-sm mt-1" style={{ color: '#94A3B8' }}>Registrando presença…</p>
            </div>
          </div>
        )}

        {/* ── SUCCESS ── */}
        {state.kind === 'success' && (
          <div
            className="rounded-3xl p-5"
            style={{
              backgroundColor: '#fff',
              boxShadow: '0 4px 20px rgba(10,31,63,0.08)',
              borderLeft: `4px solid ${state.jaRegistrado ? AMBER : '#16A34A'}`,
            }}
          >
            <div className="flex items-center gap-4">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{
                  backgroundColor: state.jaRegistrado ? 'rgba(217,119,6,0.1)' : 'rgba(22,163,74,0.1)',
                }}
              >
                {state.jaRegistrado
                  ? <AlertTriangle size={28} style={{ color: AMBER }} />
                  : <CheckCircle size={28} style={{ color: '#16A34A' }} />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-lg leading-tight" style={{ color: NAVY }}>{state.nome}</p>
                <p className="text-sm mt-0.5" style={{ color: '#94A3B8' }}>{state.materia}</p>
                <p className="text-sm font-semibold mt-1.5" style={{ color: state.jaRegistrado ? AMBER : '#16A34A' }}>
                  {state.jaRegistrado ? 'Presença já registrada' : 'Presença marcada com sucesso!'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── ERROR ── */}
        {state.kind === 'error' && (
          <div
            className="rounded-3xl p-5"
            style={{
              backgroundColor: '#fff',
              boxShadow: '0 4px 20px rgba(10,31,63,0.08)',
              borderLeft: '4px solid #DC2626',
            }}
          >
            <div className="flex items-center gap-4">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: '#FEF2F2' }}
              >
                <AlertCircle size={28} style={{ color: '#DC2626' }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-base" style={{ color: NAVY }}>Não foi possível registrar</p>
                <p className="text-sm mt-1" style={{ color: '#DC2626' }}>{state.message}</p>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
