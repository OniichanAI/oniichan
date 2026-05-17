from datetime import UTC, datetime, timedelta

from jose import JWTError, jwt

from app.core.config import settings


ALGORITHM = "HS256"


def create_signed_state(payload: dict, expires_minutes: int = 10) -> str:
    data = payload.copy()
    data["exp"] = datetime.now(UTC) + timedelta(minutes=expires_minutes)
    return jwt.encode(data, settings.session_signing_secret, algorithm=ALGORITHM)


def decode_signed_state(token: str) -> dict | None:
    try:
        return jwt.decode(token, settings.session_signing_secret, algorithms=[ALGORITHM])
    except JWTError:
        return None
