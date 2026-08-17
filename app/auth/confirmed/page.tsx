import Link from 'next/link'

export default function ConfirmedPage() {
  return (
    <main className="main" style={{ maxWidth: 560, margin: '0 auto', paddingTop: 80 }}>
      <div className="card">
        <div className="eyebrow">AI Employee</div>
        <h1 className="h1">Email confirmed</h1>
        <p className="muted">
          Your account is verified. You can return to the device where you signed up and sign in.
        </p>
        <div style={{ marginTop: 24 }}>
          <Link className="button" href="/login">Go to sign in</Link>
        </div>
      </div>
    </main>
  )
}
