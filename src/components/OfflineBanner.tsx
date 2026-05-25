import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { C } from '../constants/colors';

interface Props {
  visible: boolean;
  message?: string;
}

export default function OfflineBanner({ visible, message }: Props) {
  const { t } = useTranslation();
  if (!visible) return null;
  return (
    <View style={styles.banner}>
      <Text style={styles.text}>{message ?? t('offline.default')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: C.orangeLight,
    borderBottomWidth: 1,
    borderBottomColor: C.orange + '40',
    paddingVertical: 7,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  text: { fontSize: 12, color: C.orange, fontWeight: '600' },
});
