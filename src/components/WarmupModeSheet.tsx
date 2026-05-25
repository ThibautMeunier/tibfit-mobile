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

interface Props {
  visible: boolean;
  missingMetricNames: string[];
  onSelect: (mode: 'direct_test' | 'base_first') => void;
}

export default function WarmupModeSheet({ visible, missingMetricNames, onSelect }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={[styles.root, { paddingTop: insets.top + 16 }]}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
        >
          {/* Header */}
          <Text style={styles.title}>{t('warmupPopup.title')}</Text>
          <Text style={styles.subtitle}>{t('warmupPopup.subtitle')}</Text>

          {missingMetricNames.length > 0 && (
            <View style={styles.missingBox}>
              <Text style={styles.missingLabel}>{t('warmupPopup.missingLabel')}</Text>
              <Text style={styles.missingMetrics}>{missingMetricNames.join(', ')}</Text>
            </View>
          )}

          {/* Option A — Direct au test */}
          <TouchableOpacity
            style={styles.card}
            onPress={() => onSelect('direct_test')}
            activeOpacity={0.85}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.cardEmoji}>⚡</Text>
              <View style={styles.cardHeaderText}>
                <Text style={styles.cardTitle}>{t('warmupPopup.directTest.title')}</Text>
                <View style={styles.badge}>
                  <Text style={styles.badgeLabel}>{t('warmupPopup.directTest.badge')}</Text>
                </View>
              </View>
            </View>
            <Text style={styles.cardDescription}>{t('warmupPopup.directTest.description')}</Text>
            <LinearGradient
              colors={[C.blue, '#6366F1']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.selectBtn}
            >
              <Text style={styles.selectBtnLabel}>{t('warmupPopup.directTest.cta')}</Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* Option B — Remise en forme d'abord */}
          <TouchableOpacity
            style={styles.card}
            onPress={() => onSelect('base_first')}
            activeOpacity={0.85}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.cardEmoji}>🌱</Text>
              <View style={styles.cardHeaderText}>
                <Text style={styles.cardTitle}>{t('warmupPopup.baseFirst.title')}</Text>
              </View>
            </View>
            <Text style={styles.cardDescription}>{t('warmupPopup.baseFirst.description')}</Text>
            <View style={styles.selectBtnOutline}>
              <Text style={styles.selectBtnOutlineLabel}>{t('warmupPopup.baseFirst.cta')}</Text>
            </View>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, gap: 0 },
  title: { fontSize: 22, fontWeight: '700', color: C.text, marginBottom: 8 },
  subtitle: { fontSize: 14, color: C.text2, lineHeight: 21, marginBottom: 16 },
  missingBox: {
    backgroundColor: 'rgba(59,130,246,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.2)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
  },
  missingLabel: { fontSize: 11, color: C.blue, fontWeight: '700', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  missingMetrics: { fontSize: 13, color: C.text, fontWeight: '500' },
  card: {
    backgroundColor: C.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
    marginBottom: 14,
    gap: 10,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardEmoji: { fontSize: 28 },
  cardHeaderText: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  cardTitle: { fontSize: 16, fontWeight: '700', color: C.text },
  badge: {
    backgroundColor: C.blueLight,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  badgeLabel: { fontSize: 10, color: C.blue, fontWeight: '700' },
  cardDescription: { fontSize: 13, color: C.text2, lineHeight: 20 },
  selectBtn: { borderRadius: 10, padding: 12, alignItems: 'center' },
  selectBtnLabel: { fontSize: 14, fontWeight: '700', color: '#fff' },
  selectBtnOutline: {
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.bg3,
  },
  selectBtnOutlineLabel: { fontSize: 14, fontWeight: '700', color: C.text2 },
});
