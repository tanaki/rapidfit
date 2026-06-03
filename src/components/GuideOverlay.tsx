interface Props {
  visible: boolean;
}

export function GuideOverlay({ visible }: Props) {
  if (!visible) return null;
  return (
    <svg
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 150, pointerEvents: 'none' }}
    >
      {/* Horizontal center line */}
      <line x1="0" y1="50%" x2="100%" y2="50%" stroke="rgba(255,220,50,0.7)" strokeWidth="1" />
      {/* Vertical center line */}
      <line x1="50%" y1="0" x2="50%" y2="100%" stroke="rgba(255,220,50,0.7)" strokeWidth="1" />
      {/* 80% safe-area rectangle */}
      <rect
        x="10%" y="10%"
        width="80%" height="80%"
        fill="none"
        stroke="rgba(255,220,50,0.7)"
        strokeWidth="1"
        strokeDasharray="6 3"
      />
    </svg>
  );
}
