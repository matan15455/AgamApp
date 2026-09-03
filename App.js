import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity, StyleSheet, LogBox } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { initDB, getSetting } from './database';
import { requestPermissions } from './notifications';
import { COLORS } from './theme';
import WelcomeScreen from './screens/WelcomeScreen';
import TodayScreen from './screens/TodayScreen';
import ScheduleScreen from './screens/ScheduleScreen';
import TasksScreen from './screens/TasksScreen';
import SettingsScreen from './screens/SettingsScreen';
import SubjectsScreen from './screens/SubjectsScreen';
import { TimerProvider, useTimer } from './TimerContext';

// AgamApp only schedules local reminders — it never uses push tokens or remote
// notifications — so this Expo Go warning (SDK 53+) is harmless noise here.
LogBox.ignoreLogs(['was removed from Expo Go']);

const TABS = [
  { key: 'today', label: 'היום', icon: '◗' },
  { key: 'week', label: 'מערכת', icon: '▦' },
  { key: 'tasks', label: 'משימות', icon: '✓' },
  { key: 'settings', label: 'הגדרות', icon: '⚙' },
];

export default function App() {
  return (
    <SafeAreaProvider>
      <Root />
    </SafeAreaProvider>
  );
}

function Root() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);
  const [onboarded, setOnboarded] = useState(true);
  const [tab, setTab] = useState('today');
  const [scheduleView, setScheduleView] = useState('week');
  const [subjectsOpen, setSubjectsOpen] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        await initDB();
        setOnboarded(await getSetting('onboarded', false));
        await requestPermissions();
        setReady(true);
      } catch (e) { setError(String(e)); }
    })();
  }, []);

  if (error) return <View style={styles.center}><Text style={{ color: COLORS.red, padding: 24, textAlign: 'center' }}>{error}</Text></View>;
  if (!ready) return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.purple} /></View>;
  if (!onboarded) return <WelcomeScreen onDone={() => setOnboarded(true)} />;
  if (subjectsOpen) return <SubjectsScreen onBack={() => setSubjectsOpen(false)} />;

  return (
    <TimerProvider>
      <Shell tab={tab} setTab={setTab} scheduleView={scheduleView} setScheduleView={setScheduleView} setSubjectsOpen={setSubjectsOpen} />
    </TimerProvider>
  );
}

function Shell({ tab, setTab, scheduleView, setScheduleView, setSubjectsOpen }) {
  // real device inset (Android nav bar — gesture pill or 3-button bar — and iOS home indicator),
  // not a guessed constant, so the tab bar never sits under the system navigation
  const insets = useSafeAreaInsets();
  const tabBarBottomPadding = 11 + insets.bottom;

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <View style={{ flex: 1 }}>
        {tab === 'today' && (
          <TodayScreen onOpenWeek={() => { setScheduleView('week'); setTab('week'); }} />
        )}
        {tab === 'week' && <ScheduleScreen initialView={scheduleView} />}
        {tab === 'tasks' && <TasksScreen onOpenSettings={() => setTab('settings')} />}
        {tab === 'settings' && <SettingsScreen onOpenSubjects={() => setSubjectsOpen(true)} />}
      </View>

      <View style={[styles.tabBar, { paddingBottom: tabBarBottomPadding }]}>
        {TABS.map(t => {
          const on = tab === t.key;
          return (
            <TouchableOpacity key={t.key} style={styles.tabItem} onPress={() => setTab(t.key)} hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}>
              <Text style={{ fontSize: 15, color: on ? COLORS.purple : '#BDB5C9', marginBottom: 3 }}>{t.icon}</Text>
              <Text style={{ fontSize: 12, fontWeight: on ? '700' : '500', color: on ? COLORS.purple : '#A79FB4' }}>{t.label}</Text>
              <View style={{ width: 20, height: 3, borderRadius: 99, marginTop: 5, backgroundColor: on ? COLORS.purple : 'transparent' }} />
            </TouchableOpacity>
          );
        })}
      </View>
      <TimerBar visible={tab !== 'today'} onOpen={() => setTab('today')} bottomOffset={68 + tabBarBottomPadding} />
    </View>
  );
}

// floating strip that shows the study timer while you're on another screen
function TimerBar({ visible, onOpen, bottomOffset }) {
  const timer = useTimer();
  if (!visible || !timer || (!timer.running && timer.progress === 0)) return null;
  return (
    <TouchableOpacity onPress={onOpen} activeOpacity={0.85} style={[styles.timerBar, { bottom: bottomOffset }]}>
      <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 9 }}>
        <View style={{ width: 8, height: 8, borderRadius: 99, backgroundColor: timer.running ? (timer.phase === 'break' ? COLORS.green : COLORS.purple) : '#C9C1D6' }} />
        <Text style={{ fontSize: 13, fontWeight: '600', color: COLORS.text }}>
          {timer.phase === 'break' ? 'הפסקה' : 'טיימר לימודים'}{timer.running ? '' : ' · בהשהיה'}
        </Text>
      </View>
      <Text style={{ fontSize: 16, fontWeight: '700', color: COLORS.purple }}>{timer.mm}:{timer.ss}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.bg },
  timerBar: { position: 'absolute', left: 16, right: 16, flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', borderRadius: 99, paddingVertical: 11, paddingHorizontal: 16, elevation: 4, shadowColor: '#2A2233', shadowOpacity: 0.14, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  tabBar: { flexDirection: 'row-reverse', paddingTop: 11, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: COLORS.border },
  tabItem: { flex: 1, alignItems: 'center', minHeight: 52, justifyContent: 'center' },
});