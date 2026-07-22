# API Key Security

## Core Rules

1. Never hard-code API keys.
2. Never commit real `.env` files.
3. Never expose provider keys in browser code.
4. Never print keys in logs.
5. Never send one user's BYOK key to another user's request.
6. Prefer server-side environment variables or managed secret stores.
7. Redact authorization headers, cookies, and provider request payloads in logs.

## Platform-Owned Key Mode

Platform-owned keys live only on the server.

Allowed:

- Server API route reads `OPENAI_API_KEY`, `API_FOOTBALL_KEY`, `TAVILY_API_KEY`, etc.
- Server performs provider calls.
- Client receives only final results and safe citations.

Not allowed:

- Sending provider keys to the browser.
- Including keys in streamed events.
- Storing keys in user-visible job records.

## BYOK Mode

Default BYOK behavior:

- User enters a key for one request.
- Key is sent over HTTPS to a server route.
- Server uses it only for that request.
- Server does not persist it.
- Logs store only a fingerprint, such as last 4 characters hash, never the key.

If persistent BYOK is added later:

- Encrypt keys with a managed KMS.
- Store encrypted value in a dedicated secrets table.
- Separate encryption keys from app database access.
- Provide user delete/revoke controls.

## Local Development

- Use `.env.example` as a template.
- Put real values in `.env.local`.
- Keep `.env.local` ignored by git.
- Use mock providers until explicit key setup is complete.

## Client Variable Rule

Only variables prefixed for public browser use may be exposed to the frontend, and no provider secret may ever use such a prefix.

Examples:

- Allowed public: `NEXT_PUBLIC_APP_URL`
- Forbidden public: `NEXT_PUBLIC_OPENAI_API_KEY`
- Forbidden public: `NEXT_PUBLIC_STRIPE_SECRET_KEY`

