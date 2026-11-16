import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Icon } from './Icon';
import { ProgressStat } from './ProgressStat';
import { LearnSession, Subject, useLearning } from '../store/learning';
import { useSettings } from '../store/settings';
import { useToday } from '../store/today';
import { withAlpha } from '../theme/AccentContext';
import { colors, fonts } from '../theme/colors';

const local = (iso: string) => new Date(`${iso}T12:00:00`);
const isoOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const shift = (iso: string, n: number) => {
  const d = local(iso);
  d.setDate(d.getDate() + n);
  return isoOf(d);
};
const daysAgo = (iso: string, today: string) => Math.round((local(today).getTime() - local(iso).getTime()) / 86400000);
const hm = (sec: number) => {
  const m = Math.round(sec / 60);
  if (m < 60) return `${m}m`;
  return m % 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m / 60}h`;
};

type Props = {
  accent: string;
  onEdit: (s: LearnSession) => void;
  onAdd: () => void;
  onOpenSubject: (s: Subject) => void;
  onOpenNewSubjects: () => void;
};

export function LearnLog({ accent, onEdit, onAdd, onOpenSubject, onOpenNewSubjects }: Props) {
  const TODAY = useToday();
  const subjects = useLearning((s) => s.subjects);
  const sessions = useLearning((s) => s.sessions);
  const progressDays = useSettings((s) => s.progressDays);
  const [filter, setFilter] = useState<string>('all'); // subject id, or 'all'
  const [daysShown, setDaysShown] = useState(7);

  const done = useMemo(() => sessions.filter((s) => s.done), [sessions]);
  const colorOf = (s: LearnSession) => subjects.find((x) => x.id === s.subjectId)?.color ?? accent;

  const stats = useMemo(() => {
    const total = done.reduce((sum, s) => sum + s.durationSec, 0);
    const days = new Set(done.map((s) => s.date));
    // current streak: today (or yesterday, if today isn't studied yet) going back
    let cur = 0;
    let d = days.has(TODAY) ? TODAY : shift(TODAY, -1);
    while (days.has(d)) {
      cur++;
      d = shift(d, -1);
    }
    // best streak ever
    const sorted = [...days].sort();
    let best = 0;
    let run = 0;
    let prev = '';
    for (const x of sorted) {
      run = prev && shift(prev, 1) === x ? run + 1 : 1;
      best = Math.max(best, run);
      prev = x;
    }
    return { total, count: done.length, cur, best };
  }, [done, TODAY]);

  // last 7 days, oldest → today
  const week = useMemo(() => {
    const rows = Array.from({ length: 7 }, (_, i) => {
      const iso = shift(TODAY, i - 6);
      const sec = done.filter((s) => s.date === iso).reduce((sum, s) => sum + s.durationSec, 0);
      return { iso, sec, label: local(iso).toLocaleDateString(undefined, { weekday: 'narrow' }), today: iso === TODAY };
    });
    const max = Math.max(1, ...rows.map((r) => r.sec));
    return { rows, max, total: rows.reduce((s, r) => s + r.sec, 0), active: rows.filter((r) => r.sec > 0).length };
  }, [done, TODAY]);

  const progress = useMemo(() => {
    const win = (lo: number, hi: number) => {
      const rows = done.filter((s) => { const a = daysAgo(s.date, TODAY); return a >= lo && a < hi; });
      return { sessions: rows.length, minutes: Math.round(rows.reduce((sum, s) => sum + s.durationSec, 0) / 60) };
    };
    const subj = (lo: number, hi: number) =>
      subjects.filter((s) => { const a = Math.floor((Date.now() - new Date(s.createdAt).getTime()) / 86400000); return a >= lo && a < hi; }).length;
    return { cur: win(0, progressDays), prev: win(progressDays, progressDays * 2), newCur: subj(0, progressDays), newPrev: subj(progressDays, progressDays * 2) };
  }, [done, subjects, progressDays, TODAY]);

  const bySubject = useMemo(() => {
    const map = new Map<string, { subj: Subject | null; name: string; color: string; sec: number; n: number }>();
    for (const s of done) {
      const key = s.subjectId ?? `name:${s.subjectName}`;
      const subj = subjects.find((x) => x.id === s.subjectId) ?? null;
      const prev = map.get(key);
      map.set(key, { subj, name: s.subjectName || 'General', color: subj?.color ?? colors.textFaint, sec: (prev?.sec ?? 0) + s.durationSec, n: (prev?.n ?? 0) + 1 });
    }
    const rows = [...map.entries()].map(([key, v]) => ({ key, ...v })).sort((a, b) => b.sec - a.sec);
    return { rows, max: Math.max(1, ...rows.map((r) => r.sec)), total: rows.reduce((s, r) => s + r.sec, 0) || 1 };
  }, [done, subjects]);

  // history grouped by day, filtered by subject
  const groups = useMemo(() => {
    const rows = filter === 'all' ? done : done.filter((s) => (s.subjectId ?? `name:${s.subjectName}`) === filter);
    const m = new Map<string, LearnSession[]>();
    for (const s of rows) m.set(s.date, [...(m.get(s.date) ?? []), s]);
    return [...m.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [done, filter]);

  const dayLabel = (iso: string) => {
    const a = daysAgo(iso, TODAY);
    if (a === 0) return 'Today';
    if (a === 1) return 'Yesterday';
    return local(iso).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
  };

  return (
    <>
      {/* headline */}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Stat label="Total" value={hm(stats.total)} />
        <Stat label="Sessions" value={String(stats.count)} />
        <Stat label="Streak" value={`${stats.cur}d`} sub={stats.best > stats.cur ? `best ${stats.best}d` : stats.cur ? 'your best' : undefined} accent={stats.cur ? accent : undefined} />
      </View>

      {/* this week */}
      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
          <Text style={h2}>Last 7 days</Text>
          <Text style={{ color: colors.textMuted, fontFamily: fonts.monoSemi, fontSize: 13 }}>
            {hm(week.total)} <Text style={{ color: colors.textFainter, fontFamily: fonts.ui, fontSize: 11.5 }}>· {week.active}/7 days</Text>
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: 110 }}>
          {week.rows.map((r) => (
            <View key={r.iso} style={{ flex: 1, alignItems: 'center', gap: 6, height: '100%', justifyContent: 'flex-end' }}>
              <Text style={{ fontFamily: fonts.mono, fontSize: 9.5, color: r.sec ? colors.textDim : 'transparent' }}>{Math.round(r.sec / 60)}m</Text>
              <View
                style={{
                  width: '100%',
                  maxWidth: 30,
                  height: r.sec ? `${Math.max(6, (r.sec / week.max) * 100)}%` : 4,
                  borderTopLeftRadius: 7,
                  borderTopRightRadius: 7,
                  borderBottomLeftRadius: 3,
                  borderBottomRightRadius: 3,
                  backgroundColor: r.sec ? (r.today ? accent : withAlpha(accent, 55)) : 'rgba(255,255,255,0.06)',
                }}
              />
              <Text style={{ fontSize: 10.5, color: r.today ? accent : colors.textFainter, fontFamily: fonts.uiSemi }}>{r.label}</Text>
            </View>
          ))}
        </View>
      </Card>

      {/* progress */}
      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <Text style={h2}>Progress</Text>
          <Text style={{ fontSize: 11.5, color: colors.textFaint, fontFamily: fonts.uiSemi }}>last {progressDays}d vs prior {progressDays}d</Text>
        </View>
        <View style={{ gap: 10 }}>
          <ProgressStat label="Study time" cur={progress.cur.minutes} prev={progress.prev.minutes} unit="m" />
          <ProgressStat label="Sessions" cur={progress.cur.sessions} prev={progress.prev.sessions} />
          <Pressable onPress={onOpenNewSubjects}>
            <ProgressStat label="New subjects" cur={progress.newCur} prev={progress.newPrev} />
          </Pressable>
        </View>
      </Card>

      {/* by subject */}
      {bySubject.rows.length > 0 && (
        <Card>
          <Text style={[h2, { marginBottom: 14 }]}>By subject</Text>
          <View style={{ gap: 14 }}>
            {bySubject.rows.map((b) => (
              <Pressable key={b.key} onPress={() => b.subj && onOpenSubject(b.subj)} style={{ gap: 7 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
                  <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: b.color }} />
                  <Text style={{ flex: 1, color: colors.text, fontFamily: fonts.uiSemi, fontSize: 14 }} numberOfLines={1}>{b.name}</Text>
                  <Text style={{ color: colors.textFaint, fontFamily: fonts.mono, fontSize: 11.5 }}>{Math.round((b.sec / bySubject.total) * 100)}%</Text>
                  <Text style={{ color: colors.textMid, fontFamily: fonts.monoSemi, fontSize: 13.5, width: 64, textAlign: 'right' }}>{hm(b.sec)}</Text>
                  {b.subj ? <Icon name="chevron" size={13} color={colors.textFaint} /> : <View style={{ width: 13 }} />}
                </View>
                <View style={{ height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                  <View style={{ width: `${(b.sec / bySubject.max) * 100}%`, height: '100%', borderRadius: 3, backgroundColor: b.color }} />
                </View>
              </Pressable>
            ))}
          </View>
        </Card>
      )}

      {/* history */}
      <View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <Text style={h2}>History</Text>
          <Pressable onPress={onAdd} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: withAlpha(accent, 16), borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 }}>
            <Icon name="plus" size={13} color={accent} />
            <Text style={{ color: accent, fontFamily: fonts.uiSemi, fontSize: 12.5 }}>Log past session</Text>
          </Pressable>
        </View>

        {bySubject.rows.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7, paddingBottom: 12 }}>
            {[{ key: 'all', name: 'All', color: accent }, ...bySubject.rows].map((b) => {
              const on = filter === b.key;
              return (
                <Pressable key={b.key} onPress={() => setFilter(b.key)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, backgroundColor: on ? withAlpha(b.color, 18) : colors.card, borderWidth: 1, borderColor: on ? b.color : colors.border }}>
                  {b.key !== 'all' && <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: b.color }} />}
                  <Text style={{ color: on ? colors.text : colors.textMuted, fontFamily: fonts.uiSemi, fontSize: 12.5 }}>{b.name}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        <View style={{ gap: 16 }}>
          {groups.slice(0, daysShown).map(([iso, rows]) => (
            <View key={iso} style={{ gap: 8 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 2 }}>
                <Text style={{ color: colors.textMuted, fontFamily: fonts.uiSemi, fontSize: 12.5 }}>{dayLabel(iso)}</Text>
                <Text style={{ color: colors.textFaint, fontFamily: fonts.mono, fontSize: 12 }}>{hm(rows.reduce((s, r) => s + r.durationSec, 0))}</Text>
              </View>
              {rows.map((s) => (
                <Pressable key={s.id} onPress={() => onEdit(s)} style={{ flexDirection: 'row', gap: 12, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 15, padding: 13 }}>
                  <View style={{ width: 4, borderRadius: 2, backgroundColor: colorOf(s) }} />
                  <View style={{ flex: 1, gap: 4 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ color: colors.text, fontFamily: fonts.uiSemi, fontSize: 14 }} numberOfLines={1}>{s.subjectName || 'General'}</Text>
                      <Text style={{ color: colors.textMuted, fontFamily: fonts.monoSemi, fontSize: 13 }}>{hm(s.durationSec)}</Text>
                    </View>
                    {!!s.goal && <Text style={{ color: colors.textDim, fontFamily: fonts.ui, fontSize: 12.5 }} numberOfLines={1}>🎯 {s.goal}</Text>}
                    {!!s.summary && <Text style={{ color: colors.textSoft, fontFamily: fonts.ui, fontSize: 13, lineHeight: 18 }} numberOfLines={3}>{s.summary}</Text>}
                  </View>
                </Pressable>
              ))}
            </View>
          ))}
          {groups.length > daysShown && (
            <Pressable onPress={() => setDaysShown((n) => n + 14)} style={{ paddingVertical: 11, alignItems: 'center', borderRadius: 13, borderWidth: 1, borderColor: colors.borderSoft }}>
              <Text style={{ color: colors.textMuted, fontFamily: fonts.uiSemi, fontSize: 13 }}>Show older days</Text>
            </Pressable>
          )}
          {done.length === 0 && (
            <Text style={{ color: colors.textFaint, fontFamily: fonts.ui, fontSize: 13, textAlign: 'center', paddingVertical: 16 }}>
              No sessions yet. Start a timer, or log one you did without it.
            </Text>
          )}
          {done.length > 0 && <Text style={{ fontSize: 11.5, color: colors.textFainter, fontFamily: fonts.ui, textAlign: 'center' }}>Tap a session to edit or delete it.</Text>}
        </View>
      </View>
    </>
  );
}

const h2 = { fontSize: 17, color: colors.text, fontFamily: fonts.uiSemi } as const;

function Card({ children }: { children: React.ReactNode }) {
  return <View style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 20, padding: 18 }}>{children}</View>;
}

function Stat({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: accent ? withAlpha(accent, 12) : colors.card, borderWidth: 1, borderColor: accent ? withAlpha(accent, 30) : colors.border, borderRadius: 16, padding: 14 }}>
      <Text style={{ color: colors.textFaint, fontFamily: fonts.uiSemi, fontSize: 11, letterSpacing: 0.6 }}>{label.toUpperCase()}</Text>
      <Text style={{ color: accent ?? colors.text, fontFamily: fonts.monoSemi, fontSize: 21, marginTop: 4 }} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      {!!sub && <Text style={{ color: colors.textFaint, fontFamily: fonts.ui, fontSize: 11, marginTop: 2 }}>{sub}</Text>}
    </View>
  );
}
