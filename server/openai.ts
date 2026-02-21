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

function normalizeValue(v: string): string {
  return v.toLowerCase().replace(/,/g, ".").replace(/\s+/g, "").replace(/\.+$/, "");
}

function extractNumericParts(s: string): { number: string; unit: string } {
  const norm = normalizeValue(s);
  const match = norm.match(/^([0-9]*\.?[0-9]+)\s*(.*)$/);
  if (match) {
    return { number: match[1], unit: match[2] };
  }
  return { number: norm, unit: "" };
}

function stripOptionPrefix(s: string): string {
  return s.replace(/^[A-Da-d]\)\s*/, "").trim();
}

function valuesMatch(a: string, b: string): boolean {
  const cleanA = stripOptionPrefix(a);
  const cleanB = stripOptionPrefix(b);
  const normA = normalizeValue(cleanA);
  const normB = normalizeValue(cleanB);
  if (normA === normB) return true;

  const partsA = extractNumericParts(cleanA);
  const partsB = extractNumericParts(cleanB);

  if (partsA.number && partsB.number) {
    const numA = parseFloat(partsA.number);
    const numB = parseFloat(partsB.number);
    if (!isNaN(numA) && !isNaN(numB) && numA === numB) {
      if (partsA.unit === partsB.unit || partsA.unit === "" || partsB.unit === "") {
        return true;
      }
    }
  }
  return false;
}

export function verifyAnswerMatchesExplanation(
  explanation: string,
  markedCorrect: string,
  options: string[]
): string | null {
  const allMatches = explanation.match(/[=→⇒]\s*([0-9]+[.,]?[0-9]*)\s*(kg|g|m|cm|mm|km|m\/s|m\/s²|km\/h|s|n|j|w|v|a|hz|rad|mol|l|ml|°c|°f|k|pa|atm|ev|cal|%|nm|μm)?\.?(?=[\s,;.)⇒→=]|$)/gi);

  if (!allMatches || allMatches.length === 0) return null;

  const lastMatch = allMatches[allMatches.length - 1];
  const conclusionRaw = lastMatch.replace(/^[=→⇒]\s*/, "").replace(/\.+$/, "").trim();

  console.log(`[VERIFY] Explanation last conclusion: "${conclusionRaw}", markedCorrect: "${markedCorrect}"`);

  if (valuesMatch(conclusionRaw, markedCorrect)) {
    return null;
  }

  for (const opt of options) {
    if (valuesMatch(conclusionRaw, opt) && opt !== markedCorrect) {
      return opt;
    }
  }

  const lastSentence = explanation.split(/[.!。]\s*/).filter(s => s.trim().length > 0).pop() || "";
  for (const opt of options) {
    if (opt !== markedCorrect && valuesMatch(lastSentence, opt)) {
      return opt;
    }
  }

  return null;
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
3. Find the option that matches YOUR calculated/determined answer
4. Compare with the "markedCorrect" — if they differ, output YOUR answer
5. If the answer changed, write a corrected explanation that supports the new answer

CRITICAL NUMERIC/UNIT RULES:
- 50g = 0.05kg (NOT 5kg) — always check decimal places and unit conversions
- 0.05kg and 0,05kg are the SAME value (comma vs period decimal notation)
- When converting: g→kg divide by 1000, kg→g multiply by 1000, cm→m divide by 100, mm→cm divide by 10
- Common AI mistakes: off by factor of 10, 100, or 1000 in unit conversions
- For calculations: re-do the arithmetic yourself, don't trust the explanation
- The correct answer must have the right NUMBER and the right UNIT
- If explanation says "50g = 0,05kg" but markedCorrect is "5kg", the correct answer is the option with "0,05kg" NOT "5kg"

Questions to verify:
${JSON.stringify(verificationItems, null, 2)}

Respond with ONLY a JSON array. For each question:
- "correctAnswer": the EXACT text from the options array
- "explanation": if changed, a corrected explanation; if unchanged, copy the original
- "wrongAnswerExplanations": object mapping each WRONG option text (without prefix) to why it's wrong
[{"index": 0, "correctAnswer": "exact option text", "explanation": "why correct", "wrongAnswerExplanations": {"wrong opt text": "why wrong", ...}}, ...]`;

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
        if (typeof v.index === "number" && typeof v.correctAnswer === "string") {
          const q = mcQuestions[v.index];
          if (q) {
            const options = q.options.map((o: any) => String(o).trim());
            const verifiedAnswer = v.correctAnswer.trim();
            const markedCorrect = String(q.correctAnswer).trim();

            if (verifiedAnswer !== markedCorrect && options.includes(verifiedAnswer)) {
              console.warn(`${logPrefix} Question "${String(q.question).substring(0, 60)}..." — changing answer from "${markedCorrect}" to "${verifiedAnswer}"`);
              q.correctAnswer = verifiedAnswer;
            }

            if (v.explanation && typeof v.explanation === "string" && v.explanation.trim().length > 10) {
              q.explanation = v.explanation.trim();
            }

            if (v.wrongAnswerExplanations && typeof v.wrongAnswerExplanations === "object") {
              q.wrongAnswerExplanations = {};
              for (const [key, val] of Object.entries(v.wrongAnswerExplanations)) {
                if (val && typeof val === "string") {
                  q.wrongAnswerExplanations[String(key).trim()] = String(val).trim();
                }
              }
            }
            
            const finalCorrect = String(q.correctAnswer).trim();
            if (!q.wrongAnswerExplanations) q.wrongAnswerExplanations = {};
            for (const opt of options) {
              if (opt === finalCorrect) continue;
              const optText = opt.replace(/^[A-D]\)\s*/, "").trim();
              const hasExplanation = q.wrongAnswerExplanations[optText] || q.wrongAnswerExplanations[opt];
              if (!hasExplanation) {
                q.wrongAnswerExplanations[optText] = `This is incorrect. The correct answer is ${finalCorrect.replace(/^[A-D]\)\s*/, "").trim()}.`;
              }
            }
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
- Step 3: DECIDE which option is the correct answer and set "correctAnswer" — this is your commitment, do NOT change it later
- Step 4: All other options are now wrong. Write "explanation" to explain why correctAnswer is right (for math/science, show the full calculation that arrives at the correctAnswer value)
- Step 5: Write "wrongAnswerExplanations" — for EACH wrong option, explain the specific mistake or misconception that would lead someone to pick it

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
      "correctAnswer": "The exact correct option text (decided FIRST, without any prefix). For true_false questions, MUST be exactly \"True\" or \"False\".",
      "explanation": "Why correctAnswer is right. For math/science: show full calculation arriving at the correctAnswer value.",
      "wrongAnswerExplanations": {
        "Wrong option 1 text": "The specific mistake that leads to this wrong value",
        "Wrong option 2 text": "The specific mistake that leads to this wrong value",
        "Wrong option 3 text": "The specific mistake that leads to this wrong value"
      }
    }
  ]
}

IMPORTANT: For true_false questions, the options MUST be ["True", "False"] and correctAnswer MUST be exactly "True" or "False" (capitalized).

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
- Step 3: DECIDE which option is the correct answer and set "correctAnswer" — this is your commitment, do NOT change it later
- Step 4: All other options are now wrong. Write "explanation" to explain why correctAnswer is right (for math/science, show the full calculation that arrives at the correctAnswer value)
- Step 5: Write "wrongAnswerExplanations" — for EACH wrong option, explain the specific mistake or misconception that would lead someone to pick it

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
      "correctAnswer": "The exact correct option text (decided FIRST, without any prefix). For true_false questions, MUST be exactly \"True\" or \"False\".",
      "explanation": "Why correctAnswer is right. For math/science: show full calculation arriving at the correctAnswer value.",
      "wrongAnswerExplanations": {
        "Wrong option 1 text": "The specific mistake that leads to this wrong value",
        "Wrong option 2 text": "The specific mistake that leads to this wrong value",
        "Wrong option 3 text": "The specific mistake that leads to this wrong value"
      },
      "imageIndex": 0
    }
  ]
}

IMPORTANT: For true_false questions, the options MUST be ["True", "False"] and correctAnswer MUST be exactly "True" or "False" (capitalized).

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
- Step 3: DECIDE which option is the correct answer and set "correctAnswer" — this is your commitment, do NOT change it later
- Step 4: All other options are now wrong. Write "explanation" to explain why correctAnswer is right (for math/science, show the full calculation that arrives at the correctAnswer value)
- Step 5: Write "wrongAnswerExplanations" — for EACH wrong option, explain the specific mistake or misconception that would lead someone to pick it

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
      "correctAnswer": "The exact correct option text (decided FIRST, without any prefix). For true_false questions, MUST be exactly \"True\" or \"False\".",
      "explanation": "Why correctAnswer is right. For math/science: show full calculation arriving at the correctAnswer value.",
      "wrongAnswerExplanations": {
        "Wrong option 1 text": "The specific mistake that leads to this wrong value",
        "Wrong option 2 text": "The specific mistake that leads to this wrong value",
        "Wrong option 3 text": "The specific mistake that leads to this wrong value"
      },
      "imageIndex": 0
    }
  ]
}

IMPORTANT: For true_false questions, the options MUST be ["True", "False"] and correctAnswer MUST be exactly "True" or "False" (capitalized).

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

    onProgress?.("verifying", 85, "Verifying answer accuracy...");
    const mcQuestions = rawQuestions.filter((q: any) => 
      q.type === "multiple_choice" && q.explanation && q.correctAnswer && Array.isArray(q.options)
    );
    await aiVerifyAnswers(mcQuestions, "[AI VERIFY]");

    for (const q of mcQuestions) {
      const fixedAnswer = verifyAnswerMatchesExplanation(String(q.explanation), String(q.correctAnswer), q.options.map((o: any) => String(o)));
      if (fixedAnswer && fixedAnswer !== q.correctAnswer) {
        console.warn(`[REGEX VERIFY] Correcting answer: "${q.correctAnswer}" -> "${fixedAnswer}" for: "${String(q.question).substring(0, 60)}..."`);
        q.correctAnswer = fixedAnswer;
      }
    }

    for (const q of rawQuestions) {
      if (!q.type || !q.question || !q.correctAnswer) {
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

      let options =
        q.type === "multiple_choice" && Array.isArray(q.options)
          ? q.options.map((o: any) => String(o).trim())
          : undefined;

      let correctAnswer = String(q.correctAnswer).trim();

      // Programmatically shuffle options to ensure maximum randomness
      if (q.type === "multiple_choice" && options && options.length > 0) {
        // Find the index of the current correct answer
        // Note: AI usually returns "A) Text" or just "Text"
        const currentCorrectAns = correctAnswer;
        const currentOptions = options;
        const correctIndex = currentOptions.findIndex(
          (o: string) =>
            o === currentCorrectAns ||
            o.split(") ")[1] === currentCorrectAns ||
            currentCorrectAns.includes(o),
        );

        if (correctIndex !== -1) {
          const correctText = currentOptions[correctIndex].replace(
            /^[A-D]\) /,
            "",
          );
          const plainOptions = currentOptions.map((o: string) =>
            o.replace(/^[A-D]\) /, ""),
          );

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
      "options": ["Option 1", "Option 2", "Option 3", "Option 4"], // For multiple_choice/true_false only. Extract exactly as they appear, but REMOVE any prefixes like "A) ", "1. ", "a. ", etc. For short_answer, omit this field or use empty array.
      "correctAnswer": "The exact full text of the correct option (without any prefix)",
      "explanation": "Brief explanation of why this is the correct answer",
      "wrongAnswerExplanations": {
        "Option 1": "Why this option is incorrect",
        "Option 2": "Why this option is incorrect"
      }
    }
  ]
}

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
      "options": ["Option 1", "Option 2", "Option 3", "Option 4"], // For multiple_choice/true_false only. Extract exactly as they appear, but REMOVE any prefixes. For short_answer, omit this field or use empty array.
      "correctAnswer": "The exact full text of the correct option (without any prefix)",
      "explanation": "Brief explanation of why this is the correct answer",
      "wrongAnswerExplanations": {
        "Option 1": "Why this option is incorrect",
        "Option 2": "Why this option is incorrect"
      }
    }
  ]
}

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

    const importMcQuestions = parsed.questions.filter((q: any) =>
      q.explanation && q.correctAnswer && Array.isArray(q.options) && q.options.length > 0
    );
    await aiVerifyAnswers(importMcQuestions, "[IMPORT AI VERIFY]");

    for (const q of importMcQuestions) {
      const fixedAnswer = verifyAnswerMatchesExplanation(String(q.explanation), String(q.correctAnswer), q.options.map((o: any) => String(o)));
      if (fixedAnswer && fixedAnswer !== q.correctAnswer) {
        console.warn(`[IMPORT REGEX VERIFY] Correcting answer: "${q.correctAnswer}" -> "${fixedAnswer}" for: "${String(q.question).substring(0, 60)}..."`);
        q.correctAnswer = fixedAnswer;
      }
    }

    for (const q of parsed.questions) {
      if (!q.question || !q.correctAnswer) {
        console.warn(
          "Skipping malformed question (missing question or answer):",
          q,
        );
        continue;
      }

      let options =
        Array.isArray(q.options) && q.options.length > 0
          ? q.options.map((o: any) => String(o).trim())
          : undefined;

      // Auto-detect question type based on options
      let questionType: QuestionType = "multiple_choice";
      
      if (!options || options.length === 0) {
        // No options = short answer
        questionType = "short_answer";
        options = undefined;
      } else if (options.length === 2) {
        // Check if it's true/false
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

      let correctAnswer = String(q.correctAnswer).trim();
      
      // Normalize correct answer for true/false questions
      if (questionType === "true_false") {
        const lowerAnswer = correctAnswer.toLowerCase();
        if (["true", "t", "yes", "đúng"].includes(lowerAnswer)) {
          correctAnswer = "True";
        } else if (["false", "f", "no", "sai"].includes(lowerAnswer)) {
          correctAnswer = "False";
        }
      }

      // Programmatically shuffle options to ensure maximum randomness even for imported quizzes
      if (questionType === "multiple_choice" && options && options.length > 0) {
        const currentCorrectAns = correctAnswer;
        const currentOptions = options;
        const correctIndex = currentOptions.findIndex(
          (o: string) =>
            o === currentCorrectAns ||
            o.split(") ")[1] === currentCorrectAns ||
            currentCorrectAns.includes(o),
        );

        if (correctIndex !== -1) {
          const correctText = currentOptions[correctIndex].replace(
            /^[A-D]\) /,
            "",
          );
          const plainOptions = currentOptions.map((o: string) =>
            o.replace(/^[A-D]\) /, ""),
          );

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
            wrongAnswerExplanations[String(key).trim()] = String(value).trim();
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
            let systemPrompt: string;
            let userPrompt: string;

            if (mode === "full") {
              systemPrompt = `You are an expert quiz question writer and verifier. Your job is to revise a quiz question. You must:
1. Rewrite the question to be clearer and more precise
2. Independently solve the problem to determine the correct answer
3. Write a thorough explanation that shows the full solution process
4. Generate explanations for why each wrong answer is incorrect

CRITICAL RULES:
- LANGUAGE: You MUST write ALL output (question, explanation, wrongAnswerExplanations) in the SAME language as the original question. If the question is in Vietnamese, respond in Vietnamese. If in Spanish, respond in Spanish. Never switch to English unless the original is in English.
- You MUST independently solve the problem and determine the correct answer — the correct answer must follow logically from your explanation
- Your explanation MUST match your chosen correct answer exactly
- For math/science: show all calculations step-by-step and verify the final answer
- For unit conversions: double-check every conversion factor
- The correct answer must be one of the provided options (do not change the options themselves)
- If the user provided feedback, consider it but still verify correctness independently

Respond in valid JSON with this exact structure:
{
  "question": "revised question text (SAME LANGUAGE as original)",
  "correctAnswer": "the correct option (must be one of the provided options, verbatim)",
  "explanation": "detailed explanation (SAME LANGUAGE as original question)",
  "wrongAnswerExplanations": { "wrong option text": "why this is wrong (SAME LANGUAGE)", ... }
}`;
              
              userPrompt = `Revise this question completely. IMPORTANT: Keep everything in the same language as the original question — do NOT translate to English.

Question: ${q.question}
Type: ${q.type}
${q.options ? `Options: ${JSON.stringify(q.options)}` : ""}
Current correct answer: ${q.correctAnswer}
${sourceText ? `\nSource material (for context): ${sourceText.substring(0, 2000)}` : ""}${feedbackBlock}

Remember: Independently solve the problem and pick the correct answer from the existing options. The correct answer MUST match your explanation. Show your work. Write in the SAME language as the question above.`;
            } else {
              systemPrompt = `You are an expert answer verifier. Your job is to independently determine the correct answer for a quiz question and write proper explanations. You must NOT change the question text or answer options — only determine which answer is correct and write explanations.

CRITICAL RULES:
- LANGUAGE: You MUST write ALL output (explanation, wrongAnswerExplanations) in the SAME language as the original question. If the question is in Vietnamese, respond in Vietnamese. If in Spanish, respond in Spanish. Never switch to English unless the original is in English.
- Independently solve the problem — do NOT trust the currently marked answer
- Your explanation MUST match your chosen correct answer exactly
- The correct answer must follow logically from your explanation
- For math/science: show all calculations step-by-step
- For unit conversions: double-check every conversion factor
- The correct answer must be one of the provided options (verbatim)
- If the user provided feedback, consider it but still verify correctness independently

Respond in valid JSON with this exact structure:
{
  "correctAnswer": "the correct option (must be one of the provided options, verbatim)",
  "explanation": "detailed explanation (SAME LANGUAGE as the question)",
  "wrongAnswerExplanations": { "wrong option text": "why this is wrong (SAME LANGUAGE)", ... }
}`;
              
              userPrompt = `Determine the correct answer and write explanations for this question. IMPORTANT: Keep everything in the same language as the original question — do NOT translate to English.

Question: ${q.question}
Type: ${q.type}
${q.options ? `Options: ${JSON.stringify(q.options)}` : ""}
Currently marked correct: ${q.correctAnswer}
${sourceText ? `\nSource material (for context): ${sourceText.substring(0, 2000)}` : ""}${feedbackBlock}

Independently solve this and determine which option is actually correct. The correct answer MUST match your explanation. Show your full reasoning. Write in the SAME language as the question above.`;
            }

            const completion = await openai.chat.completions.create({
              model: "gpt-4o-mini",
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt },
              ],
              temperature: 0.3,
              max_tokens: 2000,
              response_format: { type: "json_object" },
            });

            const content = completion.choices[0]?.message?.content;
            if (!content) throw new Error("No response from AI");

            const parsed = JSON.parse(content);

            if (!parsed.explanation) {
              throw new Error("Invalid AI response: missing explanation");
            }

            const finalAnswer = parsed.correctAnswer;
            if (!finalAnswer) {
              throw new Error("Invalid AI response: missing correctAnswer");
            }

            let resolvedAnswer = finalAnswer;
            if (q.options && !q.options.includes(resolvedAnswer)) {
              console.log(`[AI REVISE] Q${idx + 1}: AI picked answer not in options, finding closest match`);
              const match = q.options.find(opt => 
                opt.toLowerCase().includes(resolvedAnswer.toLowerCase()) ||
                resolvedAnswer.toLowerCase().includes(opt.toLowerCase())
              );
              resolvedAnswer = match || q.correctAnswer;
            }

            if (q.type === "true_false") {
              const lower = resolvedAnswer.toLowerCase();
              if (["true", "t", "yes", "đúng", "correct", "right"].includes(lower)) {
                resolvedAnswer = "True";
              } else {
                resolvedAnswer = "False";
              }
            }

            return {
              ...q,
              ...(mode === "full" && parsed.question ? { question: parsed.question } : {}),
              correctAnswer: resolvedAnswer,
              explanation: parsed.explanation,
              wrongAnswerExplanations: parsed.wrongAnswerExplanations || {},
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

