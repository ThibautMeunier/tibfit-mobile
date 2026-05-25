import { NativeModules, Platform } from 'react-native';

const { WidgetDataModule } = NativeModules;

export interface WidgetSession {
  id: number;
  titre: string;
  duree_minutes: number;
  sport: string | null;
  emoji: string | null;
  zone: string | null;
}

export function setWidgetSessions(sessions: WidgetSession[]): void {
  if (Platform.OS !== 'ios' || !WidgetDataModule) return;
  WidgetDataModule.setSessionData(JSON.stringify(sessions));
}
