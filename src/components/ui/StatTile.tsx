import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Radii, FontSize } from '../../constants/tokens';

interface StatTileProps {
  value: string | number;
  unit?: string;
  label: string;
  color?: string;
}

export default function StatTile({ value, unit, label, color = Colors.text }: StatTileProps) {
  return (
    <View style={styles.container}>
      <View style={styles.valueRow}>
        <Text style={[styles.value, { color }]}>{value}</Text>
        {unit && <Text style={styles.unit}>{unit}</Text>}
      </View>
      <Text style={styles.label}>{label.toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radii.input,
    padding: 14,
    gap: 4,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
  },
  value: {
    fontSize: 22,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    lineHeight: 26,
  },
  unit: {
    fontSize: FontSize.caption,
    color: Colors.textFaint,
    lineHeight: 20,
  },
  label: {
    fontSize: FontSize.sectionLabel,
    fontWeight: '500',
    letterSpacing: 0.06 * FontSize.sectionLabel,
    color: Colors.textFaint,
  },
});
