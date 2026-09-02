import { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Modal, Switch } from 'react-native';
import { COLORS, DAYS, DAYS_SHORT, todayIndex } from '../theme';
import { getHours, getSchedule, getDaySchedule, setLesson, clearLesson, setHour, resetHours, getSubjects } from '../database';
import { scheduleLessonReminder, cancelReminder } from '../notifications';

export default function ScheduleScreen() {
  const [hours, setHours] = useState([]);
  const [schedule, setSchedule] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [view, setView] = useState('week');
  const [day, setDay] = useState(todayIndex() > 5 ? 0 : todayIndex());
  const [slotModal, setSlotModal] = useState(null); // {day, slot}
  const [remindOn, setRemindOn] = useState(true);
  const [hoursModal, setHoursModal] = useState(false);

  const load = useCallback(async () => {
    setHours(await getHours());
    setSchedule(await getSchedule());
    setSubjects(await getSubjects());
  }, []);
  useEffect(() => { load(); }, [load]);

  const cellAt = (d, slot) => schedule.find(l => l.day === d && l.slot === slot);
  const dayLessons = schedule.filter(l => l.day === day).sort((a, b) => a.slot - b.slot);

  function openSlot(d, slot) {
    const existing = cellAt(d, slot);
    setRemindOn(existing ? !!existing.remind : true);
    setSlotModal({ day: d, slot, subjectId: existing ? existing.subjectId : subjects[0]?.id });
  }

  async function saveSlot() {
    const { day: d, slot, subjectId } = slotModal;
    const prev = cellAt(d, slot);
    if (prev && prev.notifId) await cancelReminder(prev.notifId);
    await setLesson(d, slot, subjectId, remindOn);
    if (remindOn) {
      const subj = subjects.find(s => s.id === subjectId);
      const h = hours[slot];
      await scheduleLessonReminder(d, h.startTime, subj.name);
    }
    setSlotModal(null);
    await load();
  }

  async function removeSlot() {
    const { day: d, slot } = slotModal;
    await clearLesson(d, slot);
    setSlotModal(null);
    await load();
  }

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 54, paddingBottom: 100 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 4 }}>
          <Text style={{ fontSize: 26, fontWeight: '700', color: COLORS.text }}>מערכת שעות</Text>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <TouchableOpacity onPress={() => setHoursModal(true)} style={styles.smallBtn}>
              <Text style={{ color: '#5F5870', fontSize: 12.5, fontWeight: '500' }}>שעות</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => openSlot(day, 0)} style={[styles.smallBtn, { backgroundColor: COLORS.purple }]}>
              <Text style={{ color: '#fff', fontSize: 12.5, fontWeight: '600' }}>+ שיעור</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.viewToggle}>
          {[{ k: 'week', l: 'שבוע' }, { k: 'day', l: 'יום־יום' }].map(v => (
            <TouchableOpacity key={v.k} onPress={() => setView(v.k)}
              style={[styles.viewBtn, view === v.k && { backgroundColor: '#fff' }]}>
              <Text style={{ fontSize: 13, fontWeight: '500', color: view === v.k ? COLORS.text : '#8B839A' }}>{v.l}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {view === 'week' && (
          <View style={styles.gridCard}>
            <View style={{ flexDirection: 'row', gap: 5, marginBottom: 7, paddingRight: 46 }}>
              {DAYS_SHORT.map((d, i) => (
                <Text key={i} style={{ flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '600', color: i === todayIndex() ? COLORS.purple : COLORS.textDim }}>{d}</Text>
              ))}
            </View>
            {hours.map((h, slot) => (
              <View key={slot} style={{ flexDirection: 'row', gap: 5, marginBottom: 5 }}>
                <View style={{ width: 42, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 11, fontWeight: '600', color: COLORS.purple }}>{slot + 1}</Text>
                  <Text style={{ fontSize: 8.5, color: '#6E6580' }}>{h.startTime}</Text>
                </View>
                {DAYS.map((_, d) => {
                  const l = cellAt(d, slot);
                  return (
                    <TouchableOpacity key={d} onPress={() => openSlot(d, slot)}
                      style={[styles.cell, { backgroundColor: l ? l.color + '1E' : '#FAF9FC' }]}>
                      <Text numberOfLines={1} style={{ fontSize: 10.5, fontWeight: '600', color: l ? l.color : '#D6CFE0' }}>{l ? l.name.slice(0, 5) : ''}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </View>
        )}

        {view === 'day' && (
          <>
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 14, marginBottom: 12 }}>
              {DAYS_SHORT.map((d, i) => (
                <TouchableOpacity key={i} onPress={() => setDay(i)}
                  style={[styles.dayPickBtn, day === i && { backgroundColor: COLORS.purple }]}>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: day === i ? '#fff' : '#6E6580' }}>{d}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {dayLessons.map(l => (
              <TouchableOpacity key={l.slot} onPress={() => openSlot(l.day, l.slot)} style={styles.lessonRow}>
                <View style={{ width: 48, alignItems: 'center' }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: COLORS.text }}>{l.startTime}</Text>
                  <Text style={{ fontSize: 10.5, color: COLORS.textFaint }}>{l.endTime}</Text>
                </View>
                <View style={{ width: 4, borderRadius: 99, backgroundColor: l.color, alignSelf: 'stretch' }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '500', color: COLORS.text }}>{l.name}</Text>
                  <Text style={{ fontSize: 12, color: COLORS.textDim, marginTop: 2 }}>שיעור {l.slot + 1} · כיתה {l.room}</Text>
                </View>
              </TouchableOpacity>
            ))}
            {dayLessons.length === 0 && (
              <Text style={{ color: COLORS.textDim, textAlign: 'center', marginTop: 20 }}>אין שיעורים ביום זה</Text>
            )}
          </>
        )}
      </ScrollView>

      {/* Slot edit modal */}
      <Modal visible={!!slotModal} animationType="slide" transparent onRequestClose={() => setSlotModal(null)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            {slotModal && (
              <>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <TouchableOpacity onPress={() => setSlotModal(null)}><Text style={{ color: '#8B839A' }}>ביטול</Text></TouchableOpacity>
                  <Text style={{ fontWeight: '700', fontSize: 16 }}>יום {DAYS[slotModal.day]} · שיעור {slotModal.slot + 1}</Text>
                  <TouchableOpacity onPress={saveSlot}><Text style={{ color: COLORS.purple, fontWeight: '700' }}>שמירה</Text></TouchableOpacity>
                </View>
                <Text style={styles.label}>מקצוע</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
                  {subjects.map(s => (
                    <TouchableOpacity key={s.id} onPress={() => setSlotModal(m => ({ ...m, subjectId: s.id }))}
                      style={[styles.subjChip, { borderColor: slotModal.subjectId === s.id ? s.color : '#EDE9F3', backgroundColor: slotModal.subjectId === s.id ? s.color + '22' : '#fff' }]}>
                      <Text style={{ color: s.color, fontWeight: '500', fontSize: 12.5 }}>{s.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={styles.remindRow}>
                  <View>
                    <Text style={{ fontSize: 14.5, fontWeight: '500' }}>תזכורת לפני השיעור</Text>
                    <Text style={{ fontSize: 12, color: COLORS.textDim, marginTop: 2 }}>10 דקות לפני, כל שבוע ביום זה</Text>
                  </View>
                  <Switch value={remindOn} onValueChange={setRemindOn} trackColor={{ true: COLORS.purple }} />
                </View>
                <TouchableOpacity onPress={removeSlot} style={styles.dangerBtn}>
                  <Text style={{ color: COLORS.red, fontWeight: '500', fontSize: 13.5 }}>מחיקת השיעור מהמשבצת</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Hours editor modal */}
      <Modal visible={hoursModal} animationType="slide" transparent onRequestClose={() => setHoursModal(false)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <TouchableOpacity onPress={async () => { await resetHours(); await load(); }}>
                <Text style={{ color: '#8B839A' }}>ברירת מחדל</Text>
              </TouchableOpacity>
              <Text style={{ fontWeight: '700', fontSize: 16 }}>שעות המערכת</Text>
              <TouchableOpacity onPress={() => setHoursModal(false)}><Text style={{ color: COLORS.purple, fontWeight: '700' }}>סיום</Text></TouchableOpacity>
            </View>
            <ScrollView style={{ marginTop: 10 }}>
              {hours.map((h, slot) => (
                <HourRow key={slot} n={slot + 1} from={h.startTime} to={h.endTime}
                  onChange={async (from, to) => { await setHour(slot, from, to); await load(); }} />
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function shiftTime(t, delta) {
  let [h, m] = t.split(':').map(Number);
  let total = h * 60 + m + delta;
  total = ((total % 1440) + 1440) % 1440;
  return String(Math.floor(total / 60)).padStart(2, '0') + ':' + String(total % 60).padStart(2, '0');
}

function HourRow({ n, from, to, onChange }) {
  return (
    <View style={styles.hourRow}>
      <View style={{ width: 56 }}><Text style={{ fontWeight: '600', fontSize: 13.5 }}>שיעור {n}</Text></View>
      <View style={styles.stepper}>
        <TouchableOpacity onPress={() => onChange(shiftTime(from, -5), to)} style={styles.stepBtn}><Text>−</Text></TouchableOpacity>
        <Text style={{ flex: 1, textAlign: 'center', fontWeight: '700' }}>{from}</Text>
        <TouchableOpacity onPress={() => onChange(shiftTime(from, 5), to)} style={styles.stepBtn}><Text>+</Text></TouchableOpacity>
      </View>
      <View style={styles.stepper}>
        <TouchableOpacity onPress={() => onChange(from, shiftTime(to, -5))} style={styles.stepBtn}><Text>−</Text></TouchableOpacity>
        <Text style={{ flex: 1, textAlign: 'center', fontWeight: '700' }}>{to}</Text>
        <TouchableOpacity onPress={() => onChange(from, shiftTime(to, 5))} style={styles.stepBtn}><Text>+</Text></TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  smallBtn: { borderRadius: 99, paddingVertical: 11, paddingHorizontal: 14, backgroundColor: '#EDE7F5', minHeight: 44, justifyContent: 'center' },
  viewToggle: { flexDirection: 'row', backgroundColor: '#EDE7F5', borderRadius: 99, padding: 3, marginTop: 14, marginHorizontal: 6 },
  viewBtn: { flex: 1, borderRadius: 99, paddingVertical: 11, alignItems: 'center', minHeight: 44, justifyContent: 'center' },
  gridCard: { marginTop: 14, backgroundColor: COLORS.card, borderRadius: 22, padding: 10 },
  cell: { flex: 1, height: 46, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  dayPickBtn: { flex: 1, borderRadius: 14, paddingVertical: 11, alignItems: 'center', backgroundColor: '#fff', minHeight: 44, justifyContent: 'center' },
  lessonRow: { flexDirection: 'row', gap: 12, backgroundColor: COLORS.card, borderRadius: 18, padding: 13, marginBottom: 8, alignItems: 'stretch' },
  overlay: { flex: 1, backgroundColor: 'rgba(35,27,45,0.34)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#FBF9FD', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, maxHeight: '90%' },
  label: { fontSize: 12.5, fontWeight: '600', color: COLORS.textDim, marginTop: 18, marginBottom: 8 },
  subjChip: { borderWidth: 1.5, borderRadius: 99, paddingVertical: 10, paddingHorizontal: 14, minHeight: 44, justifyContent: 'center' },
  remindRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', borderRadius: 18, padding: 14, marginTop: 18 },
  dangerBtn: { marginTop: 12, backgroundColor: COLORS.redTint, borderRadius: 16, padding: 13, alignItems: 'center' },
  hourRow: { flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: '#fff', borderRadius: 16, padding: 10, marginBottom: 8 },
  stepper: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#F7F5FB', borderRadius: 12, padding: 4, gap: 5, minHeight: 44 },
  stepBtn: { width: 34, height: 34, borderRadius: 99, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
});
