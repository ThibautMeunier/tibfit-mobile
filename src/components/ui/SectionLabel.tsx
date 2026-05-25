import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, FontSize } from '../../constants/tokens';

interface SectionLabelProps {
  label: string;
  optional?: boolean;
  action?: React.ReactNode;
}

export default function SectionLabel({ label, optional, action }: SectionLabelProps) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>
        {label.toUpperCase()}
        {optional && <Text style={styles.optional}> (optionnel)</Text>}
      </Text>
      {action && <View>{action}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingBottom: 10,
  },
  label: {
    flex: 1,
    fontSize: FontSize.sectionLabel,
    fontWeight: '600',
    letterSpacing: 0.10 * FontSize.sectionLabel,
    color: Colors.textFaint,
  },
  optional: {
    fontSize: FontSize.sectionLabel,
    fontWeight: '400',
    letterSpacing: 0,
    color: Colors.textGhost,
    textTransform: 'none',
  },
});
