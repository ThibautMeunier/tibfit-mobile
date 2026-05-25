import React, { useEffect, useRef, useState } from 'react';
import { Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import PaywallModal from '../components/PaywallModal';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StyleSheet } from 'react-native';
import { C } from '../constants/colors';
import { RootStackParamList, MainTabParamList } from '../types';
import { useAuth } from '../context/AuthContext';
import { usePurchase } from '../context/PurchaseContext';
import { getPlans, findSeanceById } from '../services/api';
import Icon from '../components/Icon';
import { useTranslation } from 'react-i18next';

import LoginScreen from '../screens/LoginScreen';
import OnboardingScreen, { ONBOARDING_KEY } from '../screens/OnboardingScreen';
import DashboardScreen from '../screens/DashboardScreen';
import PlanScreen from '../screens/PlanScreen';
import ChatScreen from '../screens/ChatScreen';
import ProfileScreen from '../screens/ProfileScreen';
import SessionScreen from '../screens/SessionScreen';
import GenerateScreen from '../screens/GenerateScreen';
import PlanManageScreen from '../screens/PlanManageScreen';
import StatsScreen from '../screens/StatsScreen';
import PlanStatsScreen from '../screens/PlanStatsScreen';
import WorkoutManagerScreen from '../screens/WorkoutManagerScreen';
import StreakCelebrationScreen from '../screens/StreakCelebrationScreen';
import RecalibrationScreen from '../screens/RecalibrationScreen';
import PlanEndingScreen from '../screens/PlanEndingScreen';
import WeeklyCheckinScreen from '../screens/WeeklyCheckinScreen';
import PlanRefreshScreen from '../screens/PlanRefreshScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

function MainTabs() {
  const { t } = useTranslation();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: C.blue,
        tabBarInactiveTintColor: C.text3,
        tabBarLabelStyle: styles.tabLabel,
        tabBarIcon: ({ color }) => {
          const name =
            route.name === 'Dashboard' ? 'home' :
            route.name === 'Plan' ? 'calendar' :
            route.name === 'Chat' ? 'chat' : 'person';
          return <Icon name={name as any} size={22} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} options={{ title: t('nav.home') }} />
      <Tab.Screen name="Plan" component={PlanScreen} options={{ title: t('nav.plan') }} />
      <Tab.Screen name="Chat" component={ChatScreen} options={{ title: t('nav.chat') }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: t('nav.profile') }} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { user, loading } = useAuth();
  const { showPaywall } = usePurchase();
  const navigationRef = useNavigationContainerRef<RootStackParamList>();
  const pendingDeepLink = useRef<string | null>(null);
  const [hasOnboarded, setHasOnboarded] = useState<boolean | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) { setHasOnboarded(null); return; }
    AsyncStorage.getItem(ONBOARDING_KEY).then((val) => {
      if (val === 'true') {
        setHasOnboarded(true);
        return;
      }
      // Existing users who already have profile data skip onboarding
      const hasProfile = user.niveau !== null || user.objectif !== null || user.poids_kg_actuel !== null;
      if (hasProfile) {
        AsyncStorage.setItem(ONBOARDING_KEY, 'true');
        setHasOnboarded(true);
      } else {
        setHasOnboarded(false);
      }
    });
  }, [user, loading]);

  function handleNotificationResponse(response: Notifications.NotificationResponse) {
    if (!navigationRef.isReady()) return;
    const data = response.notification.request.content.data as Record<string, string> | undefined;
    if (!data) return;
    if (data.type === 'plan_ending' && data.plan_id) {
      const planId = parseInt(data.plan_id, 10);
      if (!isNaN(planId)) {
        if (!user?.is_premium) { showPaywall(); return; }
        navigationRef.navigate('PlanEnding', { planId });
      }
    } else if (data.type === 'weekly_checkin') {
      navigationRef.navigate('WeeklyCheckin');
    }
  }

  async function handleDeepLink(url: string) {
    if (!url.startsWith('tibfit://') || !navigationRef.isReady()) return;
    const withoutScheme = url.slice('tibfit://'.length);
    const [action, idStr] = withoutScheme.split('/');
    const id = idStr ? parseInt(idStr, 10) : NaN;

    if (action === 'session' && !isNaN(id)) {
      const result = await findSeanceById(id);
      if (result) {
        navigationRef.navigate('Session', {
          seance: result.seance,
          planCouleur: result.plan.couleur ?? undefined,
          planSport: result.plan.sport ?? null,
        });
      }
    } else if (action === 'plan' && !isNaN(id)) {
      const plans = await getPlans();
      const plan = plans.find((p) => p.id === id);
      if (plan) navigationRef.navigate('PlanManage', { plan });
    } else if (action === 'generate') {
      navigationRef.navigate('Generate');
    }
  }

  useEffect(() => {
    if (!user) return;
    const sub = Linking.addEventListener('url', ({ url }) => handleDeepLink(url));
    Linking.getInitialURL().then((url) => {
      if (!url) return;
      if (navigationRef.isReady()) handleDeepLink(url);
      else pendingDeepLink.current = url;
    });
    return () => sub.remove();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const sub = Notifications.addNotificationResponseReceivedListener(handleNotificationResponse);
    return () => sub.remove();
  }, [user]);

  if (loading || (user && hasOnboarded === null)) return null;

  return (
    <>
    <NavigationContainer
      ref={navigationRef}
      onReady={() => {
        if (pendingDeepLink.current) {
          handleDeepLink(pendingDeepLink.current);
          pendingDeepLink.current = null;
        }
      }}
    >
      {user ? (
        <Stack.Navigator
          initialRouteName={hasOnboarded ? 'Main' : 'Onboarding'}
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: C.bg },
          }}
        >
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />
          <Stack.Screen name="Main" component={MainTabs} />
          <Stack.Screen
            name="Session"
            component={SessionScreen}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="Generate"
            component={GenerateScreen}
            options={{ animation: 'slide_from_bottom', presentation: 'modal' }}
          />
          <Stack.Screen
            name="PlanManage"
            component={PlanManageScreen}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="Stats"
            component={StatsScreen}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="WorkoutManager"
            component={WorkoutManagerScreen}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="PlanRefresh"
            component={PlanRefreshScreen}
            options={{ animation: 'slide_from_bottom', presentation: 'modal' }}
          />
          <Stack.Screen
            name="PlanStats"
            component={PlanStatsScreen}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="StreakCelebration"
            component={StreakCelebrationScreen}
            options={{ animation: 'fade', presentation: 'modal', gestureEnabled: false }}
          />
          <Stack.Screen
            name="Recalibration"
            component={RecalibrationScreen}
            options={{ animation: 'slide_from_bottom', presentation: 'modal' }}
          />
          <Stack.Screen
            name="PlanEnding"
            component={PlanEndingScreen}
            options={{ animation: 'slide_from_bottom', presentation: 'modal' }}
          />
          <Stack.Screen
            name="WeeklyCheckin"
            component={WeeklyCheckinScreen}
            options={{ animation: 'slide_from_bottom', presentation: 'modal' }}
          />
        </Stack.Navigator>
      ) : (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name={'Main' as any} component={LoginScreen} />
        </Stack.Navigator>
      )}
    </NavigationContainer>
    <PaywallModal />
    </>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: C.bg2,
    borderTopColor: C.border,
    borderTopWidth: 1,
    height: 80,
    paddingBottom: 16,
    paddingTop: 8,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '400',
    letterSpacing: 0.4,
  },
});
