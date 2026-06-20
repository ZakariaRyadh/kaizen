import * as MediaLibrary from 'expo-media-library';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon } from './Icon';
import { usePlayer } from '../store/player';
import { useAccent, withAlpha } from '../theme/AccentContext';
import { colors, fonts } from '../theme/colors';

type Item = { id: string; uri: string; name: string; duration: number; created: number };

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const stripExt = (f: string) => f.replace(/\.[^.]+$/, '');

export function MusicLibrary({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { accent } = useAccent();
  const tracks = usePlayer((s) => s.tracks);
  const playerApi = usePlayer();

  const [perm, setPerm] = useState<'idle' | 'denied' | 'granted'>('idle');
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [sort, setSort] = useState<'date' | 'name'>('date');

  useEffect(() => {
    if (visible) loadLibrary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const loadLibrary = async () => {
    setLoading(true);
    const res = await MediaLibrary.requestPermissionsAsync();
    if (!res.granted) {
      setPerm('denied');
      setLoading(false);
      return;
    }
    setPerm('granted');
    // pull device audio (paged once, up to 2000)
    const page = await MediaLibrary.getAssetsAsync({
      mediaType: MediaLibrary.MediaType.audio,
      first: 2000,
    });
    setItems(
      page.assets.map((a) => ({
        id: a.id,
        uri: a.uri,
        name: stripExt(a.filename),
        duration: a.duration,
        created: a.creationTime,
      })),
    );
    setLoading(false);
  };

  const sorted = useMemo(() => {
    const copy = [...items];
    if (sort === 'name') copy.sort((a, b) => a.name.localeCompare(b.name));
    else copy.sort((a, b) => b.created - a.created);
    return copy;
  }, [items, sort]);

  const added = useMemo(() => new Set(tracks.map((t) => t.uri)), [tracks]);

  const addAndPlay = (it: Item) => {
    playerApi.addTracks([{ uri: it.uri, name: it.name }]);
    const i = usePlayer.getState().tracks.findIndex((t) => t.uri === it.uri);
    if (i >= 0) playerApi.playIndex(i);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas }} edges={['top']}>
        {/* header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 }}>
          <Pressable onPress={onClose} hitSlop={8} style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="back" size={22} color={colors.text} />
          </Pressable>
          <Text style={{ flex: 1, textAlign: 'center', fontSize: 18, color: colors.text, fontFamily: fonts.uiBold }}>Local music</Text>
          <View style={{ width: 36 }} />
        </View>

        {/* sort chips */}
        {perm === 'granted' && (
          <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingBottom: 10 }}>
            {(['date', 'name'] as const).map((s) => {
              const on = sort === s;
              return (
                <Pressable key={s} onPress={() => setSort(s)} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 16, paddingVertical: 9, borderRadius: 999, backgroundColor: on ? withAlpha(accent, 16) : colors.card, borderWidth: 1, borderColor: on ? accent : colors.border }}>
                  <Text style={{ color: on ? accent : colors.textMuted, fontFamily: fonts.uiSemi, fontSize: 13 }}>{s === 'date' ? 'Date' : 'Name'}</Text>
                </Pressable>
              );
            })}
          </View>
        )}

        {loading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color={accent} />
          </View>
        ) : perm === 'denied' ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30, gap: 12 }}>
            <Text style={{ color: colors.textSoft, fontFamily: fonts.uiSemi, fontSize: 15, textAlign: 'center' }}>
              Allow access to your music to import songs.
            </Text>
            <Pressable onPress={loadLibrary} style={{ backgroundColor: accent, borderRadius: 14, paddingHorizontal: 22, paddingVertical: 13 }}>
              <Text style={{ color: '#fff', fontFamily: fonts.uiBold }}>Grant access</Text>
            </Pressable>
          </View>
        ) : (
          <FlatList
            data={sorted}
            keyExtractor={(it) => it.id}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 30 }}
            ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: colors.border }} />}
            ListEmptyComponent={<Text style={{ color: colors.textFaint, fontFamily: fonts.ui, textAlign: 'center', paddingVertical: 40 }}>No audio files found on this device.</Text>}
            renderItem={({ item }) => {
              const isAdded = added.has(item.uri);
              return (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 }}>
                  <Pressable onPress={() => addAndPlay(item)} hitSlop={6}>
                    <Icon name="play" size={20} color={accent} />
                  </Pressable>
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={{ fontSize: 14.5, color: colors.textMid, fontFamily: fonts.uiSemi }}>{item.name}</Text>
                    <Text style={{ fontSize: 12, color: colors.textFaint, fontFamily: fonts.mono, marginTop: 2 }}>{fmt(item.duration)}</Text>
                  </View>
                  <Pressable
                    onPress={() => (isAdded ? playerApi.removeTrack(item.uri) : playerApi.addTracks([{ uri: item.uri, name: item.name }]))}
                    hitSlop={8}
                    style={{ width: 34, height: 34, borderRadius: 10, borderWidth: 1.5, borderColor: isAdded ? accent : colors.borderSoft, backgroundColor: isAdded ? accent : 'transparent', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Text style={{ color: isAdded ? '#fff' : colors.textMuted, fontSize: 18, lineHeight: 20 }}>{isAdded ? '✓' : '+'}</Text>
                  </Pressable>
                </View>
              );
            }}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}
