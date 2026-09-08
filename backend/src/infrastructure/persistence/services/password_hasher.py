"""Bcrypt password hasher implementation."""

from passlib.context import CryptContext

from src.application.use_cases.auth.login import PasswordHasher

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class BcryptPasswordHasher(PasswordHasher):
    """Concrete implementation using passlib bcrypt."""

    def verify(self, plain_password: str, hashed_password: str) -> bool:
        return pwd_context.verify(plain_password, hashed_password)

    def hash(self, password: str) -> str:
        return pwd_context.hash(password)
