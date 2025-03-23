"""
Utility functions for the Online Exam System.
"""
from datetime import datetime, timedelta
from typing import Any, Dict, Optional, Union
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from config import settings
from database import get_db
from models import User, UserRole

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# OAuth2 token handling
oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/auth/login/form")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a password against its hash.
    """
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """
    Generate password hash.
    """
    return pwd_context.hash(password)


def create_access_token(
        data: Dict[str, Any], expires_delta: Optional[timedelta] = None
) -> str:
    """
    Create a JWT access token.
    """
    to_encode = data.copy()

    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )

    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(
        to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM
    )
    return encoded_jwt


async def get_current_user(
        token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)
) -> User:
    """
    Get the current authenticated user from JWT token.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        # Decode JWT token
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
        username: str = payload.get("sub")

        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    # Get user from database
    user = db.query(User).filter(User.username == username).first()

    if user is None:
        raise credentials_exception

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user"
        )

    return user


def check_admin_privileges(user: User) -> None:
    """
    Check if a user has admin privileges.
    Raises an HTTPException if the user is not an admin.
    """
    if user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can perform this action"
        )


def check_teacher_privileges(user: User) -> None:
    """
    Check if a user has teacher or admin privileges.
    Raises an HTTPException if the user is not a teacher or admin.
    """
    if user.role not in [UserRole.TEACHER, UserRole.ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only teachers and administrators can perform this action"
        )


def validate_password(password: str) -> bool:
    """
    Validate password strength.

    Requirements:
    - At least 8 characters
    - Contains at least one uppercase letter
    - Contains at least one lowercase letter
    - Contains at least one digit
    """
    if len(password) < 8:
        return False

    # Check for uppercase
    if not any(c.isupper() for c in password):
        return False

    # Check for lowercase
    if not any(c.islower() for c in password):
        return False

    # Check for digits
    if not any(c.isdigit() for c in password):
        return False

    return True


def generate_random_password(length: int = 12) -> str:
    """
    Generate a random secure password.
    """
    import secrets
    import string

    alphabet = string.ascii_letters + string.digits
    # Ensure we have at least one uppercase, one lowercase, and one digit
    while True:
        password = ''.join(secrets.choice(alphabet) for _ in range(length))
        if validate_password(password):
            return password


def format_datetime(dt: datetime) -> str:
    """
    Format a datetime object to string.
    """
    return dt.strftime("%Y-%m-%d %H:%M:%S") if dt else ""


def calculate_exam_duration(start_time: datetime, end_time: datetime) -> int:
    """
    Calculate the duration of an exam in minutes.
    """
    if not start_time or not end_time:
        return 0

    duration = (end_time - start_time).total_seconds() / 60
    return int(duration)