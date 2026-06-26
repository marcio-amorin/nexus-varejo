import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'PDV — NexusVarejo',
}

export default function PDVLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
