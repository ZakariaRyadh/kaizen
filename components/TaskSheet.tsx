import { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Check, doneLast, SUBTASK_MOVE } from './SubtaskList';
import { TagPicker } from './TagPicker';
import { TimePicker } from './TimePicker';
import { ALL_DAY, fmtRange, span } from '../lib/time';
import { useTasks } from '../store/tasks';
import { SwipeSheet } from './SwipeSheet';
import { useAccent, withAlpha } from '../theme/AccentContext';
import { colors, fonts } from '../theme/colors';
import { NO_TAG_COLOR, REPEATS, RepeatKey, Subtask, Task } from '../theme/tags';

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
  const [time, setTime] = useState(ALL_DAY);
  const [duration, setDuration] = useState(0);
  const [tag, setTag] = useState('');
  const [tagColor, setTagColor] = useState(NO_TAG_COLOR);
  const [repeat, setRepeat] = useState<RepeatKey>('');
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [newSub, setNewSub] = useState('');

  // load the task into the form whenever the sheet opens
  useEffect(() => {
    if (!visible) return;
    setTitle(initial?.title ?? '');
    setTime(initial?.time ?? ALL_DAY);
    setDuration(initial?.duration ?? 0);
    setTag(initial?.tag ?? '');
    setTagColor(initial?.tagColor ?? NO_TAG_COLOR);
    setRepeat(initial?.repeat ?? '');
    setSubtasks(initial?.subtasks ?? []);
    setNewSub('');
  }, [visible, initial]);

  const addSub = () => {
    const t = newSub.trim();
    if (!t) return;
    setSubtasks((s) => [...s, { id: `${Date.now()}${Math.random().toString(36).slice(2, 6)}`, title: t, done: false }]);
    setNewSub('');
  };
  const editSub = (id: string, patch: Partial<Subtask>) =>
    setSubtasks((s) => s.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const removeSub = (id: string) => setSubtasks((s) => s.filter((x) => x.id !== id));

  // warn (don't block) when this overlaps another timed task that day
  const allTasks = useTasks((s) => s.tasks);
  const day = initial?.date ?? defaultDate;
  const mine = span(time, duration);
  const clash = mine
    ? allTasks.find((t) => {
        if (t.id === initial?.id || t.date !== day || t.done) return false;
        const o = span(t.time, t.duration);
        return !!o && o[0] < mine[1] && mine[0] < o[1];
      })
    : undefined;
  const conflict = clash ? `Overlaps with "${clash.title}" (${fmtRange(clash.time, clash.duration)})` : null;

  const save = () => {
    if (!title.trim()) return;
    // keep a typed-but-not-added subtask, drop blank ones
    const pending = newSub.trim() ? [{ id: `${Date.now()}`, title: newSub.trim(), done: false }] : [];
    const subs = [...subtasks, ...pending].map((x) => ({ ...x, title: x.title.trim() })).filter((x) => x.title);
    const done = subs.length ? subs.every((x) => x.done) : (initial?.done ?? false);
    onSave({
      id: initial?.id ?? Date.now().toString(),
      title: title.trim(),
      time,
      duration: time === ALL_DAY ? 0 : duration,
      tag,
      tagColor,
      repeat,
      done,
      date: initial?.date ?? defaultDate,
      subtasks: subs,
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

            <Field label="Subtasks">
              <View style={{ gap: 8 }}>
                {doneLast(subtasks).map((st) => (
                  <Animated.View key={st.id} layout={SUBTASK_MOVE} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Pressable onPress={() => editSub(st.id, { done: !st.done })} hitSlop={6}>
                      <Check done={st.done} accent={accent} size={20} />
                    </Pressable>
                    <TextInput
                      value={st.title}
                      onChangeText={(v) => editSub(st.id, { title: v })}
                      placeholderTextColor={colors.textFaint}
                      style={[input, { flex: 1, paddingVertical: 10 }, st.done && { color: colors.textFaint, textDecorationLine: 'line-through' }]}
                    />
                    <Pressable onPress={() => removeSub(st.id)} hitSlop={6} style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: 'rgba(239,68,68,0.14)', alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ color: colors.red, fontSize: 16, lineHeight: 18 }}>×</Text>
                    </Pressable>
                  </Animated.View>
                ))}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <TextInput
                    value={newSub}
                    onChangeText={setNewSub}
                    onSubmitEditing={addSub}
                    submitBehavior="submit"
                    returnKeyType="done"
                    placeholder="Add a subtask…"
                    placeholderTextColor={colors.textFaint}
                    style={[input, { flex: 1, paddingVertical: 10 }]}
                  />
                  <Pressable onPress={addSub} style={{ width: 40, height: 40, borderRadius: 11, backgroundColor: withAlpha(accent, 18), alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: accent, fontSize: 20, lineHeight: 22, fontFamily: fonts.uiSemi }}>+</Text>
                  </Pressable>
                </View>
              </View>
            </Field>

            <Field label="Time">
              <TimePicker
                time={time}
                duration={duration}
                accent={accent}
                conflict={conflict}
                onChange={(t, d) => {
                  setTime(t);
                  setDuration(d);
                }}
              />
            </Field>

            <Field label="Tag">
              <TagPicker
                tag={tag}
                accent={accent}
                onChange={(t, c) => {
                  setTag(t);
                  setTagColor(c);
                }}
              />
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
