import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../utils/firebase';
import { useRouter, useSegments } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

const GUEST_MODE_KEY = '@readwell/guest-mode';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isGuest: boolean;
  continueAsGuest: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  isGuest: false,
  continueAsGuest: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);
  const segments = useSegments();
  const router = useRouter();

  // Check for saved guest mode on mount
  useEffect(() => {
    AsyncStorage.getItem(GUEST_MODE_KEY).then((value) => {
      if (value === 'true') {
        setIsGuest(true);
      }
    });
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === 'login';
    const isAuthenticated = user || isGuest;

    if (!isAuthenticated && !inAuthGroup) {
      // Redirect to login if not logged in and not guest
      router.replace('/login');
    } else if (isAuthenticated && inAuthGroup) {
      // Redirect to home if logged in/guest and trying to access login
      router.replace('/');
    }
  }, [user, loading, segments, isGuest]);

  const continueAsGuest = async () => {
    await AsyncStorage.setItem(GUEST_MODE_KEY, 'true');
    setIsGuest(true);
  };

  return (
    <AuthContext.Provider value={{ user, loading, isGuest, continueAsGuest }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
