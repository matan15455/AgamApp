import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity, StyleSheet, I18nManager } from 'react-native';
import { initDB } from './database';

if (!I18nManager.isRTL) {
  I18nManager.allowRTL(true);
  I18nManager.forceRTL(true);
}
import { requestPermissions } from './notifications';
import TasksScreen from './screens/TasksScreen';
import ScheduleScreen from './screens/ScheduleScreen';
import TodayScreen from './screens/TodayScreen';
import SettingsScreen from './screens/SettingsScreen';
import { COLORS } from './theme';

const TABS = [
  { key: 'tasks', label: 'משימות' },
  { key: 'week', label: 'מערכת' },
  { key: 'today', label: 'היום' },
  { key: 'settings', label: 'הגדרות' },
];

export default function App() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('tasks');

  useEffect(() => {
    initDB()
      .then(() => requestPermissions())
      .then(() => setReady(true))
      .catch(e => setError(String(e)));
  }, []);

  if (error) {
    return <View style={styles.center}><Text style={{ color: 'red', padding: 20, textAlign: 'center' }}>{error}</Text></View>;
  }
  if (!ready) {
    return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.purple} /></View>;
  }

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <View style={{ flex: 1 }}>
        {tab === 'tasks' && <TasksScreen />}
        {tab === 'week' && <ScheduleScreen />}
        {tab === 'today' && <TodayScreen />}
        {tab === 'settings' && <SettingsScreen />}
      </View>

      <View style={styles.tabBar}>
        {TABS.map(t => (
          <TouchableOpacity key={t.key} style={styles.tabItem} onPress={() => setTab(t.key)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={{ fontSize: 14, fontWeight: tab === t.key ? '700' : '500', color: tab === t.key ? COLORS.purple : '#A79FB4' }}>
              {t.label}
            </Text>
            <View style={{ width: 22, height: 3.5, borderRadius: 99, marginTop: 6, backgroundColor: tab === t.key ? COLORS.purple : 'transparent' }} />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tabBar: { flexDirection: 'row', paddingTop: 13, paddingBottom: 28, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: COLORS.border },
  tabItem: { flex: 1, alignItems: 'center', minHeight: 44, justifyContent: 'center' },
});
