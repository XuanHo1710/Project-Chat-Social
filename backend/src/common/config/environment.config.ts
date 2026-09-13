type Environment = Record<string, unknown>;

function textValue(config: Environment, name: string): string {
  const value = config[name];
  return typeof value === 'string' ? value.trim() : '';
}

function requireValue(config: Environment, name: string): string {
  const value = textValue(config, name);
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function requireUrl(config: Environment, name: string, protocols: string[]): string {
  const value = requireValue(config, name);
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid URL`);
  }
  if (!protocols.includes(url.protocol)) {
    throw new Error(`${name} must use ${protocols.join(' or ')}`);
  }
  return value;
}

function requireSecret(config: Environment, name: string, minimumLength = 32): string {
  const value = requireValue(config, name);
  const obviousPlaceholders = new Set([
    'changeme',
    'change-me',
    'secret',
    'your-secret-here',
    'replace-me',
  ]);
  const normalized = value.toLowerCase();
  if (
    value.length < minimumLength ||
    obviousPlaceholders.has(normalized) ||
    normalized.includes('replace-with') ||
    normalized.includes('generate-a')
  ) {
    throw new Error(`${name} must be a non-placeholder secret of at least ${minimumLength} characters`);
  }
  return value;
}

export function validateEnvironment(config: Environment): Environment {
  const mongodbUri = requireValue(config, 'MONGODB_URI');
  if (!/^mongodb(?:\+srv)?:\/\//i.test(mongodbUri)) {
    throw new Error('MONGODB_URI must use mongodb:// or mongodb+srv://');
  }

  const accessSecret = requireSecret(config, 'JWT_ACCESS_TOKEN_SECRET');
  const refreshSecret = requireSecret(config, 'JWT_REFRESH_TOKEN_SECRET');
  if (accessSecret === refreshSecret) {
    throw new Error('JWT access and refresh token secrets must be different');
  }
  requireValue(config, 'JWT_ACCESS_EXPIRE');
  requireValue(config, 'JWT_REFRESH_EXPIRE');
  requireUrl(config, 'CLIENT_URL', ['http:', 'https:']);

  requireUrl(config, 'RABBITMQ_URL', ['amqp:', 'amqps:']);
  requireValue(config, 'RABBITMQ_QUEUE_NAME');
  requireValue(config, 'KAFKA_BROKER');

  const aiServerUrl = textValue(config, 'AI_SERVER_URL');
  if (aiServerUrl) {
    requireUrl(config, 'AI_SERVER_URL', ['http:', 'https:']);
    requireSecret(config, 'AI_INTERNAL_API_KEY', 16);
  }

  ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_CALLBACK_URL'].forEach((name) =>
    requireValue(config, name),
  );
  requireUrl(config, 'GOOGLE_CALLBACK_URL', ['http:', 'https:']);

  const cloudinaryNames = [
    'CLOUDINARY_CLOUD_NAME',
    'CLOUDINARY_API_KEY',
    'CLOUDINARY_API_SECRET',
  ];
  cloudinaryNames.forEach((name) => requireValue(config, name));

  const port = Number(textValue(config, 'PORT') || 8080);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }

  if (textValue(config, 'NODE_ENV') === 'production') {
    requireSecret(config, 'REDIS_PASSWORD', 16);
  }

  return config;
}
