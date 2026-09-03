import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { useColors } from '@/hooks/useColors';

function GoogleIcon({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        fill="#4285F4"
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
      />
      <Path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
      />
      <Path
        fill="#FBBC05"
        d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
      />
      <Path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
      />
    </Svg>
  );
}

function AppleIcon({ size = 20, color = '#FFFFFF' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 170 170">
      <Path
        fill={color}
        d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.69-3.08-7.7-7.93-12.04-14.54-6.08-9.17-10.9-19.46-14.47-30.87-3.56-11.41-5.34-22.18-5.34-32.32 0-14.43 3.65-26.31 10.95-35.65 7.3-9.34 16.5-14.15 27.61-14.42 5.02 0 10.5 1.25 16.44 3.76 5.94 2.5 9.87 3.82 11.78 3.93 2.14 0 6.32-1.42 12.56-4.27 6.23-2.85 11.66-4.15 16.29-3.9 12.04.63 21.72 4.96 29.02 12.98-10.45 6.32-15.58 15.22-15.39 26.69.21 9.07 3.69 16.63 10.43 22.68 6.74 6.05 14.81 9.58 24.21 10.59-1.92 5.86-4.22 11.83-6.9 17.91zm-32.84-106.6c0-6.14 2.21-12.04 6.64-17.69 4.43-5.65 9.99-9.35 16.69-11.11.85 6.47-.56 12.58-4.24 18.34-3.67 5.76-9.13 9.49-16.38 11.18-.54-.24-1.44-.42-2.71-.72z"
      />
    </Svg>
  );
}

export default function LoginScreen() {
  const colors = useColors();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [role, setRole] = useState<'learner' | 'sponsor'>('learner');
  const [isAppleLoading, setIsAppleLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isEmailLoading, setIsEmailLoading] = useState(false);
  const [isGuestLoading, setIsGuestLoading] = useState(false);
  const router = useRouter();
  const { signInWithGoogle, signInWithApple, signIn, signUp, continueAsGuest, devBypassLogin } = useAuth();

  const handleAppleAuth = async () => {
    setIsAppleLoading(true);
    try {
      await signInWithApple(role);
      router.replace('/');
    } catch (error: any) {
      console.error('Apple Auth Error:', error);
      Alert.alert('Apple Sign-In Error', error.message || 'Unable to sign in with Apple. Please try again.');
    } finally {
      setIsAppleLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setIsGoogleLoading(true);
    try {
      await signInWithGoogle(role);
      router.replace('/');
    } catch (error: any) {
      console.error('Google Auth Error:', error);
      Alert.alert('Google Sign-In Error', error.message || 'Unable to sign in with Google. Please try again.');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleEmailAuth = async () => {
    if (!email || !password) {
      Alert.alert('Missing Fields', 'Please enter both email and password');
      return;
    }

    setIsEmailLoading(true);
    try {
      if (isLogin) {
        await signIn(email.trim(), password);
      } else {
        await signUp(email.trim(), password, role);
      }
      router.replace('/');
    } catch (error: any) {
      Alert.alert('Authentication Error', error.message || 'Failed to authenticate');
    } finally {
      setIsEmailLoading(false);
    }
  };

  const handleGuestMode = async () => {
    setIsGuestLoading(true);
    try {
      await continueAsGuest();
      router.replace('/');
    } catch (error: any) {
      Alert.alert('Error', 'Failed to enter guest mode');
    } finally {
      setIsGuestLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: `${colors.terracotta}55`, shadowColor: colors.shadow }]}>
          {/* Header Tag */}
          <View style={styles.seasonTagRow}>
            <View style={[styles.seasonPill, { backgroundColor: `${colors.terracotta}18` }]}>
              <Text style={[styles.seasonPillText, { color: colors.terracotta }]}>
                SEASON 1 · SOCRATIC FLOOR
              </Text>
            </View>
          </View>

          {/* Header */}
          <View style={styles.header}>
            <View style={[styles.logoBadge, { backgroundColor: `${colors.terracotta}18` }]}>
              <Feather name="book-open" size={26} color={colors.terracotta} />
            </View>
            <Text style={[styles.title, { color: colors.foreground }]}>
              Read<Text style={{ color: colors.terracotta }}>Well</Text>
            </Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              One reader. Socratic checkpoints. Conquer reading stages with AI pedagogical feedback.
            </Text>
          </View>

          {/* Role Picker */}
          <View style={styles.roleContainer}>
            <Text style={[styles.roleLabel, { color: colors.mutedForeground }]}>I am signing in as:</Text>
            <View style={[styles.roleButtons, { backgroundColor: colors.background }]}>
              <TouchableOpacity
                style={[styles.roleOption, role === 'learner' && { backgroundColor: colors.primary }]}
                onPress={() => setRole('learner')}
                activeOpacity={0.8}
              >
                <Feather
                  name="book"
                  size={14}
                  color={role === 'learner' ? '#FFF' : colors.mutedForeground}
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={[
                    styles.roleOptionText,
                    { color: role === 'learner' ? '#FFF' : colors.mutedForeground },
                    role === 'learner' && styles.roleOptionTextActive,
                  ]}
                >
                  Learner
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.roleOption, role === 'sponsor' && { backgroundColor: colors.primary }]}
                onPress={() => setRole('sponsor')}
                activeOpacity={0.8}
              >
                <Feather
                  name="users"
                  size={14}
                  color={role === 'sponsor' ? '#FFF' : colors.mutedForeground}
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={[
                    styles.roleOptionText,
                    { color: role === 'sponsor' ? '#FFF' : colors.mutedForeground },
                    role === 'sponsor' && styles.roleOptionTextActive,
                  ]}
                >
                  Parent / Sponsor
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Social Auth Suite: Apple & Google */}
          <View style={styles.socialButtonsContainer}>
            {/* Apple Sign In */}
            <TouchableOpacity
              style={styles.appleButton}
              onPress={handleAppleAuth}
              disabled={isAppleLoading || isGoogleLoading}
              activeOpacity={0.85}
            >
              {isAppleLoading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <AppleIcon size={20} color="#FFFFFF" />
                  <Text style={styles.appleButtonText}>Continue with Apple</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Google Sign In */}
            <TouchableOpacity
              style={[styles.googleButton, { borderColor: colors.border }]}
              onPress={handleGoogleAuth}
              disabled={isGoogleLoading || isAppleLoading}
              activeOpacity={0.85}
            >
              {isGoogleLoading ? (
                <ActivityIndicator color={colors.foreground} size="small" />
              ) : (
                <>
                  <GoogleIcon size={20} />
                  <Text style={[styles.googleButtonText, { color: colors.foreground }]}>
                    Continue with Google
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.divider}>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            <Text style={[styles.dividerText, { color: colors.mutedForeground }]}>or</Text>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          </View>

          {/* Collapsible Email Section */}
          {!showEmailForm ? (
            <TouchableOpacity
              style={[styles.toggleEmailButton, { borderColor: colors.border }]}
              onPress={() => setShowEmailForm(true)}
            >
              <Feather name="mail" size={16} color={colors.mutedForeground} />
              <Text style={[styles.toggleEmailText, { color: colors.mutedForeground }]}>
                Sign in with Email & Password
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.emailForm}>
              <TextInput
                style={[
                  styles.input,
                  { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground },
                ]}
                placeholder="Email address"
                placeholderTextColor={colors.mutedForeground}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />

              <TextInput
                style={[
                  styles.input,
                  { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground },
                ]}
                placeholder="Password"
                placeholderTextColor={colors.mutedForeground}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />

              <TouchableOpacity
                style={[styles.primaryButton, { backgroundColor: colors.primary }]}
                onPress={handleEmailAuth}
                disabled={isEmailLoading}
              >
                {isEmailLoading ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <Text style={styles.primaryButtonText}>{isLogin ? 'Log In' : 'Sign Up'}</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity style={styles.switchButton} onPress={() => setIsLogin(!isLogin)}>
                <Text style={[styles.switchText, { color: colors.primary }]}>
                  {isLogin ? "Need an account? Sign Up" : 'Already have an account? Log In'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Guest Mode */}
          <TouchableOpacity
            style={styles.guestButton}
            onPress={handleGuestMode}
            disabled={isGuestLoading}
          >
            {isGuestLoading ? (
              <ActivityIndicator color={colors.mutedForeground} size="small" />
            ) : (
              <Text style={[styles.guestButtonText, { color: colors.mutedForeground }]}>
                Continue as Guest Reader
              </Text>
            )}
          </TouchableOpacity>

          {/* Developer Quick Login */}
          {__DEV__ && (
            <TouchableOpacity
              style={[styles.devButton, { backgroundColor: `${colors.terracotta}18` }]}
              onPress={async () => {
                try {
                  await devBypassLogin();
                  router.replace('/');
                } catch (error) {
                  Alert.alert('Dev Login Error', 'Could not bypass login');
                }
              }}
            >
              <Feather name="code" size={14} color={colors.terracotta} />
              <Text style={[styles.devButtonText, { color: colors.terracotta }]}>
                Developer Quick Login
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    borderRadius: 24,
    padding: 28,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  seasonTagRow: {
    alignItems: 'center',
    marginBottom: 12,
  },
  seasonPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  seasonPillText: {
    fontSize: 10.5,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1.1,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoBadge: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 30,
    fontFamily: 'Newsreader_700Bold',
    marginBottom: 6,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 8,
  },
  roleContainer: {
    marginBottom: 20,
  },
  roleLabel: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    marginBottom: 8,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  roleButtons: {
    flexDirection: 'row',
    borderRadius: 14,
    padding: 4,
  },
  roleOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
  },
  roleOptionText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
  },
  roleOptionTextActive: {
    fontFamily: 'Inter_600SemiBold',
  },
  socialButtonsContainer: {
    gap: 10,
  },
  appleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 14,
    backgroundColor: '#000000',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  appleButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 14,
    borderWidth: 1.5,
    backgroundColor: 'transparent',
    gap: 10,
  },
  googleButtonText: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    marginHorizontal: 12,
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
  },
  toggleEmailButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  toggleEmailText: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
  },
  emailForm: {
    marginTop: 4,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
  },
  primaryButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
  },
  switchButton: {
    marginTop: 14,
    alignItems: 'center',
  },
  switchText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
  },
  guestButton: {
    marginTop: 18,
    alignItems: 'center',
    paddingVertical: 8,
  },
  guestButtonText: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
  },
  devButton: {
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  devButtonText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
});
