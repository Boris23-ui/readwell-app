import { Redirect } from 'expo-router';
import { useApp } from '@/context/CloudAppContext';
import { View, ActivityIndicator } from 'react-native';
import { useColors } from '@/hooks/useColors';

export default function Index() {
  const { profile, isLoading } = useApp();
  const colors = useColors();

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!profile.onboardingComplete) {
    return <Redirect href="/onboarding" />;
  }

  if (profile.role === 'sponsor') {
    return <Redirect href="/(sponsor-tabs)" />;
  }

  return <Redirect href="/(tabs)" />;
}
