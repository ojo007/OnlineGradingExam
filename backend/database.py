from sqlalchemy import create_engine, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import re
import urllib.parse

from config import settings

# Create base class for models
Base = declarative_base()


def get_database_name():
    """Extract database name from the DATABASE_URL"""
    parsed = urllib.parse.urlparse(settings.DATABASE_URL)
    return parsed.path.strip('/')


def create_database_if_not_exists():
    """Create the database if it doesn't exist"""
    db_name = get_database_name()
    if not db_name:
        print("Could not extract database name from DATABASE_URL")
        return

    # Extract connection details without database name
    parsed = urllib.parse.urlparse(settings.DATABASE_URL)

    # Create URL to connect to server without specific database
    server_url = f"{parsed.scheme}://{parsed.netloc}"

    try:
        # Connect to the MySQL server (without specifying a database)
        engine = create_engine(server_url)

        # Check if database exists
        with engine.connect() as connection:
            result = connection.execute(text("SHOW DATABASES"))
            databases = [row[0] for row in result]

            if db_name.lower() not in [db.lower() for db in databases]:
                print(f"Creating database {db_name}...")
                connection.execute(text(f"CREATE DATABASE `{db_name}`"))
                print(f"Database {db_name} created successfully!")
            else:
                print(f"Database {db_name} already exists.")
    except Exception as e:
        print(f"Error connecting to database server or creating database: {e}")


# Create SQLAlchemy engine
engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,  # Verify connection before using from pool
)

# Create session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


# Dependency to get DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# Function to create tables
def create_tables():
    """Create all tables in the database"""
    try:
        # First, ensure database exists
        create_database_if_not_exists()

        # Then create tables
        Base.metadata.create_all(bind=engine)
        print("Tables created successfully.")
    except Exception as e:
        print(f"Error creating tables: {e}")