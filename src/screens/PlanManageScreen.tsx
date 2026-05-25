import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { C, SESSION_COLORS, sessionColor } from '../constants/colors';
import { RootStackParamList } from '../types';
import * as Sharing from 'expo-sharing';
import { renamePlan, deletePlan, patchPlan, exportPlanPdf } from '../services/api';
import Icon from '../components/Icon';
import { useAuth } from '../context/AuthContext';
import { usePurchase } from '../context/PurchaseContext';
import { useTranslation } from 'react-i18next';
import { LargeHeader, SectionLabel, Button } from '../components/ui';

type Props = NativeStackScreenProps<RootStackParamList, 'PlanManage'>;

export default function PlanManageScreen({ route, navigation }: Props) {
  const { plan } = route.params;
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { user, handleSessionExpired } = useAuth();
  const { showPaywall } = usePurchase();

  const [titre, setTitre] = useState(plan.titre);
  const [renaming, setRenaming] = useState(false);
  const [couleur, setCouleur] = useState<string | null>(plan.couleur ?? null);
  const [emoji, setEmoji] = useState(plan.emoji ?? '');

  const [exporting, setExporting] = useState(false);

  async function handleRename() {
    if (!titre.trim() || titre.trim() === plan.titre) return;
    setRenaming(true);
    try {
      await renamePlan(plan.id, titre.trim());
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.goBack();
    } catch (e: any) {
      if (e?.message === 'SESSION_EXPIRED') { handleSessionExpired(); return; }
      Alert.alert(t('common.error'), e?.message ?? t('planManage.alertRenameError'));
    } finally {
      setRenaming(false);
    }
  }

  async function handleDelete() {
    Alert.alert(
      t('planManage.alertDeleteTitle'),
      t('planManage.alertDeleteMsg'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('planManage.alertDeleteConfirm'),
          style: 'destructive',
          onPress: async () => {
            try {
              await deletePlan(plan.id);
              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              navigation.goBack();
            } catch (e: any) {
              if (e?.message === 'SESSION_EXPIRED') { handleSessionExpired(); return; }
              Alert.alert(t('common.error'), t('planManage.alertDeleteError'));
            }
          },
        },
      ],
    );
  }

  async function handleColorChange(name: string) {
    Haptics.selectionAsync();
    const newCouleur = name === couleur ? null : name;
    setCouleur(newCouleur);
    try {
      await patchPlan(plan.id, { couleur: newCouleur });
    } catch {
      // silent — valeur locale déjà mise à jour
    }
  }

  async function handleEmojiSave() {
    try {
      await patchPlan(plan.id, { emoji: emoji.trim() || null });
    } catch {
      // silent
    }
  }

  async function handleExportPdf() {
    setExporting(true);
    try {
      const uri = await exportPlanPdf(plan.id);
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        UTI: 'com.adobe.pdf',
        dialogTitle: plan.titre,
      });
    } catch (e: any) {
      if (e?.message === 'SESSION_EXPIRED') { handleSessionExpired(); return; }
      Alert.alert(t('common.error'), e?.message ?? t('planManage.alertExportError'));
    } finally {
      setExporting(false);
    }
  }


  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <LargeHeader
        title={t('planManage.title')}
        onBack={() => navigation.goBack()}
      />

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">

        {/* Rename */}
        <View style={styles.section}>
          <SectionLabel label={t('planManage.sectionName')} />
          <View style={styles.fieldRow}>
            <TextInput
              value={titre}
              onChangeText={setTitre}
              style={styles.input}
              placeholderTextColor={C.text3}
              autoCorrect={false}
              autoCapitalize="sentences"
            />
            <TouchableOpacity
              style={[styles.saveBtn, (!titre.trim() || titre.trim() === plan.titre) && styles.saveBtnDisabled]}
              onPress={handleRename}
              disabled={!titre.trim() || titre.trim() === plan.titre || renaming}
            >
              {renaming
                ? <ActivityIndicator size="small" color="#fff" />
                : <Icon name="check" size={16} color="#fff" />
              }
            </TouchableOpacity>
          </View>
        </View>

        {/* Couleur du plan */}
        <View style={styles.section}>
          <SectionLabel label={t('planManage.sectionColor')} />
          <View style={styles.swatches}>
            {SESSION_COLORS.map((c) => {
              const selected = couleur === c.name;
              return (
                <TouchableOpacity
                  key={c.name}
                  onPress={() => handleColorChange(c.name)}
                  style={[styles.swatch, { backgroundColor: c.hex }, selected && styles.swatchSelected]}
                  activeOpacity={0.75}
                >
                  {selected && <Icon name="check" size={14} color="#fff" />}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Emoji du plan */}
        <View style={styles.section}>
          <SectionLabel label={t('planManage.sectionEmoji')} />
          <View style={styles.emojiRow}>
            {couleur && (
              <View style={[styles.emojiPreview, { backgroundColor: sessionColor(couleur) + '25', borderColor: sessionColor(couleur) + '60' }]}>
                <Text style={styles.emojiPreviewText}>{emoji || '?'}</Text>
              </View>
            )}
            <TextInput
              value={emoji}
              onChangeText={(v) => setEmoji(v.slice(-2))}
              onBlur={handleEmojiSave}
              placeholder="🏃"
              placeholderTextColor={C.text3}
              style={[styles.input, { flex: 1 }]}
              maxLength={4}
              autoCorrect={false}
              autoCapitalize="none"
            />
          </View>
        </View>

        {/* Actualiser IA */}
        <View style={styles.section}>
          <SectionLabel label={t('planManage.sectionRefresh')} />
          <Button
            label={t('planManage.refreshBtn')}
            onPress={() => navigation.navigate('PlanRefresh', { planId: plan.id })}
            icon={<Icon name="refresh" size={16} color="#fff" />}
            full
          />
        </View>

        {/* Export PDF */}
        <View style={styles.section}>
          <SectionLabel label={t('planManage.sectionExport')} />
          <Button
            label={exporting ? t('planManage.exporting') : t('planManage.exportPDF')}
            onPress={handleExportPdf}
            variant="secondary"
            disabled={exporting}
            icon={exporting
              ? <ActivityIndicator size="small" color={C.blue} />
              : <Icon name="export" size={16} color={C.blue} />
            }
            full
          />
        </View>

        {/* Delete */}
        <View style={styles.section}>
          <SectionLabel label={t('planManage.sectionDanger')} />
          <Button
            label={t('planManage.deleteBtn')}
            onPress={handleDelete}
            variant="danger"
            icon={<Icon name="x" size={16} color={C.red} />}
            full
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  content: { paddingHorizontal: 20, paddingTop: 8 },

  section: { marginBottom: 28 },
  sectionDesc: { fontSize: 13, color: C.text2, lineHeight: 19 },

  fieldRow: { flexDirection: 'row', gap: 8 },
  input: {
    flex: 1, backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13,
    color: C.text, fontSize: 15,
  },
  saveBtn: {
    width: 46, backgroundColor: C.blue, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  saveBtnDisabled: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border },

  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  swatch: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  swatchSelected: { borderWidth: 3, borderColor: '#fff' },

  emojiRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  emojiPreview: {
    width: 46, height: 46, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },
  emojiPreviewText: { fontSize: 22 },

});
