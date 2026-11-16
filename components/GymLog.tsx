import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { confirm } from './Dialog';
import { Icon } from './Icon';
import { MiniChart } from './MiniChart';
import { ProgressStat } from './ProgressStat';
import { SwipeSheet } from './SwipeSheet';
import { WeightSheet } from './WeightSheet';
import { daysBetween, localDate, useGym } from '../store/gym';
import { useSettings } from '../store/settings';
import { useToday } from '../store/today';
import { useWeight } from '../store/weight';
import { withAlpha } from '../theme/AccentContext';
import { colors, fonts } from '../theme/colors';
import { LoggedSession, SetLog } from '../theme/programs';

const fmtDay = (iso: string) => localDate(iso).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
const fmtShort = (iso: string) => localDate(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
const fmtMin = (sec: number) => {
  const m = Math.round(sec / 60);
  return m >= 60 ? `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m` : `${m}m`;
};
const fmtVol = (kg: number) => (kg >= 1000 ? `${(kg / 1000).toFixed(1)}t` : `${Math.round(kg)}kg`);
const round1 = (n: number) => Math.round(n * 10) / 10;

// one workout's sets of one exercise, summarised
type ExerciseDay = { key: string; iso: string; top: SetLog; sets: number; pr: boolean };

function exerciseHistory(setlogs: SetLog[], name: string): ExerciseDay[] {
  const groups = new Map<string, SetLog[]>();
  for (const s of setlogs) {
    if (s.exercise !== name) continue;
    const k = s.session ?? `d-${s.date}`;
    groups.set(k, [...(groups.get(k) ?? []), s]);
  }
  return [...groups.entries()]
    .map(([key, rows]) => ({
      key,
      iso: rows[0].date,
      top: rows.reduce((a, b) => (b.weight > a.weight || (b.weight === a.weight && b.reps > a.reps) ? b : a)),
      sets: rows.length,
      pr: rows.some((r) => r.isPr),
    }))
    .sort((a, b) => (a.iso === b.iso ? Number(b.key) - Number(a.key) : b.iso.localeCompare(a.iso)));
}

export function GymLog({ accent }: { accent: string }) {
  const TODAY = useToday();
  const log = useGym((s) => s.sessions);
  const setlogs = useGym((s) => s.setlogs);
  const deleteSession = useGym((s) => s.deleteSession);
  const weights = useWeight((s) => s.weights);
  const weightApi = useWeight();
  const progressDays = useSettings((s) => s.progressDays);

  const [weightSheet, setWeightSheet] = useState(false);
  const [allWeights, setAllWeights] = useState(false);
  const [historyN, setHistoryN] = useState(8);
  const [openSession, setOpenSession] = useState<LoggedSession | null>(null);
  const [exercisesOpen, setExercisesOpen] = useState(false);
  const [exercise, setExercise] = useState<string | null>(null);

  const isoOf = (s: LoggedSession) => s.iso ?? TODAY;

  // ---- headline numbers ----
  const stats = useMemo(() => {
    const n = log.length;
    const lifting = log.filter((x) => x.durationSec > 0);
    const avg = lifting.length ? lifting.reduce((s, x) => s + x.durationSec, 0) / lifting.length : 0;
    const week = log.filter((x) => x.daysAgo < 7).length;
    const cardioMin = log.reduce((s, x) => s + x.cardioMin, 0);
    return { n, avg, week, cardioMin };
  }, [log]);

  // ---- consistency: last 5 weeks, Monday-first columns ----
  const grid = useMemo(() => {
    const trained = new Set(log.map(isoOf));
    const today = localDate(TODAY);
    const mondayOffset = (today.getDay() + 6) % 7; // 0 = Monday
    const start = new Date(today);
    start.setDate(today.getDate() - mondayOffset - 7 * 4);
    const weeks: { iso: string; on: boolean; future: boolean; today: boolean }[][] = [];
    for (let w = 0; w < 5; w++) {
      const row = [];
      for (let d = 0; d < 7; d++) {
        const x = new Date(start);
        x.setDate(start.getDate() + w * 7 + d);
        const iso = `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
        row.push({ iso, on: trained.has(iso), future: iso > TODAY, today: iso === TODAY });
      }
      weeks.push(row);
    }
    // weeks in a row with at least one workout (this week counts once it has one)
    let streak = 0;
    for (let w = 4; w >= 0; w--) {
      if (weeks[w].some((c) => c.on)) streak++;
      else if (w === 4) continue; // this week isn't over yet
      else break;
    }
    const total = weeks.flat().filter((c) => c.on).length;
    return { weeks, streak, total };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [log, TODAY]);

  // ---- this period vs the one before ----
  const progress = useMemo(() => {
    const win = (lo: number, hi: number) => {
      const rows = log.filter((x) => x.daysAgo >= lo && x.daysAgo < hi);
      return {
        sessions: rows.length,
        minutes: Math.round(rows.reduce((s, x) => s + x.durationSec, 0) / 60),
        cardio: rows.reduce((s, x) => s + x.cardioMin, 0),
        volume: Math.round(rows.reduce((s, x) => s + x.volume, 0)),
      };
    };
    return { cur: win(0, progressDays), prev: win(progressDays, progressDays * 2) };
  }, [log, progressDays]);

  // ---- every exercise you've logged ----
  const exercises = useMemo(() => {
    const names = Array.from(new Set(setlogs.map((s) => s.exercise)));
    const rows = names.map((name) => {
      const hist = exerciseHistory(setlogs, name);
      const best = hist.reduce((m, h) => Math.max(m, h.top.weight), 0);
      const bestIn = (lo: number, hi: number) =>
        hist.filter((h) => { const a = daysBetween(h.iso); return a >= lo && a < hi; }).reduce((m, h) => Math.max(m, h.top.weight), 0);
      const cur = bestIn(0, progressDays);
      const prev = bestIn(progressDays, progressDays * 2);
      return { name, hist, best, last: hist[0], cur, prev };
    });
    rows.sort((a, b) => b.last.iso.localeCompare(a.last.iso) || a.name.localeCompare(b.name));
    const tracked = rows.filter((r) => r.cur > 0 && r.prev > 0);
    return { rows, tracked: tracked.length, improved: tracked.filter((r) => r.cur > r.prev).length };
  }, [setlogs, progressDays]);

  const recentPRs = useMemo(
    () =>
      setlogs
        .filter((s) => s.isPr)
        .sort((a, b) => b.date.localeCompare(a.date) || Number(b.id) - Number(a.id))
        .slice(0, 3),
    [setlogs],
  );

  const bars = useMemo(() => {
    const last = log.slice(0, 7).reverse();
    const max = Math.max(1, ...last.map((x) => x.durationSec));
    return last.map((x) => ({ id: x.id, sec: x.durationSec, h: Math.max(4, (x.durationSec / max) * 100), label: fmtShort(isoOf(x)).split(' ')[1] ?? '', cardio: !x.volume && x.cardio }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [log]);

  // ---- body weight ----
  const weightInfo = useMemo(() => {
    if (!weights.length) return null;
    const latest = weights[0];
    const ago = (days: number) => weights.find((w) => daysBetween(w.date) >= days && w.date < latest.date);
    const w7 = ago(7);
    const w30 = ago(30);
    const chart = weights.slice(0, 20).reverse().map((w) => w.kg);
    return { latest, d7: w7 ? round1(latest.kg - w7.kg) : null, d30: w30 ? round1(latest.kg - w30.kg) : null, chart };
  }, [weights]);

  const sessionSets = openSession ? setlogs.filter((s) => s.session === openSession.id).sort((a, b) => a.order - b.order) : [];
  const exRow = exercise ? exercises.rows.find((r) => r.name === exercise) : null;

  return (
    <>
      {/* headline */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        <StatCard val={String(stats.week)} label="This week" sub="workouts, last 7 days" accent={accent} highlight />
        <StatCard val={String(stats.n)} label="All time" sub="workouts logged" accent={accent} />
        <StatCard val={stats.avg ? fmtMin(stats.avg) : '—'} label="Avg length" sub="per workout" accent={accent} />
        <StatCard val={stats.cardioMin >= 60 ? `${round1(stats.cardioMin / 60)}h` : `${stats.cardioMin}m`} label="Cardio" sub="total" accent={accent} />
      </View>

      {/* consistency */}
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <Text style={h2}>Consistency</Text>
          <Text style={{ color: grid.streak ? accent : colors.textFaint, fontFamily: fonts.uiSemi, fontSize: 12 }}>
            {grid.streak ? `🔥 ${grid.streak}-week streak` : 'Train this week to start a streak'}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', marginBottom: 6 }}>
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
            <Text key={i} style={{ flex: 1, textAlign: 'center', color: colors.textFainter, fontFamily: fonts.uiSemi, fontSize: 10.5 }}>{d}</Text>
          ))}
        </View>
        <View style={{ gap: 6 }}>
          {grid.weeks.map((row, w) => (
            <View key={w} style={{ flexDirection: 'row', gap: 6 }}>
              {row.map((c) => (
                <View
                  key={c.iso}
                  style={{
                    flex: 1,
                    aspectRatio: 1,
                    borderRadius: 7,
                    backgroundColor: c.on ? accent : c.future ? 'transparent' : 'rgba(255,255,255,0.045)',
                    borderWidth: c.today ? 1.5 : c.future ? 1 : 0,
                    borderColor: c.today ? withAlpha(accent, 90) : 'rgba(255,255,255,0.04)',
                  }}
                />
              ))}
            </View>
          ))}
        </View>
        <Text style={{ color: colors.textFaint, fontFamily: fonts.ui, fontSize: 11.5, marginTop: 10 }}>
          {grid.total} workout{grid.total === 1 ? '' : 's'} in the last 5 weeks
        </Text>
      </Card>

      {/* progress */}
      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <Text style={h2}>Progress</Text>
          <Text style={{ fontSize: 11.5, color: colors.textFaint, fontFamily: fonts.uiSemi }}>last {progressDays}d vs prior {progressDays}d</Text>
        </View>
        <View style={{ gap: 10 }}>
          <ProgressStat label="Workouts" cur={progress.cur.sessions} prev={progress.prev.sessions} />
          <ProgressStat label="Time" cur={progress.cur.minutes} prev={progress.prev.minutes} unit="m" />
          <ProgressStat label="Volume" cur={Math.round(progress.cur.volume / 100) / 10} prev={Math.round(progress.prev.volume / 100) / 10} unit="t" />
          <ProgressStat label="Cardio" cur={progress.cur.cardio} prev={progress.prev.cardio} unit="m" />
        </View>
        {exercises.rows.length > 0 && (
          <Pressable onPress={() => setExercisesOpen(true)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.borderSoft }}>
            <View>
              <Text style={{ fontSize: 14, color: colors.textSoft, fontFamily: fonts.uiSemi }}>Exercises</Text>
              <Text style={{ fontSize: 11.5, color: colors.textFaint, fontFamily: fonts.ui, marginTop: 2 }}>
                {exercises.tracked ? `${exercises.improved} of ${exercises.tracked} got stronger` : `${exercises.rows.length} tracked · history per exercise`}
              </Text>
            </View>
            <Icon name="chevron" size={16} color={colors.textFaint} />
          </Pressable>
        )}
      </Card>

      {/* recent PRs */}
      {recentPRs.length > 0 && (
        <Card>
          <Text style={[h2, { marginBottom: 12 }]}>Recent records 🏆</Text>
          <View style={{ gap: 8 }}>
            {recentPRs.map((p) => (
              <Pressable key={p.id} onPress={() => { setExercise(p.exercise); setExercisesOpen(true); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: withAlpha(colors.amber, 14), alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: colors.amber, fontSize: 15 }}>★</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.textMid, fontFamily: fonts.uiSemi, fontSize: 14 }} numberOfLines={1}>{p.exercise}</Text>
                  <Text style={{ color: colors.textFaint, fontFamily: fonts.ui, fontSize: 11.5, marginTop: 1 }}>{fmtDay(p.date)}</Text>
                </View>
                <Text style={{ color: colors.amber, fontFamily: fonts.monoSemi, fontSize: 15 }}>{p.weight}kg × {p.reps}</Text>
              </Pressable>
            ))}
          </View>
        </Card>
      )}

      {/* session length */}
      {bars.length > 0 && (
        <Card>
          <Text style={[label, { marginBottom: 16 }]}>Last {bars.length} workouts · length</Text>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8, height: 112 }}>
            {bars.map((b) => (
              <View key={b.id} style={{ flex: 1, alignItems: 'center', gap: 6, height: '100%', justifyContent: 'flex-end' }}>
                <Text style={{ fontFamily: fonts.mono, fontSize: 9.5, color: colors.textDim }}>{Math.round(b.sec / 60)}m</Text>
                <View style={{ width: '100%', maxWidth: 28, borderTopLeftRadius: 7, borderTopRightRadius: 7, borderBottomLeftRadius: 3, borderBottomRightRadius: 3, backgroundColor: b.cardio ? colors.green : accent, height: `${b.h}%` }} />
                <Text style={{ fontSize: 10, color: colors.textFainter, fontFamily: fonts.uiSemi }}>{b.label}</Text>
              </View>
            ))}
          </View>
        </Card>
      )}

      {/* body weight */}
      <View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <Text style={h2}>Body weight</Text>
          <Pressable onPress={() => setWeightSheet(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: accent, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 }}>
            <Icon name="plus" size={14} color="#fff" />
            <Text style={{ color: '#fff', fontFamily: fonts.uiSemi, fontSize: 12.5 }}>Log</Text>
          </Pressable>
        </View>
        {!weightInfo ? (
          <Text style={{ color: colors.textFainter, fontFamily: fonts.ui, textAlign: 'center', paddingVertical: 16 }}>Log your weight every day or two to see the trend.</Text>
        ) : (
          <View style={{ gap: 8 }}>
            <Card>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
                <Text style={{ fontFamily: fonts.monoSemi, fontSize: 32, color: colors.text }}>{weightInfo.latest.kg}</Text>
                <Text style={{ fontFamily: fonts.uiSemi, fontSize: 14, color: colors.textMuted, marginBottom: 6 }}>kg</Text>
                <View style={{ flex: 1, alignItems: 'flex-end', gap: 2, marginBottom: 4 }}>
                  {weightInfo.d7 !== null && <Delta label="7d" v={weightInfo.d7} />}
                  {weightInfo.d30 !== null && <Delta label="30d" v={weightInfo.d30} />}
                </View>
              </View>
              {weightInfo.chart.length >= 2 && (
                <View style={{ marginTop: 12 }}>
                  <MiniChart values={weightInfo.chart} color={accent} height={72} />
                </View>
              )}
              <Text style={{ color: colors.textFaint, fontFamily: fonts.ui, fontSize: 11.5, marginTop: 8 }}>Latest · {fmtDay(weightInfo.latest.date)}</Text>
            </Card>
            {(allWeights ? weights : weights.slice(0, 4)).map((w, i, arr) => {
              const prev = weights[weights.indexOf(w) + 1];
              const d = prev ? round1(w.kg - prev.kg) : null;
              return (
                <Pressable
                  key={w.id}
                  onLongPress={() =>
                    confirm({ title: 'Delete entry?', message: `${w.kg} kg · ${fmtDay(w.date)}`, confirmText: 'Delete', destructive: true }).then((ok) => {
                      if (ok) weightApi.remove(w.id);
                    })
                  }
                  style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 13, paddingHorizontal: 14, paddingVertical: 11 }}
                >
                  <Text style={{ flex: 1, fontFamily: fonts.ui, fontSize: 13, color: colors.textMuted }}>{fmtDay(w.date)}</Text>
                  <Text style={{ fontFamily: fonts.monoSemi, fontSize: 15, color: colors.textMid }}>{w.kg} kg</Text>
                  <Text style={{ width: 56, textAlign: 'right', fontFamily: fonts.mono, fontSize: 12, color: colors.textFaint }}>
                    {d === null ? '' : d > 0 ? `+${d}` : d < 0 ? `${d}` : '±0'}
                  </Text>
                </Pressable>
              );
            })}
            {weights.length > 4 && (
              <MoreButton open={allWeights} count={weights.length} onPress={() => setAllWeights((a) => !a)} />
            )}
            <Text style={{ fontSize: 11.5, color: colors.textFainter, fontFamily: fonts.ui, textAlign: 'center' }}>Long-press an entry to delete it.</Text>
          </View>
        )}
      </View>

      {/* history */}
      <View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <Text style={h2}>History</Text>
          <Text style={{ fontSize: 13, color: colors.textDim, fontFamily: fonts.mono }}>{log.length} logged</Text>
        </View>
        <View style={{ gap: 9 }}>
          {log.slice(0, historyN).map((lg) => {
            const sets = setlogs.filter((s) => s.session === lg.id);
            const prs = sets.filter((s) => s.isPr).length;
            const cardioOnly = !sets.length && !lg.volume && lg.cardio;
            return (
              <Pressable key={lg.id} onPress={() => setOpenSession(lg)} style={{ flexDirection: 'row', alignItems: 'center', gap: 13, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 14 }}>
                <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: withAlpha(cardioOnly ? colors.green : accent, 13), alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={cardioOnly ? 'flame' : 'gym'} size={19} color={cardioOnly ? colors.green : accent} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={{ fontSize: 15, color: colors.textMid, fontFamily: fonts.uiSemi }} numberOfLines={1}>{lg.day || 'Workout'}</Text>
                    {prs > 0 && <Text style={{ fontSize: 10.5, color: colors.amber, fontFamily: fonts.uiBold }}>★ {prs} PR</Text>}
                  </View>
                  <Text style={{ fontSize: 12, color: colors.textMuted, fontFamily: fonts.ui, marginTop: 3 }} numberOfLines={1}>
                    {[fmtMin(lg.durationSec), sets.length ? `${sets.length} sets` : '', lg.volume ? fmtVol(lg.volume) : '', lg.cardio ? `♥ ${lg.cardioMin}m` : ''].filter(Boolean).join('  ·  ')}
                  </Text>
                </View>
                <Text style={{ fontSize: 11.5, color: colors.textFainter, fontFamily: fonts.mono }}>{lg.date}</Text>
              </Pressable>
            );
          })}
          {log.length > historyN && <MoreButton open={false} count={log.length - historyN} onPress={() => setHistoryN((n) => n + 10)} more />}
          {log.length === 0 && (
            <Text style={{ color: colors.textFainter, fontFamily: fonts.ui, textAlign: 'center', paddingVertical: 24 }}>No workouts yet. Finish one to see it here.</Text>
          )}
        </View>
      </View>

      <WeightSheet visible={weightSheet} suggested={weights[0]?.kg} onClose={() => setWeightSheet(false)} onSave={(kg) => weightApi.add(TODAY, kg)} />

      {/* one workout */}
      <SwipeSheet visible={!!openSession} onClose={() => setOpenSession(null)} scroll>
        {openSession && (
          <>
            <Text style={{ fontSize: 20, color: colors.text, fontFamily: fonts.uiBold }}>{openSession.day || 'Workout'}</Text>
            <Text style={{ fontSize: 13, color: colors.textDim, fontFamily: fonts.ui, marginTop: 3 }}>
              {fmtDay(isoOf(openSession))}{openSession.program ? ` · ${openSession.program}` : ''}
            </Text>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 16, marginBottom: 18 }}>
              <Mini label="Time" value={fmtMin(openSession.durationSec)} />
              <Mini label="Volume" value={openSession.volume ? fmtVol(openSession.volume) : '—'} />
              <Mini label="Sets" value={String(sessionSets.length || '—')} />
              <Mini label="Cardio" value={openSession.cardio ? `${openSession.cardioMin}m` : '—'} color={openSession.cardio ? colors.green : undefined} />
            </View>
            {groupByExercise(sessionSets).map(([name, rows]) => (
              <View key={name} style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 15, padding: 13, marginBottom: 9 }}>
                <Text style={{ color: colors.textMid, fontFamily: fonts.uiSemi, fontSize: 14.5, marginBottom: 8 }}>{name}</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {rows.map((r, i) => (
                    <View key={r.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: r.isPr ? withAlpha(colors.amber, 14) : colors.inset, borderRadius: 9, paddingHorizontal: 10, paddingVertical: 6 }}>
                      <Text style={{ color: colors.textFaint, fontFamily: fonts.mono, fontSize: 10.5 }}>{i + 1}</Text>
                      <Text style={{ color: r.isPr ? colors.amber : colors.text, fontFamily: fonts.monoSemi, fontSize: 13 }}>{r.weight}kg × {r.reps}</Text>
                      {r.isPr && <Text style={{ color: colors.amber, fontSize: 11 }}>★</Text>}
                    </View>
                  ))}
                </View>
              </View>
            ))}
            {!sessionSets.length && (
              <Text style={{ color: colors.textFaint, fontFamily: fonts.ui, fontSize: 13, marginBottom: 12 }}>
                {openSession.cardio ? 'Cardio only — no sets logged.' : 'No sets were ticked in this workout.'}
              </Text>
            )}
            <Pressable
              onPress={() => {
                const s = openSession;
                confirm({ title: 'Delete workout?', message: `${s.day} · ${s.date}. Its sets and any records from it are removed too.`, confirmText: 'Delete', destructive: true }).then((ok) => {
                  if (!ok) return;
                  deleteSession(s.id);
                  setOpenSession(null);
                });
              }}
              style={{ paddingVertical: 14, alignItems: 'center', marginTop: 4 }}
            >
              <Text style={{ color: colors.red, fontFamily: fonts.uiSemi, fontSize: 14 }}>Delete workout</Text>
            </Pressable>
          </>
        )}
      </SwipeSheet>

      {/* exercises list → one exercise's history */}
      <SwipeSheet visible={exercisesOpen} onClose={() => { setExercisesOpen(false); setExercise(null); }} scroll>
        {exRow ? (
          <>
            <Pressable onPress={() => setExercise(null)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <Icon name="back" size={14} color={colors.textMuted} />
              <Text style={{ color: colors.textMuted, fontFamily: fonts.uiSemi, fontSize: 13 }}>All exercises</Text>
            </Pressable>
            <Text style={{ fontSize: 20, color: colors.text, fontFamily: fonts.uiBold }}>{exRow.name}</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 14, marginBottom: 14 }}>
              <Mini label="Best" value={`${exRow.best}kg`} color={colors.amber} />
              <Mini label="Last" value={`${exRow.last.top.weight}kg`} />
              <Mini label="Workouts" value={String(exRow.hist.length)} />
            </View>
            {exRow.hist.length >= 2 && (
              <View style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 15, padding: 12, marginBottom: 12 }}>
                <Text style={[label, { marginBottom: 8 }]}>Top set over time</Text>
                <MiniChart values={exRow.hist.slice(0, 20).reverse().map((h) => h.top.weight)} color={accent} height={80} />
              </View>
            )}
            {exRow.hist.map((h) => (
              <View key={h.key} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                <Text style={{ flex: 1, color: colors.textMuted, fontFamily: fonts.ui, fontSize: 13 }}>{fmtDay(h.iso)}</Text>
                <Text style={{ color: colors.textFaint, fontFamily: fonts.mono, fontSize: 11.5, marginRight: 12 }}>{h.sets} set{h.sets > 1 ? 's' : ''}</Text>
                <Text style={{ color: h.pr ? colors.amber : colors.textMid, fontFamily: fonts.monoSemi, fontSize: 14 }}>
                  {h.top.weight}kg × {h.top.reps}{h.pr ? ' ★' : ''}
                </Text>
              </View>
            ))}
          </>
        ) : (
          <>
            <Text style={{ fontSize: 19, color: colors.text, fontFamily: fonts.uiBold }}>Exercises</Text>
            <Text style={{ fontSize: 13, color: colors.textDim, fontFamily: fonts.ui, marginTop: 4, marginBottom: 16 }}>
              Best weight this {progressDays}d vs the {progressDays}d before · tap for history
            </Text>
            <View style={{ gap: 8 }}>
              {exercises.rows.map((r) => {
                const better = r.prev > 0 && r.cur > r.prev;
                const worse = r.prev > 0 && r.cur > 0 && r.cur < r.prev;
                const col = better ? colors.green : worse ? colors.red : colors.textFaint;
                return (
                  <Pressable key={r.name} onPress={() => setExercise(r.name)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 13, paddingHorizontal: 14, paddingVertical: 12 }}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ color: colors.textMid, fontFamily: fonts.uiSemi, fontSize: 13.5 }} numberOfLines={1}>{r.name}</Text>
                      <Text style={{ color: colors.textFaint, fontFamily: fonts.ui, fontSize: 11.5, marginTop: 2 }}>Best {r.best}kg · last {fmtShort(r.last.iso)}</Text>
                    </View>
                    <Text style={{ color: colors.text, fontFamily: fonts.monoSemi, fontSize: 14 }}>{r.cur > 0 ? `${r.cur}kg` : '—'}</Text>
                    <Text style={{ color: col, fontFamily: fonts.uiBold, fontSize: 12, width: 34, textAlign: 'right' }}>
                      {r.prev === 0 && r.cur > 0 ? 'new' : better ? '▲' : worse ? '▼' : '—'}
                    </Text>
                    <Icon name="chevron" size={14} color={colors.textFaint} />
                  </Pressable>
                );
              })}
            </View>
          </>
        )}
      </SwipeSheet>
    </>
  );
}

function groupByExercise(rows: SetLog[]): [string, SetLog[]][] {
  const m = new Map<string, SetLog[]>();
  for (const r of rows) m.set(r.exercise, [...(m.get(r.exercise) ?? []), r]);
  return [...m.entries()];
}

const h2 = { fontSize: 17, color: colors.text, fontFamily: fonts.uiSemi } as const;
const label = { fontSize: 11.5, color: colors.textFainter, fontFamily: fonts.uiSemi, letterSpacing: 0.8, textTransform: 'uppercase' } as const;

function Card({ children }: { children: React.ReactNode }) {
  return <View style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 20, padding: 18 }}>{children}</View>;
}

function StatCard({ val, label: l, sub, accent, highlight }: { val: string; label: string; sub: string; accent: string; highlight?: boolean }) {
  return (
    <View style={{ width: '47%', flexGrow: 1, backgroundColor: highlight ? withAlpha(accent, 12) : colors.card, borderWidth: 1, borderColor: highlight ? withAlpha(accent, 30) : colors.border, borderRadius: 18, padding: 16 }}>
      <Text style={{ fontFamily: fonts.monoSemi, fontSize: 26, color: highlight ? accent : colors.textMid }}>{val}</Text>
      <Text style={{ fontSize: 13.5, color: colors.textSoft, fontFamily: fonts.uiSemi, marginTop: 8 }}>{l}</Text>
      <Text style={{ fontSize: 11.5, color: colors.textFaint, fontFamily: fonts.ui, marginTop: 1 }}>{sub}</Text>
    </View>
  );
}

function Mini({ label: l, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.inset, borderRadius: 11, paddingVertical: 10, alignItems: 'center' }}>
      <Text style={{ fontFamily: fonts.monoSemi, fontSize: 15, color: color ?? colors.textMid }} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text style={{ fontSize: 10, color: colors.textFainter, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2, fontFamily: fonts.uiSemi }}>{l}</Text>
    </View>
  );
}

function Delta({ label: l, v }: { label: string; v: number }) {
  return (
    <Text style={{ fontFamily: fonts.mono, fontSize: 12, color: colors.textMuted }}>
      {v > 0 ? `▲ +${v}` : v < 0 ? `▼ ${v}` : '±0'} kg <Text style={{ color: colors.textFainter }}>· {l}</Text>
    </Text>
  );
}

function MoreButton({ open, count, onPress, more }: { open: boolean; count: number; onPress: () => void; more?: boolean }) {
  return (
    <Pressable onPress={onPress} style={{ paddingVertical: 11, alignItems: 'center', borderRadius: 13, borderWidth: 1, borderColor: colors.borderSoft }}>
      <Text style={{ color: colors.textMuted, fontFamily: fonts.uiSemi, fontSize: 13 }}>
        {more ? `Show more (${count})` : open ? 'Show less' : `Show all (${count})`}
      </Text>
    </Pressable>
  );
}
