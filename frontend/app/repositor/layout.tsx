import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'App Repositor — NexusVarejo',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no',
}

export default function RepositorLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
