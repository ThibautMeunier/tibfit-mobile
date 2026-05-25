import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Radii, FontSize } from '../../constants/tokens';

export type InfoBannerColor = 'blue' | 'green' | 'orange' | 'red';

interface InfoBannerProps {
  title: string;
  body: string;
  color?: InfoBannerColor;
  emoji?: string;
}

const COLOR_MAP: Record<InfoBannerColor, string> = {
  blue:   Colors.blue,
  green:  Colors.green,
  orange: Colors.orange,
  red:    Colors.red,
};

export default function InfoBanner({ title, body, color = 'blue', emoji }: InfoBannerProps) {
  const hex = COLOR_MAP[color];

  return (
    <View style={[styles.container, { backgroundColor: hex + '0F', borderColor: hex + '66' }]}>
      {emoji && <Text style={styles.emoji}>{emoji}</Text>}
      <View style={styles.content}>
        <Text style={[styles.title, { color: hex }]}>{title.toUpperCase()}</Text>
        <Text style={styles.body}>{body}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderWidth: 1,
    borderRadius: Radii.input,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  emoji: {
    fontSize: 26,
    lineHeight: 30,
  },
  content: {
    flex: 1,
    gap: 6,
  },
  title: {
    fontSize: FontSize.sectionLabel,
    fontWeight: '700',
    letterSpacing: 0.10 * FontSize.sectionLabel,
  },
  body: {
    fontSize: FontSize.caption,
    color: Colors.textMuted,
    lineHeight: FontSize.caption * 1.55,
  },
});
