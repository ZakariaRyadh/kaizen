import { useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';

/** Small line chart (oldest → newest) with a soft fill; last point highlighted. */
export function MiniChart({ values, color, height = 70 }: { values: number[]; color: string; height?: number }) {
  const [w, setW] = useState(0);
  const pad = 6;
  const pts = values.length;
  let line = '';
  let area = '';
  let last: [number, number] | null = null;
  if (w > 0 && pts >= 2) {
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;
    const xy = values.map((v, i): [number, number] => [
      pad + (i * (w - pad * 2)) / (pts - 1),
      pad + (1 - (v - min) / span) * (height - pad * 2),
    ]);
    line = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
    area = `${line} L${xy[pts - 1][0].toFixed(1)} ${height} L${xy[0][0].toFixed(1)} ${height} Z`;
    last = xy[pts - 1];
  }
  return (
    <View style={{ height }} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      {w > 0 && pts >= 2 && (
        <Svg width={w} height={height}>
          <Defs>
            <LinearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={color} stopOpacity={0.28} />
              <Stop offset="1" stopColor={color} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Path d={area} fill="url(#fill)" />
          <Path d={line} stroke={color} strokeWidth={2.2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
          {last && <Circle cx={last[0]} cy={last[1]} r={4} fill={color} stroke="#0e0e13" strokeWidth={2} />}
        </Svg>
      )}
    </View>
  );
}
