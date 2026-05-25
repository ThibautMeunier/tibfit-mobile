import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { Colors, Radii } from '../../constants/tokens';

interface CardProps {
  children: React.ReactNode;
  accent?: string;
  style?: ViewStyle;
}

export default function Card({ children, accent, style }: CardProps) {
  if (accent) {
    return (
      <View style={[styles.card, styles.accentCard, style]}>
        <View style={[styles.accentBar, { backgroundColor: accent }]} />
        <View style={styles.accentContent}>{children}</View>
      </View>
    );
  }

  return (
    <View style={[styles.card, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radii.card,
    padding: 16,
  },
  accentCard: {
    padding: 0,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  accentBar: {
    width: 3,
  },
  accentContent: {
    flex: 1,
    padding: 16,
  },
});
