'use client'
import { useState } from 'react'
import { Sidebar } from '@/components/sidebar'

const example='I need an employee that monitors supplier emails. When a quotation arrives, extract supplier, part number, price and lead time, add it to my purchasing sheet, and ask me for approval when the price is above ₪10,000.'

export default function CreateEmployee(){
  const [text,setText]=useState(example); const [show,setShow]=useState(false)
  return <div className="shell"><Sidebar active="create"/><main className="main create-wrap">
    <div><div className="eyebrow">Employee Builder</div><h1 className="h1">What employee do you need?</h1><p className="muted">Describe the role in normal language. The system will turn it into an executable employee plan.</p></div>
    <div className="card promptbox"><textarea value={text} onChange={e=>setText(e.target.value)}/><div className="actions"><button className="button" onClick={()=>setShow(true)}>Generate employee plan →</button></div></div>
    {show && <div className="plan">
      <div className="card"><div className="eyebrow">Generated employee</div><h2>Purchasing Assistant</h2><div className="muted">Processes supplier quotations and keeps purchasing records up to date.</div></div>
      <div className="plan-grid" style={{marginTop:14}}>
        <div className="card"><div className="section-title">Trigger</div><strong>New supplier email</strong><p className="muted">Run when a new message matches quotation / supplier criteria.</p><div className="section-title">Tools</div><span className="tag">Gmail</span><span className="tag">Google Sheets</span></div>
        <div className="card"><div className="section-title">Permissions</div><div className="permission"><span>Read Gmail</span><span className="yes">Allowed</span></div><div className="permission"><span>Update Sheets</span><span className="yes">Allowed</span></div><div className="permission"><span>Send email</span><span className="no">Approval required</span></div><div className="permission"><span>Delete email</span><span className="no">Blocked</span></div></div>
      </div>
      <div className="card" style={{marginTop:14}}><div className="section-title">Workflow</div><ol className="steps"><li>Read the incoming supplier email.</li><li>Decide whether it contains a quotation.</li><li>Extract supplier, part number, price and lead time.</li><li>Add the structured data to the purchasing sheet.</li><li>If price is above ₪10,000, create an approval request.</li><li>Continue only after the required approval.</li></ol><div className="actions"><button className="button">Create employee</button></div><div className="tiny">Prototype: this button is intentionally not connected yet. Next step is persistence + AI-generated specs.</div></div>
    </div>}
  </main></div>
}
