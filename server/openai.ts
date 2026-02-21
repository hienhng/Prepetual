import OpenAI from "openai";
import pLimit from "p-limit";
import pRetry from "p-retry";
import type { Question, QuestionType, DifficultyLevel, QuizCategory } from "@shared/schema";
import { QUIZ_CATEGORIES } from "@shared/schema";
import { randomUUID } from "crypto";

const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
});

function isRateLimitError(error: any): boolean {
  const errorMsg = error?.message || String(error);
  return (
    errorMsg.includes("429") ||
    errorMsg.includes("RATELIMIT_EXCEEDED") ||
    errorMsg.toLowerCase().includes("quota") ||
    errorMsg.toLowerCase().includes("rate limit")
  );
}

export type ProgressCallback = (step: string, progress: number, message: string) => void;

const SI_UNIT_NORMALIZATION_INSTRUCTIONS = `
SI UNIT NORMALIZATION (MANDATORY for physics/math/science questions with units):
When your computed answer has units, you MUST normalize to SI base units BEFORE comparing against options:
- Mass: convert to kilograms (kg). 1g = 0.001kg, 50g = 0.05kg, 1mg = 0.000001kg
- Time: convert to seconds (s). 1min = 60s, 1h = 3600s, 1ms = 0.001s
- Length: convert to meters (m). 1cm = 0.01m, 1mm = 0.001m, 1km = 1000m
- Area: convert to m². 1cm² = 0.0001m²
- Volume: convert to m³. 1L = 0.001m³, 1mL = 0.000001m³, 1cm³ = 0.000001m³
- Speed: convert to m/s. 1km/h = 1/3.6 m/s
- Energy: convert to joules (J). 1kJ = 1000J, 1cal = 4.184J
- Force: convert to newtons (N). 1kN = 1000N
- Pressure: convert to pascals (Pa). 1atm = 101325Pa, 1bar = 100000Pa
- Temperature: keep in Kelvin or Celsius as given (do not convert between them)

COMPARISON PROCESS:
1. Compute your answer and convert to SI units → this is your "SI result"
2. For EACH option, convert its value to the SAME SI unit → each option's "SI value"
3. Compare each option's SI value against your SI result numerically (treat comma and period as equivalent decimal separators: 0,05 = 0.05)
4. The option whose SI value matches your SI result is the correct one
5. Example: Your result = 0.05 kg. Options: "0,05kg" → 0.05kg ✓, "5g" → 0.005kg ✗, "0,05g" → 0.00005kg ✗, "5kg" → 5kg ✗. Answer = option with "0,05kg"
`;

const SI_CONVERSION_TABLE: Record<string, { factor: number; siUnit: string }> = {
  'kg': { factor: 1, siUnit: 'kg' },
  'g': { factor: 0.001, siUnit: 'kg' },
  'mg': { factor: 0.000001, siUnit: 'kg' },
  'tấn': { factor: 1000, siUnit: 'kg' },
  'ton': { factor: 1000, siUnit: 'kg' },
  't': { factor: 1000, siUnit: 'kg' },

  'm': { factor: 1, siUnit: 'm' },
  'cm': { factor: 0.01, siUnit: 'm' },
  'mm': { factor: 0.001, siUnit: 'm' },
  'km': { factor: 1000, siUnit: 'm' },
  'dm': { factor: 0.1, siUnit: 'm' },

  's': { factor: 1, siUnit: 's' },
  'ms': { factor: 0.001, siUnit: 's' },
  'min': { factor: 60, siUnit: 's' },
  'h': { factor: 3600, siUnit: 's' },

  'm²': { factor: 1, siUnit: 'm²' },
  'cm²': { factor: 0.0001, siUnit: 'm²' },
  'dm²': { factor: 0.01, siUnit: 'm²' },
  'km²': { factor: 1000000, siUnit: 'm²' },
  'm2': { factor: 1, siUnit: 'm²' },
  'cm2': { factor: 0.0001, siUnit: 'm²' },

  'm³': { factor: 1, siUnit: 'm³' },
  'cm³': { factor: 0.000001, siUnit: 'm³' },
  'dm³': { factor: 0.001, siUnit: 'm³' },
  'l': { factor: 0.001, siUnit: 'm³' },
  'ml': { factor: 0.000001, siUnit: 'm³' },
  'm3': { factor: 1, siUnit: 'm³' },
  'cm3': { factor: 0.000001, siUnit: 'm³' },

  'm/s': { factor: 1, siUnit: 'm/s' },
  'km/h': { factor: 1 / 3.6, siUnit: 'm/s' },
  'cm/s': { factor: 0.01, siUnit: 'm/s' },

  'j': { factor: 1, siUnit: 'J' },
  'kj': { factor: 1000, siUnit: 'J' },
  'mj': { factor: 1000000, siUnit: 'J' },
  'cal': { factor: 4.184, siUnit: 'J' },
  'kcal': { factor: 4184, siUnit: 'J' },

  'n': { factor: 1, siUnit: 'N' },
  'kn': { factor: 1000, siUnit: 'N' },

  'pa': { factor: 1, siUnit: 'Pa' },
  'kpa': { factor: 1000, siUnit: 'Pa' },
  'mpa': { factor: 1000000, siUnit: 'Pa' },
  'atm': { factor: 101325, siUnit: 'Pa' },
  'bar': { factor: 100000, siUnit: 'Pa' },

  'hz': { factor: 1, siUnit: 'Hz' },
  'khz': { factor: 1000, siUnit: 'Hz' },
  'mhz': { factor: 1000000, siUnit: 'Hz' },

  'v': { factor: 1, siUnit: 'V' },
  'kv': { factor: 1000, siUnit: 'V' },
  'mv': { factor: 0.001, siUnit: 'V' },

  'a': { factor: 1, siUnit: 'A' },
  'ma': { factor: 0.001, siUnit: 'A' },

  'ω': { factor: 1, siUnit: 'Ω' },
  'ohm': { factor: 1, siUnit: 'Ω' },
  'kω': { factor: 1000, siUnit: 'Ω' },
  'kohm': { factor: 1000, siUnit: 'Ω' },

  'w': { factor: 1, siUnit: 'W' },
  'kw': { factor: 1000, siUnit: 'W' },
  'mw': { factor: 0.001, siUnit: 'W' },

  'rad/s': { factor: 1, siUnit: 'rad/s' },
};

function parseNumericWithUnit(text: string): { value: number; unit: string; siValue: number; siUnit: string } | null {
  const cleaned = text.trim()
    .replace(/^[A-Da-d]\)\s*/, '')
    .replace(/\s*\(.*?\)\s*$/, '')
    .replace(/\s+/g, '');

  const match = cleaned.match(/^([+-]?\d+(?:[.,]\d+)?(?:[eE][+-]?\d+)?)\s*(.+)$/);
  if (!match) return null;

  const numStr = match[1].replace(',', '.');
  const value = parseFloat(numStr);
  if (isNaN(value)) return null;

  const unitRaw = match[2].trim();
  const unitLower = unitRaw.toLowerCase();

  const conversion = SI_CONVERSION_TABLE[unitLower] || SI_CONVERSION_TABLE[unitRaw];
  if (!conversion) return null;

  return {
    value,
    unit: unitRaw,
    siValue: value * conversion.factor,
    siUnit: conversion.siUnit,
  };
}

function codeSelectNumericAnswer(
  aiComputedAnswer: string,
  options: string[],
  currentCorrectAnswer: string
): { selectedAnswer: string; wasChanged: boolean } | null {
  if (!options || options.length === 0) return null;

  const parsedAiAnswer = parseNumericWithUnit(aiComputedAnswer);
  
  const parsedCurrentAnswer = parseNumericWithUnit(currentCorrectAnswer);

  const parsedOptions = options.map(opt => ({
    text: opt,
    parsed: parseNumericWithUnit(opt),
  }));

  const numericOptions = parsedOptions.filter(o => o.parsed !== null);
  if (numericOptions.length < 2) return null;

  const answerParsed = parsedAiAnswer || parsedCurrentAnswer;
  if (!answerParsed) return null;

  const answerSiValue = answerParsed.siValue;
  const answerSiUnit = answerParsed.siUnit;

  console.log(`[CODE SELECT] AI answer: "${aiComputedAnswer}" → ${answerParsed.value} ${answerParsed.unit} → SI: ${answerSiValue} ${answerSiUnit}`);
  for (const opt of numericOptions) {
    console.log(`[CODE SELECT]   Option "${opt.text}" → ${opt.parsed!.value} ${opt.parsed!.unit} → SI: ${opt.parsed!.siValue} ${opt.parsed!.siUnit}`);
  }

  const TOLERANCE = 1e-4;
  let bestMatch: string | null = null;
  let bestDiff = Infinity;

  for (const opt of numericOptions) {
    if (opt.parsed!.siUnit !== answerSiUnit) continue;
    const diff = Math.abs(opt.parsed!.siValue - answerSiValue);
    const relativeDiff = answerSiValue !== 0 ? diff / Math.abs(answerSiValue) : diff;

    if (relativeDiff < TOLERANCE && relativeDiff < bestDiff) {
      bestDiff = relativeDiff;
      bestMatch = opt.text;
    }
  }

  if (bestMatch) {
    const wasChanged = bestMatch !== currentCorrectAnswer;
    if (wasChanged) {
      console.log(`[CODE SELECT] CORRECTED: "${currentCorrectAnswer}" → "${bestMatch}" (SI match: ${answerSiValue} ${answerSiUnit})`);
    } else {
      console.log(`[CODE SELECT] CONFIRMED: "${currentCorrectAnswer}" (SI match: ${answerSiValue} ${answerSiUnit})`);
    }
    return { selectedAnswer: bestMatch, wasChanged };
  }

  return null;
}

async function generateExplanationForAnswer(
  question: string,
  options: string[],
  correctAnswer: string,
  correctIndex: number,
): Promise<{ explanation: string; wrongAnswerExplanations: Record<string, string> } | null> {
  try {
    const numberedOptions = options.map((opt, i) => `  Option ${i}: "${opt}"`).join("\n");
    const prompt = `You are an expert educator. A quiz question has been answered by deterministic code. Your job is ONLY to write the explanation — do NOT change the answer.

Question: ${question}
Options:
${numberedOptions}

The CORRECT answer is Option ${correctIndex}: "${correctAnswer}"
DO NOT question or change this answer. Just explain WHY it is correct.

INSTRUCTIONS:
- Write in the SAME language as the question
- For math/science: show the full step-by-step calculation that leads to "${correctAnswer}"
- For each wrong option, explain what specific error or misconception would lead to that value
- Keep explanations clear and educational

Respond in JSON:
{
  "explanation": "Step-by-step explanation of why the correct answer is right",
  "wrongAnswerExplanations": {
    "wrong option text": "why this is incorrect"
  }
}`;

    const completion = await pRetry(
      async () => {
        const result = await openai.chat.completions.create({
          model: "openai/gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.2,
          max_tokens: 2000,
          response_format: { type: "json_object" },
        });
        return result.choices[0]?.message?.content || "";
      },
      { retries: 2, minTimeout: 1000 }
    );

    const parsed = JSON.parse(completion);
    if (!parsed.explanation) return null;

    const wrongAnswerExplanations: Record<string, string> = {};
    if (parsed.wrongAnswerExplanations) {
      for (const [key, value] of Object.entries(parsed.wrongAnswerExplanations)) {
        if (typeof value === "string") {
          wrongAnswerExplanations[String(key).trim()] = String(value).trim();
        }
      }
    }

    return {
      explanation: parsed.explanation,
      wrongAnswerExplanations,
    };
  } catch (error) {
    console.warn("[EXPLAIN] Failed to generate explanation for code-selected answer:", error);
    return null;
  }
}

function hasNumericOptions(options: string[]): boolean {
  const numericCount = options.filter(opt => parseNumericWithUnit(opt) !== null).length;
  return numericCount >= 2;
}

async function codeSelectNumericAnswersFromGeneration(mcQuestions: any[], logPrefix: string = "[CODE-SELECT]"): Promise<void> {
  if (mcQuestions.length === 0) return;

  const questionsNeedingExplanation: Array<{ q: any; correctIndex: number }> = [];

  for (const q of mcQuestions) {
    if (!q.correctAnswer || !Array.isArray(q.options) || q.options.length === 0) continue;

    const options = q.options.map((o: any) => String(o).trim());
    const aiComputedValue = q.computedValue ? String(q.computedValue).trim() : "";

    const parsedOptions = options.map((opt: string) => ({
      text: opt,
      parsed: parseNumericWithUnit(opt),
    }));
    const numericOpts = parsedOptions.filter((o: any) => o.parsed !== null);

    if (numericOpts.length < 2) {
      console.log(`${logPrefix} Skipping "${String(q.question).substring(0, 50)}..." — not enough parseable numeric options`);
      continue;
    }

    console.log(`${logPrefix} Options with SI values for "${String(q.question).substring(0, 60)}...":`);
    for (const opt of parsedOptions) {
      if (opt.parsed) {
        console.log(`${logPrefix}   "${opt.text}" → ${opt.parsed.value} ${opt.parsed.unit} → SI: ${opt.parsed.siValue} ${opt.parsed.siUnit}`);
      } else {
        console.log(`${logPrefix}   "${opt.text}" → (not parseable)`);
      }
    }

    let targetParsed = aiComputedValue ? parseNumericWithUnit(aiComputedValue) : null;

    if (!targetParsed) {
      const currentAnswer = String(q.correctAnswer).trim();
      targetParsed = parseNumericWithUnit(currentAnswer);
      if (targetParsed) {
        console.log(`${logPrefix} No parseable computedValue "${aiComputedValue}", using AI's selected answer "${currentAnswer}" → SI: ${targetParsed.siValue} ${targetParsed.siUnit}`);
      }
    } else {
      console.log(`${logPrefix} AI computedValue: "${aiComputedValue}" → ${targetParsed.value} ${targetParsed.unit} → SI: ${targetParsed.siValue} ${targetParsed.siUnit}`);
    }

    if (!targetParsed) {
      console.warn(`${logPrefix} WARNING: Could not parse any numeric target for "${String(q.question).substring(0, 60)}..." — keeping AI selection`);
      continue;
    }

    const TOLERANCE = 1e-4;
    let bestMatch: string | null = null;
    let bestDiff = Infinity;

    for (const opt of numericOpts) {
      if (opt.parsed!.siUnit !== targetParsed.siUnit) continue;
      const diff = Math.abs(opt.parsed!.siValue - targetParsed.siValue);
      const relativeDiff = targetParsed.siValue !== 0 ? diff / Math.abs(targetParsed.siValue) : diff;

      if (relativeDiff < TOLERANCE && relativeDiff < bestDiff) {
        bestDiff = relativeDiff;
        bestMatch = opt.text;
      }
    }

    if (bestMatch) {
      const currentAnswer = String(q.correctAnswer).trim();
      if (bestMatch !== currentAnswer) {
        console.log(`${logPrefix} CODE SELECTED: "${bestMatch}" (overriding AI's "${currentAnswer}") for: "${String(q.question).substring(0, 60)}..."`);
      } else {
        console.log(`${logPrefix} CODE CONFIRMED: "${bestMatch}" matches AI's selection`);
      }
      q.correctAnswer = bestMatch;
      const idx = options.indexOf(bestMatch);
      if (idx !== -1) {
        questionsNeedingExplanation.push({ q, correctIndex: idx });
      }
    } else {
      console.warn(`${logPrefix} WARNING: No SI match found among options for target ${targetParsed.siValue} ${targetParsed.siUnit} — keeping AI selection "${q.correctAnswer}"`);
    }
  }

  if (questionsNeedingExplanation.length > 0) {
    console.log(`${logPrefix} Generating explanations for ${questionsNeedingExplanation.length} code-selected numeric answers...`);
    const explanationLimit = pLimit(3);
    await Promise.all(
      questionsNeedingExplanation.map(({ q, correctIndex }) =>
        explanationLimit(async () => {
          const result = await generateExplanationForAnswer(
            String(q.question),
            q.options.map((o: any) => String(o)),
            String(q.correctAnswer),
            correctIndex,
          );
          if (result) {
            q.explanation = result.explanation;
            q.wrongAnswerExplanations = result.wrongAnswerExplanations;
            console.log(`${logPrefix} Explanation generated for code-selected answer "${q.correctAnswer}"`);
          }
        })
      )
    );
  }

  for (const q of mcQuestions) {
    delete q.computedValue;
  }
}

export type ImageClassification = {
  url: string;
  hasIllustrations: boolean;
  description?: string;
};

export async function classifyImages(
  imageUrls: string[],
  onProgress?: ProgressCallback,
  isImageOnlyMode: boolean = false
): Promise<ImageClassification[]> {
  if (imageUrls.length === 0) {
    return [];
  }

  onProgress?.("classifying", 15, "Analyzing image content types...");

  const classificationPrompt = `Analyze each of the following images and classify them.

For EACH image, determine if it contains:
- ILLUSTRATIONS: Charts, graphs, diagrams, drawings, photographs, figures, scientific illustrations, maps, flowcharts, or any visual/graphical content beyond just text
- TEXT-ONLY: Pages that contain ONLY text content (typed or handwritten text, worksheets with just text questions, text documents, notes)

OUTPUT FORMAT (JSON):
{
  "images": [
    {
      "index": 0,
      "hasIllustrations": true or false,
      "description": "Brief description of what the image contains"
    }
  ]
}

Be strict: If an image contains ANY diagrams, charts, graphs, figures, drawings, or visual elements (other than decorative borders), classify it as having illustrations.
Only classify as text-only if the image is purely text content with no visual/graphical elements.

Respond with ONLY valid JSON, no markdown or additional text.`;

  try {
    // Match the 6-image limit used in question generation to ensure consistent classification
    const imagesToClassify = imageUrls.slice(0, 6);
    const imageContent = imagesToClassify.map(imageUrl => ({
      type: "image_url" as const,
      image_url: { url: imageUrl, detail: "low" as const }
    }));

    const response = await pRetry(
      async () => {
        const completion = await openai.chat.completions.create({
          model: "gpt-4.1",
          messages: [{
            role: "user",
            content: [
              { type: "text", text: classificationPrompt },
              ...imageContent
            ]
          }],
          response_format: { type: "json_object" },
          max_completion_tokens: 2000,
        });

        const content = completion.choices[0]?.message?.content;
        if (!content) {
          throw new Error("Empty response from AI for image classification");
        }
        return content;
      },
      {
        retries: 2,
        minTimeout: 2000,
        maxTimeout: 10000,
        onFailedAttempt: (error: any) => {
          console.log(`Image classification retry (attempt ${error.attemptNumber}): ${error.message || error}`);
          if (!isRateLimitError(error)) {
            throw error;
          }
        },
      }
    );

    const parsed = JSON.parse(response);
    
    if (!parsed.images || !Array.isArray(parsed.images)) {
      // Fallback behavior depends on mode:
      // - Image-only mode: treat as text-only (conservative, won't embed but will analyze)
      // - Mixed mode: treat as illustrations (include all, fallback to previous behavior)
      console.warn(`Invalid classification response, defaulting to ${isImageOnlyMode ? 'text-only' : 'illustrations'}`);
      return imageUrls.slice(0, 6).map(url => ({ url, hasIllustrations: !isImageOnlyMode }));
    }

    // Only classify the first 6 images (matches the generation limit)
    const classifiedUrls = imageUrls.slice(0, 6);
    const results: ImageClassification[] = classifiedUrls.map((url, index) => {
      const classification = parsed.images.find((img: any) => img.index === index);
      // Default for missing classifications depends on mode:
      // - Image-only mode: default to text-only (conservative)
      // - Mixed mode: default to illustrations (include, safe fallback)
      const defaultValue = !isImageOnlyMode;
      return {
        url,
        hasIllustrations: classification?.hasIllustrations ?? defaultValue,
        description: classification?.description,
      };
    });

    const illustrationCount = results.filter(r => r.hasIllustrations).length;
    const textOnlyCount = results.filter(r => !r.hasIllustrations).length;
    console.log(`Image classification complete: ${illustrationCount} with illustrations, ${textOnlyCount} text-only`);

    return results;
  } catch (error) {
    // Fallback behavior depends on mode (same as invalid response)
    console.error("Error classifying images:", error);
    return imageUrls.slice(0, 6).map(url => ({ url, hasIllustrations: !isImageOnlyMode }));
  }
}

async function aiVerifyAnswers(mcQuestions: any[], logPrefix: string = "[AI VERIFY]"): Promise<void> {
  if (mcQuestions.length === 0) return;

  try {
    const verificationItems = mcQuestions.map((q: any, i: number) => ({
      index: i,
      question: q.question,
      options: q.options,
      markedCorrect: q.correctAnswer,
      explanation: q.explanation,
    }));

    const verificationPrompt = `You are a strict answer verifier specializing in catching numeric and unit errors. For each question below, you must INDEPENDENTLY solve the problem and determine which option is correct. Do NOT trust the marked answer or explanation — verify by solving it yourself.

STEP-BY-STEP PROCESS FOR EACH QUESTION:
1. Read the question carefully
2. Solve it yourself from scratch (do the math, apply the formula, check the facts)
3. Compare your result against EACH numbered option individually
4. Set correctAnswerIndex to the INDEX (0, 1, 2, 3) of the option that matches your result
5. If the answer changed, write a corrected explanation that supports the new answer

CRITICAL NUMERIC/UNIT RULES:
- 50g = 0.05kg (NOT 5kg) — always check decimal places and unit conversions
- 0.05kg and 0,05kg are the SAME value (comma vs period decimal notation)
- When converting: g→kg divide by 1000, kg→g multiply by 1000, cm→m divide by 100, mm→cm divide by 10
- Common AI mistakes: off by factor of 10, 100, or 1000 in unit conversions
- For calculations: re-do the arithmetic yourself, don't trust the explanation
- The correct answer must have the right NUMBER and the right UNIT
${SI_UNIT_NORMALIZATION_INSTRUCTIONS}
Questions to verify:
${JSON.stringify(verificationItems, null, 2)}

Respond with ONLY a JSON array. For each question:
- "correctAnswerIndex": the 0-based INDEX of the correct option (0, 1, 2, or 3) — use a NUMBER, not text
- "computedValue": your independently computed answer as a string with the number and unit (e.g., "0.05kg", "3600s", "9.8m/s"). For non-numeric questions, use "".
- "explanation": if changed, a corrected explanation; if unchanged, copy the original
[{"index": 0, "correctAnswerIndex": 2, "computedValue": "0.05kg", "explanation": "why correct"}, ...]`;

    const verifyResponse = await pRetry(
      async () => {
        const result = await openai.chat.completions.create({
          model: "openai/gpt-4o-mini",
          messages: [{ role: "user", content: verificationPrompt }],
          temperature: 0,
          max_tokens: 4000,
        });
        return result.choices[0]?.message?.content || "";
      },
      { retries: 2, minTimeout: 1000 }
    );

    const cleanVerify = verifyResponse.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    const verifications = JSON.parse(cleanVerify);

    if (Array.isArray(verifications)) {
      for (const v of verifications) {
        if (typeof v.index !== "number") continue;
        const q = mcQuestions[v.index];
        if (!q) continue;

        const options = q.options.map((o: any) => String(o).trim());
        const markedCorrect = String(q.correctAnswer).trim();

        if (v.computedValue && typeof v.computedValue === "string" && v.computedValue.trim().length > 0) {
          q._aiComputedValue = v.computedValue.trim();
          console.log(`${logPrefix} Question "${String(q.question).substring(0, 60)}..." — AI computed value: "${q._aiComputedValue}"`);
        }

        if (v.correctAnswerIndex !== undefined) {
          const ansIdx = typeof v.correctAnswerIndex === "string" ? parseInt(v.correctAnswerIndex, 10) : v.correctAnswerIndex;
          if (typeof ansIdx === "number" && ansIdx >= 0 && ansIdx < options.length) {
            const verifiedAnswer = options[ansIdx];
            if (verifiedAnswer !== markedCorrect) {
              console.warn(`${logPrefix} Question "${String(q.question).substring(0, 60)}..." — changing answer from "${markedCorrect}" to "${verifiedAnswer}" (index ${ansIdx})`);
              q.correctAnswer = verifiedAnswer;
            }
          }
        } else if (typeof v.correctAnswer === "string") {
          const verifiedAnswer = v.correctAnswer.trim();
          if (verifiedAnswer !== markedCorrect && options.includes(verifiedAnswer)) {
            console.warn(`${logPrefix} Question "${String(q.question).substring(0, 60)}..." — changing answer from "${markedCorrect}" to "${verifiedAnswer}"`);
            q.correctAnswer = verifiedAnswer;
          }
        }

        if (v.explanation && typeof v.explanation === "string" && v.explanation.trim().length > 10) {
          q.explanation = v.explanation.trim();
        }

        const finalCorrect = String(q.correctAnswer).trim();
        if (!q.wrongAnswerExplanations) q.wrongAnswerExplanations = {};
        for (const opt of options) {
          if (opt === finalCorrect) continue;
          const hasExplanation = q.wrongAnswerExplanations[opt];
          if (!hasExplanation) {
            q.wrongAnswerExplanations[opt] = `This is incorrect. The correct answer is ${finalCorrect}.`;
          }
        }
      }
    }
  } catch (verifyError) {
    console.warn(`${logPrefix} Verification step failed, using original answers:`, verifyError);
  }
}

interface QuizGenerationParams {
  text: string;
  questionCount: number;
  questionTypes: QuestionType[];
  difficulty?: DifficultyLevel;
  documentImages?: string[];
  onProgress?: ProgressCallback;
  isImageOnly?: boolean;
}

export async function generateQuizQuestions(
  params: QuizGenerationParams,
): Promise<{ questions: Question[]; title: string; category: QuizCategory }> {
  const { text, questionCount, questionTypes, difficulty = "medium", documentImages = [], onProgress, isImageOnly = false } = params;

  const hasImages = documentImages.length > 0;
  
  // Step 1: Reading material
  onProgress?.("reading", 10, "Reading your study material...");
  const truncatedText =
    text.length > 8000 ? text.substring(0, 8000) + "..." : text;

  const questionTypeDescriptions = questionTypes
    .map((type) => {
      switch (type) {
        case "multiple_choice":
          return "Multiple choice questions with 4 options (A, B, C, D)";
        case "true_false":
          return "True/False questions";
        case "short_answer":
          return "Short answer questions with brief 1-3 word answers";
      }
    })
    .join(", ");

  const difficultyDescriptions: Record<DifficultyLevel, string> = {
    easy: "simple recall and basic understanding questions that test fundamental concepts",
    medium:
      "moderate complexity questions requiring comprehension and application",
    hard: "challenging questions requiring analysis, synthesis, and deep understanding with tricky distractors",
  };

  const categoryList = QUIZ_CATEGORIES.join(", ");
  
  const prompt = `You are an expert educator and subject-matter specialist. Based on the following content, generate ${questionCount} ${difficulty.toUpperCase()} difficulty quiz questions to help students study and learn the material. Also, generate a short, descriptive title (max 6 words) for this quiz and categorize it.

CONTENT:
${truncatedText}

LANGUAGE HANDLING:
- Detect the primary language of the content above (English, Vietnamese, or other)
- Generate ALL questions, options, correct answers, explanations, and the QUIZ TITLE in the SAME language as the content
- If the content is in Vietnamese, write everything in Vietnamese
- If the content is in English, write everything in English

REQUIREMENTS:
1. Generate exactly ${questionCount} questions
2. ONLY use these question types: ${questionTypeDescriptions}
3. Do NOT generate any question type that is not listed above. If only one type is specified, ALL questions MUST be that type.
4. Distribute question types roughly evenly among the selected types
5. DIFFICULTY LEVEL: ${difficulty.toUpperCase()} - ${difficultyDescriptions[difficulty]}
6. Include an explanation for why the correct answer is right
7. For multiple choice, include explanations for why EACH wrong answer is incorrect
8. For multiple choice, always provide exactly 4 options
9. CATEGORY: Assign exactly ONE category from: ${categoryList}
   - Math: arithmetic, algebra, geometry, calculus, statistics, etc.
   - English: grammar, literature, writing, reading comprehension, vocabulary (English language)
   - Science: biology, chemistry, physics, earth science, etc.
   - Social Studies: history, geography, civics, economics, etc.
   - Global Languages: foreign languages other than English (Spanish, French, Vietnamese, Chinese, etc.)
   - Others/General: anything that doesn't fit the above categories

FACTUAL ACCURACY (HIGHEST PRIORITY):
- Every correct answer MUST be verifiably, objectively correct based on the source content and established knowledge
- If the source content contains a factual claim, use it as the basis for the correct answer
- For math/science: mentally solve the problem first, determine the correct numerical result, then set correctAnswer to the option matching that result. Write the explanation afterward to show the work that leads to your already-chosen answer.
- For true/false questions: make sure the statement is UNAMBIGUOUSLY true or false — avoid statements that are partially true or context-dependent
- For short answer questions: ensure the expected answer is the most standard, widely-accepted answer — not an obscure or ambiguous phrasing
- NEVER set a wrong answer as the correct answer. If you are unsure about the correct answer, use the most defensible and commonly accepted answer
- Each wrong option must be clearly and definitively wrong — not a "close second" or debatable alternative
${SI_UNIT_NORMALIZATION_INSTRUCTIONS}

CRITICAL RULES:
- NEVER use placeholder text like "Option 1", "Option 2", "correctAnswer", "Wrong Option", etc. in actual options
- Do not contain any prefix like "A) ", "1. ", "a. ", etc. in the options or correct answer. Provide ONLY the answer text.
- All options must be real, meaningful answers related to the question
- The wrongAnswerExplanations keys must be the EXACT text of the wrong options (without any prefix)

ANSWER LENGTH BALANCING (EXTREMELY IMPORTANT - FOLLOW STRICTLY):
- The correct answer must NOT be noticeably longer or more detailed than wrong answers
- ALL four options MUST have similar word counts (within 2-3 words of each other)
- If the correct answer naturally requires more detail, ADD similar detail to wrong answers to match
- If the correct answer is short (1-3 words), keep ALL options short (1-3 words)
- If the correct answer is medium (4-8 words), make ALL options medium length
- If the correct answer is long (9+ words), make ALL options similarly long
- NEVER make the correct answer stand out by being the only "complete" or "detailed" option
- Wrong answers should be equally plausible and well-formed, not obviously wrong or shorter
- Randomize which position (1st, 2nd, 3rd, or 4th) contains the correct answer - do NOT always put it first or last

QUESTION GENERATION FLOW (MANDATORY - follow this exact order for each question):
- Step 1: Write the question text
- Step 2: Generate the answer options
- Step 3: For math/science/numeric questions: SOLVE the problem yourself step-by-step to get the raw numeric result with units (e.g., "0.05kg", "3600s", "9.8m/s²"). Put this in "computedValue".
- Step 4: DECIDE which option is the correct answer and set "correctAnswerIndex"
- Step 5: Write "explanation" to explain why correctAnswer is right (for math/science, show the full calculation)
- Step 6: Write "wrongAnswerExplanations" — for EACH wrong option, explain the specific mistake

SELF-CONSISTENCY CHECK: The explanation MUST support the correctAnswer you already chose. If you realize during explanation that a different option is actually correct, go back and fix the correctAnswer BEFORE writing the explanation.

OUTPUT FORMAT (JSON):
{
  "title": "A short descriptive title for the quiz",
  "category": "One of: ${categoryList}",
  "questions": [
    {
      "type": "multiple_choice" | "true_false" | "short_answer",
      "question": "The question text",
      "options": ["Option with similar length", "Option with similar length", "Option with similar length", "Option with similar length"],
      "correctAnswerIndex": 0,
      "correctAnswer": "Only for short_answer type - the answer text. For true_false: use correctAnswerIndex (0 for True, 1 for False).",
      "computedValue": "Your raw computed answer with units for numeric questions, e.g. '0.05kg', '3600s'. Empty string for non-numeric.",
      "explanation": "Why the correct option is right. For math/science: show full calculation.",
      "wrongAnswerExplanations": {
        "Wrong option 1 text": "The specific mistake that leads to this wrong value",
        "Wrong option 2 text": "The specific mistake that leads to this wrong value",
        "Wrong option 3 text": "The specific mistake that leads to this wrong value"
      }
    }
  ]
}

IMPORTANT: For multiple_choice and true_false questions, use "correctAnswerIndex" (a number) instead of "correctAnswer" text. For true_false questions, the options MUST be ["True", "False"] and correctAnswerIndex MUST be 0 (True) or 1 (False). For short_answer, use "correctAnswer" text. For math/science questions with numeric answers, ALWAYS include "computedValue" with your raw calculated result.

Respond with ONLY valid JSON, no markdown or additional text.`;

  const visionPrompt = hasImages ? `You are an expert educator and subject-matter specialist. Based on the following document content AND the attached images/diagrams/charts from the document, generate ${questionCount} ${difficulty.toUpperCase()} difficulty quiz questions to help students study and learn the material.

IMPORTANT: Carefully analyze ALL attached images. These may contain:
- Charts, graphs, and diagrams with important data
- Illustrations and figures that explain concepts
- Tables with information
- Screenshots or visual examples

Generate questions that test understanding of BOTH the text content AND the visual content from the images.

TEXT CONTENT:
${truncatedText}

LANGUAGE HANDLING:
- Detect the primary language of the content above (English, Vietnamese, or other)
- Generate ALL questions, options, correct answers, explanations, and the QUIZ TITLE in the SAME language as the content
- If the content is in Vietnamese, write everything in Vietnamese
- If the content is in English, write everything in English

REQUIREMENTS:
1. Generate exactly ${questionCount} questions
2. ONLY use these question types: ${questionTypeDescriptions}
3. Do NOT generate any question type that is not listed above. If only one type is specified, ALL questions MUST be that type.
4. Distribute question types roughly evenly among the selected types
5. DIFFICULTY LEVEL: ${difficulty.toUpperCase()} - ${difficultyDescriptions[difficulty]}
6. Include an explanation for why the correct answer is right
7. For multiple choice, include explanations for why EACH wrong answer is incorrect
8. For multiple choice, always provide exactly 4 options labeled A, B, C, D
9. At least 30% of questions should be based on or reference the visual content (charts, diagrams, images)
10. For questions that reference a specific image, include the imageIndex (0-based index of the attached image)
11. CATEGORY: Assign exactly ONE category from: ${categoryList}
   - Math: arithmetic, algebra, geometry, calculus, statistics, etc.
   - English: grammar, literature, writing, reading comprehension, vocabulary (English language)
   - Science: biology, chemistry, physics, earth science, etc.
   - Social Studies: history, geography, civics, economics, etc.
   - Global Languages: foreign languages other than English (Spanish, French, Vietnamese, Chinese, etc.)
   - Others/General: anything that doesn't fit the above categories

FACTUAL ACCURACY (HIGHEST PRIORITY):
- Every correct answer MUST be verifiably, objectively correct based on the source content and established knowledge
- If the source content contains a factual claim, use it as the basis for the correct answer
- For math/science: mentally solve the problem first, determine the correct numerical result, then set correctAnswer to the option matching that result. Write the explanation afterward to show the work that leads to your already-chosen answer.
- For true/false questions: make sure the statement is UNAMBIGUOUSLY true or false — avoid statements that are partially true or context-dependent
- For short answer questions: ensure the expected answer is the most standard, widely-accepted answer — not an obscure or ambiguous phrasing
- NEVER set a wrong answer as the correct answer. If you are unsure about the correct answer, use the most defensible and commonly accepted answer
- Each wrong option must be clearly and definitively wrong — not a "close second" or debatable alternative
${SI_UNIT_NORMALIZATION_INSTRUCTIONS}

CRITICAL RULES:
- NEVER use placeholder text like "Option 1", "Option 2", "correctAnswer", "Wrong Option", etc. in actual options
- Do not contain any prefix like "A) ", "1. ", "a. ", etc. in the options or correct answer. Provide ONLY the answer text.
- All options must be real, meaningful answers related to the question
- The wrongAnswerExplanations keys must be the EXACT text of the wrong options (without any prefix)

ANSWER LENGTH BALANCING (EXTREMELY IMPORTANT - FOLLOW STRICTLY):
- The correct answer must NOT be noticeably longer or more detailed than wrong answers
- ALL four options MUST have similar word counts (within 2-3 words of each other)
- If the correct answer naturally requires more detail, ADD similar detail to wrong answers to match
- If the correct answer is short (1-3 words), keep ALL options short (1-3 words)
- If the correct answer is medium (4-8 words), make ALL options medium length
- If the correct answer is long (9+ words), make ALL options similarly long
- NEVER make the correct answer stand out by being the only "complete" or "detailed" option
- Wrong answers should be equally plausible and well-formed, not obviously wrong or shorter
- Randomize which position (1st, 2nd, 3rd, or 4th) contains the correct answer - do NOT always put it first or last

QUESTION GENERATION FLOW (MANDATORY - follow this exact order for each question):
- Step 1: Write the question text
- Step 2: Generate the answer options
- Step 3: For math/science/numeric questions: SOLVE the problem yourself step-by-step to get the raw numeric result with units (e.g., "0.05kg", "3600s", "9.8m/s²"). Put this in "computedValue".
- Step 4: DECIDE which option is the correct answer and set "correctAnswerIndex"
- Step 5: Write "explanation" to explain why correctAnswer is right (for math/science, show the full calculation)
- Step 6: Write "wrongAnswerExplanations" — for EACH wrong option, explain the specific mistake

SELF-CONSISTENCY CHECK: The explanation MUST support the correctAnswer you already chose. If you realize during explanation that a different option is actually correct, go back and fix the correctAnswer BEFORE writing the explanation.

OUTPUT FORMAT (JSON):
{
  "title": "A short descriptive title for the quiz",
  "category": "One of: ${categoryList}",
  "questions": [
    {
      "type": "multiple_choice" | "true_false" | "short_answer",
      "question": "The question text",
      "options": ["Option with similar length", "Option with similar length", "Option with similar length", "Option with similar length"],
      "correctAnswerIndex": 0,
      "correctAnswer": "Only for short_answer type - the answer text",
      "computedValue": "Your raw computed answer with units for numeric questions, e.g. '0.05kg', '3600s'. Empty string for non-numeric.",
      "explanation": "Why the correct option is right. For math/science: show full calculation.",
      "wrongAnswerExplanations": {
        "Wrong option 1 text": "The specific mistake that leads to this wrong value",
        "Wrong option 2 text": "The specific mistake that leads to this wrong value",
        "Wrong option 3 text": "The specific mistake that leads to this wrong value"
      },
      "imageIndex": 0
    }
  ]
}

IMPORTANT: For multiple_choice and true_false questions, use "correctAnswerIndex" (a number) instead of "correctAnswer" text. For true_false questions, options MUST be ["True", "False"] and correctAnswerIndex MUST be 0 (True) or 1 (False). For short_answer, use "correctAnswer" text. For math/science questions with numeric answers, ALWAYS include "computedValue" with your raw calculated result.

Respond with ONLY valid JSON, no markdown or additional text.` : prompt;

  // Special prompt for image-only uploads (no text content)
  const imageOnlyPrompt = `You are an expert educator and subject-matter specialist. Analyze the attached images carefully and generate ${questionCount} ${difficulty.toUpperCase()} difficulty quiz questions based ENTIRELY on what you see in the images.

IMPORTANT: These are study materials uploaded as images. They may contain:
- Study sheets, worksheets, or exam papers
- Charts, graphs, diagrams, and illustrations
- Text within images that should be read and understood
- Educational content in any language

Your task is to:
1. Carefully analyze ALL visual content in the attached images
2. Read and understand any text visible within the images
3. Generate questions that test understanding of the material shown

LANGUAGE HANDLING:
- Detect the primary language visible in the images
- Generate ALL questions, options, correct answers, explanations, and the QUIZ TITLE in the SAME language as the content
- If the content is in Vietnamese, write everything in Vietnamese
- If the content is in English, write everything in English

REQUIREMENTS:
1. Generate exactly ${questionCount} questions
2. ONLY use these question types: ${questionTypeDescriptions}
3. Do NOT generate any question type that is not listed above. If only one type is specified, ALL questions MUST be that type.
4. Distribute question types roughly evenly among the selected types
5. DIFFICULTY LEVEL: ${difficulty.toUpperCase()} - ${difficultyDescriptions[difficulty]}
6. Include an explanation for why the correct answer is right
7. For multiple choice, include explanations for why EACH wrong answer is incorrect
8. For multiple choice, always provide exactly 4 options
9. ALL questions should be based on the visual content
10. For questions that reference a specific image, include the imageIndex (0-based index of the attached image)
11. CATEGORY: Assign exactly ONE category from: ${categoryList}
   - Math: arithmetic, algebra, geometry, calculus, statistics, etc.
   - English: grammar, literature, writing, reading comprehension, vocabulary (English language)
   - Science: biology, chemistry, physics, earth science, etc.
   - Social Studies: history, geography, civics, economics, etc.
   - Global Languages: foreign languages other than English (Spanish, French, Vietnamese, Chinese, etc.)
   - Others/General: anything that doesn't fit the above categories

FACTUAL ACCURACY (HIGHEST PRIORITY):
- Every correct answer MUST be verifiably, objectively correct based on the source content and established knowledge
- If the source content contains a factual claim, use it as the basis for the correct answer
- For math/science: mentally solve the problem first, determine the correct numerical result, then set correctAnswer to the option matching that result. Write the explanation afterward to show the work that leads to your already-chosen answer.
- For true/false questions: make sure the statement is UNAMBIGUOUSLY true or false — avoid statements that are partially true or context-dependent
- For short answer questions: ensure the expected answer is the most standard, widely-accepted answer — not an obscure or ambiguous phrasing
- NEVER set a wrong answer as the correct answer. If you are unsure about the correct answer, use the most defensible and commonly accepted answer
- Each wrong option must be clearly and definitively wrong — not a "close second" or debatable alternative
${SI_UNIT_NORMALIZATION_INSTRUCTIONS}

CRITICAL RULES:
- NEVER use placeholder text like "Option 1", "Option 2", "correctAnswer", "Wrong Option", etc. in actual options
- Do not contain any prefix like "A) ", "1. ", "a. ", etc. in the options or correct answer. Provide ONLY the answer text.
- All options must be real, meaningful answers related to the question
- The wrongAnswerExplanations keys must be the EXACT text of the wrong options (without any prefix)

ANSWER LENGTH BALANCING (EXTREMELY IMPORTANT - FOLLOW STRICTLY):
- The correct answer must NOT be noticeably longer or more detailed than wrong answers
- ALL four options MUST have similar word counts (within 2-3 words of each other)
- If the correct answer naturally requires more detail, ADD similar detail to wrong answers to match
- If the correct answer is short (1-3 words), keep ALL options short (1-3 words)
- If the correct answer is medium (4-8 words), make ALL options medium length
- If the correct answer is long (9+ words), make ALL options similarly long
- NEVER make the correct answer stand out by being the only "complete" or "detailed" option
- Wrong answers should be equally plausible and well-formed, not obviously wrong or shorter
- Randomize which position (1st, 2nd, 3rd, or 4th) contains the correct answer - do NOT always put it first or last

QUESTION GENERATION FLOW (MANDATORY - follow this exact order for each question):
- Step 1: Write the question text
- Step 2: Generate the answer options
- Step 3: For math/science/numeric questions: SOLVE the problem yourself step-by-step to get the raw numeric result with units (e.g., "0.05kg", "3600s", "9.8m/s²"). Put this in "computedValue".
- Step 4: DECIDE which option is the correct answer and set "correctAnswerIndex"
- Step 5: Write "explanation" to explain why correctAnswer is right (for math/science, show the full calculation)
- Step 6: Write "wrongAnswerExplanations" — for EACH wrong option, explain the specific mistake

SELF-CONSISTENCY CHECK: The explanation MUST support the option at correctAnswerIndex. If you realize during explanation that a different option is actually correct, go back and fix the correctAnswerIndex BEFORE writing the explanation.

OUTPUT FORMAT (JSON):
{
  "title": "A short descriptive title for the quiz",
  "category": "One of: ${categoryList}",
  "questions": [
    {
      "type": "multiple_choice" | "true_false" | "short_answer",
      "question": "The question text",
      "options": ["Option with similar length", "Option with similar length", "Option with similar length", "Option with similar length"],
      "correctAnswerIndex": 0,
      "correctAnswer": "Only for short_answer type - the answer text",
      "computedValue": "Your raw computed answer with units for numeric questions, e.g. '0.05kg', '3600s'. Empty string for non-numeric.",
      "explanation": "Why the correct option is right. For math/science: show full calculation.",
      "wrongAnswerExplanations": {
        "Wrong option 1 text": "The specific mistake that leads to this wrong value",
        "Wrong option 2 text": "The specific mistake that leads to this wrong value",
        "Wrong option 3 text": "The specific mistake that leads to this wrong value"
      },
      "imageIndex": 0
    }
  ]
}

IMPORTANT: For multiple_choice and true_false questions, use "correctAnswerIndex" (a number) instead of "correctAnswer" text. For true_false questions, options MUST be ["True", "False"] and correctAnswerIndex MUST be 0 (True) or 1 (False). For short_answer, use "correctAnswer" text. For math/science questions with numeric answers, ALWAYS include "computedValue" with your raw calculated result.

Respond with ONLY valid JSON, no markdown or additional text.`;

  // Choose the right prompt based on content type
  const finalPrompt = isImageOnly ? imageOnlyPrompt : visionPrompt;

  try {
    // Step 2: Analyzing content
    onProgress?.("analyzing", 25, "Analyzing content structure...");
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Step 3: Preparing AI request
    onProgress?.("preparing", 35, hasImages ? "Processing visual content..." : "Preparing quiz generation...");
    
    const response = await pRetry(
      async () => {
        let messages: any[];
        
        // Step 4: Generating questions
        onProgress?.("generating", 50, "AI is generating questions...");
        
        if (hasImages) {
          const imageContent = documentImages.slice(0, 6).map(imageUrl => ({
            type: "image_url" as const,
            image_url: { url: imageUrl, detail: "high" as const }
          }));
          
          messages = [{
            role: "user",
            content: [
              { type: "text", text: finalPrompt },
              ...imageContent
            ]
          }];
          
          console.log(`Generating quiz with ${imageContent.length} images using vision model (isImageOnly: ${isImageOnly})`);
        } else {
          messages = [{ role: "user", content: prompt }];
        }
        
        // Retry loop for empty responses
        let content: string | null = null;
        let emptyRetries = 0;
        const maxEmptyRetries = 3;
        
        while (!content && emptyRetries < maxEmptyRetries) {
          const completion = await openai.chat.completions.create({
            model: hasImages ? "gpt-4.1" : "gpt-5",
            messages,
            response_format: { type: "json_object" },
            max_completion_tokens: 12000,
          });

          content = completion.choices[0]?.message?.content;
          
          if (!content) {
            emptyRetries++;
            console.error(`Empty AI response for quiz generation (attempt ${emptyRetries}/${maxEmptyRetries}), retrying...`);
            if (emptyRetries < maxEmptyRetries) {
              await new Promise(resolve => setTimeout(resolve, 2000 * emptyRetries));
            }
          } else {
            console.log("Quiz generation AI response received successfully");
            onProgress?.("processing", 70, "Processing AI response...");
          }
        }
        
        if (!content) {
          throw new Error("No response from AI after multiple attempts");
        }

        return content;
      },
      {
        retries: 3,
        minTimeout: 3000,
        maxTimeout: 60000,
        factor: 2,
        onFailedAttempt: (error: any) => {
          console.log(`Quiz generation rate limit retry (attempt ${error.attemptNumber}): ${error.message || error}`);
          if (!isRateLimitError(error)) {
            throw error;
          }
        },
      },
    );

    // Step 5: Validating response
    onProgress?.("validating", 80, "Validating generated questions...");
    
    const parsed = JSON.parse(response);

    if (!parsed.questions || !Array.isArray(parsed.questions)) {
      throw new Error("Invalid AI response: missing questions array");
    }

    // Enforce question count limit - AI sometimes generates extra questions
    let rawQuestions = parsed.questions;
    if (rawQuestions.length > questionCount) {
      console.log(`AI generated ${rawQuestions.length} questions, trimming to requested ${questionCount}`);
      rawQuestions = rawQuestions.slice(0, questionCount);
    } else if (rawQuestions.length < questionCount) {
      console.warn(`AI generated only ${rawQuestions.length} questions, requested ${questionCount}`);
    }

    const title = parsed.title?.trim() || "Untitled Quiz";
    const rawCategory = parsed.category?.trim() || "Others/General";
    const category: QuizCategory = QUIZ_CATEGORIES.includes(rawCategory) ? rawCategory : "Others/General";
    const questions: Question[] = [];

    for (const q of rawQuestions) {
      if (q.correctAnswerIndex !== undefined && Array.isArray(q.options) && q.options.length > 0) {
        const idx = typeof q.correctAnswerIndex === "string" ? parseInt(q.correctAnswerIndex, 10) : q.correctAnswerIndex;
        if (typeof idx === "number" && idx >= 0 && idx < q.options.length) {
          q.correctAnswer = String(q.options[idx]).trim();
          console.log(`[GENERATE] Resolved correctAnswerIndex ${idx} -> "${q.correctAnswer}" for: "${String(q.question).substring(0, 50)}..."`);
        }
      }
    }

    onProgress?.("verifying", 85, "Verifying answer accuracy...");
    const mcQuestions = rawQuestions.filter((q: any) => 
      q.type === "multiple_choice" && q.correctAnswer && Array.isArray(q.options)
    );

    const numericMcQuestions = mcQuestions.filter((q: any) => hasNumericOptions(q.options.map((o: any) => String(o))));
    const nonNumericMcQuestions = mcQuestions.filter((q: any) => !hasNumericOptions(q.options.map((o: any) => String(o))));

    if (numericMcQuestions.length > 0) {
      console.log(`[GENERATE] ${numericMcQuestions.length} numeric questions — code will select answers deterministically`);
      await codeSelectNumericAnswersFromGeneration(numericMcQuestions, "[GENERATE CODE-SELECT]");
    }

    if (nonNumericMcQuestions.length > 0) {
      console.log(`[GENERATE] ${nonNumericMcQuestions.length} non-numeric questions — using AI verify`);
      await aiVerifyAnswers(nonNumericMcQuestions, "[AI VERIFY]");
    }

    for (const q of rawQuestions) {
      if (!q.type || !q.question || (!q.correctAnswer && q.correctAnswerIndex === undefined)) {
        console.warn("Skipping malformed question:", q);
        continue;
      }

      if (!["multiple_choice", "true_false", "short_answer"].includes(q.type)) {
        console.warn("Skipping question with invalid type:", q.type);
        continue;
      }

      if (!questionTypes.includes(q.type as QuestionType)) {
        console.warn(`AI generated ${q.type} but user only selected [${questionTypes.join(", ")}], converting...`);
        if (questionTypes.length === 1) {
          q.type = questionTypes[0];
          if (q.type === "short_answer") {
            q.options = undefined;
          }
        } else {
          continue;
        }
      }

      const stripPrefix = (s: string) => s.replace(/^[A-Da-d][).:]\s*/i, "").trim();

      let options =
        q.type === "multiple_choice" && Array.isArray(q.options)
          ? q.options.map((o: any) => stripPrefix(String(o).trim()))
          : undefined;

      let correctAnswer = stripPrefix(String(q.correctAnswer).trim());

      if (q.type === "multiple_choice" && options && options.length > 0) {
        const correctIndex = options.findIndex(
          (o: string) => o === correctAnswer,
        );

        if (correctIndex !== -1) {
          const correctText = options[correctIndex];
          const plainOptions = [...options];

          // Shuffle
          for (let i = plainOptions.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [plainOptions[i], plainOptions[j]] = [
              plainOptions[j],
              plainOptions[i],
            ];
          }

          // Re-label and find new correct
          options = plainOptions;
          const newCorrectIndex = plainOptions.findIndex(
            (t: string) => t === correctText,
          );
          correctAnswer = options[newCorrectIndex];
        }
      }

      // Normalize true/false questions
      if (q.type === "true_false") {
        options = ["True", "False"];
        const lowerAnswer = correctAnswer.toLowerCase();
        if (["true", "t", "yes", "đúng", "correct", "right"].includes(lowerAnswer)) {
          correctAnswer = "True";
        } else {
          correctAnswer = "False";
        }
      }

      // Process wrong answer explanations if present
      let wrongAnswerExplanations: Record<string, string> | undefined;
      if (q.type === "multiple_choice" && q.wrongAnswerExplanations && typeof q.wrongAnswerExplanations === "object") {
        wrongAnswerExplanations = {};
        for (const [key, value] of Object.entries(q.wrongAnswerExplanations)) {
          if (typeof value === "string") {
            wrongAnswerExplanations[String(key).trim()] = String(value).trim();
          }
        }
      }

      // Map imageIndex to actual image URL if present
      let imageUrl: string | undefined;
      if (typeof q.imageIndex === "number" && q.imageIndex >= 0 && q.imageIndex < documentImages.length) {
        imageUrl = documentImages[q.imageIndex];
      }

      const question: Question = {
        id: randomUUID(),
        type: q.type as QuestionType,
        question: String(q.question).trim(),
        options,
        correctAnswer,
        explanation: q.explanation ? String(q.explanation).trim() : undefined,
        wrongAnswerExplanations,
        imageUrl,
      };

      questions.push(question);
    }

    if (questions.length === 0) {
      throw new Error("AI failed to generate valid questions");
    }

    // Step 6: Finalizing
    onProgress?.("finalizing", 95, "Finalizing your quiz...");
    
    return { questions, title, category };
  } catch (error) {
    console.error("Error generating quiz:", error);
    throw new Error("Failed to generate quiz questions. Please try again.");
  }
}

interface ImportQuizParams {
  text: string;
  documentImages?: string[];
}

export async function importExistingQuiz(
  params: ImportQuizParams,
): Promise<{ questions: Question[]; title: string }> {
  const { text, documentImages = [] } = params;
  
  const hasImages = documentImages.length > 0;
  const truncatedText =
    text.length > 8000 ? text.substring(0, 8000) + "..." : text;

  const prompt = `You are an expert educator and subject-matter specialist. The following text appears to be from an existing exam, quiz, or worksheet that already contains questions with answer options.

Your task is to:
1. Parse and extract ALL existing questions from the content
2. Identify the correct answer for each question using your knowledge
3. Provide a brief explanation for why each answer is correct
4. For each WRONG answer option, provide a brief explanation of why it is incorrect
5. Generate a short, descriptive title (max 6 words) for this quiz.

CONTENT:
${truncatedText}

LANGUAGE HANDLING:
- Detect the primary language of the content above (English, Vietnamese, or other)
- Preserve the original language of the questions and options
- Write explanations and the QUIZ TITLE in the SAME language as the content
- If the content is in Vietnamese, write explanations and title in Vietnamese
- If the content is in English, write explanations and title in English

FACTUAL ACCURACY AND SELF-CONSISTENCY (HIGHEST PRIORITY - FOLLOW STRICTLY):
- Every correct answer MUST be verifiably, objectively correct based on established academic knowledge
- For math/science: work through all calculations, unit conversions, and formulas step by step FIRST, arrive at the result, THEN set correctAnswer to the option matching your result
- SELF-CHECK (MANDATORY): After writing each question, re-read your own explanation. The value/conclusion in the explanation MUST match the correctAnswer field EXACTLY. If your explanation derives "0.05kg" then correctAnswer MUST be "0,05kg" or "0.05kg" — NEVER a different value. Fix any mismatch before moving on.
- NEVER mark a wrong answer as correct. If uncertain, use the most defensible and commonly accepted answer
- The explanation must clearly and logically justify why the correct answer is right
- wrongAnswerExplanations: for EACH wrong option, explain specifically why that value is wrong (e.g., "This is off by a factor of 100 due to a unit conversion error"). Do NOT just restate the correct answer.
${SI_UNIT_NORMALIZATION_INSTRUCTIONS}

IMPORTANT INSTRUCTIONS:
- Extract questions EXACTLY as they appear (preserving the original wording)
- For multiple choice, preserve all answer options as they appear (e.g., a, b, c, d or A, B, C, D)
- Use your expert knowledge to determine the correct answer with high confidence - DO NOT guess
- If a question is unclear or you cannot determine the answer confidently, still include it but note the uncertainty in the explanation
- AUTOMATICALLY DETECT QUESTION TYPE based on the options:
  * If options are exactly "True" and "False" (or similar like "T/F", "Đúng/Sai") → use "true_false" type
  * If there are NO options provided (open-ended question) → use "short_answer" type
  * Otherwise (multiple options A, B, C, D etc.) → use "multiple_choice" type
- The wrongAnswerExplanations keys must be the EXACT text of the wrong options (without any prefix)

OUTPUT FORMAT (JSON):
{
  "title": "A short descriptive title for the quiz",
  "questions": [
    {
      "type": "multiple_choice OR true_false OR short_answer",
      "question": "The exact question text as it appears",
      "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
      "correctAnswerIndex": 0,
      "correctAnswer": "Only for short_answer type - the answer text",
      "computedValue": "Your raw computed answer with units for numeric questions, e.g. '0.05kg', '3600s'. Empty string for non-numeric.",
      "explanation": "Brief explanation of why this is the correct answer",
      "wrongAnswerExplanations": {
        "Option 1": "Why this option is incorrect",
        "Option 2": "Why this option is incorrect"
      }
    }
  ]
}

IMPORTANT: For multiple_choice and true_false questions, use "correctAnswerIndex" (a number 0-3) instead of "correctAnswer" text. For short_answer questions, use "correctAnswer" text. For math/science questions with numeric answers, ALWAYS include "computedValue" with your raw calculated result.

Respond with ONLY valid JSON, no markdown or additional text.`;

  const visionPrompt = hasImages ? `You are an expert educator and subject-matter specialist. The following content appears to be from an existing exam, quiz, or worksheet that already contains questions with answer options. The content includes IMAGES that may contain questions, diagrams, or visual content that are part of the quiz.

Your task is to:
1. Parse and extract ALL existing questions from BOTH the text content AND the attached images
2. Questions may appear in the images - extract those too
3. Identify the correct answer for each question using your knowledge
4. Provide a brief explanation for why each answer is correct
5. For each WRONG answer option, provide a brief explanation of why it is incorrect
6. Generate a short, descriptive title (max 6 words) for this quiz.

TEXT CONTENT:
${truncatedText}

LANGUAGE HANDLING:
- Detect the primary language of the content (English, Vietnamese, or other)
- Preserve the original language of the questions and options
- Write explanations and the QUIZ TITLE in the SAME language as the content

FACTUAL ACCURACY AND SELF-CONSISTENCY (HIGHEST PRIORITY - FOLLOW STRICTLY):
- Every correct answer MUST be verifiably, objectively correct based on established academic knowledge
- For math/science: work through all calculations, unit conversions, and formulas step by step FIRST, arrive at the result, THEN set correctAnswer to the option matching your result
- SELF-CHECK (MANDATORY): After writing each question, re-read your own explanation. The value/conclusion in the explanation MUST match the correctAnswer field EXACTLY. If your explanation derives "0.05kg" then correctAnswer MUST be "0,05kg" or "0.05kg" — NEVER a different value. Fix any mismatch before moving on.
- NEVER mark a wrong answer as correct. If uncertain, use the most defensible and commonly accepted answer
- The explanation must clearly and logically justify why the correct answer is right
- wrongAnswerExplanations: for EACH wrong option, explain specifically why that value is wrong (e.g., "This is off by a factor of 100 due to a unit conversion error"). Do NOT just restate the correct answer.
${SI_UNIT_NORMALIZATION_INSTRUCTIONS}

IMPORTANT INSTRUCTIONS:
- Extract questions EXACTLY as they appear (from both text and images)
- For multiple choice, preserve all answer options as they appear
- Use your expert knowledge to determine the correct answer with high confidence - DO NOT guess
- AUTOMATICALLY DETECT QUESTION TYPE based on the options:
  * If options are exactly "True" and "False" (or similar like "T/F", "Đúng/Sai") → use "true_false" type
  * If there are NO options provided (open-ended question) → use "short_answer" type
  * Otherwise (multiple options A, B, C, D etc.) → use "multiple_choice" type
- The wrongAnswerExplanations keys must be the EXACT text of the wrong options (without any prefix)

OUTPUT FORMAT (JSON):
{
  "title": "A short descriptive title for the quiz",
  "questions": [
    {
      "type": "multiple_choice OR true_false OR short_answer",
      "question": "The exact question text as it appears",
      "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
      "correctAnswerIndex": 0,
      "correctAnswer": "Only for short_answer type - the answer text",
      "computedValue": "Your raw computed answer with units for numeric questions, e.g. '0.05kg', '3600s'. Empty string for non-numeric.",
      "explanation": "Brief explanation of why this is the correct answer",
      "wrongAnswerExplanations": {
        "Option 1": "Why this option is incorrect",
        "Option 2": "Why this option is incorrect"
      }
    }
  ]
}

IMPORTANT: For multiple_choice and true_false questions, use "correctAnswerIndex" (a number 0-3) instead of "correctAnswer" text. For short_answer questions, use "correctAnswer" text. For math/science questions with numeric answers, ALWAYS include "computedValue" with your raw calculated result.

Respond with ONLY valid JSON, no markdown or additional text.` : prompt;

  try {
    const response = await pRetry(
      async () => {
        let messages: any[];
        
        if (hasImages) {
          const imageContent = documentImages.slice(0, 6).map(imageUrl => ({
            type: "image_url" as const,
            image_url: { url: imageUrl, detail: "high" as const }
          }));
          
          messages = [{
            role: "user",
            content: [
              { type: "text", text: visionPrompt },
              ...imageContent
            ]
          }];
          
          console.log(`Importing quiz with ${imageContent.length} images using vision model`);
        } else {
          messages = [{ role: "user", content: prompt }];
        }
        
        const completion = await openai.chat.completions.create({
          model: hasImages ? "gpt-4.1" : "gpt-5",
          messages,
          response_format: { type: "json_object" },
          max_completion_tokens: 8192,
        });

        const content = completion.choices[0]?.message?.content;
        if (!content) {
          throw new Error("No response from AI");
        }

        return content;
      },
      {
        retries: 5,
        minTimeout: 2000,
        maxTimeout: 60000,
        factor: 2,
        onFailedAttempt: (error) => {
          if (!isRateLimitError(error)) {
            throw error;
          }
        },
      },
    );

    const parsed = JSON.parse(response);

    console.log("AI import response:", JSON.stringify(parsed, null, 2));

    if (!parsed.questions || !Array.isArray(parsed.questions)) {
      throw new Error(
        "No quiz questions detected in this document. Please upload a document that contains multiple choice questions.",
      );
    }

    if (parsed.questions.length === 0) {
      throw new Error(
        "No quiz questions detected in this document. Please upload a document that contains multiple choice questions.",
      );
    }

    const title = parsed.title?.trim() || "Imported Quiz";
    const questions: Question[] = [];

    for (const q of parsed.questions) {
      if (q.correctAnswerIndex !== undefined && Array.isArray(q.options) && q.options.length > 0) {
        const idx = typeof q.correctAnswerIndex === "string" ? parseInt(q.correctAnswerIndex, 10) : q.correctAnswerIndex;
        if (typeof idx === "number" && idx >= 0 && idx < q.options.length) {
          q.correctAnswer = String(q.options[idx]).trim();
          console.log(`[IMPORT] Resolved correctAnswerIndex ${idx} -> "${q.correctAnswer}" for: "${String(q.question).substring(0, 50)}..."`);
        }
      }
    }

    const importMcQuestions = parsed.questions.filter((q: any) =>
      q.correctAnswer && Array.isArray(q.options) && q.options.length > 0
    );

    const importNumericMc = importMcQuestions.filter((q: any) => hasNumericOptions(q.options.map((o: any) => String(o))));
    const importNonNumericMc = importMcQuestions.filter((q: any) => !hasNumericOptions(q.options.map((o: any) => String(o))));

    if (importNumericMc.length > 0) {
      console.log(`[IMPORT] ${importNumericMc.length} numeric questions — code will select answers deterministically`);
      await codeSelectNumericAnswersFromGeneration(importNumericMc, "[IMPORT CODE-SELECT]");
    }

    if (importNonNumericMc.length > 0) {
      console.log(`[IMPORT] ${importNonNumericMc.length} non-numeric questions — using AI verify`);
      await aiVerifyAnswers(importNonNumericMc, "[IMPORT AI VERIFY]");
    }

    for (const q of parsed.questions) {
      if (!q.question || (!q.correctAnswer && q.correctAnswerIndex === undefined)) {
        console.warn(
          "Skipping malformed question (missing question or answer):",
          q,
        );
        continue;
      }

      const stripPrefix = (s: string) => s.replace(/^[A-Da-d][).:]\s*/i, "").trim();

      let options =
        Array.isArray(q.options) && q.options.length > 0
          ? q.options.map((o: any) => stripPrefix(String(o).trim()))
          : undefined;

      let questionType: QuestionType = "multiple_choice";
      
      if (!options || options.length === 0) {
        questionType = "short_answer";
        options = undefined;
      } else if (options.length === 2) {
        const normalizedOptions = options.map((o: string) => o.toLowerCase().trim());
        const trueFalsePatterns = [
          ["true", "false"],
          ["false", "true"],
          ["t", "f"],
          ["f", "t"],
          ["yes", "no"],
          ["no", "yes"],
          ["đúng", "sai"],
          ["sai", "đúng"],
        ];
        const isTrueFalse = trueFalsePatterns.some(pattern => 
          (normalizedOptions[0] === pattern[0] && normalizedOptions[1] === pattern[1]) ||
          (normalizedOptions.includes(pattern[0]) && normalizedOptions.includes(pattern[1]))
        );
        if (isTrueFalse) {
          questionType = "true_false";
          // Normalize options to "True" and "False"
          options = ["True", "False"];
        }
      } else if (q.type && ["multiple_choice", "true_false", "short_answer"].includes(q.type)) {
        // Use AI-detected type if valid
        questionType = q.type as QuestionType;
      }

      let correctAnswer = stripPrefix(String(q.correctAnswer).trim());
      
      // Normalize correct answer for true/false questions
      if (questionType === "true_false") {
        const lowerAnswer = correctAnswer.toLowerCase();
        if (["true", "t", "yes", "đúng"].includes(lowerAnswer)) {
          correctAnswer = "True";
        } else if (["false", "f", "no", "sai"].includes(lowerAnswer)) {
          correctAnswer = "False";
        }
      }

      if (questionType === "multiple_choice" && options && options.length > 0) {
        const correctIndex = options.findIndex(
          (o: string) => o === correctAnswer,
        );

        if (correctIndex !== -1) {
          const correctText = options[correctIndex];
          const plainOptions = [...options];

          for (let i = plainOptions.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [plainOptions[i], plainOptions[j]] = [
              plainOptions[j],
              plainOptions[i],
            ];
          }

          options = plainOptions;
          const newCorrectIndex = plainOptions.findIndex(
            (t: string) => t === correctText,
          );
          correctAnswer = options[newCorrectIndex];
        }
      }

      // Process wrongAnswerExplanations for imported quizzes
      let wrongAnswerExplanations: Record<string, string> | undefined;
      if (questionType === "multiple_choice" && q.wrongAnswerExplanations && typeof q.wrongAnswerExplanations === "object") {
        wrongAnswerExplanations = {};
        for (const [key, value] of Object.entries(q.wrongAnswerExplanations)) {
          if (value && typeof value === "string") {
            wrongAnswerExplanations[stripPrefix(String(key).trim())] = String(value).trim();
          }
        }
      }

      const question: Question = {
        id: randomUUID(),
        type: questionType,
        question: String(q.question).trim(),
        options,
        correctAnswer,
        explanation: q.explanation ? String(q.explanation).trim() : undefined,
        wrongAnswerExplanations,
      };

      questions.push(question);
    }

    if (questions.length === 0) {
      throw new Error(
        "No quiz questions detected in this document. Make sure you're uploading an exam paper or worksheet with multiple choice questions.",
      );
    }

    return { questions, title };
  } catch (error: any) {
    console.error("Error importing quiz:", error);
    if (error.message && error.message.includes("No quiz questions")) {
      throw error;
    }
    throw new Error("Failed to import quiz questions. Please try again.");
  }
}

export interface QuizChatParams {
  quizTitle: string;
  questions: Question[];
  currentQuestionIndex: number;
  userMessage: string;
  chatHistory: Array<{ role: "user" | "assistant"; content: string }>;
  sourceMaterial?: string;
}

export async function quizChatResponse(params: QuizChatParams): Promise<string> {
  const { quizTitle, questions, currentQuestionIndex, userMessage, chatHistory, sourceMaterial } = params;
  
  const safeIndex = Math.max(0, Math.min(currentQuestionIndex, questions.length - 1));
  const currentQuestion = questions[safeIndex];
  
  const quizContext = `You are Pip, the friendly penguin study buddy of Prepetual! You're an adorable arctic penguin who loves helping students learn. You live in a cozy igloo within the Prepetual app and get excited when students understand new concepts.

ABOUT PREPETUAL (the app you're part of):
Prepetual is an AI-powered exam preparation web app that helps students turn any study material into interactive practice quizzes. Key features include:
- Upload documents (PDFs, Word, PowerPoint, Excel, images) to extract text and generate quizzes automatically
- AI-generated quizzes with multiple question types: multiple choice, true/false, and short answer
- Three difficulty levels: Easy, Medium, and Hard
- Study mode with flashcards for quick review
- Revision mode to focus on questions you got wrong
- Quiz sharing via shareable links
- Progress tracking with accuracy trends and study streaks
- You (Pip!) - the AI study companion who helps explain concepts without giving away answers
- Import existing exams/worksheets where AI identifies correct answers
- Support for multiple languages including Vietnamese

YOUR PERSONALITY:
- You're a cheerful, encouraging penguin who genuinely cares about helping students succeed
- You occasionally make cute penguin references (like giving flipper high-fives, mentioning your igloo, or making light icy puns) but keep it natural and don't overdo it
- You're patient and never make students feel bad for not understanding something
- You celebrate their progress with enthusiasm
- You're a bit nerdy and love explaining things in fun, approachable ways
- You're proud to be part of Prepetual and can tell users about its features if they ask

QUIZ CONTEXT:
Quiz: "${quizTitle}"
Total questions: ${questions.length}
Current question: #${currentQuestionIndex + 1}

CURRENT QUESTION:
Type: ${currentQuestion.type}
Question: ${currentQuestion.question}
${currentQuestion.options ? `Options: ${currentQuestion.options.join(", ")}` : ""}

ALL QUIZ QUESTIONS (for context):
${questions.map((q, i) => `Q${i + 1}: ${q.question}`).join("\n")}

${sourceMaterial ? `SOURCE MATERIAL (original study content):\n${sourceMaterial.substring(0, 4000)}${sourceMaterial.length > 4000 ? "..." : ""}` : ""}

INSTRUCTIONS:
- Help the student understand concepts WITHOUT giving away answers directly
- If asked for the answer, guide them with hints instead - be a good tutor, not an answer machine!
- Explain concepts from the source material when relevant
- Be encouraging and supportive - you're their study buddy!
- Keep responses concise but helpful
- If they ask about a specific question, reference it by number
- Respond in the same language as the quiz content
- IMPORTANT: When explaining mathematical formulas, equations, or expressions, use LaTeX notation:
  - Use $...$ for inline math (e.g., $x^2 + y^2 = z^2$)
  - Use $$...$$ for display/block math (e.g., $$\\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}$$)
  - Examples: fractions like $\\frac{a}{b}$, square roots like $\\sqrt{x}$, exponents like $x^n$, subscripts like $x_i$, Greek letters like $\\alpha$, $\\beta$, integrals like $\\int_a^b f(x)dx$, sums like $\\sum_{i=1}^n$`;

  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: quizContext },
    ...chatHistory.slice(-10).map(msg => ({ role: msg.role as "user" | "assistant", content: msg.content })),
    { role: "user", content: userMessage }
  ];

  try {
    const response = await pRetry(
      async () => {
        const completion = await openai.chat.completions.create({
          model: "gpt-4.1",
          messages,
          max_tokens: 500,
        });
        return completion.choices[0]?.message?.content || "I'm sorry, I couldn't generate a response.";
      },
      {
        retries: 3,
        minTimeout: 2000,
        maxTimeout: 10000,
        factor: 2,
        onFailedAttempt: (error: any) => {
          console.log(`Quiz chat retry (attempt ${error.attemptNumber}): ${error.message || error}`);
          if (!isRateLimitError(error)) {
            throw error;
          }
        },
      }
    );
    
    return response;
  } catch (error: any) {
    console.error("Quiz chat error:", error);
    throw new Error("Failed to get AI response. Please try again.");
  }
}

export async function reviseQuizQuestions(params: {
  questions: Question[];
  mode: "full" | "answers_only";
  sourceText?: string;
  userFeedback?: string;
}): Promise<Question[]> {
  const { questions, mode, sourceText, userFeedback } = params;
  const limit = pLimit(3);
  
  const feedbackBlock = userFeedback ? `\n\nUser feedback to consider:\n"${userFeedback}"\nTake this feedback into account when revising, but still independently verify the correct answer.` : "";
  
  const revisedQuestions = await Promise.all(
    questions.map((q, idx) => limit(async () => {
      try {
        const revised = await pRetry(
          async () => {
            const hasOptions = q.options && q.options.length > 0;
            const numberedOptions = hasOptions
              ? q.options!.map((opt, i) => `  Option ${i}: "${opt}"`).join("\n")
              : "";

            let systemPrompt: string;
            let userPrompt: string;

            if (mode === "full") {
              systemPrompt = `You are an expert quiz question writer and verifier. Your job is to revise a quiz question by:
1. Rewriting the question to be clearer and more precise (keep same language)
2. SOLVING the problem independently step-by-step to determine the correct answer
3. Writing a thorough explanation showing the full solution process
4. Generating explanations for why each wrong answer is incorrect

CRITICAL RULES:
- LANGUAGE: Write ALL output in the SAME language as the original question
- SOLVE FIRST: For math/science/numeric questions, you MUST compute the answer step-by-step BEFORE choosing an option. Show every calculation, unit conversion, and intermediate result.
- COMPARE EACH OPTION: After solving, compare your computed result against EVERY option individually. Pick the option that matches your result exactly.
- DO NOT change the answer options — only the question text may be rewritten
- Your explanation MUST logically lead to the option you selected
- correctAnswerIndex MUST be the integer index (0, 1, 2, 3, ...) of the correct option
- For each wrong option, explain specifically what error or misconception would lead to choosing it
${SI_UNIT_NORMALIZATION_INSTRUCTIONS}
Respond in valid JSON:
{
  "question": "revised question text (SAME LANGUAGE as original)",
  "correctAnswerIndex": 0,
  "explanation": "step-by-step solution showing how you arrived at the answer",
  "optionExplanations": {
    "0": "why option 0 is correct/incorrect",
    "1": "why option 1 is correct/incorrect",
    "2": "why option 2 is correct/incorrect",
    "3": "why option 3 is correct/incorrect"
  }
}`;
              
              userPrompt = `Revise this question. IMPORTANT: Keep everything in the same language as the original question.

Question: ${q.question}
Type: ${q.type}
${hasOptions ? `Options:\n${numberedOptions}` : ""}
${sourceText ? `\nSource material (for context): ${sourceText.substring(0, 2000)}` : ""}${feedbackBlock}

STEP-BY-STEP PROCESS:
1. First, SOLVE the problem independently — show all work, calculations, formulas
2. Arrive at a concrete answer/value
3. Compare your answer against each option (Option 0, Option 1, Option 2, Option 3)
4. Set correctAnswerIndex to the index of the matching option
5. Write the explanation showing your solution process
6. For each wrong option, explain what specific error would lead to that answer

Return correctAnswerIndex as a NUMBER (0, 1, 2, or 3), not the option text.`;
            } else {
              systemPrompt = `You are an expert answer verifier. Your job is to independently determine the correct answer for a quiz question and write explanations. You must NOT change the question text or answer options.

CRITICAL RULES:
- LANGUAGE: Write ALL output in the SAME language as the original question
- SOLVE FIRST: For math/science/numeric questions, you MUST compute the answer step-by-step BEFORE choosing an option. Show every calculation, unit conversion, formula, and intermediate result.
- COMPARE EACH OPTION: After solving, compare your computed result against EVERY option individually. Pick the option whose value matches your computed result.
- For numeric options: check if your result matches the number AND unit in each option (e.g., 0.05kg vs 5kg vs 50g — these are all different)
- DO NOT trust the currently marked answer — solve independently
- Your explanation MUST logically lead to the option you selected
- correctAnswerIndex MUST be the integer index (0, 1, 2, 3, ...) of the correct option
${SI_UNIT_NORMALIZATION_INSTRUCTIONS}
Respond in valid JSON:
{
  "correctAnswerIndex": 0,
  "computedValue": "Your raw computed answer with units for numeric questions, e.g. '0.05kg', '3600s'. Empty string for non-numeric.",
  "explanation": "step-by-step solution showing how you arrived at the answer",
  "optionExplanations": {
    "0": "why option 0 is correct/incorrect",
    "1": "why option 1 is correct/incorrect",
    "2": "why option 2 is correct/incorrect",
    "3": "why option 3 is correct/incorrect"
  }
}`;
              
              userPrompt = `Determine the correct answer for this question. IMPORTANT: Keep everything in the same language as the original question.

Question: ${q.question}
Type: ${q.type}
${hasOptions ? `Options:\n${numberedOptions}` : ""}
${sourceText ? `\nSource material (for context): ${sourceText.substring(0, 2000)}` : ""}${feedbackBlock}

STEP-BY-STEP PROCESS:
1. First, SOLVE the problem independently — show all work, calculations, formulas
2. Arrive at a concrete answer/value
3. Compare your answer against EACH option individually:
   - For each option, state whether it matches your computed result and why
4. Set correctAnswerIndex to the index of the option that matches
5. Write the explanation showing your solution process

IMPORTANT: Return correctAnswerIndex as a NUMBER (0, 1, 2, or 3), not the option text. Do NOT assume the currently marked answer is correct.`;
            }

            const completion = await openai.chat.completions.create({
              model: "gpt-4o-mini",
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt },
              ],
              temperature: 0.2,
              max_tokens: 2500,
              response_format: { type: "json_object" },
            });

            const content = completion.choices[0]?.message?.content;
            if (!content) throw new Error("No response from AI");

            const parsed = JSON.parse(content);

            if (!parsed.explanation) {
              throw new Error("Invalid AI response: missing explanation");
            }

            let resolvedAnswer: string;

            if (hasOptions && parsed.correctAnswerIndex !== undefined) {
              const answerIdx = typeof parsed.correctAnswerIndex === "string" 
                ? parseInt(parsed.correctAnswerIndex, 10) 
                : parsed.correctAnswerIndex;
              
              if (typeof answerIdx === "number" && answerIdx >= 0 && answerIdx < q.options!.length) {
                resolvedAnswer = q.options![answerIdx];
                console.log(`[AI REVISE] Q${idx + 1}: AI selected option ${answerIdx} = "${resolvedAnswer}"`);
              } else {
                console.warn(`[AI REVISE] Q${idx + 1}: Invalid correctAnswerIndex ${parsed.correctAnswerIndex}, falling back to text match`);
                resolvedAnswer = parsed.correctAnswer || q.correctAnswer;
                if (q.options && !q.options.includes(resolvedAnswer)) {
                  const match = q.options.find(opt =>
                    opt.toLowerCase().includes(resolvedAnswer.toLowerCase()) ||
                    resolvedAnswer.toLowerCase().includes(opt.toLowerCase())
                  );
                  resolvedAnswer = match || q.correctAnswer;
                }
              }
            } else if (q.type === "short_answer") {
              resolvedAnswer = parsed.correctAnswer || q.correctAnswer;
            } else {
              resolvedAnswer = parsed.correctAnswer || q.correctAnswer;
              if (q.options && !q.options.includes(resolvedAnswer)) {
                const match = q.options.find(opt =>
                  opt.toLowerCase().includes(resolvedAnswer.toLowerCase()) ||
                  resolvedAnswer.toLowerCase().includes(opt.toLowerCase())
                );
                resolvedAnswer = match || q.correctAnswer;
              }
            }

            if (q.type === "true_false") {
              const lower = resolvedAnswer.toLowerCase();
              if (["true", "t", "yes", "đúng", "correct", "right"].includes(lower)) {
                resolvedAnswer = "True";
              } else {
                resolvedAnswer = "False";
              }
            }

            const wrongAnswerExplanations: Record<string, string> = {};
            if (parsed.optionExplanations && q.options) {
              for (let i = 0; i < q.options.length; i++) {
                const optText = q.options[i];
                if (optText !== resolvedAnswer && parsed.optionExplanations[String(i)]) {
                  wrongAnswerExplanations[optText] = parsed.optionExplanations[String(i)];
                }
              }
            } else if (parsed.wrongAnswerExplanations) {
              Object.assign(wrongAnswerExplanations, parsed.wrongAnswerExplanations);
            }

            let codeChangedAnswer = false;
            if (hasOptions && hasNumericOptions(q.options!)) {
              const aiComputedVal = parsed.computedValue ? String(parsed.computedValue).trim() : resolvedAnswer;
              const codeResult = codeSelectNumericAnswer(
                aiComputedVal,
                q.options!.map((o: string) => String(o)),
                resolvedAnswer
              );
              if (codeResult) {
                if (codeResult.wasChanged) {
                  console.warn(`[AI REVISE CODE-SELECT] Q${idx + 1}: Code selected "${codeResult.selectedAnswer}" (AI chose "${resolvedAnswer}", computedValue: "${aiComputedVal}")`);
                  resolvedAnswer = codeResult.selectedAnswer;
                  codeChangedAnswer = true;
                } else {
                  console.log(`[AI REVISE CODE-SELECT] Q${idx + 1}: Code confirmed "${resolvedAnswer}"`);
                }
              } else {
                console.warn(`[AI REVISE CODE-SELECT] Q${idx + 1}: Could not parse computedValue "${aiComputedVal}" — keeping AI selection`);
              }
            }

            let finalExplanation = parsed.explanation;
            let finalWrongExplanations = wrongAnswerExplanations;

            if (codeChangedAnswer && hasOptions) {
              const newIdx = q.options!.indexOf(resolvedAnswer);
              if (newIdx !== -1) {
                const explResult = await generateExplanationForAnswer(
                  String(q.question),
                  q.options!.map((o: string) => String(o)),
                  resolvedAnswer,
                  newIdx,
                );
                if (explResult) {
                  finalExplanation = explResult.explanation;
                  finalWrongExplanations = explResult.wrongAnswerExplanations;
                  console.log(`[AI REVISE] Q${idx + 1}: Regenerated explanation for code-selected answer "${resolvedAnswer}"`);
                }
              }
            }

            const prevAnswer = q.correctAnswer;
            if (prevAnswer !== resolvedAnswer) {
              console.log(`[AI REVISE] Q${idx + 1}: Answer CHANGED from "${prevAnswer}" to "${resolvedAnswer}"`);
            } else {
              console.log(`[AI REVISE] Q${idx + 1}: Answer unchanged: "${resolvedAnswer}"`);
            }

            return {
              ...q,
              ...(mode === "full" && parsed.question ? { question: parsed.question } : {}),
              correctAnswer: resolvedAnswer,
              explanation: finalExplanation,
              wrongAnswerExplanations: finalWrongExplanations,
            };
          },
          {
            retries: 2,
            minTimeout: 1000,
            maxTimeout: 5000,
            factor: 2,
            onFailedAttempt: (error: any) => {
              console.log(`[AI REVISE] Q${idx + 1} retry (attempt ${error.attemptNumber}): ${error.message}`);
              if (!isRateLimitError(error)) throw error;
            },
          }
        );
        console.log(`[AI REVISE] Q${idx + 1} revised successfully (mode: ${mode})`);
        return revised;
      } catch (error) {
        console.error(`[AI REVISE] Q${idx + 1} failed, keeping original:`, error);
        return q;
      }
    }))
  );

  return revisedQuestions;
}

export async function convertQuestionType(params: {
  question: Question;
  newType: QuestionType;
  sourceText?: string;
}): Promise<Question> {
  const { question, newType, sourceText } = params;

  const typeLabels: Record<string, string> = {
    multiple_choice: "multiple choice (4 options)",
    true_false: "true/false",
    short_answer: "short answer",
  };

  const formatInstructions: Record<string, string> = {
    multiple_choice: `"options": ["Option A", "Option B", "Option C", "Option D"], "correctAnswer": "the correct option text"`,
    true_false: `"options": ["True", "False"], "correctAnswer": "True" or "False"`,
    short_answer: `"options": null, "correctAnswer": "the correct short answer"`,
  };

  const systemPrompt = `You are an expert quiz question converter. Convert the given question into a ${typeLabels[newType]} question while preserving the same topic, concept, and difficulty level.

CRITICAL RULES:
- LANGUAGE: Write ALL output in the SAME language as the original question
- The converted question must test the same concept/knowledge as the original
- Write a clear, unambiguous question appropriate for the target type
- Provide a thorough explanation
${newType === "true_false" ? "- For true/false: create a clear statement that is unambiguously true or false. correctAnswer MUST be exactly \"True\" or \"False\"" : ""}
${newType === "multiple_choice" ? "- For multiple choice: create 4 plausible options of similar length. Include common misconceptions as distractors" : ""}
${newType === "short_answer" ? "- For short answer: ensure the answer is a concise, specific term or phrase" : ""}

Respond in valid JSON:
{
  "question": "the converted question text",
  ${formatInstructions[newType]},
  "explanation": "detailed explanation of the correct answer"
}`;

  const userPrompt = `Convert this ${typeLabels[question.type]} question into a ${typeLabels[newType]} question:

Question: ${question.question}
${question.options ? `Current Options: ${JSON.stringify(question.options)}` : ""}
Current Answer: ${question.correctAnswer}
${question.explanation ? `Explanation: ${question.explanation}` : ""}
${sourceText ? `\nSource material (for context): ${sourceText.substring(0, 2000)}` : ""}

Write in the SAME language as the question above.`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4.1",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.3,
    max_tokens: 1500,
    response_format: { type: "json_object" },
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) throw new Error("No response from AI");

  const parsed = JSON.parse(content);

  let correctAnswer = String(parsed.correctAnswer).trim();
  let options: string[] | undefined;

  if (newType === "true_false") {
    options = ["True", "False"];
    const lower = correctAnswer.toLowerCase();
    if (["true", "t", "yes", "đúng", "correct", "right"].includes(lower)) {
      correctAnswer = "True";
    } else {
      correctAnswer = "False";
    }
  } else if (newType === "multiple_choice") {
    options = Array.isArray(parsed.options) ? parsed.options.map((o: any) => String(o).trim()) : undefined;
  } else {
    options = undefined;
  }

  return {
    ...question,
    type: newType,
    question: String(parsed.question).trim(),
    options,
    correctAnswer,
    explanation: parsed.explanation ? String(parsed.explanation).trim() : question.explanation,
    wrongAnswerExplanations: undefined,
  };
}

