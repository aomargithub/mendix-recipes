# Recipes API

REST back-end for the recipe website, built for the Mendix Developer Assignment (Stories 1-3).
It serves recipe listings, categories and recipe creation, documents itself via OpenAPI/Swagger,
and stores recipes in memory, seeded at startup from RecipeML files.

## Prerequisites

- **Java 17 or newer** — the app compiles with `--release 17` and runs on any JDK from 17 up (17, 21, 25 all work). Older versions such as Java 11 will not work; Spring Boot 4 requires at least Java 17.
- **No Maven installation needed** — the project ships with the Maven wrapper (`mvnw`), which downloads the right Maven version automatically.

## How to start the app

```bash
./mvnw spring-boot:run
```

The application starts on `http://localhost:8080` under the context path `/mendix-recipes`.
On startup it loads every RecipeML file from `src/main/resources/init/` into the in-memory store
and logs how many recipes were seeded.

### Interactive documentation

- Swagger UI: `http://localhost:8080/mendix-recipes/swagger-ui.html`
- OpenAPI spec (JSON): `http://localhost:8080/mendix-recipes/v3/api-docs`

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/v1/recipes` | All recipes. Optional search key: `q` — case-insensitive substring matched against recipe name, categories, and author (a hit on any field includes the recipe). Optional paging: `page` (zero-based) and `size`. |
| GET | `/v1/recipes/{id}` | Full details of one recipe. |
| GET | `/v1/categories` | All recipe categories. |
| GET | `/v1/categories/{category}/recipes` | Recipes in one category (unknown category returns 404). |
| POST | `/v1/recipes` | Create a recipe. Returns 201 with a `Location` header; duplicate names (case-insensitive) return 409. |

Example request:

```bash
curl -X POST http://localhost:8080/mendix-recipes/v1/recipes \
  -H "Content-Type: application/json" \
  -d '{
        "name": "My New Dish",
        "description": "A tasty dish",
        "steps": ["Step one", "Step two"],
        "ingredients": [{"name": "rice", "quantity": 2, "unit": "CUP"}],
        "author": "Me",
        "postedAt": 1757000000000,
        "postedTo": "website",
        "preparationTimeInMinutes": 20,
        "categories": ["sidedish"]
      }'
```

Supported measurement units: `LITER`, `CUP`, `TABLESPOON`, `TEASPOON`, `GRAM`, `POUND`, `PIECE`, `CAN`, `PACKAGE`, `JAR`.

## How to run the tests

```bash
./mvnw test
```

The suite follows a testing-pyramid shape: the bulk are fast unit tests (domain, DTO mapping,
service logic, controller logic, in-memory repository, RecipeML seed mapping), plus a small
number of integration tests that boot the full application and exercise the REST API end to end.
Everything runs against the in-memory store — no database or external services are required.

## Technical and Architecture Decisions

1. Hexagonal architecture: framework-free domain, application layer with ports (`RecipesRepository` for writes, `RecipeQueryPort` for reads, CQRS-lite), infrastructure adapters.
2. Immutable, self-validating records as the domain model.
3. In-memory store guarded by a single `ReentrantReadWriteLock`; lists kept sorted by (postedAt, name) at insert time. Dynamic sorting is deliberately disabled for the sake of simplicity.
4. REST API versioned under `/v1` and served under a dedicated context path.
5. RFC 7807 `ProblemDetail` error bodies with proper status codes: 400 validation, 404 not found, 409 duplicate name.
6. Listing endpoints return all results unless `page`/`size` are requested; the `sort` parameter is explicitly rejected with 400 instead of being silently ignored.
7. Search uses a single `q` parameter matched (OR) against recipe name, categories, and author for a simpler search UX. Any other query parameter is rejected with 400.
8. DTOs at the boundary only — the domain `Recipe` never leaks through REST.
9. Duplicate recipe names are rejected case-insensitively (409).
10. RecipeML seed files are parsed with Jackson XML at startup; a broken or duplicate seed file fails startup (fail fast).
11. springdoc-openapi serves live Swagger/OpenAPI documentation for API consumers.
12. Testing pyramid: the bulk are fast unit tests, plus a minimal set of end-to-end integration tests through the REST layer.
13. Spring was chosen as it is the most common framework within the backend JVM community.

## How did I use AI

1. AI was extensively used throughout the process, with me in the driver's seat at all times. I used it as a peer programmer, reviewer, and developer for a few tasks.
2. The core of the application, the overall architecture, and the tools were all my choices; I just used AI to review, double-check and polish.
3. AI was used to write the tests.
4. Some other boilerplate code was written by AI, like the error handlers, the seed data loader at startup, and this README file — except for this section, of course :).
5. OpenCode Go with GLM 5.3 was used, as it is cost-efficient, less stubborn, and easier to drive than frontier models.
6. My flow is, start with plan mode > prompt for change > loop until I am satisfied with plan > execute the plan. 
7. And to keep the context between sessions I use plan.md (Stored locally in OpenCode data dir) file to document decisions, so every new session has the full context with no need to start over from the beginning. 
