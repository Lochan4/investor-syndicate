import type { Metadata } from 'next'
import { Figtree, Instrument_Serif } from 'next/font/google'
import './globals.css'
import LoadingScreen from '@/components/LoadingScreen'
import { ToastProvider } from '@/components/Toast'
import ClientRoot from '@/components/ClientRoot'

const figtree = Figtree({
  subsets: ['latin'],
  variable: '--sans',
  display: 'swap',
  weight: ['400', '500', '600', '800'],
})

const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  variable: '--serif',
  display: 'swap',
  weight: '400',
  style: ['normal', 'italic'],
})

export const metadata: Metadata = {
  title: 'QCI Club — Early-Stage Investor Network',
  description: 'Apply once, pitch to the whole group, get a clear answer.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${figtree.variable} ${instrumentSerif.variable}`}>
      <body>
        <LoadingScreen />
        <ClientRoot>
          <ToastProvider>{children}</ToastProvider>
        </ClientRoot>
      </body>
    </html>
  )
}
