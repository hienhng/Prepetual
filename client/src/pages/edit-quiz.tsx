import { useState, useMemo, useRef, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Save, X, Plus, Trash2, Edit2, ChevronDown, ChevronUp, 
  Copy, ArrowUp, ArrowDown, Eye, EyeOff, CheckSquare, Square,
  Search, Filter, MoreHorizontal, GripVertical, Shuffle,
  ChevronLeft, ChevronRight, FileText, ListChecks, ToggleLeft,
  ImagePlus, Image as ImageIcon, Sparkles, Loader2, PenLine, Wand2
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useQuiz } from "@/lib/quiz-context";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Question, QuestionType } from "@shared/schema";

type ViewMode = "edit" | "preview";
type QuestionFilter = "all" | "multiple_choice" | "true_false" | "short_answer";

export default function EditQuizPage() {
  const [, setLocation] = useLocation();
  const { currentQuiz, setCurrentQuiz } = useQuiz();
  const { toast } = useToast();
  
  const [title, setTitle] = useState(currentQuiz?.title || "");
  const [questions, setQuestions] = useState<Question[]>(
    (currentQuiz?.questions as Question[]) || []
  );
  const [expandedIndex, setExpandedIndex] = useState<number | null>(0);
  const [isSaving, setIsSaving] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("edit");
  const [selectedQuestions, setSelectedQuestions] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<QuestionFilter>("all");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isRevising, setIsRevising] = useState<number | null>(null);
  const [reviseDialogIndex, setReviseDialogIndex] = useState<number | null>(null);
  const [reviseSelectedAnswer, setReviseSelectedAnswer] = useState<string>("");
  const [previewIndex, setPreviewIndex] = useState(0);
  const [typeChangeDialog, setTypeChangeDialog] = useState<{ index: number; newType: QuestionType } | null>(null);
  const [isConverting, setIsConverting] = useState<number | null>(null);

  useEffect(() => {
    if (currentQuiz) {
      setTitle(currentQuiz.title || "");
      setQuestions((currentQuiz.questions as Question[]) || []);
    }
  }, [currentQuiz?.id]);

  const questionStats = useMemo(() => {
    const stats = { multiple_choice: 0, true_false: 0, short_answer: 0 };
    questions.forEach(q => {
      if (q.type in stats) stats[q.type as keyof typeof stats]++;
    });
    return stats;
  }, [questions]);

  const filteredQuestions = useMemo(() => {
    return questions.filter((q, idx) => {
      const matchesSearch = q.question.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = typeFilter === "all" || q.type === typeFilter;
      return matchesSearch && matchesType;
    });
  }, [questions, searchQuery, typeFilter]);

  const getQuestionIndex = (question: Question) => {
    return questions.findIndex(q => q.id === question.id);
  };

  if (!currentQuiz) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <Edit2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">No quiz to edit</h2>
        <p className="text-muted-foreground mb-4">
          Generate a quiz first to edit it
        </p>
        <Link href="/generate">
          <Button data-testid="button-go-generate">Create Quiz</Button>
        </Link>
      </div>
    );
  }

  const handleQuestionChange = (index: number, field: keyof Question, value: any) => {
    const updated = [...questions];
    updated[index] = { ...updated[index], [field]: value };
    setQuestions(updated);
  };

  const handleOptionChange = (questionIndex: number, optionIndex: number, value: string) => {
    const updated = [...questions];
    const options = [...(updated[questionIndex].options || [])];
    options[optionIndex] = value;
    updated[questionIndex] = { ...updated[questionIndex], options };
    setQuestions(updated);
  };

  const addOption = (questionIndex: number) => {
    const updated = [...questions];
    const options = [...(updated[questionIndex].options || [])];
    options.push(`${String.fromCharCode(65 + options.length)}) New option`);
    updated[questionIndex] = { ...updated[questionIndex], options };
    setQuestions(updated);
  };

  const removeOption = (questionIndex: number, optionIndex: number) => {
    const updated = [...questions];
    const options = [...(updated[questionIndex].options || [])];
    options.splice(optionIndex, 1);
    updated[questionIndex] = { ...updated[questionIndex], options };
    setQuestions(updated);
  };

  const addQuestion = (type: QuestionType = "multiple_choice") => {
    const newQuestion: Question = {
      id: `new-${Date.now()}`,
      type,
      question: type === "true_false" ? "New true/false statement" : "New question",
      options: type === "multiple_choice" 
        ? ["A) Option 1", "B) Option 2", "C) Option 3", "D) Option 4"]
        : type === "true_false" 
        ? ["True", "False"]
        : undefined,
      correctAnswer: type === "multiple_choice" 
        ? "A) Option 1" 
        : type === "true_false"
        ? "True"
        : "",
      explanation: "",
    };
    setQuestions([...questions, newQuestion]);
    setExpandedIndex(questions.length);
    toast({ title: "Question added", description: `New ${type.replace("_", " ")} question added` });
  };

  const duplicateQuestion = (index: number) => {
    const original = questions[index];
    const duplicate: Question = {
      ...original,
      id: `dup-${Date.now()}`,
      question: `${original.question} (copy)`,
    };
    const updated = [...questions];
    updated.splice(index + 1, 0, duplicate);
    setQuestions(updated);
    setExpandedIndex(index + 1);
    toast({ title: "Question duplicated" });
  };

  const moveQuestion = (index: number, direction: "up" | "down") => {
    if (direction === "up" && index === 0) return;
    if (direction === "down" && index === questions.length - 1) return;
    
    const updated = [...questions];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    [updated[index], updated[targetIndex]] = [updated[targetIndex], updated[index]];
    setQuestions(updated);
    setExpandedIndex(targetIndex);
  };

  const removeQuestion = (index: number) => {
    if (questions.length <= 1) {
      toast({ title: "Cannot remove", description: "Quiz must have at least one question", variant: "destructive" });
      return;
    }
    const updated = [...questions];
    const removedId = updated[index].id;
    updated.splice(index, 1);
    setQuestions(updated);
    setSelectedQuestions(prev => {
      const newSet = new Set(prev);
      newSet.delete(removedId);
      return newSet;
    });
    setExpandedIndex(null);
    toast({ title: "Question removed" });
  };

  const toggleSelectQuestion = (questionId: string) => {
    setSelectedQuestions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(questionId)) {
        newSet.delete(questionId);
      } else {
        newSet.add(questionId);
      }
      return newSet;
    });
  };

  const selectAll = () => {
    if (selectedQuestions.size === filteredQuestions.length) {
      setSelectedQuestions(new Set());
    } else {
      setSelectedQuestions(new Set(filteredQuestions.map(q => q.id)));
    }
  };

  const deleteSelected = () => {
    if (selectedQuestions.size === questions.length) {
      toast({ title: "Cannot delete all", description: "Quiz must have at least one question", variant: "destructive" });
      return;
    }
    const updated = questions.filter(q => !selectedQuestions.has(q.id));
    setQuestions(updated);
    setSelectedQuestions(new Set());
    setExpandedIndex(null);
    setShowDeleteDialog(false);
    toast({ title: "Questions deleted", description: `${selectedQuestions.size} question(s) removed` });
  };

  const shuffleQuestions = () => {
    const shuffled = [...questions].sort(() => Math.random() - 0.5);
    setQuestions(shuffled);
    toast({ title: "Questions shuffled" });
  };

  const expandAll = () => {
    setExpandedIndex(-1);
  };

  const collapseAll = () => {
    setExpandedIndex(null);
  };

  const handleImageUpload = (questionIndex: number, file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({ title: "Invalid file", description: "Please upload an image file", variant: "destructive" });
      return;
    }
    
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "Image must be under 5MB", variant: "destructive" });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const imageUrl = e.target?.result as string;
      handleQuestionChange(questionIndex, "imageUrl", imageUrl);
      toast({ title: "Image added" });
    };
    reader.readAsDataURL(file);
  };

  const removeQuestionImage = (questionIndex: number) => {
    handleQuestionChange(questionIndex, "imageUrl", undefined);
    toast({ title: "Image removed" });
  };

  const handleSave = async (): Promise<boolean> => {
    setIsSaving(true);
    try {
      const response = await apiRequest("PUT", `/api/quiz/${currentQuiz.id}`, {
        title,
        questions,
      });
      const updatedQuiz = await response.json();
      setCurrentQuiz(updatedQuiz);
      queryClient.invalidateQueries({ queryKey: ["/api/quizzes"] });
      toast({ title: "Quiz saved", description: "Your changes have been saved" });
      return true;
    } catch (error) {
      toast({ title: "Error", description: "Failed to save quiz", variant: "destructive" });
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleAiRevise = (questionIndex: number) => {
    const q = questions[questionIndex];
    setReviseDialogIndex(questionIndex);
    setReviseSelectedAnswer(q.correctAnswer);
  };

  const confirmAiRevise = async () => {
    if (reviseDialogIndex === null) return;
    const questionIndex = reviseDialogIndex;
    setReviseDialogIndex(null);
    setIsRevising(questionIndex);
    try {
      const response = await apiRequest("POST", `/api/quiz/${currentQuiz.id}/ai-revise`, {
        questionIndex,
        userCorrectAnswer: reviseSelectedAnswer,
      });
      const updatedQuiz = await response.json();
      setQuestions(updatedQuiz.questions);
      setCurrentQuiz(updatedQuiz);
      queryClient.invalidateQueries({ queryKey: ["/api/quizzes"] });
      toast({ title: "Question revised", description: `Q${questionIndex + 1} has been revised by AI` });
    } catch (error) {
      toast({ title: "Revise failed", description: "Something went wrong. Please try again.", variant: "destructive" });
    } finally {
      setIsRevising(null);
    }
  };

  const applyManualTypeChange = (index: number, newType: QuestionType) => {
    handleQuestionChange(index, "type", newType);
    if (newType === "true_false") {
      handleQuestionChange(index, "options", ["True", "False"]);
      handleQuestionChange(index, "correctAnswer", "True");
    } else if (newType === "multiple_choice") {
      const q = questions[index];
      if (!q.options || q.options.length < 2) {
        handleQuestionChange(index, "options", ["Option 1", "Option 2", "Option 3", "Option 4"]);
        handleQuestionChange(index, "correctAnswer", "Option 1");
      }
    } else if (newType === "short_answer") {
      handleQuestionChange(index, "options", undefined);
    }
  };

  const handleAiConvertType = async () => {
    if (!typeChangeDialog) return;
    const { index, newType } = typeChangeDialog;
    setTypeChangeDialog(null);
    setIsConverting(index);
    try {
      const response = await apiRequest("POST", `/api/quiz/${currentQuiz.id}/convert-question-type`, {
        questionIndex: index,
        newType,
      });
      const updatedQuiz = await response.json();
      setQuestions(updatedQuiz.questions);
      setCurrentQuiz(updatedQuiz);
      queryClient.invalidateQueries({ queryKey: ["/api/quizzes"] });
      toast({ title: "Question converted", description: `Converted to ${newType.replace("_", " ")} using AI` });
    } catch (error) {
      toast({ title: "Conversion failed", description: "Something went wrong. Please try again.", variant: "destructive" });
    } finally {
      setIsConverting(null);
    }
  };

  const handleStartQuiz = async () => {
    const saved = await handleSave();
    if (saved) {
      setCurrentQuiz({
        ...currentQuiz,
        title,
        questions,
      } as any);
      setLocation("/quiz");
    }
  };

  const getTypeBadgeVariant = (type: QuestionType) => {
    switch (type) {
      case "multiple_choice": return "default";
      case "true_false": return "secondary";
      case "short_answer": return "outline";
      default: return "default";
    }
  };

  const getTypeLabel = (type: QuestionType) => {
    switch (type) {
      case "multiple_choice": return "MC";
      case "true_false": return "T/F";
      case "short_answer": return "SA";
      default: return type;
    }
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Edit2 className="h-6 w-6" />
              Edit Quiz
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Customize your quiz before taking it
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setViewMode(viewMode === "edit" ? "preview" : "edit")}
              data-testid="button-toggle-view"
            >
              {viewMode === "edit" ? <Eye className="h-4 w-4 mr-1" /> : <EyeOff className="h-4 w-4 mr-1" />}
              {viewMode === "edit" ? "Preview" : "Edit"}
            </Button>
            <Link href="/history">
              <Button variant="outline" size="sm" data-testid="button-cancel-edit">
                <X className="h-4 w-4 mr-1" />
                Cancel
              </Button>
            </Link>
            <Button size="sm" onClick={handleStartQuiz} data-testid="button-start-edited">
              Start Quiz
            </Button>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {viewMode === "edit" ? (
            <motion.div
              key="edit"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              <Card>
                <CardHeader className="py-4">
                  <CardTitle className="text-base">Quiz Title</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Enter quiz title"
                    className="text-lg font-medium"
                    data-testid="input-quiz-title"
                  />
                </CardContent>
              </Card>

              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="gap-1">
                  <ListChecks className="h-3 w-3" />
                  {questions.length} total
                </Badge>
                {questionStats.multiple_choice > 0 && (
                  <Badge variant="default" className="gap-1">MC: {questionStats.multiple_choice}</Badge>
                )}
                {questionStats.true_false > 0 && (
                  <Badge variant="secondary" className="gap-1">T/F: {questionStats.true_false}</Badge>
                )}
                {questionStats.short_answer > 0 && (
                  <Badge variant="outline" className="gap-1">SA: {questionStats.short_answer}</Badge>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search questions..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                    data-testid="input-search-questions"
                  />
                </div>
                <Select value={typeFilter} onValueChange={(v: QuestionFilter) => setTypeFilter(v)}>
                  <SelectTrigger className="w-[160px]" data-testid="select-type-filter">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="multiple_choice">Multiple Choice</SelectItem>
                    <SelectItem value="true_false">True/False</SelectItem>
                    <SelectItem value="short_answer">Short Answer</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between gap-2 flex-wrap border-b pb-3">
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={selectAll}
                    data-testid="button-select-all"
                  >
                    {selectedQuestions.size === filteredQuestions.length && filteredQuestions.length > 0 ? (
                      <CheckSquare className="h-4 w-4 mr-1" />
                    ) : (
                      <Square className="h-4 w-4 mr-1" />
                    )}
                    {selectedQuestions.size > 0 ? `${selectedQuestions.size} selected` : "Select all"}
                  </Button>
                  
                  {selectedQuestions.size > 0 && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setShowDeleteDialog(true)}
                      data-testid="button-delete-selected"
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Delete
                    </Button>
                  )}
                </div>
                
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={expandAll} data-testid="button-expand-all">
                    <ChevronDown className="h-4 w-4 mr-1" />
                    Expand All
                  </Button>
                  <Button variant="ghost" size="sm" onClick={collapseAll} data-testid="button-collapse-all">
                    <ChevronUp className="h-4 w-4 mr-1" />
                    Collapse
                  </Button>
                  <Button variant="ghost" size="sm" onClick={shuffleQuestions} data-testid="button-shuffle">
                    <Shuffle className="h-4 w-4 mr-1" />
                    Shuffle
                  </Button>
                  
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" data-testid="button-add-question">
                        <Plus className="h-4 w-4 mr-1" />
                        Add
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => addQuestion("multiple_choice")}>
                        <ListChecks className="h-4 w-4 mr-2" />
                        Multiple Choice
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => addQuestion("true_false")}>
                        <ToggleLeft className="h-4 w-4 mr-2" />
                        True/False
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => addQuestion("short_answer")}>
                        <FileText className="h-4 w-4 mr-2" />
                        Short Answer
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              <div className="space-y-3">
                {filteredQuestions.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {searchQuery || typeFilter !== "all" 
                      ? "No questions match your search" 
                      : "No questions yet. Add one above!"}
                  </div>
                ) : (
                  filteredQuestions.map((question) => {
                    const index = getQuestionIndex(question);
                    const isExpanded = expandedIndex === -1 || expandedIndex === index;
                    
                    return (
                      <Card 
                        key={question.id} 
                        className={`transition-all ${selectedQuestions.has(question.id) ? "ring-2 ring-primary" : ""} ${isRevising === index || isConverting === index ? "opacity-60 pointer-events-none" : ""}`}
                        data-testid={`card-question-${index}`}
                      >
                        <CardHeader className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <Checkbox
                              checked={selectedQuestions.has(question.id)}
                              onCheckedChange={() => toggleSelectQuestion(question.id)}
                              data-testid={`checkbox-question-${index}`}
                            />
                            
                            <div 
                              className="flex-1 flex items-center gap-2 cursor-pointer min-w-0"
                              onClick={() => setExpandedIndex(expandedIndex === index ? null : index)}
                            >
                              <Badge variant={getTypeBadgeVariant(question.type)} className="shrink-0">
                                {getTypeLabel(question.type)}
                              </Badge>
                              <span className="text-sm text-muted-foreground shrink-0">
                                {isRevising === index || isConverting === index ? <Loader2 className="h-3.5 w-3.5 animate-spin inline" /> : `Q${index + 1}`}
                              </span>
                              {question.imageUrl && (
                                <ImageIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              )}
                              <span className="text-sm font-medium truncate">{question.question}</span>
                            </div>
                            
                            <div className="flex items-center gap-1 shrink-0">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => moveQuestion(index, "up")}
                                disabled={index === 0}
                                data-testid={`button-move-up-${index}`}
                              >
                                <ArrowUp className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => moveQuestion(index, "down")}
                                disabled={index === questions.length - 1}
                                data-testid={`button-move-down-${index}`}
                              >
                                <ArrowDown className="h-4 w-4" />
                              </Button>
                              
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button size="icon" variant="ghost">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    onClick={() => handleAiRevise(index)}
                                    disabled={isRevising !== null}
                                  >
                                    {isRevising === index ? (
                                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    ) : (
                                      <Sparkles className="h-4 w-4 mr-2" />
                                    )}
                                    AI Revise
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => duplicateQuestion(index)}>
                                    <Copy className="h-4 w-4 mr-2" />
                                    Duplicate
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem 
                                    onClick={() => removeQuestion(index)}
                                    className="text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                              
                              {isExpanded ? (
                                <ChevronUp 
                                  className="h-4 w-4 text-muted-foreground cursor-pointer" 
                                  onClick={() => setExpandedIndex(null)}
                                />
                              ) : (
                                <ChevronDown 
                                  className="h-4 w-4 text-muted-foreground cursor-pointer"
                                  onClick={() => setExpandedIndex(index)}
                                />
                              )}
                            </div>
                          </div>
                        </CardHeader>

                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                            >
                              <CardContent className="space-y-4 pt-0 px-4 pb-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                  <div className="space-y-2">
                                    <Label className="text-xs text-muted-foreground">Question Type</Label>
                                    <Select
                                      value={question.type}
                                      onValueChange={(value: QuestionType) => {
                                        if (value === question.type) return;
                                        setTypeChangeDialog({ index: getQuestionIndex(question), newType: value });
                                      }}
                                    >
                                      <SelectTrigger data-testid={`select-type-${index}`}>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="multiple_choice">Multiple Choice</SelectItem>
                                        <SelectItem value="true_false">True/False</SelectItem>
                                        <SelectItem value="short_answer">Short Answer</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  
                                  {question.type !== "multiple_choice" && (
                                    <div className="space-y-2">
                                      <Label className="text-xs text-muted-foreground">Correct Answer</Label>
                                      <div 
                                        className="px-3 py-2 rounded-md border bg-green-500/10 border-green-500/30 text-sm"
                                        data-testid={`text-answer-${index}`}
                                      >
                                        {question.correctAnswer}
                                        <span className="ml-2 text-xs text-green-600 dark:text-green-400">(cannot be edited)</span>
                                      </div>
                                    </div>
                                  )}
                                </div>

                                <div className="space-y-2">
                                  <Label className="text-xs text-muted-foreground">Question Text</Label>
                                  <Textarea
                                    value={question.question}
                                    onChange={(e) => handleQuestionChange(index, "question", e.target.value)}
                                    className="min-h-[80px]"
                                    data-testid={`input-question-${index}`}
                                  />
                                </div>

                                <div className="space-y-2">
                                  <Label className="text-xs text-muted-foreground">Question Image (optional)</Label>
                                  {question.imageUrl ? (
                                    <div className="relative group">
                                      <img 
                                        src={question.imageUrl} 
                                        alt="Question image" 
                                        className="max-h-48 rounded-lg border object-contain"
                                      />
                                      <Button
                                        size="icon"
                                        variant="destructive"
                                        onClick={() => removeQuestionImage(index)}
                                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                                        data-testid={`button-remove-image-${index}`}
                                      >
                                        <X className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  ) : (
                                    <label 
                                      className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                                      data-testid={`label-upload-image-${index}`}
                                    >
                                      <div className="flex flex-col items-center justify-center">
                                        <ImagePlus className="h-6 w-6 text-muted-foreground mb-1" />
                                        <span className="text-xs text-muted-foreground">Click to add image</span>
                                      </div>
                                      <input 
                                        type="file" 
                                        className="hidden" 
                                        accept="image/*"
                                        onChange={(e) => {
                                          const file = e.target.files?.[0];
                                          if (file) handleImageUpload(index, file);
                                          e.target.value = '';
                                        }}
                                        data-testid={`input-image-${index}`}
                                      />
                                    </label>
                                  )}
                                </div>

                                {question.type === "multiple_choice" && (
                                  <div className="space-y-2">
                                    <Label className="text-xs text-muted-foreground">Answer Options (use arrows to reorder)</Label>
                                    <div className="space-y-2">
                                      {question.options?.map((option, optIndex) => (
                                        <div key={optIndex} className="flex gap-2 items-center group">
                                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium shrink-0 ${
                                            option === question.correctAnswer 
                                              ? "bg-green-500/20 text-green-600 dark:text-green-400 ring-1 ring-green-500" 
                                              : "bg-muted text-muted-foreground"
                                          }`}>
                                            {String.fromCharCode(65 + optIndex)}
                                          </div>
                                          <div 
                                            className={`flex-1 px-3 py-2 rounded-md border text-sm ${
                                              option === question.correctAnswer 
                                                ? "bg-green-500/10 border-green-500/30" 
                                                : "bg-muted/50 border-border"
                                            }`}
                                            data-testid={`text-option-${index}-${optIndex}`}
                                          >
                                            {option}
                                            {option === question.correctAnswer && (
                                              <span className="ml-2 text-xs text-green-600 dark:text-green-400">(correct)</span>
                                            )}
                                          </div>
                                          <div className="flex gap-1">
                                            <Button
                                              size="icon"
                                              variant="ghost"
                                              onClick={() => {
                                                if (optIndex > 0) {
                                                  const newOptions = [...(question.options || [])];
                                                  [newOptions[optIndex - 1], newOptions[optIndex]] = [newOptions[optIndex], newOptions[optIndex - 1]];
                                                  handleQuestionChange(index, "options", newOptions);
                                                }
                                              }}
                                              disabled={optIndex === 0}
                                              className="shrink-0 h-8 w-8"
                                              data-testid={`button-move-option-up-${index}-${optIndex}`}
                                            >
                                              <ChevronUp className="h-4 w-4" />
                                            </Button>
                                            <Button
                                              size="icon"
                                              variant="ghost"
                                              onClick={() => {
                                                if (optIndex < (question.options?.length || 0) - 1) {
                                                  const newOptions = [...(question.options || [])];
                                                  [newOptions[optIndex], newOptions[optIndex + 1]] = [newOptions[optIndex + 1], newOptions[optIndex]];
                                                  handleQuestionChange(index, "options", newOptions);
                                                }
                                              }}
                                              disabled={optIndex === (question.options?.length || 0) - 1}
                                              className="shrink-0 h-8 w-8"
                                              data-testid={`button-move-option-down-${index}-${optIndex}`}
                                            >
                                              <ChevronDown className="h-4 w-4" />
                                            </Button>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                <div className="space-y-2">
                                  <Label className="text-xs text-muted-foreground">Explanation (shown after answering)</Label>
                                  <Textarea
                                    value={question.explanation || ""}
                                    onChange={(e) => handleQuestionChange(index, "explanation", e.target.value)}
                                    placeholder="Explain why this is the correct answer..."
                                    className="min-h-[60px]"
                                    data-testid={`input-explanation-${index}`}
                                  />
                                </div>
                              </CardContent>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </Card>
                    );
                  })
                )}
              </div>

              <div className="flex justify-between gap-2 pt-4 border-t">
                <Button variant="outline" onClick={handleSave} disabled={isSaving} data-testid="button-save-quiz">
                  <Save className="h-4 w-4 mr-1" />
                  {isSaving ? "Saving..." : "Save Changes"}
                </Button>
                <Button onClick={handleStartQuiz} data-testid="button-start-quiz">
                  Start Quiz
                </Button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="preview"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              <Card className="overflow-hidden">
                <div className="bg-gradient-to-r from-primary/10 to-primary/5 p-6">
                  <h2 className="text-xl font-bold">{title || "Untitled Quiz"}</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    {questions.length} questions
                  </p>
                </div>
                
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <span className="text-sm text-muted-foreground">
                      Question {previewIndex + 1} of {questions.length}
                    </span>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setPreviewIndex(Math.max(0, previewIndex - 1))}
                        disabled={previewIndex === 0}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setPreviewIndex(Math.min(questions.length - 1, previewIndex + 1))}
                        disabled={previewIndex === questions.length - 1}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  <AnimatePresence mode="wait">
                    {questions[previewIndex] && (
                      <motion.div
                        key={previewIndex}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="space-y-4"
                      >
                        <div className="flex items-start gap-3">
                          <Badge variant={getTypeBadgeVariant(questions[previewIndex].type)}>
                            {getTypeLabel(questions[previewIndex].type)}
                          </Badge>
                          <h3 className="text-lg font-medium flex-1">
                            {questions[previewIndex].question}
                          </h3>
                        </div>
                        
                        {questions[previewIndex].imageUrl && (
                          <div className="ml-8">
                            <img 
                              src={questions[previewIndex].imageUrl} 
                              alt="Question image" 
                              className="max-h-48 rounded-lg border object-contain"
                            />
                          </div>
                        )}
                        
                        {questions[previewIndex].type === "multiple_choice" && (
                          <div className="space-y-2 ml-8">
                            {questions[previewIndex].options?.map((option, i) => (
                              <div
                                key={i}
                                className={`p-3 rounded-lg border ${
                                  option === questions[previewIndex].correctAnswer
                                    ? "border-green-500 bg-green-500/10"
                                    : "border-border"
                                }`}
                              >
                                {option}
                                {option === questions[previewIndex].correctAnswer && (
                                  <Badge variant="outline" className="ml-2 text-green-600">Correct</Badge>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                        
                        {questions[previewIndex].type === "true_false" && (
                          <div className="space-y-2 ml-8">
                            {["True", "False"].map((option) => (
                              <div
                                key={option}
                                className={`p-3 rounded-lg border ${
                                  option === questions[previewIndex].correctAnswer
                                    ? "border-green-500 bg-green-500/10"
                                    : "border-border"
                                }`}
                              >
                                {option}
                                {option === questions[previewIndex].correctAnswer && (
                                  <Badge variant="outline" className="ml-2 text-green-600">Correct</Badge>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                        
                        {questions[previewIndex].type === "short_answer" && (
                          <div className="ml-8 p-3 rounded-lg border border-green-500 bg-green-500/10">
                            <span className="text-sm text-muted-foreground">Answer: </span>
                            {questions[previewIndex].correctAnswer}
                          </div>
                        )}
                        
                        {questions[previewIndex].explanation && (
                          <div className="ml-8 p-3 rounded-lg bg-muted/50">
                            <span className="text-sm font-medium">Explanation: </span>
                            <span className="text-sm text-muted-foreground">
                              {questions[previewIndex].explanation}
                            </span>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </CardContent>
              </Card>
              
              <div className="flex flex-wrap gap-2 justify-center">
                {questions.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setPreviewIndex(i)}
                    className={`w-8 h-8 rounded-full text-sm font-medium transition-all ${
                      i === previewIndex
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted hover:bg-muted/80"
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedQuestions.size} question(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The selected questions will be permanently removed from this quiz.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={deleteSelected} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={reviseDialogIndex !== null} onOpenChange={(open) => { if (!open) setReviseDialogIndex(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Which answer is correct?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                <p className="mb-3">Select the correct answer, and AI will generate a matching explanation.</p>
                {reviseDialogIndex !== null && (
                  <div className="text-left">
                    <p className="text-sm font-medium text-foreground mb-3">{questions[reviseDialogIndex]?.question}</p>
                    {questions[reviseDialogIndex]?.type === "short_answer" ? (
                      <Input
                        value={reviseSelectedAnswer}
                        onChange={(e) => setReviseSelectedAnswer(e.target.value)}
                        placeholder="Type the correct answer..."
                        data-testid="input-revise-answer"
                      />
                    ) : (
                      <RadioGroup
                        value={reviseSelectedAnswer}
                        onValueChange={setReviseSelectedAnswer}
                        className="space-y-2"
                      >
                        {(questions[reviseDialogIndex]?.options || []).map((option, i) => (
                          <label
                            key={i}
                            className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                              reviseSelectedAnswer === option
                                ? "border-primary bg-primary/5"
                                : "border-border hover:bg-muted/50"
                            }`}
                            data-testid={`label-revise-option-${i}`}
                          >
                            <RadioGroupItem value={option} />
                            <span className="text-sm text-foreground">{option}</span>
                          </label>
                        ))}
                      </RadioGroup>
                    )}
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmAiRevise}
              disabled={!reviseSelectedAnswer}
              data-testid="button-confirm-revise"
            >
              <Sparkles className="h-4 w-4 mr-1" />
              Revise with AI
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={typeChangeDialog !== null} onOpenChange={(open) => { if (!open) setTypeChangeDialog(null); }}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base">Change question type</AlertDialogTitle>
            <AlertDialogDescription>
              How would you like to convert this question to {typeChangeDialog?.newType === "multiple_choice" ? "multiple choice" : typeChangeDialog?.newType === "true_false" ? "true/false" : "short answer"}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex flex-col gap-2 py-2">
            <Button
              variant="outline"
              className="justify-start gap-3 h-auto py-3 px-4"
              onClick={() => {
                if (typeChangeDialog) {
                  applyManualTypeChange(typeChangeDialog.index, typeChangeDialog.newType);
                  setTypeChangeDialog(null);
                  toast({ title: "Type changed", description: "Edit the question content manually" });
                }
              }}
              data-testid="button-manual-type-change"
            >
              <PenLine className="h-4 w-4 shrink-0" />
              <div className="text-left">
                <p className="text-sm font-medium">Write manually</p>
                <p className="text-xs text-muted-foreground">Change the type and edit it yourself</p>
              </div>
            </Button>
            <Button
              variant="outline"
              className="justify-start gap-3 h-auto py-3 px-4"
              onClick={handleAiConvertType}
              data-testid="button-ai-type-change"
            >
              <Wand2 className="h-4 w-4 shrink-0" />
              <div className="text-left">
                <p className="text-sm font-medium">Generate with AI</p>
                <p className="text-xs text-muted-foreground">AI rewrites the question for the new type</p>
              </div>
            </Button>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
