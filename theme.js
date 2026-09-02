export const COLORS = {
  bg: '#F7F4FB',
  card: '#FFFFFF',
  text: '#2A2233',
  textDim: '#9C94AB',
  textFaint: '#B6AEC4',
  purple: '#7C5CD3',
  purpleTint: '#F2EDFA',
  pink: '#E8749E',
  pinkTint: '#FDEDF3',
  red: '#D2544F',
  redTint: '#FDEEEE',
  green: '#1F8A63',
  greenTint: '#E8F6EF',
  border: '#F3EFF8',
};

export const FONT = {
  regular: 'System',
};

export const DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי'];
export const DAYS_SHORT = ['א', 'ב', 'ג', 'ד', 'ה', 'ו'];

export function todayIndex() {
  // JS getDay(): 0=Sunday..6=Saturday, matches our DAYS array for 0-5
  return new Date().getDay();
}

export function fmtDate(d) {
  return d.getDate() + '.' + (d.getMonth() + 1);
}

export function addDays(base, n) {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  return d;
}

export function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

export function dueInfo(dueDateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDateStr);
  due.setHours(0, 0, 0, 0);
  const diffDays = Math.round((due - today) / 86400000);
  const wd = due.getDay();
  return {
    diffDays,
    dayName: DAYS[wd],
    dateLabel: fmtDate(due),
    overdue: diffDays < 0,
    isToday: diffDays === 0,
    isTomorrow: diffDays === 1,
  };
}
