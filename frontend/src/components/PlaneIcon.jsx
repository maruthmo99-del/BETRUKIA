export default function PlaneIcon({ rotation = 0, size = 32, crashed = false }) {
  const center = size / 2;
  const body = crashed ? "#fb7185" : "#ef4444"; // red fuselage
  const wing = crashed ? "#fca5a5" : "#f97316"; // orange wing accent
  const trim = crashed ? "#fee2e2" : "#fff7ed";

  // Compact biplane-like silhouette SVG tuned for small badges
  return (
    <svg width={size} height={size} viewBox="0 0 64 48" aria-hidden="true">
      <g transform={`translate(${(64 - size) / 2}, ${(48 - size) / 2}) rotate(${rotation}, ${center}, ${center})`}>
        <g transform={`scale(${size / 48}) translate(0,4)`}> 
          <path d="M6 28 C8 22 14 18 22 18 C30 18 36 22 38 26 C39.2 29 38 30 36 34 C34 38 28 40 22 40 C16 40 10 38 8 34 C6 30 5 28 6 28 Z" fill={body} stroke="#0b1220" strokeWidth="0.8" strokeLinejoin="round"/>
          <rect x="2" y="14" width="36" height="6" rx="2" fill={wing} stroke="#0b1220" strokeWidth="0.7"/>
          <rect x="2" y="28" width="36" height="6" rx="2" fill={wing} stroke="#0b1220" strokeWidth="0.7"/>
          <path d="M30 16 L44 12 L58 16 L54 20 L46 18 L38 22 Z" fill={wing} opacity="0.9" stroke="#0b1220" strokeWidth="0.6"/>
          <rect x="44" y="22" width="12" height="6" rx="2" fill={wing} stroke="#0b1220" strokeWidth="0.6"/>

          <circle cx="10" cy="26" r="3.6" fill={trim} opacity="0.95" />
          <g transform="translate(10 26)">
            <rect x="-0.5" y="-8" width="1" height="16" fill="#0b1220" transform="rotate(0)" />
            <rect x="-0.5" y="-8" width="1" height="16" fill="#0b1220" transform="rotate(45)" />
            <rect x="-0.5" y="-8" width="1" height="16" fill="#0b1220" transform="rotate(-45)" />
          </g>

          <path d="M2 36 L14 40" stroke="#0b1220" strokeWidth="1.2" strokeLinecap="round" />
          <path d="M20 36 L32 40" stroke="#0b1220" strokeWidth="1.2" strokeLinecap="round" />
          <ellipse cx="28" cy="44" rx="18" ry="2" fill="#0b1220" opacity="0.12" />
        </g>
      </g>
    </svg>
  );
}
