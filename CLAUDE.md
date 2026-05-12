# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Solution Overview

AgentPM is a project management tool with an AI agent layer. It is split into:
- **`AgentPM.Api`** — ASP.NET Core 10 Web API (controllers, SignalR hub, EventLogger service)
- **`AgentPM.Application`** — MediatR handlers, commands, queries, DTOs, and AI agent/tools
- **`AgentPM.Domain`** — Entities, interfaces, LLM models
- **`AgentPM.Infrastructure`** — EF Core + PostgreSQL (pgvector), Anthropic/Voyage HTTP clients, repositories
- **`agentpm-frontend`** — React 18 + Vite SPA, Tailwind CSS, MSAL authentication

## Running the Project

**Backend:**
```bash
cd AgentPM.Api
dotnet run
# Listens on http://localhost:5157 and https://localhost:7259
# Runs EF migrations automatically at startup
```

**Frontend:**
```bash
cd agentpm-frontend
npm install
npm run dev
# Always runs on http://localhost:5173 (strictPort: true)
```

**Database:** PostgreSQL on `localhost:5432`, database `agentpm_db`, user `postgres`, password `admin`. Requires the `pgvector` extension.

## Building & Linting

```bash
# Backend build
dotnet build

# Frontend lint
cd agentpm-frontend && npm run lint

# Frontend production build
cd agentpm-frontend && npm run build
```

**EF Core migrations** (run from solution root):
```bash
dotnet ef migrations add <MigrationName> --project AgentPM.Infrastructure --startup-project AgentPM.Api
dotnet ef database update --project AgentPM.Infrastructure --startup-project AgentPM.Api
```

## Architecture

### Backend Identity Model
Authentication is handled entirely by the frontend (MSAL/Azure AD). The backend **does not validate JWTs** — it cannot reach `login.microsoftonline.com` from this network. Identity flows via headers:
- `X-User-Id` — GUID of the current user (set by `api.js` from sessionStorage on every axios request)
- `X-Azure-Email` + `X-Azure-Name` — sent only to `GET /api/auth/me` to upsert the user record

`ProjectController` and all others read `X-User-Id` directly, falling back to a hardcoded dev GUID if the header is absent. `AuthController.Me()` uses `X-Azure-Email` to find/create the DB user and returns the user's GUID, which the frontend then stores in sessionStorage.

### CQRS with MediatR
Application logic uses MediatR. Controllers send commands/queries; handlers live in `AgentPM.Application/Features/{Domain}/Handlers/`. The pattern is: controller → `_mediator.Send(new XxxCommand(...))` → handler → repository/DbContext.

`TaskController` and `SprintController` bypass MediatR for operations that require cross-aggregate state changes (cascade status updates) and use `AppDbContext` directly.

### Cascade State Machine
Status transitions are enforced in controllers, not domain events:
- Task added to a closed sprint → sprint reopened → project reactivated
- Task deleted → if all remaining tasks are done → sprint auto-closed → if all sprints closed → project auto-completed
- Sprint deleted → tasks set to `SprintId = null` (backlog), not deleted (`IsRequired(false)`)
- Sprint added to completed project → project set back to "active"

Controllers return flags (`sprintReopened`, `projectReactivated`, `projectAutoCompleted`) which the frontend uses to trigger a UI refresh.

### EventLogger
`EventLogger` (scoped service in `AgentPM.Api/Services/`) appends audit events to `event_store`. It does **not** call `SaveChangesAsync` — the caller must do that. It handles both DB-persisted and EF Local-tracked entries to avoid version conflicts within a single request.

### AI Agent
`AgentOrchestrator` routes by `AgentIntent` (Decompose, Estimate, Search, Report, or free Chat). Tools in `AgentPM.Application/Agent/` use:
- **Anthropic Claude** (via `AnthropicClient`) for generation — model/token settings come from `appsettings.json` → `Anthropic` section
- **Voyage AI** (via the same `AnthropicClient`) for embeddings (1536-dim vectors stored in `task_embeddings` using `pgvector`)

The agent is exposed via REST (`/api/agent/*`) and conversation history is persisted in `AgentConversations` / `AgentMessages`.

### Frontend Auth Flow
`AuthGuard` (wraps the entire app) calls `getToken()` via MSAL, sets the axios `Authorization` header, then calls `GET /api/auth/me` to upsert the user and get their DB id. For returning users (userId in sessionStorage) this is fire-and-forget; for first logins it awaits with a 25 s timeout. The app always unlocks via `finally { setReady(true) }`.

Azure profile photo is fetched separately from Microsoft Graph with `User.Read` scope. If consent is not yet granted a "Photo" button appears in the Navbar to trigger the popup.

### Frontend Data Flow
- `src/api/api.js` — axios instance (base URL `http://localhost:5157/api`, 30 s timeout). Restores `X-User-Id` from sessionStorage on module load.
- `src/api/projectApi.js`, `sprintApi.js`, `taskApi.js`, `agentApi.js` — thin wrappers, return `r.data`
- `src/auth/authConfig.js` — MSAL config + `loginRequest`, `apiRequest`, `graphRequest` (kept separate — MSAL v5 does not allow mixing resource scopes in one request)
- `src/utils/graphPhoto.js` — must stay a non-component file (Vite Fast Refresh constraint)

### CORS
Backend allows any `localhost` origin (`SetIsOriginAllowed(uri.Host == "localhost")`). Frontend is pinned to port 5173 (`strictPort: true` in `vite.config.js`).

## Key Configuration

`appsettings.json` (not committed: `appsettings.Development.json` for secrets):
- `ConnectionStrings:DefaultConnection` — PostgreSQL connection string
- `Anthropic:ApiKey`, `Anthropic:BaseUrl`, `Anthropic:VoyageApiKey` — AI keys

Frontend MSAL config is in `src/auth/authConfig.js` (tenant id, client ids hardcoded for the Alexsys Azure AD tenant).
