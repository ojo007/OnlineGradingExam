from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from typing import Any, List
from datetime import datetime


from database import get_db
from models import (
    User,
    Exam,
    Question,
    Submission,
    Result,
    UserRole,
    ExamStatus,
    QuestionType
)
from schemas import (
    SubmissionCreate,
    SubmissionResponse,
    ExamSubmission,
    ResultResponse
)
from utils import get_current_user
from grading.mcq import grade_mcq_submission
from grading.descriptive import grade_descriptive_submission

router = APIRouter()


@router.post("/single", response_model=SubmissionResponse, status_code=status.HTTP_201_CREATED)
def submit_answer(
        submission_in: SubmissionCreate,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db)
) -> Any:
    """
    Submit an answer for a single question in an exam.
    """
    # Get exam and check if it's active
    exam = db.query(Exam).filter(Exam.id == submission_in.exam_id).first()
    if not exam:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Exam not found"
        )

    if exam.status != ExamStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Exam is not active for submissions"
        )

    # Get question
    question = db.query(Question).filter(
        Question.id == submission_in.question_id,
        Question.exam_id == submission_in.exam_id
    ).first()
    if not question:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Question not found in this exam"
        )

    # Check if the student has already submitted an answer for this question
    existing_submission = db.query(Submission).filter(
        Submission.student_id == current_user.id,
        Submission.exam_id == submission_in.exam_id,
        Submission.question_id == submission_in.question_id
    ).first()

    if existing_submission:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You have already submitted an answer for this question"
        )

    # Create submission
    new_submission = Submission(
        student_id=current_user.id,
        exam_id=submission_in.exam_id,
        question_id=submission_in.question_id,
        answer=submission_in.answer,
    )

    db.add(new_submission)
    db.commit()
    db.refresh(new_submission)

    # Grade the submission based on question type
    if question.question_type in [QuestionType.MULTIPLE_CHOICE, QuestionType.TRUE_FALSE]:
        # Automatic grading for MCQ and True/False
        is_correct, points = grade_mcq_submission(question, new_submission.answer)
        new_submission.is_correct = is_correct
        new_submission.points_earned = points
        new_submission.graded_at = datetime.now()
    elif question.question_type in [QuestionType.SHORT_ANSWER, QuestionType.DESCRIPTIVE]:
        # Semi-automatic grading for short answers
        is_correct, points, feedback = grade_descriptive_submission(
            question,
            new_submission.answer
        )
        new_submission.is_correct = is_correct
        new_submission.points_earned = points
        new_submission.grading_feedback = feedback
        new_submission.graded_at = datetime.now()
    # For descriptive answers, leave grading to teachers

    db.commit()
    db.refresh(new_submission)

    return new_submission


@router.post("/exam", response_model=ResultResponse, status_code=status.HTTP_201_CREATED)
def submit_exam(
        exam_submission: ExamSubmission,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db)
) -> Any:
    """
    Submit answers for all questions in an exam and get the result.
    """
    # Get exam and check if it's active
    exam = db.query(Exam).filter(Exam.id == exam_submission.exam_id).first()
    if not exam:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Exam not found"
        )

    if exam.status != ExamStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Exam is not active for submissions"
        )

    # Check if the student has already completed this exam
    existing_result = db.query(Result).filter(
        Result.student_id == current_user.id,
        Result.exam_id == exam_submission.exam_id
    ).first()

    if existing_result:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You have already completed this exam"
        )

    # Get all questions in the exam
    exam_questions = db.query(Question).filter(Question.exam_id == exam_submission.exam_id).all()
    question_dict = {q.id: q for q in exam_questions}

    total_points_possible = sum(q.points for q in exam_questions)

    # Process each submission
    submissions = []
    points_earned = 0

    for sub in exam_submission.submissions:
        if sub.question_id not in question_dict:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Question {sub.question_id} is not in this exam"
            )

        question = question_dict[sub.question_id]

        # Create submission
        new_submission = Submission(
            student_id=current_user.id,
            exam_id=exam_submission.exam_id,
            question_id=sub.question_id,
            answer=sub.answer,
        )

        # Grade the submission based on question type
        if question.question_type in [QuestionType.MULTIPLE_CHOICE, QuestionType.TRUE_FALSE]:
            # Automatic grading for MCQ and True/False
            is_correct, points = grade_mcq_submission(question, sub.answer)
            new_submission.is_correct = is_correct
            new_submission.points_earned = points
            points_earned += points
            new_submission.graded_at = datetime.now()

        elif question.question_type == QuestionType.SHORT_ANSWER:
            # Semi-automatic grading for short answers
            is_correct, points, feedback = grade_descriptive_submission(
                question,
                sub.answer
            )
            new_submission.is_correct = is_correct
            new_submission.points_earned = points
            points_earned += points
            new_submission.grading_feedback = feedback
            new_submission.graded_at = datetime.now()

        elif question.question_type == QuestionType.DESCRIPTIVE:
            # Automatic grading for descriptive answers too
            is_correct, points, feedback = grade_descriptive_submission(question, sub.answer)
            new_submission.is_correct = is_correct
            new_submission.points_earned = points
            new_submission.grading_feedback = feedback
            new_submission.graded_at = datetime.now()

        submissions.append(new_submission)

    # Add all submissions to database
    db.add_all(submissions)
    db.commit()

    # Calculate percentage score
    percentage_score = (points_earned / total_points_possible * 100) if total_points_possible > 0 else 0

    # Create result
    result = Result(
        student_id=current_user.id,
        exam_id=exam_submission.exam_id,
        total_points=points_earned,
        percentage_score=percentage_score,
        passed=percentage_score >= exam.passing_score,
        started_at=datetime.now(),  # Ideally, this would be set when student starts the exam
        completed_at=datetime.now()
    )

    db.add(result)
    db.commit()
    db.refresh(result)

    return result


@router.get("/results/exams/{exam_id}", response_model=List[ResultResponse])
def get_exam_results(
        exam_id: int,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db)
) -> Any:
    """
    Get all results for a specific exam. Teachers and admins can see all results.
    Students can only see their own results.
    """
    # Get exam
    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Exam not found"
        )

    # Check permissions
    if current_user.role in [UserRole.TEACHER, UserRole.ADMIN]:
        # Teachers and admins can see all results
        # Use join to include student data
        results = db.query(Result).options(
            joinedload(Result.student),
            joinedload(Result.exam)
        ).filter(Result.exam_id == exam_id).all()
    else:
        # Students can only see their own results
        results = db.query(Result).options(
            joinedload(Result.exam)
        ).filter(
            Result.exam_id == exam_id,
            Result.student_id == current_user.id
        ).all()

    return results


@router.get("/results/users", response_model=List[ResultResponse])
def get_all_user_results(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Get all results across all exams. Teachers and admins can see all results.
    Students can only see their own results.
    """
    # Check permissions
    if current_user.role in [UserRole.TEACHER, UserRole.ADMIN]:
        # Teachers and admins can see all results
        results = db.query(Result).order_by(Result.created_at.desc()).all()
    else:
        # Students can only see their own results
        results = db.query(Result).filter(
            Result.student_id == current_user.id
        ).order_by(Result.created_at.desc()).all()

    return results


@router.get("/student/{exam_id}", response_model=List[SubmissionResponse])
def get_student_submissions(
        exam_id: int,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db)
) -> Any:
    """
    Get all submissions for a student in a specific exam.
    """
    # Get exam
    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Exam not found"
        )

    # Get student's submissions
    submissions = db.query(Submission).filter(
        Submission.exam_id == exam_id,
        Submission.student_id == current_user.id
    ).all()

    return submissions


@router.post("/manual-grade/{submission_id}", response_model=SubmissionResponse)
def manual_grade_submission(
        submission_id: int,
        is_correct: bool,
        points_earned: float,
        feedback: str = None,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db)
) -> Any:
    """
    Manually grade a submission. Only teachers and admins can grade submissions.
    """
    # Check permissions
    if current_user.role not in [UserRole.TEACHER, UserRole.ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to grade submissions"
        )

    # Get submission
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Submission not found"
        )

    # Update submission with grading
    submission.is_correct = is_correct
    submission.points_earned = points_earned
    submission.grading_feedback = feedback
    submission.graded_at = datetime.now()

    db.commit()
    db.refresh(submission)

    # Update result if exists
    result = db.query(Result).filter(
        Result.student_id == submission.student_id,
        Result.exam_id == submission.exam_id
    ).first()

    if result:
        # Recalculate total points
        total_points = db.query(func.sum(Submission.points_earned)).filter(
            Submission.student_id == submission.student_id,
            Submission.exam_id == submission.exam_id
        ).scalar() or 0

        # Get exam for passing score
        exam = db.query(Exam).filter(Exam.id == submission.exam_id).first()

        # Get total possible points
        total_possible = db.query(func.sum(Question.points)).filter(
            Question.exam_id == submission.exam_id
        ).scalar() or 0

        # Update result
        result.total_points = total_points
        result.percentage_score = (total_points / total_possible * 100) if total_possible > 0 else 0
        result.passed = result.percentage_score >= exam.passing_score

        db.commit()

    return submission

@router.get("/results/all", response_model=List[ResultResponse])
def get_all_results(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Get all results. Teachers and admins can see all results.
    Students can only see their own results.
    """
    # Check permissions
    if current_user.role in [UserRole.TEACHER, UserRole.ADMIN]:
        # Teachers and admins can see all results
        # Use join to include student and exam data
        results = db.query(Result).options(
            joinedload(Result.student),
            joinedload(Result.exam)
        ).all()
    else:
        # Students can only see their own results
        results = db.query(Result).options(
            joinedload(Result.exam)
        ).filter(Result.student_id == current_user.id).all()

    return results

@router.get("/results/users/{user_id}", response_model=List[ResultResponse])
def get_user_results(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Get all results for a specific user. Teachers and admins can see any user's results.
    Students can only see their own results.
    """
    # Check permissions
    if current_user.role not in [UserRole.TEACHER, UserRole.ADMIN] and current_user.id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to view these results"
        )

    # Get user's results
    results = db.query(Result).filter(Result.student_id == user_id).all()

    return results

@router.get("/results/{result_id}", response_model=ResultResponse)
def get_result(
    result_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Get a specific result by id. Teachers and admins can see any result.
    Students can only see their own results.
    """
    # Get result
    result = db.query(Result).filter(Result.id == result_id).first()
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Result not found"
        )

    # Check permissions
    if current_user.role not in [UserRole.TEACHER, UserRole.ADMIN] and result.student_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to view this result"
        )

    return result


from grading.grading_report import generate_submission_report, generate_exam_grading_report


@router.get("/report/submission/{submission_id}")
def get_submission_report(
        submission_id: int,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db)
) -> Any:
    # Check permissions
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Submission not found"
        )

    # Students can only see their own submissions
    if current_user.role == UserRole.STUDENT and submission.student_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to view this submission"
        )

    return generate_submission_report(submission_id, db)


@router.get("/report/exam/{result_id}")
def get_exam_report(
        result_id: int,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db)
) -> Any:
    # Check permissions
    result = db.query(Result).filter(Result.id == result_id).first()
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Result not found"
        )

    # Students can only see their own results
    if current_user.role == UserRole.STUDENT and result.student_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to view this result"
        )

    return generate_exam_grading_report(result_id, db)