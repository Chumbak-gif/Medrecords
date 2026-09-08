# Backend Clean Architecture Bugfix Design

## Overview

The MEDRecords backend currently uses a flat single-layer structure (`backend/app/`) where FastAPI routers directly import ORM models, embed business logic (access control, pagination, UID generation, audit logging), and execute raw SQLAlchemy queries inline. This structural debt prevents unit testing in isolation, horizontal scaling, independent persistence evolution, and enterprise deployment.

The fix restructures the backend into Clean Architecture layers (`src/api`, `src/application`, `src/domain`, `src/infrastructure`, `src/common`, `src/config`) while preserving every existing API endpoint, response shape, authentication flow, and business rule. The approach uses the Strangler Fig pattern: new layers are built alongside existing code, then routers are migrated one domain at a time until the flat `app/` directory is removed.

## Glossary

- **Bug_Condition (C)**: Any backend module where routers directly import ORM models, embed business logic, or execute database queries without abstraction layers
- **Property (P)**: The desired state where each module respects Clean Architecture layering — routers delegate to use cases, use cases orchestrate domain logic, domain defines repository interfaces, infrastructure implements them
- **Preservation**: All existing API contracts (endpoint paths, HTTP methods, request/response schemas, status codes, auth flows, RBAC rules) remain byte-for-byte identical to callers
- **Domain Layer**: Framework-agnostic entities, value objects, repository interfaces (ports), and domain services in `src/domain/`
- **Application Layer**: Use cases (interactors) that orchestrate domain logic, in `src/application/`
- **Infrastructure Layer**: Concrete implementations of ports — SQLAlchemy repositories, Celery workers, external service clients — in `src/infrastructure/`
- **API Layer**: FastAPI routers, request/response DTOs, middleware, in `src/api/`
- **Unit of Work (UoW)**: A transactional boundary pattern managing database sessions and commit/rollback lifecycle
- **DI Container**: Dependency injection registry (`dependency-injector`) that wires interfaces to implementations at startup

## Bug Details

### Bug Condition

The bug manifests when any developer interaction requires isolation of concerns. Every router in `backend/app/routers/` directly imports SQLAlchemy models, constructs `select()` statements, applies business rules (doctor-scoping, role checks, UID generation), and writes audit logs — all within a single function. This makes the codebase untestable without a live database, unscalable without duplicating logic, and unobservable without instrumenting every router individually.

**Formal Specification:**
```
FUNCTION isBugCondition(module)
  INPUT: module of type PythonModule
  OUTPUT: boolean
  
  RETURN module.imports_orm_models_in_router = TRUE
      OR module.embeds_business_logic_in_handler = TRUE
      OR module.executes_raw_queries_in_handler = TRUE
      OR module.has_no_repository_interface = TRUE
      OR module.has_no_use_case_class = TRUE
      OR module.has_no_di_container = TRUE
      OR module.has_no_structured_logging = TRUE
      OR module.has_no_correlation_id = TRUE
      OR module.has_no_deployment_manifests = TRUE
      OR module.has_no_background_processing = TRUE
END FUNCTION
```

### Examples

- **Patients router** (`app/routers/patients.py`): Directly imports `Patient`, `Assessment`, `AuditLog`, `Disease` ORM models; constructs SQLAlchemy `select()` with joins, subqueries, pagination, and doctor-scoping logic all inline — 250+ lines of mixed concerns
- **Auth dependency** (`app/dependencies/auth.py`): Directly queries `User` model via SQLAlchemy, making it impossible to test authentication logic without a database connection
- **Lock scheduler** (`app/services/lock_scheduler.py`): Directly imports `AsyncSessionLocal` and executes queries; no interface abstraction means the scheduling logic cannot be tested without a real session factory
- **No observability**: Zero correlation IDs, no structured logging, no OpenTelemetry spans — a request failure in production provides no trace context

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- All 12 router modules (auth, patients, assessments, prescriptions, analytics, exports, audit, config, users, diseases, templates, followups) continue to serve identical request/response contracts
- JWT authentication via HS256 with `secret_key` and `access_token_expire_minutes` settings continues unchanged
- Doctor-scoped access control logic (only patients registered by or assessed by the doctor) continues unchanged
- Admin/sys_admin full access continues unchanged
- Audit logging with actor identity, event type, entity reference, and description continues unchanged
- Patient UID sequential generation (PAT-XXXXXX format) and unique contact number constraint continue unchanged
- Assessment lock scheduler (APScheduler, 5-minute interval, submitted→locked transition) continues unchanged
- Async SQLAlchemy with asyncpg, pool_size=10, max_overflow=20, pool_pre_ping=True continues unchanged
- CORS configuration with `allowed_origins` continues unchanged
- Alembic migration infrastructure continues to function

**Scope:**
All inputs that do NOT involve the internal architectural structure (i.e., external HTTP requests from clients) should be completely unaffected by this fix. This includes:
- Every existing API endpoint path and method
- Every request payload schema
- Every response payload shape and status code
- Every error response format
- Authentication and authorization behavior
- Database schema (no migration changes)

## Hypothesized Root Cause

Based on the bug description, the root causes are:

1. **No Layered Package Structure**: The flat `app/` package provides no physical boundary between concerns. Developers naturally co-locate business logic with HTTP handlers because there is no designated place for domain rules.

2. **No Repository Abstraction**: Without interface definitions for data access, routers directly import ORM models and construct queries. There is no seam for substituting mock implementations during testing.

3. **No Dependency Injection**: Without a DI container, dependencies (database session, config, services) are resolved via module-level imports and FastAPI's `Depends()` on concrete implementations. Swapping implementations requires monkey-patching.

4. **No Application Layer**: Without use case classes, business logic (validation, authorization, orchestration, audit logging) is embedded in route handlers. This logic cannot be reused from CLI or background workers.

5. **No Observability Infrastructure**: No middleware produces correlation IDs, structured logs, or OpenTelemetry spans. Debugging production issues requires manual log searching.

6. **No Deployment Infrastructure**: No Dockerfile, no Kubernetes manifests, no health probes beyond a basic `/health` endpoint. Production deployment requires ad-hoc scripting.

7. **No Background Processing**: Long-running tasks (export generation, notifications) either block the request thread or rely on in-process APScheduler with no distributed task queue.

## Correctness Properties

Property 1: Bug Condition - Clean Architecture Layer Compliance

_For any_ backend module where the bug condition holds (isBugCondition returns true), the refactored module SHALL have a dedicated domain entity, a repository interface in the domain layer, a concrete repository implementation in the infrastructure layer, a use case class in the application layer, and a router that exclusively delegates to the use case via dependency injection — with no direct ORM imports or inline query construction in the router.

**Validates: Requirements 2.1, 2.2, 2.3, 2.7, 2.8**

Property 2: Preservation - API Contract Stability

_For any_ external HTTP request where the bug condition does NOT hold (the request exercises existing API contracts), the refactored system SHALL return the exact same response payload shape, HTTP status codes, and headers as the original flat implementation, preserving all authentication, authorization, pagination, and business rule behavior.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8**

## Fix Implementation

### Target Directory Structure

```
backend/
├── src/
│   ├── __init__.py
│   ├── main.py                          # FastAPI app factory
│   ├── api/
│   │   ├── __init__.py
│   │   ├── v1/
│   │   │   ├── __init__.py
│   │   │   ├── router.py               # Aggregates all v1 routers
│   │   │   ├── patients.py
│   │   │   ├── assessments.py
│   │   │   ├── prescriptions.py
│   │   │   ├── analytics.py
│   │   │   ├── exports.py
│   │   │   ├── audit.py
│   │   │   ├── auth.py
│   │   │   ├── config_router.py
│   │   │   ├── users.py
│   │   │   ├── diseases.py
│   │   │   ├── templates.py
│   │   │   ├── followups.py
│   │   │   └── dependencies/
│   │   │       ├── __init__.py
│   │   │       └── auth.py
│   │   ├── v2/                          # Future version placeholder
│   │   │   └── __init__.py
│   │   └── middleware/
│   │       ├── __init__.py
│   │       ├── correlation_id.py
│   │       ├── structured_logging.py
│   │       └── exception_handler.py
│   ├── application/
│   │   ├── __init__.py
│   │   ├── use_cases/
│   │   │   ├── __init__.py
│   │   │   ├── patients/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── list_patients.py
│   │   │   │   ├── register_patient.py
│   │   │   │   ├── get_patient.py
│   │   │   │   ├── update_patient.py
│   │   │   │   └── delete_patient.py
│   │   │   ├── assessments/
│   │   │   ├── prescriptions/
│   │   │   ├── analytics/
│   │   │   ├── auth/
│   │   │   ├── diseases/
│   │   │   ├── templates/
│   │   │   ├── followups/
│   │   │   ├── exports/
│   │   │   ├── audit/
│   │   │   ├── config/
│   │   │   └── users/
│   │   ├── dto/
│   │   │   ├── __init__.py
│   │   │   ├── patient_dto.py
│   │   │   ├── assessment_dto.py
│   │   │   └── ...
│   │   └── interfaces/
│   │       ├── __init__.py
│   │       └── unit_of_work.py
│   ├── domain/
│   │   ├── __init__.py
│   │   ├── entities/
│   │   │   ├── __init__.py
│   │   │   ├── patient.py
│   │   │   ├── assessment.py
│   │   │   ├── user.py
│   │   │   ├── disease.py
│   │   │   ├── medicine.py
│   │   │   ├── prescription_row.py
│   │   │   ├── audit_log.py
│   │   │   ├── consent_record.py
│   │   │   ├── form_template.py
│   │   │   ├── followup.py
│   │   │   └── app_config.py
│   │   ├── value_objects/
│   │   │   ├── __init__.py
│   │   │   ├── patient_uid.py
│   │   │   └── contact_number.py
│   │   ├── repositories/
│   │   │   ├── __init__.py
│   │   │   ├── patient_repository.py    # Abstract interface (port)
│   │   │   ├── assessment_repository.py
│   │   │   ├── user_repository.py
│   │   │   ├── disease_repository.py
│   │   │   ├── medicine_repository.py
│   │   │   ├── prescription_repository.py
│   │   │   ├── audit_log_repository.py
│   │   │   ├── template_repository.py
│   │   │   ├── followup_repository.py
│   │   │   └── config_repository.py
│   │   ├── services/
│   │   │   ├── __init__.py
│   │   │   ├── patient_uid_generator.py
│   │   │   └── access_control.py
│   │   └── exceptions.py
│   ├── infrastructure/
│   │   ├── __init__.py
│   │   ├── persistence/
│   │   │   ├── __init__.py
│   │   │   ├── database.py             # Engine, session factory
│   │   │   ├── models/                  # SQLAlchemy ORM models
│   │   │   │   ├── __init__.py
│   │   │   │   ├── base.py
│   │   │   │   ├── patient_model.py
│   │   │   │   ├── assessment_model.py
│   │   │   │   ├── user_model.py
│   │   │   │   ├── disease_model.py
│   │   │   │   ├── medicine_model.py
│   │   │   │   ├── prescription_row_model.py
│   │   │   │   ├── audit_log_model.py
│   │   │   │   ├── consent_record_model.py
│   │   │   │   ├── form_template_model.py
│   │   │   │   ├── followup_model.py
│   │   │   │   └── app_config_model.py
│   │   │   ├── repositories/            # Concrete implementations (adapters)
│   │   │   │   ├── __init__.py
│   │   │   │   ├── sqlalchemy_patient_repository.py
│   │   │   │   ├── sqlalchemy_assessment_repository.py
│   │   │   │   ├── sqlalchemy_user_repository.py
│   │   │   │   └── ...
│   │   │   └── unit_of_work.py          # SQLAlchemy UoW implementation
│   │   ├── celery/
│   │   │   ├── __init__.py
│   │   │   ├── celery_app.py
│   │   │   ├── tasks/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── lock_assessments.py
│   │   │   │   ├── export_tasks.py
│   │   │   │   └── notification_tasks.py
│   │   │   └── beat_schedule.py
│   │   ├── observability/
│   │   │   ├── __init__.py
│   │   │   ├── telemetry.py             # OpenTelemetry setup
│   │   │   ├── logging_config.py        # Structured JSON logging
│   │   │   └── health.py                # Health/readiness probes
│   │   └── external/
│   │       └── __init__.py
│   ├── common/
│   │   ├── __init__.py
│   │   ├── pagination.py
│   │   ├── result.py                    # Result[T] monad for error handling
│   │   └── types.py
│   └── config/
│       ├── __init__.py
│       ├── settings.py                  # Pydantic settings with env profiles
│       ├── container.py                 # DI container definition
│       └── feature_flags.py
├── tests/
│   ├── __init__.py
│   ├── unit/
│   │   ├── domain/
│   │   ├── application/
│   │   └── conftest.py
│   ├── integration/
│   │   ├── api/
│   │   ├── infrastructure/
│   │   └── conftest.py
│   └── e2e/
│       └── conftest.py
├── alembic/                             # Unchanged — existing migrations
├── alembic.ini
├── pyproject.toml                       # Replaces requirements.txt
├── Dockerfile
├── docker-compose.yml
├── k8s/
│   ├── namespace.yaml
│   ├── deployment.yaml
│   ├── service.yaml
│   ├── configmap.yaml
│   ├── secret.yaml
│   └── ingress.yaml
├── helm/
│   └── medrecords/
│       ├── Chart.yaml
│       ├── values.yaml
│       └── templates/
│           ├── deployment.yaml
│           ├── service.yaml
│           ├── ingress.yaml
│           ├── configmap.yaml
│           └── hpa.yaml
└── run.py                               # Uvicorn entrypoint (updated import)
```

### Changes Required

Assuming our root cause analysis is correct:

**1. Domain Layer — Repository Interfaces (Ports)**

Define abstract base classes for each aggregate root:

```python
# src/domain/repositories/patient_repository.py
from abc import ABC, abstractmethod
from typing import Optional
from src.domain.entities.patient import PatientEntity
from src.common.pagination import PaginatedResult, PaginationParams

class PatientRepository(ABC):
    @abstractmethod
    async def get_by_id(self, patient_id: int) -> Optional[PatientEntity]: ...
    
    @abstractmethod
    async def get_by_contact_number(self, contact: str) -> Optional[PatientEntity]: ...
    
    @abstractmethod
    async def list_paginated(
        self, params: PaginationParams, doctor_id: Optional[int] = None, search: str = ""
    ) -> PaginatedResult[PatientEntity]: ...
    
    @abstractmethod
    async def add(self, patient: PatientEntity) -> PatientEntity: ...
    
    @abstractmethod
    async def count_all(self) -> int: ...
```

**2. Domain Layer — Entities**

Framework-agnostic dataclasses representing business concepts:

```python
# src/domain/entities/patient.py
from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Optional

@dataclass
class PatientEntity:
    id: Optional[int] = None
    patient_uid: str = ""
    first_name: str = ""
    last_name: str = ""
    date_of_birth: date = field(default_factory=date.today)
    gender: str = ""
    contact_number: str = ""
    email: Optional[str] = None
    registered_by: Optional[int] = None
    is_active: bool = True
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
```

**3. Application Layer — Use Cases**

Each use case encapsulates one business operation:

```python
# src/application/use_cases/patients/register_patient.py
from dataclasses import dataclass
from src.domain.repositories.patient_repository import PatientRepository
from src.domain.repositories.audit_log_repository import AuditLogRepository
from src.domain.services.patient_uid_generator import PatientUidGenerator
from src.application.interfaces.unit_of_work import UnitOfWork
from src.domain.exceptions import ConflictError

@dataclass
class RegisterPatientCommand:
    first_name: str
    last_name: str
    date_of_birth: date
    gender: str
    contact_number: str
    email: Optional[str]
    actor_id: int
    actor_username: str
    actor_role: str

class RegisterPatientUseCase:
    def __init__(
        self,
        patient_repo: PatientRepository,
        audit_repo: AuditLogRepository,
        uid_generator: PatientUidGenerator,
        uow: UnitOfWork,
    ):
        self._patient_repo = patient_repo
        self._audit_repo = audit_repo
        self._uid_generator = uid_generator
        self._uow = uow

    async def execute(self, command: RegisterPatientCommand) -> PatientEntity:
        async with self._uow:
            existing = await self._patient_repo.get_by_contact_number(command.contact_number)
            if existing is not None:
                raise ConflictError(f"A patient with contact number '{command.contact_number}' already exists")
            
            patient_uid = await self._uid_generator.generate_next()
            patient = PatientEntity(
                patient_uid=patient_uid,
                first_name=command.first_name,
                ...
            )
            patient = await self._patient_repo.add(patient)
            await self._audit_repo.add(...)
            await self._uow.commit()
            return patient
```

**4. Infrastructure Layer — Repository Implementations**

```python
# src/infrastructure/persistence/repositories/sqlalchemy_patient_repository.py
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from src.domain.repositories.patient_repository import PatientRepository
from src.infrastructure.persistence.models.patient_model import PatientModel

class SQLAlchemyPatientRepository(PatientRepository):
    def __init__(self, session: AsyncSession):
        self._session = session

    async def get_by_id(self, patient_id: int) -> Optional[PatientEntity]:
        result = await self._session.execute(
            select(PatientModel).where(PatientModel.id == patient_id)
        )
        model = result.scalar_one_or_none()
        return self._to_entity(model) if model else None
    
    # ... implements all abstract methods
```

**5. Unit of Work Implementation**

```python
# src/infrastructure/persistence/unit_of_work.py
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from src.application.interfaces.unit_of_work import UnitOfWork

class SQLAlchemyUnitOfWork(UnitOfWork):
    def __init__(self, session_factory: async_sessionmaker):
        self._session_factory = session_factory
        self._session: Optional[AsyncSession] = None

    async def __aenter__(self):
        self._session = self._session_factory()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if exc_type:
            await self.rollback()
        await self._session.close()

    async def commit(self):
        await self._session.commit()

    async def rollback(self):
        await self._session.rollback()

    @property
    def session(self) -> AsyncSession:
        return self._session
```

**6. DI Container Setup**

```python
# src/config/container.py
from dependency_injector import containers, providers
from src.infrastructure.persistence.database import create_session_factory
from src.infrastructure.persistence.repositories.sqlalchemy_patient_repository import SQLAlchemyPatientRepository
from src.infrastructure.persistence.unit_of_work import SQLAlchemyUnitOfWork
from src.application.use_cases.patients.register_patient import RegisterPatientUseCase

class Container(containers.DeclarativeContainer):
    config = providers.Configuration()
    
    session_factory = providers.Singleton(
        create_session_factory,
        database_url=config.async_database_url,
    )
    
    unit_of_work = providers.Factory(
        SQLAlchemyUnitOfWork,
        session_factory=session_factory,
    )
    
    # Repositories
    patient_repository = providers.Factory(
        SQLAlchemyPatientRepository,
        session=providers.Dependency(),  # Injected from UoW session
    )
    
    # Use cases
    register_patient_use_case = providers.Factory(
        RegisterPatientUseCase,
        patient_repo=patient_repository,
        audit_repo=audit_log_repository,
        uid_generator=patient_uid_generator,
        uow=unit_of_work,
    )
```

**7. Middleware — Correlation ID**

```python
# src/api/middleware/correlation_id.py
import uuid
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

CORRELATION_HEADER = "X-Correlation-ID"

class CorrelationIdMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        correlation_id = request.headers.get(CORRELATION_HEADER, str(uuid.uuid4()))
        request.state.correlation_id = correlation_id
        response = await call_next(request)
        response.headers[CORRELATION_HEADER] = correlation_id
        return response
```

**8. Middleware — Structured Logging**

```python
# src/api/middleware/structured_logging.py
import structlog
import time
from starlette.middleware.base import BaseHTTPMiddleware

class StructuredLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        start = time.perf_counter()
        structlog.contextvars.bind_contextvars(
            correlation_id=request.state.correlation_id,
            method=request.method,
            path=request.url.path,
        )
        response = await call_next(request)
        duration_ms = (time.perf_counter() - start) * 1000
        logger = structlog.get_logger()
        logger.info("request_completed", status=response.status_code, duration_ms=round(duration_ms, 2))
        structlog.contextvars.unbind_contextvars("correlation_id", "method", "path")
        return response
```

**9. Middleware — Exception Handler**

```python
# src/api/middleware/exception_handler.py
from fastapi import Request
from fastapi.responses import JSONResponse
from src.domain.exceptions import DomainError, NotFoundError, ConflictError, ForbiddenError

async def domain_exception_handler(request: Request, exc: DomainError):
    status_map = {
        NotFoundError: 404,
        ConflictError: 409,
        ForbiddenError: 403,
    }
    status_code = status_map.get(type(exc), 400)
    return JSONResponse(status_code=status_code, content={"detail": str(exc)})
```

**10. Celery Background Processing**

```python
# src/infrastructure/celery/celery_app.py
from celery import Celery
from src.config.settings import get_settings

settings = get_settings()

celery_app = Celery(
    "medrecords",
    broker=settings.celery_broker_url,  # redis://redis:6379/0
    backend=settings.celery_result_backend,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    beat_schedule=settings.celery_beat_schedule,
)
```

```python
# src/infrastructure/celery/tasks/lock_assessments.py
from src.infrastructure.celery.celery_app import celery_app

@celery_app.task(name="lock_expired_assessments", bind=True, max_retries=3)
def lock_expired_assessments(self):
    """Celery task replacing APScheduler for assessment locking."""
    import asyncio
    asyncio.run(_lock_expired_assessments_async())
```

**11. OpenTelemetry Observability**

```python
# src/infrastructure/observability/telemetry.py
from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor

def setup_telemetry(app, engine):
    provider = TracerProvider()
    processor = BatchSpanProcessor(OTLPSpanExporter())
    provider.add_span_processor(processor)
    trace.set_tracer_provider(provider)
    FastAPIInstrumentor.instrument_app(app)
    SQLAlchemyInstrumentor().instrument(engine=engine.sync_engine)
```

**12. Health & Readiness Probes**

```python
# src/infrastructure/observability/health.py
from fastapi import APIRouter
from sqlalchemy import text

health_router = APIRouter(tags=["Health"])

@health_router.get("/health")
async def health():
    return {"status": "ok", "service": "MEDRecords API"}

@health_router.get("/ready")
async def readiness(db=Depends(get_db)):
    await db.execute(text("SELECT 1"))
    return {"status": "ready"}
```

**13. API Versioning Structure**

```python
# src/api/v1/router.py
from fastapi import APIRouter
from src.api.v1 import patients, assessments, prescriptions, ...

v1_router = APIRouter(prefix="/api/v1")
v1_router.include_router(patients.router, prefix="/patients", tags=["Patients"])
v1_router.include_router(assessments.router, prefix="/assessments", tags=["Assessments"])
# ... all existing routes mounted under v1
```

**14. Deployment Infrastructure**

- **Dockerfile**: Multi-stage build (builder + runtime), non-root user, health check
- **docker-compose.yml**: API, PostgreSQL, Redis, Celery worker, Celery beat
- **Kubernetes manifests**: Deployment, Service, ConfigMap, Secret, Ingress, HPA
- **Helm chart**: Parameterized deployment for multi-environment rollout

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the architectural debt on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the architectural violation BEFORE implementing the fix. Confirm or refute the root cause analysis.

**Test Plan**: Write tests that attempt to instantiate business logic (patient registration, access control) without a database connection. Run these tests on the UNFIXED code to observe failures proving the coupling.

**Test Cases**:
1. **Unit Test Isolation Failure**: Attempt to import and call `register_patient` logic without a live database session (will fail because logic is in router requiring `AsyncSession`)
2. **Mock Repository Injection Failure**: Attempt to inject a mock data access layer (will fail because no interface exists to mock)
3. **Correlation ID Absence**: Send a request and check for `X-Correlation-ID` in response headers (will fail — no middleware exists)
4. **Structured Log Verification**: Check log output format after a request (will fail — logs are unstructured)

**Expected Counterexamples**:
- ImportError or AttributeError when trying to isolate business logic from router
- No way to substitute a fake repository because `select(Patient)` is hardcoded
- Missing `X-Correlation-ID` header in all responses
- Log output is plain text, not structured JSON

### Fix Checking

**Goal**: Verify that for all modules where the bug condition holds, the refactored module correctly implements Clean Architecture layering.

**Pseudocode:**
```
FOR ALL module WHERE isBugCondition(module) DO
  result := refactored_module(module)
  ASSERT result.domain_entity_exists = TRUE
  ASSERT result.repository_interface_exists = TRUE
  ASSERT result.use_case_class_exists = TRUE
  ASSERT result.router_delegates_to_use_case = TRUE
  ASSERT result.no_orm_imports_in_router = TRUE
  ASSERT result.di_container_wires_dependencies = TRUE
END FOR
```

### Preservation Checking

**Goal**: Verify that for all external HTTP requests, the refactored system returns identical responses to the original system.

**Pseudocode:**
```
FOR ALL request WHERE NOT isBugCondition(request) DO
  ASSERT original_system_response(request) = refactored_system_response(request)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many random valid API requests across all endpoints
- It catches subtle differences in response shapes, status codes, or error messages
- It provides strong guarantees that no regression is introduced for any combination of inputs

**Test Plan**: Capture response snapshots from UNFIXED code for all endpoints with various inputs, then write property-based tests verifying the refactored code produces identical outputs.

**Test Cases**:
1. **API Response Shape Preservation**: For each endpoint, verify response JSON structure matches original schema exactly
2. **Authentication Flow Preservation**: Verify JWT validation, token expiry, and user lookup produce same results
3. **Doctor-Scope Preservation**: Verify doctor-scoped queries return same patient sets
4. **Audit Log Preservation**: Verify mutation operations produce identical audit log entries
5. **Error Response Preservation**: Verify invalid inputs produce same HTTP status codes and error detail messages

### Unit Tests

- Test each use case class in isolation with mock repositories
- Test domain entity validation rules (PatientUid format, contact uniqueness)
- Test domain services (UID generation, access control logic)
- Test value objects (PatientUid, ContactNumber)
- Test DI container wiring resolves correct implementations

### Property-Based Tests

- Generate random patient registration payloads and verify UID generation is always sequential and formatted correctly
- Generate random authenticated requests and verify doctor-scoping always filters correctly
- Generate random search terms and verify pagination math is correct (total_pages, offset calculations)
- Generate random JWT tokens (valid/invalid/expired) and verify auth responses match original behavior

### Integration Tests

- Test full request lifecycle through API → Use Case → Repository → Database
- Test that middleware chain (correlation ID → logging → exception handler) works end-to-end
- Test Celery task execution for assessment locking produces same results as APScheduler
- Test Docker container builds and starts successfully with health check passing
- Test Alembic migrations still apply cleanly against the restructured codebase
