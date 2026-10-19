# UniSwap Production Hardening & Reliability Audit

This document details the hardening controls implemented to transition UniSwap's API from a local development state to a production-ready environment without altering the core product architecture.

## 1. Security Controls & Configuration
*   **Helmet Headers**: Implemented `helmet` globally to enforce standard HTTP security headers (XSS protection, Content-Type sniffing, Frameguard).
*   **CORS Hardening**: Transitioned from unrestricted wildcard CORS to an explicit allowed-origin configuration via `ALLOWED_ORIGINS` environment variables, defaulting to local origins safely.
*   **Body Parsing Limits**: Restrictive `10kb` limit applied to all JSON body parsing (`express.json()`) to prevent Denial of Service via enormous payloads.
*   **JWT Integrity**: Secrets are successfully strictly loaded from `.env`, with a strict 1-hour expiration policy protecting API routes.
*   **Centralized Error Safety**: Enhanced `error.middleware.js` to trap all unhandled crashes (e.g., PostgreSQL DB exceptions) and map them to safe `Internal server error` messages without leaking SQL structures or stack traces to the client.

## 2. API Rate Limiting
Added `express-rate-limit` strategically:
*   **Global Limit**: 1000 requests per 15 minutes globally per IP.
*   **Authentication (Auth)**: 20 login/registration attempts per 15 minutes to thwart brute-forcing.
*   **AI Service**: 10 requests per minute to specifically bottleneck expensive `/ai/chat` OpenAI token burns.

## 3. Upload Hardening
*   **Magic Byte Verification**: Upgraded the `multer` middleware stack to execute physical signature validation using `file-type`. It checks the internal magic bytes of the image binary buffer post-upload and immediately deletes files masquerading as images (e.g., a PHP script disguised as a `.jpg`).
*   **Path Traversal Prevention**: Safe filename randomization completely ignores user-provided filename payloads, enforcing `listing-${Date.now()}-${crypto}.ext`.

## 4. Database Integrity & Race Conditions
*   **Email Uniqueness Race**: The database `users(email)` UNIQUE constraint remains the absolute authority. Captured Postgres error code `23505` natively translating race-condition duplicated insertions into safe `409 Conflict` HTTP responses instead of crashing with a 500.
*   **Buy vs Delete Listing Race**: Fixed a critical race condition where Thread A could issue a `DELETE /listings/id` simultaneously as Thread B issued `POST /buy`. Thread B locked the row using `FOR UPDATE`, but Thread A previously deleted it blindly. Thread A's `deleteListing` now explicitly acquires a `FOR UPDATE` lock and strictly validates `status !== 'sold'` prior to attempting physical DB removal.
*   **Image Ordering Race**: Converted the `listingImage` sequential numbering from a decoupled 2-step `SELECT count -> INSERT` into a natively secure singular `SELECT COALESCE(MAX(display_order), 0) + 1` wrapped inside the `INSERT` statement.

## 5. Server Lifecycle & Health
*   **Health Endpoint**: Registered `GET /health` to verify server availability without risking DB connections or exposing internal metrics.
*   **Graceful Shutdown**: Intercepted `SIGTERM` and `SIGINT` to block new HTTP connections while closing active sockets, subsequently awaiting `pool.end()` so PostgreSQL connections cleanly detach, rather than severing inflight operations violently.

## 6. Frontend Environment Strategy
Swept the entire React `src/` directory and safely removed all hardcoded `http://localhost:3000` URLs. Components now universally evaluate `import.meta.env.VITE_API_URL` gracefully defaulting to localhost during local engineering.

## 7. Known Limitations
1.  **Image Orphan Cleanup**: Currently, if a user deletes their account or a listing, the DB transaction safely CASCADE deletes all relationships. However, synchronous physical filesystem deletions during DB transactions introduce a risk of leaving DB operations hanging indefinitely if the FS is locked or slow. Therefore, the DB cascades successfully, but images are currently left orphaned on disk (uploads/listings/). A chron job or S3 lifecycle rule is recommended post-launch to reap unreferenced images.
2.  **WebSockets/Polling**: Messaging requires full page reloads to fetch fresh DB rows; it doesn't currently use WebSockets or server-sent events for real-time delivery.
