import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';

import { confirm, toast } from '../../components/Dialog';
import { Icon } from '../../components/Icon';
import { ProgramEditor } from '../../components/ProgramEditor';
import { GymLog } from '../../components/GymLog';
import { Ring } from '../../components/Ring';
import { SwipeSheet } from '../../components/SwipeSheet';
import { useRefresh } from '../../hooks/useRefresh';
import { clearRestAlerts, startRestAlerts } from '../../services/notifications';
import { LiveSet, useGym } from '../../store/gym';
import { useNotifications } from '../../store/notifications';
import { useSettings } from '../../store/settings';
import { loadLive, saveLive } from '../../lib/liveSession';
import { useToday } from '../../store/today';
import { useWeight } from '../../store/weight';
import { useAccent, withAlpha } from '../../theme/AccentContext';
import { colors, fonts } from '../../theme/colors';
import { Exercise, LoggedSession, Program } from '../../theme/programs';

const pad = (n: number) => String(n).padStart(2, '0');
const clock = (s: number) => `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
const restFmt = (s: number) => `${Math.floor(s / 60)}:${pad(s % 60)}`;

export default function Gym() {
  const { accent } = useAccent();
  const TODAY = useToday();
  const WEEKDAY = new Date(TODAY + 'T12:00').toLocaleDateString(undefined, { weekday: 'long' });

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
  const [liveSets, setLiveSets] = useState<Record<number, LiveSet[]>>({}); // sets being done now, keyed by exercise index
  const [liveExercises, setLiveExercises] = useState<Exercise[]>([]); // editable copy of the day's plan for this session (name/weight edits)

  // rest timer (counts down) — length comes from Settings
  const restSeconds = useSettings((s) => s.restSeconds);
  const [restLeft, setRestLeft] = useState(restSeconds);
  const [restRunning, setRestRunning] = useState(false);

  // keep the idle rest timer in sync with the Settings value
  useEffect(() => {
    if (!restRunning) setRestLeft(restSeconds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restSeconds]);

  // The rest timer counts down to a fixed end time (not tick by tick), so it is
  // still right after the app was in the background. OS notifications show it
  // outside the app: "Resting · next set at …", replaced by "Rest done" on time.
  const restEnd = useRef<number | null>(null); // ms timestamp while running
  const restNotifsOn = () => useSettings.getState().notifs.rest !== false;
  const startRest = (seconds: number) => {
    restEnd.current = Date.now() + seconds * 1000;
    setRestLeft(seconds);
    setRestRunning(true);
    if (restNotifsOn()) startRestAlerts(new Date(restEnd.current)).catch(() => {});
  };
  const stopRest = (resetTo?: number) => {
    restEnd.current = null;
    setRestRunning(false);
    if (resetTo !== undefined) setRestLeft(resetTo);
    clearRestAlerts().catch(() => {});
  };

  const [programModal, setProgramModal] = useState(false);

  const { refreshing, onRefresh } = useRefresh([useGym.getState().load, useWeight.getState().load]);

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
      if (restEnd.current !== null) {
        const left = Math.max(0, Math.ceil((restEnd.current - Date.now()) / 1000));
        setRestLeft(left);
        if (left === 0) {
          // the OS "Rest done" alert fires by itself; just log it to the inbox
          restEnd.current = null;
          setRestRunning(false);
          if (restNotifsOn()) useNotifications.getState().add('Rest done', 'Back to it — next set.', 'rest').catch(() => {});
        }
      }
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
    stopRest(restSeconds);
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

  // build the editable set list for the current day from its program plan, keyed by
  // exercise index (not name) so renaming an exercise mid-session doesn't lose its sets
  const buildLiveSets = (d?: typeof day): Record<number, LiveSet[]> => {
    if (!d || d.isCardio) return {};
    const map: Record<number, LiveSet[]> = {};
    d.exercises.forEach((ex, i) => {
      const n = Math.max(1, Number(ex.sets) || 1);
      const reps = parseInt(ex.reps, 10) || 0;
      const weight = parseFloat(ex.weight) || 0;
      map[i] = Array.from({ length: n }, () => ({ reps, weight, done: false }));
    });
    return map;
  };

  const toggleSet = (exIndex: number, i: number) => {
    const wasDone = liveSets[exIndex]?.[i]?.done;
    setLiveSets((m) => ({
      ...m,
      [exIndex]: (m[exIndex] ?? []).map((s, k) => (k === i ? { ...s, done: !s.done } : s)),
    }));
    if (!wasDone) {
      // just completed a set → kick off the rest timer
      startRest(restSeconds);
    }
  };
  const editSet = (exIndex: number, i: number, field: 'reps' | 'weight', val: number) =>
    setLiveSets((m) => ({
      ...m,
      [exIndex]: (m[exIndex] ?? []).map((s, k) => (k === i ? { ...s, [field]: val } : s)),
    }));

  // extra set (copies the last one) / remove a set, mid-session
  const addSet = (exIndex: number) =>
    setLiveSets((m) => {
      const rows = m[exIndex] ?? [];
      const last = rows[rows.length - 1] ?? { reps: 0, weight: 0, done: false };
      return { ...m, [exIndex]: [...rows, { reps: last.reps, weight: last.weight, done: false }] };
    });
  const removeSet = (exIndex: number, i: number) =>
    setLiveSets((m) => ({ ...m, [exIndex]: (m[exIndex] ?? []).filter((_, k) => k !== i) }));

  // rename an exercise live, mid-session — purely local until the session is saved
  const renameExercise = (exIndex: number, name: string) =>
    setLiveExercises((arr) => arr.map((e, k) => (k === exIndex ? { ...e, name } : e)));

  // ----- start options (from idle) -----
  const startWithCardio = () => {
    resetSession();
    setPhase('precardio');
    beginCardioSegment();
  };
  const startTraining = () => {
    resetSession();
    setLiveSets(buildLiveSets(day));
    setLiveExercises(day?.exercises.map((e) => ({ ...e })) ?? []);
    sessRef.current = Date.now();
    setElapsed(0);
    setPhase('training');
  };

  // pre-cardio done → roll straight into training
  const cardioThenTrain = () => {
    commitCardioSegment();
    setLiveSets(buildLiveSets(day));
    setLiveExercises(day?.exercises.map((e) => ({ ...e })) ?? []);
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

    // gather the sets actually completed this workout — keyed by index so a mid-session
    // rename is reflected in the exercise name actually recorded to history
    const doneSets: { exercise: string; reps: number; weight: number }[] = [];
    liveExercises.forEach((ex, i) => {
      for (const s of liveSets[i] ?? []) if (s.done) doneSets.push({ exercise: ex.name, reps: s.reps, weight: s.weight });
    });
    // volume from what was actually lifted
    const realVolume = doneSets.reduce((v, s) => v + s.reps * s.weight, 0);

    const entry: LoggedSession = {
      id: Date.now().toString(),
      day: day.label,
      program: program.name,
      durationSec: elapsed + totalCardio, // whole visit: lifting + cardio
      volume: Math.round(realVolume), // only what was actually ticked
      cardio: totalCardio > 0,
      cardioMin: totalCardio > 0 ? Math.max(1, Math.ceil(totalCardio / 60)) : 0,
      date: 'Today',
      daysAgo: 0,
      iso: TODAY,
    };

    if (doneSets.length > 0) gym.saveWorkout(entry, doneSets);
    else gym.addSession(entry);

    // carry today's renamed exercises + the weight actually lifted back into the
    // program template — next session starts pre-filled, nothing to re-type.
    if (liveExercises.length > 0 && program) {
      const di = Math.min(dayIndex, program.days.length - 1);
      const updatedDays = program.days.map((d, k) => {
        if (k !== di) return d;
        return {
          ...d,
          exercises: liveExercises.map((ex, i) => {
            const done = (liveSets[i] ?? []).filter((s) => s.done && s.weight > 0);
            const lastWeight = done.length ? done[done.length - 1].weight : null;
            return { ...ex, weight: lastWeight != null ? `${lastWeight} kg` : ex.weight };
          }),
        };
      });
      gym.saveProgram({ ...program, days: updatedDays });
    }

    resetSession();
    setLiveSets({});
    setLiveExercises([]);
    setPhase('idle');
    setView('log');
  };

  // throw away the workout in progress (nothing is saved)
  const discardWorkout = async () => {
    const ok = await confirm({ title: 'Discard this workout?', message: 'The timer and the sets you ticked are thrown away. Nothing is saved.', confirmText: 'Discard', destructive: true });
    if (!ok) return;
    resetSession();
    setLiveSets({});
    setLiveExercises([]);
    setPhase('idle');
    toast('Workout discarded', 'info');
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
  const deleteProgram = async (id: string) => {
    if (programs.length <= 1) return; // keep at least one
    const p = programs.find((x) => x.id === id);
    const ok = await confirm({ title: `Delete "${p?.name ?? 'program'}"?`, message: 'Its days and exercises are removed. Your logged workouts stay.', confirmText: 'Delete', destructive: true });
    if (!ok) return;
    const next = programs.filter((x) => x.id !== id);
    gym.deleteProgram(id);
    if (id === activeId) {
      setActiveId(next[0].id);
      setDayIndex(0);
    }
  };


  // ---- keep a workout in progress if the app is closed ----
  type Snap = {
    phase: typeof phase; programId: string; dayIndex: number;
    sessStart: number | null; cardioStart: number | null;
    elapsed: number; cardioSec: number; cardioTotal: number;
    cardioRunning: boolean; paused: boolean;
    liveSets: Record<number, LiveSet[]>; liveExercises: Exercise[]; restEnd: number | null;
  };
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current || !programs.length) return;
    restored.current = true;
    loadLive<Snap>('gym:live').then((snap) => {
      if (!snap || snap.phase === 'idle') return;
      if (programs.some((p) => p.id === snap.programId)) setActiveId(snap.programId);
      setDayIndex(snap.dayIndex);
      sessRef.current = snap.sessStart;
      cardioRef.current = snap.cardioStart;
      cardioTotalRef.current = snap.cardioTotal;
      setElapsed(snap.sessStart !== null ? Math.floor((Date.now() - snap.sessStart) / 1000) : snap.elapsed);
      setCardioSec(snap.cardioStart !== null ? Math.floor((Date.now() - snap.cardioStart) / 1000) : snap.cardioSec);
      setCardioTotal(snap.cardioTotal);
      setCardioRunning(snap.cardioRunning);
      setPaused(snap.paused);
      setLiveSets(snap.liveSets ?? {});
      setLiveExercises(snap.liveExercises ?? []);
      if (snap.restEnd && snap.restEnd > Date.now()) {
        restEnd.current = snap.restEnd;
        setRestLeft(Math.ceil((snap.restEnd - Date.now()) / 1000));
        setRestRunning(true);
      }
      setPhase(snap.phase);
      toast('Workout in progress restored', 'info');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programs]);
  useEffect(() => {
    if (!restored.current) return; // don't overwrite a saved workout before it's restored
    if (phase === 'idle') {
      saveLive('gym:live', null);
      return;
    }
    saveLive<Snap>('gym:live', {
      phase, programId: activeId, dayIndex,
      sessStart: sessRef.current, cardioStart: cardioRef.current,
      elapsed, cardioSec, cardioTotal: cardioTotalRef.current,
      cardioRunning, paused, liveSets, liveExercises, restEnd: restEnd.current,
    });
    // elapsed/cardioSec are only needed while paused, so they're not deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, liveSets, liveExercises, paused, cardioRunning, cardioTotal, activeId, dayIndex, restRunning]);

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
              {phase !== 'idle' && (
                <Pressable onPress={discardWorkout} hitSlop={8} style={{ alignSelf: 'center', marginTop: 12 }}>
                  <Text style={{ color: colors.textFaint, fontFamily: fonts.uiSemi, fontSize: 12.5 }}>Discard workout</Text>
                </Pressable>
              )}
            </LinearGradient>

            {/* program selector */}
            <Pressable onPress={() => (phase === 'idle' ? setProgramModal(true) : toast('Finish or discard the workout to switch program', 'info'))} style={{ flexDirection: 'row', alignItems: 'center', gap: 13, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 18, padding: 15 }}>
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
                  <Pressable key={`${i}-${d.label}`} onPress={() => phase === 'idle' && setDayIndex(i)} style={{ flex: 1, paddingVertical: 11, borderRadius: 10, alignItems: 'center', backgroundColor: on ? accent : 'transparent' }}>
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
                <Ring size={118} stroke={8} progress={Math.min(1, restLeft / Math.max(restSeconds, restLeft || 1))} color={accent} track="rgba(255,255,255,0.07)" />
                <View style={{ position: 'absolute', top: 0, left: 0, width: 118, height: 118, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontFamily: fonts.monoSemi, fontSize: 29, color: '#fff' }}>{restFmt(restLeft)}</Text>
                  <Text style={{ fontSize: 10, color: colors.textDim, letterSpacing: 1.2, marginTop: 1 }}>REST</Text>
                </View>
              </View>
              <View style={{ flex: 1, gap: 9 }}>
                <Pressable
                  onPress={() => (restRunning ? stopRest() : startRest(restLeft > 0 ? restLeft : restSeconds))}
                  style={{ paddingVertical: 13, borderRadius: 13, backgroundColor: accent, alignItems: 'center' }}
                >
                  <Text style={{ color: '#fff', fontFamily: fonts.uiBold, fontSize: 15 }}>{restRunning ? 'Pause' : 'Start'}</Text>
                </Pressable>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Pressable
                    onPress={() => (restRunning ? startRest(restLeft + 15) : setRestLeft((r) => r + 15))}
                    style={{ flex: 1, paddingVertical: 11, borderRadius: 12, borderWidth: 1, borderColor: colors.borderSoft, alignItems: 'center' }}
                  >
                    <Text style={{ color: colors.textSoft, fontFamily: fonts.monoSemi, fontSize: 13 }}>+15s</Text>
                  </Pressable>
                  <Pressable onPress={() => stopRest(restSeconds)} style={{ flex: 1, paddingVertical: 11, borderRadius: 12, borderWidth: 1, borderColor: colors.borderSoft, alignItems: 'center' }}>
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
                {(phase === 'training' ? liveExercises : day.exercises).map((ex, i) => (
                  <View key={i} style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 17, padding: 14 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 11 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11, flex: 1 }}>
                        <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: withAlpha(accent, 14), alignItems: 'center', justifyContent: 'center' }}>
                          <Text style={{ color: accent, fontFamily: fonts.monoSemi, fontSize: 13 }}>{i + 1}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          {phase === 'training' ? (
                            <TextInput
                              value={ex.name}
                              onChangeText={(t) => renameExercise(i, t)}
                              style={{ fontSize: 15, color: colors.textMid, fontFamily: fonts.uiSemi, padding: 0 }}
                            />
                          ) : (
                            <Text style={{ fontSize: 15, color: colors.textMid, fontFamily: fonts.uiSemi }}>{ex.name}</Text>
                          )}
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

                    {phase === 'training' && liveSets[i] ? (
                      <SetTracker sets={liveSets[i]} accent={accent} onToggle={(si) => toggleSet(i, si)} onEdit={(si, f, v) => editSet(i, si, f, v)} onAdd={() => addSet(i)} onRemove={(si) => removeSet(i, si)} />
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

          </>
        ) : (
          <GymLog accent={accent} />
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

    </SafeAreaView>
  );
}

function SetTracker({
  sets,
  accent,
  onToggle,
  onEdit,
  onAdd,
  onRemove,
}: {
  sets: LiveSet[];
  accent: string;
  onToggle: (i: number) => void;
  onEdit: (i: number, field: 'reps' | 'weight', val: number) => void;
  onAdd: () => void;
  onRemove: (i: number) => void;
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
        <View key={`${sets.length}-${i}`} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: s.done ? withAlpha(accent, 14) : colors.inset, borderRadius: 11, paddingVertical: 6, paddingHorizontal: 4 }}>
          <Pressable onLongPress={() => sets.length > 1 && onRemove(i)} hitSlop={6} style={{ width: 30, alignItems: 'center' }}>
            <Text style={{ color: colors.textMuted, fontFamily: fonts.monoSemi, fontSize: 13 }}>{i + 1}</Text>
          </Pressable>
          <TextInput
            defaultValue={String(s.weight)}
            onChangeText={(v) => onEdit(i, 'weight', parseFloat(v.replace(',', '.')) || 0)}
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
      <Pressable onPress={onAdd} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9, borderRadius: 11, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.borderSoft }}>
        <Icon name="plus" size={12} color={colors.textMuted} />
        <Text style={{ color: colors.textMuted, fontFamily: fonts.uiSemi, fontSize: 12.5 }}>Add set</Text>
      </Pressable>
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

function Sheet({ visible, onClose, title, subtitle, children }: { visible: boolean; onClose: () => void; title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <SwipeSheet visible={visible} onClose={onClose}>
      <Text style={{ fontSize: 19, color: colors.text, fontFamily: fonts.uiBold }}>{title}</Text>
      <Text style={{ fontSize: 13, color: colors.textDim, fontFamily: fonts.ui, marginTop: 4, marginBottom: 18 }}>{subtitle}</Text>
      {children}
    </SwipeSheet>
  );
}
