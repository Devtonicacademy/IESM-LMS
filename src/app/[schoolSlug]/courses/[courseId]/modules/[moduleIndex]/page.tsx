"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, PlayCircle, FileText, File, CheckCircle, Circle, ArrowLeft, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { cn } from "@/lib/utils";

export default function ModulePage({
    params,
}: {
    params: Promise<{ schoolSlug: string; courseId: string; moduleIndex: string }>;
}) {
    const { schoolSlug, courseId, moduleIndex } = use(params);
    const index = parseInt(moduleIndex);
    const { user, isStudent } = useAuth();
    const router = useRouter();

    const [course, setCourse] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    useEffect(() => {
        async function fetchCourse() {
            try {
                const ref = doc(db, "schools", schoolSlug, "courses", courseId);
                const snap = await getDoc(ref);
                if (snap.exists()) {
                    setCourse({ id: snap.id, ...snap.data() });
                }
            } catch (err) {
                console.error("Failed to load course", err);
            } finally {
                setLoading(false);
            }
        }
        fetchCourse();
    }, [schoolSlug, courseId]);

    if (loading) return (
        <div className="min-h-screen bg-muted/30 flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
                <div className="h-12 w-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
                <p className="text-muted-foreground font-medium animate-pulse">Loading lesson...</p>
            </div>
        </div>
    );

    if (!course) return <div className="p-20 text-center">Course not found.</div>;

    const allModules = course.modules || [];
    const module = allModules[index];

    if (!module) return <div className="p-20 text-center">Module not found.</div>;

    const isEnrolled = user && course.enrolledStudents?.includes(user.uid);

    if (!isEnrolled) {
        return (
            <div className="container mx-auto py-20 px-4 text-center">
                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
                    <BookOpen className="h-16 w-16 mx-auto mb-6 text-muted-foreground opacity-20" />
                    <h1 className="text-3xl font-bold mb-4">Enroll to Access</h1>
                    <p className="text-muted-foreground mb-8 max-w-md mx-auto">
                        This lesson is part of <strong>{course.title}</strong>. You need to be enrolled in the course to view the content.
                    </p>
                    <Link href={`/${schoolSlug}/courses/${courseId}`}>
                        <Button size="lg" className="rounded-xl px-8 shadow-lg">
                            View Course Details
                        </Button>
                    </Link>
                </motion.div>
            </div>
        );
    }

    const isCompleted = user && module.completedBy?.includes(user.uid);

    const toggleCompletion = async () => {
        if (!user || updating) return;
        setUpdating(true);
        try {
            const newModules = [...allModules];
            const mod = newModules[index];
            if (!mod.completedBy) mod.completedBy = [];

            const alreadyCompleted = mod.completedBy.includes(user.uid);
            if (alreadyCompleted) {
                mod.completedBy = mod.completedBy.filter((id: string) => id !== user.uid);
            } else {
                mod.completedBy.push(user.uid);
            }

            // Sync with sections
            const newSections = course.sections ? JSON.parse(JSON.stringify(course.sections)) : [];
            if (newSections.length > 0) {
                newSections.forEach((s: any) => {
                    s.modules?.forEach((m: any) => {
                        if (m.title === mod.title && m.content === mod.content) {
                            m.completedBy = mod.completedBy;
                        }
                    });
                });
            }

            const ref = doc(db, "schools", schoolSlug, "courses", courseId);
            await updateDoc(ref, {
                modules: newModules,
                sections: newSections.length > 0 ? newSections : undefined
            });

            setCourse({ ...course, modules: newModules, sections: newSections.length > 0 ? newSections : undefined });
            if (!alreadyCompleted) toast.success("Marked as complete!");
        } catch (err) {
            toast.error("Failed to update progress");
        } finally {
            setUpdating(false);
        }
    };

    const nextModuleIndex = index < allModules.length - 1 ? index + 1 : null;
    const prevModuleIndex = index > 0 ? index - 1 : null;

    return (
        <div className="min-h-screen bg-muted/10 overflow-x-hidden">
            {/* Top Navbar */}
            <div className="bg-background border-b sticky top-0 z-20 shadow-sm">
                <div className="max-w-[1600px] mx-auto px-4 h-16 flex items-center justify-between">
                    <Link
                        href={`/${schoolSlug}/courses/${courseId}`}
                        className="flex items-center gap-2 text-sm font-semibold hover:text-primary transition-colors group"
                    >
                        <div className="h-8 w-8 rounded-lg bg-muted/50 flex items-center justify-center group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                            <ChevronLeft className="h-4 w-4" />
                        </div>
                        <span className="hidden sm:inline">Back to Course</span>
                    </Link>

                    <div className="hidden md:flex flex-col items-center max-w-[40%] text-center mx-auto">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Now Learning</span>
                        <span className="text-sm font-bold truncate w-full">{module.title}</span>
                    </div>

                    <div className="flex items-center gap-3">
                        <Button
                            variant={isCompleted ? "secondary" : "default"}
                            size="sm"
                            onClick={toggleCompletion}
                            disabled={updating}
                            className={cn(
                                "rounded-lg gap-2 text-xs h-9 px-4 font-bold transition-all shadow-sm",
                                isCompleted && "bg-primary/10 text-primary border-primary/20 hover:bg-primary/20"
                            )}
                        >
                            {isCompleted ? (
                                <>
                                    <CheckCircle className="h-4 w-4" />
                                    <span className="hidden sm:inline">Completed</span>
                                </>
                            ) : (
                                <>
                                    <Circle className="h-4 w-4" />
                                    <span className="hidden sm:inline">Mark Complete</span>
                                </>
                            )}
                        </Button>
                        <Button 
                            variant="outline" 
                            size="sm" 
                            className="hidden lg:flex rounded-lg h-9 w-9 p-0"
                            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                            title={isSidebarOpen ? "Hide course content" : "Show course content"}
                        >
                            <BookOpen className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </div>

            <div className={cn(
                "mx-auto py-6 md:py-8 px-4 sm:px-6 md:px-8 transition-all duration-300",
                isSidebarOpen ? "max-w-[1600px] lg:grid lg:grid-cols-4 xl:grid-cols-5 lg:gap-8" : "max-w-5xl"
            )}>
                {/* Main Content Area */}
                <div className={cn(
                    "transition-all duration-300 w-full",
                    isSidebarOpen ? "lg:col-span-3 xl:col-span-4 space-y-6" : "space-y-6"
                )}>
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-6 w-full"
                    >
                        {/* Header Area */}
                        <div className="flex flex-col gap-4">
                            <div className="flex items-center gap-2">
                                <div className={cn(
                                    "p-2 rounded-xl bg-background border shadow-sm",
                                    module.type === "video" ? "text-blue-500" : module.type === "pdf" ? "text-red-500" : "text-green-500"
                                )}>
                                    {module.type === "video" ? <PlayCircle className="h-6 w-6" /> : module.type === "pdf" ? <File className="h-6 w-6" /> : <FileText className="h-6 w-6" />}
                                </div>
                                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">{module.title}</h1>
                            </div>
                            {module.description && (
                                <div className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground bg-background/50 p-4 rounded-2xl border border-border/30">
                                    {module.description}
                                </div>
                            )}
                        </div>

                        {/* Content Display */}
                        <Card className="overflow-hidden border-none shadow-xl bg-card rounded-2xl sm:rounded-3xl w-full">
                            <CardContent className="p-0 w-full overflow-x-hidden">
                                {module.type === "video" ? (
                                    <div className="aspect-video bg-black w-full relative group">
                                        {(() => {
                                            const getYoutubeId = (url: string) => {
                                                const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|shorts\/)([^#&?]*).*/;
                                                const match = url.match(regExp);
                                                return (match && match[2].length === 11) ? match[2] : null;
                                            };
                                            const ytId = getYoutubeId(module.content);

                                            if (ytId) {
                                                return (
                                                    <iframe
                                                        src={`https://www.youtube.com/embed/${ytId}`}
                                                        className="w-full h-full border-0 absolute top-0 left-0"
                                                        allowFullScreen
                                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                                    />
                                                );
                                            } else if (module.content.includes("vimeo.com/")) {
                                                const vimeoId = module.content.split("/").pop();
                                                return (
                                                    <iframe
                                                        src={`https://player.vimeo.com/video/${vimeoId}`}
                                                        className="w-full h-full border-0 absolute top-0 left-0"
                                                        allowFullScreen
                                                    />
                                                );
                                            } else {
                                                return (
                                                    <div className="flex flex-col items-center justify-center h-full text-white p-6 text-center">
                                                        <PlayCircle className="h-20 w-20 mb-4 opacity-30" />
                                                        <h3 className="text-xl font-bold mb-4">External Video Lesson</h3>
                                                        <p className="mb-6 opacity-70">This video is hosted on an external platform.</p>
                                                        <a href={module.content} target="_blank" rel="noreferrer">
                                                            <Button size="lg" className="rounded-xl shadow-lg bg-blue-600 hover:bg-blue-700">
                                                                Open in New Tab
                                                            </Button>
                                                        </a>
                                                    </div>
                                                );
                                            }
                                        })()}
                                    </div>
                                ) : module.type === "pdf" ? (
                                    <div className="flex flex-col items-center justify-center min-h-[300px] sm:min-h-[400px] p-8 sm:p-12 text-center bg-muted/5">
                                        <File className="h-20 w-20 sm:h-24 sm:w-24 mb-6 text-red-500 opacity-20" />
                                        <h3 className="text-xl sm:text-2xl font-bold mb-2">Resource Download</h3>
                                        <p className="text-muted-foreground mb-8 max-w-sm mx-auto">Download the supporting documents for this lesson to follow along.</p>
                                        <a href={module.content} target="_blank" rel="noreferrer">
                                            <Button size="lg" className="rounded-xl px-10 shadow-lg gap-2">
                                                <File className="h-4 w-4" />
                                                Download PDF
                                            </Button>
                                        </a>
                                    </div>
                                ) : (
                                    <div className="p-6 md:p-8 lg:p-12 w-full overflow-x-hidden">
                                        <div 
                                            className="prose prose-base sm:prose-lg dark:prose-invert max-w-none whitespace-pre-wrap leading-relaxed text-muted-foreground/90 overflow-x-hidden break-words"
                                            dangerouslySetInnerHTML={{ __html: module.content }}
                                        />
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Navigation Buttons */}
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4">
                            <Link
                                href={prevModuleIndex !== null ? `/${schoolSlug}/courses/${courseId}/modules/${prevModuleIndex}` : "#"}
                                className={cn(
                                    "w-full sm:w-auto",
                                    prevModuleIndex === null && "opacity-50 pointer-events-none"
                                )}
                            >
                                <Button variant="outline" size="lg" className="w-full h-12 sm:h-14 rounded-2xl gap-2 px-8 font-bold border-border/50 shadow-sm">
                                    <ChevronLeft className="h-5 w-5" />
                                    Previous Lesson
                                </Button>
                            </Link>

                            <Link
                                href={nextModuleIndex !== null ? `/${schoolSlug}/courses/${courseId}/modules/${nextModuleIndex}` : "#"}
                                className={cn(
                                    "w-full sm:w-auto",
                                    nextModuleIndex === null && "opacity-50 pointer-events-none"
                                )}
                            >
                                <Button size="lg" className="w-full h-12 sm:h-14 rounded-2xl gap-2 px-10 font-bold shadow-xl bg-primary hover:opacity-90 transition-opacity">
                                    Next Lesson
                                    <ChevronRight className="h-5 w-5" />
                                </Button>
                            </Link>
                        </div>
                    </motion.div>
                </div>

                {/* Sidebar Lesson List */}
                <AnimatePresence>
                    {isSidebarOpen && (
                        <motion.div 
                            initial={{ opacity: 0, width: 0, x: 20 }}
                            animate={{ opacity: 1, width: "auto", x: 0 }}
                            exit={{ opacity: 0, width: 0, x: 20 }}
                            className="hidden lg:block lg:col-span-1 origin-right"
                        >
                            <Card className="border-none shadow-sm sticky top-[88px] rounded-2xl bg-muted/5 overflow-hidden w-full transition-all">
                                <CardHeader className="bg-background/80 backdrop-blur-sm border-b pb-3 px-4 pt-4 flex flex-row items-center justify-between">
                                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                                        <BookOpen className="h-4 w-4 text-primary" />
                                        Course Content
                                    </CardTitle>
                                    <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        className="h-6 w-6 rounded-md hover:bg-muted"
                                        onClick={() => setIsSidebarOpen(false)}
                                    >
                                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                    </Button>
                                </CardHeader>
                                <CardContent className="p-2 overflow-y-auto max-h-[calc(100vh-140px)]">
                                    <div className="space-y-1">
                                        {allModules.map((m: any, i: number) => {
                                            const mCompleted = user && m.completedBy?.includes(user!.uid);
                                            const isActive = i === index;

                                            return (
                                                <Link key={i} href={`/${schoolSlug}/courses/${courseId}/modules/${i}`}>
                                                    <div className={cn(
                                                        "p-3 rounded-xl transition-all cursor-pointer flex items-center gap-3 group border border-transparent",
                                                        isActive ? "bg-background border-border shadow-sm" : "hover:bg-background/50",
                                                        !isActive && mCompleted && "opacity-70"
                                                    )}>
                                                        <div className={cn(
                                                            "shrink-0 p-1.5 rounded-lg border shadow-xs transition-colors",
                                                            isActive ? "bg-primary text-primary-foreground border-primary" : "bg-background group-hover:border-primary/30 group-hover:text-primary"
                                                        )}>
                                                            {m.type === "video" ? <PlayCircle className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className={cn(
                                                                "text-xs font-bold truncate transition-colors",
                                                                isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                                                            )}>
                                                                {m.title}
                                                            </p>
                                                        </div>
                                                        {mCompleted && (
                                                            <CheckCircle className={cn(
                                                                "h-3.5 w-3.5 shrink-0",
                                                                isActive ? "text-primary" : "text-primary/50"
                                                            )} />
                                                        )}
                                                    </div>
                                                </Link>
                                            );
                                        })}
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
