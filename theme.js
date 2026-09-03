import { Platform, StatusBar } from 'react-native';

export const COLORS = {
  bg: '#F7F4FB',
  card: '#FFFFFF',
  text: '#2A2233',
  textDim: '#9C94AB',
  textFaint: '#B6AEC4',
  purple: '#7C5CD3',
  purpleDeep: '#6B47C9',
  purpleTint: '#F2EDFA',
  pink: '#E8749E',
  pinkTint: '#FDEDF3',
  red: '#D2544F',
  redTint: '#FDEEEE',
  green: '#1F8A63',
  greenTint: '#E8F6EF',
  border: '#F3EFF8',
  line: '#EDE9F3',
};

// safe top inset — keeps titles clear of the notch / status bar
export const TOP = Platform.OS === 'ios' ? 58 : (StatusBar.currentHeight || 24) + 14;

export const PALETTE = [
  '#5B7CE8', '#E8749E', '#7C5CD3', '#C77DDF', '#DE9448',
  '#33A87D', '#3FA5BC', '#8B839A', '#D2544F', '#E0B33C',
  '#5FA85C', '#B5647D',
];

export const DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי'];
export const DAYS_SHORT = ['א', 'ב', 'ג', 'ד', 'ה', 'ו'];
export const DAYS_ALL = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
export const DAYS_SHORT_ALL = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];

export function todayIndex() { return new Date().getDay(); }

export function fmtDate(d) { return d.getDate() + '.' + (d.getMonth() + 1); }

export function addDays(base, n) {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  return d;
}

export function isoDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function dateOfWeekday(wd) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return addDays(today, wd - today.getDay());
}

export function dueInfo(dueDateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [y, m, d] = String(dueDateStr).split('-').map(Number);
  const due = new Date(y, (m || 1) - 1, d || 1);
  due.setHours(0, 0, 0, 0);
  const diffDays = Math.round((due - today) / 86400000);
  const wd = due.getDay();
  return {
    diffDays,
    dayName: DAYS_ALL[wd],
    dayShort: DAYS_SHORT_ALL[wd],
    dateLabel: fmtDate(due),
    overdue: diffDays < 0,
    isToday: diffDays === 0,
    isTomorrow: diffDays === 1,
  };
}

export function toMin(t) {
  const [h, m] = String(t).split(':').map(Number);
  return h * 60 + m;
}

export function fmtMin(total) {
  total = ((total % 1440) + 1440) % 1440;
  return String(Math.floor(total / 60)).padStart(2, '0') + ':' + String(total % 60).padStart(2, '0');
}

export function shiftTime(t, delta) { return fmtMin(toMin(t) + delta); }

export function plural(n, one, many) { return n === 1 ? one : n + ' ' + many; }

// "45 דקות" / "שעה" / "שעתיים" / "3 שעות" / "יום" / "יומיים"
export function humanDuration(mins) {
  if (mins < 60) return mins + ' דקות';
  if (mins === 60) return 'שעה';
  if (mins === 120) return 'שעתיים';
  if (mins % 1440 === 0) {
    const d = mins / 1440;
    return d === 1 ? 'יום' : d === 2 ? 'יומיים' : d + ' ימים';
  }
  if (mins % 60 === 0) return (mins / 60) + ' שעות';
  return Math.floor(mins / 60) + ':' + String(mins % 60).padStart(2, '0') + ' שעות';
}
