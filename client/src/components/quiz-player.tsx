import { useState, useMemo, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Check, X, ArrowRight, ArrowLeft, Loader2, Sparkles, CheckCheck, RotateCcw, Zap, Trophy, Target, ChevronUp, ChevronDown, Star, Flame, BadgeCheck, BookCheck, Lock, MessageCircle, Lightbulb, AlertCircle, ZoomIn, FileImage, ChevronLeft, ChevronRight, Image } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useQuiz } from "@/lib/quiz-context";
import { useAuth } from "@/hooks/useAuth";
import { queryClient } from "@/lib/queryClient";
import { useSidebarOptional } from "@/components/ui/sidebar";
import { motion, AnimatePresence } from "framer-motion";
import type { Question } from "@shared/schema";
import confetti from "canvas-confetti";
import { QuizChatbot, CutePenguin } from "@/components/quiz-chatbot";

const encouragingMessages = {
  correct: [
    "Excellent work!",
    "You nailed it!",
    "Brilliant!",
    "Keep it up!",
    "Perfect!",
    "Outstanding!",
    "You're on fire!",
    "Impressive!",
  ],
  retryCorrect: [
    "Look at that improvement!",
    "You learned from the last one! Amazing!",
    "Second time's the charm! Great job!",
    "You've mastered this now!",
    "Growth mindset in action!",
    "Persistence pays off! Well done!",
    "You didn't give up and it shows!",
    "That's how you learn! Fantastic!",
  ],
  incorrect: [
    "Don't worry, keep learning!",
    "You'll get the next one!",
    "Learning in progress!",
    "Every mistake is a lesson!",
    "Stay curious!",
  ],
  streak: [
    "2 in a row!",
    "3 in a row! Nice!",
    "4 in a row! Amazing!",
    "5+ streak! Unstoppable!",
  ],
};

const getRandomMessage = (type: "correct" | "incorrect" | "retryCorrect") => {
  const messages = encouragingMessages[type];
  return messages[Math.floor(Math.random() * messages.length)];
};

const getStreakMessage = (streak: number) => {
  if (streak < 2) return null;
  if (streak === 2) return encouragingMessages.streak[0];
  if (streak === 3) return encouragingMessages.streak[1];
  if (streak === 4) return encouragingMessages.streak[2];
  return encouragingMessages.streak[3];
};

import { ThemeToggle } from "@/components/theme-toggle";

export function QuizPlayer() {
  const [, setLocation] = useLocation();
  const { 
    currentQuiz, 
    userAnswers, 
    setUserAnswer, 
    setQuizResult, 
    sourceMaterial, 
    setRevisedQuestionsCount, 
    setRetryCorrectCount, 
    checkedQuestions, 
    markQuestionChecked,
    restoredCurrentIndex,
    restoredRetryAnswers,
    restoredRetryCheckedQuestions,
    clearRestoredState,
    syncPlayerState,
  } = useQuiz();
  const { user } = useAuth();
  const sidebarContext = useSidebarOptional();
  const sidebarState = sidebarContext?.state ?? "expanded";
  const isMobile = sidebarContext?.isMobile ?? false;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [shortAnswerInput, setShortAnswerInput] = useState("");
  const [correctStreak, setCorrectStreak] = useState(0);
  const [feedbackMessages, setFeedbackMessages] = useState<Record<string, { message: string; streakAtTime: number }>>({}); 
  const [showQuestionNav, setShowQuestionNav] = useState(false);
  const [showChatbot, setShowChatbot] = useState(false);
  const [isGrading, setIsGrading] = useState(false);
  const [aiGradingResults, setAiGradingResults] = useState<Record<string, { isCorrect: boolean; isPartial: boolean; explanation: string }>>({});
  
  const wrongAnswerIds = useRef<Set<string>>(new Set());
  const [retryAnswers, setRetryAnswers] = useState<Record<string, string>>({});
  const [retryChecked, setRetryChecked] = useState<Set<string>>(new Set());
  const hasRestoredRef = useRef(false);
  const [expandedExplanations, setExpandedExplanations] = useState<Set<string>>(new Set());
  
  const isGuest = !user;

  if (!currentQuiz) {
    return null;
  }
  
  // Initialize from restored state on mount (from saved progress) - only for authenticated users
  useEffect(() => {
    if (hasRestoredRef.current || !currentQuiz || isGuest) return;
    
    // Derive wrongAnswerIds from userAnswers by comparing to correct answers
    // This handles both: 1) Legacy progress without retry state, 2) Fresh restore with explicit state
    const questions = currentQuiz.questions;
    const derivedWrongIds = new Set<string>();
    
    for (const q of questions) {
      const userAnswer = userAnswers[q.id];
      if (userAnswer && checkedQuestions.has(q.id)) {
        const isCorrect = userAnswer.toLowerCase().trim() === q.correctAnswer.toLowerCase().trim();
        if (!isCorrect) {
          derivedWrongIds.add(q.id);
        }
      }
    }
    
    // Also include original question IDs from restored retry answers (keys are "retry-{originalId}")
    if (restoredRetryAnswers) {
      for (const retryKey of Object.keys(restoredRetryAnswers)) {
        if (retryKey.startsWith("retry-")) {
          const originalId = retryKey.replace("retry-", "");
          derivedWrongIds.add(originalId);
        }
      }
    }
    
    // Populate wrongAnswerIds from derived + restored state
    wrongAnswerIds.current = derivedWrongIds;
    
    // Restore retry state if available
    if (restoredRetryAnswers && Object.keys(restoredRetryAnswers).length > 0) {
      setRetryAnswers(restoredRetryAnswers);
    }
    
    if (restoredRetryCheckedQuestions && restoredRetryCheckedQuestions.length > 0) {
      setRetryChecked(new Set(restoredRetryCheckedQuestions));
    }
    
    // Restore current index if available
    if (restoredCurrentIndex !== null && restoredCurrentIndex > 0) {
      setCurrentIndex(restoredCurrentIndex);
    }
    
    hasRestoredRef.current = true;
    clearRestoredState(currentQuiz.id);
  }, [currentQuiz, userAnswers, checkedQuestions, restoredCurrentIndex, restoredRetryAnswers, restoredRetryCheckedQuestions, clearRestoredState, isGuest]);

  // Sync player state to context for save functionality (only for authenticated users)
  useEffect(() => {
    if (!isGuest) {
      syncPlayerState(currentIndex, retryAnswers, Array.from(retryChecked));
    }
  }, [currentIndex, retryAnswers, retryChecked, syncPlayerState, isGuest]);

  // Cleanup: reset hasRestoredRef when quiz changes (to allow fresh restoration)
  useEffect(() => {
    return () => {
      hasRestoredRef.current = false;
    };
  }, [currentQuiz?.id]);

  const originalQuestions = currentQuiz.questions;
  
  const skipRevision = user?.skipRevisionQuestions === true;
  
  const allQuestions = useMemo(() => {
    // Only registered users get a 2nd attempt for wrong answers (unless they've disabled revision)
    const shouldIncludeRetry = !isGuest && !skipRevision;
    const wrongQuestions = shouldIncludeRetry ? originalQuestions.filter(q => wrongAnswerIds.current.has(q.id)) : [];
    const retryQuestions = wrongQuestions.map(q => ({
      ...q,
      id: `retry-${q.id}`,
      originalId: q.id,
      isRetry: true as const,
    }));
    return [...originalQuestions.map(q => ({ ...q, isRetry: false as const, originalId: q.id })), ...retryQuestions];
  }, [originalQuestions, wrongAnswerIds.current.size, isGuest, skipRevision]);

  const currentQuestion = allQuestions[currentIndex];
  const isRetryQuestion = currentQuestion?.isRetry;
  const originalQuestionCount = originalQuestions.length;
  
  const mainProgress = Math.min(currentIndex + 1, originalQuestionCount);
  const progress = (mainProgress / originalQuestionCount) * 100;
  
  const selectedAnswer = currentQuestion?.isRetry 
    ? retryAnswers[currentQuestion.id] 
    : userAnswers[currentQuestion?.originalId];
    
  const isChecked = currentQuestion?.isRetry 
    ? retryChecked.has(currentQuestion.id)
    : checkedQuestions.has(currentQuestion?.originalId);

  const isCorrectAnswer = (answer: string | undefined, question: typeof currentQuestion) => {
    if (!answer || !question) return false;
    if (question.type === "short_answer") {
      const gradeKey = question.isRetry ? question.id : question.originalId;
      const grading = aiGradingResults[gradeKey];
      if (grading) return grading.isCorrect;
      return false;
    }
    const normalizedUser = answer.toLowerCase().trim();
    const normalizedCorrect = question.correctAnswer.toLowerCase().trim();
    return normalizedUser === normalizedCorrect;
  };

  const isCorrect = () => {
    return isCorrectAnswer(selectedAnswer, currentQuestion);
  };

  const triggerConfetti = () => {
    confetti({
      particleCount: 80,
      spread: 60,
      origin: { y: 0.7 },
      colors: ['#4255FF', '#9C27B0', '#00C853', '#FFD700'],
    });
  };

  const handleSelectAnswer = (answer: string) => {
    if (isChecked) return;
    if (currentQuestion.isRetry) {
      setRetryAnswers(prev => ({ ...prev, [currentQuestion.id]: answer }));
    } else {
      setUserAnswer(currentQuestion.originalId, answer);
    }
  };

  const handleShortAnswerChange = (value: string) => {
    if (isChecked) return;
    setShortAnswerInput(value);
  };

  const applyCheckResult = (correct: boolean, answerToCheck: string | undefined, qSnap: typeof currentQuestion) => {
    let newStreak = correctStreak;
    let message = "";

    if (correct) {
      newStreak = correctStreak + 1;
      setCorrectStreak(newStreak);

      if (qSnap.isRetry) {
        message = getRandomMessage("retryCorrect");
      } else {
        message = getStreakMessage(newStreak) || getRandomMessage("correct");
      }

      if (newStreak >= 3 && user?.consecutiveCorrectConfetti === true) {
        triggerConfetti();
      }
    } else {
      setCorrectStreak(0);
      message = getRandomMessage("incorrect");
    }

    setFeedbackMessages(prev => ({
      ...prev,
      [qSnap.id]: { message, streakAtTime: correct ? newStreak : 0 }
    }));

    if (qSnap.isRetry) {
      setRetryChecked(prev => new Set(prev).add(qSnap.id));
    } else {
      markQuestionChecked(qSnap.originalId);
      if (!correct) {
        wrongAnswerIds.current.add(qSnap.originalId);
      }
    }

    const keysToExpand: string[] = [];
    if (qSnap.type === "true_false") {
      const correctOption = qSnap.correctAnswer.toLowerCase() === "true" ? "True" : "False";
      keysToExpand.push(`${qSnap.id}-tf-${correctOption}`);
      if (!correct && answerToCheck) {
        keysToExpand.push(`${qSnap.id}-tf-${answerToCheck}`);
      }
    } else if (qSnap.type === "short_answer") {
      keysToExpand.push(`${qSnap.id}-short-answer`);
    } else if (qSnap.options && qSnap.explanation && (!isGuest || qSnap.isRetry)) {
      qSnap.options.forEach((opt, idx) => {
        const isCorrectOpt = opt.toLowerCase().trim() === qSnap.correctAnswer.toLowerCase().trim();
        const isSelectedWrong = opt === answerToCheck && !correct;
        if (isCorrectOpt || isSelectedWrong) {
          keysToExpand.push(`${qSnap.id}-${idx}`);
        }
      });
    }

    if (keysToExpand.length > 0) {
      setExpandedExplanations(prev => {
        const next = new Set(prev);
        keysToExpand.forEach(key => next.add(key));
        return next;
      });
    }
  };

  const handleCheck = async () => {
    let answerToCheck = selectedAnswer;
    const questionSnapshot = { ...currentQuestion };

    if (questionSnapshot.type === "short_answer" && shortAnswerInput.trim()) {
      answerToCheck = shortAnswerInput.trim();
      if (questionSnapshot.isRetry) {
        setRetryAnswers(prev => ({ ...prev, [questionSnapshot.id]: answerToCheck! }));
      } else {
        setUserAnswer(questionSnapshot.originalId, answerToCheck);
      }
    }

    if (answerToCheck || (questionSnapshot.type === "short_answer" && shortAnswerInput.trim())) {
      const questionKey = questionSnapshot.id;

      if (questionSnapshot.type === "short_answer") {
        setIsGrading(true);
        try {
          const res = await fetch("/api/grade-short-answer", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              question: questionSnapshot.question,
              correctAnswer: questionSnapshot.correctAnswer,
              userAnswer: answerToCheck,
              sourceText: sourceMaterial?.text || (currentQuiz as any)?.sourceText || "",
            }),
          });

          if (!res.ok) throw new Error("Grading failed");

          const grading = await res.json();
          const gradeKey = questionSnapshot.isRetry ? questionSnapshot.id : questionSnapshot.originalId;

          setAiGradingResults(prev => ({
            ...prev,
            [gradeKey]: {
              isCorrect: grading.isCorrect,
              isPartial: grading.isPartial,
              explanation: grading.explanation,
            },
          }));

          applyCheckResult(grading.isCorrect, answerToCheck, questionSnapshot);
        } catch {
          const normalizedUser = (answerToCheck || "").toLowerCase().trim();
          const normalizedCorrect = questionSnapshot.correctAnswer.toLowerCase().trim();
          const fallbackCorrect = normalizedUser === normalizedCorrect;
          const gradeKey = questionSnapshot.isRetry ? questionSnapshot.id : questionSnapshot.originalId;

          setAiGradingResults(prev => ({
            ...prev,
            [gradeKey]: {
              isCorrect: fallbackCorrect,
              isPartial: false,
              explanation: fallbackCorrect
                ? "Your answer matches the expected answer."
                : `The expected answer is: ${questionSnapshot.correctAnswer}`,
            },
          }));

          applyCheckResult(fallbackCorrect, answerToCheck, questionSnapshot);
        } finally {
          setIsGrading(false);
        }
      } else {
        const correct = isCorrectAnswer(answerToCheck, questionSnapshot);
        applyCheckResult(correct, answerToCheck, questionSnapshot);
      }
    }
  };

  const goToNext = () => {
    if (isGrading) return;
    if (currentIndex < allQuestions.length - 1) {
      const nextQuestion = allQuestions[currentIndex + 1];
      setCurrentIndex(currentIndex + 1);
      if (nextQuestion.isRetry) {
        setShortAnswerInput(retryAnswers[nextQuestion.id] || "");
      } else {
        setShortAnswerInput(userAnswers[nextQuestion.originalId] || "");
      }
    }
  };

  const goToPrevious = () => {
    if (isGrading) return;
    if (currentIndex > 0) {
      const prevQuestion = allQuestions[currentIndex - 1];
      setCurrentIndex(currentIndex - 1);
      if (prevQuestion.isRetry) {
        setShortAnswerInput(retryAnswers[prevQuestion.id] || "");
      } else {
        setShortAnswerInput(userAnswers[prevQuestion.originalId] || "");
      }
    }
  };

  const goToQuestion = (index: number) => {
    if (isGrading) return;
    setCurrentIndex(index);
    setShowQuestionNav(false);
    const question = allQuestions[index];
    if (question.isRetry) {
      setShortAnswerInput(retryAnswers[question.id] || "");
    } else {
      setShortAnswerInput(userAnswers[question.originalId] || "");
    }
  };

  const finishQuiz = async () => {
    setIsSubmitting(true);

    try {
      setRevisedQuestionsCount(wrongAnswerIds.current.size);
      
      const retryQs = allQuestions.filter(q => q.isRetry);
      let retryCorrect = 0;
      for (const rq of retryQs) {
        const answer = retryAnswers[rq.id];
        if (answer) {
          if (rq.type === "short_answer") {
            const grading = aiGradingResults[rq.id];
            if (grading?.isCorrect) retryCorrect++;
          } else if (answer.toLowerCase().trim() === rq.correctAnswer.toLowerCase().trim()) {
            retryCorrect++;
          }
        }
      }
      setRetryCorrectCount(retryCorrect);
      
      const response = await fetch("/api/submit-quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quizId: currentQuiz.id,
          answers: userAnswers,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to submit quiz");
      }

      const result = await response.json();
      
      queryClient.invalidateQueries({ queryKey: ["/api/quizzes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/result-history"] });
      queryClient.invalidateQueries({ queryKey: ["/api/quiz-progress"] });

      setQuizResult(result);
      setLocation("/results");
    } catch (error) {
      console.error("Error submitting quiz:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getQuestionTypeBadge = (type: Question["type"]) => {
    switch (type) {
      case "multiple_choice":
        return <Badge variant="secondary" className="text-xs">Multiple Choice</Badge>;
      case "true_false":
        return <Badge className="bg-quiz-purple text-white text-xs">True/False</Badge>;
      case "short_answer":
        return <Badge className="bg-quiz-orange text-white text-xs">Short Answer</Badge>;
    }
  };

  const getWrongAnswerExplanation = (answer: string | undefined) => {
    if (!answer || !currentQuestion.wrongAnswerExplanations) return null;
    
    if (currentQuestion.wrongAnswerExplanations[answer]) {
      return currentQuestion.wrongAnswerExplanations[answer];
    }
    
    const answerWithoutPrefix = answer.replace(/^[A-D]\)\s*/, "").trim();
    if (currentQuestion.wrongAnswerExplanations[answerWithoutPrefix]) {
      return currentQuestion.wrongAnswerExplanations[answerWithoutPrefix];
    }
    
    const normalize = (s: string) => s.replace(/^[A-D]\)\s*/, "").trim().toLowerCase()
      .replace(/\s+/g, " ")
      .replace(/,/g, ".")
      .replace(/\u00A0/g, " ");
    
    const normalizedAnswer = normalize(answer);
    
    for (const [key, value] of Object.entries(currentQuestion.wrongAnswerExplanations)) {
      const normalizedKey = normalize(key);
      if (normalizedKey === normalizedAnswer) {
        return value;
      }
    }
    
    for (const [key, value] of Object.entries(currentQuestion.wrongAnswerExplanations)) {
      const normalizedKey = normalize(key);
      if (normalizedKey.length > 3 && normalizedAnswer.length > 3 && 
          (normalizedAnswer.includes(normalizedKey) || normalizedKey.includes(normalizedAnswer))) {
        return value;
      }
    }
    
    return null;
  };

  const renderFeedback = () => {
    return null;
  };

  const toggleExplanation = (key: string) => {
    setExpandedExplanations(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const renderAnswerOptions = () => {
    if (currentQuestion.type === "true_false") {
      return (
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          {["True", "False"].map((option, index) => {
            const isSelected = selectedAnswer === option;
            const isCorrectOpt = option.toLowerCase().trim() === currentQuestion.correctAnswer.toLowerCase().trim();
            const showCorrectExplanation = isChecked && isCorrectOpt && currentQuestion.explanation && (!isGuest || isRetryQuestion);
            const wrongExplanationForOption = isChecked && isSelected && !isCorrectOpt ? getWrongAnswerExplanation(option) : null;
            const showWrongExplanation = wrongExplanationForOption && (!isGuest || isRetryQuestion);
            const explanationKey = `${currentQuestion.id}-tf-${option}`;
            const isExpanded = expandedExplanations.has(explanationKey);
            const hasExplanation = showCorrectExplanation || showWrongExplanation;
            
            return (
              <div key={option} className="flex flex-col">
                <motion.button
                  whileHover={!isChecked ? { scale: 1.02 } : {}}
                  whileTap={!isChecked ? { scale: 0.98 } : {}}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  onClick={() => handleSelectAnswer(option)}
                  disabled={isChecked}
                  data-testid={`option-${option.toLowerCase()}`}
                  className={`
                    relative p-5 sm:p-8 text-left
                    ${hasExplanation ? "rounded-t-2xl" : "rounded-2xl"}
                    ${!isChecked ? "cursor-pointer" : "cursor-default"}
                    ${isChecked && isCorrectOpt 
                      ? "bg-green-500/15 border-2 border-green-500 shadow-lg shadow-green-500/10" 
                      : isChecked && isSelected && !isCorrectOpt
                        ? "bg-red-500/15 border-2 border-red-500 shadow-lg shadow-red-500/10"
                        : isSelected
                          ? "bg-primary/10 border-2 border-primary shadow-lg shadow-primary/10"
                          : "bg-card border-2 border-border hover:border-primary/50 hover:bg-muted/50"
                    }
                    ${hasExplanation ? "border-b-0" : ""}
                  `}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-lg sm:text-xl font-semibold">{option}</span>
                    <AnimatePresence>
                      {isChecked && isCorrectOpt && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center"
                        >
                          <Check className="h-5 w-5 text-white" />
                        </motion.div>
                      )}
                      {isChecked && isSelected && !isCorrectOpt && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center"
                        >
                          <X className="h-5 w-5 text-white" />
                        </motion.div>
                      )}
                      {!isChecked && isSelected && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="w-8 h-8 rounded-full bg-primary flex items-center justify-center"
                        >
                          <Check className="h-5 w-5 text-primary-foreground" />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.button>
                
                {/* Explanation dropdown for True/False */}
                {hasExplanation && (
                  <div className={`
                    border-2 border-t-0 rounded-b-2xl overflow-hidden
                    ${isCorrectOpt ? "border-green-500 bg-green-500/5" : "border-red-500 bg-red-500/5"}
                  `}>
                    <button
                      onClick={() => toggleExplanation(explanationKey)}
                      className={`
                        w-full px-3 py-2 flex items-center justify-between text-xs sm:text-sm font-medium transition-colors
                        ${isCorrectOpt 
                          ? "text-green-700 dark:text-green-400 hover:bg-green-500/10" 
                          : "text-red-700 dark:text-red-400 hover:bg-red-500/10"
                        }
                      `}
                      data-testid={`toggle-explanation-${option.toLowerCase()}`}
                    >
                      <div className="flex items-center gap-1.5">
                        {isCorrectOpt ? (
                          <Lightbulb className="h-3.5 w-3.5" />
                        ) : (
                          <AlertCircle className="h-3.5 w-3.5" />
                        )}
                        <span className="hidden sm:inline">{isCorrectOpt && isSelected ? "Great job! Here's why" : isCorrectOpt ? "The correct answer" : "Learn from this"}</span>
                        <span className="sm:hidden">{isCorrectOpt && isSelected ? "Nice!" : isCorrectOpt ? "Answer" : "Learn"}</span>
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5" />
                      )}
                    </button>
                    
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="px-3 pb-3 pt-1">
                            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                              {isCorrectOpt ? currentQuestion.explanation : wrongExplanationForOption}
                            </p>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      );
    }

    if (currentQuestion.type === "short_answer") {
      const gradeKey = currentQuestion.isRetry ? currentQuestion.id : currentQuestion.originalId;
      const aiGrading = aiGradingResults[gradeKey];
      const explanationKey = `${currentQuestion.id}-short-answer`;
      const isExpanded = expandedExplanations.has(explanationKey);
      const showAiExplanation = isChecked && aiGrading && (!isGuest || isRetryQuestion);
      const isShortAnswerCorrect = aiGrading?.isCorrect;
      const isPartial = aiGrading?.isPartial;
      
      const borderColor = isChecked 
        ? isShortAnswerCorrect 
          ? "border-green-500" 
          : isPartial 
            ? "border-yellow-500" 
            : "border-red-500"
        : "focus:border-primary";
      
      return (
        <div className="space-y-4">
          <Input
            value={isChecked ? (selectedAnswer || shortAnswerInput) : shortAnswerInput}
            onChange={(e) => handleShortAnswerChange(e.target.value)}
            placeholder="Type your answer here..."
            className={`py-6 px-5 text-lg rounded-xl border-2 ${borderColor}`}
            disabled={isChecked || isGrading}
            data-testid="input-short-answer"
          />

          {isGrading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground px-1">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>AI is grading your answer...</span>
            </div>
          )}
          
          {showAiExplanation && (
            <div className={`border-2 ${isShortAnswerCorrect ? "border-green-500 bg-green-500/5" : isPartial ? "border-yellow-500 bg-yellow-500/5" : "border-red-500 bg-red-500/5"} rounded-xl overflow-hidden`}>
              <button
                onClick={() => toggleExplanation(explanationKey)}
                className={`w-full px-4 py-2.5 flex items-center justify-between text-sm font-medium transition-colors ${
                  isShortAnswerCorrect 
                    ? "text-green-700 dark:text-green-400 hover:bg-green-500/10" 
                    : isPartial 
                      ? "text-yellow-700 dark:text-yellow-400 hover:bg-yellow-500/10"
                      : "text-red-700 dark:text-red-400 hover:bg-red-500/10"
                }`}
                data-testid="toggle-explanation-short-answer"
              >
                <div className="flex items-center gap-2">
                  {isShortAnswerCorrect ? (
                    <Check className="h-4 w-4" />
                  ) : isPartial ? (
                    <AlertCircle className="h-4 w-4" />
                  ) : (
                    <X className="h-4 w-4" />
                  )}
                  <span>
                    {isShortAnswerCorrect ? "Correct" : isPartial ? "Partially Correct" : "Incorrect"} — AI Assessment
                  </span>
                </div>
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>
              
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-4 pt-1">
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {aiGrading.explanation}
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      );
    }

    const optionLabels = ['A', 'B', 'C', 'D'];
    
    return (
      <div className="space-y-3">
        {currentQuestion.options?.map((option, index) => {
          const isSelected = selectedAnswer === option;
          const isCorrectOpt = option.toLowerCase().trim() === currentQuestion.correctAnswer.toLowerCase().trim();
          const showCorrectExplanation = isChecked && isCorrectOpt && currentQuestion.explanation && (!isGuest || isRetryQuestion);
          const wrongExplanationForOption = isChecked && isSelected && !isCorrectOpt ? getWrongAnswerExplanation(option) : null;
          const showWrongExplanation = wrongExplanationForOption && (!isGuest || isRetryQuestion);
          const explanationKey = `${currentQuestion.id}-${index}`;
          const isExpanded = expandedExplanations.has(explanationKey);
          const hasExplanation = showCorrectExplanation || showWrongExplanation;
          
          return (
            <div key={index} className="space-y-0">
              <motion.button
                whileHover={!isChecked ? { scale: 1.03, x: 4 } : {}}
                whileTap={!isChecked ? { scale: 0.98 } : {}}
                transition={{ 
                  type: "spring", 
                  stiffness: 400, 
                  damping: 25,
                  layout: { duration: 0 } 
                }}
                onClick={() => handleSelectAnswer(option)}
                disabled={isChecked}
                data-testid={`option-${index}`}
                className={`
                  w-full relative p-4 sm:p-5 text-left
                  ${hasExplanation ? "rounded-t-xl rounded-b-none" : "rounded-xl"}
                  ${!isChecked ? "cursor-pointer" : "cursor-default"}
                  ${isChecked && isCorrectOpt 
                    ? "bg-green-500/15 border-2 border-green-500 border-b-0" 
                    : isChecked && isSelected && !isCorrectOpt
                      ? "bg-red-500/15 border-2 border-red-500 border-b-0"
                      : isSelected
                        ? "bg-primary/10 border-2 border-primary"
                        : "bg-card border-2 border-border hover:border-primary/50 hover:bg-muted/30"
                  }
                `}
              >
                <div className="flex items-center gap-4">
                  <div className={`
                    w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0 transition-all
                    ${isChecked && isCorrectOpt
                      ? "bg-green-500 text-white"
                      : isChecked && isSelected && !isCorrectOpt
                        ? "bg-red-500 text-white"
                        : isSelected
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                    }
                  `}>
                    {optionLabels[index]}
                  </div>
                  <span className="text-sm sm:text-base flex-1 font-medium">{option}</span>
                  <AnimatePresence>
                    {isChecked && isCorrectOpt && (
                      <motion.div
                        initial={{ scale: 0, rotate: -180 }}
                        animate={{ scale: 1, rotate: 0 }}
                        className="w-7 h-7 rounded-full bg-green-500 flex items-center justify-center"
                      >
                        <Check className="h-4 w-4 text-white" />
                      </motion.div>
                    )}
                    {isChecked && isSelected && !isCorrectOpt && (
                      <motion.div
                        initial={{ scale: 0, rotate: 180 }}
                        animate={{ scale: 1, rotate: 0 }}
                        className="w-7 h-7 rounded-full bg-red-500 flex items-center justify-center"
                      >
                        <X className="h-4 w-4 text-white" />
                      </motion.div>
                    )}
                    {!isChecked && isSelected && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="w-7 h-7 rounded-full bg-primary flex items-center justify-center"
                      >
                        <Check className="h-4 w-4 text-primary-foreground" />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.button>
              
              {/* Explanation dropdown for this option */}
              {hasExplanation && (
                <div className={`
                  border-2 border-t-0 rounded-b-xl overflow-hidden
                  ${isCorrectOpt ? "border-green-500 bg-green-500/5" : "border-red-500 bg-red-500/5"}
                `}>
                  <button
                    onClick={() => toggleExplanation(explanationKey)}
                    className={`
                      w-full px-4 py-2.5 flex items-center justify-between text-sm font-medium transition-colors
                      ${isCorrectOpt 
                        ? "text-green-700 dark:text-green-400 hover:bg-green-500/10" 
                        : "text-red-700 dark:text-red-400 hover:bg-red-500/10"
                      }
                    `}
                    data-testid={`toggle-explanation-${index}`}
                  >
                    <div className="flex items-center gap-2">
                      {isCorrectOpt ? (
                        <Lightbulb className="h-4 w-4" />
                      ) : (
                        <AlertCircle className="h-4 w-4" />
                      )}
                      <span>{isCorrectOpt && isSelected ? "Great job! Here's why" : isCorrectOpt ? "The correct answer" : "Learn from this"}</span>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </button>
                  
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="px-4 pb-4 pt-1">
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            {isCorrectOpt ? currentQuestion.explanation : wrongExplanationForOption}
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const renderQuestionNav = () => {
    return (
      <AnimatePresence>
        {showQuestionNav && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed inset-x-0 bottom-20 sm:bottom-24 z-40 px-4"
          >
            <Card className="mx-auto max-w-lg p-4 shadow-xl border-2">
              <p className="text-sm font-medium text-muted-foreground mb-3">Jump to question</p>
              <div className="flex flex-wrap gap-2">
                {originalQuestions.map((q, i) => {
                  const isAnswered = checkedQuestions.has(q.id);
                  const wasCorrect = isAnswered && isCorrectAnswer(userAnswers[q.id], { ...q, isRetry: false, originalId: q.id });
                  const isCurrent = currentQuestion?.originalId === q.id && !currentQuestion?.isRetry;
                  const isCurrentRetry = currentQuestion?.originalId === q.id && currentQuestion?.isRetry;
                  
                  return (
                    <button
                      key={q.id}
                      onClick={() => goToQuestion(i)}
                      className={`
                        w-10 h-10 rounded-lg font-semibold text-sm transition-all
                        ${isCurrent 
                          ? "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2" 
                          : isCurrentRetry
                            ? "bg-orange-500 text-white ring-2 ring-orange-500 ring-offset-2"
                            : isAnswered && wasCorrect
                              ? "bg-green-500/20 text-green-700 dark:text-green-400 border border-green-500/50"
                              : isAnswered
                                ? "bg-red-500/20 text-red-700 dark:text-red-400 border border-red-500/50"
                                : "bg-muted hover:bg-muted/80"
                        }
                      `}
                      data-testid={`nav-question-${i}`}
                    >
                      {i + 1}
                    </button>
                  );
                })}
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    );
  };

  const allOriginalChecked = checkedQuestions.size === originalQuestionCount;
  const [expandedImageUrl, setExpandedImageUrl] = useState<string | null>(null);
  const [showMaterialViewer, setShowMaterialViewer] = useState(false);
  const [materialImageIndex, setMaterialImageIndex] = useState(0);
  const [materialPanelWidth, setMaterialPanelWidth] = useState(45);
  const isDraggingRef = useRef(false);
  const dragStartXRef = useRef(0);
  const dragStartWidthRef = useRef(45);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const containerWidth = window.innerWidth;
      const deltaX = e.clientX - dragStartXRef.current;
      const deltaPercent = (deltaX / containerWidth) * 100;
      const newWidth = Math.min(70, Math.max(20, dragStartWidthRef.current - deltaPercent));
      setMaterialPanelWidth(newWidth);
    };
    const handleMouseUp = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const startDrag = (e: React.MouseEvent) => {
    isDraggingRef.current = true;
    dragStartXRef.current = e.clientX;
    dragStartWidthRef.current = materialPanelWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  };

  const materialImages = sourceMaterial?.documentImages || (currentQuiz as any)?.sourceImages || [];
  const singleSourceImage = sourceMaterial?.imageDataUrl || (currentQuiz as any)?.sourceImageUrl;
  const allMaterialImages = singleSourceImage ? [singleSourceImage, ...materialImages] : materialImages;
  const hasMaterialImages = allMaterialImages.length > 0;

  const retryQuestionsInList = allQuestions.filter(q => q.isRetry);
  const allRetryChecked = retryQuestionsInList.every(q => retryChecked.has(q.id));
  const isLastQuestion = currentIndex === allQuestions.length - 1;
  const canFinish = allOriginalChecked && (retryQuestionsInList.length === 0 || allRetryChecked);
    
  const canCheck = !isChecked && !isGrading && (selectedAnswer || (currentQuestion?.type === "short_answer" && shortAnswerInput.trim()));

  if (!currentQuestion) return null;

  const displayQuestionNum = isRetryQuestion 
    ? originalQuestions.findIndex(q => q.id === currentQuestion.originalId) + 1
    : currentIndex + 1;

  const correctCount = Array.from(checkedQuestions).filter(qId => {
    const q = originalQuestions.find(oq => oq.id === qId);
    return q && isCorrectAnswer(userAnswers[qId], { ...q, isRetry: false, originalId: q.id });
  }).length;

  return (
    <>
      <div className="flex w-full min-h-[calc(100vh-4rem)] overflow-x-hidden">
        <div className="flex-1 min-w-0">
          <div className="w-full mx-auto pb-32 sm:pb-28 max-w-3xl px-4">
            <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-md supports-[backdrop-filter]:bg-background/80 py-4 -mx-4 px-4 sm:mx-0 sm:px-0">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  {isRetryQuestion && (
                    <Badge variant="outline" className="border-orange-500 text-orange-600 dark:text-orange-400 text-xs font-semibold">
                      <RotateCcw className="h-3 w-3 mr-1" />
                      Retry
                    </Badge>
                  )}
                  <button
                    onClick={() => setShowQuestionNav(!showQuestionNav)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted hover:bg-muted/80 transition-colors"
                    data-testid="button-question-nav"
                  >
                    <span className="text-sm font-semibold">{displayQuestionNum}/{originalQuestionCount}</span>
                    <ChevronUp className={`h-4 w-4 transition-transform ${showQuestionNav ? "rotate-180" : ""}`} />
                  </button>
                  {hasMaterialImages && (
                    <Button
                      variant={showMaterialViewer ? "secondary" : "outline"}
                      size="sm"
                      onClick={() => {
                        setMaterialImageIndex(0);
                        setShowMaterialViewer(!showMaterialViewer);
                      }}
                      className="gap-1.5 rounded-full h-8"
                      data-testid="button-view-material"
                    >
                      <FileImage className="h-4 w-4" />
                      <span className="hidden sm:inline">Material</span>
                    </Button>
                  )}
                  <ThemeToggle />
                </div>
                <div className="flex items-center gap-3">
                  {correctStreak >= 2 && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="flex items-center gap-1 px-2.5 py-1 bg-orange-500/20 rounded-full"
                    >
                      <Flame className="h-4 w-4 text-orange-500" />
                      <span className="text-sm font-bold text-orange-600 dark:text-orange-400">{correctStreak}</span>
                    </motion.div>
                  )}
                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-green-500/20 rounded-full">
                    <BadgeCheck className="h-4 w-4 text-green-600 dark:text-green-400" />
                    <span className="text-sm font-bold text-green-600 dark:text-green-400">{correctCount}</span>
                  </div>
                </div>
              </div>
              
              <div className="relative">
                <Progress value={progress} className="h-2.5 rounded-full" data-testid="progress-quiz" />
                <motion.div
                  className="absolute -top-1 h-4 w-4 bg-primary rounded-full border-2 border-background shadow-lg"
                  style={{ left: `calc(${progress}% - 8px)` }}
                  layoutId="progress-indicator"
                />
              </div>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={currentQuestion.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className="mt-6"
              >
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-4 flex-wrap">
                    {isRetryQuestion ? (
                      <Badge variant="outline" className="border-orange-500 text-orange-600 dark:text-orange-400">
                        <RotateCcw className="h-3 w-3 mr-1" />
                        Give it another try
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="font-semibold">
                        Question {displayQuestionNum}
                      </Badge>
                    )}
                    {getQuestionTypeBadge(currentQuestion.type)}
                  </div>
                  
                  <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-foreground leading-snug" data-testid="text-question">
                    {currentQuestion.question}
                  </h2>
                </div>

                {currentQuestion.imageUrl && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="mb-6 rounded-2xl overflow-hidden border-2 border-border bg-muted/30 cursor-pointer relative group/img"
                    onClick={() => setExpandedImageUrl(currentQuestion.imageUrl || null)}
                  >
                    <img 
                      src={currentQuestion.imageUrl} 
                      alt="Question reference"
                      className="w-full max-h-72 sm:max-h-80 object-contain"
                      data-testid="image-question-reference"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/10 transition-colors flex items-center justify-center">
                      <ZoomIn className="h-8 w-8 text-white opacity-0 group-hover/img:opacity-100 transition-opacity drop-shadow-md" />
                    </div>
                  </motion.div>
                )}

                {renderAnswerOptions()}
                {renderFeedback()}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {showMaterialViewer && hasMaterialImages && !isMobile && (
          <>
            <div
              onMouseDown={startDrag}
              className="w-1.5 cursor-col-resize bg-border hover:bg-primary/50 transition-colors shrink-0 relative group"
              data-testid="drag-handle-material"
            >
              <div className="absolute inset-y-0 -left-1 -right-1" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-8 rounded-full bg-muted-foreground/30 group-hover:bg-primary/60 transition-colors" />
            </div>
            <div
              className="h-full flex flex-col bg-muted/30 overflow-hidden shrink-0"
              style={{ width: `${materialPanelWidth}%` }}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b bg-background/80 backdrop-blur-sm shrink-0">
                <div className="flex items-center gap-2">
                  <Image className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-muted-foreground">
                    {allMaterialImages.length > 1 ? `${materialImageIndex + 1} / ${allMaterialImages.length}` : "Source Material"}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowMaterialViewer(false)}
                  data-testid="button-close-material-panel"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex-1 overflow-auto">
                <div className="flex flex-col h-full">
                  <div className="flex-1 flex items-center justify-center p-4 relative">
                    {allMaterialImages.length > 1 && (
                      <Button
                        variant="secondary"
                        size="icon"
                        className="absolute left-2 z-10 rounded-full shadow-md"
                        onClick={() => setMaterialImageIndex(prev => prev > 0 ? prev - 1 : allMaterialImages.length - 1)}
                        data-testid="button-material-prev"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                    )}
                    <img
                      src={allMaterialImages[materialImageIndex]}
                      alt={`Study material ${materialImageIndex + 1}`}
                      className="max-w-full max-h-[calc(100vh-12rem)] object-contain rounded-lg"
                      data-testid="image-material-side"
                    />
                    {allMaterialImages.length > 1 && (
                      <Button
                        variant="secondary"
                        size="icon"
                        className="absolute right-2 z-10 rounded-full shadow-md"
                        onClick={() => setMaterialImageIndex(prev => prev < allMaterialImages.length - 1 ? prev + 1 : 0)}
                        data-testid="button-material-next"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  {allMaterialImages.length > 1 && (
                    <div className="flex justify-center gap-2 py-3 border-t shrink-0">
                      {allMaterialImages.map((_: string, idx: number) => (
                        <button
                          key={idx}
                          onClick={() => setMaterialImageIndex(idx)}
                          className={`w-2 h-2 rounded-full transition-colors ${
                            idx === materialImageIndex ? 'bg-primary' : 'bg-muted-foreground/30'
                          }`}
                          data-testid={`button-material-dot-${idx}`}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {renderQuestionNav()}

      <div 
        className="fixed bottom-0 right-0 left-0 z-30 bg-background/95 backdrop-blur-md border-t transition-[left] duration-300 ease-in-out"
        style={{ 
          left: !sidebarContext || isMobile ? 0 : sidebarState === 'collapsed' ? 'var(--sidebar-width-icon)' : 'var(--sidebar-width)' 
        }}
      >
        <div className="max-w-3xl mx-auto px-2 sm:px-4 py-2 sm:py-4">
          <div className="flex items-center justify-between gap-1.5 sm:gap-3">
            <Button
              variant="outline"
              onClick={goToPrevious}
              disabled={currentIndex === 0 || isGrading}
              size="icon"
              className="rounded-lg sm:rounded-xl h-9 w-9 sm:h-11 sm:w-auto sm:px-4 shrink-0"
              data-testid="button-previous"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline ml-2">Back</span>
            </Button>

            <div className="flex items-center gap-1.5 sm:gap-2 flex-1 justify-center">
              <Button
                variant="outline"
                onClick={() => setShowChatbot(true)}
                className="rounded-full h-9 sm:h-11 px-3 sm:px-4 shrink-0 bg-background/50 backdrop-blur-sm border-2 hover:bg-primary/5 gap-2 font-semibold shadow-sm transition-all hover:shadow-md group"
                data-testid="button-ask-pip"
              >
                <div className="flex items-center justify-center">
                  <CutePenguin size={22} className="sm:w-6 sm:h-6" />
                </div>
                <span className="hidden sm:inline">Ask Pip</span>
              </Button>
              
              {!isChecked ? (
                <Button
                  onClick={handleCheck}
                  disabled={!canCheck}
                  className="gap-1 sm:gap-2 rounded-lg sm:rounded-xl flex-1 max-w-[140px] sm:max-w-none sm:min-w-[160px] font-semibold h-9 sm:h-11 text-sm sm:text-base px-3 sm:px-4"
                  data-testid="button-check"
                >
                  {isGrading ? (
                    <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin" />
                  ) : (
                    <CheckCheck className="h-4 w-4 sm:h-5 sm:w-5" />
                  )}
                  {isGrading ? "Grading..." : "Check"}
                </Button>
              ) : isLastQuestion ? (
                <Button
                  onClick={finishQuiz}
                  disabled={isSubmitting || !canFinish}
                  className="gap-1 sm:gap-2 rounded-lg sm:rounded-xl flex-1 max-w-[140px] sm:max-w-none sm:min-w-[160px] font-semibold bg-primary hover:from-primary/90 hover:primary/90 h-9 sm:h-11 text-sm sm:text-base px-3 sm:px-4"
                  data-testid="button-finish"
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin" />
                  ) : (
                    <>Results</>
                  )}
                </Button>
              ) : (
                <Button
                  onClick={goToNext}
                  className="gap-1 sm:gap-2 rounded-lg sm:rounded-xl flex-1 max-w-[140px] sm:max-w-none sm:min-w-[160px] font-semibold h-9 sm:h-11 text-sm sm:text-base px-3 sm:px-4"
                  data-testid="button-next"
                >
                  Continue
                  <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5" />
                </Button>
              )}
            </div>

            <Button
              variant="outline"
              onClick={goToNext}
              disabled={currentIndex >= allQuestions.length - 1 || isGrading}
              size="icon"
              className="rounded-lg sm:rounded-xl h-9 w-9 sm:h-11 sm:w-auto sm:px-4 shrink-0"
              data-testid="button-skip"
            >
              <span className="hidden sm:inline mr-2">Next</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <QuizChatbot
        quizTitle={currentQuiz.title}
        questions={currentQuiz.questions}
        currentQuestionIndex={Math.min(currentIndex, currentQuiz.questions.length - 1)}
        sourceMaterial={sourceMaterial?.text || undefined}
        isOpen={showChatbot}
        onClose={() => setShowChatbot(false)}
      />

      <AnimatePresence>
        {expandedImageUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4 sm:p-8 cursor-zoom-out"
            onClick={() => setExpandedImageUrl(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative max-w-full max-h-full flex items-center justify-center"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={expandedImageUrl}
                alt="Expanded view"
                className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl ring-1 ring-white/10"
              />
              <Button
                variant="secondary"
                size="icon"
                className="absolute -top-4 -right-4 rounded-full shadow-lg border-2 border-background h-10 w-10 z-10"
                onClick={() => setExpandedImageUrl(null)}
              >
                <X className="h-5 w-5" />
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showMaterialViewer && isMobile && hasMaterialImages && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/90 flex flex-col"
            onClick={() => setShowMaterialViewer(false)}
          >
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <Image className="h-5 w-5 text-white/80" />
                <span className="text-white font-medium">
                  {`Images ${allMaterialImages.length > 1 ? `(${materialImageIndex + 1}/${allMaterialImages.length})` : ""}`}
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="text-white"
                onClick={() => setShowMaterialViewer(false)}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            
            <div 
              className="flex-1 flex items-center justify-center p-4 relative"
              onClick={(e) => e.stopPropagation()}
            >
              {allMaterialImages.length > 1 && (
                <Button
                  variant="secondary"
                  size="icon"
                  className="absolute left-4 z-10 rounded-full shadow-lg"
                  onClick={() => setMaterialImageIndex(prev => prev > 0 ? prev - 1 : allMaterialImages.length - 1)}
                  data-testid="button-material-prev-mobile"
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
              )}
              <img
                src={allMaterialImages[materialImageIndex]}
                alt={`Study material ${materialImageIndex + 1}`}
                className="max-w-full max-h-[calc(100vh-120px)] object-contain rounded-lg"
              />
              {allMaterialImages.length > 1 && (
                <Button
                  variant="secondary"
                  size="icon"
                  className="absolute right-4 z-10 rounded-full shadow-lg"
                  onClick={() => setMaterialImageIndex(prev => prev < allMaterialImages.length - 1 ? prev + 1 : 0)}
                  data-testid="button-material-next-mobile"
                >
                  <ChevronRight className="h-5 w-5" />
                </Button>
              )}
            </div>
            {allMaterialImages.length > 1 && (
              <div className="flex justify-center gap-2 p-4 border-t border-white/10">
                {allMaterialImages.map((_: string, idx: number) => (
                  <button
                    key={idx}
                    onClick={(e) => {
                      e.stopPropagation();
                      setMaterialImageIndex(idx);
                    }}
                    className={`w-2.5 h-2.5 rounded-full transition-colors ${
                      idx === materialImageIndex ? 'bg-white' : 'bg-white/30'
                    }`}
                    data-testid={`button-material-dot-${idx}`}
                  />
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
