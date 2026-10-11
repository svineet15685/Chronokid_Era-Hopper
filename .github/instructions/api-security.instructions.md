---
name: API and Database Security
description: "Apply when changing Fastify routes, request validation, identity or authorization, Drizzle schemas, SQL, database migrations, or handling secrets and user data."
applyTo:
  - "apps/api/**/*.ts"
  - "apps/api/drizzle/**/*.sql"
---

# API and Database Security

- Treat every request field, header, cookie, query parameter, and client-generated identifier as untrusted. Validate route inputs with Zod, reject invalid values, and bound strings, arrays, numeric values, and request sizes.
- Never trust client-reported score, elapsed time, lives, or era completion. The current client-side simulation can only support a casual leaderboard; state this limitation and do not describe bounds checks as cheat-proof validation.
- When identity or player-owned data is introduced, authenticate and authorize every operation at the API boundary. Verify resource ownership on each read and write; a UUID or hidden UI control is not authorization. Deny by default.
- CORS is not authentication or authorization. Keep allowed origins explicit. Add rate limiting and abuse controls before exposing write endpoints publicly.
- Use Drizzle's parameterized query APIs. If raw SQL is necessary, use tagged parameters for values; never concatenate untrusted values into SQL or identifiers.
- Keep secrets in environment variables, validate configuration at startup, and return generic client errors. Never log credentials, authorization material, full connection strings, or unnecessary personal data.
- Make database access use the least-privileged application role in deployed environments. Do not use the local Compose credentials outside local development.
- Change `apps/api/src/db/schema.ts`, generate migrations with `npm run db:generate`, and inspect the generated SQL and snapshot. Do not hand-edit generated migration metadata. Destructive data changes require an explicit rollout/backup plan and user approval.
- Add tests for invalid input, authorization boundaries, and failure paths whenever implementing a route or persistence behavior. Do not expose stack traces or database errors in responses.