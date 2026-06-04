/** Simplified bike fitting reference diagram — reproduces the standard measurement chart. */
export function BikeMeasurementDiagram() {
  const blue = '#3b82f6';
  const dark = '#1e293b';
  const dash = '5,4';
  const sw   = 7;  // frame stroke-width
  const lw   = 1.2; // measurement line width

  return (
    <svg viewBox="0 0 700 390" xmlns="http://www.w3.org/2000/svg" className="w-full">
      {/* ── Bike silhouette ── */}
      <g stroke={blue} fill="none" strokeLinecap="round" strokeLinejoin="round">
        {/* Wheels */}
        <circle cx="135" cy="298" r="78" strokeWidth={sw} />
        <circle cx="475" cy="298" r="78" strokeWidth={sw} />
        {/* Axles */}
        <circle cx="135" cy="298" r="5" fill={blue} stroke="none" />
        <circle cx="475" cy="298" r="5" fill={blue} stroke="none" />
        {/* BB */}
        <circle cx="300" cy="298" r="9" fill={blue} stroke="none" />

        {/* Frame */}
        {/* Chain stays */}
        <line x1="300" y1="298" x2="135" y2="298" strokeWidth={sw} />
        {/* Seat tube */}
        <line x1="300" y1="298" x2="268" y2="155" strokeWidth={sw} />
        {/* Seat stays */}
        <line x1="268" y1="155" x2="135" y2="298" strokeWidth={sw} />
        {/* Top tube */}
        <line x1="268" y1="155" x2="440" y2="143" strokeWidth={sw} />
        {/* Down tube */}
        <line x1="440" y1="143" x2="300" y2="298" strokeWidth={sw} />
        {/* Head tube */}
        <line x1="440" y1="143" x2="452" y2="173" strokeWidth={sw + 2} />
        {/* Fork */}
        <line x1="452" y1="173" x2="475" y2="298" strokeWidth={sw} />

        {/* Seat post */}
        <line x1="272" y1="162" x2="265" y2="126" strokeWidth={5} />
        {/* Saddle */}
        <path d="M244,122 Q255,118 265,120 Q275,118 286,122" strokeWidth={6} strokeLinecap="round" />

        {/* Stem */}
        <line x1="446" y1="145" x2="474" y2="136" strokeWidth={5} />
        {/* Handlebar — drop bar shape */}
        <path d="M466,130 L480,130 Q488,130 488,138 L488,158 Q488,166 480,166" strokeWidth={5} />
        {/* Hoods (grip/brake position) */}
        <circle cx="480" cy="136" r="4" fill={blue} stroke="none" />

        {/* Crank arm */}
        <line x1="300" y1="298" x2="322" y2="323" strokeWidth={5} />
        <line x1="300" y1="298" x2="278" y2="273" strokeWidth={5} />
        {/* Pedal */}
        <line x1="318" y1="326" x2="330" y2="320" strokeWidth={4} />
        <line x1="274" y1="270" x2="264" y2="277" strokeWidth={4} />
      </g>

      {/* ── Measurement lines ── */}
      <g stroke={dark} fill="none" strokeDasharray={dash} strokeWidth={lw}>
        {/* S — vertical from BB to saddle height */}
        <line x1="300" y1="298" x2="300" y2="120" />
        {/* R — horizontal from saddle to BB vertical */}
        <line x1="263" y1="120" x2="300" y2="120" />
        {/* A — horizontal from BB to handlebar, at top */}
        <line x1="300" y1="102" x2="484" y2="102" />
        {/* D — vertical at handlebar: saddle height vs bar height */}
        <line x1="484" y1="120" x2="484" y2="132" />
        {/* C — saddle to handlebar drop (hoods) */}
        <line x1="263" y1="120" x2="480" y2="136" />
        {/* G — saddle to handlebar center top */}
        <line x1="263" y1="120" x2="473" y2="130" />
        {/* P — saddle to beyond handlebar */}
        <line x1="263" y1="120" x2="488" y2="126" />
        {/* M — crank arm indicator */}
        <line x1="300" y1="298" x2="323" y2="324" strokeDasharray="none" />
      </g>

      {/* ── Measurement arrows ── */}
      <g fill={dark} stroke="none" fontSize="11" fontFamily="sans-serif" fontWeight="bold">
        {/* Arrow heads — simple triangles */}
        {/* S top */}
        <polygon points="300,115 296,123 304,123" />
        {/* S bottom */}
        <polygon points="300,303 296,295 304,295" />
        {/* A left */}
        <polygon points="295,102 303,98 303,106" />
        {/* A right */}
        <polygon points="489,102 481,98 481,106" />
        {/* R left */}
        <polygon points="258,120 266,116 266,124" />
        {/* R right */}
        <polygon points="305,120 297,116 297,124" />
      </g>

      {/* ── Labels ── */}
      <g fill={dark} fontFamily="sans-serif" fontWeight="bold" textAnchor="middle">
        <text x="392" y="98" fontSize="13">A</text>
        <text x="492" y="130" fontSize="13">D</text>
        <text x="382" y="136" fontSize="13">C</text>
        <text x="374" y="128" fontSize="13">G</text>
        <text x="382" y="116" fontSize="13">P</text>
        <text x="280" y="116" fontSize="13">R</text>
        <text x="315" y="215" fontSize="13">S</text>
        <text x="318" y="333" fontSize="13">M</text>
      </g>

      {/* ── Handlebar inset (top right) ── */}
      <g transform="translate(545, 18)">
        <text x="70" y="12" fontSize="10" fontFamily="sans-serif" fill="#64748b" textAnchor="middle">Cintre</text>
        {/* Front view of drop bar */}
        <g stroke={blue} fill="none" strokeWidth={4} strokeLinecap="round">
          {/* Top bar */}
          <line x1="20" y1="30" x2="120" y2="30" />
          {/* Left drop */}
          <path d="M20,30 Q12,30 12,42 L12,65 Q12,72 20,72" />
          {/* Right drop */}
          <path d="M120,30 Q128,30 128,42 L128,65 Q128,72 120,72" />
          {/* Hoods area */}
          <path d="M30,30 Q30,48 42,52" strokeWidth={3} />
          <path d="M110,30 Q110,48 98,52" strokeWidth={3} />
        </g>
        {/* 1 — Largeur */}
        <line x1="20" y1="20" x2="120" y2="20" stroke={dark} strokeWidth={1} strokeDasharray={dash} />
        <polygon points="20,20 27,17 27,23" fill={dark} />
        <polygon points="120,20 113,17 113,23" fill={dark} />
        <text x="70" y="17" fontSize="10" fontFamily="sans-serif" fontWeight="bold" fill={dark} textAnchor="middle">1</text>

        {/* 2 — Reach (from centre to hood) */}
        <line x1="70" y1="30" x2="98" y2="52" stroke={dark} strokeWidth={1} strokeDasharray={dash} />
        <text x="90" y="45" fontSize="10" fontFamily="sans-serif" fontWeight="bold" fill={dark}>2</text>

        {/* 3 — Drop */}
        <line x1="135" y1="30" x2="135" y2="72" stroke={dark} strokeWidth={1} strokeDasharray={dash} />
        <polygon points="135,30 132,38 138,38" fill={dark} />
        <polygon points="135,72 132,64 138,64" fill={dark} />
        <text x="143" y="54" fontSize="10" fontFamily="sans-serif" fontWeight="bold" fill={dark}>3</text>
      </g>

      {/* ── Stem inset (right, below handlebar) ── */}
      <g transform="translate(557, 130)">
        <text x="60" y="12" fontSize="10" fontFamily="sans-serif" fill="#64748b" textAnchor="middle">Potence</text>
        {/* Stem body — angled rectangle */}
        <g stroke={blue} fill="none" strokeWidth={4} strokeLinecap="round">
          <rect x="10" y="22" width="72" height="16" rx="3" transform="rotate(-8, 46, 30)" />
        </g>
        {/* 4 — Length arrow */}
        <line x1="10" y1="46" x2="82" y2="38" stroke={dark} strokeWidth={1} strokeDasharray={dash} />
        <polygon points="10,46 17,42 18,49" fill={dark} />
        <polygon points="82,38 75,34 76,41" fill={dark} />
        <text x="46" y="55" fontSize="10" fontFamily="sans-serif" fontWeight="bold" fill={dark} textAnchor="middle">4</text>

        {/* 5 — Angle arc */}
        <path d="M10,22 A30,30 0 0,1 36,10" stroke={dark} strokeWidth={1} fill="none" strokeDasharray={dash} />
        <text x="8" y="10" fontSize="10" fontFamily="sans-serif" fontWeight="bold" fill={dark}>5</text>
      </g>
    </svg>
  );
}
