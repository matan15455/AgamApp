import { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput, Modal, Platform, KeyboardAvoidingView, TouchableWithoutFeedback, Alert } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, TOP, dueInfo, isoDate, addDays, plural } from '../theme';
import { getTasks, getSubjects, addTask, updateTask, toggleTask, deleteTask, setTaskNotifId, getSetting } from '../database';
import { scheduleTaskReminder, cancelReminder, TASK_REMIND_PRESETS, previewTaskReminder, fmtWhen } from '../notifications';

const TYPES = ['שיעורי בית', 'מבחן', 'עבודה', 'תזכורת'];

function timeToDate(t) {
  const [h, m] = (t || '18:00').split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}
function dateToTime(d) {
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

export default function TasksScreen({ onOpenSettings }) {
  const [tasks, setTasks] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [name, setName] = useState('');
  const [filter, setFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [draft, setDraft] = useState(blankDraft());
  const [picker, setPicker] = useState(null);

  function blankDraft() {
    return { title: '', subjectId: 'math', type: 'שיעורי בית', dueDate: isoDate(new Date()), dueTime: '18:00', remindKind: 'before:1440' };
  }

  const load = useCallback(async () => {
    setTasks(await getTasks());
    setSubjects(await getSubjects());
    setName(await getSetting('studentName', ''));
  }, []);
  useEffect(() => { load(); }, [load]);

  const subjById = (id) => subjects.find(s => s.id === id) || {};

  const filtered = tasks.filter(t => {
    const di = dueInfo(t.dueDate);
    if (filter === 'done') return !!t.done;
    if (filter === 'today') return !t.done && di.diffDays <= 0;
    if (filter === 'week') return !t.done && di.diffDays >= 0 && di.diffDays < 7;
    return true;
  });

  const groups = [
    { key: 'late', label: 'באיחור', test: t => !t.done && dueInfo(t.dueDate).diffDays < 0 },
    { key: 'today', label: 'להיום', test: t => !t.done && dueInfo(t.dueDate).diffDays === 0 },
    { key: 'tomorrow', label: 'למחר', test: t => !t.done && dueInfo(t.dueDate).diffDays === 1 },
    { key: 'week', label: 'בהמשך השבוע', test: t => !t.done && dueInfo(t.dueDate).diffDays > 1 },
    { key: 'done', label: 'בוצעו', test: t => !!t.done },
  ].map(g => ({ ...g, items: filtered.filter(g.test) })).filter(g => g.items.length);

  const openCount = tasks.filter(t => !t.done).length;
  const doneCount = tasks.length - openCount;
  const urgentCount = tasks.filter(t => !t.done && dueInfo(t.dueDate).diffDays <= 0).length;
  const pct = tasks.length ? (doneCount / tasks.length) * 100 : 0;

  async function onToggle(task) {
    await toggleTask(task.id, !task.done);
    if (!task.done && task.notifId) await cancelReminder(task.notifId);
    await load();
  }

  async function onSave() {
    const payload = { ...draft, title: draft.title.trim() || (draft.type + ' ב' + subjById(draft.subjectId).name) };

    // validation: the due datetime itself must not be in the past
    const dueAt = new Date(payload.dueDate + 'T' + (payload.dueTime || '18:00') + ':00');
    if (dueAt.getTime() < Date.now() - 60000) {
      return Alert.alert('המועד כבר עבר', 'ההגשה נקבעה ל' + fmtWhen(dueAt) + '. לשמור בכל זאת?', [
        { text: 'תיקון התאריך', style: 'cancel' },
        { text: 'שמירה', onPress: () => commit(payload) },
      ]);
    }

    // validation: a one-off reminder that already passed can never fire
    const fire = previewTaskReminder(payload);
    if (fire && fire.getTime() <= Date.now()) {
      return Alert.alert(
        'התזכורת הזו כבר עברה',
        'לפי מה שבחרת ההתראה אמורה להופיע ב' + fmtWhen(fire) + ' — זמן שכבר חלף.',
        [
          { text: 'בחירת תזכורת אחרת', style: 'cancel' },
          { text: 'שמירה בלי תזכורת', onPress: () => commit({ ...payload, remindKind: 'none' }) },
        ]
      );
    }
    await commit(payload);
  }

  async function commit(payload) {
    let id = editId;
    const existing = tasks.find(t => t.id === editId);
    if (editId) await updateTask(editId, payload);
    else id = await addTask(payload);
    if (existing && existing.notifId) await cancelReminder(existing.notifId);
    if (payload.remindKind !== 'none') {
      const notifId = await scheduleTaskReminder({ ...payload, id, subjectName: subjById(payload.subjectId).name });
      if (notifId) await setTaskNotifId(id, notifId);
    }
    setModalOpen(false); setEditId(null); setDraft(blankDraft()); setPicker(null);
    await load();
  }

  function openEdit(task) {
    setEditId(task.id);
    setDraft({ title: task.title, subjectId: task.subjectId, type: task.type, dueDate: task.dueDate, dueTime: task.dueTime || '18:00', remindKind: task.remindKind || 'none' });
    setModalOpen(true);
  }
  function openNew() { setEditId(null); setDraft(blankDraft()); setModalOpen(true); }

  function confirmDelete(t) {
    Alert.alert('למחוק את המשימה?', t.title, [
      { text: 'ביטול', style: 'cancel' },
      { text: 'מחיקה', style: 'destructive', onPress: async () => {
        await cancelReminder(t.notifId);
        await deleteTask(t.id);
        setModalOpen(false); setEditId(null); setDraft(blankDraft()); setPicker(null);
        await load();
      } },
    ]);
  }

  const REMIND = TASK_REMIND_PRESETS;
  const draftDue = dueInfo(draft.dueDate);

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: TOP, paddingBottom: 110 }} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: 'row-reverse', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.dateLabel}>
              {new Date().toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' })}
            </Text>
            <Text style={styles.pageTitle}>{name ? 'המשימות של ' + name : 'המשימות שלי'}</Text>
          </View>
          <TouchableOpacity onPress={onOpenSettings} style={styles.gearBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={{ fontSize: 15, color: '#7C7489' }}>⚙</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.progressCard}>
          <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: 15, fontWeight: '600', color: COLORS.text }}>
              {openCount === 0 ? 'סיימת הכול, כל הכבוד!' : urgentCount > 0 ? urgentCount + ' משימות דחופות להיום' : openCount + ' משימות פתוחות'}
            </Text>
            <Text style={{ fontSize: 12.5, color: COLORS.textDim }}>{doneCount}/{tasks.length} בוצעו</Text>
          </View>
          <View style={styles.progressTrack}>
            <LinearGradient colors={[COLORS.pink, COLORS.purple]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={{ width: `${pct}%`, height: '100%', borderRadius: 99 }} />
          </View>
        </View>

        <View style={{ flexDirection: 'row-reverse', gap: 8, marginVertical: 18, flexWrap: 'wrap' }}>
          {[{ k: 'all', l: 'הכול' }, { k: 'today', l: 'להיום' }, { k: 'week', l: 'השבוע' }, { k: 'done', l: 'בוצעו' }].map(f => (
            <TouchableOpacity key={f.k} onPress={() => setFilter(f.k)}
              style={[styles.chip, filter === f.k && { backgroundColor: COLORS.text }]}>
              <Text style={{ color: filter === f.k ? '#fff' : '#6E6580', fontSize: 14, fontWeight: '600' }}>{f.l}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {groups.map(g => (
          <View key={g.key} style={{ marginBottom: 18 }}>
            <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 10, paddingHorizontal: 2 }}>
              <Text style={{ fontSize: 14.5, fontWeight: '700', color: g.key === 'late' ? COLORS.red : COLORS.text }}>{g.label}</Text>
              <Text style={{ fontSize: 13, color: COLORS.textFaint }}>{g.items.length}</Text>
            </View>
            {g.items.map(t => {
              const s = subjById(t.subjectId);
              const di = dueInfo(t.dueDate);
              const tone = t.done ? '#F4F2F7' : di.overdue ? COLORS.redTint : di.isToday ? COLORS.purpleTint : '#F7F5FB';
              const toneFg = t.done ? '#A79FB4' : di.overdue ? COLORS.red : di.isToday ? COLORS.purple : '#6E6580';
              return (
                <View key={t.id} style={styles.taskRow}>
                  <TouchableOpacity onPress={() => onToggle(t)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    style={[styles.checkbox, { borderColor: t.done ? COLORS.purple : '#DED7E8', backgroundColor: t.done ? COLORS.purple : '#fff' }]}>
                    {!!t.done && <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>✓</Text>}
                  </TouchableOpacity>

                  <TouchableOpacity style={{ flex: 1 }} onPress={() => openEdit(t)} activeOpacity={0.7}>
                    <Text style={{ fontSize: 15.5, fontWeight: '600', lineHeight: 21, textAlign: 'right', color: t.done ? '#A79FB4' : COLORS.text, textDecorationLine: t.done ? 'line-through' : 'none' }}>
                      {t.title}
                    </Text>
                    <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                      <View style={[styles.subjTag, { backgroundColor: (s.color || '#999') + '1F' }]}>
                        <View style={[styles.letterDot, { backgroundColor: s.color || '#999' }]}>
                          <Text style={{ color: '#fff', fontSize: 8, fontWeight: '700' }}>{s.letter}</Text>
                        </View>
                        <Text style={{ fontSize: 11.5, fontWeight: '600', color: s.color || '#999' }}>{s.name}</Text>
                      </View>
                      {t.type === 'מבחן' && !t.done && (
                        <View style={styles.examBadge}><Text style={{ fontSize: 10.5, fontWeight: '700', color: '#D2547F' }}>מבחן</Text></View>
                      )}
                      <Text style={{ fontSize: 12, color: di.overdue && !t.done ? COLORS.red : COLORS.textDim }}>
                        {t.done ? 'בוצע' : di.overdue ? 'עבר · ' + (di.diffDays === -1 ? 'אתמול' : 'יום ' + di.dayName)
                          : di.isToday ? 'היום, ' + (t.dueTime || '18:00')
                          : di.isTomorrow ? 'מחר, ' + (t.dueTime || '18:00')
                          : 'יום ' + di.dayName + ', ' + (t.dueTime || '18:00')}
                      </Text>
                    </View>
                  </TouchableOpacity>

                  <View style={[styles.dateBlock, { backgroundColor: tone }]}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: toneFg }}>{di.dayShort}׳</Text>
                    <Text style={{ fontSize: 12.5, fontWeight: '700', marginTop: 1, color: toneFg }}>{di.dateLabel}</Text>
                  </View>

                  <TouchableOpacity onPress={() => confirmDelete(t)}
                    hitSlop={{ top: 12, bottom: 12, left: 10, right: 10 }} style={styles.rowDelete}>
                    <Text style={{ color: '#C0B8CE', fontSize: 15 }}>✕</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        ))}

        {groups.length === 0 && (
          <View style={styles.empty}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: COLORS.text }}>אין כאן משימות</Text>
            <Text style={{ fontSize: 14, color: COLORS.textDim, marginTop: 6, textAlign: 'center', lineHeight: 21 }}>
              כל מה שצריך להגיש, ללמוד או לזכור — נוסיף בכפתור ה+
            </Text>
          </View>
        )}
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={openNew} activeOpacity={0.85}>
        <Text style={{ color: '#fff', fontSize: 30, fontWeight: '300', marginTop: -3 }}>+</Text>
      </TouchableOpacity>

      <Modal visible={modalOpen} animationType="slide" transparent onRequestClose={() => setModalOpen(false)}>
        <View style={{ flex: 1 }}>
          <TouchableWithoutFeedback onPress={() => setModalOpen(false)}>
            <View style={styles.modalOverlay} />
          </TouchableWithoutFeedback>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end' }} pointerEvents="box-none">
            <View style={styles.sheet}>
              <View style={styles.sheetHandle} />
              <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <TouchableOpacity onPress={() => setModalOpen(false)} style={styles.btnGhost}>
                  <Text style={styles.btnGhostText}>ביטול</Text>
                </TouchableOpacity>
                <Text style={{ fontSize: 16.5, fontWeight: '700', color: COLORS.text }}>{editId ? 'עריכת משימה' : 'משימה חדשה'}</Text>
                <TouchableOpacity onPress={onSave} style={styles.btnPrimary}>
                  <Text style={styles.btnPrimaryText}>שמירה</Text>
                </TouchableOpacity>
              </View>

              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <Text style={styles.label}>מה צריך לעשות?</Text>
                <TextInput value={draft.title} onChangeText={v => setDraft(d => ({ ...d, title: v }))}
                  placeholder="למשל: תרגילים 1–8 בחוברת" placeholderTextColor="#B6AEC4" style={styles.input} />

                <Text style={styles.label}>איזה מקצוע?</Text>
                <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 }}>
                  {subjects.map(s => {
                    const on = draft.subjectId === s.id;
                    return (
                      <TouchableOpacity key={s.id} onPress={() => setDraft(d => ({ ...d, subjectId: s.id }))}
                        style={[styles.subjChip, { borderColor: on ? s.color : COLORS.line, backgroundColor: on ? s.color + '1A' : '#fff' }]}>
                        <View style={[styles.letterDot, { backgroundColor: s.color }]}>
                          <Text style={{ color: '#fff', fontSize: 8, fontWeight: '700' }}>{s.letter}</Text>
                        </View>
                        <Text style={{ color: on ? s.color : '#5F5870', fontWeight: '600', fontSize: 13 }}>{s.name}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={styles.label}>סוג</Text>
                <View style={{ flexDirection: 'row-reverse', gap: 7 }}>
                  {TYPES.map(t => (
                    <TouchableOpacity key={t} onPress={() => setDraft(d => ({ ...d, type: t }))}
                      style={[styles.typeChip, draft.type === t && { backgroundColor: COLORS.text }]}>
                      <Text style={{ fontSize: 12.5, fontWeight: '600', color: draft.type === t ? '#fff' : '#6E6580' }}>{t}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.label}>מתי להגיש?</Text>
                <View style={{ flexDirection: 'row-reverse', gap: 8, flexWrap: 'wrap' }}>
                  {[0, 1, 3, 7].map(off => {
                    const iso = isoDate(addDays(new Date(), off));
                    const on = draft.dueDate === iso;
                    return (
                      <TouchableOpacity key={off} onPress={() => setDraft(dr => ({ ...dr, dueDate: iso }))}
                        style={[styles.pill, on && { backgroundColor: COLORS.purpleTint, borderColor: COLORS.purple }]}>
                        <Text style={{ fontSize: 13, fontWeight: '600', color: on ? COLORS.purple : '#6E6580' }}>
                          {off === 0 ? 'היום' : off === 1 ? 'מחר' : off === 3 ? 'בעוד 3 ימים' : 'בעוד שבוע'}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <View style={{ flexDirection: 'row-reverse', gap: 10, marginTop: 12 }}>
                  <TouchableOpacity style={styles.fieldBox} onPress={() => setPicker(picker === 'date' ? null : 'date')} activeOpacity={0.7}>
                    <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={styles.fieldLabel}>תאריך הגשה</Text>
                      <Text style={{ fontSize: 11, color: COLORS.purple, fontWeight: '700' }}>לוח שנה</Text>
                    </View>
                    <Text style={styles.fieldValue}>יום {draftDue.dayShort}׳ · {draftDue.dateLabel}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.fieldBox} onPress={() => setPicker(picker === 'time' ? null : 'time')} activeOpacity={0.7}>
                    <Text style={styles.fieldLabel}>שעת הגשה</Text>
                    <Text style={styles.fieldValue}>{draft.dueTime}</Text>
                  </TouchableOpacity>
                </View>

                {picker === 'date' && (
                  <DateTimePicker value={new Date(draft.dueDate + 'T12:00:00')} mode="date"
                    display={Platform.OS === 'ios' ? 'inline' : 'default'}
                    minimumDate={new Date(new Date().setHours(0, 0, 0, 0))}
                    onChange={(e, sel) => {
                      if (Platform.OS === 'android') setPicker(null);
                      if (e.type === 'dismissed') return;
                      if (sel) setDraft(d => ({ ...d, dueDate: isoDate(sel) }));
                    }} />
                )}
                {picker === 'time' && (
                  <DateTimePicker value={timeToDate(draft.dueTime)} mode="time" is24Hour
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(e, sel) => {
                      if (Platform.OS === 'android') setPicker(null);
                      if (e.type === 'dismissed') return;
                      if (sel) setDraft(d => ({ ...d, dueTime: dateToTime(sel) }));
                    }} />
                )}
                {picker && Platform.OS === 'ios' && (
                  <TouchableOpacity onPress={() => setPicker(null)} style={{ alignSelf: 'center', paddingVertical: 8 }}>
                    <Text style={{ color: COLORS.purple, fontWeight: '700' }}>אישור</Text>
                  </TouchableOpacity>
                )}

                <Text style={styles.label}>מתי לקבל תזכורת?</Text>
                <Text style={{ fontSize: 12, color: COLORS.textFaint, marginTop: -4, marginBottom: 9, textAlign: 'right' }}>
                  {(() => {
                    const f = previewTaskReminder(draft);
                    if (draft.remindKind === 'none') return 'לא תופיע התראה על המשימה הזו';
                    if (!f) return 'התראה חוזרת · נעצרת כשמסמנים בוצע';
                    const past = f.getTime() <= Date.now();
                    return (past ? '⚠ ' : '') + 'ההתראה תופיע ב' + fmtWhen(f) + (past ? ' — זמן שכבר עבר' : '');
                  })()}
                </Text>
                <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
                  {REMIND.map(r => {
                    const on = draft.remindKind === r.key;
                    return (
                      <TouchableOpacity key={r.key} onPress={() => setDraft(d => ({ ...d, remindKind: r.key }))}
                        style={[styles.pill, on && { backgroundColor: COLORS.purple, borderColor: COLORS.purple }]}>
                        <Text style={{ fontSize: 13, fontWeight: '600', color: on ? '#fff' : '#6E6580' }}>{r.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {editId && (
                  <TouchableOpacity onPress={() => { const t = tasks.find(x => x.id === editId); if (t) confirmDelete(t); }} style={styles.dangerBtn}>
                    <Text style={{ color: COLORS.red, fontWeight: '700', fontSize: 14.5 }}>מחיקת המשימה</Text>
                  </TouchableOpacity>
                )}
                <View style={{ height: 10 }} />
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  dateLabel: { fontSize: 13.5, color: COLORS.textDim, fontWeight: '500', textAlign: 'right' },
  pageTitle: { fontSize: 27, fontWeight: '700', color: COLORS.text, marginTop: 3, textAlign: 'right' },
  gearBtn: { width: 36, height: 36, borderRadius: 99, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  progressCard: { marginTop: 18, backgroundColor: COLORS.card, borderRadius: 20, padding: 16 },
  progressTrack: { marginTop: 12, height: 9, borderRadius: 99, backgroundColor: '#F0EBF7', overflow: 'hidden', flexDirection: 'row-reverse' },
  chip: { borderRadius: 99, paddingVertical: 11, paddingHorizontal: 17, backgroundColor: '#fff', minHeight: 44, justifyContent: 'center' },
  taskRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 11, backgroundColor: COLORS.card, borderRadius: 20, padding: 14, marginBottom: 9 },
  checkbox: { width: 28, height: 28, borderRadius: 99, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  subjTag: { borderRadius: 99, paddingVertical: 4, paddingHorizontal: 8, flexDirection: 'row-reverse', alignItems: 'center', gap: 5 },
  letterDot: { width: 16, height: 16, borderRadius: 99, alignItems: 'center', justifyContent: 'center' },
  examBadge: { backgroundColor: '#FDECF2', borderRadius: 99, paddingVertical: 4, paddingHorizontal: 8 },
  dateBlock: { width: 44, borderRadius: 13, paddingVertical: 8, alignItems: 'center' },
  empty: { marginTop: 20, alignItems: 'center', padding: 34, borderWidth: 1, borderColor: '#DDD5E8', borderStyle: 'dashed', borderRadius: 22 },
  fab: { position: 'absolute', left: 20, bottom: 22, width: 60, height: 60, borderRadius: 99, backgroundColor: COLORS.purple, alignItems: 'center', justifyContent: 'center', elevation: 5, shadowColor: COLORS.purple, shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 5 } },
  modalOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(35,27,45,0.4)' },
  sheet: { backgroundColor: '#FBF9FD', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 20, maxHeight: '88%' },
  sheetHandle: { width: 38, height: 4, borderRadius: 99, backgroundColor: '#DDD6E6', alignSelf: 'center', marginBottom: 14 },
  input: { backgroundColor: '#fff', borderRadius: 16, paddingHorizontal: 15, paddingVertical: 14, fontSize: 16.5, textAlign: 'right', minHeight: 52, color: COLORS.text },
  label: { fontSize: 12.5, fontWeight: '700', color: COLORS.textDim, marginTop: 18, marginBottom: 9, textAlign: 'right' },
  subjChip: { borderWidth: 1.5, borderRadius: 99, paddingVertical: 9, paddingHorizontal: 12, minHeight: 42, flexDirection: 'row-reverse', alignItems: 'center', gap: 6 },
  typeChip: { flex: 1, backgroundColor: '#fff', borderRadius: 14, paddingVertical: 12, alignItems: 'center', minHeight: 44, justifyContent: 'center' },
  pill: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: COLORS.line, borderRadius: 99, paddingVertical: 10, paddingHorizontal: 14, minHeight: 42, justifyContent: 'center' },
  fieldBox: { flex: 1, backgroundColor: '#fff', borderRadius: 16, padding: 13 },
  fieldLabel: { fontSize: 11.5, color: COLORS.textDim, textAlign: 'right' },
  fieldValue: { fontSize: 17, fontWeight: '700', color: COLORS.text, textAlign: 'right', marginTop: 3 },
  btnGhost: { backgroundColor: '#EFEBF6', borderRadius: 99, paddingVertical: 11, paddingHorizontal: 20, minHeight: 44, justifyContent: 'center' },
  btnGhostText: { color: '#5F5870', fontSize: 14.5, fontWeight: '700' },
  btnPrimary: { backgroundColor: COLORS.purple, borderRadius: 99, paddingVertical: 11, paddingHorizontal: 22, minHeight: 44, justifyContent: 'center' },
  btnPrimaryText: { color: '#fff', fontSize: 14.5, fontWeight: '700' },
  dangerBtn: { marginTop: 4, backgroundColor: COLORS.redTint, borderRadius: 16, padding: 15, alignItems: 'center' },
  rowDelete: { width: 30, height: 30, borderRadius: 99, backgroundColor: '#F7F5FA', alignItems: 'center', justifyContent: 'center' },
});
