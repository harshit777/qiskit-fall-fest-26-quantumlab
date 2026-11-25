import type { Metadata } from 'next'
import './globals.css'
import { LangProvider } from '@/lib/i18n'

export const metadata: Metadata = {
  title: 'QuantumLab | Sus in Binary',
  description: 'Learn superposition, entanglement and Grover search in English and Hindi. Change a gate, watch the measurement histogram update live.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <LangProvider>{children}</LangProvider>
      </body>
    </html>
  )
}
