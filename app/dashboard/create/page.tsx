'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Sidebar } from '@/components/sidebar'
import { advanceEmployeeInterview, saveEmployee } from './actions'
import type { EmployeeSpecification } from '@/lib/employees/specification'
import type { InterviewAnswer, InterviewQuestion, InterviewUnderstanding } from '@/lib/employees/interview'

type DraftAnswer = string | string[] | boolean | number
type UsageItem = NonNullable<Awaited<ReturnType<typeof advanceEmployeeInterview>>['usage']>

function permissionLabel(mode: EmployeeSpecification['permissions'][number]['mode']) {
  if (mode === 'allowed') return 'Allowed'
  if (mode === 'approval_required') return 'Approval required'
  return 'Blocked'
}

export default function CreateEmployee() {
  const router = useRouter()
  const [text, setText] = useState('')
  const [plan, setPlan] = useState<EmployeeSpecification | null>(null)
  const [questions, setQuestions] = useState<InterviewQuestion[]>([])
  const [understanding, setUnderstanding] = useState<InterviewUnderstanding | null>(null)
  const [answers, setAnswers] = useState<InterviewAnswer[]>([])
  const [draftAnswers, setDraftAnswers] = useState<Record<string, DraftAnswer>>({})
  const [usageEvents, setUsageEvents] = useState<UsageItem[]>([])
  const [demoMode, setDemoMode] = useState(false)
  const [error, setError] = useState('')
  const [isGenerating, startGenerating] = useTransition()
  const [isCreating, startCreating] = useTransition()

  const totalCost = usageEvents.reduce((sum, usage) => sum + usage.estimatedCostUsd, 0)
  const totalTokens = usageEvents.reduce((sum, usage) => sum + usage.inputTokens + usage.outputTokens, 0)
  const lastUsage = usageEvents.at(-1)

  function applyInterviewResult(result: Awaited<ReturnType<typeof advanceEmployeeInterview>>) {
    setDemoMode(result.demoMode)
    if (result.status === 'error') { setError(result.errorMessage || 'Could not continue employee discovery'); return }
    if (result.usage) setUsageEvents((current) => [...current, result.usage as UsageItem])
    setError(''); setUnderstanding(result.understanding); setQuestions(result.questions); setDraftAnswers({})
    if (result.status === 'ready') {
      if (!result.specification) { setError('No employee specification returned'); return }
      setPlan(result.specification)
    } else setPlan(null)
  }

  function startInterview() {
    setError(''); setPlan(null); setQuestions([]); setUnderstanding(null); setAnswers([]); setDraftAnswers({}); setUsageEvents([])
    startGenerating(async () => {
      try { applyInterviewResult(await advanceEmployeeInterview(text, [])) }
      catch (err) { setError(err instanceof Error ? err.message : 'Could not start employee discovery') }
    })
  }

  function buildRoundAnswers(): InterviewAnswer[] {
    return questions.map((question) => {
      const value = draftAnswers[question.id]
      const missing = value === undefined || value === '' || (Array.isArray(value) && value.length === 0)
      if (question.required && missing) throw new Error(`Please answer: ${question.question}`)
      let answer: DraftAnswer = value ?? ''
      if (question.type === 'number' && typeof answer === 'string' && answer !== '') {
        const numberValue = Number(answer)
        if (!Number.isFinite(numberValue)) throw new Error(`Enter a valid number for: ${question.question}`)
        answer = numberValue
      }
      if (question.type === 'boolean' && typeof answer === 'string') answer = answer === 'true'
      return { questionId: question.id, question: question.question, answer }
    })
  }

  function continueInterview() {
    setError('')
    startGenerating(async () => {
      try {
        const allAnswers = [...answers, ...buildRoundAnswers()]
        const result = await advanceEmployeeInterview(text, allAnswers)
        if (result.status !== 'error') setAnswers(allAnswers)
        applyInterviewResult(result)
      } catch (err) { setError(err instanceof Error ? err.message : 'Could not continue employee discovery') }
    })
  }

  function createEmployee() {
    if (!plan || demoMode) return
    setError('')
    startCreating(async () => {
      try { await saveEmployee(plan); router.push('/dashboard'); router.refresh() }
      catch (err) { setError(err instanceof Error ? err.message : 'Could not create employee') }
    })
  }

  function setAnswer(id: string, value: DraftAnswer) { setDraftAnswers((current) => ({ ...current, [id]: value })) }
  function toggleMultiple(questionId: string, value: string) {
    const current = Array.isArray(draftAnswers[questionId]) ? draftAnswers[questionId] as string[] : []
    setAnswer(questionId, current.includes(value) ? current.filter((item) => item !== value) : [...current, value])
  }

  function renderQuestion(question: InterviewQuestion) {
    const value = draftAnswers[question.id]
    if (question.type === 'single_choice') return <div>{question.options.map(option => <label key={option.value} style={{display:'block',margin:'8px 0'}}><input type="radio" name={question.id} checked={value === option.value} onChange={()=>setAnswer(question.id, option.value)}/> {option.label}</label>)}</div>
    if (question.type === 'multiple_choice') { const selected = Array.isArray(value) ? value : []; return <div>{question.options.map(option => <label key={option.value} style={{display:'block',margin:'8px 0'}}><input type="checkbox" checked={selected.includes(option.value)} onChange={()=>toggleMultiple(question.id, option.value)}/> {option.label}</label>)}</div> }
    if (question.type === 'boolean') return <select value={typeof value === 'boolean' ? String(value) : ''} onChange={e=>setAnswer(question.id, e.target.value)}><option value="">Select…</option><option value="true">Yes</option><option value="false">No</option></select>
    if (question.type === 'number') return <div style={{display:'flex',gap:8,alignItems:'center'}}><input type="number" value={typeof value === 'number' || typeof value === 'string' ? value : ''} onChange={e=>setAnswer(question.id, e.target.value)}/>{question.unit && <span className="muted">{question.unit}</span>}</div>
    return <textarea value={typeof value === 'string' ? value : ''} onChange={e=>setAnswer(question.id, e.target.value)} style={{minHeight:90}}/>
  }

  return <div className="shell"><Sidebar active="create"/><main className="main create-wrap">
    <div><div className="eyebrow">Employee Builder</div><h1 className="h1">What employee do you need?</h1><p className="muted">Describe the job in your own words. We’ll define the business rules first, review the employee plan, and connect the real tools afterward.</p></div>

    <div className="card" style={{marginBottom:14}}><div className="section-title">Setup</div><div style={{display:'flex',gap:10,flexWrap:'wrap'}}><span className="tag">1 · Define the job</span><span className="tag">2 · Review employee plan</span><span className="tag">3 · Connect tools</span></div><p className="muted" style={{marginBottom:0,marginTop:10}}>During discovery we ask about business behavior, permissions and exceptions — not Sheet URLs, column names or account setup.</p></div>

    {demoMode && <div className="card" style={{marginBottom:14}}><strong>Preview demo mode</strong><p className="muted" style={{marginBottom:0}}>Authentication is intentionally bypassed only for the Employee Builder in this Vercel Preview. You can test discovery and plan generation. Database persistence and tool connection remain disabled until you sign in.</p></div>}

    <div className="card promptbox"><textarea value={text} placeholder="Example: I need an employee that reviews my inbox, identifies urgent messages, organizes what needs attention, and drafts replies without sending them." onChange={e=>setText(e.target.value)} disabled={isGenerating || answers.length > 0}/><div className="actions"><button className="button" disabled={isGenerating || text.trim().length < 10} onClick={startInterview}>{isGenerating && questions.length === 0 ? 'Understanding the role…' : 'Start employee setup →'}</button></div></div>

    {usageEvents.length > 0 && <div className="card" style={{marginTop:14}}><div className="eyebrow">AI usage · development visibility</div><div style={{display:'flex',gap:24,flexWrap:'wrap'}}><div><strong>${totalCost.toFixed(6)}</strong><div className="tiny">estimated creation cost so far</div></div><div><strong>{totalTokens.toLocaleString()}</strong><div className="tiny">tokens across {usageEvents.length} AI call{usageEvents.length===1?'':'s'}</div></div><div><strong>{lastUsage?.model}</strong><div className="tiny">model used in latest round</div></div></div><div className="tiny" style={{marginTop:10}}>Cost is estimated from token usage and our configured model pricing. In authenticated mode, each event is also stored per organization for SaaS cost tracking.</div></div>}

    {error && <div className="card" style={{marginTop:14,color:'#b91c1c'}}>{error}</div>}
    {understanding && !plan && <div className="card" style={{marginTop:14}}><div className="eyebrow">What I’ve learned</div><strong>{understanding.roleSummary}</strong>{understanding.knownFacts.length > 0 && <ul className="steps">{understanding.knownFacts.map(fact => <li key={fact}>{fact}</li>)}</ul>}<div className="tiny">This summary is updated after every round. Tool-specific setup is intentionally deferred until the employee plan is approved.</div></div>}
    {questions.length > 0 && !plan && <div className="card" style={{marginTop:14}}><div className="eyebrow">Smart discovery · Define the job</div><h2>Let’s define how this employee should work</h2><p className="muted">We only ask about decisions that change the employee’s business behavior, authority or safety.</p><div style={{display:'grid',gap:20,marginTop:18}}>{questions.map((question,index)=><div key={question.id}><div className="section-title">{index+1}. {question.question}{question.required?' *':''}</div>{question.helpText&&<p className="muted">{question.helpText}</p>}{renderQuestion(question)}</div>)}</div><div className="actions" style={{marginTop:22}}><button className="button" disabled={isGenerating} onClick={continueInterview}>{isGenerating?'Analyzing answers…':'Continue →'}</button><button className="button secondary" disabled={isGenerating} onClick={startInterview}>Restart</button></div></div>}

    {plan && <div className="plan"><div className="card"><div className="eyebrow">Step 2 · Review employee plan · Specification v{plan.schemaVersion}</div><h2>{plan.name}</h2><div className="muted">{plan.role}</div><p>{plan.goal}</p><div className="tiny">Concrete Gmail accounts, Google Sheets and field mappings are configured only after this business plan is accepted.</div></div><div className="plan-grid" style={{marginTop:14}}><div className="card"><div className="section-title">Trigger</div><strong>{plan.trigger.type}</strong><p className="muted">{plan.trigger.description}</p><div className="section-title">Required tools</div>{plan.tools.map(tool=><span className="tag" key={tool.id}>{tool.id}</span>)}</div><div className="card"><div className="section-title">Permissions</div>{plan.permissions.map(permission=><div className="permission" key={permission.capability}><span>{permission.capability}</span><span className={permission.mode==='allowed'?'yes':'no'}>{permissionLabel(permission.mode)}</span></div>)}</div></div><div className="card" style={{marginTop:14}}><div className="section-title">Workflow</div><ol className="steps">{plan.workflow.map(step=><li key={step.id}>{step.instruction}</li>)}</ol></div><div className="plan-grid" style={{marginTop:14}}><div className="card"><div className="section-title">Approval rules</div>{plan.approvalRules.length===0?<p className="muted">No conditional approval rules.</p>:plan.approvalRules.map(rule=><p key={rule.id}><strong>{rule.reason}</strong><br/><span className="muted">{rule.condition.field} {rule.condition.operator} {String(rule.condition.value)}</span></p>)}</div><div className="card"><div className="section-title">Constraints</div><ul className="steps">{plan.constraints.map(item=><li key={item}>{item}</li>)}</ul><div className="section-title">Success criteria</div><ul className="steps">{plan.successCriteria.map(item=><li key={item}>{item}</li>)}</ul></div></div><div className="card" style={{marginTop:14}}><div className="section-title">Next: Connect tools</div><p className="muted">After creating the employee, the next setup phase will connect the actual Gmail and Google Sheet resources and propose mappings from the selected data.</p><div className="actions"><button className="button" disabled={isCreating||demoMode} onClick={createEmployee}>{demoMode?'Sign in later to create employee':isCreating?'Creating…':'Approve plan & create employee'}</button><button className="button secondary" disabled={isCreating} onClick={startInterview}>Restart discovery</button></div><div className="tiny">No external action is executed during employee creation.</div></div></div>}
  </main></div>
}
