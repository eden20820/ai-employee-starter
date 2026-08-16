import Link from 'next/link'

export function Sidebar({active}:{active:'workforce'|'create'}){
  return <aside className="sidebar">
    <div className="brand">Workforce<span>.AI</span></div>
    <nav className="nav">
      <Link className={active==='workforce'?'active':''} href="/dashboard">AI Workforce</Link>
      <Link className={active==='create'?'active':''} href="/dashboard/create">Create Employee</Link>
      <a href="#">Approvals</a><a href="#">Activity</a><a href="#">Connections</a>
    </nav>
    <div className="sidebar-foot">MVP · Email Operations Employee</div>
  </aside>
}
