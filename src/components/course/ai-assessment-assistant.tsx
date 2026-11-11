"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Sparkles,
  Send,
  Loader2,
  Plus,
  Trash2,
  CheckCircle,
  FileText,
  Key,
  BookOpen,
  ClipboardList,
  Clock,
  Settings,
  HelpCircle,
  AlertCircle,
  ChevronRight,
  Info,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface AIAssessmentAssistantProps {
  open: boolean;
  onClose: () => void;
  coursePdfUrl?: string;
  coursePdfFile?: File | null;
  onApply: (questions: any[], project: string, timesheet: string) => void;
  initialQuizQuestions?: any[];
  initialProjectInstructions?: string;
  initialTimesheetInstructions?: string;
  schoolSlug?: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
}

interface DraftAssessments {
  quiz: {
    questions: QuizQuestion[];
    passMark: number;
  };
  project: {
    instructions: string;
  };
  timesheet: {
    instructions: string;
  };
}

export function AIAssessmentAssistant({
  open,
  onClose,
  coursePdfUrl,
  coursePdfFile,
  onApply,
  initialQuizQuestions = [],
  initialProjectInstructions = "",
  initialTimesheetInstructions = "",
  schoolSlug,
}: AIAssessmentAssistantProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Custom API Key (for environments without process.env.GEMINI_API_KEY)
  const [userApiKey, setUserApiKey] = useState("");
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);

  // File loading state
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfBase64, setPdfBase64] = useState<string | null>(null);
  const [isConvertingPdf, setIsConvertingPdf] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Active tab in draft preview
  const [activeTab, setActiveTab] = useState<"quiz" | "project" | "timesheet">("quiz");

  // Draft assessments state
  const [draft, setDraft] = useState<DraftAssessments>({
    quiz: {
      questions: [],
      passMark: 80,
    },
    project: {
      instructions: "",
    },
    timesheet: {
      instructions: "",
    },
  });

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Sync initial values when modal opens
  useEffect(() => {
    if (open) {
      // Load stored API key from local storage if available
      const storedKey = localStorage.getItem("user_gemini_api_key") || "";
      setUserApiKey(storedKey);

      setDraft({
        quiz: {
          questions: initialQuizQuestions.length > 0 ? [...initialQuizQuestions] : [],
          passMark: 80,
        },
        project: {
          instructions: initialProjectInstructions || "",
        },
        timesheet: {
          instructions: initialTimesheetInstructions || "",
        },
      });

      // Clear or set PDF file based on parent props
      if (coursePdfFile) {
        setPdfFile(coursePdfFile);
        convertFileToBase64(coursePdfFile);
      } else {
        setPdfFile(null);
        setPdfBase64(null);
      }

      // Initialize welcome message
      setMessages([
        {
          role: "assistant",
          content: "Welcome to the AI Assessment Assistant! 🧠✨\n\nI can read your course PDF document and generate quizzes, final project criteria, and study timesheet instructions tailored to the course content.\n\n" + 
            (coursePdfFile || coursePdfUrl 
              ? "I see a course document has already been attached. Ask me to generate a quiz, project, or timesheet logger instructions based on it!" 
              : "To get started, please upload a course PDF document below or configure your Gemini API Key in the settings button.")
        }
      ]);
    }
  }, [open, coursePdfUrl, coursePdfFile, initialQuizQuestions, initialProjectInstructions, initialTimesheetInstructions]);

  // Scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isGenerating]);

  // Convert File object to Base64
  const convertFileToBase64 = (file: File) => {
    setIsConvertingPdf(true);
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      setPdfBase64(reader.result as string);
      setIsConvertingPdf(false);
    };
    reader.onerror = (error) => {
      console.error("Error reading PDF file:", error);
      toast.error("Failed to read the PDF file");
      setIsConvertingPdf(false);
    };
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const file = e.target.files[0];
      if (file.type !== "application/pdf") {
        toast.error("Please upload a PDF document.");
        return;
      }
      setPdfFile(file);
      convertFileToBase64(file);
      toast.success(`Loaded PDF: ${file.name}`);
    }
  };

  const handleSaveApiKey = () => {
    localStorage.setItem("user_gemini_api_key", userApiKey);
    toast.success("API key saved locally!");
    setShowApiKeyInput(false);
  };

  const handleSend = async (customPrompt?: string) => {
    const textToSend = customPrompt || inputValue;
    if (!textToSend.trim() && !customPrompt) return;

    // Check if we need PDF
    if (!pdfFile && !pdfBase64 && !coursePdfUrl) {
      toast.warning("Generating without a document. Content will not be fully tailored to the specific course material.");
    }

    const newMessages: Message[] = [...messages, { role: "user", content: textToSend }];
    setMessages(newMessages);
    setInputValue("");
    setIsGenerating(true);

    try {
      const response = await fetch("/api/generate-assessments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: textToSend,
          history: messages.slice(-10), // Send last 10 messages for context
          pdfUrl: coursePdfUrl || null,
          pdfBase64: pdfBase64 || null,
          currentAssessments: draft,
          userApiKey: userApiKey || null,
          schoolSlug: schoolSlug || null,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate assessments.");
      }

      const resData = await response.json();

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: resData.message },
      ]);

      if (resData.data) {
        const generated = resData.data;
        const newDraft: DraftAssessments = {
          quiz: {
            questions: generated.quiz?.questions?.map((q: any) => ({
              id: q.id || crypto.randomUUID(),
              question: q.question || "",
              options: q.options || ["", "", "", ""],
              correctAnswer: typeof q.correctAnswer === "number" ? q.correctAnswer : 0,
            })) || draft.quiz.questions,
            passMark: generated.quiz?.passMark || draft.quiz.passMark || 80,
          },
          project: {
            instructions: generated.project?.instructions || draft.project.instructions || "",
          },
          timesheet: {
            instructions: generated.timesheet?.instructions || draft.timesheet.instructions || "",
          },
        };
        setDraft(newDraft);
        
        // Auto switch tab based on what was modified
        if (generated.quiz?.questions?.length > 0) {
          setActiveTab("quiz");
        } else if (generated.project?.instructions) {
          setActiveTab("project");
        } else if (generated.timesheet?.instructions) {
          setActiveTab("timesheet");
        }

        toast.success("Draft assessments updated!");
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "An error occurred during generation.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApply = () => {
    // Validate draft
    const validQuestions = draft.quiz.questions.filter(q => q.question.trim().length > 0);
    if (validQuestions.length > 0) {
      const hasInvalidOptions = validQuestions.some(q => q.options.some(opt => opt.trim().length === 0));
      if (hasInvalidOptions) {
        toast.error("Please fill in all options for the quiz questions, or delete empty questions.");
        return;
      }
    }

    onApply(validQuestions, draft.project.instructions, draft.timesheet.instructions);
    toast.success("Assessments successfully applied to course form!");
    onClose();
  };

  // Inline editor functions
  const handleUpdateQuestionText = (qId: string, text: string) => {
    setDraft(prev => ({
      ...prev,
      quiz: {
        ...prev.quiz,
        questions: prev.quiz.questions.map(q => q.id === qId ? { ...q, question: text } : q)
      }
    }));
  };

  const handleUpdateOptionText = (qId: string, optIndex: number, text: string) => {
    setDraft(prev => ({
      ...prev,
      quiz: {
        ...prev.quiz,
        questions: prev.quiz.questions.map(q => {
          if (q.id === qId) {
            const newOptions = [...q.options];
            newOptions[optIndex] = text;
            return { ...q, options: newOptions };
          }
          return q;
        })
      }
    }));
  };

  const handleUpdateCorrectAnswer = (qId: string, index: number) => {
    setDraft(prev => ({
      ...prev,
      quiz: {
        ...prev.quiz,
        questions: prev.quiz.questions.map(q => q.id === qId ? { ...q, correctAnswer: index } : q)
      }
    }));
  };

  const handleAddQuestion = () => {
    const newQuestion: QuizQuestion = {
      id: crypto.randomUUID(),
      question: "Enter new question here...",
      options: ["Option A", "Option B", "Option C", "Option D"],
      correctAnswer: 0
    };
    setDraft(prev => ({
      ...prev,
      quiz: {
        ...prev.quiz,
        questions: [...prev.quiz.questions, newQuestion]
      }
    }));
    toast.success("New question added!");
  };

  const handleDeleteQuestion = (qId: string) => {
    setDraft(prev => ({
      ...prev,
      quiz: {
        ...prev.quiz,
        questions: prev.quiz.questions.filter(q => q.id !== qId)
      }
    }));
  };

  // Helper to format AI replies
  const renderMessageContent = (text: string) => {
    if (!text) return "";
    return text.split("\n\n").map((para, i) => {
      const parts = para.split(/\*\*(.*?)\*\*/g);
      const content = parts.map((part, j) => {
        if (j % 2 === 1) {
          return <strong key={j} className="font-bold text-slate-800 dark:text-slate-100">{part}</strong>;
        }
        return part;
      });
      return <p key={i} className="mb-2 last:mb-0 leading-relaxed text-sm whitespace-pre-wrap">{content}</p>;
    });
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[92vw] lg:max-w-[85vw] xl:max-w-6xl w-[calc(100%-2rem)] h-[90vh] flex flex-col p-0 gap-0 overflow-hidden border border-border/80 bg-background shadow-2xl rounded-2xl">
        {/* Header */}
        <DialogHeader className="p-4 border-b flex flex-row items-center justify-between bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-md">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold flex items-center gap-2">
                AI Assessment Assistant
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Generate and edit quizzes, projects, and timesheet papers from a PDF document.
              </DialogDescription>
            </div>
          </div>
          
          <div className="flex items-center gap-2 mr-8">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setShowApiKeyInput(!showApiKeyInput)}
              className={cn("h-8 w-8 rounded-lg", showApiKeyInput && "bg-accent")}
              title="API Key Configuration"
            >
              <Settings className="h-4 w-4" />
            </Button>
            {pdfFile && (
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/10 text-red-500 border border-red-500/20 text-xs font-medium">
                <FileText className="h-3 w-3" />
                <span className="max-w-[120px] truncate">{pdfFile.name}</span>
              </div>
            )}
            {!pdfFile && coursePdfUrl && (
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-500 border border-blue-500/20 text-xs font-medium">
                <FileText className="h-3 w-3" />
                <span>Default Course PDF</span>
              </div>
            )}
          </div>
        </DialogHeader>

        {/* API Key Modal Panel */}
        <AnimatePresence>
          {showApiKeyInput && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="p-4 border-b bg-muted/40 flex flex-col sm:flex-row gap-3 items-end"
            >
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="apiKey" className="text-xs flex items-center gap-1">
                  <Key className="h-3 w-3" /> Gemini API Key (Optional Override)
                </Label>
                <Input
                  id="apiKey"
                  type="password"
                  value={userApiKey}
                  onChange={(e) => setUserApiKey(e.target.value)}
                  placeholder="Paste your AIzaSy... Gemini key"
                  className="h-9"
                />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSaveApiKey}>Save Key</Button>
                <Button size="sm" variant="ghost" onClick={() => setShowApiKeyInput(false)}>Cancel</Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Columns Container */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 overflow-hidden bg-background">
          
          {/* Left Column: Conversational Chatbot */}
          <div className="flex flex-col border-r h-full overflow-hidden bg-muted/5">
            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {!userApiKey && (
                <div className="p-3 border border-yellow-500/20 bg-yellow-500/5 text-yellow-700 dark:text-yellow-400 text-xs rounded-xl flex gap-2.5 items-start">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-semibold text-yellow-800 dark:text-yellow-300">Simulated Demo Mode Active</p>
                    <p className="leading-relaxed">
                      To generate real questions from your PDF, click the settings gear icon <span className="font-bold">⚙️</span> in the header to paste your Gemini API key, or define <code className="font-mono bg-yellow-500/10 px-1 rounded">GEMINI_API_KEY</code> in your <code className="font-mono bg-yellow-500/10 px-1 rounded">.env.local</code> file.
                    </p>
                  </div>
                </div>
              )}
              <AnimatePresence initial={false}>
                {messages.map((msg, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      "flex gap-3 max-w-[85%]",
                      msg.role === "user" ? "ml-auto flex-row-reverse" : ""
                    )}
                  >
                    <div
                      className={cn(
                        "w-7 h-7 rounded-lg flex items-center justify-center text-xs font-semibold shrink-0 shadow-sm",
                        msg.role === "user" 
                          ? "bg-violet-500 text-white" 
                          : "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      )}
                    >
                      {msg.role === "user" ? "IN" : "AI"}
                    </div>
                    <div
                      className={cn(
                        "p-3 rounded-2xl text-sm shadow-xs border",
                        msg.role === "user"
                          ? "bg-gradient-to-br from-violet-500 to-indigo-600 text-white border-transparent rounded-tr-none"
                          : "bg-background border-border/80 rounded-tl-none text-slate-800 dark:text-slate-200"
                      )}
                    >
                      {renderMessageContent(msg.content)}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              
              {isGenerating && (
                <div className="flex gap-3 max-w-[85%]">
                  <div className="w-7 h-7 rounded-lg bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200 flex items-center justify-center text-xs font-semibold shrink-0 shadow-sm animate-pulse">
                    AI
                  </div>
                  <div className="p-4 rounded-2xl rounded-tl-none bg-background border border-border/80 text-sm shadow-xs flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    Analyzing document & generating assessments...
                  </div>
                </div>
              )}
              
              <div ref={chatEndRef} />
            </div>

            {/* Quick Suggestions Chips */}
            <div className="px-4 py-2 flex flex-wrap gap-2 border-t bg-muted/10">
              <button
                disabled={isGenerating}
                onClick={() => handleSend("Generate a comprehensive 5-question quiz based on the PDF.")}
                className="text-[11px] font-medium px-2.5 py-1 rounded-full border border-border/60 bg-background hover:bg-accent/50 text-muted-foreground hover:text-foreground transition-all shrink-0 cursor-pointer"
              >
                📝 Generate Quiz
              </button>
              <button
                disabled={isGenerating}
                onClick={() => handleSend("Generate final project guidelines based on this document.")}
                className="text-[11px] font-medium px-2.5 py-1 rounded-full border border-border/60 bg-background hover:bg-accent/50 text-muted-foreground hover:text-foreground transition-all shrink-0 cursor-pointer"
              >
                🚀 Generate Project
              </button>
              <button
                disabled={isGenerating}
                onClick={() => handleSend("Generate study log timesheet requirements based on the document contents.")}
                className="text-[11px] font-medium px-2.5 py-1 rounded-full border border-border/60 bg-background hover:bg-accent/50 text-muted-foreground hover:text-foreground transition-all shrink-0 cursor-pointer"
              >
                ⏱️ Generate Timesheet instructions
              </button>
            </div>

            {/* Input / Control Panel */}
            <div className="p-4 border-t bg-background space-y-3">
              {/* PDF Document Loading Field */}
              {!pdfFile && !coursePdfUrl && (
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center justify-center border border-dashed border-border/80 rounded-xl p-2 bg-muted/20 hover:bg-muted/40 transition-colors cursor-pointer text-xs text-muted-foreground gap-2"
                >
                  <FileText className="h-4 w-4 text-violet-500" />
                  <span>Click to select or upload course PDF (Required for tailoring)</span>
                  <input
                    type="file"
                    accept="application/pdf"
                    ref={fileInputRef}
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </div>
              )}

              {/* Chat Input Field */}
              <div className="flex gap-2 items-center">
                {pdfFile && (
                  <button 
                    onClick={() => {
                      setPdfFile(null);
                      setPdfBase64(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                    className="p-1 rounded-md text-red-500 hover:bg-red-500/10 cursor-pointer"
                    title="Remove attached PDF"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
                <div className="flex-1 relative">
                  <Input
                    placeholder={
                      isConvertingPdf 
                        ? "Converting PDF to text..." 
                        : "Ask AI to generate/refine questions..."
                    }
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    disabled={isGenerating || isConvertingPdf}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    className="h-10 rounded-xl pr-10"
                  />
                  <Button
                    size="icon"
                    onClick={() => handleSend()}
                    disabled={isGenerating || isConvertingPdf || !inputValue.trim()}
                    className="absolute right-1 top-1 h-8 w-8 rounded-lg bg-violet-600 hover:bg-violet-700 text-white"
                  >
                    <Send className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Interactive Editor Dashboard */}
          <div className="flex flex-col h-full overflow-hidden bg-background">
            <Tabs
              value={activeTab}
              onValueChange={(v: any) => setActiveTab(v)}
              className="flex-1 flex flex-col h-full overflow-hidden"
            >
              {/* Tab Selector */}
              <div className="border-b px-4 py-2 flex items-center justify-between bg-muted/10 shrink-0">
                <TabsList className="bg-muted/40 p-[2px] rounded-lg">
                  <TabsTrigger value="quiz" className="px-3 py-1 text-xs gap-1.5">
                    <BookOpen className="h-3 w-3" />
                    Quiz Draft ({draft.quiz.questions.length})
                  </TabsTrigger>
                  <TabsTrigger value="project" className="px-3 py-1 text-xs gap-1.5">
                    <ClipboardList className="h-3 w-3" />
                    Final Project
                  </TabsTrigger>
                  <TabsTrigger value="timesheet" className="px-3 py-1 text-xs gap-1.5">
                    <Clock className="h-3 w-3" />
                    Timesheet
                  </TabsTrigger>
                </TabsList>
              </div>

              {/* Tab Contents */}
              <div className="flex-1 overflow-y-auto p-4">
                
                {/* 1. QUIZ DRAFT EDITOR */}
                <TabsContent value="quiz" className="space-y-4 mt-0 focus-visible:outline-none">
                  {draft.quiz.questions.length === 0 ? (
                    <div className="text-center py-20 border border-dashed rounded-2xl bg-muted/5 flex flex-col items-center justify-center gap-3">
                      <BookOpen className="h-8 w-8 text-muted-foreground/60 animate-pulse" />
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-foreground">No Questions Drafted</p>
                        <p className="text-xs text-muted-foreground max-w-[260px] mx-auto leading-relaxed">
                          Use the AI chatbot on the left to generate quiz questions, or add them manually.
                        </p>
                      </div>
                      <Button size="sm" variant="outline" onClick={handleAddQuestion} className="gap-1.5 text-xs">
                        <Plus className="h-3.5 w-3.5" /> Add Question
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Pass mark controls */}
                      <div className="p-3 bg-muted/20 border rounded-xl flex items-center justify-between text-xs">
                        <span className="font-semibold text-muted-foreground">Requirements</span>
                        <div className="flex items-center gap-2">
                          <Label className="text-xs font-semibold">Pass Mark:</Label>
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            value={draft.quiz.passMark}
                            onChange={(e) => setDraft(prev => ({
                              ...prev,
                              quiz: { ...prev.quiz, passMark: parseInt(e.target.value) || 80 }
                            }))}
                            className="w-16 h-8 text-center text-xs px-1 rounded-lg"
                          />
                          <span className="font-semibold text-muted-foreground">%</span>
                        </div>
                      </div>

                      {/* Question List */}
                      <div className="space-y-4">
                        <AnimatePresence initial={false}>
                          {draft.quiz.questions.map((q, idx) => (
                            <motion.div
                              key={q.id}
                              initial={{ opacity: 0, scale: 0.98 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.95 }}
                              className="p-4 border rounded-xl bg-card shadow-xs relative group"
                            >
                              {/* Index & Delete bar */}
                              <div className="flex items-center justify-between mb-3 border-b border-border/40 pb-2">
                                <span className="text-xs font-bold text-primary flex items-center gap-1.5">
                                  <span className="flex items-center justify-center w-5 h-5 rounded-md bg-primary/10 text-xs">
                                    {idx + 1}
                                  </span>
                                  Question
                                </span>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDeleteQuestion(q.id)}
                                  className="h-7 w-7 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-md"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>

                              {/* Question Input */}
                              <div className="space-y-3">
                                <div className="space-y-1">
                                  <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Question Statement</Label>
                                  <Textarea
                                    value={q.question}
                                    onChange={(e) => handleUpdateQuestionText(q.id, e.target.value)}
                                    placeholder="Enter your question statement..."
                                    className="min-h-[60px] text-sm resize-none rounded-lg"
                                  />
                                </div>

                                {/* Options Input list */}
                                <div className="space-y-2.5">
                                  <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Options & Correct Answer</Label>
                                  <div className="grid gap-2">
                                    {q.options.map((opt, oIdx) => (
                                      <div key={oIdx} className="flex items-center gap-2">
                                        <button
                                          type="button"
                                          onClick={() => handleUpdateCorrectAnswer(q.id, oIdx)}
                                          className={cn(
                                            "w-6 h-6 rounded-full border flex items-center justify-center shrink-0 cursor-pointer transition-all",
                                            q.correctAnswer === oIdx
                                              ? "bg-green-500 border-green-500 text-white font-bold"
                                              : "border-border hover:bg-muted hover:border-muted-foreground/30 text-muted-foreground text-xs"
                                          )}
                                          title={q.correctAnswer === oIdx ? "Correct Answer" : "Mark as correct answer"}
                                        >
                                          {q.correctAnswer === oIdx ? "✓" : String.fromCharCode(65 + oIdx)}
                                        </button>
                                        <Input
                                          value={opt}
                                          onChange={(e) => handleUpdateOptionText(q.id, oIdx, e.target.value)}
                                          placeholder={`Option ${String.fromCharCode(65 + oIdx)}`}
                                          className={cn(
                                            "h-9 rounded-lg text-sm bg-muted/10 border-border/80 focus:bg-background transition-all",
                                            q.correctAnswer === oIdx && "border-green-500/50 bg-green-500/5 focus:border-green-500"
                                          )}
                                        />
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          ))}
                        </AnimatePresence>

                        {/* Add question manually */}
                        <Button
                          variant="outline"
                          onClick={handleAddQuestion}
                          className="w-full h-11 border-dashed hover:bg-muted/30 border-border/80 rounded-xl text-xs gap-1.5"
                        >
                          <Plus className="h-4 w-4" /> Add Next Question
                        </Button>
                      </div>
                    </div>
                  )}
                </TabsContent>

                {/* 2. FINAL PROJECT EDITOR */}
                <TabsContent value="project" className="space-y-3 mt-0 focus-visible:outline-none">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="projectInstructions" className="text-xs font-semibold flex items-center gap-1.5 text-primary">
                        <ClipboardList className="h-4 w-4" /> Project Guidelines & Scope
                      </Label>
                    </div>
                    <Textarea
                      id="projectInstructions"
                      value={draft.project.instructions}
                      onChange={(e) => setDraft(prev => ({ ...prev, project: { instructions: e.target.value } }))}
                      placeholder="e.g. Project Title: Power BI dashboard design. Students must build a dashboard and upload a PDF report containing screenshots, insights, and data models..."
                      className="min-h-[360px] text-sm leading-relaxed rounded-xl focus:bg-background transition-colors"
                    />
                    <div className="p-3 border border-blue-500/20 bg-blue-500/5 text-[11px] rounded-lg text-blue-700 dark:text-blue-300 flex gap-2">
                      <Info className="h-4 w-4 shrink-0 mt-0.5 text-blue-500" />
                      <div>
                        These instructions will govern the final course project submissions. Students will upload their deliverables (typically PDF or slide presentations) directly inside the final assessment platform.
                      </div>
                    </div>
                  </div>
                </TabsContent>

                {/* 3. TIMESHEET EDITOR */}
                <TabsContent value="timesheet" className="space-y-3 mt-0 focus-visible:outline-none">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="timesheetInstructions" className="text-xs font-semibold flex items-center gap-1.5 text-primary">
                        <Clock className="h-4 w-4" /> Timesheet Logging Policy
                      </Label>
                    </div>
                    <Textarea
                      id="timesheetInstructions"
                      value={draft.timesheet.instructions}
                      onChange={(e) => setDraft(prev => ({ ...prev, timesheet: { instructions: e.target.value } }))}
                      placeholder="e.g. Study Log Policy: Students are required to self-report at least 15 hours of active study for this PDF course. Ensure you detail chapter-by-chapter progress in each log entry..."
                      className="min-h-[360px] text-sm leading-relaxed rounded-xl focus:bg-background transition-colors"
                    />
                    <div className="p-3 border border-violet-500/20 bg-violet-500/5 text-[11px] rounded-lg text-violet-700 dark:text-violet-300 flex gap-2">
                      <Info className="h-4 w-4 shrink-0 mt-0.5 text-violet-500" />
                      <div>
                        PDF-only course timesheets let students self-report reading/study sessions manually. Use this area to describe standard rules (e.g. required hours, summary expectations per entry).
                      </div>
                    </div>
                  </div>
                </TabsContent>

              </div>

              {/* Bottom Apply Actions Bar */}
              <div className="border-t p-4 bg-muted/20 flex gap-3 justify-end shrink-0">
                <Button variant="outline" onClick={onClose} className="rounded-xl h-10 px-4 text-xs font-medium">
                  Cancel
                </Button>
                <Button
                  onClick={handleApply}
                  className="rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white border-0 shadow-md h-10 px-5 text-xs font-bold gap-1.5"
                >
                  <CheckCircle className="h-4 w-4" /> Patch to Course Form
                </Button>
              </div>
            </Tabs>
          </div>

        </div>
      </DialogContent>
    </Dialog>
  );
}
