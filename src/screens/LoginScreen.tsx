import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as AppleAuthentication from 'expo-apple-authentication';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { useTranslation } from 'react-i18next';
import { C } from '../constants/colors';
import { Button } from '../components/ui';
import { PRIVACY_URL, TERMS_URL } from '../constants/legal';
import { login, register, forgotPassword, appleSignIn, googleSignIn } from '../services/api';

GoogleSignin.configure({
  iosClientId: '391199112655-7so8b9vmovctnmmaqlr5r59a76v52hib.apps.googleusercontent.com',
  // TODO: remplacer par le Client ID Web créé dans Google Cloud Console (nécessaire sur Android)
  webClientId: 'PLACEHOLDER.apps.googleusercontent.com',
});
import { useAuth } from '../context/AuthContext';

export default function LoginScreen() {
  const { t } = useTranslation();
  const { signIn } = useAuth();
  const insets = useSafeAreaInsets();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);

  async function handleForgotPassword() {
    if (!email.trim()) {
      Alert.alert(t('login.alertEmailRequired'), t('login.alertEmailRequiredMsg'));
      return;
    }
    setForgotLoading(true);
    try {
      await forgotPassword(email.trim());
      Alert.alert(t('login.alertEmailSent'), t('login.alertEmailSentMsg'));
    } catch {
      Alert.alert(t('common.error'), t('login.alertEmailError'));
    } finally {
      setForgotLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    try {
      await GoogleSignin.hasPlayServices();
      const response = await GoogleSignin.signIn();
      const idToken = response.data?.idToken;
      if (!idToken) throw new Error('Token Google manquant');
      const token = await googleSignIn(idToken);
      await signIn(token);
    } catch (e: any) {
      if (e.code === statusCodes.SIGN_IN_CANCELLED) return;
      if (e.code === statusCodes.IN_PROGRESS) return;
      Alert.alert(t('common.error'), t(`errors.${e?.message}`, { defaultValue: t('login.alertGenericError') }));
    }
  }

  async function handleAppleSignIn() {
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken) throw new Error('Token Apple manquant');
      const firstName = credential.fullName?.givenName ?? '';
      const lastName = credential.fullName?.familyName ?? '';
      const fullName = [firstName, lastName].filter(Boolean).join(' ') || undefined;
      const token = await appleSignIn(credential.identityToken, fullName);
      await signIn(token);
    } catch (e: any) {
      if (e.code === 'ERR_REQUEST_CANCELED') return;
      Alert.alert(t('common.error'), t(`errors.${e?.message}`, { defaultValue: t('login.alertGenericError') }));
    }
  }

  async function handleSubmit() {
    if (!email.trim() || !password.trim()) return;
    if (mode === 'register' && !name.trim()) return;
    if (password.length < 8) {
      Alert.alert(t('login.alertPasswordShort'), t('login.alertPasswordShortMsg'));
      return;
    }
    if (mode === 'register' && password !== confirmPassword) {
      Alert.alert(t('login.alertPasswordMismatch'), t('login.alertPasswordMismatchMsg'));
      return;
    }
    if (mode === 'register' && !consentAccepted) {
      Alert.alert(t('login.alertConsentRequired'), t('login.alertConsentRequiredMsg'));
      return;
    }
    setLoading(true);
    try {
      let token: string;
      if (mode === 'login') {
        token = await login(email.trim(), password);
      } else {
        token = await register(email.trim(), password, name.trim());
      }
      await signIn(token);
    } catch (e: any) {
      Alert.alert(t('common.error'), t(`errors.${e?.message}`, { defaultValue: t('login.alertGenericError') }));
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo */}
        <View style={styles.logoSection}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoText}>T</Text>
          </View>
          <Text style={styles.appName}>TibFit</Text>
          <Text style={styles.tagline}>{t('login.tagline')}</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          {mode === 'register' && (
            <View style={styles.field}>
              <Text style={styles.label}>{t('login.name')}</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder={t('login.namePlaceholder')}
                placeholderTextColor={C.text3}
                style={styles.input}
                autoCapitalize="words"
              />
            </View>
          )}

          <View style={styles.field}>
            <Text style={styles.label}>{t('login.email')}</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder={t('login.emailPlaceholder')}
              placeholderTextColor={C.text3}
              style={styles.input}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>{t('login.password')}</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder={t('login.passwordPlaceholder')}
              placeholderTextColor={C.text3}
              style={styles.input}
              secureTextEntry
              autoCorrect={false}
              autoCapitalize="none"
            />
          </View>

          {mode === 'register' && (
            <View style={styles.field}>
              <Text style={styles.label}>{t('login.confirmPassword')}</Text>
              <TextInput
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder={t('login.confirmPasswordPlaceholder')}
                placeholderTextColor={C.text3}
                style={[styles.input, confirmPassword.length > 0 && confirmPassword !== password && styles.inputError]}
                secureTextEntry
                autoCorrect={false}
                autoCapitalize="none"
              />
            </View>
          )}

          {mode === 'register' && (
            <>
              <TouchableOpacity style={styles.consentRow} onPress={() => setConsentAccepted((v) => !v)} activeOpacity={0.7}>
                <View style={[styles.checkbox, consentAccepted && styles.checkboxChecked]}>
                  {consentAccepted && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text style={styles.consentText}>
                  {t('login.consentPrivacy_pre')}
                  <Text style={styles.consentLink} onPress={() => Linking.openURL(PRIVACY_URL)}>{t('login.consentPrivacy_privacyLink')}</Text>
                  {t('login.consentPrivacy_mid')}
                  <Text style={styles.consentLink} onPress={() => Linking.openURL(TERMS_URL)}>{t('login.consentPrivacy_termsLink')}</Text>
                </Text>
              </TouchableOpacity>

            </>
          )}

          {mode === 'login' && (
            <TouchableOpacity
              onPress={handleForgotPassword}
              disabled={forgotLoading}
              style={styles.forgotBtn}
            >
              <Text style={styles.forgotLabel}>
                {forgotLoading ? t('login.forgotSending') : t('login.forgot')}
              </Text>
            </TouchableOpacity>
          )}

          <Button
            variant="primary"
            label={mode === 'login' ? t('login.submitLogin') : t('login.submitRegister')}
            onPress={handleSubmit}
            disabled={loading}
            icon={loading ? <ActivityIndicator size="small" color="#fff" /> : undefined}
            full
            size="lg"
          />
        </View>

        {/* Social login */}
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>{t('common.or')}</Text>
          <View style={styles.dividerLine} />
        </View>

        <TouchableOpacity style={styles.googleBtn} onPress={handleGoogleSignIn} activeOpacity={0.85}>
          <Text style={styles.googleBtnLabel}>
            <Text style={{ color: '#4285F4' }}>G</Text>
            <Text style={{ color: '#EA4335' }}>o</Text>
            <Text style={{ color: '#FBBC05' }}>o</Text>
            <Text style={{ color: '#4285F4' }}>g</Text>
            <Text style={{ color: '#34A853' }}>l</Text>
            <Text style={{ color: '#EA4335' }}>e</Text>
            {'  '}{t('login.continueWithGoogle')}
          </Text>
        </TouchableOpacity>

        {Platform.OS === 'ios' && (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
            cornerRadius={14}
            style={styles.appleBtn}
            onPress={handleAppleSignIn}
          />
        )}

        <Text style={styles.socialLegal}>
          {t('login.socialLegal_pre')}
          <Text style={styles.consentLink} onPress={() => Linking.openURL(TERMS_URL)}>{t('login.socialLegal_terms')}</Text>
          {t('login.socialLegal_mid')}
          <Text style={styles.consentLink} onPress={() => Linking.openURL(PRIVACY_URL)}>{t('login.socialLegal_privacy')}</Text>
          {t('login.socialLegal_post')}
        </Text>

        {/* Toggle mode */}
        <TouchableOpacity
          style={styles.toggleRow}
          onPress={() => { setMode(mode === 'login' ? 'register' : 'login'); setConfirmPassword(''); setConsentAccepted(false); }}
        >
          <Text style={styles.toggleText}>
            {mode === 'login' ? t('login.toggleToRegister') : t('login.toggleToLogin')}
            <Text style={styles.toggleLink}>
              {mode === 'login' ? t('login.signUp') : t('login.signIn')}
            </Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },

  logoSection: { alignItems: 'center', marginBottom: 40 },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: C.blueLight,
    borderWidth: 1,
    borderColor: C.blue + '50',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  logoText: { fontSize: 32, fontWeight: '700', color: C.blue },
  appName: { fontSize: 28, fontWeight: '700', color: C.text, marginBottom: 6 },
  tagline: { fontSize: 14, color: C.text3 },

  form: { gap: 16, marginBottom: 24 },
  field: { gap: 6 },
  label: { fontSize: 12, color: C.text2, fontWeight: '600' },
  input: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: C.text,
    fontSize: 15,
  },
  inputError: { borderColor: C.red },

  consentRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  checkbox: {
    width: 20, height: 20, borderRadius: 5, borderWidth: 2, borderColor: C.border,
    backgroundColor: C.card, alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1,
  },
  checkboxChecked: { backgroundColor: C.blue, borderColor: C.blue },
  checkmark: { fontSize: 12, color: '#fff', fontWeight: '700' },
  consentText: { flex: 1, fontSize: 12, color: C.text2, lineHeight: 18 },
  consentLink: { color: C.blue, fontWeight: '600' },
  submitBtn: {
    padding: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  submitBtnLabel: { fontSize: 16, fontWeight: '700', color: '#fff' },

  forgotBtn: { alignItems: 'flex-end', marginTop: -4 },
  forgotLabel: { fontSize: 13, color: C.blue, fontWeight: '500' },

  toggleRow: { alignItems: 'center' },
  toggleText: { fontSize: 14, color: C.text2 },
  toggleLink: { color: C.blue, fontWeight: '600' },

  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 20, gap: 12 },
  dividerLine: { flex: 1, height: 1, backgroundColor: C.border },
  dividerText: { fontSize: 13, color: C.text3 },

  googleBtn: {
    width: '100%', height: 52, borderRadius: 14, marginBottom: 10,
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#E0E0E0',
  },
  googleBtnLabel: { fontSize: 15, fontWeight: '600', color: '#3C3C3C' },

  appleBtn: { width: '100%', height: 52, marginBottom: 12 },

  socialLegal: { fontSize: 11, color: C.text3, textAlign: 'center', lineHeight: 16, marginBottom: 20 },
});
