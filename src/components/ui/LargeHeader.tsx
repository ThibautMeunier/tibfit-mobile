import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize } from '../../constants/tokens';

interface LargeHeaderProps {
  title: string;
  onBack: () => void;
  subtitle?: string;
}

export default function LargeHeader({ title, onBack, subtitle }: LargeHeaderProps) {
  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7}>
        <Ionicons name="chevron-back" size={16} color={Colors.blue} />
        <Text style={styles.backLabel}>Retour</Text>
      </TouchableOpacity>
      {subtitle && (
        <Text style={styles.subtitle}>{subtitle.toUpperCase()}</Text>
      )}
      <Text style={styles.title}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    alignSelf: 'flex-start',
  },
  backLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.blue,
  },
  subtitle: {
    fontSize: FontSize.sectionLabel,
    fontWeight: '600',
    letterSpacing: 0.08 * FontSize.sectionLabel,
    color: Colors.textFaint,
    marginBottom: 4,
  },
  title: {
    fontSize: FontSize.display,
    fontWeight: '700',
    letterSpacing: -0.3,
    color: Colors.text,
  },
});
