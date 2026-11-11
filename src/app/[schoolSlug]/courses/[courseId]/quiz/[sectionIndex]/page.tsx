"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, Circle, Trophy, Lock } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";

export default function TakeQuizPage({
    params,
}: {
    params: Promise<{ schoolSlug: string; courseId: string; sectionIndex: string }>;
}) {
    const { schoolSlug, courseId, sectionIndex } = use(params);
    const { user, loading: authLoading, isAdmin, isInstructor } = useAuth();
    const router = useRouter();

    const [course, setCourse] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [answers, setAnswers] = useState<Record<string, number>>({});
    const [submitted, setSubmitted] = useState(false);
    const [score, setScore] = useState(0);
    const [isLocked, setIsLocked] = useState(false);
    const [unlockDate, setUnlockDate] = useState<Date | null>(null);
    const [studyDuration, setStudyDuration] = useState<number>(6);

    const sIdx = parseInt(sectionIndex, 10);

    useEffect(() => {
        if (!authLoading && !user) {
            router.push(`/${schoolSlug}/auth/login`);
            return;
        }

        async function fetchCourseAndLockStatus() {
            try {
                // 1. Fetch course
                const ref = doc(db, "schools", schoolSlug, "courses", courseId);
                const snap = await getDoc(ref);
                if (!snap.exists()) {
                    toast.error("Course not found");
                    setLoading(false);
                    return;
                }
                const cData = { id: snap.id, ...snap.data() };
                setCourse(cData);

                if (isAdmin || isInstructor) {
                    setLoading(false);
                    return;
                }

                // 2. Fetch duration settings
                let duration = 6;
                const settingsRef = doc(db, "schools", schoolSlug, "settings", "payment");
                const settingsSnap = await getDoc(settingsRef);
                if (settingsSnap.exists()) {
                    const sData = settingsSnap.data();
                    if (sData.courseStudyDuration !== undefined) {
                        duration = Number(sData.courseStudyDuration);
                        setStudyDuration(duration);
                    }
                }

                // 3. Fetch enrollment date
                const q = query(
                    collection(db, "schools", schoolSlug, "enrollmentRequests"),
                    where("courseId", "==", courseId),
                    where("studentId", "==", user!.uid),
                    where("status", "==", "approved")
                );
                const enrollSnap = await getDocs(q);
                if (!enrollSnap.empty) {
                    const eData = enrollSnap.docs[0].data();
                    const dateVal = eData.decidedAt || eData.requestedAt || eData.createdAt;
                    if (dateVal) {
                        const enrolledDate = dateVal.toDate ? dateVal.toDate() : new Date(dateVal);
                        const unlock = new Date(enrolledDate.getTime() + duration * 7 * 24 * 60 * 60 * 1000);
                        setUnlockDate(unlock);
                        if (new Date() < unlock) {
                            setIsLocked(true);
                        }
                    }
                }
            } catch (err) {
                console.error("Failed to load course details and lock settings", err);
            } finally {
                setLoading(false);
            }
        }
        if (user) fetchCourseAndLockStatus();
    }, [user, authLoading, schoolSlug, courseId, router, isAdmin, isInstructor]);

    if (loading || authLoading) return <div className="py-20 text-center animate-pulse">Loading quiz...</div>;

    if (isLocked) {
        return (
            <div className="py-20 text-center space-y-6 max-w-lg mx-auto px-4">
                <div className="p-4 bg-muted/60 rounded-full w-16 h-16 flex items-center justify-center mx-auto text-primary border shadow-sm">
                    <Lock className="h-8 w-8" />
                </div>
                <h2 className="text-2xl font-bold tracking-tight">Assessment is Locked</h2>
                <p className="text-muted-foreground leading-relaxed text-sm">
                    To ensure sufficient preparation, you must study this course for a minimum of <strong>{studyDuration} weeks</strong>. This assessment will become available on <strong>{unlockDate?.toLocaleDateString()}</strong>.
                </p>
                <Link href={`/${schoolSlug}/courses/${courseId}`}>
                    <Button className="mt-4">Back to Course Details</Button>
                </Link>
            </div>
        );
    }

    if (!course) return <div className="py-20 text-center text-muted-foreground">Course not found.</div>;

    const section = course.sections?.[sIdx];
    const quiz = section?.quiz;

    if (!section || !quiz || !quiz.questions || quiz.questions.length === 0) {
        return (
            <div className="py-20 text-center space-y-4">
                <p className="text-muted-foreground">No quiz exists for this section.</p>
                <Link href={`/${schoolSlug}/courses/${courseId}`}>
                    <Button variant="outline">Back to Course</Button>
                </Link>
            </div>
        );
    }

    const { questions, passMark = 80 } = quiz;

    // Check if previously passed
    const userPassStatus = quiz.passedBy?.find((p: any) => p.uid === user?.uid);
    const previouslyPassed = !!userPassStatus;

    const handleSelectOption = (questionId: string, optionIndex: number) => {
        if (submitted) return;
        setAnswers(prev => ({ ...prev, [questionId]: optionIndex }));
    };

    const handleSubmit = async () => {
        if (!user) return;
        if (Object.keys(answers).length < questions.length) {
            toast.error("Please answer all questions before submitting.");
            return;
        }

        let correct = 0;
        questions.forEach((q: any) => {
            if (answers[q.id] === q.correctAnswer) correct++;
        });

        const calculatedScore = Math.round((correct / questions.length) * 100);
        setScore(calculatedScore);
        setSubmitted(true);

        // If they passed, record it in DB
        if (calculatedScore >= passMark && !previouslyPassed) {
            try {
                const newSections = JSON.parse(JSON.stringify(course.sections));
                const targetQuiz = newSections[sIdx].quiz;
                if (!targetQuiz.passedBy) targetQuiz.passedBy = [];

                if (!targetQuiz.passedBy.some((p: any) => p.uid === user.uid)) {
                    targetQuiz.passedBy.push({
                        uid: user.uid,
                        score: calculatedScore,
                        date: new Date().toISOString()
                    });
                }

                const ref = doc(db, "schools", schoolSlug, "courses", courseId);
                await updateDoc(ref, { sections: newSections });
                toast.success(`You passed the quiz with ${calculatedScore}%!`);
            } catch (err) {
                console.error("Failed to save quiz result", err);
                toast.error("Failed to save progress, but you passed!");
            }
        } else if (calculatedScore < passMark) {
            toast.error(`You scored ${calculatedScore}%. You need ${passMark}% to pass. Please try again!`);
        }
    };

    const handleRetry = () => {
        setAnswers({});
        setSubmitted(false);
        setScore(0);
    };

    return (
        <div className="min-h-screen p-4 sm:p-8 flex justify-center bg-muted/10">
            <div className="w-full max-w-3xl space-y-6">
                <Link href={`/${schoolSlug}/courses/${courseId}`}>
                    <Button variant="ghost" size="sm" className="mb-2 -ml-3 gap-2 text-muted-foreground hover:text-foreground transition-colors">
                        <ArrowLeft className="h-4 w-4" />
                        Back to {course.title}
                    </Button>
                </Link>

                <Card className="border-border/50 shadow-lg">
                    <CardHeader className="bg-primary/5 rounded-t-xl border-b border-border/50 pb-6">
                        <div className="flex items-center gap-2 text-primary font-semibold text-sm mb-2">
                            <Trophy className="h-4 w-4" /> Section {sIdx + 1} Quiz
                        </div>
                        <CardTitle className="text-2xl font-bold">{section.title} - Quiz</CardTitle>
                        <CardDescription>
                            Test your knowledge. Passing mark is <strong>{passMark}%</strong>.
                        </CardDescription>
                    </CardHeader>

                    <CardContent className="pt-8 space-y-8">
                        {previouslyPassed && !submitted && (
                            <div className="bg-green-500/10 text-green-600 dark:text-green-400 p-4 rounded-xl flex items-center gap-3 border border-green-500/20 mb-6">
                                <CheckCircle2 className="h-5 w-5" />
                                <div>
                                    <p className="font-semibold text-sm">You have already passed this quiz!</p>
                                    <p className="text-xs opacity-90">Score recorded: {userPassStatus.score}%</p>
                                </div>
                            </div>
                        )}

                        {questions.map((q: any, i: number) => {
                            const userAnswer = answers[q.id];
                            const isCorrect = userAnswer === q.correctAnswer;
                            const showResult = submitted;

                            return (
                                <motion.div 
                                    key={q.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="p-5 border border-border/50 rounded-2xl bg-card"
                                >
                                    <h3 className="text-lg font-bold mb-4 flex gap-2">
                                        <span className="text-muted-foreground">{i + 1}.</span> {q.question}
                                    </h3>

                                    <div className="space-y-2.5">
                                        {q.options.map((opt: string, optIdx: number) => {
                                            const isSelected = userAnswer === optIdx;
                                            
                                            let optClass = "border-border/50 hover:border-primary/50 text-foreground bg-background";
                                            let icon = <Circle className="h-4 w-4 text-muted-foreground" />;

                                            if (isSelected) {
                                                optClass = "border-primary bg-primary/5 text-primary";
                                                icon = <CheckCircle2 className="h-4 w-4 fill-primary/20" />;
                                            }

                                            if (showResult) {
                                                if (optIdx === q.correctAnswer) {
                                                    optClass = "border-green-500 bg-green-500/10 text-green-700 dark:text-green-400";
                                                    icon = <CheckCircle2 className="h-4 w-4 fill-green-500/20 text-green-600" />;
                                                } else if (isSelected && !isCorrect) {
                                                    optClass = "border-red-500 bg-red-500/10 text-red-700 dark:text-red-400 opacity-70";
                                                } else {
                                                    optClass = "border-border/30 opacity-50 bg-background";
                                                }
                                            }

                                            return (
                                                <button
                                                    key={optIdx}
                                                    onClick={() => handleSelectOption(q.id, optIdx)}
                                                    disabled={submitted}
                                                    className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left text-sm ${optClass} ${!submitted && 'cursor-pointer hover:bg-muted/10 ml-0 hover:-translate-y-0.5'}`}
                                                >
                                                    <span className="shrink-0">{icon}</span>
                                                    <span>{opt}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                    
                                    {showResult && (
                                        <div className="mt-3 text-sm font-medium">
                                            {isCorrect ? (
                                                <span className="text-green-600 dark:text-green-400 flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4" /> Correct</span>
                                            ) : (
                                                <span className="text-red-600 dark:text-red-400 flex items-center gap-1.5">Incorrect. The correct answer was: <span className="font-bold underline decoration-red-500/30 underline-offset-2">{q.options[q.correctAnswer]}</span></span>
                                            )}
                                        </div>
                                    )}
                                </motion.div>
                            );
                        })}
                    </CardContent>

                    <CardFooter className="p-6 bg-muted/10 border-t border-border/50 rounded-b-xl flex flex-col sm:flex-row justify-between items-center gap-4">
                        {!submitted ? (
                            <div className="w-full flex justify-end">
                                <Button size="lg" onClick={handleSubmit} className="w-full sm:w-auto font-bold rounded-xl shadow-lg">Submit Quiz</Button>
                            </div>
                        ) : (
                            <>
                                <div className="text-center sm:text-left">
                                    <p className="text-sm text-muted-foreground font-medium uppercase tracking-wider mb-1">Your Score</p>
                                    <p className={`text-4xl font-extrabold ${score >= passMark ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                        {score}%
                                    </p>
                                    <p className="text-sm font-medium mt-1">
                                        {score >= passMark ? "🎉 Congratulations, you passed!" : "Score too low. Try again!"}
                                    </p>
                                </div>
                                <div className="flex gap-3 w-full sm:w-auto mt-4 sm:mt-0">
                                    {score < passMark && (
                                        <Button size="lg" variant="outline" onClick={handleRetry} className="flex-1 sm:flex-none font-bold rounded-xl">Retry Quiz</Button>
                                    )}
                                    <Link href={`/${schoolSlug}/courses/${courseId}`} className="flex-1 sm:flex-none">
                                        <Button size="lg" className="w-full font-bold rounded-xl bg-primary text-primary-foreground shadow-lg">Return to Course</Button>
                                    </Link>
                                </div>
                            </>
                        )}
                    </CardFooter>
                </Card>
            </div>
        </div>
    );
}
