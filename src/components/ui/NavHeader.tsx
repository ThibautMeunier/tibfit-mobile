import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, FontSize } from '../../constants/tokens';
import BackButton from './BackButton';

interface NavHeaderProps {
  title: string;
  onBack: () => void;
  trailing?: React.ReactNode;
}

export default function NavHeader({ title, onBack, trailing }: NavHeaderProps) {
  return (
    <View style={styles.container}>
      <BackButton onPress={onBack} />
      <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">
        {title}
      </Text>
      <View style={styles.trailingSlot}>
        {trailing ?? null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSubtle,
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: FontSize.navTitle,
    fontWeight: '700',
    color: Colors.text,
    marginHorizontal: 8,
  },
  trailingSlot: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
