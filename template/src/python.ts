export interface TemplateFile {
  path: string;
  content: string;
}

export function createPythonMainTemplateFiles(projectName: string): TemplateFile[] {
  return [
    ...createSharedPythonFiles({
      projectName,
      templateName: "python-main",
      serviceName: "auth-service",
      description: "FastAPI authentication service with PostgreSQL, Redis, RS256 JWT, Alembic, Docker, nginx, and CI.",
      envDatabaseName: "auth",
      readmeSections: [
        "This template is the authentication center. It owns login, refresh, logout, session management, refresh token storage, and access token blacklist writes.",
        "Only this service should receive JWT_PRIVATE_KEY. Resource services such as python-app should only receive JWT_PUBLIC_KEY."
      ]
    }),
    {
      path: "app/api/auth.py",
      content: `from fastapi import APIRouter, Depends, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.schemas.auth import LoginRequest, LogoutResponse, RefreshTokenRequest, TokenResponse, UserResponse
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])
security = HTTPBearer(auto_error=True)


@router.post(
    "/login",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
    summary="Login and issue tokens",
    responses={401: {"description": "Invalid credentials"}},
)
def login(payload: LoginRequest) -> TokenResponse:
    return AuthService().login(payload)


@router.post(
    "/refresh",
    response_model=TokenResponse,
    summary="Passively refresh access token",
    responses={401: {"description": "Invalid refresh token"}},
)
def refresh(payload: RefreshTokenRequest) -> TokenResponse:
    return AuthService().refresh(payload.refresh_token)


@router.post(
    "/logout",
    response_model=LogoutResponse,
    summary="Logout current session and blacklist current access token jti",
    responses={401: {"description": "Invalid access token"}},
)
def logout(credentials: HTTPAuthorizationCredentials = Depends(security)) -> LogoutResponse:
    return AuthService().logout(credentials.credentials)


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Return current authenticated user",
    responses={401: {"description": "Invalid access token"}},
)
def me(credentials: HTTPAuthorizationCredentials = Depends(security)) -> UserResponse:
    return AuthService().current_user(credentials.credentials)
`
    },
    {
      path: "app/models/user.py",
      content: `from sqlalchemy import Boolean, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
`
    },
    {
      path: "app/models/role.py",
      content: `from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Role(Base):
    __tablename__ = "roles"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(64), unique=True, index=True)
`
    },
    {
      path: "app/models/session.py",
      content: `from datetime import datetime
from sqlalchemy import DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Session(Base):
    __tablename__ = "sessions"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    sid: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    user_id: Mapped[str] = mapped_column(String(64), index=True)
    status: Mapped[str] = mapped_column(String(32), default="active")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
`
    },
    {
      path: "app/schemas/auth.py",
      content: `from pydantic import BaseModel, EmailStr


class LoginRequest(BaseModel):
    username: EmailStr
    password: str


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "Bearer"
    expires_in: int


class LogoutResponse(BaseModel):
    message: str


class UserResponse(BaseModel):
    id: str
    username: str
    roles: list[str] = []
`
    },
    {
      path: "app/services/auth_service.py",
      content: `from app.schemas.auth import LoginRequest, LogoutResponse, TokenResponse, UserResponse
from app.services.blacklist_service import BlacklistService
from app.services.refresh_token_service import RefreshTokenService
from app.services.token_service import TokenService


class AuthService:
    def __init__(self) -> None:
        self.tokens = TokenService()
        self.refresh_tokens = RefreshTokenService()
        self.blacklist = BlacklistService()

    def login(self, payload: LoginRequest) -> TokenResponse:
        # Replace this demo credential check with a database lookup.
        user_id = "user_123"
        sid = "sess_demo"
        access_token = self.tokens.create_access_token(user_id=user_id, sid=sid, roles=["admin"], scope="user:read")
        refresh_token = self.refresh_tokens.create_refresh_token(user_id=user_id, sid=sid)
        return TokenResponse(access_token=access_token, refresh_token=refresh_token, expires_in=self.tokens.expires_in_seconds)

    def refresh(self, refresh_token: str) -> TokenResponse:
        session = self.refresh_tokens.verify_and_rotate(refresh_token)
        access_token = self.tokens.create_access_token(user_id=session["user_id"], sid=session["sid"], roles=["admin"], scope="user:read")
        new_refresh_token = self.refresh_tokens.create_refresh_token(user_id=session["user_id"], sid=session["sid"])
        return TokenResponse(access_token=access_token, refresh_token=new_refresh_token, expires_in=self.tokens.expires_in_seconds)

    def logout(self, access_token: str) -> LogoutResponse:
        payload = self.tokens.verify_access_token(access_token)
        self.blacklist.add_jti(payload["jti"], payload["exp"])
        self.refresh_tokens.revoke_session(payload["sid"])
        return LogoutResponse(message="logged out")

    def current_user(self, access_token: str) -> UserResponse:
        payload = self.tokens.verify_access_token(access_token)
        self.blacklist.ensure_not_blacklisted(payload["jti"])
        return UserResponse(id=payload["sub"], username="admin@example.com", roles=payload.get("roles", []))
`
    },
    {
      path: "app/services/token_service.py",
      content: `from datetime import datetime, timedelta, timezone
from uuid import uuid4

import jwt

from app.core.config import settings
from app.core.security import parse_pem_key


class TokenService:
    @property
    def expires_in_seconds(self) -> int:
        return settings.access_token_expire_minutes * 60

    def create_access_token(self, user_id: str, sid: str, roles: list[str], scope: str) -> str:
        now = datetime.now(timezone.utc)
        expires_at = now + timedelta(minutes=settings.access_token_expire_minutes)
        payload = {
            "sub": user_id,
            "iss": settings.jwt_issuer,
            "aud": settings.jwt_audience,
            "iat": int(now.timestamp()),
            "exp": int(expires_at.timestamp()),
            "jti": str(uuid4()),
            "sid": sid,
            "roles": roles,
            "scope": scope,
        }
        return jwt.encode(payload, parse_pem_key(settings.jwt_private_key), algorithm=settings.jwt_algorithm)

    def verify_access_token(self, token: str) -> dict:
        return jwt.decode(
            token,
            parse_pem_key(settings.jwt_public_key),
            algorithms=[settings.jwt_algorithm],
            issuer=settings.jwt_issuer,
            audience=settings.jwt_audience,
        )
`
    },
    {
      path: "app/services/refresh_token_service.py",
      content: `from datetime import datetime, timedelta, timezone
from secrets import token_urlsafe
from typing import Any

from app.core.config import settings
from app.core.security import sha256_text
from app.core.redis import get_redis


class RefreshTokenService:
    def create_refresh_token(self, user_id: str, sid: str) -> str:
        refresh_token = token_urlsafe(48)
        expires_at = datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_expire_days)
        key = f"{settings.refresh_token_prefix}{sha256_text(refresh_token)}"
        get_redis().hset(
            key,
            mapping={
                "user_id": user_id,
                "sid": sid,
                "status": "active",
                "expires_at": expires_at.isoformat(),
                "rotated_at": "",
                "replaced_by": "",
            },
        )
        get_redis().expire(key, settings.refresh_token_expire_days * 24 * 60 * 60)
        return refresh_token

    def verify_and_rotate(self, refresh_token: str) -> dict[str, Any]:
        key = f"{settings.refresh_token_prefix}{sha256_text(refresh_token)}"
        data = get_redis().hgetall(key)
        if not data or data.get("status") != "active":
            raise ValueError("invalid refresh token")
        get_redis().hset(key, mapping={"status": "rotated", "rotated_at": datetime.now(timezone.utc).isoformat()})
        return data

    def revoke_session(self, sid: str) -> None:
        get_redis().set(f"{settings.session_prefix}{sid}", "revoked")
`
    },
    createBlacklistServiceFile()
  ];
}

export function createPythonAppTemplateFiles(projectName: string): TemplateFile[] {
  return [
    ...createSharedPythonFiles({
      projectName,
      templateName: "python-app",
      serviceName: "backend-api",
      description: "FastAPI resource service with PostgreSQL, Redis blacklist checks, RS256 JWT verification, Alembic, Docker, nginx, and CI.",
      envDatabaseName: "app",
      readmeSections: [
        "This template is a resource API service. It validates access tokens and reads the Redis blacklist, but it never signs or refreshes tokens.",
        "Do not add JWT_PRIVATE_KEY to this service. Only configure JWT_PUBLIC_KEY."
      ]
    }),
    {
      path: "app/api/example.py",
      content: `from fastapi import APIRouter, Depends

from app.deps.auth import CurrentUser, get_current_user
from app.schemas.profile import ProfileResponse

router = APIRouter(prefix="/api", tags=["profile"])


@router.get(
    "/profile",
    response_model=ProfileResponse,
    summary="Return the profile for the current access token",
    responses={401: {"description": "Invalid token"}, 403: {"description": "Insufficient scope or role"}},
)
def profile(current_user: CurrentUser = Depends(get_current_user)) -> ProfileResponse:
    return ProfileResponse(user_id=current_user.user_id, message="authorized")
`
    },
    {
      path: "app/deps/__init__.py",
      content: ""
    },
    {
      path: "app/deps/auth.py",
      content: `from dataclasses import dataclass

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import settings
from app.core.security import parse_pem_key
from app.services.blacklist_service import BlacklistService

security = HTTPBearer(auto_error=True)


@dataclass(frozen=True)
class CurrentUser:
    user_id: str
    sid: str
    jti: str
    roles: list[str]
    scope: str


def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> CurrentUser:
    try:
        payload = jwt.decode(
            credentials.credentials,
            parse_pem_key(settings.jwt_public_key),
            algorithms=[settings.jwt_algorithm],
            issuer=settings.jwt_issuer,
            audience=settings.jwt_audience,
        )
        BlacklistService().ensure_not_blacklisted(payload["jti"])
        return CurrentUser(
            user_id=payload["sub"],
            sid=payload["sid"],
            jti=payload["jti"],
            roles=payload.get("roles", []),
            scope=payload.get("scope", ""),
        )
    except Exception as exc:  # Replace with narrower jwt and Redis exceptions as the app grows.
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid token") from exc
`
    },
    {
      path: "app/schemas/profile.py",
      content: `from pydantic import BaseModel


class ProfileResponse(BaseModel):
    user_id: str
    message: str
`
    },
    createBlacklistServiceFile()
  ];
}

interface SharedPythonOptions {
  projectName: string;
  templateName: string;
  serviceName: string;
  description: string;
  envDatabaseName: string;
  readmeSections: string[];
}

function createSharedPythonFiles(options: SharedPythonOptions): TemplateFile[] {
  const includePrivateKey = options.templateName === "python-main";
  const apiImport = options.templateName === "python-main" ? "from app.api.auth import router as feature_router" : "from app.api.example import router as feature_router";
  const modelImports = options.templateName === "python-main" ? "from app.models import role, session, user  # noqa: F401" : "# Import application models here so Alembic can detect metadata.";

  return [
    {
      path: "README.md",
      content: createReadme(options)
    },
    {
      path: "pyproject.toml",
      content: `[project]
name = "${options.projectName}"
version = "0.0.0"
description = "${options.description}"
requires-python = ">=3.11"
dependencies = [
  "fastapi>=0.115.0",
  "uvicorn[standard]>=0.34.0",
  "gunicorn>=23.0.0",
  "uvicorn-worker>=0.3.0",
  "pydantic-settings>=2.7.0",
  "sqlalchemy>=2.0.36",
  "alembic>=1.14.0",
  "psycopg[binary]>=3.2.3",
  "redis>=5.2.1",
  "pyjwt[crypto]>=2.10.1",
  "passlib[bcrypt]>=1.7.4",
  "email-validator>=2.2.0"
]

[dependency-groups]
dev = [
  "pytest>=8.3.4",
  "httpx>=0.28.1",
  "ruff>=0.8.4"
]

[tool.pdm.scripts]
dev = "uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"
lint = "ruff check ."
test = "pytest"
migrate = "alembic upgrade head"
alembic-current = "alembic current"
seed = "python -m app.seed"

[tool.pytest.ini_options]
pythonpath = ["."]
testpaths = ["tests"]

[tool.ruff]
line-length = 120
`
    },
    {
      path: ".gitignore",
      content: `__pycache__/
*.py[cod]
.pytest_cache/
.ruff_cache/
.venv/
.env
.env.*
!.env.test.example
!.env.product.example
alembic/versions/*.py
!alembic/versions/.gitkeep
`
    },
    {
      path: ".dockerignore",
      content: `.git
.venv
__pycache__
.pytest_cache
.ruff_cache
.env
.env.*
*.pyc
`
    },
    {
      path: "Dockerfile",
      content: `FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PDM_VENV_IN_PROJECT=1 \
    PATH="/app/.venv/bin:$PATH"

RUN pip install --no-cache-dir pdm

COPY pyproject.toml ./
RUN pdm install --prod --no-self

COPY . .

EXPOSE 8000
CMD ["sh", "-c", "gunicorn app.main:app -k uvicorn_worker.UvicornWorker --bind 0.0.0.0:8000 --workers \${WEB_CONCURRENCY:-4} --timeout \${GUNICORN_TIMEOUT:-60} --graceful-timeout \${GUNICORN_GRACEFUL_TIMEOUT:-30}"]
`
    },
    {
      path: "docker-compose.yml",
      content: `services:
  api:
    build: .
    command: uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
    env_file:
      - .env.test.example
    volumes:
      - .:/app
    ports:
      - "8000:8000"
    depends_on:
      - postgres
      - redis

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: test_${options.envDatabaseName}
      POSTGRES_USER: test_user
      POSTGRES_PASSWORD: test_password
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  nginx:
    image: nginx:1.27-alpine
    ports:
      - "8080:80"
    volumes:
      - ./nginx/default.conf:/etc/nginx/conf.d/default.conf:ro
    depends_on:
      - api
`
    },
    {
      path: "nginx/default.conf",
      content: `server {
  listen 80;
  server_name _;

  client_max_body_size 10m;

  add_header X-Content-Type-Options "nosniff" always;
  add_header X-Frame-Options "DENY" always;
  add_header Referrer-Policy "strict-origin-when-cross-origin" always;
  add_header Permissions-Policy "geolocation=(), camera=(), microphone=()" always;

  location /health {
    proxy_pass http://api:8000/health;
    proxy_set_header X-Request-ID $request_id;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  location / {
    proxy_pass http://api:8000;
    proxy_set_header Host $host;
    proxy_set_header X-Request-ID $request_id;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
`
    },
    {
      path: ".github/workflows/ci.yml",
      content: `name: CI

on:
  pull_request:
    branches:
      - master
  push:
    branches:
      - master

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
      - run: pipx install pdm
      - run: pdm install
      - run: pdm run lint
      - run: pdm run test
`
    },
    {
      path: ".env.test.example",
      content: createEnvExample("test", options, includePrivateKey)
    },
    {
      path: ".env.product.example",
      content: createEnvExample("product", options, includePrivateKey)
    },
    {
      path: "alembic.ini",
      content: `[alembic]
script_location = alembic
prepend_sys_path = .
sqlalchemy.url = driver://user:pass@localhost/dbname

[loggers]
keys = root,sqlalchemy,alembic

[handlers]
keys = console

[formatters]
keys = generic

[logger_root]
level = WARN
handlers = console
qualname =

[logger_sqlalchemy]
level = WARN
handlers =
qualname = sqlalchemy.engine

[logger_alembic]
level = INFO
handlers =
qualname = alembic

[handler_console]
class = StreamHandler
args = (sys.stderr,)
level = NOTSET
formatter = generic

[formatter_generic]
format = %(levelname)-5.5s [%(name)s] %(message)s
datefmt = %H:%M:%S
`
    },
    {
      path: "alembic/env.py",
      content: `from logging.config import fileConfig

from alembic import context

from app.core.config import settings
from app.core.database import Base
${modelImports}

config = context.config
config.set_main_option("sqlalchemy.url", settings.database_url)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    context.configure(url=settings.database_url, target_metadata=target_metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    from sqlalchemy import engine_from_config, pool

    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
`
    },
    {
      path: "alembic/versions/.gitkeep",
      content: ""
    },
    {
      path: "app/__init__.py",
      content: ""
    },
    {
      path: "app/main.py",
      content: `${apiImport}
from app.api.health import router as health_router
from app.core.config import settings
from app.core.logging import RequestIdMiddleware, configure_logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware


def create_app() -> FastAPI:
    configure_logging()
    app = FastAPI(
        title=settings.service_name,
        docs_url="/docs" if settings.docs_enabled else None,
        redoc_url="/redoc" if settings.redoc_enabled else None,
        openapi_url="/openapi.json" if settings.openapi_enabled else None,
    )
    app.add_middleware(RequestIdMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=settings.cors_allow_credentials,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(health_router)
    app.include_router(feature_router)
    return app


app = create_app()
`
    },
    {
      path: "app/api/__init__.py",
      content: ""
    },
    {
      path: "app/api/health.py",
      content: `from fastapi import APIRouter

from app.core.config import settings

router = APIRouter(tags=["health"])


@router.get("/health", summary="Service health check")
def health() -> dict[str, str]:
    return {"status": "ok", "service": settings.service_name, "env": settings.app_env}
`
    },
    {
      path: "app/core/__init__.py",
      content: ""
    },
    {
      path: "app/core/config.py",
      content: `from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_env: str = "test"
    debug: bool = True
    log_level: str = "debug"
    log_format: str = "json"
    request_id_header: str = "X-Request-ID"
    service_name: str = "${options.serviceName}"
    api_prefix: str = "/api"

    database_url: str = "postgresql+psycopg://test_user:test_password@localhost:5432/test_${options.envDatabaseName}"
    db_sslmode: str = "disable"
    redis_url: str = "redis://localhost:6379/0"
    redis_key_prefix: str = "auth:test:"

    jwt_algorithm: str = "RS256"
    jwt_issuer: str = "auth-service-test"
    jwt_audience: str = "backend-api-test"
    jwt_private_key: str = ""
    jwt_public_key: str = ""

    access_token_expire_minutes: int = 60
    refresh_token_expire_days: int = 7
    refresh_token_rotate: bool = True
    refresh_token_reuse_grace_seconds: int = 10

    token_blacklist_prefix: str = "auth:test:blacklist:jti:"
    refresh_token_prefix: str = "auth:test:refresh:"
    session_prefix: str = "auth:test:session:"

    cors_allow_origins: str = "http://localhost:5173"
    cors_allow_credentials: bool = True

    openapi_enabled: bool = True
    docs_enabled: bool = True
    redoc_enabled: bool = True

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_allow_origins.split(",") if origin.strip()]


settings = Settings()
`
    },
    {
      path: "app/core/logging.py",
      content: `import json
import logging
import time
from contextvars import ContextVar
from uuid import uuid4

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.core.config import settings

request_id_context: ContextVar[str] = ContextVar("request_id", default="")


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "level": record.levelname.lower(),
            "logger": record.name,
            "message": record.getMessage(),
            "service": settings.service_name,
            "env": settings.app_env,
            "request_id": request_id_context.get(),
        }
        return json.dumps(payload, ensure_ascii=False)


def configure_logging() -> None:
    handler = logging.StreamHandler()
    handler.setFormatter(JsonFormatter() if settings.log_format == "json" else logging.Formatter("%(levelname)s %(name)s %(message)s"))
    logging.basicConfig(level=settings.log_level.upper(), handlers=[handler], force=True)


class RequestIdMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        request_id = request.headers.get(settings.request_id_header) or str(uuid4())
        token = request_id_context.set(request_id)
        started_at = time.perf_counter()
        try:
            response = await call_next(request)
            response.headers[settings.request_id_header] = request_id
            logging.getLogger("app.request").info(
                "request completed method=%s path=%s status_code=%s duration_ms=%.2f",
                request.method,
                request.url.path,
                response.status_code,
                (time.perf_counter() - started_at) * 1000,
            )
            return response
        finally:
            request_id_context.reset(token)
`
    },
    {
      path: "app/core/database.py",
      content: `from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import settings


class Base(DeclarativeBase):
    pass


engine = create_engine(settings.database_url, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
`
    },
    {
      path: "app/core/redis.py",
      content: `from functools import lru_cache

from redis import Redis

from app.core.config import settings


@lru_cache
def get_redis() -> Redis:
    return Redis.from_url(settings.redis_url, decode_responses=True)
`
    },
    {
      path: "app/core/security.py",
      content: `import hashlib

from passlib.context import CryptContext

password_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def parse_pem_key(value: str) -> str:
    return value.replace("\\\\n", "\\n").strip()


def hash_password(password: str) -> str:
    return password_context.hash(password)


def verify_password(password: str, hashed_password: str) -> bool:
    return password_context.verify(password, hashed_password)


def sha256_text(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()
`
    },
    {
      path: "app/models/__init__.py",
      content: ""
    },
    {
      path: "app/schemas/__init__.py",
      content: ""
    },
    {
      path: "app/services/__init__.py",
      content: ""
    },
    {
      path: "app/seed/__init__.py",
      content: ""
    },
    {
      path: "app/seed/__main__.py",
      content: `import logging

logger = logging.getLogger(__name__)


def main() -> None:
    logger.info("seed completed")


if __name__ == "__main__":
    main()
`
    },
    {
      path: "tests/test_health.py",
      content: `from fastapi.testclient import TestClient

from app.main import app


def test_health_returns_service_status() -> None:
    response = TestClient(app).get("/health")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert response.headers["X-Request-ID"]
`
    }
  ];
}

function createBlacklistServiceFile(): TemplateFile {
  return {
    path: "app/services/blacklist_service.py",
    content: `from datetime import datetime, timezone

from app.core.config import settings
from app.core.redis import get_redis


class BlacklistService:
    def add_jti(self, jti: str, exp: int) -> None:
        ttl = max(1, exp - int(datetime.now(timezone.utc).timestamp()))
        get_redis().setex(f"{settings.token_blacklist_prefix}{jti}", ttl, "1")

    def ensure_not_blacklisted(self, jti: str) -> None:
        if get_redis().exists(f"{settings.token_blacklist_prefix}{jti}"):
            raise ValueError("token is blacklisted")
`
  };
}

function createEnvExample(env: "test" | "product", options: SharedPythonOptions, includePrivateKey: boolean) {
  const isProduct = env === "product";
  const prefix = isProduct ? "product" : "test";
  const issuer = isProduct ? "auth-service" : "auth-service-test";
  const audience = isProduct ? "backend-api" : "backend-api-test";
  const dbSslMode = isProduct ? "require" : "disable";
  const redisScheme = isProduct ? "rediss" : "redis";
  const docsEnabled = isProduct ? "false" : "true";
  const logLevel = isProduct ? "info" : "debug";

  return `APP_ENV=${env}
DEBUG=${isProduct ? "false" : "true"}
LOG_LEVEL=${logLevel}
LOG_FORMAT=json
REQUEST_ID_HEADER=X-Request-ID
WEB_CONCURRENCY=${isProduct ? "4" : "1"}
GUNICORN_TIMEOUT=60
GUNICORN_GRACEFUL_TIMEOUT=30

SERVICE_NAME=${options.serviceName}
API_PREFIX=/api

DATABASE_URL=postgresql+psycopg://${prefix}_user:${isProduct ? "strong_password" : "test_password"}@${prefix}-postgres:5432/${prefix}_${options.envDatabaseName}
DB_SSLMODE=${dbSslMode}

REDIS_URL=${redisScheme}://${prefix}-redis:6379/0
REDIS_KEY_PREFIX=auth:${env}:

JWT_ALGORITHM=RS256
JWT_ISSUER=${issuer}
JWT_AUDIENCE=${audience}
${includePrivateKey ? "JWT_PRIVATE_KEY=\"-----BEGIN PRIVATE KEY-----\\\\n...\\\\n-----END PRIVATE KEY-----\"\n" : ""}JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\\\\n...\\\\n-----END PUBLIC KEY-----"

ACCESS_TOKEN_EXPIRE_MINUTES=${isProduct ? "30" : "60"}
REFRESH_TOKEN_EXPIRE_DAYS=${isProduct ? "30" : "7"}
REFRESH_TOKEN_ROTATE=true
REFRESH_TOKEN_REUSE_GRACE_SECONDS=10

TOKEN_BLACKLIST_PREFIX=auth:${env}:blacklist:jti:
REFRESH_TOKEN_PREFIX=auth:${env}:refresh:
SESSION_PREFIX=auth:${env}:session:

CORS_ALLOW_ORIGINS=${isProduct ? "https://app.example.com,https://admin.example.com" : "https://test.example.com,http://localhost:5173"}
CORS_ALLOW_CREDENTIALS=true

OPENAPI_ENABLED=${docsEnabled}
DOCS_ENABLED=${docsEnabled}
REDOC_ENABLED=${docsEnabled}
`;
}

function createReadme(options: SharedPythonOptions) {
  return `# ${options.projectName}

Generated by Tsu from the \`${options.templateName}\` template.

${options.description}

## Service Role

${options.readmeSections.map((section) => `- ${section}`).join("\n")}

## Tech Stack

- FastAPI
- PDM
- PostgreSQL
- SQLAlchemy 2.x
- Alembic
- Redis
- RS256 JWT
- pytest
- Docker
- nginx
- GitHub Actions

## Development Server

Use Uvicorn directly during local development so reloads and tracebacks stay simple:

\`\`\`bash
pdm install
pdm run dev
\`\`\`

PDM manages the virtual environment, dependency groups, and project scripts. The default \`docker-compose.yml\` is also development-oriented and runs Uvicorn with \`--reload\` plus a source-code volume mount.

## Production App Server

The Dockerfile uses Gunicorn with Uvicorn workers for production process management:

\`\`\`bash
gunicorn app.main:app \\
  -k uvicorn_worker.UvicornWorker \\
  --bind 0.0.0.0:8000 \\
  --workers \${WEB_CONCURRENCY:-4} \\
  --timeout \${GUNICORN_TIMEOUT:-60} \\
  --graceful-timeout \${GUNICORN_GRACEFUL_TIMEOUT:-30}
\`\`\`

Recommended production path:

1. Build an immutable Docker image.
2. Inject real product environment variables or secrets.
3. Run Alembic migrations.
4. Start the container with the Dockerfile CMD or an equivalent Gunicorn command.
5. Put nginx, a cloud load balancer, or an ingress gateway in front of the app.

## Dependency Management

This template uses PDM with standard \`pyproject.toml\` metadata.

- \`[project]\` declares runtime dependencies.
- \`[dependency-groups].dev\` declares test and lint dependencies.
- \`[tool.pdm.scripts]\` provides stable commands for development, linting, tests, migrations, and seed.
- Run \`pdm lock\` after dependency changes when you want to commit a reproducible lock file.

## Environment Files

- \`.env.test.example\` enables Swagger, ReDoc, and OpenAPI JSON.
- \`.env.product.example\` disables public docs by default.
- Use different PostgreSQL databases, Redis instances, JWT keys, issuers, audiences, and GitHub Secrets for test and product.

## Scripts

\`\`\`bash
pdm run test
pdm run lint
pdm run migrate
pdm run seed
pdm run alembic-current
\`\`\`

## Project Structure

| Path | Purpose |
| --- | --- |
| \`app/main.py\` | FastAPI app factory, middleware, and router wiring |
| \`app/api/\` | HTTP route handlers |
| \`app/core/\` | config, logging, database, Redis, and security helpers |
| \`app/models/\` | SQLAlchemy ORM models |
| \`app/schemas/\` | Pydantic request and response schemas |
| \`app/services/\` | Business logic and infrastructure-facing service objects |
| \`alembic/\` | Database migration environment |
| \`nginx/\` | Reverse proxy configuration |
| \`tests/\` | pytest tests |

## Security Notes

- Access Token values must not be stored in Redis.
- Refresh Token values must not be stored in plaintext; store a SHA-256 hash.
- Logs must never include passwords, full tokens, Authorization headers, private keys, database passwords, Redis passwords, or GitHub Secrets.
- Product Swagger/OpenAPI should stay closed unless protected by Basic Auth, gateway auth, IP allowlist, or an internal network.
- Product database rollback should prefer forward-compatible migrations and new repair migrations over Alembic downgrade.
`;
}
