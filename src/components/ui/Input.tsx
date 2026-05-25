import React from 'react';
import { View, Text, TextInput, StyleSheet, KeyboardTypeOptions } from 'react-native';
import { Colors, Radii, FontSize } from '../../constants/tokens';

interface InputProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  prefix?: string;
  suffix?: string;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  editable?: boolean;
}

export default function Input({
  value,
  onChangeText,
  placeholder,
  prefix,
  suffix,
  keyboardType,
  autoCapitalize,
  editable = true,
}: InputProps) {
  return (
    <View style={styles.container}>
      {prefix && (
        <>
          <Text style={styles.affix}>{prefix}</Text>
          <View style={styles.divider} />
        </>
      )}
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.textFaint}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        editable={editable}
      />
      {suffix && (
        <>
          <View style={styles.divider} />
          <Text style={styles.affix}>{suffix}</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    paddingHorizontal: 14,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radii.input,
  },
  input: {
    flex: 1,
    fontSize: FontSize.body,
    color: Colors.text,
    padding: 0,
  },
  affix: {
    fontSize: FontSize.body,
    color: Colors.textFaint,
  },
  divider: {
    width: 1,
    height: 16,
    backgroundColor: Colors.border,
    marginHorizontal: 10,
  },
});
