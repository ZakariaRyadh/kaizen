import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { TimeWheelSheet } from './TimeWheel';

import { ALL_DAY, fmtDuration, fmtRange, nextHalfHour, parseTime } from '../lib/time';
import { withAlpha } from '../theme/AccentContext';
import { colors, fonts } from '../theme/colors';

const DURATIONS = [0, 15, 30, 45, 60, 90, 120];
const MAX_DURATION = 24 * 60;

type Props = {
  time: string;                       // 'HH:MM' or 'All day'
  duration: number;                   // minutes, 0 = none
  accent: string;
  onChange: (time: string, duration: number) => void;
  conflict?: string | null;           // e.g. "Overlaps with Gym (09:00–10:00)"
};

/** All day / at a time (wheel picker), optional duration from chips or custom h/m. */
export function TimePicker({ time, duration, accent, onChange, conflict }: Props) {
  const timed = !!parseTime(time);
  const [clockOpen, setClockOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);

  const customDur = !!duration && !DURATIONS.includes(duration);
  const setDur = (h: string, m: string) => {
    const total = Math.min(MAX_DURATION, (parseInt(h, 10) || 0) * 60 + (parseInt(m, 10) || 0));
    onChange(time, total);
  };


  return (
    <View style={{ gap: 10 }}>
      {/* all day vs timed */}
      <View style={{ flexDirection: 'row', gap: 6, backgroundColor: colors.card, borderRadius: 13, padding: 4 }}>
        {[
          { k: false, label: 'All day' },
          { k: true, label: 'At a time' },
        ].map((o) => {
          const on = timed === o.k;
          return (
            <Pressable
              key={o.label}
              onPress={() => onChange(o.k ? (timed ? time : nextHalfHour()) : ALL_DAY, o.k ? duration : 0)}
              style={{ flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center', backgroundColor: on ? accent : 'transparent' }}
            >
              <Text style={{ color: on ? '#fff' : colors.textMuted, fontFamily: fonts.uiSemi, fontSize: 13 }}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {timed && (
        <>
          {/* the chosen time, big — tap to open the clock */}
          <Pressable
            onPress={() => setClockOpen(true)}
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.card, borderWidth: 1, borderColor: withAlpha(accent, 40), borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12 }}
          >
            <Text style={{ fontFamily: fonts.monoSemi, fontSize: 24, color: colors.text }}>{fmtRange(time, duration)}</Text>
            <Text style={{ color: accent, fontFamily: fonts.uiSemi, fontSize: 13 }}>Change time</Text>
          </Pressable>

          {/* duration */}
          <Text style={{ fontSize: 12, color: colors.textFainter, fontFamily: fonts.uiSemi, textTransform: 'uppercase', letterSpacing: 1, marginTop: 4 }}>Duration</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
            {DURATIONS.map((m) => (
              <Chip
                key={m}
                on={duration === m && !customOpen}
                accent={accent}
                onPress={() => {
                  setCustomOpen(false);
                  onChange(time, m);
                }}
                label={m ? fmtDuration(m) : 'None'}
              />
            ))}
            <Chip on={customOpen || customDur} accent={accent} onPress={() => setCustomOpen(true)} label={customDur ? fmtDuration(duration) : 'Custom'} />
          </View>
          {customOpen && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <NumBox value={Math.floor(duration / 60)} unit="h" max={24} onChange={(v) => setDur(v, String(duration % 60))} />
              <NumBox value={duration % 60} unit="min" max={59} onChange={(v) => setDur(String(Math.floor(duration / 60)), v)} />
            </View>
          )}

          {!!conflict && (
            <Text style={{ color: colors.amber, fontFamily: fonts.ui, fontSize: 12.5 }}>⚠ {conflict}</Text>
          )}

          <TimeWheelSheet
            visible={clockOpen}
            value={time}
            title="Start time"
            accent={accent}
            onClose={() => setClockOpen(false)}
            onDone={(v) => onChange(v, duration)}
          />
        </>
      )}
    </View>
  );
}

// small numeric field: "1 h", "30 min"
function NumBox({ value, unit, max, onChange }: { value: number; unit: string; max: number; onChange: (v: string) => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 11, paddingHorizontal: 12 }}>
      <TextInput
        value={value ? String(value) : ''}
        onChangeText={(t) => onChange(String(Math.min(max, parseInt(t.replace(/\D/g, ''), 10) || 0)))}
        keyboardType="number-pad"
        maxLength={2}
        placeholder="0"
        placeholderTextColor={colors.textFaint}
        style={{ minWidth: 28, color: colors.text, fontFamily: fonts.monoSemi, fontSize: 16, paddingVertical: 8, textAlign: 'center' }}
      />
      <Text style={{ color: colors.textMuted, fontFamily: fonts.uiSemi, fontSize: 13 }}>{unit}</Text>
    </View>
  );
}

function Chip({ on, accent, onPress, label, sub }: { on: boolean; accent: string; onPress: () => void; label: string; sub?: string }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 11,
        backgroundColor: on ? withAlpha(accent, 18) : colors.card,
        borderWidth: 1,
        borderColor: on ? accent : colors.border,
        alignItems: 'center',
      }}
    >
      <Text style={{ color: on ? accent : colors.textSoft, fontFamily: fonts.uiSemi, fontSize: 12.5 }}>{label}</Text>
      {!!sub && <Text style={{ color: on ? accent : colors.textFaint, fontFamily: fonts.mono, fontSize: 10.5, marginTop: 1 }}>{sub}</Text>}
    </Pressable>
  );
}
