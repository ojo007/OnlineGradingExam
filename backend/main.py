"""
Main application file for Online Exam System with Automatic Grading.
"""
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from config import settings
from database import create_tables
from routes import api_router

# Initialize FastAPI app
app = FastAPI(
    title=settings.PROJECT_NAME,
    description="API for Online Exam System with Automatic Grading",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

# Set up CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[str(origin) for origin in settings.BACKEND_CORS_ORIGINS],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API router
app.include_router(api_router, prefix=settings.API_V1_STR)

# Root endpoint
@app.get("/", tags=["Root"])
async def root():
    """
    Root endpoint, provides basic API information.
    """
    return JSONResponse(
        content={
            "message": "Welcome to the Online Exam System API",
            "docs_url": "/api/docs",
            "version": "1.0.0"
        }
    )

# Startup event - create database tables if they don't exist
@app.on_event("startup")
async def startup_event():
    """
    Create database and tables on startup if they don't exist.
    """
    try:
        create_tables()
        print("Database setup completed successfully.")
    except Exception as e:
        print(f"Error during database setup: {e}")

if __name__ == "__main__":
    # Run the application with uvicorn when this file is executed directly
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)