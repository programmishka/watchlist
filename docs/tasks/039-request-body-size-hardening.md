# TASK-039: Request Body Size Hardening

## Status

Ready

## Goal

Add an application-level request-body size limit to the Watchlist JSON API so oversized request bodies are rejected **before the application parses the complete JSON payload**.

TASK-037 identified that the current JSON endpoints conceptually perform:

```text
HTTP request
    ↓
request.json()
    ↓
field/type validation
    ↓
application service
```

TASK-038 added strict bounds for individual fields and resources, but those bounds apply only **after the JSON request body has already been read and parsed**.

Therefore a request such as:

```json
{
  "symbol": "AAPL",
  "unused": "<very large attacker-controlled string>"
}
```

can still force the Worker to process a body far larger than any legitimate Watchlist API request.

Cloudflare's platform-level request limits are substantially larger than this application's legitimate JSON payloads and are therefore not a sufficient application-level boundary.

TASK-039 establishes:

> JSON mutation endpoints accept only small bounded request bodies. Oversized bodies are rejected before JSON parsing and before application services, persistence, or external providers are reached.

The implementation must handle both:

1. requests with a trustworthy/useful `Content-Length`;
2. requests where `Content-Length` is missing or cannot be relied upon.

The desired flow is:

```text
HTTP request
    ↓
body-size boundary
    ├─ oversized
    │     ↓
    │   413 PAYLOAD_TOO_LARGE
    │   no JSON parsing
    │   no application services
    │
    ↓
bounded JSON parsing
    ↓
existing field validation
    ↓
application service
```

Do not implement rate limiting, WAF rules, or authentication changes.

---

# Context

Read before starting:

* `CLAUDE.md`
* `ARCHITECTURE.md`
* `docs/security/input-boundary-audit.md`
* TASK-037;
* TASK-038;
* current API route tree under `src/routes/api/`;
* current API request parsing helpers;
* current error model/mapping;
* current SvelteKit/Cloudflare adapter configuration;
* current installed SvelteKit version;
* current Cloudflare Workers runtime assumptions;
* this task completely.

Inspect the actual route handlers before designing the shared boundary.

Do not assume every endpoint has a request body.

---

# Scope

## 1. JSON Request Bodies Only

This task applies to application endpoints that accept JSON request bodies.

Inventory them from the actual route tree.

Expected examples include operations such as:

```text
Create Watchlist
Set active Watchlist
Add Stock
Set Target Price
Calculate Investment Allocation
```

Use the actual endpoint list discovered in code.

---

## 2. Bodyless Requests

Do not apply body parsing to normal:

```text
GET
DELETE
```

requests that do not require a JSON body.

Do not reject a DELETE merely because it has no body.

---

## 3. Authentication Remains First Trust Boundary

Preserve the existing authentication architecture.

Do not weaken:

```text
Cloudflare Access
→ authenticated user
→ application API
```

This task concerns payload resource bounds, not authentication.

---

# Determine a Concrete Application Limit

## 4. Measure Legitimate Payloads

Before choosing the final byte limit, inspect every legitimate JSON request shape.

Examples conceptually:

```json
{
  "name": "My Watchlist"
}
```

```json
{
  "watchlistId": "..."
}
```

```json
{
  "symbol": "HEXA-B.ST"
}
```

```json
{
  "targetPrice": 123.456
}
```

```json
{
  "totalSavings": 10000000
}
```

Use TASK-038's final field bounds.

---

## 5. Limit Must Be Byte-Based

Request-body size is a transport/resource concern.

Define the limit in:

```text
bytes
```

not JavaScript string characters.

UTF-8 strings can consume multiple bytes per character.

---

## 6. Keep the Limit Small but Practical

The legitimate API bodies are tiny.

Choose a single application-level maximum that provides comfortable headroom for:

* maximum valid Watchlist names;
* Unicode UTF-8 encoding;
* JSON syntax/property names;
* normal HTTP-client serialization;
* future small compatible additions.

Do not choose a multi-megabyte limit simply because Cloudflare allows it.

---

## 7. Starting Candidate

A candidate such as:

```text
4 KiB
```

is likely to provide substantial headroom while remaining tiny relative to Cloudflare's platform limit.

This is a starting point, not a mandatory value.

Inspect actual maximum legitimate payload sizes first.

---

## 8. One Shared Limit Preferred

Prefer one application-wide JSON-body limit rather than different arbitrary limits per endpoint.

Only introduce endpoint-specific limits if there is a concrete demonstrated need.

---

## 9. Named Constant

Define a clearly named constant conceptually equivalent to:

```ts
MAX_JSON_REQUEST_BODY_BYTES
```

Do not scatter numeric literals across handlers.

---

# Investigate Current Runtime Semantics First

## 10. Inspect SvelteKit Request Handling

Before implementation, determine how the current SvelteKit version exposes request bodies in server handlers.

Confirm behavior of:

```ts
Request.body
Request.json()
Request.text()
```

in the actual runtime/type environment.

---

## 11. Inspect Cloudflare Workers Runtime

Confirm that the selected bounded-reading strategy works in the Cloudflare Workers runtime used by this project.

Do not assume Node.js stream APIs are available.

---

## 12. Web Streams

Prefer standard Web Platform APIs supported by Workers, such as:

```text
ReadableStream
ReadableStreamDefaultReader
TextDecoder
Uint8Array
```

where necessary.

Do not add a Node-specific stream dependency.

---

## 13. No New Runtime Dependency Unless Necessary

This should be implementable with standard Web APIs.

Do not add a production dependency merely to count request bytes or parse JSON.

---

# Content-Length Fast Rejection

## 14. Inspect `Content-Length`

If a request contains a valid non-negative:

```text
Content-Length
```

header greater than the application maximum, reject immediately.

Conceptually:

```text
Content-Length > MAX
→ 413
→ do not read body
```

---

## 15. Content-Length Is Not Sufficient

Do not rely exclusively on `Content-Length`.

A request may:

* omit it;
* use transfer semantics where it is unavailable;
* provide an incorrect/misleading value depending on runtime/proxy behavior.

The actual body must still be bounded while reading.

---

## 16. Smaller Declared Length

If:

```text
Content-Length <= MAX
```

do not assume the body is safe without bounded reading.

Actual consumed bytes remain authoritative.

---

## 17. Invalid Content-Length

Malformed `Content-Length` must not disable body-size protection.

Use the bounded-read path.

Do not accidentally treat:

```text
Content-Length: nonsense
```

as unlimited.

---

# Bounded Body Reading

## 18. Read Incrementally

For requests whose body must be parsed, read the request body incrementally while counting bytes.

Conceptually:

```text
bytesRead = 0

for each chunk:
    bytesRead += chunk.byteLength

    if bytesRead > MAX:
        stop
        reject 413
```

Do not first call:

```ts
await request.text()
```

and only afterward check the resulting size.

That would defeat the main purpose of this task.

---

## 19. Stop Once Oversized

Once the body exceeds the maximum:

* stop accumulating it;
* cancel/release the reader appropriately;
* return the oversized-payload error.

Do not continue buffering the remainder merely to produce a nicer error.

---

## 20. Exact Boundary

A body whose encoded byte length is exactly:

```text
MAX
```

is allowed to proceed to JSON parsing.

A body of:

```text
MAX + 1
```

is rejected.

---

# UTF-8 Correctness

## 21. Count Bytes, Not Characters

A Watchlist name may contain Unicode.

Example:

```text
Ä
€
漢
```

can occupy multiple UTF-8 bytes.

The body-size helper must count actual request bytes.

---

## 22. Chunk Boundaries

Do not assume UTF-8 characters align with stream chunks.

If decoding incrementally, use `TextDecoder` correctly.

Alternatively, accumulate bounded raw byte chunks and decode only after confirming the total is within the limit.

Prefer the simplest correct approach.

---

# JSON Parsing

## 23. Parse Only After Bound Check

After successfully reading a body no larger than the limit, parse it as JSON.

Do not call the original unbounded:

```ts
request.json()
```

after consuming the stream.

---

## 24. Shared Helper

Introduce a shared server-side helper conceptually equivalent to:

```ts
readBoundedJson(request)
```

or:

```ts
parseBoundedJsonRequest(request)
```

The helper should:

1. perform optional Content-Length fast rejection;
2. read at most the allowed number of bytes;
3. reject oversized payloads;
4. decode the bounded body;
5. parse JSON;
6. preserve existing invalid-JSON semantics where appropriate.

Choose the smallest clear API.

---

## 25. Server-Only Location

This helper belongs under:

```text
$lib/server
```

or another server-only API boundary module.

Do not expose body-stream handling to client bundles.

---

# Empty Bodies

## 26. Existing Behavior

Inspect how each JSON endpoint currently behaves when the request body is empty.

Preserve the existing public semantics where possible.

If empty JSON body currently becomes:

```text
400 INVALID_REQUEST
```

keep that behavior.

Do not turn it into `413`.

---

# Malformed JSON

## 27. Existing Error

Malformed JSON below the body-size limit must continue to map to the existing invalid-request behavior.

Conceptually:

```text
400 INVALID_REQUEST
```

not:

```text
500
```

---

## 28. Oversized Malformed JSON

If a malformed body exceeds the size limit before JSON parsing:

```text
413
```

takes precedence.

Do not parse an oversized body just to discover that it is malformed.

---

# New API Error

## 29. Stable Error Code

Introduce a stable API error code:

```text
PAYLOAD_TOO_LARGE
```

for this condition.

---

## 30. HTTP Status

Return:

```text
413 Payload Too Large
```

---

## 31. Public Message

Use a generic message such as:

```text
Request body is too large.
```

Do not expose:

* internal buffer sizes;
* Worker memory details;
* Cloudflare limits;
* stream implementation details.

Whether the exact application limit is included in the public message is optional; prefer the generic message unless clients need the number.

---

# Error Architecture

## 32. Boundary Error

Represent oversized body as an API/boundary error appropriate to the existing architecture.

Do not model it as:

* domain financial error;
* Watchlist business error;
* MarketDataProvider error.

---

## 33. Central Mapping

Use the existing centralized error-response conventions where practical.

Avoid custom ad hoc JSON responses duplicated across every route.

---

# Handler Integration

## 34. Replace Unbounded Parsing

For every JSON endpoint in scope, replace direct unbounded calls such as:

```ts
await request.json()
```

with the shared bounded parser.

---

## 35. No Missed Endpoint

Search the complete API route tree for:

```text
request.json()
```

after implementation.

Any remaining occurrence must be:

* outside the intended scope; or
* explicitly justified.

Document the result.

---

## 36. Preserve Validation Order After Parsing

Once bounded JSON has been parsed, existing TASK-038 field validation remains authoritative.

Example:

```text
bounded JSON
→ symbol too long
→ INVALID_STOCK_SYMBOL
```

Do not replace field validation with body-size validation.

---

# Application-Service Short Circuit

## 37. Oversized Body Must Stop Early

For an oversized request:

```text
createApplicationServices calls = 0
```

where route architecture permits this assertion.

This follows the same early-boundary principle already established for invalid Total Savings in TASK-015.

---

## 38. No Repository Work

Oversized payload:

```text
repository calls = 0
```

---

## 39. No Provider Work

Oversized payload:

```text
MarketDataProvider calls = 0
ExchangeRateProvider calls = 0
```

where relevant.

---

# Authentication Ordering

## 40. Preserve Current Authentication Behavior

Inspect whether handlers currently authenticate before reading/parsing the request body.

Prefer preserving:

```text
authenticate
→ require user
→ body boundary
→ parse/validate
```

if that is the established architecture.

Do not reorganize authentication solely for this task without justification.

---

## 41. Unauthenticated Request

An unauthenticated request should continue to produce the established authentication response according to current handler ordering.

Do not unintentionally change it to:

```text
413
```

merely because the body is large unless the architecture intentionally checks transport size before authentication.

Document the final ordering.

---

# Content-Type

## 42. Do Not Expand Scope Unnecessarily

If the API currently does not strictly require:

```text
Content-Type: application/json
```

do not introduce broad Content-Type enforcement unless needed for the bounded parser.

If a small correction is necessary, report it rather than silently changing the API contract.

---

# GET/DELETE Behavior

## 43. Do Not Parse Bodies Unnecessarily

GET and bodyless DELETE endpoints should not gain JSON parsing merely to use the shared helper.

---

## 44. Unexpected Body on Bodyless Route

Do not add a global rule rejecting bodies on GET/DELETE unless already required by the architecture.

This task is about bounding legitimate JSON-body endpoints.

---

# Client Behavior

## 45. No Normal UI Change

Normal browser requests are far below the new body limit.

No visible product behavior should change during ordinary use.

---

## 46. No Client Pre-Check Required

The browser already enforces field-level limits from TASK-038.

Do not add client-side JSON byte-size calculation.

The server body boundary is a defense against direct/malicious clients.

---

# Unit Tests — Bounded Reader

## 47. Below Limit

A valid JSON body below the limit parses successfully.

---

## 48. Exactly Limit

A request body exactly at the configured byte limit is accepted by the size boundary.

If constructing valid JSON at exactly the limit is cumbersome, test the bounded byte reader independently at the exact boundary and JSON parsing separately.

---

## 49. Limit Plus One

A body of:

```text
MAX + 1
```

is rejected.

---

## 50. Content-Length Above Limit

A request declaring a valid Content-Length above the maximum is rejected without reading/parsing the body.

---

## 51. Content-Length Equal Limit

Declared exact limit is not rejected solely by the header.

Actual bounded reading still applies.

---

## 52. Missing Content-Length

An oversized body with no usable Content-Length is still rejected through streaming byte counting.

This is mandatory.

---

## 53. Misleading Smaller Content-Length

Where the Request/test runtime permits constructing such a case, verify a body larger than the limit is rejected even if the declared Content-Length claims a smaller value.

If standard Request construction prevents intentionally inconsistent headers/body semantics, test the bounded reader independently and document the runtime limitation.

Do not weaken the implementation because the synthetic test is awkward.

---

## 54. Invalid Content-Length

Malformed header does not bypass streaming protection.

---

## 55. Unicode Bytes

Add a case proving byte counting rather than JavaScript character counting.

---

## 56. Malformed JSON Below Limit

Produces existing invalid-request semantics.

---

## 57. Empty Body

Produces existing invalid-request semantics.

---

# Route Tests

## 58. Representative Route

For at least one JSON route, prove:

```text
oversized body
→ 413 PAYLOAD_TOO_LARGE
```

---

## 59. All JSON Routes

Ensure every JSON route uses the shared helper.

This can be verified through:

* representative route tests;
* route wiring tests;
* static source inspection;
* focused tests per handler where architecture makes that clearer.

Do not copy the same enormous payload test unnecessarily into every spec if shared wiring can prove coverage.

---

## 60. Early Service Guard

Add at least one dedicated test proving oversized input is rejected before:

```text
createApplicationServices
```

or equivalent service construction.

---

## 61. Existing Validation

Preserve representative route tests showing:

```text
small body + invalid field
→ existing field validation error
```

not 413.

---

# API Error Mapping Tests

## 62. Status

Verify:

```text
PAYLOAD_TOO_LARGE
→ 413
```

---

## 63. Shape

Response uses the established API error envelope.

Conceptually:

```json
{
  "error": {
    "code": "PAYLOAD_TOO_LARGE",
    "message": "Request body is too large."
  }
}
```

Use the exact project convention.

---

# Integration / Runtime Verification

## 64. Node/Vitest Is Not Enough

Because this task depends on Web Request/ReadableStream behavior in Cloudflare Workers, perform a focused runtime verification under the project's real Worker runtime.

Use:

```text
npm run preview
```

or the appropriate Wrangler/workerd flow.

---

## 65. Small Real Runtime Request

Send a normal authenticated/synthetic-local request with a legitimate JSON body.

Verify existing endpoint behavior remains correct.

---

## 66. Oversized Real Runtime Request

Against local workerd only, send an oversized JSON request above the application limit.

Expected:

```text
413
PAYLOAD_TOO_LARGE
```

Do not send this adversarial test to production.

---

## 67. Missing Content-Length Runtime Case

Where practical, use a local client capable of sending a streamed/chunked body without a normal Content-Length and verify the Worker still rejects once the byte limit is exceeded.

If the local HTTP tooling/runtime automatically supplies Content-Length, document that limitation and ensure unit tests cover the missing-header path.

---

# Performance / Memory

## 68. Bounded Accumulation

The helper must never intentionally accumulate more than approximately:

```text
MAX + one incoming chunk
```

before detecting overflow.

Do not buffer the entire oversized body.

---

## 69. No Double Full-Body Copies Where Avoidable

For accepted small bodies, keep implementation straightforward.

The bodies are tiny, so micro-optimization is unnecessary, but avoid obviously wasteful repeated whole-body transformations.

---

# Logging

## 70. Do Not Log Oversized Body

Do not log the request body content when rejecting it.

---

## 71. No Sensitive Echo

Do not include submitted body content in the public error response.

---

# Security Audit Follow-Up

## 72. Update Audit

Update:

```text
docs/security/input-boundary-audit.md
```

with an implementation-status note stating that TASK-039 closes the application-level JSON request-body-size gap.

Preserve the original audit findings.

---

# Architecture Documentation

## 73. Request Boundary

Update `ARCHITECTURE.md` with the final request-body rule:

```text
authenticated JSON request
→ bounded byte read
→ JSON parse
→ field validation
→ application services
```

or the exact final authentication ordering.

---

## 74. Final Byte Limit

Document the selected:

```text
MAX_JSON_REQUEST_BODY_BYTES
```

and the rationale based on legitimate request sizes.

---

## 75. Platform vs Application Limit

Document that Cloudflare's larger platform request-body limit is not treated as the application's acceptable payload size.

The application intentionally uses a much smaller boundary appropriate to its API.

---

## 76. Field Bounds Remain Necessary

Document that body-size protection complements rather than replaces TASK-038's per-field validation.

---

# README

## 77. README

No README change is required unless developer-facing API documentation benefits materially from noting the request-size limit.

Do not add security implementation details to the project introduction unnecessarily.

---

# Historical Task Notes

## 78. TASK-037

Add a concise implementation-follow-up note if the repository convention supports it:

```text
TASK-039 later implemented the request-body-size protection identified by this audit.
```

Keep status Done.

---

## 79. TASK-038

Add a concise note that TASK-039 completes the remaining body-size hardening intentionally deferred from TASK-038.

Keep status Done.

---

# Non-Goals

Do NOT implement:

* rate limiting;
* per-user quotas;
* Cloudflare WAF rules;
* CAPTCHA;
* IP blocking;
* CSRF redesign;
* authentication changes;
* Cloudflare Access changes;
* field-length changes;
* Watchlist-capacity changes;
* strict unknown-JSON-property rejection;
* gzip/decompression policy unless the actual runtime makes it directly necessary for correctness;
* file upload handling;
* multipart handling;
* WebSocket limits;
* response-size limits;
* production load testing;
* production adversarial requests;
* UI redesign;
* production deployment;
* unrelated V3 work.

---

# Acceptance Criteria

The task is complete when all of the following are true:

1. Every JSON-body endpoint is inventoried.
2. Legitimate maximum payload shapes are measured.
3. One explicit application-level JSON byte limit is selected.
4. Limit is justified.
5. Limit is represented by one named constant.
6. Limit is byte-based.
7. Content-Length above limit is rejected immediately.
8. Content-Length alone is not trusted.
9. Missing Content-Length remains protected.
10. Invalid Content-Length remains protected.
11. Actual body bytes are counted incrementally.
12. Oversized body is not fully buffered.
13. Reading stops after overflow is detected.
14. Exact limit is accepted by size boundary.
15. Limit + 1 is rejected.
16. Unicode byte counting is correct.
17. JSON is parsed only after size validation succeeds.
18. Direct `request.json()` is removed from all in-scope routes.
19. Remaining `request.json()` calls, if any, are explicitly justified.
20. Shared server-side bounded JSON helper exists.
21. No Node-specific stream API is required.
22. No unnecessary production dependency is added.
23. Malformed small JSON remains INVALID_REQUEST.
24. Empty body preserves existing invalid-request semantics.
25. Oversized malformed body returns 413 before parsing.
26. `PAYLOAD_TOO_LARGE` stable API code exists.
27. HTTP status is 413.
28. Public error message is generic.
29. Error uses standard API envelope.
30. Oversized body reaches no application service.
31. Oversized body reaches no repository.
32. Oversized body reaches no provider.
33. Authentication semantics/order remain intentional and documented.
34. Bodyless GET/DELETE routes are not unnecessarily changed.
35. Normal browser UI behavior remains unchanged.
36. No client byte-count implementation is introduced.
37. Unit tests cover below-limit body.
38. Unit tests cover exact limit.
39. Unit tests cover limit + 1.
40. Unit tests cover Content-Length fast rejection.
41. Unit tests cover missing Content-Length.
42. Unit tests cover invalid Content-Length.
43. Unit tests cover Unicode byte counting.
44. Unit tests cover malformed JSON.
45. Unit tests cover empty body.
46. Route tests prove 413 behavior.
47. Route tests prove early service short-circuit.
48. Existing field-validation behavior remains.
49. Real workerd runtime accepts normal request.
50. Real workerd runtime rejects oversized request.
51. Missing-Content-Length runtime behavior is verified where tooling permits.
52. No oversized/adversarial request is sent to production.
53. Audit document records closure.
54. `ARCHITECTURE.md` documents the request boundary.
55. Platform-vs-application limit distinction is documented.
56. TASK-038 field bounds remain unchanged.
57. Existing project checks pass.
58. No production deployment occurs.

---

# Verification

Before completing the task, execute:

```bash
npm run test
npm run test:e2e
npm run check
npm run lint
npm run build
```

If no browser behavior changes, `npm run test:e2e` should still be run because this task changes the HTTP API boundary shared by browser workflows.

Additionally verify explicitly:

1. complete JSON-route inventory;
2. maximum legitimate body-size calculation;
3. final selected byte limit;
4. valid body below limit;
5. exact-limit boundary;
6. limit + 1;
7. Content-Length above limit;
8. missing Content-Length;
9. invalid Content-Length;
10. Unicode byte accounting;
11. malformed small JSON;
12. empty body;
13. oversized malformed JSON;
14. standard 413 response envelope;
15. zero application-service calls for oversized body;
16. zero repository/provider calls for oversized body;
17. no in-scope unbounded `request.json()` remains;
18. normal local workerd request;
19. oversized local workerd request;
20. missing-Content-Length local case where practical;
21. no production request/deployment performed.

Do not report verification as successful unless actually executed.

Do NOT deploy production.

---

# Task Status

After all implementation, testing, runtime verification, and documentation criteria are satisfied, change:

```text
Status: Ready
```

to:

```text
Status: Done
```

Do not modify unrelated task statuses.

---

# Completion Report

When finished, report:

1. files added/changed;
2. JSON endpoints discovered;
3. legitimate maximum payload sizes measured;
4. final byte limit and rationale;
5. location of shared limit constant;
6. bounded-reader/parser design;
7. Content-Length fast-path behavior;
8. missing Content-Length behavior;
9. invalid/misleading Content-Length behavior;
10. byte-counting/UTF-8 behavior;
11. exact-limit behavior;
12. limit+1 behavior;
13. malformed JSON behavior;
14. empty-body behavior;
15. final `PAYLOAD_TOO_LARGE` API code/status/message;
16. authentication-vs-body-boundary ordering;
17. application-service short-circuit proof;
18. repository/provider short-circuit proof;
19. remaining `request.json()` search result;
20. unit tests added/changed;
21. route/error-mapping tests added/changed;
22. E2E result;
23. real workerd normal-request result;
24. real workerd oversized-request result;
25. missing-Content-Length runtime result or tooling limitation;
26. memory/buffering behavior;
27. `ARCHITECTURE.md` changes;
28. security-audit follow-up;
29. historical task notes;
30. README changes, if any;
31. results of `test`, `test:e2e`, `check`, `lint`, and `build`;
32. confirmation no new production dependency was required;
33. confirmation TASK-038 field/resource limits were unchanged;
34. confirmation no production adversarial requests were made;
35. confirmation no production deployment occurred;
36. confirmation task status changed to Done;
37. assumptions or unresolved issues;
38. deviations from this task or `ARCHITECTURE.md`.

Do not proceed to another task.

Do not stage, commit, or push changes. Git operations are performed manually by the user.
