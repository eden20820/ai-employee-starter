'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Sidebar } from '@/components/sidebar'
import { saveEmployee, type EmployeePlan } from './actions'

const example = 'I need an employee that monitors supplier emails. When a quotation arrives, extract supplier, part number, price and lead time, add it to my purchasing sheet, and ask me for approval when the price is above ₪10,000.'

const prototypePlan: EmployeePlan = {
  name: 'Purchasing Assistant',
  role: 'Supplier Quotation Processing',
  goal: 'Process supplier quotations and keep purchasing records up to date.',
  trigger: { type: 'new_email', description: 'Run when a new supplier message matches quotation criteria.' },
  tools: ['gmail.read', 'google_sheets.write'],
  permissions: {
    read_email: 'allowed',
    update_sheet: 'allowed',
    send_email: 'approval_required',
    delete_email: 'blocked',
  },
  workflow: [
    'Read the incoming supplier email.',
    'Decide whether it contains a quotation.',
    'Extract supplier, part number, price and lead time.',
    'Add the structured data to the purchasing sheet.',
    'If price is above ₪10,000, create an approval request.',
    'Continue only after the required approval.',
  ],
  approval_rules: [{ condition: 'quotation_value > 10000 ILS', action: 'request_human_approval' }],
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
    <div><div className="eyebrow">Employee Builder</div><h1 className="h1">What employee do you need?</h1><p className="muted">Describe the role in normal language. The system will turn it into an executable employee plan.</p></div>
    <div className="card promptbox"><textarea value={text} onChange={e=>setText(e.target.value)}/><div className="actions"><button className="button" onClick={()=>setShow(true)}>Generate employee plan →</button></div></div>
    {show && <div className="plan">
      <div className="card"><div className="eyebrow">Generated employee</div><h2>{prototypePlan.name}</h2><div className="muted">{prototypePlan.goal}</div></div>
      <div className="plan-grid" style={{marginTop:14}}>
        <div className="card"><div className="section-title">Trigger</div><strong>New supplier email</strong><p className="muted">{prototypePlan.trigger.description}</p><div className="section-title">Tools</div><span className="tag">Gmail</span><span className="tag">Google Sheets</span></div>
        <div className="card"><div className="section-title">Permissions</div><div className="permission"><span>Read Gmail</span><span className="yes">Allowed</span></div><div className="permission"><span>Update Sheets</span><span className="yes">Allowed</span></div><div className="permission"><span>Send email</span><span className="no">Approval required</span></div><div className="permission"><span>Delete email</span><span className="no">Blocked</span></div></div>
      </div>
      <div className="card" style={{marginTop:14}}><div className="section-title">Workflow</div><ol className="steps">{prototypePlan.workflow.map(step => <li key={step}>{step}</li>)}</ol><div className="actions"><button className="button" disabled={isPending} onClick={createEmployee}>{isPending ? 'Creating…' : 'Create employee'}</button></div>{error && <div className="tiny" style={{color:'#b91c1c'}}>{error}</div>}<div className="tiny">Stage 2: this plan is now persisted in Supabase. Stage 3 will generate it dynamically from your text with AI.</div></div>
    </div>}
  </main></div>
}
