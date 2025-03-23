from fastapi import APIRouter, Depends, HTTPException, status, Response
from sqlalchemy.orm import Session
from typing import Any, List

from database import get_db
from models import User, UserRole
from schemas import UserResponse, UserUpdate
from utils import get_current_user, get_password_hash, check_admin_privileges

router = APIRouter()


@router.get("/", response_model=List[UserResponse])
def get_users(
        skip: int = 0,
        limit: int = 100,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db)
) -> Any:
    """
    Retrieve users. Only admins can access this endpoint.
    """
    # Check if user is admin
    check_admin_privileges(current_user)

    # Get users
    users = db.query(User).offset(skip).limit(limit).all()
    return users


@router.get("/{user_id}", response_model=UserResponse)
def get_user(
        user_id: int,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db)
) -> Any:
    """
    Get a specific user by id. Admin users can access any user.
    Normal users can only access their own user information.
    """
    # Check if user is admin or the requested user is the current user
    if current_user.role != UserRole.ADMIN and current_user.id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only access your own user information"
        )

    # Get user
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    return user


@router.put("/{user_id}", response_model=UserResponse)
def update_user(
        user_id: int,
        user_in: UserUpdate,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db)
) -> Any:
    """
    Update a user. Admin users can update any user.
    Normal users can only update their own user information.
    """
    # Check if user is admin or the requested user is the current user
    if current_user.role != UserRole.ADMIN and current_user.id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only update your own user information"
        )

    # Get user
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Update user fields
    update_data = user_in.dict(exclude_unset=True)

    # Hash password if it's being updated
    if "password" in update_data:
        hashed_password = get_password_hash(update_data["password"])
        update_data["hashed_password"] = hashed_password
        del update_data["password"]

    # Only admins can change user status
    if "is_active" in update_data and current_user.role != UserRole.ADMIN:
        del update_data["is_active"]

    # Update user
    for key, value in update_data.items():
        setattr(user, key, value)

    db.commit()
    db.refresh(user)

    return user


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
        user_id: int,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db)
):
    """
    Delete a user. Only admins can delete users.
    """
    # Check if user is admin
    check_admin_privileges(current_user)

    # Get user
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Delete user
    db.delete(user)
    db.commit()

    return Response(status_code=status.HTTP_204_NO_CONTENT)