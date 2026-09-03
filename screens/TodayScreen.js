import { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, TOP, todayIndex, toMin, dateOfWeekday, isoDate, plural } from '../theme';
import { getSchedule, getSetting, setSetting, getTasks } from '../database';
import { useTimer } from '../TimerContext';
import { scheduleNextLessonOneOff, cancelReminder } from '../notifications';

export default function TodayScreen({ onOpenWeek }) {
  const [lessons, setLessons] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [editingNote, setEditingNote] = useState(false);
  const [nowMin, setNowMin] = useState(new Date().getHours() * 60 + new Date().getMinutes());
  const [pickDuration, setPickDuration] = useState(false);
  const [nextRemind, setNextRemind] = useState(null); // { slot, notifId }
  const timer = useTimer();
  const clockRef = useRef(null);

  const dayIdx = todayIndex() > 5 ? 0 : todayIndex();

  const load = useCallback(async () => {
    const all = await getSchedule();
    setLessons(all.filter(l => l.day === dayIdx).sort((a, b) => a.slot - b.slot));
    setTasks(await getTasks());
    setNote(await getSetting('dayNote', ''));
    setName(await getSetting('studentName', ''));
  }, [dayIdx]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    clockRef.current = setInterval(() => {
      const d = new Date();
      setNowMin(d.getHours() * 60 + d.getMinutes());
    }, 30000);
    return () => clearInterval(clockRef.current);
  }, []);

  const current = lessons.find(l => toMin(l.startTime) <= nowMin && toMin(l.endTime) > nowMin);
  const upcoming = lessons.find(l => toMin(l.startTime) > nowMin);
  const focus = current || upcoming;
  const isNow = !!current;

  const todayIso = isoDate(new Date());
  const todayTasks = tasks.filter(t => !t.done && t.dueDate === todayIso);
  const hwFor = (subjectId) => tasks.filter(t => !t.done && t.subjectId === subjectId && t.dueDate === todayIso).length;

  const mm = timer.mm, ss = timer.ss;

  async function saveNote() { await setSetting('dayNote', note); setEditingNote(false); }

  async function toggleNextReminder() {
    if (!focus || isNow) return;
    if (nextRemind && nextRemind.slot === focus.slot) {
      await cancelReminder(nextRemind.notifId);
      setNextRemind(null);
      return;
    }
    const notifId = await scheduleNextLessonOneOff(focus, 5);
    if (notifId) setNextRemind({ slot: focus.slot, notifId });
    else Alert.alert('אי אפשר להוסיף תזכורת', 'השיעור קרוב מדי או כבר התחיל.');
  }

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: TOP, paddingBottom: 110 }} showsVerticalScrollIndicator={false}>
        <Text style={styles.dateLabel}>
          {new Date().toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' })}
        </Text>
        <Text style={styles.pageTitle}>היום</Text>

        <LinearGradient colors={[COLORS.purple, COLORS.pink]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.nextCard}>
          <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6 }}>
            {isNow && <View style={{ width: 6, height: 6, borderRadius: 99, backgroundColor: '#fff' }} />}
            <Text style={{ color: 'rgba(255,255,255,0.92)', fontSize: 12.5, fontWeight: '600' }}>
              {focus ? (isNow ? 'עכשיו · עד ' + focus.endTime : 'השיעור הבא · ' + focus.startTime) : 'אין עוד שיעורים היום'}
            </Text>
          </View>
          {focus ? (
            <>
              <Text style={{ color: '#fff', fontSize: 25, fontWeight: '700', marginTop: 9, textAlign: 'right' }}>{focus.name}</Text>
              <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 13, marginTop: 4, textAlign: 'right' }}>
                שיעור {focus.slot + 1} • {focus.startTime}–{focus.endTime} • כיתה {focus.room}{focus.teacher ? ' • ' + focus.teacher : ''}
              </Text>
            </>
          ) : (
            <Text style={{ color: '#fff', fontSize: 19, fontWeight: '700', marginTop: 9, textAlign: 'right' }}>
              {name ? name + ', סיימת להיום' : 'סיימת להיום'}
            </Text>
          )}
        </LinearGradient>

        <View style={styles.timerCard}>
          <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' }}>
            <View>
              <Text style={{ fontSize: 15.5, fontWeight: '700', color: COLORS.text, textAlign: 'right' }}>
                {timer.phase === 'break' ? 'הפסקה' : 'טיימר למידה'}
              </Text>
              <Text style={{ fontSize: 12.5, color: COLORS.textDim, marginTop: 3, textAlign: 'right' }}>
                {timer.phase === 'break' ? '5 דקות לנשום' : timer.duration + ' דקות'}
                {timer.rounds > 0 ? ' · ' + plural(timer.rounds, 'סבב אחד הושלם', 'סבבים הושלמו') : ''}
              </Text>
            </View>
            <Text style={{ fontSize: 34, fontWeight: '700', color: timer.running ? COLORS.purple : COLORS.text, letterSpacing: 0.5 }}>
              {mm}:{ss}
            </Text>
          </View>

          <View style={styles.timerTrack}>
            <View style={{ width: `${Math.min(100, Math.max(0, timer.progress * 100))}%`, height: '100%', borderRadius: 99, backgroundColor: timer.phase === 'break' ? COLORS.green : COLORS.purple }} />
          </View>

          <View style={{ flexDirection: 'row-reverse', gap: 8, marginTop: 14, alignItems: 'center' }}>
            <TouchableOpacity onPress={timer.toggle} style={[styles.timerBtn, timer.running && { backgroundColor: COLORS.text }]}>
              <Text style={{ color: '#fff', fontSize: 13.5, fontWeight: '700' }}>{timer.running ? 'עצירה' : timer.progress > 0 ? 'המשך' : 'התחלה'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={timer.reset} style={styles.timerBtnSecondary}>
              <Text style={{ color: '#6E6580', fontSize: 13.5, fontWeight: '600' }}>איפוס</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setPickDuration(v => !v)} style={styles.timerBtnSecondary}>
              <Text style={{ color: '#6E6580', fontSize: 13.5, fontWeight: '600' }}>{timer.duration} דק׳</Text>
            </TouchableOpacity>
          </View>

          {pickDuration && (
            <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8, marginTop: 13, borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 13 }}>
              {[10, 15, 20, 25, 30, 45, 60, 90].map(m => {
                const on = timer.duration === m;
                return (
                  <TouchableOpacity key={m} onPress={() => { timer.changeDuration(m); setPickDuration(false); }}
                    style={[styles.pill, on && { backgroundColor: COLORS.purple, borderColor: COLORS.purple }]}>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: on ? '#fff' : '#6E6580' }}>{m} דק׳</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, marginBottom: 11 }}>
          <Text style={styles.sectionTitle}>השיעורים שלי היום</Text>
        </View>

        {lessons.map(l => {
          const now = toMin(l.startTime) <= nowMin && toMin(l.endTime) > nowMin;
          const past = toMin(l.endTime) <= nowMin;
          const hw = hwFor(l.subjectId);
          return (
            <View key={l.slot} style={[styles.lessonRow, past && { opacity: 0.5 }]}>
              <View style={{ width: 52, alignItems: 'flex-end' }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: COLORS.text }}>{l.startTime}</Text>
                <Text style={{ fontSize: 11.5, color: COLORS.textFaint, marginTop: 1 }}>{l.endTime}</Text>
              </View>
              <View style={{ width: 4, borderRadius: 99, backgroundColor: l.color, alignSelf: 'stretch' }} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: COLORS.text, textAlign: 'right' }}>{l.name}</Text>
                <Text style={{ fontSize: 12, color: COLORS.textDim, marginTop: 3, textAlign: 'right' }}>
                  שיעור {l.slot + 1} • כיתה {l.room}{l.teacher ? ' • ' + l.teacher : ''}
                </Text>
              </View>
              {now ? (
                <View style={styles.nowTag}><Text style={{ color: '#fff', fontSize: 10.5, fontWeight: '700' }}>עכשיו</Text></View>
              ) : hw > 0 ? (
                <View style={[styles.hwBadge, { backgroundColor: l.color + '1F' }]}>
                  <Text style={{ fontSize: 10.5, fontWeight: '700', color: l.color }}>{plural(hw, 'משימה אחת', 'משימות')}</Text>
                </View>
              ) : null}
            </View>
          );
        })}
        {lessons.length === 0 && (
          <View style={styles.empty}>
            <Text style={{ fontSize: 15.5, fontWeight: '700', color: COLORS.text }}>אין שיעורים היום</Text>
            <Text style={{ fontSize: 13, color: COLORS.textDim, marginTop: 5 }}>יום חופש</Text>
          </View>
        )}

        {todayTasks.length > 0 && (
          <>

          <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={[styles.sectionTitle, { marginTop: 24, marginBottom: 11 }]}>להגיש היום</Text>
          </View>
            {todayTasks.map(t => (
              <View key={t.id} style={styles.taskMini}>
                <View style={[styles.letterDot, { backgroundColor: t.subjectColor || '#999', width: 20, height: 20 }]}>
                  <Text style={{ color: '#fff', fontSize: 9.5, fontWeight: '700' }}>{t.subjectLetter}</Text>
                </View>
                <Text style={{ flex: 1, fontSize: 14.5, fontWeight: '600', color: COLORS.text, textAlign: 'right' }}>{t.title}</Text>
                <Text style={{ fontSize: 12, color: COLORS.textDim }}>{t.dueTime || '18:00'}</Text>
              </View>
            ))}
          </>
        )}

        <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={[styles.sectionTitle, { marginTop: 24, marginBottom: 11 }]}>הערה ליום</Text>
        </View>

        {editingNote ? (
          <View style={styles.noteCard}>
            <TextInput value={note} onChangeText={setNote} multiline autoFocus
              placeholder="למשל: להביא אישור טיול" placeholderTextColor="#BFAF8C"
              style={{ fontSize: 14.5, minHeight: 60, textAlign: 'right', color: '#5C5340', lineHeight: 21 }} />
            <TouchableOpacity onPress={saveNote} style={{ marginTop: 8, alignSelf: 'flex-start' }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={{ color: COLORS.purple, fontWeight: '700' }}>שמירה</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity onPress={() => setEditingNote(true)} style={styles.noteCard} activeOpacity={0.8}>
            <Text style={{ fontSize: 14.5, color: '#5C5340', lineHeight: 21, textAlign: 'right' }}>{note || 'הקש כדי להוסיף הערה ליום'}</Text>
            <Text style={{ fontSize: 11.5, color: '#A79A78', marginTop: 8, textAlign: 'right' }}> לחיצה כדי לערוך</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  dateLabel: { fontSize: 13.5, color: COLORS.textDim, fontWeight: '500', textAlign: 'right' },
  pageTitle: { fontSize: 27, fontWeight: '700', color: COLORS.text, marginTop: 3, textAlign: 'right' },
  nextCard: { marginTop: 16, borderRadius: 24, padding: 18 },
  remindBtn: { marginTop: 12, alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 99, paddingVertical: 8, paddingHorizontal: 14 },
  timerCard: { marginTop: 14, backgroundColor: COLORS.card, borderRadius: 22, padding: 18 },
  timerTrack: { marginTop: 14, height: 8, borderRadius: 99, backgroundColor: '#F0EBF7', overflow: 'hidden', flexDirection: 'row-reverse' },
  timerRing: { width: 70, height: 70, borderRadius: 99, borderWidth: 3, borderColor: '#F0EBF7', alignItems: 'center', justifyContent: 'center' },
  timerBtn: { backgroundColor: COLORS.purple, borderRadius: 99, paddingVertical: 11, paddingHorizontal: 19, minHeight: 42, justifyContent: 'center' },
  timerBtnSecondary: { backgroundColor: '#F2EEF8', borderRadius: 99, paddingVertical: 11, paddingHorizontal: 17, minHeight: 42, justifyContent: 'center' },
  durationCard: { marginTop: 10, backgroundColor: COLORS.card, borderRadius: 20, padding: 15 },
  pill: { backgroundColor: '#F9F7FC', borderWidth: 1.5, borderColor: COLORS.line, borderRadius: 99, paddingVertical: 9, paddingHorizontal: 14, minHeight: 40, justifyContent: 'center' },
  sectionTitle: { fontSize: 16.5, fontWeight: '700', color: COLORS.text },
  lessonRow: { flexDirection: 'row-reverse', gap: 11, backgroundColor: COLORS.card, borderRadius: 18, padding: 14, marginBottom: 9, alignItems: 'center' },
  nowTag: { backgroundColor: COLORS.purple, borderRadius: 99, paddingVertical: 5, paddingHorizontal: 10 },
  hwBadge: { borderRadius: 99, paddingVertical: 5, paddingHorizontal: 10 },
  taskMini: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10, backgroundColor: COLORS.card, borderRadius: 16, padding: 13, marginBottom: 8 },
  letterDot: { borderRadius: 99, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', padding: 26, borderWidth: 1, borderColor: '#DDD5E8', borderStyle: 'dashed', borderRadius: 20 },
  noteCard: { backgroundColor: '#FFF8E9', borderRadius: 20, padding: 15, borderWidth: 1, borderColor: '#F6E7C4' },
  fab: { position: 'absolute', left: 20, bottom: 22, width: 60, height: 60, borderRadius: 99, backgroundColor: COLORS.purple, alignItems: 'center', justifyContent: 'center', elevation: 5, shadowColor: COLORS.purple, shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 5 } },
});