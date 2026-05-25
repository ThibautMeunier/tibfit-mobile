import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PurchasesPackage } from 'react-native-purchases';
import { C } from '../constants/colors';
import { usePurchase } from '../context/PurchaseContext';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { PRIVACY_URL, TERMS_URL } from '../constants/legal';
import { Button } from './ui';

export default function PaywallModal() {
  const { t } = useTranslation();
  const { paywallVisible, hidePaywall, offerings, purchasePackage, restorePurchases } = usePurchase();
  const { refreshUser } = useAuth();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);

  const monthly = offerings?.current?.monthly;
  const annual = offerings?.current?.annual;
  const [selected, setSelected] = useState<'monthly' | 'annual'>('annual');

  const annualHasTrial = (annual?.product.introPrice?.price ?? -1) === 0;
  const monthlyHasTrial = (monthly?.product.introPrice?.price ?? -1) === 0;
  const hasTrial = selected === 'annual' ? annualHasTrial : monthlyHasTrial;

  const featuresFree = t('paywall.featuresFree', { returnObjects: true }) as string[];
  const featuresPro = t('paywall.featuresPro', { returnObjects: true }) as string[];

  async function handlePurchase() {
    const pkg: PurchasesPackage | undefined = (selected === 'annual' ? annual : monthly) ?? undefined;
    if (!pkg) return;
    setLoading(true);
    try {
      await purchasePackage(pkg);
      setTimeout(() => refreshUser().catch(() => {}), 3000);
    } catch (e: any) {
      if (!e.userCancelled) {
        Alert.alert(t('common.error'), e?.message ?? t('paywall.purchaseError'));
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleRestore() {
    setLoading(true);
    try {
      await restorePurchases();
      Alert.alert(t('paywall.restoreSuccess'), t('paywall.restoreSuccessMsg'));
    } catch {
      Alert.alert(t('common.error'), t('paywall.restoreError'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal visible={paywallVisible} animationType="slide" presentationStyle="pageSheet">
      <ScrollView
        style={styles.root}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity style={styles.closeBtn} onPress={hidePaywall}>
          <Text style={styles.closeBtnText}>✕</Text>
        </TouchableOpacity>

        <Text style={styles.title}>{t('paywall.title')}</Text>
        <Text style={styles.subtitle}>{t('paywall.subtitle')}</Text>

        {/* Comparison */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('paywall.tierFree')}</Text>
          {featuresFree.map((f) => (
            <Text key={f} style={styles.featureFree}>• {f}</Text>
          ))}
        </View>

        <View style={[styles.card, styles.cardPro]}>
          <Text style={styles.cardTitlePro}>{t('paywall.tierPro')}</Text>
          {featuresPro.map((f) => (
            <Text key={f} style={styles.featurePro}>✓ {f}</Text>
          ))}
        </View>

        {/* Package selector */}
        <View style={styles.packages}>
          {annual && (
            <TouchableOpacity
              style={[styles.pkg, selected === 'annual' && styles.pkgSelected]}
              onPress={() => setSelected('annual')}
            >
              <View style={styles.badgeRow}>
                <Text style={styles.pkgLabel}>{t('paywall.annual')}</Text>
                <View style={styles.badge}><Text style={styles.badgeText}>-33%</Text></View>
              </View>
              {annualHasTrial && (
                <View style={[styles.badge, styles.badgeTrial, styles.badgeBlock]}><Text style={styles.badgeText}>{t('paywall.trialBadge')}</Text></View>
              )}
              <Text style={styles.pkgPrice}>{annual.product.priceString} {t('paywall.perYear')}</Text>
            </TouchableOpacity>
          )}
          {monthly && (
            <TouchableOpacity
              style={[styles.pkg, selected === 'monthly' && styles.pkgSelected]}
              onPress={() => setSelected('monthly')}
            >
              <View style={styles.badgeRow}>
                <Text style={styles.pkgLabel}>{t('paywall.monthly')}</Text>
                {monthlyHasTrial && (
                  <View style={[styles.badge, styles.badgeTrial]}><Text style={styles.badgeText}>{t('paywall.trialBadge')}</Text></View>
                )}
              </View>
              <Text style={styles.pkgPrice}>{monthly.product.priceString} {t('paywall.perMonth')}</Text>
            </TouchableOpacity>
          )}
        </View>

        <Button
          variant="primary"
          label={hasTrial ? t('paywall.ctaTrial') : t('paywall.cta')}
          onPress={handlePurchase}
          disabled={loading}
          icon={loading ? <ActivityIndicator color="#fff" size="small" /> : undefined}
          full
          size="lg"
        />

        <TouchableOpacity onPress={handleRestore} disabled={loading} style={styles.restoreBtn}>
          <Text style={styles.restoreLabel}>{t('paywall.restore')}</Text>
        </TouchableOpacity>

        <Text style={styles.legal}>{hasTrial ? t('paywall.legalTrial') : t('paywall.legal')}</Text>

        <View style={styles.legalLinks}>
          <TouchableOpacity onPress={() => Linking.openURL(TERMS_URL)}>
            <Text style={styles.legalLink}>{t('paywall.termsLink')}</Text>
          </TouchableOpacity>
          <Text style={styles.legalSep}> · </Text>
          <TouchableOpacity onPress={() => Linking.openURL(PRIVACY_URL)}>
            <Text style={styles.legalLink}>{t('paywall.privacyLink')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  content: { padding: 24 },
  closeBtn: { alignSelf: 'flex-end', padding: 8, marginBottom: 8 },
  closeBtnText: { fontSize: 18, color: C.text3 },

  title: { fontSize: 28, fontWeight: '700', color: C.text, textAlign: 'center', marginBottom: 6 },
  subtitle: { fontSize: 15, color: C.text2, textAlign: 'center', marginBottom: 28 },

  card: {
    backgroundColor: C.card, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: C.border, marginBottom: 12,
  },
  cardPro: { borderColor: C.blue + '60', backgroundColor: C.blueLight },
  cardTitle: { fontSize: 13, fontWeight: '700', color: C.text3, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 },
  cardTitlePro: { fontSize: 13, fontWeight: '700', color: C.blue, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 },
  featureFree: { fontSize: 14, color: C.text2, marginBottom: 4 },
  featurePro: { fontSize: 14, color: C.text, fontWeight: '500', marginBottom: 4 },

  packages: { flexDirection: 'row', gap: 12, marginBottom: 20, marginTop: 8 },
  pkg: {
    flex: 1, backgroundColor: C.card, borderRadius: 14, padding: 14,
    borderWidth: 2, borderColor: C.border,
  },
  pkgSelected: { borderColor: C.blue },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  pkgLabel: { fontSize: 14, fontWeight: '700', color: C.text },
  pkgPrice: { fontSize: 12, color: C.text2 },
  badge: { backgroundColor: C.blue, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  badgeTrial: { backgroundColor: '#16a34a' },
  badgeBlock: { alignSelf: 'flex-start', marginTop: 4, marginBottom: 2 },
  badgeText: { fontSize: 10, fontWeight: '700', color: '#fff' },

  restoreBtn: { alignItems: 'center', paddingVertical: 12 },
  restoreLabel: { fontSize: 14, color: C.blue },

  legal: { fontSize: 11, color: C.text3, textAlign: 'center', lineHeight: 16, marginTop: 8 },
  legalLinks: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 8 },
  legalLink: { fontSize: 11, color: C.blue, textDecorationLine: 'underline' },
  legalSep: { fontSize: 11, color: C.text3 },
});
