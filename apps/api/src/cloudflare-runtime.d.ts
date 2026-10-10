declare module "cloudflare:node" {
  export function httpServerHandler(server: unknown): {
    fetch(request: Request, environment?: unknown, context?: unknown): Promise<Response>;
  };
}
