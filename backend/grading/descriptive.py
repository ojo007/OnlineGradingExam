"""
Module for automatically grading short answers using both fallback methods and NLP techniques when available.
This module provides two parallel implementations: one using basic string operations (always available)
and another using NLP libraries (when available).

FIXED VERSION: Improved text normalization, comparison, and NLTK file handling.
"""
import re
import os
import logging
from difflib import SequenceMatcher
from typing import Tuple, Optional, Dict, List, Any
import importlib.util

# Configure logging
logging.basicConfig(level=logging.INFO,
                   format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("descriptive_grading")

# Import models module without creating a circular import
from models import Question, QuestionType

# Flag to track if NLP features are available
NLP_AVAILABLE = False
TOKENIZER_AVAILABLE = False
STOPWORDS_AVAILABLE = False
WORDNET_AVAILABLE = False
TRANSFORMERS_AVAILABLE = False

# Configure NLTK to use local data directory or try to download resources
nltk_data_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'nltk_data')
os.makedirs(nltk_data_dir, exist_ok=True)

def ensure_nltk_data_paths():
    """
    Ensure NLTK data paths are correctly set up and fix common issues.
    """
    global nltk_data_dir

    # Make sure our nltk_data_dir is first in the search path
    if nltk and hasattr(nltk, 'data') and hasattr(nltk.data, 'path') and nltk_data_dir not in nltk.data.path:
        nltk.data.path.insert(0, nltk_data_dir)

    # Fix potential path issues with punkt_tab
    punkt_tab_dir = os.path.join(nltk_data_dir, 'tokenizers', 'punkt_tab')
    english_dir = os.path.join(punkt_tab_dir, 'english')

    # Create directories if they don't exist
    os.makedirs(punkt_tab_dir, exist_ok=True)
    os.makedirs(english_dir, exist_ok=True)

    # Check for required files and create them if missing
    collocations_file = os.path.join(english_dir, 'collocations.tab')
    if not os.path.exists(collocations_file):
        logger.warning(f"collocations.tab missing, creating empty file at {collocations_file}")
        try:
            with open(collocations_file, 'w') as f:
                f.write("# Empty collocations file created by descriptive.py\n")
        except Exception as e:
            logger.error(f"Error creating collocations.tab: {str(e)}")

try:
    import nltk
    nltk.data.path.insert(0, nltk_data_dir)
    logger.info(f"Using NLTK data from directory: {nltk_data_dir}")

    # Ensure paths are set up correctly early
    ensure_nltk_data_paths()

    # Try to download resources if they don't exist
    try:
        if not os.path.exists(os.path.join(nltk_data_dir, 'tokenizers/punkt')):
            logger.info("Downloading punkt tokenizer...")
            nltk.download('punkt', download_dir=nltk_data_dir)
        TOKENIZER_AVAILABLE = True
        logger.info("Punkt tokenizer available")
    except Exception as e:
        logger.warning(f"Failed to setup punkt tokenizer: {str(e)}")
        TOKENIZER_AVAILABLE = False

    try:
        if not os.path.exists(os.path.join(nltk_data_dir, 'corpora/stopwords')):
            logger.info("Downloading stopwords...")
            nltk.download('stopwords', download_dir=nltk_data_dir)
        STOPWORDS_AVAILABLE = True
        logger.info("Stopwords available")
    except Exception as e:
        logger.warning(f"Failed to setup stopwords: {str(e)}")
        STOPWORDS_AVAILABLE = False

    try:
        if not os.path.exists(os.path.join(nltk_data_dir, 'corpora/wordnet')):
            logger.info("Downloading wordnet...")
            nltk.download('wordnet', download_dir=nltk_data_dir)
        WORDNET_AVAILABLE = True
        logger.info("WordNet available")
    except Exception as e:
        logger.warning(f"Failed to setup wordnet: {str(e)}")
        WORDNET_AVAILABLE = False

    # Mark NLP as available only if all required resources are available
    if TOKENIZER_AVAILABLE and STOPWORDS_AVAILABLE and WORDNET_AVAILABLE:
        try:
            from nltk.tokenize import word_tokenize
            from nltk.corpus import stopwords
            from nltk.stem import WordNetLemmatizer
            NLP_AVAILABLE = True
            logger.info("All NLTK resources found - NLP features are enabled")
        except ImportError as e:
            logger.warning(f"Error importing NLTK components: {str(e)}")
            NLP_AVAILABLE = False
    else:
        logger.warning("Some NLTK resources missing - using fallback methods")
except ImportError as e:
    logger.warning(f"Failed to import NLTK: {str(e)}")
    NLP_AVAILABLE = False

# Try to import transformers but provide fallback if not available
try:
    # Check if sentence_transformers is installed
    if importlib.util.find_spec("sentence_transformers") is not None:
        from sentence_transformers import SentenceTransformer, util

        # Test if we can actually load a model
        try:
            # Use a smaller model for faster loading and inference
            model = SentenceTransformer('paraphrase-MiniLM-L3-v2')
            TRANSFORMERS_AVAILABLE = True
            logger.info("Sentence Transformer model loaded. Semantic similarity features enabled.")
        except Exception as e:
            logger.warning(f"Could not load Sentence Transformer model: {str(e)}")
            TRANSFORMERS_AVAILABLE = False
    else:
        logger.warning("Sentence Transformers library not installed")
        TRANSFORMERS_AVAILABLE = False
except ImportError as e:
    logger.warning(f"Failed to import transformers: {str(e)}")
    TRANSFORMERS_AVAILABLE = False


def normalize_text_for_comparison(text):
    """Normalize text by removing punctuation, extra spaces, and converting to lowercase"""
    if not text:
        return ""
    # Convert to lowercase
    text = text.lower()
    # Remove all punctuation
    text = re.sub(r'[^\w\s]', ' ', text)
    # Replace multiple spaces with a single space
    text = re.sub(r'\s+', ' ', text)
    # Trim leading/trailing whitespace
    text = text.strip()
    return text


def grade_descriptive_submission(question: Question, submitted_answer: str) -> Tuple[bool, float, Optional[str]]:
    """
    Grade a short answer or descriptive question using available techniques.
    Will use advanced NLP if available, otherwise fall back to basic text processing.
    The grading is now case-insensitive for more reliable results.

    Args:
        question: The Question object containing the correct answer and points
        submitted_answer: The student's answer text

    Returns:
        Tuple of (is_correct, points_earned, feedback)
    """
    # Log grading attempt
    logger.info(f"Grading question {question.id} with type {question.question_type}")

    # Only grade short answer and descriptive questions
    if question.question_type not in [QuestionType.SHORT_ANSWER, QuestionType.DESCRIPTIVE]:
        logger.warning(f"Question type {question.question_type} cannot be automatically graded")
        return False, 0.0, "This question type cannot be automatically graded."

    # Get the correct answer
    correct_answer = question.correct_answer
    if not correct_answer:
        logger.warning(f"Question {question.id} has no correct answer provided")
        return False, 0.0, "This question cannot be automatically graded (no correct answer provided)."

    # DIRECT EXACT MATCH - First check if answers are literally identical
    if submitted_answer.strip() == correct_answer.strip():
        is_correct = True
        points_earned = question.points
        feedback = "Excellent answer! Perfect match."
        logger.info(f"Exact match - full points: {points_earned}")
        return is_correct, points_earned, feedback

    # NORMALIZED TEXT COMPARISON - handles both case and punctuation
    normalized_submitted = normalize_text_for_comparison(submitted_answer)
    normalized_correct = normalize_text_for_comparison(correct_answer)

    # If normalized texts match exactly, it's correct
    if normalized_submitted == normalized_correct:
        is_correct = True
        points_earned = question.points
        feedback = "Excellent answer! Perfect match."
        logger.info(f"Normalized match - full points: {points_earned}")
        return is_correct, points_earned, feedback

    # DIRECT CASE-INSENSITIVE CHECK
    if submitted_answer.lower().strip() == correct_answer.lower().strip():
        is_correct = True
        points_earned = question.points
        feedback = "Excellent answer! Perfect match."
        logger.info(f"Case-insensitive match - full points: {points_earned}")
        return is_correct, points_earned, feedback

    # Log the answer being graded
    logger.info(f"Grading answer: '{submitted_answer[:50]}...' against correct answer: '{correct_answer[:50]}...'")

    # Clean and normalize answers using basic methods (always available)
    submitted_clean = basic_clean_text(submitted_answer)
    correct_clean = basic_clean_text(correct_answer)

    # Check if the answer is empty
    if not submitted_clean:
        logger.warning("Empty answer submitted")
        return False, 0.0, "No answer provided."

    # HIGH SIMILARITY CHECK - If very similar but not exact, still give full credit
    # This helps with minor whitespace/formatting differences
    string_similarity = SequenceMatcher(None, correct_clean, submitted_clean).ratio()
    if string_similarity >= 0.95:  # 95% similar text should be considered correct
        is_correct = True
        points_earned = question.points
        feedback = "Excellent answer! Very close match."
        logger.info(f"High similarity match ({string_similarity:.2f}) - full points: {points_earned}")
        return is_correct, points_earned, feedback

    # Calculate basic scores (always available)
    keyword_score = basic_keyword_match(correct_clean, submitted_clean)

    # Log basic scores
    logger.info(f"Basic keyword match score: {keyword_score:.4f}")
    logger.info(f"String similarity score: {string_similarity:.4f}")

    # Calculate NLP scores if available
    semantic_score = 0.0
    nlp_keyword_score = 0.0

    try:
        if NLP_AVAILABLE:
            # Ensure NLTK paths are good before using NLP
            ensure_nltk_data_paths()

            # Clean text with NLP methods
            submitted_nlp = nlp_clean_text(submitted_answer)
            correct_nlp = nlp_clean_text(correct_answer)

            # Get better keyword matching with NLP
            nlp_keyword_score = nlp_keyword_match(correct_nlp, submitted_nlp)
            logger.info(f"NLP keyword match score: {nlp_keyword_score:.4f}")
            # Use NLP keyword score instead of basic keyword score
            keyword_score = nlp_keyword_score

        # Get semantic similarity if transformers are available
        if TRANSFORMERS_AVAILABLE:
            semantic_score = get_semantic_similarity(correct_answer, submitted_answer)
            logger.info(f"Semantic similarity score: {semantic_score:.4f}")
    except Exception as e:
        logger.warning(f"Error in NLP processing, falling back to case-insensitive basic matching: {str(e)}")

    # Calculate weighted combined score
    # Adjust weights based on what's available
    method = "Basic Text Matching"
    if TRANSFORMERS_AVAILABLE and NLP_AVAILABLE:
        # Use all methods with appropriate weights
        combined_score = (
                keyword_score * 0.4 +
                semantic_score * 0.5 +
                string_similarity * 0.1
        )
        method = "Full NLP with Transformers"
        logger.info(f"Using full NLP with transformers scoring (combined: {combined_score:.4f})")
    elif NLP_AVAILABLE:
        # Use NLP keyword matching with string similarity
        combined_score = keyword_score * 0.7 + string_similarity * 0.3
        method = "NLP Without Transformers"
        logger.info(f"Using NLP without transformers scoring (combined: {combined_score:.4f})")
    else:
        # Use only basic methods - give more weight to string similarity
        combined_score = keyword_score * 0.5 + string_similarity * 0.5
        logger.info(f"Using basic scoring methods (combined: {combined_score:.4f})")

    # Set thresholds for partial credit
    if combined_score >= 0.85:
        # Excellent answer - full credit
        is_correct = True
        points_earned = question.points
        feedback = "Excellent answer! All key points covered."
        logger.info(f"Excellent answer - full points: {points_earned}")
    elif combined_score >= 0.7:
        # Good answer - partial credit
        is_correct = True
        points_earned = question.points * 0.9
        feedback = "Good answer. Most key points covered."
        logger.info(f"Good answer - 90% points: {points_earned}")
    elif combined_score >= 0.55:
        # Adequate answer - partial credit
        is_correct = False  # Technically not fully correct
        points_earned = question.points * 0.7
        feedback = "Adequate answer. Some key points missing or incorrect."
        logger.info(f"Adequate answer - 70% points: {points_earned}")
    elif combined_score >= 0.35:
        # Poor answer - minimal credit
        is_correct = False
        points_earned = question.points * 0.4
        feedback = "Answer is on topic but missing important key points."
        logger.info(f"Poor answer - 40% points: {points_earned}")
    else:
        # Incorrect answer
        is_correct = False
        points_earned = 0.0
        feedback = "Answer is incorrect or missing essential information."
        logger.info("Incorrect answer - 0 points")

    # Round points to 2 decimal places
    points_earned = round(points_earned, 2)

    # Add score details to feedback for transparency
    detailed_feedback = (
        f"{feedback}\n\n"
        f"--- Grading Details ---\n"
        f"Method: {method}\n"
        f"Combined Score: {combined_score:.2f}\n"
        f"Keyword Match: {keyword_score:.2f}\n"
        f"String Similarity: {string_similarity:.2f}\n"
    )

    if TRANSFORMERS_AVAILABLE:
        detailed_feedback += f"Semantic Similarity: {semantic_score:.2f}\n"

    # Add threshold information
    if combined_score >= 0.85:
        detailed_feedback += "Threshold: 0.85 (Excellent - 100%)\n"
    elif combined_score >= 0.7:
        detailed_feedback += "Threshold: 0.70 (Good - 90%)\n"
    elif combined_score >= 0.55:
        detailed_feedback += "Threshold: 0.55 (Adequate - 70%)\n"
    elif combined_score >= 0.35:
        detailed_feedback += "Threshold: 0.35 (Poor - 40%)\n"
    else:
        detailed_feedback += "Threshold: <0.35 (Incorrect - 0%)\n"

    return is_correct, points_earned, detailed_feedback


def basic_clean_text(text: str) -> str:
    """
    Clean and normalize text using basic string operations.
    This method does not require any NLP libraries.
    Made case-insensitive for more reliable grading.

    Args:
        text: Text to clean

    Returns:
        Cleaned text
    """
    if not text:
        return ""

    # Convert to lowercase
    text = text.lower()

    # Remove punctuation
    text = re.sub(r'[^\w\s]', ' ', text)

    # Replace multiple spaces with a single space
    text = re.sub(r'\s+', ' ', text)

    # Trim whitespace
    text = text.strip()

    return text


def basic_keyword_match(correct_answer: str, submitted_answer: str) -> float:
    """
    Calculate a score based on basic keyword matching.
    This method does not require any NLP libraries.
    Made case-insensitive for more reliable grading.

    Args:
        correct_answer: The cleaned correct answer
        submitted_answer: The cleaned submitted answer

    Returns:
        Score between 0.0 and 1.0
    """
    # Ensure lowercase
    correct_answer = correct_answer.lower()
    submitted_answer = submitted_answer.lower()

    # Extract all words from the correct answer
    correct_terms = set(correct_answer.split())

    # Count important words (longer than 2 characters to avoid "is", "a", etc.)
    important_terms = [term for term in correct_terms if len(term) > 2]

    # Add back short but important words that might be excluded
    short_important_words = ["is", "as", "an", "in", "of", "to", "or"]
    for word in short_important_words:
        if word in correct_terms:
            important_terms.append(word)

    # If no important terms, check exact matching
    if not important_terms:
        return 1.0 if correct_answer == submitted_answer else 0.0

    # Count matches in the submitted answer
    submitted_terms = set(submitted_answer.split())
    matches = sum(1 for term in important_terms if term in submitted_terms)

    # Calculate score
    return matches / len(important_terms)


# NLP-based methods (used only if NLP is available)
def nlp_clean_text(text: str) -> str:
    """
    Clean and normalize text using NLP techniques.
    Made case-insensitive for more reliable grading with improved error handling.

    Args:
        text: Text to clean

    Returns:
        Cleaned text with NLP processing
    """
    if not NLP_AVAILABLE or not text:
        return basic_clean_text(text)

    # Convert to lowercase
    text = text.lower()

    try:
        # Ensure paths are good
        ensure_nltk_data_paths()

        # Import here to avoid errors if NLP is not available
        from nltk.tokenize import word_tokenize
        from nltk.corpus import stopwords
        from nltk.stem import WordNetLemmatizer

        # Try tokenizing with fallback
        try:
            tokens = word_tokenize(text)
        except Exception as e:
            logger.warning(f"Tokenization failed: {str(e)}, falling back to basic split")
            tokens = text.split()

        # Remove stopwords
        try:
            stop_words = set(stopwords.words('english'))
            tokens = [word for word in tokens if word not in stop_words]
        except Exception as e:
            logger.warning(f"Stopword removal failed: {str(e)}")

        # Lemmatize words
        try:
            lemmatizer = WordNetLemmatizer()
            tokens = [lemmatizer.lemmatize(word) for word in tokens]
        except Exception as e:
            logger.warning(f"Lemmatization failed: {str(e)}")

        # Join back into a string
        text = ' '.join(tokens)

        return text
    except Exception as e:
        logger.warning(f"Error in NLP text cleaning: {str(e)}")
        return basic_clean_text(text)


def nlp_keyword_match(correct_answer: str, submitted_answer: str) -> float:
    """
    Calculate a score based on NLP-enhanced keyword matching.
    Made case-insensitive for more reliable grading.

    Args:
        correct_answer: The NLP-cleaned correct answer
        submitted_answer: The NLP-cleaned submitted answer

    Returns:
        Score between 0.0 and 1.0
    """
    if not NLP_AVAILABLE:
        return basic_keyword_match(correct_answer, submitted_answer)

    try:
        # Ensure lowercase
        correct_answer = correct_answer.lower()
        submitted_answer = submitted_answer.lower()

        # Extract key terms from the correct answer
        correct_terms = set(correct_answer.split())

        if not correct_terms:
            return 1.0 if correct_answer == submitted_answer else 0.0

        # Count matches in the submitted answer
        submitted_terms = set(submitted_answer.split())
        matches = sum(1 for term in correct_terms if term in submitted_terms)

        # Calculate score
        return matches / len(correct_terms)
    except Exception as e:
        logger.warning(f"Error in NLP keyword matching: {str(e)}")
        return basic_keyword_match(correct_answer, submitted_answer)


def get_semantic_similarity(correct_answer: str, submitted_answer: str) -> float:
    """
    Calculate semantic similarity using sentence transformers if available.

    Args:
        correct_answer: The correct answer
        submitted_answer: The submitted answer

    Returns:
        Similarity score between 0.0 and 1.0
    """
    if not TRANSFORMERS_AVAILABLE:
        logger.warning("Transformers not available, returning 0.0 for semantic similarity")
        return 0.0

    try:
        # Import locally to avoid errors
        from sentence_transformers import SentenceTransformer, util

        # Get or load model (try to use cached instance)
        global model
        if 'model' not in globals() or model is None:
            model = SentenceTransformer('paraphrase-MiniLM-L3-v2')

        # Encode sentences to get embeddings
        embeddings = model.encode([correct_answer, submitted_answer])

        # Calculate cosine similarity using util function from sentence_transformers
        similarity = util.cos_sim(embeddings[0], embeddings[1]).item()

        return max(0.0, min(1.0, float(similarity)))  # Ensure value is between 0 and 1
    except Exception as e:
        logger.error(f"Error calculating semantic similarity: {str(e)}")
        return 0.0


def check_nlp_availability() -> Dict[str, bool]:
    """
    Utility function to check and report the availability of NLP components.
    Useful for debugging and system status.

    Returns:
        Dictionary with availability status of different components
    """
    status = {
        "nlp_available": NLP_AVAILABLE,
        "tokenizer_available": TOKENIZER_AVAILABLE,
        "stopwords_available": STOPWORDS_AVAILABLE,
        "wordnet_available": WORDNET_AVAILABLE,
        "transformers_available": TRANSFORMERS_AVAILABLE,
        "nltk_data_dir_exists": os.path.exists(nltk_data_dir),
    }

    # Check resources in nltk_data_dir if it exists
    if os.path.exists(nltk_data_dir):
        status["nltk_resources"] = os.listdir(nltk_data_dir)

    return status


if __name__ == "__main__":
    # Self-test code
    print("NLP Grading Module Status:")
    status = check_nlp_availability()
    for key, value in status.items():
        print(f"  {key}: {value}")

    # Test with sample questions and answers
    test_questions = [
        {
            "id": 1,
            "question_type": "short_answer",
            "text": "What is the capital of France?",
            "correct_answer": "Paris is the capital of France.",
            "points": 1.0
        },
        {
            "id": 2,
            "question_type": "short_answer",
            "text": "Explain what photosynthesis is.",
            "correct_answer": "Photosynthesis is the process by which plants convert light energy into chemical energy to fuel their activities.",
            "points": 2.0
        }
    ]

    test_answers = [
        "Paris",
        "The capital of France is Paris",
        "I think it's Madrid or maybe Paris",
        "Photosynthesis is how plants make energy from sunlight",
        "Plants use sunlight, water, and carbon dioxide to make glucose and oxygen through photosynthesis."
    ]

    # Create dummy Question objects
    class DummyQuestion:
        def __init__(self, q_dict):
            self.id = q_dict["id"]
            self.question_type = q_dict["question_type"]
            self.text = q_dict["text"]
            self.correct_answer = q_dict["correct_answer"]
            self.points = q_dict["points"]

    # Run tests
    for q_dict in test_questions:
        q = DummyQuestion(q_dict)
        print(f"\nTesting question: {q.text}")
        print(f"Correct answer: {q.correct_answer}")

        for answer in test_answers:
            print(f"\nTesting answer: {answer}")
            is_correct, points, feedback = grade_descriptive_submission(q, answer)
            print(f"Is correct: {is_correct}")
            print(f"Points earned: {points} out of {q.points}")
            print(f"Feedback: {feedback}")