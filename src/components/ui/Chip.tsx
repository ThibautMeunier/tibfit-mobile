import React from 'react';
import { TouchableOpacity, Text, ScrollView, StyleSheet, ViewStyle } from 'react-native';
import { Colors, Radii } from '../../constants/tokens';

type ChipSize = 'sm' | 'md';

interface ChipProps {
  label: string;
  active?: boolean;
  color?: string;
  size?: ChipSize;
  onPress?: () => void;
}

interface ChipGroupProps {
  children: React.ReactNode;
}

const SIZE = {
  sm: { height: 32, paddingHorizontal: 12, fontSize: 12 },
  md: { height: 38, paddingHorizontal: 16, fontSize: 13 },
} as const;

export function ChipGroup({ children }: ChipGroupProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.group}
    >
      {children}
    </ScrollView>
  );
}

export default function Chip({
  label,
  active = false,
  color = Colors.blue,
  size = 'md',
  onPress,
}: ChipProps) {
  const { height, paddingHorizontal, fontSize } = SIZE[size];

  const containerStyle: ViewStyle = active
    ? {
        backgroundColor: color + '1F',
        borderColor: color,
        borderWidth: 1,
      }
    : {
        backgroundColor: Colors.surface,
        borderColor: Colors.border,
        borderWidth: 1,
      };

  return (
    <TouchableOpacity
      style={[styles.chip, containerStyle, { height, paddingHorizontal }]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Text
        style={[
          styles.label,
          { fontSize },
          active ? { color, fontWeight: '600' } : { color: Colors.textMuted, fontWeight: '400' },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  group: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 4,
  },
  chip: {
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {},
});
