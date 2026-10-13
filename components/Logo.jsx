'use client';

// PulseProfit brand logo (user-provided crest). The source image is a tall poster
// (832x1248) containing crown+crest, the PULSEPROFIT wordmark, and a feature strip.
// We crop with CSS to show just the parts we need:
//   variant="crest"  -> crown + circular crest (compact, for the app header / loader)
//   variant="lockup" -> crest + PULSEPROFIT wordmark (for marketing / landing)
const SRC = '/logo.jpg';
const RATIO = 832 / 1248; // width / height of source

export function Logo({ variant = 'crest', size = 40, className = '' }) {
  const f = variant === 'lockup' ? 0.74 : 0.58; // top fraction of the image to reveal
  const height = size;
  const width = (height * RATIO) / f;
  return (
    <div
      className={className}
      style={{ height, width, overflow: 'hidden', display: 'inline-block', lineHeight: 0 }}
    >
      <img src={SRC} alt="PulseProfit" style={{ width: '100%', display: 'block' }} />
    </div>
  );
}

// Kept for backward compatibility (used by the loading state).
export function PulseMark({ size = 48, className = '' }) {
  return <Logo variant="crest" size={size} className={className} />;
}

export default Logo;
