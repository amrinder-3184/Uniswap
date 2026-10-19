# UniSwap API Reference

Base URL (local): `http://localhost:3000`

The examples below are responses recorded from the API running against the test
database. IDs are renumbered, and timestamps and tokens shortened, for readability.
Two success examples are illustrative rather than recorded, built from the code:
`GET /listings/:listingId/similar` (the recording had no similar listings) and
`POST /ai/chat` (recordings never call the real OpenAI API).

## Conventions

**Authentication.** Endpoints marked **Auth: user** need a JWT from `POST /auth/login`:

```
Authorization: Bearer <token>
```

Tokens are signed with HS256 and expire after 1 hour. **Auth: admin** also requires the
account's `role` to be `admin` in the database. The role is read from the database on each
request, not from the token.

**Request bodies** are JSON (`Content-Type: application/json`), limited to 10 kB.
Image uploads use `multipart/form-data`.

**IDs** in URLs must be positive whole numbers that fit in a PostgreSQL `INTEGER`
(`1` … `2147483647`). Values such as `abc`, `1.0`, `1e2` or `0` are rejected with 400.

**Prices** are returned as strings with two decimals (`"450.00"`), because PostgreSQL
`NUMERIC` values are returned as strings to avoid floating-point rounding.

### Error format

Every error response is JSON with a `message`. Validation errors also include an `errors` array:

```json
{ "message": "Validation failed", "errors": ["Title is required and must be a non-empty string."] }
```
```json
{ "message": "Listing not found" }
```

| Status | When |
|---|---|
| 400 | Validation failure, malformed JSON, malformed ID, business-rule violation (e.g. buying your own listing) |
| 401 | Missing, invalid or expired token; wrong credentials |
| 403 | Authenticated but not allowed (not the owner, not an admin, disallowed CORS origin) |
| 404 | Resource or route does not exist |
| 409 | Duplicate (email, category name, favorite) |
| 413 | Request body over 10 kB |
| 429 | Rate limit exceeded |
| 500 | Unexpected server error. The message is always `"Internal server error"`, and details are logged on the server only. |
| 503 | AI service unavailable |

### Rate limits (per IP address)

| Scope | Limit |
|---|---|
| All routes | 1000 requests / 15 minutes |
| `POST /auth/register`, `POST /auth/login` | 20 requests / 15 minutes |
| `POST /ai/chat` | 10 requests / minute |

---

## Endpoint summary

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/health` | – | Health check |
| POST | `/auth/register` | – | Create an account |
| POST | `/auth/login` | – | Log in and receive a JWT |
| GET | `/users/me` | user | Own profile |
| GET | `/users/me/listings` | user | Own listings (any status) |
| PATCH | `/users/me` | user | Update own name / email |
| PATCH | `/users/me/password` | user | Change own password |
| DELETE | `/users/me` | user | Delete own account |
| GET | `/categories` | – | List categories |
| GET | `/categories/:id` | – | One category |
| POST | `/categories` | admin | Create a category |
| GET | `/listings` | – | Search available listings (paginated) |
| GET | `/listings/:id` | – | One listing |
| POST | `/listings` | user | Create a listing |
| PATCH | `/listings/:id` | user (owner) | Update a listing |
| DELETE | `/listings/:id` | user (owner) | Delete a listing |
| GET | `/listings/:listingId/images` | – | A listing's images |
| POST | `/listings/:listingId/images` | user (owner) | Upload an image |
| DELETE | `/listings/:listingId/images/:imageId` | user (owner) | Delete an image |
| GET | `/listings/:listingId/similar` | – | Similar listings |
| POST | `/listings/:listingId/buy` | user | Buy a listing |
| GET | `/transactions/purchases` | user | Own purchases |
| GET | `/transactions/sales` | user | Own sales |
| GET | `/favorites` | user | Own favorites |
| POST | `/favorites/:listingId` | user | Add a favorite |
| DELETE | `/favorites/:listingId` | user | Remove a favorite |
| GET | `/messages` | user | Own conversations |
| POST | `/messages` | user | Message a listing's seller |
| GET | `/messages/:listingId/:otherUserId` | user | One conversation thread |
| GET | `/recommendations` | user | Personalised recommendations |
| POST | `/ai/chat` | user | AI marketplace assistant |

Uploaded images are served as static files at `/uploads/listings/<filename>` (no auth).

---

## Health

### GET /health
**Auth:** none. Confirms the HTTP server is running (it does not query the database).

`200 OK`
```json
{ "status": "healthy", "timestamp": "2026-10-12T10:00:00.000Z" }
```

---

## Authentication

### POST /auth/register
**Auth:** none · rate limited (20 / 15 min)

| Field | Type | Rules |
|---|---|---|
| `name` | string | required, non-blank, max 255 characters |
| `email` | string | required, valid format, max 255 characters, unique |
| `password` | string | required, at least 6 characters, **at most 72 bytes** in UTF-8 (bcrypt limit) |

Any other field (including `role`) is ignored. New accounts are always `student`.

```json
{ "name": "Asha Rao", "email": "asha@example.com", "password": "secret123" }
```

`201 Created`
```json
{ "id": 1, "name": "Asha Rao", "email": "asha@example.com", "role": "student", "created_at": "2026-10-12T10:00:00.000Z" }
```

`409 Conflict`. The email is already registered; this also covers two simultaneous sign-ups with the same email.
```json
{ "message": "Email already registered" }
```

`400 Bad Request`
```json
{
  "message": "Validation failed",
  "errors": [
    "Name is required and cannot be empty.",
    "A valid email is required.",
    "Password must be at least 6 characters long."
  ]
}
```

### POST /auth/login
**Auth:** none · rate limited (20 / 15 min)

```json
{ "email": "asha@example.com", "password": "secret123" }
```

`200 OK`
```json
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": { "id": 1, "name": "Asha Rao", "email": "asha@example.com", "role": "admin" }
}
```

`401 Unauthorized`. The same response is returned for a wrong password and for an unknown email.
```json
{ "message": "Invalid email or password" }
```

---

## Users (own account)

All `/users/me` routes act only on the account identified by the token.

Without a token, `401 Unauthorized`:
```json
{ "message": "Authentication required" }
```

### GET /users/me
`200 OK`
```json
{ "id": 1, "name": "Asha Rao", "email": "asha@example.com", "role": "admin", "created_at": "2026-10-12T10:00:00.000Z" }
```
`404 Not Found` if the account in a still-valid token has been deleted.

### GET /users/me/listings
All of the user's listings, including sold ones, newest first. `image_url` is the first image or `null`.

`200 OK`
```json
{
  "data": [
    {
      "id": 2, "title": "Data Structures notes", "description": "Handwritten notes, semester 3",
      "price": "150.00", "condition": "Like New", "status": "available",
      "category_id": 1, "category_name": "Books", "created_at": "2026-10-12T10:00:00.000Z",
      "seller_id": 1, "seller_name": "Asha Rao", "image_url": null
    }
  ]
}
```

### PATCH /users/me
Body: `name` and/or `email` (same rules as registration). Any other field, such as `role`, `id` or `password_hash`, is rejected.

```json
{ "name": "Ravi K" }
```

`200 OK`
```json
{ "id": 2, "name": "Ravi K", "email": "ravi@example.com", "role": "student", "created_at": "2026-10-12T10:00:00.000Z" }
```

`400 Bad Request` (attempting to change `role`)
```json
{ "message": "Validation failed", "errors": ["Unsupported fields provided. Only name and email can be updated."] }
```
`409 Conflict`: `{ "message": "Email already registered" }`

### PATCH /users/me/password
```json
{ "currentPassword": "secret123", "newPassword": "newsecret456" }
```
`newPassword` follows the registration rules and must differ from `currentPassword`.

`200 OK`: `{ "message": "Password changed successfully" }`
`401 Unauthorized`: `{ "message": "Current password is incorrect" }`

### DELETE /users/me
Requires the current password. Deleting the account also deletes the user's listings, favorites and messages (database `ON DELETE CASCADE`). Transaction records are kept, with the user reference set to `NULL`.

```json
{ "currentPassword": "newsecret456" }
```
`200 OK`: `{ "message": "Account deleted successfully" }`
`401 Unauthorized`: `{ "message": "Current password is incorrect" }`

---

## Categories

### GET /categories
**Auth:** none. `200 OK`, ordered by id:
```json
[{ "id": 1, "name": "Books" }]
```

### GET /categories/:id
**Auth:** none. `200 OK`: `{ "id": 1, "name": "Books" }`. `404`: `{ "message": "Category not found" }`

### POST /categories
**Auth:** admin

```json
{ "name": "Books" }
```
`201 Created`: `{ "id": 1, "name": "Books" }`

| Status | Response |
|---|---|
| 401 | `{ "message": "Authentication required" }`, or `{ "message": "User account no longer exists" }` |
| 403 | `{ "message": "Admin privileges required" }` |
| 409 | `{ "message": "Category already exists" }` |

---

## Listings

### GET /listings
**Auth:** none. Returns only listings with status `available`.

| Query | Type | Default | Rules |
|---|---|---|---|
| `page` | integer | 1 | ≥ 1 |
| `limit` | integer | 10 | 1–100 |
| `category` | integer | – | category id |
| `search` | string | – | case-insensitive match on title or description, max 200 characters |
| `sortBy` | string | `created_at` | `price`, `created_at` or `title` |
| `order` | string | `desc` | `asc` or `desc` |

Each parameter may appear only once.

`GET /listings?search=notes&sortBy=price&order=asc&page=1&limit=10`, `200 OK`:
```json
{
  "data": [
    {
      "id": 2, "title": "Data Structures notes", "description": "Handwritten notes, semester 3",
      "price": "150.00", "condition": "Like New", "seller_id": 1,
      "category_id": 1, "category_name": "Books", "created_at": "2026-10-12T10:00:00.000Z"
    }
  ],
  "pagination": { "page": 1, "limit": 10, "total": 1, "totalPages": 1, "hasNextPage": false, "is_hybrid": false }
}
```
`is_hybrid` is always `false`: the semantic (pgvector) search path exists in the code but is disabled.

### GET /listings/:id
**Auth:** none. `200 OK`:
```json
{
  "id": 1, "title": "Engineering Mathematics textbook", "description": "Second-hand copy, a few pencil notes",
  "price": "450.00", "condition": "Used", "status": "available",
  "seller_id": 1, "seller_name": "Asha Rao", "category_id": 1, "category_name": "Books",
  "created_at": "2026-10-12T10:00:00.000Z"
}
```
`404`: `{ "message": "Listing not found" }`. `400` for a malformed id:
```json
{ "message": "Validation failed", "errors": ["Listing ID must be a valid positive integer."] }
```

### POST /listings
**Auth:** user. The seller is always the authenticated user; a `seller_id` in the body is ignored.

| Field | Type | Rules |
|---|---|---|
| `title` | string | required, non-blank, max 255 characters |
| `description` | string | required, non-blank, max 5000 characters |
| `price` | number | required, > 0 and ≤ 99999999.99 (a JSON number, not a string) |
| `condition` | string | required, non-blank, max 100 characters |
| `category_id` | integer | required, must reference an existing category |

```json
{ "title": "Engineering Mathematics textbook", "description": "Second-hand copy, a few pencil notes", "price": 450, "condition": "Used", "category_id": 1 }
```

`201 Created`
```json
{
  "id": 1, "title": "Engineering Mathematics textbook", "description": "Second-hand copy, a few pencil notes",
  "price": "450.00", "condition": "Used", "seller_id": 1, "category_id": 1, "created_at": "2026-10-12T10:00:00.000Z"
}
```

`400 Bad Request`
```json
{
  "message": "Validation failed",
  "errors": [
    "Title is required and must be a non-empty string.",
    "Description is required and must be a non-empty string.",
    "Price is required and must be a number greater than 0 and at most 99999999.99.",
    "Category ID is required and must be a valid positive integer."
  ]
}
```
`400` for an unknown category: `{ "message": "Category does not exist" }`

### PATCH /listings/:id
**Auth:** user, owner only. Send any subset of `title`, `description`, `price`, `condition`, `category_id` (same rules as create). `seller_id` cannot be changed.

```json
{ "price": 399.5 }
```
`200 OK`
```json
{
  "id": 1, "title": "Engineering Mathematics textbook", "description": "Second-hand copy, a few pencil notes",
  "price": "399.50", "condition": "Used", "seller_id": 1, "category_id": 1, "created_at": "2026-10-12T10:00:00.000Z"
}
```
`403`: `{ "message": "You are not allowed to modify this listing" }`. `404`: `{ "message": "Listing not found" }`

### DELETE /listings/:id
**Auth:** user, owner only. Sold listings cannot be deleted.

`200 OK`: `{ "message": "Listing deleted successfully" }`

| Status | Response |
|---|---|
| 400 | `{ "message": "Sold listings cannot be deleted" }` |
| 403 | `{ "message": "You are not allowed to delete this listing" }` |
| 404 | `{ "message": "Listing not found" }` |

---

## Listing images

### GET /listings/:listingId/images
**Auth:** none. `200 OK`:
```json
{
  "data": [
    { "id": 1, "listing_id": 1, "image_url": "/uploads/listings/listing-1791813569509-a8be64ab7ac5.png", "display_order": 1, "created_at": "2026-10-12T10:00:00.000Z" }
  ]
}
```

### POST /listings/:listingId/images
**Auth:** user, owner only. `multipart/form-data` with one file in the field `image`.
- **Formats:** JPEG, PNG or WebP. The file's actual content (its signature bytes) is checked, not just the declared type.
- **Limits:** 5 MB per file, at most 5 images per listing.
- **Filenames:** generated by the server; the uploaded filename is ignored.

```powershell
curl.exe -X POST http://localhost:3000/listings/1/images -H "Authorization: Bearer <token>" -F "image=@cover.png"
```

`201 Created`
```json
{ "id": 1, "listing_id": 1, "image_url": "/uploads/listings/listing-1791813569509-a8be64ab7ac5.png", "display_order": 1, "created_at": "2026-10-12T10:00:00.000Z" }
```

| Status | Response |
|---|---|
| 400 | `{ "message": "No image provided" }` |
| 400 | `{ "message": "Invalid file type. Only JPEG, PNG, and WebP are allowed." }` |
| 400 | `{ "message": "Invalid file signature. File is not a real image." }` |
| 400 | `{ "message": "File too large. Maximum size is 5MB." }` |
| 400 | `{ "message": "Maximum 5 images allowed per listing" }` |
| 403 | `{ "message": "Unauthorized access to listing" }` |
| 404 | `{ "message": "Listing not found" }` |

A rejected upload's file is removed from disk.

### DELETE /listings/:listingId/images/:imageId
**Auth:** user, owner only. Deletes the database row and the file.

`200 OK`: `{ "message": "Image deleted successfully" }`. `403`: `{ "message": "Unauthorized access to listing" }`. `404`: `{ "message": "Image not found" }`

---

## Similar listings

### GET /listings/:listingId/similar
**Auth:** none. Up to 10 other available listings, excluding the same seller's, scored by plain SQL:
- same category: +40
- price within ±30%: +30
- same condition: +20
- shared title words: +10

`200 OK`
```json
{
  "data": [
    {
      "id": 4, "title": "Study table with drawer", "description": "Solid wood", "price": "1100.00", "condition": "Used",
      "category_id": 2, "category_name": "Furniture", "score": 100, "reason": "Same category and similar price"
    }
  ]
}
```
`404`: `{ "message": "Listing not found" }`

---

## Transactions

### POST /listings/:listingId/buy
**Auth:** user. Locks the listing row (`SELECT ... FOR UPDATE`), records the purchase at the current price and marks the listing `sold`, all in one database transaction. If several buyers try at the same moment, exactly one succeeds.

`201 Created`
```json
{ "id": 1, "listing_id": 2, "buyer_id": 2, "seller_id": 1, "purchase_price": "150.00", "created_at": "2026-10-12T10:00:00.000Z" }
```

| Status | Response |
|---|---|
| 400 | `{ "message": "Listing already sold" }` |
| 400 | `{ "message": "You cannot buy your own listing" }` |
| 404 | `{ "message": "Listing not found" }` |

This records the sale only. There is no payment processing.

### GET /transactions/purchases
**Auth:** user. `200 OK`:
```json
{
  "data": [
    {
      "id": 1, "listing_id": 2, "listing_title": "Data Structures notes", "buyer_id": 2, "seller_id": 1,
      "seller_name": "Asha Rao", "seller_email": "asha@example.com", "purchase_price": "150.00", "created_at": "2026-10-12T10:00:00.000Z"
    }
  ]
}
```

### GET /transactions/sales
**Auth:** user. `200 OK`:
```json
{
  "data": [
    {
      "id": 1, "listing_id": 2, "listing_title": "Data Structures notes", "buyer_id": 2,
      "buyer_name": "Ravi K", "buyer_email": "ravi@example.com", "seller_id": 1, "purchase_price": "150.00", "created_at": "2026-10-12T10:00:00.000Z"
    }
  ]
}
```

---

## Favorites

### GET /favorites
**Auth:** user. `200 OK`:
```json
{
  "data": [
    {
      "id": 1, "title": "Engineering Mathematics textbook", "description": "Second-hand copy, a few pencil notes",
      "price": "399.50", "condition": "Used", "category_id": 1, "category_name": "Books", "favorited_at": "2026-10-12T10:00:00.000Z"
    }
  ]
}
```

### POST /favorites/:listingId
**Auth:** user. `201 Created`: `{ "message": "Listing added to favorites" }`
`409`: `{ "message": "Listing already favorited" }`. `404`: `{ "message": "Listing not found" }`

### DELETE /favorites/:listingId
**Auth:** user. `200 OK`: `{ "message": "Favorite removed successfully" }`. `404`: `{ "message": "Favorite not found" }`

---

## Messages

### POST /messages
**Auth:** user. Sends a message about a listing to that listing's seller. The receiver is always the seller; the body may contain only these two fields.

| Field | Type | Rules |
|---|---|---|
| `listing_id` | integer | required, existing listing |
| `content` | string | required, non-blank, max 2000 characters (trimmed) |

```json
{ "listing_id": 1, "content": "Is this still available?" }
```
`201 Created`
```json
{ "id": 1, "sender_id": 2, "receiver_id": 1, "listing_id": 1, "content": "Is this still available?", "created_at": "2026-10-12T10:00:00.000Z" }
```
`400`: `{ "message": "You cannot message yourself about your own listing" }`

**Limitation:** because the receiver is always the listing's seller, a seller cannot currently reply through this endpoint.

### GET /messages
**Auth:** user. One entry per conversation (listing + other person), newest first. `200 OK`:
```json
{
  "data": [
    {
      "listing_id": 1, "listing_title": "Engineering Mathematics textbook", "other_user_id": 2,
      "latest_message": "Is this still available?", "latest_message_at": "2026-10-12T10:00:00.000Z", "message_count": 1
    }
  ]
}
```

### GET /messages/:listingId/:otherUserId
**Auth:** user. Messages between the authenticated user and `otherUserId` about the listing, oldest first. A user who isn't part of the conversation gets an empty list.

`200 OK`
```json
{
  "data": [
    { "id": 1, "sender_id": 2, "receiver_id": 1, "listing_id": 1, "content": "Is this still available?", "created_at": "2026-10-12T10:00:00.000Z" }
  ]
}
```
`404`: `{ "message": "Listing not found" }`

---

## Recommendations

### GET /recommendations
**Auth:** user. Up to 10 available listings from other sellers, ranked by plain SQL and JavaScript scoring over the user's favorites and purchases (category, price range, condition, recency). Users with no history get the newest listings.

`200 OK`
```json
{
  "data": [
    {
      "id": 1, "title": "Engineering Mathematics textbook", "description": "Second-hand copy, a few pencil notes",
      "price": "399.50", "condition": "Used", "category_id": 1, "category_name": "Books",
      "created_at": "2026-10-12T10:00:00.000Z", "score": 50, "reason": "Matches categories you frequently interact with"
    }
  ]
}
```

---

## AI assistant

### POST /ai/chat
**Auth:** user · rate limited (10 / min). Requires `OPENAI_API_KEY`. The model can call four read-only tools against the marketplace data: search listings, get recommendations, get similar listings, get listing details. It cannot buy or send messages.

| Field | Type | Rules |
|---|---|---|
| `message` | string | required, non-blank, max 2000 characters |
| `history` | array | optional, max 10 items of `{ role: "user" \| "assistant", content, listings? }` |
| `context` | object | optional, only `{ listingId: integer }` |

```json
{ "message": "Any maths books under 500?" }
```

`200 OK`
```json
{ "message": "I found one: Engineering Mathematics textbook for ₹399.50.", "listings": [{ "id": 1, "title": "Engineering Mathematics textbook", "price": "399.50", "...": "..." }] }
```

`503 Service Unavailable`: no key configured, or OpenAI unreachable.
```json
{ "message": "AI service temporarily unavailable" }
```

---

## General errors

`404` for an unknown route:
```json
{ "message": "Route GET /nope not found" }
```
`400` for malformed JSON:
```json
{ "message": "Malformed JSON in request body" }
```
