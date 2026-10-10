import { useCallback, useEffect, useRef, useState } from 'react';
import { useRoute } from 'wouter';
import { AlertTriangle, ArrowRight, Check, Camera, Loader2, Package, Printer, ScanLine, X } from 'lucide-react';
import './KitRetirada.css';
import { LabelSheet } from '@/components/LabelSheet';
import { montarEtiqueta } from '@/lib/labelData';
import {
  buscarConfigKit,
  buscarModeloEtiqueta,
  registrarRetiradaKit,
  type KitConfigResponse,
  type KitDeliveryResponse,
  type LabelTemplateResponse,
} from '@/lib/eventsApi';

type Estado = 'carregando' | 'configurarImpressora' | 'idle' | 'scanning' | 'processando' | 'resultado' | 'erroConfig';

// Texto legível (preto/branco) sobre uma cor de fundo
function textoSobre(bg: string): '#0b1220' | '#ffffff' {
  const h = (bg || '').replace('#', '');
  if (h.length < 6) return '#ffffff';
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? '#0b1220' : '#ffffff';
}

export default function KitRetirada() {
  const [, params] = useRoute('/kit/:eventId');
  const eventId = params?.eventId || '';

  const [estado, setEstado] = useState<Estado>('carregando');
  const [config, setConfig] = useState<KitConfigResponse | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<KitDeliveryResponse | null>(null);
  const [labelPrint, setLabelPrint] = useState<{ template: LabelTemplateResponse['template']; items: any[] } | null>(null);
  const [testePrint, setTestePrint] = useState<{ template: LabelTemplateResponse['template']; items: any[] } | null>(null);
  // Evento realmente imprime etiqueta (tem modelo e flag não desligado).
  const [vaiImprimir, setVaiImprimir] = useState(false);

  // Chave por evento para lembrar (neste dispositivo/navegador) que a impressora já foi
  // configurada — evita repetir o passo a cada recarga.
  const printerStorageKey = `kit:impressora-ok:${eventId}`;
  const testeNonceRef = useRef(0);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const jsqrRef = useRef<((d: Uint8ClampedArray, w: number, h: number) => { data: string } | null) | null>(null);
  const busyRef = useRef(false);
  const scanSessionRef = useRef(0);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        // Busca a config do kit e o modelo de etiqueta em paralelo. O modelo é o
        // sinal confiável de que haverá impressão (o flag imprimeEtiqueta pode não
        // vir no kit-config, dependendo do backend).
        const [cfg, modelo] = await Promise.all([
          buscarConfigKit(eventId),
          buscarModeloEtiqueta(eventId).catch(() => null),
        ]);
        if (cancel) return;
        setConfig(cfg);
        // Imprime etiqueta se: existe modelo de etiqueta E o flag não está
        // explicitamente desligado. Assim funciona mesmo que imprimeEtiqueta venha
        // undefined/ausente do kit-config.
        const imprime = Boolean(modelo?.template) && cfg.imprimeEtiqueta !== false;
        setVaiImprimir(imprime);
        let jaConfig = false;
        try { jaConfig = localStorage.getItem(printerStorageKey) === '1'; } catch { /* storage indisponível */ }
        setEstado(imprime && !jaConfig ? 'configurarImpressora' : 'idle');
      } catch (err: any) {
        if (cancel) return;
        setErro(err?.response?.data?.message || 'Não foi possível carregar a configuração de kits.');
        setEstado('erroConfig');
      }
    })();
    return () => { cancel = true; };
  }, [eventId]);

  const stopScan = useCallback(() => {
    scanSessionRef.current += 1;
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
  }, []);

  const resetar = useCallback(() => {
    stopScan();
    setResultado(null);
    setLabelPrint(null);
    setErro(null);
    busyRef.current = false;
    setEstado('idle');
  }, [stopScan]);

  // Marca a impressora como configurada neste dispositivo e libera a leitura.
  const marcarImpressoraPronta = useCallback(() => {
    try { localStorage.setItem(printerStorageKey, '1'); } catch { /* storage indisponível */ }
    setTestePrint(null);
    setEstado('idle');
  }, [printerStorageKey]);

  // Imprime uma etiqueta de teste para o operador escolher a impressora e o
  // tamanho corretos na janela de impressão (o navegador guarda a escolha).
  const imprimirTeste = useCallback(async () => {
    const et = await montarEtiqueta(eventId, undefined, undefined, 'ETIQUETA DE TESTE');
    if (!et) { marcarImpressoraPronta(); return; } // sem modelo: nada a configurar
    testeNonceRef.current += 1;
    const nonce = testeNonceRef.current;
    // Chave variável a cada clique para permitir reimprimir o teste quantas vezes quiser.
    setTestePrint({ template: et.template, items: et.items.map((it) => ({ ...it, key: `teste-${nonce}` })) });
  }, [eventId, marcarImpressoraPronta]);

  // Imprime a etiqueta via PDF no tamanho EXATO do modelo (mesmo método confiável
  // da tela /etiquetas). Evita o window.print() cair para A4/modelo errado quando a
  // impressora de etiqueta não está perfeitamente selecionada.
  const imprimirViaPdf = useCallback(async (tpl: LabelTemplateResponse['template'], printId: string) => {
    try {
      const { imprimirEtiquetasPdf } = await import('@/lib/labelPdf');
      await imprimirEtiquetasPdf(Number(tpl.widthMm), Number(tpl.heightMm), printId);
    } catch (e) {
      console.error('Falha ao gerar PDF da etiqueta, usando impressão padrão:', e);
      window.print();
    }
  }, []);

  // Permite refazer a configuração da impressora (ex.: trocou de impressora).
  const reconfigurarImpressora = useCallback(() => {
    try { localStorage.removeItem(printerStorageKey); } catch { /* storage indisponível */ }
    setTestePrint(null);
    setEstado('configurarImpressora');
  }, [printerStorageKey]);

  const processarQr = useCallback(async (raw: string) => {
    if (busyRef.current) return;
    busyRef.current = true;
    stopScan();
    setEstado('processando');

    let orderCode = '';
    let attendeeId: string | undefined;
    try {
      const obj = JSON.parse(raw);
      orderCode = String(obj.orderCode || '').trim();
      attendeeId = obj.attendeeId ? String(obj.attendeeId) : undefined;
    } catch {
      orderCode = raw.trim();
    }
    if (!orderCode) {
      setErro('QR Code inválido.'); setResultado(null); setEstado('resultado');
      busyRef.current = false; return;
    }

    try {
      const r = await registrarRetiradaKit(eventId, { orderCode, attendeeId });
      setResultado(r);
      setEstado('resultado');

      // Imprime assim que a etiqueta estiver pronta; a tela permanece até
      // o operador tocar em "Próxima retirada".
      if (r.delivered && r.imprimeEtiqueta) {
        const et = await montarEtiqueta(eventId, r.orderCode, r.attendeeId, r.attendeeName);
        if (et) setLabelPrint(et);
      }
    } catch (err: any) {
      setErro(err?.response?.data?.message || 'Não foi possível validar este ingresso.');
      setResultado(null);
      setEstado('resultado');
    } finally {
      busyRef.current = false;
    }
  }, [eventId, stopScan]);

  const startScan = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) { setErro('Câmera não suportada neste dispositivo.'); setEstado('resultado'); return; }
    setErro(null);
    setEstado('scanning');
    const session = ++scanSessionRef.current;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      if (session !== scanSessionRef.current) { stream.getTracks().forEach((t) => t.stop()); return; }
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) { stopScan(); return; }
      video.srcObject = stream;
      await video.play();
      if (session !== scanSessionRef.current) return;

      const Detector = (window as any).BarcodeDetector;
      const nativo = Detector ? new Detector({ formats: ['qr_code'] }) : null;
      const canvas = document.createElement('canvas');

      const loop = async () => {
        const v = videoRef.current;
        if (!v || !streamRef.current || session !== scanSessionRef.current) return;
        try {
          if (nativo) {
            const codes = await nativo.detect(v);
            if (session !== scanSessionRef.current) return;
            const hit = codes.find((c: any) => c.rawValue && c.rawValue.trim());
            if (hit?.rawValue) { processarQr(hit.rawValue); return; }
          } else {
            const w = v.videoWidth; const h = v.videoHeight;
            if (w && h) {
              if (!jsqrRef.current) { const mod = await import('jsqr'); jsqrRef.current = mod.default as any; }
              if (session !== scanSessionRef.current) return;
              const parse = jsqrRef.current;
              canvas.width = w; canvas.height = h;
              const ctx = canvas.getContext('2d', { willReadFrequently: true });
              if (ctx && parse) {
                ctx.drawImage(v, 0, 0, w, h);
                const img = ctx.getImageData(0, 0, w, h);
                const code = parse(img.data, w, h);
                if (code?.data) { processarQr(code.data); return; }
              }
            }
          }
        } catch { /* ignora frame */ }
        rafRef.current = requestAnimationFrame(loop);
      };
      rafRef.current = requestAnimationFrame(loop);
    } catch {
      if (session !== scanSessionRef.current) return;
      stopScan();
      setErro('Não foi possível acessar a câmera.');
      setEstado('resultado');
    }
  }, [processarQr, stopScan]);

  useEffect(() => () => { stopScan(); }, [stopScan]);

  const entregue = Boolean(resultado?.delivered && resultado.kit);
  const corKit = entregue ? (resultado!.kit!.color || '#16a34a') : '';
  const fg = entregue ? textoSobre(corKit) : '#fff';
  const etapa = estado === 'resultado' ? 3 : estado === 'scanning' || estado === 'processando' ? 2 : 1;

  return (
    <div className="kit-page">
      {labelPrint && (
        <LabelSheet
          template={labelPrint.template}
          items={labelPrint.items}
          screenHidden
          autoPrint
          printId="kit-print-real"
          onPrint={(id) => imprimirViaPdf(labelPrint.template, id)}
        />
      )}
      {testePrint && (
        <LabelSheet
          template={testePrint.template}
          items={testePrint.items}
          screenHidden
          autoPrint
          printId="kit-print-teste"
          onPrint={(id) => imprimirViaPdf(testePrint.template, id)}
        />
      )}
      <div className="kit-shell no-print">
        <header className="kit-header">
          <div className="kit-brand">
            <span className="kit-brand-icon"><Package size={22} strokeWidth={1.7} aria-hidden="true" /></span>
            <div><span className="kit-eyebrow">Ponto de retirada</span><p>{config?.event.title || 'Retirada de kit'}</p></div>
          </div>
          <span className="kit-header-note">Seu ingresso. Seu kit.</span>
        </header>

        <main className="kit-main">
          {estado === 'configurarImpressora' && (
            <section className="kit-message kit-config-printer">
              <span className="kit-message-icon"><Printer size={30} aria-hidden="true" /></span>
              <span className="kit-eyebrow">Antes de começar</span>
              <h1>Configure a impressora.</h1>
              <p>
                Imprima uma etiqueta de teste e, na janela de impressão, selecione a impressora de
                etiquetas e confira o tamanho. O navegador guarda essa escolha para as próximas leituras.
              </p>
              <div className="kit-config-actions">
                <button type="button" onClick={imprimirTeste} className="kit-button kit-button-secondary">
                  <Printer size={18} aria-hidden="true" /> Imprimir etiqueta de teste
                </button>
                <button type="button" onClick={marcarImpressoraPronta} className="kit-button kit-button-primary">
                  Impressora pronta, começar <ArrowRight size={20} aria-hidden="true" />
                </button>
              </div>
              <p className="kit-message-hint">
                A etiqueta de teste saiu no tamanho certo? Então pode iniciar as retiradas. Se precisar,
                imprima o teste novamente até acertar a impressora.
              </p>
            </section>
          )}

          {estado === 'idle' && config && (
            <div className="kit-entry">
              <section className="kit-intro" aria-labelledby="kit-title">
                <span className="kit-eyebrow">Tudo pronto para começar</span>
                <h1 id="kit-title">Seu kit.<br /><span>Seu evento.</span></h1>
                <p className="kit-description">O próximo passo é aqui. Tenha o QR Code do ingresso em mãos para retirar seu kit.</p>
                <button type="button" onClick={startScan} className="kit-button kit-button-primary">
                  <ScanLine size={23} aria-hidden="true" /><span>Retirar meu kit</span><ArrowRight size={21} aria-hidden="true" />
                </button>
                <p className="kit-camera-note"><Camera size={15} aria-hidden="true" /> A câmera será aberta para ler o ingresso.</p>
                {vaiImprimir && (
                  <button type="button" onClick={reconfigurarImpressora} className="kit-config-link">
                    <Printer size={14} aria-hidden="true" /> Reconfigurar impressora
                  </button>
                )}
              </section>
              <aside className="kit-ticket" aria-labelledby="kit-sectors-title">
                <div className="kit-ticket-heading">
                  <div><span className="kit-eyebrow">Guia de retirada</span><h2 id="kit-sectors-title">Encontre sua cor.</h2></div>
                  <Package size={30} strokeWidth={1.4} aria-hidden="true" />
                </div>
                <div className="kit-ticket-body">
                  <p>Após a leitura, confira na tela o kit correspondente ao seu setor.</p>
                  {config.kits.length > 0 ? (
                    <ul className="kit-sector-list">
                      {config.kits.map((k) => (
                        <li key={k.sector} className="kit-sector">
                          <span className="kit-color-tab" style={{ backgroundColor: k.color }} aria-hidden="true" />
                          <div><span className="kit-sector-name">{k.sector}</span><span className="kit-sector-label">{k.label}</span></div>
                          <Package size={19} strokeWidth={1.5} aria-hidden="true" />
                        </li>
                      ))}
                    </ul>
                  ) : <div className="kit-empty-guide"><ScanLine size={28} aria-hidden="true" /><p>Leia seu ingresso para consultar a retirada.</p></div>}
                </div>
                <div className="kit-ticket-stub"><ScanLine size={18} aria-hidden="true" /><span>Um ingresso, uma retirada.</span></div>
              </aside>
            </div>
          )}

          {estado === 'scanning' && (
            <section className="kit-scan-layout" aria-labelledby="kit-scan-title">
              <div className="kit-scan-copy">
                <span className="kit-eyebrow">Leitura do ingresso</span>
                <h1 id="kit-scan-title">Aproxime.<br /><span>É só isso.</span></h1>
                <p className="kit-description">Posicione o QR Code dentro da marcação. A leitura acontece automaticamente.</p>
                <p className="kit-scan-tip">Ingresso no celular? Aumente o brilho da tela para facilitar a leitura.</p>
                <button type="button" onClick={resetar} className="kit-button kit-button-secondary"><X size={18} aria-hidden="true" /> Cancelar leitura</button>
              </div>
              <div className="kit-camera-panel">
                <div className="kit-viewfinder">
                  <video ref={videoRef} playsInline muted aria-label="Câmera para leitura do QR Code" />
                  <div className="kit-scan-frame" aria-hidden="true"><i /><i /><i /><i /></div>
                </div>
                <div className="kit-camera-caption"><span className="kit-status-dot" /> Aguardando QR Code</div>
              </div>
            </section>
          )}

          {(estado === 'carregando' || estado === 'processando') && (
            <section className="kit-wait" role="status" aria-live="polite">
              <Loader2 className="kit-spinner" size={36} strokeWidth={1.5} aria-hidden="true" />
              <span className="kit-eyebrow">{estado === 'carregando' ? 'Ponto de retirada' : 'Ingresso recebido'}</span>
              <h1>{estado === 'carregando' ? 'Preparando tudo.' : 'Conferindo seu ingresso.'}</h1>
              <p>{estado === 'carregando' ? 'Aguarde enquanto carregamos as informações do evento.' : 'Aguarde um instante para consultar a retirada.'}</p>
            </section>
          )}

          {estado === 'erroConfig' && (
            <section className="kit-message kit-message-error" role="alert">
              <span className="kit-message-icon"><AlertTriangle size={30} aria-hidden="true" /></span>
              <span className="kit-eyebrow">Retirada indisponível</span>
              <h1>Não foi possível começar.</h1><p>{erro}</p>
              <button type="button" onClick={() => window.location.reload()} className="kit-button kit-button-primary">Tentar novamente<ArrowRight size={20} aria-hidden="true" /></button>
            </section>
          )}

          {estado === 'resultado' && (
            <section className="kit-result" aria-live="polite" aria-atomic="true">
              {erro ? (
                <div className="kit-message kit-message-error" role="alert">
                  <span className="kit-message-icon"><AlertTriangle size={30} aria-hidden="true" /></span>
                  <span className="kit-eyebrow">Não foi possível concluir</span>
                  <h1>Vamos tentar de novo.</h1><p>{erro}</p>
                  <p className="kit-message-hint">Confira o ingresso e, se necessário, peça ajuda à equipe.</p>
                </div>
              ) : resultado?.alreadyDelivered ? (
                <div className="kit-message kit-message-warning">
                  <span className="kit-message-icon"><Package size={30} aria-hidden="true" /></span>
                  <span className="kit-eyebrow">Retirada já registrada</span>
                  <h1>Este kit já foi retirado.</h1>
                  <p className="kit-attendee">{resultado.attendeeName}</p>
                  {resultado.sector && <span className="kit-result-sector">Setor {resultado.sector}</span>}
                  <p className="kit-message-hint">Em caso de dúvida, procure a equipe de entrega.</p>
                </div>
              ) : entregue ? (
                <div className="kit-delivery-ticket">
                  <div className="kit-delivery-color" style={{ backgroundColor: corKit, color: fg }}>
                    <span className="kit-delivery-status"><Check size={19} aria-hidden="true" /> Retirada confirmada</span>
                    <div><span className="kit-eyebrow">Seu kit é</span><h1>{resultado!.kit!.label}</h1></div>
                    {resultado!.sector && <span className="kit-delivery-sector">Setor {resultado!.sector}</span>}
                  </div>
                  <div className="kit-delivery-details">
                    <span className="kit-eyebrow">Preparado para</span>
                    <p className="kit-attendee">{resultado!.attendeeName}</p>
                    <p>Apresente esta confirmação à equipe e retire seu kit.</p>
                    {resultado!.imprimeEtiqueta && (
                      <div className="kit-print-status">
                        <div><Printer size={20} aria-hidden="true" /><span>{labelPrint ? 'Imprimindo etiqueta…' : 'Preparando etiqueta…'}</span></div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="kit-message">
                  <span className="kit-message-icon"><Check size={30} aria-hidden="true" /></span>
                  <span className="kit-eyebrow">Ingresso conferido</span><h1>Kit liberado.</h1>
                  <p className="kit-attendee">{resultado?.attendeeName}</p><p>Setor sem kit configurado.</p>
                </div>
              )}
              <button type="button" onClick={resetar} className="kit-button kit-button-primary kit-next">{erro ? 'Tentar novamente' : 'Próxima retirada'}<ArrowRight size={20} aria-hidden="true" /></button>
            </section>
          )}
        </main>

        <footer className="kit-footer">
          <ol className="kit-steps" aria-label="Etapas da retirada">
            {['Prepare o ingresso', 'Leia o QR Code', 'Retire seu kit'].map((label, index) => (
              <li key={label} className={etapa === index + 1 ? 'is-current' : etapa > index + 1 ? 'is-complete' : ''} aria-current={etapa === index + 1 ? 'step' : undefined}>
                <span>{etapa > index + 1 ? <Check size={12} aria-hidden="true" /> : index + 1}</span>{label}
              </li>
            ))}
          </ol>
          <span className="kit-footer-label">Retirada de kits</span>
        </footer>
      </div>
    </div>
  );
}
