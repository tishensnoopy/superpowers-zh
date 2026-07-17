/**
 * Strapi global middleware stack (R28).
 *
 * The list replaces Strapi's implicit default stack, so every default entry
 * must be kept explicitly. Hardened bits:
 *   - strapi::cors: whitelist origins via CORS_ORIGINS env (comma-separated)
 *     instead of the default reflect-any-origin behaviour.
 *   - strapi::security: CSP tightened for self-hosted assets while still
 *     allowing the Strapi admin panel to work.
 */

export default ({ env }) => {
  // Comma-separated whitelist, e.g. "https://example.com,https://www.example.com"
  // Falls back to same-origin only (no cross-origin browser requests allowed).
  const corsOrigins = env.array('CORS_ORIGINS', []);

  return [
    'strapi::logger',
    'strapi::errors',
    {
      name: 'strapi::security',
      config: {
        contentSecurityPolicy: {
          useDefaults: true,
          directives: {
            'connect-src': ["'self'", 'https:'],
            // Strapi admin + media library preview need data:/blob: images
            'img-src': ["'self'", 'data:', 'blob:'],
            'media-src': ["'self'", 'data:', 'blob:'],
            upgradeInsecureRequests: null,
          },
        },
      },
    },
    {
      name: 'strapi::cors',
      config: {
        // @koa/cors accepts only string|function for origin (no arrays), so
        // resolve the whitelist dynamically. Requests without an Origin
        // header (server-to-server, curl, health checks) are always allowed;
        // browser cross-origin requests must match CORS_ORIGINS exactly.
        // When the whitelist is empty, all cross-origin browser requests are
        // rejected — the frontend talks to Strapi server-side, so this is safe.
        origin: (ctx: any) => {
          const requestOrigin = ctx.get('Origin');
          if (!requestOrigin) return '*';
          return corsOrigins.includes(requestOrigin) ? requestOrigin : 'null';
        },
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'],
        headers: ['Content-Type', 'Authorization', 'Origin', 'Accept'],
        keepHeaderOnError: true,
      },
    },
    'strapi::poweredBy',
    'strapi::query',
    'strapi::body',
    'strapi::session',
    'strapi::favicon',
    'strapi::public',
  ];
};
