import { useEffect, useState } from 'react';
import { Dimensions, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { SwipeSheet } from './SwipeSheet';
import { useAccent, withAlpha } from '../theme/AccentContext';
import { colors, fonts } from '../theme/colors';
import { Exercise, Program, ProgramDay } from '../theme/programs';

const SHEET_BODY = Dimensions.get('window').height * 0.72;

type Props = {
  visible: boolean;
  initial: Program | null;       // null = create new
  onClose: () => void;
  onSave: (p: Program) => void;
};

const blankExercise = (): Exercise => ({ name: '', sub: '', sets: 3, reps: '10', weight: '', pr: false });
const blankDay = (n: number): ProgramDay => ({ label: `Day ${n}`, exercises: [blankExercise()] });

export function ProgramEditor({ visible, initial, onClose, onSave }: Props) {
  const { accent } = useAccent();
  const [name, setName] = useState('');
  const [meta, setMeta] = useState('');
  const [days, setDays] = useState<ProgramDay[]>([blankDay(1)]);

  // deep-clone the program into editable state each time the editor opens
  useEffect(() => {
    if (!visible) return;
    if (initial) {
      setName(initial.name);
      setMeta(initial.meta);
      setDays(JSON.parse(JSON.stringify(initial.days)));
    } else {
      setName('');
      setMeta('');
      setDays([blankDay(1)]);
    }
  }, [visible, initial]);

  // --- day ops ---
  const setDayLabel = (i: number, label: string) =>
    setDays((d) => d.map((day, k) => (k === i ? { ...day, label } : day)));
  const addDay = () => setDays((d) => [...d, blankDay(d.length + 1)]);
  const removeDay = (i: number) => setDays((d) => (d.length > 1 ? d.filter((_, k) => k !== i) : d));
  const toggleCardio = (i: number) =>
    setDays((d) => d.map((day, k) => (k === i ? { ...day, isCardio: !day.isCardio } : day)));

  // --- exercise ops ---
  const addEx = (di: number) =>
    setDays((d) => d.map((day, k) => (k === di ? { ...day, exercises: [...day.exercises, blankExercise()] } : day)));
  const removeEx = (di: number, ei: number) =>
    setDays((d) => d.map((day, k) => (k === di ? { ...day, exercises: day.exercises.filter((_, j) => j !== ei) } : day)));
  const setEx = (di: number, ei: number, field: keyof Exercise, val: any) =>
    setDays((d) =>
      d.map((day, k) =>
        k === di ? { ...day, exercises: day.exercises.map((ex, j) => (j === ei ? { ...ex, [field]: val } : ex)) } : day,
      ),
    );

  const save = () => {
    if (!name.trim()) return;
    const cleanDays = days
      .map((day) => ({
        label: day.label.trim() || 'Day',
        isCardio: !!day.isCardio,
        exercises: day.isCardio
          ? []
          : day.exercises.filter((e) => e.name.trim()).map((e) => ({ ...e, sets: Number(e.sets) || 1 })),
      }))
      // keep a day if it's cardio, has exercises, OR has a real custom name;
      // only drop leftover empty auto-named "Day N" rows.
      .filter((day) => day.isCardio || day.exercises.length > 0 || !/^Day \d+$/.test(day.label));
    if (cleanDays.length === 0) return;
    onSave({
      id: initial?.id ?? Date.now().toString(),
      name: name.trim(),
      meta: meta.trim() || `${cleanDays.length} day${cleanDays.length > 1 ? 's' : ''}`,
      days: cleanDays,
    });
    onClose();
  };

  return (
    <SwipeSheet visible={visible} onClose={onClose}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <Text style={{ fontSize: 19, color: colors.text, fontFamily: fonts.uiBold }}>{initial ? 'Edit program' : 'New program'}</Text>
            <Pressable onPress={onClose}><Text style={{ color: colors.textMuted, fontFamily: fonts.uiSemi, fontSize: 14 }}>Cancel</Text></Pressable>
          </View>

          <ScrollView style={{ maxHeight: SHEET_BODY }} contentContainerStyle={{ paddingBottom: 10, gap: 16 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {/* program meta */}
            <TextInput value={name} onChangeText={setName} placeholder="Program name (e.g. My PPL)" placeholderTextColor={colors.textFaint} style={input} />
            <TextInput value={meta} onChangeText={setMeta} placeholder="Subtitle (e.g. 3 days · hypertrophy)" placeholderTextColor={colors.textFaint} style={input} />

            {/* days */}
            {days.map((day, di) => (
              <View key={di} style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 18, padding: 14, gap: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: withAlpha(accent, 16), alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: accent, fontFamily: fonts.monoSemi, fontSize: 12 }}>{di + 1}</Text>
                  </View>
                  <TextInput value={day.label} onChangeText={(v) => setDayLabel(di, v)} placeholder="Day name" placeholderTextColor={colors.textFaint} style={[input, { flex: 1, paddingVertical: 9 }]} />
                  {days.length > 1 && (
                    <Pressable onPress={() => removeDay(di)} hitSlop={8}><Text style={{ color: colors.red, fontFamily: fonts.uiSemi, fontSize: 13 }}>Remove</Text></Pressable>
                  )}
                </View>

                {/* cardio-day toggle */}
                <Pressable
                  onPress={() => toggleCardio(di)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 9, alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 11, backgroundColor: day.isCardio ? withAlpha(colors.green, 18) : 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: day.isCardio ? colors.green : colors.borderSoft }}
                >
                  <Text style={{ color: day.isCardio ? colors.green : colors.textMuted, fontFamily: fonts.uiSemi, fontSize: 13 }}>
                    {day.isCardio ? '🏃 Cardio day' : 'Make cardio day'}
                  </Text>
                </Pressable>

                {day.isCardio ? (
                  <Text style={{ color: colors.textFaint, fontFamily: fonts.ui, fontSize: 12.5 }}>
                    No exercises — this day runs a cardio timer when you train it.
                  </Text>
                ) : (
                <>
                {/* exercises in this day */}
                {day.exercises.map((ex, ei) => (
                  <View key={ei} style={{ backgroundColor: colors.inset, borderRadius: 13, padding: 11, gap: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <TextInput value={ex.name} onChangeText={(v) => setEx(di, ei, 'name', v)} placeholder="Exercise" placeholderTextColor={colors.textFaint} style={[miniInput, { flex: 1 }]} />
                      <Pressable onPress={() => removeEx(di, ei)} hitSlop={6} style={{ width: 26, height: 26, borderRadius: 8, backgroundColor: 'rgba(239,68,68,0.14)', alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ color: colors.red, fontSize: 16, lineHeight: 18 }}>×</Text>
                      </Pressable>
                    </View>
                    <TextInput value={ex.sub} onChangeText={(v) => setEx(di, ei, 'sub', v)} placeholder="Muscle / note" placeholderTextColor={colors.textFaint} style={miniInput} />
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <NumIn label="Sets" value={String(ex.sets)} onChange={(v) => setEx(di, ei, 'sets', parseInt(v, 10) || 0)} />
                      <NumIn label="Reps" value={ex.reps} onChange={(v) => setEx(di, ei, 'reps', v)} />
                      <NumIn label="Weight" value={ex.weight} onChange={(v) => setEx(di, ei, 'weight', v)} flex={1.3} />
                      <Pressable onPress={() => setEx(di, ei, 'pr', !ex.pr)} style={{ paddingHorizontal: 12, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: ex.pr ? withAlpha(colors.amber, 18) : 'rgba(255,255,255,0.05)' }}>
                        <Text style={{ color: ex.pr ? colors.amber : colors.textFaint, fontFamily: fonts.uiBold, fontSize: 12 }}>★ PR</Text>
                      </Pressable>
                    </View>
                  </View>
                ))}

                <Pressable onPress={() => addEx(di)} style={{ paddingVertical: 10, borderRadius: 11, borderWidth: 1, borderColor: colors.borderSoft, borderStyle: 'dashed', alignItems: 'center' }}>
                  <Text style={{ color: colors.textMuted, fontFamily: fonts.uiSemi, fontSize: 13 }}>+ Add exercise</Text>
                </Pressable>
                </>
                )}
              </View>
            ))}

            <Pressable onPress={addDay} style={{ paddingVertical: 13, borderRadius: 13, borderWidth: 1, borderColor: withAlpha(accent, 40), borderStyle: 'dashed', alignItems: 'center' }}>
              <Text style={{ color: accent, fontFamily: fonts.uiSemi, fontSize: 14 }}>+ Add day</Text>
            </Pressable>

            <Pressable onPress={save} style={{ backgroundColor: accent, borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 4 }}>
              <Text style={{ color: '#fff', fontFamily: fonts.uiBold, fontSize: 15 }}>{initial ? 'Save program' : 'Create program'}</Text>
            </Pressable>
          </ScrollView>
    </SwipeSheet>
  );
}

function NumIn({ label, value, onChange, flex = 1 }: { label: string; value: string; onChange: (v: string) => void; flex?: number }) {
  return (
    <View style={{ flex, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 9, paddingVertical: 6, paddingHorizontal: 8 }}>
      <Text style={{ fontSize: 9, color: colors.textFainter, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</Text>
      <TextInput value={value} onChangeText={onChange} placeholderTextColor={colors.textFaint} style={{ color: colors.text, fontFamily: fonts.monoSemi, fontSize: 14, padding: 0, marginTop: 2 }} />
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

const miniInput = {
  color: colors.text,
  fontFamily: fonts.ui,
  fontSize: 13.5,
  paddingVertical: 4,
} as const;
