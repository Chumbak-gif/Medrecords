# Implementation Plan

## Overview

Restructure the MEDRecords backend from a flat single-layer architecture (`backend/app/`) into Clean Architecture layers (`backend/src/`) using the Strangler Fig pattern. This focused plan covers domain, application, infrastructure, and API layers for the core domains (patients, assessments, auth), with DI container wiring, middleware, and migration cleanup.

## Task Dependency Graph

```json
{
  "waves": [
    ["1", "2"],
    ["3"],
    ["4"],
    ["5"]
  ]
}
```

## Tasks

- [ ] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Clean Architecture Layer Violation
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the architectural debt exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate business logic cannot be tested in isolation without a database
  - **Scoped PBT Approach**: Scope the property to concrete failing cases: attempt to instantiate patient registration logic without a DB session, inject a mock repository, and verify correlation ID header presence
  - Test 1: Attempt to import and invoke patient registration business logic with a mock repository — will fail because logic is embedded in router with hardcoded SQLAlchemy queries, no repository interface exists
  - Test 2: Attempt to instantiate doctor-scoped access control without a live database — will fail because scoping logic is inline in router handlers
  - Test 3: Send a request and assert `X-Correlation-ID` header exists in response — will fail because no correlation ID middleware exists
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests FAIL (this is correct — it proves the architectural debt exists)
  - Document counterexamples found: ImportError/AttributeError when isolating business logic, no interface to mock, missing correlation header
  - Mark task complete when tests are written, run, and failures are documented
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [ ] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - API Contract Stability
  - **IMPORTANT**: Follow observation-first methodology
  - Observe: Capture response payload shapes and HTTP status codes from existing endpoints (patients, assessments, auth) on unfixed code
  - Observe: Capture JWT auth flow responses (valid token → 200, invalid → 401)
  - Observe: Capture doctor-scoped patient list (doctor sees only their patients)
  - Observe: Capture audit log creation on mutation operations
  - Write property-based tests: for all valid authenticated requests to existing endpoints, response payload shape and status codes match observed baseline
  - Write property-based tests: for all doctor-scoped queries, same patient set is returned
  - Verify tests pass on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.7, 3.8_

- [ ] 3. Fix for Clean Architecture layer restructuring

  - [ ] 3.1 Create domain layer (entities, repository interfaces, domain services)
    - Create `backend/src/domain/entities/` with framework-agnostic dataclasses: PatientEntity, AssessmentEntity, UserEntity, AuditLogEntity
    - Create `backend/src/domain/value_objects/` with PatientUid (PAT-XXXXXX format) and ContactNumber
    - Create `backend/src/domain/repositories/` with ABC interfaces: PatientRepository, AssessmentRepository, UserRepository, AuditLogRepository
    - Create `backend/src/domain/services/` with PatientUidGenerator interface and AccessControlService (doctor-scoping, role-based permissions)
    - Create `backend/src/domain/exceptions.py` with DomainError, NotFoundError, ConflictError, ForbiddenError
    - _Bug_Condition: isBugCondition(module) where module.has_no_repository_interface = TRUE OR module.has_no_domain_entity_separation = TRUE_
    - _Expected_Behavior: result.domain_entity_exists = TRUE AND result.repository_interface_exists = TRUE_
    - _Preservation: Domain entities must represent same data as existing ORM models (same fields, same constraints)_
    - _Requirements: 2.1, 2.2, 2.3, 3.7_

  - [ ] 3.2 Create application layer (use cases, UoW interface, DTOs)
    - Create `backend/src/application/interfaces/unit_of_work.py` with UnitOfWork ABC (async context manager, commit, rollback)
    - Create `backend/src/application/use_cases/patients/` with RegisterPatientUseCase, ListPatientsUseCase, GetPatientUseCase, UpdatePatientUseCase, DeletePatientUseCase
    - Create `backend/src/application/use_cases/assessments/` with CreateAssessmentUseCase, ListAssessmentsUseCase, UpdateAssessmentUseCase, LockExpiredAssessmentsUseCase
    - Create `backend/src/application/use_cases/auth/` with LoginUseCase, GetCurrentUserUseCase
    - All use cases accept repository interfaces via constructor injection — no direct ORM or DB imports
    - _Bug_Condition: isBugCondition(module) where module.business_logic_in_router = TRUE OR module.no_use_case_layer = TRUE_
    - _Expected_Behavior: result.use_case_class_exists = TRUE AND result.router_only_calls_use_cases = TRUE_
    - _Preservation: Business logic (UID generation, doctor-scoping, audit logging) must produce identical results_
    - _Requirements: 2.1, 2.2, 2.3, 3.3, 3.4, 3.5, 3.6, 3.7_

  - [ ] 3.3 Create infrastructure layer (repository implementations, UoW, database)
    - Create `backend/src/infrastructure/persistence/database.py` (async engine + session factory, pool_size=10, max_overflow=20, pool_pre_ping=True)
    - Create `backend/src/infrastructure/persistence/models/` relocating existing ORM model definitions (same tables, no schema changes)
    - Create `backend/src/infrastructure/persistence/repositories/` with SQLAlchemyPatientRepository, SQLAlchemyAssessmentRepository, SQLAlchemyUserRepository, SQLAlchemyAuditLogRepository implementing domain interfaces
    - Create `backend/src/infrastructure/persistence/unit_of_work.py` with SQLAlchemyUnitOfWork
    - _Bug_Condition: isBugCondition(module) where module.router_imports_orm_models = TRUE OR module.no_repository_interface = TRUE_
    - _Expected_Behavior: result.has_repository_interface = TRUE AND ORM models isolated in infrastructure layer_
    - _Preservation: Same connection pool settings, same table mappings, same query semantics_
    - _Requirements: 2.1, 2.2, 3.8_

  - [ ] 3.4 Create config, DI container, and API layer with middleware
    - Create `backend/src/config/settings.py` (Pydantic BaseSettings with all existing config values)
    - Create `backend/src/config/container.py` (dependency-injector wiring: settings → session_factory → repositories → use cases)
    - Create `backend/src/api/middleware/correlation_id.py` (generate/propagate X-Correlation-ID)
    - Create `backend/src/api/middleware/structured_logging.py` (structlog with JSON, bind correlation_id + method + path)
    - Create `backend/src/api/middleware/exception_handler.py` (map domain exceptions to HTTP status codes)
    - Create `backend/src/api/v1/router.py` aggregating all v1 routers under /api/v1
    - Create v1 routers (patients, assessments, auth, and remaining modules) that ONLY delegate to injected use cases — no ORM imports
    - Create `backend/src/api/v1/dependencies/auth.py` (JWT validation via GetCurrentUserUseCase, preserving HS256 + same secret_key)
    - Create `backend/src/main.py` app factory (DI init, middleware stack, router mounting, CORS, scheduler)
    - Update `backend/run.py` to import from `src.main`
    - _Bug_Condition: isBugCondition(module) where module.no_di_container = TRUE OR module.no_observability = TRUE_
    - _Expected_Behavior: result.di_container_injects_dependencies = TRUE AND result.structured_logging_enabled = TRUE_
    - _Preservation: Same endpoint paths, same response shapes, same CORS config, same auth flow_
    - _Requirements: 2.1, 2.2, 2.4, 2.7, 2.8, 3.1, 3.2_

  - [ ] 3.5 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Clean Architecture Layer Compliance
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior: business logic instantiable without DB, mock repos injectable, correlation ID present
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms architectural debt is fixed)
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [ ] 3.6 Verify preservation tests still pass
    - **Property 2: Preservation** - API Contract Stability
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions in API contracts)
    - Confirm all existing endpoints return same response shapes and status codes
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.7, 3.8_

- [ ] 4. Remove old flat structure
  - Remove `backend/app/routers/` (logic now in `backend/src/api/v1/`)
  - Remove `backend/app/models/` (models now in `backend/src/infrastructure/persistence/models/`)
  - Remove `backend/app/schemas/` (replaced by application DTOs and API schemas)
  - Remove `backend/app/dependencies/` (replaced by `backend/src/api/v1/dependencies/`)
  - Remove `backend/app/services/` (replaced by domain services and use cases)
  - Remove `backend/app/main.py` and `backend/app/__init__.py`
  - Update `alembic/env.py` to import models from `src/infrastructure/persistence/models/`
  - Run full test suite to confirm no breakage
  - _Requirements: 2.1, 2.2, 2.3_

- [ ] 5. Checkpoint - Ensure all tests pass
  - Run full test suite (unit + property-based + integration)
  - Verify bug condition test passes (architectural compliance confirmed)
  - Verify preservation tests pass (no API regressions)
  - Verify application starts and serves requests correctly
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- This refactoring uses the Strangler Fig pattern: new layers are built alongside existing code, then old code is removed only after verification.
- No database schema changes are made — ORM models are relocated but map to the same tables.
- The `dependency-injector` library is used for DI container wiring; `structlog` for structured logging.
- All existing API endpoint paths, response shapes, and auth behavior must remain byte-for-byte identical to callers.
