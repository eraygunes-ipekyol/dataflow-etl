export interface UserInfo {
  id: string
  username: string
  role: 'superadmin' | 'user'
  email?: string | null
}

export interface LoginRequest {
  username: string
  password: string
}

export interface TokenResponse {
  access_token: string
  token_type: string
  user: UserInfo
}

export interface UserCreate {
  username: string
  password: string
  role: 'superadmin' | 'user'
  email?: string
}

export interface UserResponse {
  id: string
  username: string
  role: 'superadmin' | 'user'
  email?: string | null
  is_active: boolean
  created_at: string
}

export interface ChangePasswordRequest {
  current_password?: string
  new_password: string
  confirm_password: string
}

export interface SetActiveRequest {
  is_active: boolean
}
