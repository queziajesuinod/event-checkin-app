import { useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';

interface SignaturePadProps {
  onChange?: (dataUrl: string | null) => void;
  height?: number;
  disabled?: boolean;
}

/**
 * Canvas de assinatura a mao livre, sem dependencias externas.
 * Emite o PNG (data-URL) via onChange ao final de cada traço; null ao limpar.
 */
export function SignaturePad({ onChange, height = 170, disabled = false }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const hasContent = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);

  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const width = canvas.clientWidth || 300;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#111827';
  }, [height]);

  useEffect(() => {
    setupCanvas();
    const onResize = () => setupCanvas();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [setupCanvas]);

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    drawing.current = true;
    last.current = pos(e);
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
  };

  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || disabled) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx || !last.current) return;
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
    hasContent.current = true;
  };

  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    last.current = null;
    if (hasContent.current && canvasRef.current) {
      onChange?.(canvasRef.current.toDataURL('image/png'));
    }
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    hasContent.current = false;
    onChange?.(null);
  };

  return (
    <div className="w-full">
      <canvas
        ref={canvasRef}
        style={{ height, touchAction: 'none' }}
        className="w-full rounded-md border border-input bg-white cursor-crosshair"
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
      />
      <div className="mt-1 flex justify-end">
        <Button type="button" variant="ghost" size="sm" onClick={clear} disabled={disabled}>
          Limpar assinatura
        </Button>
      </div>
    </div>
  );
}

export default SignaturePad;
