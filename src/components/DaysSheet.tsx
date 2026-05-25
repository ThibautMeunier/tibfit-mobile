import React from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { C } from '../constants/colors';
import DaysWeeksSelector, { JOURS_FR, Jour, WEEKS_OPTIONS_LONG } from './DaysWeeksSelector';

interface Props {
  visible: boolean;
  selectedJours: Set<Jour>;
  onToggleJour: (jour: Jour) => void;
  selectedWeeks: number;
  onSelectWeeks: (w: number) => void;
  loading: boolean;
  onConfirm: (jours: string[], semaines: number) => void;
  onSkip: () => void;
}

export default function DaysSheet({ visible, selectedJours, onToggleJour, selectedWeeks, onSelectWeeks, loading, onConfirm, onSkip }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const sortedSelected = JOURS_FR.filter((j) => selectedJours.has(j));

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" transparent={false}>
      <View style={[styles.root, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>{t('daysPopup.title')}</Text>
          <Text style={styles.subtitle}>{t('daysPopup.subtitle')}</Text>

          <DaysWeeksSelector
            selectedJours={selectedJours}
            onToggleJour={onToggleJour}
            selectedWeeks={selectedWeeks}
            onSelectWeeks={onSelectWeeks}
            weekOptions={WEEKS_OPTIONS_LONG}
            loading={loading}
            hint={loading ? undefined : t('daysPopup.selectedHint', { count: selectedJours.size })}
            weeksLabel={t('daysPopup.weeksLabel')}
            weekLabel={(count) => t('daysPopup.week', { count })}
          />
        </ScrollView>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.skipBtn} onPress={onSkip}>
            <Text style={styles.skipLabel}>{t('daysPopup.skip')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.confirmBtn, (loading || selectedJours.size === 0) && { opacity: 0.5 }]}
            onPress={() => onConfirm(sortedSelected, selectedWeeks)}
            disabled={loading || selectedJours.size === 0}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={[C.blue, '#6366F1']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.confirmBtnInner}
            >
              <Text style={styles.confirmLabel}>{t('daysPopup.confirm')}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  content: { paddingHorizontal: 24, paddingBottom: 16 },
  title: { fontSize: 20, fontWeight: '700', color: C.text, marginBottom: 8 },
  subtitle: { fontSize: 14, color: C.text2, lineHeight: 20, marginBottom: 28 },

  actions: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 24,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  skipBtn: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  skipLabel: { fontSize: 14, color: C.text3, fontWeight: '600' },
  confirmBtn: { flex: 1 },
  confirmBtnInner: { borderRadius: 14, padding: 16, alignItems: 'center' },
  confirmLabel: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
