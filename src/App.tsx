import * as React from 'react'
import { RouterProvider } from '@tanstack/react-router'
import { Providers } from './app/providers'
import { router } from './app/router'
import { OnboardingScreen } from './components/OnboardingScreen'

export function App() {
  // ponytail: 1-line check with native localStorage + ?onboarding dev override
  const [isOnboarded, setIsOnboarded] = React.useState<boolean>(() => {
    try {
      if (typeof window !== 'undefined' && window.location.search.includes('onboarding')) {
        return false
      }
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
    if (typeof window !== 'undefined' && window.location.search.includes('onboarding')) {
      const url = new URL(window.location.href)
      url.searchParams.delete('onboarding')
      window.history.replaceState({}, '', url.pathname + (url.search ? url.search : ''))
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
