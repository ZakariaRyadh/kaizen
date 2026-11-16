import { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { SwipeSheet } from './SwipeSheet';
import { TagPicker } from './TagPicker';
import { useAccent, withAlpha } from '../theme/AccentContext';
import { colors, fonts } from '../theme/colors';
import { NO_TAG_COLOR } from '../theme/tags';

export type Note = {
  id: string;
  title: string;
  body: string;
  tag: string;
  tagColor: string;
  pinned: boolean;
  date: string;
};

type Props = {
  visible: boolean;
  initial?: Note | null;
  onClose: () => void;
  onSave: (n: Note) => void;
  onDelete?: (id: string) => void;
};

export function NoteSheet({ visible, initial, onClose, onSave, onDelete }: Props) {
  const { accent } = useAccent();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [tag, setTag] = useState('');
  const [tagColor, setTagColor] = useState(NO_TAG_COLOR);
  const [pinned, setPinned] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setTitle(initial?.title ?? '');
    setBody(initial?.body ?? '');
    setTag(initial?.tag ?? '');
    setTagColor(initial?.tagColor ?? NO_TAG_COLOR);
    setPinned(initial?.pinned ?? false);
  }, [visible, initial]);

  const save = () => {
    if (!title.trim() && !body.trim()) return;
    const now = new Date();
    onSave({
      id: initial?.id ?? Date.now().toString(),
      title: title.trim() || 'Untitled',
      body: body.trim(),
      tag,
      tagColor,
      pinned,
      date: initial?.date ?? now.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    });
    onClose();
  };

  return (
    <SwipeSheet visible={visible} onClose={onClose} scroll>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <Text style={{ fontSize: 19, color: colors.text, fontFamily: fonts.uiBold }}>{initial ? 'Edit note' : 'New note'}</Text>
            <Pressable onPress={() => setPinned((p) => !p)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, backgroundColor: pinned ? withAlpha(accent, 16) : colors.card, borderWidth: 1, borderColor: pinned ? accent : colors.border }}>
              <Text style={{ color: pinned ? accent : colors.textMuted, fontFamily: fonts.uiSemi, fontSize: 12.5 }}>📌 {pinned ? 'Pinned' : 'Pin'}</Text>
            </Pressable>
          </View>

            <TextInput value={title} onChangeText={setTitle} placeholder="Title" placeholderTextColor={colors.textFaint} style={[input, { fontFamily: fonts.uiSemi, fontSize: 17 }]} />
            <TextInput value={body} onChangeText={setBody} placeholder="Write your note… (markdown ok)" placeholderTextColor={colors.textFaint} multiline style={[input, { marginTop: 12, minHeight: 120, textAlignVertical: 'top' }]} />

            <Text style={{ fontSize: 12, color: colors.textFainter, fontFamily: fonts.uiSemi, textTransform: 'uppercase', letterSpacing: 1, marginTop: 18, marginBottom: 9 }}>Tag</Text>
            <TagPicker
              tag={tag}
              accent={accent}
              onChange={(t, c) => {
                setTag(t);
                setTagColor(c);
              }}
            />

            <Pressable onPress={save} style={{ backgroundColor: accent, borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 20 }}>
              <Text style={{ color: '#fff', fontFamily: fonts.uiBold, fontSize: 15 }}>{initial ? 'Save note' : 'Add note'}</Text>
            </Pressable>
            {initial && onDelete && (
              <Pressable onPress={() => { onDelete(initial.id); onClose(); }} style={{ paddingVertical: 14, alignItems: 'center', marginTop: 4 }}>
                <Text style={{ color: colors.red, fontFamily: fonts.uiSemi, fontSize: 14 }}>Delete note</Text>
              </Pressable>
            )}
    </SwipeSheet>
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
