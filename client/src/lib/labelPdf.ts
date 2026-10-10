import { toPng } from 'html-to-image';
import JsPDF from 'jspdf';

/**
 * Gera um PDF com UMA PÁGINA POR ETIQUETA no tamanho EXATO do modelo (em mm) e
 * dispara a impressão. Diferente do window.print() do navegador (que no iOS cai
 * para A4 quando não há impressora de etiqueta selecionada), o PDF carrega o
 * tamanho de página embutido — então o preview/AirPrint respeita 29×90 (ou o que
 * o modelo definir) e a Brother imprime no rótulo certo.
 *
 * Rasteriza as próprias etiquetas já renderizadas (.etiqueta dentro de
 * #etiquetas-print), mantendo o layout idêntico (rotação, marca d'água, QR, logo).
 */
export async function imprimirEtiquetasPdf(
  widthMm: number,
  heightMm: number,
  printId = 'etiquetas-print',
): Promise<void> {
  const nodes = Array.from(
    document.querySelectorAll<HTMLElement>(`#${printId} .etiqueta`),
  );
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
