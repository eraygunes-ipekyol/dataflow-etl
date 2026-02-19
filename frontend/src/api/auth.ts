import { api } from './client'
import type {
  ChangePasswordRequest,
  LoginRequest,
  SetActiveRequest,
  TokenResponse,
  UserCreate,
  UserInfo,
  UserResponse,
} from '@/types/auth'

export const authApi = {
  login: async (data: LoginRequest): Promise<TokenResponse> => {
    const res = await api.post<TokenResponse>('/auth/login', data)
    return res.data
  },

  me: async (): Promise<UserInfo> => {
    const res = await api.get<UserInfo>('/auth/me')
    return res.data
  },

  changePassword: async (data: ChangePasswordRequest): Promise<void> => {
    await api.post('/auth/change-password', data)
  },

  // Superadmin only
  listUsers: async (): Promise<UserResponse[]> => {
    const res = await api.get<UserResponse[]>('/auth/users')
    return res.data
  },

  createUser: async (data: UserCreate): Promise<UserResponse> => {
    const res = await api.post<UserResponse>('/auth/users', data)
    return res.data
  },

  changeUserPassword: async (userId: string, data: ChangePasswordRequest): Promise<void> => {
    await api.put(`/auth/users/${userId}/password`, data)
  },

  setUserActive: async (userId: string, data: SetActiveRequest): Promise<UserResponse> => {
    const res = await api.put<UserResponse>(`/auth/users/${userId}/active`, data)
    return res.data
  },

  deleteUser: async (userId: string): Promise<void> => {
    await api.delete(`/auth/users/${userId}`)
  },
}
