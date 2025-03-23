from pydantic import BaseModel, EmailStr, Field, validator
from typing import List, Optional, Dict, Any, Union
from datetime import datetime
from models import UserRole, QuestionType, ExamStatus


# Base schemas
class UserBase(BaseModel):
    email: EmailStr
    username: str
    full_name: Optional[str] = None
    role: Optional[UserRole] = UserRole.STUDENT


class ExamBase(BaseModel):
    title: str
    description: Optional[str] = None
    duration_minutes: int = 60
    passing_score: float = 50.0
    is_randomized: bool = False
    status: ExamStatus = ExamStatus.DRAFT
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None


class QuestionBase(BaseModel):
    text: str
    question_type: QuestionType
    points: float = 1.0
    order: Optional[int] = None
    options: Optional[List[Dict[str, Any]]] = None
    correct_answer: Optional[str] = None

    @validator('options')
    def validate_options(cls, v, values):
        if values.get('question_type') == QuestionType.MULTIPLE_CHOICE and not v:
            raise ValueError('Multiple choice questions must have options')
        return v


class SubmissionBase(BaseModel):
    question_id: int
    answer: str


class ResultBase(BaseModel):
    student_id: int
    exam_id: int
    total_points: float
    percentage_score: float
    passed: bool
    started_at: datetime
    completed_at: datetime


# Create schemas
class UserCreate(UserBase):
    password: str

    class Config:
        json_schema_extra = {
            "example": {
                "email": "student@example.com",
                "username": "student1",
                "full_name": "Student Name",
                "password": "securepassword123",
                "role": "student"
            }
        }


class ExamCreate(ExamBase):
    pass

    class Config:
        json_schema_extra = {
            "example": {
                "title": "Introduction to Python",
                "description": "Basic concepts of Python programming",
                "duration_minutes": 60,
                "passing_score": 70.0,
                "is_randomized": True
            }
        }


class QuestionCreate(QuestionBase):
    exam_id: int

    class Config:
        json_schema_extra = {
            "example": {
                "exam_id": 1,
                "text": "What is the output of print(2 + 2)?",
                "question_type": "multiple_choice",
                "points": 2.0,
                "order": 1,
                "options": [
                    {"id": "A", "text": "4", "is_correct": True},
                    {"id": "B", "text": "2", "is_correct": False},
                    {"id": "C", "text": "22", "is_correct": False},
                    {"id": "D", "text": "Error", "is_correct": False}
                ]
            }
        }


class SubmissionCreate(SubmissionBase):
    exam_id: int

    class Config:
        json_schema_extra = {
            "example": {
                "exam_id": 1,
                "question_id": 1,
                "answer": "A"
            }
        }


# Update schemas
class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    password: Optional[str] = None
    is_active: Optional[bool] = None


class ExamUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    duration_minutes: Optional[int] = None
    passing_score: Optional[float] = None
    status: Optional[ExamStatus] = None
    is_randomized: Optional[bool] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None


class QuestionUpdate(BaseModel):
    text: Optional[str] = None
    question_type: Optional[QuestionType] = None
    points: Optional[float] = None
    order: Optional[int] = None
    options: Optional[List[Dict[str, Any]]] = None
    correct_answer: Optional[str] = None


# Response schemas
class UserResponse(UserBase):
    id: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class QuestionResponse(QuestionBase):
    id: int
    exam_id: int
    created_at: datetime

    class Config:
        orm_mode = True


class ExamResponse(ExamBase):
    id: int
    creator_id: int
    created_at: datetime
    questions: List[QuestionResponse] = []

    class Config:
        orm_mode = True


class SubmissionResponse(SubmissionBase):
    id: int
    student_id: int
    exam_id: int
    is_correct: Optional[bool] = None
    points_earned: float
    submitted_at: datetime
    graded_at: Optional[datetime] = None

    class Config:
        orm_mode = True


class ResultResponse(ResultBase):
    id: int
    created_at: datetime

    class Config:
        orm_mode = True


# Authentication schemas
class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    username: Optional[str] = None


class Login(BaseModel):
    username: str
    password: str

    class Config:
        json_schema_extra = {
            "example": {
                "username": "student1",
                "password": "securepassword123"
            }
        }


# Batch submission schema
class ExamSubmission(BaseModel):
    exam_id: int
    submissions: List[SubmissionBase]

    class Config:
        json_schema_extra = {
            "example": {
                "exam_id": 1,
                "submissions": [
                    {"question_id": 1, "answer": "A"},
                    {"question_id": 2, "answer": "B"},
                    {"question_id": 3, "answer": "Python is a programming language."}
                ]
            }
        }