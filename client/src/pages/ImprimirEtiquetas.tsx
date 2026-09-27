import { useCallback, useEffect, useRef, useState } from 'react';
import { useRoute } from 'wouter';
import { toast } from 'sonner';
import { AlertTriangle, Loader2, Printer, QrCode, ScanLine, Search, Tag, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LabelSheet, type LabelRenderItem } from '@/components/LabelSheet';
import {
  buscarIngressosPublico,
  buscarModeloEtiqueta,
  type LabelTemplateResponse,
  type LookupRegistration,
} from '@/lib/eventsApi';

const num = (v: number | string) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export default function ImprimirEtiquetas() {
  const [, params] = useRoute('/etiquetas/:eventId');
  const eventId = params?.eventId || '';

  const [loadingTpl, setLoadingTpl] = useState(true);
  const [tpl, setTpl] = useState<LabelTemplateResponse | null>(null);
  const [tplErro, setTplErro] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [itens, setItens] = useState<LabelRenderItem[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const jsqrRef = useRef<((d: Uint8ClampedArray, w: number, h: number) => { data: string } | null) | null>(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        setLoadingTpl(true);
        const data = await buscarModeloEtiqueta(eventId);
        if (cancel) return;
        if (!data) {
          setTplErro('Este evento ainda não tem um modelo de etiqueta configurado.');
        } else {
          setTpl(data);
        }
      } catch (err: any) {
        if (!cancel) setTplErro(err?.response?.data?.message || 'Não foi possível carregar o modelo de etiqueta.');
      } finally {
        if (!cancel) setLoadingTpl(false);
      }
    })();
    return () => { cancel = true; };
  }, [eventId]);

  const template = tpl?.template;
  const widthMm = template ? num(template.widthMm) : 90;
  const heightMm = template ? num(template.heightMm) : 29;

  const executarBusca = useCallback(async (termoRaw: string) => {
    const termo = (termoRaw || '').trim();
    if (termo.length < 3) {
      setMsg('Digite o código do pedido ou o e-mail do comprador.');
      return;
    }
    setBuscando(true);
    setMsg(null);
    setItens([]);
    try {
      const registros: LookupRegistration[] = await buscarIngressosPublico(termo);
      const doEvento = registros.filter(
        (r) => r.event?.id === eventId && (r.paymentStatus === 'confirmed' || r.paymentStatus === 'partial')
      );
      const labels: LabelRenderItem[] = [];
      doEvento.forEach((r) => {
        (r.attendees || []).forEach((att) => {
          labels.push({
            key: `${r.orderCode}-${att.id}`,
            attendeeName: att.name,
            sector: att.batch?.sector || '',
            batchName: att.batch?.name || '',
            orderCode: r.orderCode,
            attendeeId: att.id,
            eventId: r.event!.id,
            eventTitle: r.event!.title,
            eventImage: r.event!.imageUrl || tpl?.event?.imageUrl || null,
          });
        });
      });
      if (labels.length === 0) {
        setMsg('Nenhuma inscrição confirmada encontrada para esse código ou e-mail neste evento.');
        return;
      }
      setItens(labels);
    } catch (err: any) {
      setMsg(err?.response?.data?.message || 'Falha na busca. Tente novamente.');
    } finally {
      setBuscando(false);
    }
  }, [eventId, tpl]);

  const buscar = useCallback((e?: React.FormEvent) => {
    if (e) e.preventDefault();
    executarBusca(busca);
  }, [busca, executarBusca]);

  // --- Leitura de QR Code (câmera) ---
  const stopScan = useCallback(() => {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
    setScanning(false);
  }, []);

  const onScanned = useCallback((raw: string) => {
    let termo = raw.trim();
    try {
      const obj = JSON.parse(raw);
      if (obj && typeof obj.orderCode === 'string') termo = obj.orderCode;
    } catch { /* não é JSON — usa o texto lido */ }
    stopScan();
    setBusca(termo);
    executarBusca(termo);
  }, [stopScan, executarBusca]);

  const startScan = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error('Câmera não suportada neste dispositivo.');
      return;
    }
    setMsg(null);
    setScanning(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) { stopScan(); return; }
      video.srcObject = stream;
      await video.play();

      const Detector = (window as any).BarcodeDetector;
      const nativo = Detector ? new Detector({ formats: ['qr_code'] }) : null;
      const canvas = document.createElement('canvas');

      const loop = async () => {
        const v = videoRef.current;
        if (!v || !streamRef.current) return;
        try {
          if (nativo) {
            const codes = await nativo.detect(v);
            const hit = codes.find((c: any) => c.rawValue && c.rawValue.trim());
            if (hit?.rawValue) { onScanned(hit.rawValue); return; }
          } else {
            const w = v.videoWidth; const h = v.videoHeight;
            if (w && h) {
              if (!jsqrRef.current) {
                const mod = await import('jsqr');
                jsqrRef.current = mod.default as any;
              }
              const parseQr = jsqrRef.current;
              canvas.width = w; canvas.height = h;
              const ctx = canvas.getContext('2d', { willReadFrequently: true });
              if (ctx && parseQr) {
                ctx.drawImage(v, 0, 0, w, h);
                const img = ctx.getImageData(0, 0, w, h);
                const code = parseQr(img.data, w, h);
                if (code?.data) { onScanned(code.data); return; }
              }
            }
          }
        } catch { /* ignora frame */ }
        rafRef.current = requestAnimationFrame(loop);
      };
      rafRef.current = requestAnimationFrame(loop);
    } catch {
      stopScan();
      toast.error('Não foi possível acessar a câmera.');
    }
  }, [onScanned, stopScan]);

  useEffect(() => () => stopScan(), [stopScan]);

  const imprimir = () => window.print();

  return (
    <div className="min-h-dvh bg-gradient-to-b from-muted/40 to-background">
      {/* Animação do scanner (o CSS de impressão vem do LabelSheet) */}
      <style>{`
        @media print { .no-print { display: none !important; } }
        @media (prefers-reduced-motion: no-preference) {
          @keyframes etq-scan { 0% { top: 6%; } 100% { top: 94%; } }
          .etq-scanline { animation: etq-scan 1.8s ease-in-out infinite alternate; }
        }
      `}</style>

      <div className="no-print mx-auto w-full max-w-3xl px-4 py-10 sm:py-14">
        {/* Cabeçalho */}
        <header className="mb-8 text-center">
          {tpl?.event?.title && (
            <Badge variant="secondary" className="mb-4 gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium">
              <Tag className="h-4 w-4" aria-hidden="true" />
              {tpl.event.title}
            </Badge>
          )}
          <div className="flex items-center justify-center gap-3">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Printer className="h-6 w-6" aria-hidden="true" />
            </span>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Imprimir etiquetas</h1>
          </div>
          <p className="mx-auto mt-3 max-w-xl text-base text-muted-foreground">
            Informe o código do pedido, o e-mail do comprador ou leia o QR Code do ingresso para imprimir os crachás dos inscritos.
          </p>
        </header>

        {loadingTpl ? (
          <Card>
            <CardContent className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
              Carregando modelo de etiqueta...
            </CardContent>
          </Card>
        ) : tplErro ? (
          <Card className="border-amber-300/70 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-950/30">
            <CardContent className="flex flex-col items-center gap-3 py-8 text-center text-amber-900 dark:text-amber-200">
              <AlertTriangle className="h-7 w-7 shrink-0" aria-hidden="true" />
              <p className="max-w-md text-base leading-relaxed">{tplErro}</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card className="shadow-sm">
              <CardHeader className="pb-3 text-center">
                <CardTitle className="text-xl">Buscar inscrição</CardTitle>
                <CardDescription className="text-sm">Código do pedido (REG-…) ou e-mail do comprador.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <form onSubmit={buscar} className="mx-auto max-w-xl space-y-3">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                    <Input
                      value={busca}
                      onChange={(e) => setBusca(e.target.value)}
                      placeholder="REG-20260906-XXXXXX ou email@exemplo.com"
                      aria-label="Código do pedido ou e-mail"
                      inputMode="search"
                      autoComplete="off"
                      className="h-14 pl-11 text-center text-base"
                    />
                  </div>
                  <div className="flex flex-col gap-2.5 sm:flex-row">
                    <Button type="submit" disabled={buscando} className="h-12 flex-1 gap-2 text-base">
                      {buscando ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : <Search className="h-5 w-5" aria-hidden="true" />}
                      Buscar
                    </Button>
                    <Button type="button" variant="outline" onClick={startScan} disabled={scanning} className="h-12 flex-1 gap-2 text-base">
                      <ScanLine className="h-5 w-5" aria-hidden="true" />
                      Ler QR Code
                    </Button>
                  </div>
                </form>

                {scanning && (
                  <div className="space-y-2 pt-1">
                    <div className="relative mx-auto max-w-sm overflow-hidden rounded-xl bg-black">
                      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                      <video ref={videoRef} playsInline muted className="block w-full" />
                      <div className="pointer-events-none absolute inset-0 rounded-xl ring-2 ring-primary/70" />
                      <div className="etq-scanline pointer-events-none absolute left-[8%] right-[8%] h-0.5 bg-primary/80 shadow-[0_0_8px] shadow-primary" />
                    </div>
                    <p className="text-center text-sm text-muted-foreground">Aponte a câmera para o QR Code do ingresso.</p>
                    <Button type="button" variant="ghost" onClick={stopScan} className="mx-auto flex h-10 gap-2">
                      <X className="h-4 w-4" aria-hidden="true" /> Cancelar leitura
                    </Button>
                  </div>
                )}

                {msg && (
                  <div className="mx-auto flex max-w-xl items-center justify-center gap-2 rounded-lg border border-border bg-muted/50 px-4 py-3 text-center text-sm text-muted-foreground" role="status" aria-live="polite">
                    <QrCode className="h-4 w-4 shrink-0 text-muted-foreground/80" aria-hidden="true" />
                    <span>{msg}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {itens.length > 0 && (
              <div className="mt-6 flex flex-col items-center gap-4 rounded-xl border bg-card p-5 text-center shadow-sm">
                <div>
                  <p className="text-lg font-semibold">{itens.length} etiqueta(s) encontrada(s)</p>
                  <p className="text-sm text-muted-foreground">Tamanho {widthMm}×{heightMm} mm — confira a pré-visualização abaixo.</p>
                </div>
                <Button onClick={imprimir} size="lg" className="h-12 w-full gap-2 text-base sm:w-auto sm:px-8">
                  <Printer className="h-5 w-5" aria-hidden="true" />
                  Imprimir {itens.length} etiqueta(s)
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {itens.length > 0 && (
        <p className="no-print mx-auto max-w-3xl px-4 pb-2 text-center text-xs text-muted-foreground">
          Em quiosque, o Chrome com <code className="rounded bg-muted px-1 py-0.5">--kiosk-printing</code> imprime direto na etiquetadora padrão.
        </p>
      )}

      {/* Área imprimível — também serve de pré-visualização (page-break por etiqueta) */}
      {template && itens.length > 0 && (
        <LabelSheet template={template} items={itens} />
      )}
    </div>
  );
}
