import * as SQLite from 'expo-sqlite';

let db;

export async function initDB() {
  db = await SQLite.openDatabaseAsync('maarechet.db');
  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS subjects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      short TEXT,
      letter TEXT,
      color TEXT,
      room TEXT,
      teacher TEXT
    );

    CREATE TABLE IF NOT EXISTS hours (
      slot INTEGER PRIMARY KEY,
      startTime TEXT NOT NULL,
      endTime TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS lessons (
      day INTEGER NOT NULL,
      slot INTEGER NOT NULL,
      subjectId TEXT NOT NULL,
      remind INTEGER DEFAULT 1,
      PRIMARY KEY (day, slot)
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      subjectId TEXT,
      type TEXT,
      dueDate TEXT,
      dueTime TEXT DEFAULT '18:00',
      done INTEGER DEFAULT 0,
      remindKind TEXT,
      notifId TEXT,
      createdAt TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);
  await seedIfEmpty();
  return db;
}

const DEFAULT_SUBJECTS = [
  ['math', 'מתמטיקה', 'מתמט׳', 'מת', '#5B7CE8', '11/3', ''],
  ['eng', 'אנגלית', 'אנגל׳', 'אנ', '#E8749E', '11/3', ''],
  ['lit', 'ספרות', 'ספרות', 'ספ', '#7C5CD3', '9/2', ''],
  ['heb', 'לשון', 'לשון', 'לש', '#C77DDF', '11/3', ''],
  ['hist', 'היסטוריה', 'היסט׳', 'הי', '#DE9448', '8/1', ''],
  ['bio', 'ביולוגיה', 'ביולו׳', 'בי', '#33A87D', 'מעבדה', ''],
  ['phy', 'פיזיקה', 'פיזי׳', 'פי', '#3FA5BC', 'מעבדה 2', ''],
  ['sport', 'חנ״ג', 'חנ״ג', 'חנ', '#8B839A', 'אולם', ''],
];

const DEFAULT_HOURS = [
  [0, '08:00', '08:45'], [1, '08:50', '09:35'], [2, '09:50', '10:35'], [3, '10:40', '11:25'],
  [4, '11:40', '12:25'], [5, '12:30', '13:15'], [6, '13:30', '14:15'], [7, '14:20', '15:05'],
];

async function seedIfEmpty() {
  const row = await db.getFirstAsync('SELECT COUNT(*) AS n FROM subjects');
  if (row.n > 0) return;
  for (const s of DEFAULT_SUBJECTS) {
    await db.runAsync(
      'INSERT INTO subjects (id,name,short,letter,color,room,teacher) VALUES (?,?,?,?,?,?,?)', s
    );
  }
  for (const h of DEFAULT_HOURS) {
    await db.runAsync('INSERT INTO hours (slot,startTime,endTime) VALUES (?,?,?)', h);
  }
}

/* ---------- מקצועות ---------- */
export const getSubjects = () => db.getAllAsync('SELECT * FROM subjects ORDER BY name');

export const saveSubject = (s) => db.runAsync(
  `INSERT INTO subjects (id,name,short,letter,color,room,teacher) VALUES (?,?,?,?,?,?,?)
   ON CONFLICT(id) DO UPDATE SET name=excluded.name, short=excluded.short, letter=excluded.letter,
   color=excluded.color, room=excluded.room, teacher=excluded.teacher`,
  [s.id, s.name, s.short, s.letter, s.color, s.room, s.teacher]
);

export const deleteSubject = (id) => db.runAsync('DELETE FROM subjects WHERE id = ?', [id]);

/* ---------- שעות המערכת ---------- */
export const getHours = () => db.getAllAsync('SELECT * FROM hours ORDER BY slot');

export const setHour = (slot, startTime, endTime) => db.runAsync(
  `INSERT INTO hours (slot,startTime,endTime) VALUES (?,?,?)
   ON CONFLICT(slot) DO UPDATE SET startTime=excluded.startTime, endTime=excluded.endTime`,
  [slot, startTime, endTime]
);

export const resetHours = async () => {
  await db.runAsync('DELETE FROM hours');
  for (const h of DEFAULT_HOURS) await db.runAsync('INSERT INTO hours (slot,startTime,endTime) VALUES (?,?,?)', h);
};

/* ---------- מערכת שעות ---------- */
export const getSchedule = () => db.getAllAsync(
  `SELECT l.day, l.slot, l.remind, s.id AS subjectId, s.name, s.short, s.letter, s.color, s.room, s.teacher,
          h.startTime, h.endTime
   FROM lessons l
   JOIN subjects s ON s.id = l.subjectId
   JOIN hours h ON h.slot = l.slot
   ORDER BY l.day, l.slot`
);

export const getDaySchedule = (day) => db.getAllAsync(
  `SELECT l.day, l.slot, l.remind, s.id AS subjectId, s.name, s.color, s.room, s.teacher,
          h.startTime, h.endTime
   FROM lessons l
   JOIN subjects s ON s.id = l.subjectId
   JOIN hours h ON h.slot = l.slot
   WHERE l.day = ? ORDER BY l.slot`,
  [day]
);

export const setLesson = (day, slot, subjectId, remind = 1) => db.runAsync(
  `INSERT INTO lessons (day,slot,subjectId,remind) VALUES (?,?,?,?)
   ON CONFLICT(day,slot) DO UPDATE SET subjectId=excluded.subjectId, remind=excluded.remind`,
  [day, slot, subjectId, remind ? 1 : 0]
);

export const clearLesson = (day, slot) =>
  db.runAsync('DELETE FROM lessons WHERE day = ? AND slot = ?', [day, slot]);

/* ---------- משימות ---------- */
export const getTasks = () => db.getAllAsync(
  `SELECT t.*, s.name AS subjectName, s.color AS subjectColor, s.letter AS subjectLetter
   FROM tasks t LEFT JOIN subjects s ON s.id = t.subjectId
   ORDER BY t.done ASC, t.dueDate ASC, t.id DESC`
);

export const addTask = async (t) => {
  const r = await db.runAsync(
    `INSERT INTO tasks (title,subjectId,type,dueDate,dueTime,remindKind) VALUES (?,?,?,?,?,?)`,
    [t.title, t.subjectId, t.type, t.dueDate, t.dueTime || '18:00', t.remindKind || null]
  );
  return r.lastInsertRowId;
};

export const updateTask = (id, t) => db.runAsync(
  `UPDATE tasks SET title=?, subjectId=?, type=?, dueDate=?, dueTime=?, remindKind=? WHERE id=?`,
  [t.title, t.subjectId, t.type, t.dueDate, t.dueTime || '18:00', t.remindKind || null, id]
);

export const toggleTask = (id, done) =>
  db.runAsync('UPDATE tasks SET done = ? WHERE id = ?', [done ? 1 : 0, id]);

export const deleteTask = (id) => db.runAsync('DELETE FROM tasks WHERE id = ?', [id]);

export const setTaskNotifId = (id, notifId) =>
  db.runAsync('UPDATE tasks SET notifId = ? WHERE id = ?', [notifId, id]);

/* ---------- הגדרות ---------- */
export const getSetting = async (key, fallback = null) => {
  const row = await db.getFirstAsync('SELECT value FROM settings WHERE key = ?', [key]);
  return row ? JSON.parse(row.value) : fallback;
};

export const setSetting = (key, value) => db.runAsync(
  `INSERT INTO settings (key,value) VALUES (?,?)
   ON CONFLICT(key) DO UPDATE SET value=excluded.value`,
  [key, JSON.stringify(value)]
);

/* ---------- גיבוי / איפוס ---------- */
export const exportAll = async () => ({
  subjects: await getSubjects(),
  hours: await getHours(),
  lessons: await db.getAllAsync('SELECT * FROM lessons'),
  tasks: await db.getAllAsync('SELECT * FROM tasks'),
  exportedAt: new Date().toISOString(),
});

export const wipeAll = async () => {
  await db.execAsync('DELETE FROM tasks; DELETE FROM lessons; DELETE FROM settings;');
};
