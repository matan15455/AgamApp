import { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Modal, Switch, TextInput, Platform, KeyboardAvoidingView, TouchableWithoutFeedback, Alert } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { COLORS, TOP, DAYS, DAYS_SHORT, todayIndex, dateOfWeekday, isoDate, shiftTime, plural, fmtMin, toMin } from '../theme';
import { getHours, getSchedule, setLesson, clearLesson, setHour, resetHours, deleteHour, getSubjects, getTasks, setLessonNotifId } from '../database';
import { scheduleLessonReminder, cancelReminder, LESSON_BEFORE_PRESETS } from '../notifications';

function timeToDate(t) {
  const [h, m] = String(t || '08:00').split(':').map(Number);
  const d = new Date(); d.setHours(h, m, 0, 0); return d;
}
function dateToTime(d) {
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

export default function ScheduleScreen({ initialView = 'week', initialDay }) {
  const [hours, setHours] = useState([]);
  const [schedule, setSchedule] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [view, setView] = useState(initialView);
  const [day, setDay] = useState(initialDay != null ? initialDay : (todayIndex() > 5 ? 0 : todayIndex()));
  const [slot, setSlot] = useState(null);   // {day, slot, subjectId, room, teacher, startTime, endTime, remind}
  const [picker, setPicker] = useState(null); // 'start' | 'end'
  const [hoursModal, setHoursModal] = useState(false);

  const load = useCallback(async () => {
    setHours(await getHours());
    setSchedule(await getSchedule());
    setSubjects(await getSubjects());
    setTasks(await getTasks());
  }, []);
  useEffect(() => { load(); }, [load]);

  const cellAt = (d, s) => schedule.find(l => l.day === d && l.slot === s);
  const dayLessons = schedule.filter(l => l.day === day).sort((a, b) => a.slot - b.slot);
  const countFor = (d) => schedule.filter(l => l.day === d).length;

  // open tasks for a subject on the date of that weekday, this week
  const hwFor = (subjectId, wd) => {
    const iso = isoDate(dateOfWeekday(wd));
    return tasks.filter(t => !t.done && t.subjectId === subjectId && t.dueDate === iso).length;
  };

  function openSlot(d, s) {
    const ex = cellAt(d, s);
    const h = hours.find(x => x.slot === s) || { startTime: '08:00', endTime: '08:45' };
    const subj = ex ? subjects.find(x => x.id === ex.subjectId) : subjects[0];
    setPicker(null);
    setSlot({
      day: d, slot: s,
      subjectId: ex ? ex.subjectId : (subjects[0]?.id),
      room: ex ? ex.room : '',
      teacher: null,
      startTime: ex ? ex.startTime : h.startTime,
      endTime: ex ? ex.endTime : h.endTime,
      remind: ex ? !!ex.remind : true,
      remindBefore: ex && ex.remindBefore != null ? ex.remindBefore : 10,
      exists: !!ex,
      notifId: ex ? ex.notifId : null,
    });
  }

  function pickSubject(id) {
    setSlot(m => ({ ...m, subjectId: id }));
  }

  async function saveSlot() {
    const v = slot;
    const start = toMin(v.startTime), end = toMin(v.endTime);

    if (!v.subjectId) return Alert.alert('בחרי מקצוע', 'צריך לבחור איזה מקצוע יש במשבצת הזו.');
    if (end <= start) {
      return Alert.alert('השעות לא הגיוניות', 'שעת הסיום (' + v.endTime + ') חייבת להיות אחרי שעת ההתחלה (' + v.startTime + ').');
    }
    if (end - start < 10) {
      return Alert.alert('השיעור קצר מדי', 'שיעור צריך להיות לפחות 10 דקות.');
    }
    if (v.remind && start - v.remindBefore < 0) {
      return Alert.alert('התזכורת מוקדמת מדי', 'שיעור שמתחיל ב-' + v.startTime + ' לא יכול לקבל תזכורת ' + v.remindBefore + ' דקות לפני — זה יוצא ביום הקודם. בחרי זמן קרוב יותר.');
    }

    const clash = schedule.find(l => l.day === v.day && l.slot !== v.slot &&
      toMin(l.startTime) < end && toMin(l.endTime) > start);
    if (clash) {
      return Alert.alert(
        'התנגשות במערכת',
        'ביום ' + DAYS[v.day] + ' כבר יש ' + clash.name + ' בשעות ' + clash.startTime + '–' + clash.endTime + '.',
        [{ text: 'תיקון השעות', style: 'cancel' }, { text: 'לשמור בכל זאת', onPress: () => commitSlot(v) }]
      );
    }
    await commitSlot(v);
  }

  async function commitSlot(v) {
    if (v.notifId) await cancelReminder(v.notifId);
    await setLesson(v.day, v.slot, v);
    if (v.remind) {
      const subj = subjects.find(s => s.id === v.subjectId);
      const nid = await scheduleLessonReminder(v.day, v.startTime, subj?.name || 'שיעור', v.remindBefore, v.room);
      if (nid) await setLessonNotifId(v.day, v.slot, nid);
    }
    setSlot(null);
    await load();
  }

  async function removeSlot() {
    if (slot.notifId) await cancelReminder(slot.notifId);
    await clearLesson(slot.day, slot.slot);
    setSlot(null);
    await load();
  }

  async function confirmDeleteHour(s) {
    const affected = schedule.filter(l => l.slot === s);
    const doDelete = async () => {
      for (const l of affected) if (l.notifId) await cancelReminder(l.notifId);
      await deleteHour(s);
      await load();
    };
    if (affected.length) {
      Alert.alert(
        'למחוק את שיעור ' + (s + 1) + '?',
        'יימחקו גם ' + affected.length + ' שיעורים שמוגדרים בשעה הזו לאורך השבוע.',
        [{ text: 'ביטול', style: 'cancel' }, { text: 'מחיקה', style: 'destructive', onPress: doDelete }]
      );
    } else {
      Alert.alert(
        'למחוק את שיעור ' + (s + 1) + '?',
        'אפשר לשחזר את כל שעות ברירת המחדל מאוחר יותר בלחיצה על "ברירת מחדל".',
        [{ text: 'ביטול', style: 'cancel' }, { text: 'מחיקה', style: 'destructive', onPress: doDelete }]
      );
    }
  }

  const MAX_HOURS = 12;

  async function addHour() {
    if (hours.length >= MAX_HOURS) {
      return Alert.alert('הגעת למקסימום', 'אפשר להוסיף עד ' + MAX_HOURS + ' שעות במערכת.');
    }
    const newSlot = hours.length ? Math.max(...hours.map(h => h.slot)) + 1 : 0;
    let startTime = '08:00', endTime = '08:45';
    if (hours.length) {
      const last = hours.reduce((a, b) => (toMin(a.endTime) > toMin(b.endTime) ? a : b));
      const start = toMin(last.endTime) + 5; // same 5-minute gap used between the default hours
      startTime = fmtMin(start);
      endTime = fmtMin(start + 45); // 45-minute default lesson length, matches the defaults
    }
    await setHour(newSlot, startTime, endTime);
    await load();
  }

  const slotSubject = slot ? subjects.find(s => s.id === slot.subjectId) : null;

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: TOP, paddingBottom: 110 }} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 4 }}>
          <Text style={{ fontSize: 26, fontWeight: '700', color: COLORS.text }}>מערכת שעות</Text>
          <View style={{ flexDirection: 'row-reverse', gap: 7 }}>
            <TouchableOpacity onPress={() => setHoursModal(true)} style={styles.smallBtn}>
              <Text style={{ color: '#5F5870', fontSize: 13, fontWeight: '600' }}>שעות</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => {
              const free = hours.find(h => !cellAt(day, h.slot));
              if (!free) return Alert.alert('היום מלא', 'כל השעות ביום ' + DAYS[day] + ' תפוסות. אפשר לערוך משבצת קיימת בלחיצה עליה.');
              openSlot(day, free.slot);
            }} style={[styles.smallBtn, { backgroundColor: COLORS.purple }]}>
              <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>הוסף שיעור</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.viewToggle}>
          {[{ k: 'week', l: 'שבועי' }, { k: 'day', l: 'יומי' }].map(v => (
            <TouchableOpacity key={v.k} onPress={() => setView(v.k)}
              style={[styles.viewBtn, view === v.k && { backgroundColor: '#fff' }]}>
              <Text style={{ fontSize: 13.5, fontWeight: '600', color: view === v.k ? COLORS.text : '#8B839A' }}>{v.l}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {view === 'week' && (
          <>
            <View style={styles.gridCard}>
              <View style={{ flexDirection: 'row-reverse', gap: 4, marginBottom: 8 }}>
                <View style={{ width: 40 }} />
                {DAYS_SHORT.map((d, i) => (
                  <Text key={i} style={{ flex: 1, textAlign: 'center', fontSize: 12.5, fontWeight: '700', color: i === todayIndex() ? COLORS.purple : COLORS.textDim }}>{d}</Text>
                ))}
              </View>
              {hours.map((h) => {
                const s = h.slot;
                return (
                  <View key={s} style={{ flexDirection: 'row-reverse', gap: 4, marginBottom: 4 }}>
                    <View style={{ width: 40, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.purple }}>{s + 1}</Text>
                      <Text style={{ fontSize: 8.5, fontWeight: '600', color: '#605869', marginTop: 1 }}>{h.startTime}</Text>
                      <Text style={{ fontSize: 8.5, color: COLORS.textFaint }}>{h.endTime}</Text>
                    </View>
                    {DAYS.map((_, d) => {
                      const l = cellAt(d, s);
                      return (
                        <TouchableOpacity key={d} onPress={() => openSlot(d, s)} activeOpacity={0.6}
                          style={[styles.cell, { backgroundColor: l ? l.color + '1C' : '#FAF9FC' }]}>
                          {l ? (
                            <>
                              <Text numberOfLines={1} style={{ fontSize: 10, fontWeight: '700', color: l.color }}>{l.short || l.name}</Text>
                              <Text numberOfLines={1} style={{ fontSize: 8, color: l.color, opacity: 0.7, marginTop: 1 }}>{l.room}</Text>
                            </>
                          ) : (
                            <Text style={{ fontSize: 13, color: '#DED8E6' }}>+</Text>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                );
              })}
            </View>

            <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 6, marginTop: 13, paddingHorizontal: 2 }}>
              {subjects.map(s => (
                <View key={s.id} style={styles.legendPill}>
                  <View style={{ width: 8, height: 8, borderRadius: 99, backgroundColor: s.color }} />
                  <Text style={{ fontSize: 11.5, color: '#605869' }}>{s.name}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {view === 'day' && (
          <>
            <View style={{ flexDirection: 'row-reverse', gap: 5, marginTop: 14, marginBottom: 14 }}>
              {DAYS_SHORT.map((d, i) => {
                const on = day === i;
                return (
                  <TouchableOpacity key={i} onPress={() => setDay(i)} style={[styles.dayPickBtn, on && { backgroundColor: COLORS.purple }]}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: on ? '#fff' : '#4A4257' }}>{d}</Text>
                    <Text style={{ fontSize: 9.5, marginTop: 2, color: on ? 'rgba(255,255,255,0.85)' : COLORS.textFaint }}>{countFor(i)} ש׳</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {dayLessons.map(l => {
              const hw = hwFor(l.subjectId, l.day);
              return (
                <TouchableOpacity key={l.slot} onPress={() => openSlot(l.day, l.slot)} activeOpacity={0.7} style={styles.lessonRow}>
                  <View style={{ width: 52, alignItems: 'flex-end' }}>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: COLORS.text }}>{l.startTime}</Text>
                    <Text style={{ fontSize: 11.5, color: COLORS.textFaint, marginTop: 1 }}>{l.endTime}</Text>
                  </View>
                  <View style={{ width: 4, borderRadius: 99, backgroundColor: l.color, alignSelf: 'stretch' }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: COLORS.text, textAlign: 'right' }}>{l.name}</Text>
                    <Text style={{ fontSize: 12, color: COLORS.textDim, marginTop: 3, textAlign: 'right' }}>
                      שיעור {l.slot + 1}{l.room ? ' • כיתה ' + l.room : ''}{l.teacher ? ' • ' + l.teacher : ''}
                    </Text>
                  </View>
                  {hw > 0 && (
                    <View style={[styles.hwBadge, { backgroundColor: l.color + '1F' }]}>
                      <Text style={{ fontSize: 10.5, fontWeight: '700', color: l.color }}>{plural(hw, 'משימה אחת', 'משימות')}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
            {dayLessons.length === 0 && (
              <View style={styles.empty}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: COLORS.text }}>אין שיעורים ביום {DAYS[day]}</Text>
                <Text style={{ fontSize: 13, color: COLORS.textDim, marginTop: 5, textAlign: 'center' }}>עליך להוסיף שיעור</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* --- עריכת שיעור --- */}
      <Modal visible={!!slot} animationType="slide" transparent onRequestClose={() => setSlot(null)}>
        <View style={{ flex: 1 }}>
          <TouchableWithoutFeedback onPress={() => setSlot(null)}><View style={styles.overlay} /></TouchableWithoutFeedback>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end' }} pointerEvents="box-none">
            <View style={styles.sheet}>
              <View style={styles.sheetHandle} />
              {slot && (
                <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                  <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <TouchableOpacity onPress={() => setSlot(null)} style={styles.btnGhost}>
                      <Text style={styles.btnGhostText}>ביטול</Text>
                    </TouchableOpacity>
                    <Text style={{ fontWeight: '700', fontSize: 15.5, color: COLORS.text }}>יום {DAYS[slot.day]} · שיעור {slot.slot + 1}</Text>
                    <TouchableOpacity onPress={saveSlot} style={styles.btnPrimary}>
                      <Text style={styles.btnPrimaryText}>שמירה</Text>
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.label}>איזה מקצוע?</Text>
                  <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 }}>
                    {subjects.map(s => {
                      const on = slot.subjectId === s.id;
                      return (
                        <TouchableOpacity key={s.id} onPress={() => pickSubject(s.id)}
                          style={[styles.subjChip, { borderColor: on ? s.color : COLORS.line, backgroundColor: on ? s.color + '1A' : '#fff' }]}>
                          <View style={[styles.letterDot, { backgroundColor: s.color }]}>
                            <Text style={{ color: '#fff', fontSize: 8, fontWeight: '700' }}>{s.letter}</Text>
                          </View>
                          <Text style={{ color: on ? s.color : '#5F5870', fontWeight: '600', fontSize: 13 }}>{s.name}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <Text style={styles.label}>שעות</Text>
                  <View style={{ flexDirection: 'row-reverse', gap: 10 }}>
                    <TouchableOpacity style={styles.fieldBox} onPress={() => setPicker(picker === 'start' ? null : 'start')}>
                      <Text style={styles.fieldLabel}>משעה</Text>
                      <Text style={styles.fieldValue}>{slot.startTime}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.fieldBox} onPress={() => setPicker(picker === 'end' ? null : 'end')}>
                      <Text style={styles.fieldLabel}>עד שעה</Text>
                      <Text style={styles.fieldValue}>{slot.endTime}</Text>
                    </TouchableOpacity>
                  </View>

                  {picker && (
                    <>
                      <DateTimePicker value={timeToDate(picker === 'start' ? slot.startTime : slot.endTime)} mode="time" is24Hour
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        onValueChange={(event, sel) => {
                          if (Platform.OS === 'android') setPicker(null);
                          if (!sel) return;
                          const t = dateToTime(sel);
                          setSlot(m => picker === 'start' ? { ...m, startTime: t } : { ...m, endTime: t });
                        }}
                        onDismiss={() => setPicker(null)} />
                      {Platform.OS === 'ios' && (
                        <TouchableOpacity onPress={() => setPicker(null)} style={{ alignSelf: 'center', paddingVertical: 6 }}>
                          <Text style={{ color: COLORS.purple, fontWeight: '700' }}>אישור</Text>
                        </TouchableOpacity>
                      )}
                    </>
                  )}

                  <View style={{ flexDirection: 'row-reverse', gap: 10, marginTop: 10 }}>
                    <View style={styles.fieldBox}>
                      <Text style={styles.fieldLabel}>כיתה לשיעור הזה</Text>
                      <TextInput value={slot.room} onChangeText={v => setSlot(m => ({ ...m, room: v }))}
                        placeholder="למשל: מעבדה א' או יא2" placeholderTextColor="#C6BFD2" style={styles.fieldInput} />
                    </View>
                    <View style={styles.fieldBox}>
                      <Text style={styles.fieldLabel}>מורה</Text>
                      <Text style={[styles.fieldInput, !slotSubject?.teacher && { color: COLORS.textFaint }]} numberOfLines={1}>
                        {slotSubject?.teacher || 'לא הוגדר'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.remindRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: '600', color: COLORS.text, textAlign: 'right' }}>תזכורת לפני השיעור</Text>
                    </View>
                    <Switch value={slot.remind} onValueChange={v => setSlot(m => ({ ...m, remind: v }))}
                      trackColor={{ true: COLORS.purple, false: '#DFD8E9' }} thumbColor="#fff" />
                  </View>

                  {slot.remind && (
                    <>
                      <Text style={styles.label}>כמה זמן לפני להזכיר?</Text>
                      <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 }}>
                        {LESSON_BEFORE_PRESETS.map(mins => {
                          const on = slot.remindBefore === mins;
                          return (
                            <TouchableOpacity key={mins} onPress={() => setSlot(m => ({ ...m, remindBefore: mins }))}
                              style={[styles.pill, on && { backgroundColor: COLORS.purple, borderColor: COLORS.purple }]}>
                              <Text style={{ fontSize: 13, fontWeight: '600', color: on ? '#fff' : '#6E6580' }}>
                                {mins === 0 ? 'בזמן ההתחלה' : mins === 60 ? 'שעה לפני' : mins + ' דקות'}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                      <Text style={{ fontSize: 12, color: COLORS.textFaint, marginTop: 8, textAlign: 'right' }}>
                        התראה תופיע ב-{slot.remindBefore === 0 ? slot.startTime : fmtMin(toMin(slot.startTime) - slot.remindBefore)}
                      </Text>
                    </>
                  )}

                  {slot.exists && (
                    <TouchableOpacity onPress={removeSlot} style={styles.dangerBtn}>
                      <Text style={{ color: COLORS.red, fontWeight: '600', fontSize: 14 }}>מחיקת השיעור מהמשבצת</Text>
                    </TouchableOpacity>
                  )}
                  <View style={{ height: 14 }} />
                </ScrollView>
              )}
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* --- שעות המערכת --- */}
      <Modal visible={hoursModal} animationType="slide" transparent onRequestClose={() => setHoursModal(false)}>
        <View style={{ flex: 1 }}>
          <TouchableWithoutFeedback onPress={() => setHoursModal(false)}><View style={styles.overlay} /></TouchableWithoutFeedback>
          <View style={{ justifyContent: 'flex-end', flex: 1 }} pointerEvents="box-none">
            <View style={styles.sheet}>
              <View style={styles.sheetHandle} />
              <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }}>
                <TouchableOpacity onPress={async () => { await resetHours(); await load(); }} style={styles.btnGhost}>
                  <Text style={styles.btnGhostText}>ברירת מחדל</Text>
                </TouchableOpacity>
                <Text style={{ fontWeight: '700', fontSize: 16, color: COLORS.text }}>שעות המערכת</Text>
                <TouchableOpacity onPress={() => setHoursModal(false)} style={styles.btnPrimary}>
                  <Text style={styles.btnPrimaryText}>סיום</Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={{ marginTop: 12, maxHeight: 420 }} showsVerticalScrollIndicator={false}>
                {hours.map((h) => {
                  const s = h.slot;
                  return (
                    <View key={s} style={styles.hourRow}>
                      <View style={{ width: 58 }}><Text style={{ fontWeight: '700', fontSize: 13.5, color: COLORS.text, textAlign: 'right' }}>שיעור {s + 1}</Text></View>
                      <Stepper value={h.startTime} onChange={async (t) => {
                        if (toMin(t) >= toMin(h.endTime)) return Alert.alert('לא הגיוני', 'שעת ההתחלה חייבת להיות לפני שעת הסיום (' + h.endTime + ').');
                        const prev = hours.find(x => x.slot === s - 1);
                        if (prev && toMin(t) < toMin(prev.endTime)) {
                          return Alert.alert('לא הגיוני', 'שיעור ' + s + ' מסתיים ב-' + prev.endTime + ' — שיעור ' + (s + 1) + ' לא יכול להתחיל לפני זה.');
                        }
                        await setHour(s, t, h.endTime); await load();
                      }} />
                      <Stepper value={h.endTime} onChange={async (t) => {
                        if (toMin(t) <= toMin(h.startTime)) return Alert.alert('לא הגיוני', 'שעת הסיום חייבת להיות אחרי שעת ההתחלה (' + h.startTime + ').');
                        const next = hours.find(x => x.slot === s + 1);
                        if (next && toMin(t) > toMin(next.startTime)) {
                          return Alert.alert('לא הגיוני', 'שיעור ' + (s + 2) + ' מתחיל ב-' + next.startTime + ' — שיעור ' + (s + 1) + ' לא יכול להסתיים אחרי זה.');
                        }
                        await setHour(s, h.startTime, t); await load();
                      }} />
                      <TouchableOpacity onPress={() => confirmDeleteHour(s)} hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }} style={styles.hourDeleteBtn}>
                        <Text style={{ color: '#C0B8CE', fontSize: 15 }}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
                {hours.length === 0 && (
                  <Text style={{ textAlign: 'center', color: COLORS.textDim, fontSize: 13, marginTop: 10 }}>
                    אין שעות במערכת — אפשר לשחזר בלחיצה על "ברירת מחדל" או להוסיף שעה חדשה.
                  </Text>
                )}
                <TouchableOpacity onPress={addHour} disabled={hours.length >= MAX_HOURS}
                  style={[styles.addHourBtn, hours.length >= MAX_HOURS && { opacity: 0.4 }]}>
                  <Text style={{ color: COLORS.purple, fontSize: 14.5, fontWeight: '700' }}>
                    {hours.length >= MAX_HOURS ? 'הגעת למקסימום (' + MAX_HOURS + ' שעות)' : '+ הוספת שעה'}
                  </Text>
                </TouchableOpacity>
                <View style={{ height: 20 }} />
              </ScrollView>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Stepper({ value, onChange }) {
  return (
    <View style={styles.stepper}>
      <TouchableOpacity onPress={() => onChange(shiftTime(value, 5))} style={styles.stepBtn} hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}>
        <Text style={{ fontSize: 16, color: '#5F5870' }}>+</Text>
      </TouchableOpacity>
      <Text style={{ flex: 1, textAlign: 'center', fontWeight: '700', fontSize: 14, color: COLORS.text }}>{value}</Text>
      <TouchableOpacity onPress={() => onChange(shiftTime(value, -5))} style={styles.stepBtn} hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}>
        <Text style={{ fontSize: 16, color: '#5F5870' }}>−</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  smallBtn: { borderRadius: 99, paddingVertical: 11, paddingHorizontal: 15, backgroundColor: '#EDE7F5', minHeight: 42, justifyContent: 'center' },
  viewToggle: { flexDirection: 'row-reverse', backgroundColor: '#EDE7F5', borderRadius: 99, padding: 3, marginTop: 16, marginHorizontal: 4 },
  viewBtn: { flex: 1, borderRadius: 99, paddingVertical: 11, alignItems: 'center', minHeight: 44, justifyContent: 'center' },
  gridCard: { marginTop: 14, backgroundColor: COLORS.card, borderRadius: 22, padding: 10 },
  cell: { flex: 1, height: 50, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2 },
  legendPill: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6, backgroundColor: '#fff', borderRadius: 99, paddingVertical: 7, paddingHorizontal: 11 },
  dayPickBtn: { flex: 1, borderRadius: 14, paddingVertical: 9, alignItems: 'center', backgroundColor: '#fff', minHeight: 48, justifyContent: 'center' },
  lessonRow: { flexDirection: 'row-reverse', gap: 11, backgroundColor: COLORS.card, borderRadius: 18, padding: 14, marginBottom: 9, alignItems: 'center' },
  hwBadge: { borderRadius: 99, paddingVertical: 5, paddingHorizontal: 10 },
  empty: { marginTop: 16, alignItems: 'center', padding: 30, borderWidth: 1, borderColor: '#DDD5E8', borderStyle: 'dashed', borderRadius: 22 },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(35,27,45,0.4)' },
  sheet: { backgroundColor: '#FBF9FD', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 20, maxHeight: '88%' },
  sheetHandle: { width: 38, height: 4, borderRadius: 99, backgroundColor: '#DDD6E6', alignSelf: 'center', marginBottom: 14 },
  label: { fontSize: 12.5, fontWeight: '700', color: COLORS.textDim, marginTop: 18, marginBottom: 9, textAlign: 'right' },
  subjChip: { borderWidth: 1.5, borderRadius: 99, paddingVertical: 9, paddingHorizontal: 12, minHeight: 42, flexDirection: 'row-reverse', alignItems: 'center', gap: 6 },
  letterDot: { width: 16, height: 16, borderRadius: 99, alignItems: 'center', justifyContent: 'center' },
  fieldBox: { flex: 1, backgroundColor: '#fff', borderRadius: 16, padding: 13 },
  fieldLabel: { fontSize: 11.5, color: COLORS.textDim, textAlign: 'right' },
  fieldValue: { fontSize: 19, fontWeight: '700', color: COLORS.text, textAlign: 'right', marginTop: 2 },
  fieldInput: { fontSize: 16, fontWeight: '600', color: COLORS.text, textAlign: 'right', marginTop: 2, padding: 0, minHeight: 26 },
  remindRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 18, padding: 15, marginTop: 16 },
  dangerBtn: { marginTop: 12, backgroundColor: COLORS.redTint, borderRadius: 16, padding: 15, alignItems: 'center' },
  btnGhost: { backgroundColor: '#EFEBF6', borderRadius: 99, paddingVertical: 11, paddingHorizontal: 18, minHeight: 44, justifyContent: 'center' },
  btnGhostText: { color: '#5F5870', fontSize: 14, fontWeight: '700' },
  btnPrimary: { backgroundColor: COLORS.purple, borderRadius: 99, paddingVertical: 11, paddingHorizontal: 20, minHeight: 44, justifyContent: 'center' },
  btnPrimaryText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  pill: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: COLORS.line, borderRadius: 99, paddingVertical: 10, paddingHorizontal: 14, minHeight: 42, justifyContent: 'center' },
  hourRow: { flexDirection: 'row-reverse', gap: 8, alignItems: 'center', backgroundColor: '#fff', borderRadius: 16, padding: 10, marginBottom: 8 },
  hourDeleteBtn: { width: 28, height: 28, borderRadius: 99, backgroundColor: '#F7F5FA', alignItems: 'center', justifyContent: 'center' },
  addHourBtn: { marginTop: 10, borderWidth: 1.5, borderColor: '#DACFEC', borderStyle: 'dashed', borderRadius: 16, padding: 13, alignItems: 'center' },
  stepper: { flex: 1, flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: '#F7F5FB', borderRadius: 12, padding: 4, gap: 4, minHeight: 44 },
  stepBtn: { width: 32, height: 32, borderRadius: 99, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
});