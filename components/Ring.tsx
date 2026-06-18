import Svg, { Circle } from 'react-native-svg';

// Circular progress ring. progress = 0..1.
export function Ring({
  size,
  stroke,
  progress,
  color,
  track = 'rgba(255,255,255,0.1)',
}: {
  size: number;
  stroke: number;
  progress: number;
  color: string;
  track?: string;
}) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.max(0, Math.min(1, progress)));
  const c = size / 2;
  return (
    <Svg width={size} height={size}>
      <Circle cx={c} cy={c} r={r} stroke={track} strokeWidth={stroke} fill="none" />
      <Circle
        cx={c}
        cy={c}
        r={r}
        stroke={color}
        strokeWidth={stroke}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${c} ${c})`}
      />
    </Svg>
  );
}
