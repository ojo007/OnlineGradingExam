from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, Text, Float, DateTime, Enum, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from datetime import datetime

from database import Base

# Enums for model fields
class UserRole(str, enum.Enum):
    STUDENT = "student"
    TEACHER = "teacher"
    ADMIN = "admin"

class QuestionType(str, enum.Enum):
    MULTIPLE_CHOICE = "multiple_choice"
    TRUE_FALSE = "true_false"
    SHORT_ANSWER = "short_answer"
    DESCRIPTIVE = "descriptive"

class ExamStatus(str, enum.Enum):
    DRAFT = "draft"
    PUBLISHED = "published"
    ACTIVE = "active"
    COMPLETED = "completed"
    ARCHIVED = "archived"

# User model
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    username = Column(String(50), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(100))
    role = Column(Enum(UserRole), default=UserRole.STUDENT)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    # Relationships
    exams_created = relationship("Exam", back_populates="creator")
    submissions = relationship("Submission", back_populates="student")
    results = relationship("Result", back_populates="student")

# Exam model
class Exam(Base):
    __tablename__ = "exams"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text)
    creator_id = Column(Integer, ForeignKey("users.id"))
    duration_minutes = Column(Integer, default=60)
    passing_score = Column(Float, default=50.0)
    status = Column(Enum(ExamStatus), default=ExamStatus.DRAFT)
    is_randomized = Column(Boolean, default=False)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    start_time = Column(DateTime, nullable=True)
    end_time = Column(DateTime, nullable=True)

    # Relationships
    creator = relationship("User", back_populates="exams_created")
    questions = relationship("Question", back_populates="exam", cascade="all, delete-orphan")
    submissions = relationship("Submission", back_populates="exam", cascade="all, delete-orphan")
    results = relationship("Result", back_populates="exam", cascade="all, delete-orphan")

# Question model
class Question(Base):
    __tablename__ = "questions"

    id = Column(Integer, primary_key=True, index=True)
    exam_id = Column(Integer, ForeignKey("exams.id"))
    text = Column(Text, nullable=False)
    question_type = Column(Enum(QuestionType))
    points = Column(Float, default=1.0)
    order = Column(Integer)
    options = Column(JSON, nullable=True)  # For multiple choice: [{"id": "A", "text": "Option A", "is_correct": true}, ...]
    correct_answer = Column(Text, nullable=True)  # For non-multiple choice questions
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    # Relationships
    exam = relationship("Exam", back_populates="questions")
    submissions = relationship("Submission", back_populates="question")

# Submission model
class Submission(Base):
    __tablename__ = "submissions"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("users.id"))
    exam_id = Column(Integer, ForeignKey("exams.id"))
    question_id = Column(Integer, ForeignKey("questions.id"))
    answer = Column(Text)
    is_correct = Column(Boolean, nullable=True)
    points_earned = Column(Float, default=0.0)
    submitted_at = Column(DateTime, default=func.now())
    graded_at = Column(DateTime, nullable=True)
    grading_feedback = Column(Text, nullable=True)

    # Relationships
    student = relationship("User", back_populates="submissions")
    exam = relationship("Exam", back_populates="submissions")
    question = relationship("Question", back_populates="submissions")

# Result model
class Result(Base):
    __tablename__ = "results"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("users.id"))
    exam_id = Column(Integer, ForeignKey("exams.id"))
    total_points = Column(Float)
    percentage_score = Column(Float)
    passed = Column(Boolean)
    started_at = Column(DateTime)
    completed_at = Column(DateTime)
    created_at = Column(DateTime, default=func.now())

    # Relationships
    student = relationship("User", back_populates="results")
    exam = relationship("Exam", back_populates="results")