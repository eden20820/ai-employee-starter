import { z } from 'zod'

export const EMPLOYEE_SPECIFICATION_VERSION = '1.0' as const

export const permissionModeSchema = z.enum([
  'allowed',
  'approval_required',
  'blocked',
])

export const triggerSchema = z
  .object({
    type: z.enum(['email_received', 'manual', 'schedule', 'webhook']),
    description: z.string().trim().min(3).max(500),
  })
  .strict()

export const toolRequirementSchema = z
  .object({
    id: z.string().trim().min(2).max(120),
    purpose: z.string().trim().min(3).max(500),
    required: z.boolean().default(true),
  })
  .strict()

export const permissionSchema = z
  .object({
    capability: z.string().trim().min(2).max(160),
    mode: permissionModeSchema,
    reason: z.string().trim().min(3).max(500),
  })
  .strict()

export const workflowStepSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9_]+$/).max(80),
    instruction: z.string().trim().min(3).max(1000),
    tool: z.string().trim().min(2).max(120).optional(),
  })
  .strict()

export const approvalRuleSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9_]+$/).max(80),
    condition: z
      .object({
        field: z.string().trim().min(1).max(120),
        operator: z.enum(['gt', 'gte', 'lt', 'lte', 'eq', 'neq']),
        value: z.union([z.string().max(500), z.number(), z.boolean()]),
      })
      .strict(),
    action: z.literal('request_human_approval'),
    reason: z.string().trim().min(3).max(500),
  })
  .strict()

export const employeeSpecificationSchema = z
  .object({
    schemaVersion: z.literal(EMPLOYEE_SPECIFICATION_VERSION),
    name: z.string().trim().min(2).max(100),
    role: z.string().trim().min(2).max(160),
    goal: z.string().trim().min(5).max(2000),
    trigger: triggerSchema,
    tools: z.array(toolRequirementSchema).max(20),
    workflow: z.array(workflowStepSchema).min(1).max(40),
    permissions: z.array(permissionSchema).min(1).max(50),
    approvalRules: z.array(approvalRuleSchema).max(20),
    constraints: z.array(z.string().trim().min(3).max(500)).max(30),
    successCriteria: z.array(z.string().trim().min(3).max(500)).min(1).max(20),
  })
  .strict()
  .superRefine((specification, context) => {
    const toolIds = new Set(specification.tools.map((tool) => tool.id))

    for (const step of specification.workflow) {
      if (step.tool && !toolIds.has(step.tool)) {
        context.addIssue({
          code: 'custom',
          path: ['workflow', specification.workflow.indexOf(step), 'tool'],
          message: `Workflow references undeclared tool: ${step.tool}`,
        })
      }
    }

    const workflowIds = specification.workflow.map((step) => step.id)
    if (new Set(workflowIds).size !== workflowIds.length) {
      context.addIssue({
        code: 'custom',
        path: ['workflow'],
        message: 'Workflow step IDs must be unique',
      })
    }

    const approvalIds = specification.approvalRules.map((rule) => rule.id)
    if (new Set(approvalIds).size !== approvalIds.length) {
      context.addIssue({
        code: 'custom',
        path: ['approvalRules'],
        message: 'Approval rule IDs must be unique',
      })
    }
  })

export type EmployeeSpecification = z.infer<typeof employeeSpecificationSchema>
export type PermissionMode = z.infer<typeof permissionModeSchema>

export function parseEmployeeSpecification(input: unknown): EmployeeSpecification {
  return employeeSpecificationSchema.parse(input)
}
