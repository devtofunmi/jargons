# Security Policy

## Reporting a vulnerability

Please **do not** report security vulnerabilities through public GitHub issues.

Instead, use one of these private channels:

- **GitHub** — open a private report via the repository's **Security** tab →
  **"Report a vulnerability"** (GitHub Security Advisories). This is preferred.
- **Email** — <olayiwolajesutofunmi@gmail.com>

Please include:

- a description of the issue and its impact,
- steps to reproduce (or a proof of concept),
- affected version / commit, and any suggested fix.

We'll acknowledge your report as soon as we can, keep you updated on progress,
and credit you once a fix ships (unless you'd prefer to stay anonymous).

## Scope

Jargons handles GitHub App credentials, webhook secrets, and database access, so
we're especially interested in reports involving:

- authentication / session handling,
- GitHub webhook signature verification,
- secret or token exposure,
- SQL injection or unsafe data handling,
- SSRF or unsafe outbound requests.

Thank you for helping keep Jargons and its users safe.
