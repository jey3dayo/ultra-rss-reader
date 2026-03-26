"use client"

import { useState } from "react"
import { X, Settings, Moon, BookOpen, Type, Keyboard, Hand, Share2, Puzzle, Rss, Plus, ChevronRight } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import { accounts } from "@/lib/mock-data"

interface SettingsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type SettingsSection =
  | "general"
  | "appearance"
  | "reading"
  | "bionic"
  | "animations"
  | "shortcuts"
  | "gestures"
  | "actions"
  | "services"

interface SettingsNavItem {
  id: SettingsSection
  label: string
  icon: React.ReactNode
}

const navItems: SettingsNavItem[] = [
  { id: "general", label: "General", icon: <Settings className="h-5 w-5" /> },
  { id: "appearance", label: "Appearance", icon: <Moon className="h-5 w-5" /> },
  { id: "reading", label: "Reading", icon: <BookOpen className="h-5 w-5" /> },
  { id: "bionic", label: "Bionic Reading", icon: <span className="text-sm font-bold">BR</span> },
  { id: "animations", label: "Animations", icon: <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-foreground">A</span> },
  { id: "shortcuts", label: "Shortcuts", icon: <Keyboard className="h-5 w-5" /> },
  { id: "gestures", label: "Gestures", icon: <Hand className="h-5 w-5" /> },
  { id: "actions", label: "Actions and Sharing", icon: <Share2 className="h-5 w-5" /> },
  { id: "services", label: "Services", icon: <Puzzle className="h-5 w-5" /> },
]

export function SettingsModal({ open, onOpenChange }: SettingsModalProps) {
  const [activeSection, setActiveSection] = useState<SettingsSection>("general")
  const [selectedAccount, setSelectedAccount] = useState(accounts[1].id)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex h-[600px] max-w-[800px] gap-0 overflow-hidden p-0"
        showCloseButton={false}
      >
        {/* Sidebar Navigation */}
        <div className="flex w-[260px] flex-col border-r border-border bg-sidebar">
          {/* Header */}
          <DialogHeader className="flex flex-row items-center gap-3 border-b border-border px-4 py-4">
            <button
              onClick={() => onOpenChange(false)}
              className="rounded p-1 text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
            >
              <X className="h-4 w-4" />
            </button>
            <DialogTitle className="text-base font-medium">Preferences</DialogTitle>
          </DialogHeader>

          {/* Navigation */}
          <ScrollArea className="flex-1">
            <nav className="space-y-1 p-2">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                    activeSection === item.id
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  )}
                >
                  <span className="flex h-6 w-6 items-center justify-center text-muted-foreground">
                    {item.icon}
                  </span>
                  {item.label}
                </button>
              ))}
            </nav>
          </ScrollArea>

          {/* Accounts Section */}
          <div className="border-t border-border p-2">
            {accounts.map((account) => (
              <button
                key={account.id}
                onClick={() => setSelectedAccount(account.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  selectedAccount === account.id
                    ? "bg-sidebar-accent"
                    : "hover:bg-sidebar-accent/50"
                )}
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <Rss className="h-4 w-4" />
                </span>
                <div className="flex flex-col items-start">
                  <span className="font-medium">{account.name}</span>
                  <span className="text-xs text-muted-foreground">{account.email}</span>
                </div>
              </button>
            ))}
            <button className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-sidebar-accent/50">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                <Plus className="h-4 w-4" />
              </span>
              Add Account...
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex flex-1 flex-col bg-popover">
          <ScrollArea className="flex-1">
            {activeSection === "general" && <GeneralSettings />}
            {activeSection === "reading" && <ReadingSettings />}
            {activeSection === "appearance" && <AppearanceSettings />}
            {activeSection !== "general" &&
              activeSection !== "reading" &&
              activeSection !== "appearance" && (
                <div className="flex h-full items-center justify-center p-8 text-muted-foreground">
                  <p>{navItems.find((n) => n.id === activeSection)?.label} settings</p>
                </div>
              )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function GeneralSettings() {
  return (
    <div className="p-6">
      <h2 className="mb-6 text-center text-lg font-semibold">General</h2>

      {/* App Icon Section */}
      <section className="mb-6">
        <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          App Icon
        </h3>
        <SettingsRow
          label="Unread count badge"
          value="Don&apos;t display"
          type="select"
        />
      </section>

      {/* Browser Section */}
      <section className="mb-6">
        <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Browser
        </h3>
        <SettingsRow label="Open links" value="In-app browser" type="select" />
        <SettingsRow
          label="Default browser"
          value="Use system default (Arc)"
          type="select"
        />
        <SettingsRow
          label="Open links in background"
          type="switch"
          checked={false}
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Please note that some third-party browsers do not support opening links in the
          background.
        </p>
      </section>

      {/* Article List Section */}
      <section className="mb-6">
        <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Article List
        </h3>
        <SettingsRow label="Sort unread items" value="Newest first" type="select" />
        <SettingsRow label="Group by" value="Date" type="select" />
        <SettingsRow
          label="⌘-click opens in-app browser"
          type="switch"
          checked={false}
        />
      </section>

      {/* Mark All As Read Section */}
      <section>
        <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Mark All As Read
        </h3>
        <SettingsRow label="Ask before" type="switch" checked={true} />
      </section>
    </div>
  )
}

function ReadingSettings() {
  return (
    <div className="p-6">
      <h2 className="mb-6 text-center text-lg font-semibold">FreshRSS</h2>
      <p className="mb-6 text-center text-sm text-muted-foreground">jey3dayo</p>

      {/* General Section */}
      <section className="mb-6">
        <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          General
        </h3>
        <SettingsRow label="Description" value="FreshRSS" type="text" />
        <SettingsRow
          label="Server"
          value="http://jey3dayo.asuscomm.com:5556/api/greader..."
          type="text"
          truncate
        />
      </section>

      {/* Syncing Section */}
      <section className="mb-6">
        <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Syncing
        </h3>
        <SettingsRow label="Sync" value="Every hour" type="select" />
        <SettingsRow label="Sync on wake up from sleep" type="switch" checked={true} />
        <SettingsRow label="Keep read items" value="1 month" type="select" />
      </section>

      {/* Reading Section */}
      <section>
        <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Reading
        </h3>
        <SettingsRow
          label="Reader View (full-text)"
          type="navigate"
        />
        <SettingsRow label="Sort subscriptions" value="Folders first" type="select" />
        <SettingsRow label="Mark article as read" value="On open" type="select" />
        <SettingsRow label="Mark as read on scroll" type="switch" checked={false} />
      </section>
    </div>
  )
}

function AppearanceSettings() {
  return (
    <div className="p-6">
      <h2 className="mb-6 text-center text-lg font-semibold">Appearance</h2>

      <section className="mb-6">
        <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Theme
        </h3>
        <SettingsRow label="Color scheme" value="Dark" type="select" />
        <SettingsRow label="Accent color" value="Orange" type="select" />
      </section>

      <section className="mb-6">
        <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Layout
        </h3>
        <SettingsRow label="Sidebar position" value="Left" type="select" />
        <SettingsRow label="Show feed icons" type="switch" checked={true} />
        <SettingsRow label="Compact article list" type="switch" checked={false} />
      </section>

      <section>
        <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Typography
        </h3>
        <SettingsRow label="Article font" value="System" type="select" />
        <SettingsRow label="Font size" value="Medium" type="select" />
        <SettingsRow label="Line spacing" value="Comfortable" type="select" />
      </section>
    </div>
  )
}

interface SettingsRowProps {
  label: string
  value?: string
  type: "switch" | "select" | "text" | "navigate"
  checked?: boolean
  truncate?: boolean
}

function SettingsRow({ label, value, type, checked, truncate }: SettingsRowProps) {
  return (
    <div className="flex min-h-[44px] items-center justify-between border-b border-border py-3">
      <span className="text-sm text-foreground">{label}</span>
      {type === "switch" && (
        <Switch
          checked={checked}
          className="data-[state=checked]:bg-accent"
        />
      )}
      {type === "select" && (
        <span className="text-sm text-muted-foreground">{value} ▾</span>
      )}
      {type === "text" && (
        <span className={cn("text-sm text-muted-foreground", truncate && "max-w-[200px] truncate")}>
          {value}
        </span>
      )}
      {type === "navigate" && (
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      )}
    </div>
  )
}
