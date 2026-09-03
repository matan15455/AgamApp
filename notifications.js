// expo-notifications is loaded lazily (via require, on first real use) instead of
// a static top-level import. In Expo Go on Android (SDK 53+) merely importing this
// native module can throw during bundle evaluation — before the app has even
// mounted — which crashes with "[runtime not ready]". Requiring it lazily, inside
// a try/catch, means that if it fails, it fails quietly after the app is already
// running, and reminders are just silently unavailable instead of crashing the app.
// (This project only uses local/scheduled notifications — never push tokens — so
// there is no real feature loss here in Expo Go; it only matters once you move to
// a development build, where the module loads normally.)

let _mod = null;
let _failed = false;

function getModule() {
  if (_mod) return _mod;
  if (_failed) return null;
  try {
    const mod = require('expo-notifications');
    try {
      mod.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
        }),
      });
    } catch (e) {}
    _mod = mod;
    return _mod;
  } catch (e) {
    _failed = true;
    console.warn('[notifications] expo-notifications unavailable in this environment:', e?.message || e);
    return null;
  }
}

export async function requestPermissions() {
  const N = getModule();
  if (!N) return false;
  try {
    const { status } = await N.requestPermissionsAsync();
    return status === 'granted';
  } catch (e) { return false; }
}

export async function getPermissionGranted() {
  const N = getModule();
  if (!N) return false;
  try {
    const perm = await N.getPermissionsAsync();
    return perm.status === 'granted';
  } catch (e) { return false; }
}

/*
  remindKind is a short string so it stays editable and future-proof:
    'none'            – no reminder
    'at_due'          – exactly at the due time
    'before:<mins>'   – N minutes before the due time (fully adjustable, not fixed presets)
    'morning'         – 07:15 on the due date
    'daily:<HH:MM>'   – every day at that hour until it's marked done (any HH:MM, chosen with a time picker)
    'every:<hours>'   – repeating every N hours (adjustable 1–12)
*/

export const LESSON_BEFORE_PRESETS = [0, 5, 10, 15, 20, 30, 45, 60];

function dueDateTime(task) {
  const [y, m, d] = String(task.dueDate).split('-').map(Number);
  const [h, mi] = String(task.dueTime || '18:00').split(':').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, h, mi, 0, 0);
}

export async function scheduleTaskReminder(task) {
  const N = getModule();
  if (!N) return null;
  const kind = task.remindKind;
  if (!kind || kind === 'none') return null;

  const content = {
    title: 'תזכורת: ' + task.title,
    body: (task.type || 'משימה') + (task.subjectName ? ' · ' + task.subjectName : '') + ' · עד ' + (task.dueTime || '18:00'),
    sound: true,
  };

  try {
    // repeating: every day at a fixed hour
    if (kind.startsWith('daily:')) {
      const [h, m] = kind.slice(6).split(':').map(Number);
      return await N.scheduleNotificationAsync({
        content,
        trigger: { type: N.SchedulableTriggerInputTypes.DAILY, hour: h, minute: m },
      });
    }

    // repeating: every N hours
    if (kind.startsWith('every:')) {
      const hours = Number(kind.slice(6)) || 2;
      return await N.scheduleNotificationAsync({
        content,
        trigger: { type: N.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: hours * 3600, repeats: true },
      });
    }

    // one-off
    let fire;
    if (kind === 'at_due') fire = dueDateTime(task);
    else if (kind === 'morning') {
      const [y, m, d] = String(task.dueDate).split('-').map(Number);
      fire = new Date(y, (m || 1) - 1, d || 1, 7, 15, 0, 0);
    } else if (kind.startsWith('before:')) {
      const mins = Number(kind.slice(7)) || 60;
      fire = new Date(dueDateTime(task).getTime() - mins * 60000);
    } else fire = dueDateTime(task);

    if (fire.getTime() <= Date.now()) return null;
    return await N.scheduleNotificationAsync({
      content,
      trigger: { type: N.SchedulableTriggerInputTypes.DATE, date: fire },
    });
  } catch (e) {
    console.warn('[notifications] scheduleTaskReminder failed:', e?.message || e);
    return null;
  }
}

export async function cancelReminder(notifId) {
  if (!notifId) return;
  const N = getModule();
  if (!N) return;
  try { await N.cancelScheduledNotificationAsync(notifId); } catch (e) {}
}

// weekly reminder, N minutes before a lesson starts
export async function scheduleLessonReminder(day, startTime, subjectName, minutesBefore = 10, room) {
  const N = getModule();
  if (!N) return null;
  const [h, m] = String(startTime).split(':').map(Number);
  let total = h * 60 + m - minutesBefore;
  total = ((total % 1440) + 1440) % 1440;

  try {
    return await N.scheduleNotificationAsync({
      content: {
        title: minutesBefore === 0 ? subjectName + ' מתחיל עכשיו' : subjectName + ' מתחיל בקרוב',
        body: (minutesBefore === 0 ? 'שיעור ב-' + startTime : minutesBefore + ' דקות לשיעור (' + startTime + ')') + (room ? ' · כיתה ' + room : ''),
        sound: true,
      },
      trigger: {
        type: N.SchedulableTriggerInputTypes.WEEKLY,
        weekday: day + 1, // 1=Sunday..7=Saturday
        hour: Math.floor(total / 60),
        minute: total % 60,
      },
    });
  } catch (e) {
    console.warn('[notifications] scheduleLessonReminder failed:', e?.message || e);
    return null;
  }
}

// one-off "remind me before the next upcoming lesson" — fires once, today only
export async function scheduleNextLessonOneOff(lesson, minutesBefore = 5) {
  const N = getModule();
  if (!N) return null;
  const [h, m] = String(lesson.startTime).split(':').map(Number);
  const fire = new Date();
  fire.setHours(h, m - minutesBefore, 0, 0);
  if (fire.getTime() <= Date.now()) return null;

  try {
    return await N.scheduleNotificationAsync({
      content: {
        title: minutesBefore === 0 ? lesson.name + ' מתחיל עכשיו' : lesson.name + ' מתחיל בקרוב',
        body: (minutesBefore === 0 ? 'שיעור ב-' + lesson.startTime : minutesBefore + ' דקות לשיעור (' + lesson.startTime + ')') + (lesson.room ? ' · כיתה ' + lesson.room : ''),
        sound: true,
      },
      trigger: { type: N.SchedulableTriggerInputTypes.DATE, date: fire },
    });
  } catch (e) {
    console.warn('[notifications] scheduleNextLessonOneOff failed:', e?.message || e);
    return null;
  }
}

export async function cancelAll() {
  const N = getModule();
  if (!N) return;
  try { await N.cancelAllScheduledNotificationsAsync(); } catch (e) {}
}

// When would this reminder actually fire? null = repeating (always valid) / no reminder.
export function previewTaskReminder(task) {
  const kind = task.remindKind;
  if (!kind || kind === 'none' || kind.startsWith('daily:') || kind.startsWith('every:')) return null;
  if (kind === 'at_due') return dueDateTime(task);
  if (kind === 'morning') {
    const [y, m, d] = String(task.dueDate).split('-').map(Number);
    return new Date(y, (m || 1) - 1, d || 1, 7, 15, 0, 0);
  }
  if (kind.startsWith('before:')) {
    const mins = Number(kind.slice(7)) || 60;
    return new Date(dueDateTime(task).getTime() - mins * 60000);
  }
  return dueDateTime(task);
}

export function fmtWhen(d) {
  return d.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'numeric' }) +
    ' בשעה ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}