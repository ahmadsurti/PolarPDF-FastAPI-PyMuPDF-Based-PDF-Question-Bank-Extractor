import * as React from 'react'
import { RouterProvider } from '@tanstack/react-router'
import { Providers } from './app/providers'
import { router } from './app/router'
import { OnboardingScreen } from './components/OnboardingScreen'

export function App() {
  // ponytail: lazy 1-line check with native localStorage — no extra store, zero flash
  const [isOnboarded, setIsOnboarded] = React.useState<boolean>(() => {
    try {
      return localStorage.getItem('polarpdf_onboarded') === 'true'
    } catch {
      return true
    }
  })

  const handleComplete = React.useCallback(() => {
    try {
      localStorage.setItem('polarpdf_onboarded', 'true')
    } catch {
      // ignore
    }
    setIsOnboarded(true)
  }, [])

  if (!isOnboarded) {
    return <OnboardingScreen onComplete={handleComplete} />
  }

  return (
    <Providers>
      <RouterProvider router={router} />
    </Providers>
  )
}

export default App
