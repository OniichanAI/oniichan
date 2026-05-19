from pydantic import AnyHttpUrl
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    app_name: str = "AI Discord Ops Assistant API"
    environment: str = "local"
    api_v1_prefix: str = "/api/v1"
    cors_allow_origins: str = "http://localhost:4200"

    database_url: str = "postgresql+psycopg://postgres:postgres@postgres:5432/discord_ops"
    discord_client_id: str = ""
    discord_client_secret: str = ""
    discord_bot_token: str = ""
    discord_redirect_uri: AnyHttpUrl = "http://localhost:8000/api/v1/auth/discord/callback"
    discord_oauth_authorize_url: AnyHttpUrl = "https://discord.com/oauth2/authorize"
    discord_oauth_token_url: AnyHttpUrl = "https://discord.com/api/oauth2/token"
    discord_oauth_scopes: str = "identify guilds"
    discord_bot_scopes: str = "bot applications.commands"
    discord_bot_permissions: str = "8"

    session_signing_secret: str = "change_me"
    default_tenant_header: str = "x-tenant-id"

    # LLM (intent parsing). Disabled until LLM_API_KEY is set, in which case
    # the OpenAI-compatible /v1/chat/completions endpoint at LLM_BASE_URL is
    # called. Works as-is against OpenAI, OpenRouter, Groq, Together, Mistral,
    # Ollama, vLLM, etc. — change base URL + key.
    llm_provider: str = "openai-compatible"  # future: "anthropic-native"
    llm_base_url: str = "https://api.openai.com/v1"
    llm_api_key: str = ""
    llm_model: str = "gpt-4o-mini"
    llm_timeout_seconds: int = 12
    llm_max_tokens: int = 400
    # "json"  — chat-completions with response_format=json_object. Best for
    #           small open-source models (Llama-3.1-8B, Qwen-7B, Mistral-7B).
    # "tools" — chat-completions with tools=[...]. Better on stronger models
    #           (GPT-4o-mini, Claude-3.5-Haiku, Llama-3.3-70B+) — measure
    #           with eval/run_intent_eval.py before flipping in prod.
    llm_mode: str = "json"


settings = Settings()
