import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CalEvent, EventSheet, PRIORITY_META, Priority } from '../../components/EventSheet';
import { Icon } from '../../components/Icon';
import { TaskSheet } from '../../components/TaskSheet';
import { useRefresh } from '../../hooks/useRefresh';
import { useEvents } from '../../store/events';
import { daysInMonth, firstDow, iso, MONTH, monthName, TODAY, TODAY_DAY, useTasks, YEAR } from '../../store/tasks';
import { useAccent, withAlpha } from '../../theme/AccentContext';
import { colors, fonts } from '../../theme/colors';
import { Task } from '../../theme/tags';

const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export default function Calendar() {
  const { accent } = useAccent();
  const [mode, setMode] = useState<'week' | 'month'>('week');

  // which month is on screen + which date is selected (full ISO date)
  const [viewYear, setViewYear] = useState(YEAR);
  const [viewMonth, setViewMonth] = useState(MONTH); // 0-indexed
  const [selected, setSelected] = useState(TODAY);   // 'YYYY-MM-DD'

  const events = useEvents((s) => s.events);
  const { upsert, remove } = useEvents();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<CalEvent | null>(null);

  const { refreshing, onRefresh } = useRefresh([useEvents.getState().load, useTasks.getState().load]);

  // shared tasks (same store Home reads)
  const allTasks = useTasks((s) => s.tasks);
  const taskStore = useTasks();
  const [taskSheetOpen, setTaskSheetOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const nDays = daysInMonth(viewYear, viewMonth);
  const fDow = firstDow(viewYear, viewMonth);
  const dateFor = (day: number) => iso(viewYear, viewMonth, day);

  const dayTasks = useMemo(
    () => allTasks.filter((t) => t.date === selected).sort((a, b) => a.time.localeCompare(b.time)),
    [allTasks, selected],
  );
  const dayEvents = useMemo(
    () => events.filter((e) => e.date === selected).sort((a, b) => a.time.localeCompare(b.time)),
    [events, selected],
  );
  const dotsFor = (dateStr: string) =>
    [
      ...events.filter((e) => e.date === dateStr).map((e) => e.color),
      ...allTasks.filter((t) => t.date === dateStr).map((t) => t.tagColor),
    ].slice(0, 3);

  const openAddTask = () => { setEditingTask(null); setTaskSheetOpen(true); };
  const openEditTask = (t: Task) => { setEditingTask(t); setTaskSheetOpen(true); };
  const openAdd = () => { setEditing(null); setSheetOpen(true); };
  const openEdit = (e: CalEvent) => { setEditing(e); setSheetOpen(true); };

  // selected day number, only if the selected date is in the viewed month
  const selDay = useMemo(() => {
    const [y, m, d] = selected.split('-').map(Number);
    return y === viewYear && m - 1 === viewMonth ? d : -1;
  }, [selected, viewYear, viewMonth]);

  // week (7 day-numbers, some <1 or >nDays = other months) around the selected day
  const weekDays = useMemo(() => {
    const anchor = selDay > 0 ? selDay : 1;
    const dow = (fDow + anchor - 1) % 7;
    const start = anchor - dow;
    return Array.from({ length: 7 }, (_, i) => start + i);
  }, [selDay, fDow]);

  const monthCells = useMemo(() => {
    const cells: (number | null)[] = Array.from({ length: fDow }, () => null);
    for (let d = 1; d <= nDays; d++) cells.push(d);
    return cells;
  }, [fDow, nDays]);

  const shiftMonth = (dir: number) => {
    let m = viewMonth + dir;
    let y = viewYear;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    setViewMonth(m);
    setViewYear(y);
  };
  const goToday = () => {
    setViewYear(YEAR);
    setViewMonth(MONTH);
    setSelected(TODAY);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 28, gap: 18 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={accent} />}
      >
        {/* header + week/month toggle */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingTop: 6 }}>
          <View>
            <Text style={{ fontSize: 13, color: colors.textDim, fontFamily: fonts.ui }}>{viewYear}</Text>
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

        {/* month navigator */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Pressable onPress={() => shiftMonth(-1)} hitSlop={10} style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="back" size={16} color={colors.textSoft} />
          </Pressable>
          <Pressable onPress={goToday}>
            <Text style={{ fontSize: 17, color: colors.text, fontFamily: fonts.uiSemi }}>{monthName(viewMonth)} {viewYear}</Text>
          </Pressable>
          <Pressable onPress={() => shiftMonth(1)} hitSlop={10} style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ transform: [{ scaleX: -1 }] }}>
              <Icon name="back" size={16} color={colors.textSoft} />
            </View>
          </Pressable>
        </View>

        {/* WEEK strip */}
        {mode === 'week' ? (
          <View style={{ flexDirection: 'row', gap: 5 }}>
            {weekDays.map((d, i) => {
              const valid = d >= 1 && d <= nDays;
              const dateStr = valid ? dateFor(d) : '';
              const on = valid && dateStr === selected;
              const isToday = valid && dateStr === TODAY;
              return (
                <Pressable key={i} onPress={() => valid && setSelected(dateStr)} style={{ flex: 1, alignItems: 'center', gap: 8 }}>
                  <Text style={{ fontSize: 11, color: on ? accent : colors.textFainter, fontFamily: fonts.uiSemi }}>{DOW[i]}</Text>
                  <View style={{ width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? accent : 'transparent', borderWidth: isToday && !on ? 1 : 0, borderColor: accent }}>
                    <Text style={{ fontFamily: fonts.monoSemi, fontSize: 14, color: on ? '#fff' : valid ? colors.textSoft : colors.textFainter }}>{valid ? d : ''}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 3, minHeight: 7 }}>
                    {valid && dotsFor(dateStr).map((c, k) => (
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
                const dateStr = dateFor(d);
                const on = dateStr === selected;
                const isToday = dateStr === TODAY;
                return (
                  <View key={i} style={{ width: `${100 / 7}%`, aspectRatio: 1, padding: 2 }}>
                    <Pressable onPress={() => setSelected(dateStr)} style={{ flex: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center', gap: 3, backgroundColor: on ? withAlpha(accent, 18) : colors.card, borderWidth: 1, borderColor: on || isToday ? accent : colors.border }}>
                      <Text style={{ fontFamily: fonts.mono, fontSize: 12.5, color: on || isToday ? accent : colors.textSoft }}>{d}</Text>
                      <View style={{ flexDirection: 'row', gap: 2 }}>
                        {dotsFor(dateStr).map((c, k) => (
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
            <Text style={{ fontSize: 17, color: colors.text, fontFamily: fonts.uiSemi }}>
              {new Date(`${selected}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
            </Text>
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
              {selected === TODAY && (
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

      <EventSheet visible={sheetOpen} initial={editing} date={selected} onClose={() => setSheetOpen(false)} onSave={upsert} onDelete={remove} />
      <TaskSheet visible={taskSheetOpen} initial={editingTask} defaultDate={selected} onClose={() => setTaskSheetOpen(false)} onSave={taskStore.upsert} onDelete={taskStore.remove} />
    </SafeAreaView>
  );
}
