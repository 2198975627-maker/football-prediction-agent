# Web And API Security

## Baseline

The app should follow OWASP web, API, and LLM safety principles:

- Validate all input.
- Authorize every object access.
- Rate limit before expensive work.
- Keep secrets server-side.
- Treat model inputs and scraped pages as untrusted.
- Sanitize rendered output.
- Log safely without secrets.

## API Controls

Every API route should include:

- Method allowlist.
- Zod schema validation.
- Authentication check where needed.
- Object ownership check.
- Rate limit.
- Request size limit.
- Structured error response.
- No stack traces in production.

## LLM Controls

Controls for prompt injection and excessive agency:

- External webpages are data, not instructions.
- Tools must have narrow schemas.
- Agent cannot call payment, refund, or balance tools directly.
- Agent cannot execute arbitrary code.
- Agent cannot browse private accounts.
- Agent cannot modify ledger records.
- The server controls workflow order.

## Output Handling

- Render markdown through a sanitizer.
- Escape HTML.
- Open external links with safe attributes.
- Do not display raw tool JSON by default.
- Do not display internal prompts.

## Data Retention

Store:

- User ID
- Prediction parameters
- Safe source citations
- Cost summary
- Final report

Avoid storing:

- BYOK plaintext keys
- Raw provider authorization headers
- Unnecessary personal details about players
- Full scraped pages unless legally and operationally required

## Deployment Checklist

- HTTPS only.
- Secure cookies.
- CSRF protection for state-changing browser routes.
- CORS allowlist.
- Security headers.
- Dependency audit in CI.
- Error monitoring with secret redaction.
- Database backups and least-privilege service roles.

