import { Html5Qrcode, Html5QrcodeScannerState, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { useEffect, useId, useState } from "react";

interface QRScannerProps {
  active: boolean;
  onDetected: (value: string) => void;
}

const SUPPORTED_FORMATS = [
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.CODE_39,
  Html5QrcodeSupportedFormats.QR_CODE,
];

export function QRScanner({ active, onDetected }: QRScannerProps) {
  const scannerId = useId().replace(/:/g, "");
  const [message, setMessage] = useState("Camara lista para iniciar.");

  useEffect(() => {
    if (!active) {
      return;
    }

    const scanner = new Html5Qrcode(scannerId, {
      formatsToSupport: SUPPORTED_FORMATS,
      verbose: false,
      experimentalFeatures: {
        useBarCodeDetectorIfSupported: true,
      },
    });
    let cancelled = false;

    const startScanner = async () => {
      try {
        await scanner.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: 260, height: 180 },
            disableFlip: false,
          },
          (decodedText) => {
            if (!cancelled) {
              onDetected(decodedText.trim());
              setMessage(`Leido: ${decodedText.trim()}`);
            }
          },
          () => undefined,
        );
        if (!cancelled) {
          setMessage("Escaner activo. Apunta la camara al serial.");
        }
      } catch (error) {
        if (!cancelled) {
          setMessage("No fue posible iniciar la camara. Revisa permisos del navegador.");
        }
      }
    };

    const startPromise = startScanner();

    return () => {
      cancelled = true;
      void (async () => {
        try {
          await startPromise;
        } catch {
          // Si la inicializacion falla, igual intentamos limpiar el contenedor.
        }

        try {
          const state = scanner.getState();

          if (
            state === Html5QrcodeScannerState.SCANNING ||
            state === Html5QrcodeScannerState.PAUSED
          ) {
            await scanner.stop();
          }
        } catch {
          // Ignoramos errores de cierre para evitar ruido al desmontar.
        }

        try {
          scanner.clear();
        } catch {
          // clear() lanza si el escaner sigue ocupado; no debe romper el desmontaje.
        }

        // Limpiar cualquier elemento de audio residual
        try {
          const audioElements = document.querySelectorAll("audio");
          audioElements.forEach((audio) => {
            audio.pause();
            audio.src = "";
            audio.removeAttribute("src");
          });
        } catch {
          // Ignorar errores al limpiar audio
        }
      })();
    };
  }, [active, onDetected, scannerId]);

  return (
    <div className="space-y-3">
      <div id={scannerId} className="min-h-[260px] overflow-hidden rounded-3xl bg-slate-100" />
      <p className="rounded-2xl bg-brand-50 px-4 py-3 text-sm text-brand-700">{message}</p>
    </div>
  );
}
