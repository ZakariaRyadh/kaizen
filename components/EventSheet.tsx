import { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { SwipeSheet } from './SwipeSheet';
import { useAccent, withAlpha } from '../theme/AccentContext';
import { colors, fonts } from '../theme/colors';
import { TAG_COLORS } from '../theme/tags';

export type Priority = 'low' | 'med' | 'high';

export type CalEvent = {
  id: string;
  date: string;         // 'YYYY-MM-DD' (full date, any month)
  time: string;
  title: string;
  color: string;        // category color bar
  priority: Priority;
};

const prettyDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

export const PRIORITY_META: Record<Priority, { label: string; color: string }> = {
  low: { label: 'Low', color: '#22c55e' },
  med: { label: 'Medium', color: '#f59e0b' },
  high: { label: 'High', color: '#ef4444' },
};

type Props = {
  visible: boolean;
  initial?: CalEvent | null;
  date: string;         // selected date (for new events)
  onClose: () => void;
  onSave: (e: CalEvent) => void;
  onDelete?: (id: string) => void;
};

export function EventSheet({ visible, initial, date, onClose, onSave, onDelete }: Props) {
  const { accent } = useAccent();
  const [title, setTitle] = useState('');
  const [time, setTime] = useState('');
  const [color, setColor] = useState(TAG_COLORS[0]);
  const [priority, setPriority] = useState<Priority>('med');

  useEffect(() => {
    if (!visible) return;
    setTitle(initial?.title ?? '');
    setTime(initial?.time ?? '');
    setColor(initial?.color ?? TAG_COLORS[0]);
    setPriority(initial?.priority ?? 'med');
  }, [visible, initial]);

  const save = () => {
    if (!title.trim()) return;
    onSave({
      id: initial?.id ?? Date.now().toString(),
      date: initial?.date ?? date,
      time: time.trim() || 'All day',
      title: title.trim(),
      color,
      priority,
    });
    onClose();
  };

  return (
    <SwipeSheet visible={visible} onClose={onClose}>
          <Text style={{ fontSize: 19, color: colors.text, fontFamily: fonts.uiBold }}>{initial ? 'Edit event' : 'New event'}</Text>
          <Text style={{ fontSize: 13, color: colors.textDim, fontFamily: fonts.ui, marginTop: 4, marginBottom: 16 }}>{prettyDate(initial?.date ?? date)}</Text>

          <TextInput value={title} onChangeText={setTitle} placeholder="Event title" placeholderTextColor={colors.textFaint} style={input} />
          <TextInput value={time} onChangeText={setTime} placeholder="Time (e.g. 11:00)" placeholderTextColor={colors.textFaint} style={[input, { marginTop: 12 }]} />

          <Text style={label}>Category color</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {TAG_COLORS.map((c) => (
              <Pressable key={c} onPress={() => setColor(c)} style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: c, borderWidth: color === c ? 2 : 0, borderColor: '#fff' }} />
            ))}
          </View>

          <Text style={label}>Priority</Text>
          <View style={{ flexDirection: 'row', gap: 8, backgroundColor: colors.card, borderRadius: 14, padding: 4 }}>
            {(Object.keys(PRIORITY_META) as Priority[]).map((p) => {
              const on = priority === p;
              const meta = PRIORITY_META[p];
              return (
                <Pressable key={p} onPress={() => setPriority(p)} style={{ flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center', backgroundColor: on ? withAlpha(meta.color, 20) : 'transparent' }}>
                  <Text style={{ color: on ? meta.color : colors.textMuted, fontFamily: fonts.uiSemi, fontSize: 13 }}>{meta.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable onPress={save} style={{ backgroundColor: accent, borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 20 }}>
            <Text style={{ color: '#fff', fontFamily: fonts.uiBold, fontSize: 15 }}>{initial ? 'Save event' : 'Add event'}</Text>
          </Pressable>
          {initial && onDelete && (
            <Pressable onPress={() => { onDelete(initial.id); onClose(); }} style={{ paddingVertical: 14, alignItems: 'center', marginTop: 4 }}>
              <Text style={{ color: colors.red, fontFamily: fonts.uiSemi, fontSize: 14 }}>Delete event</Text>
            </Pressable>
          )}
    </SwipeSheet>
  );
}

const input = {
  backgroundColor: colors.card,
  borderWidth: 1,
  borderColor: colors.borderSoft,
  borderRadius: 13,
  paddingHorizontal: 14,
  paddingVertical: 13,
  color: colors.text,
  fontFamily: fonts.ui,
  fontSize: 15,
} as const;

const label = {
  fontSize: 12,
  color: colors.textFainter,
  fontFamily: fonts.uiSemi,
  textTransform: 'uppercase',
  letterSpacing: 1,
  marginTop: 18,
  marginBottom: 9,
} as const;
