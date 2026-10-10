# Cloudflare frontend deployment

The frontend and Vinext Response Store are separate Workers. The frontend
Worker is named `web`; its `RESPONSE_STORE` service binding targets
`web-response-store`.

## Cloudflare Workers Builds for the frontend

Configure the repository's Workers Builds integration for the frontend Worker
with:

- **Worker name:** `web`
- **Root directory:** `.` (the repository root, so npm can resolve workspace
  dependencies)
- **Build command:** `npm run build:vinext --workspace apps/web`
- **Deploy command:** `npm run deploy --workspace apps/web`

The deploy script uses the generated `apps/web/dist/server/wrangler.json` and
`--skip-build`, since the build command has already produced that configuration.
It deploys only `web`. Do not run `deploy:response-store` from this frontend CI
job: Workers Builds supplies the frontend Worker name, `web`, to its deployment
job.

## Response Store setup

Deploy the Response Store separately, once when setting up the frontend or
again when its package/configuration changes. From the repository root, run
this command in an authenticated environment targeting the same Cloudflare
account as `web`:

```sh
npm run deploy:response-store --workspace apps/web
```

This uses `apps/web/wrangler.response-store.jsonc` to deploy the Worker named
`web-response-store` with its `CACHE_METADATA` Durable Object and
`CACHE_BODIES` R2 bucket bindings. Ensure the configured R2 bucket exists and
that the deployment identity has permission to deploy Workers and manage the
Worker's Durable Object and R2 resources.

Keep the `RESPONSE_STORE` binding in `apps/web/wrangler.jsonc` pointed at
`web-response-store` with entrypoint `ResponseStoreService`. Do not deploy the
Response Store configuration through the `web` Workers Builds integration.
