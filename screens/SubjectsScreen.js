import { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput, Modal, Alert, KeyboardAvoidingView, Platform, TouchableWithoutFeedback } from 'react-native';
import { COLORS, PALETTE, TOP } from '../theme';
import { getSubjects, saveSubject, deleteSubject, subjectUsage } from '../database';

export default function SubjectsScreen({ onBack }) {
  const [subjects, setSubjects] = useState([]);
  const [draft, setDraft] = useState(null);

  const load = useCallback(async () => setSubjects(await getSubjects()), []);
  useEffect(() => { load(); }, [load]);

  function openNew() {
    setDraft({ id: 's' + Date.now(), name: '', short: '', letter: '', color: PALETTE[0], room: '', teacher: '', isNew: true });
  }
  function openEdit(s) { setDraft({ ...s, isNew: false }); }

  async function save() {
    const name = draft.name.trim();
    if (!name) return Alert.alert('חסר שם', 'צריך לתת שם למקצוע.');
    await saveSubject({
      ...draft,
      name,
      short: (draft.short || '').trim() || name.slice(0, 6),
      letter: (draft.letter || '').trim() || name.slice(0, 2),
    });
    setDraft(null);
    await load();
  }

  async function remove() {
    const use = await subjectUsage(draft.id);
    const detail = [];
    if (use.lessons) detail.push(use.lessons + ' שיעורים במערכת');
    if (use.tasks) detail.push(use.tasks + ' משימות פתוחות');
    Alert.alert(
      'למחוק את ' + draft.name + '?',
      detail.length ? 'יימחקו גם ' + detail.join(' ו') + '.' : 'המקצוע יוסר מהרשימה.',
      [
        { text: 'ביטול', style: 'cancel' },
        { text: 'מחיקה', style: 'destructive', onPress: async () => { await deleteSubject(draft.id); setDraft(null); await load(); } },
      ]
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: TOP, paddingBottom: 110 }} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontSize: 27, fontWeight: '700', color: COLORS.text }}>המקצועות שלי</Text>
          <TouchableOpacity onPress={onBack} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={{ color: COLORS.purple, fontSize: 14, fontWeight: '600' }}>סיום</Text>
          </TouchableOpacity>
        </View>
        <Text style={{ fontSize: 13.5, color: COLORS.textDim, marginTop: 6, textAlign: 'right', lineHeight: 20 }}>
          כל מקצוע עם צבע ומורה — הצבע מופיע גם במערכת וגם על המשימות שלו.
        </Text>

        <View style={{ marginTop: 18, gap: 9 }}>
          {subjects.map(s => (
            <TouchableOpacity key={s.id} onPress={() => openEdit(s)} activeOpacity={0.7} style={styles.row}>
              <View style={[styles.swatch, { backgroundColor: s.color }]}>
                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>{s.letter}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: COLORS.text, textAlign: 'right' }}>{s.name}</Text>
                <Text style={{ fontSize: 12.5, color: COLORS.textDim, marginTop: 2, textAlign: 'right' }}>
                  {s.teacher ? s.teacher : 'בלי מורה'}
                </Text>
              </View>
              <Text style={{ color: '#C9C1D6', fontSize: 15 }}>✎</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity onPress={openNew} style={styles.addBtn}>
          <Text style={{ color: COLORS.purple, fontSize: 15, fontWeight: '700' }}>+ מקצוע חדש</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={!!draft} animationType="slide" transparent onRequestClose={() => setDraft(null)}>
        <View style={{ flex: 1 }}>
          <TouchableWithoutFeedback onPress={() => setDraft(null)}><View style={styles.overlay} /></TouchableWithoutFeedback>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end' }} pointerEvents="box-none">
            <View style={styles.sheet}>
              <View style={styles.handle} />
              {draft && (
                <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                  <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <TouchableOpacity onPress={() => setDraft(null)} style={styles.btnGhost}>
                      <Text style={styles.btnGhostText}>ביטול</Text>
                    </TouchableOpacity>
                    <Text style={{ fontSize: 15.5, fontWeight: '700', color: COLORS.text }}>{draft.isNew ? 'מקצוע חדש' : draft.name}</Text>
                    <TouchableOpacity onPress={save} style={styles.btnPrimary}>
                      <Text style={styles.btnPrimaryText}>שמירה</Text>
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.label}>שם המקצוע</Text>
                  <TextInput value={draft.name} onChangeText={v => setDraft(d => ({ ...d, name: v }))}
                    placeholder="למשל: כימיה" placeholderTextColor="#C6BFD2" style={styles.input} />

                  <Text style={styles.label}>צבע</Text>
                  <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 10 }}>
                    {PALETTE.map(c => (
                      <TouchableOpacity key={c} onPress={() => setDraft(d => ({ ...d, color: c }))}
                        style={[styles.colorDot, { backgroundColor: c, borderWidth: draft.color === c ? 3 : 0 }]} />
                    ))}
                  </View>

                  <View style={{ marginTop: 16 }}>
                    <View style={styles.fieldBox}>
                      <Text style={styles.fieldLabel}>מורה</Text>
                      <TextInput value={draft.teacher} onChangeText={v => setDraft(d => ({ ...d, teacher: v }))}
                        placeholder="שם המורה" placeholderTextColor="#C6BFD2" style={styles.fieldInput} />
                    </View>
                    <Text style={{ fontSize: 12, color: COLORS.textFaint, marginTop: 7, textAlign: 'right' }}>
                      את הכיתה קובעים בכל משבצת במערכת בנפרד — כדי שאפשר לשנות אותה לפי השבוע.
                    </Text>
                  </View>

                  <View style={{ flexDirection: 'row-reverse', gap: 10, marginTop: 10 }}>
                    <View style={styles.fieldBox}>
                      <Text style={styles.fieldLabel}>קיצור בטבלה</Text>
                      <TextInput value={draft.short} onChangeText={v => setDraft(d => ({ ...d, short: v }))}
                        placeholder="כימ׳" placeholderTextColor="#C6BFD2" maxLength={7} style={styles.fieldInput} />
                    </View>
                    <View style={styles.fieldBox}>
                      <Text style={styles.fieldLabel}>אות בעיגול</Text>
                      <TextInput value={draft.letter} onChangeText={v => setDraft(d => ({ ...d, letter: v }))}
                        placeholder="כי" placeholderTextColor="#C6BFD2" maxLength={2} style={styles.fieldInput} />
                    </View>
                  </View>

                  {!draft.isNew && (
                    <TouchableOpacity onPress={remove} style={styles.dangerBtn}>
                      <Text style={{ color: COLORS.red, fontWeight: '600', fontSize: 14 }}>מחיקת המקצוע</Text>
                    </TouchableOpacity>
                  )}
                  <View style={{ height: 16 }} />
                </ScrollView>
              )}
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12, backgroundColor: COLORS.card, borderRadius: 18, padding: 14 },
  swatch: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  addBtn: { marginTop: 14, borderWidth: 1.5, borderColor: '#DACFEC', borderStyle: 'dashed', borderRadius: 18, padding: 16, alignItems: 'center' },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(35,27,45,0.4)' },
  sheet: { backgroundColor: '#FBF9FD', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 14, maxHeight: '90%' },
  handle: { width: 38, height: 4, borderRadius: 99, backgroundColor: '#DDD6E6', alignSelf: 'center', marginBottom: 14 },
  label: { fontSize: 12.5, fontWeight: '700', color: COLORS.textDim, marginTop: 18, marginBottom: 9, textAlign: 'right' },
  input: { backgroundColor: '#fff', borderRadius: 16, paddingHorizontal: 15, paddingVertical: 14, fontSize: 16.5, textAlign: 'right', color: COLORS.text, minHeight: 52 },
  colorDot: { width: 40, height: 40, borderRadius: 99, borderColor: COLORS.text },
  fieldBox: { flex: 1, backgroundColor: '#fff', borderRadius: 16, padding: 13 },
  fieldLabel: { fontSize: 11.5, color: COLORS.textDim, textAlign: 'right' },
  fieldInput: { fontSize: 16, fontWeight: '600', color: COLORS.text, textAlign: 'right', marginTop: 2, padding: 0, minHeight: 26 },
  dangerBtn: { marginTop: 18, backgroundColor: COLORS.redTint, borderRadius: 16, padding: 15, alignItems: 'center' },
  btnGhost: { backgroundColor: '#EFEBF6', borderRadius: 99, paddingVertical: 11, paddingHorizontal: 18, minHeight: 44, justifyContent: 'center' },
  btnGhostText: { color: '#5F5870', fontSize: 14, fontWeight: '700' },
  btnPrimary: { backgroundColor: COLORS.purple, borderRadius: 99, paddingVertical: 11, paddingHorizontal: 20, minHeight: 44, justifyContent: 'center' },
  btnPrimaryText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
