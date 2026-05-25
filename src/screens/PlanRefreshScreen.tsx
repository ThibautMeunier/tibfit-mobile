import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import LottieView from 'lottie-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { C } from '../constants/colors';
import { Button } from '../components/ui';
import { refreshPlan } from '../services/api';

type Props = NativeStackScreenProps<RootStackParamList, 'PlanRefresh'>;

type Phase = 'generating' | 'success' | 'error';

export default function PlanRefreshScreen({ route, navigation }: Props) {
  const { planId } = route.params;
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState<Phase>('generating');
  const [streamText, setStreamText] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const bufferRef = useRef('');

  useEffect(() => {
    if (phase !== 'generating') return;
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      e.preventDefault();
      Alert.alert(
        t('planRefresh.leaveTitle'),
        t('planRefresh.leaveMsg'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('planRefresh.leaveConfirm'), style: 'destructive', onPress: () => navigation.dispatch(e.data.action) },
        ],
      );
    });
    return unsubscribe;
  }, [navigation, phase, t]);

  useEffect(() => {
    refreshPlan(
      planId,
      (chunk) => {
        bufferRef.current += chunk;
        setStreamText(bufferRef.current);
      },
      () => {
        setPhase('success');
      },
      (msg) => {
        setErrorMsg(msg);
        setPhase('error');
      },
    );
  }, [planId]);

  return (
    <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
      {phase === 'generating' && (
        <ScrollView contentContainerStyle={styles.content}>
          <LottieView
            source={require('../../assets/Fibi.json')}
            autoPlay
            loop
            style={styles.fibi}
          />
          <Text style={styles.title}>{t('planRefresh.generating')}</Text>
          {streamText.length > 0 && (
            <Text style={styles.streamText} numberOfLines={6}>{streamText}</Text>
          )}
          <ActivityIndicator color={C.blue} style={{ marginTop: 24 }} />
        </ScrollView>
      )}

      {phase === 'success' && (
        <View style={styles.content}>
          <LottieView
            source={require('../../assets/Fibi.json')}
            autoPlay
            loop={false}
            style={styles.fibi}
          />
          <Text style={styles.title}>{t('planRefresh.success')}</Text>
          <Text style={styles.subtitle}>{t('planRefresh.successDetail')}</Text>
          <Button
            variant="success"
            label={t('planRefresh.seePlan')}
            onPress={() => navigation.goBack()}
            full
          />
        </View>
      )}

      {phase === 'error' && (
        <View style={styles.content}>
          <Text style={styles.title}>{t('planRefresh.error')}</Text>
          <Text style={styles.subtitle}>{errorMsg}</Text>
          <Button
            variant="secondary"
            label={t('common.back')}
            onPress={() => navigation.goBack()}
            full
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  content: { flex: 1, alignItems: 'center', padding: 24 },
  fibi: { width: 100, height: 100, marginBottom: 16 },
  title: { fontSize: 20, fontWeight: '700', color: C.text, textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 15, color: C.text2, textAlign: 'center', marginBottom: 20 },
  streamText: { fontSize: 13, color: C.text3, textAlign: 'center', lineHeight: 20, marginTop: 8 },
});
