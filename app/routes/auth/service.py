import logging
from typing import Optional

from fastapi import HTTPException, status
from supabase import Client, create_client

from core.environment import get_environment

from .schemas import AuthResponse, AuthUserResponse, MessageResponse

logger = logging.getLogger(__name__)


class AuthService:
    """Service for handling authentication operations with Supabase"""

    def __init__(self):
        env = get_environment()

        self.supabase: Client = create_client(env.supabase_url, env.supabase_anon_key)
        logger.info("Authentication service initialized with Supabase (anon key)")

    async def login_user(self, email: str, password: str) -> AuthResponse:
        """Authenticate user with Supabase Auth"""
        try:
            response = self.supabase.auth.sign_in_with_password(
                {"email": email, "password": password}
            )

            if not response.user or not response.session:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid email or password",
                )

            logger.info(f"User logged in successfully: {response.user.email}")

            return AuthResponse(
                user=AuthUserResponse(
                    id=response.user.id,
                    email=response.user.email,
                    created_at=response.user.created_at,
                ),
                access_token=response.session.access_token,
                refresh_token=response.session.refresh_token,
                expires_in=response.session.expires_in,
            )

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Login failed for {email}: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password",
            )

    async def logout_user(self, jwt_token: str) -> MessageResponse:
        """Logout user and invalidate session"""
        try:
            self.supabase.auth.set_session(jwt_token, None)
            self.supabase.auth.sign_out()
            logger.info("User logged out successfully")
        except Exception as e:
            logger.error(f"Logout failed: {str(e)}")
            # Don't fail logout - just log the error

        return MessageResponse(message="Logged out successfully")

    async def refresh_token(self, refresh_token: str) -> AuthResponse:
        """Refresh user's access token"""
        try:
            response = self.supabase.auth.refresh_session(refresh_token)

            if not response.session or not response.user:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid refresh token",
                )

            logger.info(f"Token refreshed for user: {response.user.email}")

            return AuthResponse(
                user=AuthUserResponse(
                    id=response.user.id,
                    email=response.user.email,
                    created_at=response.user.created_at,
                ),
                access_token=response.session.access_token,
                refresh_token=response.session.refresh_token,
                expires_in=response.session.expires_in,
            )

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Token refresh failed: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="Token refresh failed"
            )

    async def reset_password(self, email: str) -> MessageResponse:
        """Send password reset email"""
        try:
            self.supabase.auth.reset_password_email(email)
            logger.info(f"Password reset email sent to: {email}")
            return MessageResponse(
                message="Password reset email sent. Please check your inbox."
            )
        except Exception as e:
            logger.error(f"Password reset failed for {email}: {str(e)}")
            # Don't reveal if email exists or not for security
            return MessageResponse(
                message="If an account with this email exists, a password reset email has been sent."
            )


# Global service instance
_auth_service: Optional[AuthService] = None


def get_auth_service() -> AuthService:
    """Get or create the global authentication service instance"""
    global _auth_service
    if _auth_service is None:
        _auth_service = AuthService()
    return _auth_service
