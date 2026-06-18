import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CalEvent, EventSheet, PRIORITY_META, Priority } from '../../components/EventSheet';
import { Icon } from '../../components/Icon';
import { TaskSheet } from '../../components/TaskSheet';
import { useEvents } from '../../store/events';
import { dateOf, MONTH, MONTH_NAME, TODAY, TODAY_DAY, useTasks, YEAR } from '../../store/tasks';
import { useAccent, withAlpha } from '../../theme/AccentContext';
import { colors, fonts } from '../../theme/colors';
import { Task } from '../../theme/tags';

// current-month facts (computed from the real date)
const DAYS_IN_MONTH = new Date(YEAR, MONTH + 1, 0).getDate();
const FIRST_DOW = new Date(YEAR, MONTH, 1).getDay(); // 0=Sun
const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export default function Calendar() {
  const { accent } = useAccent();
  const [mode, setMode] = useState<'week' | 'month'>('week');
  const [selected, setSelected] = useState(TODAY_DAY);
  const events = useEvents((s) => s.events);
  const { upsert, remove } = useEvents();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<CalEvent | null>(null);

  // shared tasks (same store Home reads) — tasks added here on TODAY show on Home
  const allTasks = useTasks((s) => s.tasks);
  const taskStore = useTasks();
  const [taskSheetOpen, setTaskSheetOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const selectedDate = dateOf(selected);
  const dayTasks = useMemo(
    () => allTasks.filter((t) => t.date === selectedDate).sort((a, b) => a.time.localeCompare(b.time)),
    [allTasks, selectedDate],
  );

  const dayEvents = useMemo(
    () => events.filter((e) => e.day === selected).sort((a, b) => a.time.localeCompare(b.time)),
    [events, selected],
  );
  const dotsFor = (day: number) =>
    [
      ...events.filter((e) => e.day === day).map((e) => e.color),
      ...allTasks.filter((t) => t.date === dateOf(day)).map((t) => t.tagColor),
    ].slice(0, 3);

  const openAddTask = () => { setEditingTask(null); setTaskSheetOpen(true); };
  const openEditTask = (t: Task) => { setEditingTask(t); setTaskSheetOpen(true); };

  // week containing the selected day
  const weekDays = useMemo(() => {
    const dowOfSelected = (FIRST_DOW + selected - 1) % 7;
    const start = selected - dowOfSelected;
    return Array.from({ length: 7 }, (_, i) => start + i); // some may be <1 or >30
  }, [selected]);

  // month grid cells (leading blanks + days)
  const monthCells = useMemo(() => {
    const cells: (number | null)[] = Array.from({ length: FIRST_DOW }, () => null);
    for (let d = 1; d <= DAYS_IN_MONTH; d++) cells.push(d);
    return cells;
  }, []);

  const openAdd = () => { setEditing(null); setSheetOpen(true); };
  const openEdit = (e: CalEvent) => { setEditing(e); setSheetOpen(true); };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 28, gap: 18 }} showsVerticalScrollIndicator={false}>
        {/* header + week/month toggle */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingTop: 6 }}>
          <View>
            <Text style={{ fontSize: 13, color: colors.textDim, fontFamily: fonts.ui }}>{MONTH_NAME} {YEAR}</Text>
            <Text style={{ fontSize: 25, color: colors.text, fontFamily: fonts.uiBold, marginTop: 2 }}>Calendar</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 3, backgroundColor: '#131319', borderWidth: 1, borderColor: colors.border, borderRadius: 11, padding: 3 }}>
            {(['week', 'month'] as const).map((m) => {
              const on = mode === m;
              return (
                <Pressable key={m} onPress={() => setMode(m)} style={{ paddingHorizontal: 15, paddingVertical: 8, borderRadius: 8, backgroundColor: on ? accent : 'transparent' }}>
                  <Text style={{ color: on ? '#fff' : colors.textMuted, fontFamily: fonts.uiSemi, fontSize: 13 }}>{m === 'week' ? 'Week' : 'Month'}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* WEEK strip */}
        {mode === 'week' ? (
          <View style={{ flexDirection: 'row', gap: 5 }}>
            {weekDays.map((d, i) => {
              const valid = d >= 1 && d <= DAYS_IN_MONTH;
              const on = d === selected;
              return (
                <Pressable key={i} onPress={() => valid && setSelected(d)} style={{ flex: 1, alignItems: 'center', gap: 8 }}>
                  <Text style={{ fontSize: 11, color: on ? accent : colors.textFainter, fontFamily: fonts.uiSemi }}>{DOW[i]}</Text>
                  <View style={{ width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? accent : 'transparent' }}>
                    <Text style={{ fontFamily: fonts.monoSemi, fontSize: 14, color: on ? '#fff' : valid ? colors.textSoft : colors.textFainter }}>{valid ? d : ''}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 3, minHeight: 7 }}>
                    {valid && dotsFor(d).map((c, k) => (
                      <View key={k} style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: c }} />
                    ))}
                  </View>
                </Pressable>
              );
            })}
          </View>
        ) : (
          /* MONTH grid */
          <View>
            <View style={{ flexDirection: 'row', marginBottom: 8 }}>
              {DOW.map((d, i) => (
                <Text key={i} style={{ flex: 1, textAlign: 'center', fontSize: 11, color: colors.textFainter, fontFamily: fonts.uiSemi }}>{d}</Text>
              ))}
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {monthCells.map((d, i) => {
                if (d === null) return <View key={i} style={{ width: `${100 / 7}%`, aspectRatio: 1 }} />;
                const on = d === selected;
                return (
                  <View key={i} style={{ width: `${100 / 7}%`, aspectRatio: 1, padding: 2 }}>
                    <Pressable onPress={() => setSelected(d)} style={{ flex: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center', gap: 3, backgroundColor: on ? withAlpha(accent, 18) : colors.card, borderWidth: 1, borderColor: on ? accent : colors.border }}>
                      <Text style={{ fontFamily: fonts.mono, fontSize: 12.5, color: on ? accent : colors.textSoft }}>{d}</Text>
                      <View style={{ flexDirection: 'row', gap: 2 }}>
                        {dotsFor(d).map((c, k) => (
                          <View key={k} style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: c }} />
                        ))}
                      </View>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* agenda */}
        <View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text style={{ fontSize: 17, color: colors.text, fontFamily: fonts.uiSemi }}>{MONTH_NAME} {selected}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Text style={{ fontSize: 13, color: colors.textDim, fontFamily: fonts.mono }}>{dayEvents.length} events</Text>
              <Pressable onPress={openAdd} style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: accent, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="plus" size={17} color="#fff" />
              </Pressable>
            </View>
          </View>
          <View style={{ gap: 9 }}>
            {dayEvents.map((ev) => {
              const pri = PRIORITY_META[ev.priority as Priority];
              return (
                <Pressable key={ev.id} onPress={() => openEdit(ev)} style={{ flexDirection: 'row', alignItems: 'center', gap: 13, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 15, padding: 14 }}>
                  <View style={{ width: 4, alignSelf: 'stretch', borderRadius: 4, backgroundColor: ev.color }} />
                  <Text style={{ fontFamily: fonts.mono, fontSize: 12, color: colors.textMuted, width: 56 }}>{ev.time}</Text>
                  <Text style={{ flex: 1, fontSize: 14.5, color: colors.textMid, fontFamily: fonts.uiSemi }}>{ev.title}</Text>
                  <Text style={{ fontSize: 10, fontFamily: fonts.uiBold, color: pri.color, backgroundColor: withAlpha(pri.color, 15), paddingHorizontal: 8, paddingVertical: 4, borderRadius: 7, overflow: 'hidden' }}>{pri.label}</Text>
                </Pressable>
              );
            })}
            {dayEvents.length === 0 && (
              <Text style={{ color: colors.textFainter, fontFamily: fonts.ui, textAlign: 'center', paddingVertical: 16 }}>No events scheduled</Text>
            )}
          </View>
        </View>

        {/* tasks for this day (same store as Home) */}
        <View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontSize: 17, color: colors.text, fontFamily: fonts.uiSemi }}>Tasks</Text>
              {selectedDate === TODAY && (
                <Text style={{ fontSize: 11, color: accent, fontFamily: fonts.uiSemi, backgroundColor: withAlpha(accent, 14), paddingHorizontal: 8, paddingVertical: 3, borderRadius: 7, overflow: 'hidden' }}>Today · on Home</Text>
              )}
            </View>
            <Pressable onPress={openAddTask} style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: accent, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="plus" size={17} color="#fff" />
            </Pressable>
          </View>
          <View style={{ gap: 8 }}>
            {dayTasks.map((t) => (
              <View key={t.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 15, padding: 13 }}>
                <Pressable onPress={() => taskStore.toggle(t.id)} hitSlop={8}>
                  <View style={{ width: 22, height: 22, borderRadius: 7, borderWidth: 2, borderColor: t.done ? accent : '#3a3a45', backgroundColor: t.done ? accent : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                    {t.done && (
                      <Svg width={13} height={13} viewBox="0 0 13 13"><Path d="M2.5 6.5 5.5 9.5 10.5 3.5" fill="none" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" /></Svg>
                    )}
                  </View>
                </Pressable>
                <Pressable onPress={() => openEditTask(t)} style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14.5, color: t.done ? colors.textFaint : colors.textMid, fontFamily: fonts.ui, textDecorationLine: t.done ? 'line-through' : 'none' }}>{t.title}</Text>
                  <Text style={{ fontSize: 12, color: colors.textFaint, fontFamily: fonts.mono, marginTop: 2 }}>{t.time}</Text>
                </Pressable>
                <Text style={{ fontSize: 11, fontFamily: fonts.uiSemi, color: t.tagColor, backgroundColor: withAlpha(t.tagColor, 14), paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8, overflow: 'hidden' }}>{t.tag}</Text>
              </View>
            ))}
            {dayTasks.length === 0 && (
              <Text style={{ color: colors.textFainter, fontFamily: fonts.ui, textAlign: 'center', paddingVertical: 16 }}>No tasks this day</Text>
            )}
          </View>
        </View>
      </ScrollView>

      <EventSheet visible={sheetOpen} initial={editing} day={selected} onClose={() => setSheetOpen(false)} onSave={upsert} onDelete={remove} />
      <TaskSheet visible={taskSheetOpen} initial={editingTask} defaultDate={selectedDate} onClose={() => setTaskSheetOpen(false)} onSave={taskStore.upsert} onDelete={taskStore.remove} />
    </SafeAreaView>
  );
}
