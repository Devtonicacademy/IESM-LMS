"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, doc, getDoc, updateDoc, addDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, FileText, CheckCircle2, File, UploadCloud, DownloadCloud } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";

export default function CaseStudyPage({
    params,
}: {
    params: Promise<{ schoolSlug: string; courseId: string; sectionIndex: string }>;
}) {
    const { schoolSlug, courseId, sectionIndex } = use(params);
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();

    const [course, setCourse] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [uploadFile, setUploadFile] = useState<File | null>(null);

    const sIdx = parseInt(sectionIndex, 10);

    useEffect(() => {
        if (!authLoading && !user) {
            router.push(`/${schoolSlug}/auth/login`);
            return;
        }

        async function fetchCourse() {
            try {
                const docRef = doc(db, "schools", schoolSlug, "courses", courseId);
                const snap = await getDoc(docRef);
                if (snap.exists()) {
                    setCourse({ id: snap.id, ...snap.data() });
                } else {
                    toast.error("Course not found");
                }
            } catch (err) {
                console.error("Failed to load course", err);
            } finally {
                setLoading(false);
            }
        }
        if (user) fetchCourse();
    }, [user, authLoading, schoolSlug, courseId, router]);

    if (loading || authLoading) return <div className="py-20 text-center animate-pulse">Loading case study...</div>;
    if (!course) return <div className="py-20 text-center text-muted-foreground">Course not found.</div>;

    const section = course.sections?.[sIdx];
    const caseStudy = section?.caseStudy;

    if (!section || !caseStudy) {
        return (
            <div className="py-20 text-center space-y-4">
                <p className="text-muted-foreground">No case study exists for this section.</p>
                <Link href={`/${schoolSlug}/courses/${courseId}`}>
                    <Button variant="outline">Back to Course</Button>
                </Link>
            </div>
        );
    }

    const { instructions, attachmentUrl, completedBy = [] } = caseStudy;
    const previouslySubmitted = user && completedBy.includes(user.uid);

    const handleSubmit = async () => {
        if (!user) return;
        if (!uploadFile) {
            toast.error("Please select a file to upload.");
            return;
        }

        setSubmitting(true);
        try {
            // Upload file
            const fileExt = uploadFile.name.split(".").pop();
            const storageRef = ref(storage, `schools/${schoolSlug}/submissions/${courseId}/${user.uid}_case_study_${sIdx}_${Date.now()}.${fileExt}`);
            const snapshot = await uploadBytes(storageRef, uploadFile);
            const downloadUrl = await getDownloadURL(snapshot.ref);

            // Create submission record
            await addDoc(collection(db, "schools", schoolSlug, "submissions"), {
                courseId,
                sectionIndex: sIdx,
                type: "case_study",
                studentId: user.uid,
                studentName: user.displayName || user.email || "Student",
                studentEmail: user.email,
                fileUrl: downloadUrl,
                fileName: uploadFile.name,
                submittedAt: serverTimestamp(),
                graded: false,
                score: null,
            });

            // Mark as completed in course
            if (!previouslySubmitted) {
                const newSections = JSON.parse(JSON.stringify(course.sections));
                const targetCS = newSections[sIdx].caseStudy;
                if (!targetCS.completedBy) targetCS.completedBy = [];
                targetCS.completedBy.push(user.uid);

                const courseRef = doc(db, "schools", schoolSlug, "courses", courseId);
                await updateDoc(courseRef, { sections: newSections });
                
                // Update local state so it shows success UI
                setCourse({ ...course, sections: newSections });
            }

            toast.success("Case study submitted successfully!");
            setUploadFile(null);
        } catch (err: any) {
            console.error("Submission error:", err);
            toast.error(err.message || "Failed to submit case study.");
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
                            <FileText className="h-4 w-4" /> Section {sIdx + 1}
                        </div>
                        <CardTitle className="text-3xl font-bold">{section.title} - Case Study</CardTitle>
                        <CardDescription className="text-base mt-2">
                            Review the instructions and submit your work below.
                        </CardDescription>
                    </CardHeader>

                    <CardContent className="pt-8 space-y-8">
                        {previouslySubmitted && (
                            <div className="bg-green-500/10 text-green-600 dark:text-green-400 p-4 rounded-xl flex items-center gap-3 border border-green-500/20 mb-6">
                                <CheckCircle2 className="h-5 w-5" />
                                <div>
                                    <p className="font-semibold text-sm">You have already submitted this case study.</p>
                                    <p className="text-xs opacity-90">You can upload again to replace your previous submission.</p>
                                </div>
                            </div>
                        )}

                        <div className="space-y-4">
                            <h3 className="text-xl font-bold border-b pb-2">Instructions</h3>
                            <div className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground whitespace-pre-wrap bg-background p-6 rounded-xl border border-border/50 shadow-sm">
                                {instructions}
                            </div>
                        </div>

                        {attachmentUrl && (
                            <div className="space-y-4 bg-muted/30 p-6 rounded-xl border border-border/50">
                                <h3 className="text-base font-bold flex items-center gap-2">
                                    <File className="h-4 w-4 text-primary" /> Attached Resources
                                </h3>
                                <p className="text-sm text-muted-foreground mb-4">Please download and review the attached document for this case study.</p>
                                <a href={attachmentUrl} target="_blank" rel="noreferrer">
                                    <Button variant="outline" className="gap-2 shadow-sm">
                                        <DownloadCloud className="h-4 w-4" />
                                        Download Attachment
                                    </Button>
                                </a>
                            </div>
                        )}

                        <div className="space-y-4 pt-4 border-t border-border/50">
                            <h3 className="text-xl font-bold">Your Submission</h3>
                            
                            <div className="space-y-3 bg-background p-6 rounded-xl border border-border/50 shadow-sm">
                                <Label htmlFor="file-upload" className="font-medium text-sm">Upload Document <span className="text-destructive">*</span></Label>
                                <div className="flex items-center gap-4">
                                    <input 
                                        id="file-upload"
                                        type="file" 
                                        onChange={(e) => setUploadFile(e.target.files?.[0] || null)} 
                                        className="w-full text-sm text-muted-foreground file:mr-4 file:py-2.5 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer border border-dashed p-2 rounded-xl transition-all hover:border-primary/50" 
                                    />
                                </div>
                                <p className="text-xs text-muted-foreground">Accepted formats: PDF, DOCX, PPTX. Max file size: 10MB.</p>
                            </div>
                        </div>
                    </CardContent>

                    <CardFooter className="p-6 bg-muted/10 border-t border-border/50 rounded-b-xl flex justify-end gap-3">
                        <Link href={`/${schoolSlug}/courses/${courseId}`}>
                            <Button variant="outline" className="font-semibold rounded-xl">Cancel</Button>
                        </Link>
                        <Button 
                            onClick={handleSubmit} 
                            disabled={submitting || !uploadFile} 
                            className="font-bold rounded-xl shadow-lg gap-2"
                        >
                            <UploadCloud className="h-4 w-4" />
                            {submitting ? "Uploading..." : (previouslySubmitted ? "Update Submission" : "Submit Case Study")}
                        </Button>
                    </CardFooter>
                </Card>
            </div>
        </div>
    );
}
