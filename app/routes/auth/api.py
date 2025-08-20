import logging

from fastapi import APIRouter, Depends, HTTPException, status, Response, Request

from core.auth import get_current_user
from core.models.user import User
from core.environment import get_environment, Env

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

REFRESH_COOKIE_NAME = "refresh_token"
REFRESH_COOKIE_PATH = "/auth"


@router.post("/login", response_model=AuthResponse)
async def login(
    login_data: LoginRequest,
    response: Response,
    env=Depends(get_environment),
    auth_service: AuthService = Depends(get_auth_service),
):
    """Authenticate user and return access tokens"""
    logger.info(f"Login attempt for email: {login_data.email}")

    auth_response = await auth_service.login_user(login_data.email, login_data.password)

    # Set HttpOnly refresh token cookie
    if auth_response.refresh_token:
        is_prod = env.env == Env.PROD
        response.set_cookie(
            key=REFRESH_COOKIE_NAME,
            value=auth_response.refresh_token,
            httponly=True,
            secure=True if is_prod else False,
            samesite="none" if is_prod else "lax",
            path=REFRESH_COOKIE_PATH,
            max_age=60 * 60 * 24 * 7,
        )

    logger.info(f"User logged in successfully: {login_data.email}")
    return auth_response


@router.post("/logout", response_model=MessageResponse)
async def logout(response: Response, current_user: User = Depends(get_current_user)):
    """Logout current user and invalidate session"""
    logger.info(f"Logout request for user: {current_user.email}")

    # Note: Token invalidation can be implemented later if needed
    logger.info(f"User logged out: {current_user.email}")
    # Clear refresh cookie
    response.delete_cookie(key=REFRESH_COOKIE_NAME, path=REFRESH_COOKIE_PATH)
    return MessageResponse(message="Logged out successfully")


@router.post("/refresh", response_model=AuthResponse)
async def refresh_token(
    request: Request,
    response: Response,
    refresh_data: RefreshTokenRequest | None = None,
    env=Depends(get_environment),
    auth_service: AuthService = Depends(get_auth_service),
):
    """Refresh access token using refresh token"""
    logger.info("Token refresh request")
    # Prefer cookie; fallback to body for backward compatibility
    cookie_rt = request.cookies.get(REFRESH_COOKIE_NAME)
    body_rt = refresh_data.refresh_token if refresh_data else None
    refresh_token_value = cookie_rt or body_rt
    if not refresh_token_value:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="No refresh token"
        )

    auth_response = await auth_service.refresh_token(refresh_token_value)

    # Rotate refresh cookie if a new token was issued
    if auth_response.refresh_token:
        is_prod = env.env == Env.PROD
        response.set_cookie(
            key=REFRESH_COOKIE_NAME,
            value=auth_response.refresh_token,
            httponly=True,
            secure=True if is_prod else False,
            samesite="none" if is_prod else "lax",
            path=REFRESH_COOKIE_PATH,
            max_age=60 * 60 * 24 * 7,
        )

    logger.info("Token refreshed successfully")
    return auth_response


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


@router.get("/me", response_model=AuthUserResponse)
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    """Get current authenticated user information"""
    return AuthUserResponse(
        id=current_user.id,
        email=current_user.email,
        created_at=current_user.created_at,
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
