"""
Module for automatically grading multiple-choice and true/false questions.
"""
from models import Question, QuestionType


def grade_mcq_submission(question: Question, submitted_answer: str) -> tuple[bool, float]:
    """
    Grade a multiple choice or true/false question.

    Args:
        question: The Question object containing the correct answer and points
        submitted_answer: The student's answer

    Returns:
        Tuple of (is_correct, points_earned)
    """
    # Handle different question types
    if question.question_type == QuestionType.MULTIPLE_CHOICE:
        return grade_multiple_choice(question, submitted_answer)
    elif question.question_type == QuestionType.TRUE_FALSE:
        return grade_true_false(question, submitted_answer)
    else:
        # Return zero points for unsupported question types
        return False, 0.0


def grade_multiple_choice(question: Question, submitted_answer: str) -> tuple[bool, float]:
    """
    Grade a multiple choice question by checking if the submitted answer matches
    the correct option.

    Args:
        question: The Question object containing options and correct answer
        submitted_answer: The student's answer (usually option ID like 'A', 'B', etc.)

    Returns:
        Tuple of (is_correct, points_earned)
    """
    # Normalize answers for comparison
    submitted_answer = submitted_answer.strip().upper()

    # Check if the question has options
    if not question.options:
        return False, 0.0

    # Find the correct option
    correct_option_id = None
    for option in question.options:
        if option.get('is_correct', False):
            correct_option_id = option.get('id', '').strip().upper()
            break

    # If no correct option found or submitted answer doesn't match
    if not correct_option_id or submitted_answer != correct_option_id:
        return False, 0.0

    # Answer is correct
    return True, question.points


def grade_true_false(question: Question, submitted_answer: str) -> tuple[bool, float]:
    """
    Grade a true/false question with improved case-insensitive comparison.

    Args:
        question: The Question object containing the correct answer
        submitted_answer: The student's answer ('true', 'false', 't', 'f')

    Returns:
        Tuple of (is_correct, points_earned)
    """
    # Normalize answers for comparison - make fully case-insensitive
    submitted_answer = submitted_answer.strip().lower()
    correct_answer = question.correct_answer.strip().lower() if question.correct_answer else ""

    # Convert various forms of true/false to standardized format
    true_values = ['true', 't', 'yes', 'y', '1']
    false_values = ['false', 'f', 'no', 'n', '0']

    submitted_bool = None
    if submitted_answer in true_values:
        submitted_bool = 'true'
    elif submitted_answer in false_values:
        submitted_bool = 'false'

    correct_bool = None
    if correct_answer in true_values:
        correct_bool = 'true'
    elif correct_answer in false_values:
        correct_bool = 'false'

    # Check if the answers match
    if submitted_bool and correct_bool and submitted_bool == correct_bool:
        return True, question.points

    # Direct string comparison fallback if standardization fails
    if submitted_answer == correct_answer:
        return True, question.points

    # Log the mismatch for debugging
    print(f"True/False grading failed: submitted='{submitted_answer}', correct='{correct_answer}'")
    print(f"Standardized: submitted_bool='{submitted_bool}', correct_bool='{correct_bool}'")

    return False, 0.0