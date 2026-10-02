import React, { useEffect } from 'react';
import { Platform, View, StyleSheet, useWindowDimensions } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { AppProvider } from '@/context/CloudAppContext';
import { AuthProvider } from '@/context/AuthContext';
import { CoachProvider } from '@/context/CoachContext';
import { useColors } from '@/hooks/useColors';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts as useInterFonts,
} from '@expo-google-fonts/inter';
import {
  Newsreader_400Regular,
  Newsreader_500Medium,
  Newsreader_600SemiBold,
  Newsreader_700Bold,
  useFonts as useNewsreaderFonts,
} from '@expo-google-fonts/newsreader';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="index" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="(sponsor-tabs)" />
      <Stack.Screen
        name="import"
        options={{ presentation: 'modal', headerShown: false }}
      />
      <Stack.Screen name="reader/[bookId]" />
      <Stack.Screen name="quiz/[bookId]" />
      <Stack.Screen name="session-summary/[bookId]" />
    </Stack>
  );
}

function WebContainer({ children }: { children: React.ReactNode }) {
  const colors = useColors();
  const { width } = useWindowDimensions();

  if (Platform.OS !== 'web') {
    return <>{children}</>;
  }

  const isWide = width > 1240;

  return (
    <View style={[styles.webOuter, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.webInner,
          {
            backgroundColor: colors.background,
            borderColor: isWide ? `${colors.border}66` : 'transparent',
            borderLeftWidth: isWide ? 1 : 0,
            borderRightWidth: isWide ? 1 : 0,
          },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

export default function RootLayout() {
  const [interLoaded, interError] = useInterFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  const [newsreaderLoaded, newsreaderError] = useNewsreaderFonts({
    Newsreader_400Regular,
    Newsreader_500Medium,
    Newsreader_600SemiBold,
    Newsreader_700Bold,
  });

  const fontsLoaded = interLoaded && newsreaderLoaded;
  const fontError = interError || newsreaderError;

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <KeyboardProvider>
              <AuthProvider>
                <AppProvider>
                  <CoachProvider>
                    <WebContainer>
                      <RootLayoutNav />
                    </WebContainer>
                  </CoachProvider>
                </AppProvider>
              </AuthProvider>
            </KeyboardProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  webOuter: {
    flex: 1,
    width: '100%',
    height: '100%',
    alignItems: 'center',
  },
  webInner: {
    flex: 1,
    width: '100%',
    maxWidth: 1200,
    height: '100%',
    position: 'relative',
    overflow: 'hidden',
  },
});
