# coturn TURN/STUN server

The coturn config used by this project. It is started by the root
`docker-compose.yml` (see the top-level README), not on its own.

## Files

- `coturn.conf` — turnserver configuration file.

## Configuration

- Listens on UDP/TCP port `3478`. `5349` is exposed for TLS if you enable certs.
- Uses long-term (REST API) credentials via `use-auth-secret` /
  `static-auth-secret`.
- **`static-auth-secret` must match `TURN_SECRET` used by the API service** —
  the API signs credentials with this secret and coturn validates them.
- Set `realm` to your domain or service name.

## Notes

- coturn serves STUN and TURN on the same port.
- For production, set `relay-ip` to the public IP/interface of the host.
- Add TLS certificate paths (`cert` / `pkey`) for secure TURN over `5349`.
