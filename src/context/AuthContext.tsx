import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getMe, logout as apiLogout, updateProfile, updatePassword } from '../services/api';
import { clearAllCache } from '../services/offlineCache';
import { registerForPushNotifications, unregisterPushNotifications } from '../services/notifications';
import { identifyUserInRevenueCat, resetRevenueCatUser } from './PurchaseContext';

interface User {
  id: number;
  email: string;
  name: string;
  is_premium: boolean;
  niveau: string | null;
  objectif: string | null;
  streak: number;
  poids_kg_actuel: number | null;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  signIn: (token: string) => Promise<void>;
  signOut: () => Promise<void>;
  handleSessionExpired: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem('token').then(async (token) => {
      if (token) {
        try {
          const me = await getMe();
          setUser(me);
        } catch {
          await AsyncStorage.removeItem('token');
        }
      }
      setLoading(false);
    });
  }, []);

  async function signIn(token: string) {
    await AsyncStorage.setItem('token', token);
    const me = await getMe();
    setUser(me);
    identifyUserInRevenueCat(me.id);
    registerForPushNotifications().catch(() => {});
  }

  async function signOut() {
    await unregisterPushNotifications().catch(() => {});
    await apiLogout();
    await clearAllCache();
    await AsyncStorage.removeItem('hasCompletedOnboarding');
    await resetRevenueCatUser();
    setUser(null);
  }

  // Called by any screen that gets SESSION_EXPIRED — clears state and goes to login
  const handleSessionExpired = useCallback(async () => {
    await AsyncStorage.multiRemove(['token', 'refresh_token']);
    await clearAllCache();
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const me = await getMe();
    setUser(me);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut, handleSessionExpired, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
