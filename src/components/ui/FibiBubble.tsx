import React from 'react';
import { View, StyleSheet } from 'react-native';
import LottieView from 'lottie-react-native';
import { C } from '../../constants/colors';

export type FibiBubbleTone = 'neutral' | 'tip' | 'warn';

const TONE_STYLES: Record<FibiBubbleTone, { bg: string; border: string }> = {
  neutral: { bg: C.card, border: C.border },
  tip: { bg: 'rgba(234,179,8,0.08)', border: 'rgba(234,179,8,0.25)' },
  warn: { bg: 'rgba(249,115,22,0.08)', border: 'rgba(249,115,22,0.25)' },
};

interface FibiBubbleProps {
  children: React.ReactNode;
  tone?: FibiBubbleTone;
  avatarSize?: number;
}

export default function FibiBubble({ children, tone = 'neutral', avatarSize = 34 }: FibiBubbleProps) {
  const ts = TONE_STYLES[tone];
  return (
    <View style={styles.row}>
      <LottieView
        source={require('../../../assets/Fibi.json')}
        autoPlay
        loop
        style={{ width: avatarSize, height: avatarSize }}
      />
      <View style={[styles.bubble, { backgroundColor: ts.bg, borderColor: ts.border }]}>
        {/* Speech tail — carré 10×10 rotaté 45°, bordures gauche + bas */}
        <View style={[
          styles.tail,
          { backgroundColor: ts.bg, borderLeftColor: ts.border, borderBottomColor: ts.border },
        ]} />
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  bubble: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  tail: {
    position: 'absolute',
    left: -6,
    top: 12,
    width: 10,
    height: 10,
    transform: [{ rotate: '45deg' }],
    borderLeftWidth: 1,
    borderBottomWidth: 1,
  },
});
