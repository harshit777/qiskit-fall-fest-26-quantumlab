import type { Metadata } from 'next'
import { CodeLab } from '@/components/code-lab'

export const metadata: Metadata = { title: 'Code | QuantumLab' }

export default function Page() {
  return <CodeLab />
}
