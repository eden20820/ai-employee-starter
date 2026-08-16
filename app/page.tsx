import Link from 'next/link'

export default function Home() {
  return <main className="hero">
    <div className="eyebrow">AI WORKFORCE PLATFORM</div>
    <h1>Describe the employee.<br/>Put them to work.</h1>
    <p>Turn a plain-language job description into an AI employee with tools, permissions, approval rules and an auditable workflow.</p>
    <div className="hero-actions">
      <Link className="button" href="/dashboard/create">Create an AI employee</Link>
      <Link className="button secondary" href="/dashboard">View workforce</Link>
    </div>
    <div className="card demo">
      <div className="section-title">Example request</div>
      <div className="demo-input">“Monitor supplier emails. When a quotation arrives, extract supplier, part number, price and lead time, add it to my purchasing sheet, and ask for approval when the quote is above ₪10,000.”</div>
    </div>
  </main>
}
