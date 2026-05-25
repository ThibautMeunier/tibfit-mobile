import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { C } from '../constants/colors';
import Icon from './Icon';

interface AnimatedCheckProps {
  visible: boolean;
}

export default function AnimatedCheck({ visible }: AnimatedCheckProps) {
  const scale = useRef(new Animated.Value(visible ? 1 : 0.85)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: visible ? 1 : 0.85,
      useNativeDriver: true,
      tension: 200,
      friction: 8,
    }).start();
  }, [visible, scale]);

  return (
    <Animated.View
      style={[
        styles.circle,
        {
          backgroundColor: visible ? C.green : 'transparent',
          borderColor: visible ? C.green : C.border,
          transform: [{ scale }],
        },
      ]}
    >
      {visible && <Icon name="check" size={14} color="#fff" />}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  circle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});
