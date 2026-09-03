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
      remindBefore INTEGER DEFAULT 10,
      room TEXT,
      teacher TEXT,
      startTime TEXT,
      endTime TEXT,
      notifId TEXT,
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
  // migrations for DBs created by earlier versions
  for (const col of ['room TEXT', 'teacher TEXT', 'startTime TEXT', 'endTime TEXT', 'notifId TEXT', 'remindBefore INTEGER DEFAULT 10']) {
    try { await db.execAsync(`ALTER TABLE lessons ADD COLUMN ${col}`); } catch (e) {}
  }
  await seedIfEmpty();
  await topUpHours();
  return db;
}

const DEFAULT_SUBJECTS = [
  ['math', 'מתמטיקה', 'מתמט׳', 'מת', '#5B7CE8', '11/3', 'ר. לוי'],
  ['eng', 'אנגלית', 'אנגל׳', 'אנ', '#E8749E', '11/3', 'ד. כהן'],
  ['lit', 'ספרות', 'ספרות', 'ספ', '#7C5CD3', '9/2', 'מ. אביב'],
  ['heb', 'לשון', 'לשון', 'לש', '#C77DDF', '11/3', 'ע. בר'],
  ['hist', 'היסטוריה', 'היסט׳', 'הי', '#DE9448', '8/1', 'א. נוי'],
  ['bio', 'ביולוגיה', 'ביולו׳', 'בי', '#33A87D', 'מעבדה', 'ל. שגב'],
  ['phy', 'פיזיקה', 'פיזי׳', 'פי', '#3FA5BC', 'מעבדה 2', 'ג. דהן'],
  ['sport', 'חנ״ג', 'חנ״ג', 'חנ', '#8B839A', 'אולם', 'ט. מור'],
];

const DEFAULT_HOURS = [
  [0, '08:00', '08:45'], [1, '08:50', '09:35'], [2, '09:50', '10:35'], [3, '10:40', '11:25'],
  [4, '11:40', '12:25'], [5, '12:30', '13:15'], [6, '13:30', '14:15'], [7, '14:20', '15:05'],
  [8, '15:10', '15:55'], [9, '16:00', '16:45'], [10, '16:50', '17:35'],
];

async function seedIfEmpty() {
  const row = await db.getFirstAsync('SELECT COUNT(*) AS n FROM subjects');
  if (row.n > 0) return;
  for (const s of DEFAULT_SUBJECTS) {
    await db.runAsync('INSERT INTO subjects (id,name,short,letter,color,room,teacher) VALUES (?,?,?,?,?,?,?)', s);
  }
  for (const h of DEFAULT_HOURS) {
    await db.runAsync('INSERT INTO hours (slot,startTime,endTime) VALUES (?,?,?)', h);
  }
}

// existing installs were created with 8 slots — add any missing ones without touching edits
async function topUpHours() {
  for (const [slot, start, end] of DEFAULT_HOURS) {
    await db.runAsync('INSERT OR IGNORE INTO hours (slot,startTime,endTime) VALUES (?,?,?)', [slot, start, end]);
  }
}

/* ---------- מקצועות ---------- */
export const getSubjects = () => db.getAllAsync('SELECT * FROM subjects ORDER BY rowid');

export const saveSubject = (s) => db.runAsync(
  `INSERT INTO subjects (id,name,short,letter,color,room,teacher) VALUES (?,?,?,?,?,?,?)
   ON CONFLICT(id) DO UPDATE SET name=excluded.name, short=excluded.short, letter=excluded.letter,
   color=excluded.color, room=excluded.room, teacher=excluded.teacher`,
  [s.id, s.name, s.short, s.letter, s.color, s.room, s.teacher]
);

export const deleteSubject = async (id) => {
  await db.runAsync('DELETE FROM lessons WHERE subjectId = ?', [id]);
  await db.runAsync('UPDATE tasks SET subjectId = NULL WHERE subjectId = ?', [id]);
  await db.runAsync('DELETE FROM subjects WHERE id = ?', [id]);
};

export const subjectUsage = async (id) => {
  const l = await db.getFirstAsync('SELECT COUNT(*) AS n FROM lessons WHERE subjectId = ?', [id]);
  const t = await db.getFirstAsync('SELECT COUNT(*) AS n FROM tasks WHERE subjectId = ? AND done = 0', [id]);
  return { lessons: l.n, tasks: t.n };
};

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
// room is per-cell (it changes week to week); teacher comes from the subject
export const getSchedule = () => db.getAllAsync(
  `SELECT l.day, l.slot, l.remind, l.notifId, COALESCE(l.remindBefore, 10) AS remindBefore,
          s.id AS subjectId, s.name, s.short, s.letter, s.color,
          l.room AS room,
          s.teacher AS teacher,
          COALESCE(l.startTime, h.startTime) AS startTime,
          COALESCE(l.endTime, h.endTime) AS endTime
   FROM lessons l
   JOIN subjects s ON s.id = l.subjectId
   LEFT JOIN hours h ON h.slot = l.slot
   ORDER BY l.day, l.slot`
);

export const setLesson = (day, slot, v) => db.runAsync(
  `INSERT INTO lessons (day,slot,subjectId,remind,remindBefore,room,teacher,startTime,endTime) VALUES (?,?,?,?,?,?,?,?,?)
   ON CONFLICT(day,slot) DO UPDATE SET subjectId=excluded.subjectId, remind=excluded.remind,
   remindBefore=excluded.remindBefore, room=excluded.room, teacher=excluded.teacher,
   startTime=excluded.startTime, endTime=excluded.endTime`,
  [day, slot, v.subjectId, v.remind ? 1 : 0, v.remindBefore == null ? 10 : v.remindBefore,
   v.room || null, v.teacher || null, v.startTime || null, v.endTime || null]
);

export const setLessonNotifId = (day, slot, notifId) =>
  db.runAsync('UPDATE lessons SET notifId = ? WHERE day = ? AND slot = ?', [notifId, day, slot]);

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
  if (!db) return fallback;
  const row = await db.getFirstAsync('SELECT value FROM settings WHERE key = ?', [key]);
  if (!row) return fallback;
  try { return JSON.parse(row.value); } catch (e) { return fallback; }
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
