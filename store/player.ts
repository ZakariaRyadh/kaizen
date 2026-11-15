import AsyncStorage from '@react-native-async-storage/async-storage';
import { AudioPlayer, createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { create } from 'zustand';

export type Track = { uri: string; name: string };

const STORAGE_KEY = 'gym_playlist';
const SHUFFLE_KEY = 'gym_playlist_shuffle';

// one shared native player instance for the whole app
let player: AudioPlayer | null = null;
let wired = false;

type State = {
  tracks: Track[];
  index: number;
  playing: boolean;
  ready: boolean;
  shuffle: boolean;
  load: () => Promise<void>;
  addTracks: (t: Track[]) => void;
  removeTrack: (uri: string) => void;
  playIndex: (i: number) => void;
  toggle: () => void;
  toggleShuffle: () => void;
  next: () => void;
  prev: () => void;
};

export const usePlayer = create<State>((set, get) => {
  const persist = (tracks: Track[]) => AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(tracks)).catch(() => {});

  // didJustFinish is a level check (playbackState === ENDED), re-sent on every ~500ms
  // poll while the player sits in ENDED — without an edge-guard, next() fires several
  // times before replace()/play() clears that state, racing itself back onto the same track.
  let finishHandled = false;

  const ensurePlayer = () => {
    if (!player) player = createAudioPlayer(undefined, { updateInterval: 500 });
    if (!wired) {
      wired = true;
      player.addListener('playbackStatusUpdate', (status: any) => {
        if (status?.didJustFinish) {
          if (!finishHandled) {
            finishHandled = true;
            get().next();
          }
        } else {
          finishHandled = false;
          if (typeof status?.playing === 'boolean') set({ playing: status.playing });
        }
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
    // lock-screen / notification-shade "Now Playing" widget — same one Spotify/etc get,
    // it's free once a media session is active, just needs metadata to look right.
    p.setActiveForLockScreen(true, { title: tracks[i].name, artist: 'Kaizen' });
    set({ index: i, playing: true });
  };

  return {
    tracks: [],
    index: 0,
    playing: false,
    ready: false,
    shuffle: false,

    load: async () => {
      // shouldPlayInBackground is the one flag that keeps audio alive once you leave the app —
      // without it the OS tears the player down the instant Kaizen goes background, like Spotify never would.
      await setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: true }).catch(() => {});
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        const shuffleRaw = await AsyncStorage.getItem(SHUFFLE_KEY);
        set({ tracks: raw ? JSON.parse(raw) : [], shuffle: shuffleRaw === '1', ready: true });
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
      if (tracks.length === 0) {
        player?.pause();
        player?.clearLockScreenControls();
        set({ playing: false });
      }
    },

    playIndex: (i) => start(i),

    toggleShuffle: () => {
      const shuffle = !get().shuffle;
      set({ shuffle });
      AsyncStorage.setItem(SHUFFLE_KEY, shuffle ? '1' : '0').catch(() => {});
    },

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

    // didJustFinish (in ensurePlayer's listener) already calls this — that's the
    // "auto-play next track when one finishes" behavior, for free.
    next: () => {
      const { tracks, index, shuffle } = get();
      if (tracks.length === 0) return;
      if (tracks.length === 1) return start(index);
      if (shuffle) {
        let ni = index;
        while (ni === index) ni = Math.floor(Math.random() * tracks.length);
        return start(ni);
      }
      start((index + 1) % tracks.length);
    },

    prev: () => {
      const { tracks, index } = get();
      if (tracks.length === 0) return;
      start((index - 1 + tracks.length) % tracks.length);
    },
  };
});
