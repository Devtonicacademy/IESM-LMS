"use client";

import { use, useState } from "react";
import { useFieldArray, Control } from "react-hook-form";
import { CourseFormValues } from "@/lib/course-schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, HelpCircle, Sparkles, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function SectionQuizEditor({
    sectionIndex,
    control,
    register,
    errors,
    watch,
    setValue,
}: {
    sectionIndex: number;
    control: any;
    register: any;
    errors: any;
    watch: any;
    setValue: any;
}) {
    const sectionTitle = watch(`sections.${sectionIndex}.title`);
    const quizExists = watch(`sections.${sectionIndex}.quiz`);

    const { fields: questions, append, remove } = useFieldArray({
        control,
        name: `sections.${sectionIndex}.quiz.questions` as any,
    });

    const [generating, setGenerating] = useState(false);

    const handleAddQuiz = () => {
        setValue(`sections.${sectionIndex}.quiz`, {
            questions: [
                {
                    id: crypto.randomUUID(),
                    question: "",
                    options: ["", "", "", ""],
                    correctAnswer: 0,
                },
            ],
            passMark: 80,
        });
    };

    const handleRemoveQuiz = () => {
        if (confirm("Are you sure you want to remove the quiz from this section?")) {
            setValue(`sections.${sectionIndex}.quiz`, undefined);
        }
    };

    const handleGenerateAI = async () => {
        if (!sectionTitle) {
            toast.error("Please enter a section title first to generate a quiz.");
            return;
        }

        setGenerating(true);
        try {
            const res = await fetch("/api/generate-quiz", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ topic: sectionTitle }),
            });

            if (!res.ok) throw new Error("Failed to generate quiz");

            const data = await res.json();
            
            // Generate standard ids for questions
            const newQuestions = data.questions.map((q: any) => ({
                id: crypto.randomUUID(),
                ...q,
            }));

            setValue(`sections.${sectionIndex}.quiz`, {
                questions: newQuestions,
                passMark: 80,
            });
            toast.success("AI generated a quiz based on the section topic!");
        } catch (err: any) {
            console.error(err);
            toast.error(err.message || "Failed to generate AI quiz.");
        } finally {
            setGenerating(false);
        }
    };

    if (!quizExists) {
        return (
            <div className="pt-4 mt-4 border-t border-border/50">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl bg-muted/10 border border-dashed border-border/50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                            <HelpCircle className="w-5 h-5" />
                        </div>
                        <div>
                            <h4 className="font-semibold text-sm text-foreground">Add a Quiz (Optional)</h4>
                            <p className="text-xs text-muted-foreground">Test student knowledge on this section.</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <Button type="button" variant="outline" size="sm" onClick={handleGenerateAI} disabled={generating} className="flex-1 sm:flex-none">
                            <Sparkles className="w-4 h-4 mr-2 text-indigo-500" />
                            {generating ? "Generating..." : "Generate AI Quiz"}
                        </Button>
                        <Button type="button" size="sm" onClick={handleAddQuiz} className="flex-1 sm:flex-none">
                            <Plus className="w-4 h-4 mr-2" />
                            Add Manually
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="pt-6 mt-6 border-t border-border/50">
            <div className="flex items-center justify-between mb-4 px-2">
                <div className="flex items-center gap-2">
                    <HelpCircle className="h-5 w-5 text-primary" />
                    <h4 className="font-bold text-foreground">Section Quiz</h4>
                </div>
                <div className="flex items-center gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={handleGenerateAI} disabled={generating} className="gap-2">
                        <Sparkles className="h-3 w-3 text-indigo-500" />
                        {generating ? "Generating..." : "Regenerate AI"}
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={handleRemoveQuiz} className="text-destructive hover:bg-destructive/10 gap-2">
                        <Trash2 className="h-3 w-3" />
                        Remove Quiz
                    </Button>
                </div>
            </div>

            <div className="space-y-6">
                <AnimatePresence>
                    {questions.map((field, qIndex) => {
                        const baseName = `sections.${sectionIndex}.quiz.questions.${qIndex}`;
                        const qErrors = errors?.sections?.[sectionIndex]?.quiz?.questions?.[qIndex];

                        return (
                            <motion.div
                                key={field.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="p-5 border border-primary/20 bg-primary/5 rounded-2xl relative group"
                            >
                                <div className="absolute top-4 right-4">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => remove(qIndex)}
                                        className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <Label className="text-xs font-semibold mb-1.5 inline-block">Question {qIndex + 1}</Label>
                                        <Input
                                            {...register(`${baseName}.question`)}
                                            placeholder="What is the main purpose of..."
                                            className={cn("h-11 rounded-xl bg-background", qErrors?.question && "border-destructive")}
                                        />
                                        {qErrors?.question && (
                                            <p className="text-[10px] text-destructive mt-1">{qErrors.question.message}</p>
                                        )}
                                    </div>

                                    <div className="space-y-3 pt-2">
                                        <Label className="text-xs font-semibold">Options & Correct Answer</Label>
                                        {[0, 1, 2, 3].map((optIndex) => {
                                            const isCorrect = watch(`${baseName}.correctAnswer`) === optIndex;
                                            return (
                                                <div key={optIndex} className="flex items-center gap-3">
                                                    <button
                                                        type="button"
                                                        onClick={() => setValue(`${baseName}.correctAnswer`, optIndex)}
                                                        className={cn(
                                                            "flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors",
                                                            isCorrect ? "border-green-500 bg-green-500/10 text-green-500" : "border-muted-foreground/30 hover:border-primary/50 text-transparent"
                                                        )}
                                                    >
                                                        <CheckCircle2 className="w-4 h-4 fill-current" />
                                                    </button>
                                                    <div className="flex-1">
                                                        <Input
                                                            {...register(`${baseName}.options.${optIndex}`)}
                                                            placeholder={`Option ${optIndex + 1}`}
                                                            className={cn("h-10 rounded-lg bg-background/50", qErrors?.options?.[optIndex] && "border-destructive")}
                                                        />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        {qErrors?.correctAnswer && (
                                            <p className="text-[10px] text-destructive mt-1">{qErrors.correctAnswer.message}</p>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}
                </AnimatePresence>

                <Button
                    type="button"
                    variant="outline"
                    onClick={() => append({ id: crypto.randomUUID(), question: "", options: ["", "", "", ""], correctAnswer: 0 })}
                    className="w-full border-dashed py-6 rounded-xl text-primary hover:bg-primary/5"
                >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Another Question
                </Button>
            </div>
        </div>
    );
}
