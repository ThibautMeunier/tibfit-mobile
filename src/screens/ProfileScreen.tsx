import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Linking,
  Share,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import Constants from 'expo-constants';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';
import { C } from '../constants/colors';
import { PRIVACY_URL, TERMS_URL } from '../constants/legal';
import { useAuth } from '../context/AuthContext';
import {
  updateProfile,
  updatePassword,
  deleteAccount,
  exportData,
  updateAthleteProfile,
  getUserMetrics,
  getMetricsCatalog,
  upsertUserMetric,
  updateUserMetric,
  deleteUserMetric,
  getCustomMetrics,
  createCustomMetric,
  updateCustomMetric,
  deleteCustomMetric,
  UserMetric,
  CatalogMetric,
  CustomMetricDef,
} from '../services/api';
import Icon from '../components/Icon';
import { SectionLabel, Button } from '../components/ui';
import { RootStackParamList } from '../types';
import { isHealthKitAvailable, isAuthorized, requestPermissions, openHealthSettings, readFitnessMetrics, FitnessMetrics } from '../services/healthKit';
import { setLanguage, SUPPORTED_LANGUAGES, AppLanguage } from '../i18n';

type Section = 'profil' | 'securite' | 'donnees';

// DB stores French level codes; option (b): keep French in DB, translate display only.
const NIVEAU_OPTIONS: { value: string; key: string }[] = [
  { value: 'débutant',      key: 'profile.niveau_debutant' },
  { value: 'intermédiaire', key: 'profile.niveau_intermediaire' },
  { value: 'avancé',        key: 'profile.niveau_avance' },
  { value: 'expert',        key: 'profile.niveau_expert' },
];

function DataRow({
  icon,
  label,
  chevron = true,
  danger = false,
  onPress,
}: {
  icon: React.ComponentProps<typeof Icon>['name'];
  label: string;
  chevron?: boolean;
  danger?: boolean;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity style={styles.dataRow} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.dataRowIcon, danger && styles.dataRowIconDanger]}>
        <Icon name={icon} size={15} color={danger ? C.red : C.blue} />
      </View>
      <Text style={[styles.dataRowLabel, danger && styles.dataRowLabelDanger]}>{label}</Text>
      {chevron && <Icon name="chevronRight" size={16} color={danger ? C.red + '80' : C.text3} />}
    </TouchableOpacity>
  );
}

function MetricField({
  label,
  value,
  onChangeText,
  unit,
  color,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  unit?: string;
  color: string;
  keyboardType?: React.ComponentProps<typeof TextInput>['keyboardType'];
}) {
  return (
    <View style={styles.metricField}>
      <Text style={styles.metricLabel}>{label}</Text>
      <View style={styles.metricCard}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboardType ?? 'decimal-pad'}
          style={[styles.metricValue, { color }]}
          placeholderTextColor={C.text3}
          autoCorrect={false}
          autoCapitalize="none"
        />
        {unit ? <Text style={styles.metricUnit}>{unit}</Text> : null}
      </View>
    </View>
  );
}

export default function ProfileScreen() {
  const { t, i18n } = useTranslation();
  const { user, signOut, refreshUser, handleSessionExpired } = useAuth();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [section, setSection] = useState<Section>('profil');
  const [currentLang, setCurrentLang] = useState<AppLanguage>(i18n.language as AppLanguage);

  // Profil
  const [name, setName] = useState(user?.name ?? '');
  const [savingName, setSavingName] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [niveau, setNiveau] = useState(user?.niveau ?? '');
  const [objectif, setObjectif] = useState(user?.objectif ?? '');
  const [savingProfil, setSavingProfil] = useState(false);

  // Métriques personnalisées
  const [userMetrics, setUserMetrics] = useState<UserMetric[]>([]);
  const [catalogMetrics, setCatalogMetrics] = useState<CatalogMetric[]>([]);
  const [customMetrics, setCustomMetrics] = useState<CustomMetricDef[]>([]);
  const [metricsLoading, setMetricsLoading] = useState(false);
  // Edit modal (catalogue)
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingUserMetric, setEditingUserMetric] = useState<UserMetric | null>(null);
  const [editingCatalogEntry, setEditingCatalogEntry] = useState<CatalogMetric | null>(null);
  const [editValue, setEditValue] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  // Picker modal (catalogue)
  const [pickerVisible, setPickerVisible] = useState(false);
  // Create custom metric modal
  const [createCustomVisible, setCreateCustomVisible] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customType, setCustomType] = useState<'number' | 'text' | 'scale'>('number');
  const [customUnit, setCustomUnit] = useState('');
  const [customInitialValue, setCustomInitialValue] = useState('');
  const [savingCustom, setSavingCustom] = useState(false);

  function getCatalogEntry(metric_id: string): CatalogMetric | undefined {
    return catalogMetrics.find((c) => c.id === metric_id);
  }

  function openEditModal(userMetric: UserMetric) {
    const entry = getCatalogEntry(userMetric.metric_id);
    setEditingUserMetric(userMetric);
    setEditingCatalogEntry(entry ?? null);
    setEditValue(userMetric.value);
    setEditModalVisible(true);
  }

  function openAddModal(entry: CatalogMetric) {
    setPickerVisible(false);
    setEditingUserMetric(null);
    setEditingCatalogEntry(entry);
    setEditValue(entry.user_value ?? '');
    setEditModalVisible(true);
  }

  function closeEditModal() {
    setEditModalVisible(false);
    setEditingUserMetric(null);
    setEditingCatalogEntry(null);
    setEditValue('');
  }

  useFocusEffect(
    useCallback(() => {
      if (section !== 'profil') return;
      (async () => {
        setMetricsLoading(true);
        try {
          const [metricsData, catalog, customDefs] = await Promise.all([
            getUserMetrics(),
            getMetricsCatalog(),
            getCustomMetrics(),
          ]);
          setUserMetrics(metricsData);
          setCatalogMetrics(catalog);
          setCustomMetrics(customDefs);
        } catch {
          // silent
        } finally {
          setMetricsLoading(false);
        }
      })();
    }, [section]),
  );

  async function handleDeleteFromModal() {
    if (!editingUserMetric) return;
    Alert.alert(
      t('profile.metricDeleteConfirmTitle'),
      t('profile.metricDeleteConfirmMsg'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteUserMetric(editingUserMetric.id);
              setUserMetrics((prev) => prev.filter((m) => m.id !== editingUserMetric.id));
              closeEditModal();
            } catch {
              // silent
            }
          },
        },
      ],
    );
  }

  async function handleSaveEdit() {
    const metricId = editingUserMetric?.metric_id ?? editingCatalogEntry?.id;
    if (!editValue.trim() || !metricId) return;
    setSavingEdit(true);
    try {
      const saved = await upsertUserMetric(metricId, editValue.trim());
      setUserMetrics((prev) => [...prev.filter((m) => m.metric_id !== saved.metric_id), saved]);
      closeEditModal();
    } catch (e: any) {
      Alert.alert(t('common.error'), t(`errors.${e?.message}`, { defaultValue: t('common.error') }));
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleDeleteMetric(id: number) {
    Alert.alert(
      t('profile.metricDeleteConfirmTitle'),
      t('profile.metricDeleteConfirmMsg'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteUserMetric(id);
              setUserMetrics((prev) => prev.filter((m) => m.id !== id));
            } catch {
              // silent
            }
          },
        },
      ],
    );
  }

  function openCreateCustomModal() {
    setCustomName('');
    setCustomType('number');
    setCustomUnit('');
    setCustomInitialValue('');
    setCreateCustomVisible(true);
  }

  async function handleCreateCustomMetric() {
    if (!customName.trim()) return;
    setSavingCustom(true);
    try {
      const def = await createCustomMetric(
        customName.trim(),
        customType,
        customUnit.trim() || null,
        customInitialValue.trim() || null,
      );
      setCustomMetrics((prev) => [...prev, def]);
      if (customInitialValue.trim()) {
        const refreshed = await getUserMetrics();
        setUserMetrics(refreshed);
      }
      setCreateCustomVisible(false);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      Alert.alert(t('common.error'), t(`errors.${e?.message}`, { defaultValue: t('common.error') }));
    } finally {
      setSavingCustom(false);
    }
  }

  async function handleDeleteCustomMetric(def: CustomMetricDef) {
    Alert.alert(
      t('profile.customMetricDeleteConfirmTitle'),
      t('profile.customMetricDeleteConfirmMsg'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteCustomMetric(def.id);
              setCustomMetrics((prev) => prev.filter((c) => c.id !== def.id));
              setUserMetrics((prev) => prev.filter((m) => m.metric_id !== def.metric_id));
            } catch {
              // silent
            }
          },
        },
      ],
    );
  }

  // Apple Santé
  const [hkAvailable, setHkAvailable] = useState(false);
  const [hkAuthorized, setHkAuthorized] = useState(false);
  const [hkLoading, setHkLoading] = useState(false);
  const [hkMetrics, setHkMetrics] = useState<FitnessMetrics | null>(null);
  const [hkSyncing, setHkSyncing] = useState(false);

  React.useEffect(() => {
    if (section !== 'donnees') return;
    (async () => {
      const available = await isHealthKitAvailable();
      setHkAvailable(available);
      if (available) {
        const auth = await isAuthorized();
        setHkAuthorized(auth);
        if (auth) {
          const metrics = await readFitnessMetrics();
          setHkMetrics(metrics);
        }
      }
    })();
  }, [section]);

  async function handleConnectHealth() {
    setHkLoading(true);
    try {
      const ok = await requestPermissions();
      setHkAuthorized(ok);
      if (ok) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        const metrics = await readFitnessMetrics();
        setHkMetrics(metrics);
      } else {
        openHealthSettings();
      }
    } finally {
      setHkLoading(false);
    }
  }

  async function handleSyncFromHealth() {
    if (!hkMetrics) return;
    setHkSyncing(true);
    try {
      if (hkMetrics.poids_kg !== null) {
        const saved = await upsertUserMetric('poids_corporel', String(hkMetrics.poids_kg), 'workout');
        setUserMetrics((prev) => [...prev.filter((m) => m.metric_id !== 'poids_corporel'), saved]);
      }
      await refreshUser();
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert(t('common.error'), t('profile.alertSyncError'));
    } finally {
      setHkSyncing(false);
    }
  }

  const poidsActuel = userMetrics.find((m) => m.metric_id === 'poids_corporel')?.value;
  const hasHkDiff =
    hkMetrics !== null &&
    hkMetrics.poids_kg !== null &&
    Math.abs(hkMetrics.poids_kg - (poidsActuel ? parseFloat(poidsActuel) : 0)) > 0.4;

  // Sécurité
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [savingPwd, setSavingPwd] = useState(false);

  async function handleSaveProfil() {
    setSavingProfil(true);
    try {
      if (name.trim() && name.trim() !== user?.name) {
        await updateProfile(name.trim());
      }
      await updateAthleteProfile({
        niveau: niveau || null,
        objectif: objectif.trim() || null,
      });
      await refreshUser();
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      if (e?.message === 'SESSION_EXPIRED') { handleSessionExpired(); return; }
      Alert.alert(t('common.error'), t(`errors.${e?.message}`, { defaultValue: t('profile.alertProfileError') }));
    } finally {
      setSavingProfil(false);
    }
  }

  async function handleSavePassword() {
    if (!currentPwd || !newPwd || !confirmPwd) return;
    if (newPwd.length < 8) {
      Alert.alert(t('profile.alertPasswordShort'), t('profile.alertPasswordShortMsg'));
      return;
    }
    if (newPwd !== confirmPwd) {
      Alert.alert(t('profile.alertPasswordMismatch'), t('profile.alertPasswordMismatchMsg'));
      return;
    }
    setSavingPwd(true);
    try {
      await updatePassword(currentPwd, newPwd);
      setCurrentPwd(''); setNewPwd(''); setConfirmPwd('');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(t('profile.alertPasswordSuccess'), t('profile.alertPasswordSuccessMsg'));
    } catch (e: any) {
      if (e?.message === 'SESSION_EXPIRED') { handleSessionExpired(); return; }
      Alert.alert(t('common.error'), t(`errors.${e?.message}`, { defaultValue: t('profile.alertPasswordError') }));
    } finally {
      setSavingPwd(false);
    }
  }

  async function handleExportData() {
    try {
      const json = await exportData();
      await Share.share({ message: json, title: t('profile.exportTitle') });
    } catch (e: any) {
      Alert.alert(t('common.error'), t(`errors.${e?.message}`, { defaultValue: t('profile.alertExportError') }));
    }
  }

  async function handleDeleteAccount() {
    Alert.alert(
      t('profile.alertDeleteTitle'),
      t('profile.alertDeleteMsg'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('profile.alertDeleteConfirm'),
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteAccount();
              await signOut();
            } catch (e: any) {
              Alert.alert(t('common.error'), t(`errors.${e?.message}`, { defaultValue: t('profile.alertDeleteError') }));
            }
          },
        },
      ],
    );
  }

  async function handleSignOut() {
    Alert.alert(t('profile.alertSignOutTitle'), t('profile.alertSignOutMsg'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('profile.alertSignOutConfirm'),
        style: 'destructive',
        onPress: async () => {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          await signOut();
        },
      },
    ]);
  }

  const initial = (user?.name ?? 'T')[0].toUpperCase();

  const SPORT_LABELS: Record<string, string> = {
    running: 'Running', velo: 'Vélo', natation: 'Natation',
    triathlon: 'Triathlon', musculation: 'Musculation', yoga: 'Yoga', transverse: 'Général',
  };
  const SPORT_ORDER = ['running', 'velo', 'natation', 'triathlon', 'musculation', 'yoga', 'transverse'];

  const availableCatalogMetrics = catalogMetrics.filter(
    (c) => !userMetrics.find((m) => m.metric_id === c.id),
  );

  const pickerGroups: { sport: string; entries: CatalogMetric[] }[] = SPORT_ORDER
    .map((sport) => ({
      sport,
      entries: availableCatalogMetrics.filter((c) => (c.sports[0] ?? 'transverse') === sport),
    }))
    .filter((g) => g.entries.length > 0);

  function renderMetricInput(entry: CatalogMetric, value: string, onChange: (v: string) => void) {
    if (entry.type === 'number') {
      return (
        <View style={styles.editInputRow}>
          <TextInput
            value={value}
            onChangeText={onChange}
            keyboardType="decimal-pad"
            returnKeyType="done"
            style={styles.editInput}
            placeholder={entry.value_range ? `${entry.value_range.min}–${entry.value_range.max}` : ''}
            placeholderTextColor={C.text3}
          />
          {entry.unit ? <Text style={styles.editInputUnit}>{entry.unit}</Text> : null}
        </View>
      );
    }
    if (entry.type === 'scale') {
      const min = entry.value_range?.min ?? 1;
      const max = entry.value_range?.max ?? 10;
      const steps = Array.from({ length: max - min + 1 }, (_, i) => String(i + min));
      return (
        <View style={styles.scaleRow}>
          {steps.map((s) => (
            <TouchableOpacity
              key={s}
              style={[styles.scaleBtn, value === s && styles.scaleBtnActive]}
              onPress={() => onChange(s)}
              activeOpacity={0.7}
            >
              <Text style={[styles.scaleBtnLabel, value === s && styles.scaleBtnLabelActive]}>{s}</Text>
            </TouchableOpacity>
          ))}
        </View>
      );
    }
    if (entry.type === 'enum') {
      return (
        <View style={styles.enumRow}>
          {(entry.enum_values ?? []).map((opt) => (
            <TouchableOpacity
              key={opt}
              style={[styles.enumChip, value === opt && styles.enumChipActive]}
              onPress={() => onChange(value === opt ? '' : opt)}
              activeOpacity={0.7}
            >
              <Text style={[styles.enumChipLabel, value === opt && styles.enumChipLabelActive]}>{opt}</Text>
            </TouchableOpacity>
          ))}
        </View>
      );
    }
    return (
      <TextInput
        value={value}
        onChangeText={onChange}
        style={styles.editInput}
        placeholderTextColor={C.text3}
        returnKeyType="done"
        autoCapitalize="none"
      />
    );
  }

  return (
    <View style={styles.screenRoot}>
    <ScrollView
      style={styles.root}
      contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 100 }}
      keyboardShouldPersistTaps="handled"
    >
      {/* Header */}
      <Text style={styles.pageTitle}>{t('profile.title')}</Text>

      {/* Avatar */}
      <View style={styles.avatarSection}>
        <View style={styles.avatarWrap}>
          <LinearGradient
            colors={['#3B82F6', '#6366F1']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.avatar}
          >
            <Text style={styles.avatarLetter}>{initial}</Text>
          </LinearGradient>
        </View>
        <Text style={styles.avatarName}>{user?.name ?? ''}</Text>
        <Text style={styles.avatarEmail}>{user?.email ?? ''}</Text>
      </View>

      {/* Tab switcher */}
      <View style={styles.tabRow}>
        {([
          { id: 'profil',   key: 'profile.tabProfil' },
          { id: 'securite', key: 'profile.tabSecurite' },
          { id: 'donnees',  key: 'profile.tabDonnees' },
        ] as { id: Section; key: string }[]).map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tabBtn, section === tab.id && styles.tabBtnActive]}
            onPress={() => setSection(tab.id)}
          >
            <Text style={[styles.tabLabel, section === tab.id && styles.tabLabelActive]}>
              {t(tab.key)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── PROFIL ── */}
      {section === 'profil' && (
        <>
          {/* Identité */}
          <View style={styles.group}>
            <SectionLabel label={t('profile.groupIdentite')} />
            <View style={styles.card}>
              <View style={[styles.cardRow, styles.cardRowBorder]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldMini}>{t('profile.fieldName')}</Text>
                  <TextInput
                    value={name}
                    onChangeText={setName}
                    style={styles.inlineInput}
                    placeholderTextColor={C.text3}
                    autoCapitalize="words"
                  />
                </View>
              </View>
              <View style={styles.cardRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldMini}>{t('profile.fieldEmail')}</Text>
                  <Text style={styles.emailText}>{user?.email}</Text>
                </View>
                <View style={styles.verifiedBadge}>
                  <Text style={styles.verifiedLabel}>{t('common.verified')}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Niveau */}
          <View style={styles.group}>
            <SectionLabel label={t('profile.groupNiveau')} />
            <View style={styles.niveauRow}>
              {NIVEAU_OPTIONS.map((opt) => {
                const active = niveau === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.niveauBtn, active && styles.niveauBtnActive]}
                    onPress={() => setNiveau(active ? '' : opt.value)}
                  >
                    <Text style={[styles.niveauLabel, active && styles.niveauLabelActive]}>
                      {t(opt.key)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Objectif */}
          <View style={styles.group}>
            <SectionLabel label={t('profile.groupObjectif')} />
            <View style={styles.card}>
              <View style={styles.objectifHeader}>
                <Text style={styles.objectifEmoji}>🎯</Text>
                <Text style={styles.objectifHeaderLabel}>{t('profile.objectifLabel')}</Text>
              </View>
              <TextInput
                value={objectif}
                onChangeText={setObjectif}
                placeholder={t('profile.objectifPlaceholder')}
                placeholderTextColor={C.text3}
                multiline
                style={styles.objectifInput}
                autoCorrect
                autoCapitalize="sentences"
              />
            </View>
          </View>

          {/* Métriques */}
          <View style={styles.group}>
            <SectionLabel label={t('profile.groupMetrics')} />
            {metricsLoading ? (
              <ActivityIndicator color={C.blue} style={{ marginVertical: 12 }} />
            ) : (
              <>
                {/* Toutes les métriques catalogue avec valeur (core + non-core) */}
                {userMetrics.filter((m) => getCatalogEntry(m.metric_id)).map((m) => {
                  const entry = getCatalogEntry(m.metric_id)!;
                  const unit = entry.unit ?? '';
                  return (
                    <TouchableOpacity
                      key={m.id}
                      style={styles.userMetricRow}
                      onPress={() => openEditModal(m)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.userMetricContent}>
                        <Text style={styles.userMetricName}>{entry.name}</Text>
                        <Text style={styles.userMetricValue}>
                          {m.value}{unit ? ` ${unit}` : ''}
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => handleDeleteMetric(m.id)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Icon name="trash" size={14} color={C.text3} />
                      </TouchableOpacity>
                    </TouchableOpacity>
                  );
                })}
                {/* Métriques libres (custom) */}
                {customMetrics.map((def) => {
                  const userVal = userMetrics.find((m) => m.metric_id === def.metric_id);
                  return (
                    <TouchableOpacity
                      key={def.id}
                      style={styles.userMetricRow}
                      onPress={() => {
                        if (userVal) {
                          setEditingUserMetric(userVal);
                          setEditingCatalogEntry({
                            id: def.metric_id,
                            name: def.name,
                            description: '',
                            category: '',
                            sports: [],
                            unit: def.unit,
                            type: def.type === 'scale' ? 'scale' : def.type === 'number' ? 'number' : 'text',
                            value_range: def.type === 'scale' ? { min: 1, max: 10 } : undefined,
                            volatility: 'stable',
                            blocking_for_sports: [],
                            user_value: userVal?.value ?? null,
                            user_source: userVal?.source ?? null,
                            user_updated_at: userVal?.updated_at ?? null,
                          });
                          setEditValue(userVal.value);
                          setEditModalVisible(true);
                        } else {
                          setEditingUserMetric(null);
                          setEditingCatalogEntry({
                            id: def.metric_id,
                            name: def.name,
                            description: '',
                            category: '',
                            sports: [],
                            unit: def.unit,
                            type: def.type === 'scale' ? 'scale' : def.type === 'number' ? 'number' : 'text',
                            value_range: def.type === 'scale' ? { min: 1, max: 10 } : undefined,
                            volatility: 'stable',
                            blocking_for_sports: [],
                            user_value: null,
                            user_source: null,
                            user_updated_at: null,
                          });
                          setEditValue('');
                          setEditModalVisible(true);
                        }
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={styles.userMetricContent}>
                        <Text style={styles.userMetricName}>{def.name}</Text>
                        <Text style={styles.userMetricValue}>
                          {userVal ? `${userVal.value}${def.unit ? ` ${def.unit}` : ''}` : '—'}
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => handleDeleteCustomMetric(def)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Icon name="trash" size={14} color={C.text3} />
                      </TouchableOpacity>
                    </TouchableOpacity>
                  );
                })}
                {userMetrics.filter((m) => getCatalogEntry(m.metric_id)).length === 0
                  && customMetrics.length === 0 && (
                  <Text style={styles.userMetricsEmpty}>{t('profile.userMetricsEmpty')}</Text>
                )}
                <TouchableOpacity
                  style={styles.addMetricBtn}
                  onPress={() => setPickerVisible(true)}
                  activeOpacity={0.7}
                >
                  <Icon name="plus" size={14} color={C.blue} />
                  <Text style={styles.addMetricBtnLabel}>{t('profile.addMetric')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.addMetricBtn, { marginTop: 4 }]}
                  onPress={openCreateCustomModal}
                  activeOpacity={0.7}
                >
                  <Icon name="edit" size={14} color={C.blue} />
                  <Text style={styles.addMetricBtnLabel}>{t('profile.addCustomMetric')}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          {/* Save */}
          <View style={styles.group}>
            <Button
              variant={saveSuccess ? 'success' : 'primary'}
              label={saveSuccess ? t('profile.profileSaved') : t('profile.saveProfile')}
              onPress={handleSaveProfil}
              disabled={savingProfil}
              icon={savingProfil ? <ActivityIndicator size="small" color="#fff" /> : saveSuccess ? <Icon name="check" size={18} color="#fff" /> : undefined}
              full
            />
          </View>
        </>
      )}

      {/* ── SÉCURITÉ ── */}
      {section === 'securite' && (
        <View style={styles.group}>
          <SectionLabel label={t('profile.groupPassword')} />
          <View style={styles.card}>
            {[
              { placeholder: t('profile.pwdCurrent'),  value: currentPwd, setter: setCurrentPwd },
              { placeholder: t('profile.pwdNew'),      value: newPwd,     setter: setNewPwd },
              { placeholder: t('profile.pwdConfirm'),  value: confirmPwd, setter: setConfirmPwd },
            ].map((f, i, arr) => (
              <View key={i} style={[styles.pwdRow, i < arr.length - 1 && styles.pwdRowBorder]}>
                <Icon name="lock" size={15} color={C.text3} />
                <TextInput
                  value={f.value}
                  onChangeText={f.setter}
                  placeholder={f.placeholder}
                  placeholderTextColor={C.text3}
                  secureTextEntry
                  style={styles.pwdInput}
                  autoCorrect={false}
                  autoCapitalize="none"
                />
              </View>
            ))}
          </View>
          <View style={{ marginTop: 12 }}>
            <Button
              variant="primary"
              label={t('profile.updatePassword')}
              onPress={handleSavePassword}
              disabled={!currentPwd || !newPwd || !confirmPwd || savingPwd}
              icon={savingPwd ? <ActivityIndicator size="small" color="#fff" /> : undefined}
              full
            />
          </View>
        </View>
      )}

      {/* ── DONNÉES ── */}
      {section === 'donnees' && (
        <>
          {/* Apple Santé */}
          {hkAvailable && (
            <View style={styles.group}>
              <SectionLabel label={t('profile.groupAppleHealth')} />
              <View style={[styles.card, hkAuthorized && styles.hkConnectedCard]}>
                <View style={styles.hkRow}>
                  <View style={[styles.dataRowIcon, hkAuthorized && styles.hkConnectedIcon]}>
                    <Icon name="heart" size={15} color={hkAuthorized ? C.red : C.blue} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.dataRowLabel}>
                      {hkAuthorized ? t('profile.hkConnected') : t('profile.hkConnect')}
                    </Text>
                    <Text style={styles.hkSubtitle}>
                      {hkAuthorized ? t('profile.hkConnectedSubtitle') : t('profile.hkDisconnectedSubtitle')}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={hkAuthorized ? styles.hkSettingsBtn : styles.hkBtn}
                    onPress={hkAuthorized ? openHealthSettings : handleConnectHealth}
                    disabled={hkLoading}
                    activeOpacity={0.8}
                  >
                    {hkLoading
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <Text style={hkAuthorized ? styles.hkSettingsBtnLabel : styles.hkBtnLabel}>
                          {hkAuthorized ? t('profile.hkManage') : t('profile.hkAllow')}
                        </Text>
                    }
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {/* Métriques HealthKit */}
          {hkAuthorized && hkMetrics && (hkMetrics.restingHR || hkMetrics.vo2max || hkMetrics.poids_kg) && (
            <View style={styles.group}>
              <SectionLabel label={t('profile.hkMetricsTitle')} />
              <View style={styles.card}>
                {hkMetrics.restingHR && (
                  <View style={styles.hkMetricRow}>
                    <Icon name="heart" size={14} color={C.red} />
                    <Text style={styles.hkMetricLabel}>{t('profile.hkRestingHR')}</Text>
                    <Text style={styles.hkMetricValue}>{hkMetrics.restingHR} bpm</Text>
                  </View>
                )}
                {hkMetrics.vo2max && (
                  <View style={styles.hkMetricRow}>
                    <Icon name="activity" size={14} color={C.blue} />
                    <Text style={styles.hkMetricLabel}>{t('profile.hkVO2Max')}</Text>
                    <Text style={styles.hkMetricValue}>{hkMetrics.vo2max} ml/kg/min</Text>
                  </View>
                )}
                {hkMetrics.poids_kg && (
                  <View style={styles.hkMetricRow}>
                    <Icon name="stats" size={14} color={C.text2} />
                    <Text style={styles.hkMetricLabel}>{t('profile.hkWeight')}</Text>
                    <Text style={styles.hkMetricValue}>{hkMetrics.poids_kg} kg</Text>
                  </View>
                )}
                {hasHkDiff && (
                  <TouchableOpacity
                    style={styles.hkSyncBtn}
                    onPress={handleSyncFromHealth}
                    disabled={hkSyncing}
                    activeOpacity={0.8}
                  >
                    {hkSyncing
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <Text style={styles.hkSyncBtnLabel}>{t('profile.hkSyncWeight')}</Text>
                    }
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

          <View style={styles.group}>
            <SectionLabel label={t('language.groupLanguage')} />
            <View style={styles.segmentRow}>
              {SUPPORTED_LANGUAGES.map((lang) => (
                <TouchableOpacity
                  key={lang}
                  style={[styles.segmentBtn, currentLang === lang && styles.segmentBtnActive]}
                  activeOpacity={0.7}
                  onPress={async () => {
                    if (lang === currentLang) return;
                    await setLanguage(lang);
                    setCurrentLang(lang);
                  }}
                >
                  <Text style={[styles.segmentLabel, currentLang === lang && styles.segmentLabelActive]}>
                    {t(`language.${lang}`)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.group}>
            <SectionLabel label={t('profile.groupData')} />
            <View style={styles.card}>
              <DataRow icon="download" label={t('profile.rowExport')} chevron={false} onPress={handleExportData} />
            </View>
          </View>

          <View style={styles.group}>
            <SectionLabel label={t('profile.groupIntegrations')} />
            <View style={styles.card}>
              <DataRow icon="watch" label={t('profile.rowWorkoutManager')} onPress={() => navigation.navigate('WorkoutManager')} />
            </View>
          </View>

          <View style={styles.group}>
            <SectionLabel label={t('profile.groupLegal')} />
            <View style={styles.card}>
              <DataRow icon="shield" label={t('profile.rowPrivacy')} onPress={() => Linking.openURL(PRIVACY_URL)} />
              <DataRow icon="star" label={t('profile.rowTerms')} onPress={() => Linking.openURL(TERMS_URL)} />
            </View>
          </View>

          <View style={styles.group}>
            <SectionLabel label={t('profile.groupDanger')} />
            <View style={styles.dangerCard}>
              <DataRow icon="logout" label={t('profile.signOut')} chevron={false} danger onPress={handleSignOut} />
              <DataRow icon="trash" label={t('profile.deleteAccount')} chevron={false} danger onPress={handleDeleteAccount} />
            </View>
          </View>
        </>
      )}

      <Text style={styles.versionLabel}>
        v{Constants.expoConfig?.version} · build {Constants.expoConfig?.ios?.buildNumber}
      </Text>

    </ScrollView>

    {/* Picker modal — catalogue des métriques disponibles */}
    <Modal visible={pickerVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setPickerVisible(false)}>
      <View style={styles.pickerModal}>
        <View style={styles.pickerHeader}>
          <Text style={styles.pickerTitle}>{t('profile.metricPickerTitle')}</Text>
          <TouchableOpacity onPress={() => setPickerVisible(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Icon name="x" size={20} color={C.text2} />
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={styles.pickerContent}>
          {pickerGroups.length === 0 && (
            <Text style={styles.pickerEmpty}>{t('profile.metricPickerEmpty')}</Text>
          )}
          {pickerGroups.map((group) => (
            <View key={group.sport} style={styles.pickerGroup}>
              <Text style={styles.pickerGroupLabel}>{SPORT_LABELS[group.sport] ?? group.sport}</Text>
              {group.entries.map((entry) => (
                <TouchableOpacity
                  key={entry.id}
                  style={styles.pickerRow}
                  onPress={() => openAddModal(entry)}
                  activeOpacity={0.7}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pickerRowName}>{entry.name}</Text>
                    {entry.unit ? <Text style={styles.pickerRowMeta}>{entry.unit}</Text> : null}
                  </View>
                  <Icon name="plus" size={16} color={C.blue} />
                </TouchableOpacity>
              ))}
            </View>
          ))}
        </ScrollView>
      </View>
    </Modal>

    {/* Edit modal — saisie de la valeur */}
    <Modal visible={editModalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={closeEditModal}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.editModal}>
          <View style={styles.pickerHeader}>
            <Text style={styles.pickerTitle}>
              {editingUserMetric ? t('profile.metricEditTitle') : t('profile.metricModalTitle')}
            </Text>
            <TouchableOpacity onPress={closeEditModal} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Icon name="x" size={20} color={C.text2} />
            </TouchableOpacity>
          </View>
          {editingCatalogEntry && (
            <View style={styles.editModalBody}>
              <Text style={styles.editMetricName}>{editingCatalogEntry.name}</Text>
              {editingCatalogEntry.description ? (
                <Text style={styles.editMetricDesc}>{editingCatalogEntry.description}</Text>
              ) : null}
              <View style={{ marginTop: 20 }}>
                {renderMetricInput(editingCatalogEntry, editValue, setEditValue)}
              </View>
              <TouchableOpacity
                style={[styles.editSaveBtn, !editValue.trim() && { opacity: 0.4 }]}
                onPress={handleSaveEdit}
                disabled={!editValue.trim() || savingEdit}
                activeOpacity={0.85}
              >
                {savingEdit
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.editSaveBtnLabel}>{t('profile.metricSave')}</Text>
                }
              </TouchableOpacity>
              {editingUserMetric && (
                <TouchableOpacity
                  style={styles.editDeleteBtn}
                  onPress={handleDeleteFromModal}
                  activeOpacity={0.7}
                >
                  <Icon name="trash" size={14} color={C.red} />
                  <Text style={styles.editDeleteBtnLabel}>{t('profile.metricDeleteConfirmTitle')}</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>

    {/* Modal création métrique libre */}
    <Modal visible={createCustomVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setCreateCustomVisible(false)}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.editModal}>
          <View style={styles.pickerHeader}>
            <Text style={styles.pickerTitle}>{t('profile.customMetricModalTitle')}</Text>
            <TouchableOpacity onPress={() => setCreateCustomVisible(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Icon name="x" size={20} color={C.text2} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.editModalBody} keyboardShouldPersistTaps="handled">
            {/* Nom */}
            <Text style={styles.editMetricName}>{t('profile.customMetricNameLabel')}</Text>
            <TextInput
              value={customName}
              onChangeText={setCustomName}
              placeholder={t('profile.customMetricNamePlaceholder')}
              placeholderTextColor={C.text3}
              style={[styles.editInput, { marginTop: 8, marginBottom: 20 }]}
              autoCapitalize="sentences"
              autoCorrect={false}
              returnKeyType="next"
            />
            {/* Type */}
            <Text style={styles.editMetricName}>{t('profile.customMetricTypeLabel')}</Text>
            <View style={[styles.enumRow, { marginTop: 8, marginBottom: 20 }]}>
              {([
                { value: 'number', label: t('profile.customMetricTypeNumber') },
                { value: 'text',   label: t('profile.customMetricTypeText') },
                { value: 'scale',  label: t('profile.customMetricTypeScale') },
              ] as { value: 'number' | 'text' | 'scale'; label: string }[]).map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.enumChip, customType === opt.value && styles.enumChipActive]}
                  onPress={() => setCustomType(opt.value)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.enumChipLabel, customType === opt.value && styles.enumChipLabelActive]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {/* Unité */}
            <Text style={styles.editMetricName}>{t('profile.customMetricUnitLabel')}</Text>
            <TextInput
              value={customUnit}
              onChangeText={setCustomUnit}
              placeholder={t('profile.customMetricUnitPlaceholder')}
              placeholderTextColor={C.text3}
              style={[styles.editInput, { marginTop: 8, marginBottom: 20 }]}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
            />
            {/* Valeur initiale */}
            <Text style={styles.editMetricName}>{t('profile.customMetricValueLabel')}</Text>
            <View style={[styles.editInputRow, { marginTop: 8, marginBottom: 28 }]}>
              <TextInput
                value={customInitialValue}
                onChangeText={setCustomInitialValue}
                keyboardType={customType === 'number' || customType === 'scale' ? 'decimal-pad' : 'default'}
                style={styles.editInput}
                placeholderTextColor={C.text3}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
              />
              {customUnit ? <Text style={styles.editInputUnit}>{customUnit}</Text> : null}
            </View>
            <TouchableOpacity
              style={[styles.editSaveBtn, !customName.trim() && { opacity: 0.4 }]}
              onPress={handleCreateCustomMetric}
              disabled={!customName.trim() || savingCustom}
              activeOpacity={0.85}
            >
              {savingCustom
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.editSaveBtnLabel}>{t('profile.customMetricCreate')}</Text>
              }
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg, paddingHorizontal: 20 },
  versionLabel: { textAlign: 'center', fontSize: 11, color: C.text3, marginTop: 24, marginBottom: 8 },

  pageTitle: { fontSize: 20, fontWeight: '700', color: C.text, marginBottom: 20 },

  avatarSection: { alignItems: 'center', marginBottom: 28 },
  avatarWrap: { position: 'relative', marginBottom: 12 },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: C.blue, shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 0 },
  },
  avatarLetter: { fontSize: 32, fontWeight: '700', color: '#fff' },
  avatarName: { fontSize: 17, fontWeight: '700', color: C.text, marginBottom: 3 },
  avatarEmail: { fontSize: 12, color: C.text3 },

  tabRow: {
    flexDirection: 'row', backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
    borderRadius: 14, padding: 4, gap: 2, marginBottom: 24,
  },
  tabBtn: { flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: 'center' },
  tabBtnActive: { backgroundColor: C.bg3, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
  tabLabel: { fontSize: 12, fontWeight: '500', color: C.text3 },
  tabLabelActive: { fontWeight: '700', color: C.text },

  group: { marginBottom: 20 },
  segmentRow: {
    flexDirection: 'row', gap: 10,
  },
  segmentBtn: {
    flex: 1, paddingVertical: 10,
    backgroundColor: C.card, borderRadius: 10,
    borderWidth: 1, borderColor: C.border,
    alignItems: 'center',
  },
  segmentBtnActive: {
    backgroundColor: C.blueLight, borderColor: C.blue,
  },
  segmentLabel: { fontSize: 14, fontWeight: '600', color: C.text2 },
  segmentLabelActive: { color: C.blue },
  groupTitle: {
    fontSize: 11, color: C.text3, fontWeight: '600',
    letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8,
  },

  card: {
    backgroundColor: C.card, borderRadius: 14,
    borderWidth: 1, borderColor: C.border, overflow: 'hidden',
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  cardRowBorder: { borderBottomWidth: 1, borderBottomColor: C.border },

  fieldMini: {
    fontSize: 10, color: C.text3, fontWeight: '600',
    letterSpacing: 0.7, textTransform: 'uppercase', marginBottom: 4,
  },
  inlineInput: { color: C.text, fontSize: 15, fontWeight: '600' },
  emailText: { color: C.text2, fontSize: 14 },
  verifiedBadge: {
    backgroundColor: C.greenLight, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3,
  },
  verifiedLabel: { fontSize: 10, color: C.green, fontWeight: '700' },

  niveauRow: { flexDirection: 'row', gap: 6 },
  niveauBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 12,
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
    alignItems: 'center',
  },
  niveauBtnActive: {
    backgroundColor: C.blue, borderColor: C.blue,
    shadowColor: C.blue, shadowOpacity: 0.4, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
  },
  niveauLabel: { fontSize: 11, fontWeight: '500', color: C.text3 },
  niveauLabelActive: { fontWeight: '700', color: '#fff' },

  objectifHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6, paddingHorizontal: 16, paddingTop: 14 },
  objectifEmoji: { fontSize: 14 },
  objectifHeaderLabel: { fontSize: 11, color: C.blue, fontWeight: '600' },
  objectifInput: {
    color: C.text, fontSize: 14, lineHeight: 22,
    paddingHorizontal: 16, paddingBottom: 14,
    minHeight: 60, textAlignVertical: 'top',
  },

  metricsGrid: { gap: 8 },
  metricsRow: { flexDirection: 'row', gap: 8 },
  metricField: { flex: 1 },
  metricLabel: {
    fontSize: 10, color: C.text3, fontWeight: '600',
    letterSpacing: 0.7, textTransform: 'uppercase', marginBottom: 6,
  },
  metricCard: {
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10,
    flexDirection: 'row', alignItems: 'baseline', gap: 4,
  },
  metricValue: { flex: 1, fontSize: 18, fontWeight: '700', fontFamily: 'DMM' },
  metricUnit: { fontSize: 10, color: C.text3, fontWeight: '600' },

  saveBtn: {
    borderRadius: 14, paddingVertical: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  saveBtnLabel: { fontSize: 15, fontWeight: '700', color: '#fff' },

  pwdRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  pwdRowBorder: { borderBottomWidth: 1, borderBottomColor: C.border },
  pwdInput: { flex: 1, color: C.text, fontSize: 14 },

  dataRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 13,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  dataRowIcon: {
    width: 30, height: 30, borderRadius: 8,
    backgroundColor: C.blueLight, alignItems: 'center', justifyContent: 'center',
  },
  dataRowIconDanger: { backgroundColor: 'rgba(239,68,68,0.12)' },
  dataRowLabel: { flex: 1, fontSize: 14, color: C.text, fontWeight: '500' },
  dataRowLabelDanger: { color: C.red },

  hkConnectedCard: { borderColor: 'rgba(239,68,68,0.2)', backgroundColor: 'rgba(239,68,68,0.04)' },
  hkConnectedIcon: { backgroundColor: 'rgba(239,68,68,0.12)' },
  hkRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  hkSubtitle: { fontSize: 11, color: C.text3, marginTop: 2, lineHeight: 16 },
  hkBtn: {
    backgroundColor: C.blue, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 7,
    minWidth: 76, alignItems: 'center',
  },
  hkBtnLabel: { fontSize: 12, fontWeight: '700', color: '#fff' },
  hkSettingsBtn: {
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6,
  },
  hkSettingsBtnLabel: { fontSize: 12, color: C.text2, fontWeight: '600' },

  hkMetricRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 11,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  hkMetricLabel: { flex: 1, fontSize: 13, color: C.text2 },
  hkMetricValue: { fontSize: 13, fontWeight: '700', color: C.text, fontVariant: ['tabular-nums'] },
  hkSyncBtn: {
    margin: 12, padding: 12, borderRadius: 10,
    backgroundColor: C.blue, alignItems: 'center',
  },
  hkSyncBtnLabel: { fontSize: 13, fontWeight: '700', color: '#fff' },

  consentBlock: { padding: 14, gap: 12 },
  consentRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  consentIconOn: { backgroundColor: 'rgba(22,163,74,0.12)' },
  consentIconOff: { backgroundColor: 'rgba(255,255,255,0.05)' },
  consentSub: { fontSize: 12, color: C.text3, marginTop: 4, lineHeight: 17 },
  consentToggleBtn: {
    backgroundColor: C.blue, borderRadius: 10,
    paddingVertical: 11, alignItems: 'center',
  },
  consentToggleBtnRevoke: { backgroundColor: 'transparent', borderWidth: 1, borderColor: C.red + '60' },
  consentToggleLabel: { fontSize: 13, fontWeight: '700', color: '#fff' },
  consentToggleLabelRevoke: { color: C.red },

  dangerCard: {
    backgroundColor: 'rgba(239,68,68,0.05)',
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)',
    borderRadius: 14, overflow: 'hidden',
  },

  userMetricsEmpty: { fontSize: 13, color: C.text3, marginBottom: 10, lineHeight: 18 },
  userMetricRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    marginBottom: 8,
  },
  userMetricContent: { flex: 1 },
  userMetricName: { fontSize: 13, fontWeight: '600', color: C.text, marginBottom: 2 },
  userMetricValue: { fontSize: 12, color: C.blue, fontWeight: '700' },
  addMetricBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.blueLight, borderWidth: 1, borderColor: C.blue + '40',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11,
    borderStyle: 'dashed',
  },
  addMetricBtnLabel: { fontSize: 13, fontWeight: '600', color: C.blue },

  screenRoot: { flex: 1 },

  // Picker modal
  pickerModal: { flex: 1, backgroundColor: C.bg },
  pickerHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  pickerTitle: { fontSize: 17, fontWeight: '700', color: C.text },
  pickerContent: { paddingHorizontal: 20, paddingBottom: 40 },
  pickerEmpty: { fontSize: 14, color: C.text3, marginTop: 24, textAlign: 'center' },
  pickerGroup: { marginTop: 24 },
  pickerGroupLabel: {
    fontSize: 11, color: C.text3, fontWeight: '600',
    letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8,
  },
  pickerRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    marginBottom: 8,
  },
  pickerRowName: { fontSize: 14, fontWeight: '600', color: C.text },
  pickerRowMeta: { fontSize: 11, color: C.text3, marginTop: 2 },

  // Edit modal
  editModal: { flex: 1, backgroundColor: C.bg },
  editModalBody: { paddingHorizontal: 20, paddingTop: 24 },
  editMetricName: { fontSize: 20, fontWeight: '700', color: C.text, marginBottom: 6 },
  editMetricDesc: { fontSize: 13, color: C.text2, lineHeight: 19 },
  editInputRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  editInput: {
    flex: 1, backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14,
    color: C.text, fontSize: 18, fontWeight: '700', fontFamily: 'DMM',
  },
  editInputUnit: { fontSize: 14, color: C.text3, fontWeight: '600' },
  scaleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  scaleBtn: {
    width: 46, height: 46, borderRadius: 10,
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center',
  },
  scaleBtnActive: { backgroundColor: C.blue, borderColor: C.blue },
  scaleBtnLabel: { fontSize: 16, fontWeight: '600', color: C.text2 },
  scaleBtnLabelActive: { color: '#fff' },
  enumRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  enumChip: {
    paddingHorizontal: 14, paddingVertical: 9,
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 20,
  },
  enumChipActive: { backgroundColor: C.blue, borderColor: C.blue },
  enumChipLabel: { fontSize: 13, fontWeight: '600', color: C.text2 },
  enumChipLabelActive: { color: '#fff' },
  editSaveBtn: {
    marginTop: 32, backgroundColor: C.blue, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center',
  },
  editSaveBtnLabel: { fontSize: 15, fontWeight: '700', color: '#fff' },
  editDeleteBtn: {
    marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 12,
  },
  editDeleteBtnLabel: { fontSize: 14, color: C.red },
});
