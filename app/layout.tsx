import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Workforce AI',
  description: 'Describe the employee you need. Put them to work.'
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>
}
