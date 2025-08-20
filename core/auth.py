import logging
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy import select
from sqlalchemy.orm import Session
from supabase import create_client, Client

from core.database import get_db_session
from core.environment import get_environment
from core.models.user import User

logger = logging.getLogger(__name__)
security = HTTPBearer()


class AuthenticationError(HTTPException):
    """Custom authentication error with proper HTTP status codes"""

    def __init__(self, detail: str = "Authentication failed"):
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=detail,
            headers={"WWW-Authenticate": "Bearer"},
        )


class SupabaseAuthService:
    """Production authentication service using Supabase"""

    def __init__(self):
        env = get_environment()

        self.supabase: Client = create_client(env.supabase_url, env.supabase_anon_key)
        logger.info("Supabase authentication service initialized (anon key)")

    async def verify_jwt_token(self, token: str, session: Session) -> User:
        """Verify JWT token with Supabase and return corresponding local User."""
        try:
            response = self.supabase.auth.get_user(token)

            if not response.user:
                logger.warning("Invalid JWT token provided")
                raise AuthenticationError("Invalid or expired token")

            logger.info(f"JWT token verified for user: {response.user.id}")

            # Simply fetch the user - they should already exist
            user = session.scalars(
                select(User).where(User.id == response.user.id)
            ).first()
            if not user:
                logger.error(f"User {response.user.id} not found in local database")
                raise AuthenticationError("User not found in system")

            return user

        except AuthenticationError:
            raise
        except Exception as e:
            logger.error(f"JWT verification failed: {str(e)}")
            raise AuthenticationError("Token verification failed")


# Global auth service instance
_auth_service: Optional[SupabaseAuthService] = None


def get_auth_service() -> SupabaseAuthService:
    """Get or create the global authentication service instance"""
    global _auth_service
    if _auth_service is None:
        _auth_service = SupabaseAuthService()
    return _auth_service


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    session: Session = Depends(get_db_session),
) -> User:
    """FastAPI dependency to get the current authenticated user."""
    auth_service = get_auth_service()

    try:
        user = await auth_service.verify_jwt_token(credentials.credentials, session)

        logger.debug(f"User authenticated successfully: {user.id}")
        return user

    except AuthenticationError:
        raise
    except Exception as e:
        logger.error(f"Unexpected authentication error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authentication service error",
        )


async def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(
        HTTPBearer(auto_error=False)
    ),
    session: Session = Depends(get_db_session),
) -> Optional[User]:
    """Optional authentication dependency for endpoints that work with or without auth."""
    if not credentials:
        return None

    try:
        return await get_current_user(credentials, session)
    except HTTPException:
        return None
