import { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput } from 'react-native';
import { COLORS, todayIndex } from '../theme';
import { getSchedule, getSetting, setSetting } from '../database';

const TODAY = todayIndex() > 5 ? 0 : todayIndex();
const NOW_MIN = new Date().getHours() * 60 + new Date().getMinutes();

function toMin(t) { const [h, m] = t.split(':').map(Number); return h * 60 + m; }

export default function TodayScreen() {
  const [lessons, setLessons] = useState([]);
  const [note, setNote] = useState('');
  const [editingNote, setEditingNote] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const timerRef = useRef(null);

  const load = useCallback(async () => {
    const all = await getSchedule();
    setLessons(all.filter(l => l.day === TODAY).sort((a, b) => a.slot - b.slot));
    setNote(await getSetting('dayNote', ''));
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => () => clearInterval(timerRef.current), []);

  function toggleTimer() {
    if (running) {
      clearInterval(timerRef.current);
      setRunning(false);
    } else {
      setRunning(true);
      timerRef.current = setInterval(() => {
        setSecondsLeft(s => {
          if (s <= 1) { clearInterval(timerRef.current); setRunning(false); return 0; }
          return s - 1;
        });
      }, 1000);
    }
  }
  function resetTimer() { clearInterval(timerRef.current); setRunning(false); setSecondsLeft(25 * 60); }

  const nextLesson = lessons.find(l => toMin(l.endTime) > NOW_MIN) || null;
  const isNow = nextLesson && toMin(nextLesson.startTime) <= NOW_MIN && toMin(nextLesson.endTime) > NOW_MIN;

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const ss = String(secondsLeft % 60).padStart(2, '0');

  async function saveNote() {
    await setSetting('dayNote', note);
    setEditingNote(false);
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: COLORS.bg }} contentContainerStyle={{ padding: 20, paddingTop: 54, paddingBottom: 100 }}>
      <Text style={{ fontSize: 14, color: COLORS.textDim, fontWeight: '500', textAlign: 'right' }}>
        {new Date().toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'numeric' })}
      </Text>
      <Text style={{ fontSize: 30, fontWeight: '700', color: COLORS.text, marginTop: 4, textAlign: 'right' }}>היום</Text>

      <View style={styles.nextCard}>
        <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 12, fontWeight: '500' }}>
          {nextLesson ? (isNow ? 'עכשיו · עד ' + nextLesson.endTime : 'השיעור הבא') : 'אין עוד שיעורים היום'}
        </Text>
        {nextLesson && (
          <>
            <Text style={{ color: '#fff', fontSize: 24, fontWeight: '700', marginTop: 8 }}>{nextLesson.name}</Text>
            <Text style={{ color: 'rgba(255,255,255,0.88)', fontSize: 13.5, marginTop: 3 }}>
              {nextLesson.startTime}–{nextLesson.endTime} · כיתה {nextLesson.room}
            </Text>
          </>
        )}
      </View>

      <View style={[styles.timerCard, { flexDirection: 'row-reverse' }]}>
        <View style={styles.timerCircle}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: COLORS.text }}>{mm}:{ss}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: '600', color: COLORS.text }}>טיימר לימודים</Text>
          <Text style={{ fontSize: 12.5, color: COLORS.textDim, marginTop: 2 }}>25 דקות ריכוז, אחר כך הפסקה</Text>
          <View style={{ flexDirection: 'row-reverse', gap: 7, marginTop: 10 }}>
            <TouchableOpacity onPress={toggleTimer} style={styles.timerBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={{ color: '#fff', fontSize: 13.5, fontWeight: '600' }}>{running ? 'עצירה' : 'התחלה'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={resetTimer} style={styles.timerBtnSecondary} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={{ color: '#6E6580', fontSize: 13.5 }}>איפוס</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <Text style={styles.sectionTitle}>השיעורים שלי</Text>
      {lessons.map(l => {
        const now = toMin(l.startTime) <= NOW_MIN && toMin(l.endTime) > NOW_MIN;
        const past = toMin(l.endTime) <= NOW_MIN;
        return (
          <View key={l.slot} style={[styles.lessonRow, past && { opacity: 0.55 }, { flexDirection: 'row-reverse' }]}>
            <View style={{ width: 48, alignItems: 'center' }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: COLORS.text }}>{l.startTime}</Text>
              <Text style={{ fontSize: 10.5, color: COLORS.textFaint }}>{l.endTime}</Text>
            </View>
            <View style={{ width: 4, borderRadius: 99, backgroundColor: l.color, alignSelf: 'stretch' }} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '500', color: COLORS.text }}>{l.name}</Text>
              <Text style={{ fontSize: 12, color: COLORS.textDim, marginTop: 2 }}>כיתה {l.room}</Text>
            </View>
            {now && <View style={styles.nowTag}><Text style={{ color: '#fff', fontSize: 10.5, fontWeight: '600' }}>עכשיו</Text></View>}
          </View>
        );
      })}
      {lessons.length === 0 && <Text style={{ color: COLORS.textDim, marginTop: 4 }}>אין שיעורים היום</Text>}

      <Text style={styles.sectionTitle}>הערה ליום</Text>
      {editingNote ? (
        <View style={styles.noteCard}>
          <TextInput value={note} onChangeText={setNote} multiline style={{ fontSize: 14, minHeight: 60, textAlign: 'right' }} placeholder="למשל: להביא אישור טיול" />
          <TouchableOpacity onPress={saveNote} style={{ marginTop: 8, alignSelf: 'flex-end' }}>
            <Text style={{ color: COLORS.purple, fontWeight: '700' }}>שמירה</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity onPress={() => setEditingNote(true)} style={styles.noteCard}>
          <Text style={{ fontSize: 14, color: '#5C5340', lineHeight: 21 }}>{note || 'הקישי כדי להוסיף הערה ליום'}</Text>
          <Text style={{ fontSize: 11.5, color: '#A79A78', marginTop: 8 }}>נשמר בטלפון · לחיצה כדי לערוך</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  nextCard: { marginTop: 16, borderRadius: 24, padding: 18, backgroundColor: COLORS.purple },
  timerCard: { marginTop: 14, backgroundColor: COLORS.card, borderRadius: 22, padding: 16, flexDirection: 'row', gap: 16, alignItems: 'center' },
  timerCircle: { width: 66, height: 66, borderRadius: 99, backgroundColor: COLORS.purpleTint, alignItems: 'center', justifyContent: 'center' },
  timerBtn: { backgroundColor: COLORS.purple, borderRadius: 99, paddingVertical: 11, paddingHorizontal: 18, minHeight: 44, justifyContent: 'center' },
  timerBtnSecondary: { backgroundColor: '#F2EEF8', borderRadius: 99, paddingVertical: 11, paddingHorizontal: 16, minHeight: 44, justifyContent: 'center' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginTop: 22, marginBottom: 10 },
  lessonRow: { flexDirection: 'row', gap: 12, backgroundColor: COLORS.card, borderRadius: 18, padding: 13, marginBottom: 8, alignItems: 'stretch' },
  nowTag: { alignSelf: 'center', backgroundColor: COLORS.purple, borderRadius: 99, paddingVertical: 4, paddingHorizontal: 9 },
  noteCard: { backgroundColor: '#FFF8E9', borderRadius: 20, padding: 15, borderWidth: 1, borderColor: '#F6E7C4' },
});
