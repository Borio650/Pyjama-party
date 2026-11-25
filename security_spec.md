# Security Specification — Pyjama Party Registration Platform

## 1. Data Invariants
1. **PII Isolation**: Phone numbers (`contact`) live exclusively in `participants_private/{participantId}` and are readable only by verified administrators (`isAdmin()`). `participants_public/{participantId}` never stores phone numbers or emails.
2. **Duplicate Registration Lock**: Every registration atomically creates `participants_public/{participantId}`, `participants_private/{participantId}`, and `registration_locks/{phoneHash}` (`existsAfter` verified). Re-registering the same phone number fails server-side.
3. **Single-Use Ticket Check-In**: `statut_entree` is initialized to `false` and `date_entree` to `null` at creation. Only an admin can transition `statut_entree` from `false` to `true`, with `date_entree == request.time`. A second check-in attempt (`existing().statut_entree == true`) is rejected.
4. **Public Visibility Gate**: When `event_settings/main.affichage_public_participants == false`, new registrations must set `public_visible == false` and public `list`/`get` queries on `participants_public` are blocked for non-admins when `public_visible == false`.
5. **Unverified Email & Admin Privilege Protection**: Admin checks require `request.auth.token.email_verified == true`. Non-admins cannot create/modify `admins/{uid}`, `event_settings`, `event_posters`, `branches`, or `services`.

## 2. Adversarial Test Payloads ("Dirty Dozen")
1. **PII Leak Attempt**: Unauthenticated `get` or `list` on `/participants_private/{id}` -> DENIED.
2. **Pre-Checked-In Forgery**: Public `create` on `/participants_public/{id}` with `statut_entree: true` -> DENIED.
3. **Double Check-In Replay**: Admin `update` on `/participants_public/{id}` where `existing().statut_entree == true` -> DENIED.
4. **Shadow Field Injection**: `create` on `/participants_public/{id}` with extra field `isAdmin: true` -> DENIED by `hasOnly(...)`.
5. **Unbundled Orphan Write**: `create` on `/participants_public/{id}` without matching `participants_private/{id}` and `registration_locks/{phoneHash}` -> DENIED by `existsAfter(...)`.
6. **Public Visibility Bypass**: `create` on `/participants_public/{id}` with `public_visible: true` while `event_settings/main.affichage_public_participants == false` -> DENIED.
7. **Timestamp Forgery**: `create` with `created_at` different from `request.time` -> DENIED.
8. **ID Poisoning**: Document ID > 128 chars or containing invalid characters (`../`, `$`) -> DENIED by `isValidId()`.
9. **Value Poisoning**: `nom` > 80 chars or `contact` not matching `^\+[0-9]{8,18}$` -> DENIED.
10. **Self-Promotion to Admin**: Non-admin `create` on `/admins/{uid}` -> DENIED.
11. **Unverified Email Spoof**: User with `email_verified: false` attempting admin read/write -> DENIED.
12. **Immutable Token Tampering**: Admin edit attempt modifying `qr_token` or `numero_inscription` -> DENIED by `affectedKeys().hasOnly(...)`.
