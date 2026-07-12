// BL-036 — Cabeceras de seguridad (RNF-01). Mitigan clickjacking, sniffing de MIME,
// fuga de referrer y degradación a HTTP. El CSP es permisivo en `inline` porque la
// app usa estilos inline y el QR de MFA es `data:`; un CSP con nonce queda como mejora.
const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self'",
      "connect-src 'self' blob:",
      "object-src 'self' blob:",
      "frame-src 'self' blob:",
      "child-src 'self' blob:",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'self'",
    ].join('; '),
  },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: [
      'better-sqlite3',
      'pdf-parse',
      '@napi-rs/canvas',
      'tesseract.js',
      'pdfjs-dist',
    ],
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
  webpack: (config) => {
    config.externals.push('better-sqlite3', 'pdf-parse', '@napi-rs/canvas', 'tesseract.js');
    return config;
  },
};

module.exports = nextConfig;
