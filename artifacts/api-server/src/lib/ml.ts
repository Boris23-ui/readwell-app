import { VertexAI, SchemaType } from '@google-cloud/vertexai';
import { logger } from './logger';

export interface ReadingMetrics {
  elo: number;
  secondsRead: number;
  wordCount: number;
  complexity: number;
  readingLevel: string;
}

export interface MLInsight {
  predictedComprehension: number; // 0.0 to 1.0
  recommendedComplexityAdjust: number; // -1.0 to 1.0
  promptGuidance: string;
}

// In production, configure with the correct GCP project ID and location.
// The VertexAI client uses Application Default Credentials (ADC).
let vertexAiClient: VertexAI | null = null;
try {
  vertexAiClient = new VertexAI({
    project: process.env.GOOGLE_CLOUD_PROJECT || 'my-project-id',
    location: process.env.GOOGLE_CLOUD_LOCATION || 'us-central1',
  });
} catch (e) {
  logger.warn({ err: e }, 'Failed to initialize Vertex AI client. ML predictions will fallback to defaults.');
}

export async function evaluateComprehension(metrics: ReadingMetrics): Promise<MLInsight> {
  const defaultOutput = {
    predictedComprehension: 0.7,
    recommendedComplexityAdjust: 0.0,
    promptGuidance: "ML Insight fallback: Maintain the current level of difficulty.",
  };

  if (!vertexAiClient) {
    return defaultOutput;
  }

  try {
    const generativeModel = vertexAiClient.getGenerativeModel({
      model: 'gemini-1.5-flash',
      systemInstruction: {
        role: 'system',
        parts: [{ text: "You are an expert reading telemetry analyzer. Analyze the student reading metrics." }]
      },
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            predictedComprehension: { type: SchemaType.NUMBER, description: 'estimated comprehension from 0.0 to 1.0' },
            recommendedComplexityAdjust: { type: SchemaType.NUMBER, description: '-1.0 to 1.0 (-1=much easier, 0=same, 1=much harder)' }
          }
        },
        maxOutputTokens: 100,
      },
    });

    const wpm = metrics.secondsRead > 0 ? (metrics.wordCount / metrics.secondsRead) * 60 : 0;
    
    const prompt = `Student Metrics:
- ELO Score (0-5000): ${metrics.elo}
- Reading Speed (WPM): ${wpm.toFixed(0)}
- Text Complexity Index (1.0 - 5.0): ${metrics.complexity}
- Target Reading Level: ${metrics.readingLevel}`;

    const resp = await generativeModel.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });
    
    if (!resp.response.candidates?.[0]?.content?.parts?.[0]?.text) {
      throw new Error('Empty response from Vertex AI');
    }

    const text = resp.response.candidates[0].content.parts[0].text;
    const parsed = JSON.parse(text);
    
    const comp = Number(parsed.predictedComprehension);
    const adjust = Number(parsed.recommendedComplexityAdjust);

    let guidance = `ML Insight: The Vertex AI model predicts a user comprehension rate of ${(comp * 100).toFixed(0)}%. `;
    if (adjust > 0.3) {
      guidance += "The user is finding this easy. Make the inference and vocabulary questions slightly more challenging.";
    } else if (adjust < -0.3) {
      guidance += "The user might be struggling with the complexity or skimming too fast. Keep the questions highly focused on core recall facts, and simplify the vocabulary.";
    } else {
      guidance += "The user is in the optimal learning zone. Maintain the current level of difficulty.";
    }

    return {
      predictedComprehension: isNaN(comp) ? defaultOutput.predictedComprehension : Math.max(0, Math.min(1, comp)),
      recommendedComplexityAdjust: isNaN(adjust) ? defaultOutput.recommendedComplexityAdjust : Math.max(-1, Math.min(1, adjust)),
      promptGuidance: guidance,
    };
    } catch (error) {
    logger.error({ err: error }, 'Vertex AI prediction failed, using fallback');
    return defaultOutput;
  }
}

export interface RecommendationRequest {
  elo: number;
  readingLevel: string;
  interests: string[];
  recentTopics: string[];
}

export interface RecommendedContent {
  title: string;
  topic: string;
  reason: string;
  estimatedComplexity: number;
}

export async function generateContentRecommendations(req: RecommendationRequest): Promise<RecommendedContent[]> {
  const fallback = [
    {
      title: "The History of Space Exploration",
      topic: "Science",
      reason: "Matches your interest in technology and fits your reading level.",
      estimatedComplexity: 2.5,
    },
    {
      title: "Introduction to Financial Literacy",
      topic: "Finance",
      reason: "A great next step to build your foundational knowledge.",
      estimatedComplexity: 2.8,
    }
  ];

  if (!vertexAiClient) {
    return fallback;
  }

  try {
    const generativeModel = vertexAiClient.getGenerativeModel({
      model: 'gemini-1.5-flash',
      systemInstruction: {
        role: 'system',
        parts: [{ text: "You are an AI reading tutor and content recommender. Based on the student's profile, recommend exactly 3 specific book topics, articles, or reading areas that will help them improve their reading comprehension while staying engaged." }]
      },
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.OBJECT,
            properties: {
              title: { type: SchemaType.STRING, description: 'A catchy, descriptive title for the recommended reading' },
              topic: { type: SchemaType.STRING, description: 'The general subject area' },
              reason: { type: SchemaType.STRING, description: 'Why this is recommended for their specific ELO and interests' },
              estimatedComplexity: { type: SchemaType.NUMBER, description: 'Complexity number from 1.0 to 5.0' },
            }
          }
        },
        maxOutputTokens: 600,
      },
    });

    const prompt = `Student Profile:
- ELO Score (0-5000): ${req.elo}
- Target Reading Level: ${req.readingLevel}
- Expressed Interests: ${req.interests.join(", ") || "General knowledge"}
- Recently Read Topics: ${req.recentTopics.join(", ") || "None"}`;

    const resp = await generativeModel.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });

    if (!resp.response.candidates?.[0]?.content?.parts?.[0]?.text) {
      throw new Error('Empty response from Vertex AI');
    }

    const text = resp.response.candidates[0].content.parts[0].text;
    const parsed = JSON.parse(text);

    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map((item: any) => ({
        title: String(item.title || "Recommended Reading"),
        topic: String(item.topic || "General"),
        reason: String(item.reason || "Recommended for your reading level."),
        estimatedComplexity: Number(item.estimatedComplexity) || 2.5,
      }));
    }
    return fallback;
  } catch (error) {
    logger.error({ err: error }, 'Vertex AI recommendation failed, using fallback');
    return fallback;
  }
}
