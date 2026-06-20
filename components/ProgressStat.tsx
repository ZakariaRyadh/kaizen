import { Text, View } from 'react-native';

import { colors, fonts } from '../theme/colors';

// One "this period vs previous period" row: value, prior value, % change, up/down.
// Higher = better (green); lower = worse (red).
export function ProgressStat({ label, cur, prev, unit = '' }: { label: string; cur: number; prev: number; unit?: string }) {
  const delta = cur - prev;
  const pct = prev > 0 ? Math.round((delta / prev) * 100) : cur > 0 ? 100 : 0;
  const better = delta > 0;
  const worse = delta < 0;
  const col = better ? colors.green : worse ? colors.red : colors.textFaint;
  const arrow = better ? '▲' : worse ? '▼' : '—';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <Text style={{ flex: 1, color: colors.textSoft, fontFamily: fonts.uiSemi, fontSize: 14 }}>{label}</Text>
      <Text numberOfLines={1} style={{ color: colors.text, fontFamily: fonts.monoSemi, fontSize: 15, width: 104, textAlign: 'right' }}>
        {cur} <Text style={{ color: colors.textFainter, fontSize: 12 }}>/ {prev}{unit}</Text>
      </Text>
      <View style={{ width: 64, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 3 }}>
        <Text style={{ color: col, fontFamily: fonts.uiBold, fontSize: 12 }}>{arrow}</Text>
        <Text style={{ color: col, fontFamily: fonts.monoSemi, fontSize: 12.5 }}>{delta === 0 ? '0' : `${pct > 0 ? '+' : ''}${pct}%`}</Text>
      </View>
    </View>
  );
}
