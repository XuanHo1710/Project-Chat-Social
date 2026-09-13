# Server AI deployment

1. Copy `.env.example` to a deployment-only `.env` file.
2. Generate `AI_INTERNAL_API_KEY` with a cryptographically secure random generator and use the same value for server-ai, backend, Kafka, and RabbitMQ workers.
3. Store MongoDB, Qdrant, Groq, and Hugging Face credentials in the deployment secret store. Never put credential-bearing URLs or keys in this repository, image build arguments, logs, or documentation.
4. Limit MongoDB/Qdrant network access to the application network and grant each account only the permissions it needs.
5. Build and start the service, then check the public `/health` endpoint.
6. Call `/retrain` once with the `X-AI-API-Key` header after this refactor to create the versioned Qdrant collection and switch its alias.

If a credential has ever been committed, deleting the file is insufficient: revoke or rotate it first, then purge it from Git history and invalidate cached build artifacts.
