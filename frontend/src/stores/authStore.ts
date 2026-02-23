import { create } from 'zustand'
import type { UserInfo } from '@/types/auth'

const TOKEN_KEY = 'auth_token'
const USER_KEY = 'auth_user'

interface AuthState {
  token: string | null
  user: UserInfo | null
  isAuthenticated: boolean
  mustChangePassword: boolean
  login: (token: string, user: UserInfo, mustChangePassword?: boolean) => void
  logout: () => void
  updateUser: (user: UserInfo) => void
  clearMustChangePassword: () => void
}

function loadToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

function loadUser(): UserInfo | null {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? (JSON.parse(raw) as UserInfo) : null
  } catch {
    return null
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  token: loadToken(),
  user: loadUser(),
  isAuthenticated: !!loadToken(),
  mustChangePassword: false,

  login: (token, user, mustChangePassword = false) => {
    localStorage.setItem(TOKEN_KEY, token)
    localStorage.setItem(USER_KEY, JSON.stringify(user))
    set({ token, user, isAuthenticated: true, mustChangePassword })
  },

  logout: () => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    set({ token: null, user: null, isAuthenticated: false, mustChangePassword: false })
  },

  updateUser: (user) => {
    localStorage.setItem(USER_KEY, JSON.stringify(user))
    set({ user })
  },

  clearMustChangePassword: () => {
    set({ mustChangePassword: false })
  },
}))
