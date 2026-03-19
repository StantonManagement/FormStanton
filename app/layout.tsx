import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import PageTitle from '@/components/PageTitle'
import './globals.css'
import './mobile-styles.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Tenant Onboarding Form - Stanton Management',
  description: 'Complete your tenant onboarding requirements',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <PageTitle />
        {children}
      </body>
    </html>
  )
}
