import * as Notifications from 'expo-notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function requestPermissions() {
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

/*
  remindKind is a short string so it stays editable and future-proof:
    'none'            – no reminder
    'at_due'          – exactly at the due time
    'before:<mins>'   – N minutes before the due time (30, 60, 120, 1440, 2880, 10080...)
    'morning'         – 07:15 on the due date
    'daily:<HH:MM>'   – every day at that hour until it's marked done
    'every:<hours>'   – repeating every N hours
*/

export const TASK_REMIND_PRESETS = [
  { key: 'none', label: 'בלי תזכורת' },
  { key: 'at_due', label: 'בשעת ההגשה' },
  { key: 'before:15', label: '15 דקות לפני' },
  { key: 'before:30', label: 'חצי שעה לפני' },
  { key: 'before:60', label: 'שעה לפני' },
  { key: 'before:120', label: 'שעתיים לפני' },
  { key: 'before:180', label: '3 שעות לפני' },
  { key: 'morning', label: 'בבוקר של אותו יום · 07:15' },
  { key: 'before:1440', label: 'יום לפני' },
  { key: 'before:2880', label: 'יומיים לפני' },
  { key: 'before:10080', label: 'שבוע לפני' },
  { key: 'daily:08:00', label: 'כל יום ב-08:00' },
  { key: 'daily:16:00', label: 'כל יום ב-16:00' },
  { key: 'daily:20:00', label: 'כל יום ב-20:00' },
  { key: 'every:2', label: 'כל שעתיים' },
  { key: 'every:4', label: 'כל 4 שעות' },
  { key: 'every:6', label: 'כל 6 שעות' },
];

export const LESSON_BEFORE_PRESETS = [0, 5, 10, 15, 20, 30, 45, 60];

function dueDateTime(task) {
  const [y, m, d] = String(task.dueDate).split('-').map(Number);
  const [h, mi] = String(task.dueTime || '18:00').split(':').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, h, mi, 0, 0);
}

export async function scheduleTaskReminder(task) {
  const kind = task.remindKind;
  if (!kind || kind === 'none') return null;

  const content = {
    title: 'תזכורת: ' + task.title,
    body: (task.type || 'משימה') + (task.subjectName ? ' · ' + task.subjectName : '') + ' · עד ' + (task.dueTime || '18:00'),
    sound: true,
  };

  // repeating: every day at a fixed hour
  if (kind.startsWith('daily:')) {
    const [h, m] = kind.slice(6).split(':').map(Number);
    return Notifications.scheduleNotificationAsync({
      content,
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: h, minute: m },
    });
  }

  // repeating: every N hours
  if (kind.startsWith('every:')) {
    const hours = Number(kind.slice(6)) || 2;
    return Notifications.scheduleNotificationAsync({
      content,
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: hours * 3600, repeats: true },
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
  return Notifications.scheduleNotificationAsync({
    content,
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fire },
  });
}

export async function cancelReminder(notifId) {
  if (!notifId) return;
  try { await Notifications.cancelScheduledNotificationAsync(notifId); } catch (e) {}
}

// weekly reminder, N minutes before a lesson starts
export async function scheduleLessonReminder(day, startTime, subjectName, minutesBefore = 10, room) {
  const [h, m] = String(startTime).split(':').map(Number);
  let total = h * 60 + m - minutesBefore;
  total = ((total % 1440) + 1440) % 1440;

  return Notifications.scheduleNotificationAsync({
    content: {
      title: minutesBefore === 0 ? subjectName + ' מתחיל עכשיו' : subjectName + ' מתחיל בקרוב',
      body: (minutesBefore === 0 ? 'שיעור ב-' + startTime : minutesBefore + ' דקות לשיעור (' + startTime + ')') + (room ? ' · כיתה ' + room : ''),
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: day + 1, // 1=Sunday..7=Saturday
      hour: Math.floor(total / 60),
      minute: total % 60,
    },
  });
}

export const cancelAll = () => Notifications.cancelAllScheduledNotificationsAsync();

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
