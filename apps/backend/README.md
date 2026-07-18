# AstroCalc Backend

Express + TypeScript API. Currently implements Google OAuth (issue #2).

## Setup

```bash
cd apps/backend
npm install
cp .env.example .env   # fill in GOOGLE_CLIENT_IDS, JWT secrets, DATABASE_URL
npm run db:generate && npm run db:migrate   # apply the Drizzle schema to Neon
npm run dev
```

## Auth flow: `POST /auth/google`

Request:

```json
{ "idToken": "<Google ID token from the mobile app>" }
```

The handler:

1. Verifies the ID token with `google-auth-library` (signature against Google's
   JWKS, plus explicit `aud` / `iss` / `exp` / `email_verified` checks — see
   `src/auth/googleVerifier.ts`).
2. Finds the user by Google id; else links a pre-existing account with the same
   email; else creates a new user **and** a profile record.
3. Opens a session and issues a JWT access + refresh token pair.

Success (`200`):

```json
{
  "user": { "id": "...", "email": "...", "googleId": "..." },
  "accessToken": "...",
  "refreshToken": "...",
  "isNewUser": true
}
```

Failure returns a stable, client-readable shape — `400` for bad input, `401`
for token verification failure:

```json
{ "error": { "code": "google_token_invalid", "message": "Google token verification failed: ..." } }
```

## Testing

```bash
npm test        # Vitest — verifier, token service, auth service, route
npm run typecheck
```

The auth service is tested against an in-memory repository
(`src/auth/repository.ts`); production wiring uses the Drizzle/Neon repository
(`src/db/drizzleUserRepository.ts`).
