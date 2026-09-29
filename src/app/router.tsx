import { createRootRoute, createRoute, createRouter, Outlet } from '@tanstack/react-router'
import { QuestionStudioPage } from '@/features/question-studio/QuestionStudioPage'

// ponytail: pruned 13 dead marketplace routes and 15 orphaned imports

const rootRoute = createRootRoute({
  component: Outlet,
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: QuestionStudioPage,
})

const studioRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'studio',
  component: QuestionStudioPage,
})

const routeTree = rootRoute.addChildren([
  indexRoute,
  studioRoute,
])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

