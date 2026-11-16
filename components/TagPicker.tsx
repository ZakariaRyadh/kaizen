import { useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';

import { useNotes } from '../store/notes';
import { useSettings } from '../store/settings';
import { useTasks } from '../store/tasks';
import { withAlpha } from '../theme/AccentContext';
import { colors, fonts } from '../theme/colors';
import { NO_TAG_COLOR, TAG_COLORS } from '../theme/tags';

/** Ask, then delete a tag from the list and clear it from every task and note that uses it. */
export function confirmDeleteTag(name: string) {
  Alert.alert(`Delete "${name}"?`, 'It is removed from your tags and from every task and note that uses it.', [
    { text: 'Cancel', style: 'cancel' },
    {
      text: 'Delete',
      style: 'destructive',
      onPress: () => {
        useSettings.getState().removeTag(name);
        const { tasks, upsert } = useTasks.getState();
        tasks.filter((t) => t.tag === name).forEach((t) => upsert({ ...t, tag: '', tagColor: NO_TAG_COLOR }).catch(() => {}));
        const notes = useNotes.getState();
        notes.notes.filter((n) => n.tag === name).forEach((n) => notes.upsert({ ...n, tag: '', tagColor: NO_TAG_COLOR }).catch(() => {}));
      },
    },
  ]);
}

type Props = {
  tag?: string;
  accent: string;
  onChange?: (tag: string, color: string) => void;
  manage?: boolean; // Settings: no selection, each tag has a delete ×
};

/** None + your tags; long-press a tag to delete it; "+ New" adds one. */
export function TagPicker({ tag = '', accent, onChange = () => {}, manage = false }: Props) {
  const tags = useSettings((s) => s.tags);
  const addTag = useSettings((s) => s.addTag);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState(TAG_COLORS[0]);

  const create = () => {
    const n = name.trim();
    if (!n) return;
    const existing = tags.find((t) => t.name.toLowerCase() === n.toLowerCase());
    if (existing) onChange(existing.name, existing.color);
    else {
      addTag({ name: n, color });
      onChange(n, color);
    }
    setName('');
    setAdding(false);
  };

  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {!manage && <Chip label="None" color={NO_TAG_COLOR} on={!tag} onPress={() => onChange('', NO_TAG_COLOR)} />}
        {tags.map((t) => (
          <Chip
            key={t.name}
            label={t.name}
            color={t.color}
            on={!manage && tag === t.name}
            onPress={() => (manage ? confirmDeleteTag(t.name) : onChange(t.name, t.color))}
            onLongPress={() => confirmDeleteTag(t.name)}
            removable={manage}
          />
        ))}
        <Pressable
          onPress={() => setAdding((a) => !a)}
          style={{ paddingHorizontal: 13, paddingVertical: 9, borderRadius: 11, borderWidth: 1, borderStyle: 'dashed', borderColor: adding ? accent : colors.borderSoft }}
        >
          <Text style={{ color: adding ? accent : colors.textMuted, fontFamily: fonts.uiSemi, fontSize: 13 }}>+ New</Text>
        </Pressable>
      </View>

      {adding && (
        <View style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 13, padding: 12, gap: 12 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput
              value={name}
              onChangeText={setName}
              onSubmitEditing={create}
              autoFocus
              maxLength={40}
              placeholder="Tag name"
              placeholderTextColor={colors.textFaint}
              style={{ flex: 1, color: colors.text, fontFamily: fonts.ui, fontSize: 14.5, paddingVertical: 6 }}
            />
            <Pressable onPress={create} style={{ backgroundColor: accent, borderRadius: 9, paddingHorizontal: 14, justifyContent: 'center', opacity: name.trim() ? 1 : 0.5 }}>
              <Text style={{ color: '#fff', fontFamily: fonts.uiSemi, fontSize: 13 }}>Add</Text>
            </Pressable>
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {TAG_COLORS.map((c) => (
              <Pressable key={c} onPress={() => setColor(c)} style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: c, borderWidth: color === c ? 2 : 0, borderColor: '#fff' }} />
            ))}
          </View>
        </View>
      )}
      {!manage && tags.length > 0 && <Text style={{ color: colors.textFaint, fontFamily: fonts.ui, fontSize: 11.5 }}>Long-press a tag to delete it.</Text>}
    </View>
  );
}

function Chip({ label, color, on, onPress, onLongPress, removable }: { label: string; color: string; on: boolean; onPress: () => void; onLongPress?: () => void; removable?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 7,
        paddingHorizontal: 13,
        paddingVertical: 9,
        borderRadius: 11,
        backgroundColor: on ? withAlpha(color, 16) : colors.card,
        borderWidth: 1,
        borderColor: on ? color : colors.border,
      }}
    >
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }} />
      <Text style={{ color: on ? color : colors.textSoft, fontFamily: fonts.uiSemi, fontSize: 13 }}>{label}</Text>
      {removable && <Text style={{ color: colors.textFaint, fontSize: 15, lineHeight: 16, marginLeft: 2 }}>×</Text>}
    </Pressable>
  );
}
