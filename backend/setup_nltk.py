"""
Setup script to download required NLTK resources and create punkt_tab
"""
import os
import nltk
import zipfile
import shutil
import sys
import logging

# Configure logging
logging.basicConfig(level=logging.INFO,
                   format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("nltk_setup")

# Set NLTK data directory to the project's nltk_data folder
nltk_data_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'nltk_data')
os.makedirs(nltk_data_dir, exist_ok=True)

print(f"Downloading NLTK resources to: {nltk_data_dir}")

def download_nltk_data():
    """Download all required NLTK resources"""
    nltk.data.path.insert(0, nltk_data_dir)

    # List of resources we need
    resources = [
        ('punkt', 'tokenizers/punkt'),
        ('stopwords', 'corpora/stopwords'),
        ('wordnet', 'corpora/wordnet')
    ]

    for resource, path in resources:
        try:
            full_path = os.path.join(nltk_data_dir, path)
            if not os.path.exists(full_path):
                logger.info(f"Downloading {resource}...")
                nltk.download(resource, download_dir=nltk_data_dir)
                logger.info(f"Successfully downloaded {resource}")
            else:
                logger.info(f"{resource} already exists at {full_path}")
        except Exception as e:
            logger.error(f"Failed to download {resource}: {str(e)}")

def extract_zip_files():
    """Extract all zip files in the NLTK data directory"""
    for root, dirs, files in os.walk(nltk_data_dir):
        for file in files:
            if file.endswith('.zip'):
                zip_path = os.path.join(root, file)
                extract_dir = os.path.dirname(zip_path)
                logger.info(f"Extracting {zip_path} to {extract_dir}")
                try:
                    with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                        zip_ref.extractall(extract_dir)
                except Exception as e:
                    logger.error(f"Failed to extract {zip_path}: {str(e)}")

def create_punkt_tab():
    """Create punkt_tab directory and required files"""
    punkt_dir = os.path.join(nltk_data_dir, 'tokenizers', 'punkt')
    punkt_tab_dir = os.path.join(nltk_data_dir, 'tokenizers', 'punkt_tab')
    english_dir = os.path.join(punkt_tab_dir, 'english')

    # Create directories if they don't exist
    os.makedirs(punkt_tab_dir, exist_ok=True)
    os.makedirs(english_dir, exist_ok=True)

    logger.info(f"Creating punkt_tab directory from punkt for compatibility")

    # Copy pickle files from punkt to punkt_tab/english
    if os.path.exists(punkt_dir):
        punkt_files = [f for f in os.listdir(punkt_dir) if f.endswith('.pickle')]
        for file in punkt_files:
            src = os.path.join(punkt_dir, file)
            dst = os.path.join(english_dir, file)
            shutil.copy2(src, dst)
            logger.info(f"  Copied {src} to {dst}")

    # Create properly formatted tab files
    with open(os.path.join(english_dir, "abbrev_types.txt"), 'w') as f:
        f.write("Mr.\nMrs.\nMs.\nDr.\nProf.")
    logger.info("  Created abbrev_types.txt")

    with open(os.path.join(english_dir, "collocations.tab"), 'w') as f:
        f.write("of\tthe\n")  # Simple tab-delimited format
    logger.info("  Created collocations.tab")

    with open(os.path.join(english_dir, "sent_starters.txt"), 'w') as f:
        f.write("The\nIt\nThis\nThere\nIn")
    logger.info("  Created sent_starters.txt")

    # IMPORTANT: This file needs EXACTLY 2 columns, not 3
    with open(os.path.join(english_dir, "ortho_context.tab"), 'w') as f:
        # Two tab-delimited columns ONLY:
        f.write("left\t0\nright\t0\n")
    logger.info("  Created ortho_context.tab")

    # Word tokenizer with proper format
    with open(os.path.join(english_dir, "word_tokenizer.tab"), 'w') as f:
        f.write("\\s+\t \n")  # Two tab-delimited columns
    logger.info("  Created word_tokenizer.tab")


def test_tokenization():
    """Test the tokenizer to ensure it works"""
    try:
        logger.info("\nTesting NLTK tokenizer...")

        # Import nltk inside the function to avoid UnboundLocalError
        import nltk

        # Set the data path
        nltk.data.path.insert(0, nltk_data_dir)

        # Then try to load the punkt tokenizer
        from nltk.tokenize import word_tokenize

        # Print paths to help debug
        logger.info(f"NLTK data paths: {nltk.data.path}")

        # Test with a simple sentence
        test_sentence = "This is a test sentence."
        tokens = word_tokenize(test_sentence)
        logger.info(f"Tokenization test result: {tokens}")
        logger.info("NLTK tokenization test successful!")
        return True
    except Exception as e:
        logger.error(f"NLTK tokenization test failed: {str(e)}")
        # Print stack trace for better debugging
        import traceback
        logger.error(traceback.format_exc())
        logger.error("Please check the error message and fix any issues with the NLTK data files.")
        return False

if __name__ == "__main__":
    # Download NLTK resources
    download_nltk_data()

    # Extract zip files
    extract_zip_files()

    # Create punkt_tab directory and files
    create_punkt_tab()

    # Test tokenization
    success = test_tokenization()

    if success:
        logger.info("NLTK resources setup complete and working!")
        sys.exit(0)
    else:
        logger.error("NLTK setup completed with issues. Please review the logs.")
        sys.exit(1)