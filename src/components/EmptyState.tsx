import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { C } from '../constants/colors';
import Icon from './Icon';
import { Button } from './ui';

interface Props {
  icon: string;
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
}

export default function EmptyState({ icon, title, body, actionLabel, onAction }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        <Icon name={icon as any} size={28} color={C.blue} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
      {actionLabel && onAction && (
        <Button
          variant="primary"
          label={actionLabel}
          onPress={onAction}
          icon={<Icon name="bolt" size={15} color="#fff" />}
          full
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 20,
    marginTop: 40,
    alignItems: 'center',
    padding: 36,
    backgroundColor: C.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: C.blueLight,
    borderWidth: 1,
    borderColor: C.blue + '30',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: C.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  body: {
    fontSize: 13,
    color: C.text2,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
});
