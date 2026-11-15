import { Pressable, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { colors, fonts } from '../theme/colors';
import { Subtask } from '../theme/tags';

// Small tickable checklist shown under a task row (Home + Calendar).
export function SubtaskList({ items, accent, onToggle }: { items: Subtask[]; accent: string; onToggle: (id: string) => void }) {
  if (!items.length) return null;
  return (
    <View style={{ gap: 7, marginTop: 10, paddingLeft: 33 }}>
      {items.map((st) => (
        <Pressable key={st.id} onPress={() => onToggle(st.id)} hitSlop={4} style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
          <Check done={st.done} accent={accent} size={17} />
          <Text
            style={{
              flex: 1,
              fontSize: 13.5,
              color: st.done ? colors.textFaint : colors.textSoft,
              fontFamily: fonts.ui,
              textDecorationLine: st.done ? 'line-through' : 'none',
            }}
          >
            {st.title}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

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
