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
export async function imprimirEtiquetasPdf(widthMm: number, heightMm: number): Promise<void> {
  const nodes = Array.from(
    document.querySelectorAll<HTMLElement>('#etiquetas-print .etiqueta'),
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
  const url = doc.output('bloburl');
  const win = window.open(url, '_blank');
  if (!win) doc.save('etiquetas.pdf'); // popup bloqueado → baixa o PDF
}

export default imprimirEtiquetasPdf;
