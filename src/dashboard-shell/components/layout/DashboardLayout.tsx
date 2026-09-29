import * as React from "react"
import { getCookie } from "../../lib/cookies"
import { cn } from "../../lib/utils"
import { LayoutProvider, useLayout } from "../../context/layout-provider"
import { SidebarInset, SidebarProvider } from "../ui/sidebar"
import { DashboardSidebar, type DashboardSidebarProps } from "./DashboardSidebar"
import { DashboardHeader, type DashboardHeaderProps } from "./DashboardHeader"

import { ScrollArea } from "../ui/scroll-area"

export interface DashboardLayoutProps {
  /** Props passed through to the sidebar */
  sidebarProps?: DashboardSidebarProps
  /** Props passed through to the header */
  headerProps?: DashboardHeaderProps
  /** The main content of the dashboard */
  children: React.ReactNode
  /** Optional layout mode: 'fixed' (viewport height, internal scrolling) or 'fluid' (document scrolling) */
  contentLayout?: "fixed" | "fluid"
  /** Custom className for the content container */
  contentClassName?: string
  /** Floating overlay pinned inside the main content area (e.g. action bars, selection toasts) */
  footerOverlay?: React.ReactNode
}

function InnerLayout({
  sidebarProps = {},
  headerProps = {},
  children,
  contentLayout = "fixed",
  contentClassName,
  footerOverlay,
}: DashboardLayoutProps) {
  const { variant } = useLayout()
  const defaultOpen = getCookie("sidebar_state") !== "false"

  return (
    <SidebarProvider defaultOpen={defaultOpen} className="h-svh max-h-svh overflow-hidden">
      {/* Sidebar with Brand, Items, Resizing Rail, and User Menu */}
      <DashboardSidebar {...sidebarProps} />

      {/* Main Workspace Inset Area */}
      <SidebarInset
        className={cn(
          "@container/content flex flex-1 flex-col overflow-hidden min-h-0",
          variant === "inset"
            ? "md:h-[calc(100svh-1rem)] md:max-h-[calc(100svh-1rem)]"
            : "h-svh max-h-svh",
        )}
      >
        {/* Sticky Header with SidebarTrigger, Title, Actions, Theme Toggle, Config Drawer */}
        <DashboardHeader {...headerProps} />

        {/* Dynamic Page Content Slot with Contained ScrollArea */}
        <main
          data-layout={contentLayout}
          className="flex flex-1 flex-col min-h-0 overflow-hidden relative"
        >
          {contentLayout === "fluid" ? (
            <ScrollArea className="h-full w-full">
              <div className={cn(contentClassName)}>
                {children}
              </div>
            </ScrollArea>
          ) : (
            <div className={cn("flex flex-1 flex-col overflow-hidden", contentClassName)}>
              {children}
            </div>
          )}
        </main>
      </SidebarInset>

      {/* Floating Viewport Overlays (unclipped by SidebarInset/main) */}
      {footerOverlay}
    </SidebarProvider>
  )
}

/**
 * Universal Dashboard Shell Wrapper.
 * Provides LayoutProvider & SidebarProvider.
 * Wrap your app or dashboard route with this component.
 */
export function DashboardLayout(props: DashboardLayoutProps) {
  return (
    <LayoutProvider>
      <InnerLayout {...props} />
    </LayoutProvider>
  )
}
