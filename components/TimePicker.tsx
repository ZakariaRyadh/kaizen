import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';

import { ALL_DAY, fmtDuration, fmtRange, hhmm, nextHalfHour, parseTime } from '../lib/time';
import { withAlpha } from '../theme/AccentContext';
import { colors, fonts } from '../theme/colors';

const PRESETS = [
  { label: 'Morning', time: '09:00' },
  { label: 'Noon', time: '12:00' },
  { label: 'Afternoon', time: '15:00' },
  { label: 'Evening', time: '19:00' },
];
const DURATIONS = [0, 15, 30, 45, 60, 90, 120];

type Props = {
  time: string;                       // 'HH:MM' or 'All day'
  duration: number;                   // minutes, 0 = none
  accent: string;
  onChange: (time: string, duration: number) => void;
  conflict?: string | null;           // e.g. "Overlaps with Gym (09:00–10:00)"
};

/** All day / at a time, quick presets, native clock for anything else, optional duration. */
export function TimePicker({ time, duration, accent, onChange, conflict }: Props) {
  const timed = !!parseTime(time);
  const [clockOpen, setClockOpen] = useState(false);

  const p = parseTime(time) ?? parseTime(nextHalfHour())!;
  const asDate = new Date(2000, 0, 1, p.h, p.m);
  const custom = timed && !PRESETS.some((x) => x.time === time);

  const onClock = (e: DateTimePickerEvent, d?: Date) => {
    if (Platform.OS === 'android') setClockOpen(false); // Android dialog closes itself
    if (e.type === 'set' && d) onChange(hhmm(d.getHours(), d.getMinutes()), duration);
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
            <Text style={{ color: accent, fontFamily: fonts.uiSemi, fontSize: 13 }}>{duration ? fmtDuration(duration) : 'Change'}</Text>
          </Pressable>

          {/* quick picks */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
            {PRESETS.map((x) => (
              <Chip key={x.time} on={time === x.time} accent={accent} onPress={() => onChange(x.time, duration)} label={x.label} sub={x.time} />
            ))}
            <Chip on={custom} accent={accent} onPress={() => setClockOpen(true)} label="Custom…" sub={custom ? time : undefined} />
          </View>

          {/* duration */}
          <Text style={{ fontSize: 12, color: colors.textFainter, fontFamily: fonts.uiSemi, textTransform: 'uppercase', letterSpacing: 1, marginTop: 4 }}>Duration</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
            {DURATIONS.map((m) => (
              <Chip key={m} on={duration === m} accent={accent} onPress={() => onChange(time, m)} label={m ? fmtDuration(m) : 'None'} />
            ))}
          </View>

          {!!conflict && (
            <Text style={{ color: colors.amber, fontFamily: fonts.ui, fontSize: 12.5 }}>⚠ {conflict}</Text>
          )}

          {clockOpen && (
            <DateTimePicker
              value={asDate}
              mode="time"
              is24Hour
              display={Platform.OS === 'ios' ? 'spinner' : 'clock'}
              minuteInterval={5}
              onChange={onClock}
              themeVariant="dark"
            />
          )}
          {clockOpen && Platform.OS === 'ios' && (
            <Pressable onPress={() => setClockOpen(false)} style={{ alignSelf: 'flex-end', paddingHorizontal: 12, paddingVertical: 6 }}>
              <Text style={{ color: accent, fontFamily: fonts.uiSemi }}>Done</Text>
            </Pressable>
          )}
        </>
      )}
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
