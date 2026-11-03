import { Control, Controller } from "react-hook-form";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { CourseFormValues } from "@/lib/course-schema";
import { BookOpen, FileText, ClipboardList } from "lucide-react";

export function SectionCaseStudyEditor({
  sectionIndex,
  control,
  register,
  errors,
  watch,
  isAdmin = true,
}: {
  sectionIndex: number,
  control: Control<CourseFormValues>,
  register: any,
  errors: any,
  watch: any,
  isAdmin?: boolean,
}) {
  return (
    <div className="space-y-4 pt-4 border-t border-border/50">
      {!isAdmin && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-600 rounded-xl text-xs font-medium">
          Case study details are view-only for instructors and can only be modified by course administrators.
        </div>
      )}
      <div className="flex items-center gap-2 px-2">
        <FileText className="h-4 w-4" />
        <Label className="text-sm font-semibold">Case Study Details</Label>
      </div>
      <div className="p-4 border border-border/50 rounded-xl bg-muted/20 space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs">Instructions <span className="text-destructive">*</span></Label>
          <Textarea
            placeholder="Provide instructions for the case study... (Lecturers will be able to group students here later)"
            {...register(`sections.${sectionIndex}.caseStudy.instructions`)}
            disabled={!isAdmin}
            className="min-h-[100px] rounded-lg text-sm"
          />
          <p className="text-[10px] text-muted-foreground">Note: Instructors can group students later. Group scores will reflect on each student in the group.</p>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Attachment URL (Optional)</Label>
          <Input
            placeholder="Link to PDF or resource..."
            {...register(`sections.${sectionIndex}.caseStudy.attachmentUrl`)}
            disabled={!isAdmin}
            className="h-9 rounded-lg"
          />
          <p className="text-[10px] text-muted-foreground">Upload any required reading or attachments for the case study.</p>
        </div>
      </div>
    </div>
  );
}

export function SectionFinalAssessmentEditor({
  sectionIndex,
  control,
  register,
  errors,
  watch,
  isAdmin = true,
}: {
  sectionIndex: number,
  control: Control<CourseFormValues>,
  register: any,
  errors: any,
  watch: any,
  isAdmin?: boolean,
}) {
  return (
    <div className="space-y-4 pt-4 border-t border-border/50">
      {!isAdmin && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-600 rounded-xl text-xs font-medium">
          Final assessment guidelines are view-only for instructors and can only be modified by course administrators.
        </div>
      )}
      <div className="flex items-center gap-2 px-2">
        <ClipboardList className="h-4 w-4" />
        <Label className="text-sm font-semibold">Final Assessment Details</Label>
      </div>
      <div className="p-4 border border-border/50 rounded-xl bg-muted/20 space-y-6">
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-primary">Time Paper</Label>
          <Textarea
            placeholder="Instructions for the time paper..."
            {...register(`sections.${sectionIndex}.finalAssessment.timePaperInstructions`)}
            disabled={!isAdmin}
            className="min-h-[80px] rounded-lg text-sm"
          />
          <p className="text-[10px] text-muted-foreground">Accepts student uploads (all file types, PowerPoint recommended). Instructors grade here.</p>
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-primary">Final Project</Label>
          <Textarea
            placeholder="Instructions for the final project..."
            {...register(`sections.${sectionIndex}.finalAssessment.finalProjectInstructions`)}
            disabled={!isAdmin}
            className="min-h-[80px] rounded-lg text-sm"
          />
          <p className="text-[10px] text-muted-foreground">Accepts student uploads (all file types, PDF recommended). Instructors grade here.</p>
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-primary">Final Project Presentation</Label>
          <Textarea
            placeholder="Instructions for the presentation..."
            {...register(`sections.${sectionIndex}.finalAssessment.presentationInstructions`)}
            disabled={!isAdmin}
            className="min-h-[80px] rounded-lg text-sm"
          />
          <p className="text-[10px] text-muted-foreground">No student upload needed. Instructors only grade here.</p>
        </div>
      </div>
    </div>
  );
}
