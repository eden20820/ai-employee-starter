import { z } from 'zod'
import {
  EMPLOYEE_SPECIFICATION_VERSION,
  employeeSpecificationSchema,
  type EmployeeSpecification,
} from './specification'

const aiToolIdSchema = z.enum([
  'gmail.read_message',
  'gmail.search_messages',
  'gmail.create_draft',
  'gmail.send_message',
  'google_sheets.read_rows',
  'google_sheets.add_row',
  'google_sheets.update_row',
  'system.request_approval',
])

const aiSpecificationSchema = z.object({
  schemaVersion: z.literal(EMPLOYEE_SPECIFICATION_VERSION),
  name: z.string().min(2).max(100),
  role: z.string().min(2).max(160),
  goal: z.string().min(5).max(2000),
  trigger: z.object({
    type: z.enum(['email_received', 'manual', 'schedule', 'webhook']),
    description: z.string().min(3).max(500),
  }),
  tools: z.array(z.object({
    id: aiToolIdSchema,
    purpose: z.string().min(3).max(500),
    required: z.boolean(),
  })).max(20),
  workflow: z.array(z.object({
    id: z.string().regex(/^[a-z0-9_]+$/).max(80),
    instruction: z.string().min(3).max(1000),
    tool: aiToolIdSchema.nullable(),
  })).min(1).max(40),
  permissions: z.array(z.object({
    capability: z.string().min(2).max(160),
    mode: z.enum(['allowed', 'approval_required', 'blocked']),
    reason: z.string().min(3).max(500),
  })).min(1).max(50),
  approvalRules: z.array(z.object({
    id: z.string().regex(/^[a-z0-9_]+$/).max(80),
    condition: z.object({
      field: z.string().min(1).max(120),
      operator: z.enum(['gt', 'gte', 'lt', 'lte', 'eq', 'neq']),
      value: z.union([z.string().max(500), z.number(), z.boolean()]),
    }),
    action: z.literal('request_human_approval'),
    reason: z.string().min(3).max(500),
  })).max(20),
  constraints: z.array(z.string().min(3).max(500)).max(30),
  successCriteria: z.array(z.string().min(3).max(500)).min(1).max(20),
})

export const employeeGenerationResultSchema = z.object({
  status: z.enum(['ready', 'needs_clarification']),
  clarificationQuestions: z.array(z.string().min(3).max(500)).max(5),
  specification: aiSpecificationSchema.nullable(),
})

export type EmployeeGenerationResult = z.infer<typeof employeeGenerationResultSchema>

export function finalizeGeneratedSpecification(
  result: EmployeeGenerationResult,
): EmployeeSpecification | null {
  if (result.status !== 'ready' || !result.specification) return null

  const normalized = {
    ...result.specification,
    workflow: result.specification.workflow.map((step) => ({
      ...step,
      ...(step.tool ? { tool: step.tool } : {}),
    })),
  }

  return employeeSpecificationSchema.parse(normalized)
}
