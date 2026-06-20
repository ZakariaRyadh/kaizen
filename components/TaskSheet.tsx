import { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { SwipeSheet } from './SwipeSheet';
import { useAccent, withAlpha } from '../theme/AccentContext';
import { colors, fonts } from '../theme/colors';
import { REPEATS, RepeatKey, TAG_COLORS, TAG_PRESETS, Task } from '../theme/tags';

type Props = {
  visible: boolean;
  initial?: Task | null;       // null = add mode, task = edit mode
  defaultDate: string;         // date assigned to a NEW task (e.g. today, or a calendar day)
  onClose: () => void;
  onSave: (t: Task) => void;
  onDelete?: (id: string) => void;
};

export function TaskSheet({ visible, initial, defaultDate, onClose, onSave, onDelete }: Props) {
  const { accent } = useAccent();
  const [title, setTitle] = useState('');
  const [time, setTime] = useState('');
  const [tag, setTag] = useState(TAG_PRESETS[0].name);
  const [tagColor, setTagColor] = useState(TAG_PRESETS[0].color);
  const [repeat, setRepeat] = useState<RepeatKey>('');

  // load the task into the form whenever the sheet opens
  useEffect(() => {
    if (!visible) return;
    setTitle(initial?.title ?? '');
    setTime(initial?.time ?? '');
    setTag(initial?.tag ?? TAG_PRESETS[0].name);
    setTagColor(initial?.tagColor ?? TAG_PRESETS[0].color);
    setRepeat(initial?.repeat ?? '');
  }, [visible, initial]);

  const save = () => {
    if (!title.trim()) return;
    onSave({
      id: initial?.id ?? Date.now().toString(),
      title: title.trim(),
      time: time.trim() || 'All day',
      tag,
      tagColor,
      repeat,
      done: initial?.done ?? false,
      date: initial?.date ?? defaultDate,
    });
    onClose();
  };

  return (
    <SwipeSheet visible={visible} onClose={onClose} scroll>
      <Text style={{ fontSize: 19, color: colors.text, fontFamily: fonts.uiBold, marginBottom: 16 }}>
        {initial ? 'Edit task' : 'New task'}
      </Text>

            <Field label="Title">
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="What needs doing?"
                placeholderTextColor={colors.textFaint}
                style={input}
              />
            </Field>

            <Field label="Time">
              <TextInput
                value={time}
                onChangeText={setTime}
                placeholder="09:00  (or leave blank for All day)"
                placeholderTextColor={colors.textFaint}
                style={input}
              />
            </Field>

            <Field label="Tag">
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {TAG_PRESETS.map((p) => {
                  const on = tag === p.name;
                  return (
                    <Pressable
                      key={p.name}
                      onPress={() => {
                        setTag(p.name);
                        setTagColor(p.color);
                      }}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 7,
                        paddingHorizontal: 13,
                        paddingVertical: 9,
                        borderRadius: 11,
                        backgroundColor: on ? withAlpha(p.color, 16) : colors.card,
                        borderWidth: 1,
                        borderColor: on ? p.color : colors.border,
                      }}
                    >
                      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: p.color }} />
                      <Text style={{ color: on ? p.color : colors.textSoft, fontFamily: fonts.uiSemi, fontSize: 13 }}>
                        {p.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </Field>

            <Field label="Custom tag name">
              <TextInput
                value={TAG_PRESETS.some((p) => p.name === tag) ? '' : tag}
                onChangeText={setTag}
                placeholder="Type your own…"
                placeholderTextColor={colors.textFaint}
                style={input}
              />
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                {TAG_COLORS.map((c) => (
                  <Pressable
                    key={c}
                    onPress={() => setTagColor(c)}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 14,
                      backgroundColor: c,
                      borderWidth: tagColor === c ? 2 : 0,
                      borderColor: '#fff',
                    }}
                  />
                ))}
              </View>
            </Field>

            <Field label="Repeat">
              <View style={{ flexDirection: 'row', gap: 8, backgroundColor: colors.card, borderRadius: 14, padding: 4 }}>
                {REPEATS.map((r) => {
                  const on = repeat === r.key;
                  return (
                    <Pressable
                      key={r.key}
                      onPress={() => setRepeat(r.key)}
                      style={{
                        flex: 1,
                        paddingVertical: 10,
                        borderRadius: 10,
                        alignItems: 'center',
                        backgroundColor: on ? accent : 'transparent',
                      }}
                    >
                      <Text style={{ color: on ? '#fff' : colors.textMuted, fontFamily: fonts.uiSemi, fontSize: 13 }}>
                        {r.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </Field>

            {/* actions */}
            <Pressable
              onPress={save}
              style={{ backgroundColor: accent, borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 8 }}
            >
              <Text style={{ color: '#fff', fontFamily: fonts.uiBold, fontSize: 15 }}>
                {initial ? 'Save changes' : 'Add task'}
              </Text>
            </Pressable>

            {initial && onDelete && (
              <Pressable
                onPress={() => {
                  onDelete(initial.id);
                  onClose();
                }}
                style={{ paddingVertical: 14, alignItems: 'center', marginTop: 4 }}
              >
                <Text style={{ color: colors.red, fontFamily: fonts.uiSemi, fontSize: 14 }}>Delete task</Text>
              </Pressable>
            )}
    </SwipeSheet>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={{ fontSize: 12, color: colors.textFainter, fontFamily: fonts.uiSemi, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 9 }}>
        {label}
      </Text>
      {children}
    </View>
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
