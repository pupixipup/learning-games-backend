# TURN server + credentials API

A [coturn](https://github.com/coturn/coturn) TURN/STUN server plus a small
[NestJS](https://nestjs.com) API that hands out short-lived TURN credentials to
clients (e.g. WebRTC apps).

## Layout

```
.
├── docker-compose.yml      # runs both the API and coturn
├── Dockerfile              # builds the NestJS API image
├── .env.example            # copy to .env and edit
├── src/
│   └── turn/               # the /turn-credentials feature module
└── coturn/
    ├── coturn.conf         # turnserver configuration
    └── README.md
```

## How credentials work

coturn is configured with `use-auth-secret` + `static-auth-secret`, i.e. the
[TURN REST API](https://github.com/coturn/coturn/wiki/turnserver#turn-rest-api)
scheme. The API generates ephemeral credentials from the shared secret:

- `username` = `<unix-expiry-timestamp>` (optionally `<expiry>:<userId>`)
- `credential` = `base64(HMAC-SHA1(secret, username))`

coturn recomputes the same HMAC to validate, so no per-user state is stored.
**The API's `TURN_SECRET` must equal `static-auth-secret` in
`coturn/coturn.conf`.**

## Run

```bash
cp .env.example .env   # then edit TURN_SECRET / TURN_URLS
docker compose up -d --build
```

- API: http://localhost:8080
- TURN/STUN: UDP/TCP `3478` (and `5349` for TLS if enabled)

## Endpoint

```
GET /turn-credentials[?userId=<id>]
```

```json
{
  "urls": ["turn:turn.example.com:3478"],
  "username": "1781988340",
  "credential": "L3azezExv6XjCA+gF3iTLvcH/n4="
}
```

## WebRTC signaling

A small SSE-based relay coordinates one **broadcaster** and many **viewers** per
`sessionId`. Events use SSE event names; payloads are JSON. State is in-memory
and ephemeral (cleared on restart).

| Method   | Path                                    | Purpose                                                                 |
| -------- | --------------------------------------- | ----------------------------------------------------------------------- |
| GET SSE  | `/signal/:sessionId/broadcaster`        | Broadcaster subscribes → `viewer-offer {id,offer}`, `viewer-ice {id,candidate}`, `viewer-disconnect {id}` |
| POST     | `/signal/:sessionId/broadcaster`        | Broadcaster sends `broadcaster-answer`/`broadcaster-ice` (body carries target `id`) → routed to that viewer |
| GET SSE  | `/signal/:sessionId/viewer/:viewerId`   | Viewer subscribes → `broadcaster-ready`, `broadcaster-gone`, `broadcaster-answer {answer}`, `broadcaster-ice {candidate}` |
| POST     | `/signal/:sessionId/viewer/:viewerId`   | Viewer sends `viewer-offer`/`viewer-ice` → tagged with the viewerId and routed to the broadcaster (buffered if the broadcaster hasn't connected yet) |

A viewer receives `broadcaster-ready` as soon as a broadcaster is present (on
connect if one is already live, otherwise the moment one connects), and
`broadcaster-gone` when the broadcaster's stream closes.

POST body shapes:

```jsonc
// broadcaster → viewer  (id = target viewerId)
{ "type": "broadcaster-answer", "id": "v1", "answer": { /* RTCSessionDescription */ } }
{ "type": "broadcaster-ice",    "id": "v1", "candidate": { /* RTCIceCandidate */ } }

// viewer → broadcaster  (viewerId comes from the URL)
{ "type": "viewer-offer", "offer": { /* RTCSessionDescription */ } }
{ "type": "viewer-ice",   "candidate": { /* RTCIceCandidate */ } }
```

A periodic `ping` event is emitted on both streams to keep the connection alive
through idle-timeout proxies; clients can ignore it.

## Game template compression

Templates are uploaded as loose web assets and served one file at a time from
`GET /templates/:id/*path`. Nothing in front of the API compresses those
responses — Cloudflare runs in DNS-only mode here, because its proxied mode is
blocked in Russia — so the origin does it, at upload time rather than per
request:

```
templates/tic-tac-toe/index.js       # raw bytes
templates/tic-tac-toe/index.js.br    # Content-Encoding: br
templates/tic-tac-toe/logo.png       # already compressed — no sidecar
```

The sidecar is written for every compressible extension (`js`, `mjs`, `css`,
`json`, `map`, `txt`, `svg`, `wasm`, `pck`) unconditionally, so the serve path knows
from the extension alone that it exists and never has to ask storage. It serves
it when the request's `Accept-Encoding` allows, and sets `Vary: Accept-Encoding`.
Uploading a `.br`/`.gz` file yourself is rejected — a client-supplied sidecar
could otherwise shadow a real asset.

Templates uploaded before this existed have no sidecar; they still serve
correctly (the request falls back to the raw file) and re-uploading them is what
generates the compressed variant.

**Brotli only, no gzip fallback** (~14% of original vs gzip's ~18%). A client
that cannot take brotli gets the raw file. That is safe here because these
assets are ES modules loaded by browsers, and every browser that can load an ES
module also supports brotli — but note browsers only advertise `br` on secure
origins, so the origin must be behind HTTPS for this to engage at all.
`http://localhost` counts as secure, so local dev does use it.

## Configuration (env)

| Variable      | Default                        | Notes                                        |
| ------------- | ------------------------------ | -------------------------------------------- |
| `TURN_SECRET` | `2285427`           | Must match `static-auth-secret` in coturn.   |
| `TURN_URLS`   | `turn:turn.example.com:3478`   | Comma-separated ICE URLs returned to clients.|
| `TURN_TTL`    | `86400`                        | Credential lifetime in seconds.              |
| `PORT`        | `8080`                         | API listen port.                             |
| `TEMPLATE_BROTLI_QUALITY` | `9`                | Brotli level for template sidecars. Raising it to 11 costs ~29x the CPU for ~12% smaller output, which is only worth it for rare offline uploads. |

## Local development (without Docker)

```bash
npm install
npm run start:dev
```
