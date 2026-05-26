import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { C } from '../constants/colors';

export const JOURS_FR = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'] as const;
export const JOURS_EN = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
export type Jour = typeof JOURS_FR[number];

const WEEKS_OPTIONS = [1, 2, 3, 4] as const;

interface Props {
  selectedJours: Set<Jour>;
  onToggleJour: (jour: Jour) => void;
  selectedWeeks: number;
  onSelectWeeks: (w: number) => void;
  loading?: boolean;
  hint?: string;
  weeksLabel: string;
  weekLabel: (count: number) => string;
}

export default function DaysWeeksSelector({
  selectedJours,
  onToggleJour,
  selectedWeeks,
  onSelectWeeks,
  loading,
  hint,
  weeksLabel,
  weekLabel,
}: Props) {
  const { i18n } = useTranslation();

  function dayAbbr(jour: Jour, index: number): string {
    const isFr = i18n.language.startsWith('fr');
    const name = isFr ? jour : JOURS_EN[index];
    return name.charAt(0).toUpperCase() + name.slice(1, 3);
  }

  if (loading) {
    return (
      <View style={styles.loadingRow}>
        <ActivityIndicator color={C.blue} />
      </View>
    );
  }

  return (
    <>
      <View style={styles.grid}>
        {JOURS_FR.map((jour, i) => {
          const isSelected = selectedJours.has(jour);
          return (
            <TouchableOpacity
              key={jour}
              style={[styles.dayBtn, isSelected && styles.dayBtnSelected]}
              onPress={() => onToggleJour(jour)}
              activeOpacity={0.75}
            >
              <Text style={[styles.dayAbbr, isSelected && styles.dayAbbrSelected]}>
                {dayAbbr(jour, i)}
              </Text>
              <Text style={[styles.dayFull, isSelected && styles.dayFullSelected]} numberOfLines={1}>
                {i18n.language.startsWith('fr') ? jour : JOURS_EN[i]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {hint != null && (
        <Text style={styles.hint}>{hint}</Text>
      )}

      <Text style={styles.weeksLabel}>{weeksLabel}</Text>
      <View style={styles.weeksRow}>
        {WEEKS_OPTIONS.map((w) => (
          <TouchableOpacity
            key={w}
            style={[styles.weekChip, selectedWeeks === w && styles.weekChipSelected]}
            onPress={() => onSelectWeeks(w)}
            activeOpacity={0.75}
          >
            <Text style={[styles.weekChipText, selectedWeeks === w && styles.weekChipTextSelected]}>
              {weekLabel(w)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  loadingRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 32 },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 8,
    alignSelf: 'stretch',
  },
  dayBtn: {
    flex: 1,
    minWidth: 40,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: C.card,
  },
  dayBtnSelected: { borderColor: C.blue, backgroundColor: C.blueLight },
  dayAbbr: { fontSize: 14, fontWeight: '700', color: C.text3, marginBottom: 2 },
  dayAbbrSelected: { color: C.blue },
  dayFull: { fontSize: 9, color: C.text3, textTransform: 'capitalize' },
  dayFullSelected: { color: C.blue },

  hint: {
    fontSize: 12,
    color: C.text3,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 16,
  },
  weeksLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: C.text3,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 10,
    alignSelf: 'flex-start',
  },
  weeksRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
    alignSelf: 'stretch',
  },
  weekChip: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: C.card,
    alignItems: 'center',
  },
  weekChipSelected: { borderColor: C.blue, backgroundColor: C.blueLight },
  weekChipText: { fontSize: 14, fontWeight: '600', color: C.text2 },
  weekChipTextSelected: { color: C.blue },
});
