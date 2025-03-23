"""
Module for automatically grading short answers using both fallback methods and NLP techniques when available.
This module provides two parallel implementations: one using basic string operations (always available)
and another using NLP libraries (when available).
"""
import re
import os
from difflib import SequenceMatcher
from models import Question, QuestionType
from typing import Tuple, Optional

# Flag to track if NLP features are available
NLP_AVAILABLE = False
TOKENIZER_AVAILABLE = False
STOPWORDS_AVAILABLE = False
WORDNET_AVAILABLE = False

# Configure NLTK to use local data directory
nltk_data_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'nltk_data')
if os.path.exists(nltk_data_dir):
    import nltk
    nltk.data.path.insert(0, nltk_data_dir)
    print(f"Using NLTK data from local directory: {nltk_data_dir}")

    # Check each resource individually
    try:
        nltk.data.find('tokenizers/punkt')
        TOKENIZER_AVAILABLE = True
        print("Found punkt tokenizer in local directory")
    except LookupError:
        print("Punkt tokenizer not found in local directory")

    try:
        nltk.data.find('corpora/stopwords')
        STOPWORDS_AVAILABLE = True
        print("Found stopwords in local directory")
    except LookupError:
        print("Stopwords not found in local directory")

    try:
        nltk.data.find('corpora/wordnet')
        WORDNET_AVAILABLE = True
        print("Found wordnet in local directory")
    except LookupError:
        print("Wordnet not found in local directory")

    # Only mark NLP as available if all required resources are found
    if TOKENIZER_AVAILABLE and STOPWORDS_AVAILABLE and WORDNET_AVAILABLE:
        NLP_AVAILABLE = True
        print("All NLTK resources found - NLP features are enabled")
    else:
        print("Some NLTK resources missing - using fallback methods")
else:
    print(f"No local NLTK data directory found at {nltk_data_dir}")

# Only import NLTK components if resources are available
if NLP_AVAILABLE:
    try:
        from nltk.tokenize import word_tokenize
        from nltk.corpus import stopwords
        from nltk.stem import WordNetLemmatizer
    except ImportError:
        NLP_AVAILABLE = False
        print("Error importing NLTK components - using fallback methods")

# Try to import transformers but provide fallback if not available
TRANSFORMERS_AVAILABLE = False
try:
    from sentence_transformers import SentenceTransformer
    # Test if we can actually load a model
    try:
        model = SentenceTransformer('all-MiniLM-L6-v2')
        TRANSFORMERS_AVAILABLE = True
        print("Sentence Transformer model loaded. Semantic similarity features enabled.")
    except Exception:
        print("Could not load Sentence Transformer model. Semantic similarity features disabled.")
except ImportError:
    print("Sentence Transformers library not available. Semantic similarity features disabled.")

# Try to import NLTK but provide fallback if not available
try:
    import nltk
    # Only mark as available if we can successfully load a resource
    try:
        # First check if the data already exists locally
        nltk.data.find('tokenizers/punkt')
        nltk.data.find('corpora/stopwords')
        nltk.data.find('corpora/wordnet')

        # If we got here, the data is available
        from nltk.tokenize import word_tokenize
        from nltk.corpus import stopwords
        from nltk.stem import WordNetLemmatizer
        NLP_AVAILABLE = True
        print("NLTK resources found locally. Advanced NLP features are enabled.")
    except LookupError:
        # Data not found, we'll use fallback methods
        print("NLTK data not available. Using basic grading methods.")
except ImportError:
    print("NLTK library not available. Using basic grading methods.")

# Try to import transformers but provide fallback if not available
TRANSFORMERS_AVAILABLE = False
try:
    from sentence_transformers import SentenceTransformer
    # Test if we can actually load a model
    try:
        model = SentenceTransformer('all-MiniLM-L6-v2')
        TRANSFORMERS_AVAILABLE = True
        print("Sentence Transformer model loaded. Semantic similarity features enabled.")
    except Exception:
        print("Could not load Sentence Transformer model. Semantic similarity features disabled.")
except ImportError:
    print("Sentence Transformers library not available. Semantic similarity features disabled.")

def grade_descriptive_submission(question: Question, submitted_answer: str) -> Tuple[bool, float, Optional[str]]:
    """
    Grade a short answer or descriptive question using available techniques.
    Will use advanced NLP if available, otherwise fall back to basic text processing.

    Args:
        question: The Question object containing the correct answer and points
        submitted_answer: The student's answer text

    Returns:
        Tuple of (is_correct, points_earned, feedback)
    """
    # Only grade short answer questions
    if question.question_type != QuestionType.SHORT_ANSWER:
        return False, 0.0, "This question cannot be automatically graded."

    # Get the correct answer
    correct_answer = question.correct_answer
    if not correct_answer:
        return False, 0.0, "This question cannot be automatically graded (no correct answer provided)."

    # Clean and normalize answers using basic methods (always available)
    submitted_clean = basic_clean_text(submitted_answer)
    correct_clean = basic_clean_text(correct_answer)

    # Check if the answer is empty
    if not submitted_clean:
        return False, 0.0, "No answer provided."

    # Calculate basic scores (always available)
    keyword_score = basic_keyword_match(correct_clean, submitted_clean)
    string_similarity = SequenceMatcher(None, correct_clean, submitted_clean).ratio()

    # Calculate NLP scores if available
    semantic_score = 0.0
    if NLP_AVAILABLE:
        # Clean text with NLP methods
        submitted_nlp = nlp_clean_text(submitted_answer)
        correct_nlp = nlp_clean_text(correct_answer)

        # Get better keyword matching with NLP
        keyword_score = nlp_keyword_match(correct_nlp, submitted_nlp)

    # Get semantic similarity if transformers are available
    if TRANSFORMERS_AVAILABLE:
        semantic_score = get_semantic_similarity(correct_answer, submitted_answer)

    # Calculate weighted combined score
    # Adjust weights based on what's available
    if TRANSFORMERS_AVAILABLE and NLP_AVAILABLE:
        # Use all methods with appropriate weights
        combined_score = (
            keyword_score * 0.4 +
            semantic_score * 0.5 +
            string_similarity * 0.1
        )
    elif NLP_AVAILABLE:
        # Use NLP keyword matching with string similarity
        combined_score = keyword_score * 0.7 + string_similarity * 0.3
    else:
        # Use only basic methods
        combined_score = keyword_score * 0.6 + string_similarity * 0.4

    # Set thresholds for partial credit
    if combined_score >= 0.9:
        # Excellent answer - full credit
        is_correct = True
        points_earned = question.points
        feedback = "Excellent answer! All key points covered."
    elif combined_score >= 0.75:
        # Good answer - partial credit
        is_correct = True
        points_earned = question.points * 0.9
        feedback = "Good answer. Most key points covered."
    elif combined_score >= 0.6:
        # Adequate answer - partial credit
        is_correct = False  # Technically not fully correct
        points_earned = question.points * 0.7
        feedback = "Adequate answer. Some key points missing or incorrect."
    elif combined_score >= 0.4:
        # Poor answer - minimal credit
        is_correct = False
        points_earned = question.points * 0.4
        feedback = "Answer is on topic but missing important key points."
    else:
        # Incorrect answer
        is_correct = False
        points_earned = 0.0
        feedback = "Answer is incorrect or missing essential information."

    # Round points to 2 decimal places
    points_earned = round(points_earned, 2)

    return is_correct, points_earned, feedback

def basic_clean_text(text: str) -> str:
    """
    Clean and normalize text using basic string operations.
    This method does not require any NLP libraries.

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
    text = re.sub(r'[^\w\s]', '', text)

    # Remove extra whitespace
    text = ' '.join(text.split())

    return text

def basic_keyword_match(correct_answer: str, submitted_answer: str) -> float:
    """
    Calculate a score based on basic keyword matching.
    This method does not require any NLP libraries.

    Args:
        correct_answer: The cleaned correct answer
        submitted_answer: The cleaned submitted answer

    Returns:
        Score between 0.0 and 1.0
    """
    # Extract terms from the correct answer
    correct_terms = set(correct_answer.split())

    # Count important words (longer than 3 characters)
    important_terms = [term for term in correct_terms if len(term) > 3]

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

    Args:
        text: Text to clean

    Returns:
        Cleaned text with NLP processing
    """
    if not NLP_AVAILABLE or not text:
        return basic_clean_text(text)

    # Convert to lowercase
    text = text.lower()

    # Tokenize
    tokens = word_tokenize(text)

    # Remove stopwords
    stop_words = set(stopwords.words('english'))
    tokens = [word for word in tokens if word not in stop_words]

    # Lemmatize words
    lemmatizer = WordNetLemmatizer()
    tokens = [lemmatizer.lemmatize(word) for word in tokens]

    # Join back into a string
    text = ' '.join(tokens)

    return text

def nlp_keyword_match(correct_answer: str, submitted_answer: str) -> float:
    """
    Calculate a score based on NLP-enhanced keyword matching.

    Args:
        correct_answer: The NLP-cleaned correct answer
        submitted_answer: The NLP-cleaned submitted answer

    Returns:
        Score between 0.0 and 1.0
    """
    if not NLP_AVAILABLE:
        return basic_keyword_match(correct_answer, submitted_answer)

    # Extract key terms from the correct answer
    correct_terms = set(correct_answer.split())

    if not correct_terms:
        return 1.0 if correct_answer == submitted_answer else 0.0

    # Count matches in the submitted answer
    submitted_terms = set(submitted_answer.split())
    matches = sum(1 for term in correct_terms if term in submitted_terms)

    # Calculate score
    return matches / len(correct_terms)

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
        return 0.0

    # Encode sentences to get embeddings
    embeddings = model.encode([correct_answer, submitted_answer])

    # Calculate cosine similarity
    from numpy import dot
    from numpy.linalg import norm

    similarity = dot(embeddings[0], embeddings[1]) / (norm(embeddings[0]) * norm(embeddings[1]))

    return float(similarity)