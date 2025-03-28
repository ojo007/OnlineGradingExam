# Online Exam System with Automatic Grading

A modern web-based examination platform with automatic grading capabilities for educational institutions.

## Features

- **User Management**: Roles for students, teachers, and administrators
- **Exam Creation**: Create and manage various types of exams
- **Multiple Question Types**: Support for multiple-choice, true/false, and descriptive questions
- **Automatic Grading**: Instant evaluation of multiple-choice and short-answer questions
- **AI-Powered Grading**: NLP-based assessment for descriptive answers
- **Results Analysis**: Comprehensive reporting and analytics
- **Secure Authentication**: JWT-based authentication and role-based access control

## Technology Stack

- **Backend**: FastAPI (Python)
- **Database**: MySQL
- **ORM**: SQLAlchemy
- **Authentication**: JWT (JSON Web Tokens)
- **AI/ML**: NLTK, Transformers (optional, for advanced grading)

## Project Structure

```
exam_system/
│
├── config.py                  # Configuration settings
├── database.py                # Database connection and session
├── models.py                  # Database models
├── schemas.py                 # Pydantic schemas for validation
├── routes/                    # API endpoints
│   ├── __init__.py
│   ├── auth.py                # Authentication routes
│   ├── exams.py               # Exam management
│   ├── submissions.py         # Answer submissions and grading
│   └── users.py               # User management
├── grading/                   # Grading logic
│   ├── __init__.py 
│   ├── mcq.py                 # Multiple choice question grading
│   └── descriptive.py         # NLP-based descriptive answer grading
├── utils.py                   # Utility functions
├── main.py                    # FastAPI application entry point
├── requirements.txt           # Project dependencies
└── README.md                  # Project documentation
```

## Installation

### Prerequisites

- Python 3.8+
- MySQL 8.0+

### Step 1: Clone the repository

```bash
git clone https://github.com/yourusername/online-exam-system.git
cd online-exam-system
```

### Step 2: Create a virtual environment

```bash
python -m venv venv
```

Activate the virtual environment:

- On Windows:
  ```bash
  venv\Scripts\activate
  ```
- On macOS/Linux:
  ```bash
  source venv/bin/activate
  ```

### Step 3: Install dependencies

```bash
pip install -r requirements.txt
```

### Step 4: Configure environment variables

Create a `.env` file in the project root with the following variables:

```
DATABASE_URL=mysql+pymysql://username:password@localhost/exam_system
SECRET_KEY=your-secret-key-for-jwt
```

### Step 5: Create the database

In MySQL:

```sql
CREATE DATABASE exam_system;
```

### Step 6: Run the application

```bash
python main.py
```

The API will be available at `http://localhost:8000`

## API Documentation

Once the application is running, you can access the interactive API documentation:

- Swagger UI: http://localhost:8000/api/docs
- ReDoc: http://localhost:8000/api/redoc

## Usage Examples

### Authentication

```python
import requests

# Register a new user
response = requests.post(
    "http://localhost:8000/api/v1/auth/register",
    json={
        "email": "teacher@example.com",
        "username": "teacher1",
        "full_name": "Teacher Name",
        "password": "SecurePassword123",
        "role": "teacher"
    }
)
print(response.json())

# Login
response = requests.post(
    "http://localhost:8000/api/v1/auth/login",
    json={
        "username": "teacher1",
        "password": "SecurePassword123"
    }
)
token = response.json()["access_token"]

# Use the token for authenticated requests
headers = {"Authorization": f"Bearer {token}"}
```

### Creating an Exam

```python
# Create a new exam
response = requests.post(
    "http://localhost:8000/api/v1/exams/",
    headers=headers,
    json={
        "title": "Introduction to Python",
        "description": "Basic concepts of Python programming",
        "duration_minutes": 60,
        "passing_score": 70.0
    }
)
exam_id = response.json()["id"]

# Add a question to the exam
response = requests.post(
    "http://localhost:8000/api/v1/exams/questions/",
    headers=headers,
    json={
        "exam_id": exam_id,
        "text": "What is the output of print(2 + 2)?",
        "question_type": "multiple_choice",
        "points": 2.0,
        "options": [
            {"id": "A", "text": "4", "is_correct": True},
            {"id": "B", "text": "2", "is_correct": False},
            {"id": "C", "text": "22", "is_correct": False},
            {"id": "D", "text": "Error", "is_correct": False}
        ]
    }
)
```

## For Developers

### Running Tests

```bash
pytest
```

### Database Migrations

When making changes to the database models:

```bash
# Create tables with SQLAlchemy
python -c "from database import create_tables; create_tables()"
```

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgements

- This project was developed as part of a bachelor's thesis in Computer Science.
- Special thanks to Skyline University Nigeria for supporting this research.