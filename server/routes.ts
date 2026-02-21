import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./auth";
import { sendContactEmail } from "./email";
import multer from "multer";
import { createWorker } from "tesseract.js";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { parseOffice } from "officeparser";
import { generateQuizQuestions, importExistingQuiz, quizChatResponse, classifyImages, reviseQuizQuestions, convertQuestionType } from "./openai";
import { generateQuizRequestSchema, submitQuizRequestSchema } from "@shared/schema";
import type { Question, DifficultyLevel } from "@shared/schema";
import { createJob, getJob, storeBuffer, processJob, deleteJob } from "./upload-jobs";
import crypto from "crypto";
import { fetchTranscript } from "youtube-transcript-plus";
import TranscriptClient from "youtube-transcript-api";
import ytdl from "@distube/ytdl-core";
import { Readable } from "stream";
import OpenAI from "openai";
import fs from "fs";
import path from "path";
import os from "os";

const openaiClient = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const MAX_AUDIO_SIZE_MB = 20; // Max 20MB audio file
const MAX_DOWNLOAD_TIMEOUT_MS = 60000; // 60 second timeout for downloads

async function transcribeYouTubeAudio(videoId: string): Promise<string> {
  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const tempDir = os.tmpdir();
  const tempFilePath = path.join(tempDir, `youtube_${videoId}_${Date.now()}.mp3`);
  
  try {
    // First check video info to validate duration
    const info = await ytdl.getInfo(videoUrl);
    const durationSeconds = parseInt(info.videoDetails.lengthSeconds, 10);
    
    // Limit to 15 minutes max for transcription
    if (durationSeconds > 900) {
      throw new Error("Video is too long. Audio transcription is limited to videos under 15 minutes.");
    }
    
    // Download audio stream with size limit and timeout
    const audioStream = ytdl(videoUrl, {
      filter: 'audioonly',
      quality: 'lowestaudio',
    });
    
    // Write to temp file with size limit
    const writeStream = fs.createWriteStream(tempFilePath);
    let downloadedBytes = 0;
    const maxBytes = MAX_AUDIO_SIZE_MB * 1024 * 1024;
    
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        audioStream.destroy();
        writeStream.close();
        reject(new Error("Download timed out. Please try a shorter video."));
      }, MAX_DOWNLOAD_TIMEOUT_MS);
      
      audioStream.on('data', (chunk: Buffer) => {
        downloadedBytes += chunk.length;
        if (downloadedBytes > maxBytes) {
          clearTimeout(timeout);
          audioStream.destroy();
          writeStream.close();
          reject(new Error("Audio file too large. Please try a shorter video."));
        }
      });
      
      audioStream.pipe(writeStream);
      writeStream.on('finish', () => {
        clearTimeout(timeout);
        resolve();
      });
      writeStream.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
      audioStream.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
    
    // Transcribe using OpenAI Whisper
    const transcription = await openaiClient.audio.transcriptions.create({
      file: fs.createReadStream(tempFilePath),
      model: "gpt-4o-mini-transcribe",
      response_format: "json",
    });
    
    return transcription.text;
  } finally {
    // Clean up temp file
    try {
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
    } catch (e) {
      console.error("Failed to clean up temp file:", e);
    }
  }
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/jpg",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/msword",
      "application/vnd.ms-powerpoint",
      "application/vnd.ms-excel",
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only PDF, images, and Office documents (docx, pptx, xlsx) are allowed."));
    }
  },
});

async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  try {
    const data = new Uint8Array(buffer);
    const loadingTask = pdfjsLib.getDocument({ data });
    const pdf = await loadingTask.promise;
    
    let fullText = "";
    
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      
      let lastY: number | null = null;
      const pageTextParts: string[] = [];
      
      for (const item of content.items as any[]) {
        if (item.str) {
          if (lastY !== null && Math.abs(item.transform[5] - lastY) > 5) {
            pageTextParts.push("\n");
          } else if (pageTextParts.length > 0 && !pageTextParts[pageTextParts.length - 1].endsWith(" ")) {
            pageTextParts.push(" ");
          }
          pageTextParts.push(item.str);
          lastY = item.transform[5];
        }
      }
      
      fullText += pageTextParts.join("") + "\n\n";
    }
    
    return fullText
      .replace(/\s+/g, " ")
      .replace(/\n\s*\n/g, "\n\n")
      .trim();
  } catch (error) {
    console.error("PDF extraction error:", error);
    throw new Error("Failed to extract text from PDF");
  }
}

let tesseractWorker: Awaited<ReturnType<typeof createWorker>> | null = null;

async function getOCRWorker() {
  if (!tesseractWorker) {
    tesseractWorker = await createWorker("eng+vie");
  }
  return tesseractWorker;
}

async function extractTextFromImage(buffer: Buffer): Promise<string> {
  try {
    const worker = await getOCRWorker();
    const { data: { text } } = await worker.recognize(buffer);
    return text.trim();
  } catch (error) {
    console.error("OCR error:", error);
    if (tesseractWorker) {
      try { await tesseractWorker.terminate(); } catch {}
      tesseractWorker = null;
    }
    throw new Error("Failed to extract text from image");
  }
}

async function extractTextFromOfficeDocument(buffer: Buffer): Promise<string> {
  try {
    const result = await parseOffice(buffer);
    const text = typeof result === 'string' ? result : String(result);
    return text.trim();
  } catch (error) {
    console.error("Office document extraction error:", error);
    throw new Error("Failed to extract text from document");
  }
}

async function extractTextFromBase64Image(base64Url: string): Promise<string> {
  try {
    // Extract base64 data from data URL
    const matches = base64Url.match(/^data:image\/[^;]+;base64,(.+)$/);
    if (!matches) {
      console.warn("Invalid base64 image URL format");
      return "";
    }
    const base64Data = matches[1];
    const buffer = Buffer.from(base64Data, "base64");
    return await extractTextFromImage(buffer);
  } catch (error) {
    console.error("Error extracting text from base64 image:", error);
    return "";
  }
}

async function extractTextFromTextOnlyImages(
  imageUrls: string[],
  onProgress?: (step: string, progress: number, message: string) => void
): Promise<string> {
  if (imageUrls.length === 0) return "";
  
  onProgress?.("extracting", 20, "Extracting text from images...");
  
  const textParts: string[] = [];
  for (const url of imageUrls) {
    const text = await extractTextFromBase64Image(url);
    if (text) {
      textParts.push(text);
    }
  }
  
  return textParts.join("\n\n");
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Setup custom auth
  setupAuth(app);

  // Public config endpoint for frontend (Google Client ID is public, not sensitive)
  app.get("/api/config", (req, res) => {
    res.json({
      googleClientId: process.env.GOOGLE_CLIENT_ID || "",
    });
  });

  // YouTube transcript extraction endpoint
  app.post("/api/youtube-transcript", async (req, res) => {
    try {
      const { url } = req.body;
      
      if (!url || typeof url !== "string") {
        return res.status(400).json({ message: "YouTube URL is required" });
      }

      // Extract video ID from various YouTube URL formats
      const videoIdMatch = url.match(
        /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/
      );
      
      if (!videoIdMatch || !videoIdMatch[1]) {
        return res.status(400).json({ message: "Invalid YouTube URL. Please provide a valid YouTube video link." });
      }

      const videoId = videoIdMatch[1];
      console.log(`[YouTube] Fetching transcript for video ${videoId}`);
      
      // Method 1: Try youtube-transcript.io API (external service - most reliable)
      const youtubeTranscriptApiKey = process.env.YOUTUBE_TRANSCRIPT_API_KEY;
      if (youtubeTranscriptApiKey) {
        try {
          console.log(`[YouTube] Trying youtube-transcript.io API for ${videoId}`);
          const response = await fetch('https://www.youtube-transcript.io/api/transcripts', {
            method: 'POST',
            headers: {
              'Authorization': `Basic ${youtubeTranscriptApiKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ ids: [videoId] })
          });
          
          if (response.ok) {
            const data = await response.json();
            if (data && Array.isArray(data) && data.length > 0 && data[0].transcript) {
              const transcriptSegments = data[0].transcript;
              const fullText = transcriptSegments
                .map((segment: { text: string }) => segment.text)
                .join(" ")
                .replace(/\s+/g, " ")
                .replace(/&#39;/g, "'")
                .replace(/&quot;/g, '"')
                .replace(/&amp;/g, '&')
                .trim();
              
              if (fullText.length >= 50) {
                console.log(`[YouTube] Successfully got transcript via youtube-transcript.io`);
                return res.json({ 
                  text: fullText,
                  videoId,
                  segmentCount: transcriptSegments.length,
                  method: "youtube_transcript_io"
                });
              }
            }
          } else {
            const errorText = await response.text();
            console.log(`[YouTube] youtube-transcript.io API failed: ${response.status} - ${errorText}`);
          }
        } catch (apiError: any) {
          console.log(`[YouTube] youtube-transcript.io API error: ${apiError.message}`);
        }
      }
      
      // Method 2: Try youtube-transcript-api npm package (uses youtube-transcript.io backend)
      try {
        console.log(`[YouTube] Trying youtube-transcript-api npm for ${videoId}`);
        const client = new TranscriptClient();
        await client.ready;
        const result = await client.getTranscript(videoId);
        
        if (result && result.transcript && result.transcript.length > 0) {
          const fullText = result.transcript
            .map((segment: { text: string }) => segment.text)
            .join(" ")
            .replace(/\s+/g, " ")
            .trim();
          
          if (fullText.length >= 50) {
            console.log(`[YouTube] Successfully got transcript via youtube-transcript-api npm`);
            return res.json({ 
              text: fullText,
              videoId,
              segmentCount: result.transcript.length,
              method: "transcript_api"
            });
          }
        }
      } catch (apiError: any) {
        console.log(`[YouTube] youtube-transcript-api npm failed: ${apiError.message}`);
      }
      
      // Method 3: Try youtube-transcript-plus (direct scraping - fallback)
      try {
        console.log(`[YouTube] Trying youtube-transcript-plus for ${videoId}`);
        let transcript;
        const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
        
        try {
          transcript = await fetchTranscript(videoId, { userAgent });
        } catch (langError: any) {
          const errorMsg = langError.message || '';
          const langMatch = errorMsg.match(/Available languages?: ([a-z, ]+)/i);
          if (langMatch) {
            const availableLangs = langMatch[1].split(',').map((l: string) => l.trim());
            console.log(`[YouTube] Trying available language: ${availableLangs[0]}`);
            transcript = await fetchTranscript(videoId, { lang: availableLangs[0], userAgent });
          } else {
            throw langError;
          }
        }
        
        if (transcript && transcript.length > 0) {
          const fullText = transcript
            .map((segment: { text: string }) => segment.text)
            .join(" ")
            .replace(/\s+/g, " ")
            .trim();

          if (fullText.length >= 50) {
            console.log(`[YouTube] Successfully got transcript via youtube-transcript-plus`);
            return res.json({ 
              text: fullText,
              videoId,
              segmentCount: transcript.length,
              method: "captions"
            });
          }
        }
      } catch (transcriptError: any) {
        console.log(`[YouTube] youtube-transcript-plus failed: ${transcriptError.message}`);
      }

      // All methods failed
      return res.status(400).json({ 
        message: "Could not fetch video transcript. The video may not have captions available, or YouTube is blocking access. Try pasting the transcript text directly instead."
      });
    } catch (error) {
      console.error("YouTube transcript error:", error);
      res.status(500).json({
        message: error instanceof Error ? error.message : "Failed to fetch YouTube transcript",
      });
    }
  });

  app.post("/api/extract-text", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const { buffer, mimetype } = req.file;
      let extractedText = "";

      if (mimetype === "application/pdf") {
        extractedText = await extractTextFromPDF(buffer);
      } else if (mimetype.startsWith("image/")) {
        extractedText = await extractTextFromImage(buffer);
      } else if (
        mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        mimetype === "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
        mimetype === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
        mimetype === "application/msword" ||
        mimetype === "application/vnd.ms-powerpoint" ||
        mimetype === "application/vnd.ms-excel"
      ) {
        extractedText = await extractTextFromOfficeDocument(buffer);
      } else {
        return res.status(400).json({ message: "Unsupported file type" });
      }

      if (!extractedText || extractedText.length < 50) {
        return res.status(400).json({
          message: "Could not extract enough text from the document. Please try a different file with more readable content.",
        });
      }

      res.json({ text: extractedText });
    } catch (error) {
      console.error("Text extraction error:", error);
      res.status(500).json({
        message: error instanceof Error ? error.message : "Failed to extract text from file",
      });
    }
  });

  app.post("/api/upload-async", upload.array("files", 10), async (req, res) => {
    try {
      const files = req.files as Express.Multer.File[];
      
      if (!files || files.length === 0) {
        return res.status(400).json({ message: "No files uploaded" });
      }

      const jobs: { jobId: string; fileName: string; status: string; message: string }[] = [];

      for (const file of files) {
        const { buffer, mimetype, originalname } = file;
        const jobId = crypto.randomUUID();
        
        const job = createJob(jobId, mimetype);
        storeBuffer(jobId, buffer);
        
        setImmediate(() => {
          processJob(jobId);
        });
        
        jobs.push({ jobId, fileName: originalname, status: job.status, message: job.message });
      }

      res.json({ jobs });
    } catch (error) {
      console.error("Async upload error:", error);
      res.status(500).json({
        message: error instanceof Error ? error.message : "Failed to start upload",
      });
    }
  });

  app.get("/api/upload-status/:jobId", async (req, res) => {
    try {
      const job = getJob(req.params.jobId);
      
      if (!job) {
        return res.status(404).json({ message: "Job not found", expired: true });
      }

      res.json({
        status: job.status,
        progress: job.progress,
        message: job.message,
        text: job.text,
        error: job.error,
        isOfficeWithImages: job.isOfficeWithImages || false,
        documentImages: job.documentImages || [],
        isImageOnly: job.isImageOnly || false,
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to get job status" });
    }
  });

  app.delete("/api/upload-job/:jobId", async (req, res) => {
    try {
      deleteJob(req.params.jobId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete job" });
    }
  });

  // SSE endpoint for quiz generation with progress updates
  app.post("/api/generate-quiz-stream", isAuthenticated, async (req: any, res) => {
    // Set up SSE headers - disable all buffering
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no"); // Disable nginx buffering
    res.flushHeaders();

    const sendProgress = (step: string, progress: number, message: string) => {
      const data = `data: ${JSON.stringify({ type: "progress", step, progress, message })}\n\n`;
      console.log(`[SSE] Sending progress: ${step} - ${progress}%`);
      res.write(data);
      // Force flush - some Express setups need this
      if (typeof (res as any).flush === 'function') {
        (res as any).flush();
      }
    };
    
    // Send initial progress immediately
    sendProgress("starting", 5, "Starting quiz generation...");

    try {
      const validation = generateQuizRequestSchema.safeParse(req.body);
      
      if (!validation.success) {
        res.write(`data: ${JSON.stringify({ type: "error", message: validation.error.errors[0]?.message || "Invalid request" })}\n\n`);
        res.end();
        return;
      }

      const { text, questionCount, questionTypes, difficulty, documentImages, isImageOnly } = validation.data;
      const { sourceImageUrl } = req.body;
      const userId = req.user.claims.sub;

      // Classify images to separate text-only from illustrations
      // For image-only uploads, we still need images for the AI to analyze even if they're text-only
      let imagesForQuestions: string[] | undefined;
      let textForQuiz = text;
      const imageOnlyFlag = isImageOnly || false;
      if (documentImages && documentImages.length > 0) {
        const classifications = await classifyImages(documentImages, sendProgress, imageOnlyFlag);
        const illustrationImages = classifications
          .filter(c => c.hasIllustrations)
          .map(c => c.url);
        const textOnlyImages = classifications
          .filter(c => !c.hasIllustrations)
          .map(c => c.url);
        
        if (textOnlyImages.length > 0) {
          console.log(`Found ${textOnlyImages.length} text-only images, running OCR...`);
          // Extract text from text-only images using OCR
          const ocrText = await extractTextFromTextOnlyImages(textOnlyImages, sendProgress);
          if (ocrText) {
            // Append OCR text to existing text (or replace placeholder)
            if (text === "[Images uploaded - AI will analyze visually]" || text.length < 50) {
              textForQuiz = ocrText;
            } else {
              textForQuiz = text + "\n\n" + ocrText;
            }
            console.log(`OCR extracted ${ocrText.length} characters from text-only images`);
          }
        }
        
        // For image-only uploads: if all images are text-only, still pass them for AI analysis
        // For mixed uploads: only embed illustration images in questions
        if (isImageOnly && illustrationImages.length === 0) {
          // All images are text-only but this is image-only mode - pass all for AI to read
          imagesForQuestions = documentImages;
          console.log(`Image-only mode: passing all ${documentImages.length} images for AI analysis`);
        } else if (illustrationImages.length > 0) {
          imagesForQuestions = illustrationImages;
        }
      }

      const { questions, title, category } = await generateQuizQuestions({
        text: textForQuiz,
        questionCount,
        questionTypes,
        difficulty: difficulty as DifficultyLevel,
        documentImages: imagesForQuestions,
        onProgress: sendProgress,
        isImageOnly: isImageOnly || false,
      });

      sendProgress("saving", 98, "Saving your quiz...");

      const quiz = await storage.saveQuiz({
        userId,
        title,
        sourceText: textForQuiz,
        sourceImageUrl: sourceImageUrl || null,
        sourceImages: documentImages || null,
        questions: questions as Question[],
        difficulty: difficulty || "medium",
        category,
        generationMode: "generate",
        isPublic: 0,
      });

      sendProgress("complete", 100, "Quiz created successfully!");

      res.write(`data: ${JSON.stringify({ type: "complete", quiz: { ...quiz, createdAt: quiz.createdAt.toISOString() } })}\n\n`);
      res.end();
    } catch (error) {
      console.error("Quiz generation error:", error);
      res.write(`data: ${JSON.stringify({ type: "error", message: error instanceof Error ? error.message : "Failed to generate quiz" })}\n\n`);
      res.end();
    }
  });

  app.post("/api/generate-quiz", isAuthenticated, async (req: any, res) => {
    try {
      const validation = generateQuizRequestSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({
          message: validation.error.errors[0]?.message || "Invalid request",
        });
      }

      const { text, questionCount, questionTypes, difficulty, documentImages, isImageOnly } = validation.data;
      const { sourceImageUrl } = req.body;
      const userId = req.user.claims.sub;

      // Classify images to separate text-only from illustrations
      let imagesForQuestions: string[] | undefined;
      let textForQuiz = text;
      const imageOnlyFlag = isImageOnly || false;
      
      if (documentImages && documentImages.length > 0) {
        const classifications = await classifyImages(documentImages, undefined, imageOnlyFlag);
        const illustrationImages = classifications
          .filter(c => c.hasIllustrations)
          .map(c => c.url);
        const textOnlyImages = classifications
          .filter(c => !c.hasIllustrations)
          .map(c => c.url);
        
        if (textOnlyImages.length > 0) {
          console.log(`Found ${textOnlyImages.length} text-only images, running OCR...`);
          // Extract text from text-only images using OCR
          const ocrText = await extractTextFromTextOnlyImages(textOnlyImages);
          if (ocrText) {
            // Append OCR text to existing text (or replace placeholder)
            if (text === "[Images uploaded - AI will analyze visually]" || text.length < 50) {
              textForQuiz = ocrText;
            } else {
              textForQuiz = text + "\n\n" + ocrText;
            }
            console.log(`OCR extracted ${ocrText.length} characters from text-only images`);
          }
        }
        
        // For image-only uploads: if all images are text-only, still pass them for AI analysis
        if (isImageOnly && illustrationImages.length === 0) {
          imagesForQuestions = documentImages;
          console.log(`Image-only mode: passing all ${documentImages.length} images for AI analysis`);
        } else if (illustrationImages.length > 0) {
          imagesForQuestions = illustrationImages;
        }
      }

      const { questions, title, category } = await generateQuizQuestions({
        text: textForQuiz,
        questionCount,
        questionTypes,
        difficulty: difficulty as DifficultyLevel,
        documentImages: imagesForQuestions,
      });

      const quiz = await storage.saveQuiz({
        userId,
        title,
        sourceText: textForQuiz,
        sourceImageUrl: sourceImageUrl || null,
        sourceImages: documentImages || null,
        questions: questions as Question[],
        difficulty: difficulty || "medium",
        category,
        generationMode: "generate",
        isPublic: 0,
      });

      res.json({
        ...quiz,
        createdAt: quiz.createdAt.toISOString(),
      });
    } catch (error) {
      console.error("Quiz generation error:", error);
      res.status(500).json({
        message: error instanceof Error ? error.message : "Failed to generate quiz",
      });
    }
  });

  app.post("/api/import-quiz", isAuthenticated, async (req: any, res) => {
    try {
      const { text, sourceImageUrl, documentImages } = req.body;
      const userId = req.user.claims.sub;
      
      if (!text || typeof text !== "string") {
        return res.status(400).json({
          message: "Text content is required",
        });
      }

      // For image-only uploads, run OCR to extract text
      let textForImport = text;
      if (documentImages && Array.isArray(documentImages) && documentImages.length > 0) {
        if (text === "[Images uploaded - AI will analyze visually]" || text.length < 50) {
          console.log(`Import: Running OCR on ${documentImages.length} images...`);
          const ocrText = await extractTextFromTextOnlyImages(documentImages);
          if (ocrText && ocrText.length > 50) {
            textForImport = ocrText;
            console.log(`Import: OCR extracted ${ocrText.length} characters`);
          }
        }
      }

      if (textForImport.length < 50) {
        return res.status(400).json({
          message: "Text content is too short. Please upload a document with quiz questions.",
        });
      }

      const { questions, title } = await importExistingQuiz({ 
        text: textForImport,
        documentImages: Array.isArray(documentImages) ? documentImages : undefined,
      });

      const quiz = await storage.saveQuiz({
        userId,
        title,
        sourceText: textForImport,
        sourceImageUrl: sourceImageUrl || null,
        sourceImages: Array.isArray(documentImages) ? documentImages : null,
        questions: questions as Question[],
        difficulty: "medium",
        generationMode: "import",
        isPublic: 0,
      });

      res.json({
        ...quiz,
        createdAt: quiz.createdAt.toISOString(),
      });
    } catch (error) {
      console.error("Quiz import error:", error);
      res.status(500).json({
        message: error instanceof Error ? error.message : "Failed to import quiz",
      });
    }
  });

  // Summarize text endpoint
  app.post("/api/summarize-text", async (req, res) => {
    try {
      const { text } = req.body;
      
      if (!text || typeof text !== "string") {
        return res.status(400).json({ message: "Text is required" });
      }
      
      if (text.length < 100) {
        return res.status(400).json({ message: "Text is too short to summarize" });
      }
      
      const completion = await openaiClient.chat.completions.create({
        model: "gpt-4.1-nano",
        messages: [
          {
            role: "system",
            content: `You are a helpful study assistant. Summarize the given study material into clear, concise key points. 
Keep the summary focused on the main concepts and important details that would be useful for exam preparation.
If the text is in a language other than English, keep the summary in that same language.
Format with bullet points for easy reading. Keep it under 500 words.`
          },
          {
            role: "user",
            content: text
          }
        ],
        max_tokens: 800,
        temperature: 0.3,
      });
      
      const summary = completion.choices[0]?.message?.content || "Could not generate summary.";
      
      res.json({ summary });
    } catch (error) {
      console.error("Summarize error:", error);
      res.status(500).json({
        message: error instanceof Error ? error.message : "Failed to summarize text",
      });
    }
  });

  app.post("/api/submit-quiz", async (req: any, res) => {
    try {
      const validation = submitQuizRequestSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({
          message: validation.error.errors[0]?.message || "Invalid request",
        });
      }

      const { quizId, answers } = validation.data;

      const quiz = await storage.getQuiz(quizId);
      if (!quiz) {
        return res.status(404).json({ message: "Quiz not found" });
      }

      let correctAnswers = 0;
      const wrongQuestionIds: string[] = [];
      const questions = quiz.questions as Question[];
      const quizSourceText = (quiz as any).sourceText || "";
      
      const gradePromises = questions.map(async (question) => {
        const userAnswer = answers[question.id];
        if (!userAnswer) {
          return { questionId: question.id, correct: false };
        }

        if (question.type === "short_answer") {
          try {
            const sourceContext = quizSourceText
              ? `\nOriginal study material:\n---\n${quizSourceText.slice(0, 3000)}\n---`
              : "";
            const referenceHint = question.correctAnswer
              ? `\nA suggested answer was: "${question.correctAnswer}" — but do NOT treat this as the only correct answer. Use the study material to determine if the student's answer is valid.`
              : "";
            const response = await openaiClient.chat.completions.create({
              model: "gpt-4.1",
              messages: [
                {
                  role: "system",
                  content: `You are a strict but fair exam grader. Determine if the student's short answer is correct based on the question and the original study material — NOT by comparing to a fixed predetermined answer.${sourceContext}${referenceHint}\nAccept answers that demonstrate correct understanding even if worded differently. Accept synonyms, abbreviations, alternate phrasings, and minor spelling mistakes. Be strict about factual accuracy.\nRespond ONLY with JSON: {"isCorrect": true/false}`
                },
                {
                  role: "user",
                  content: `Question: ${question.question}\nStudent's Answer: ${userAnswer}`
                }
              ],
              temperature: 0.1,
              max_tokens: 50,
            });
            const content = response.choices[0]?.message?.content || "";
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const result = JSON.parse(jsonMatch[0]);
              return { questionId: question.id, correct: result.isCorrect === true };
            }
          } catch (e) {
            console.error("AI grading failed for submit, falling back to exact match:", e);
          }
          return { 
            questionId: question.id, 
            correct: userAnswer.toLowerCase().trim() === question.correctAnswer.toLowerCase().trim() 
          };
        }

        return {
          questionId: question.id,
          correct: userAnswer.toLowerCase().trim() === question.correctAnswer.toLowerCase().trim()
        };
      });

      const gradeResults = await Promise.all(gradePromises);
      for (const result of gradeResults) {
        if (result.correct) {
          correctAnswers++;
        } else {
          wrongQuestionIds.push(result.questionId);
        }
      }

      // Get userId if authenticated
      const userId = req.user?.claims?.sub || null;

      const result = await storage.saveQuizResult({
        quizId,
        userId,
        answers,
        score: Math.round((correctAnswers / questions.length) * 100),
        totalQuestions: questions.length,
        correctAnswers,
        wrongQuestionIds,
      });

      res.json({
        ...result,
        completedAt: result.completedAt.toISOString(),
      });
    } catch (error) {
      console.error("Quiz submission error:", error);
      res.status(500).json({
        message: error instanceof Error ? error.message : "Failed to submit quiz",
      });
    }
  });

  app.get("/api/quiz/:id", async (req, res) => {
    try {
      const quiz = await storage.getQuiz(req.params.id);
      if (!quiz) {
        return res.status(404).json({ message: "Quiz not found" });
      }
      res.json({
        ...quiz,
        createdAt: quiz.createdAt.toISOString(),
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to get quiz" });
    }
  });

  app.get("/api/quizzes", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const quizzes = await storage.getQuizzesByUserId(userId);
      
      // Get attempt counts for each quiz
      const quizzesWithAttempts = await Promise.all(
        quizzes.map(async (q) => {
          const results = await storage.getQuizResultsByQuizId(q.id);
          return {
            ...q,
            createdAt: q.createdAt.toISOString(),
            attemptCount: results.length,
          };
        })
      );
      
      res.json(quizzesWithAttempts);
    } catch (error) {
      res.status(500).json({ message: "Failed to get quizzes" });
    }
  });

  app.get("/api/user/stats", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const stats = await storage.getUserAverageAccuracy(userId);
      res.json(stats);
    } catch (error) {
      console.error("Stats fetch error:", error);
      res.status(500).json({ message: "Failed to get stats" });
    }
  });

  app.get("/api/user/result-history", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const history = await storage.getUserResultHistory(userId);
      res.json(history);
    } catch (error) {
      console.error("Result history fetch error:", error);
      res.status(500).json({ message: "Failed to get result history" });
    }
  });

  app.get("/api/user/settings", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json({
        username: user.username,
        profileImageUrl: user.profileImageUrl,
        autoDeleteFiles: user.autoDeleteFiles || false,
        consecutiveCorrectConfetti: user.consecutiveCorrectConfetti !== false,
        skipRevisionQuestions: user.skipRevisionQuestions || false,
      });
    } catch (error) {
      console.error("Settings fetch error:", error);
      res.status(500).json({ message: "Failed to get settings" });
    }
  });

  app.patch("/api/user/settings", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { username, autoDeleteFiles, profileImageUrl, consecutiveCorrectConfetti, skipRevisionQuestions } = req.body;
      
      const updates: any = {};
      if (username !== undefined) {
        const trimmedUsername = typeof username === "string" ? username.trim() : "";
        if (trimmedUsername.length > 0) {
          updates.username = trimmedUsername;
        }
      }
      if (autoDeleteFiles !== undefined) updates.autoDeleteFiles = autoDeleteFiles;
      if (profileImageUrl !== undefined) updates.profileImageUrl = profileImageUrl;
      if (consecutiveCorrectConfetti !== undefined) updates.consecutiveCorrectConfetti = consecutiveCorrectConfetti;
      if (skipRevisionQuestions !== undefined) updates.skipRevisionQuestions = skipRevisionQuestions;

      const updatedUser = await storage.updateUser(userId, updates).catch(err => {
        if (err.message?.includes('unique constraint') || err.code === '23505') {
          throw new Error("Username already taken");
        }
        throw err;
      });
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json({
        username: updatedUser.username,
        profileImageUrl: updatedUser.profileImageUrl,
        autoDeleteFiles: updatedUser.autoDeleteFiles || false,
        consecutiveCorrectConfetti: updatedUser.consecutiveCorrectConfetti !== false,
        skipRevisionQuestions: updatedUser.skipRevisionQuestions || false,
      });
    } catch (error) {
      console.error("Settings update error:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to update settings";
      res.status(500).json({ message: errorMessage });
    }
  });

  app.post("/api/user/upload-profile-image", isAuthenticated, upload.single("file"), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const base64Image = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
      const userId = req.user.claims.sub;
      
      await storage.updateUser(userId, { profileImageUrl: base64Image });
      
      res.json({ imageUrl: base64Image });
    } catch (error) {
      console.error("Profile image upload error:", error);
      res.status(500).json({ message: "Failed to upload profile image" });
    }
  });

  app.put("/api/quiz/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { title, questions, isPublic } = req.body;
      
      const { folderId } = req.body;
      const updates: any = {};
      if (title !== undefined) updates.title = title;
      if (questions !== undefined) updates.questions = questions;
      if (isPublic !== undefined) updates.isPublic = isPublic ? 1 : 0;
      if (folderId !== undefined) updates.folderId = folderId;

      const quiz = await storage.updateQuiz(id, updates);
      if (!quiz) {
        return res.status(404).json({ message: "Quiz not found" });
      }
      
      res.json({
        ...quiz,
        createdAt: quiz.createdAt.toISOString(),
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to update quiz" });
    }
  });

  app.post("/api/quiz/:id/ai-revise", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;
      const quiz = await storage.getQuiz(id);
      if (!quiz) {
        return res.status(404).json({ message: "Quiz not found" });
      }
      if (quiz.userId && quiz.userId !== userId) {
        return res.status(403).json({ message: "Not authorized to revise this quiz" });
      }

      const mode = quiz.generationMode === "import" ? "answers_only" : "full";
      const { questionIndex, userFeedback } = req.body;
      const allQuestions = quiz.questions as Question[];

      if (questionIndex !== undefined && typeof questionIndex === "number") {
        if (questionIndex < 0 || questionIndex >= allQuestions.length) {
          return res.status(400).json({ message: "Invalid question index" });
        }
        console.log(`[AI REVISE] Revising single question ${questionIndex + 1}/${allQuestions.length} for quiz ${id}, mode: ${mode}, feedback: ${userFeedback ? "yes" : "none"}`);
        const revisedSingle = await reviseQuizQuestions({
          questions: [allQuestions[questionIndex]],
          mode,
          sourceText: quiz.sourceText,
          userFeedback: userFeedback || undefined,
        });
        allQuestions[questionIndex] = revisedSingle[0];
      } else {
        console.log(`[AI REVISE] Revising all ${allQuestions.length} questions for quiz ${id}, mode: ${mode}`);
        const revisedAll = await reviseQuizQuestions({
          questions: allQuestions,
          mode,
          sourceText: quiz.sourceText,
        });
        allQuestions.splice(0, allQuestions.length, ...revisedAll);
      }

      const updatedQuiz = await storage.updateQuiz(id, {
        questions: allQuestions,
      });

      res.json({
        ...updatedQuiz,
        createdAt: updatedQuiz!.createdAt.toISOString(),
        revisedQuestionIndex: questionIndex,
      });
    } catch (error) {
      console.error("AI revise error:", error);
      res.status(500).json({
        message: error instanceof Error ? error.message : "Failed to revise quiz",
      });
    }
  });

  app.post("/api/quiz/:id/convert-question-type", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;
      const quiz = await storage.getQuiz(id);
      if (!quiz) {
        return res.status(404).json({ message: "Quiz not found" });
      }
      if (quiz.userId && quiz.userId !== userId) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const { questionIndex, newType } = req.body;
      const allQuestions = quiz.questions as Question[];

      if (typeof questionIndex !== "number" || questionIndex < 0 || questionIndex >= allQuestions.length) {
        return res.status(400).json({ message: "Invalid question index" });
      }
      if (!["multiple_choice", "true_false", "short_answer"].includes(newType)) {
        return res.status(400).json({ message: "Invalid question type" });
      }

      const converted = await convertQuestionType({
        question: allQuestions[questionIndex],
        newType,
        sourceText: quiz.sourceText,
      });

      allQuestions[questionIndex] = converted;

      const updatedQuiz = await storage.updateQuiz(id, { questions: allQuestions });

      res.json({
        ...updatedQuiz,
        createdAt: updatedQuiz!.createdAt.toISOString(),
      });
    } catch (error) {
      console.error("Convert question type error:", error);
      res.status(500).json({
        message: error instanceof Error ? error.message : "Failed to convert question type",
      });
    }
  });

  app.delete("/api/quiz/:id", async (req, res) => {
    try {
      await storage.deleteQuiz(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete quiz" });
    }
  });

  // Folder CRUD routes
  app.get("/api/folders", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const userFolders = await storage.getFoldersByUserId(userId);
      res.json(userFolders.map(f => ({
        ...f,
        createdAt: f.createdAt.toISOString(),
      })));
    } catch (error) {
      res.status(500).json({ message: "Failed to get folders" });
    }
  });

  app.get("/api/folders/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const userFolders = await storage.getFoldersByUserId(userId);
      const folder = userFolders.find(f => f.id === req.params.id);
      if (!folder) {
        return res.status(404).json({ message: "Folder not found" });
      }
      res.json({ ...folder, createdAt: folder.createdAt.toISOString() });
    } catch (error) {
      res.status(500).json({ message: "Failed to get folder" });
    }
  });

  app.post("/api/folders", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { name } = req.body;
      if (!name || typeof name !== "string" || name.trim().length === 0) {
        return res.status(400).json({ message: "Folder name is required" });
      }
      const folder = await storage.createFolder({ userId, name: name.trim() });
      res.json({ ...folder, createdAt: folder.createdAt.toISOString() });
    } catch (error) {
      console.error("Failed to create folder:", error);
      res.status(500).json({ message: "Failed to create folder" });
    }
  });

  app.patch("/api/folders/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { name } = req.body;
      if (!name || typeof name !== "string" || name.trim().length === 0) {
        return res.status(400).json({ message: "Folder name is required" });
      }
      const folder = await storage.updateFolder(req.params.id, userId, name.trim());
      if (!folder) {
        return res.status(404).json({ message: "Folder not found" });
      }
      res.json({ ...folder, createdAt: folder.createdAt.toISOString() });
    } catch (error) {
      res.status(500).json({ message: "Failed to update folder" });
    }
  });

  app.delete("/api/folders/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      await storage.deleteFolder(req.params.id, userId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete folder" });
    }
  });

  app.patch("/api/folders/:id/pin", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const folder = await storage.toggleFolderPin(req.params.id, userId);
      if (!folder) {
        return res.status(404).json({ message: "Folder not found" });
      }
      res.json({ ...folder, createdAt: folder.createdAt.toISOString() });
    } catch (error) {
      res.status(500).json({ message: "Failed to toggle folder pin" });
    }
  });

  app.get("/api/quiz/:id/results", async (req, res) => {
    try {
      const results = await storage.getQuizResultsByQuizId(req.params.id);
      res.json(results.map(r => ({
        ...r,
        completedAt: r.completedAt.toISOString(),
      })));
    } catch (error) {
      res.status(500).json({ message: "Failed to get quiz results" });
    }
  });

  app.get("/api/share/:id", async (req, res) => {
    try {
      const quiz = await storage.getQuiz(req.params.id);
      if (!quiz) {
        return res.status(404).json({ message: "Quiz not found" });
      }
      res.json({
        ...quiz,
        createdAt: quiz.createdAt.toISOString(),
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to get shared quiz" });
    }
  });

  app.get("/api/public-quizzes", async (req, res) => {
    try {
      const publicQuizzes = await storage.getPublicQuizzes();
      res.json(publicQuizzes.map(q => ({
        ...q,
        createdAt: q.createdAt.toISOString(),
      })));
    } catch (error) {
      res.status(500).json({ message: "Failed to get public quizzes" });
    }
  });

  // Personalized quiz recommendations
  app.get("/api/recommendations", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const recommendationData = await storage.getUserRecommendationData(userId);
      
      if (!recommendationData.hasData) {
        return res.json({ 
          hasData: false, 
          recommendations: [],
          message: "Complete a quiz to get personalized recommendations" 
        });
      }

      // Get all public quizzes
      const publicQuizzes = await storage.getPublicQuizzes();
      
      // Filter out user's own quizzes and score remaining ones
      const availableQuizzes = publicQuizzes.filter(quiz => !recommendationData.recentQuizIds.includes(quiz.id));
      
      let scoredQuizzes = availableQuizzes
        .map(quiz => {
          let score = 0;
          const category = quiz.category || "Others/General";
          
          // Boost quizzes in weak categories (needs improvement)
          if (recommendationData.weakCategories.includes(category)) {
            score += 3;
          }
          
          // Boost quizzes in user's preferred categories
          if (recommendationData.userCategories.includes(category)) {
            score += 2;
          }
          
          // Small boost for newer quizzes
          const ageInDays = (Date.now() - new Date(quiz.createdAt).getTime()) / (1000 * 60 * 60 * 24);
          if (ageInDays < 7) score += 1;
          
          return { quiz, score };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, 6)
        .map(item => ({
          ...item.quiz,
          createdAt: item.quiz.createdAt.toISOString(),
          recommendationReason: item.score >= 3 ? "needs_improvement" : 
                               item.score >= 2 ? "matches_interests" : "popular"
        }));

      // Fallback: if no recommendations found after filtering, show newest unvisited quizzes
      if (scoredQuizzes.length === 0 && availableQuizzes.length > 0) {
        scoredQuizzes = availableQuizzes
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, 6)
          .map(quiz => ({
            ...quiz,
            createdAt: quiz.createdAt.toISOString(),
            recommendationReason: "popular" as const
          }));
      }

      res.json({
        hasData: true,
        recommendations: scoredQuizzes,
        userCategories: recommendationData.userCategories,
        weakCategories: recommendationData.weakCategories,
      });
    } catch (error) {
      console.error("Recommendations error:", error);
      res.status(500).json({ message: "Failed to get recommendations" });
    }
  });

  // Comments endpoints
  app.get("/api/quiz/:id/comments", async (req, res) => {
    try {
      const comments = await storage.getCommentsByQuizId(req.params.id);
      res.json(comments.map(c => ({
        ...c,
        createdAt: c.createdAt.toISOString(),
      })));
    } catch (error) {
      res.status(500).json({ message: "Failed to get comments" });
    }
  });

  app.post("/api/quiz/:id/comments", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { content } = req.body;
      
      if (!content || content.trim().length === 0) {
        return res.status(400).json({ message: "Comment content is required" });
      }
      
      const comment = await storage.addComment({
        quizId: req.params.id,
        userId,
        content: content.trim(),
      });
      
      // Get user info for the response
      const user = await storage.getUser(userId);
      
      res.json({
        ...comment,
        createdAt: comment.createdAt.toISOString(),
        author: {
          username: user?.username || null,
          profileImageUrl: user?.profileImageUrl || null,
        },
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to add comment" });
    }
  });

  app.delete("/api/comments/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      await storage.deleteComment(req.params.id, userId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete comment" });
    }
  });

  // Votes endpoints
  app.get("/api/quiz/:id/votes", async (req: any, res) => {
    try {
      const votes = await storage.getVotesByQuizId(req.params.id);
      
      // Get user's vote if authenticated
      let userVote: number | null = null;
      if (req.user?.claims?.sub) {
        userVote = await storage.getUserVote(req.params.id, req.user.claims.sub);
      }
      
      res.json({ ...votes, userVote });
    } catch (error) {
      res.status(500).json({ message: "Failed to get votes" });
    }
  });

  app.post("/api/quiz/:id/vote", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { voteType } = req.body;
      
      if (voteType !== 1 && voteType !== -1) {
        return res.status(400).json({ message: "Vote type must be 1 (upvote) or -1 (downvote)" });
      }
      
      // Check if user already has this vote type
      const existingVote = await storage.getUserVote(req.params.id, userId);
      
      if (existingVote === voteType) {
        // Same vote type, remove the vote (toggle off)
        await storage.removeVote(req.params.id, userId);
      } else {
        // Different or no vote, upsert the new vote
        await storage.upsertVote(req.params.id, userId, voteType);
      }
      
      // Get updated vote counts
      const votes = await storage.getVotesByQuizId(req.params.id);
      const userVote = await storage.getUserVote(req.params.id, userId);
      
      res.json({ ...votes, userVote });
    } catch (error) {
      res.status(500).json({ message: "Failed to vote" });
    }
  });

  // Quiz Progress endpoints - saved in-progress quizzes (synced across sessions)
  app.get("/api/quiz-progress", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const progresses = await storage.getQuizProgressByUserId(userId);
      res.json(progresses);
    } catch (error) {
      console.error("Failed to get quiz progress:", error);
      res.status(500).json({ message: "Failed to get saved progress" });
    }
  });

  app.post("/api/quiz-progress", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { quizId, answers, checkedQuestions, currentIndex, retryAnswers, retryCheckedQuestions } = req.body;

      if (!quizId || !answers) {
        return res.status(400).json({ message: "quizId and answers are required" });
      }

      const saved = await storage.saveQuizProgress({
        userId,
        quizId,
        answers,
        checkedQuestions: checkedQuestions || [],
        currentIndex: currentIndex ?? 0,
        retryAnswers: retryAnswers ?? {},
        retryCheckedQuestions: retryCheckedQuestions ?? [],
      });

      res.json(saved);
    } catch (error) {
      console.error("Failed to save quiz progress:", error);
      res.status(500).json({ message: "Failed to save progress" });
    }
  });

  app.delete("/api/quiz-progress/:quizId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      await storage.deleteQuizProgress(userId, req.params.quizId);
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete quiz progress:", error);
      res.status(500).json({ message: "Failed to delete progress" });
    }
  });

  app.post("/api/contact", async (req, res) => {
    try {
      const { name, email, subject, message } = req.body;
      
      if (!name || !email || !subject || !message) {
        return res.status(400).json({ message: "All fields are required" });
      }

      await sendContactEmail({ name, email, subject, message });
      
      res.json({ success: true, message: "Your message has been sent successfully" });
    } catch (error) {
      console.error("Contact form error:", error);
      res.status(500).json({ 
        message: "Failed to send message. Please try again later." 
      });
    }
  });

  app.post("/api/grade-short-answer", async (req, res) => {
    try {
      const { question, correctAnswer, userAnswer, sourceText } = req.body;

      if (!question || !userAnswer) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const sourceContext = sourceText 
        ? `\n\nOriginal study material the question was generated from:\n---\n${sourceText.slice(0, 3000)}\n---`
        : "";

      const referenceHint = correctAnswer 
        ? `\nA suggested answer was: "${correctAnswer}" — but do NOT treat this as the only correct answer. Use the study material and your knowledge to determine if the student's answer is valid.`
        : "";

      const response = await openaiClient.chat.completions.create({
        model: "gpt-4.1",
        messages: [
          {
            role: "system",
            content: `You are a strict but fair exam grader. You grade short answer responses by evaluating the student's answer against the question and the original study material.${sourceContext}

Your job is to determine whether the student's answer is correct based on the study material and the question — NOT by comparing to a fixed predetermined answer. The correct answer should come from your understanding of the material.${referenceHint}

Rules:
- Determine correctness based on the study material and question context
- Accept answers that demonstrate correct understanding even if worded differently
- Accept reasonable synonyms, abbreviations, or alternate phrasings
- Accept minor spelling mistakes if the intent is clearly correct
- Be strict about factual accuracy — wrong facts = incorrect
- Partial credit: if the answer is partially correct but missing key details, mark as "partial"

Respond in JSON format:
{
  "isCorrect": true | false,
  "isPartial": false,
  "explanation": "Brief explanation of why the answer is correct/incorrect/partial. For correct answers, affirm what makes it right. For incorrect answers, explain what the correct answer should be based on the material and why theirs was wrong."
}

If the question and study material are in a non-English language, respond with the explanation in that same language.`
          },
          {
            role: "user",
            content: `Question: ${question}\nStudent's Answer: ${userAnswer}`
          }
        ],
        temperature: 0.1,
        max_tokens: 300,
      });

      const content = response.choices[0]?.message?.content || "";
      const jsonMatch = content.match(/\{[\s\S]*\}/);

      if (!jsonMatch) {
        return res.status(500).json({ message: "Failed to parse AI grading response" });
      }

      const result = JSON.parse(jsonMatch[0]);
      res.json({
        isCorrect: result.isCorrect === true,
        isPartial: result.isPartial === true,
        explanation: result.explanation || "",
      });
    } catch (error: any) {
      console.error("AI grading error:", error);
      res.status(500).json({ message: error.message || "Failed to grade answer" });
    }
  });

  // Quiz AI Chat Assistant
  app.post("/api/quiz-chat", async (req, res) => {
    try {
      const { quizTitle, questions, currentQuestionIndex, userMessage, chatHistory, sourceMaterial } = req.body;
      
      if (!quizTitle || !questions || currentQuestionIndex === undefined || !userMessage) {
        return res.status(400).json({ message: "Missing required fields" });
      }
      
      const response = await quizChatResponse({
        quizTitle,
        questions,
        currentQuestionIndex,
        userMessage,
        chatHistory: chatHistory || [],
        sourceMaterial,
      });
      
      res.json({ response });
    } catch (error: any) {
      console.error("Quiz chat error:", error);
      res.status(500).json({ message: error.message || "Failed to get AI response" });
    }
  });

  return httpServer;
}
