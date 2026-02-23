import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { authApi } from '@/api/auth'
import { useAuthStore } from '@/stores/authStore'
import type {
  ChangePasswordRequest,
  LoginRequest,
  SetActiveRequest,
  UserCreate,
} from '@/types/auth'

export function useLogin() {
  const navigate = useNavigate()
  const login = useAuthStore((s) => s.login)

  return useMutation({
    mutationFn: (data: LoginRequest) => authApi.login(data),
    onSuccess: (data) => {
      login(data.access_token, data.user, data.must_change_password)
      navigate('/')
      toast.success(`Hoş geldiniz, ${data.user.username}!`)
    },
    onError: () => {
      toast.error('Kullanıcı adı veya şifre hatalı')
    },
  })
}

export function useLogout() {
  const navigate = useNavigate()
  const logout = useAuthStore((s) => s.logout)
  const queryClient = useQueryClient()

  return () => {
    logout()
    queryClient.clear()
    navigate('/login')
    toast.success('Çıkış yapıldı')
  }
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (data: ChangePasswordRequest) => authApi.changePassword(data),
    onSuccess: () => {
      toast.success('Şifre başarıyla değiştirildi')
    },
    onError: (err: { response?: { data?: { detail?: string } } }) => {
      toast.error(err.response?.data?.detail || 'Şifre değiştirilemedi')
    },
  })
}

export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: () => authApi.listUsers(),
  })
}

export function useCreateUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: UserCreate) => authApi.createUser(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success('Kullanıcı oluşturuldu')
    },
    onError: (err: { response?: { data?: { detail?: string } } }) => {
      toast.error(err.response?.data?.detail || 'Kullanıcı oluşturulamadı')
    },
  })
}

export function useChangeUserPassword() {
  return useMutation({
    mutationFn: ({ userId, data }: { userId: string; data: ChangePasswordRequest }) =>
      authApi.changeUserPassword(userId, data),
    onSuccess: () => {
      toast.success('Kullanıcı şifresi güncellendi')
    },
    onError: (err: { response?: { data?: { detail?: string } } }) => {
      toast.error(err.response?.data?.detail || 'Şifre güncellenemedi')
    },
  })
}

export function useSetUserActive() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, data }: { userId: string; data: SetActiveRequest }) =>
      authApi.setUserActive(userId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success('Kullanıcı durumu güncellendi')
    },
    onError: () => {
      toast.error('Kullanıcı durumu güncellenemedi')
    },
  })
}

export function useDeleteUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (userId: string) => authApi.deleteUser(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success('Kullanıcı silindi')
    },
    onError: () => {
      toast.error('Kullanıcı silinemedi')
    },
  })
}
