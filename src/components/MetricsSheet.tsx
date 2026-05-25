import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
import { CatalogMetric } from '../services/api';

interface Props {
  visible: boolean;
  metrics: CatalogMetric[];
  loading: boolean;
  onSkip: () => void;
  onConfirm: (values: Record<string, string>, missingBlockingMetricIds: string[]) => void;
}

// ── Inputs par type ──────────────────────────────────────────────────────────

function NumberInput({
  value, onChange, unit, min, max,
}: { value: string; onChange: (v: string) => void; unit: string | null; min?: number; max?: number }) {
  const placeholder = min !== undefined && max !== undefined ? `${min}–${max}` : '';
  return (
    <View style={inputStyles.row}>
      <TextInput
        style={inputStyles.textInput}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={C.text3}
        keyboardType="decimal-pad"
        returnKeyType="done"
      />
      {unit && <Text style={inputStyles.unit}>{unit}</Text>}
    </View>
  );
}

function TextInput_({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <TextInput
      style={[inputStyles.textInput, { flex: 1 }]}
      value={value}
      onChangeText={onChange}
      placeholder="Ex: 4:30"
      placeholderTextColor={C.text3}
      returnKeyType="done"
    />
  );
}

function ScaleInput({ value, onChange, min = 1, max = 5 }: { value: string; onChange: (v: string) => void; min?: number; max?: number }) {
  const steps = Array.from({ length: max - min + 1 }, (_, i) => String(i + min));
  return (
    <View style={inputStyles.scaleRow}>
      {steps.map((s) => (
        <TouchableOpacity
          key={s}
          style={[inputStyles.scaleBtn, value === s && inputStyles.scaleBtnActive]}
          onPress={() => onChange(s)}
          activeOpacity={0.7}
        >
          <Text style={[inputStyles.scaleBtnLabel, value === s && inputStyles.scaleBtnLabelActive]}>{s}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function EnumInput({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={inputStyles.enumScroll} contentContainerStyle={inputStyles.enumContent}>
      {options.map((opt) => (
        <TouchableOpacity
          key={opt}
          style={[inputStyles.enumChip, value === opt && inputStyles.enumChipActive]}
          onPress={() => onChange(value === opt ? '' : opt)}
          activeOpacity={0.7}
        >
          <Text style={[inputStyles.enumChipLabel, value === opt && inputStyles.enumChipLabelActive]} numberOfLines={1}>
            {opt}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const inputStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  textInput: {
    flex: 1,
    backgroundColor: C.bg3,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    color: C.text,
    fontSize: 14,
  },
  unit: { fontSize: 12, color: C.text3, minWidth: 40 },
  scaleRow: { flexDirection: 'row', gap: 8 },
  scaleBtn: {
    width: 42, height: 36, borderRadius: 9,
    backgroundColor: C.bg3, borderWidth: 1, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center',
  },
  scaleBtnActive: { backgroundColor: C.blueLight, borderColor: C.blue },
  scaleBtnLabel: { fontSize: 14, color: C.text2, fontWeight: '500' },
  scaleBtnLabelActive: { color: C.blue, fontWeight: '700' },
  enumScroll: { marginTop: 2 },
  enumContent: { gap: 8, paddingRight: 4 },
  enumChip: {
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 20, backgroundColor: C.bg3,
    borderWidth: 1, borderColor: C.border,
  },
  enumChipActive: { backgroundColor: C.blueLight, borderColor: C.blue },
  enumChipLabel: { fontSize: 12, color: C.text2 },
  enumChipLabelActive: { color: C.blue, fontWeight: '600' },
});

// ── Ligne de métrique ────────────────────────────────────────────────────────

function MetricRow({
  metric, value, onChange,
}: { metric: CatalogMetric; value: string; onChange: (v: string) => void }) {
  const { t } = useTranslation();
  const isBlocking = metric.blocking_for_sports.length > 0;
  const isPreFilled = !!metric.user_value && value === metric.user_value;

  const volatilityLabel = metric.volatility === 'stable'
    ? t('metricsPopup.stable')
    : t('metricsPopup.contextual');

  return (
    <View style={rowStyles.container}>
      <View style={rowStyles.header}>
        <View style={rowStyles.headerLeft}>
          <Text style={rowStyles.name}>{metric.name}</Text>
          {isBlocking && <View style={rowStyles.blockingBadge}><Text style={rowStyles.blockingLabel}>{t('metricsPopup.key')}</Text></View>}
        </View>
        <View style={[rowStyles.volatilityBadge, metric.volatility === 'stable' ? rowStyles.stableBadge : rowStyles.contextualBadge]}>
          <Text style={[rowStyles.volatilityLabel, metric.volatility === 'stable' ? rowStyles.stableLabel : rowStyles.contextualLabel]}>
            {volatilityLabel}
          </Text>
        </View>
      </View>

      {metric.description && (
        <Text style={rowStyles.description} numberOfLines={2}>{metric.description}</Text>
      )}

      <View style={rowStyles.inputWrapper}>
        {metric.type === 'number' && (
          <NumberInput
            value={value}
            onChange={onChange}
            unit={metric.unit}
            min={metric.value_range?.min}
            max={metric.value_range?.max}
          />
        )}
        {metric.type === 'text' && <TextInput_ value={value} onChange={onChange} />}
        {metric.type === 'scale' && (
          <ScaleInput
            value={value}
            onChange={onChange}
            min={metric.value_range?.min}
            max={metric.value_range?.max}
          />
        )}
        {metric.type === 'enum' && (
          <EnumInput value={value} onChange={onChange} options={metric.enum_values ?? []} />
        )}
      </View>

      {isPreFilled && (
        <Text style={rowStyles.preFillHint}>{t('metricsPopup.preFilled')}</Text>
      )}
    </View>
  );
}

const rowStyles = StyleSheet.create({
  container: {
    backgroundColor: C.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    padding: 14,
    gap: 8,
    marginBottom: 10,
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  headerLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  name: { fontSize: 14, fontWeight: '600', color: C.text },
  blockingBadge: {
    backgroundColor: 'rgba(59,130,246,0.12)',
    borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2,
  },
  blockingLabel: { fontSize: 10, color: C.blue, fontWeight: '700' },
  volatilityBadge: {
    borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  stableBadge: { backgroundColor: 'rgba(22,163,74,0.1)' },
  contextualBadge: { backgroundColor: 'rgba(249,115,22,0.1)' },
  volatilityLabel: { fontSize: 10, fontWeight: '600' },
  stableLabel: { color: C.green },
  contextualLabel: { color: C.orange },
  description: { fontSize: 12, color: C.text3, lineHeight: 17 },
  inputWrapper: { marginTop: 2 },
  preFillHint: { fontSize: 11, color: C.text3, fontStyle: 'italic' },
});

// ── Composant principal ──────────────────────────────────────────────────────

export default function MetricsPopup({ visible, metrics, loading, onSkip, onConfirm }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [values, setValues] = useState<Record<string, string>>({});

  // Préremplir depuis les valeurs utilisateur existantes à chaque ouverture
  useEffect(() => {
    if (visible && metrics.length > 0) {
      const initial: Record<string, string> = {};
      for (const m of metrics) {
        if (m.user_value) initial[m.id] = m.user_value;
      }
      setValues(initial);
    }
  }, [visible, metrics]);

  const handleChange = useCallback((id: string, v: string) => {
    setValues((prev) => ({ ...prev, [id]: v }));
  }, []);

  const handleConfirm = useCallback(() => {
    const filled: Record<string, string> = {};
    for (const [k, v] of Object.entries(values)) {
      if (v.trim()) filled[k] = v.trim();
    }
    // Métriques bloquantes encore absentes après remplissage → transmises au parent pour WarmupModePopup
    const missingBlockingIds = metrics
      .filter(m => m.blocking_for_sports.length > 0 && m.discovery_session && !m.user_value && !values[m.id]?.trim())
      .map(m => m.id);
    onConfirm(filled, missingBlockingIds);
  }, [values, metrics, onConfirm]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <KeyboardAvoidingView style={popupStyles.root} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        {/* Header */}
        <View style={[popupStyles.header, { paddingTop: insets.top + 12 }]}>
          <View>
            <Text style={popupStyles.title}>{t('metricsPopup.title')}</Text>
            <Text style={popupStyles.subtitle}>{t('metricsPopup.subtitle')}</Text>
          </View>
          <TouchableOpacity onPress={onSkip} style={popupStyles.skipBtn} activeOpacity={0.7}>
            <Text style={popupStyles.skipBtnLabel}>{t('metricsPopup.skip')}</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={popupStyles.loaderWrapper}>
            <ActivityIndicator color={C.blue} size="large" />
            <Text style={popupStyles.loaderText}>{t('metricsPopup.loading')}</Text>
          </View>
        ) : (
          <ScrollView
            style={popupStyles.scroll}
            contentContainerStyle={[popupStyles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            <Text style={popupStyles.hint}>{t('metricsPopup.hint')}</Text>
            {metrics.map((m) => (
              <MetricRow
                key={m.id}
                metric={m}
                value={values[m.id] ?? ''}
                onChange={(v) => handleChange(m.id, v)}
              />
            ))}

          </ScrollView>
        )}

        {/* Footer fixe */}
        <View style={[popupStyles.footer, { paddingBottom: insets.bottom + 8 }]}>
          <TouchableOpacity style={popupStyles.skipFooterBtn} onPress={onSkip} activeOpacity={0.7}>
            <Text style={popupStyles.skipFooterLabel}>{t('metricsPopup.skip')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={popupStyles.confirmBtnWrapper} onPress={handleConfirm} activeOpacity={0.85}>
            <LinearGradient
              colors={[C.blue, '#6366F1']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={popupStyles.confirmBtn}
            >
              <Text style={popupStyles.confirmBtnLabel}>{t('metricsPopup.generate')}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const popupStyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  title: { fontSize: 18, fontWeight: '700', color: C.text, marginBottom: 3 },
  subtitle: { fontSize: 13, color: C.text2, maxWidth: 220 },
  skipBtn: { paddingVertical: 4, paddingLeft: 12 },
  skipBtnLabel: { fontSize: 14, color: C.text3 },
  loaderWrapper: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  loaderText: { fontSize: 14, color: C.text2 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16 },
  hint: { fontSize: 12, color: C.text3, marginBottom: 14, lineHeight: 18 },
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
  confirmBtnWrapper: { flex: 2 },
  confirmBtn: { padding: 14, borderRadius: 12, alignItems: 'center' },
  confirmBtnLabel: { fontSize: 14, fontWeight: '700', color: '#fff' },
});
