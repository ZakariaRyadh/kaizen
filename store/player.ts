import AsyncStorage from '@react-native-async-storage/async-storage';
import { AudioPlayer, createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { create } from 'zustand';

export type Track = { uri: string; name: string };

const STORAGE_KEY = 'gym_playlist';

// one shared native player instance for the whole app
let player: AudioPlayer | null = null;
let wired = false;

type State = {
  tracks: Track[];
  index: number;
  playing: boolean;
  ready: boolean;
  load: () => Promise<void>;
  addTracks: (t: Track[]) => void;
  removeTrack: (uri: string) => void;
  playIndex: (i: number) => void;
  toggle: () => void;
  next: () => void;
  prev: () => void;
};

export const usePlayer = create<State>((set, get) => {
  const persist = (tracks: Track[]) => AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(tracks)).catch(() => {});

  const ensurePlayer = () => {
    if (!player) player = createAudioPlayer(undefined, { updateInterval: 500 });
    if (!wired) {
      wired = true;
      player.addListener('playbackStatusUpdate', (status: any) => {
        if (status?.didJustFinish) get().next();
        else if (typeof status?.playing === 'boolean') set({ playing: status.playing });
      });
    }
    return player;
  };

  const start = (i: number) => {
    const { tracks } = get();
    if (i < 0 || i >= tracks.length) return;
    const p = ensurePlayer();
    p.replace({ uri: tracks[i].uri });
    p.play();
    set({ index: i, playing: true });
  };

  return {
    tracks: [],
    index: 0,
    playing: false,
    ready: false,

    load: async () => {
      await setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        set({ tracks: raw ? JSON.parse(raw) : [], ready: true });
      } catch {
        set({ ready: true });
      }
    },

    addTracks: (incoming) => {
      const have = new Set(get().tracks.map((t) => t.uri));
      const merged = [...get().tracks, ...incoming.filter((t) => !have.has(t.uri))];
      set({ tracks: merged });
      persist(merged);
    },

    removeTrack: (uri) => {
      const tracks = get().tracks.filter((t) => t.uri !== uri);
      set({ tracks, index: Math.min(get().index, Math.max(0, tracks.length - 1)) });
      persist(tracks);
    },

    playIndex: (i) => start(i),

    toggle: () => {
      const { tracks, index, playing } = get();
      if (tracks.length === 0) return;
      if (!player) {
        start(index);
        return;
      }
      if (playing) {
        player.pause();
        set({ playing: false });
      } else {
        player.play();
        set({ playing: true });
      }
    },

    next: () => {
      const { tracks, index } = get();
      if (tracks.length === 0) return;
      start((index + 1) % tracks.length);
    },

    prev: () => {
      const { tracks, index } = get();
      if (tracks.length === 0) return;
      start((index - 1 + tracks.length) % tracks.length);
    },
  };
});
