import { useMemo, useState, useRef, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { 
  Plus, BookOpen, Play, Target, 
  Clock, FileText, Loader2, Sparkles, ArrowRight, 
  Brain, GraduationCap, Lightbulb, ChartNoAxesColumn, ChevronLeft, ChevronRight, X,
  Calculator, Languages, FlaskConical, Globe2, HelpCircle, BookText, Zap,
  Binary, Book, Globe
} from "lucide-react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { 
  faFileLines, 
  faBullseye, 
  faChartSimple, 
  faComment,
  faMessage
} from "@fortawesome/free-solid-svg-icons";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useQuiz } from "@/lib/quiz-context";
import { useAuth } from "@/hooks/useAuth";
import type { Quiz } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";

// Category to Icon mapping
const categoryIcons: Record<string, any> = {
  "Math": Binary,
  "English": Book,
  "Science": FlaskConical,
  "Social Studies": Globe,
  "Global Languages": Languages,
  "Others/General": GraduationCap,
};

// Difficulty to Color mapping
const difficultyColors: Record<string, { border: string, from: string, via: string, text: string, icon: string, shadow: string, badge: string }> = {
  "easy": {
    border: "border-emerald-500/30",
    from: "from-emerald-500/10",
    via: "via-emerald-500/5",
    text: "text-emerald-600 dark:text-emerald-400",
    icon: "bg-gradient-to-br from-emerald-500 to-emerald-600",
    shadow: "shadow-emerald-500/5",
    badge: "bg-emerald-500/10 text-emerald-600 border-emerald-200 dark:border-emerald-900",
  },
  "medium": {
    border: "border-amber-500/30",
    from: "from-amber-500/10",
    via: "via-amber-500/5",
    text: "text-amber-600 dark:text-amber-400",
    icon: "bg-gradient-to-br from-amber-500 to-amber-600",
    shadow: "shadow-amber-500/5",
    badge: "bg-amber-500/10 text-amber-600 border-amber-200 dark:border-amber-900",
  },
  "hard": {
    border: "border-rose-500/30",
    from: "from-rose-500/10",
    via: "via-rose-500/5",
    text: "text-rose-600 dark:text-rose-400",
    icon: "bg-gradient-to-br from-rose-500 to-rose-600",
    shadow: "shadow-rose-500/5",
    badge: "bg-rose-500/10 text-rose-600 border-rose-200 dark:border-rose-900",
  }
};

interface UserStats {
  averageAccuracy: number;
  totalAttempts: number;
}

const learningTips = [
  "Spaced repetition helps you remember better. Try reviewing your quizzes at increasing intervals for maximum retention.",
  "Teaching others what you've learned is one of the best ways to reinforce your own understanding.",
  "Taking breaks between study sessions helps your brain consolidate information more effectively.",
  "Active recall (testing yourself) is more effective than passive review. Keep taking those quizzes!",
  "Getting enough sleep is crucial for memory consolidation. Your brain processes what you learned while you rest.",
  "Mix up different topics in your study sessions. Interleaving subjects can improve long-term retention.",
  "Write down key concepts by hand. The physical act of writing helps cement information in memory.",
  "Create mental associations or stories to connect new information with what you already know.",
  "Study in short, focused bursts of 25-30 minutes, then take a 5-minute break. This is called the Pomodoro Technique.",
  "Challenge yourself with harder questions. Struggling a bit helps you learn more deeply.",
  "Review material right before sleep. Your brain will continue processing it overnight.",
  "Explain concepts in your own words. If you can't simplify it, you don't understand it well enough yet.",
  "Stay hydrated and maintain good nutrition. Your brain needs proper fuel to learn effectively.",
  "Test yourself before you think you're ready. Making mistakes early helps identify gaps in your knowledge.",
  "Connect new concepts to real-world examples. Practical applications make abstract ideas stick better.",
  "When doing multiple-choice questions, don't just find the right answer. Explain to yourself why the other three options are wrong. This triples your learning from a single question.",
  "Upload your material and take a quiz before you start intensive studying. This 'pre-test' highlights exactly which parts of the PDF you already know and which parts need your full attention.",
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.05,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] },
  },
};

const floatAnimation = {
  y: [0, -8, 0],
  transition: {
    duration: 3,
    repeat: Infinity,
    ease: "easeInOut",
  },
};

function StatCard({ 
  label, 
  value, 
  icon: Icon, 
  gradient,
  isActive = true,
  onClick
}: { 
  label: string; 
  value: number | string; 
  icon: any; 
  gradient: string;
  isActive?: boolean;
  onClick?: () => void;
}) {
  const colorMap: Record<string, { bg: string; text: string; iconBg: string; ring: string }> = {
    "bg-gradient-to-br from-blue-500 to-blue-600": {
      bg: "bg-blue-50 dark:bg-blue-950/30",
      text: "text-blue-600 dark:text-blue-400",
      iconBg: "bg-blue-100 dark:bg-blue-900/50",
      ring: "ring-blue-200 dark:ring-blue-800/50",
    },
    "bg-gradient-to-br from-violet-500 to-violet-600": {
      bg: "bg-violet-50 dark:bg-violet-950/30",
      text: "text-violet-600 dark:text-violet-400",
      iconBg: "bg-violet-100 dark:bg-violet-900/50",
      ring: "ring-violet-200 dark:ring-violet-800/50",
    },
    "bg-gradient-to-br from-emerald-500 to-emerald-600": {
      bg: "bg-emerald-50 dark:bg-emerald-950/30",
      text: "text-emerald-600 dark:text-emerald-400",
      iconBg: "bg-emerald-100 dark:bg-emerald-900/50",
      ring: "ring-emerald-200 dark:ring-emerald-800/50",
    },
  };

  const colors = colorMap[gradient] || colorMap["bg-gradient-to-br from-blue-500 to-blue-600"];
  const inactive = !isActive;

  return (
    <motion.div
      whileHover={{ y: -3, transition: { duration: 0.2, ease: "easeOut" } }}
      whileTap={onClick ? { scale: 0.98 } : {}}
      onClick={onClick}
      className={onClick ? "cursor-pointer" : ""}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      } : undefined}
      aria-label={onClick ? `${label}: ${value}` : undefined}
    >
      <div className={`relative rounded-2xl p-5 ring-1 transition-all duration-300 h-full ${
        inactive
          ? "bg-muted/50 ring-border"
          : `${colors.bg} ${colors.ring} hover:ring-2`
      }`}>
        <div className="flex items-center gap-4">
          <div className={`shrink-0 flex items-center justify-center w-11 h-11 rounded-xl transition-colors ${
            inactive
              ? "bg-muted"
              : colors.iconBg
          }`}>
            <Icon className={`h-5 w-5 ${inactive ? "text-muted-foreground" : colors.text}`} />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {label}
            </p>
            <p className={`text-2xl font-bold tracking-tight mt-0.5 ${
              inactive ? "text-muted-foreground" : "text-foreground"
            }`}>
              {value}
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}


function QuickActionCard({ 
  title, 
  description, 
  icon: Icon, 
  onClick,
  variant = "default",
  testId
}: { 
  title: string; 
  description: string; 
  icon: any; 
  onClick: () => void;
  variant?: "default" | "primary";
  testId: string;
}) {
  const isPrimary = variant === "primary";
  
  return (
    <motion.div 
      whileHover={{ scale: 1.02 }} 
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.2 }}
      className={isPrimary ? "relative group" : ""}
    >
      {isPrimary && (
        <motion.div 
          className="absolute -inset-0.5 bg-gradient-to-r from-primary via-quiz-purple to-primary rounded-xl blur opacity-30 group-hover:opacity-50 transition duration-1000 group-hover:duration-200 animate-tilt"
          animate={{ 
            backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"] 
          }}
          transition={{ 
            duration: 5, 
            repeat: Infinity, 
            ease: "linear" 
          }}
        />
      )}
      <Card 
        className={`relative cursor-pointer overflow-hidden transition-all duration-300 hover:shadow-xl  ${
          isPrimary 
            ? "bg-gradient-to-br from-primary via-primary to-primary/90 border-0 shadow-lg shadow-primary/20" 
            : "border-border/50"
        }`}
        onClick={onClick}
        data-testid={testId}
      >
        <CardContent className="p-6 relative z-20">
          <div className="flex items-center gap-4">
            <motion.div 
              className={`p-3 rounded-xl ${isPrimary ? "bg-white/20 backdrop-blur-sm border border-white/20" : "bg-primary/10"}`}
              whileHover={{ rotate: isPrimary ? 90 : 0, scale: 1.1 }}
              transition={{ duration: 0.3, type: "spring", stiffness: 300 }}
            >
              <Icon className={`w-6 h-6 ${isPrimary ? "text-white" : "text-primary"}`} />
            </motion.div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <h3 className={`font-bold text-lg leading-tight ${isPrimary ? "text-white" : "text-foreground"}`}>
                  {title}
                </h3>
              </div>
              <p className={`text-sm font-medium tracking-tight truncate ${isPrimary ? "text-white/90" : "text-muted-foreground"}`}>
                {description}
              </p>
            </div>
            <div className={`p-2 rounded-full transition-colors ${isPrimary ? "bg-white/20 hover:bg-white/30" : "bg-muted"}`}>
              <ArrowRight className={`w-5 h-5 flex-shrink-0 ${isPrimary ? "text-white" : "text-muted-foreground"}`} />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function EmptyState({ onCreateQuiz }: { onCreateQuiz: () => void }) {
  return (
    <Card className="overflow-visible">
      <CardContent className="py-16 px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-md mx-auto"
        >
          <motion.div 
            className="relative w-32 h-32 mx-auto mb-8 cursor-pointer group"
            animate={floatAnimation}
            whileHover={{ scale: 1.05 }}
            transition={{ duration: 0.2 }}
          >
            <motion.div 
              className="absolute -inset-2 bg-gradient-to-r from-primary/20 via-quiz-purple/20 to-primary/20 rounded-full blur-xl"
              animate={{ opacity: [0.3, 0.6, 0.3], scale: [0.95, 1.05, 0.95] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div 
              className="absolute inset-0 bg-gradient-to-br from-primary/20 to-primary/5 rounded-full transition-all duration-300 group-hover:from-primary/30 group-hover:to-primary/15"
              animate={{ rotate: 360 }}
              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              style={{ background: "conic-gradient(from 0deg, hsl(var(--primary) / 0.2), hsl(var(--quiz-purple) / 0.1), hsl(var(--primary) / 0.2))" }}
            />
            <div className="absolute inset-1 bg-background rounded-full" />
            <div className="absolute inset-4 bg-gradient-to-br from-primary/30 to-primary/10 rounded-full transition-all duration-300 group-hover:from-primary/40 group-hover:to-primary/20" />
            <div className="absolute inset-0 flex items-center justify-center">
              <motion.div
                animate={{ rotate: [0, 5, -5, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              >
                <Brain className="w-12 h-12 text-primary transition-transform duration-300 group-hover:scale-110" />
              </motion.div>
            </div>
            <motion.div 
              className="absolute -top-1 -right-1"
              animate={{ y: [0, -4, 0], rotate: [0, 10, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            >
              <Sparkles className="w-6 h-6 text-primary transition-all duration-300 group-hover:scale-125 group-hover:text-quiz-purple" />
            </motion.div>
            <motion.div 
              className="absolute -bottom-1 -left-1"
              animate={{ y: [0, 3, 0], rotate: [0, -10, 0] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
            >
              <Sparkles className="w-4 h-4 text-quiz-purple/70 transition-all duration-300 group-hover:scale-125 group-hover:text-primary" />
            </motion.div>
          </motion.div>
          
          <h3 className="text-2xl font-bold text-foreground mb-3">
            Ready to learn smarter?
          </h3>
          <p className="text-muted-foreground mb-8 leading-relaxed">
            Upload your study materials and let AI create personalized quizzes tailored just for you.
          </p>
          
          <Button size="lg" onClick={onCreateQuiz} data-testid="button-create-first">
            <Plus className="w-5 h-5 mr-2" />
            Create Your First Quiz
          </Button>
          
          <div className="mt-8 flex items-center justify-center gap-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              <span>PDFs</span>
            </div>
            <div className="flex items-center gap-2">
              <Lightbulb className="w-4 h-4" />
              <span>Images</span>
            </div>
            <div className="flex items-center gap-2">
              <GraduationCap className="w-4 h-4" />
              <span>Any topic</span>
            </div>
          </div>
        </motion.div>
      </CardContent>
    </Card>
  );
}

function QuizCard({ 
  quiz, 
  onTake, 
  onStudy, 
  index 
}: { 
  quiz: Quiz; 
  onTake: () => void; 
  onStudy: () => void;
  index: number;
}) {
  const difficultyRaw = quiz.difficulty?.toLowerCase() || "medium";
  const difficulty = (["easy", "medium", "hard"].includes(difficultyRaw) ? difficultyRaw : "medium") as "easy" | "medium" | "hard";
  const colors = difficultyColors[difficulty] || difficultyColors.medium;
  const CategoryIcon = categoryIcons[quiz.category || "Others/General"] || GraduationCap;
  const questionCount = (quiz.questions as any[]).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      whileTap={{ scale: 0.99 }}
      className="group cursor-pointer"
      data-testid={`card-recent-quiz-${quiz.id}`}
      onClick={onTake}
    >
      <div className="relative flex gap-3 p-3 rounded-lg bg-muted/40 hover:bg-muted/70 transition-all duration-200 border border-transparent hover:border-border/40">
        <div className="flex items-center justify-center flex-shrink-0">
          <div className={`w-9 h-9 rounded-lg ${colors.icon} flex items-center justify-center`}>
            <CategoryIcon className="w-4 h-4 text-white" />
          </div>
        </div>
        
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
            {quiz.title}
          </h3>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
            <span>{questionCount} <span className="hidden sm:inline">questions</span><span className="sm:hidden">q</span></span>
            <span className="flex items-center gap-1">
              <span className={`w-1.5 h-1.5 rounded-full ${colors.badge.split(' ')[0].replace('text-', 'bg-')}`} />
              <span className={`capitalize ${colors.text} font-medium`}>{difficulty}</span>
            </span>
            <span className="hidden sm:inline">{formatDistanceToNow(new Date(quiz.createdAt))} ago</span>
          </div>
        </div>
        
        <div className="flex items-center gap-1 flex-shrink-0">
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 hidden sm:flex"
            onClick={(e) => { e.stopPropagation(); onStudy(); }}
            data-testid={`button-study-${quiz.id}`}
          >
            <BookOpen className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            className="h-8 px-3"
            onClick={(e) => { e.stopPropagation(); onTake(); }}
            data-testid={`button-take-${quiz.id}`}
          >
            <Play className="w-3.5 h-3.5 sm:mr-1.5 fill-black" />
            <span className="hidden sm:inline">Take</span>
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

function LearningTipCard() {
  const randomTip = useMemo(() => {
    return learningTips[Math.floor(Math.random() * learningTips.length)];
  }, []);

  return (
    <motion.section variants={itemVariants}>
      <Card className="overflow-visible bg-gradient-to-r from-primary/5 via-transparent to-primary/5 border-primary/10">
        <CardContent className="p-5">
          <div className="flex items-start gap-4">
            <div className="p-2 rounded-lg bg-primary/10 flex-shrink-0">
              <Lightbulb className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-medium text-foreground mb-1">Learning Tip</h3>
              <p className="text-sm text-muted-foreground">
                {randomTip}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.section>
  );
}

function ContinueQuizCard({ 
  quiz, 
  answeredCount, 
  totalCount, 
  onContinue, 
  onDiscard,
  isCurrent = true,
  savedAt,
  isRevising = false,
  retryAnsweredCount = 0,
  retryTotalCount = 0,
}: { 
  quiz: Quiz; 
  answeredCount: number; 
  totalCount: number; 
  onContinue: () => void; 
  onDiscard: () => void;
  isCurrent?: boolean;
  savedAt?: string;
  isRevising?: boolean;
  retryAnsweredCount?: number;
  retryTotalCount?: number;
}) {
  const displayAnswered = isRevising ? retryAnsweredCount : answeredCount;
  const displayTotal = isRevising ? retryTotalCount : totalCount;
  const progress = Math.round((displayAnswered / displayTotal) * 100) || 0;
  const remaining = displayTotal - displayAnswered;
  
  const difficultyRaw = quiz.difficulty?.toLowerCase() || "medium";
  const difficulty = (["easy", "medium", "hard"].includes(difficultyRaw) ? difficultyRaw : "medium") as "easy" | "medium" | "hard";
  const colors = difficultyColors[difficulty] || difficultyColors.medium;
  const CategoryIcon = categoryIcons[quiz.category || "Others/General"] || GraduationCap;

  const timeLabel = formatDistanceToNow(new Date(savedAt || new Date()));

  return (
    <motion.div
      whileHover={{ y: 0 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className="relative group"
    >
      <Card className={`overflow-hidden border ${isRevising ? 'border-violet-500/40' : colors.border} transition-all duration-300 bg-gradient-to-br ${isRevising ? 'from-violet-500/5 via-purple-500/5' : `${colors.from} ${colors.via}`} to-transparent`}>
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-col gap-4">
            {/* Header row */}
            <div className="flex items-start gap-3">
              {/* Icon */}
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-md flex-shrink-0 ${isRevising ? 'bg-gradient-to-br from-violet-500 to-purple-600' : colors.icon}`}>
                <CategoryIcon className="w-6 h-6 text-white" />
              </div>
              
              {/* Title and meta */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-foreground truncate text-base mb-1">{quiz.title}</h3>
                    <div className="flex items-center gap-2 flex-wrap">
                      {isRevising ? (
                        <Badge className="gap-1 text-[10px] px-2 py-0.5 bg-violet-500/15 text-violet-600 dark:text-violet-400 border-violet-300 dark:border-violet-800">
                          <motion.div 
                            className="w-1.5 h-1.5 rounded-full bg-violet-500"
                            animate={{ opacity: [1, 0.4, 1] }}
                            transition={{ duration: 1.5, repeat: Infinity }}
                          />
                          Revising
                        </Badge>
                      ) : (
                        <Badge variant="outline" className={`text-[10px] px-2 py-0.5 uppercase tracking-wider font-bold ${colors.badge}`}>
                          {difficulty}
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {timeLabel} ago
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive flex-shrink-0 transition-colors opacity-0 group-hover:opacity-100"
                    onClick={(e) => { e.stopPropagation(); onDiscard(); }}
                    data-testid="button-discard-progress"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
            
            {/* Progress section */}
            {isRevising ? (
              <div className="flex items-center gap-2 py-2 px-3 rounded-lg bg-violet-500/10 dark:bg-violet-500/15 border border-violet-200/50 dark:border-violet-800/30">
                <motion.div 
                  className="w-2 h-2 rounded-full bg-violet-500"
                  animate={{ scale: [1, 1.3, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
                <span className="text-sm font-medium text-violet-700 dark:text-violet-300">
                  {remaining} question{remaining !== 1 ? 's' : ''} left to review
                </span>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground font-medium flex items-center gap-1.5">
                    <Target className="w-3.5 h-3.5" />
                    {displayAnswered} of {displayTotal} completed
                  </span>
                  <span className={`font-bold ${colors.text}`}>{progress}%</span>
                </div>
                <div className="relative h-2.5 bg-muted/30 dark:bg-muted/20 rounded-full overflow-hidden">
                  <motion.div 
                    className={`absolute inset-y-0 left-0 rounded-full ${colors.icon.replace('bg-gradient-to-br', 'bg-gradient-to-r')}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                  />
                </div>
              </div>
            )}
            
            {/* Action button */}
            <Button
              onClick={onContinue}
              className={`w-full gap-2 h-10 shadow-md transition-all duration-300 ${
                isRevising 
                  ? 'bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700' 
                  : colors.icon.replace('bg-gradient-to-br', 'bg-gradient-to-r')
              } hover:brightness-110 text-white border-0`}
              data-testid="button-continue-quiz"
            >
              <Play className="w-4 h-4 fill-current" />
              <span className="font-semibold">{isRevising ? 'Continue Review' : 'Continue Quiz'}</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { 
    currentQuiz, 
    userAnswers,
    checkedQuestions,
    setCurrentQuiz, 
    setSourceMaterial, 
    resetQuiz, 
    clearUserAnswers,
    clearRetryProgress,
    savedProgresses,
    loadSavedProgress,
    removeSavedProgress,
    clearRestoredState,
  } = useQuiz();
  const { user } = useAuth();
  const [revisionExitWarning, setRevisionExitWarning] = useState<{ open: boolean; quizId: string | null; type: 'saved' | null }>({ 
    open: false, 
    quizId: null, 
    type: null 
  });

  const { data: quizzes, isLoading } = useQuery<Quiz[]>({
    queryKey: ["/api/quizzes"],
  });

  const { data: userStats } = useQuery<UserStats>({
    queryKey: ["/api/user/stats"],
  });

  const handleTakeQuiz = (quiz: Quiz) => {
    // Check if there's saved progress for this quiz
    const hasSavedProgress = savedProgresses.some(p => p.quizId === quiz.id);
    if (hasSavedProgress) {
      loadSavedProgress(quiz.id);
    } else {
      setCurrentQuiz({
        ...quiz,
        createdAt: typeof quiz.createdAt === "string" ? quiz.createdAt : quiz.createdAt.toISOString(),
      } as any);
      setSourceMaterial({
        type: quiz.sourceImageUrl ? "image" : null,
        text: quiz.sourceText,
        imageDataUrl: quiz.sourceImageUrl || null,
        isOfficeWithImages: (quiz.sourceImages?.length || 0) > 0,
        documentImages: quiz.sourceImages || [],
      });
    }
    setLocation("/quiz");
  };

  const handleStudyQuiz = (quiz: Quiz) => {
    setCurrentQuiz({
      ...quiz,
      createdAt: typeof quiz.createdAt === "string" ? quiz.createdAt : quiz.createdAt.toISOString(),
    } as any);
    setSourceMaterial({
      type: quiz.sourceImageUrl ? "image" : null,
      text: quiz.sourceText,
      imageDataUrl: quiz.sourceImageUrl || null,
      isOfficeWithImages: (quiz.sourceImages?.length || 0) > 0,
      documentImages: quiz.sourceImages || [],
    });
    setLocation("/study");
  };

  const handleContinueQuiz = () => {
    setLocation("/quiz");
  };

  const handleContinueSavedQuiz = (quizId: string) => {
    loadSavedProgress(quizId);
    setLocation("/quiz");
  };

  // Helper to check if a quiz item is in revision mode
  const isQuizInRevisionMode = (item: { quiz: Quiz; answers: Record<string, string>; checkedQuestions: string[] }) => {
    const answerKeys = Object.keys(item.answers);
    const retryAnswerKeys = answerKeys.filter(k => k.startsWith('retry-'));
    const totalQuestions = item.quiz.questions?.length || 0;
    const checkedQuestionsCount = item.checkedQuestions?.length || 0;
    
    // Calculate wrong answers from first attempt (case-insensitive comparison)
    let wrongQuestionsCount = 0;
    if (item.quiz.questions) {
      const questions = item.quiz.questions as any[];
      wrongQuestionsCount = questions.filter(q => {
        const userAnswer = item.answers[q.id];
        return userAnswer && userAnswer.toLowerCase().trim() !== q.correctAnswer.toLowerCase().trim();
      }).length;
    }
    
    const hasCompletedFirstAttempt = checkedQuestionsCount >= totalQuestions && totalQuestions > 0;
    const hasWrongAnswersToRetry = wrongQuestionsCount > 0;
    const hasRetryProgress = retryAnswerKeys.length > 0;
    
    return (hasCompletedFirstAttempt && hasWrongAnswersToRetry) || hasRetryProgress;
  };

  const handleDiscardProgress = () => {
    // Also delete from API if the current quiz has saved progress
    if (currentQuiz?.id) {
      removeSavedProgress(currentQuiz.id);
    }
    clearUserAnswers();
    resetQuiz();
  };

  const handleDiscardSavedProgress = (quizId: string) => {
    removeSavedProgress(quizId);
  };

  // Handle discard with revision warning
  const handleAttemptDiscard = (item: { type: 'saved'; quizId: string; quiz: Quiz; answers: Record<string, string>; checkedQuestions: string[] }) => {
    const isRevising = isQuizInRevisionMode(item);
    
    if (isRevising) {
      // Show warning dialog for revision mode exit
      setRevisionExitWarning({ open: true, quizId: item.quizId, type: 'saved' });
    } else {
      // No revision progress to lose, discard normally
      handleDiscardSavedProgress(item.quizId);
    }
  };

  // Confirm revision exit - delete the entire quiz progress
  const handleConfirmRevisionExit = () => {
    const { quizId } = revisionExitWarning;
    
    if (quizId) {
      handleDiscardSavedProgress(quizId);
    }
    
    setRevisionExitWarning({ open: false, quizId: null, type: null });
  };

  const hasInProgressQuiz = currentQuiz && Object.keys(userAnswers).length > 0;
  const inProgressAnsweredCount = Object.keys(userAnswers).filter(k => !k.startsWith('retry-')).length;
  const inProgressTotalCount = currentQuiz?.questions?.length || 0;

  // Show only saved progresses from the database in the carousel
  const allSavedQuizzes = useMemo(() => {
    const items: Array<{
      type: 'saved';
      quizId: string;
      quiz: Quiz;
      answers: Record<string, string>;
      checkedQuestions: string[];
      savedAt: string;
    }> = [];
    
    // Only show saved progresses from the API (with savedAt timestamps)
    savedProgresses.forEach(p => {
      // Merge retryAnswers into answers with 'retry-' prefix for revision detection
      const mergedAnswers: Record<string, string> = { ...p.answers };
      if (p.retryAnswers) {
        Object.entries(p.retryAnswers).forEach(([key, value]) => {
          mergedAnswers[`retry-${key}`] = value;
        });
      }
      
      items.push({
        type: 'saved',
        quizId: p.quizId,
        quiz: p.quiz,
        answers: mergedAnswers,
        checkedQuestions: p.checkedQuestions || [],
        savedAt: p.savedAt,
      });
    });
    
    return items;
  }, [savedProgresses]);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const [activeIndex, setActiveIndex] = useState(0);

  const checkScroll = useCallback(() => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 5);
      setActiveIndex(Math.round(scrollLeft / clientWidth));
    }
  }, []);

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, [checkScroll, allSavedQuizzes]);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = scrollContainerRef.current.clientWidth;
      scrollContainerRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };


  const hasSavedQuizzes = allSavedQuizzes.length > 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  const totalQuizzes = quizzes?.length || 0;
  const totalQuestions = quizzes?.reduce((acc, q) => acc + (q.questions as any[]).length, 0) || 0;
  const recentQuizzes = quizzes?.slice(0, 6) || [];
  const hasQuizzes = totalQuizzes > 0;
  
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  

  return (
    <div className="container mx-auto px-4 py-6 md:py-8 max-w-5xl">
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-8"
      >
        {/* Welcome Section */}
        <motion.section variants={itemVariants}>
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-1">
                {getGreeting()}
              </h1>
              <p className="text-muted-foreground">
                {hasQuizzes 
                  ? "Continue where you left off or create something new."
                  : "Let's create your first quiz and start learning."
                }
              </p>
            </div>
            {/* {hasQuizzes && (
              <Button onClick={() => setLocation("/create")} data-testid="button-create-new">
                <Plus className="w-4 h-4 mr-2" />
                New Quiz
              </Button>
            )} */}
          </div>
        </motion.section>

        {/* Stats + Continue Learning - Side by Side */}
        {hasQuizzes && (
          <motion.section variants={itemVariants}>
            <div className={`grid gap-5 ${hasSavedQuizzes ? 'lg:grid-cols-[1fr_280px]' : ''}`}>
              {/* Continue Learning (left/top) */}
              {hasSavedQuizzes && (
                <div className="relative group/carousel min-w-0">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                      <Play className="w-4 h-4 text-primary fill-primary" />
                      Continue Learning
                    </h2>
                    <div className="hidden md:flex items-center gap-2">
                      <Button 
                        variant="outline" 
                        size="icon" 
                        className={`h-8 w-8 rounded-full transition-all duration-300 ${!canScrollLeft ? 'opacity-0 scale-90 pointer-events-none' : 'opacity-100 scale-100'}`}
                        onClick={() => scroll('left')}
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="outline" 
                        size="icon" 
                        className={`h-8 w-8 rounded-full transition-all duration-300 ${!canScrollRight ? 'opacity-0 scale-90 pointer-events-none' : 'opacity-100 scale-100'}`}
                        onClick={() => scroll('right')}
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="relative">
                    <div 
                      ref={scrollContainerRef}
                      onScroll={checkScroll}
                      className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-none scroll-smooth"
                      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                    >
                      {allSavedQuizzes.map((item, idx) => {
                        const answerKeys = Object.keys(item.answers);
                        const retryAnswerKeys = answerKeys.filter(k => k.startsWith('retry-'));
                        const originalAnswerKeys = answerKeys.filter(k => !k.startsWith('retry-'));
                        const totalQuestions = item.quiz.questions?.length || 0;
                        const checkedQuestionsCount = item.checkedQuestions?.length || 0;
                        
                        let wrongQuestionsCount = 0;
                        if (item.quiz.questions) {
                          const questions = item.quiz.questions as any[];
                          wrongQuestionsCount = questions.filter(q => {
                            const userAnswer = item.answers[q.id];
                            return userAnswer && userAnswer.toLowerCase().trim() !== q.correctAnswer.toLowerCase().trim();
                          }).length;
                        }
                        
                        const hasCompletedFirstAttempt = checkedQuestionsCount >= totalQuestions && totalQuestions > 0;
                        const hasWrongAnswersToRetry = wrongQuestionsCount > 0;
                        const hasRetryProgress = retryAnswerKeys.length > 0;
                        const isRevising = (hasCompletedFirstAttempt && hasWrongAnswersToRetry) || hasRetryProgress;
                        
                        const retryAnsweredCount = retryAnswerKeys.length;
                        const retryTotalCount = wrongQuestionsCount;
                        
                        return (
                          <div 
                            key={item.quizId + idx} 
                            className="w-full flex-shrink-0 snap-center"
                          >
                            <ContinueQuizCard
                              quiz={item.quiz}
                              answeredCount={originalAnswerKeys.length}
                              totalCount={item.quiz.questions?.length || 0}
                              onContinue={() => handleContinueSavedQuiz(item.quizId)}
                              onDiscard={() => handleAttemptDiscard(item)}
                              isCurrent={false}
                              savedAt={item.savedAt}
                              isRevising={isRevising}
                              retryAnsweredCount={retryAnsweredCount}
                              retryTotalCount={retryTotalCount}
                            />
                          </div>
                        );
                      })}
                    </div>

                    {allSavedQuizzes.length > 1 && (
                      <div className="flex justify-center gap-1.5 mt-2">
                        {allSavedQuizzes.map((_, i) => (
                          <div 
                            key={i} 
                            className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                              activeIndex === i ? 'bg-primary w-3' : 'bg-muted-foreground/30'
                            }`}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Stats (right/bottom) */}
              <div className={hasSavedQuizzes ? 'flex flex-col gap-3' : 'grid grid-cols-3 gap-4'}>
                <StatCard
                  label="CREATED"
                  value={totalQuizzes}
                  icon={() => <FontAwesomeIcon icon={faFileLines} className="h-5 w-5" />}
                  gradient="bg-gradient-to-br from-blue-500 to-blue-600"
                />
                <StatCard
                  label="QUESTIONS"
                  value={totalQuestions}
                  icon={() => <FontAwesomeIcon icon={faMessage} className="h-5 w-5" />}
                  gradient="bg-gradient-to-br from-violet-500 to-violet-600"
                />
                <StatCard
                  label="ACCURACY"
                  value={userStats?.totalAttempts ? `${userStats.averageAccuracy}%` : "-"}
                  icon={() => <FontAwesomeIcon icon={faChartSimple} className="h-5 w-5" />}
                  gradient="bg-gradient-to-br from-emerald-500 to-emerald-600"
                  isActive={(userStats?.totalAttempts ?? 0) > 0}
                  onClick={() => setLocation("/progress")}
                />
              </div>
            </div>
          </motion.section>
        )}

        {/* Quick Actions */}
        {hasQuizzes && (
          <motion.section variants={itemVariants}>
            <h2 className="text-lg font-semibold text-foreground mb-4">Quick Actions</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <QuickActionCard
                title="Create New Quiz"
                description="Upload materials and generate questions"
                icon={Plus}
                onClick={() => setLocation("/create")}
                variant="primary"
                testId="card-create-quiz"
              />
              {recentQuizzes[0] && (
                <QuickActionCard
                  title="Continue Studying"
                  description={recentQuizzes[0].title}
                  icon={BookOpen}
                  onClick={() => handleStudyQuiz(recentQuizzes[0])}
                  testId="card-continue-studying"
                />
              )}
            </div>
          </motion.section>
        )}

        {/* Recent Quizzes or Empty State */}
        <motion.section variants={itemVariants}>
          {!hasQuizzes ? (
            <EmptyState onCreateQuiz={() => setLocation("/create")} />
          ) : (
            <div>
              <div className="flex items-center justify-between gap-4 mb-4">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <h2 className="font-semibold text-foreground">Recent Quizzes</h2>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setLocation("/history")}
                  data-testid="button-view-all"
                >
                  View all
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
              
              <div className="space-y-2">
                {recentQuizzes.map((quiz, index) => (
                  <QuizCard
                    key={quiz.id}
                    quiz={quiz}
                    index={index}
                    onTake={() => handleTakeQuiz(quiz)}
                    onStudy={() => handleStudyQuiz(quiz)}
                  />
                ))}
              </div>
            </div>
          )}
        </motion.section>

        {/* Learning Tip */}
        {hasQuizzes && <LearningTipCard />}
      </motion.div>

      <AlertDialog 
        open={revisionExitWarning.open} 
        onOpenChange={(open) => !open && setRevisionExitWarning({ open: false, quizId: null, type: null })}
      >
        <AlertDialogContent data-testid="dialog-revision-exit-warning">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Quiz Progress?</AlertDialogTitle>
            <AlertDialogDescription>
              You're currently revising this quiz. Deleting will remove all your progress including your original answers and revision progress.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-revision-exit">
              Keep Revising
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmRevisionExit}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-revision-exit"
            >
              Delete All Progress
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
