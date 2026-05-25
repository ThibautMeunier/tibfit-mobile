import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Text as SvgText } from 'react-native-svg';
import { C } from '../constants/colors';
import { useTranslation } from 'react-i18next';

interface FormeGaugeProps {
  fraicheur: number;   // 0-100 : 100 = top forme, 0 = épuisé
  niveau: string;      // "fraîche" | "légère" | "modérée" | "élevée" | "très élevée"
}

const NIVEAU_KEY: Record<string, string> = {
  'fraîche': 'gauge.fraiche',
  'légère': 'gauge.legere',
  'modérée': 'gauge.moderee',
  'élevée': 'gauge.elevee',
  'très élevée': 'gauge.tresElevee',
};

export default function DriftGauge({ fraicheur, niveau }: FormeGaugeProps) {
  const { t } = useTranslation();
  const color = fraicheur >= 70 ? C.green : fraicheur >= 40 ? C.orange : C.red;
  const labelKey = NIVEAU_KEY[niveau];
  const label = labelKey ? t(labelKey) : niveau;

  const angle = (fraicheur / 100) * 180;
  const r = 36;
  const cx = 50;
  const cy = 48;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const x = cx + r * Math.cos(toRad(180 - angle));
  const y = cy - r * Math.sin(toRad(180 - angle));

  const trackPath = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;
  const fillPath = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${x} ${y}`;

  return (
    <View style={styles.container}>
      <Svg width="100" height="58" viewBox="0 0 100 58">
        <Path
          d={trackPath}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="8"
          strokeLinecap="round"
        />
        <Path
          d={fillPath}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
        />
        <Circle cx={x} cy={y} r="5" fill={color} />
        <SvgText
          x={cx}
          y={cy + 6}
          textAnchor="middle"
          fill={C.text}
          fontSize="18"
          fontWeight="700"
        >
          {fraicheur}
        </SvgText>
      </Svg>
      <Text style={[styles.label, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 4,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});
