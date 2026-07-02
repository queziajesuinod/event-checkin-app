// Extrai as cores dominantes de uma imagem (client-side, via canvas) para
// tematizar a página de acordo com a arte do evento, mantendo contraste do texto.

export interface ImagePalette {
  /** Overlay escuro tingido com a cor média da imagem (topo do gradiente). */
  overlay: string;
  /** Overlay um pouco mais forte/escuro (base do gradiente). */
  overlayStrong: string;
  /** Cor de acento vibrante extraída da imagem (para detalhes/realces). */
  accent: string;
  /** Cor de texto legível sobre o acento (#fff ou #0f172a). */
  accentText: string;
  /** box-shadow colorido (puxa o tom da imagem) para cards/boxes. */
  shadow: string;
}

type RGB = [number, number, number];

const relativeLuminance = ([r, g, b]: RGB) =>
  (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

// Escurece uma cor até atingir (no máximo) a luminância alvo, sem clarear.
const darkenToLuminance = (rgb: RGB, target: number): RGB => {
  const lum = Math.max(relativeLuminance(rgb), 0.001);
  const factor = Math.min(1, target / lum);
  return [
    Math.round(rgb[0] * factor),
    Math.round(rgb[1] * factor),
    Math.round(rgb[2] * factor),
  ];
};

export function extractImagePalette(src: string): Promise<ImagePalette | null> {
  return new Promise((resolve) => {
    if (!src) return resolve(null);

    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const size = 64;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return resolve(null);

        ctx.drawImage(img, 0, 0, size, size);
        const { data } = ctx.getImageData(0, 0, size, size);

        let r = 0;
        let g = 0;
        let b = 0;
        let count = 0;
        let bestVibrant: RGB | null = null;
        let bestScore = -1;

        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] < 125) continue; // ignora pixels muito transparentes
          const cr = data[i];
          const cg = data[i + 1];
          const cb = data[i + 2];

          r += cr;
          g += cg;
          b += cb;
          count++;

          // Pontua vibrância: saturação alta + brilho médio (evita preto/branco)
          const max = Math.max(cr, cg, cb);
          const min = Math.min(cr, cg, cb);
          const sat = max === 0 ? 0 : (max - min) / max;
          const lum = relativeLuminance([cr, cg, cb]);
          const score = sat * (1 - Math.abs(lum - 0.5));
          if (score > bestScore) {
            bestScore = score;
            bestVibrant = [cr, cg, cb];
          }
        }

        if (!count) return resolve(null);

        const avg: RGB = [
          Math.round(r / count),
          Math.round(g / count),
          Math.round(b / count),
        ];
        const accent = bestVibrant ?? avg;
        const overlay = darkenToLuminance(avg, 0.16);
        const overlayStrong = darkenToLuminance(accent, 0.09);
        // Sombra colorida: tom vibrante da imagem, opaca e difusa (efeito "glow")
        const shadowColor = darkenToLuminance(accent, 0.28);

        resolve({
          overlay: `rgba(${overlay[0]}, ${overlay[1]}, ${overlay[2]}, 0.66)`,
          overlayStrong: `rgba(${overlayStrong[0]}, ${overlayStrong[1]}, ${overlayStrong[2]}, 0.8)`,
          accent: `rgb(${accent[0]}, ${accent[1]}, ${accent[2]})`,
          accentText: relativeLuminance(accent) > 0.6 ? '#0f172a' : '#ffffff',
          shadow: `0 22px 48px -12px rgba(${shadowColor[0]}, ${shadowColor[1]}, ${shadowColor[2]}, 0.6)`,
        });
      } catch {
        // Canvas "tainted" (imagem cross-origin sem CORS) — usa fallback.
        resolve(null);
      }
    };

    img.onerror = () => resolve(null);
    img.src = src;
  });
}
