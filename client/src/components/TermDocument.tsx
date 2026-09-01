import { useLayoutEffect, useRef, useState } from 'react';

interface TermDocumentProps {
  html: string;                  // HTML já sanitizado, com {{QUEBRA_PAGINA}} preservado
  backgroundImageUrl?: string | null;
  topOffset?: number;            // % da altura da FOLHA A4 onde o texto começa
  bottomOffset?: number;         // % da folha reservado no rodapé
  sidePaddingPct?: number;       // % de recuo lateral (cada lado)
}

// Restaura estilos de lista (o preflight do Tailwind zera ul/ol/li).
const TERM_CSS = `
.term-content ul { list-style: disc; padding-left: 1.25rem; margin: 0.35rem 0; }
.term-content ol { list-style: decimal; padding-left: 1.25rem; margin: 0.35rem 0; }
.term-content li { display: list-item; }
.term-content p { margin: 0.35rem 0; }
`;

interface MeasureStyle { fontSize: string; lineHeight: string; fontFamily: string; }

// Divide o HTML em páginas medindo blocos num container offscreen que replica
// EXATAMENTE a largura, altura útil e fonte da caixa de texto renderizada.
function paginate(html: string, widthPx: number, pageHeightPx: number, style?: MeasureStyle): string[] {
  if (!widthPx || !pageHeightPx || pageHeightPx < 20) return [html];

  const mkBox = () => {
    const el = document.createElement('div');
    el.className = 'term-content';
    el.style.cssText = `position:absolute;left:-99999px;top:0;visibility:hidden;width:${widthPx}px;`;
    if (style) {
      el.style.fontSize = style.fontSize;
      el.style.lineHeight = style.lineHeight;
      el.style.fontFamily = style.fontFamily;
    }
    document.body.appendChild(el);
    return el;
  };

  const measurer = mkBox();
  measurer.innerHTML = html;
  const blocks = Array.from(measurer.children) as HTMLElement[];
  const pageEl = mkBox();

  const pages: string[] = [];
  const flush = () => {
    if (pageEl.childNodes.length) { pages.push(pageEl.innerHTML); pageEl.innerHTML = ''; }
  };

  for (const block of blocks) {
    const isBreak = (block.textContent || '').trim() === '{{QUEBRA_PAGINA}}'
      || block.getAttribute('data-pagebreak') != null;
    if (isBreak) { flush(); continue; }
    const clone = block.cloneNode(true) as HTMLElement;
    pageEl.appendChild(clone);
    if (pageEl.scrollHeight > pageHeightPx && pageEl.childNodes.length > 1) {
      pageEl.removeChild(clone);
      flush();
      pageEl.appendChild(clone);
    }
  }
  flush();

  document.body.removeChild(measurer);
  document.body.removeChild(pageEl);
  return pages.length ? pages : [''];
}

export function TermDocument({
  html, backgroundImageUrl, topOffset = 0, bottomOffset = 0, sidePaddingPct = 8,
}: TermDocumentProps) {
  const sheetRef = useRef<HTMLDivElement>(null);   // primeira folha (para observar tamanho)
  const overlayRef = useRef<HTMLDivElement>(null); // caixa de texto da primeira folha
  const [pages, setPages] = useState<string[]>([html]);

  // Mede a caixa de texto REAL (largura/altura úteis + fonte) e pagina com base nela.
  useLayoutEffect(() => {
    const measure = () => {
      const ov = overlayRef.current;
      if (!ov || !backgroundImageUrl) { setPages([html]); return; }
      const widthPx = ov.clientWidth;
      const heightPx = ov.clientHeight;
      if (!widthPx || !heightPx) { setPages([html]); return; }
      const cs = window.getComputedStyle(ov);
      setPages(paginate(html, widthPx, heightPx, {
        fontSize: cs.fontSize, lineHeight: cs.lineHeight, fontFamily: cs.fontFamily,
      }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (sheetRef.current) ro.observe(sheetRef.current);
    return () => ro.disconnect();
  }, [html, topOffset, bottomOffset, sidePaddingPct, backgroundImageUrl]);

  // Sem imagem: fluxo único rolável
  if (!backgroundImageUrl) {
    return (
      <div className="w-full">
        <style>{TERM_CSS}</style>
        <div
          className="term-content max-w-none max-h-72 overflow-y-auto rounded-md bg-muted/40 p-3 text-sm"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    );
  }

  return (
    <div className="w-full space-y-3">
      <style>{TERM_CSS}</style>
      {pages.map((pageHtml, i) => (
        <div
          key={i}
          ref={i === 0 ? sheetRef : undefined}
          className="relative w-full overflow-hidden rounded-md border bg-white"
          style={{ aspectRatio: '210 / 297' }}
        >
          {/* Imagem no topo, tamanho natural; se menor que A4, o restante fica branco */}
          <img
            src={backgroundImageUrl}
            alt={`termo página ${i + 1}`}
            className="absolute left-0 top-0 block w-full"
            style={{ height: 'auto' }}
          />
          <div
            ref={i === 0 ? overlayRef : undefined}
            className="term-content absolute overflow-hidden text-[11px] leading-snug text-black"
            style={{
              left: `${sidePaddingPct}%`,
              right: `${sidePaddingPct}%`,
              top: `${topOffset}%`,
              bottom: `${bottomOffset}%`,
            }}
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: pageHtml }}
          />
        </div>
      ))}
      {pages.length > 1 && (
        <p className="text-center text-xs text-muted-foreground">{pages.length} páginas</p>
      )}
    </div>
  );
}

export default TermDocument;
