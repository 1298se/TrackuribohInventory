from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


class LoginRequest(BaseModel):
    """Request schema for user login"""

    email: EmailStr
    password: str = Field(..., min_length=1, max_length=128)


class RegisterRequest(BaseModel):
    """Request schema for user registration"""

    email: EmailStr
    password: str = Field(..., min_length=1, max_length=128)
    confirm_password: str = Field(..., min_length=1, max_length=128)


class PasswordResetRequest(BaseModel):
    """Request schema for password reset"""

    email: EmailStr


class PasswordUpdateRequest(BaseModel):
    """Request schema for password update"""

    current_password: str = Field(..., min_length=1, max_length=128)
    new_password: str = Field(..., min_length=1, max_length=128)
    confirm_new_password: str = Field(..., min_length=1, max_length=128)


class RefreshTokenRequest(BaseModel):
    """Request schema for token refresh"""

    refresh_token: str


class AuthUserResponse(BaseModel):
    """User data returned in auth responses"""

    id: UUID
    email: str
    created_at: datetime


class AuthResponse(BaseModel):
    """Standard authentication response"""

    user: AuthUserResponse
    access_token: Optional[str] = None
    refresh_token: Optional[str] = None
    token_type: str = "bearer"
    expires_in: Optional[int] = None


class MessageResponse(BaseModel):
    """Generic message response"""

    message: str
    success: bool = True


class ErrorResponse(BaseModel):
    """Error response schema"""

    detail: str
    error_code: Optional[str] = None
    success: bool = False


class CreateUserRequest(BaseModel):
    """Request schema for creating a user in local database"""

    id: UUID
    email: EmailStr


class CreateUserResponse(BaseModel):
    """Response schema for user creation"""

    user: str  # "created" or "exist"
