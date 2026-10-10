# Cloudflare Error 10064 investigation

## Status

Local investigation completed against commit `c4e827a`. No deployment, namespace
mutation, data deletion, commit, or push was performed. Live verification is
blocked: `wrangler whoami` reports **not authenticated** in this environment.
Do not treat the conclusions below as a completed Cloudflare account audit.

## Evidence and root cause

| Item | Repository evidence |
| --- | --- |
| Frontend | `wrangler.jsonc`: Worker `web`, entrypoint `vinext/server/fetch-handler`, no Durable Object class declarations or migrations |
| Store connection | Frontend `RESPONSE_STORE` service binding targets `web-response-store`, entrypoint `ResponseStoreService` |
| Response Store | `wrangler.response-store.jsonc`: Worker `web-response-store`, package service entrypoint, SQLite `CacheMetadata` in declarative `exports`, local `CACHE_METADATA` binding |
| R2 | Response Store binds `CACHE_BODIES` to `web-response-store-cache-bodies` |
| Earlier deploy command | Commit `1b3de0f` chained `npm run deploy:response-store` before frontend deployment |
| Existing prevention | Commit `c4e827a` separated deployments; current frontend deploy scripts use only the generated frontend configuration with `--skip-build` |

The reported Error 10064 means Cloudflare expects the new `web` script to retain
`CacheMetadata` because of existing Durable Object state. Combined with the
reported CI name override and the old chained command, the likely cause is that
the Response Store code was uploaded as `web` and provisioned that class there.
Separately deploying `web-response-store` does not, by itself, transfer a namespace
from `web`.

The precise ownership, creation time, deployed artifact, migration tag, instance
count, and stored-data status remain **unverified**. The error alone does not
prove that any object has stored data. Neither local `.wrangler` state nor the
absence of a class in today's configuration establishes remote emptiness.

## Required read-only account inspection

Use authenticated GET requests to `https://api.cloudflare.com/client/v4` in the
actual deployment account. Do not invoke the application or a Durable Object
method to inspect it: reads through application code can initialize storage or
schedule alarms. Keep credentials and raw settings out of Git and shared logs.

1. List `/accounts/{account_id}/workers/durable_objects/namespaces`, following
   pagination. Record namespace IDs, `script`, `class`, and available storage
   metadata for both Workers. Specifically locate every `CacheMetadata` entry.
2. For **each** matching namespace, list
   `/accounts/{account_id}/workers/durable_objects/namespaces/{namespace_id}/objects`.
   Follow every returned cursor. Record total objects and counts with
   `hasStoredData: true`, false, or missing. A failed/partial query is not an
   empty namespace. This inventory is not a data backup or an atomic snapshot.
3. Read each Worker's `/accounts/{account_id}/workers/scripts/{script}/settings`
   and `/script-settings` as available. Capture class exports, Durable Object
   namespace IDs, service/R2 bindings, and migration metadata. Do not expose
   unrelated variable values. Inspect other Workers' binding metadata as needed
   to identify consumers of the namespace on `web`.
4. Read `/accounts/{account_id}/workers/scripts/{script}/deployments` and
   `/versions`, then `/versions/{version_id}` for relevant versions. Correlate
   timestamps and available migration tags with the bad CI build and its logs.
   A latest migration tag is not a complete migration history. Declarative
   `exports` can provision a namespace without a handwritten migration array;
   consult CI artifacts/reconciliation output if version metadata is insufficient.
5. Compare the live Response Store's namespace ID and R2 binding against the
   frontend's historical bindings. If needed, use read-only R2 listing/metadata
   inspection to establish whether body objects exist. Do not infer ownership
   of all R2 objects solely from a namespace listing: two namespaces may reference
   the same bucket. No R2 inventory was possible in this session.

[Namespace API](https://developers.cloudflare.com/api/resources/durable_objects/)
and [object inventory API](https://developers.cloudflare.com/api/resources/durable_objects/subresources/namespaces/subresources/objects/methods/list/)
document the inventory operations. [Workers API](https://developers.cloudflare.com/api/resources/workers/)
documents settings, versions, and deployments.

## Safest implementation decision

Leave both deployment configurations unchanged until the inventory is available.
The existing command separation already prevents the known recurrence path.
There is no verified configuration-only repair that both removes the export
requirement on `web` and preserves an unknown existing namespace.

Choose a recovery after reviewing live evidence:

- **Retain the namespace on `web`:** prepare a frontend entrypoint that also
  exports the original compatible `CacheMetadata` implementation, preserving
  its actual lifecycle configuration and required bindings. Verify the generated
  Vinext entrypoint retains both the frontend handler and class. This can avoid
  deletion, but is a compatibility deployment, not merely a binding change.
  Inspect the historically deployed implementation first. The locally installed
  `workers-response-store@0.1.0-beta.0` implementation has cleanup alarms that
  call `CACHE_BODIES.delete(...)`; blindly adding the class and shared R2 binding
  could resume cleanup. A dummy class could break existing RPCs and alarms.
- **Move the misplaced namespace:** prepare a supported transfer to a separate,
  unused archival Worker/class destination. Preserve compatible code and binding
  behavior, and review alarm effects before rollout. Do not transfer into the
  already occupied `web-response-store/CacheMetadata` destination or treat transfer
  as a merge. Leave the correct Response Store namespace and R2 bucket intact.
- **Remove the misplaced namespace:** only after complete inventory, dependency
  review, any required backup, and explicit approval identifying the account,
  Worker and namespace ID. An empty-looking listing is not approval to delete.

Cloudflare supports retaining class exports and a coordinated transfer flow.
For declarative exports, the destination declares `expecting-transfer`, the source
declares `transferred`, then bindings are finalized after rollout. Match the
procedure to the live lifecycle mode; do not mix DO `exports` and legacy
`migrations`. See [class lifecycle documentation](https://developers.cloudflare.com/durable-objects/reference/durable-objects-migrations/).

## Is a delete-class migration necessary?

**No, not inherently.** Retention or transfer can resolve the export requirement
without deleting the namespace. Deletion is only an optional cleanup decision.

A legacy `deleted_classes: ["CacheMetadata"]` migration deletes every instance
of that class on the targeted Worker and all stored data in those instances.
It is not an instruction to detach a binding. A declarative
`exports.CacheMetadata` entry with `state: "deleted"` similarly permanently
removes the namespace and its data. Redeploying old code is not a recovery plan.

Correctly scoped to the namespace on `web`, this would not delete the independent
namespace on `web-response-store` or the R2 bucket. However, losing metadata can
make bodies in R2 unreachable through the cache; surviving body files are not a
replacement for metadata. Verify actual IDs and bindings before concluding that
the namespaces are independent. Never apply this cleanup to the correct store.

No deletion declaration or guessed migration tag has been added. See
[legacy delete migration consequences](https://developers.cloudflare.com/durable-objects/reference/durable-object-class-migrations-legacy/#delete-migration).

## Local validation

Dependencies installed from the existing lockfile with lifecycle scripts disabled.

- `npm run typecheck --workspace apps/web`: passed.
- `npm run build:vinext --workspace apps/web`: passed; emitted chunk-size and
  static route-classification notices.
- `node_modules/.bin/wrangler deploy --config apps/web/dist/server/wrangler.json --dry-run`:
  passed with Wrangler 4.133.0; exited without deployment.

The generated frontend configuration names `web`, preserves the
`web-response-store` service binding, and contains empty DO bindings, migrations,
exports, and R2 bindings. A successful dry-run checks the local artifact; it
does not reconcile it with live namespace ownership or prove Error 10064 is fixed.

After choosing and reviewing a recovery patch, repeat these checks and inspect
the generated Worker exports. All live deployment and cleanup remain separate,
explicitly authorized operator steps.
