from fastapi import APIRouter, Depends, HTTPException, status, Response
from sqlalchemy.orm import Session
from typing import Any, List

from database import get_db
from models import User, Exam, Question, UserRole, ExamStatus
from schemas import (
    ExamCreate,
    ExamUpdate,
    ExamResponse,
    QuestionCreate,
    QuestionUpdate,
    QuestionResponse
)
from utils import get_current_user, check_teacher_privileges

router = APIRouter()


# Exam routes
@router.post("/", response_model=ExamResponse, status_code=status.HTTP_201_CREATED)
def create_exam(
        exam_in: ExamCreate,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db)
) -> Any:
    """
    Create a new exam. Only teachers and admins can create exams.
    """
    # Check if user is teacher or admin
    check_teacher_privileges(current_user)

    # Create exam
    db_exam = Exam(**exam_in.dict(), creator_id=current_user.id)
    db.add(db_exam)
    db.commit()
    db.refresh(db_exam)

    return db_exam


@router.get("/", response_model=List[ExamResponse])
def get_exams(
        skip: int = 0,
        limit: int = 100,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db)
) -> Any:
    """
    Retrieve exams. Teachers and admins can see all exams.
    Students can only see published and active exams.
    """
    # Different queries based on user role
    if current_user.role in [UserRole.TEACHER, UserRole.ADMIN]:
        exams = db.query(Exam).offset(skip).limit(limit).all()
    else:
        exams = db.query(Exam).filter(
            Exam.status.in_([ExamStatus.PUBLISHED, ExamStatus.ACTIVE])
        ).offset(skip).limit(limit).all()

    return exams


@router.get("/{exam_id}", response_model=ExamResponse)
def get_exam(
        exam_id: int,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db)
) -> Any:
    """
    Get a specific exam by id.
    """
    # Get exam
    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Exam not found"
        )

    # Check permissions based on role and exam status
    if current_user.role not in [UserRole.TEACHER, UserRole.ADMIN]:
        if exam.status not in [ExamStatus.PUBLISHED, ExamStatus.ACTIVE]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to access this exam"
            )

    return exam


@router.put("/{exam_id}", response_model=ExamResponse)
def update_exam(
        exam_id: int,
        exam_in: ExamUpdate,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db)
) -> Any:
    """
    Update an exam. Only teachers who created the exam and admins can update exams.
    """
    # Get exam
    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Exam not found"
        )

    # Check permissions
    if current_user.role != UserRole.ADMIN and exam.creator_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to update this exam"
        )

    # Update exam
    update_data = exam_in.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(exam, key, value)

    db.commit()
    db.refresh(exam)

    return exam


@router.delete("/{exam_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_exam(
        exam_id: int,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db)
):
    """
    Delete an exam. Only teachers who created the exam and admins can delete exams.
    """
    # Get exam
    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Exam not found"
        )

    # Check permissions
    if current_user.role != UserRole.ADMIN and exam.creator_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to delete this exam"
        )

    # Delete exam (will cascade delete questions)
    db.delete(exam)
    db.commit()

    return Response(status_code=status.HTTP_204_NO_CONTENT)


# Question routes
@router.post("/questions/", response_model=QuestionResponse, status_code=status.HTTP_201_CREATED)
def create_question(
        question_in: QuestionCreate,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db)
) -> Any:
    """
    Create a new question for an exam.
    """
    # Get exam
    exam = db.query(Exam).filter(Exam.id == question_in.exam_id).first()
    if not exam:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Exam not found"
        )

    # Check permissions
    if current_user.role != UserRole.ADMIN and exam.creator_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to add questions to this exam"
        )

    # Create question
    db_question = Question(**question_in.dict())
    db.add(db_question)
    db.commit()
    db.refresh(db_question)

    return db_question


@router.put("/questions/{question_id}", response_model=QuestionResponse)
def update_question(
        question_id: int,
        question_in: QuestionUpdate,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db)
) -> Any:
    """
    Update a question.
    """
    # Get question
    question = db.query(Question).filter(Question.id == question_id).first()
    if not question:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Question not found"
        )

    # Get exam to check permissions
    exam = db.query(Exam).filter(Exam.id == question.exam_id).first()

    # Check permissions
    if current_user.role != UserRole.ADMIN and exam.creator_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to update questions in this exam"
        )

    # Update question
    update_data = question_in.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(question, key, value)

    db.commit()
    db.refresh(question)

    return question


@router.delete("/questions/{question_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_question(
        question_id: int,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db)
):
    """
    Delete a question.
    """
    # Get question
    question = db.query(Question).filter(Question.id == question_id).first()
    if not question:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Question not found"
        )

    # Get exam to check permissions
    exam = db.query(Exam).filter(Exam.id == question.exam_id).first()

    # Check permissions
    if current_user.role != UserRole.ADMIN and exam.creator_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to delete questions in this exam"
        )

    # Delete question
    db.delete(question)
    db.commit()

    return Response(status_code=status.HTTP_204_NO_CONTENT)

@router.get("/{exam_id}/questions", response_model=List[QuestionResponse])
def get_exam_questions(
        exam_id: int,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db)
) -> Any:
    """
    Get all questions for a specific exam.
    """
    # Get exam
    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Exam not found"
        )

    # Check permissions based on role and exam status
    if current_user.role not in [UserRole.TEACHER, UserRole.ADMIN]:
        if exam.status not in [ExamStatus.PUBLISHED, ExamStatus.ACTIVE]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to access this exam's questions"
            )

    # Get questions
    questions = db.query(Question).filter(Question.exam_id == exam_id).all()
    return questions

@router.get("/questions/{question_id}", response_model=QuestionResponse)
def get_question(
    question_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Get a specific question by id.
    """
    # Get question
    question = db.query(Question).filter(Question.id == question_id).first()
    if not question:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Question not found"
        )

    # Get exam to check permissions
    exam = db.query(Exam).filter(Exam.id == question.exam_id).first()

    # Check permissions based on role
    if current_user.role not in [UserRole.TEACHER, UserRole.ADMIN] and exam.creator_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to access this question"
        )

    return question