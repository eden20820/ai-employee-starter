import { signIn, signUp } from './actions'

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string }> }) {
  const params = await searchParams
  return (
    <main className="main" style={{ maxWidth: 520, margin: '0 auto', paddingTop: 80 }}>
      <div className="card">
        <div className="eyebrow">AI Employee</div>
        <h1 className="h1">Sign in to your workforce</h1>
        <p className="muted">Create and manage AI employees inside your organization workspace.</p>
        {params.error && <p style={{ color: '#b91c1c' }}>{params.error}</p>}
        {params.message && <p style={{ color: '#166534' }}>{params.message}</p>}
        <form style={{ display: 'grid', gap: 12, marginTop: 24 }}>
          <input name="email" type="email" placeholder="you@company.com" required style={{ padding: 14, borderRadius: 12, border: '1px solid #dbe3ef' }} />
          <input name="password" type="password" placeholder="Password" minLength={8} required style={{ padding: 14, borderRadius: 12, border: '1px solid #dbe3ef' }} />
          <button className="button" formAction={signIn}>Sign in</button>
          <button className="button" formAction={signUp} style={{ background: '#eef2ff', color: '#1e3a8a' }}>Create account</button>
        </form>
      </div>
    </main>
  )
}
