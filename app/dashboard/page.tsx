import Link from 'next/link'
import { Sidebar } from '@/components/sidebar'
import { createClient } from '@/lib/supabase/server'

export default async function Dashboard() {
  const supabase = await createClient()
  const { data: employees, error } = await supabase
    .from('employees')
    .select('id,name,role,status,created_at')
    .order('created_at', { ascending: false })

  const items = employees ?? []

  return <div className="shell"><Sidebar active="workforce"/><main className="main">
    <div className="topbar"><div><div className="eyebrow">Workspace</div><h1 className="h1">Your AI Workforce</h1></div><Link className="button" href="/dashboard/create">+ Create Employee</Link></div>
    <div className="grid">
      <div className="card"><div className="muted">AI employees</div><div className="metric">{items.length}</div></div>
      <div className="card"><div className="muted">Active employees</div><div className="metric">{items.filter(e => e.status === 'active').length}</div></div>
      <div className="card"><div className="muted">Draft employees</div><div className="metric">{items.filter(e => e.status === 'draft').length}</div></div>
    </div>

    {error && <div className="card" style={{marginTop:18,color:'#b91c1c'}}>Could not load employees: {error.message}</div>}

    {!error && items.length === 0 && <div className="card" style={{marginTop:18}}>
      <div className="employee-name">Your workforce is empty</div>
      <p className="muted">Create your first AI employee. It will be stored in your organization workspace.</p>
      <Link className="button" href="/dashboard/create">Create your first employee</Link>
    </div>}

    <div className="employees">{items.map(employee => <div className="card employee" key={employee.id}>
      <div><div className="employee-name">{employee.name}</div><div className="muted">{employee.role}</div></div>
      <div className={'status ' + (employee.status === 'draft' ? 'wait' : '')}>{employee.status === 'draft' ? 'Draft' : employee.status}</div>
    </div>)}</div>
  </main></div>
}
