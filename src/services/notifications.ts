import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { registerPushToken, revokePushToken } from './api';

const PROJECT_ID = '0fd4a3dc-fa3b-40db-ac8e-0e8f83dfeca9';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: false,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export async function registerForPushNotifications(): Promise<void> {
  // iOS et Android supportés via Expo (APNs sur iOS, FCM sur Android)
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return;

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') return;

  const tokenData = await Notifications.getExpoPushTokenAsync({ projectId: PROJECT_ID });
  await registerPushToken(tokenData.data);
}

export async function unregisterPushNotifications(): Promise<void> {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return;
  try {
    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId: PROJECT_ID });
    await revokePushToken(tokenData.data);
  } catch {
    // Token déjà invalide ou permissions retirées — on ignore silencieusement
  }
}
