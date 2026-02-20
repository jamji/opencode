import { TextAttributes } from "@opentui/core"
import { For, Show, createSignal, onCleanup, onMount, createMemo } from "solid-js"
import { useTheme } from "@tui/context/theme"
import { useDialog } from "@tui/ui/dialog"
import { useTerminalDimensions } from "@opentui/solid"
import { Database } from "bun:sqlite"
import { homedir } from "os"
import { join } from "path"
import { existsSync } from "fs"

interface SwarmTask {
  id: string
  agent: string
  prompt: string
  status: string
  tmux_session: string | null
  tmux_pid: number | null
  started_at: number | null
  completed_at: number | null
  error_message: string | null
  retry_count: number
  created_at: number
}

function getDbPath(): string | null {
  const paths = [
    join(process.cwd(), ".opencode", "swarm", "swarm.db"),
    join(homedir(), ".config", "opencode", "swarm", "swarm.db"),
  ]
  for (const p of paths) {
    if (existsSync(p)) return p
  }
  return null
}

function readTasks(): SwarmTask[] {
  const dbPath = getDbPath()
  if (!dbPath) return []
  try {
    const db = new Database(dbPath, { readonly: true })
    const rows = db.query("SELECT * FROM delegations ORDER BY created_at DESC LIMIT 20").all() as SwarmTask[]
    db.close()
    return rows
  } catch {
    return []
  }
}

function formatDuration(ms: number): string {
  const secs = Math.floor(ms / 1000)
  const mins = Math.floor(secs / 60)
  const hours = Math.floor(mins / 60)
  if (hours > 0) return `${hours}h ${mins % 60}m`
  if (mins > 0) return `${mins}m ${secs % 60}s`
  return `${secs}s`
}

export function DialogSwarm() {
  const { theme } = useTheme()
  const dialog = useDialog()
  const term = useTerminalDimensions()
  const [activeTab, setActiveTab] = createSignal(0)
  
  const tabs = ["All", "Running", "Completed", "Failed"]
  
  onMount(() => {
    const interval = setInterval(() => {}, 2000)
    onCleanup(() => clearInterval(interval))
  })
  
  const tasks = createMemo(() => readTasks())
  const runningTasks = createMemo(() => tasks().filter(t => t.status === "running"))
  const completedTasks = createMemo(() => tasks().filter(t => t.status === "complete"))
  const failedTasks = createMemo(() => tasks().filter(t => t.status === "error"))
  
  const summary = createMemo(() => ({
    running: runningTasks().length,
    complete: completedTasks().length,
    failed: failedTasks().length,
    total: tasks().length
  }))
  
  const getTasksForTab = (tab: number) => {
    switch (tab) {
      case 1: return runningTasks()
      case 2: return completedTasks()
      case 3: return failedTasks()
      default: return tasks()
    }
  }

  const getTaskIcon = (status: string) => {
    return status === "running" ? "●" : status === "complete" ? "✓" : "✗"
  }
  
  const getTaskColor = (status: string) => {
    return status === "running" ? theme.warning : status === "complete" ? theme.success : theme.error
  }

  const getTabBg = (idx: number) => {
    return activeTab() === idx ? theme.primary : "transparent"
  }

  const getTabFg = (idx: number) => {
    return activeTab() === idx ? theme.selectedListItemText : theme.textMuted
  }

  const getTabAttr = (idx: number) => {
    return activeTab() === idx ? [TextAttributes.BOLD] : []
  }
  
  return (
    <box paddingLeft={2} paddingRight={2} gap={1}>
      {/* Header */}
      <box flexDirection="row" justifyContent="space-between">
        <text attributes={TextAttributes.BOLD} fg={theme.text}>Swarm Dashboard</text>
        <text fg={theme.textMuted} onMouseUp={() => dialog.clear()}>esc</text>
      </box>
      
      {/* Summary */}
      <box flexDirection="row" gap={2}>
        <text fg={theme.text}>●</text>
        <text fg={theme.warning}>{String(summary().running)} running</text>
        <text fg={theme.success}>✓ {String(summary().complete)} complete</text>
        <text fg={theme.error}>✗ {String(summary().failed)} failed</text>
        <text fg={theme.textMuted}>• {String(summary().total)} total</text>
      </box>
      
      {/* Tabs */}
      <box flexDirection="row" gap={1}>
        <box paddingLeft={1} paddingRight={1} backgroundColor={getTabBg(0)} onMouseUp={() => setActiveTab(0)}>
          <text fg={getTabFg(0)} attributes={getTabAttr(0)}>All</text>
        </box>
        <box paddingLeft={1} paddingRight={1} backgroundColor={getTabBg(1)} onMouseUp={() => setActiveTab(1)}>
          <text fg={getTabFg(1)} attributes={getTabAttr(1)}>Running</text>
        </box>
        <box paddingLeft={1} paddingRight={1} backgroundColor={getTabBg(2)} onMouseUp={() => setActiveTab(2)}>
          <text fg={getTabFg(2)} attributes={getTabAttr(2)}>Completed</text>
        </box>
        <box paddingLeft={1} paddingRight={1} backgroundColor={getTabBg(3)} onMouseUp={() => setActiveTab(3)}>
          <text fg={getTabFg(3)} attributes={getTabAttr(3)}>Failed</text>
        </box>
      </box>
      
      {/* Content */}
      <scrollbox height={Math.floor(term().height * 0.5)}>
        <Show when={getTasksForTab(activeTab()).length > 0} fallback={<text fg={theme.textMuted}>No tasks</text>}>
          <For each={getTasksForTab(activeTab())}>
            {(task) => (
              <box flexDirection="row" gap={1} paddingTop={1}>
                <text fg={getTaskColor(task.status)}>{getTaskIcon(task.status)}</text>
                <text><text attributes={TextAttributes.BOLD}>{task.id}</text><text> </text><text fg={theme.textMuted}>{task.agent}</text></text>
              </box>
            )}
          </For>
        </Show>
      </scrollbox>
      
      {/* Footer */}
      <box flexDirection="row" justifyContent="space-between" paddingTop={1}>
        <text fg={theme.textMuted}>(click tabs to filter)</text>
        <text fg={theme.textMuted}>esc to close</text>
      </box>
    </box>
  )
}
