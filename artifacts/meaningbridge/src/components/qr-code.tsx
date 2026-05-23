import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";

type Props = {
  value: string;
  size?: number;
  className?: string;
};

export function QRCodeImage({ value, size = 320, className }: Props) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ref.current || !value) return;
    QRCode.toCanvas(
      ref.current,
      value,
      {
        errorCorrectionLevel: "H",
        margin: 2,
        width: size,
        color: { dark: "#1a2e4a", light: "#fafaf5" },
      },
      (err) => {
        if (err) setError(err.message);
      },
    );
  }, [value, size]);

  if (error) {
    return <div className="text-sm text-destructive">QR error: {error}</div>;
  }

  return <canvas ref={ref} className={className} aria-label={`QR code for ${value}`} />;
}
