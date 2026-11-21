import { useMemo } from 'react';
import QRCode from 'qrcode';

export function getGuestJoinUrl(): string {
  if (typeof window === 'undefined') return '/play';
  return `${window.location.origin}/play`;
}

export function getDisplayJoinUrl(): string {
  if (typeof window === 'undefined') return '/play';
  return `${window.location.host}/play`;
}

interface QrCodeSvgProps {
  value: string;
  size?: number | string;
  fgColor?: string;
  bgColor?: string;
  quietZone?: number;
  className?: string;
  label?: string;
}

/**
 * Synchronous, offline vector QR code renderer backed by `qrcode`.
 * Emits a single clean SVG path with zero raw HTML injection and razor-sharp
 * output on both 4K displays and A4 printouts.
 */
export function QrCodeSvg({
  value,
  size = 180,
  fgColor = '#08090A',
  bgColor = '#FFFFFF',
  quietZone = 2,
  className = '',
  label = 'Scan QR code to join the game',
}: QrCodeSvgProps) {
  const { viewBoxSize, pathData } = useMemo(() => {
    const qr = QRCode.create(value, { errorCorrectionLevel: 'M' });
    const count = qr.modules.size;
    const total = count + quietZone * 2;
    const commands: string[] = [];

    for (let row = 0; row < count; row++) {
      for (let col = 0; col < count; col++) {
        if (qr.modules.get(row, col)) {
          const x = col + quietZone;
          const y = row + quietZone;
          commands.push(`M${x},${y}h1v1h-1z`);
        }
      }
    }

    return {
      viewBoxSize: total,
      pathData: commands.join(''),
    };
  }, [value, quietZone]);

  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
      width={size}
      height={size}
      shapeRendering="crispEdges"
      className={className}
    >
      <rect width={viewBoxSize} height={viewBoxSize} fill={bgColor} />
      <path d={pathData} fill={fgColor} />
    </svg>
  );
}
