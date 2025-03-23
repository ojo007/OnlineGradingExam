import os
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()


class Settings(BaseSettings):
    # API settings
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "Online Exam System with Automatic Grading"

    # Database settings
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "mysql+pymysql://root:@localhost/exam_system"
    )

    # JWT settings
    SECRET_KEY: str = os.getenv("SECRET_KEY", "your-secret-key-for-jwt")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours

    # CORS settings
    BACKEND_CORS_ORIGINS: list[str] = [
        "http://localhost:3000",  # React frontend
        "http://localhost:8000",  # FastAPI Swagger UI
        "http://localhost"
    ]

    # ML model settings
    NLP_MODEL_PATH: str = os.getenv("NLP_MODEL_PATH", "./models/nlp_model")

    class Config:
        case_sensitive = True


# Create settings instance
settings = Settings()