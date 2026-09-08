# Bugfix Requirements Document

## Introduction

The MEDRecords backend (`backend/`) suffers from severe architectural debt that prevents enterprise-scale deployment. The codebase uses a flat single-layer structure where FastAPI routers directly access SQLAlchemy ORM models, embed business logic, and perform raw database queries without any abstraction. This violates Clean Architecture, Domain-Driven Design (DDD), Hexagonal Architecture (Ports & Adapters), and SOLID principles. The "bug" is this structural debt — the system cannot be properly tested in isolation, cannot scale horizontally, cannot evolve its persistence layer independently, and lacks observability, background processing, and deployment infrastructure required for enterprise production use.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a developer attempts to unit-test business logic THEN the system requires a live database connection because business logic is embedded directly in router handlers alongside SQLAlchemy queries with no separation

1.2 WHEN a developer attempts to swap or mock the persistence layer THEN the system fails because routers import ORM models and execute raw SQLAlchemy queries directly with no repository abstraction or port/adapter interface

1.3 WHEN a developer attempts to reuse domain logic across different entry points (API, CLI, background jobs) THEN the system cannot provide this because domain rules are scattered inside individual router functions with no dedicated domain layer

1.4 WHEN the system processes a request THEN it produces no correlation ID, no structured logging, and no distributed tracing telemetry because no observability infrastructure exists

1.5 WHEN the system needs to run long-running or scheduled tasks (email notifications, report generation, data exports) THEN it blocks the request thread or uses an in-process scheduler (APScheduler) because no background processing layer (Celery/Redis) exists

1.6 WHEN the system needs to be deployed to a production environment THEN it lacks containerization best practices, orchestration manifests, and health/readiness probes because no deployment infrastructure (Dockerfile, Kubernetes, Helm) is defined

1.7 WHEN the API needs to evolve with breaking changes THEN it cannot version endpoints independently because there is no API versioning structure — all routes use a single hardcoded `/api/v1` prefix with no mechanism for v2 coexistence

1.8 WHEN a developer attempts to configure the application for different environments THEN the system provides only a single flat `Settings` class with no dependency injection container, no feature flags, and no environment-specific configuration layering

### Expected Behavior (Correct)

2.1 WHEN a developer attempts to unit-test business logic THEN the system SHALL allow testing use cases and domain logic in isolation by injecting mock repository implementations through well-defined port interfaces, without requiring any database connection

2.2 WHEN a developer attempts to swap or mock the persistence layer THEN the system SHALL support this through repository interfaces (ports) defined in the domain layer, with concrete implementations (adapters) in the infrastructure layer that can be substituted via dependency injection

2.3 WHEN a developer attempts to reuse domain logic across different entry points THEN the system SHALL provide a dedicated domain layer with entities, value objects, and domain services that are framework-agnostic and can be invoked from API handlers, CLI commands, or background workers via application-layer use cases

2.4 WHEN the system processes a request THEN it SHALL assign a correlation ID, emit structured JSON logs with request context, and produce OpenTelemetry traces/spans for distributed tracing observability

2.5 WHEN the system needs to run long-running or scheduled tasks THEN it SHALL dispatch them to a Celery worker backed by Redis as the broker, decoupling background processing from the request-response cycle

2.6 WHEN the system needs to be deployed to a production environment THEN it SHALL provide a multi-stage Dockerfile, docker-compose for local development, Kubernetes manifests, Helm charts, and proper health/readiness probe endpoints

2.7 WHEN the API needs to evolve with breaking changes THEN it SHALL support multiple API versions (v1, v2) coexisting simultaneously through a versioned router structure under `src/api/v1/` and `src/api/v2/`

2.8 WHEN a developer attempts to configure the application for different environments THEN the system SHALL provide a dependency injection container, environment-specific settings profiles, and a feature flag mechanism to control behavior without code changes

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a client sends a valid authenticated request to any existing API endpoint (patients, assessments, prescriptions, analytics, exports, audit, config, users, diseases, templates, followups, auth) THEN the system SHALL CONTINUE TO return the same response payload shape and HTTP status codes as the current implementation

3.2 WHEN a client authenticates with valid JWT credentials THEN the system SHALL CONTINUE TO validate tokens using the same HS256 algorithm and secret key configuration, returning the authenticated user context

3.3 WHEN a doctor-role user accesses patient data THEN the system SHALL CONTINUE TO enforce doctor-scoped access control (only patients registered by the doctor or with assessments by the doctor are visible)

3.4 WHEN an admin/sys_admin user performs administrative actions THEN the system SHALL CONTINUE TO allow full access per the existing role-based permission model

3.5 WHEN a mutation operation occurs (create, update, delete) THEN the system SHALL CONTINUE TO record audit log entries with actor identity, event type, entity reference, and description

3.6 WHEN the application starts THEN it SHALL CONTINUE TO run the assessment lock scheduler that auto-locks assessments based on configurable time windows

3.7 WHEN a patient is registered THEN the system SHALL CONTINUE TO generate sequential patient UIDs in the format PAT-XXXXXX and enforce unique contact number constraints

3.8 WHEN the database connection is established THEN the system SHALL CONTINUE TO use async SQLAlchemy with asyncpg driver, connection pooling (pool_size=10, max_overflow=20), and pool_pre_ping health checking

---

## Bug Condition (Formal)

```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type BackendModule
  OUTPUT: boolean
  
  // Returns true when any module violates Clean Architecture layering
  RETURN (X.router_imports_orm_models = TRUE)
      OR (X.business_logic_in_router = TRUE)
      OR (X.no_repository_interface = TRUE)
      OR (X.no_domain_entity_separation = TRUE)
      OR (X.no_use_case_layer = TRUE)
      OR (X.no_di_container = TRUE)
      OR (X.no_observability = TRUE)
      OR (X.no_deployment_infra = TRUE)
END FUNCTION
```

```pascal
// Property: Fix Checking — Clean Architecture Compliance
FOR ALL X WHERE isBugCondition(X) DO
  result ← refactored_module(X)
  ASSERT result.has_domain_layer = TRUE
     AND result.has_repository_interface = TRUE
     AND result.has_use_case_layer = TRUE
     AND result.router_only_calls_use_cases = TRUE
     AND result.di_container_injects_dependencies = TRUE
     AND result.structured_logging_enabled = TRUE
     AND result.deployment_manifests_exist = TRUE
END FOR
```

```pascal
// Property: Preservation Checking — API Contract Stability
FOR ALL X WHERE NOT isBugCondition(X) DO
  // All existing API contracts, auth flows, and business rules are preserved
  ASSERT original_api_response(X) = refactored_api_response(X)
END FOR
```
