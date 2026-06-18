import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';
import ReorderableList, {
  ReorderableListReorderEvent,
  reorderItems,
  useReorderableDrag,
} from 'react-native-reorderable-list';
import Svg, { Path } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon, IconName } from '../../components/Icon';
import { Ring } from '../../components/Ring';
import { TaskSheet } from '../../components/TaskSheet';
import { useSettings } from '../../store/settings';
import { TODAY, useTasks } from '../../store/tasks';
import { useAccent, withAlpha } from '../../theme/AccentContext';
import { colors, fonts } from '../../theme/colors';
import { Task } from '../../theme/tags';

// real current date, e.g. "Tuesday, June 16"
const TODAY_LABEL = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
};

export default function Home() {
  const { accent } = useAccent();
  const allTasks = useTasks((s) => s.tasks);
  const { upsert, remove, toggle, setTasks } = useTasks();
  const widgets = useSettings((s) => s.widgets);
  const show = (k: string) => widgets[k] !== false;
  const [filter, setFilter] = useState<string>('All');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);

  // Home only shows tasks scheduled for today
  const today = useMemo(() => allTasks.filter((t) => t.date === TODAY), [allTasks]);

  const doneCount = useMemo(() => today.filter((t) => t.done).length, [today]);
  const total = today.length;
  const remaining = total - doneCount;

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
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 6 }}>
        <View>
          <Text style={{ fontSize: 13, color: colors.textDim, fontFamily: fonts.ui }}>{greeting()}</Text>
          <Text style={{ fontSize: 23, color: colors.text, fontFamily: fonts.uiBold, marginTop: 2 }}>{TODAY_LABEL}</Text>
        </View>
        <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: '#22222d', borderWidth: 1, borderColor: colors.borderSoft, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: colors.textSoft, fontFamily: fonts.uiBold, fontSize: 16 }}>A</Text>
        </View>
      </View>

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

      {/* 2x2 widget grid */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {show('workout') && <Widget onPress={() => router.push('/gym')} iconBg={withAlpha(accent, 16)} iconColor={accent} icon="gym" kicker="Next workout" title="Pull day" sub="5 exercises · 45 min" />}
        {show('calendar') && <Widget onPress={() => router.push('/calendar')} iconBg={withAlpha(colors.blue, 16)} iconColor={colors.blue} icon="calendar" kicker="Up next · 11:00" title="Design review" sub="High priority" subColor={colors.red} />}
        {show('streak') && <Widget iconBg={withAlpha(colors.amber, 16)} iconColor={colors.amber} icon="flame" kicker="" title="12" titleMono sub="day streak" />}
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
        panGesture={Gesture.Pan().activeOffsetY([-12, 12])}
        ListHeaderComponent={Header}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 28 }}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        ListEmptyComponent={
          <Text style={{ color: colors.textFainter, fontFamily: fonts.ui, textAlign: 'center', paddingVertical: 24 }}>
            No tasks in “{filter}”.
          </Text>
        }
        renderItem={({ item }) => (
          <TaskRow item={item} accent={accent} onToggle={toggle} onEdit={openEdit} dragEnabled={reorderable} />
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
  onEdit,
  dragEnabled,
}: {
  item: Task;
  accent: string;
  onToggle: (id: string) => void;
  onEdit: (t: Task) => void;
  dragEnabled: boolean;
}) {
  const drag = useReorderableDrag();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: colors.card, borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)', borderRadius: 15, padding: 13 }}>
      <Pressable onPress={() => onToggle(item.id)} hitSlop={8}>
        <View style={{ width: 22, height: 22, borderRadius: 7, borderWidth: 2, borderColor: item.done ? accent : '#3a3a45', backgroundColor: item.done ? accent : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
          {item.done && (
            <Svg width={13} height={13} viewBox="0 0 13 13">
              <Path d="M2.5 6.5 5.5 9.5 10.5 3.5" fill="none" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          )}
        </View>
      </Pressable>

      <Pressable onPress={() => onEdit(item)} style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ fontSize: 14.5, color: item.done ? colors.textFaint : colors.textMid, fontFamily: fonts.ui, textDecorationLine: item.done ? 'line-through' : 'none' }}>
            {item.title}
          </Text>
          {!!item.repeat && <Icon name="flame" size={11} color={colors.textFaint} />}
        </View>
        <Text style={{ fontSize: 12, color: colors.textFaint, marginTop: 2, fontFamily: fonts.mono }}>
          {item.time}{item.repeat ? ` · ${item.repeat}` : ''}
        </Text>
      </Pressable>

      <Text style={{ fontSize: 11, fontFamily: fonts.uiSemi, color: item.tagColor, backgroundColor: withAlpha(item.tagColor, 14), paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8, overflow: 'hidden' }}>
        {item.tag}
      </Text>

      {dragEnabled && (
        <Pressable onLongPress={drag} delayLongPress={120} hitSlop={8} style={{ paddingLeft: 2 }}>
          <Icon name="grip" size={18} color={colors.textFaint} />
        </Pressable>
      )}
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
