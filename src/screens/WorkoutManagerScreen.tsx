import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { C } from '../constants/colors';
import Icon from '../components/Icon';
import { listScheduledWorkouts, removeScheduledWorkout, ScheduledWorkout } from '../services/workoutKit';
import { NavHeader, ListRow } from '../components/ui';

export default function WorkoutManagerScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  const [workouts, setWorkouts] = useState<ScheduledWorkout[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const list = await listScheduledWorkouts();
    setWorkouts(list.sort((a, b) => a.date.localeCompare(b.date)));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function extractEmoji(displayName: string): { emoji: string | null; title: string } {
    const match = displayName.match(/^([^\x00-\x7F\s]+)\s*(.*)/s);
    if (match) return { emoji: match[1], title: match[2] || displayName };
    return { emoji: null, title: displayName };
  }

  function formatDate(iso: string): string {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }

  function confirmDelete(workout: ScheduledWorkout) {
    Alert.alert(
      t('workoutManager.deleteConfirmTitle'),
      `"${workout.displayName}" — ${formatDate(workout.date)}\n\n${t('workoutManager.deleteConfirmMsg')}`,
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('workoutManager.deleteConfirm'),
          style: 'destructive',
          onPress: () => handleDelete(workout.id),
        },
      ],
    );
  }

  async function handleDelete(id: string) {
    setDeleting(id);
    const ok = await removeScheduledWorkout(id);
    if (ok) {
      setWorkouts(prev => prev.filter(w => w.id !== id));
    } else {
      Alert.alert(t('common.error'), t('workoutManager.deleteError'));
    }
    setDeleting(null);
  }

  function renderItem({ item }: { item: ScheduledWorkout }) {
    const isDeleting = deleting === item.id;
    const { emoji, title } = extractEmoji(item.displayName);
    return (
      <ListRow
        icon={emoji ?? '⌚'}
        title={title}
        subtitle={formatDate(item.date)}
        trailing={
          isDeleting
            ? <ActivityIndicator size="small" color={C.red} />
            : (
              <TouchableOpacity onPress={() => confirmDelete(item)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Icon name="trash" size={18} color={C.red} />
              </TouchableOpacity>
            )
        }
      />
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <NavHeader title={t('workoutManager.title')} onBack={() => navigation.goBack()} />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={C.blue} />
        </View>
      ) : workouts.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>⌚</Text>
          <Text style={styles.emptyTitle}>{t('workoutManager.empty')}</Text>
          <Text style={styles.emptyDesc}>{t('workoutManager.emptyDesc')}</Text>
        </View>
      ) : (
        <FlatList
          data={workouts}
          keyExtractor={w => w.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: C.text, marginBottom: 8, textAlign: 'center' },
  emptyDesc: { fontSize: 14, color: C.text2, textAlign: 'center', lineHeight: 20 },
  list: { padding: 16, gap: 10 },
  separator: { height: 0 },
});
