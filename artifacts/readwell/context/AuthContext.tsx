import React, { createContext, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { useRouter, useSegments } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { supabase, isSupabaseConfigured } from '../utils/supabase';

// Ensure any redirect from auth sessions completes properly on web
WebBrowser.maybeCompleteAuthSession();

const GUEST_MODE_KEY = '@readwell/guest-mode';
const LOCAL_USER_KEY = '@readwell/local-user';

export interface AuthUser {
  uid: string;
  id: string;
  email: string | null;
  displayName?: string | null;
  photoUrl?: string | null;
  role?: 'learner' | 'sponsor';
  provider?: 'google' | 'apple' | 'password' | 'guest';
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  isGuest: boolean;
  continueAsGuest: () => Promise<void>;
  signInWithGoogle: (role?: 'learner' | 'sponsor') => Promise<void>;
  signInWithApple: (role?: 'learner' | 'sponsor') => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, role?: 'learner' | 'sponsor') => Promise<void>;
  signOut: () => Promise<void>;
  devBypassLogin: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  isGuest: false,
  continueAsGuest: async () => {},
  signInWithGoogle: async () => {},
  signInWithApple: async () => {},
  signIn: async () => {},
  signUp: async () => {},
  signOut: async () => {},
  devBypassLogin: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);
  const segments = useSegments();
  const router = useRouter();

  const extractAuthUser = (supabaseUser: any, defaultRole: 'learner' | 'sponsor' = 'learner'): AuthUser => {
    const meta = supabaseUser.user_metadata || {};
    const appMeta = supabaseUser.app_metadata || {};
    const isGoogle = appMeta.provider === 'google' || meta.iss?.includes('google');
    const isApple = appMeta.provider === 'apple' || meta.iss?.includes('apple');

    let provider: 'google' | 'apple' | 'password' | 'guest' = 'password';
    if (isGoogle) provider = 'google';
    else if (isApple) provider = 'apple';

    return {
      uid: supabaseUser.id,
      id: supabaseUser.id,
      email: supabaseUser.email ?? null,
      displayName: meta.full_name || meta.name || meta.display_name || supabaseUser.email?.split('@')[0] || 'Reader',
      photoUrl: meta.avatar_url || meta.picture || null,
      role: meta.role || defaultRole,
      provider,
    };
  };

  // Load saved session or guest mode on mount
  useEffect(() => {
    let isMounted = true;

    const initAuth = async () => {
      try {
        const guestVal = await AsyncStorage.getItem(GUEST_MODE_KEY);
        if (guestVal === 'true' && isMounted) {
          setIsGuest(true);
        }

        if (isSupabaseConfigured()) {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user && isMounted) {
            setUser(extractAuthUser(session.user));
          }
        } else {
          // Check for saved local/offline user
          const savedUserRaw = await AsyncStorage.getItem(LOCAL_USER_KEY);
          if (savedUserRaw && isMounted) {
            try {
              setUser(JSON.parse(savedUserRaw));
            } catch {}
          }
        }
      } catch (err) {
        console.warn('Error initializing auth:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    initAuth();

    // Listen to Supabase auth changes
    let authListener: { subscription: { unsubscribe: () => void } } | null = null;
    if (isSupabaseConfigured()) {
      const { data } = supabase.auth.onAuthStateChange(async (_event, session) => {
        if (session?.user) {
          setUser(extractAuthUser(session.user));
          setIsGuest(false);
        } else {
          setUser(null);
        }
        setLoading(false);
      });
      authListener = data;
    }

    return () => {
      isMounted = false;
      authListener?.subscription.unsubscribe();
    };
  }, []);

  // Navigation guard
  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === 'login';
    const isAuthenticated = user || isGuest;

    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/login');
    } else if (isAuthenticated && inAuthGroup) {
      router.replace('/');
    }
  }, [user, loading, segments, isGuest]);

  const continueAsGuest = async () => {
    await AsyncStorage.setItem(GUEST_MODE_KEY, 'true');
    setIsGuest(true);
  };

  const signInWithGoogle = async (role: 'learner' | 'sponsor' = 'learner') => {
    if (isSupabaseConfigured()) {
      if (Platform.OS === 'web') {
        const redirectUrl = typeof window !== 'undefined' ? window.location.origin : undefined;
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: redirectUrl,
            queryParams: {
              access_type: 'offline',
              prompt: 'consent',
            },
          },
        });
        if (error) throw error;
        return;
      }

      // Native iOS / Android OAuth Flow with expo-web-browser
      const redirectUrl = Linking.createURL('/');
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: true,
        },
      });

      if (error) throw error;

      if (data?.url) {
        const res = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);
        if (res.type === 'success' && res.url) {
          const urlStr = res.url;
          let accessToken: string | null = null;
          let refreshToken: string | null = null;

          if (urlStr.includes('#')) {
            const hash = urlStr.substring(urlStr.indexOf('#') + 1);
            const params = new URLSearchParams(hash);
            accessToken = params.get('access_token');
            refreshToken = params.get('refresh_token');
          } else if (urlStr.includes('?')) {
            const search = urlStr.substring(urlStr.indexOf('?') + 1);
            const params = new URLSearchParams(search);
            accessToken = params.get('access_token');
            refreshToken = params.get('refresh_token');
          }

          if (accessToken && refreshToken) {
            const { data: sessionData, error: sessionErr } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            if (sessionErr) throw sessionErr;
            if (sessionData.user) {
              const googleUser = extractAuthUser(sessionData.user, role);
              setUser(googleUser);
              setIsGuest(false);
              await AsyncStorage.removeItem(GUEST_MODE_KEY);
              return;
            }
          }
        }
      }
    } else {
      // Offline / Local Demo Google Auth experience
      const demoGoogleUser: AuthUser = {
        uid: 'google_reader_' + Math.floor(1000 + Math.random() * 9000),
        id: 'google_reader_' + Math.floor(1000 + Math.random() * 9000),
        email: 'reader.google@gmail.com',
        displayName: 'Google Reader',
        photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
        role,
        provider: 'google',
      };
      await AsyncStorage.setItem(LOCAL_USER_KEY, JSON.stringify(demoGoogleUser));
      await AsyncStorage.removeItem(GUEST_MODE_KEY);
      setUser(demoGoogleUser);
      setIsGuest(false);
    }
  };

  const signInWithApple = async (role: 'learner' | 'sponsor' = 'learner') => {
    if (isSupabaseConfigured()) {
      if (Platform.OS === 'web') {
        const redirectUrl = typeof window !== 'undefined' ? window.location.origin : undefined;
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'apple',
          options: {
            redirectTo: redirectUrl,
          },
        });
        if (error) throw error;
        return;
      }

      // Native iOS / Android OAuth Flow with expo-web-browser
      const redirectUrl = Linking.createURL('/');
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'apple',
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: true,
        },
      });

      if (error) throw error;

      if (data?.url) {
        const res = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);
        if (res.type === 'success' && res.url) {
          const urlStr = res.url;
          let accessToken: string | null = null;
          let refreshToken: string | null = null;

          if (urlStr.includes('#')) {
            const hash = urlStr.substring(urlStr.indexOf('#') + 1);
            const params = new URLSearchParams(hash);
            accessToken = params.get('access_token');
            refreshToken = params.get('refresh_token');
          } else if (urlStr.includes('?')) {
            const search = urlStr.substring(urlStr.indexOf('?') + 1);
            const params = new URLSearchParams(search);
            accessToken = params.get('access_token');
            refreshToken = params.get('refresh_token');
          }

          if (accessToken && refreshToken) {
            const { data: sessionData, error: sessionErr } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            if (sessionErr) throw sessionErr;
            if (sessionData.user) {
              const appleUser = extractAuthUser(sessionData.user, role);
              setUser(appleUser);
              setIsGuest(false);
              await AsyncStorage.removeItem(GUEST_MODE_KEY);
              return;
            }
          }
        }
      }
    } else {
      // Offline / Local Demo Apple Auth experience
      const demoAppleUser: AuthUser = {
        uid: 'apple_reader_' + Math.floor(1000 + Math.random() * 9000),
        id: 'apple_reader_' + Math.floor(1000 + Math.random() * 9000),
        email: 'reader.apple@icloud.com',
        displayName: 'Apple Reader',
        photoUrl: null,
        role,
        provider: 'apple',
      };
      await AsyncStorage.setItem(LOCAL_USER_KEY, JSON.stringify(demoAppleUser));
      await AsyncStorage.removeItem(GUEST_MODE_KEY);
      setUser(demoAppleUser);
      setIsGuest(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    if (isSupabaseConfigured()) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (data.user) {
        setUser(extractAuthUser(data.user));
        setIsGuest(false);
      }
    } else {
      // Offline/demo fallback login
      const localUser: AuthUser = {
        uid: 'user_' + Math.abs(email.split('').reduce((a, b) => ((a << 5) - a) + b.charCodeAt(0), 0)),
        id: 'user_' + Math.abs(email.split('').reduce((a, b) => ((a << 5) - a) + b.charCodeAt(0), 0)),
        email,
        displayName: email.split('@')[0],
        role: 'learner',
        provider: 'password',
      };
      await AsyncStorage.setItem(LOCAL_USER_KEY, JSON.stringify(localUser));
      setUser(localUser);
      setIsGuest(false);
    }
  };

  const signUp = async (email: string, password: string, role: 'learner' | 'sponsor' = 'learner') => {
    if (isSupabaseConfigured()) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { role, display_name: email.split('@')[0] },
        },
      });
      if (error) throw error;
      if (data.user) {
        setUser(extractAuthUser(data.user, role));
        setIsGuest(false);
      }
    } else {
      // Offline/demo fallback signup
      const localUser: AuthUser = {
        uid: 'user_' + Math.abs(email.split('').reduce((a, b) => ((a << 5) - a) + b.charCodeAt(0), 0)),
        id: 'user_' + Math.abs(email.split('').reduce((a, b) => ((a << 5) - a) + b.charCodeAt(0), 0)),
        email,
        displayName: email.split('@')[0],
        role,
        provider: 'password',
      };
      await AsyncStorage.setItem(LOCAL_USER_KEY, JSON.stringify(localUser));
      setUser(localUser);
      setIsGuest(false);
    }
  };

  const signOut = async () => {
    if (isSupabaseConfigured()) {
      await supabase.auth.signOut();
    }
    await AsyncStorage.removeItem(LOCAL_USER_KEY);
    await AsyncStorage.removeItem(GUEST_MODE_KEY);
    setUser(null);
    setIsGuest(false);
  };

  const devBypassLogin = async () => {
    const devUser: AuthUser = {
      uid: 'dev_admin_001',
      id: 'dev_admin_001',
      email: 'developer@readwell.app',
      displayName: 'Developer',
      role: 'learner',
      provider: 'password',
    };
    await AsyncStorage.setItem(LOCAL_USER_KEY, JSON.stringify(devUser));
    await AsyncStorage.removeItem(GUEST_MODE_KEY);
    setUser(devUser);
    setIsGuest(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isGuest,
        continueAsGuest,
        signInWithGoogle,
        signInWithApple,
        signIn,
        signUp,
        signOut,
        devBypassLogin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
