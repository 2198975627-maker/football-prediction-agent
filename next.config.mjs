/** @type {import('next').NextConfig} */
const scriptPolicy =
  process.env.NODE_ENV === "production"
    ? "script-src 'self' 'unsafe-inline'"
    : "script-src 'self' 'unsafe-inline' 'unsafe-eval'";

const nextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  outputFileTracingIncludes: {
    "/api/cron/refresh-rosters": ["./skills/football-roster-refresh/scripts/refresh-rosters.mjs"]
  },
  async headers() {
    const securityHeaders = [
      {
        key: "Content-Security-Policy",
        value: [
          "default-src 'self'",
          "base-uri 'self'",
          "frame-ancestors 'none'",
          "form-action 'self'",
          "object-src 'none'",
          "img-src 'self' data: blob: https://r2.thesportsdb.com https://www.thesportsdb.com https://flagcdn.com",
          "connect-src 'self' https://www.thesportsdb.com https://*.supabase.co",
          "font-src 'self' data:",
          "style-src 'self' 'unsafe-inline'",
          scriptPolicy,
          "upgrade-insecure-requests"
        ].join("; ")
      },
      {
        key: "Referrer-Policy",
        value: "same-origin"
      },
      {
        key: "X-Content-Type-Options",
        value: "nosniff"
      },
      {
        key: "X-Frame-Options",
        value: "DENY"
      },
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=(), payment=()"
      },
      {
        key: "Strict-Transport-Security",
        value: "max-age=31536000; includeSubDomains"
      }
    ];

    return [
      {
        source: "/(.*)",
        headers: securityHeaders
      }
    ];
  }
};

export default nextConfig;
