import React from 'react';
import { TextInput, StyleSheet } from 'react-native';
import { Colors, Radii, FontSize } from '../../constants/tokens';

interface TextareaProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  numberOfLines?: number;
  onBlur?: () => void;
  autoCorrect?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
}

export default function Textarea({
  value,
  onChangeText,
  placeholder,
  numberOfLines = 4,
  onBlur,
  autoCorrect = true,
  autoCapitalize = 'sentences',
}: TextareaProps) {
  return (
    <TextInput
      style={[styles.textarea, { minHeight: numberOfLines * FontSize.body * 1.5 + 28 }]}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={Colors.textFaint}
      multiline
      textAlignVertical="top"
      onBlur={onBlur}
      autoCorrect={autoCorrect}
      autoCapitalize={autoCapitalize}
    />
  );
}

const styles = StyleSheet.create({
  textarea: {
    padding: 14,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radii.input,
    fontSize: FontSize.body,
    color: Colors.text,
    lineHeight: FontSize.body * 1.5,
  },
});
