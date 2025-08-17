import logging

from fastapi import APIRouter, Depends, HTTPException, status

from core.auth import get_current_user
from core.models.user import User

from .schemas import (
    AuthResponse,
    AuthUserResponse,
    ErrorResponse,
    LoginRequest,
    MessageResponse,
    PasswordResetRequest,
    RefreshTokenRequest,
)
from .service import AuthService, get_auth_service

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/auth",
    tags=["authentication"],
    responses={
        400: {"model": ErrorResponse, "description": "Bad Request"},
        401: {"model": ErrorResponse, "description": "Unauthorized"},
        422: {"model": ErrorResponse, "description": "Validation Error"},
    },
)


@router.post("/login", response_model=AuthResponse)
async def login(
    login_data: LoginRequest, auth_service: AuthService = Depends(get_auth_service)
):
    """Authenticate user and return access tokens"""
    logger.info(f"Login attempt for email: {login_data.email}")

    response = await auth_service.login_user(login_data.email, login_data.password)

    logger.info(f"User logged in successfully: {login_data.email}")
    return response


@router.post("/logout", response_model=MessageResponse)
async def logout(current_user: User = Depends(get_current_user)):
    """Logout current user and invalidate session"""
    logger.info(f"Logout request for user: {current_user.email}")

    # Note: Token invalidation can be implemented later if needed
    logger.info(f"User logged out: {current_user.email}")
    return MessageResponse(message="Logged out successfully")


@router.post("/refresh", response_model=AuthResponse)
async def refresh_token(
    refresh_data: RefreshTokenRequest,
    auth_service: AuthService = Depends(get_auth_service),
):
    """Refresh access token using refresh token"""
    logger.info("Token refresh request")
    response = await auth_service.refresh_token(refresh_data.refresh_token)
    logger.info("Token refreshed successfully")
    return response


@router.post("/reset-password", response_model=MessageResponse)
async def reset_password(
    reset_data: PasswordResetRequest,
    auth_service: AuthService = Depends(get_auth_service),
):
    """Send password reset email"""
    logger.info(f"Password reset request for: {reset_data.email}")
    response = await auth_service.reset_password(reset_data.email)
    logger.info(f"Password reset email sent to: {reset_data.email}")
    return response


@router.get("/me", response_model=AuthResponse)
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    """Get current authenticated user information"""
    return AuthResponse(
        user=AuthUserResponse(
            id=current_user.id,
            email=current_user.email,
            created_at=current_user.created_at.isoformat(),
        )
    )


@router.get("/health")
async def health_check():
    """Health check endpoint for authentication service"""
    try:
        get_auth_service()
        return {
            "status": "healthy",
            "service": "authentication",
            "supabase_configured": True,
        }
    except Exception as e:
        logger.error(f"Authentication service health check failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service is not properly configured",
        )
