import { create } from 'zustand'

export type ThemeMode = 'dark' | 'light' | 'system'

interface UIState {
  sidebarOpen: boolean
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void

  theme: ThemeMode
  setTheme: (theme: ThemeMode) => void
}

function applyTheme(theme: ThemeMode) {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const isDark = theme === 'dark' || (theme === 'system' && prefersDark)
  if (isDark) {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
  localStorage.setItem('theme', theme)
}

const storedTheme = (localStorage.getItem('theme') as ThemeMode | null) ?? 'dark'

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  theme: storedTheme,
  setTheme: (theme) => {
    applyTheme(theme)
    set({ theme })
  },
}))
