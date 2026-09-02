import { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Switch, Alert } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { COLORS } from '../theme';
import { getSubjects, getSetting, setSetting, exportAll, wipeAll } from '../database';
import { requestPermissions } from '../notifications';

export default function SettingsScreen() {
  const [subjects, setSubjects] = useState([]);
  const [permGranted, setPermGranted] = useState(true);
  const [morning, setMorning] = useState(true);
  const [lessonRemind, setLessonRemind] = useState(true);

  const load = useCallback(async () => {
    setSubjects(await getSubjects());
    setMorning(await getSetting('morningSummary', true));
    setLessonRemind(await getSetting('lessonReminders', true));
    const perm = await Notifications.getPermissionsAsync();
    setPermGranted(perm.status === 'granted');
  }, []);
  useEffect(() => { load(); }, [load]);

  async function toggleMorning(v) { setMorning(v); await setSetting('morningSummary', v); }
  async function toggleLessonRemind(v) { setLessonRemind(v); await setSetting('lessonReminders', v); }

  async function onBackup() {
    const data = await exportAll();
    const uri = FileSystem.documentDirectory + 'maarechet-backup.json';
    await FileSystem.writeAsStringAsync(uri, JSON.stringify(data, null, 2));
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri);
    } else {
      Alert.alert('הגיבוי נשמר', uri);
    }
  }

  function onReset() {
    Alert.alert('איפוס הכול', 'כל המשימות והמערכת יימחקו. לא ניתן לבטל.', [
      { text: 'ביטול', style: 'cancel' },
      { text: 'איפוס', style: 'destructive', onPress: async () => { await wipeAll(); await load(); Alert.alert('אופס', 'הכול נמחק.'); } },
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
    <ScrollView style={{ flex: 1, backgroundColor: COLORS.bg }} contentContainerStyle={{ padding: 20, paddingTop: 54, paddingBottom: 100 }}>
      <Text style={{ fontSize: 26, fontWeight: '700', color: COLORS.text }}>הגדרות</Text>

      <Text style={styles.sectionLabel}>תזכורות</Text>
      <View style={styles.card}>
        <View style={styles.row}>
          <View>
            <Text style={styles.rowTitle}>התראות במכשיר</Text>
            <Text style={styles.rowSub}>{permGranted ? 'מאושר · עובד גם בלי אינטרנט' : 'לא מאושר — הקישי לאישור'}</Text>
          </View>
          {permGranted ? (
            <View style={styles.badge}><Text style={{ color: COLORS.green, fontSize: 11, fontWeight: '600' }}>פעיל</Text></View>
          ) : (
            <TouchableOpacity onPress={testNotification} style={styles.badgeWarn}><Text style={{ color: '#B36B00', fontSize: 11, fontWeight: '600' }}>לאשר</Text></TouchableOpacity>
          )}
        </View>
        <View style={styles.divider} />
        <View style={styles.row}>
          <View>
            <Text style={styles.rowTitle}>סיכום בוקר</Text>
            <Text style={styles.rowSub}>כל בוקר ב-07:15</Text>
          </View>
          <Switch value={morning} onValueChange={toggleMorning} trackColor={{ true: COLORS.purple }} />
        </View>
        <View style={styles.divider} />
        <View style={styles.row}>
          <View>
            <Text style={styles.rowTitle}>תזכורת לפני שיעור</Text>
            <Text style={styles.rowSub}>רק במקצועות שבחרת</Text>
          </View>
          <Switch value={lessonRemind} onValueChange={toggleLessonRemind} trackColor={{ true: COLORS.purple }} />
        </View>
      </View>

      <Text style={styles.sectionLabel}>מקצועות</Text>
      <View style={[styles.card, { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 7, padding: 14 }]}>
        {subjects.map(s => (
          <View key={s.id} style={[styles.subjTag, { backgroundColor: s.color + '1E' }]}>
            <Text style={{ color: s.color, fontSize: 12, fontWeight: '500' }}>{s.name}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.sectionLabel}>הנתונים שלי</Text>
      <View style={styles.card}>
        <View style={{ padding: 15 }}>
          <Text style={styles.rowTitle}>הכול נשמר בטלפון שלך</Text>
          <Text style={[styles.rowSub, { marginTop: 3, lineHeight: 18 }]}>בלי חשבון, בלי סיסמה ובלי אינטרנט. אפשר לשמור גיבוי לקובץ ולהעביר לטלפון אחר.</Text>
        </View>
        <View style={styles.divider} />
        <TouchableOpacity onPress={onBackup} style={{ padding: 15 }}>
          <Text style={{ color: COLORS.purple, fontSize: 15, fontWeight: '500', textAlign: 'right' }}>שמירת גיבוי</Text>
        </TouchableOpacity>
        <View style={styles.divider} />
        <TouchableOpacity onPress={onReset} style={{ padding: 15 }}>
          <Text style={{ color: COLORS.red, fontSize: 15, fontWeight: '500', textAlign: 'right' }}>איפוס הכול</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity onPress={testNotification} style={styles.testBtn}>
        <Text style={{ color: '#7C7489', fontSize: 13.5, fontWeight: '500' }}>בדיקה: הצגת תזכורת לדוגמה</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  sectionLabel: { fontSize: 12.5, fontWeight: '600', color: COLORS.textDim, marginTop: 22, marginBottom: 8 },
  card: { backgroundColor: COLORS.card, borderRadius: 20, overflow: 'hidden' },
  row: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', padding: 15 },
  rowTitle: { fontSize: 15, fontWeight: '500', color: COLORS.text },
  rowSub: { fontSize: 12.5, color: COLORS.textDim, marginTop: 2 },
  divider: { height: 1, backgroundColor: COLORS.border, marginHorizontal: 16 },
  badge: { backgroundColor: COLORS.greenTint, borderRadius: 99, paddingVertical: 5, paddingHorizontal: 10 },
  badgeWarn: { backgroundColor: '#FDF2E7', borderRadius: 99, paddingVertical: 5, paddingHorizontal: 10 },
  subjTag: { borderRadius: 99, paddingVertical: 6, paddingHorizontal: 11 },
  testBtn: { marginTop: 18, borderWidth: 1, borderColor: '#D8D0E4', borderStyle: 'dashed', borderRadius: 16, padding: 13, alignItems: 'center' },
});
