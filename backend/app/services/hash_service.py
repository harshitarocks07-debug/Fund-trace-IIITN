import hashlib
from typing import BinaryIO

CHUNK_SIZE = 64 * 1024  # 64 KB

def calculate_sha256_bytes(data: bytes) -> str:
    """Calculate the hexadecimal SHA-256 digest of raw bytes."""
    return hashlib.sha256(data).hexdigest().lower()

def calculate_sha256_stream(file_obj: BinaryIO) -> str:
    """Calculate the hexadecimal SHA-256 digest of an open binary stream in chunks."""
    hasher = hashlib.sha256()
    while True:
        chunk = file_obj.read(CHUNK_SIZE)
        if not chunk:
            break
        hasher.update(chunk)
    return hasher.hexdigest().lower()

