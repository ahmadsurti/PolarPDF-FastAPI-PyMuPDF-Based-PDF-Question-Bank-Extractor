import { type ReactNode } from 'react'
import { ThemeProvider } from '@/dashboard-shell/context/theme-provider'

// ponytail: QueryClientProvider and useAuthStore removed — Question Studio uses Zustand + IndexedDB
export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider defaultTheme="light" defaultColorTheme="polar">
      {children}
    </ThemeProvider>
  )
}

