"""P4-NH04: operator-issued, expiring demo capability tokens (not a login system).

Opt in with GAMEWEEK_DEMO_AUTH_ENABLED and a random server-only secret >=32 chars.
Mint offline: python -m app.core.gameweek_auth --user-id 1 --hours 24
Only the per-user token goes to the demo participant. Never send the signing
secret to frontend, issue tokens from a public endpoint, or log token values.
"""

import argparse
import base64
import binascii
import hashlib
import hmac
import json
import time

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import settings


bearer = HTTPBearer(auto_error=False)


def _key() -> bytes:
    if not settings.GAMEWEEK_DEMO_AUTH_ENABLED or settings.GAMEWEEK_DEMO_TOKEN_SECRET is None:
        raise HTTPException(503, detail="Gameweek demo writes are disabled")
    return settings.GAMEWEEK_DEMO_TOKEN_SECRET.get_secret_value().encode()


def _signature(payload: str, key: bytes) -> str:
    digest = hmac.new(key, ("p4nh04.v1." + payload).encode(), hashlib.sha256).digest()
    return base64.urlsafe_b64encode(digest).decode().rstrip("=")


def issue_demo_token(user_id: int, *, hours: int = 24) -> str:
    key = _key()
    if type(user_id) is not int or not 1 <= user_id <= 2147483647:
        raise ValueError("user_id must be a positive PostgreSQL integer")
    if type(hours) is not int or not 1 <= hours <= 168:
        raise ValueError("hours must be an integer from 1 to 168")
    data = {"aud": "p4-transfers", "v": 1, "sub": user_id, "exp": int(time.time()) + hours * 3600}
    payload = base64.urlsafe_b64encode(json.dumps(data, separators=(",", ":"), sort_keys=True).encode()).decode().rstrip("=")
    return payload + "." + _signature(payload, key)


def get_demo_user_id(credentials: HTTPAuthorizationCredentials | None = Depends(bearer)) -> int:
    key = _key()
    unauthorized = HTTPException(401, detail="Invalid or expired demo token", headers={"WWW-Authenticate": "Bearer"})
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise unauthorized
    token = credentials.credentials
    try:
        if len(token) > 512:
            raise ValueError("Token too long")
        payload, signature = token.split(".")
        if not hmac.compare_digest(signature, _signature(payload, key)):
            raise ValueError("Invalid signature")
        data = json.loads(base64.b64decode(payload + "=" * (-len(payload) % 4), altchars=b"-_", validate=True))
        if (
            not isinstance(data, dict) or set(data) != {"aud", "v", "sub", "exp"}
            or data["aud"] != "p4-transfers" or type(data["v"]) is not int or data["v"] != 1
            or type(data["sub"]) is not int or not 1 <= data["sub"] <= 2147483647
            or type(data["exp"]) is not int or data["exp"] <= time.time()
        ):
            raise ValueError("Invalid claims")
    except (ValueError, TypeError, KeyError, binascii.Error, UnicodeError):
        raise unauthorized from None
    return data["sub"]


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="P4-NH04: issue a private demo token offline")
    parser.add_argument("--user-id", type=int, required=True)
    parser.add_argument("--hours", type=int, default=24)
    args = parser.parse_args()
    try:
        print(issue_demo_token(args.user_id, hours=args.hours))
    except (ValueError, HTTPException) as exc:
        parser.error(exc.detail if isinstance(exc, HTTPException) else str(exc))
