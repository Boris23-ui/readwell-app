import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../utils/firebase';
import { useRouter, useSegments } from 'expo-router';

interface AuthContextType {
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const segments = useSegments();
  const router = useRouter();

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

    if (!user && !inAuthGroup) {
      // Redirect to login if not logged in and trying to access other screens
      router.replace('/login');
    } else if (user && inAuthGroup) {
      // Redirect to home if logged in and trying to access login
      router.replace('/');
    }
  }, [user, loading, segments]);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
