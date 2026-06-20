import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon } from '../../components/Icon';
import { EditSessionSheet, IdeaSheet, NewSubjectsSheet, SubjectDetailSheet, SubjectSheet, SummarySheet } from '../../components/LearnSheets';
import { ProgressStat } from '../../components/ProgressStat';
import { useRefresh } from '../../hooks/useRefresh';
import { LearnSession, Subject, useLearning } from '../../store/learning';
import { useSettings } from '../../store/settings';
import { TODAY } from '../../store/tasks';
import { useAccent, withAlpha } from '../../theme/AccentContext';
import { colors, fonts } from '../../theme/colors';

const WEEKDAY = new Date().toLocaleDateString(undefined, { weekday: 'long' });
const pad = (n: number) => String(n).padStart(2, '0');
const clock = (s: number) => `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
const hrs = (s: number) => {
  const h = s / 3600;
  return h >= 1 ? `${h.toFixed(1)}h` : `${Math.round(s / 60)}m`;
};
const fmtDay = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
const daysAgo = (iso: string) => Math.round((new Date(TODAY).getTime() - new Date(iso).getTime()) / 86400000);

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

export default function Learn() {
  const { accent } = useAccent();
  const [view, setView] = useState<'train' | 'log'>('train');

  const subjects = useLearning((s) => s.subjects);
  const sessions = useLearning((s) => s.sessions);
  const learning = useLearning();

  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [goal, setGoal] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null); // editing an existing planned entry

  const startRef = useRef<number | null>(null);
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const [subjectSheet, setSubjectSheet] = useState(false);
  const [ideaSheet, setIdeaSheet] = useState(false);
  const [summarySheet, setSummarySheet] = useState(false);
  const [editSession, setEditSession] = useState<LearnSession | null>(null);
  const [detailSubject, setDetailSubject] = useState<Subject | null>(null);
  const [newSubjectsSheet, setNewSubjectsSheet] = useState(false);

  const deleteSubject = (s: Subject) =>
    Alert.alert('Delete subject?', `${s.name} — kept sessions stay in your log.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => learning.deleteSubject(s.id) },
    ]);

  const { refreshing, onRefresh } = useRefresh([useLearning.getState().load]);

  useEffect(() => {
    if (subjects.length && subjectId === null) setSubjectId(subjects[0].id);
  }, [subjects, subjectId]);

  useEffect(() => {
    const id = setInterval(() => {
      if (startRef.current !== null) setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const currentSubject = subjects.find((s) => s.id === subjectId);

  const start = () => {
    startRef.current = Date.now();
    setElapsed(0);
    setPaused(false);
    setRunning(true);
  };

  const startFromIdea = (idea: LearnSession) => {
    setSubjectId(idea.subjectId);
    setGoal(idea.goal);
    setActiveId(idea.id);
    setView('train');
    startRef.current = Date.now();
    setElapsed(0);
    setPaused(false);
    setRunning(true);
  };

  const togglePause = () => {
    if (paused) {
      startRef.current = Date.now() - elapsed * 1000;
      setPaused(false);
    } else {
      startRef.current = null;
      setPaused(true);
    }
  };

  const finish = () => {
    startRef.current = null;
    setRunning(false);
    setPaused(false);
    setSummarySheet(true);
  };

  const saveSummary = (summary: string) => {
    const subjectName = currentSubject?.name ?? 'General';
    if (activeId) {
      learning.updateSession(activeId, { durationSec: elapsed, summary, done: true, date: TODAY, goal });
    } else {
      learning.addSession({
        subjectId, subjectName, date: TODAY, durationSec: elapsed, goal, summary, done: true,
      });
    }
    setActiveId(null);
    setGoal('');
    setElapsed(0);
    setView('log');
  };

  const saveIdea = (g: string) => {
    const subjectName = currentSubject?.name ?? 'General';
    learning.addSession({ subjectId, subjectName, date: TODAY, durationSec: 0, goal: g, summary: '', done: false });
  };

  const done = sessions.filter((s) => s.done);
  const planned = sessions.filter((s) => !s.done);

  const totalSec = useMemo(() => done.reduce((sum, s) => sum + s.durationSec, 0), [done]);

  const streak = useMemo(() => {
    const days = new Set(done.map((s) => daysAgo(s.date)));
    let n = 0;
    let d = days.has(0) ? 0 : 1;
    while (days.has(d)) {
      n++;
      d++;
    }
    return n;
  }, [done]);

  // this-period vs previous-period (window from Settings)
  const progressDays = useSettings((s) => s.progressDays);
  const progress = useMemo(() => {
    const win = (lo: number, hi: number) => {
      const rows = done.filter((s) => { const a = daysAgo(s.date); return a >= lo && a < hi; });
      return { sessions: rows.length, minutes: Math.round(rows.reduce((sum, s) => sum + s.durationSec, 0) / 60) };
    };
    return { cur: win(0, progressDays), prev: win(progressDays, progressDays * 2) };
  }, [done, progressDays]);

  // new subjects picked up this period vs the period before
  const newSubjects = useMemo(() => {
    const daysAgoNow = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
    const win = (lo: number, hi: number) => subjects.filter((s) => { const a = daysAgoNow(s.createdAt); return a >= lo && a < hi; }).length;
    return { cur: win(0, progressDays), prev: win(progressDays, progressDays * 2) };
  }, [subjects, progressDays]);

  const bySubject = useMemo(() => {
    const map = new Map<string, { id: string | null; name: string; color: string; sec: number }>();
    for (const s of done) {
      const key = s.subjectId ?? s.subjectName;
      const subj = subjects.find((x) => x.id === s.subjectId);
      const prev = map.get(key);
      map.set(key, {
        id: s.subjectId,
        name: s.subjectName || 'General',
        color: subj?.color ?? accent,
        sec: (prev?.sec ?? 0) + s.durationSec,
      });
    }
    return [...map.values()].sort((a, b) => b.sec - a.sec);
  }, [done, subjects, accent]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 28, gap: 18 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={accent} />}
      >
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingTop: 6 }}>
          <View>
            <Text style={{ fontSize: 13, color: colors.textDim, fontFamily: fonts.ui }}>{WEEKDAY} · learning</Text>
            <Text style={{ fontSize: 25, color: colors.text, fontFamily: fonts.uiBold, marginTop: 2 }}>Learn</Text>
          </View>
          <Segment
            options={[{ k: 'train', label: 'Learn' }, { k: 'log', label: 'Log' }]}
            value={view}
            onChange={(k) => setView(k as any)}
            accent={accent}
          />
        </View>

        {view === 'train' ? (
          <>
            {/* subject picker */}
            <View>
              <Text style={{ fontSize: 13, color: colors.textMuted, fontFamily: fonts.uiSemi, marginBottom: 10 }}>Subject</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {subjects.map((s) => {
                  const on = subjectId === s.id;
                  return (
                    <Pressable
                      key={s.id}
                      onPress={() => setSubjectId(s.id)}
                      onLongPress={() => deleteSubject(s)}
                      style={{
                        flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 14, paddingVertical: 10,
                        borderRadius: 12, backgroundColor: on ? withAlpha(s.color, 22) : colors.card,
                        borderWidth: 1, borderColor: on ? s.color : colors.border,
                      }}
                    >
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: s.color }} />
                      <Text style={{ color: on ? colors.text : colors.textMuted, fontFamily: fonts.uiSemi, fontSize: 13.5 }}>{s.name}</Text>
                    </Pressable>
                  );
                })}
                <Pressable
                  onPress={() => setSubjectSheet(true)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: colors.borderSoft, borderStyle: 'dashed' }}
                >
                  <Icon name="plus" size={13} color={colors.textMuted} />
                  <Text style={{ color: colors.textMuted, fontFamily: fonts.uiSemi, fontSize: 13.5 }}>Subject</Text>
                </Pressable>
              </ScrollView>
              {subjects.length === 0 && (
                <Text style={{ fontSize: 12.5, color: colors.textFaint, fontFamily: fonts.ui, marginTop: 8 }}>
                  Add a subject to start tracking what you're learning.
                </Text>
              )}
            </View>

            {/* goal — only editable before starting */}
            {!running && (
              <TextInput
                value={goal}
                onChangeText={setGoal}
                placeholder="What's the goal for this session?"
                placeholderTextColor={colors.textFaint}
                style={{
                  backgroundColor: colors.card, borderWidth: 1, borderColor: colors.borderSoft, borderRadius: 14,
                  paddingHorizontal: 16, paddingVertical: 13, color: colors.text, fontFamily: fonts.ui, fontSize: 14,
                }}
              />
            )}

            {/* timer */}
            <LinearGradient
              colors={[withAlpha(accent, 18), colors.card]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ borderRadius: 22, padding: 18, borderWidth: 1, borderColor: withAlpha(accent, 24) }}
            >
              {running && (
                <Text style={{ fontSize: 13.5, color: colors.textSoft, fontFamily: fonts.ui, marginBottom: 14 }} numberOfLines={2}>
                  {currentSubject?.name ?? 'General'} {goal ? `· ${goal}` : ''}
                </Text>
              )}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View>
                  <Text style={{ fontSize: 11, letterSpacing: 1.4, color: colors.textMuted, fontFamily: fonts.uiSemi }}>SESSION{paused ? ' · PAUSED' : ''}</Text>
                  <Text style={{ fontFamily: fonts.monoSemi, fontSize: 34, color: '#fff', marginTop: 3 }}>{clock(elapsed)}</Text>
                </View>
                {running ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Pressable onPress={togglePause} style={{ width: 48, height: 48, borderRadius: 14, borderWidth: 1, borderColor: colors.borderSoft, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name={paused ? 'play' : 'pause'} size={16} color="#fff" />
                    </Pressable>
                    <Pressable onPress={finish} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.red, paddingHorizontal: 18, paddingVertical: 14, borderRadius: 14 }}>
                      <View style={{ width: 12, height: 12, borderRadius: 2, backgroundColor: '#fff' }} />
                      <Text style={{ color: '#fff', fontFamily: fonts.uiBold, fontSize: 15 }}>Finish</Text>
                    </Pressable>
                  </View>
                ) : (
                  <Pressable onPress={start} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: accent, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 14 }}>
                    <Icon name="play" size={13} color="#fff" />
                    <Text style={{ color: '#fff', fontFamily: fonts.uiBold, fontSize: 15 }}>Start</Text>
                  </Pressable>
                )}
              </View>
            </LinearGradient>

            {/* quick capture */}
            <Pressable
              onPress={() => setIdeaSheet(true)}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 16, paddingVertical: 14 }}
            >
              <Icon name="book" size={15} color={colors.textMuted} />
              <Text style={{ color: colors.textSoft, fontFamily: fonts.uiSemi, fontSize: 14 }}>Save an idea for later (no timer)</Text>
            </Pressable>

            {/* planned ideas, startable from here too */}
            {planned.length > 0 && (
              <View>
                <Text style={{ fontSize: 13, color: colors.textMuted, fontFamily: fonts.uiSemi, marginBottom: 10 }}>Saved for later</Text>
                <View style={{ gap: 8 }}>
                  {planned.map((p) => (
                    <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 14 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.textFaint, fontFamily: fonts.uiSemi, fontSize: 11.5 }}>{p.subjectName || 'General'}</Text>
                        <Text style={{ color: colors.text, fontFamily: fonts.ui, fontSize: 14, marginTop: 2 }} numberOfLines={2}>{p.goal}</Text>
                      </View>
                      <Pressable onPress={() => startFromIdea(p)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: accent, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10 }}>
                        <Icon name="play" size={11} color="#fff" />
                        <Text style={{ color: '#fff', fontFamily: fonts.uiBold, fontSize: 12.5 }}>Start</Text>
                      </Pressable>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </>
        ) : (
          <>
            {/* stats */}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 14 }}>
                <Text style={{ color: colors.textFaint, fontFamily: fonts.uiSemi, fontSize: 11 }}>TOTAL TIME</Text>
                <Text style={{ color: colors.text, fontFamily: fonts.monoSemi, fontSize: 22, marginTop: 4 }}>{hrs(totalSec)}</Text>
              </View>
              <View style={{ flex: 1, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 14 }}>
                <Text style={{ color: colors.textFaint, fontFamily: fonts.uiSemi, fontSize: 11 }}>SESSIONS</Text>
                <Text style={{ color: colors.text, fontFamily: fonts.monoSemi, fontSize: 22, marginTop: 4 }}>{done.length}</Text>
              </View>
              <View style={{ flex: 1, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 14 }}>
                <Text style={{ color: colors.textFaint, fontFamily: fonts.uiSemi, fontSize: 11 }}>STREAK</Text>
                <Text style={{ color: colors.text, fontFamily: fonts.monoSemi, fontSize: 22, marginTop: 4 }}>{streak}d</Text>
              </View>
            </View>

            {/* progress vs previous period */}
            <View style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 20, padding: 18 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <Text style={{ fontSize: 17, color: colors.text, fontFamily: fonts.uiSemi }}>Progress</Text>
                <Text style={{ fontSize: 11.5, color: colors.textFaint, fontFamily: fonts.uiSemi }}>last {progressDays}d vs prior {progressDays}d</Text>
              </View>
              <Text style={{ fontSize: 11.5, color: colors.textFainter, fontFamily: fonts.ui, marginBottom: 14 }}>
                Are you learning more than the period before?
              </Text>
              <View style={{ gap: 10 }}>
                <ProgressStat label="Study time" cur={progress.cur.minutes} prev={progress.prev.minutes} unit="m" />
                <ProgressStat label="Sessions" cur={progress.cur.sessions} prev={progress.prev.sessions} />
                <Pressable onPress={() => setNewSubjectsSheet(true)}>
                  <ProgressStat label="New subjects" cur={newSubjects.cur} prev={newSubjects.prev} />
                </Pressable>
              </View>
            </View>

            {/* per-subject totals */}
            {bySubject.length > 0 && (
              <View>
                <Text style={{ fontSize: 17, color: colors.text, fontFamily: fonts.uiSemi, marginBottom: 10 }}>By subject</Text>
                <View style={{ gap: 8 }}>
                  {bySubject.map((b) => {
                    const subj = b.id ? subjects.find((x) => x.id === b.id) : null;
                    return (
                      <Pressable
                        key={b.name}
                        onPress={() => subj && setDetailSubject(subj)}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 14 }}
                      >
                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: b.color }} />
                        <Text style={{ flex: 1, color: colors.text, fontFamily: fonts.uiSemi, fontSize: 14 }}>{b.name}</Text>
                        <Text style={{ color: colors.textMuted, fontFamily: fonts.monoSemi, fontSize: 14 }}>{hrs(b.sec)}</Text>
                        {subj && <Icon name="chevron" size={15} color={colors.textFaint} />}
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}

            {/* history */}
            <View>
              <Text style={{ fontSize: 17, color: colors.text, fontFamily: fonts.uiSemi, marginBottom: 4 }}>History</Text>
              <Text style={{ fontSize: 11.5, color: colors.textFainter, fontFamily: fonts.ui, marginBottom: 10 }}>
                Tap to edit · long-press to delete.
              </Text>
              <View style={{ gap: 9 }}>
                {done.map((s) => (
                  <Pressable
                    key={s.id}
                    onPress={() => setEditSession(s)}
                    onLongPress={() =>
                      Alert.alert('Delete entry?', `${s.subjectName} · ${fmtDay(s.date)}`, [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Delete', style: 'destructive', onPress: () => learning.deleteSession(s.id) },
                      ])
                    }
                    style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 14, gap: 6 }}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ color: colors.text, fontFamily: fonts.uiSemi, fontSize: 14 }}>{s.subjectName || 'General'}</Text>
                      <Text style={{ color: colors.textMuted, fontFamily: fonts.monoSemi, fontSize: 13 }}>{hrs(s.durationSec)} · {fmtDay(s.date)}</Text>
                    </View>
                    {s.goal && <Text style={{ color: colors.textDim, fontFamily: fonts.ui, fontSize: 12.5 }} numberOfLines={1}>Goal: {s.goal}</Text>}
                    {s.summary && <Text style={{ color: colors.textSoft, fontFamily: fonts.ui, fontSize: 13 }}>{s.summary}</Text>}
                  </Pressable>
                ))}
                {done.length === 0 && (
                  <Text style={{ color: colors.textFaint, fontFamily: fonts.ui, fontSize: 13 }}>
                    No sessions yet. Start a timer to log one.
                  </Text>
                )}
              </View>
            </View>
          </>
        )}
      </ScrollView>

      <SubjectSheet visible={subjectSheet} onClose={() => setSubjectSheet(false)} onSave={(name, color) => learning.addSubject(name, color).then((s) => s && setSubjectId(s.id))} />
      <IdeaSheet visible={ideaSheet} onClose={() => setIdeaSheet(false)} onSave={saveIdea} />
      <SummarySheet visible={summarySheet} durationLabel={clock(elapsed)} onClose={() => setSummarySheet(false)} onSave={saveSummary} />
      <EditSessionSheet
        visible={!!editSession}
        session={editSession}
        subjects={subjects}
        onClose={() => setEditSession(null)}
        onSave={(patch) => editSession && learning.updateSession(editSession.id, patch)}
        onDelete={() => editSession && learning.deleteSession(editSession.id)}
      />
      <SubjectDetailSheet
        visible={!!detailSubject}
        subject={detailSubject}
        sessions={sessions}
        onClose={() => setDetailSubject(null)}
        onDelete={() => detailSubject && learning.deleteSubject(detailSubject.id)}
      />
      <NewSubjectsSheet
        visible={newSubjectsSheet}
        subjects={subjects}
        progressDays={progressDays}
        onClose={() => setNewSubjectsSheet(false)}
      />
    </SafeAreaView>
  );
}
