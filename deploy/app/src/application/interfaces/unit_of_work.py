"""Abstract Unit of Work interface.

The UoW manages transactional boundaries for use cases. Infrastructure
implementations wrap a database session and provide commit/rollback semantics.
"""

from abc import ABC, abstractmethod
from typing import Any


class UnitOfWork(ABC):
    """Abstract transactional boundary for use case operations."""

    @abstractmethod
    async def __aenter__(self) -> "UnitOfWork":
        """Enter the transactional context."""
        ...

    @abstractmethod
    async def __aexit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> None:
        """Exit the transactional context, rolling back on exception."""
        ...

    @abstractmethod
    async def commit(self) -> None:
        """Commit the current transaction."""
        ...

    @abstractmethod
    async def rollback(self) -> None:
        """Rollback the current transaction."""
        ...

    @property
    @abstractmethod
    def session(self) -> Any:
        """Return the underlying session object (opaque to use cases)."""
        ...
