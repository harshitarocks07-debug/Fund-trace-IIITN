import os
from pathlib import Path
from typing import List
from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parents[2]
load_dotenv(BACKEND_DIR / ".env")


class Settings:
    PROJECT_NAME: str = os.getenv("PROJECT_NAME", "FundTrace - Transparent NGO Fund Tracking")
    VERSION: str = "1.0.0"
    API_V1_STR: str = os.getenv("API_V1_STR", "/api/v1")
    SECRET_KEY: str = os.getenv("SECRET_KEY", "fundtrace-super-secure-jwt-secret-key-change-in-production-2026")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "10080"))
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./fundtrace.db")
    HASH_ITERATIONS: int = int(os.getenv("HASH_ITERATIONS", "50000"))

    # Secure Receipt Storage Settings
    STORAGE_DIR: str = os.getenv(
        "STORAGE_DIR",
        os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "storage"))
    )
    RECEIPTS_DIR: str = os.path.join(STORAGE_DIR, "receipts")
    MAX_RECEIPT_SIZE_BYTES: int = int(os.getenv("MAX_RECEIPT_SIZE_BYTES", str(10 * 1024 * 1024)))  # 10 MB
    ALLOWED_RECEIPT_MIME_TYPES: List[str] = [
        "application/pdf",
        "image/jpeg",
        "image/png",
        "image/webp"
    ]
    ALLOWED_RECEIPT_EXTENSIONS: List[str] = [".pdf", ".jpg", ".jpeg", ".png", ".webp"]

    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "*"
    ]
    BACKEND_CORS_ORIGINS: List[str] = CORS_ORIGINS

    # Blockchain / EVM Smart Contract Settings
    FUNDTRACE_RPC_URL: str = os.getenv("FUNDTRACE_RPC_URL", "http://127.0.0.1:8545")
    FUNDTRACE_NETWORK_NAME: str = os.getenv("FUNDTRACE_NETWORK_NAME", "Hardhat Local")
    FUNDTRACE_CHAIN_ID: int = int(os.getenv("FUNDTRACE_CHAIN_ID", "31337"))
    FUNDTRACE_CONTRACT_ADDRESS: str = os.getenv(
        "FUNDTRACE_CONTRACT_ADDRESS",
        "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0"
    )
    FUNDTRACE_PRIVATE_KEY: str = os.getenv(
        "FUNDTRACE_PRIVATE_KEY",
        "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
    )


settings = Settings()
