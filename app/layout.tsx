import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import './mobile-styles.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Tenant Onboarding Form - Stanton Management',
  description: 'Complete your tenant onboarding requirements',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  )
}
