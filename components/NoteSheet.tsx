import { useEffect, useState } from 'react';
import { Dimensions, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { SwipeSheet } from './SwipeSheet';
import { useAccent, withAlpha } from '../theme/AccentContext';
import { colors, fonts } from '../theme/colors';
import { TAG_COLORS, TAG_PRESETS } from '../theme/tags';

const SHEET_BODY = Dimensions.get('window').height * 0.66;

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
  const [tag, setTag] = useState(TAG_PRESETS[0].name);
  const [tagColor, setTagColor] = useState(TAG_PRESETS[0].color);
  const [pinned, setPinned] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setTitle(initial?.title ?? '');
    setBody(initial?.body ?? '');
    setTag(initial?.tag ?? TAG_PRESETS[0].name);
    setTagColor(initial?.tagColor ?? TAG_PRESETS[0].color);
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
    <SwipeSheet visible={visible} onClose={onClose}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <Text style={{ fontSize: 19, color: colors.text, fontFamily: fonts.uiBold }}>{initial ? 'Edit note' : 'New note'}</Text>
            <Pressable onPress={() => setPinned((p) => !p)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, backgroundColor: pinned ? withAlpha(accent, 16) : colors.card, borderWidth: 1, borderColor: pinned ? accent : colors.border }}>
              <Text style={{ color: pinned ? accent : colors.textMuted, fontFamily: fonts.uiSemi, fontSize: 12.5 }}>📌 {pinned ? 'Pinned' : 'Pin'}</Text>
            </Pressable>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} style={{ maxHeight: SHEET_BODY }}>
            <TextInput value={title} onChangeText={setTitle} placeholder="Title" placeholderTextColor={colors.textFaint} style={[input, { fontFamily: fonts.uiSemi, fontSize: 17 }]} />
            <TextInput value={body} onChangeText={setBody} placeholder="Write your note… (markdown ok)" placeholderTextColor={colors.textFaint} multiline style={[input, { marginTop: 12, minHeight: 120, textAlignVertical: 'top' }]} />

            <Text style={{ fontSize: 12, color: colors.textFainter, fontFamily: fonts.uiSemi, textTransform: 'uppercase', letterSpacing: 1, marginTop: 18, marginBottom: 9 }}>Tag</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {TAG_PRESETS.map((p) => {
                const on = tag === p.name;
                return (
                  <Pressable key={p.name} onPress={() => { setTag(p.name); setTagColor(p.color); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 13, paddingVertical: 9, borderRadius: 11, backgroundColor: on ? withAlpha(p.color, 16) : colors.card, borderWidth: 1, borderColor: on ? p.color : colors.border }}>
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: p.color }} />
                    <Text style={{ color: on ? p.color : colors.textSoft, fontFamily: fonts.uiSemi, fontSize: 13 }}>{p.name}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={{ fontSize: 12, color: colors.textFainter, fontFamily: fonts.uiSemi, textTransform: 'uppercase', letterSpacing: 1, marginTop: 16, marginBottom: 9 }}>Custom tag name</Text>
            <TextInput
              value={TAG_PRESETS.some((p) => p.name === tag) ? '' : tag}
              onChangeText={setTag}
              placeholder="Type your own…"
              placeholderTextColor={colors.textFaint}
              style={input}
            />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
              {TAG_COLORS.map((c) => (
                <Pressable key={c} onPress={() => setTagColor(c)} style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: c, borderWidth: tagColor === c ? 2 : 0, borderColor: '#fff' }} />
              ))}
            </View>

            <Pressable onPress={save} style={{ backgroundColor: accent, borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 20 }}>
              <Text style={{ color: '#fff', fontFamily: fonts.uiBold, fontSize: 15 }}>{initial ? 'Save note' : 'Add note'}</Text>
            </Pressable>
            {initial && onDelete && (
              <Pressable onPress={() => { onDelete(initial.id); onClose(); }} style={{ paddingVertical: 14, alignItems: 'center', marginTop: 4 }}>
                <Text style={{ color: colors.red, fontFamily: fonts.uiSemi, fontSize: 14 }}>Delete note</Text>
              </Pressable>
            )}
          </ScrollView>
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
