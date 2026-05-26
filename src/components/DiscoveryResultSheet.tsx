import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { C } from '../constants/colors';
import { CatalogMetric, getMetricsCatalog, submitMetricResult } from '../services/api';

interface Props {
  visible: boolean;
  discoveryMetricId: string;
  onDone: () => void;
  onSkip: () => void;
  onRecalibrate?: (metricId: string, planId: number) => void;
  onAfterClose?: () => void;
}

export default function DiscoveryResultPopup({ visible, discoveryMetricId, onDone, onSkip, onRecalibrate, onAfterClose }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [metric, setMetric] = useState<CatalogMetric | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [value, setValue] = useState('');

  useEffect(() => {
    if (!visible || !discoveryMetricId) return;
    setValue('');
    setLoading(true);
    getMetricsCatalog()
      .then((catalog) => {
        const found = catalog.find((m) => m.id === discoveryMetricId) ?? null;
        setMetric(found);
        if (found?.user_value) setValue(found.user_value);
      })
      .catch(() => setMetric(null))
      .finally(() => setLoading(false));
  }, [visible, discoveryMetricId]);

  const handleSave = useCallback(async () => {
    if (!value.trim() || !metric) return;
    setSaving(true);
    try {
      const result = await submitMetricResult(metric.id, value.trim());
      const pending = result.pending_recalibration;
      if (pending && onRecalibrate) {
        Alert.alert(
          t('recalibration.confirmTitle'),
          t('recalibration.confirmMsg', { nb: pending.nb_seances_a_recalibrer }),
          [
            {
              text: t('recalibration.later'),
              style: 'cancel',
              onPress: () => onDone(),
            },
            {
              text: t('recalibration.yes'),
              onPress: () => onRecalibrate(metric.id, pending.plan_id),
            },
          ],
        );
      } else {
        onDone();
      }
    } catch (e: any) {
      Alert.alert(t('common.error'), t(`errors.${e?.message}`, { defaultValue: t('common.error') }));
    } finally {
      setSaving(false);
    }
  }, [value, metric, onDone, onRecalibrate, t]);

  const renderInput = () => {
    if (!metric) return null;
    if (metric.type === 'number') {
      const placeholder = metric.value_range
        ? `${metric.value_range.min}–${metric.value_range.max}`
        : '';
      return (
        <View style={styles.inputRow}>
          <TextInput
            style={styles.textInput}
            value={value}
            onChangeText={setValue}
            placeholder={placeholder}
            placeholderTextColor={C.text3}
            keyboardType="decimal-pad"
            returnKeyType="done"
            autoFocus
          />
          {metric.unit && <Text style={styles.unit}>{metric.unit}</Text>}
        </View>
      );
    }
    if (metric.type === 'text') {
      return (
        <TextInput
          style={[styles.textInput, { flex: 1 }]}
          value={value}
          onChangeText={setValue}
          placeholder={metric.discovery_session ? `Ex: ${metric.discovery_session.title}` : ''}
          placeholderTextColor={C.text3}
          returnKeyType="done"
          autoFocus
        />
      );
    }
    if (metric.type === 'scale') {
      const min = metric.value_range?.min ?? 1;
      const max = metric.value_range?.max ?? 5;
      const steps = Array.from({ length: max - min + 1 }, (_, i) => String(i + min));
      return (
        <View style={styles.scaleRow}>
          {steps.map((s) => (
            <TouchableOpacity
              key={s}
              style={[styles.scaleBtn, value === s && styles.scaleBtnActive]}
              onPress={() => setValue(s)}
              activeOpacity={0.7}
            >
              <Text style={[styles.scaleBtnLabel, value === s && styles.scaleBtnLabelActive]}>{s}</Text>
            </TouchableOpacity>
          ))}
        </View>
      );
    }
    if (metric.type === 'enum') {
      return (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.enumContent}>
          {(metric.enum_values ?? []).map((opt) => (
            <TouchableOpacity
              key={opt}
              style={[styles.enumChip, value === opt && styles.enumChipActive]}
              onPress={() => setValue(value === opt ? '' : opt)}
              activeOpacity={0.7}
            >
              <Text style={[styles.enumChipLabel, value === opt && styles.enumChipLabelActive]}>{opt}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      );
    }
    return null;
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="formSheet" transparent={false} onDismiss={onAfterClose}>
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <View style={styles.headerLeft}>
            <Text style={styles.title}>{t('discoveryResultPopup.title')}</Text>
            {metric && <Text style={styles.metricName}>{t(`metrics.${metric.id}`, { defaultValue: metric.name })}</Text>}
          </View>
          <TouchableOpacity onPress={onSkip} style={styles.skipBtn} activeOpacity={0.7}>
            <Text style={styles.skipLabel}>{t('discoveryResultPopup.skip')}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
          keyboardShouldPersistTaps="handled"
        >
          {loading ? (
            <ActivityIndicator color={C.blue} size="large" style={{ marginTop: 40 }} />
          ) : metric ? (
            <>
              {metric.description && (
                <Text style={styles.description}>{metric.description}</Text>
              )}
              {metric.discovery_session && (
                <View style={styles.protocolBox}>
                  <Text style={styles.protocolLabel}>{t('discoveryResultPopup.protocol')}</Text>
                  <Text style={styles.protocolText}>{metric.discovery_session.description}</Text>
                </View>
              )}
              <Text style={styles.inputLabel}>{t('discoveryResultPopup.inputLabel')}</Text>
              {renderInput()}
            </>
          ) : (
            <Text style={styles.description}>{t('discoveryResultPopup.notFound')}</Text>
          )}
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: insets.bottom + 8 }]}>
          <TouchableOpacity style={styles.skipFooterBtn} onPress={onSkip} activeOpacity={0.7}>
            <Text style={styles.skipFooterLabel}>{t('discoveryResultPopup.skip')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.saveWrapper}
            onPress={handleSave}
            disabled={!value.trim() || saving || !metric}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={value.trim() && metric ? [C.blue, '#6366F1'] : [C.bg3, C.bg3]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.saveBtn}
            >
              {saving ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={[styles.saveBtnLabel, !value.trim() && { color: C.text3 }]}>
                  {t('discoveryResultPopup.save')}
                </Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  headerLeft: { flex: 1 },
  title: { fontSize: 13, color: C.text3, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 },
  metricName: { fontSize: 20, fontWeight: '700', color: C.text },
  skipBtn: { paddingVertical: 4, paddingLeft: 16 },
  skipLabel: { fontSize: 14, color: C.text3 },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, gap: 0 },
  description: { fontSize: 13, color: C.text2, lineHeight: 20, marginBottom: 16 },
  protocolBox: {
    backgroundColor: 'rgba(59,130,246,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.18)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
  },
  protocolLabel: { fontSize: 11, color: C.blue, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  protocolText: { fontSize: 13, color: C.text2, lineHeight: 19 },
  inputLabel: { fontSize: 13, fontWeight: '600', color: C.text, marginBottom: 10 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  textInput: {
    flex: 1,
    backgroundColor: C.bg3,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: C.text,
    fontSize: 16,
  },
  unit: { fontSize: 14, color: C.text2, minWidth: 44 },
  scaleRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  scaleBtn: {
    width: 48, height: 40, borderRadius: 10,
    backgroundColor: C.bg3, borderWidth: 1, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center',
  },
  scaleBtnActive: { backgroundColor: C.blueLight, borderColor: C.blue },
  scaleBtnLabel: { fontSize: 15, color: C.text2, fontWeight: '500' },
  scaleBtnLabelActive: { color: C.blue, fontWeight: '700' },
  enumContent: { gap: 8, paddingRight: 4 },
  enumChip: {
    paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: 20, backgroundColor: C.bg3,
    borderWidth: 1, borderColor: C.border,
  },
  enumChipActive: { backgroundColor: C.blueLight, borderColor: C.blue },
  enumChipLabel: { fontSize: 13, color: C.text2 },
  enumChipLabelActive: { color: C.blue, fontWeight: '600' },
  footer: {
    flexDirection: 'row',
    gap: 10,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: C.border,
    backgroundColor: C.bg,
  },
  skipFooterBtn: {
    flex: 1,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  skipFooterLabel: { fontSize: 14, fontWeight: '600', color: C.text2 },
  saveWrapper: { flex: 2 },
  saveBtn: { padding: 14, borderRadius: 12, alignItems: 'center' },
  saveBtnLabel: { fontSize: 14, fontWeight: '700', color: '#fff' },
});
