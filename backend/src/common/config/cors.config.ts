type CorsCallback = (error: Error | null, allow?: boolean) => void;

const DEFAULT_DEVELOPMENT_ORIGINS = ['http://localhost:3000', 'http://localhost:1710'];

export function getAllowedOrigins(): string[] {
  const configured = process.env.CORS_ORIGINS || process.env.CLIENT_URL || '';
  const origins = configured
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (origins.length > 0) {
    return origins;
  }

  return process.env.NODE_ENV === 'production' ? [] : DEFAULT_DEVELOPMENT_ORIGINS;
}

export function validateCorsOrigin(origin: string | undefined, callback: CorsCallback): void {
  // Requests without an Origin header are server-to-server or non-browser clients.
  if (!origin || getAllowedOrigins().includes(origin)) {
    callback(null, true);
    return;
  }

  callback(new Error('Origin is not allowed by CORS'), false);
}

export const socketCorsOptions = {
  origin: validateCorsOrigin,
  methods: ['GET', 'POST'],
  credentials: true,
};
