import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useApp } from '@/context/AppContext';
import { UserProfile } from '@/types';

const { width } = Dimensions.get('window');

const READING_LEVELS = ['beginner', 'intermediate', 'advanced'] as const;
const GOAL_OPTIONS = [10, 20, 30, 45, 60];
const INTERESTS = ['Fiction', 'Non-fiction', 'Science', 'History', 'Biography', 'Self-help', 'Fantasy', 'Mystery'];

export default function Onboarding() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { saveProfile, profile } = useApp();
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [ageGroup, setAgeGroup] = useState<'teen' | 'adult'>('adult');
  const [readingLevel, setReadingLevel] = useState<'beginner' | 'intermediate' | 'advanced'>('intermediate');
  const [dailyGoal, setDailyGoal] = useState(20);
  const [interests, setInterests] = useState<string[]>([]);

  const totalSteps = 4;

  const toggleInterest = (interest: string) => {
    setInterests(prev =>
      prev.includes(interest) ? prev.filter(i => i !== interest) : [...prev, interest]
    );
  };

  const handleNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (step < totalSteps - 1) {
      setStep(s => s + 1);
    } else {
      handleFinish();
    }
  };

  const handleFinish = async () => {
    const newProfile: UserProfile = {
      ...profile,
      name: name.trim() || 'Reader',
      ageGroup,
      readingLevel,
      interests,
      dailyGoalMinutes: dailyGoal,
      onboardingComplete: true,
      createdAt: new Date().toISOString(),
    };
    await saveProfile(newProfile);
    router.replace('/(tabs)');
  };

  const canProceed = step === 0 ? name.trim().length > 0 : true;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <LinearGradient
        colors={['#1C1917', '#2D2420', '#1C1917']}
        style={[styles.container, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}
      >
        {/* Progress dots */}
        <View style={styles.dots}>
          {Array.from({ length: totalSteps }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                {
                  backgroundColor: i <= step ? colors.primary : '#3C3530',
                  width: i === step ? 24 : 8,
                },
              ]}
            />
          ))}
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {step === 0 && (
            <View style={styles.stepContent}>
              <View style={[styles.logoCircle, { backgroundColor: `${colors.primary}20`, borderColor: colors.primary }]}>
                <Feather name="book-open" size={40} color={colors.primary} />
              </View>
              <Text style={styles.heroTitle}>ReadWell</Text>
              <Text style={[styles.heroSubtitle, { color: '#A8A29E' }]}>
                Turn any book into a reading habit.{'\n'}Understand more. Remember more.
              </Text>
              <View style={styles.nameSection}>
                <Text style={[styles.label, { color: '#A8A29E' }]}>What should we call you?</Text>
                <TextInput
                  style={[
                    styles.input,
                    { backgroundColor: '#28231E', borderColor: '#3C3530', color: '#FAF9F6' },
                  ]}
                  placeholder="Your name"
                  placeholderTextColor="#78716C"
                  value={name}
                  onChangeText={setName}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={canProceed ? handleNext : undefined}
                />
                <View style={styles.ageRow}>
                  {(['teen', 'adult'] as const).map(ag => (
                    <TouchableOpacity
                      key={ag}
                      onPress={() => setAgeGroup(ag)}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: ageGroup === ag ? `${colors.primary}20` : '#28231E',
                          borderColor: ageGroup === ag ? colors.primary : '#3C3530',
                        },
                      ]}
                    >
                      <Text style={[styles.chipText, { color: ageGroup === ag ? colors.primary : '#A8A29E' }]}>
                        {ag === 'teen' ? 'Under 18' : '18+'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          )}

          {step === 1 && (
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>How would you describe your reading?</Text>
              <Text style={[styles.stepSubtitle, { color: '#A8A29E' }]}>
                We'll adjust quiz difficulty to match your level.
              </Text>
              <View style={styles.optionsCol}>
                {READING_LEVELS.map(lvl => (
                  <TouchableOpacity
                    key={lvl}
                    onPress={() => setReadingLevel(lvl)}
                    style={[
                      styles.bigChip,
                      {
                        backgroundColor: readingLevel === lvl ? `${colors.primary}20` : '#28231E',
                        borderColor: readingLevel === lvl ? colors.primary : '#3C3530',
                      },
                    ]}
                  >
                    <Text style={[styles.bigChipTitle, { color: readingLevel === lvl ? colors.primary : '#FAF9F6' }]}>
                      {lvl.charAt(0).toUpperCase() + lvl.slice(1)}
                    </Text>
                    <Text style={[styles.bigChipSub, { color: '#78716C' }]}>
                      {lvl === 'beginner' ? 'I read occasionally'
                        : lvl === 'intermediate' ? 'I read a few books a year'
                        : 'I read regularly and widely'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {step === 2 && (
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Daily reading goal</Text>
              <Text style={[styles.stepSubtitle, { color: '#A8A29E' }]}>
                Even 10 minutes a day builds a powerful habit.
              </Text>
              <View style={styles.goalGrid}>
                {GOAL_OPTIONS.map(g => (
                  <TouchableOpacity
                    key={g}
                    onPress={() => setDailyGoal(g)}
                    style={[
                      styles.goalChip,
                      {
                        backgroundColor: dailyGoal === g ? `${colors.primary}20` : '#28231E',
                        borderColor: dailyGoal === g ? colors.primary : '#3C3530',
                      },
                    ]}
                  >
                    <Text style={[styles.goalMin, { color: dailyGoal === g ? colors.primary : '#FAF9F6' }]}>
                      {g}
                    </Text>
                    <Text style={[styles.goalLabel, { color: '#78716C' }]}>min</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {step === 3 && (
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>What do you enjoy reading?</Text>
              <Text style={[styles.stepSubtitle, { color: '#A8A29E' }]}>
                Optional — helps us understand you better.
              </Text>
              <View style={styles.interestGrid}>
                {INTERESTS.map(interest => (
                  <TouchableOpacity
                    key={interest}
                    onPress={() => toggleInterest(interest)}
                    style={[
                      styles.interestChip,
                      {
                        backgroundColor: interests.includes(interest) ? `${colors.primary}20` : '#28231E',
                        borderColor: interests.includes(interest) ? colors.primary : '#3C3530',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.interestText,
                        { color: interests.includes(interest) ? colors.primary : '#A8A29E' },
                      ]}
                    >
                      {interest}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </ScrollView>

        <View style={styles.footer}>
          {step > 0 && (
            <TouchableOpacity onPress={() => setStep(s => s - 1)} style={styles.backBtn}>
              <Feather name="arrow-left" size={20} color="#A8A29E" />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={handleNext}
            disabled={!canProceed}
            style={[
              styles.nextBtn,
              { backgroundColor: canProceed ? colors.primary : '#3C3530' },
              step > 0 && { flex: 1 },
            ]}
            activeOpacity={0.8}
          >
            <Text style={[styles.nextText, { color: canProceed ? '#FFF' : '#78716C' }]}>
              {step === totalSteps - 1 ? "Let's read" : 'Continue'}
            </Text>
            <Feather name={step === totalSteps - 1 ? 'check' : 'arrow-right'} size={18} color={canProceed ? '#FFF' : '#78716C'} />
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 24 },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 32 },
  dot: { height: 8, borderRadius: 4 },
  scrollContent: { flexGrow: 1 },
  stepContent: { flex: 1, gap: 24 },
  logoCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  heroTitle: { fontSize: 40, fontWeight: '700', color: '#FAF9F6', fontFamily: 'Inter_700Bold' },
  heroSubtitle: { fontSize: 16, lineHeight: 24, fontFamily: 'Inter_400Regular' },
  nameSection: { gap: 12 },
  label: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
  },
  ageRow: { flexDirection: 'row', gap: 10 },
  chip: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  chipText: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  stepTitle: { fontSize: 26, fontWeight: '700', color: '#FAF9F6', fontFamily: 'Inter_700Bold', lineHeight: 34 },
  stepSubtitle: { fontSize: 15, fontFamily: 'Inter_400Regular', lineHeight: 22, marginTop: -12 },
  optionsCol: { gap: 12 },
  bigChip: { borderRadius: 14, borderWidth: 1, padding: 18, gap: 4 },
  bigChipTitle: { fontSize: 17, fontFamily: 'Inter_600SemiBold' },
  bigChipSub: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  goalGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  goalChip: {
    width: '30%',
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 18,
    alignItems: 'center',
  },
  goalMin: { fontSize: 28, fontFamily: 'Inter_700Bold' },
  goalLabel: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  interestGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  interestChip: { borderRadius: 20, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 9 },
  interestText: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  footer: { flexDirection: 'row', gap: 12, paddingTop: 16 },
  backBtn: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: '#28231E',
    borderWidth: 1,
    borderColor: '#3C3530',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextBtn: {
    flex: 1,
    flexDirection: 'row',
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  nextText: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
});
