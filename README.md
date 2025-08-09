# Weather API Service

A modern, scalable weather service built with NestJS, focused on wind conditions and forecast, with favorites management and location search.

## Requirements Coverage At-a-Glance
- Setup and installation instructions: Added (see “Setup & Installation” and “Running”).
- Architecture overview (1–2 pages): Added (see “Architecture Overview”).
- Technology choices and justifications: Added (see “Technology Choices & Why”).
- Known limitations or assumptions: Added (see “Known Limitations & Assumptions”).
- Future improvement suggestions: Added (see “Future Improvements”).

What’s still missing (nice-to-have docs):
- Full production runbook (alerts/SLIs/SLOs).
- Detailed threat model and security hardening guide.
- Ops examples for scaling horizontally and blue/green deploys.

---

## Setup & Installation

1) Prerequisites
- Node.js 18+
- Yarn
- Docker (recommended for Postgres and Redis)
  - OpenWeather API key

  2) Install dependencies
    
      ```
     yarn install
     cp .env.example .env
      ```
3) Configure environment
- Copy the example file and set values:

- Set OPENWEATHER_API_KEY=<your_api_key>
- For local dev without Redis, set USE_REDIS=false.

4) Start dependencies (recommended via Docker)
   bash
    ### Postgres
    ```
    docker run --name weather-db
    -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres
    -e POSTGRES_DB=weather_db -p 5432:5432 -d postgres:16-alpine
    # Redis (optional; for best rate limiting/caching in dev)
    docker run --name weather-redis -p 6379:6379 -d redis:7-alpine
    
    ```

5) Database migrations
   - If you maintain migrations, run them here (example):
       ```
       yarn typeorm migration:run
       ```
     Start the application
       ```
       yarn start:dev
       ```
     Production
       ```
       yarn build yarn start:prod
       ```
     Lint & Format
     ```
       yarn lint
       yarn format
     ```
     Testing
     ```
       yarn test
       yarn test:cov
       yarn test:e2e
    ```

Swagger/OpenAPI
- http://localhost:3000/api

---

## Architecture Overview

This service is structured around a clean, modular NestJS architecture with strong boundaries and cross-cutting concerns handled centrally.

Core modules
- Weather Module
    - Controllers: WeatherController
    - Services: WeatherService
    - Responsibilities:
        - Wind forecast: GET /v1/weather/{lat},{lon}/forecast
        - Granular views: hourly (3-hour steps) or daily (aggregated from hourly)
        - Wind direction mapping to 16-point compass
        - Provider-aware caching (SWR) and rate limiting
- Locations Module
    - Controllers: LocationsController
    - Services: LocationsService
    - Responsibilities:
        - Favorites CRUD (per anonymous client via X-Client-Id)
        - Pagination, soft-delete, and minimal “current” wind enrichment
- Location Search Module
    - Controllers: LocationSearchController
    - Services: LocationSearchService
    - Responsibilities:
        - City lookup via OpenWeather Geo API
        - Caching and result scoring for better UX
- Shared
    - CacheSwrService: Stale-While-Revalidate helper
    - InflightRequestsService: collapses identical concurrent requests
    - RateLimiterService: Redis-first fixed window with fallback
    - Global validation, exception filters, timeouts

Request lifecycle (typical)
1) Controller validates/normalizes inputs (DTO + ValidationPipe).
2) Service enforces rate limits and checks cache.
3) On hit: respond from cache. On miss: fetch from OpenWeather, transform, cache result.
4) Errors normalized (4xx with clear messaging, 429 for rate limits, 5xx for unknown).

Caching strategy (SWR)
- Keys:
    - Current: weather:current:{lat}:{lon}:{units}
    - Forecast: weather:forecast:{lat}:{lon}:{granularity}:{units}:{range|days}
- TTL policy:
    - Current: fresh ~3m, stale ~5m
    - Forecast: fresh ~10m, stale ~15m
- Behavior:
    - Fresh: serve from cache.
    - Stale: serve stale immediately; refresh in background (in-flight dedup).
    - Miss: compute and populate (in-flight dedup to avoid thundering herd).

Rate limiting
- Multi-bucket policy:
    - Short burst: per-minute bucket (e.g., 120/min) before upstream.
    - Hourly global: aligns with OpenWeather’s free tier limit.
    - Optional per-client bucket using X-Client-Id to prevent abuse.
- Redis path: atomic INCR/EXPIRE; in-memory fallback for local dev.

Data model (favorites)
- Locations table:
    - id, name, latitude, longitude, clientId, isActive (soft-delete), updatedAt.
- Duplicate prevention:
    - App-level checks by name (case-insensitive) and near-match coordinates.
    - DB indexing recommended for performance.

Error handling
- Validation errors: 400 with field messages.
- Upstream errors: mapped to 400 or 429 (Too Many Requests).
- Unknowns: 500 with a generic message (details logged).

Security notes
- Anonymous client identity via X-Client-Id (UUID v4).
- Secrets via environment variables.
- CORS configurable per environment.

---

## Technology Choices & Why

- NestJS (TypeScript): opinionated, modular architecture; DI-first for testability and readability.
- TypeORM + Postgres: relational model suitable for favorites; mature ecosystem; SQL power when needed.
- Redis (cache-manager-redis-store): cross-instance cache and atomic counters for rate limits; fast, reliable.
- Axios: robust HTTP client with timeout control and flexible error handling.
- class-validator / class-transformer: strict input validation and normalization at the framework boundary.
- Swagger (NestJS Swagger): first-class API docs, accelerates testing and integration.
- Jest: fast unit/integration tests, snapshot support.
- Winston (or equivalent): structured logging and transport flexibility.

Tradeoffs considered
- One Call API vs 5-day/3-hour:
    - Chose 5-day/3-hour for free-tier compatibility and to avoid over-scoping; daily views are aggregated server-side.
- SWR staleness vs freshness:
    - Slight staleness acceptable for a wind-focused dashboard; significant reductions in latency and quota usage.

---

## Known Limitations & Assumptions

- Forecast horizon limited to OpenWeather’s free 5-day/3-hour dataset.
- Daily aggregation computed in UTC; timezone-specific analysis may differ slightly from local expectations.
- In-memory cache fallback (when Redis disabled) isn’t atomic across processes; fine for local dev, not for multi-instance prod.
- Anonymous client model (X-Client-Id) is not a security boundary; it’s an MVP convenience for scoping favorites.
- No full auth/role model; no per-user secure data storage beyond client scoping.
- Health checks exist at the framework level; deeper provider SLIs/SLOs and alerting are not included in this repo.

---

## Future Improvements

- Data & resilience
    - Add circuit breaker for upstream outages (open on consecutive failures; serve stale).
    - Background jobs to pre-warm popular locations and reduce on-demand provider calls.
    - Timezone-aware daily aggregation using location-specific TZ data.
- Observability
    - OpenTelemetry traces/metrics; dashboards for latency, error rates, cache hit rates.
    - Request correlation IDs with structured logs for cross-service debugging.
- Security & quotas
    - Stronger identity model and per-user quotas; IP-based throttling.
    - Secret management via a vault or managed secret store.
- API & UX
    - Optional support for OpenWeather One Call if available.
    - Extended search filters and better disambiguation for locations.
    - Websocket/SSE for live update push instead of polling.
- Ops & scale
    - Blue/green or canary deployments with automated rollbacks.
    - Hardened production Helm charts and Terraform (if targeting k8s/cloud).

---

## API Reference (Backend)

Weather
- GET /v1/weather/{lat},{lon}/forecast
    - Query:
        - units: standard | metric | imperial (default: metric)
        - granularity: hourly | daily (default: hourly)
        - hourly: range (hours, 3–120 in steps of 3; default: 24)
        - daily: days (1–7; default: 5)

Locations (requires X-Client-Id header: UUID v4)
- GET /v1/locations?page=&pageSize=&units=
- POST /v1/locations
- PATCH /v1/locations/:id
- DELETE /v1/locations/:id
- DELETE /v1/locations

Location Search
- GET /v1/location-search?query=&limit=

---

## Troubleshooting

- DB connection timeout
    - Verify DB_HOST/PORT and that Postgres is running/reachable.
    - For remote DBs, ensure firewall and SSL settings match your env.
- Redis connection refused
    - Start Redis locally or set USE_REDIS=false to use in-memory cache.
- 429 responses
    - Back off and retry later; the service enforces upstream-friendly quotas.
- 400 on forecast
    - Check lat/lon values and that you only send days for daily or range for hourly (integers, correct ranges).