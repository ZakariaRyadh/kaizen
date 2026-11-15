import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Image, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';
import ReorderableList, {
  ReorderableListReorderEvent,
  reorderItems,
  useReorderableDrag,
} from 'react-native-reorderable-list';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PRIORITY_META, Priority } from '../../components/EventSheet';
import { Icon, IconName } from '../../components/Icon';
import { Ring } from '../../components/Ring';
import { Check, SubtaskList, subtaskProgress } from '../../components/SubtaskList';
import { TaskSheet } from '../../components/TaskSheet';
import { useRefresh } from '../../hooks/useRefresh';
import { useAuth } from '../../store/auth';
import { useEvents } from '../../store/events';
import { useGym } from '../../store/gym';
import { useLearning } from '../../store/learning';
import { useNotifications } from '../../store/notifications';
import { useSettings } from '../../store/settings';
import { useTasks } from '../../store/tasks';
import { useToday } from '../../store/today';
import { useAccent, withAlpha } from '../../theme/AccentContext';
import { colors, fonts } from '../../theme/colors';
import { Task } from '../../theme/tags';

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
};

export default function Home() {
  const { accent } = useAccent();
  const TODAY = useToday();
  // real current date, e.g. "Tuesday, June 16"
  const TODAY_LABEL = new Date(TODAY + 'T12:00').toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  const user = useAuth((s) => s.user);
  const firstName = (user?.display_name || user?.email?.split('@')[0] || '').split(' ')[0];
  const initial = (user?.display_name || user?.email || 'A').charAt(0).toUpperCase();
  const allTasks = useTasks((s) => s.tasks);
  const { upsert, remove, toggle, toggleSubtask, setTasks } = useTasks();
  const widgets = useSettings((s) => s.widgets);
  const show = (k: string) => widgets[k] !== false;
  const unread = useNotifications((s) => s.items.filter((n) => !n.read).length);
  const [filter, setFilter] = useState<string>('All');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);

  // Home only shows tasks scheduled for today — finished ones sink to the bottom
  const today = useMemo(() => {
    const list = allTasks.filter((t) => t.date === TODAY);
    return [...list.filter((t) => !t.done), ...list.filter((t) => t.done)];
  }, [allTasks, TODAY]);

  // unfinished tasks whose day already passed — surfaced in a banner, not silently dropped
  const overdue = useMemo(() => allTasks.filter((t) => t.date < TODAY && !t.done), [allTasks, TODAY]);
  const moveOverdueToToday = (t: Task) => upsert({ ...t, date: TODAY });
  const skipOverdue = (t: Task) => upsert({ ...t, done: true });

  const doneCount = useMemo(() => today.filter((t) => t.done).length, [today]);
  const total = today.length;
  const remaining = total - doneCount;

  // ---- real widget data (no more static placeholders) ----
  const events = useEvents((s) => s.events);
  const programs = useGym((s) => s.programs);
  const sessions = useGym((s) => s.sessions);
  const learnSessions = useLearning((s) => s.sessions);

  // today's study time (mins) + count of saved-for-later ideas
  const learnMin = useMemo(
    () => Math.round(learnSessions.filter((s) => s.done && s.date === TODAY).reduce((sum, s) => sum + s.durationSec, 0) / 60),
    [learnSessions, TODAY],
  );
  const learnIdeas = useMemo(() => learnSessions.filter((s) => !s.done).length, [learnSessions]);

  const { refreshing, onRefresh } = useRefresh([
    useTasks.getState().load,
    useEvents.getState().load,
    useGym.getState().load,
    useLearning.getState().load,
  ]);

  // next upcoming calendar event (today onward)
  const nextEvent = useMemo(
    () => events.filter((e) => e.date >= TODAY).sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))[0],
    [events, TODAY],
  );
  // your current program
  const nextWorkout = programs.find((p) => p.isActive) ?? programs[0];
  // consecutive-day workout streak (ending today or yesterday)
  const streak = useMemo(() => {
    const set = new Set(sessions.map((s) => s.daysAgo));
    let n = 0;
    let d = set.has(0) ? 0 : 1;
    while (set.has(d)) {
      n++;
      d++;
    }
    return n;
  }, [sessions]);

  const tagsPresent = useMemo(() => ['All', ...Array.from(new Set(today.map((t) => t.tag)))], [today]);
  const reorderable = filter === 'All';
  const shown = reorderable ? today : today.filter((t) => t.tag === filter);

  // drag reorder: reorder only today's slice, then merge back into the full list
  const onReorder = ({ from, to }: ReorderableListReorderEvent) => {
    const reordered = reorderItems(today, from, to);
    const others = allTasks.filter((t) => t.date !== TODAY);
    setTasks([...others, ...reordered]);
  };

  const openAdd = () => {
    setEditing(null);
    setSheetOpen(true);
  };
  const openEdit = (t: Task) => {
    setEditing(t);
    setSheetOpen(true);
  };

  const Header = (
    <View style={{ gap: 18, paddingBottom: 8 }}>
      {/* header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingTop: 6 }}>
        {/* text takes the leftover width and shrinks to fit; buttons never move */}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ fontSize: 13, color: colors.textDim, fontFamily: fonts.ui }}>{greeting()}{firstName ? `, ${firstName}` : ''}</Text>
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={{ fontSize: 23, color: colors.text, fontFamily: fonts.uiBold, marginTop: 2 }}>{TODAY_LABEL}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          {/* notifications bell + unread badge */}
          <Pressable
            onPress={() => router.push('/notifications')}
            style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.borderSoft, alignItems: 'center', justifyContent: 'center' }}
          >
            <Icon name="bell" size={21} color={colors.textSoft} />
            {unread > 0 && (
              <View style={{ position: 'absolute', top: 9, right: 9, minWidth: 16, height: 16, paddingHorizontal: 3, borderRadius: 8, backgroundColor: colors.red, borderWidth: 1.5, borderColor: colors.canvas, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: '#fff', fontFamily: fonts.uiBold, fontSize: 9 }}>{unread > 9 ? '9+' : unread}</Text>
              </View>
            )}
          </Pressable>

          <Pressable
            onPress={() => router.push('/settings')}
            style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: withAlpha(accent, 20), borderWidth: 1, borderColor: colors.borderSoft, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}
          >
            {user?.avatar ? (
              <Image source={{ uri: user.avatar }} style={{ width: 46, height: 46 }} />
            ) : (
              <Text style={{ color: colors.textSoft, fontFamily: fonts.uiBold, fontSize: 16 }}>{initial}</Text>
            )}
          </Pressable>
        </View>
      </View>

      {/* overdue tasks — surfaced, never silently dropped off Home */}
      {overdue.length > 0 && (
        <View style={{ backgroundColor: withAlpha(colors.amber, 10), borderWidth: 1, borderColor: withAlpha(colors.amber, 26), borderRadius: 18, padding: 14, gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Icon name="flame" size={15} color={colors.amber} />
            <Text style={{ fontSize: 14, color: colors.amber, fontFamily: fonts.uiSemi }}>
              {overdue.length} overdue task{overdue.length > 1 ? 's' : ''}
            </Text>
          </View>
          {overdue.map((t) => (
            <View key={t.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text numberOfLines={1} style={{ flex: 1, fontSize: 13.5, color: colors.textMid, fontFamily: fonts.ui }}>
                {t.title}
              </Text>
              <Pressable onPress={() => moveOverdueToToday(t)} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: accent }}>
                <Text style={{ fontSize: 12, color: '#fff', fontFamily: fonts.uiSemi }}>Move to today</Text>
              </Pressable>
              <Pressable onPress={() => skipOverdue(t)} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }}>
                <Text style={{ fontSize: 12, color: colors.textMuted, fontFamily: fonts.uiSemi }}>Skip</Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}

      {/* today progress card */}
      {show('today') && (
      <LinearGradient
        colors={[withAlpha(accent, 20), colors.card]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ borderRadius: 24, padding: 20, flexDirection: 'row', alignItems: 'center', gap: 18, borderWidth: 1, borderColor: withAlpha(accent, 26) }}
      >
        <View style={{ width: 66, height: 66 }}>
          <Ring size={66} stroke={6} progress={total ? doneCount / total : 0} color={accent} />
          <View style={{ position: 'absolute', top: 0, left: 0, width: 66, height: 66, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: fonts.monoSemi, fontSize: 14, color: '#fff' }}>{doneCount}/{total}</Text>
          </View>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 17, color: colors.text, fontFamily: fonts.uiSemi }}>Today's progress</Text>
          <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 3, fontFamily: fonts.ui }}>
            {remaining === 0 ? 'All done — nice work!' : `${remaining} task${remaining > 1 ? 's' : ''} left today`}
          </Text>
        </View>
      </LinearGradient>
      )}

      {/* 2x2 widget grid — real data */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {show('workout') && nextWorkout && (
          <Widget
            onPress={() => router.push('/gym')}
            iconBg={withAlpha(accent, 16)}
            iconColor={accent}
            icon="gym"
            kicker="Your program"
            title={nextWorkout.name}
            sub={`${nextWorkout.days.length} day${nextWorkout.days.length > 1 ? 's' : ''}`}
          />
        )}
        {show('calendar') && nextEvent && (
          <Widget
            onPress={() => router.push('/calendar')}
            iconBg={withAlpha(nextEvent.color, 16)}
            iconColor={nextEvent.color}
            icon="calendar"
            kicker={`Up next · ${nextEvent.time}`}
            title={nextEvent.title}
            sub={`${PRIORITY_META[nextEvent.priority as Priority].label} priority`}
            subColor={PRIORITY_META[nextEvent.priority as Priority].color}
          />
        )}
        {show('learn') && (
          <Widget
            onPress={() => router.push('/learn')}
            iconBg={withAlpha(accent, 16)}
            iconColor={accent}
            icon="book"
            kicker="Learning"
            title={`${learnMin}m`}
            titleMono
            sub={learnMin > 0 ? 'studied today' : learnIdeas > 0 ? `${learnIdeas} saved to start` : 'nothing yet today'}
          />
        )}
        {show('streak') && (
          <Widget iconBg={withAlpha(colors.amber, 16)} iconColor={colors.amber} icon="flame" kicker="" title={String(streak)} titleMono sub={streak === 1 ? 'day streak' : 'days streak'} />
        )}
        {show('note') && <Widget onPress={() => router.push('/notes')} dashed iconBg="rgba(255,255,255,0.05)" iconColor={colors.textMuted} icon="plus" kicker="" title="New note" center />}
      </View>

      {/* tasks header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 17, color: colors.text, fontFamily: fonts.uiSemi }}>Today's tasks</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Text style={{ fontSize: 13, color: colors.textDim, fontFamily: fonts.mono }}>{doneCount}/{total}</Text>
          <Pressable onPress={openAdd} style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: accent, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="plus" size={17} color="#fff" />
          </Pressable>
        </View>
      </View>

      {/* filter chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {tagsPresent.map((tg) => {
          const on = filter === tg;
          return (
            <Pressable
              key={tg}
              onPress={() => setFilter(tg)}
              style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 11, backgroundColor: on ? withAlpha(accent, 16) : colors.card, borderWidth: 1, borderColor: on ? accent : colors.border }}
            >
              <Text style={{ color: on ? accent : colors.textMuted, fontFamily: fonts.uiSemi, fontSize: 13 }}>{tg}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {reorderable && (
        <Text style={{ fontSize: 11.5, color: colors.textFainter, fontFamily: fonts.ui, marginTop: -4 }}>
          Long-press the ⋮⋮ handle to drag a task.
        </Text>
      )}
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas }} edges={['top']}>
      <ReorderableList
        data={shown}
        keyExtractor={(t) => t.id}
        onReorder={onReorder}
        // pan engages only after a long-press, so normal scroll + tab-swipe stay
        // fully native (no gesture contention). Drag a task by holding it.
        panGesture={Gesture.Pan().activateAfterLongPress(300)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={accent} />}
        ListHeaderComponent={Header}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 28 }}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        ListEmptyComponent={
          <Text style={{ color: colors.textFainter, fontFamily: fonts.ui, textAlign: 'center', paddingVertical: 24 }}>
            No tasks in “{filter}”.
          </Text>
        }
        renderItem={({ item }) => (
          <TaskRow item={item} accent={accent} onToggle={toggle} onToggleSub={toggleSubtask} onEdit={openEdit} dragEnabled={reorderable} />
        )}
      />

      <TaskSheet visible={sheetOpen} initial={editing} defaultDate={TODAY} onClose={() => setSheetOpen(false)} onSave={upsert} onDelete={remove} />
    </SafeAreaView>
  );
}

// One draggable task row. useReorderableDrag() gives the fn that starts a drag.
function TaskRow({
  item,
  accent,
  onToggle,
  onToggleSub,
  onEdit,
  dragEnabled,
}: {
  item: Task;
  accent: string;
  onToggle: (id: string) => void;
  onToggleSub: (taskId: string, subId: string) => void;
  onEdit: (t: Task) => void;
  dragEnabled: boolean;
}) {
  const drag = useReorderableDrag();
  const progress = subtaskProgress(item.subtasks);
  return (
    <View style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)', borderRadius: 15, padding: 13 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
      <Pressable onPress={() => onToggle(item.id)} hitSlop={8}>
        <Check done={item.done} accent={accent} />
      </Pressable>

      <Pressable onPress={() => onEdit(item)} style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ fontSize: 14.5, color: item.done ? colors.textFaint : colors.textMid, fontFamily: fonts.ui, textDecorationLine: item.done ? 'line-through' : 'none' }}>
            {item.title}
          </Text>
          {!!item.repeat && <Icon name="flame" size={11} color={colors.textFaint} />}
        </View>
        <Text style={{ fontSize: 12, color: colors.textFaint, marginTop: 2, fontFamily: fonts.mono }}>
          {item.time}{item.repeat ? ` · ${item.repeat}` : ''}{progress ? ` · ${progress}` : ''}
        </Text>
      </Pressable>

      <Text style={{ fontSize: 11, fontFamily: fonts.uiSemi, color: item.tagColor, backgroundColor: withAlpha(item.tagColor, 14), paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8, overflow: 'hidden' }}>
        {item.tag}
      </Text>

      {dragEnabled && (
        <Pressable onLongPress={drag} delayLongPress={300} hitSlop={8} style={{ paddingLeft: 2 }}>
          <Icon name="grip" size={18} color={colors.textFaint} />
        </Pressable>
      )}
    </View>
    <SubtaskList items={item.subtasks} accent={accent} onToggle={(sid) => onToggleSub(item.id, sid)} />
    </View>
  );
}

function Widget({ onPress, icon, iconBg, iconColor, kicker, title, sub, subColor, titleMono, dashed, center }: {
  onPress?: () => void; icon: IconName; iconBg: string; iconColor: string; kicker: string;
  title: string; sub?: string; subColor?: string; titleMono?: boolean; dashed?: boolean; center?: boolean;
}) {
  const Container: any = onPress ? Pressable : View;
  return (
    <Container
      onPress={onPress}
      style={{ width: '47%', flexGrow: 1, backgroundColor: colors.cardAlt, borderWidth: 1, borderColor: dashed ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.05)', borderStyle: dashed ? 'dashed' : 'solid', borderRadius: 20, padding: 16, minHeight: 120, justifyContent: center ? 'center' : 'space-between', alignItems: center ? 'center' : 'flex-start', gap: center ? 10 : 0 }}
    >
      <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: iconBg, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={20} color={iconColor} />
      </View>
      {center ? (
        <Text style={{ fontSize: 14, color: colors.textSoft, fontFamily: fonts.uiSemi }}>{title}</Text>
      ) : (
        <View>
          {!!kicker && <Text style={{ fontSize: 12, color: colors.textDim, fontFamily: fonts.ui }}>{kicker}</Text>}
          <Text style={{ fontSize: titleMono ? 30 : 18, color: colors.textMid, fontFamily: titleMono ? fonts.monoSemi : fonts.uiBold, marginTop: 2 }}>{title}</Text>
          {!!sub && <Text style={{ fontSize: 11.5, color: subColor ?? colors.textFaint, fontFamily: subColor ? fonts.uiSemi : fonts.ui, marginTop: 4 }}>{sub}</Text>}
        </View>
      )}
    </Container>
  );
}
