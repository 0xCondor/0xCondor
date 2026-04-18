from app.core.security import hash_password, verify_password, create_access_token, decode_token


def test_password_roundtrip():
    h = hash_password("super-secret-pass-123")
    assert verify_password("super-secret-pass-123", h)
    assert not verify_password("wrong", h)


def test_jwt_roundtrip():
    tok = create_access_token("user-123", {"org": "org-1"})
    payload = decode_token(tok)
    assert payload["sub"] == "user-123"
    assert payload["org"] == "org-1"
    assert payload["type"] == "access"
