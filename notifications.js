import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

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

// Computes the actual Date the reminder should fire, based on task due date + kind.
function computeFireDate(task) {
  const [y, m, d] = task.dueDate.split('-').map(Number);
  const due = new Date(y, m - 1, d);

  switch (task.remindKind) {
    case 'due_morning':
      due.setHours(7, 15, 0, 0);
      break;
    case 'due_1h':
      due.setHours(17, 0, 0, 0);
      break;
    case 'day_before':
      due.setDate(due.getDate() - 1);
      due.setHours(18, 0, 0, 0);
      break;
    default:
      due.setHours(18, 0, 0, 0);
  }
  return due;
}

export async function scheduleTaskReminder(task) {
  if (!task.remindKind || task.remindKind === 'none') return null;
  const fireDate = computeFireDate(task);
  if (fireDate.getTime() <= Date.now()) return null; // don't schedule in the past

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'תזכורת: ' + task.title,
      body: task.type + (task.subjectName ? ' · ' + task.subjectName : ''),
      sound: true,
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fireDate },
  });
  return id;
}

export async function cancelReminder(notifId) {
  if (!notifId) return;
  try { await Notifications.cancelScheduledNotificationAsync(notifId); } catch (e) {}
}

// Schedules a reminder before a lesson, repeating weekly on that day.
export async function scheduleLessonReminder(day, startTime, subjectName, minutesBefore = 10) {
  const [h, m] = startTime.split(':').map(Number);
  let hour = h, minute = m - minutesBefore;
  if (minute < 0) { minute += 60; hour -= 1; }

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: subjectName + ' מתחיל בקרוב',
      body: minutesBefore + ' דקות לשיעור',
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: day + 1, // expo weekday: 1=Sunday..7=Saturday
      hour,
      minute,
    },
  });
  return id;
}
