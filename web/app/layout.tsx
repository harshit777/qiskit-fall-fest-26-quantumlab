import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'QuantumLab | Sus in Binary',
  description: 'Learn superposition, entanglement and Grover search in English and Hindi. Change a gate, watch the measurement histogram update live.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
