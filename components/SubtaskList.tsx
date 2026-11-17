import { Pressable, Text, View } from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { colors, fonts } from '../theme/colors';
import { Subtask } from '../theme/tags';

// smooth slide when a ticked subtask moves to the bottom
export const SUBTASK_MOVE = LinearTransition.springify().damping(20).stiffness(180);

// Small checklist under a task row (Home + Calendar): the box ticks the
// subtask; the rest of the row opens the task.
export function SubtaskList({ items, accent, onToggle, onOpen }: { items: Subtask[]; accent: string; onToggle: (id: string) => void; onOpen?: () => void }) {
  if (!items.length) return null;
  return (
    <View style={{ gap: 7, marginTop: 10, paddingLeft: 33 }}>
      {doneLast(items).map((st) => (
        <Animated.View key={st.id} layout={SUBTASK_MOVE} style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
          <Pressable onPress={() => onToggle(st.id)} hitSlop={8}>
            <Check done={st.done} accent={accent} size={17} />
          </Pressable>
          <Pressable onPress={onOpen} disabled={!onOpen} style={{ flex: 1, paddingVertical: 2 }}>
            <Text
              style={{
                fontSize: 13.5,
                color: st.done ? colors.textFaint : colors.textSoft,
                fontFamily: fonts.ui,
                textDecorationLine: st.done ? 'line-through' : 'none',
              }}
            >
              {st.title}
            </Text>
          </Pressable>
        </Animated.View>
      ))}
    </View>
  );
}

// open ones first, ticked ones sink to the bottom (order otherwise kept)
export const doneLast = (items: Subtask[]) => [...items.filter((s) => !s.done), ...items.filter((s) => s.done)];

// "2/3" progress label for a task's subtasks (empty when it has none)
export const subtaskProgress = (items: Subtask[]) =>
  items.length ? `${items.filter((s) => s.done).length}/${items.length}` : '';

export function Check({ done, accent, size = 22 }: { done: boolean; accent: string; size?: number }) {
  const icon = Math.round(size * 0.6);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.32,
        borderWidth: 2,
        borderColor: done ? accent : '#3a3a45',
        backgroundColor: done ? accent : 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {done && (
        <Svg width={icon} height={icon} viewBox="0 0 13 13">
          <Path d="M2.5 6.5 5.5 9.5 10.5 3.5" fill="none" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      )}
    </View>
  );
}
