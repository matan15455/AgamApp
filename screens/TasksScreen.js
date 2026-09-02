import { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput, Modal, Platform, KeyboardAvoidingView, TouchableWithoutFeedback } from 'react-native';
import { COLORS } from '../theme';
import { dueInfo, isoDate, addDays } from '../theme';
import { getTasks, getSubjects, addTask, updateTask, toggleTask, deleteTask, setTaskNotifId } from '../database';
import { scheduleTaskReminder, cancelReminder } from '../notifications';

const TYPES = ['שיעורי בית', 'מבחן', 'עבודה', 'תזכורת'];
const REMIND_OPTIONS = [
  { key: 'none', label: 'בלי תזכורת' },
  { key: 'due_morning', label: 'בבוקר של היום' },
  { key: 'due_1h', label: 'שעה לפני 18:00' },
  { key: 'day_before', label: 'יום לפני, 18:00' },
];

export default function TasksScreen() {
  const [tasks, setTasks] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [filter, setFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [draft, setDraft] = useState(blankDraft());

  function blankDraft() {
    return { title: '', subjectId: 'math', type: 'שיעורי בית', dueDate: isoDate(new Date()), remindKind: 'day_before' };
  }

  const load = useCallback(async () => {
    setTasks(await getTasks());
    setSubjects(await getSubjects());
  }, []);

  useEffect(() => { load(); }, [load]);

  const subjById = (id) => subjects.find(s => s.id === id) || {};

  const filtered = tasks.filter(t => {
    if (filter === 'done') return t.done;
    if (filter === 'today') return !t.done && dueInfo(t.dueDate).diffDays <= 0;
    if (filter === 'week') return !t.done && dueInfo(t.dueDate).diffDays >= 0 && dueInfo(t.dueDate).diffDays < 7;
    return true;
  });

  const groups = [
    { key: 'late', label: 'באיחור', test: t => !t.done && dueInfo(t.dueDate).diffDays < 0 },
    { key: 'today', label: 'להיום', test: t => !t.done && dueInfo(t.dueDate).diffDays === 0 },
    { key: 'tomorrow', label: 'למחר', test: t => !t.done && dueInfo(t.dueDate).diffDays === 1 },
    { key: 'week', label: 'בהמשך השבוע', test: t => !t.done && dueInfo(t.dueDate).diffDays > 1 },
    { key: 'done', label: 'בוצעו', test: t => t.done },
  ].map(g => ({ ...g, items: filtered.filter(g.test) })).filter(g => g.items.length);

  const openCount = tasks.filter(t => !t.done).length;
  const doneCount = tasks.length - openCount;

  async function onToggle(task) {
    await toggleTask(task.id, !task.done);
    if (!task.done && task.notifId) await cancelReminder(task.notifId);
    await load();
  }

  async function onSave() {
    const payload = { ...draft, title: draft.title.trim() || (draft.type + ' ב' + subjById(draft.subjectId).name) };
    let id = editId;
    const existing = tasks.find(t => t.id === editId);
    if (editId) {
      await updateTask(editId, payload);
    } else {
      id = await addTask(payload);
    }
    if (existing && existing.notifId) await cancelReminder(existing.notifId);
    if (draft.remindKind !== 'none') {
      const notifId = await scheduleTaskReminder({ ...payload, id, subjectName: subjById(draft.subjectId).name });
      if (notifId) await setTaskNotifId(id, notifId);
    }
    setModalOpen(false);
    setEditId(null);
    setDraft(blankDraft());
    await load();
  }

  function openEdit(task) {
    setEditId(task.id);
    setDraft({ title: task.title, subjectId: task.subjectId, type: task.type, dueDate: task.dueDate, remindKind: task.remindKind || 'none' });
    setModalOpen(true);
  }

  function openNew() {
    setEditId(null);
    setDraft(blankDraft());
    setModalOpen(true);
  }

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 54, paddingBottom: 100 }}>
        <Text style={styles.dateLabel}>
          {new Date().toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'numeric' })}
        </Text>
        <Text style={styles.pageTitle}>המשימות שלי</Text>

        <View style={styles.progressCard}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 14.5, fontWeight: '500', color: COLORS.text, textAlign: 'right' }}>
              {openCount === 0 ? 'סיימת הכול, כל הכבוד!' : openCount + ' משימות פתוחות'}
            </Text>
            <Text style={{ fontSize: 13, color: COLORS.textDim }}>{doneCount}/{tasks.length} בוצעו</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${tasks.length ? (doneCount / tasks.length) * 100 : 0}%` }]} />
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 8, marginVertical: 16, flexWrap: 'wrap' }}>
          {[{ k: 'all', l: 'הכול' }, { k: 'today', l: 'להיום' }, { k: 'week', l: 'השבוע' }, { k: 'done', l: 'בוצעו' }].map(f => (
            <TouchableOpacity key={f.k} onPress={() => setFilter(f.k)}
              style={[styles.chip, filter === f.k && { backgroundColor: COLORS.text }]}>
              <Text style={{ color: filter === f.k ? '#fff' : '#6E6580', fontSize: 14, fontWeight: '500' }}>{f.l}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {groups.map(g => (
          <View key={g.key} style={{ marginBottom: 20 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 9 }}>
              <Text style={{ fontSize: 14.5, fontWeight: '600', color: g.key === 'late' ? COLORS.red : COLORS.text }}>{g.label}</Text>
              <Text style={{ fontSize: 13, color: COLORS.textFaint }}>{g.items.length}</Text>
            </View>
            {g.items.map(t => {
              const s = subjById(t.subjectId);
              const di = dueInfo(t.dueDate);
              return (
                <View key={t.id} style={styles.taskRow}>
                  <TouchableOpacity onPress={() => onToggle(t)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    style={[styles.checkbox, { borderColor: t.done ? COLORS.purple : '#D9D2E4', backgroundColor: t.done ? COLORS.purple : '#fff' }]}>
                    {t.done && <Text style={{ color: '#fff', fontSize: 14 }}>✓</Text>}
                  </TouchableOpacity>
                  <TouchableOpacity style={{ flex: 1 }} onPress={() => openEdit(t)}>
                    <Text style={{ fontSize: 16, fontWeight: '500', color: t.done ? '#A79FB4' : COLORS.text, textDecorationLine: t.done ? 'line-through' : 'none', textAlign: 'right' }}>
                      {t.title}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 5, flexWrap: 'wrap' }}>
                      <View style={[styles.subjTag, { backgroundColor: s.color ? s.color + '22' : '#eee' }]}>
                        <Text style={{ fontSize: 12, fontWeight: '500', color: s.color || '#888' }}>{s.name}</Text>
                      </View>
                      <Text style={{ fontSize: 12.5, color: di.overdue ? COLORS.red : COLORS.textDim }}>
                        {di.overdue ? 'עבר · אתמול' : di.isToday ? 'היום' : di.isTomorrow ? 'מחר' : 'יום ' + di.dayName}
                      </Text>
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={async () => { await deleteTask(t.id); await load(); }}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} style={{ padding: 8 }}>
                    <Text style={{ color: '#CFC8DA', fontSize: 16 }}>✕</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        ))}

        {groups.length === 0 && (
          <View style={styles.empty}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: COLORS.text }}>אין כאן משימות</Text>
            <Text style={{ fontSize: 14, color: COLORS.textDim, marginTop: 6, textAlign: 'center' }}>
              כל מה שצריך להגיש, ללמוד או לזכור — נוסיף בכפתור ה+
            </Text>
          </View>
        )}
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={openNew}>
        <Text style={{ color: '#fff', fontSize: 30, fontWeight: '300', marginTop: -2 }}>+</Text>
      </TouchableOpacity>

      <Modal visible={modalOpen} animationType="slide" transparent onRequestClose={() => setModalOpen(false)}>
        <View style={{ flex: 1 }}>
          <TouchableWithoutFeedback onPress={() => setModalOpen(false)}>
            <View style={styles.modalOverlay} />
          </TouchableWithoutFeedback>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ justifyContent: 'flex-end' }} pointerEvents="box-none">
            <View style={styles.sheet}>
              <View style={styles.sheetHandle} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <TouchableOpacity onPress={() => setModalOpen(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Text style={{ color: '#8B839A', fontSize: 15 }}>ביטול</Text>
                </TouchableOpacity>
                <Text style={{ fontSize: 17, fontWeight: '700' }}>{editId ? 'עריכת משימה' : 'משימה חדשה'}</Text>
                <TouchableOpacity onPress={onSave} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Text style={{ color: COLORS.purple, fontWeight: '700', fontSize: 15 }}>שמירה</Text>
                </TouchableOpacity>
              </View>

              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} style={{ marginTop: 4 }}>
                <TextInput
                  value={draft.title}
                  onChangeText={v => setDraft(d => ({ ...d, title: v }))}
                  placeholder="למשל: תרגילים 1–8 בחוברת"
                  style={styles.input}
                />

                <Text style={styles.label}>מקצוע</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {subjects.map(s => (
                    <TouchableOpacity key={s.id} onPress={() => setDraft(d => ({ ...d, subjectId: s.id }))}
                      style={[styles.subjChip, { borderColor: draft.subjectId === s.id ? s.color : '#EDE9F3', backgroundColor: draft.subjectId === s.id ? s.color + '22' : '#fff' }]}>
                      <Text style={{ color: s.color, fontWeight: '500', fontSize: 13.5 }}>{s.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.label}>סוג</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {TYPES.map(t => (
                    <TouchableOpacity key={t} onPress={() => setDraft(d => ({ ...d, type: t }))}
                      style={[styles.typeChip, draft.type === t && { backgroundColor: COLORS.text }]}>
                      <Text style={{ fontSize: 13.5, color: draft.type === t ? '#fff' : '#6E6580' }}>{t}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.label}>תאריך הגשה</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {[0, 1, 3, 7].map(off => {
                    const d = addDays(new Date(), off);
                    const iso = isoDate(d);
                    const active = draft.dueDate === iso;
                    return (
                      <TouchableOpacity key={off} onPress={() => setDraft(dr => ({ ...dr, dueDate: iso }))}
                        style={[styles.dueChip, active && { backgroundColor: COLORS.purpleTint }]}>
                        <Text style={{ fontSize: 13.5, color: active ? COLORS.purple : '#6E6580', fontWeight: '500' }}>
                          {off === 0 ? 'היום' : off === 1 ? 'מחר' : off + ' ימים'}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={styles.label}>תזכורת</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
                  {REMIND_OPTIONS.map(r => (
                    <TouchableOpacity key={r.key} onPress={() => setDraft(d => ({ ...d, remindKind: r.key }))}
                      style={[styles.remindChip, draft.remindKind === r.key && { backgroundColor: COLORS.purple }]}>
                      <Text style={{ fontSize: 13.5, color: draft.remindKind === r.key ? '#fff' : '#6E6580' }}>{r.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  dateLabel: { fontSize: 14, color: COLORS.textDim, fontWeight: '500', textAlign: 'right' },
  pageTitle: { fontSize: 30, fontWeight: '700', color: COLORS.text, marginTop: 4, textAlign: 'right' },
  progressCard: { marginTop: 16, backgroundColor: COLORS.card, borderRadius: 20, padding: 16 },
  progressTrack: { marginTop: 11, height: 9, borderRadius: 99, backgroundColor: '#F0EBF7', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 99, backgroundColor: COLORS.purple },
  chip: { borderRadius: 99, paddingVertical: 11, paddingHorizontal: 16, backgroundColor: '#fff', minHeight: 44, justifyContent: 'center' },
  taskRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: COLORS.card, borderRadius: 18, padding: 14, marginBottom: 9 },
  checkbox: { width: 30, height: 30, borderRadius: 99, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  subjTag: { borderRadius: 99, paddingVertical: 4, paddingHorizontal: 9 },
  empty: { marginTop: 30, alignItems: 'center', padding: 34, borderWidth: 1, borderColor: '#DDD5E8', borderStyle: 'dashed', borderRadius: 22 },
  fab: { position: 'absolute', left: 20, bottom: 24, width: 60, height: 60, borderRadius: 99, backgroundColor: COLORS.purple, alignItems: 'center', justifyContent: 'center', elevation: 4, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8 },
  modalOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(35,27,45,0.4)' },
  sheet: { backgroundColor: '#FBF9FD', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, maxHeight: '88%' },
  sheetHandle: { width: 38, height: 4, borderRadius: 99, backgroundColor: '#DDD6E6', alignSelf: 'center', marginBottom: 12 },
  input: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginTop: 16, fontSize: 17, textAlign: 'right', minHeight: 52 },
  label: { fontSize: 13.5, fontWeight: '600', color: COLORS.textDim, marginTop: 18, marginBottom: 9, textAlign: 'right' },
  subjChip: { borderWidth: 1.5, borderRadius: 99, paddingVertical: 10, paddingHorizontal: 14, minHeight: 44, justifyContent: 'center' },
  typeChip: { flex: 1, backgroundColor: '#fff', borderRadius: 14, paddingVertical: 13, alignItems: 'center', minHeight: 44, justifyContent: 'center' },
  dueChip: { flex: 1, backgroundColor: '#fff', borderRadius: 14, paddingVertical: 13, alignItems: 'center', minHeight: 44, justifyContent: 'center' },
  remindChip: { backgroundColor: '#fff', borderRadius: 99, paddingVertical: 11, paddingHorizontal: 15, minHeight: 44, justifyContent: 'center' },
});
