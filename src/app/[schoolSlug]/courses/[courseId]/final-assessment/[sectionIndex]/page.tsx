"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, doc, getDoc, updateDoc, query, where, getDocs, addDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, ClipboardList, CheckCircle2, UploadCloud, Clock, FileCheck, Presentation } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";

export default function FinalAssessmentPage({
    params,
}: {
    params: Promise<{ schoolSlug: string; courseId: string; sectionIndex: string }>;
}) {
    const { schoolSlug, courseId, sectionIndex } = use(params);
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();

    const [course, setCourse] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    
    // Submissions state
    const [submissionDocId, setSubmissionDocId] = useState<string | null>(null);
    const [submittingTimePaper, setSubmittingTimePaper] = useState(false);
    const [submittingFinalProject, setSubmittingFinalProject] = useState(false);
    
    const [timePaperFile, setTimePaperFile] = useState<File | null>(null);
    const [finalProjectFile, setFinalProjectFile] = useState<File | null>(null);
    
    const [timePaperUrl, setTimePaperUrl] = useState<string | null>(null);
    const [finalProjectUrl, setFinalProjectUrl] = useState<string | null>(null);

    const sIdx = parseInt(sectionIndex, 10);

    useEffect(() => {
        if (!authLoading && !user) {
            router.push(`/${schoolSlug}/auth/login`);
            return;
        }

        async function fetchData() {
            try {
                // Fetch course
                const courseRef = doc(db, "schools", schoolSlug, "courses", courseId);
                const courseSnap = await getDoc(courseRef);
                if (courseSnap.exists()) {
                    setCourse({ id: courseSnap.id, ...courseSnap.data() });
                } else {
                    toast.error("Course not found");
                    setLoading(false);
                    return;
                }

                // Fetch existing submission if any
                const q = query(
                    collection(db, "schools", schoolSlug, "submissions"),
                    where("courseId", "==", courseId),
                    where("sectionIndex", "==", sIdx),
                    where("studentId", "==", user!.uid),
                    where("type", "==", "final_assessment")
                );
                const querySnapshot = await getDocs(q);
                if (!querySnapshot.empty) {
                    const docData = querySnapshot.docs[0];
                    setSubmissionDocId(docData.id);
                    const data = docData.data();
                    setTimePaperUrl(data.timePaperUrl || null);
                    setFinalProjectUrl(data.finalProjectUrl || null);
                }
            } catch (err) {
                console.error("Failed to load data", err);
            } finally {
                setLoading(false);
            }
        }
        if (user) fetchData();
    }, [user, authLoading, schoolSlug, courseId, sIdx, router]);

    if (loading || authLoading) return <div className="py-20 text-center animate-pulse">Loading final assessment...</div>;
    if (!course) return <div className="py-20 text-center text-muted-foreground">Course not found.</div>;

    const section = course.sections?.[sIdx];
    const finalAssessment = section?.finalAssessment;

    if (!section || !finalAssessment) {
        return (
            <div className="py-20 text-center space-y-4">
                <p className="text-muted-foreground">No final assessment exists for this section.</p>
                <Link href={`/${schoolSlug}/courses/${courseId}`}>
                    <Button variant="outline">Back to Course</Button>
                </Link>
            </div>
        );
    }

    const { timePaperInstructions, finalProjectInstructions, presentationInstructions, completedBy = [] } = finalAssessment;
    const isFullyCompleted = completedBy.includes(user?.uid);

    const checkAndMarkCompleted = async () => {
        // Only mark completed if the parts that have instructions have been uploaded
        const needsTimePaper = !!timePaperInstructions;
        const needsFinalProject = !!finalProjectInstructions;
        
        // Use the current urls or files depending on what we have
        const hasTimePaper = !!timePaperUrl;
        const hasFinalProject = !!finalProjectUrl;

        // Note: Presentation requires no upload, so it doesn't block completion
        
        if ((!needsTimePaper || hasTimePaper) && (!needsFinalProject || hasFinalProject)) {
            if (!isFullyCompleted && user) {
                try {
                    const newSections = JSON.parse(JSON.stringify(course.sections));
                    const targetFA = newSections[sIdx].finalAssessment;
                    if (!targetFA.completedBy) targetFA.completedBy = [];
                    targetFA.completedBy.push(user.uid);

                    const courseRef = doc(db, "schools", schoolSlug, "courses", courseId);
                    await updateDoc(courseRef, { sections: newSections });
                    
                    setCourse({ ...course, sections: newSections });
                } catch(e) {
                    console.error("Failed to mark course section completed", e);
                }
            }
        }
    };

    const handleUpload = async (type: 'time_paper' | 'final_project') => {
        if (!user) return;
        
        const file = type === 'time_paper' ? timePaperFile : finalProjectFile;
        if (!file) {
            toast.error("Please select a file to upload.");
            return;
        }

        const setSubmitting = type === 'time_paper' ? setSubmittingTimePaper : setSubmittingFinalProject;
        setSubmitting(true);
        
        try {
            // Upload file
            const fileExt = file.name.split(".").pop();
            const storageRef = ref(storage, `schools/${schoolSlug}/submissions/${courseId}/${user.uid}_${type}_${sIdx}_${Date.now()}.${fileExt}`);
            const snapshot = await uploadBytes(storageRef, file);
            const downloadUrl = await getDownloadURL(snapshot.ref);

            // Update or create submission doc
            const subCollection = collection(db, "schools", schoolSlug, "submissions");
            
            if (submissionDocId) {
                const docRef = doc(subCollection, submissionDocId);
                await updateDoc(docRef, {
                    [type === 'time_paper' ? 'timePaperUrl' : 'finalProjectUrl']: downloadUrl,
                    [type === 'time_paper' ? 'timePaperFileName' : 'finalProjectFileName']: file.name,
                    updatedAt: serverTimestamp(),
                });
            } else {
                const newDoc = await addDoc(subCollection, {
                    courseId,
                    sectionIndex: sIdx,
                    type: "final_assessment",
                    studentId: user.uid,
                    studentName: user.displayName || user.email || "Student",
                    studentEmail: user.email,
                    [type === 'time_paper' ? 'timePaperUrl' : 'finalProjectUrl']: downloadUrl,
                    [type === 'time_paper' ? 'timePaperFileName' : 'finalProjectFileName']: file.name,
                    submittedAt: serverTimestamp(),
                    graded: false,
                    score: null,
                });
                setSubmissionDocId(newDoc.id);
            }

            // Update local state
            if (type === 'time_paper') {
                setTimePaperUrl(downloadUrl);
                setTimePaperFile(null);
            } else {
                setFinalProjectUrl(downloadUrl);
                setFinalProjectFile(null);
            }

            toast.success("File uploaded successfully!");
            
            // Check if we can mark section complete now
            setTimeout(checkAndMarkCompleted, 500);

        } catch (err: any) {
            console.error("Upload error:", err);
            toast.error(err.message || "Failed to upload file.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen p-4 sm:p-8 flex justify-center bg-muted/10">
            <div className="w-full max-w-4xl space-y-6">
                <Link href={`/${schoolSlug}/courses/${courseId}`}>
                    <Button variant="ghost" size="sm" className="mb-2 -ml-3 gap-2 text-muted-foreground hover:text-foreground transition-colors">
                        <ArrowLeft className="h-4 w-4" />
                        Back to {course.title}
                    </Button>
                </Link>

                <Card className="border-border/50 shadow-lg">
                    <CardHeader className="bg-primary/5 rounded-t-xl border-b border-border/50 pb-6">
                        <div className="flex items-center gap-2 text-primary font-semibold text-sm mb-2">
                            <ClipboardList className="h-4 w-4" /> Section {sIdx + 1}
                        </div>
                        <CardTitle className="text-3xl font-bold">{section.title} - Final Assessment</CardTitle>
                        <CardDescription className="text-base mt-2">
                            Complete all required components of your final assessment.
                        </CardDescription>
                    </CardHeader>

                    <CardContent className="pt-8 space-y-8">
                        {isFullyCompleted && (
                            <div className="bg-green-500/10 text-green-600 dark:text-green-400 p-4 rounded-xl flex items-center gap-3 border border-green-500/20 mb-6">
                                <CheckCircle2 className="h-5 w-5" />
                                <div>
                                    <p className="font-semibold text-sm">You have completed the requirements for this final assessment.</p>
                                    <p className="text-xs opacity-90">Your submissions are awaiting grading.</p>
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-1 gap-8">
                            
                            {/* Time Paper */}
                            {timePaperInstructions && (
                                <div className="space-y-4 bg-background p-6 rounded-xl border shadow-sm">
                                    <h3 className="text-xl font-bold flex items-center gap-2 border-b pb-3">
                                        <Clock className="h-5 w-5 text-indigo-500" /> Time Paper
                                    </h3>
                                    <div className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground whitespace-pre-wrap">
                                        {timePaperInstructions}
                                    </div>
                                    
                                    <div className="mt-6 pt-4 border-t border-border/50">
                                        {timePaperUrl && (
                                            <div className="bg-green-500/10 text-green-600 dark:text-green-400 p-3 rounded-lg flex items-center justify-between border border-green-500/20 mb-4">
                                                <div className="flex items-center gap-2 text-sm font-semibold">
                                                    <CheckCircle2 className="h-4 w-4" /> Submitted
                                                </div>
                                                <a href={timePaperUrl} target="_blank" rel="noreferrer" className="text-xs font-medium underline hover:text-green-700">View Submission</a>
                                            </div>
                                        )}
                                        
                                        <div className="space-y-3">
                                            <Label htmlFor="time-paper-upload" className="font-medium text-sm">
                                                {timePaperUrl ? "Update Time Paper" : "Upload Time Paper"}
                                            </Label>
                                            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                                                <input 
                                                    id="time-paper-upload"
                                                    type="file" 
                                                    onChange={(e) => setTimePaperFile(e.target.files?.[0] || null)} 
                                                    className="w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-500/10 file:text-indigo-600 hover:file:bg-indigo-500/20 cursor-pointer border p-1 rounded-xl transition-all" 
                                                />
                                                <Button 
                                                    onClick={() => handleUpload('time_paper')} 
                                                    disabled={submittingTimePaper || !timePaperFile} 
                                                    className="w-full sm:w-auto font-bold rounded-lg gap-2 bg-indigo-600 hover:bg-indigo-700 text-white shrink-0"
                                                >
                                                    <UploadCloud className="h-4 w-4" />
                                                    {submittingTimePaper ? "Uploading..." : "Submit"}
                                                </Button>
                                            </div>
                                            <p className="text-xs text-muted-foreground">Recommended: PowerPoint Slides (.pptx). Max size: 10MB.</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Final Project */}
                            {finalProjectInstructions && (
                                <div className="space-y-4 bg-background p-6 rounded-xl border shadow-sm">
                                    <h3 className="text-xl font-bold flex items-center gap-2 border-b pb-3">
                                        <FileCheck className="h-5 w-5 text-teal-500" /> Final Project
                                    </h3>
                                    <div className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground whitespace-pre-wrap">
                                        {finalProjectInstructions}
                                    </div>
                                    
                                    <div className="mt-6 pt-4 border-t border-border/50">
                                        {finalProjectUrl && (
                                            <div className="bg-green-500/10 text-green-600 dark:text-green-400 p-3 rounded-lg flex items-center justify-between border border-green-500/20 mb-4">
                                                <div className="flex items-center gap-2 text-sm font-semibold">
                                                    <CheckCircle2 className="h-4 w-4" /> Submitted
                                                </div>
                                                <a href={finalProjectUrl} target="_blank" rel="noreferrer" className="text-xs font-medium underline hover:text-green-700">View Submission</a>
                                            </div>
                                        )}
                                        
                                        <div className="space-y-3">
                                            <Label htmlFor="final-project-upload" className="font-medium text-sm">
                                                {finalProjectUrl ? "Update Final Project" : "Upload Final Project"}
                                            </Label>
                                            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                                                <input 
                                                    id="final-project-upload"
                                                    type="file" 
                                                    onChange={(e) => setFinalProjectFile(e.target.files?.[0] || null)} 
                                                    className="w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-teal-500/10 file:text-teal-600 hover:file:bg-teal-500/20 cursor-pointer border p-1 rounded-xl transition-all" 
                                                />
                                                <Button 
                                                    onClick={() => handleUpload('final_project')} 
                                                    disabled={submittingFinalProject || !finalProjectFile} 
                                                    className="w-full sm:w-auto font-bold rounded-lg gap-2 bg-teal-600 hover:bg-teal-700 text-white shrink-0"
                                                >
                                                    <UploadCloud className="h-4 w-4" />
                                                    {submittingFinalProject ? "Uploading..." : "Submit"}
                                                </Button>
                                            </div>
                                            <p className="text-xs text-muted-foreground">Recommended: PDF Document (.pdf). Max size: 20MB.</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Presentation */}
                            {presentationInstructions && (
                                <div className="space-y-4 bg-background p-6 rounded-xl border shadow-sm">
                                    <h3 className="text-xl font-bold flex items-center gap-2 border-b pb-3">
                                        <Presentation className="h-5 w-5 text-orange-500" /> Final Project Presentation
                                    </h3>
                                    <div className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground whitespace-pre-wrap">
                                        {presentationInstructions}
                                    </div>
                                    <div className="mt-4 pt-4 border-t border-border/50">
                                        <p className="text-sm font-medium text-muted-foreground italic flex items-center gap-2">
                                            <CheckCircle2 className="h-4 w-4" /> No upload required for this component.
                                        </p>
                                    </div>
                                </div>
                            )}

                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
