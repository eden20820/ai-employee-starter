'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Sidebar } from '@/components/sidebar'
import { saveEmployee } from './actions'
import type { EmployeeSpecification } from '@/lib/employees/specification'

const example = 'I need an employee that monitors supplier emails. When a quotation arrives, extract supplier, part number, price and lead time, add it to my purchasing sheet, and ask me for approval when the price is above ₪10,000.'

const prototypePlan: EmployeeSpecification = {
  schemaVersion: '1.0',
  name: 'Purchasing Assistant',
  role: 'Supplier Quotation Processing',
  goal: 'Process supplier quotations and keep purchasing records up to date.',
  trigger: {
    type: 'email_received',
    description: 'Run when a new supplier message matches quotation criteria.',
  },
  tools: [
    {
      id: 'gmail.read_message',
      purpose: 'Read supplier emails and quotation content.',
      required: true,
    },
    {
      id: 'google_sheets.add_row',
      purpose: 'Store extracted quotation data in the purchasing sheet.',
      required: true,
    },
  ],
  permissions: [
    {
      capability: 'gmail.read',
      mode: 'allowed',
      reason: 'The employee must read incoming supplier messages.',
    },
    {
      capability: 'google_sheets.write',
      mode: 'allowed',
      reason: 'The employee must record structured quotation data.',
    },
    {
      capability: 'gmail.send',
      mode: 'approval_required',
      reason: 'External communication must remain human-controlled in the MVP.',
    },
    {
      capability: 'gmail.delete',
      mode: 'blocked',
      reason: 'Deleting business email is outside this employee role.',
    },
  ],
  workflow: [
    {
      id: 'read_supplier_email',
      instruction: 'Read the incoming supplier email.',
      tool: 'gmail.read_message',
    },
    {
      id: 'detect_quotation',
      instruction: 'Determine whether the message contains a supplier quotation.',
    },
    {
      id: 'extract_quotation_data',
      instruction: 'Extract supplier, part number, price and lead time.',
    },
    {
      id: 'record_quotation',
      instruction: 'Add the structured quotation data to the purchasing sheet.',
      tool: 'google_sheets.add_row',
    },
    {
      id: 'evaluate_approval',
      instruction: 'Evaluate deterministic approval rules before continuing.',
    },
  ],
  approvalRules: [
    {
      id: 'high_value_quotation',
      condition: {
        field: 'quotation_value_ils',
        operator: 'gt',
        value: 10000,
      },
      action: 'request_human_approval',
      reason: 'High-value quotations require a human decision.',
    },
  ],
  constraints: [
    'Never delete supplier emails.',
    'Never send an external email without the required approval.',
    'Do not invent quotation fields that are missing from the source material.',
  ],
  successCriteria: [
    'Valid supplier quotations are captured with the available structured fields.',
    'High-value quotations are never progressed without human approval.',
  ],
}

function permissionLabel(mode: EmployeeSpecification['permissions'][number]['mode']) {
  if (mode === 'allowed') return 'Allowed'
  if (mode === 'approval_required') return 'Approval required'
  return 'Blocked'
}

export default function CreateEmployee() {
  const router = useRouter()
  const [text, setText] = useState(example)
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  function createEmployee() {
    setError('')
    startTransition(async () => {
      try {
        await saveEmployee(prototypePlan)
        router.push('/dashboard')
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not create employee')
      }
    })
  }

  return <div className="shell"><Sidebar active="create"/><main className="main create-wrap">
    <div><div className="eyebrow">Employee Builder</div><h1 className="h1">What employee do you need?</h1><p className="muted">Describe the role in normal language. The system will turn it into a structured, reviewable employee specification.</p></div>
    <div className="card promptbox"><textarea value={text} onChange={e=>setText(e.target.value)}/><div className="actions"><button className="button" onClick={()=>setShow(true)}>Generate employee plan →</button></div></div>
    {show && <div className="plan">
      <div className="card"><div className="eyebrow">Employee Specification v{prototypePlan.schemaVersion}</div><h2>{prototypePlan.name}</h2><div className="muted">{prototypePlan.role}</div><p>{prototypePlan.goal}</p></div>
      <div className="plan-grid" style={{marginTop:14}}>
        <div className="card"><div className="section-title">Trigger</div><strong>{prototypePlan.trigger.type}</strong><p className="muted">{prototypePlan.trigger.description}</p><div className="section-title">Tools</div>{prototypePlan.tools.map(tool => <span className="tag" key={tool.id}>{tool.id}</span>)}</div>
        <div className="card"><div className="section-title">Permissions</div>{prototypePlan.permissions.map(permission => <div className="permission" key={permission.capability}><span>{permission.capability}</span><span className={permission.mode === 'allowed' ? 'yes' : 'no'}>{permissionLabel(permission.mode)}</span></div>)}</div>
      </div>
      <div className="card" style={{marginTop:14}}><div className="section-title">Workflow</div><ol className="steps">{prototypePlan.workflow.map(step => <li key={step.id}>{step.instruction}</li>)}</ol></div>
      <div className="plan-grid" style={{marginTop:14}}>
        <div className="card"><div className="section-title">Approval rules</div>{prototypePlan.approvalRules.map(rule => <p key={rule.id}><strong>{rule.reason}</strong><br/><span className="muted">{rule.condition.field} {rule.condition.operator} {String(rule.condition.value)}</span></p>)}</div>
        <div className="card"><div className="section-title">Constraints</div><ul className="steps">{prototypePlan.constraints.map(item => <li key={item}>{item}</li>)}</ul><div className="section-title">Success criteria</div><ul className="steps">{prototypePlan.successCriteria.map(item => <li key={item}>{item}</li>)}</ul></div>
      </div>
      <div className="card" style={{marginTop:14}}><div className="actions"><button className="button" disabled={isPending} onClick={createEmployee}>{isPending ? 'Creating…' : 'Create employee'}</button></div>{error && <div className="tiny" style={{color:'#b91c1c'}}>{error}</div>}<div className="tiny">This plan is validated against Employee Specification v1 before it can be saved. The next milestone will generate this same structure dynamically from the user's text with AI.</div></div>
    </div>}
  </main></div>
}
