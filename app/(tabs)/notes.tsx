import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon } from '../../components/Icon';
import { Note, NoteSheet } from '../../components/NoteSheet';
import { useRefresh } from '../../hooks/useRefresh';
import { useNotes } from '../../store/notes';
import { useAccent, withAlpha } from '../../theme/AccentContext';
import { colors, fonts } from '../../theme/colors';

export default function Notes() {
  const { accent } = useAccent();
  const notes = useNotes((s) => s.notes);
  const { upsert, remove } = useNotes();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('All');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Note | null>(null);

  const { refreshing, onRefresh } = useRefresh([useNotes.getState().load]);

  const tags = useMemo(() => ['All', ...Array.from(new Set(notes.map((n) => n.tag)))], [notes]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return notes.filter((n) => {
      const matchTag = filter === 'All' || n.tag === filter;
      const matchQ = !q || n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q);
      return matchTag && matchQ;
    });
  }, [notes, query, filter]);

  const pinned = filtered.filter((n) => n.pinned);
  const rest = filtered.filter((n) => !n.pinned);

  const openAdd = () => { setEditing(null); setSheetOpen(true); };
  const openEdit = (n: Note) => { setEditing(n); setSheetOpen(true); };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 28, gap: 18 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={accent} />}
      >
        {/* header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 6 }}>
          <View>
            <Text style={{ fontSize: 13, color: colors.textDim, fontFamily: fonts.ui }}>{notes.length} notes</Text>
            <Text style={{ fontSize: 25, color: colors.text, fontFamily: fonts.uiBold, marginTop: 2 }}>Notes</Text>
          </View>
          <Pressable onPress={openAdd} style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: accent, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="plus" size={20} color="#fff" />
          </Pressable>
        </View>

        {/* search */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.borderSoft, borderRadius: 14, paddingHorizontal: 14 }}>
          <Icon name="search" size={17} color={colors.textFainter} />
          <TextInput value={query} onChangeText={setQuery} placeholder="Search notes…" placeholderTextColor={colors.textFainter} style={{ flex: 1, color: colors.text, fontFamily: fonts.ui, fontSize: 14, paddingVertical: 12 }} />
        </View>

        {/* tag chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {tags.map((t) => {
            const on = filter === t;
            return (
              <Pressable key={t} onPress={() => setFilter(t)} style={{ paddingHorizontal: 15, paddingVertical: 8, borderRadius: 11, backgroundColor: on ? withAlpha(accent, 16) : colors.card, borderWidth: 1, borderColor: on ? accent : colors.border }}>
                <Text style={{ color: on ? accent : colors.textMuted, fontFamily: fonts.uiSemi, fontSize: 13 }}>{t}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* pinned */}
        {pinned.length > 0 && (
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 11 }}>
              <Text style={{ fontSize: 12 }}>📌</Text>
              <Text style={{ fontSize: 12, color: colors.textFainter, fontFamily: fonts.uiSemi, letterSpacing: 0.8, textTransform: 'uppercase' }}>Pinned</Text>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
              {pinned.map((n) => (
                <Pressable key={n.id} onPress={() => openEdit(n)} style={{ width: '47%', flexGrow: 1, backgroundColor: colors.cardAlt, borderWidth: 1, borderColor: colors.borderSoft, borderRadius: 18, padding: 15, gap: 9, minHeight: 135 }}>
                  <Text style={{ fontSize: 14, color: colors.textMid, fontFamily: fonts.uiBold }}>{n.title}</Text>
                  <Text numberOfLines={4} style={{ fontSize: 11.5, color: colors.textMuted, fontFamily: fonts.ui, lineHeight: 18, flex: 1 }}>{n.body}</Text>
                  <Tag note={n} />
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* all notes */}
        <View>
          <Text style={{ fontSize: 12, color: colors.textFainter, fontFamily: fonts.uiSemi, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 11 }}>All notes</Text>
          <View style={{ gap: 10 }}>
            {rest.map((n) => (
              <Pressable key={n.id} onPress={() => openEdit(n)} style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 15 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 7 }}>
                  <Text style={{ fontSize: 15, color: colors.textMid, fontFamily: fonts.uiSemi, flex: 1 }}>{n.title}</Text>
                  <Text style={{ fontSize: 11, color: colors.textFainter, fontFamily: fonts.mono }}>{n.date}</Text>
                </View>
                <Text numberOfLines={2} style={{ fontSize: 12.5, color: colors.textMuted, fontFamily: fonts.ui, lineHeight: 18 }}>{n.body}</Text>
                <View style={{ marginTop: 11, flexDirection: 'row' }}><Tag note={n} /></View>
              </Pressable>
            ))}
            {filtered.length === 0 && (
              <Text style={{ color: colors.textFainter, fontFamily: fonts.ui, textAlign: 'center', paddingVertical: 28 }}>No notes found.</Text>
            )}
          </View>
        </View>
      </ScrollView>

      <NoteSheet visible={sheetOpen} initial={editing} onClose={() => setSheetOpen(false)} onSave={upsert} onDelete={remove} />
    </SafeAreaView>
  );
}

function Tag({ note }: { note: Note }) {
  return (
    <Text style={{ fontSize: 10, fontFamily: fonts.uiSemi, color: note.tagColor, backgroundColor: withAlpha(note.tagColor, 14), paddingHorizontal: 8, paddingVertical: 3, borderRadius: 7, alignSelf: 'flex-start', overflow: 'hidden' }}>
      {note.tag}
    </Text>
  );
}
