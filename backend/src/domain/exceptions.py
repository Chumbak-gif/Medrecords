"""Domain-level exceptions for the MEDRecords application."""


class DomainError(Exception):
    """Base class for all domain errors."""

    def __init__(self, message: str = "A domain error occurred"):
        self.message = message
        super().__init__(self.message)


class NotFoundError(DomainError):
    """Raised when a requested entity does not exist."""

    def __init__(self, message: str = "Entity not found"):
        super().__init__(message)


class ConflictError(DomainError):
    """Raised when an operation conflicts with existing state (e.g. duplicate)."""

    def __init__(self, message: str = "Conflict with existing entity"):
        super().__init__(message)


class ForbiddenError(DomainError):
    """Raised when the actor lacks permission for the requested operation."""

    def __init__(self, message: str = "Operation not permitted"):
        super().__init__(message)


class ValidationError(DomainError):
    """Raised when input data fails domain validation rules."""

    def __init__(self, message: str = "Validation failed"):
        super().__init__(message)
