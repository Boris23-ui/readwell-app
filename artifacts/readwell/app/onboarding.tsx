import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useApp } from '@/context/CloudAppContext';
import { useAuth } from '@/context/AuthContext';
import { UserProfile } from '@/types';

const READING_LEVELS = ['beginner', 'intermediate', 'advanced'] as const;
const GOAL_OPTIONS = [10, 15, 20, 30, 45, 60];
const INTERESTS = ['Fiction', 'Non-fiction', 'Science', 'History', 'Biography', 'Self-help', 'Fantasy', 'Mystery'];

export default function Onboarding() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { saveProfile, profile } = useApp();
  const { user } = useAuth();

  const [step, setStep] = useState(0);
  const [name, setName] = useState(profile.name || user?.displayName || '');
  const [isNameFocused, setIsNameFocused] = useState(false);
  const [ageGroup, setAgeGroup] = useState<'teen' | 'adult'>(profile.ageGroup || 'adult');
  const [readingLevel, setReadingLevel] = useState<'beginner' | 'intermediate' | 'advanced'>(
    profile.readingLevel || 'intermediate',
  );
  const [dailyGoal, setDailyGoal] = useState(profile.dailyGoalMinutes || 15);
  const [interests, setInterests] = useState<string[]>(profile.interests || []);

  const totalSteps = 4;

  const toggleInterest = (interest: string) => {
    setInterests((prev) =>
      prev.includes(interest) ? prev.filter((i) => i !== interest) : [...prev, interest],
    );
  };

  const handleNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (step < totalSteps - 1) {
      setStep((s) => s + 1);
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
      createdAt: profile.createdAt || new Date().toISOString(),
    };
    await saveProfile(newProfile);
    router.replace('/(tabs)');
  };

  const canProceed = step === 0 ? name.trim().length > 0 : true;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View
        style={[
          styles.container,
          {
            backgroundColor: colors.background,
            paddingTop: Platform.OS === 'web' ? 40 : insets.top + 20,
            paddingBottom: Platform.OS === 'web' ? 32 : insets.bottom + 20,
          },
        ]}
      >
        {/* Progress dots */}
        <View style={styles.dots}>
          {Array.from({ length: totalSteps }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                {
                  backgroundColor: i <= step ? colors.primary : colors.border,
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
              <View
                style={[
                  styles.logoCircle,
                  { backgroundColor: `${colors.primary}18`, borderColor: `${colors.primary}66` },
                ]}
              >
                <Feather name="book-open" size={38} color={colors.primary} />
              </View>
              <Text style={[styles.heroTitle, { color: colors.foreground }]}>
                Read<Text style={{ color: colors.primary }}>Well</Text>
              </Text>
              <Text style={[styles.heroSubtitle, { color: colors.mutedForeground }]}>
                Turn any book into a daily reading habit.{'\n'}Understand more. Remember more.
              </Text>
              <View style={styles.nameSection}>
                <Text style={[styles.label, { color: colors.foreground }]}>
                  What should we call you?
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: colors.card,
                      borderColor: isNameFocused ? colors.primary : colors.border,
                      color: colors.foreground,
                    },
                    Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : null,
                  ]}
                  placeholder="Your name"
                  placeholderTextColor={colors.mutedForeground}
                  value={name}
                  onChangeText={setName}
                  onFocus={() => setIsNameFocused(true)}
                  onBlur={() => setIsNameFocused(false)}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={canProceed ? handleNext : undefined}
                />
                <Text style={[styles.label, { color: colors.mutedForeground, marginTop: 4 }]}>
                  Age group
                </Text>
                <View style={styles.ageRow}>
                  {(['teen', 'adult'] as const).map((ag) => (
                    <TouchableOpacity
                      key={ag}
                      onPress={() => setAgeGroup(ag)}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: ageGroup === ag ? `${colors.primary}18` : colors.card,
                          borderColor: ageGroup === ag ? colors.primary : colors.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          { color: ageGroup === ag ? colors.primary : colors.mutedForeground },
                        ]}
                      >
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
              <Text style={[styles.stepTitle, { color: colors.foreground }]}>
                How would you describe your reading?
              </Text>
              <Text style={[styles.stepSubtitle, { color: colors.mutedForeground }]}>
                We'll tune quiz questions and vocabulary checks to match your pace.
              </Text>
              <View style={styles.optionsCol}>
                {READING_LEVELS.map((lvl) => (
                  <TouchableOpacity
                    key={lvl}
                    onPress={() => setReadingLevel(lvl)}
                    style={[
                      styles.bigChip,
                      {
                        backgroundColor: readingLevel === lvl ? `${colors.primary}15` : colors.card,
                        borderColor: readingLevel === lvl ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.bigChipTitle,
                        { color: readingLevel === lvl ? colors.primary : colors.foreground },
                      ]}
                    >
                      {lvl.charAt(0).toUpperCase() + lvl.slice(1)}
                    </Text>
                    <Text style={[styles.bigChipSub, { color: colors.mutedForeground }]}>
                      {lvl === 'beginner'
                        ? 'I read occasionally and want clear, approachable checks'
                        : lvl === 'intermediate'
                        ? 'I read a few books a year and enjoy thoughtful questions'
                        : 'I read regularly and want deeper inference and nuance'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {step === 2 && (
            <View style={styles.stepContent}>
              <Text style={[styles.stepTitle, { color: colors.foreground }]}>
                Set your daily reading goal
              </Text>
              <Text style={[styles.stepSubtitle, { color: colors.mutedForeground }]}>
                Even 10 minutes a day builds a lasting reading habit. You can change this anytime.
              </Text>
              <View style={styles.goalGrid}>
                {GOAL_OPTIONS.map((g) => (
                  <TouchableOpacity
                    key={g}
                    onPress={() => setDailyGoal(g)}
                    style={[
                      styles.goalChip,
                      {
                        backgroundColor: dailyGoal === g ? `${colors.honey}33` : colors.card,
                        borderColor: dailyGoal === g ? colors.honeyDeep : colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.goalMin,
                        { color: dailyGoal === g ? colors.honeyDeep : colors.foreground },
                      ]}
                    >
                      {g}
                    </Text>
                    <Text style={[styles.goalLabel, { color: colors.mutedForeground }]}>min</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {step === 3 && (
            <View style={styles.stepContent}>
              <Text style={[styles.stepTitle, { color: colors.foreground }]}>
                What do you enjoy reading?
              </Text>
              <Text style={[styles.stepSubtitle, { color: colors.mutedForeground }]}>
                Optional — helps your Reading Coach personalize conversations.
              </Text>
              <View style={styles.interestGrid}>
                {INTERESTS.map((interest) => (
                  <TouchableOpacity
                    key={interest}
                    onPress={() => toggleInterest(interest)}
                    style={[
                      styles.interestChip,
                      {
                        backgroundColor: interests.includes(interest)
                          ? `${colors.primary}18`
                          : colors.card,
                        borderColor: interests.includes(interest)
                          ? colors.primary
                          : colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.interestText,
                        {
                          color: interests.includes(interest)
                            ? colors.primary
                            : colors.foreground,
                        },
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
            <TouchableOpacity
              onPress={() => setStep((s) => s - 1)}
              style={[
                styles.backBtn,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <Feather name="arrow-left" size={20} color={colors.foreground} />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={handleNext}
            disabled={!canProceed}
            style={[
              styles.nextBtn,
              { backgroundColor: canProceed ? colors.honey : colors.muted },
              step > 0 && { flex: 1 },
            ]}
            activeOpacity={0.85}
          >
            <Text style={[styles.nextText, { color: canProceed ? '#1F1C18' : colors.mutedForeground }]}>
              {step === totalSteps - 1 ? 'Start Reading' : 'Continue'}
            </Text>
            <Feather
              name={step === totalSteps - 1 ? 'check' : 'arrow-right'}
              size={18}
              color={canProceed ? '#1F1C18' : colors.mutedForeground}
            />
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 24, maxWidth: 640, width: '100%', alignSelf: 'center' },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 28 },
  dot: { height: 8, borderRadius: 4 },
  scrollContent: { flexGrow: 1 },
  stepContent: { flex: 1, gap: 20 },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 24,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  heroTitle: { fontSize: 38, fontFamily: 'Newsreader_700Bold' },
  heroSubtitle: { fontSize: 16, lineHeight: 24, fontFamily: 'Inter_400Regular' },
  nameSection: { gap: 12 },
  label: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  input: {
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
  },
  ageRow: { flexDirection: 'row', gap: 10 },
  chip: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  chipText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  stepTitle: { fontSize: 26, fontFamily: 'Newsreader_700Bold', lineHeight: 34 },
  stepSubtitle: { fontSize: 15, fontFamily: 'Inter_400Regular', lineHeight: 22, marginTop: -8 },
  optionsCol: { gap: 12 },
  bigChip: { borderRadius: 16, borderWidth: 1.5, padding: 18, gap: 4 },
  bigChipTitle: { fontSize: 17, fontFamily: 'Inter_600SemiBold' },
  bigChipSub: { fontSize: 13.5, fontFamily: 'Inter_400Regular', lineHeight: 19 },
  goalGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  goalChip: {
    width: '30%',
    borderRadius: 16,
    borderWidth: 1.5,
    paddingVertical: 18,
    alignItems: 'center',
  },
  goalMin: { fontSize: 28, fontFamily: 'Newsreader_700Bold' },
  goalLabel: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  interestGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  interestChip: { borderRadius: 20, borderWidth: 1.5, paddingHorizontal: 16, paddingVertical: 10 },
  interestText: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  footer: { flexDirection: 'row', gap: 12, paddingTop: 16 },
  backBtn: {
    width: 52,
    height: 52,
    borderRadius: 14,
    borderWidth: 1.5,
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
  nextText: { fontSize: 16, fontFamily: 'Inter_700Bold' },
});
