# Unwind OFA

### One For All. One For Auth.

**Unwind OFA** is a unified identity and security platform designed to provide secure authentication and account management across the Unwind ecosystem.

It aims to bring identity management, password security, and application authentication together through a single platform.

---

## Overview

Unwind OFA is being developed as the central identity provider for Unwind products.

The long-term vision consists of three major components:

- **Unwind Identity** — Centralized identity management and Single Sign-On (SSO).
- **Unwind Vault** — A zero-knowledge encrypted password manager.
- **Unwind Connect** — An integration layer that allows other Unwind applications to authenticate users through OFA.

The platform prioritizes passkey-based authentication, secure account recovery, and privacy-focused architecture.

## Current Features

### Authentication and Identity
- Passkey-based account registration.
- Passkey-based sign-in.
- Passwordless authentication.
- Email verification through secure verification links.
- HTTP-only session cookies.
- Session revocation and logout.

### Passkey Security
- WebAuthn-based authentication using SimpleWebAuthn.
- Platform authenticator support.
- User verification requirements.
- Credential counter validation.
- Secure passkey registration and verification.

### Email Notifications
- Email verification notifications.
- Account registration confirmation.
- Successful sign-in security notifications.
- Emergency account lockdown links.

### Emergency Account Protection
- Emergency account lockdown through a secure email link.
- Automatic revocation of active sessions.
- Blocking authentication while an account is locked.

### Account Recovery
- Email ownership verification.
- Verification of an existing passkey.
- Replacement passkey registration.
- Removal of previous passkeys after successful recovery.
- Session revocation during recovery.
- Generation of ten one-time recovery codes.
- Secure storage of recovery-code hashes.

**Note:** Recovery-code-based authentication for users who have lost all their passkeys is planned but not yet implemented.

---

## Technology Stack

| Component | Technology |
|---|---|
| Frontend | React |
| Build Tool | Vite |
| Backend | Node.js |
| API Framework | Express.js |
| Database | Supabase PostgreSQL |
| Authentication | WebAuthn |
| Passkey Library | SimpleWebAuthn |
| Validation | Zod |
| Security Headers | Helmet |
| Email Service | Brevo |
| Frontend Routing | React Router |

## Architecture

```text
                 UNWIND OFA
                      |
          +-----------+-----------+
          |                       |
      FRONTEND                 BACKEND
     React + Vite          Node.js + Express
          |                       |
          +-----------+-----------+
                      |
                SUPABASE
                      |
          +-----------+-----------+
          |                       |
       PostgreSQL          Secure Storage
          |
     OFA Database
          |
   +------+------+-------+
   |             |       |
 Users       Passkeys  Sessions
   |
 Recovery & Security
```

### Project Structure

```text
Unwind-OFA/
|
+-- apps/
|   |
|   +-- web/
|   |   +-- src/
|   |   +-- public/
|   |   +-- package.json
|   |
|   +-- api/
|       +-- src/
|       +-- package.json
|
+-- package.json
+-- package-lock.json
+-- README.md
```

---

## Getting Started

### Prerequisites

Install the following:

- Node.js
- npm
- Git
- A Supabase project

### 1. Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/Unwind-OFA.git

cd Unwind-OFA
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Create the following environment files.

**Backend: `apps/api/.env`**

```env
PORT=4000
FRONTEND_URL=http://localhost:5173

SUPABASE_URL=your_supabase_url
SUPABASE_SECRET_KEY=your_supabase_secret_key

RP_NAME=Unwind OFA
RP_ID=localhost
EXPECTED_ORIGIN=http://localhost:5173

BREVO_API_KEY=your_brevo_api_key
BREVO_SENDER_EMAIL=your_verified_sender_email
BREVO_SENDER_NAME=Unwind OFA
```

**Frontend: `apps/web/.env`**

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
```

Never commit environment files, API keys, or other credentials to version control.

### 4. Configure Supabase

Create a Supabase project and apply the database schema and SQL functions required by the application.

The backend uses the Supabase service-role client for privileged database operations. Keep its secret key exclusively on the server.

### 5. Start the Development Servers

Start the frontend:

```bash
npm run dev
```

Start the backend in a separate terminal:

```bash
npm run dev:api
```

### 6. Open the Application

| Service | Local URL |
|---|---|
| Frontend | http://localhost:5173 |
| Backend | http://localhost:4000 |
| Health Check | http://localhost:4000/api/health |

---

## Security Principles

Unwind OFA is designed around the following principles:

1. **Passkey-first authentication** — Use WebAuthn instead of traditional passwords.
2. **Privacy by design** — Minimize exposure of sensitive authentication data.
3. **Secure sessions** — Protect session tokens using HTTP-only cookies.
4. **Server-side verification** — Verify authentication challenges and credential responses on the backend.
5. **Recovery protection** — Require multiple verification steps before replacing account credentials.
6. **Emergency control** — Allow users to lock down compromised accounts.
7. **Secret management** — Keep privileged keys and credentials out of frontend code.

The planned Unwind Vault will introduce a separate zero-knowledge encryption architecture. Identity authentication alone will not automatically unlock the password vault.

---

## Roadmap

### Completed
- [x] Initial monorepo setup.
- [x] Passkey-based registration.
- [x] Passkey-based authentication.
- [x] Email verification.
- [x] Session management.
- [x] Login security notifications.
- [x] Emergency account lockdown.
- [x] Existing-passkey account recovery.
- [x] Replacement passkey registration.
- [x] Recovery-code generation and secure storage.

### Planned
- [ ] Recovery using backup codes without an existing passkey.
- [ ] Recovery code management interface.
- [ ] OAuth 2.0 and OpenID Connect.
- [ ] Single Sign-On for Unwind applications.
- [ ] Unwind Connect integration SDK.
- [ ] Zero-knowledge encrypted password vault.
- [ ] Browser extension and autofill.
- [ ] Advanced account security dashboard.

---

## Vision

Unwind OFA aims to become the central identity and security layer for the entire Unwind ecosystem.

Instead of managing separate accounts across different applications, users will eventually be able to access their Unwind services through one secure identity.

**One identity. One secure ecosystem. One for all.**

---

## License

License information will be added when the project's licensing model is finalized.

---

*Built as part of the Unwind ecosystem.*
