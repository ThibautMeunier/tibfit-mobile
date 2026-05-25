import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { C, ZONE_COLORS } from '../constants/colors';

interface ZoneBadgeProps {
  zone?: string;
}

export default function ZoneBadge({ zone }: ZoneBadgeProps) {
  if (!zone) return null;
  const color = ZONE_COLORS[zone] ?? C.text3;

  return (
    <Text
      style={[
        styles.badge,
        { color, backgroundColor: color + '22' },
      ]}
    >
      {zone}
    </Text>
  );
}

const styles = StyleSheet.create({
  badge: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    overflow: 'hidden',
  },
});
