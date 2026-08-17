'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Sidebar } from '@/components/sidebar'
import { generateEmployeePlan, saveEmployee } from './actions'
import type { EmployeeSpecification } from '@/lib/employees/specification'

const example = 'I need an employee that monitors supplier emails. When a quotation arrives, extract supplier, part number, price and lead time, add it to my purchasing sheet, and ask me for approval when the price is above ₪10,000.'

function permissionLabel(mode: EmployeeSpecification['permissions'][number]['mode']) {
  if (mode === 'allowed') return 'Allowed'
  if (mode === 'approval_required') return 'Approval required'
  return 'Blocked'
}

export default function CreateEmployee() {
  const router = useRouter()
  const [text, setText] = useState(example)
  const [plan, setPlan] = useState<EmployeeSpecification | null>(null)
  const [questions, setQuestions] = useState<string[]>([])
  const [error, setError] = useState('')
  const [isGenerating, startGenerating] = useTransition()
  const [isCreating, startCreating] = useTransition()

  function generatePlan() {
    setError('')
    setPlan(null)
    setQuestions([])

    startGenerating(async () => {
      try {
        const result = await generateEmployeePlan(text)
        if (result.status === 'needs_clarification') {
          setQuestions(result.clarificationQuestions)
          return
        }
        if (!result.specification) throw new Error('No employee plan returned')
        setPlan(result.specification)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not generate employee plan')
      }
    })
  }

  function createEmployee() {
    if (!plan) return
    setError('')

    startCreating(async () => {
      try {
        await saveEmployee(plan)
        router.push('/dashboard')
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not create employee')
      }
    })
  }

  return <div className="shell"><Sidebar active="create"/><main className="main create-wrap">
    <div><div className="eyebrow">Employee Builder</div><h1 className="h1">What employee do you need?</h1><p className="muted">Describe the job in normal language. AI Employee will turn it into a structured plan for you to review before anything is deployed.</p></div>

    <div className="card promptbox">
      <textarea value={text} onChange={e=>setText(e.target.value)} disabled={isGenerating}/>
      <div className="actions"><button className="button" disabled={isGenerating || text.trim().length < 10} onClick={generatePlan}>{isGenerating ? 'Designing employee…' : 'Generate employee plan →'}</button></div>
    </div>

    {error && <div className="card" style={{marginTop:14,color:'#b91c1c'}}>{error}</div>}

    {questions.length > 0 && <div className="card" style={{marginTop:14}}>
      <div className="eyebrow">A few details are missing</div>
      <h2>Before I create the employee plan</h2>
      <ol className="steps">{questions.map(question => <li key={question}>{question}</li>)}</ol>
      <p className="muted">Add the answers to your description above and generate the plan again.</p>
    </div>}

    {plan && <div className="plan">
      <div className="card"><div className="eyebrow">Employee Specification v{plan.schemaVersion}</div><h2>{plan.name}</h2><div className="muted">{plan.role}</div><p>{plan.goal}</p></div>

      <div className="plan-grid" style={{marginTop:14}}>
        <div className="card"><div className="section-title">Trigger</div><strong>{plan.trigger.type}</strong><p className="muted">{plan.trigger.description}</p><div className="section-title">Tools</div>{plan.tools.map(tool => <span className="tag" key={tool.id}>{tool.id}</span>)}</div>
        <div className="card"><div className="section-title">Permissions</div>{plan.permissions.map(permission => <div className="permission" key={permission.capability}><span>{permission.capability}</span><span className={permission.mode === 'allowed' ? 'yes' : 'no'}>{permissionLabel(permission.mode)}</span></div>)}</div>
      </div>

      <div className="card" style={{marginTop:14}}><div className="section-title">Workflow</div><ol className="steps">{plan.workflow.map(step => <li key={step.id}>{step.instruction}</li>)}</ol></div>

      <div className="plan-grid" style={{marginTop:14}}>
        <div className="card"><div className="section-title">Approval rules</div>{plan.approvalRules.length === 0 ? <p className="muted">No conditional approval rules were requested.</p> : plan.approvalRules.map(rule => <p key={rule.id}><strong>{rule.reason}</strong><br/><span className="muted">{rule.condition.field} {rule.condition.operator} {String(rule.condition.value)}</span></p>)}</div>
        <div className="card"><div className="section-title">Constraints</div><ul className="steps">{plan.constraints.map(item => <li key={item}>{item}</li>)}</ul><div className="section-title">Success criteria</div><ul className="steps">{plan.successCriteria.map(item => <li key={item}>{item}</li>)}</ul></div>
      </div>

      <div className="card" style={{marginTop:14}}>
        <div className="actions"><button className="button" disabled={isCreating} onClick={createEmployee}>{isCreating ? 'Creating…' : 'Create employee'}</button><button className="button secondary" disabled={isCreating} onClick={()=>setPlan(null)}>Edit description</button></div>
        <div className="tiny">The AI-generated plan has already passed structured-output parsing and Employee Specification v1 validation. Creating the employee stores this reviewed version; it does not execute external actions yet.</div>
      </div>
    </div>}
  </main></div>
}
