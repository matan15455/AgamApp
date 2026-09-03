import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS, TOP } from '../theme';
import { setSetting } from '../database';

const STEPS = [
  { n: '1', title: 'בונים את המערכת פעם אחת', sub: 'לוחצים על משבצת בטבלה ובוחרים מקצוע' },
  { n: '2', title: 'מוסיפים משימות בכפתור ה+', sub: 'שיעורי בית, מבחנים והגשות — עם תאריך ושעה' },
  { n: '3', title: 'מאשרים התראות', sub: 'כדי שהתזכורות יגיעו בזמן, גם בלי אינטרנט' },
];

export default function WelcomeScreen({ onDone }) {
  async function start() {
    await setSetting('onboarded', true);
    onDone();
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#FBF9FD' }}>
      <View style={{ flex: 1, paddingHorizontal: 26, paddingTop: TOP + 30 }}>
        <View style={styles.logo} />
        <Text style={styles.title}>ברוכה הבאה{'\n'}למערכת שלך</Text>
        <Text style={styles.sub}>מערכת שעות, שיעורי בית ומבחנים — במקום אחד, עם תזכורות שמגיעות בזמן.</Text>

        <View style={{ marginTop: 30, gap: 12 }}>
          {STEPS.map(s => (
            <View key={s.n} style={{ flexDirection: 'row-reverse', gap: 12, alignItems: 'flex-start' }}>
              <View style={styles.stepNum}><Text style={{ color: COLORS.purple, fontWeight: '700', fontSize: 13 }}>{s.n}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '500', color: COLORS.text, textAlign: 'right' }}>{s.title}</Text>
                <Text style={{ fontSize: 13, color: COLORS.textDim, marginTop: 2, textAlign: 'right', lineHeight: 19 }}>{s.sub}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      <View style={{ paddingHorizontal: 22, paddingBottom: 46 }}>
        <TouchableOpacity onPress={start} style={styles.cta}>
          <Text style={{ color: '#fff', fontSize: 16.5, fontWeight: '700' }}>בואי נתחיל</Text>
        </TouchableOpacity>
        <Text style={{ textAlign: 'center', fontSize: 12.5, color: '#A79FB4', marginTop: 12 }}>הכול נשמר רק בטלפון הזה · אפשר לתת שם בהגדרות מתי שרוצים</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  logo: { width: 60, height: 60, borderRadius: 18, backgroundColor: COLORS.purple },
  title: { fontSize: 31, fontWeight: '700', color: COLORS.text, marginTop: 22, textAlign: 'right', lineHeight: 39 },
  sub: { fontSize: 15, color: '#7C7489', marginTop: 10, textAlign: 'right', lineHeight: 24 },
  stepNum: { width: 28, height: 28, borderRadius: 99, backgroundColor: COLORS.purpleTint, alignItems: 'center', justifyContent: 'center' },
  cta: { backgroundColor: COLORS.purple, borderRadius: 20, paddingVertical: 17, alignItems: 'center' },
});