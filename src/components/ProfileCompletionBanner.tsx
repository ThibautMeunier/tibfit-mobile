import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { C } from '../constants/colors';
import Icon from './Icon';

interface Props {
  onPress: () => void;
}

export default function ProfileCompletionBanner({ onPress }: Props) {
  const { t } = useTranslation();
  return (
    <TouchableOpacity style={styles.banner} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.left}>
        <Icon name="person" size={14} color={C.orange} />
        <Text style={styles.text}>{t('profileBanner.text')}</Text>
      </View>
      <Icon name="chevronRight" size={14} color={C.orange} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  banner: {
    marginHorizontal: 20,
    marginBottom: 12,
    backgroundColor: C.orangeLight,
    borderWidth: 1,
    borderColor: C.orange + '40',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  text: {
    fontSize: 13,
    color: C.orange,
    fontWeight: '500',
    flex: 1,
  },
});
