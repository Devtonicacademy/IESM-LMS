import * as z from "zod";

export const quizQuestionSchema = z.object({
  id: z.string(),
  question: z.string().min(1, "Question is required"),
  options: z.array(z.string().min(1, "Option is required")).min(2, "At least two options are required"),
  correctAnswer: z.number().min(0, "Select a correct answer"),
});

export const quizSchema = z.object({
  questions: z.array(quizQuestionSchema),
  passMark: z.number().min(0).max(100).optional(),
});

export const attachmentSchema = z.object({
  name: z.string(),
  url: z.string(),
  size: z.number().optional(),
  type: z.string().optional(),
});

export const moduleSchema = z.object({
  title: z.string().min(1, "Module title is required"),
  videoUrl: z.string().optional(),
  content: z.string().optional(),
  notes: z.string().optional(),
  completedBy: z.array(z.string()).optional(),
  type: z.string().optional(), // Kept for backwards compatibility
  description: z.string().optional(), // Kept for backwards compatibility
  attachments: z.array(attachmentSchema).optional(),
});

export const caseStudySchema = z.object({
  instructions: z.string().min(1, "Instructions are required"),
  attachmentUrl: z.string().optional(),
});

export const finalAssessmentSchema = z.object({
  timePaperInstructions: z.string().optional(),
  finalProjectInstructions: z.string().optional(),
  presentationInstructions: z.string().optional(),
});

export const sectionSchema = z.object({
  title: z.string().min(1, "Section title is required"),
  type: z.enum(["standard", "quiz", "case_study", "final_assessment"]).default("standard"),
  modules: z.array(moduleSchema).default([]),
  quiz: quizSchema.optional(),
  caseStudy: caseStudySchema.optional(),
  finalAssessment: finalAssessmentSchema.optional(),
});

export const courseSchema = z.object({
  title: z.string().min(1, "Course title is required"),
  description: z.string().optional(),
  price: z.coerce.number().min(0, "Price cannot be negative"),
  session: z.string().optional(),
  courseType: z.enum(["structured", "pdf_only"]).default("structured"),
  pdfUrl: z.string().optional(),
  sections: z.array(sectionSchema).default([]),
});

export type CourseFormValues = z.infer<typeof courseSchema>;
export type QuizQuestion = z.infer<typeof quizQuestionSchema>;
export type Quiz = z.infer<typeof quizSchema>;
