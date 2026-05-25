import type { Metadata } from 'next'
import { Analytics } from '@vercel/analytics/next'
import { I18nProvider } from '@/lib/i18n'
import './globals.css'

export const metadata: Metadata = {
  title: 'BehaviourAI Platform',
  description: 'Real-time ecommerce behaviour analytics and AI insight platform',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <I18nProvider>{children}</I18nProvider>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
