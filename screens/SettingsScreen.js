import { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Switch, Alert, TextInput } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { COLORS, TOP } from '../theme';
import { getSubjects, getSetting, setSetting, exportAll, wipeAll } from '../database';
import { requestPermissions } from '../notifications';

export default function SettingsScreen({ onOpenSubjects }) {
  const [subjects, setSubjects] = useState([]);
  const [permGranted, setPermGranted] = useState(true);
  const [morning, setMorning] = useState(true);
  const [lessonRemind, setLessonRemind] = useState(true);
  const [name, setName] = useState('');

  const load = useCallback(async () => {
    setSubjects(await getSubjects());
    setMorning(await getSetting('morningSummary', true));
    setLessonRemind(await getSetting('lessonReminders', true));
    setName(await getSetting('studentName', ''));
    const perm = await Notifications.getPermissionsAsync();
    setPermGranted(perm.status === 'granted');
  }, []);
  useEffect(() => { load(); }, [load]);

  async function onBackup() {
    const data = await exportAll();
    const uri = FileSystem.documentDirectory + 'maarechet-backup.json';
    await FileSystem.writeAsStringAsync(uri, JSON.stringify(data, null, 2));
    if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri);
    else Alert.alert('הגיבוי נשמר', uri);
  }

  function onReset() {
    Alert.alert('איפוס הכול', 'כל המשימות והמערכת יימחקו. לא ניתן לבטל.', [
      { text: 'ביטול', style: 'cancel' },
      { text: 'איפוס', style: 'destructive', onPress: async () => { await wipeAll(); await load(); Alert.alert('בוצע', 'הכול נמחק.'); } },
    ]);
  }

  async function testNotification() {
    if (!permGranted) {
      const ok = await requestPermissions();
      setPermGranted(ok);
      if (!ok) return Alert.alert('אין הרשאה', 'צריך לאשר התראות בהגדרות הטלפון.');
    }
    await Notifications.scheduleNotificationAsync({
      content: { title: 'תזכורת לדוגמה', body: 'כך תיראה תזכורת אמיתית.', sound: true },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 3, repeats: false },
    });
    Alert.alert('נשלח', 'ההתראה תופיע בעוד 3 שניות.');
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: COLORS.bg }} contentContainerStyle={{ padding: 20, paddingTop: TOP, paddingBottom: 110 }} showsVerticalScrollIndicator={false}>
      <Text style={{ fontSize: 27, fontWeight: '700', color: COLORS.text, textAlign: 'right' }}>הגדרות</Text>

      <View style={[styles.card, { marginTop: 18, padding: 16 }]}>
        <Text style={styles.rowSub}>איך לקרוא לך?</Text>
        <TextInput value={name} onChangeText={setName} onBlur={() => setSetting('studentName', name.trim())}
          placeholder="השם שלך" placeholderTextColor="#C6BFD2"
          style={{ fontSize: 18, fontWeight: '700', color: COLORS.text, textAlign: 'right', marginTop: 4, padding: 0, minHeight: 30 }} />
      </View>

      <Text style={styles.sectionLabel}>תזכורות</Text>
      <View style={styles.card}>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>התראות במכשיר</Text>
            <Text style={styles.rowSub}>{permGranted ? 'מאושר · עובד גם בלי אינטרנט' : 'לא מאושר — הקישי לאישור'}</Text>
          </View>
          {permGranted ? (
            <View style={styles.badge}><Text style={{ color: COLORS.green, fontSize: 11, fontWeight: '700' }}>פעיל</Text></View>
          ) : (
            <TouchableOpacity onPress={testNotification} style={styles.badgeWarn}><Text style={{ color: '#B36B00', fontSize: 11, fontWeight: '700' }}>לאשר</Text></TouchableOpacity>
          )}
        </View>
        <View style={styles.divider} />
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>סיכום בוקר</Text>
            <Text style={styles.rowSub}>כל בוקר ב-07:15</Text>
          </View>
          <Switch value={morning} onValueChange={v => { setMorning(v); setSetting('morningSummary', v); }}
            trackColor={{ true: COLORS.purple, false: '#DFD8E9' }} thumbColor="#fff" />
        </View>
        <View style={styles.divider} />
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>תזכורת לפני שיעור</Text>
            <Text style={styles.rowSub}>רק בשיעורים שסימנת במערכת</Text>
          </View>
          <Switch value={lessonRemind} onValueChange={v => { setLessonRemind(v); setSetting('lessonReminders', v); }}
            trackColor={{ true: COLORS.purple, false: '#DFD8E9' }} thumbColor="#fff" />
        </View>
      </View>

      <Text style={styles.sectionLabel}>מקצועות</Text>
      <View style={styles.card}>
        <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8, padding: 15 }}>
          {subjects.map(s => (
            <View key={s.id} style={[styles.subjTag, { backgroundColor: s.color + '1C' }]}>
              <View style={[styles.letterDot, { backgroundColor: s.color }]}>
                <Text style={{ color: '#fff', fontSize: 8, fontWeight: '700' }}>{s.letter}</Text>
              </View>
              <Text style={{ color: s.color, fontSize: 12, fontWeight: '600' }}>{s.name}</Text>
            </View>
          ))}
          {subjects.length === 0 && <Text style={styles.rowSub}>אין עדיין מקצועות</Text>}
        </View>
        <View style={styles.divider} />
        <TouchableOpacity onPress={onOpenSubjects} style={{ padding: 16 }}>
          <Text style={{ color: COLORS.purple, fontSize: 15, fontWeight: '600', textAlign: 'right' }}>ניהול מקצועות · הוספה, צבע, כיתה ומורה</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionLabel}>הנתונים שלי</Text>
      <View style={styles.card}>
        <View style={{ padding: 15 }}>
          <Text style={styles.rowTitle}>הכול נשמר בטלפון שלך</Text>
          <Text style={[styles.rowSub, { marginTop: 3, lineHeight: 19 }]}>בלי חשבון, בלי סיסמה ובלי אינטרנט. אפשר לשמור גיבוי לקובץ ולהעביר לטלפון אחר.</Text>
        </View>
        <View style={styles.divider} />
        <TouchableOpacity onPress={onBackup} style={{ padding: 16 }}>
          <Text style={{ color: COLORS.purple, fontSize: 15, fontWeight: '600', textAlign: 'right' }}>שמירת גיבוי</Text>
        </TouchableOpacity>
        <View style={styles.divider} />
        <TouchableOpacity onPress={onReset} style={{ padding: 16 }}>
          <Text style={{ color: COLORS.red, fontSize: 15, fontWeight: '600', textAlign: 'right' }}>איפוס הכול</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity onPress={testNotification} style={styles.testBtn}>
        <Text style={{ color: '#7C7489', fontSize: 13.5, fontWeight: '600' }}>בדיקה: הצגת תזכורת לדוגמה</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  sectionLabel: { fontSize: 12.5, fontWeight: '700', color: COLORS.textDim, marginTop: 22, marginBottom: 9, textAlign: 'right' },
  card: { backgroundColor: COLORS.card, borderRadius: 20, overflow: 'hidden' },
  row: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12, padding: 15 },
  rowTitle: { fontSize: 15, fontWeight: '600', color: COLORS.text, textAlign: 'right' },
  rowSub: { fontSize: 12.5, color: COLORS.textDim, marginTop: 2, textAlign: 'right' },
  divider: { height: 1, backgroundColor: COLORS.border, marginHorizontal: 16 },
  badge: { backgroundColor: COLORS.greenTint, borderRadius: 99, paddingVertical: 6, paddingHorizontal: 11 },
  badgeWarn: { backgroundColor: '#FDF2E7', borderRadius: 99, paddingVertical: 6, paddingHorizontal: 11 },
  subjTag: { borderRadius: 99, paddingVertical: 7, paddingHorizontal: 10, flexDirection: 'row-reverse', alignItems: 'center', gap: 6 },
  letterDot: { width: 16, height: 16, borderRadius: 99, alignItems: 'center', justifyContent: 'center' },
  testBtn: { marginTop: 18, borderWidth: 1, borderColor: '#D8D0E4', borderStyle: 'dashed', borderRadius: 16, padding: 14, alignItems: 'center' },
});
