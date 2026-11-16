import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { confirm, toast } from '../../components/Dialog';
import { Icon } from '../../components/Icon';
import { EditSessionSheet, IdeaSheet, NewSubjectsSheet, SubjectDetailSheet, SubjectSheet, SummarySheet } from '../../components/LearnSheets';
import { LearnLog } from '../../components/LearnLog';
import { useRefresh } from '../../hooks/useRefresh';
import { LearnSession, Subject, useLearning } from '../../store/learning';
import { useSettings } from '../../store/settings';
import { loadLive, saveLive } from '../../lib/liveSession';
import { useToday } from '../../store/today';
import { useAccent, withAlpha } from '../../theme/AccentContext';
import { colors, fonts } from '../../theme/colors';

const pad = (n: number) => String(n).padStart(2, '0');
const clock = (s: number) => `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
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
  const TODAY = useToday();
  const WEEKDAY = new Date(TODAY + 'T12:00').toLocaleDateString(undefined, { weekday: 'long' });
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
    confirm({ title: 'Delete subject?', message: `${s.name} — its past sessions stay in your log.`, confirmText: 'Delete', destructive: true }).then((ok) => {
      if (ok) learning.deleteSubject(s.id);
    });

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

  // ---- keep a study session in progress if the app is closed ----
  type Snap = { start: number | null; elapsed: number; paused: boolean; subjectId: string | null; goal: string; activeId: string | null };
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    loadLive<Snap>('learn:live').then((snap) => {
      if (!snap) return;
      setSubjectId(snap.subjectId);
      setGoal(snap.goal);
      setActiveId(snap.activeId);
      startRef.current = snap.start;
      setElapsed(snap.start !== null ? Math.floor((Date.now() - snap.start) / 1000) : snap.elapsed);
      setPaused(snap.paused);
      setRunning(true);
      setView('train');
      toast('Study session in progress restored', 'info');
    });
  }, []);
  useEffect(() => {
    if (!restored.current) return;
    if (!running) {
      saveLive('learn:live', null);
      return;
    }
    saveLive<Snap>('learn:live', { start: startRef.current, elapsed, paused, subjectId, goal, activeId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, paused, subjectId, goal, activeId]);

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
    pendingSave.current = true;
    setSummarySheet(true);
  };

  // closing the summary sheet any way other than Discard still saves the time
  const pendingSave = useRef(false);
  const closeSummary = () => {
    setSummarySheet(false);
    if (pendingSave.current) saveSummary('');
  };
  const discardSession = () => {
    pendingSave.current = false;
    setSummarySheet(false);
    setActiveId(null);
    setElapsed(0);
    toast('Session discarded', 'info');
  };

  const saveSummary = (summary: string) => {
    if (!pendingSave.current) return;
    pendingSave.current = false;
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
    toast(`Saved · ${Math.max(1, Math.round(elapsed / 60))} min of ${subjectName}`);
  };

  const saveIdea = (g: string) => {
    const subjectName = currentSubject?.name ?? 'General';
    learning.addSession({ subjectId, subjectName, date: TODAY, durationSec: 0, goal: g, summary: '', done: false });
  };

  const planned = sessions.filter((s) => !s.done);
  const progressDays = useSettings((s) => s.progressDays);

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
          <LearnLog
            accent={accent}
            onEdit={setEditSession}
            onAdd={() => setEditSession({ id: 'new', subjectId, subjectName: '', date: TODAY, durationSec: 0, goal: '', summary: '', done: true })}
            onOpenSubject={setDetailSubject}
            onOpenNewSubjects={() => setNewSubjectsSheet(true)}
          />
        )}
      </ScrollView>

      <SubjectSheet visible={subjectSheet} onClose={() => setSubjectSheet(false)} onSave={(name, color) => learning.addSubject(name, color).then((s) => s && setSubjectId(s.id))} />
      <IdeaSheet visible={ideaSheet} onClose={() => setIdeaSheet(false)} onSave={saveIdea} />
      <SummarySheet visible={summarySheet} durationLabel={clock(elapsed)} onClose={closeSummary} onSave={saveSummary} onDiscard={discardSession} />
      <EditSessionSheet
        visible={!!editSession}
        session={editSession}
        subjects={subjects}
        onClose={() => setEditSession(null)}
        onSave={(patch) => {
          if (!editSession) return;
          if (editSession.id === 'new') {
            learning.addSession({ ...editSession, ...patch, done: true } as Omit<LearnSession, 'id'>);
            toast('Session added to your log');
          } else learning.updateSession(editSession.id, patch);
        }}
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
