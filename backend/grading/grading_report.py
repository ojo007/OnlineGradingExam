"""
Grading report generator - Add this to your grading module or create a new file.
This provides detailed reporting on how answers are graded.
"""
import json
import logging
from typing import Dict, List, Any, Optional
from sqlalchemy.orm import Session

from models import Submission, Question, Result, QuestionType, Exam
from grading.descriptive import (
    grade_descriptive_submission,
    basic_clean_text,
    basic_keyword_match,
    nlp_clean_text,
    get_semantic_similarity,
    NLP_AVAILABLE,
    TRANSFORMERS_AVAILABLE
)
from grading.mcq import grade_mcq_submission

logger = logging.getLogger("grading_report")


def generate_submission_report(submission_id: int, db: Session) -> Dict[str, Any]:
    """
    Generate a detailed report for a specific submission showing how it was graded.

    Args:
        submission_id: ID of the submission
        db: Database session

    Returns:
        Dictionary with detailed grading information
    """
    # Fetch the submission
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission:
        return {"error": "Submission not found"}

    # Fetch the associated question
    question = db.query(Question).filter(Question.id == submission.question_id).first()
    if not question:
        return {"error": "Question not found"}

    # Initialize report
    report = {
        "submission_id": submission_id,
        "question_id": question.id,
        "question_text": question.text,
        "question_type": question.question_type,
        "student_answer": submission.answer,
        "correct_answer": question.correct_answer,
        "points_earned": submission.points_earned,
        "max_points": question.points,
        "percentage": round((submission.points_earned / question.points) * 100, 1) if question.points else 0,
        "is_correct": submission.is_correct,
        "graded_at": submission.graded_at.isoformat() if submission.graded_at else None,
        "grading_feedback": submission.grading_feedback,
        "grading_details": {}
    }

    # Add detailed grading information based on question type
    if question.question_type == QuestionType.MULTIPLE_CHOICE or question.question_type == QuestionType.TRUE_FALSE:
        # For MCQ, we just need to show if the selected option was correct
        if question.question_type == QuestionType.MULTIPLE_CHOICE:
            # Get the options
            options = question.options if question.options else []
            correct_options = [opt.get('id') for opt in options if opt.get('is_correct')]

            report["grading_details"] = {
                "correct_options": correct_options,
                "selected_option": submission.answer,
                "is_correct": submission.is_correct
            }
        else:
            # True/False
            report["grading_details"] = {
                "correct_answer": question.correct_answer,
                "student_answer": submission.answer,
                "is_correct": submission.is_correct
            }

    elif question.question_type == QuestionType.SHORT_ANSWER or question.question_type == QuestionType.DESCRIPTIVE:
        # For short answers and descriptive, calculate all the scores again to show details
        try:
            # Basic text cleaning
            submitted_clean = basic_clean_text(submission.answer)
            correct_clean = basic_clean_text(question.correct_answer)

            # Basic scores
            keyword_score = basic_keyword_match(correct_clean, submitted_clean)
            from difflib import SequenceMatcher
            string_similarity = SequenceMatcher(None, correct_clean, submitted_clean).ratio()

            # NLP scores if available
            nlp_keyword_score = None
            semantic_score = None

            if NLP_AVAILABLE:
                submitted_nlp = nlp_clean_text(submission.answer)
                correct_nlp = nlp_clean_text(question.correct_answer)

                from grading.descriptive import nlp_keyword_match
                nlp_keyword_score = nlp_keyword_match(correct_nlp, submitted_nlp)

            if TRANSFORMERS_AVAILABLE:
                semantic_score = get_semantic_similarity(question.correct_answer, submission.answer)

            # Calculate combined score based on available components
            if TRANSFORMERS_AVAILABLE and NLP_AVAILABLE:
                combined_score = (
                        nlp_keyword_score * 0.4 +
                        semantic_score * 0.5 +
                        string_similarity * 0.1
                )
                method = "Full NLP with transformers"
            elif NLP_AVAILABLE:
                combined_score = nlp_keyword_score * 0.7 + string_similarity * 0.3
                method = "NLP without transformers"
            else:
                combined_score = keyword_score * 0.6 + string_similarity * 0.4
                method = "Basic text matching"

            # Store all scores in the report
            report["grading_details"] = {
                "method": method,
                "combined_score": round(combined_score, 4),
                "basic_keyword_score": round(keyword_score, 4),
                "string_similarity": round(string_similarity, 4),
                "nlp_keyword_score": round(nlp_keyword_score, 4) if nlp_keyword_score is not None else None,
                "semantic_score": round(semantic_score, 4) if semantic_score is not None else None,
                "threshold_applied": get_threshold_info(combined_score),
                "features_available": {
                    "nlp_processing": NLP_AVAILABLE,
                    "semantic_similarity": TRANSFORMERS_AVAILABLE
                }
            }
        except Exception as e:
            logger.error(f"Error generating detailed grading report: {str(e)}")
            report["grading_details"] = {
                "error": f"Could not generate detailed grading information: {str(e)}"
            }

    return report


def get_threshold_info(score: float) -> Dict[str, Any]:
    """Get information about which threshold was applied for the score"""
    if score >= 0.85:
        return {
            "threshold": 0.85,
            "percentage": 100,
            "description": "Excellent answer - full credit"
        }
    elif score >= 0.7:
        return {
            "threshold": 0.7,
            "percentage": 90,
            "description": "Good answer - 90% credit"
        }
    elif score >= 0.55:
        return {
            "threshold": 0.55,
            "percentage": 70,
            "description": "Adequate answer - 70% credit"
        }
    elif score >= 0.35:
        return {
            "threshold": 0.35,
            "percentage": 40,
            "description": "Poor answer - 40% credit"
        }
    else:
        return {
            "threshold": 0,
            "percentage": 0,
            "description": "Incorrect answer - no credit"
        }


def generate_exam_grading_report(result_id: int, db: Session) -> Dict[str, Any]:
    """
    Generate a detailed report for an entire exam result.

    Args:
        result_id: ID of the exam result
        db: Database session

    Returns:
        Dictionary with detailed grading information for all questions
    """
    # Fetch the result
    result = db.query(Result).filter(Result.id == result_id).first()
    if not result:
        return {"error": "Result not found"}

    # Fetch all submissions for this result
    submissions = db.query(Submission).filter(
        Submission.student_id == result.student_id,
        Submission.exam_id == result.exam_id
    ).all()

    # Generate report for each submission
    submission_reports = []
    for submission in submissions:
        report = generate_submission_report(submission.id, db)
        submission_reports.append(report)

    # Recalculate total points based on current submission reports
    total_points = sum(report.get("points_earned", 0) for report in submission_reports)
    total_possible = sum(report.get("max_points", 0) for report in submission_reports)
    percentage_score = (total_points / total_possible * 100) if total_possible > 0 else 0

    # Get exam for passing score
    exam = db.query(Exam).filter(Exam.id == result.exam_id).first()
    passing_score = exam.passing_score if exam else 50.0
    passed = percentage_score >= passing_score

    # Compile overall report
    exam_report = {
        "result_id": result_id,
        "exam_id": result.exam_id,
        "student_id": result.student_id,
        "total_points": total_points,  # Use recalculated value
        "percentage_score": percentage_score,  # Use recalculated value
        "passed": passed,  # Use recalculated value
        "started_at": result.started_at.isoformat() if result.started_at else None,
        "completed_at": result.completed_at.isoformat() if result.completed_at else None,
        "submissions": submission_reports,
        "question_type_summary": summarize_by_question_type(submission_reports)
    }

    return exam_report


def summarize_by_question_type(submission_reports: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Generate a summary of points by question type"""
    summary = {}

    for report in submission_reports:
        question_type = report.get("question_type")
        if not question_type:
            continue

        if question_type not in summary:
            summary[question_type] = {
                "count": 0,
                "points_earned": 0,
                "max_points": 0,
                "questions": []
            }

        summary[question_type]["count"] += 1
        summary[question_type]["points_earned"] += report.get("points_earned", 0)
        summary[question_type]["max_points"] += report.get("max_points", 0)
        summary[question_type]["questions"].append({
            "question_id": report.get("question_id"),
            "points_earned": report.get("points_earned"),
            "max_points": report.get("max_points"),
            "percentage": report.get("percentage")
        })

    # Calculate percentages for each type
    for question_type, data in summary.items():
        if data["max_points"] > 0:
            data["percentage"] = round((data["points_earned"] / data["max_points"]) * 100, 1)
        else:
            data["percentage"] = 0

    return summary