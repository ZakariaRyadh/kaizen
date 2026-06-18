import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon } from '../../components/Icon';
import { ProgramEditor } from '../../components/ProgramEditor';
import { Ring } from '../../components/Ring';
import { SwipeSheet } from '../../components/SwipeSheet';
import { useGym } from '../../store/gym';
import { useAccent, withAlpha } from '../../theme/AccentContext';
import { colors, fonts } from '../../theme/colors';
import { IMPORT_SOURCES, LoggedSession, Program } from '../../theme/programs';

const WEEKDAY = new Date().toLocaleDateString(undefined, { weekday: 'long' });

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

const REST_DEFAULT = 90;

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

  // session timer (counts up)
  const startRef = useRef<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [cardio, setCardio] = useState(false);
  const [cardioSec, setCardioSec] = useState(0);
  const active = startRef.current !== null;

  // rest timer (counts down)
  const [restLeft, setRestLeft] = useState(REST_DEFAULT);
  const [restRunning, setRestRunning] = useState(false);

  // playlist + modals
  const [playing, setPlaying] = useState(false);
  const [playlist, setPlaylist] = useState({ name: 'Lift Hard 🔥', meta: '42 tracks · 2h 51m' });
  const [programModal, setProgramModal] = useState(false);
  const [importModal, setImportModal] = useState(false);
  const [importUrl, setImportUrl] = useState('');

  const log = useGym((s) => s.sessions);

  // pick the first program once data loads
  useEffect(() => {
    if (programs.length && !programs.some((p) => p.id === activeId)) setActiveId(programs[0].id);
  }, [programs, activeId]);

  const program = programs.find((p) => p.id === activeId) ?? programs[0];
  const day = program?.days[Math.min(dayIndex, (program?.days.length ?? 1) - 1)];

  // one shared 1-second tick drives both timers
  useEffect(() => {
    const id = setInterval(() => {
      if (startRef.current !== null) {
        setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
        setCardio((c) => {
          if (c) setCardioSec((s) => s + 1);
          return c;
        });
      }
      setRestLeft((r) => {
        if (!restRunning) return r;
        if (r <= 1) {
          setRestRunning(false);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [restRunning]);

  const startSession = () => {
    startRef.current = Date.now();
    setElapsed(0);
    setCardio(false);
    setCardioSec(0);
  };

  const finishSession = () => {
    const dur = elapsed;
    startRef.current = null;
    const entry: LoggedSession = {
      id: Date.now().toString(),
      day: day.label,
      program: program.name.split(' ').map((w) => w[0]).join(''),
      durationSec: dur,
      volume: dayVolume(day.exercises),
      cardio,
      cardioMin: Math.max(cardio ? 1 : 0, Math.floor(cardioSec / 60)),
      date: 'Today',
      daysAgo: 0,
    };
    gym.addSession(entry);
    setElapsed(0);
    setView('log');
  };

  const pickProgram = (id: string) => {
    setActiveId(id);
    setDayIndex(0);
    setProgramModal(false);
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

  const confirmImport = () => {
    if (importUrl.trim()) setPlaylist({ name: 'Imported playlist', meta: importUrl.trim().slice(0, 28) + '…' });
    setImportUrl('');
    setImportModal(false);
  };
  const pickSource = (label: string) => {
    setPlaylist({ name: `${label} playlist`, meta: 'Connected · syncing' });
    setImportModal(false);
  };

  // ---- log stats ----
  const stats = useMemo(() => {
    const n = log.length;
    const avg = n ? Math.round(log.reduce((s, x) => s + x.durationSec, 0) / n / 60) : 0;
    const week = log.filter((x) => x.daysAgo <= 7).length;
    const cardioMin = log.reduce((s, x) => s + x.cardioMin, 0);
    return { n, avg, week, cardioMin };
  }, [log]);

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
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 28, gap: 18 }} showsVerticalScrollIndicator={false}>
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
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View>
                  <Text style={{ fontSize: 11, letterSpacing: 1.4, color: colors.textMuted, fontFamily: fonts.uiSemi }}>SESSION</Text>
                  <Text style={{ fontFamily: fonts.monoSemi, fontSize: 34, color: '#fff', marginTop: 3 }}>{clock(elapsed)}</Text>
                </View>
                {active ? (
                  <Pressable onPress={finishSession} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.red, paddingHorizontal: 22, paddingVertical: 14, borderRadius: 14 }}>
                    <View style={{ width: 12, height: 12, borderRadius: 2, backgroundColor: '#fff' }} />
                    <Text style={{ color: '#fff', fontFamily: fonts.uiBold, fontSize: 15 }}>Finish</Text>
                  </Pressable>
                ) : (
                  <Pressable onPress={startSession} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: accent, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 14 }}>
                    <Icon name="play" size={13} color="#fff" />
                    <Text style={{ color: '#fff', fontFamily: fonts.uiBold, fontSize: 15 }}>Start</Text>
                  </Pressable>
                )}
              </View>

              {active && (
                <Pressable
                  onPress={() => setCardio((c) => !c)}
                  style={{ marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 11, padding: 12, borderRadius: 14, backgroundColor: cardio ? withAlpha(colors.green, 16) : 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: cardio ? colors.green : colors.border }}
                >
                  <View style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="flame" size={16} color={cardio ? colors.green : colors.textMuted} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, color: cardio ? colors.green : colors.textSoft, fontFamily: fonts.uiSemi }}>Cardio this session</Text>
                    <Text style={{ fontSize: 11.5, color: colors.textMuted, fontFamily: fonts.ui, marginTop: 1 }}>Tap if you did cardio</Text>
                  </View>
                  {cardio && (
                    <Text style={{ fontFamily: fonts.monoSemi, fontSize: 14, color: '#fff', backgroundColor: 'rgba(0,0,0,0.25)', paddingHorizontal: 11, paddingVertical: 6, borderRadius: 9, overflow: 'hidden' }}>
                      {Math.max(1, Math.floor(cardioSec / 60))} min
                    </Text>
                  )}
                </Pressable>
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

            {/* rest timer */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 22, padding: 20 }}>
              <View style={{ width: 118, height: 118 }}>
                <Ring size={118} stroke={8} progress={restLeft / REST_DEFAULT} color={accent} track="rgba(255,255,255,0.07)" />
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
                  <Pressable onPress={() => { setRestLeft(REST_DEFAULT); setRestRunning(false); }} style={{ flex: 1, paddingVertical: 11, borderRadius: 12, borderWidth: 1, borderColor: colors.borderSoft, alignItems: 'center' }}>
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
                      {ex.pr && (
                        <Text style={{ fontSize: 10, color: colors.amber, backgroundColor: withAlpha(colors.amber, 16), paddingHorizontal: 8, paddingVertical: 4, borderRadius: 7, fontFamily: fonts.uiBold, overflow: 'hidden' }}>★ PR</Text>
                      )}
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <Stat label="Sets" value={String(ex.sets)} />
                      <Stat label="Reps" value={ex.reps} />
                      <Stat label="Weight" value={ex.weight} color={accent} flex={1.3} />
                    </View>
                  </View>
                ))}
              </View>
            </View>

            {/* playlist */}
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 11 }}>
                <Text style={{ fontSize: 12, color: colors.textFainter, fontFamily: fonts.uiSemi, letterSpacing: 0.8, textTransform: 'uppercase' }}>Playlist</Text>
                <Pressable onPress={() => setImportModal(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <Icon name="plus" size={13} color={accent} />
                  <Text style={{ color: accent, fontFamily: fonts.uiSemi, fontSize: 12.5 }}>Import</Text>
                </Pressable>
              </View>
              <LinearGradient colors={['#1b1726', '#141119']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 20, padding: 14, borderWidth: 1, borderColor: colors.borderSoft }}>
                <LinearGradient colors={[accent, '#3a2a7e']} style={{ width: 54, height: 54, borderRadius: 13, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="play" size={20} color="#fff" />
                </LinearGradient>
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={{ fontSize: 14.5, color: colors.textMid, fontFamily: fonts.uiSemi }}>{playlist.name}</Text>
                  <Text style={{ fontSize: 12, color: colors.textDim, fontFamily: fonts.ui, marginTop: 2 }}>{playlist.meta}</Text>
                </View>
                <Pressable onPress={() => setPlaying((p) => !p)} style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={playing ? 'pause' : 'play'} size={16} color="#13131a" />
                </Pressable>
              </LinearGradient>
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

            {/* history */}
            <View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <Text style={{ fontSize: 17, color: colors.text, fontFamily: fonts.uiSemi }}>History</Text>
                <Text style={{ fontSize: 13, color: colors.textDim, fontFamily: fonts.mono }}>{log.length} logged</Text>
              </View>
              <View style={{ gap: 9 }}>
                {log.map((lg) => (
                  <View key={lg.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 13, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 14 }}>
                    <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: withAlpha(accent, 13), alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name="gym" size={19} color={accent} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={{ fontSize: 15, color: colors.textMid, fontFamily: fonts.uiSemi }}>{lg.day}</Text>
                        <Text style={{ fontSize: 11, color: colors.textFaint, fontFamily: fonts.mono }}>{lg.program}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', gap: 12, marginTop: 4 }}>
                        <Text style={{ fontSize: 12, color: colors.textMuted, fontFamily: fonts.mono }}>{Math.round(lg.durationSec / 60)}m</Text>
                        <Text style={{ fontSize: 12, color: colors.textMuted, fontFamily: fonts.mono }}>{(lg.volume / 1000).toFixed(1)}t</Text>
                        <Text style={{ fontSize: 12, color: lg.cardio ? colors.green : colors.textFaint, fontFamily: fonts.mono }}>♥ {lg.cardio ? `${lg.cardioMin}m` : '—'}</Text>
                      </View>
                    </View>
                    <Text style={{ fontSize: 11.5, color: colors.textFainter, fontFamily: fonts.mono }}>{lg.date}</Text>
                  </View>
                ))}
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

      {/* PLAYLIST IMPORT */}
      <Sheet visible={importModal} onClose={() => setImportModal(false)} title="Import playlist" subtitle="Connect a service or paste a link">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
          {IMPORT_SOURCES.map((src) => (
            <Pressable key={src.label} onPress={() => pickSource(src.label)} style={{ width: '47%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#1b1b22', borderWidth: 1, borderColor: colors.borderSoft, borderRadius: 14, padding: 14 }}>
              <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: src.color }} />
              <Text style={{ fontSize: 13.5, color: colors.textSoft, fontFamily: fonts.uiSemi }}>{src.label}</Text>
            </Pressable>
          ))}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.inset, borderWidth: 1, borderColor: colors.borderSoft, borderRadius: 14, paddingLeft: 14, paddingRight: 4, paddingVertical: 4 }}>
          <TextInput value={importUrl} onChangeText={setImportUrl} placeholder="Paste playlist URL…" placeholderTextColor={colors.textFaint} style={{ flex: 1, color: colors.text, fontFamily: fonts.ui, fontSize: 14, paddingVertical: 10 }} />
          <Pressable onPress={confirmImport} style={{ backgroundColor: accent, borderRadius: 11, paddingHorizontal: 16, paddingVertical: 11 }}>
            <Text style={{ color: '#fff', fontFamily: fonts.uiSemi, fontSize: 13 }}>Add</Text>
          </Pressable>
        </View>
      </Sheet>
    </SafeAreaView>
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
