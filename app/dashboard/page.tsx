import Link from 'next/link'
import { Sidebar } from '@/components/sidebar'

const employees=[
  {name:'Daniel',role:'Sales Assistant',tasks:18,status:'Working'},
  {name:'Maya',role:'Customer Support',tasks:31,status:'Waiting for approval',wait:true},
  {name:'Alex',role:'Operations Assistant',tasks:7,status:'Working'},
]

export default function Dashboard(){return <div className="shell"><Sidebar active="workforce"/><main className="main">
  <div className="topbar"><div><div className="eyebrow">Workspace</div><h1 className="h1">Your AI Workforce</h1></div><Link className="button" href="/dashboard/create">+ Create Employee</Link></div>
  <div className="grid">
    <div className="card"><div className="muted">Active employees</div><div className="metric">3</div></div>
    <div className="card"><div className="muted">Tasks completed today</div><div className="metric">56</div></div>
    <div className="card"><div className="muted">Pending approvals</div><div className="metric">3</div></div>
  </div>
  <div className="employees">{employees.map(e=><div className="card employee" key={e.name}><div><div className="employee-name">{e.name}</div><div className="muted">{e.role} · {e.tasks} tasks today</div></div><div className={'status '+(e.wait?'wait':'')}>{e.status}</div></div>)}</div>
</main></div>}
