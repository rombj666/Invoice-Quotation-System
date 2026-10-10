# Cloudflare frontend deployment

The frontend Worker is named `invoice-quotation-web`. It runs Vinext without a Response Store
adapter or `RESPONSE_STORE` service binding. The application does not explicitly
use ISR or server cache APIs, and its business screens load data through browser
API requests. Frontend deployment no longer requires Response Store.

Vinext uses its default in-memory caching instead of a shared persistent cache.
Eligible responses may need to render more often; static assets and image
optimization remain configured as before.

## Cloudflare Workers Builds for the frontend

Create a separate Workers Builds GitHub integration for `invoice-quotation-web`.
Do not reuse or change the integration belonging to `web`. Use:

- **Worker name:** `invoice-quotation-web`
- **Root directory:** `.` (the repository root, so npm can resolve workspace
  dependencies)
- **Build command:** `npm run build:vinext --workspace apps/web`
- **Deploy command:** `npm run deploy --workspace apps/web`
- **Production branch:** `main` (the repository's current branch and local
  `origin/HEAD` default)

Copy the existing production `NEXT_PUBLIC_API_URL` value into the new
integration's build environment unchanged. It is embedded in the frontend at
build time; do not replace it with a Cloudflare API URL. The production value
is managed outside this repository and has not been changed or verified here.

The deploy script uses the generated `apps/web/dist/server/wrangler.json` and
`--skip-build`, since the build command has already produced that configuration.
Both frontend deploy scripts explicitly pass `--name invoice-quotation-web`.
The generated configuration must have the same name. Do not run
`deploy:response-store` from this frontend CI job. Ensure the Dashboard Worker
name matches the new name, since Workers Builds also supplies deployment identity.

See [Workers Builds configuration](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/)
for integration settings. No live Worker, route, or domain has been created or
changed by these local configuration changes.

## Existing Response Store resources

Keep `apps/web/wrangler.response-store.jsonc`, the separate deployment script,
and package dependencies for now. The deployed `web-response-store` Worker,
its `CacheMetadata` Durable Object class, and the
`web-response-store-cache-bodies` R2 bucket are preserved with their existing data.
They are not part of the frontend deployment. Do not deploy the Response Store
configuration through either frontend Workers Builds integration.

The old `web` Worker has a historical Error 10064 involving `CacheMetadata`.
Deploying the frontend under the separate name avoids updating that Worker;
it does not repair or delete its Durable Object state. Leave `web`,
`web-response-store`, all existing Durable Object namespaces, and R2 buckets
unchanged. Do not add Durable Object bindings or migrations to the new frontend.
Live ownership of the old Worker's Durable Objects remains unverified.
