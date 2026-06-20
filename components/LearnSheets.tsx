import { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { SwipeSheet } from './SwipeSheet';
import type { LearnSession, Subject } from '../store/learning';
import { accentSwatches, colors, fonts } from '../theme/colors';
import { useAccent, withAlpha } from '../theme/AccentContext';

const fmtDay = (iso: string) => new Date(iso).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
const hrs = (s: number) => (s / 3600 >= 1 ? `${(s / 3600).toFixed(1)}h` : `${Math.round(s / 60)}m`);

// ---- create a new subject ----
export function SubjectSheet({
  visible,
  onClose,
  onSave,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (name: string, color: string) => void;
}) {
  const { accent } = useAccent();
  const [name, setName] = useState('');
  const [color, setColor] = useState(accentSwatches[0]);

  useEffect(() => {
    if (visible) {
      setName('');
      setColor(accentSwatches[0]);
    }
  }, [visible]);

  const save = () => {
    const n = name.trim();
    if (!n) return;
    onSave(n, color);
    onClose();
  };

  return (
    <SwipeSheet visible={visible} onClose={onClose}>
      <Text style={{ fontSize: 19, color: colors.text, fontFamily: fonts.uiBold }}>New subject</Text>
      <Text style={{ fontSize: 13, color: colors.textDim, fontFamily: fonts.ui, marginTop: 4, marginBottom: 18 }}>
        Something you want to learn
      </Text>

      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="e.g. Spanish, Django, Guitar"
        placeholderTextColor={colors.textFaint}
        style={{
          backgroundColor: colors.card, borderWidth: 1, borderColor: colors.borderSoft, borderRadius: 14,
          paddingHorizontal: 16, paddingVertical: 14, color: colors.text, fontFamily: fonts.uiSemi, fontSize: 16,
        }}
      />

      <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
        {accentSwatches.map((c) => (
          <Pressable
            key={c}
            onPress={() => setColor(c)}
            style={{
              width: 32, height: 32, borderRadius: 16, backgroundColor: c,
              borderWidth: color === c ? 2 : 0, borderColor: '#fff',
            }}
          />
        ))}
      </View>

      <Pressable onPress={save} style={{ backgroundColor: accent, borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 20 }}>
        <Text style={{ color: '#fff', fontFamily: fonts.uiBold, fontSize: 15 }}>Add subject</Text>
      </Pressable>
    </SwipeSheet>
  );
}

// ---- capture a learning idea/goal without starting a timer ----
export function IdeaSheet({
  visible,
  onClose,
  onSave,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (goal: string) => void;
}) {
  const { accent } = useAccent();
  const [goal, setGoal] = useState('');

  useEffect(() => {
    if (visible) setGoal('');
  }, [visible]);

  const save = () => {
    const g = goal.trim();
    if (!g) return;
    onSave(g);
    onClose();
  };

  return (
    <SwipeSheet visible={visible} onClose={onClose}>
      <Text style={{ fontSize: 19, color: colors.text, fontFamily: fonts.uiBold }}>Save for later</Text>
      <Text style={{ fontSize: 13, color: colors.textDim, fontFamily: fonts.ui, marginTop: 4, marginBottom: 18 }}>
        What do you want to learn? Start it any time from the log.
      </Text>

      <TextInput
        value={goal}
        onChangeText={setGoal}
        placeholder="e.g. React Native gesture handler, Spanish past tense..."
        placeholderTextColor={colors.textFaint}
        multiline
        style={{
          backgroundColor: colors.card, borderWidth: 1, borderColor: colors.borderSoft, borderRadius: 14,
          paddingHorizontal: 16, paddingVertical: 14, color: colors.text, fontFamily: fonts.ui, fontSize: 15,
          minHeight: 90, textAlignVertical: 'top',
        }}
      />

      <Pressable onPress={save} style={{ backgroundColor: accent, borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 18 }}>
        <Text style={{ color: '#fff', fontFamily: fonts.uiBold, fontSize: 15 }}>Save</Text>
      </Pressable>
    </SwipeSheet>
  );
}

// ---- write what was learned, right after finishing a timed session ----
export function SummarySheet({
  visible,
  durationLabel,
  onClose,
  onSave,
}: {
  visible: boolean;
  durationLabel: string;
  onClose: () => void;
  onSave: (summary: string) => void;
}) {
  const { accent } = useAccent();
  const [summary, setSummary] = useState('');

  useEffect(() => {
    if (visible) setSummary('');
  }, [visible]);

  return (
    <SwipeSheet visible={visible} onClose={onClose}>
      <Text style={{ fontSize: 19, color: colors.text, fontFamily: fonts.uiBold }}>What did you learn?</Text>
      <Text style={{ fontSize: 13, color: colors.textDim, fontFamily: fonts.ui, marginTop: 4, marginBottom: 18 }}>
        Session · {durationLabel}
      </Text>

      <TextInput
        value={summary}
        onChangeText={setSummary}
        placeholder="Write a quick summary so future-you remembers..."
        placeholderTextColor={colors.textFaint}
        multiline
        style={{
          backgroundColor: colors.card, borderWidth: 1, borderColor: colors.borderSoft, borderRadius: 14,
          paddingHorizontal: 16, paddingVertical: 14, color: colors.text, fontFamily: fonts.ui, fontSize: 15,
          minHeight: 120, textAlignVertical: 'top',
        }}
      />

      <Pressable
        onPress={() => {
          onSave(summary.trim());
          onClose();
        }}
        style={{ backgroundColor: accent, borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 18 }}
      >
        <Text style={{ color: '#fff', fontFamily: fonts.uiBold, fontSize: 15 }}>Save session</Text>
      </Pressable>
      <Pressable onPress={() => { onSave(''); onClose(); }} style={{ alignItems: 'center', paddingVertical: 14 }}>
        <Text style={{ color: colors.textMuted, fontFamily: fonts.uiSemi, fontSize: 14 }}>Skip</Text>
      </Pressable>
    </SwipeSheet>
  );
}

// ---- edit an existing logged session ----
export function EditSessionSheet({
  visible,
  session,
  subjects,
  onClose,
  onSave,
  onDelete,
}: {
  visible: boolean;
  session: LearnSession | null;
  subjects: Subject[];
  onClose: () => void;
  onSave: (patch: Partial<LearnSession>) => void;
  onDelete: () => void;
}) {
  const { accent } = useAccent();
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [goal, setGoal] = useState('');
  const [summary, setSummary] = useState('');
  const [minutes, setMinutes] = useState('');

  useEffect(() => {
    if (visible && session) {
      setSubjectId(session.subjectId);
      setGoal(session.goal);
      setSummary(session.summary);
      setMinutes(String(Math.round(session.durationSec / 60)));
    }
  }, [visible, session]);

  if (!session) return null;

  const save = () => {
    const subj = subjects.find((s) => s.id === subjectId);
    onSave({
      subjectId,
      subjectName: subj?.name ?? session.subjectName,
      goal: goal.trim(),
      summary: summary.trim(),
      durationSec: (parseInt(minutes, 10) || 0) * 60,
      date: session.date,
      done: true,
    });
    onClose();
  };

  return (
    <SwipeSheet visible={visible} onClose={onClose} scroll>
      <Text style={{ fontSize: 19, color: colors.text, fontFamily: fonts.uiBold, marginBottom: 16 }}>Edit session</Text>

      <Text style={{ fontSize: 12, color: colors.textFainter, fontFamily: fonts.uiSemi, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 9 }}>Subject</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {subjects.map((s) => {
          const on = subjectId === s.id;
          return (
            <Pressable key={s.id} onPress={() => setSubjectId(s.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 13, paddingVertical: 9, borderRadius: 11, backgroundColor: on ? withAlpha(s.color, 18) : colors.card, borderWidth: 1, borderColor: on ? s.color : colors.border }}>
              <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: s.color }} />
              <Text style={{ color: on ? colors.text : colors.textSoft, fontFamily: fonts.uiSemi, fontSize: 13 }}>{s.name}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={{ fontSize: 12, color: colors.textFainter, fontFamily: fonts.uiSemi, textTransform: 'uppercase', letterSpacing: 1, marginTop: 16, marginBottom: 9 }}>Minutes</Text>
      <TextInput value={minutes} onChangeText={setMinutes} keyboardType="number-pad" placeholder="0" placeholderTextColor={colors.textFaint} style={inp} />

      <Text style={{ fontSize: 12, color: colors.textFainter, fontFamily: fonts.uiSemi, textTransform: 'uppercase', letterSpacing: 1, marginTop: 16, marginBottom: 9 }}>Goal</Text>
      <TextInput value={goal} onChangeText={setGoal} placeholder="What you wanted to learn" placeholderTextColor={colors.textFaint} style={inp} />

      <Text style={{ fontSize: 12, color: colors.textFainter, fontFamily: fonts.uiSemi, textTransform: 'uppercase', letterSpacing: 1, marginTop: 16, marginBottom: 9 }}>Summary</Text>
      <TextInput value={summary} onChangeText={setSummary} multiline placeholder="What you learned" placeholderTextColor={colors.textFaint} style={[inp, { minHeight: 90, textAlignVertical: 'top' }]} />

      <Pressable onPress={save} style={{ backgroundColor: accent, borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 18 }}>
        <Text style={{ color: '#fff', fontFamily: fonts.uiBold, fontSize: 15 }}>Save changes</Text>
      </Pressable>
      <Pressable onPress={() => { onDelete(); onClose(); }} style={{ paddingVertical: 14, alignItems: 'center', marginTop: 2 }}>
        <Text style={{ color: colors.red, fontFamily: fonts.uiSemi, fontSize: 14 }}>Delete session</Text>
      </Pressable>
    </SwipeSheet>
  );
}

// ---- read-only detail for one subject: totals + history ----
export function SubjectDetailSheet({
  visible,
  subject,
  sessions,
  onClose,
  onDelete,
}: {
  visible: boolean;
  subject: Subject | null;
  sessions: LearnSession[];
  onClose: () => void;
  onDelete: () => void;
}) {
  if (!subject) return null;
  const mine = sessions.filter((s) => s.subjectId === subject.id && s.done);
  const total = mine.reduce((sum, s) => sum + s.durationSec, 0);

  return (
    <SwipeSheet visible={visible} onClose={onClose} scroll>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: subject.color }} />
        <Text style={{ fontSize: 19, color: colors.text, fontFamily: fonts.uiBold, flex: 1 }}>{subject.name}</Text>
        <Pressable onPress={() => { onDelete(); onClose(); }} hitSlop={8}>
          <Text style={{ color: colors.red, fontFamily: fonts.uiSemi, fontSize: 13 }}>Delete</Text>
        </Pressable>
      </View>

      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
        <View style={{ flex: 1, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 14 }}>
          <Text style={{ color: colors.textFaint, fontFamily: fonts.uiSemi, fontSize: 11 }}>TOTAL</Text>
          <Text style={{ color: colors.text, fontFamily: fonts.monoSemi, fontSize: 20, marginTop: 4 }}>{hrs(total)}</Text>
        </View>
        <View style={{ flex: 1, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 14 }}>
          <Text style={{ color: colors.textFaint, fontFamily: fonts.uiSemi, fontSize: 11 }}>SESSIONS</Text>
          <Text style={{ color: colors.text, fontFamily: fonts.monoSemi, fontSize: 20, marginTop: 4 }}>{mine.length}</Text>
        </View>
      </View>

      <View style={{ gap: 9 }}>
        {mine.map((s) => (
          <View key={s.id} style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 13, gap: 5 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: colors.textMuted, fontFamily: fonts.monoSemi, fontSize: 12.5 }}>{fmtDay(s.date)}</Text>
              <Text style={{ color: colors.textMuted, fontFamily: fonts.monoSemi, fontSize: 12.5 }}>{hrs(s.durationSec)}</Text>
            </View>
            {!!s.goal && <Text style={{ color: colors.textDim, fontFamily: fonts.ui, fontSize: 12.5 }}>Goal: {s.goal}</Text>}
            {!!s.summary && <Text style={{ color: colors.textSoft, fontFamily: fonts.ui, fontSize: 13 }}>{s.summary}</Text>}
          </View>
        ))}
        {mine.length === 0 && <Text style={{ color: colors.textFaint, fontFamily: fonts.ui, fontSize: 13 }}>No sessions logged yet.</Text>}
      </View>
    </SwipeSheet>
  );
}

// ---- new subjects this period vs the period before ----
export function NewSubjectsSheet({
  visible,
  subjects,
  progressDays,
  onClose,
}: {
  visible: boolean;
  subjects: Subject[];
  progressDays: number;
  onClose: () => void;
}) {
  const daysAgo = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  const rows = [...subjects]
    .filter((s) => daysAgo(s.createdAt) < progressDays * 2)
    .sort((a, b) => daysAgo(a.createdAt) - daysAgo(b.createdAt));

  return (
    <SwipeSheet visible={visible} onClose={onClose} scroll>
      <Text style={{ fontSize: 19, color: colors.text, fontFamily: fonts.uiBold, marginBottom: 4 }}>New subjects</Text>
      <Text style={{ color: colors.textFaint, fontFamily: fonts.ui, fontSize: 12.5, marginBottom: 16 }}>
        Added in the last {progressDays * 2} days
      </Text>

      <View style={{ gap: 9 }}>
        {rows.map((s) => {
          const cur = daysAgo(s.createdAt) < progressDays;
          return (
            <View key={s.id} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, gap: 10 }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: s.color }} />
              <Text style={{ flex: 1, color: colors.text, fontFamily: fonts.uiSemi, fontSize: 14 }}>{s.name}</Text>
              <Text style={{ color: colors.textMuted, fontFamily: fonts.monoSemi, fontSize: 12 }}>{fmtDay(s.createdAt)}</Text>
              {cur && (
                <View style={{ backgroundColor: withAlpha(colors.green, 0.15), borderRadius: 7, paddingHorizontal: 7, paddingVertical: 3 }}>
                  <Text style={{ color: colors.green, fontFamily: fonts.uiBold, fontSize: 10.5 }}>NEW</Text>
                </View>
              )}
            </View>
          );
        })}
        {rows.length === 0 && <Text style={{ color: colors.textFaint, fontFamily: fonts.ui, fontSize: 13 }}>No subjects added recently.</Text>}
      </View>
    </SwipeSheet>
  );
}

const inp = {
  backgroundColor: colors.card,
  borderWidth: 1,
  borderColor: colors.borderSoft,
  borderRadius: 13,
  paddingHorizontal: 14,
  paddingVertical: 12,
  color: colors.text,
  fontFamily: fonts.ui,
  fontSize: 15,
} as const;
