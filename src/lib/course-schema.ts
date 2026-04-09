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

export const moduleSchema = z.object({
  title: z.string().min(1, "Module title is required"),
  videoUrl: z.string().optional(),
  content: z.string().optional(),
  notes: z.string().optional(),
  completedBy: z.array(z.string()).optional(),
  type: z.string().optional(), // Kept for backwards compatibility
  description: z.string().optional(), // Kept for backwards compatibility
});

export const sectionSchema = z.object({
  title: z.string().min(1, "Section title is required"),
  modules: z.array(moduleSchema),
  quiz: quizSchema.optional(),
});

export const courseSchema = z.object({
  title: z.string().min(1, "Course title is required"),
  description: z.string().optional(),
  price: z.coerce.number().min(0, "Price cannot be negative"),
  sections: z.array(sectionSchema),
});

export type CourseFormValues = z.infer<typeof courseSchema>;
export type QuizQuestion = z.infer<typeof quizQuestionSchema>;
export type Quiz = z.infer<typeof quizSchema>;
