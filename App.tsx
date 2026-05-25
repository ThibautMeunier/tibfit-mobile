import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_700Bold,
} from '@expo-google-fonts/dm-sans';
import {
  DMMono_400Regular,
  DMMono_500Medium,
} from '@expo-google-fonts/dm-mono';
import * as SplashScreen from 'expo-splash-screen';
import { initLanguage } from './src/i18n';
import { AuthProvider } from './src/context/AuthContext';
import { PurchaseProvider } from './src/context/PurchaseContext';
import { GenerationProvider } from './src/context/GenerationContext';
import AppNavigator from './src/navigation/AppNavigator';

SplashScreen.preventAutoHideAsync();

export default function App() {
  const [fontsLoaded] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_700Bold,
    DMMono_400Regular,
    DMMono_500Medium,
  });
  const [langReady, setLangReady] = useState(false);

  useEffect(() => {
    initLanguage().finally(() => setLangReady(true));
  }, []);

  useEffect(() => {
    if (fontsLoaded && langReady) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, langReady]);

  if (!fontsLoaded || !langReady) return null;

  return (
    <SafeAreaProvider>
      <PurchaseProvider>
        <AuthProvider>
          <GenerationProvider>
            <StatusBar style="light" />
            <AppNavigator />
          </GenerationProvider>
        </AuthProvider>
      </PurchaseProvider>
    </SafeAreaProvider>
  );
}
