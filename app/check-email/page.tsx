import Link from 'next/link'

export default async function CheckEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>
}) {
  const { email } = await searchParams

  return (
    <main className="main" style={{ maxWidth: 560, margin: '0 auto', paddingTop: 80 }}>
      <div className="card">
        <div className="eyebrow">AI Employee</div>
        <h1 className="h1">Check your email</h1>
        <p className="muted">
          We sent a confirmation link{email ? ` to ${email}` : ''}. Open it on any device to verify your account.
        </p>
        <p className="muted" style={{ marginTop: 12 }}>
          After confirming, you can return here and sign in from this device.
        </p>
        <div style={{ marginTop: 24 }}>
          <Link className="button" href="/login">Back to sign in</Link>
        </div>
      </div>
    </main>
  )
}
