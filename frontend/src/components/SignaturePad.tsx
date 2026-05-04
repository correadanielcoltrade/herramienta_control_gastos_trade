import type { PointerEvent as ReactPointerEvent } from "react";
import { useEffect, useRef } from "react";

interface SignaturePadProps {
  onChange: (value: string) => void;
  value: string;
}

const CANVAS_HEIGHT = 220;
const CANVAS_WIDTH = 640;

export function SignaturePad({ onChange, value }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.lineCap = "round";
    context.lineJoin = "round";
    context.lineWidth = 2;
    context.strokeStyle = "#0f172a";

    if (!value) {
      return;
    }

    const image = new Image();
    image.onload = () => {
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
    };
    image.src = value;
  }, [value]);

  function getCoordinates(event: ReactPointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) {
      return null;
    }

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    };
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    const coordinates = getCoordinates(event);
    if (!canvas || !context || !coordinates) {
      return;
    }

    isDrawingRef.current = true;
    canvas.setPointerCapture(event.pointerId);
    context.beginPath();
    context.moveTo(coordinates.x, coordinates.y);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!isDrawingRef.current) {
      return;
    }

    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    const coordinates = getCoordinates(event);
    if (!canvas || !context || !coordinates) {
      return;
    }

    context.lineTo(coordinates.x, coordinates.y);
    context.stroke();
  }

  function finishDrawing() {
    if (!isDrawingRef.current) {
      return;
    }

    isDrawingRef.current = false;
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    onChange(canvas.toDataURL("image/png"));
  }

  function clearSignature() {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) {
      return;
    }

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    onChange("");
  }

  return (
    <div className="space-y-3">
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="h-[220px] w-full touch-none rounded-3xl border border-slate-200 bg-white"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishDrawing}
        onPointerLeave={finishDrawing}
      />
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-500">Dibuja la firma dentro del recuadro.</p>
        <button
          type="button"
          className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          onClick={clearSignature}
        >
          Limpiar firma
        </button>
      </div>
    </div>
  );
}
