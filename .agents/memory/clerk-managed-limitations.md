---
name: Replit-managed Clerk limitations
description: What the Replit-managed Clerk tenant does NOT support, and the app-level workaround chosen for MeaningBridge.
---

# Replit-managed Clerk limitations

The Replit-managed Clerk tenant does **not** expose native MFA/2FA, organizations,
or SMS. You cannot enable Clerk's built-in TOTP/second-factor from this tenant.

**Why:** MeaningBridge's professional portal gates PHI (client referrals + directory)
behind a required second factor and an idle-timeout re-auth. Clerk-native MFA was
unavailable, so 2FA is implemented at the application level.

**How to apply:** When a feature needs a second factor on the Replit-managed Clerk
setup, build it app-side — do not reach for Clerk MFA APIs. In this repo:
- TOTP is implemented with `node:crypto` only (no `otplib`): secret, otpauth URI,
  code verification, and single-use recovery codes, all server-side.
- A signed idle-timeout cookie (`mb_2fa`, signed with `SESSION_SECRET`,
  `IDLE_TIMEOUT_MINUTES` default 15) tracks the active second-factor session.
- PHI endpoints return `403` with a `code` the client maps to recovery UX:
  `no_provider_profile`, `provider_unverified`, `two_factor_setup_required`
  (rendered as a notice), and `two_factor_challenge_required` (opens a challenge
  modal, then retries). Email verification stays Clerk-native.
- Client wraps every PHI fetch in a `useTwoFactorGate` guard so a mid-session
  challenge transparently reopens the modal and retries — new PHI surfaces should
  reuse that guard rather than hand-rolling 403 handling.
