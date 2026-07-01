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
      content: `import jwt
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.schemas.auth import LoginRequest, LogoutResponse, RefreshTokenRequest, TokenResponse, UserResponse
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])
security = HTTPBearer(auto_error=False)


def _unauthorized(detail: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=detail)


def _require_access_token(credentials: HTTPAuthorizationCredentials | None) -> str:
    if credentials is None:
        raise _unauthorized("invalid access token")
    return credentials.credentials


@router.post(
    "/login",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
    summary="Login and issue tokens",
    responses={401: {"description": "Invalid credentials"}},
)
def login(payload: LoginRequest) -> TokenResponse:
    try:
        return AuthService().login(payload)
    except ValueError as exc:
        raise _unauthorized("invalid credentials") from exc


@router.post(
    "/refresh",
    response_model=TokenResponse,
    summary="Passively refresh access token",
    responses={401: {"description": "Invalid refresh token"}},
)
def refresh(payload: RefreshTokenRequest) -> TokenResponse:
    try:
        return AuthService().refresh(payload.refresh_token)
    except ValueError as exc:
        raise _unauthorized("invalid refresh token") from exc


@router.post(
    "/logout",
    response_model=LogoutResponse,
    summary="Logout current session and blacklist current access token jti",
    responses={401: {"description": "Invalid access token"}},
)
def logout(credentials: HTTPAuthorizationCredentials | None = Depends(security)) -> LogoutResponse:
    try:
        return AuthService().logout(_require_access_token(credentials))
    except (jwt.PyJWTError, ValueError) as exc:
        raise _unauthorized("invalid access token") from exc


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Return current authenticated user",
    responses={401: {"description": "Invalid access token"}},
)
def me(credentials: HTTPAuthorizationCredentials | None = Depends(security)) -> UserResponse:
    try:
        return AuthService().current_user(_require_access_token(credentials))
    except (jwt.PyJWTError, ValueError) as exc:
        raise _unauthorized("invalid access token") from exc
`
    },
    {
      path: "app/models/user.py",
      content: `from sqlalchemy import Boolean, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
`
    },
    {
      path: "app/models/role.py",
      content: `from sqlalchemy import Column, ForeignKey, Integer, String, Table
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base

user_roles = Table(
    "user_roles",
    Base.metadata,
    Column("user_id", ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    Column("role_id", ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True),
)

role_permissions = Table(
    "role_permissions",
    Base.metadata,
    Column("role_id", ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True),
    Column("permission_id", ForeignKey("permissions.id", ondelete="CASCADE"), primary_key=True),
)


class Role(Base):
    __tablename__ = "roles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(64), unique=True, index=True)
`
    },
    {
      path: "app/models/permission.py",
      content: `from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Permission(Base):
    __tablename__ = "permissions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    description: Mapped[str] = mapped_column(String(255), default="")
`
    },
    {
      path: "app/models/session.py",
      content: `from datetime import datetime
from sqlalchemy import DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Session(Base):
    __tablename__ = "sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
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
      content: `import logging

from app.schemas.auth import LoginRequest, LogoutResponse, TokenResponse, UserResponse
from app.services.blacklist_service import BlacklistService
from app.services.refresh_token_service import RefreshTokenService
from app.services.token_service import TokenService

logger = logging.getLogger("app.auth")


class AuthService:
    def __init__(self) -> None:
        self.tokens = TokenService()
        self.refresh_tokens = RefreshTokenService()
        self.blacklist = BlacklistService()

    def login(self, payload: LoginRequest) -> TokenResponse:
        # Replace this demo credential check with a database lookup.
        if str(payload.username).lower() != "admin@example.com" or payload.password != "password123":
            logger.warning("login failed username=%s", str(payload.username).lower())
            raise ValueError("invalid credentials")
        user_id = "user_123"
        sid = "sess_demo"
        access_token = self.tokens.create_access_token(user_id=user_id, sid=sid, roles=["admin"], scope="user:read")
        refresh_token = self.refresh_tokens.create_refresh_token(user_id=user_id, sid=sid)
        logger.info("login succeeded user_id=%s sid=%s", user_id, sid)
        return TokenResponse(access_token=access_token, refresh_token=refresh_token, expires_in=self.tokens.expires_in_seconds)

    def refresh(self, refresh_token: str) -> TokenResponse:
        rotation = self.refresh_tokens.rotate_refresh_token(refresh_token)
        access_token = self.tokens.create_access_token(user_id=rotation["user_id"], sid=rotation["sid"], roles=["admin"], scope="user:read")
        logger.info("refresh succeeded user_id=%s sid=%s", rotation["user_id"], rotation["sid"])
        return TokenResponse(access_token=access_token, refresh_token=rotation["refresh_token"], expires_in=self.tokens.expires_in_seconds)

    def logout(self, access_token: str) -> LogoutResponse:
        payload = self.tokens.verify_access_token(access_token)
        self.blacklist.add_jti(payload["jti"], payload["exp"])
        self.refresh_tokens.revoke_session(payload["sid"])
        logger.info("logout succeeded sid=%s jti=%s", payload["sid"], payload["jti"])
        return LogoutResponse(message="logged out")

    def current_user(self, access_token: str) -> UserResponse:
        payload = self.tokens.verify_access_token(access_token)
        self.blacklist.ensure_not_blacklisted(payload["jti"])
        self.refresh_tokens.ensure_session_active(payload["sid"])
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
      content: `import logging
from datetime import datetime, timedelta, timezone
from secrets import token_urlsafe
from typing import Any

from app.core.config import settings
from app.core.security import sha256_text
from app.core.redis import get_redis
from app.services.session_service import SessionService

logger = logging.getLogger("app.auth.refresh")


class RefreshTokenService:
    def __init__(self) -> None:
        self.sessions = SessionService()

    def create_refresh_token(self, user_id: str, sid: str) -> str:
        refresh_token = token_urlsafe(48)
        now = datetime.now(timezone.utc)
        expires_at = now + timedelta(days=settings.refresh_token_expire_days)
        key = self._refresh_key(refresh_token)
        get_redis().hset(
            key,
            mapping={
                "user_id": user_id,
                "sid": sid,
                "status": "active",
                "created_at": now.isoformat(),
                "expires_at": expires_at.isoformat(),
                "rotated_at": "",
                "replaced_by": "",
            },
        )
        get_redis().expire(key, settings.refresh_token_expire_days * 24 * 60 * 60)
        return refresh_token

    def rotate_refresh_token(self, refresh_token: str) -> dict[str, Any]:
        key = self._refresh_key(refresh_token)
        data = get_redis().hgetall(key)
        if not data:
            logger.warning("refresh rejected reason=missing_token_hash")
            raise ValueError("invalid refresh token")

        sid = data.get("sid", "")
        if sid:
            self.ensure_session_active(sid)
        if self._is_expired(data.get("expires_at", "")):
            get_redis().hset(key, mapping={"status": "revoked"})
            logger.warning("refresh rejected reason=expired sid=%s", sid)
            raise ValueError("invalid refresh token")

        status = data.get("status")
        if status == "active":
            user_id = data["user_id"]
            sid = data["sid"]
            new_refresh_token = self.create_refresh_token(user_id=user_id, sid=sid)
            new_refresh_hash = sha256_text(new_refresh_token)
            get_redis().hset(
                key,
                mapping={
                    "status": "rotated",
                    "rotated_at": datetime.now(timezone.utc).isoformat(),
                    "replaced_by": new_refresh_hash,
                },
            )
            logger.info("refresh rotated sid=%s replaced_by=%s", sid, new_refresh_hash[:12])
            return {"user_id": user_id, "sid": sid, "refresh_token": new_refresh_token}

        if status == "rotated":
            if self._within_reuse_grace(data.get("rotated_at", "")):
                logger.warning("refresh replay within grace sid=%s", sid)
                raise ValueError("refresh token already rotated")
            if sid:
                self.revoke_session(sid)
            logger.warning("refresh reuse detected sid=%s", sid)
            raise ValueError("refresh token reuse detected")

        logger.warning("refresh rejected reason=status_%s sid=%s", status, sid)
        raise ValueError("invalid refresh token")

    def revoke_session(self, sid: str) -> None:
        self.sessions.revoke_session(sid)

    def ensure_session_active(self, sid: str) -> None:
        self.sessions.ensure_session_active(sid)

    def _refresh_key(self, refresh_token: str) -> str:
        return f"{settings.refresh_token_prefix}{sha256_text(refresh_token)}"

    def _is_expired(self, expires_at: str) -> bool:
        expires = self._parse_timestamp(expires_at)
        return expires is None or expires <= datetime.now(timezone.utc)

    def _within_reuse_grace(self, rotated_at: str) -> bool:
        rotated = self._parse_timestamp(rotated_at)
        if rotated is None:
            return False
        elapsed = datetime.now(timezone.utc) - rotated
        return elapsed <= timedelta(seconds=settings.refresh_token_reuse_grace_seconds)

    def _parse_timestamp(self, value: str) -> datetime | None:
        if not value:
            return None
        parsed = datetime.fromisoformat(value)
        if parsed.tzinfo is None:
            return parsed.replace(tzinfo=timezone.utc)
        return parsed
`
    },
    createBlacklistServiceFile(),
    createSessionServiceFile(),
    createPythonMainConftestFile(),
    createPythonMainAuthApiTestFile(),
    createPythonMainTokenServiceTestFile(),
    createPythonMainRefreshTokenServiceTestFile()
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

from app.deps.auth import CurrentUser, require_scope
from app.schemas.profile import ProfileResponse

router = APIRouter(prefix="/api", tags=["profile"])


@router.get(
    "/profile",
    response_model=ProfileResponse,
    summary="Return the profile for the current access token",
    responses={401: {"description": "Invalid token"}, 403: {"description": "Insufficient scope or role"}},
)
def profile(current_user: CurrentUser = Depends(require_scope("user:read"))) -> ProfileResponse:
    return ProfileResponse(user_id=current_user.user_id, message="authorized")
`
    },
    {
      path: "app/deps/__init__.py",
      content: ""
    },
    {
      path: "app/deps/auth.py",
      content: `import logging
from collections.abc import Callable
from dataclasses import dataclass

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import settings
from app.core.security import parse_pem_key
from app.services.blacklist_service import BlacklistService
from app.services.session_service import SessionService

security = HTTPBearer(auto_error=False)
logger = logging.getLogger("app.auth")


@dataclass(frozen=True)
class CurrentUser:
    user_id: str
    sid: str
    jti: str
    roles: list[str]
    scope: str

    @property
    def scopes(self) -> set[str]:
        return {scope for scope in self.scope.split() if scope}


def get_current_user(credentials: HTTPAuthorizationCredentials | None = Depends(security)) -> CurrentUser:
    if credentials is None:
        logger.warning("auth rejected reason=missing_token")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid token")
    try:
        payload = jwt.decode(
            credentials.credentials,
            parse_pem_key(settings.jwt_public_key),
            algorithms=[settings.jwt_algorithm],
            issuer=settings.jwt_issuer,
            audience=settings.jwt_audience,
        )
        BlacklistService().ensure_not_blacklisted(payload["jti"])
        SessionService().ensure_session_active(payload["sid"])
        return CurrentUser(
            user_id=payload["sub"],
            sid=payload["sid"],
            jti=payload["jti"],
            roles=payload.get("roles", []),
            scope=payload.get("scope", ""),
        )
    except (jwt.PyJWTError, KeyError, ValueError) as exc:
        logger.warning("auth rejected reason=invalid_or_revoked_token")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid token") from exc


def require_scope(required_scope: str) -> Callable[[CurrentUser], CurrentUser]:
    def dependency(current_user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if required_scope not in current_user.scopes:
            logger.warning("authorization rejected reason=insufficient_scope user_id=%s required_scope=%s", current_user.user_id, required_scope)
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="insufficient scope")
        return current_user

    return dependency
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
    createBlacklistServiceFile(),
    createSessionServiceFile(),
    createPythonAppConftestFile(),
    createPythonAppProfileApiTestFile()
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
  const modelImports = options.templateName === "python-main" ? "from app.models import permission, role, session, user  # noqa: F401" : "from app.models import app_setting, sample_profile  # noqa: F401";

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
  "bcrypt>=4.0.1,<5.0.0",
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
      content: `map $http_x_request_id $proxy_request_id {
  default $http_x_request_id;
  "" $request_id;
}

log_format safe_json escape=json
  '{"time":"$time_iso8601","remote_addr":"$remote_addr","request_id":"$proxy_request_id","method":"$request_method","uri":"$uri","status":$status,"bytes_sent":$body_bytes_sent,"request_time":$request_time,"upstream_response_time":"$upstream_response_time"}';

server {
  listen 80;
  server_name _;

  client_max_body_size 10m;
  access_log /var/log/nginx/access.log safe_json;
  error_log /var/log/nginx/error.log warn;

  add_header X-Content-Type-Options "nosniff" always;
  add_header X-Frame-Options "DENY" always;
  add_header Referrer-Policy "strict-origin-when-cross-origin" always;
  add_header Permissions-Policy "geolocation=(), camera=(), microphone=()" always;
  # Enable only when TLS is terminated at this nginx layer and HSTS policy is approved.
  # add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

  location /health {
    proxy_pass http://api:8000/health;
    proxy_set_header X-Request-ID $proxy_request_id;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  location / {
    proxy_pass http://api:8000;
    proxy_set_header Host $host;
    proxy_set_header X-Request-ID $proxy_request_id;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
`
    },
    {
      path: ".github/workflows/ci.yml",
      content: createGithubActionsWorkflow(options, includePrivateKey)
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
${includePrivateKey ? "    jwt_private_key: str = \"\"\n" : ""}    jwt_public_key: str = ""
${includePrivateKey ? `
    access_token_expire_minutes: int = 60
    refresh_token_expire_days: int = 7
    refresh_token_rotate: bool = True
    refresh_token_reuse_grace_seconds: int = 10
` : ""}
    token_blacklist_prefix: str = "auth:test:blacklist:jti:"
${includePrivateKey ? "    refresh_token_prefix: str = \"auth:test:refresh:\"\n" : ""}    session_prefix: str = "auth:test:session:"

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
    ...createStageSevenFiles(options),
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
      content: createSeedMainContent(options)
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

const PYTHON_TEST_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC+Z6emQGbqLphz
OdHE4MhNdafo4XUxkRYob7UbDFW8/nT+pbLjjh5gxIefoRDxeqYhWgz1hBf3Vv27
AV2Ug6E8Vgts+iLkBUfd5J6LTVSxbu1xMHo66pqborFcyJcXDfJh2Kaz/HsXLwFG
m42wx4pNUvMSP72KIjexlpvbfG3GwVO610Nhz1RSyHcrOyzeDMOOU6FYKGynUk9B
g5tPItGLbOs2A6bCd03bLQddv60Quv1Cbqx9e1RabPa003Bks1uBT/OjD1LFD1CZ
4WIHyiPJbNc+PwG8raaVk6lie1AX+z5BGaz9O4LWgLR32GKLu2ezPw7nm5c6tIge
qFHgSoJHAgMBAAECggEBAJf6tte9+iecj7URhr2mSluBuUfqhhfNXilimOWBIAKd
/Raxfiuiad8Fn9erwZFuO6LNdSCXkmWr+xVEjsSXmKBHchFHS4hEKswTyvUYAa0r
BL3fWwEh98yYvQd5WRhe2oR9YPqzYjDsJRGN4jgj3eHAfyKm3AyhKWFH/RnhpOIK
VwhJqaGItTidthUJbFIYIuuZ5Vjohj6gGd4WooyQsQaiELCa1nzZzuMSmLJfUgp+
7QkOWW4BUZvESO/vEJcrcXpczkOsQqq2u78oOtsMxvXExFDlu8kDWvXquvkEajVj
a8SlHS/B13EsS5XqsWnwBawL0mp161IMAwro8cV7z6ECgYEA7RmmSDfD+2+6RBh5
L+KIQ+jymUDTGHJF0DGCRVOePmQDgzzj4n4+B47RpYu9LOxnBDehOgbW4ji+6oo/
leQf5I95Hj6PloDb2Pm7h2/RGhB7El5sv6hRjSRDjxdHAs9aFsFuFIG1oD20sxbG
EcQdpaa8qW2/K4D3oyD+tk8mHtcCgYEAzZUf6/QMnaw3PY6aV3ss2vc72APs02gG
otNW0BoCkCIEsKNVQquR2VLS/2kxsISiKJmuJhqHBrFGRpjp0MqyjoTkUBy9DZyF
xOO6AQr9J1PKbWOriPPxRwgyBqG100CvDAtLzhhFgtHwM4Ai1d5hToP4Pe7DPkRh
+hVkhfpwehECgYABZmxf8sxaeL9t1YMpsDnDxOVh2Esm0s3su84cILFHhwmqRbrG
xJ4TJ1m/k4KreD3nfXibQh0UuucNtYFInk8950b80bvBVMN3lYnw880VTVGcuygD
Pbg1kChB+Q43SwgqKDxBLL7o0lR11kWXJ0RRjRmCGp7NX/aWZQR8CR2dgwKBgFjS
NC+CiqzYyikbYo2nVzLnnIBw+bJBAJT60Egq5K6XNAWJG/4pGGOXyDe3oFNOiq0V
8MrfrTT0BJPd3y9pVAoFWotOT1QBKz5s0WE/+S4zooLujB8onjb9UHfTCDbUfIys
mLzbebTStX/avbI/WTVOCUPg05QkgVxGP98u28exAoGBAIu0+fCIYoy07yEmomhk
+HqsmDOq9mnC9H5y8xZ1z55SMqWoqc91e8HSsKmdQL0htcOHErjAGvlCRGP9vP1B
cifihzNMBiRtXx/XfG4UN5mmF5rJgdNvQPXuFhETyZ2E95f2ks3OZnYR0Ft1ejbZ
TZYO7jMxHqi6RD0PlREnq6CJ
-----END PRIVATE KEY-----`;

const PYTHON_TEST_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAvmenpkBm6i6YcznRxODI
TXWn6OF1MZEWKG+1GwxVvP50/qWy444eYMSHn6EQ8XqmIVoM9YQX91b9uwFdlIOh
PFYLbPoi5AVH3eSei01UsW7tcTB6Ouqam6KxXMiXFw3yYdims/x7Fy8BRpuNsMeK
TVLzEj+9iiI3sZab23xtxsFTutdDYc9UUsh3Kzss3gzDjlOhWChsp1JPQYObTyLR
i2zrNgOmwndN2y0HXb+tELr9Qm6sfXtUWmz2tNNwZLNbgU/zow9SxQ9QmeFiB8oj
yWzXPj8BvK2mlZOpYntQF/s+QRms/TuC1oC0d9hii7tnsz8O55uXOrSIHqhR4EqC
RwIDAQAB
-----END PUBLIC KEY-----`;

function createPythonMainConftestFile(): TemplateFile {
  return {
    path: "tests/conftest.py",
    content: `from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import app

TEST_PRIVATE_KEY = """${PYTHON_TEST_PRIVATE_KEY}"""
TEST_PUBLIC_KEY = """${PYTHON_TEST_PUBLIC_KEY}"""


@pytest.fixture(autouse=True)
def configure_test_settings(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    monkeypatch.setattr(settings, "jwt_private_key", TEST_PRIVATE_KEY)
    monkeypatch.setattr(settings, "jwt_public_key", TEST_PUBLIC_KEY)
    monkeypatch.setattr(settings, "jwt_issuer", "auth-service-test")
    monkeypatch.setattr(settings, "jwt_audience", "backend-api-test")
    yield


@pytest.fixture
def client() -> Iterator[TestClient]:
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def test_keys() -> dict[str, str]:
    return {"private_key": TEST_PRIVATE_KEY, "public_key": TEST_PUBLIC_KEY}
`
  };
}

function createPythonMainAuthApiTestFile(): TemplateFile {
  return {
    path: "tests/test_auth_api.py",
    content: `from types import SimpleNamespace

import pytest

import app.api.auth as auth_api
from app.schemas.auth import LogoutResponse, TokenResponse, UserResponse
from app.schemas.auth import LoginRequest
from app.services.auth_service import AuthService


def test_login_success_returns_tokens(client, monkeypatch: pytest.MonkeyPatch) -> None:
    class FakeAuthService:
        def login(self, payload: LoginRequest) -> TokenResponse:
            assert str(payload.username).lower() == "admin@example.com"
            return TokenResponse(access_token="access", refresh_token="refresh", expires_in=3600)

    monkeypatch.setattr(auth_api, "AuthService", FakeAuthService)

    response = client.post("/auth/login", json={"username": "admin@example.com", "password": "password123"})

    assert response.status_code == 200
    assert response.json()["access_token"] == "access"
    assert response.json()["refresh_token"] == "refresh"
    assert response.headers["X-Request-ID"]


def test_login_failure_returns_401(client) -> None:
    response = client.post("/auth/login", json={"username": "admin@example.com", "password": "wrong"})

    assert response.status_code == 401
    assert response.json()["detail"] == "invalid credentials"
    assert response.headers["X-Request-ID"]


def test_refresh_success_returns_new_tokens(client, monkeypatch: pytest.MonkeyPatch) -> None:
    class FakeAuthService:
        def refresh(self, refresh_token: str) -> TokenResponse:
            assert refresh_token == "refresh"
            return TokenResponse(access_token="new-access", refresh_token="new-refresh", expires_in=3600)

    monkeypatch.setattr(auth_api, "AuthService", FakeAuthService)

    response = client.post("/auth/refresh", json={"refresh_token": "refresh"})

    assert response.status_code == 200
    assert response.json()["access_token"] == "new-access"
    assert response.json()["refresh_token"] == "new-refresh"


def test_refresh_failure_returns_401(client, monkeypatch: pytest.MonkeyPatch) -> None:
    class FakeAuthService:
        def refresh(self, refresh_token: str) -> TokenResponse:
            raise ValueError("invalid refresh token")

    monkeypatch.setattr(auth_api, "AuthService", FakeAuthService)

    response = client.post("/auth/refresh", json={"refresh_token": "bad"})

    assert response.status_code == 401
    assert response.json()["detail"] == "invalid refresh token"


def test_logout_success_returns_message(client, monkeypatch: pytest.MonkeyPatch) -> None:
    class FakeAuthService:
        def logout(self, access_token: str) -> LogoutResponse:
            assert access_token == "access"
            return LogoutResponse(message="logged out")

    monkeypatch.setattr(auth_api, "AuthService", FakeAuthService)

    response = client.post("/auth/logout", headers={"Authorization": "Bearer access"})

    assert response.status_code == 200
    assert response.json() == {"message": "logged out"}


def test_logout_missing_token_returns_401(client) -> None:
    response = client.post("/auth/logout")

    assert response.status_code == 401
    assert response.json()["detail"] == "invalid access token"


def test_logout_blacklists_jti_and_revokes_session() -> None:
    calls: dict[str, object] = {}
    service = AuthService()
    service.tokens = SimpleNamespace(
        verify_access_token=lambda token: {"jti": "jti-123", "exp": 4_102_444_800, "sid": "sid-123"}
    )
    service.blacklist = SimpleNamespace(add_jti=lambda jti, exp: calls.update({"jti": jti, "exp": exp}))
    service.refresh_tokens = SimpleNamespace(revoke_session=lambda sid: calls.update({"sid": sid}))

    response = service.logout("access")

    assert response.message == "logged out"
    assert calls == {"jti": "jti-123", "exp": 4_102_444_800, "sid": "sid-123"}


def test_me_success_returns_current_user(client, monkeypatch: pytest.MonkeyPatch) -> None:
    class FakeAuthService:
        def current_user(self, access_token: str) -> UserResponse:
            assert access_token == "access"
            return UserResponse(id="user_123", username="admin@example.com", roles=["admin"])

    monkeypatch.setattr(auth_api, "AuthService", FakeAuthService)

    response = client.get("/auth/me", headers={"Authorization": "Bearer access"})

    assert response.status_code == 200
    assert response.json()["id"] == "user_123"
    assert response.json()["roles"] == ["admin"]


def test_me_blacklisted_token_returns_401(client, monkeypatch: pytest.MonkeyPatch) -> None:
    class FakeAuthService:
        def current_user(self, access_token: str) -> UserResponse:
            raise ValueError("token is blacklisted")

    monkeypatch.setattr(auth_api, "AuthService", FakeAuthService)

    response = client.get("/auth/me", headers={"Authorization": "Bearer access"})

    assert response.status_code == 401
    assert response.json()["detail"] == "invalid access token"


def test_me_revoked_session_returns_401(client, monkeypatch: pytest.MonkeyPatch) -> None:
    class FakeAuthService:
        def current_user(self, access_token: str) -> UserResponse:
            raise ValueError("session is revoked")

    monkeypatch.setattr(auth_api, "AuthService", FakeAuthService)

    response = client.get("/auth/me", headers={"Authorization": "Bearer access"})

    assert response.status_code == 401
    assert response.json()["detail"] == "invalid access token"


def test_current_user_checks_session_status() -> None:
    def reject_session(sid: str) -> None:
        assert sid == "sid-123"
        raise ValueError("session is revoked")

    service = AuthService()
    service.tokens = SimpleNamespace(
        verify_access_token=lambda token: {"sub": "user_123", "jti": "jti-123", "sid": "sid-123", "roles": ["admin"]}
    )
    service.blacklist = SimpleNamespace(ensure_not_blacklisted=lambda jti: None)
    service.refresh_tokens = SimpleNamespace(ensure_session_active=reject_session)

    with pytest.raises(ValueError, match="session is revoked"):
        service.current_user("access")
`
  };
}

function createPythonMainTokenServiceTestFile(): TemplateFile {
  return {
    path: "tests/test_token_service.py",
    content: `import pytest
import jwt

from app.core.config import settings
from app.services.token_service import TokenService


def test_create_access_token_includes_required_payload_claims(test_keys: dict[str, str]) -> None:
    token = TokenService().create_access_token(
        user_id="user_123",
        sid="sid_123",
        roles=["admin"],
        scope="user:read",
    )

    payload = jwt.decode(
        token,
        test_keys["public_key"],
        algorithms=[settings.jwt_algorithm],
        issuer=settings.jwt_issuer,
        audience=settings.jwt_audience,
    )

    assert payload["sub"] == "user_123"
    assert payload["sid"] == "sid_123"
    assert payload["roles"] == ["admin"]
    assert payload["scope"] == "user:read"
    assert {"iat", "exp", "jti", "iss", "aud"}.issubset(payload)


def test_verify_access_token_accepts_valid_token() -> None:
    service = TokenService()
    token = service.create_access_token(user_id="user_123", sid="sid_123", roles=["admin"], scope="user:read")

    payload = service.verify_access_token(token)

    assert payload["sub"] == "user_123"
    assert payload["sid"] == "sid_123"


def test_verify_access_token_rejects_invalid_token() -> None:
    with pytest.raises(jwt.PyJWTError):
        TokenService().verify_access_token("not-a-jwt")
`
  };
}

function createPythonMainRefreshTokenServiceTestFile(): TemplateFile {
  return {
    path: "tests/test_refresh_token_service.py",
    content: `from datetime import datetime, timedelta, timezone

import pytest

import app.services.refresh_token_service as refresh_module
import app.services.session_service as session_module
from app.core.config import settings
from app.core.security import sha256_text
from app.services.refresh_token_service import RefreshTokenService


class FakeRedis:
    def __init__(self) -> None:
        self.hashes: dict[str, dict[str, str]] = {}
        self.values: dict[str, str] = {}
        self.expirations: dict[str, int] = {}

    def hset(self, key: str, mapping: dict[str, str]) -> None:
        self.hashes.setdefault(key, {}).update(mapping)

    def hgetall(self, key: str) -> dict[str, str]:
        return dict(self.hashes.get(key, {}))

    def expire(self, key: str, ttl: int) -> None:
        self.expirations[key] = ttl

    def set(self, key: str, value: str) -> None:
        self.values[key] = value

    def get(self, key: str) -> str | None:
        return self.values.get(key)


@pytest.fixture
def fake_redis(monkeypatch: pytest.MonkeyPatch) -> FakeRedis:
    redis = FakeRedis()
    monkeypatch.setattr(refresh_module, "get_redis", lambda: redis)
    monkeypatch.setattr(session_module, "get_redis", lambda: redis)
    return redis


def refresh_key(refresh_token: str) -> str:
    return f"{settings.refresh_token_prefix}{sha256_text(refresh_token)}"


def session_key(sid: str) -> str:
    return f"{settings.session_prefix}{sid}"


def test_rotate_refresh_token_marks_old_hash_and_returns_new_token(fake_redis: FakeRedis) -> None:
    service = RefreshTokenService()
    refresh_token = service.create_refresh_token(user_id="user_123", sid="sid_123")

    rotation = service.rotate_refresh_token(refresh_token)

    old_hash = fake_redis.hgetall(refresh_key(refresh_token))
    new_hash = fake_redis.hgetall(refresh_key(rotation["refresh_token"]))
    assert rotation["user_id"] == "user_123"
    assert rotation["sid"] == "sid_123"
    assert rotation["refresh_token"] != refresh_token
    assert old_hash["status"] == "rotated"
    assert old_hash["rotated_at"]
    assert old_hash["replaced_by"] == sha256_text(rotation["refresh_token"])
    assert new_hash["status"] == "active"
    assert new_hash["created_at"]


def test_rotated_refresh_token_within_grace_does_not_revoke_session(fake_redis: FakeRedis) -> None:
    service = RefreshTokenService()
    refresh_token = service.create_refresh_token(user_id="user_123", sid="sid_123")
    service.rotate_refresh_token(refresh_token)

    with pytest.raises(ValueError, match="already rotated"):
        service.rotate_refresh_token(refresh_token)

    assert fake_redis.get(session_key("sid_123")) is None


def test_rotated_refresh_token_after_grace_revokes_session(fake_redis: FakeRedis) -> None:
    service = RefreshTokenService()
    refresh_token = service.create_refresh_token(user_id="user_123", sid="sid_123")
    service.rotate_refresh_token(refresh_token)
    fake_redis.hashes[refresh_key(refresh_token)]["rotated_at"] = (
        datetime.now(timezone.utc) - timedelta(seconds=settings.refresh_token_reuse_grace_seconds + 1)
    ).isoformat()

    with pytest.raises(ValueError, match="reuse detected"):
        service.rotate_refresh_token(refresh_token)

    assert fake_redis.get(session_key("sid_123")) == "revoked"


def test_revoked_session_rejects_refresh(fake_redis: FakeRedis) -> None:
    service = RefreshTokenService()
    refresh_token = service.create_refresh_token(user_id="user_123", sid="sid_123")
    service.revoke_session("sid_123")

    with pytest.raises(ValueError, match="session is revoked"):
        service.rotate_refresh_token(refresh_token)
`
  };
}

function createPythonAppConftestFile(): TemplateFile {
  return {
    path: "tests/conftest.py",
    content: `from collections.abc import Callable, Iterator
from datetime import datetime, timedelta, timezone
from uuid import uuid4

import jwt
import pytest
from fastapi.testclient import TestClient

import app.deps.auth as auth_deps
from app.core.config import settings
from app.main import app

TEST_PRIVATE_KEY = """${PYTHON_TEST_PRIVATE_KEY}"""
TEST_PUBLIC_KEY = """${PYTHON_TEST_PUBLIC_KEY}"""


class AllowBlacklistService:
    def ensure_not_blacklisted(self, jti: str) -> None:
        return None


class ActiveSessionService:
    def ensure_session_active(self, sid: str) -> None:
        return None


@pytest.fixture(autouse=True)
def configure_test_settings(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    monkeypatch.setattr(settings, "jwt_public_key", TEST_PUBLIC_KEY)
    monkeypatch.setattr(settings, "jwt_issuer", "auth-service-test")
    monkeypatch.setattr(settings, "jwt_audience", "backend-api-test")
    monkeypatch.setattr(auth_deps, "BlacklistService", AllowBlacklistService)
    monkeypatch.setattr(auth_deps, "SessionService", ActiveSessionService)
    yield


@pytest.fixture
def client() -> Iterator[TestClient]:
    with TestClient(app) as test_client:
        yield test_client


def _make_access_token(
    *,
    user_id: str = "user_123",
    sid: str = "sid_123",
    jti: str | None = None,
    roles: list[str] | None = None,
    scope: str = "user:read",
    issuer: str | None = None,
    audience: str | None = None,
    expires_delta: timedelta = timedelta(minutes=5),
    private_key: str = TEST_PRIVATE_KEY,
) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "iss": issuer or settings.jwt_issuer,
        "aud": audience or settings.jwt_audience,
        "iat": int(now.timestamp()),
        "exp": int((now + expires_delta).timestamp()),
        "jti": jti or str(uuid4()),
        "sid": sid,
        "roles": roles or ["admin"],
        "scope": scope,
    }
    return jwt.encode(payload, private_key, algorithm=settings.jwt_algorithm)


@pytest.fixture
def access_token_factory() -> Callable[..., str]:
    return _make_access_token
`
  };
}

function createPythonAppProfileApiTestFile(): TemplateFile {
  return {
    path: "tests/test_profile_api.py",
    content: `from datetime import timedelta

import pytest

import app.deps.auth as auth_deps


def assert_request_id(response) -> None:
    assert response.headers["X-Request-ID"]


def test_profile_requires_token(client) -> None:
    response = client.get("/api/profile")

    assert response.status_code == 401
    assert response.json()["detail"] == "invalid token"
    assert_request_id(response)


def test_profile_accepts_valid_token(client, access_token_factory) -> None:
    token = access_token_factory(scope="user:read")

    response = client.get("/api/profile", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 200
    assert response.json() == {"user_id": "user_123", "message": "authorized"}
    assert_request_id(response)


def test_profile_rejects_invalid_signature(client, access_token_factory) -> None:
    token = access_token_factory()
    header, payload, signature = token.split(".")
    invalid_token = f"{header}.{payload}.invalid-{signature}"

    response = client.get("/api/profile", headers={"Authorization": f"Bearer {invalid_token}"})

    assert response.status_code == 401
    assert response.json()["detail"] == "invalid token"
    assert_request_id(response)


def test_profile_rejects_wrong_issuer(client, access_token_factory) -> None:
    token = access_token_factory(issuer="other-issuer")

    response = client.get("/api/profile", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 401
    assert response.json()["detail"] == "invalid token"


def test_profile_rejects_wrong_audience(client, access_token_factory) -> None:
    token = access_token_factory(audience="other-audience")

    response = client.get("/api/profile", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 401
    assert response.json()["detail"] == "invalid token"


def test_profile_rejects_expired_token(client, access_token_factory) -> None:
    token = access_token_factory(expires_delta=timedelta(minutes=-5))

    response = client.get("/api/profile", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 401
    assert response.json()["detail"] == "invalid token"


def test_profile_rejects_blacklisted_token(client, access_token_factory, monkeypatch: pytest.MonkeyPatch) -> None:
    class RejectingBlacklistService:
        def ensure_not_blacklisted(self, jti: str) -> None:
            raise ValueError("token is blacklisted")

    monkeypatch.setattr(auth_deps, "BlacklistService", RejectingBlacklistService)
    token = access_token_factory(jti="blacklisted")

    response = client.get("/api/profile", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 401
    assert response.json()["detail"] == "invalid token"
    assert_request_id(response)


def test_profile_rejects_revoked_session(client, access_token_factory, monkeypatch: pytest.MonkeyPatch) -> None:
    class RevokedSessionService:
        def ensure_session_active(self, sid: str) -> None:
            assert sid == "revoked-sid"
            raise ValueError("session is revoked")

    monkeypatch.setattr(auth_deps, "SessionService", RevokedSessionService)
    token = access_token_factory(sid="revoked-sid")

    response = client.get("/api/profile", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 401
    assert response.json()["detail"] == "invalid token"
    assert_request_id(response)


def test_profile_rejects_insufficient_scope(client, access_token_factory) -> None:
    token = access_token_factory(scope="profile:read")

    response = client.get("/api/profile", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 403
    assert response.json()["detail"] == "insufficient scope"
    assert_request_id(response)
`
  };
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

function createSessionServiceFile(): TemplateFile {
  return {
    path: "app/services/session_service.py",
    content: `from app.core.config import settings
from app.core.redis import get_redis


class SessionService:
    def revoke_session(self, sid: str) -> None:
        get_redis().set(f"{settings.session_prefix}{sid}", "revoked")

    def ensure_session_active(self, sid: str) -> None:
        if get_redis().get(f"{settings.session_prefix}{sid}") == "revoked":
            raise ValueError("session is revoked")
`
  };
}

function createStageSevenFiles(options: SharedPythonOptions): TemplateFile[] {
  if (options.templateName === "python-main") {
    return [
      {
        path: "alembic/versions/0001_initial_auth_schema.py",
        content: `"""initial auth schema

Revision ID: 0001_initial_auth_schema
Revises:
Create Date: 2026-07-02
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = "0001_initial_auth_schema"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("hashed_password", sa.String(length=255), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.create_index("ix_users_id", "users", ["id"])
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    op.create_table(
        "roles",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=64), nullable=False),
    )
    op.create_index("ix_roles_id", "roles", ["id"])
    op.create_index("ix_roles_name", "roles", ["name"], unique=True)

    op.create_table(
        "permissions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=128), nullable=False),
        sa.Column("description", sa.String(length=255), nullable=False, server_default=""),
    )
    op.create_index("ix_permissions_id", "permissions", ["id"])
    op.create_index("ix_permissions_name", "permissions", ["name"], unique=True)

    op.create_table(
        "sessions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("sid", sa.String(length=64), nullable=False),
        sa.Column("user_id", sa.String(length=64), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="active"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_sessions_id", "sessions", ["id"])
    op.create_index("ix_sessions_sid", "sessions", ["sid"], unique=True)
    op.create_index("ix_sessions_user_id", "sessions", ["user_id"])

    op.create_table(
        "user_roles",
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("role_id", sa.Integer(), sa.ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True),
    )
    op.create_table(
        "role_permissions",
        sa.Column("role_id", sa.Integer(), sa.ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("permission_id", sa.Integer(), sa.ForeignKey("permissions.id", ondelete="CASCADE"), primary_key=True),
    )


def downgrade() -> None:
    op.drop_table("role_permissions")
    op.drop_table("user_roles")
    op.drop_index("ix_sessions_user_id", table_name="sessions")
    op.drop_index("ix_sessions_sid", table_name="sessions")
    op.drop_index("ix_sessions_id", table_name="sessions")
    op.drop_table("sessions")
    op.drop_index("ix_permissions_name", table_name="permissions")
    op.drop_index("ix_permissions_id", table_name="permissions")
    op.drop_table("permissions")
    op.drop_index("ix_roles_name", table_name="roles")
    op.drop_index("ix_roles_id", table_name="roles")
    op.drop_table("roles")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_index("ix_users_id", table_name="users")
    op.drop_table("users")
`
      }
    ];
  }

  return [
    {
      path: "app/models/app_setting.py",
      content: `from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class AppSetting(Base):
    __tablename__ = "app_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    key: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    value: Mapped[str] = mapped_column(String(512))
    description: Mapped[str] = mapped_column(String(255), default="")
`
    },
    {
      path: "app/models/sample_profile.py",
      content: `from sqlalchemy import Boolean, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class SampleProfile(Base):
    __tablename__ = "sample_profiles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    slug: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    display_name: Mapped[str] = mapped_column(String(255))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
`
    },
    {
      path: "alembic/versions/0001_initial_app_schema.py",
      content: `"""initial app schema

Revision ID: 0001_initial_app_schema
Revises:
Create Date: 2026-07-02
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = "0001_initial_app_schema"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "app_settings",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("key", sa.String(length=128), nullable=False),
        sa.Column("value", sa.String(length=512), nullable=False),
        sa.Column("description", sa.String(length=255), nullable=False, server_default=""),
    )
    op.create_index("ix_app_settings_id", "app_settings", ["id"])
    op.create_index("ix_app_settings_key", "app_settings", ["key"], unique=True)

    op.create_table(
        "sample_profiles",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("slug", sa.String(length=128), nullable=False),
        sa.Column("display_name", sa.String(length=255), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.create_index("ix_sample_profiles_id", "sample_profiles", ["id"])
    op.create_index("ix_sample_profiles_slug", "sample_profiles", ["slug"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_sample_profiles_slug", table_name="sample_profiles")
    op.drop_index("ix_sample_profiles_id", table_name="sample_profiles")
    op.drop_table("sample_profiles")
    op.drop_index("ix_app_settings_key", table_name="app_settings")
    op.drop_index("ix_app_settings_id", table_name="app_settings")
    op.drop_table("app_settings")
`
    }
  ];
}

function createSeedMainContent(options: SharedPythonOptions): string {
  if (options.templateName === "python-main") {
    return `import logging

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.core.logging import configure_logging
from app.core.security import hash_password
from app.models.permission import Permission
from app.models.role import Role, role_permissions, user_roles
from app.models.user import User

logger = logging.getLogger(__name__)

DEFAULT_ADMIN_EMAIL = "admin@example.com"
DEFAULT_ADMIN_PASSWORD = "password123"
DEFAULT_ROLE = "admin"
DEFAULT_PERMISSIONS = {
    "user:read": "Read current user profile data",
    "user:write": "Update user profile data",
}


def ensure_admin_user(db: Session) -> User:
    user = db.scalar(select(User).where(User.email == DEFAULT_ADMIN_EMAIL))
    if user is not None:
        logger.info("seed skipped existing admin user email=%s", DEFAULT_ADMIN_EMAIL)
        return user
    user = User(email=DEFAULT_ADMIN_EMAIL, hashed_password=hash_password(DEFAULT_ADMIN_PASSWORD), is_active=True)
    db.add(user)
    db.flush()
    logger.info("seed created admin user email=%s", DEFAULT_ADMIN_EMAIL)
    return user


def ensure_role(db: Session, name: str) -> Role:
    role = db.scalar(select(Role).where(Role.name == name))
    if role is not None:
        logger.info("seed skipped existing role name=%s", name)
        return role
    role = Role(name=name)
    db.add(role)
    db.flush()
    logger.info("seed created role name=%s", name)
    return role


def ensure_permission(db: Session, name: str, description: str) -> Permission:
    permission = db.scalar(select(Permission).where(Permission.name == name))
    if permission is not None:
        logger.info("seed skipped existing permission name=%s", name)
        return permission
    permission = Permission(name=name, description=description)
    db.add(permission)
    db.flush()
    logger.info("seed created permission name=%s", name)
    return permission


def ensure_user_role(db: Session, user: User, role: Role) -> None:
    exists = db.execute(select(user_roles.c.user_id).where(user_roles.c.user_id == user.id, user_roles.c.role_id == role.id)).first()
    if exists is not None:
        logger.info("seed skipped existing user role user_id=%s role=%s", user.id, role.name)
        return
    db.execute(user_roles.insert().values(user_id=user.id, role_id=role.id))
    logger.info("seed attached role user_id=%s role=%s", user.id, role.name)


def ensure_role_permission(db: Session, role: Role, permission: Permission) -> None:
    exists = db.execute(
        select(role_permissions.c.role_id).where(
            role_permissions.c.role_id == role.id,
            role_permissions.c.permission_id == permission.id,
        )
    ).first()
    if exists is not None:
        logger.info("seed skipped existing role permission role=%s permission=%s", role.name, permission.name)
        return
    db.execute(role_permissions.insert().values(role_id=role.id, permission_id=permission.id))
    logger.info("seed attached permission role=%s permission=%s", role.name, permission.name)


def seed(db: Session) -> None:
    logger.info("seed started target=python-main")
    admin = ensure_admin_user(db)
    role = ensure_role(db, DEFAULT_ROLE)
    ensure_user_role(db, admin, role)
    for permission_name, description in DEFAULT_PERMISSIONS.items():
        permission = ensure_permission(db, permission_name, description)
        ensure_role_permission(db, role, permission)
    logger.info("seed completed target=python-main")


def main() -> None:
    configure_logging()
    db = SessionLocal()
    try:
        seed(db)
        db.commit()
    except Exception:
        db.rollback()
        logger.exception("seed failed target=python-main")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
`;
  }

  return `import logging

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.core.logging import configure_logging
from app.models.app_setting import AppSetting
from app.models.sample_profile import SampleProfile

logger = logging.getLogger(__name__)

DEFAULT_SETTINGS = {
    "site_name": ("Backend API", "Display name for the generated API service"),
    "feature.profile_demo_enabled": ("true", "Enable the scaffolded profile demo endpoint"),
}
DEFAULT_SAMPLE_PROFILES = {
    "starter-profile": "Starter Profile",
}


def ensure_setting(db: Session, key: str, value: str, description: str) -> AppSetting:
    setting = db.scalar(select(AppSetting).where(AppSetting.key == key))
    if setting is not None:
        logger.info("seed skipped existing setting key=%s", key)
        return setting
    setting = AppSetting(key=key, value=value, description=description)
    db.add(setting)
    db.flush()
    logger.info("seed created setting key=%s", key)
    return setting


def ensure_sample_profile(db: Session, slug: str, display_name: str) -> SampleProfile:
    profile = db.scalar(select(SampleProfile).where(SampleProfile.slug == slug))
    if profile is not None:
        logger.info("seed skipped existing sample profile slug=%s", slug)
        return profile
    profile = SampleProfile(slug=slug, display_name=display_name, is_active=True)
    db.add(profile)
    db.flush()
    logger.info("seed created sample profile slug=%s", slug)
    return profile


def seed(db: Session) -> None:
    logger.info("seed started target=python-app")
    for key, (value, description) in DEFAULT_SETTINGS.items():
        ensure_setting(db, key, value, description)
    for slug, display_name in DEFAULT_SAMPLE_PROFILES.items():
        ensure_sample_profile(db, slug, display_name)
    logger.info("seed completed target=python-app")


def main() -> None:
    configure_logging()
    db = SessionLocal()
    try:
        seed(db)
        db.commit()
    except Exception:
        db.rollback()
        logger.exception("seed failed target=python-app")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
`;
}

function createGithubActionsWorkflow(options: SharedPythonOptions, includePrivateKey: boolean): string {
  const testPrivateKeySecret = includePrivateKey ? "      JWT_PRIVATE_KEY: ${{ secrets.TEST_JWT_PRIVATE_KEY }}\n" : "";
  const productPrivateKeySecret = includePrivateKey ? "      JWT_PRIVATE_KEY: ${{ secrets.PRODUCT_JWT_PRIVATE_KEY }}\n" : "";

  return `name: CI

on:
  pull_request:
    branches:
      - master
  push:
    branches:
      - master
    tags:
      - "v*"
      - "release-*"
  workflow_dispatch:
    inputs:
      deploy_environment:
        description: "Optional environment to deploy"
        type: choice
        default: none
        options:
          - none
          - test
          - product

env:
  IMAGE_NAME: ${options.serviceName}
  REGISTRY: ghcr.io/\${{ github.repository_owner }}

permissions:
  contents: read
  packages: write

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_DB: test_${options.envDatabaseName}
          POSTGRES_USER: test_user
          POSTGRES_PASSWORD: test_password
        ports:
          - "5432:5432"
        options: >-
          --health-cmd "pg_isready -U test_user -d test_${options.envDatabaseName}"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      redis:
        image: redis:7-alpine
        ports:
          - "6379:6379"
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    env:
      APP_ENV: test
      DATABASE_URL: postgresql+psycopg://test_user:test_password@localhost:5432/test_${options.envDatabaseName}
      REDIS_URL: redis://localhost:6379/0
${testPrivateKeySecret}      JWT_PUBLIC_KEY: \${{ secrets.TEST_JWT_PUBLIC_KEY }}
      CORS_ALLOW_ORIGINS: \${{ secrets.TEST_CORS_ALLOW_ORIGINS }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
      - run: pipx install pdm
      - run: pdm install
      - run: pdm run lint
      - run: pdm run test
      - name: Check Alembic migration state
        run: pdm run alembic-current

  docker-build:
    runs-on: ubuntu-latest
    needs: test
    steps:
      - uses: actions/checkout@v4
      - name: Build Docker image
        run: docker build --tag "$IMAGE_NAME:test-\${{ github.sha }}" .

  deploy-test:
    runs-on: ubuntu-latest
    needs: docker-build
    if: github.ref == 'refs/heads/master' || (github.event_name == 'workflow_dispatch' && inputs.deploy_environment == 'test')
    environment: test
    env:
      DATABASE_URL: \${{ secrets.TEST_DATABASE_URL }}
      REDIS_URL: \${{ secrets.TEST_REDIS_URL }}
${testPrivateKeySecret}      JWT_PUBLIC_KEY: \${{ secrets.TEST_JWT_PUBLIC_KEY }}
      CORS_ALLOW_ORIGINS: \${{ secrets.TEST_CORS_ALLOW_ORIGINS }}
      REGISTRY_TOKEN: \${{ secrets.TEST_DOCKER_REGISTRY_TOKEN }}
      IMAGE_TAG: test-\${{ github.sha }}
    steps:
      - uses: actions/checkout@v4
      - name: Build deployment image
        run: docker build --tag "$REGISTRY/$IMAGE_NAME:$IMAGE_TAG" .
      - name: Login to registry
        if: env.REGISTRY_TOKEN != ''
        run: echo "$REGISTRY_TOKEN" | docker login "$REGISTRY" --username "\${{ github.actor }}" --password-stdin
      - name: Push test image
        if: env.REGISTRY_TOKEN != ''
        run: docker push "$REGISTRY/$IMAGE_NAME:$IMAGE_TAG"
      - name: Deploy test environment
        run: |
          echo "Deploy test environment with image $REGISTRY/$IMAGE_NAME:$IMAGE_TAG"
          echo "Replace this placeholder with your test deployment command. Do not print secrets or .env contents."

  deploy-product:
    runs-on: ubuntu-latest
    needs: docker-build
    if: >-
      (startsWith(github.ref, 'refs/tags/v') || startsWith(github.ref, 'refs/tags/release-')) ||
      (github.event_name == 'workflow_dispatch' && inputs.deploy_environment == 'product' && github.ref == 'refs/heads/master')
    environment: product
    env:
      DATABASE_URL: \${{ secrets.PRODUCT_DATABASE_URL }}
      REDIS_URL: \${{ secrets.PRODUCT_REDIS_URL }}
${productPrivateKeySecret}      JWT_PUBLIC_KEY: \${{ secrets.PRODUCT_JWT_PUBLIC_KEY }}
      CORS_ALLOW_ORIGINS: \${{ secrets.PRODUCT_CORS_ALLOW_ORIGINS }}
      REGISTRY_TOKEN: \${{ secrets.PRODUCT_DOCKER_REGISTRY_TOKEN }}
      IMAGE_TAG: product-\${{ github.ref_name }}-\${{ github.sha }}
    steps:
      - uses: actions/checkout@v4
      - name: Build deployment image
        run: docker build --tag "$REGISTRY/$IMAGE_NAME:$IMAGE_TAG" .
      - name: Login to registry
        if: env.REGISTRY_TOKEN != ''
        run: echo "$REGISTRY_TOKEN" | docker login "$REGISTRY" --username "\${{ github.actor }}" --password-stdin
      - name: Push product image
        if: env.REGISTRY_TOKEN != ''
        run: docker push "$REGISTRY/$IMAGE_NAME:$IMAGE_TAG"
      - name: Deploy product environment
        run: |
          echo "Deploy product environment with image $REGISTRY/$IMAGE_NAME:$IMAGE_TAG"
          echo "Use GitHub Environment reviewers and branch/tag rules before enabling the real deploy command."
`;
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

${includePrivateKey ? `ACCESS_TOKEN_EXPIRE_MINUTES=${isProduct ? "30" : "60"}
REFRESH_TOKEN_EXPIRE_DAYS=${isProduct ? "30" : "7"}
REFRESH_TOKEN_ROTATE=true
REFRESH_TOKEN_REUSE_GRACE_SECONDS=10
` : ""}
TOKEN_BLACKLIST_PREFIX=auth:${env}:blacklist:jti:
${includePrivateKey ? `REFRESH_TOKEN_PREFIX=auth:${env}:refresh:
` : ""}SESSION_PREFIX=auth:${env}:session:

CORS_ALLOW_ORIGINS=${isProduct ? "https://app.example.com,https://admin.example.com" : "https://test.example.com,http://localhost:5173"}
CORS_ALLOW_CREDENTIALS=true

OPENAPI_ENABLED=${docsEnabled}
DOCS_ENABLED=${docsEnabled}
REDOC_ENABLED=${docsEnabled}
`;
}

function createPythonTemplateUsageDocs(options: SharedPythonOptions): string {
  const newline = String.fromCharCode(10);

  if (options.templateName === 'python-main') {
    return [
      '## Auth API',
      '',
      '- `POST /auth/login` issues access and refresh tokens for the auth service.',
      '- `POST /auth/refresh` rotates a refresh token and returns a new token pair.',
      '- `POST /auth/logout` blacklists the current access token `jti` and revokes the session.',
      '- `GET /auth/me` returns the current authenticated user.',
      '',
      '## JWT Configuration',
      '',
      '- `python-main` owns `JWT_PRIVATE_KEY`; `python-app` should only receive `JWT_PUBLIC_KEY`.',
      '- `parse_pem_key(...)` accepts raw PEM blocks or escaped newline secrets from CI and environment files.',
      '- Keep `JWT_ISSUER` and `JWT_AUDIENCE` aligned with the resource service.',
      '',
      '## Environment Variables',
      '',
      '| Variable | Purpose |',
      '| --- | --- |',
      '| `JWT_PRIVATE_KEY` | RS256 signing key for access tokens |',
      '| `JWT_PUBLIC_KEY` | Matching verification key for local checks and docs |',
      '| `JWT_ISSUER` | Token issuer value expected by verifiers |',
      '| `JWT_AUDIENCE` | Token audience value expected by verifiers |',
      '| `ACCESS_TOKEN_EXPIRE_MINUTES` | Access token lifetime |',
      '| `REFRESH_TOKEN_EXPIRE_DAYS` | Refresh token lifetime |',
      '| `REFRESH_TOKEN_REUSE_GRACE_SECONDS` | Replay grace tuning value for refresh rotation |',
      '| `TOKEN_BLACKLIST_PREFIX` | Redis prefix for revoked access-token `jti` values |',
      '| `REFRESH_TOKEN_PREFIX` | Redis prefix for refresh-token hashes |',
      '| `SESSION_PREFIX` | Redis prefix for session status markers |',
      '',
      '## Redis Token State',
      '',
      '- Access tokens are not stored in Redis.',
      '- Refresh tokens are stored as SHA-256 hashes, not plaintext values.',
      '- Refresh token rotation stores `created_at`, `rotated_at`, and `replaced_by` metadata on the old token hash.',
      '- Replaying a rotated refresh token within `REFRESH_TOKEN_REUSE_GRACE_SECONDS` is rejected without revoking the session; replaying it after the grace window revokes the session.',
      '- Logout writes the current access-token `jti` into the blacklist and marks the session revoked.',
      '- `/auth/me` also checks the session status so revoked sessions are rejected before access token expiry.',
      '',
      '## Database Migrations and Seed',
      '',
      '- Use `pdm run alembic-current` to inspect the active revision.',
      '- Use `pdm run migrate` to apply Alembic migrations.',
      '- Use `alembic downgrade -1` or `alembic downgrade <revision_id>` only for development, test, or pre-release rollback drills.',
      '- Use `pdm run seed` to populate baseline auth data for local development.',
      '- The seed is idempotent and ensures the default admin user, admin role, and starter permissions exist without duplicating rows.',
      '- Product does not auto-run seed; execute it manually only after reviewing the target environment.',
      '- Prefer immutable image rollback and forward-compatible repair migrations over relying on product database downgrade.',
      '',
      '## Logging and Request ID',
      '',
      '- Every request gets an `X-Request-ID` so auth and refresh failures can be traced across services.',
      '- Keep request logs, token logs, and secrets redacted.',
      '',
      '## Docker and nginx',
      '',
      '- `docker-compose.yml` is the local development path and uses Uvicorn with `--reload`.',
      '- The Dockerfile runs Gunicorn with Uvicorn workers for the production container.',
      '- nginx proxies the app and forwards `X-Request-ID`.',
      '',
      '## FAQ',
      '',
      '- **Why does login fail?** The demo credentials must match the scaffolded example user.',
      '- **Why does refresh fail?** The refresh token may be expired, rotated, or revoked.',
      '- **Why is `/auth/me` rejected?** The access token may be blacklisted or signed for the wrong issuer/audience.'
    ].join(newline);
  }

  return [
    '## Protected API Usage',
    '',
    '- `GET /api/profile` is the sample protected endpoint.',
    '- Call it with `Authorization: Bearer <access-token>`.',
    '- Missing token, invalid signature, wrong issuer or audience, expired token, or a blacklist hit all return 401.',
    '- Missing scope returns 403.',
    '',
    '## Auth Integration with python-main',
    '',
    '- Configure `JWT_PUBLIC_KEY` from the matching `python-main` private key.',
    '- Keep `JWT_ISSUER` and `JWT_AUDIENCE` identical across both services.',
    '- Do not add `JWT_PRIVATE_KEY` to this service.',
    '',
    '## Environment Variables',
    '',
    '| Variable | Purpose |',
    '| --- | --- |',
    '| `JWT_PUBLIC_KEY` | RS256 verification key from `python-main` |',
    '| `JWT_ISSUER` | Expected issuer value |',
    '| `JWT_AUDIENCE` | Expected audience value |',
      '| `REDIS_URL` | Redis blacklist and session revoke lookup |',
      '| `TOKEN_BLACKLIST_PREFIX` | Redis prefix for revoked access-token `jti` values |',
      '| `SESSION_PREFIX` | Redis prefix for revoked session markers from `python-main` |',
      '| `CORS_ALLOW_ORIGINS` | Allowed browser origins |',
    '| `DATABASE_URL` | PostgreSQL connection string |',
    '| `LOG_LEVEL` | Log verbosity |',
    '| `LOG_FORMAT` | JSON or plain-text logging |',
    '',
    '## Redis Blacklist',
    '',
    '- The resource service still checks Redis so revoked `jti` values are rejected everywhere.',
    '- It also checks `SESSION_PREFIX` so sessions revoked by logout or refresh-token reuse in `python-main` are rejected before access token expiry.',
      '- If a token is blacklisted or its session is revoked, the request is treated as an invalid token.',
    '',
    '## Scopes and Permissions',
    '',
    '- The scaffold uses `require_scope("user:read")` on `/api/profile`.',
    '- Add new authorization rules by wrapping endpoints with `require_scope(...)` or a similar dependency.',
    '',
    '## Database Migrations and Seed',
    '',
    '- Use `pdm run alembic-current` to inspect the active revision.',
    '- Use `pdm run migrate` to apply Alembic migrations.',
    '- Use `alembic downgrade -1` or `alembic downgrade <revision_id>` only for development, test, or pre-release rollback drills.',
    '- Use `pdm run seed` to populate the default app settings and sample profile data.',
    '- The seed is idempotent and can be run repeatedly without duplicating rows.',
    '- Product does not auto-run seed; execute it manually only after reviewing the target environment.',
    '- Prefer immutable image rollback and forward-compatible repair migrations over relying on product database downgrade.',
    '',
    '## Logging and Request ID',
    '',
    '- Every request gets an `X-Request-ID` for troubleshooting across services.',
    '- Keep token values and secrets out of logs.',
    '',
    '## Docker and nginx',
    '',
    '- `docker-compose.yml` is the local development path and uses Uvicorn with `--reload`.',
    '- The Dockerfile runs Gunicorn with Uvicorn workers for the production container.',
    '- nginx proxies the API and forwards `X-Request-ID`.',
    '',
    '## FAQ',
    '',
    '- **Why does `/api/profile` return 401?** Check signature, issuer, audience, expiry, and blacklist state.',
    '- **Why does `/api/profile` return 403?** The token is valid but missing the required scope.',
    '- **Why is the token valid in `python-main` but rejected here?** The public key, issuer, or audience likely differs.'
  ].join(newline);
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

${createPythonTemplateUsageDocs(options)}

## GitHub Actions, Secrets, and Environments

The generated \`.github/workflows/ci.yml\` keeps CI/CD environment-aware:

- \`test\` runs PDM install, lint, pytest, Alembic state checks, and a Docker build.
- \`deploy-test\` uses the GitHub Environment named \`test\` and a \`test-<git-sha>\` image tag.
- \`deploy-product\` uses the GitHub Environment named \`product\` and only runs from release tags or a manual master deployment.
- Deployment steps are placeholders by default; replace them with your platform command without printing \`.env\` files or secret values.

Configure GitHub Environments before enabling real deploy commands:

| Environment | Recommended protection |
| --- | --- |
| \`test\` | limited deploy credentials and test-only data stores |
| \`product\` | required reviewers, master/release-tag restrictions, and least-privilege deploy credentials |

Recommended secrets:

| Scope | Secrets |
| --- | --- |
| test | ${options.templateName === "python-main" ? "\`TEST_JWT_PRIVATE_KEY\`, " : ""}\`TEST_DATABASE_URL\`, \`TEST_REDIS_URL\`, \`TEST_JWT_PUBLIC_KEY\`, \`TEST_CORS_ALLOW_ORIGINS\`, \`TEST_DOCKER_REGISTRY_TOKEN\` |
| product | ${options.templateName === "python-main" ? "\`PRODUCT_JWT_PRIVATE_KEY\`, " : ""}\`PRODUCT_DATABASE_URL\`, \`PRODUCT_REDIS_URL\`, \`PRODUCT_JWT_PUBLIC_KEY\`, \`PRODUCT_CORS_ALLOW_ORIGINS\`, \`PRODUCT_DOCKER_REGISTRY_TOKEN\` |

Use immutable image tags rather than relying on \`latest\`:

- \`${options.serviceName}:test-<git-sha>\`
- \`${options.serviceName}:product-<version>\`
- \`${options.serviceName}:product-<git-sha>\`

For production rollback, redeploy a previously verified image tag first. Prefer forward-compatible migrations and repair migrations over relying on database downgrades.

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
