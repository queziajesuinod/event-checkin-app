import { toPng } from 'html-to-image';
import JsPDF from 'jspdf';

function isAndroid(): boolean {
  return /Android/i.test(navigator.userAgent || '');
}

/**
 * Impressão no Android via window.print() da própria página — o Chrome do Android
 * NÃO consegue abrir a janela de impressão a partir de um PDF dentro de iframe
 * (diferente do iOS/desktop), então o método do PDF não abria nada.
 *
 * Isola no DOM só a(s) etiqueta(s) selecionada(s) (esconde as demais na impressão),
 * chama window.print() — que abre a janela nativa do Android — e restaura o DOM
 * quando a impressão termina. Resolve a Promise no 'afterprint' para que impressões
 * em sequência (ex.: "Imprimir todas") abram uma janela por vez, na ordem.
 */
function imprimirViaNavegador(printId: string, keys?: string[]): Promise<void> {
  return new Promise((resolve) => {
    const todas = Array.from(
      document.querySelectorAll<HTMLElement>(`#${printId} .etiqueta`),
    );
    const want = keys && keys.length ? new Set(keys) : null;
    const alvos = want ? todas.filter((n) => want.has(n.dataset.labelKey || '')) : todas;
    if (!alvos.length) { window.print(); resolve(); return; }

    // Marca as não-selecionadas para esconder e a última selecionada para não
    // deixar página/etiqueta em branco no fim (page-break-after do LabelSheet).
    const escondidas: HTMLElement[] = [];
    if (want) {
      todas.forEach((n) => {
        if (!want.has(n.dataset.labelKey || '')) {
          n.setAttribute('data-print-skip', '');
          escondidas.push(n);
        }
      });
    }
    const ultima = alvos[alvos.length - 1];
    ultima.setAttribute('data-print-last', '');

    const style = document.createElement('style');
    style.textContent = `@media print {
      #${printId} .etiqueta[data-print-skip] { display: none !important; }
      #${printId} .etiqueta[data-print-last] { page-break-after: auto !important; break-after: auto !important; }
    }`;
    document.head.appendChild(style);

    let feito = false;
    const limpar = () => {
      if (feito) return;
      feito = true;
      escondidas.forEach((n) => n.removeAttribute('data-print-skip'));
      ultima.removeAttribute('data-print-last');
      try { style.remove(); } catch { /* já removido */ }
      window.removeEventListener('afterprint', limpar);
      resolve();
    };

    window.addEventListener('afterprint', limpar);
    // Fallback: em alguns Androids o 'afterprint' pode não disparar.
    setTimeout(limpar, 60000);

    // Deixa o <style> aplicar antes de abrir a janela de impressão.
    setTimeout(() => { try { window.print(); } catch { limpar(); } }, 50);
  });
}

/**
 * Gera um PDF com UMA PÁGINA POR ETIQUETA no tamanho EXATO do modelo (em mm) e
 * dispara a impressão. Diferente do window.print() do navegador (que no iOS cai
 * para A4 quando não há impressora de etiqueta selecionada), o PDF carrega o
 * tamanho de página embutido — então o preview/AirPrint respeita 29×90 (ou o que
 * o modelo definir) e a Brother imprime no rótulo certo.
 *
 * Rasteriza as próprias etiquetas já renderizadas (.etiqueta dentro de
 * #etiquetas-print), mantendo o layout idêntico (rotação, marca d'água, QR, logo).
 *
 * No Android (onde o PDF em iframe não abre a janela de impressão) cai para o
 * caminho window.print() via imprimirViaNavegador().
 */
export async function imprimirEtiquetasPdf(
  widthMm: number,
  heightMm: number,
  printId = 'etiquetas-print',
  opts?: { keys?: string[] },
): Promise<void> {
  // Android: o PDF-em-iframe não abre a janela de impressão. Usa window.print().
  if (isAndroid()) {
    await imprimirViaNavegador(printId, opts?.keys);
    return;
  }

  let nodes = Array.from(
    document.querySelectorAll<HTMLElement>(`#${printId} .etiqueta`),
  );
  // Se um subconjunto de keys for informado, imprime só essas etiquetas (ex.:
  // reimprimir um único inscrito, ou disparar um trabalho por etiqueta).
  if (opts?.keys && opts.keys.length) {
    const want = new Set(opts.keys);
    nodes = nodes.filter((n) => want.has(n.dataset.labelKey || ''));
  }
  if (!nodes.length) {
    window.print();
    return;
  }

  const w = Number(widthMm) || 90;
  const h = Number(heightMm) || 29;
  const orient: 'portrait' | 'landscape' = w >= h ? 'landscape' : 'portrait';
  const doc = new JsPDF({ unit: 'mm', orientation: orient, format: [w, h] });

  for (let i = 0; i < nodes.length; i += 1) {
    // Alta resolução p/ impressão térmica nítida; fundo branco; sem sombra/borda da tela.
    // eslint-disable-next-line no-await-in-loop
    const png = await toPng(nodes[i], {
      pixelRatio: 6,
      backgroundColor: '#ffffff',
      style: {
        boxShadow: 'none', border: 'none', borderRadius: '0', margin: '0',
      },
    });
    if (i > 0) doc.addPage([w, h], orient);
    doc.addImage(png, 'PNG', 0, 0, w, h);
  }

  doc.autoPrint();
  const url = String(doc.output('bloburl'));

  // Imprime o PDF via iframe oculto e dispara print() nele: a janela de impressão
  // abre automaticamente (não só abre o PDF), sem depender de pop-up nem de aba nova.
  // Se algo falhar, cai para abrir em nova aba (visualizador respeita o autoPrint) ou baixar.
  await new Promise<void>((resolve) => {
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
    iframe.src = url;

    let finalizado = false;
    const limpar = () => { setTimeout(() => { try { iframe.remove(); } catch { /* já removido */ } }, 60000); };

    iframe.onload = () => {
      if (finalizado) return;
      finalizado = true;
      try {
        const w2 = iframe.contentWindow;
        if (!w2) throw new Error('sem contentWindow');
        w2.focus();
        w2.print();
      } catch {
        const win = window.open(url, '_blank');
        if (!win) doc.save('etiquetas.pdf'); // pop-up bloqueado → baixa o PDF
      }
      limpar();
      resolve();
    };

    // Segurança: se o iframe não carregar, usa o fallback de nova aba/download.
    setTimeout(() => {
      if (finalizado) return;
      finalizado = true;
      const win = window.open(url, '_blank');
      if (!win) doc.save('etiquetas.pdf');
      limpar();
      resolve();
    }, 3000);

    document.body.appendChild(iframe);
  });
}

export default imprimirEtiquetasPdf;
