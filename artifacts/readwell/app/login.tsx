import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../utils/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { useRouter } from 'expo-router';
import { DEFAULT_PROFILE } from '@/context/CloudAppContext';
import { useAuth } from '@/context/AuthContext';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [role, setRole] = useState<'learner' | 'sponsor'>('learner');
  const [isGuestLoading, setIsGuestLoading] = useState(false);
  const router = useRouter();
  const { continueAsGuest } = useAuth();

  const handleAuth = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter email and password');
      return;
    }
    
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await setDoc(doc(db, 'users', cred.user.uid), {
          ...DEFAULT_PROFILE,
          role,
        });
      }
      // Auth state listener in _layout or AppContext will handle routing
      router.replace('/');
    } catch (error: any) {
      Alert.alert('Authentication Error', error.message);
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
      style={styles.container}
    >
      <View style={styles.card}>
        <Text style={styles.title}>{isLogin ? 'Welcome Back' : 'Create Account'}</Text>
        <Text style={styles.subtitle}>Sign in to sync your reading progress.</Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#9ca3af"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#9ca3af"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        {!isLogin && (
          <View style={styles.roleContainer}>
            <Text style={styles.roleLabel}>I am a:</Text>
            <View style={styles.roleButtons}>
              <TouchableOpacity
                style={[styles.roleOption, role === 'learner' && styles.roleOptionActive]}
                onPress={() => setRole('learner')}
              >
                <Text style={[styles.roleOptionText, role === 'learner' && styles.roleOptionTextActive]}>Learner</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.roleOption, role === 'sponsor' && styles.roleOptionActive]}
                onPress={() => setRole('sponsor')}
              >
                <Text style={[styles.roleOptionText, role === 'sponsor' && styles.roleOptionTextActive]}>Parent / Employer</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <TouchableOpacity style={styles.primaryButton} onPress={handleAuth}>
          <Text style={styles.primaryButtonText}>{isLogin ? 'Log In' : 'Sign Up'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.switchButton} onPress={() => setIsLogin(!isLogin)}>
          <Text style={styles.switchText}>
            {isLogin ? "Don't have an account? Sign Up" : 'Already have an account? Log In'}
          </Text>
        </TouchableOpacity>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        <TouchableOpacity 
          style={styles.guestButton} 
          onPress={handleGuestMode}
          disabled={isGuestLoading}
        >
          {isGuestLoading ? (
            <ActivityIndicator color="#6b7280" size="small" />
          ) : (
            <Text style={styles.guestButtonText}>Continue as Guest</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#f3f4f6',
  },
  card: {
    backgroundColor: '#ffffff',
    padding: 32,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  title: {
    fontSize: 28,
    fontFamily: 'Newsreader_700Bold',
    color: '#1f2937',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    color: '#6b7280',
    marginBottom: 32,
    textAlign: 'center',
  },
  input: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    color: '#1f2937',
  },
  primaryButton: {
    backgroundColor: '#3b82f6',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
  switchButton: {
    marginTop: 24,
    alignItems: 'center',
  },
  switchText: {
    color: '#3b82f6',
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
  },
  roleContainer: {
    marginBottom: 16,
  },
  roleLabel: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: '#374151',
    marginBottom: 8,
  },
  roleButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  roleOption: {
    flex: 1,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#f9fafb',
  },
  roleOptionActive: {
    borderColor: '#3b82f6',
    backgroundColor: '#eff6ff',
  },
  roleOptionText: {
    color: '#6b7280',
    fontFamily: 'Inter_500Medium',
  },
  roleOptionTextActive: {
    color: '#3b82f6',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e5e7eb',
  },
  dividerText: {
    marginHorizontal: 12,
    color: '#9ca3af',
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },
  guestButton: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#f9fafb',
  },
  guestButtonText: {
    color: '#374151',
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
});
