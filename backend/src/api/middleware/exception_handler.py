"""Domain exception → HTTP response mapping.

Register these handlers on the FastAPI app to automatically convert
domain-layer exceptions into appropriate HTTP error responses.
"""

from fastapi import Request
from fastapi.responses import JSONResponse

from src.domain.exceptions import (
    ConflictError,
    DomainError,
    ForbiddenError,
    NotFoundError,
    ValidationError,
)

# Map each domain exception type to its HTTP status code
_STATUS_MAP: dict[type[DomainError], int] = {
    NotFoundError: 404,
    ConflictError: 409,
    ForbiddenError: 403,
    ValidationError: 422,
}


async def domain_exception_handler(request: Request, exc: DomainError) -> JSONResponse:
    """Convert a DomainError into a JSON HTTP response with the correct status code."""
    status_code = _STATUS_MAP.get(type(exc), 400)
    return JSONResponse(
        status_code=status_code,
        content={"detail": str(exc)},
    )
