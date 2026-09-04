'use client';

// ProfitPulse wordmark: the stem of "P" extends into a heart-rate pulse
// wave that transitions into an upward financial growth arrow.
export function PulseMark({ size = 34, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      {/* P bowl */}
      <path
        d="M10 6h10a9 9 0 0 1 0 18h-6"
        stroke="hsl(189 94% 43%)"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* P stem descending, becoming the pulse baseline */}
      <path
        d="M10 6v28"
        stroke="hsl(189 94% 43%)"
        strokeWidth="4"
        strokeLinecap="round"
      />
      {/* pulse wave -> growth arrow */}
      <path
        d="M10 34h6l4-9 5 15 5-24 4 12h5"
        stroke="hsl(160 84% 39%)"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* arrow head */}
      <path
        d="M40 28l4-4 0 8"
        stroke="hsl(160 84% 39%)"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Logo({ size = 34, showText = true, className = '' }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <PulseMark size={size} />
      {showText && (
        <span className="text-xl font-extrabold tracking-tight text-foreground">
          Profit<span className="text-primary">Pulse</span>
        </span>
      )}
    </div>
  );
}

export default Logo;
