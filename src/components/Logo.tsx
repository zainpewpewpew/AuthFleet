import * as React from 'react';

/**
 * AuthFleet mark: a glossy aqua paper plane cradled inside a chrome capsule.
 * The world's signature move in miniature — rendered as inline SVG with its
 * own gradients so it carries the Y2K Frutiger Aero material wherever it lands.
 */
export function Logo({ size = 40 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      role="img"
      aria-label="AuthFleet"
      style={{ display: 'block' }}
    >
      <defs>
        <linearGradient id="af-logo-chrome" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FDFEFF" />
          <stop offset="0.45" stopColor="#D3E2F2" />
          <stop offset="0.75" stopColor="#BCD1E6" />
          <stop offset="1" stopColor="#EAF2FB" />
        </linearGradient>
        <linearGradient id="af-logo-aqua" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8EE4FF" />
          <stop offset="0.6" stopColor="#00C9D4" />
          <stop offset="1" stopColor="#008CA8" />
        </linearGradient>
        <linearGradient id="af-logo-plane-lit" x1="0.1" y1="0" x2="0.9" y2="1">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.95" />
          <stop offset="0.4" stopColor="#FFFFFF" stopOpacity="0.1" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="af-logo-highlight" cx="0.3" cy="0.2" r="0.6">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.9" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* chrome capsule */}
      <rect x="2" y="2" width="44" height="44" rx="14" fill="url(#af-logo-chrome)" />
      <rect x="2" y="2" width="44" height="44" rx="14" fill="url(#af-logo-highlight)" />
      <rect x="2.5" y="2.5" width="43" height="43" rx="13.5"
        fill="none" stroke="#8FA7C4" strokeOpacity="0.55" />
      {/* aqua plane */}
      <g transform="translate(24 24) rotate(-14)">
        <path
          d="M -14 6 L 14 -6 L 6 0 L 14 6 Z"
          fill="url(#af-logo-aqua)"
          stroke="#003E4A"
          strokeOpacity="0.35"
          strokeWidth="0.75"
        />
        <path
          d="M -14 6 L 14 -6 L 6 0 Z"
          fill="url(#af-logo-plane-lit)"
        />
      </g>
    </svg>
  );
}

/** Wordmark used alongside the capsule in app chrome. */
export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`af-wordmark ${className}`}>
      Auth<span>Fleet</span>
    </span>
  );
}
