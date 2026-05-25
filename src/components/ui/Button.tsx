import React from 'react';
import { TouchableOpacity, Text, View, StyleSheet, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Gradients, Radii, ButtonHeight, ButtonPaddingX, ButtonFontSize, ButtonIconGap } from '../../constants/tokens';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'success' | 'streak' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ReactNode;
  full?: boolean;
  disabled?: boolean;
}

const SHADOW: Record<string, ViewStyle> = {
  primary: {
    shadowColor: Colors.blue,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.20,
    shadowRadius: 24,
    elevation: 8,
  },
  success: {
    shadowColor: Colors.green,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.20,
    shadowRadius: 24,
    elevation: 8,
  },
  streak: {
    shadowColor: Colors.orange,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 28,
    elevation: 10,
  },
};

export default function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  full = false,
  disabled = false,
}: ButtonProps) {
  const height = ButtonHeight[size];
  const paddingX = ButtonPaddingX[size];
  const fontSize = ButtonFontSize[size];
  const gap = ButtonIconGap[size];

  const containerStyle: ViewStyle[] = [
    { alignSelf: full ? 'stretch' : 'flex-start' },
    SHADOW[variant] ?? {},
    ...(disabled ? [{ opacity: 0.45 } as ViewStyle] : []),
  ];

  const inner = (
    <View style={[styles.inner, { height, paddingHorizontal: paddingX, gap }]}>
      {icon && <View>{icon}</View>}
      <Text style={[styles.label, { fontSize }, variantLabelStyle[variant]]}>{label}</Text>
    </View>
  );

  if (variant === 'primary') {
    return (
      <TouchableOpacity style={containerStyle} onPress={onPress} disabled={disabled} activeOpacity={0.85}>
        <LinearGradient
          colors={Gradients.primary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.base, { borderRadius: Radii.input }]}
        >
          {inner}
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  if (variant === 'streak') {
    return (
      <TouchableOpacity style={containerStyle} onPress={onPress} disabled={disabled} activeOpacity={0.85}>
        <LinearGradient
          colors={Gradients.streak}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.base, { borderRadius: Radii.input }]}
        >
          {inner}
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={[containerStyle, styles.base, variantContainerStyle[variant], { borderRadius: Radii.input }]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
    >
      {inner}
    </TouchableOpacity>
  );
}

const variantContainerStyle: Record<ButtonVariant, ViewStyle> = {
  primary:   {},
  secondary: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  ghost:     { backgroundColor: 'transparent', borderWidth: 1, borderColor: Colors.blue + '55' },
  success:   { backgroundColor: Colors.greenDeep },
  streak:    {},
  danger:    { backgroundColor: 'transparent', borderWidth: 1, borderColor: Colors.red + '55' },
};

const variantLabelStyle: Record<ButtonVariant, object> = {
  primary:   { color: '#fff' },
  secondary: { color: Colors.text },
  ghost:     { color: Colors.blue },
  success:   { color: '#fff' },
  streak:    { color: '#fff' },
  danger:    { color: Colors.red },
};

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontWeight: '600',
  },
});
