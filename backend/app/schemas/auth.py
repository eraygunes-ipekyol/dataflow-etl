from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, model_validator


class LoginRequest(BaseModel):
    username: str
    password: str


class UserInfo(BaseModel):
    id: str
    username: str
    role: str
    email: Optional[str] = None

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserInfo
    must_change_password: bool = False


class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=6)
    role: str = Field(default="user")
    email: Optional[str] = None


class UserResponse(BaseModel):
    id: str
    username: str
    role: str
    email: Optional[str] = None
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class ChangePasswordRequest(BaseModel):
    current_password: Optional[str] = None
    new_password: str = Field(..., min_length=6)
    confirm_password: str

    @model_validator(mode="after")
    def passwords_match(self) -> "ChangePasswordRequest":
        if self.new_password != self.confirm_password:
            raise ValueError("Yeni şifreler eşleşmiyor")
        return self


class ForceChangePasswordRequest(BaseModel):
    new_password: str = Field(..., min_length=6)
    confirm_password: str

    @model_validator(mode="after")
    def passwords_match(self) -> "ForceChangePasswordRequest":
        if self.new_password != self.confirm_password:
            raise ValueError("Yeni şifreler eşleşmiyor")
        return self


class SetActiveRequest(BaseModel):
    is_active: bool
