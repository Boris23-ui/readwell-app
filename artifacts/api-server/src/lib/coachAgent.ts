import { aiGateway } from './aiGateway';
import { logger } from './logger';
import {
  coachMemory,
  CoachProfile,
  StrategyDoc,
  EvolutionRecord,
  Flashcard,
  ReadingPlan,
  EngagementSignal,
} from './coachMemory';

const GOOGLE_BOOKS_API = 'https://www.googleapis.com/books/v1/volumes';

export interface ChatOptions {
  userId: string;
  message: string;
  bookContext?: {
    bookId?: string;
    title?: string;
    author?: string;
    chapter?: number;
    segmentText?: string;
  };
}

export interface ChatResult {
  reply: string;
  strategyVersion: number;
  agentName: string;
  intent: string;
  detectedSignal?: string;
  evolved?: boolean;
}

// ── Google Books API Helper ──────────────────────────────────────────────────

export async function searchGoogleBooks(query: string, maxResults = 5): Promise<any[]> {
  const apiKey = process.env.GOOGLE_BOOKS_API_KEY || process.env.GEMINI_API_KEY || '';
  const url = new URL(GOOGLE_BOOKS_API);
  url.searchParams.set('q', query);
  url.searchParams.set('maxResults', String(maxResults));
  url.searchParams.set('printType', 'books');
  if (apiKey) {
    url.searchParams.set('key', apiKey);
  }

  try {
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return [];
    const data = (await res.json()) as any;
    const items = data.items || [];
    return items.map((item: any) => {
      const info = item.volumeInfo || {};
      return {
        title: info.title || 'Unknown Title',
        authors: info.authors || ['Unknown Author'],
        description: (info.description || '').slice(0, 240),
        pageCount: info.pageCount || 0,
        categories: info.categories || [],
        averageRating: info.averageRating || null,
        thumbnail: info.imageLinks?.thumbnail || '',
      };
    });
  } catch (err) {
    logger.warn({ err, query }, 'Google Books search failed or timed out');
    return [];
  }
}

// ── Reading Plan & Pace Mathematics ──────────────────────────────────────────

export function calculateReadingPace(
  totalChaptersOrPages: number,
  availableMinutesPerDay: number,
  targetDays: number,
) {
  const unitsPerDay = Math.max(1, Math.ceil(totalChaptersOrPages / Math.max(1, targetDays)));
  // Heuristic: 1 chapter takes ~15 mins, or 1 page takes ~2 mins
  const estimatedMinutesPerSession = Math.round(unitsPerDay * 15);
  const feasible = estimatedMinutesPerSession <= availableMinutesPerDay * 1.25;

  return {
    unitsPerDay,
    estimatedMinutesPerSession,
    targetDays,
    feasible,
    recommendation: feasible
      ? `Read ${unitsPerDay} unit(s)/day (~${estimatedMinutesPerSession} min/session) to finish in ${targetDays} days.`
      : `This pace needs ~${estimatedMinutesPerSession} min/day, but you have ${availableMinutesPerDay} min/day. Consider extending to ${Math.ceil((totalChaptersOrPages * 15) / availableMinutesPerDay)} days.`,
  };
}

export async function createReadingPlan(
  userId: string,
  bookTitle: string,
  totalChapters: number,
  targetDays: number,
  availableMinutes = 20,
): Promise<ReadingPlan> {
  const chaptersPerDay = Math.max(1, Math.ceil(totalChapters / Math.max(1, targetDays)));
  const estimatedMinutesPerSession = Math.round(chaptersPerDay * 15);
  const feasible = estimatedMinutesPerSession <= availableMinutes * 1.25;

  const schedule: ReadingPlan['schedule'] = [];
  let current = 1;
  const now = new Date();

  for (let day = 1; day <= targetDays; day++) {
    const end = Math.min(current + chaptersPerDay - 1, totalChapters);
    const dateObj = new Date(now.getTime() + day * 86_400_000);
    schedule.push({
      day,
      date: dateObj.toISOString().split('T')[0],
      chapters: current === end ? `Ch. ${current}` : `Ch. ${current} - ${end}`,
      milestone: end === totalChapters,
    });
    current = end + 1;
    if (current > totalChapters) break;
  }

  const plan: ReadingPlan = {
    bookTitle,
    totalChapters,
    targetDays: schedule.length,
    chaptersPerDay,
    estimatedMinutesPerSession,
    feasible,
    schedule,
  };

  await coachMemory.saveReadingPlan(userId, plan);
  return plan;
}

// ── SM-2 Spaced Repetition Algorithm ─────────────────────────────────────────

export function applySm2(
  card: Flashcard,
  quality: number, // 0 to 5
): Flashcard {
  const q = Math.max(0, Math.min(5, quality));
  let ef = card.easeFactor || 2.5;
  ef = Math.max(1.3, ef + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));

  let intervalDays = 1;
  let repetitions = card.repetitions || 0;

  if (q < 3) {
    repetitions = 0;
    intervalDays = 1;
  } else {
    if (repetitions === 0) {
      intervalDays = 1;
    } else if (repetitions === 1) {
      intervalDays = 6;
    } else {
      intervalDays = Math.max(1, Math.round(card.intervalDays * ef));
    }
    repetitions += 1;
  }

  const nextReviewDate = new Date(Date.now() + intervalDays * 86_400_000);

  return {
    ...card,
    easeFactor: Number(ef.toFixed(2)),
    intervalDays,
    repetitions,
    nextReview: nextReviewDate.toISOString(),
  };
}

// ── Background Digest ("While You Were Away") ────────────────────────────────

export async function generateCoachDigest(userId: string): Promise<{
  digest: string;
  strategyVersion: number;
  streak: CoachProfile['streak'];
  daysAway: number;
}> {
  const profile = await coachMemory.getProfile(userId);
  const strategy = await coachMemory.getStrategy(userId);

  let daysAway = 0;
  try {
    const last = new Date(profile.lastActive).getTime();
    daysAway = Math.max(0, Math.floor((Date.now() - last) / (1000 * 60 * 60 * 24)));
  } catch {
    daysAway = 0;
  }

  if (daysAway < 1) {
    return {
      digest: "Welcome back! You were here recently. What are you reading today?",
      strategyVersion: strategy.version,
      streak: profile.streak,
      daysAway,
    };
  }

  const parts: string[] = [
    `Welcome back! It's been ${daysAway} day${daysAway > 1 ? 's' : ''} since your last reading session. Here is your coaching catch-up:`,
  ];

  if (strategy.evolutionHistory && strategy.evolutionHistory.length > 0) {
    const recent = strategy.evolutionHistory.slice(-2);
    parts.push('\n🔄 **Strategy Evolution:**');
    for (const ev of recent) {
      parts.push(`• v${ev.version}: ${ev.adjustmentMade}`);
    }
  }

  if (profile.activeBooks.length > 0) {
    const b = profile.activeBooks[0];
    const pct = b.totalChapters > 0 ? Math.round((b.currentChapter / b.totalChapters) * 100) : 0;
    parts.push(`\n📖 **Current Book:** '${b.title}' — Chapter ${b.currentChapter}/${b.totalChapters} (${pct}%)`);
  }

  if (profile.streak.currentStreak > 0) {
    parts.push(`\n🔥 **Streak:** ${profile.streak.currentStreak} day streak preserved. Read today to keep it burning!`);
  } else {
    parts.push('\n🔥 **Streak:** Ready to ignite a brand new streak today?');
  }

  const flashcards = await coachMemory.getFlashcards(userId);
  const nowIso = new Date().toISOString();
  const due = flashcards.filter(c => c.nextReview <= nowIso);
  if (due.length > 0) {
    parts.push(`\n🧠 **Spaced Repetition:** You have ${due.length} concept flashcard${due.length > 1 ? 's' : ''} due for review!`);
  }

  parts.push('\nReady to jump back in? Tell me what section you want to explore!');

  // Refresh last active
  profile.lastActive = new Date().toISOString();
  await coachMemory.saveProfile(profile);

  return {
    digest: parts.join('\n'),
    strategyVersion: strategy.version,
    streak: profile.streak,
    daysAway,
  };
}

// ── Explain Evolution Transparency Tool ──────────────────────────────────────

export async function explainCoachEvolution(userId: string): Promise<string> {
  const strategy = await coachMemory.getStrategy(userId);

  if (!strategy.evolutionHistory || strategy.evolutionHistory.length === 0) {
    return `I am currently operating at baseline strategy (v${strategy.version}): **${strategy.tone}**, difficulty **${(strategy.difficultyLevel * 10).toFixed(1)}/10**, using **${strategy.preferredQuestionStyle}**.\n\nAs we have more reading discussions, my meta-cognitive engine observes how you engage and evolves my questions to match your rhythm!`;
  }

  let text = `Here is how my coaching strategy has evolved for you (currently at **v${strategy.version}**):\n\n`;
  text += `• **Current Tone**: ${strategy.tone}\n`;
  text += `• **Pedagogical Difficulty**: ${(strategy.difficultyLevel * 10).toFixed(1)} / 10\n`;
  text += `• **Questioning Style**: ${strategy.preferredQuestionStyle}\n\n`;
  text += `**Evolution Timeline:**\n`;

  for (const ev of strategy.evolutionHistory.slice(-4)) {
    text += `- **v${ev.version}** (${ev.timestamp.slice(0, 10)}): Noticed *${ev.observation}*. Adjusted: *${ev.adjustmentMade}* (Expected: ${ev.expectedImpact})\n`;
  }

  if (strategy.effectiveTactics.length > 0) {
    text += `\n**What resonates with you:** ${strategy.effectiveTactics.slice(-3).join(', ')}`;
  }
  if (strategy.ineffectiveTactics.length > 0) {
    text += `\n**Techniques I've phased out:** ${strategy.ineffectiveTactics.slice(-2).join(', ')}`;
  }

  return text;
}

// ── Meta-Cognitive Self-Evolution Engine ──────────────────────────────────────

export async function triggerStrategyEvolution(
  userId: string,
  forceReason?: string,
): Promise<{ updated: boolean; strategy: StrategyDoc; record?: EvolutionRecord }> {
  const strategy = await coachMemory.getStrategy(userId);
  const transcripts = await coachMemory.getTranscripts(userId, 10);
  const profile = await coachMemory.getProfile(userId);

  if (transcripts.length < 3 && !forceReason) {
    return { updated: false, strategy };
  }

  // Analyze interaction signals
  const userMessages = transcripts.map(t => t.userMessage);
  const avgLength = userMessages.reduce((sum, m) => sum + m.length, 0) / Math.max(1, userMessages.length);
  const signals = profile.engagementSignals.slice(-10);

  let newDifficulty = strategy.difficultyLevel;
  let newTone = strategy.tone;
  let newQuestionStyle = strategy.preferredQuestionStyle;
  let observation = '';
  let adjustment = '';
  let expectedImpact = '';

  const enthusiasmCount = signals.filter(s => s.signalType === 'enthusiasm' || s.signalType === 'breakthrough').length;
  const confusionCount = signals.filter(s => s.signalType === 'confusion' || s.signalType === 'disengagement').length;

  if (avgLength > 100 || enthusiasmCount >= 2) {
    newDifficulty = Math.min(0.9, strategy.difficultyLevel + 0.1);
    newTone = 'Deep, intellectually provocative, analytical';
    newQuestionStyle = 'Open-ended philosophical and cross-thematic inquiry';
    observation = `Reader writes in-depth answers (avg ${Math.round(avgLength)} chars) and demonstrates high engagement.`;
    adjustment = 'Increased conceptual difficulty and introduced deeper thematic synthesis questions.';
    expectedImpact = 'Deeper analytical comprehension and richer critical thinking.';
  } else if (confusionCount >= 2 || avgLength < 25) {
    newDifficulty = Math.max(0.3, strategy.difficultyLevel - 0.1);
    newTone = 'Warm, accessible, conversational with scaffolding';
    newQuestionStyle = 'Concrete real-world analogies followed by personal connection';
    observation = `Reader responses are concise (avg ${Math.round(avgLength)} chars) or express occasional hesitation.`;
    adjustment = 'Scaffolded questions with relatable real-world analogies before theoretical questions.';
    expectedImpact = 'Reduced friction, higher conversational confidence, and clearer understanding.';
  } else {
    newDifficulty = Number((strategy.difficultyLevel + 0.02).toFixed(2));
    observation = `Consistent balanced dialogue across ${transcripts.length} exchanges.`;
    adjustment = 'Subtle calibration toward personal reflection and cross-book pattern recognition.';
    expectedImpact = 'Continued steady habit formation and thematic discovery.';
  }

  if (forceReason) {
    observation = `${observation} User requested manual review: ${forceReason}`;
  }

  const record: EvolutionRecord = {
    version: strategy.version + 1,
    timestamp: new Date().toISOString(),
    observation,
    adjustmentMade: adjustment,
    expectedImpact,
  };

  strategy.version += 1;
  strategy.lastUpdated = new Date().toISOString();
  strategy.difficultyLevel = Number(newDifficulty.toFixed(2));
  strategy.tone = newTone;
  strategy.preferredQuestionStyle = newQuestionStyle;
  strategy.evolutionHistory.push(record);

  await coachMemory.saveStrategy(userId, strategy);
  logger.info({ userId, version: strategy.version, adjustment }, 'Evolved coach strategy document');

  return { updated: true, strategy, record };
}

// ── Multi-Agent Socratic Chat Orchestrator ───────────────────────────────────

export async function chatWithCoach(options: ChatOptions): Promise<ChatResult> {
  const { userId, message, bookContext } = options;
  const profile = await coachMemory.getProfile(userId);
  const strategy = await coachMemory.getStrategy(userId);
  const recentTurns = await coachMemory.getTranscripts(userId, 3);

  const lower = message.toLowerCase().trim();

  // 1. Transparency check: "how did you change / why did you evolve"
  if (
    lower.includes('why did you change') ||
    lower.includes('how have you evolved') ||
    lower.includes('why do you ask differently') ||
    lower.includes('explain your strategy')
  ) {
    const reply = await explainCoachEvolution(userId);
    await coachMemory.saveTranscript(userId, {
      timestamp: new Date().toISOString(),
      userMessage: message,
      agentResponse: reply,
      agentName: 'evolution_engine',
      intent: 'explain_evolution',
    });
    return {
      reply,
      strategyVersion: strategy.version,
      agentName: 'evolution_engine',
      intent: 'explain_evolution',
    };
  }

  // 2. Digest check: "what happened while i was away / digest"
  if (lower.includes('while you were away') || lower.includes('give me a digest') || lower.includes('catch me up')) {
    const digestObj = await generateCoachDigest(userId);
    await coachMemory.saveTranscript(userId, {
      timestamp: new Date().toISOString(),
      userMessage: message,
      agentResponse: digestObj.digest,
      agentName: 'summary_agent',
      intent: 'digest',
    });
    return {
      reply: digestObj.digest,
      strategyVersion: strategy.version,
      agentName: 'summary_agent',
      intent: 'digest',
    };
  }

  // 3. Spaced repetition flashcard query: "review flashcards / due cards"
  if (lower.includes('flashcard') || lower.includes('vocabulary bank') || lower.includes('review cards')) {
    const cards = await coachMemory.getFlashcards(userId);
    const nowIso = new Date().toISOString();
    const due = cards.filter(c => c.nextReview <= nowIso);

    let reply = '';
    if (cards.length === 0) {
      reply = "You don't have any flashcards yet! When we discuss key vocabulary, concepts, or quotes in your books, I'll create spaced repetition flashcards for you to master.";
    } else if (due.length === 0) {
      reply = `All caught up! 🎉 You have ${cards.length} total flashcards in your deck, and none are due right now. Keep reading to add more!`;
    } else {
      reply = `You have **${due.length} flashcard(s)** ready for review!\n\n` +
        due.slice(0, 3).map((c, i) => `${i + 1}. **[${c.cardType.toUpperCase()}]** *${c.front}*\n   → Meaning: ${c.back} *(From '${c.bookTitle}')*`).join('\n\n') +
        `\n\nUse the Flashcards deck to rate your recall (Again, Hard, Good, Easy)!`;
    }

    await coachMemory.saveTranscript(userId, {
      timestamp: new Date().toISOString(),
      userMessage: message,
      agentResponse: reply,
      agentName: 'summary_agent',
      intent: 'flashcards',
    });
    return {
      reply,
      strategyVersion: strategy.version,
      agentName: 'summary_agent',
      intent: 'flashcards',
    };
  }

  // 4. Reading plan query: "plan / pace / schedule / fall behind"
  if (lower.includes('reading plan') || lower.includes('calculate pace') || lower.includes('schedule my reading')) {
    const bookTitle = bookContext?.title || profile.activeBooks[0]?.title || 'your current book';
    const plan = await createReadingPlan(userId, bookTitle, 12, 14, profile.availableMinutesPerDay);

    const reply = `Here is your customized reading plan for **'${bookTitle}'**:\n\n` +
      `• Goal: 12 chapters in 14 days (~${plan.chaptersPerDay} chapter/day)\n` +
      `• Estimated daily time: ~${plan.estimatedMinutesPerSession} minutes\n` +
      `• Pacing status: ${plan.feasible ? '✅ Fully feasible with your daily goal!' : '⚠️ Consider spreading across a few extra days'}\n\n` +
      `Remember: Life happens! If you miss a day, tell me and I'll adjust the schedule with zero guilt. Progress over perfection!`;

    await coachMemory.saveTranscript(userId, {
      timestamp: new Date().toISOString(),
      userMessage: message,
      agentResponse: reply,
      agentName: 'planner_agent',
      intent: 'plan',
    });
    return {
      reply,
      strategyVersion: strategy.version,
      agentName: 'planner_agent',
      intent: 'plan',
    };
  }

  // 5. Detect engagement signals for meta-learning
  let signalType: EngagementSignal['signalType'] = 'response_length';
  if (message.length > 120 || message.includes('!') || lower.includes('fascinating') || lower.includes('love this')) {
    signalType = 'enthusiasm';
  } else if (lower.includes("don't understand") || lower.includes('confused') || lower.includes('what does that mean')) {
    signalType = 'confusion';
  } else if (lower.includes('realize') || lower.includes('now i see') || lower.includes('connection') || lower.includes('eureka')) {
    signalType = 'breakthrough';
  } else if (message.length < 15 && (lower === 'ok' || lower === 'yes' || lower === 'no' || lower === 'sure')) {
    signalType = 'disengagement';
  }

  profile.engagementSignals.push({
    timestamp: new Date().toISOString(),
    signalType,
    value: `${message.length} chars`,
    context: message.slice(0, 50),
  });
  profile.engagementSignals = profile.engagementSignals.slice(-50);
  await coachMemory.saveProfile(profile);

  // 6. Gemini-powered Socratic Partner Response (via AIGateway)
  let replyText = '';
  let agentName = 'socratic_partner';
  let intent = 'socratic_dialogue';

  const bookTitle = bookContext?.title || 'your reading';

  // Compressed conversation history (3 turns max, truncated)
  const conversationHistory = recentTurns.map(t =>
    `User: ${t.userMessage.slice(0, 100)}\nCoach: ${t.agentResponse.slice(0, 150)}`
  ).join('\n');

  // Compressed system instruction (~250 chars vs previous ~528 chars)
  const systemInstruction = `You are ReadWell Coach, a Socratic reading companion (v${strategy.version}). Tone: ${strategy.tone}. Difficulty: ${strategy.difficultyLevel}. Style: ${strategy.preferredQuestionStyle}. Ask 1-2 sharp questions per reply. Never summarize — scaffold discovery. Under 100 words.`;

  // Compressed prompt — passage truncated to 800 chars (was 1500)
  const prompt = `${profile.name} reading ${bookContext?.title ? `"${bookContext.title}"` : 'a book'}${bookContext?.chapter ? ` ch.${bookContext.chapter}` : ''}
${bookContext?.segmentText ? `Passage: """${bookContext.segmentText.slice(0, 800)}"""\n` : ''}
${conversationHistory ? `History:\n${conversationHistory}\n` : ''}
User: ${message}
Coach:`;

  try {
    const result = await aiGateway.generate({
      purpose: 'coach',
      priority: 'standard',
      cacheTtlMs: 0, // Never cache chat responses
      prompt,
      systemInstruction,
      maxOutputTokens: 180, // Was 300; instruction says "under 100 words" ≈ 130 tokens
      temperature: 0.7,
      fallbackFn: () => {
        if (bookContext?.segmentText) {
          return `In this section of *${bookTitle}*, what particular idea or phrase stood out most to you? Why do you think the author chose to present it this way?`;
        }
        return `That's a thoughtful thought on *${bookTitle}*. How does that perspective connect with your personal experience, or does it challenge something you previously believed?`;
      },
    });

    replyText = result.text.trim();
    if (!replyText) {
      replyText = "What a fascinating aspect of this book. What question does this raise in your mind about where the story or argument is headed?";
    }
  } catch (err) {
    logger.error({ err }, 'Coach chat call failed, providing resilient fallback');
    replyText = `That's an intriguing angle on ${bookContext?.title ? `'${bookContext.title}'` : 'your reading'}. What do you think the deeper implication is for the main character or overarching argument?`;
  }

  // 7. Save transcript turn
  await coachMemory.saveTranscript(userId, {
    timestamp: new Date().toISOString(),
    userMessage: message,
    agentResponse: replyText,
    agentName,
    intent,
  });

  // 8. Auto-trigger evolution check every 5 turns
  let evolved = false;
  const updatedTurns = await coachMemory.getTranscripts(userId, 20);
  if (updatedTurns.length > 0 && updatedTurns.length % 5 === 0) {
    try {
      const evo = await triggerStrategyEvolution(userId);
      evolved = evo.updated;
    } catch (e) {
      logger.warn({ e }, 'Auto evolution check failed');
    }
  }

  // 9. Auto-capture flashcard if user asks about a vocabulary word or key definition
  if (lower.startsWith('what does') || lower.includes('definition of') || lower.includes('meaning of')) {
    const wordMatch = message.match(/(?:what does|meaning of|definition of)\s+["']?([a-zA-Z\s-]+)["']?/i);
    if (wordMatch && wordMatch[1] && wordMatch[1].trim().length < 30) {
      const cardWord = wordMatch[1].trim();
      await coachMemory.saveFlashcard(userId, {
        id: `card_${Date.now()}`,
        front: cardWord,
        back: replyText.slice(0, 120),
        bookTitle: bookContext?.title || 'Vocabulary',
        chapter: bookContext?.chapter || 1,
        cardType: 'vocabulary',
        createdAt: new Date().toISOString(),
        nextReview: new Date().toISOString(),
        intervalDays: 1,
        easeFactor: 2.5,
        repetitions: 0,
      });
    }
  }

  return {
    reply: replyText,
    strategyVersion: strategy.version,
    agentName,
    intent,
    detectedSignal: signalType,
    evolved,
  };
}
