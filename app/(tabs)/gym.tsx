import * as DocumentPicker from 'expo-document-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon } from '../../components/Icon';
import { ProgramEditor } from '../../components/ProgramEditor';
import { ProgressStat } from '../../components/ProgressStat';
import { Ring } from '../../components/Ring';
import { SwipeSheet } from '../../components/SwipeSheet';
import { WeightSheet } from '../../components/WeightSheet';
import { useRefresh } from '../../hooks/useRefresh';
import { fireNow } from '../../services/notifications';
import { LiveSet, useGym } from '../../store/gym';
import { useNotifications } from '../../store/notifications';
import { useSettings } from '../../store/settings';
import { usePlayer } from '../../store/player';
import { TODAY } from '../../store/tasks';
import { useWeight } from '../../store/weight';
import { useAccent, withAlpha } from '../../theme/AccentContext';
import { colors, fonts } from '../../theme/colors';
import { LoggedSession, Program } from '../../theme/programs';

const WEEKDAY = new Date().toLocaleDateString(undefined, { weekday: 'long' });
const fmtDay = (iso: string) => new Date(iso).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

const pad = (n: number) => String(n).padStart(2, '0');
const clock = (s: number) => `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
const restFmt = (s: number) => `${Math.floor(s / 60)}:${pad(s % 60)}`;

// rough training volume from a day's exercises (sets × reps × weight)
function dayVolume(exercises: { sets: number; reps: string; weight: string }[]) {
  return exercises.reduce((sum, e) => {
    const reps = parseInt(e.reps, 10) || 0;
    const w = parseFloat(e.weight) || 0;
    return sum + e.sets * reps * w;
  }, 0);
}


export default function Gym() {
  const { accent } = useAccent();

  const [view, setView] = useState<'train' | 'log'>('train');
  const programs = useGym((s) => s.programs);
  const gym = useGym();
  const [activeId, setActiveId] = useState<string>('');
  const [dayIndex, setDayIndex] = useState(0);

  // program editor (create / edit custom programs)
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingProgram, setEditingProgram] = useState<Program | null>(null);

  // session flow: idle → (precardio) → training → (postcardio) → saved
  const sessRef = useRef<number | null>(null); // training start timestamp
  const cardioRef = useRef<number | null>(null); // current cardio segment start
  const [phase, setPhase] = useState<'idle' | 'precardio' | 'training' | 'postcardio'>('idle');
  const [cardioRunning, setCardioRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [cardioSec, setCardioSec] = useState(0);       // current running cardio segment
  const [cardioTotal, setCardioTotal] = useState(0);   // committed cardio so far (display)
  const [paused, setPaused] = useState(false);         // session/cardio timer paused
  const [liveSets, setLiveSets] = useState<Record<string, LiveSet[]>>({}); // sets being done now

  // rest timer (counts down) — length comes from Settings
  const restSeconds = useSettings((s) => s.restSeconds);
  const [restLeft, setRestLeft] = useState(restSeconds);
  const [restRunning, setRestRunning] = useState(false);

  // keep the idle rest timer in sync with the Settings value
  useEffect(() => {
    if (!restRunning) setRestLeft(restSeconds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restSeconds]);

  // playlist (real local-file player) + modals
  const tracks = usePlayer((s) => s.tracks);
  const playing = usePlayer((s) => s.playing);
  const trackIndex = usePlayer((s) => s.index);
  const playerReady = usePlayer((s) => s.ready);
  const playerApi = usePlayer();
  const [programModal, setProgramModal] = useState(false);
  const [importModal, setImportModal] = useState(false);

  // body weight log
  const weights = useWeight((s) => s.weights);
  const weightApi = useWeight();
  const [weightSheet, setWeightSheet] = useState(false);

  const { refreshing, onRefresh } = useRefresh([useGym.getState().load, useWeight.getState().load]);

  // load saved playlist once
  useEffect(() => {
    if (!playerReady) playerApi.load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // pick audio files from device storage (works in Expo Go — no extra permission)
  const pickAudio = async () => {
    const res = await DocumentPicker.getDocumentAsync({
      type: 'audio/*',
      multiple: true,
      copyToCacheDirectory: true,
    });
    if (res.canceled) return;
    playerApi.addTracks(
      res.assets.map((a) => ({ uri: a.uri, name: a.name?.replace(/\.[^.]+$/, '') ?? 'Track' })),
    );
  };

  const currentTrack = tracks[trackIndex];

  const log = useGym((s) => s.sessions);

  // default to the active program once data loads
  useEffect(() => {
    if (programs.length && !programs.some((p) => p.id === activeId)) {
      setActiveId((programs.find((p) => p.isActive) ?? programs[0]).id);
    }
  }, [programs, activeId]);

  const program = programs.find((p) => p.id === activeId) ?? programs[0];
  const day = program?.days[Math.min(dayIndex, (program?.days.length ?? 1) - 1)];

  // one shared 1-second tick drives the session, cardio, and rest timers
  useEffect(() => {
    const id = setInterval(() => {
      if (sessRef.current !== null) setElapsed(Math.floor((Date.now() - sessRef.current) / 1000));
      if (cardioRef.current !== null) setCardioSec(Math.floor((Date.now() - cardioRef.current) / 1000));
      setRestLeft((r) => {
        if (!restRunning) return r;
        if (r <= 1) {
          setRestRunning(false);
          if (useSettings.getState().notifs.rest !== false) {
            fireNow({ title: 'Rest done', body: 'Back to it — next set.', kind: 'rest' });
            useNotifications.getState().add('Rest done', 'Back to it — next set.', 'rest');
          }
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [restRunning]);

  // total committed cardio across all segments (pre + post), in seconds
  const cardioTotalRef = useRef(0);

  // start/stop one cardio segment; on stop the elapsed time is banked into the total
  const beginCardioSegment = () => {
    cardioRef.current = Date.now();
    setCardioSec(0);
    setCardioRunning(true);
    setPaused(false);
  };
  const commitCardioSegment = () => {
    if (cardioRef.current !== null) {
      cardioTotalRef.current += Math.floor((Date.now() - cardioRef.current) / 1000);
    } else {
      cardioTotalRef.current += cardioSec; // was paused: ref frozen, use displayed value
    }
    cardioRef.current = null;
    setCardioSec(0);
    setCardioRunning(false);
    setPaused(false);
    setCardioTotal(cardioTotalRef.current);
  };

  const resetSession = () => {
    cardioTotalRef.current = 0;
    sessRef.current = null;
    cardioRef.current = null;
    setElapsed(0);
    setCardioSec(0);
    setCardioTotal(0);
    setCardioRunning(false);
    setPaused(false);
  };

  // pause / resume the running session or cardio timer
  const togglePause = () => {
    if (phase === 'training') {
      if (paused) {
        sessRef.current = Date.now() - elapsed * 1000;
        setPaused(false);
      } else {
        sessRef.current = null;
        setPaused(true);
      }
    } else if (cardioRunning) {
      if (paused) {
        cardioRef.current = Date.now() - cardioSec * 1000;
        setPaused(false);
      } else {
        cardioRef.current = null;
        setPaused(true);
      }
    }
  };

  // build the editable set list for the current day from its program plan
  const buildLiveSets = (d?: typeof day): Record<string, LiveSet[]> => {
    if (!d || d.isCardio) return {};
    const map: Record<string, LiveSet[]> = {};
    for (const ex of d.exercises) {
      const n = Math.max(1, Number(ex.sets) || 1);
      const reps = parseInt(ex.reps, 10) || 0;
      const weight = parseFloat(ex.weight) || 0;
      map[ex.name] = Array.from({ length: n }, () => ({ reps, weight, done: false }));
    }
    return map;
  };

  const toggleSet = (exercise: string, i: number) => {
    const wasDone = liveSets[exercise]?.[i]?.done;
    setLiveSets((m) => ({
      ...m,
      [exercise]: (m[exercise] ?? []).map((s, k) => (k === i ? { ...s, done: !s.done } : s)),
    }));
    if (!wasDone) {
      // just completed a set → kick off the rest timer
      setRestLeft(restSeconds);
      setRestRunning(true);
    }
  };
  const editSet = (exercise: string, i: number, field: 'reps' | 'weight', val: number) =>
    setLiveSets((m) => ({
      ...m,
      [exercise]: (m[exercise] ?? []).map((s, k) => (k === i ? { ...s, [field]: val } : s)),
    }));

  // ----- start options (from idle) -----
  const startWithCardio = () => {
    resetSession();
    setPhase('precardio');
    beginCardioSegment();
  };
  const startTraining = () => {
    resetSession();
    setLiveSets(buildLiveSets(day));
    sessRef.current = Date.now();
    setElapsed(0);
    setPhase('training');
  };

  // pre-cardio done → roll straight into training
  const cardioThenTrain = () => {
    commitCardioSegment();
    setLiveSets(buildLiveSets(day));
    sessRef.current = Date.now();
    setElapsed(0);
    setPaused(false);
    setPhase('training');
  };

  // Finish training → end-of-session cardio step (don't save yet)
  const finishTraining = () => {
    sessRef.current = null; // freeze the training time
    setPhase('postcardio');
  };

  const startPostCardio = () => beginCardioSegment();

  // Save the session (banks any running cardio first), then jump to the Log
  const saveSession = () => {
    commitCardioSegment();
    const totalCardio = cardioTotalRef.current;

    // gather the sets actually completed this workout
    const doneSets: { exercise: string; reps: number; weight: number }[] = [];
    for (const [exercise, sets] of Object.entries(liveSets)) {
      for (const s of sets) if (s.done) doneSets.push({ exercise, reps: s.reps, weight: s.weight });
    }
    // real volume from what was lifted; fall back to plan estimate if nothing checked
    const realVolume = doneSets.reduce((v, s) => v + s.reps * s.weight, 0);

    const entry: LoggedSession = {
      id: Date.now().toString(),
      day: day.label,
      program: program.name.split(' ').map((w) => w[0]).join(''),
      durationSec: elapsed,
      volume: realVolume || (day?.isCardio ? 0 : dayVolume(day.exercises)),
      cardio: totalCardio > 0,
      cardioMin: totalCardio > 0 ? Math.max(1, Math.ceil(totalCardio / 60)) : 0,
      date: 'Today',
      daysAgo: 0,
    };

    if (doneSets.length > 0) gym.saveWorkout(entry, doneSets);
    else gym.addSession(entry);

    resetSession();
    setLiveSets({});
    setPhase('idle');
    setView('log');
  };

  const pickProgram = (id: string) => {
    setActiveId(id);
    setDayIndex(0);
    setProgramModal(false);
    gym.setActiveProgram(id);
  };

  // program CRUD
  const openNewProgram = () => {
    setEditingProgram(null);
    setProgramModal(false);
    setEditorOpen(true);
  };
  const openEditProgram = (p: Program) => {
    setEditingProgram(p);
    setProgramModal(false);
    setEditorOpen(true);
  };
  const saveProgram = (p: Program) => {
    gym.saveProgram(p);
    setActiveId(p.id);
    setDayIndex(0);
  };
  const deleteProgram = (id: string) => {
    if (programs.length <= 1) return; // keep at least one
    const next = programs.filter((p) => p.id !== id);
    gym.deleteProgram(id);
    if (id === activeId) {
      setActiveId(next[0].id);
      setDayIndex(0);
    }
  };


  // ---- log stats ----
  const stats = useMemo(() => {
    const n = log.length;
    const avg = n ? Math.round(log.reduce((s, x) => s + x.durationSec, 0) / n / 60) : 0;
    const week = log.filter((x) => x.daysAgo <= 7).length;
    const cardioMin = log.reduce((s, x) => s + x.cardioMin, 0);
    return { n, avg, week, cardioMin };
  }, [log]);

  // this-period vs previous-period comparison (window = Settings → progress days)
  const progressDays = useSettings((s) => s.progressDays);
  const progress = useMemo(() => {
    const win = (lo: number, hi: number) => {
      const rows = log.filter((x) => x.daysAgo >= lo && x.daysAgo < hi);
      return {
        sessions: rows.length,
        minutes: Math.round(rows.reduce((s, x) => s + x.durationSec, 0) / 60),
        cardio: rows.reduce((s, x) => s + x.cardioMin, 0),
      };
    };
    return { cur: win(0, progressDays), prev: win(progressDays, progressDays * 2) };
  }, [log, progressDays]);

  const daysAgoOf = (iso: string) => Math.max(0, Math.round((new Date(TODAY).getTime() - new Date(iso).getTime()) / 86400000));

  // per-exercise: best weight lifted this period vs the period before — "+1" per exercise that went up
  const setlogs = gym.setlogs;
  const exerciseProgress = useMemo(() => {
    const names = Array.from(new Set(setlogs.map((s) => s.exercise)));
    const bestIn = (name: string, lo: number, hi: number) =>
      setlogs
        .filter((s) => s.exercise === name && daysAgoOf(s.date) >= lo && daysAgoOf(s.date) < hi)
        .reduce((m, s) => Math.max(m, s.weight), 0);
    const rows = names
      .map((name) => ({ name, cur: bestIn(name, 0, progressDays), prev: bestIn(name, progressDays, progressDays * 2) }))
      .filter((r) => r.cur > 0 || r.prev > 0)
      .sort((a, b) => a.name.localeCompare(b.name));
    const tracked = rows.filter((r) => r.cur > 0 && r.prev > 0);
    const improved = tracked.filter((r) => r.cur > r.prev).length;
    return { rows, tracked: tracked.length, improved };
  }, [setlogs, progressDays]);

  // body weight: average kg this period vs the period before
  const weightProgress = useMemo(() => {
    const win = (lo: number, hi: number) => {
      const rows = weights.filter((w) => { const a = daysAgoOf(w.date); return a >= lo && a < hi; });
      if (!rows.length) return 0;
      return Math.round((rows.reduce((s, w) => s + w.kg, 0) / rows.length) * 10) / 10;
    };
    return { cur: win(0, progressDays), prev: win(progressDays, progressDays * 2) };
  }, [weights, progressDays]);

  const [exerciseSheet, setExerciseSheet] = useState(false);

  const bars = useMemo(() => {
    const last = [...log].slice(0, 5).reverse();
    const max = Math.max(1, ...last.map((x) => x.durationSec));
    return last.map((x) => ({ min: Math.round(x.durationSec / 60), h: (x.durationSec / max) * 100, label: x.day.slice(0, 3) }));
  }, [log]);

  // programs still loading from the backend
  if (!program || !day) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas, alignItems: 'center', justifyContent: 'center' }} edges={['top']}>
        <Text style={{ color: colors.textDim, fontFamily: fonts.ui }}>Loading your programs…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 28, gap: 18 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={accent} />}
      >
        {/* header + Train/Log toggle */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingTop: 6 }}>
          <View>
            <Text style={{ fontSize: 13, color: colors.textDim, fontFamily: fonts.ui }}>{WEEKDAY} · training</Text>
            <Text style={{ fontSize: 25, color: colors.text, fontFamily: fonts.uiBold, marginTop: 2 }}>Gym</Text>
          </View>
          <Segment
            options={[{ k: 'train', label: 'Train' }, { k: 'log', label: 'Log' }]}
            value={view}
            onChange={(k) => setView(k as any)}
            accent={accent}
          />
        </View>

        {view === 'train' ? (
          <>
            {/* session timer */}
            <LinearGradient
              colors={[withAlpha(accent, 18), colors.card]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ borderRadius: 22, padding: 18, borderWidth: 1, borderColor: withAlpha(accent, 24) }}
            >
              {phase === 'idle' ? (
                // ===== idle: choose how to begin =====
                <View>
                  <Text style={{ fontSize: 11, letterSpacing: 1.4, color: colors.textMuted, fontFamily: fonts.uiSemi }}>{day?.isCardio ? 'CARDIO DAY' : 'SESSION'}</Text>
                  <Text style={{ fontFamily: fonts.monoSemi, fontSize: 34, color: '#fff', marginTop: 3, marginBottom: 14 }}>{clock(0)}</Text>
                  {day?.isCardio ? (
                    <Pressable onPress={startWithCardio} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.green, paddingVertical: 14, borderRadius: 14 }}>
                      <Icon name="flame" size={16} color="#fff" />
                      <Text style={{ color: '#fff', fontFamily: fonts.uiBold, fontSize: 15 }}>Start cardio</Text>
                    </Pressable>
                  ) : (
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      <Pressable onPress={startTraining} style={{ flex: 1.4, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: accent, paddingVertical: 14, borderRadius: 14 }}>
                        <Icon name="play" size={13} color="#fff" />
                        <Text style={{ color: '#fff', fontFamily: fonts.uiBold, fontSize: 15 }}>Start training</Text>
                      </Pressable>
                      <Pressable onPress={startWithCardio} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: withAlpha(colors.green, 18), borderWidth: 1, borderColor: colors.green, paddingVertical: 14, borderRadius: 14 }}>
                        <Icon name="flame" size={15} color={colors.green} />
                        <Text style={{ color: colors.green, fontFamily: fonts.uiBold, fontSize: 14 }}>Cardio</Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              ) : phase === 'precardio' ? (
                // ===== cardio (warm-up, or the whole cardio day) =====
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View>
                    <Text style={{ fontSize: 11, letterSpacing: 1.4, color: colors.green, fontFamily: fonts.uiSemi }}>{day?.isCardio ? 'CARDIO' : 'CARDIO · WARM-UP'}{paused ? ' · PAUSED' : ''}</Text>
                    <Text style={{ fontFamily: fonts.monoSemi, fontSize: 34, color: '#fff', marginTop: 3 }}>{clock(cardioSec)}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <PauseBtn paused={paused} onPress={togglePause} />
                    {day?.isCardio ? (
                      <Pressable onPress={saveSession} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.green, paddingHorizontal: 18, paddingVertical: 14, borderRadius: 14 }}>
                        <View style={{ width: 12, height: 12, borderRadius: 2, backgroundColor: '#fff' }} />
                        <Text style={{ color: '#fff', fontFamily: fonts.uiBold, fontSize: 14 }}>Finish</Text>
                      </Pressable>
                    ) : (
                      <Pressable onPress={cardioThenTrain} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: accent, paddingHorizontal: 16, paddingVertical: 14, borderRadius: 14 }}>
                        <Icon name="play" size={13} color="#fff" />
                        <Text style={{ color: '#fff', fontFamily: fonts.uiBold, fontSize: 14 }}>To training</Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              ) : phase === 'training' ? (
                // ===== training =====
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View>
                    <Text style={{ fontSize: 11, letterSpacing: 1.4, color: colors.textMuted, fontFamily: fonts.uiSemi }}>
                      SESSION{paused ? ' · PAUSED' : ''}{cardioTotal > 0 ? ` · ${Math.ceil(cardioTotal / 60)}m cardio` : ''}
                    </Text>
                    <Text style={{ fontFamily: fonts.monoSemi, fontSize: 34, color: '#fff', marginTop: 3 }}>{clock(elapsed)}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <PauseBtn paused={paused} onPress={togglePause} />
                    <Pressable onPress={finishTraining} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.red, paddingHorizontal: 18, paddingVertical: 14, borderRadius: 14 }}>
                      <View style={{ width: 12, height: 12, borderRadius: 2, backgroundColor: '#fff' }} />
                      <Text style={{ color: '#fff', fontFamily: fonts.uiBold, fontSize: 15 }}>Finish</Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                // ===== postcardio: end-of-session cardio step =====
                cardioRunning ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View>
                      <Text style={{ fontSize: 11, letterSpacing: 1.4, color: colors.green, fontFamily: fonts.uiSemi }}>CARDIO{paused ? ' · PAUSED' : ''}</Text>
                      <Text style={{ fontFamily: fonts.monoSemi, fontSize: 34, color: '#fff', marginTop: 3 }}>{clock(cardioSec)}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <PauseBtn paused={paused} onPress={togglePause} />
                      <Pressable onPress={saveSession} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.green, paddingHorizontal: 18, paddingVertical: 14, borderRadius: 14 }}>
                        <View style={{ width: 12, height: 12, borderRadius: 2, backgroundColor: '#fff' }} />
                        <Text style={{ color: '#fff', fontFamily: fonts.uiBold, fontSize: 15 }}>Finish</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <View>
                    <Text style={{ fontSize: 11, letterSpacing: 1.4, color: colors.textMuted, fontFamily: fonts.uiSemi }}>SESSION DONE · {clock(elapsed)}</Text>
                    <Text style={{ fontSize: 17, color: '#fff', fontFamily: fonts.uiSemi, marginTop: 6, marginBottom: 14 }}>
                      {cardioTotal > 0 ? 'Add more cardio?' : 'Did you do cardio?'}
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      <Pressable onPress={startPostCardio} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.green, paddingVertical: 14, borderRadius: 14 }}>
                        <Icon name="flame" size={16} color="#fff" />
                        <Text style={{ color: '#fff', fontFamily: fonts.uiBold, fontSize: 15 }}>{cardioTotal > 0 ? 'More cardio' : 'Start cardio'}</Text>
                      </Pressable>
                      <Pressable onPress={saveSession} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 14, borderWidth: 1, borderColor: colors.borderSoft }}>
                        <Text style={{ color: colors.textSoft, fontFamily: fonts.uiSemi, fontSize: 15 }}>{cardioTotal > 0 ? 'Save' : 'Skip & save'}</Text>
                      </Pressable>
                    </View>
                  </View>
                )
              )}
            </LinearGradient>

            {/* program selector */}
            <Pressable onPress={() => setProgramModal(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 13, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 18, padding: 15 }}>
              <View style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: withAlpha(accent, 14), alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="notes" size={20} color={accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, color: colors.textDim, fontFamily: fonts.ui }}>Program</Text>
                <Text style={{ fontSize: 16, color: colors.textMid, fontFamily: fonts.uiBold, marginTop: 1 }}>{program.name}</Text>
              </View>
              <Icon name="chevron" size={18} color={colors.textFaint} />
            </Pressable>

            {/* day tabs */}
            <View style={{ flexDirection: 'row', gap: 4, backgroundColor: '#131319', borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 4 }}>
              {program.days.map((d, i) => {
                const on = i === dayIndex;
                return (
                  <Pressable key={d.label} onPress={() => setDayIndex(i)} style={{ flex: 1, paddingVertical: 11, borderRadius: 10, alignItems: 'center', backgroundColor: on ? accent : 'transparent' }}>
                    <Text style={{ color: on ? '#fff' : colors.textMuted, fontFamily: fonts.uiSemi, fontSize: 13.5 }}>{d.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            {day?.isCardio ? (
              <View style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 18, padding: 18, alignItems: 'center', gap: 8 }}>
                <Icon name="flame" size={26} color={colors.green} />
                <Text style={{ color: colors.text, fontFamily: fonts.uiSemi, fontSize: 15 }}>Cardio day</Text>
                <Text style={{ color: colors.textFaint, fontFamily: fonts.ui, fontSize: 12.5, textAlign: 'center' }}>
                  No lifts today — hit Start cardio above, then Finish to log the minutes.
                </Text>
              </View>
            ) : (
            <>
            {/* rest timer */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 22, padding: 20 }}>
              <View style={{ width: 118, height: 118 }}>
                <Ring size={118} stroke={8} progress={restLeft / restSeconds} color={accent} track="rgba(255,255,255,0.07)" />
                <View style={{ position: 'absolute', top: 0, left: 0, width: 118, height: 118, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontFamily: fonts.monoSemi, fontSize: 29, color: '#fff' }}>{restFmt(restLeft)}</Text>
                  <Text style={{ fontSize: 10, color: colors.textDim, letterSpacing: 1.2, marginTop: 1 }}>REST</Text>
                </View>
              </View>
              <View style={{ flex: 1, gap: 9 }}>
                <Pressable onPress={() => setRestRunning((r) => !r)} style={{ paddingVertical: 13, borderRadius: 13, backgroundColor: accent, alignItems: 'center' }}>
                  <Text style={{ color: '#fff', fontFamily: fonts.uiBold, fontSize: 15 }}>{restRunning ? 'Pause' : 'Start'}</Text>
                </Pressable>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Pressable onPress={() => setRestLeft((r) => r + 15)} style={{ flex: 1, paddingVertical: 11, borderRadius: 12, borderWidth: 1, borderColor: colors.borderSoft, alignItems: 'center' }}>
                    <Text style={{ color: colors.textSoft, fontFamily: fonts.monoSemi, fontSize: 13 }}>+15s</Text>
                  </Pressable>
                  <Pressable onPress={() => { setRestLeft(restSeconds); setRestRunning(false); }} style={{ flex: 1, paddingVertical: 11, borderRadius: 12, borderWidth: 1, borderColor: colors.borderSoft, alignItems: 'center' }}>
                    <Text style={{ color: colors.textSoft, fontFamily: fonts.uiSemi, fontSize: 13 }}>Reset</Text>
                  </Pressable>
                </View>
              </View>
            </View>

            {/* exercises */}
            <View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <Text style={{ fontSize: 17, color: colors.text, fontFamily: fonts.uiSemi }}>Exercises</Text>
                <Text style={{ fontSize: 13, color: colors.textDim, fontFamily: fonts.mono }}>{day.exercises.length} total</Text>
              </View>
              <View style={{ gap: 10 }}>
                {day.exercises.map((ex, i) => (
                  <View key={i} style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 17, padding: 14 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 11 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
                        <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: withAlpha(accent, 14), alignItems: 'center', justifyContent: 'center' }}>
                          <Text style={{ color: accent, fontFamily: fonts.monoSemi, fontSize: 13 }}>{i + 1}</Text>
                        </View>
                        <View>
                          <Text style={{ fontSize: 15, color: colors.textMid, fontFamily: fonts.uiSemi }}>{ex.name}</Text>
                          <Text style={{ fontSize: 12, color: colors.textFaint, fontFamily: fonts.ui, marginTop: 1 }}>{ex.sub}</Text>
                        </View>
                      </View>
                      {gym.bestWeight(ex.name) > 0 && (
                        <Text style={{ fontSize: 10, color: colors.amber, backgroundColor: withAlpha(colors.amber, 16), paddingHorizontal: 8, paddingVertical: 4, borderRadius: 7, fontFamily: fonts.uiBold, overflow: 'hidden' }}>
                          ★ {gym.bestWeight(ex.name)}kg
                        </Text>
                      )}
                    </View>

                    {/* last-time reference */}
                    {(() => {
                      const last = gym.lastSets(ex.name);
                      if (last.length === 0) return null;
                      const top = last.reduce((a, b) => (b.weight > a.weight ? b : a), last[0]);
                      return (
                        <Text style={{ fontSize: 11.5, color: colors.textFaint, fontFamily: fonts.ui, marginBottom: 10 }}>
                          Last time: {top.weight}kg × {top.reps} · {last.length} set{last.length > 1 ? 's' : ''}
                        </Text>
                      );
                    })()}

                    {phase === 'training' && liveSets[ex.name] ? (
                      <SetTracker sets={liveSets[ex.name]} accent={accent} onToggle={(si) => toggleSet(ex.name, si)} onEdit={(si, f, v) => editSet(ex.name, si, f, v)} />
                    ) : (
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <Stat label="Sets" value={String(ex.sets)} />
                        <Stat label="Reps" value={ex.reps} />
                        <Stat label="Weight" value={ex.weight} color={accent} flex={1.3} />
                      </View>
                    )}
                  </View>
                ))}
              </View>
            </View>
            </>
            )}

            {/* playlist — real local-file player */}
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 11 }}>
                <Text style={{ fontSize: 12, color: colors.textFainter, fontFamily: fonts.uiSemi, letterSpacing: 0.8, textTransform: 'uppercase' }}>Playlist</Text>
                <Pressable onPress={() => setImportModal(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <Icon name="plus" size={13} color={accent} />
                  <Text style={{ color: accent, fontFamily: fonts.uiSemi, fontSize: 12.5 }}>{tracks.length ? 'Manage' : 'Import'}</Text>
                </Pressable>
              </View>

              {tracks.length === 0 ? (
                <Pressable onPress={pickAudio} style={{ borderWidth: 1, borderColor: withAlpha(accent, 40), borderStyle: 'dashed', borderRadius: 20, padding: 22, alignItems: 'center', gap: 6 }}>
                  <Icon name="play" size={22} color={accent} />
                  <Text style={{ color: colors.textSoft, fontFamily: fonts.uiSemi, fontSize: 14 }}>Import music from your device</Text>
                  <Text style={{ color: colors.textFaint, fontFamily: fonts.ui, fontSize: 12 }}>Pick audio files from Downloads/Files</Text>
                </Pressable>
              ) : (
                <LinearGradient colors={['#1b1726', '#141119']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 20, padding: 14, borderWidth: 1, borderColor: colors.borderSoft }}>
                  <LinearGradient colors={[accent, '#3a2a7e']} style={{ width: 54, height: 54, borderRadius: 13, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="play" size={20} color="#fff" />
                  </LinearGradient>
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={{ fontSize: 14.5, color: colors.textMid, fontFamily: fonts.uiSemi }}>{currentTrack?.name ?? 'Tap play'}</Text>
                    <Text style={{ fontSize: 12, color: colors.textDim, fontFamily: fonts.ui, marginTop: 2 }}>{tracks.length} track{tracks.length > 1 ? 's' : ''}</Text>
                  </View>
                  <Pressable onPress={playerApi.prev} hitSlop={8} style={{ padding: 4 }}>
                    <Icon name="chevron" size={16} color={colors.textMuted} />
                  </Pressable>
                  <Pressable onPress={playerApi.toggle} style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name={playing ? 'pause' : 'play'} size={16} color="#13131a" />
                  </Pressable>
                  <View style={{ transform: [{ rotate: '180deg' }] }}>
                    <Pressable onPress={playerApi.next} hitSlop={8} style={{ padding: 4 }}>
                      <Icon name="chevron" size={16} color={colors.textMuted} />
                    </Pressable>
                  </View>
                </LinearGradient>
              )}
            </View>
          </>
        ) : (
          <>
            {/* stat cards */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              <StatCard val={String(stats.n)} label="Total sessions" sub="all time" />
              <StatCard val={`${stats.avg}m`} label="Avg length" sub="per session" />
              <StatCard val={String(stats.week)} label="This week" sub="sessions" />
              <StatCard val={`${stats.cardioMin}m`} label="Cardio" sub="total minutes" />
            </View>

            {/* progress vs previous period */}
            <View style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 20, padding: 18 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <Text style={{ fontSize: 17, color: colors.text, fontFamily: fonts.uiSemi }}>Progress</Text>
                <Text style={{ fontSize: 11.5, color: colors.textFaint, fontFamily: fonts.uiSemi }}>last {progressDays}d vs prior {progressDays}d</Text>
              </View>
              <Text style={{ fontSize: 11.5, color: colors.textFainter, fontFamily: fonts.ui, marginBottom: 14 }}>
                Are you training more than the period before?
              </Text>
              <View style={{ gap: 10 }}>
                <ProgressStat label="Sessions" cur={progress.cur.sessions} prev={progress.prev.sessions} />
                <ProgressStat label="Time" cur={progress.cur.minutes} prev={progress.prev.minutes} unit="m" />
                <ProgressStat label="Cardio" cur={progress.cur.cardio} prev={progress.prev.cardio} unit="m" />
                {(weightProgress.cur > 0 || weightProgress.prev > 0) && (
                  <ProgressStat label="Body weight" cur={weightProgress.cur} prev={weightProgress.prev} unit="kg" />
                )}
              </View>

              {exerciseProgress.tracked > 0 && (
                <Pressable
                  onPress={() => setExerciseSheet(true)}
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.borderSoft }}
                >
                  <View>
                    <Text style={{ fontSize: 14, color: colors.textSoft, fontFamily: fonts.uiSemi }}>Exercises improved</Text>
                    <Text style={{ fontSize: 11.5, color: colors.textFaint, fontFamily: fonts.ui, marginTop: 2 }}>tap for the breakdown</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={{ color: colors.green, fontFamily: fonts.monoSemi, fontSize: 17 }}>
                      {exerciseProgress.improved}<Text style={{ color: colors.textFainter, fontSize: 13 }}> / {exerciseProgress.tracked}</Text>
                    </Text>
                    <Icon name="chevron" size={16} color={colors.textFaint} />
                  </View>
                </Pressable>
              )}
            </View>

            {/* duration chart */}
            <View style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 20, padding: 18 }}>
              <Text style={{ fontSize: 12, color: colors.textFainter, fontFamily: fonts.uiSemi, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 16 }}>Session length</Text>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8, height: 108 }}>
                {bars.map((b, i) => (
                  <View key={i} style={{ flex: 1, alignItems: 'center', gap: 7, height: '100%', justifyContent: 'flex-end' }}>
                    <Text style={{ fontFamily: fonts.mono, fontSize: 10, color: colors.textDim }}>{b.min}m</Text>
                    <View style={{ width: '100%', maxWidth: 30, borderTopLeftRadius: 7, borderTopRightRadius: 7, borderBottomLeftRadius: 3, borderBottomRightRadius: 3, backgroundColor: accent, height: `${b.h}%` }} />
                    <Text style={{ fontSize: 10, color: colors.textFainter, fontFamily: fonts.uiSemi }}>{b.label}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* body weight */}
            <View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <Text style={{ fontSize: 17, color: colors.text, fontFamily: fonts.uiSemi }}>Body weight</Text>
                <Pressable onPress={() => setWeightSheet(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: accent, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 }}>
                  <Icon name="plus" size={14} color="#fff" />
                  <Text style={{ color: '#fff', fontFamily: fonts.uiSemi, fontSize: 12.5 }}>Log</Text>
                </Pressable>
              </View>

              {weights.length === 0 ? (
                <Text style={{ color: colors.textFainter, fontFamily: fonts.ui, textAlign: 'center', paddingVertical: 16 }}>
                  Log your weight every day or two to track the trend.
                </Text>
              ) : (
                <View style={{ gap: 8 }}>
                  {/* latest big number */}
                  <View style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
                    <Text style={{ fontFamily: fonts.monoSemi, fontSize: 30, color: colors.text }}>{weights[0].kg}</Text>
                    <Text style={{ fontFamily: fonts.uiSemi, fontSize: 14, color: colors.textMuted, marginBottom: 5 }}>kg</Text>
                    <Text style={{ flex: 1, textAlign: 'right', fontFamily: fonts.ui, fontSize: 12, color: colors.textDim, marginBottom: 5 }}>latest · {fmtDay(weights[0].date)}</Text>
                  </View>
                  {/* measurement list with deltas */}
                  {weights.map((w, i) => {
                    const prev = weights[i + 1];
                    const delta = prev ? Math.round((w.kg - prev.kg) * 10) / 10 : 0;
                    return (
                      <Pressable
                        key={w.id}
                        onLongPress={() =>
                          Alert.alert('Delete entry?', `${w.kg} kg · ${fmtDay(w.date)}`, [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'Delete', style: 'destructive', onPress: () => weightApi.remove(w.id) },
                          ])
                        }
                        style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 13, paddingHorizontal: 14, paddingVertical: 11 }}
                      >
                        <Text style={{ flex: 1, fontFamily: fonts.ui, fontSize: 13, color: colors.textMuted }}>{fmtDay(w.date)}</Text>
                        <Text style={{ fontFamily: fonts.monoSemi, fontSize: 15, color: colors.textMid }}>{w.kg} kg</Text>
                        {prev && (
                          <Text style={{ width: 56, textAlign: 'right', fontFamily: fonts.mono, fontSize: 12, color: delta > 0 ? colors.red : delta < 0 ? colors.green : colors.textFaint }}>
                            {delta > 0 ? `+${delta}` : delta < 0 ? `${delta}` : '—'}
                          </Text>
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>

            {/* history */}
            <View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <Text style={{ fontSize: 17, color: colors.text, fontFamily: fonts.uiSemi }}>History</Text>
                <Text style={{ fontSize: 13, color: colors.textDim, fontFamily: fonts.mono }}>{log.length} logged</Text>
              </View>
              <Text style={{ fontSize: 11.5, color: colors.textFainter, fontFamily: fonts.ui, marginBottom: 10, marginTop: -4 }}>
                Long-press a session to delete it.
              </Text>
              <View style={{ gap: 9 }}>
                {log.map((lg) => (
                  <Pressable
                    key={lg.id}
                    onLongPress={() =>
                      Alert.alert('Delete session?', `${lg.day} · ${lg.date}`, [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Delete', style: 'destructive', onPress: () => gym.deleteSession(lg.id) },
                      ])
                    }
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 13, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 14 }}
                  >
                    <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: withAlpha(accent, 13), alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name="gym" size={19} color={accent} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={{ fontSize: 15, color: colors.textMid, fontFamily: fonts.uiSemi }}>{lg.day}</Text>
                        <Text style={{ fontSize: 11, color: colors.textFaint, fontFamily: fonts.ui }}>{lg.program}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', gap: 12, marginTop: 4, flexWrap: 'wrap' }}>
                        <Text style={{ fontSize: 12, color: colors.textMuted, fontFamily: fonts.ui }}>{Math.round(lg.durationSec / 60)} min</Text>
                        <Text style={{ fontSize: 12, color: lg.cardio ? colors.green : colors.textFaint, fontFamily: fonts.ui }}>
                          {lg.cardio ? `♥ ${lg.cardioMin} min cardio` : 'no cardio'}
                        </Text>
                      </View>
                    </View>
                    <Text style={{ fontSize: 11.5, color: colors.textFainter, fontFamily: fonts.mono }}>{lg.date}</Text>
                  </Pressable>
                ))}
                {log.length === 0 && (
                  <Text style={{ color: colors.textFainter, fontFamily: fonts.ui, textAlign: 'center', paddingVertical: 24 }}>
                    No sessions yet. Finish a workout to log one.
                  </Text>
                )}
              </View>
            </View>
          </>
        )}
      </ScrollView>

      {/* PROGRAM PICKER */}
      <Sheet visible={programModal} onClose={() => setProgramModal(false)} title="Your programs" subtitle="Select, edit, or build your own">
        <View style={{ gap: 10 }}>
          {programs.map((p) => {
            const on = p.id === activeId;
            return (
              <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: on ? withAlpha(accent, 12) : colors.card, borderWidth: 1.5, borderColor: on ? accent : colors.border, borderRadius: 16, padding: 15 }}>
                <Pressable onPress={() => pickProgram(p.id)} style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15.5, color: colors.textMid, fontFamily: fonts.uiSemi }}>{p.name}</Text>
                  <Text style={{ fontSize: 12, color: colors.textDim, fontFamily: fonts.ui, marginTop: 2 }}>{p.meta}</Text>
                </Pressable>
                {on && (
                  <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: accent, alignItems: 'center', justifyContent: 'center' }}>
                    <Svg width={12} height={12} viewBox="0 0 13 13"><Path d="M2.5 6.5 5.5 9.5 10.5 3.5" fill="none" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" /></Svg>
                  </View>
                )}
                <Pressable onPress={() => openEditProgram(p)} hitSlop={6} style={{ paddingHorizontal: 4 }}>
                  <Text style={{ color: colors.textMuted, fontFamily: fonts.uiSemi, fontSize: 12.5 }}>Edit</Text>
                </Pressable>
                {programs.length > 1 && (
                  <Pressable onPress={() => deleteProgram(p.id)} hitSlop={6}>
                    <Text style={{ color: colors.red, fontFamily: fonts.uiSemi, fontSize: 12.5 }}>Delete</Text>
                  </Pressable>
                )}
              </View>
            );
          })}

          <Pressable onPress={openNewProgram} style={{ paddingVertical: 14, borderRadius: 14, borderWidth: 1.5, borderColor: withAlpha(accent, 40), borderStyle: 'dashed', alignItems: 'center', marginTop: 2 }}>
            <Text style={{ color: accent, fontFamily: fonts.uiBold, fontSize: 14 }}>+ New program</Text>
          </Pressable>
        </View>
      </Sheet>

      <ProgramEditor
        visible={editorOpen}
        initial={editingProgram}
        onClose={() => setEditorOpen(false)}
        onSave={saveProgram}
      />

      <WeightSheet
        visible={weightSheet}
        suggested={weights[0]?.kg}
        onClose={() => setWeightSheet(false)}
        onSave={(kg) => weightApi.add(TODAY, kg)}
      />

      <Sheet
        visible={exerciseSheet}
        onClose={() => setExerciseSheet(false)}
        title="Exercises improved"
        subtitle={`Best weight this ${progressDays}d vs the ${progressDays}d before`}
      >
        <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
          <View style={{ gap: 8 }}>
            {exerciseProgress.rows.map((r) => {
              const better = r.prev > 0 && r.cur > r.prev;
              const worse = r.prev > 0 && r.cur > 0 && r.cur < r.prev;
              const isNew = r.prev === 0 && r.cur > 0;
              const col = better ? colors.green : worse ? colors.red : colors.textFaint;
              const arrow = better ? '▲' : worse ? '▼' : '—';
              return (
                <View key={r.name} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 13, paddingHorizontal: 14, paddingVertical: 12 }}>
                  <Text style={{ flex: 1, color: colors.textMid, fontFamily: fonts.uiSemi, fontSize: 13.5 }}>{r.name}</Text>
                  <Text style={{ color: colors.text, fontFamily: fonts.monoSemi, fontSize: 14 }}>
                    {r.cur > 0 ? `${r.cur}kg` : '—'} <Text style={{ color: colors.textFainter, fontSize: 11.5 }}>/ {r.prev > 0 ? `${r.prev}kg` : '—'}</Text>
                  </Text>
                  <Text style={{ color: col, fontFamily: fonts.uiBold, fontSize: 12, marginLeft: 10, width: 36, textAlign: 'right' }}>
                    {isNew ? 'new' : arrow}
                  </Text>
                </View>
              );
            })}
          </View>
        </ScrollView>
      </Sheet>

      {/* PLAYLIST MANAGER — import + list local audio files */}
      <Sheet visible={importModal} onClose={() => setImportModal(false)} title="Your playlist" subtitle="Music stored on your device">
        <Pressable onPress={pickAudio} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: accent, borderRadius: 14, paddingVertical: 14, marginBottom: 14 }}>
          <Icon name="plus" size={16} color="#fff" />
          <Text style={{ color: '#fff', fontFamily: fonts.uiBold, fontSize: 14 }}>Add audio from device</Text>
        </Pressable>

        {tracks.length === 0 ? (
          <Text style={{ color: colors.textFaint, fontFamily: fonts.ui, textAlign: 'center', paddingVertical: 16 }}>No tracks yet. Add some MP3/audio files.</Text>
        ) : (
          <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
            <View style={{ gap: 8 }}>
              {tracks.map((t, i) => {
                const on = i === trackIndex;
                return (
                  <View key={t.uri} style={{ flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: on ? withAlpha(accent, 12) : colors.card, borderWidth: 1, borderColor: on ? accent : colors.border, borderRadius: 13, padding: 11 }}>
                    <Pressable onPress={() => playerApi.playIndex(i)} style={{ width: 34, height: 34, borderRadius: 9, backgroundColor: withAlpha(accent, 16), alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name={on && playing ? 'pause' : 'play'} size={15} color={accent} />
                    </Pressable>
                    <Text numberOfLines={1} style={{ flex: 1, color: colors.textMid, fontFamily: fonts.uiSemi, fontSize: 13.5 }}>{t.name}</Text>
                    <Pressable onPress={() => playerApi.removeTrack(t.uri)} hitSlop={6} style={{ width: 26, height: 26, borderRadius: 8, backgroundColor: 'rgba(239,68,68,0.14)', alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ color: colors.red, fontSize: 16, lineHeight: 18 }}>×</Text>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          </ScrollView>
        )}
      </Sheet>
    </SafeAreaView>
  );
}

function SetTracker({
  sets,
  accent,
  onToggle,
  onEdit,
}: {
  sets: LiveSet[];
  accent: string;
  onToggle: (i: number) => void;
  onEdit: (i: number, field: 'reps' | 'weight', val: number) => void;
}) {
  return (
    <View style={{ gap: 7 }}>
      <View style={{ flexDirection: 'row', paddingHorizontal: 4 }}>
        <Text style={{ width: 30, fontSize: 10, color: colors.textFainter, fontFamily: fonts.uiSemi }}>SET</Text>
        <Text style={{ flex: 1, fontSize: 10, color: colors.textFainter, fontFamily: fonts.uiSemi, textAlign: 'center' }}>KG</Text>
        <Text style={{ flex: 1, fontSize: 10, color: colors.textFainter, fontFamily: fonts.uiSemi, textAlign: 'center' }}>REPS</Text>
        <View style={{ width: 38 }} />
      </View>
      {sets.map((s, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: s.done ? withAlpha(accent, 14) : colors.inset, borderRadius: 11, paddingVertical: 6, paddingHorizontal: 4 }}>
          <Text style={{ width: 30, textAlign: 'center', color: colors.textMuted, fontFamily: fonts.monoSemi, fontSize: 13 }}>{i + 1}</Text>
          <TextInput
            defaultValue={String(s.weight)}
            onChangeText={(v) => onEdit(i, 'weight', parseFloat(v) || 0)}
            keyboardType="decimal-pad"
            style={{ flex: 1, textAlign: 'center', color: colors.text, fontFamily: fonts.monoSemi, fontSize: 15, paddingVertical: 4 }}
          />
          <TextInput
            defaultValue={String(s.reps)}
            onChangeText={(v) => onEdit(i, 'reps', parseInt(v, 10) || 0)}
            keyboardType="number-pad"
            style={{ flex: 1, textAlign: 'center', color: colors.text, fontFamily: fonts.monoSemi, fontSize: 15, paddingVertical: 4 }}
          />
          <Pressable onPress={() => onToggle(i)} style={{ width: 38, alignItems: 'center' }}>
            <View style={{ width: 26, height: 26, borderRadius: 8, borderWidth: 2, borderColor: s.done ? accent : '#3a3a45', backgroundColor: s.done ? accent : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
              {s.done && (
                <Svg width={14} height={14} viewBox="0 0 13 13">
                  <Path d="M2.5 6.5 5.5 9.5 10.5 3.5" fill="none" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              )}
            </View>
          </Pressable>
        </View>
      ))}
    </View>
  );
}

function PauseBtn({ paused, onPress }: { paused: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{ width: 48, height: 48, borderRadius: 14, borderWidth: 1, borderColor: colors.borderSoft, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center' }}
    >
      <Icon name={paused ? 'play' : 'pause'} size={16} color="#fff" />
    </Pressable>
  );
}

function Segment({ options, value, onChange, accent }: { options: { k: string; label: string }[]; value: string; onChange: (k: string) => void; accent: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 3, backgroundColor: '#131319', borderWidth: 1, borderColor: colors.border, borderRadius: 11, padding: 3 }}>
      {options.map((o) => {
        const on = value === o.k;
        return (
          <Pressable key={o.k} onPress={() => onChange(o.k)} style={{ paddingHorizontal: 15, paddingVertical: 8, borderRadius: 8, backgroundColor: on ? accent : 'transparent' }}>
            <Text style={{ color: on ? '#fff' : colors.textMuted, fontFamily: fonts.uiSemi, fontSize: 13 }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Stat({ label, value, color, flex = 1 }: { label: string; value: string; color?: string; flex?: number }) {
  return (
    <View style={{ flex, backgroundColor: colors.inset, borderRadius: 10, paddingVertical: 9, alignItems: 'center' }}>
      <Text style={{ fontFamily: fonts.monoSemi, fontSize: 16, color: color ?? '#e9e9ef' }}>{value}</Text>
      <Text style={{ fontSize: 10, color: colors.textFainter, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 }}>{label}</Text>
    </View>
  );
}

function StatCard({ val, label, sub }: { val: string; label: string; sub: string }) {
  return (
    <View style={{ width: '47%', flexGrow: 1, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 18, padding: 16 }}>
      <Text style={{ fontFamily: fonts.monoSemi, fontSize: 27, color: colors.textMid }}>{val}</Text>
      <Text style={{ fontSize: 13.5, color: colors.textSoft, fontFamily: fonts.uiSemi, marginTop: 8 }}>{label}</Text>
      <Text style={{ fontSize: 11.5, color: colors.textFaint, fontFamily: fonts.ui, marginTop: 1 }}>{sub}</Text>
    </View>
  );
}

function Sheet({ visible, onClose, title, subtitle, children }: { visible: boolean; onClose: () => void; title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <SwipeSheet visible={visible} onClose={onClose}>
      <Text style={{ fontSize: 19, color: colors.text, fontFamily: fonts.uiBold }}>{title}</Text>
      <Text style={{ fontSize: 13, color: colors.textDim, fontFamily: fonts.ui, marginTop: 4, marginBottom: 18 }}>{subtitle}</Text>
      {children}
    </SwipeSheet>
  );
}
