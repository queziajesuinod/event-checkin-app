import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import type { LabelElement, LabelTemplateResponse } from '@/lib/eventsApi';

// Compacta o texto horizontalmente (scaleX) para caber na largura do campo, sem cortar.
function FitText({ text, align }: { text: string; align: 'left' | 'center' | 'right' }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [scaleX, setScaleX] = useState(1);
  useLayoutEffect(() => {
    const el = ref.current;
    const parent = el?.parentElement;
    if (!el || !parent) return;
    const avail = parent.clientWidth;
    const need = el.scrollWidth;
    setScaleX(need > avail && need > 0 ? Math.max(0.2, avail / need) : 1);
  }, [text]);
  const origin = align === 'center' ? 'center' : align === 'right' ? 'right' : 'left';
  return (
    <span
      ref={ref}
      style={{ display: 'inline-block', whiteSpace: 'nowrap', transform: `scaleX(${scaleX})`, transformOrigin: origin }}
    >
      {text}
    </span>
  );
}

export interface LabelRenderItem {
  key: string;
  attendeeName: string;
  sector: string;
  batchName: string;
  eventTitle: string;
  orderCode: string;
  attendeeId: string;
  eventId: string;
  eventImage?: string | null;
}

type Template = LabelTemplateResponse['template'];

interface Props {
  template: Template;
  items: LabelRenderItem[];
  /** Esconde a folha na tela (só imprime) — usado no check-in. */
  screenHidden?: boolean;
  /** Dispara window.print() automaticamente quando os QRs estão prontos. */
  autoPrint?: boolean;
}

const num = (v: number | string) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

// Partículas de ligação que não contam como sobrenome/nome principal
const PARTICULAS_NOME = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'di', 'del', 'della', 'van', 'von', 'y', 'du']);
// Primeiros nomes que quase sempre formam nome composto (mantém o 2º nome)
const PREFIXOS_COMPOSTOS = new Set(['maria', 'ana', 'jose', 'josé', 'joao', 'joão', 'luiz', 'luis', 'luís', 'antonio', 'antônio']);

// "Ana Paula da Silva Souza" -> "Ana Paula Souza"; "João Pedro Lima" -> "João Pedro Lima" (composto);
// "Carlos Eduardo Souza Lima" -> "Carlos Lima". Heurística p/ nomes BR (não é 100%).
export function primeiroUltimoNome(nome: string): string {
  const partes = String(nome || '').trim().split(/\s+/).filter(Boolean);
  if (partes.length <= 1) return partes[0] || '';

  // Primeiro nome (pode ser composto)
  let primeiro = partes[0];
  const segundo = partes[1] || '';
  const ehComposto = PREFIXOS_COMPOSTOS.has(primeiro.toLowerCase())
    && partes.length >= 3
    && !PARTICULAS_NOME.has(segundo.toLowerCase());
  if (ehComposto) primeiro = `${partes[0]} ${partes[1]}`;

  // Último sobrenome válido (pula partículas soltas no fim, se houver)
  let i = partes.length - 1;
  while (i > 0 && PARTICULAS_NOME.has(partes[i].toLowerCase())) i -= 1;
  const ultimo = partes[i];

  return ultimo && ultimo !== primeiro.split(' ').pop() ? `${primeiro} ${ultimo}` : primeiro;
}

function resolveField(field: string | null, item: LabelRenderItem): string {
  switch (field) {
    case 'attendeeName': return item.attendeeName || '';
    case 'sector': return item.sector || '';
    case 'batchName': return item.batchName || '';
    case 'eventTitle': return item.eventTitle || '';
    case 'orderCode': return item.orderCode || '';
    default: return '';
  }
}

export function LabelSheet({ template, items, screenHidden = false, autoPrint = false }: Props) {
  const widthMm = num(template.widthMm);
  const heightMm = num(template.heightMm);
  const temQr = useMemo(() => (template.elements || []).some((e) => e.type === 'qr'), [template]);
  const [qrMap, setQrMap] = useState<Record<string, string>>({});
  const printedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!temQr || items.length === 0) { setQrMap({}); return; }
    let cancel = false;
    (async () => {
      const entries = await Promise.all(
        items.map(async (it) => {
          try {
            const payload = JSON.stringify({ orderCode: it.orderCode, event_id: it.eventId, attendeeId: it.attendeeId });
            const url = await QRCode.toDataURL(payload, { margin: 0, width: 300 });
            return [it.key, url] as const;
          } catch {
            return [it.key, ''] as const;
          }
        })
      );
      if (!cancel) setQrMap(Object.fromEntries(entries));
    })();
    return () => { cancel = true; };
  }, [items, temQr]);

  const ready = !temQr || Object.keys(qrMap).length >= items.length;

  useEffect(() => {
    if (!autoPrint || !ready || items.length === 0) return;
    const token = items.map((i) => i.key).join('|');
    if (printedRef.current === token) return;
    printedRef.current = token;
    const t = setTimeout(() => window.print(), 350);
    return () => clearTimeout(t);
  }, [autoPrint, ready, items]);

  const renderElemento = (el: LabelElement, item: LabelRenderItem) => {
    const style: React.CSSProperties = {
      position: 'absolute',
      left: `${el.x}mm`,
      top: `${el.y}mm`,
      width: `${el.width}mm`,
      height: `${el.height}mm`,
      overflow: 'hidden',
      display: 'flex',
      alignItems: 'center',
      justifyContent: el.align === 'center' ? 'center' : el.align === 'right' ? 'flex-end' : 'flex-start',
    };
    if (el.type === 'qr') {
      const url = qrMap[item.key];
      return <div key={el.id} style={style}>{url ? <img src={url} alt="QR" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : null}</div>;
    }
    if (el.type === 'logo') {
      return <div key={el.id} style={style}>{item.eventImage ? <img src={item.eventImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : null}</div>;
    }
    let value = el.type === 'field' ? resolveField(el.field, item) : (el.text || '');
    if (el.type === 'field' && el.field === 'attendeeName' && el.nameFormat === 'first_last') {
      value = primeiroUltimoNome(value);
    }
    if (el.uppercase) value = value.toUpperCase();
    return (
      <div
        key={el.id}
        style={{
          ...style,
          fontSize: `${el.fontSize}pt`,
          fontWeight: el.fontWeight,
          lineHeight: 1.05,
          color: '#000',
        }}
      >
        <FitText text={value} align={el.align} />
      </div>
    );
  };

  return (
    <>
      <style>{`
        @page { size: ${widthMm}mm ${heightMm}mm; margin: 0; }
        ${screenHidden ? '@media screen { #etiquetas-print { display: none !important; } }' : ''}
        @media print {
          body * { visibility: hidden !important; }
          #etiquetas-print, #etiquetas-print * { visibility: visible !important; }
          #etiquetas-print { position: absolute !important; left: 0; top: 0; padding: 0 !important; margin: 0 !important; background: none !important; border: none !important; box-shadow: none !important; display: block !important; }
          /* cada inscrito = uma etiqueta em página separada */
          .etiqueta { page-break-after: always; break-after: page; border: none !important; box-shadow: none !important; border-radius: 0 !important; margin: 0 !important; }
          .etiqueta:last-child { page-break-after: auto; break-after: auto; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div
        id="etiquetas-print"
        className={screenHidden ? '' : 'mx-auto mb-10 flex max-w-4xl flex-wrap justify-center gap-4 rounded-2xl border bg-muted/40 p-4 sm:p-6'}
      >
        {items.map((item) => (
          <div
            key={item.key}
            className="etiqueta relative overflow-hidden rounded-md bg-white ring-1 ring-black/10 shadow-sm"
            style={{ width: `${widthMm}mm`, height: `${heightMm}mm`, boxSizing: 'border-box' }}
          >
            {(template.elements || []).map((el) => renderElemento(el, item))}
          </div>
        ))}
      </div>
    </>
  );
}

export default LabelSheet;
