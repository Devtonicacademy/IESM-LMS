"use client";

import React, { use, useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { cn } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray, Control, Controller } from "react-hook-form";
import * as z from "zod";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, ArrowLeft, BookOpen, Layers, Upload, FileText, Paperclip, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { courseSchema, CourseFormValues } from "@/lib/course-schema";
import { SectionQuizEditor } from "@/components/course/course-quiz-editor";
import { SectionCaseStudyEditor, SectionFinalAssessmentEditor } from "@/components/course/course-additional-editors";
import { RichTextEditor } from "@/components/rich-text-editor";
import { AIAssessmentAssistant } from "@/components/course/ai-assessment-assistant";

function SectionModules({
  sectionIndex,
  control,
  register,
  errors,
  watch,
  setValue,
  schoolSlug
}: {
  sectionIndex: number,
  control: Control<CourseFormValues>,
  register: any,
  errors: any,
  watch: any,
  setValue: any,
  schoolSlug: string
}) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: `sections.${sectionIndex}.modules` as any,
  });

  return (
    <div className="space-y-4 pt-2">
      <div className="flex items-center justify-between px-2">
        <Label className="text-sm font-semibold flex items-center gap-2">
          <BookOpen className="h-4 w-4" />
          Modules
        </Label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => append({ title: "", videoUrl: "", content: "", notes: "", attachments: [] })}
          className="h-7 text-xs gap-1"
        >
          <Plus className="h-3 w-3" />
          Add Module
        </Button>
      </div>

      <AnimatePresence>
        {fields.map((field, index) => {
          const type = watch(`sections.${sectionIndex}.modules.${index}.type`);
          const attachments = watch(`sections.${sectionIndex}.modules.${index}.attachments`) || [];
          
          return (
            <motion.div
              key={field.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="p-4 border border-border/50 rounded-xl bg-muted/20 relative group"
            >
              <div className="absolute top-2 right-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => remove(index)}
                  className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <div className="grid gap-4 md:grid-cols-1">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Module Title <span className="text-destructive">*</span></Label>
                  <Input
                    {...register(`sections.${sectionIndex}.modules.${index}.title`)}
                    placeholder="e.g. Intro to UI Design"
                    className="h-9 rounded-lg border-primary/20"
                  />
                  {errors?.sections?.[sectionIndex]?.modules?.[index]?.title && (
                    <p className="text-[10px] text-destructive">{errors?.sections?.[sectionIndex]?.modules?.[index]?.title?.message}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Video Link (Optional)</Label>
                  <Input
                    {...register(`sections.${sectionIndex}.modules.${index}.videoUrl`)}
                    placeholder="e.g. https://youtube.com/..."
                    className="h-9 rounded-lg"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Module Content (Rich Text)</Label>
                  <Controller
                    control={control}
                    name={`sections.${sectionIndex}.modules.${index}.content`}
                    render={({ field }) => (
                      <RichTextEditor
                        value={field.value || ""}
                        onChange={field.onChange}
                        placeholder="Write your module content here with formatting..."
                      />
                    )}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Notes (Optional)</Label>
                  <Textarea
                    placeholder="Add more details or instructor notes..."
                    {...register(`sections.${sectionIndex}.modules.${index}.notes`)}
                    className="min-h-[80px] rounded-lg text-sm"
                  />
                </div>

                {/* Attachments Section */}
                <div className="space-y-2 border-t pt-3 mt-1">
                  <Label className="text-xs font-semibold flex items-center gap-1.5">
                    <Paperclip className="h-3.5 w-3.5 text-primary" />
                    Attachments / Lesson Resources (Optional)
                  </Label>

                  {attachments.length > 0 && (
                    <div className="space-y-1.5 max-w-xl">
                      {attachments.map((att: any, attIdx: number) => (
                        <div key={attIdx} className="flex items-center justify-between p-2 rounded-lg border bg-background text-xs">
                          <div className="flex items-center gap-2 truncate">
                            <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span className="truncate font-medium">{att.name}</span>
                            {att.size && <span className="text-[10px] text-muted-foreground">({(att.size / 1024).toFixed(1)} KB)</span>}
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              const updated = attachments.filter((_: any, i: number) => i !== attIdx);
                              setValue(`sections.${sectionIndex}.modules.${index}.attachments`, updated);
                            }}
                            className="h-6 w-6 text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const input = document.createElement("input");
                        input.type = "file";
                        input.multiple = true;
                        input.onchange = async (e) => {
                          const files = (e.target as HTMLInputElement).files;
                          if (!files || files.length === 0) return;
                          
                          const loadingToastId = toast.loading("Uploading attachment...");
                          try {
                            const newAttachments = [...attachments];
                            
                            for (let i = 0; i < files.length; i++) {
                              const file = files[i];
                              const fileRef = ref(storage, `courses/${schoolSlug}/attachments/${Date.now()}_${file.name}`);
                              await uploadBytes(fileRef, file);
                              const url = await getDownloadURL(fileRef);
                              newAttachments.push({
                                name: file.name,
                                url,
                                size: file.size,
                                type: file.type,
                              });
                            }
                            
                            setValue(`sections.${sectionIndex}.modules.${index}.attachments`, newAttachments);
                            toast.success("Attachment(s) uploaded successfully!", { id: loadingToastId });
                          } catch (err: any) {
                            toast.error(err.message || "Failed to upload attachments", { id: loadingToastId });
                          }
                        };
                        input.click();
                      }}
                      className="text-xs h-8 border-dashed flex items-center gap-1.5"
                    >
                      <Upload className="h-3.5 w-3.5" />
                      Upload Files
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>

      {fields.length === 0 && (
        <div className="text-center py-6 border border-dashed rounded-xl bg-muted/10 text-xs text-muted-foreground">
          No modules in this section yet.
        </div>
      )}
    </div>
  );
}

export default function NewCoursePage({ params }: { params: Promise<{ schoolSlug: string }> }) {
  const { schoolSlug } = use(params);
  const { user, isAdmin, isInstructor } = useAuth();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [assistantOpen, setAssistantOpen] = useState(false);

  // Redirect instructors — only admins can create new courses
  useEffect(() => {
    if (user && !isAdmin && isInstructor) {
      router.replace(`/${schoolSlug}/admin/courses`);
    }
  }, [user, isAdmin, isInstructor, router, schoolSlug]);

  const handleApplyAssessments = (questions: any[], project: string, timesheet: string) => {
    const newSections: any[] = [];
    if (questions.length > 0) {
      newSections.push({
        title: "Course Quiz",
        type: "quiz",
        modules: [],
        quiz: {
          questions: questions,
          passMark: 80
        }
      });
    }
    if (project.trim().length > 0 || timesheet.trim().length > 0) {
      newSections.push({
        title: "Final Assessments",
        type: "final_assessment",
        modules: [],
        finalAssessment: {
          timePaperInstructions: timesheet,
          finalProjectInstructions: project,
          presentationInstructions: "Present your final project to the class."
        }
      });
    }
    replaceSections(newSections);
    toast.success("AI generated assessments applied to course form!");
  };

  if (!user || (!isAdmin && !isInstructor)) {
    return <div className="p-8 text-center text-destructive">Unauthorized: You do not have permission to create courses.</div>;
  }

  const form = useForm<CourseFormValues>({
    resolver: zodResolver(courseSchema as any),
    defaultValues: {
      title: "",
      description: "",
      price: 0,
      session: "First Academic Session",
      courseType: "structured",
      sections: [{ title: "Introduction", type: "standard", modules: [{ title: "Welcome", content: "", videoUrl: "", notes: "", attachments: [] }] }],
    },
  });

  const courseType = form.watch("courseType");

  const { fields: sectionFields, append: appendSection, remove: removeSection, replace: replaceSections } = useFieldArray({
    name: "sections",
    control: form.control,
  });

  async function onSubmit(data: CourseFormValues) {
    if (!user) return;
    setSaving(true);
    try {
      let finalPdfUrl = data.pdfUrl || "";
      if (data.courseType === "pdf_only" && pdfFile) {
        const fileRef = ref(storage, `courses/${schoolSlug}/${Date.now()}_${pdfFile.name}`);
        await uploadBytes(fileRef, pdfFile);
        finalPdfUrl = await getDownloadURL(fileRef);
      }

      const coursesRef = collection(db, "schools", schoolSlug, "courses");
      await addDoc(coursesRef, {
        title: data.title,
        description: data.description || "",
        price: data.price || 0,
        session: data.session || "First Academic Session",
        courseType: data.courseType || "structured",
        pdfUrl: finalPdfUrl,
        instructorId: user.uid,
        sections: data.sections ? data.sections.map(s => ({
          title: s.title,
          type: s.type || "standard",
          modules: s.modules?.map(m => ({
            title: m.title,
            videoUrl: m.videoUrl || "",
            content: m.content || "",
            notes: m.notes || "",
            attachments: m.attachments || [],
            completedBy: []
          })) || [],
          quiz: s.quiz || null,
          caseStudy: s.caseStudy || null,
          finalAssessment: s.finalAssessment || null
        })) : [],
        // For backwards compatibility and easier counting
        modules: data.sections ? data.sections.flatMap(s => s.modules?.map(m => ({
          title: m.title,
          videoUrl: m.videoUrl || "",
          content: m.content || "",
          notes: m.notes || "",
          attachments: m.attachments || [],
          completedBy: []
        })) || []) : [],
        enrolledStudents: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      toast.success("Course created successfully!");
      router.push(`/${schoolSlug}/admin/courses`);
    } catch (err: any) {
      toast.error(err.message || "Failed to create course");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <Link href={`/${schoolSlug}/admin/courses`} className="mb-6 -ml-4 inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Courses
      </Link>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <Card className="border-border/50 shadow-lg">
          <CardHeader className="pb-4">
            <CardTitle className="text-3xl font-bold">Create New Course</CardTitle>
            <CardDescription>Configure a new course and curriculum structure.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title" className="text-sm font-semibold">Course Title <span className="text-destructive">*</span></Label>
                <Input
                  id="title"
                  placeholder="e.g. Microsoft Power Platform Mastery"
                  {...form.register("title")}
                  className={cn("h-11 rounded-xl bg-muted/20 border-border/50 focus:bg-background transition-all", form.formState.errors.title && "border-destructive")}
                />
                {form.formState.errors.title && (
                  <p className="text-sm text-destructive">{form.formState.errors.title.message}</p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="session" className="text-sm font-semibold">Academic Session <span className="text-destructive">*</span></Label>
                  <Controller
                    control={form.control}
                    name="session"
                    render={({ field }) => (
                      <Select onValueChange={field.onChange} value={field.value || "First Academic Session"}>
                        <SelectTrigger className="h-11 rounded-xl bg-muted/20 border-border/50">
                          <SelectValue placeholder="Select Session" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="First Academic Session">First Academic Session</SelectItem>
                          <SelectItem value="Second Academic Session">Second Academic Session</SelectItem>
                          <SelectItem value="Third Academic Session">Third Academic Session</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="courseType" className="text-sm font-semibold">Course Structure <span className="text-destructive">*</span></Label>
                  <Controller
                    control={form.control}
                    name="courseType"
                    render={({ field }) => (
                      <Select onValueChange={field.onChange} value={field.value || "structured"}>
                        <SelectTrigger className="h-11 rounded-xl bg-muted/20 border-border/50">
                          <SelectValue placeholder="Select Structure" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="structured">Structured Curriculum (Modules & Sections)</SelectItem>
                          <SelectItem value="pdf_only">PDF Attachment Only</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="price" className="text-sm font-semibold">Course Price (₦) <span className="text-muted-foreground font-normal">(Leave 0 for free)</span></Label>
                <Input
                  id="price"
                  type="number"
                  placeholder="0"
                  {...form.register("price")}
                  className={cn("h-11 rounded-xl bg-muted/20 border-border/50 focus:bg-background transition-all", form.formState.errors.price && "border-destructive")}
                />
                {form.formState.errors.price && (
                  <p className="text-sm text-destructive">{form.formState.errors.price.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="description" className="text-sm font-semibold">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Enter course overview, objectives and what students will learn..."
                  {...form.register("description")}
                  className="min-h-[120px] rounded-xl bg-muted/20 border-border/50 focus:bg-background transition-all"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {courseType === "pdf_only" && (
          <Card className="border-border/50 shadow-lg">
            <CardHeader className="pb-4">
              <CardTitle className="text-2xl font-bold flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Course PDF
              </CardTitle>
              <CardDescription>Upload the main document for this course.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div 
                className="border-2 border-dashed border-muted-foreground/30 rounded-2xl p-8 text-center hover:bg-muted/30 transition-colors cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  ref={fileInputRef}
                  onChange={(e) => {
                    if (e.target.files?.[0]) setPdfFile(e.target.files[0]);
                  }}
                />
                <div className="flex flex-col items-center gap-2">
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <p className="font-semibold">{pdfFile ? pdfFile.name : "Click to select a PDF file"}</p>
                  <p className="text-xs text-muted-foreground">PDF files up to 50MB</p>
                </div>
              </div>

              {/* AI Assessment Section for PDF-only course */}
              <div className="pt-6 border-t border-border/50 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <h4 className="text-sm font-semibold flex items-center gap-2 text-foreground">
                      <Sparkles className="h-4 w-4 text-violet-500 animate-pulse" />
                      Course Assessments (AI-Powered)
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      Generate exam questions, quizzes, project tasks, and timesheet papers based on this PDF.
                    </p>
                  </div>
                  <Button
                    type="button"
                    onClick={() => setAssistantOpen(true)}
                    className="shrink-0 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white border-0 shadow-md gap-1.5 text-xs h-9 font-semibold"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Open AI Assistant
                  </Button>
                </div>

                {/* Displaying Summary */}
                {form.watch("sections")?.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {(() => {
                      const sections = form.watch("sections") || [];
                      const quizSec = sections.find((s: any) => s.type === "quiz");
                      const faSec = sections.find((s: any) => s.type === "final_assessment");
                      
                      return (
                        <>
                          <div className="p-3 bg-muted/20 border border-border/50 rounded-xl space-y-1">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Course Quiz</span>
                            <span className="text-xs font-semibold block">
                              {quizSec?.quiz?.questions?.length
                                ? `${quizSec?.quiz?.questions?.length} Questions` 
                                : "Not Generated"}
                            </span>
                          </div>
                          <div className="p-3 bg-muted/20 border border-border/50 rounded-xl space-y-1">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Final Project</span>
                            <span className="text-xs font-semibold block truncate">
                              {faSec?.finalAssessment?.finalProjectInstructions 
                                ? "Instructions Configured" 
                                : "Not Generated"}
                            </span>
                          </div>
                          <div className="p-3 bg-muted/20 border border-border/50 rounded-xl space-y-1">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Timesheet Guidelines</span>
                            <span className="text-xs font-semibold block truncate">
                              {faSec?.finalAssessment?.timePaperInstructions 
                                ? "Guidelines Configured" 
                                : "Not Generated"}
                            </span>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                ) : (
                  <div className="text-center py-4 bg-muted/10 border border-dashed rounded-xl text-xs text-muted-foreground">
                    No assessments generated yet. Click "Open AI Assistant" to begin!
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="space-y-6">
          <div className="flex justify-between items-center bg-background/50 backdrop-blur-sm sticky top-0 py-4 z-10 border-b">
            <div className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-primary" />
              <h3 className="text-xl font-bold">Curriculum Sections</h3>
            </div>
            <Button
              type="button"
              onClick={() => appendSection({ title: "", type: "standard", modules: [] })}
              variant="outline"
              className="rounded-xl border-primary/20 hover:bg-primary/5 text-primary gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Section
            </Button>
          </div>

          <div className="space-y-8">
            <AnimatePresence>
              {sectionFields.map((field, index) => (
                <motion.div
                  key={field.id}
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="p-6 border border-border/50 rounded-2xl bg-card shadow-sm hover:shadow-md transition-shadow relative group"
                >
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                      <div className="flex items-center gap-3 flex-1">
                        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 text-primary font-bold text-sm shrink-0">
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <Input
                            {...form.register(`sections.${index}.title`)}
                            placeholder="Section Title (e.g. Getting Started)"
                            className={cn("text-lg font-bold border-none bg-transparent h-auto p-0 focus-visible:ring-0 placeholder:opacity-50", form.formState.errors.sections?.[index]?.title && "text-destructive")}
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-2 pl-11 sm:pl-0">
                        <Controller
                          control={form.control}
                          name={`sections.${index}.type`}
                          render={({ field }) => (
                            <Select onValueChange={field.onChange} value={field.value || "standard"}>
                              <SelectTrigger className="w-[150px] sm:w-48 h-9 text-xs rounded-lg">
                                <SelectValue placeholder="Section Type" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="standard">Standard Modules</SelectItem>
                                <SelectItem value="quiz">Quiz Assessment</SelectItem>
                                <SelectItem value="case_study">Case Study</SelectItem>
                                <SelectItem value="final_assessment">Final Assessment</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeSection(index)}
                          className="text-destructive hover:bg-destructive/10 rounded-lg shrink-0 h-9 w-9"
                          title="Delete Section"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    {form.formState.errors.sections?.[index]?.title && (
                      <p className="text-xs text-destructive">{form.formState.errors.sections[index]?.title?.message}</p>
                    )}

                    {form.watch(`sections.${index}.type`) === "standard" && (
                      <SectionModules
                        sectionIndex={index}
                        control={form.control}
                        register={form.register}
                        errors={form.formState.errors}
                        watch={form.watch}
                        setValue={form.setValue}
                        schoolSlug={schoolSlug}
                      />
                    )}
                    
                    {form.watch(`sections.${index}.type`) === "quiz" && (
                      <SectionQuizEditor
                        sectionIndex={index}
                        control={form.control}
                        register={form.register}
                        errors={form.formState.errors}
                        watch={form.watch}
                        setValue={form.setValue}
                      />
                    )}

                    {form.watch(`sections.${index}.type`) === "case_study" && (
                      <SectionCaseStudyEditor
                        sectionIndex={index}
                        control={form.control}
                        register={form.register}
                        errors={form.formState.errors}
                        watch={form.watch}
                      />
                    )}

                    {form.watch(`sections.${index}.type`) === "final_assessment" && (
                      <SectionFinalAssessmentEditor
                        sectionIndex={index}
                        control={form.control}
                        register={form.register}
                        errors={form.formState.errors}
                        watch={form.watch}
                      />
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            
            {sectionFields.length === 0 && (
              <div className="text-center py-12 border-2 border-dashed border-border/50 rounded-2xl bg-muted/5">
                <p className="text-muted-foreground">No sections created yet. Add your first section to organize your course content.</p>
                <Button
                  type="button"
                  onClick={() => appendSection({ title: "", type: "standard", modules: [] })}
                  variant="ghost"
                  className="mt-4 gap-2 text-primary"
                >
                  <Plus className="h-4 w-4" />
                  Create My First Section
                </Button>
              </div>
            )}
          </div>
        </div>

        <Button type="submit" disabled={saving || (courseType === "structured" && sectionFields.length === 0)} className="w-full h-12 rounded-xl text-lg font-bold shadow-lg bg-green-600 hover:bg-green-700 transition-all">
          {saving ? "Creating Course..." : "Create Course"}
        </Button>
      </form>

      {assistantOpen && (
        <AIAssessmentAssistant
          open={assistantOpen}
          onClose={() => setAssistantOpen(false)}
          schoolSlug={schoolSlug}
          coursePdfFile={pdfFile}
          onApply={handleApplyAssessments}
          initialQuizQuestions={(() => {
            const quizSec = form.getValues("sections")?.find((s: any) => s.type === "quiz");
            return quizSec?.quiz?.questions || [];
          })()}
          initialProjectInstructions={(() => {
            const faSec = form.getValues("sections")?.find((s: any) => s.type === "final_assessment");
            return faSec?.finalAssessment?.finalProjectInstructions || "";
          })()}
          initialTimesheetInstructions={(() => {
            const faSec = form.getValues("sections")?.find((s: any) => s.type === "final_assessment");
            return faSec?.finalAssessment?.timePaperInstructions || "";
          })()}
        />
      )}
    </div>
  );
}
