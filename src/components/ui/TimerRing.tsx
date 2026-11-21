interface TimerRingProps {
  totalSeconds: number;
  remainingMs: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

export function TimerRing({
  totalSeconds,
  remainingMs,
  size = 64,
  strokeWidth = 3.5,
  className = '',
}: TimerRingProps) {
  const safeTotalMs = Math.max(1000, totalSeconds * 1000);
  const clampedMs = Math.max(0, Math.min(safeTotalMs, remainingMs));
  const progress = clampedMs / safeTotalMs;
  const secondsDisplay = Math.ceil(clampedMs / 1000);

  const isWarning = secondsDisplay > 0 && secondsDisplay <= 5;
  const isExpired = secondsDisplay === 0;

  const strokeColor = isExpired
    ? '#F2555A'
    : isWarning
      ? '#F5A524'
      : '#C8F560';

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  // Deplete clockwise by advancing strokeDashoffset from 0 to circumference
  const dashOffset = circumference * (1 - progress);

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 ${className}`}
      style={{ width: size, height: size }}
      role="timer"
      aria-label={`${secondsDisplay} seconds remaining`}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#23252A"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{ transition: 'stroke 150ms ease-out' }}
        />
      </svg>
      <span
        className="absolute tabular-mono font-semibold leading-none"
        style={{
          fontSize: Math.max(13, Math.round(size * 0.28)),
          color: isExpired ? '#F2555A' : isWarning ? '#F5A524' : '#F7F8F8',
        }}
      >
        {secondsDisplay}s
      </span>
    </div>
  );
}
