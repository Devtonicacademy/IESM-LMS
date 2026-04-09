"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { cn } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray, Control, Controller } from "react-hook-form";
import * as z from "zod";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, ArrowLeft, BookOpen, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { courseSchema, CourseFormValues } from "@/lib/course-schema";
import { SectionQuizEditor } from "@/components/course/course-quiz-editor";
import { RichTextEditor } from "@/components/rich-text-editor";

function SectionModules({
  sectionIndex,
  control,
  register,
  errors,
  watch
}: {
  sectionIndex: number,
  control: Control<CourseFormValues>,
  register: any,
  errors: any,
  watch: any
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
          onClick={() => append({ title: "", videoUrl: "", content: "", notes: "" })}
          className="h-7 text-xs gap-1"
        >
          <Plus className="h-3 w-3" />
          Add Module
        </Button>
      </div>

      <AnimatePresence>
        {fields.map((field, index) => {
          const type = watch(`sections.${sectionIndex}.modules.${index}.type`);
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
                  <Label className="text-xs">Video Link (Optional)</Label>
                  <Input
                    {...register(`sections.${sectionIndex}.modules.${index}.videoUrl`)}
                    placeholder="e.g. https://youtube.com/..."
                    className="h-9 rounded-lg"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Module Content (Rich Text)</Label>
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
                  <Label className="text-xs">Notes (Optional)</Label>
                  <Textarea
                    placeholder="Add more details or instructor notes..."
                    {...register(`sections.${sectionIndex}.modules.${index}.notes`)}
                    className="min-h-[80px] rounded-lg text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Module Title <span className="text-destructive">*</span></Label>
                  <Input
                    {...register(`sections.${sectionIndex}.modules.${index}.title`)}
                    placeholder="e.g. Intro to UI Design"
                    className="h-9 rounded-lg border-primary/20"
                  />
                  {errors?.sections?.[sectionIndex]?.modules?.[index]?.title && (
                    <p className="text-[10px] text-destructive">{errors?.sections?.[sectionIndex]?.modules?.[index]?.title?.message}</p>
                  )}
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

  if (!user || (!isAdmin && !isInstructor)) {
    return <div className="p-8 text-center text-destructive">Unauthorized: You do not have permission to create courses.</div>;
  }

  const form = useForm<CourseFormValues>({
    resolver: zodResolver(courseSchema as any),
    defaultValues: {
      title: "",
      description: "",
      price: 0,
      sections: [{ title: "Introduction", modules: [{ title: "Welcome", content: "", videoUrl: "", notes: "" }] }],
    },
  });

  const { fields: sectionFields, append: appendSection, remove: removeSection } = useFieldArray({
    name: "sections",
    control: form.control,
  });

  async function onSubmit(data: CourseFormValues) {
    if (!user) return;
    setSaving(true);
    try {
      const coursesRef = collection(db, "schools", schoolSlug, "courses");
      await addDoc(coursesRef, {
        title: data.title,
        description: data.description || "",
        price: data.price || 0,
        instructorId: user.uid,
        sections: data.sections.map(s => ({
          ...s,
          modules: s.modules.map(m => ({ ...m, completedBy: [] }))
        })),
        // For backwards compatibility and easier counting
        modules: data.sections.flatMap(s => s.modules.map(m => ({ ...m, completedBy: [] }))),
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

        <div className="space-y-6">
          <div className="flex justify-between items-center bg-background/50 backdrop-blur-sm sticky top-0 py-4 z-10 border-b">
            <div className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-primary" />
              <h3 className="text-xl font-bold">Curriculum Sections</h3>
            </div>
            <Button
              type="button"
              onClick={() => appendSection({ title: "", modules: [] })}
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
                  <div className="absolute top-4 right-4">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeSection(index)}
                      className="text-destructive hover:bg-destructive/10 rounded-lg"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 text-primary font-bold text-sm">
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
                    {form.formState.errors.sections?.[index]?.title && (
                      <p className="text-xs text-destructive">{form.formState.errors.sections[index]?.title?.message}</p>
                    )}

                    <SectionModules
                      sectionIndex={index}
                      control={form.control}
                      register={form.register}
                      errors={form.formState.errors}
                      watch={form.watch}
                    />
                    <SectionQuizEditor
                      sectionIndex={index}
                      control={form.control}
                      register={form.register}
                      errors={form.formState.errors}
                      watch={form.watch}
                      setValue={form.setValue}
                    />
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>

        <Button type="submit" disabled={saving || sectionFields.length === 0} className="w-full h-12 rounded-xl text-lg font-bold shadow-lg bg-green-600 hover:bg-green-700 transition-all">
          {saving ? "Creating Course..." : "Create Course"}
        </Button>
      </form>
    </div>
  );
}
