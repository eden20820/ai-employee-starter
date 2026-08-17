import { z } from 'zod'
import { aiSpecificationSchema } from './generation'

export const interviewQuestionTypeSchema = z.enum([
  'single_choice',
  'multiple_choice',
  'text',
  'number',
  'boolean',
])

export const interviewCategorySchema = z.enum([
  'scope',
  'trigger',
  'inputs',
  'outputs',
  'tools',
  'permissions',
  'approvals',
  'constraints',
  'exceptions',
  'success',
])

export const interviewOptionSchema = z.object({
  value: z.string().min(1).max(120),
  label: z.string().min(1).max(200),
})

export const interviewQuestionSchema = z.object({
  id: z.string().regex(/^[a-z0-9_]+$/).max(80),
  category: interviewCategorySchema,
  type: interviewQuestionTypeSchema,
  question: z.string().min(3).max(500),
  helpText: z.string().max(500),
  required: z.boolean(),
  options: z.array(interviewOptionSchema).max(12),
  unit: z.string().max(40),
  allowOther: z.boolean(),
})

export const interviewUnderstandingSchema = z.object({
  roleSummary: z.string().min(3).max(600),
  knownFacts: z.array(z.string().min(3).max(500)).max(30),
  missingDimensions: z.array(interviewCategorySchema).max(10),
})

export const interviewTurnResultSchema = z.object({
  status: z.enum(['questions', 'ready']),
  understanding: interviewUnderstandingSchema,
  questions: z.array(interviewQuestionSchema).max(8),
  specification: aiSpecificationSchema.nullable(),
})

export const interviewAnswerValueSchema = z.union([
  z.string().max(3000),
  z.number(),
  z.boolean(),
  z.array(z.string().max(500)).max(20),
])

export const interviewAnswerSchema = z.object({
  questionId: z.string().regex(/^[a-z0-9_]+$/).max(80),
  question: z.string().min(3).max(500),
  answer: interviewAnswerValueSchema,
})

export type InterviewQuestion = z.infer<typeof interviewQuestionSchema>
export type InterviewAnswer = z.infer<typeof interviewAnswerSchema>
export type InterviewUnderstanding = z.infer<typeof interviewUnderstandingSchema>
export type InterviewTurnResult = z.infer<typeof interviewTurnResultSchema>
