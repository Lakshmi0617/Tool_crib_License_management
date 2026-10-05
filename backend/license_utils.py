import uuid
import hashlib
import json
import base64
import os
import sys
import re
from datetime import datetime, timedelta
from typing import Dict, Any, Tuple, Optional, List

from cryptography.hazmat.primitives.asymmetric import ed25519
from cryptography.hazmat.primitives import serialization

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PRIVATE_KEY_PATH = os.path.join(BASE_DIR, "ed25519_private.b64")
PUBLIC_KEY_PATH = os.path.join(BASE_DIR, "ed25519_public.b64")

# Add project root and License directory to path for RSA Client Validator import
PROJECT_ROOT = os.path.dirname(BASE_DIR)
LICENSE_DIR = os.path.join(PROJECT_ROOT, "License")

for d in [PROJECT_ROOT, LICENSE_DIR]:
    if os.path.exists(d) and d not in sys.path:
        sys.path.append(d)

try:
    from License.client_license import verify_license_data as verify_rsa_license_data
except Exception:
    verify_rsa_license_data = None

def get_secret_key() -> str:
    """Read JWT secret key from secret_key.txt for user auth session tokens"""
    secret_path = os.path.join(BASE_DIR, "secret_key.txt")
    if os.path.exists(secret_path):
        for enc in ["utf-8", "utf-16", "utf-16-le", "latin1"]:
            try:
                with open(secret_path, "r", encoding=enc) as f:
                    content = f.read().strip()
                    if content:
                        cleaned = content.replace("\x00", "").strip()
                        if cleaned:
                            return cleaned
            except Exception:
                continue
    return "ToolCrib_Default_License_Secret_Key_2026"

def _encode_b64url(data: bytes) -> str:
    """URL-safe Base64 encode without padding '='"""
    return base64.urlsafe_b64encode(data).decode('utf-8').rstrip("=")

def _decode_b64url(data_str: str) -> bytes:
    """URL-safe Base64 decode with padding restored"""
    padded = data_str.strip() + "=" * ((4 - len(data_str.strip()) % 4) % 4)
    return base64.urlsafe_b64decode(padded.encode('utf-8'))

def get_or_create_keypair() -> Tuple[ed25519.Ed25519PrivateKey, ed25519.Ed25519PublicKey]:
    """
    Load or create the Ed25519 private and public key pair for vendor signing.
    """
    env_priv = os.getenv("TOOLCRIB_LICENSE_PRIVATE_KEY")
    if env_priv:
        priv_bytes = _decode_b64url(env_priv)
        priv_key = ed25519.Ed25519PrivateKey.from_private_bytes(priv_bytes)
        return priv_key, priv_key.public_key()

    if os.path.exists(PRIVATE_KEY_PATH):
        try:
            with open(PRIVATE_KEY_PATH, "r", encoding="utf-8") as f:
                priv_bytes = _decode_b64url(f.read().strip())
            priv_key = ed25519.Ed25519PrivateKey.from_private_bytes(priv_bytes)
            pub_key = priv_key.public_key()
            
            # Ensure PUBLIC_KEY_PATH is saved on disk and matches private key
            pub_raw = pub_key.public_bytes(
                encoding=serialization.Encoding.Raw,
                format=serialization.PublicFormat.Raw
            )
            with open(PUBLIC_KEY_PATH, "w", encoding="utf-8") as f:
                f.write(_encode_b64url(pub_raw))

            return priv_key, pub_key
        except Exception:
            pass

    # Generate new keypair if not existing
    priv_key = ed25519.Ed25519PrivateKey.generate()
    pub_key = priv_key.public_key()

    priv_raw = priv_key.private_bytes(
        encoding=serialization.Encoding.Raw,
        format=serialization.PrivateFormat.Raw,
        encryption_algorithm=serialization.NoEncryption()
    )
    pub_raw = pub_key.public_bytes(
        encoding=serialization.Encoding.Raw,
        format=serialization.PublicFormat.Raw
    )

    with open(PRIVATE_KEY_PATH, "w", encoding="utf-8") as f:
        f.write(_encode_b64url(priv_raw))

    with open(PUBLIC_KEY_PATH, "w", encoding="utf-8") as f:
        f.write(_encode_b64url(pub_raw))

    return priv_key, pub_key

def get_public_key() -> ed25519.Ed25519PublicKey:
    """Load public key for verifying license signatures"""
    env_pub = os.getenv("TOOLCRIB_LICENSE_PUBLIC_KEY")
    if env_pub:
        try:
            pub_bytes = _decode_b64url(env_pub)
            return ed25519.Ed25519PublicKey.from_public_bytes(pub_bytes)
        except Exception:
            pass

    if os.path.exists(PUBLIC_KEY_PATH):
        try:
            with open(PUBLIC_KEY_PATH, "r", encoding="utf-8") as f:
                pub_bytes = _decode_b64url(f.read().strip())
            return ed25519.Ed25519PublicKey.from_public_bytes(pub_bytes)
        except Exception:
            pass

    if os.path.exists(PRIVATE_KEY_PATH):
        try:
            with open(PRIVATE_KEY_PATH, "r", encoding="utf-8") as f:
                priv_bytes = _decode_b64url(f.read().strip())
            priv_key = ed25519.Ed25519PrivateKey.from_private_bytes(priv_bytes)
            return priv_key.public_key()
        except Exception:
            pass

    _, pub_key = get_or_create_keypair()
    return pub_key

def normalize_mac(mac: str) -> str:
    """Standardize MAC address format to UPPERCASE XX:XX:XX:XX:XX:XX pattern"""
    if not mac:
        return ""
    cleaned = re.sub(r'[^A-Fa-f0-9]', '', mac).upper()
    if len(cleaned) == 12:
        return ":".join([cleaned[i:i+2] for i in range(0, 12, 2)])
    return mac.upper()

def is_valid_mac_pattern(mac: str) -> bool:
    """Check if MAC address matches standard XX:XX:XX:XX:XX:XX pattern"""
    norm = normalize_mac(mac)
    return bool(re.match(r'^([0-9A-F]{2}:){5}[0-9A-F]{2}$', norm))

def get_system_mac_address() -> str:
    """Get primary MAC address of the current host machine"""
    mac_num = uuid.getnode()
    mac_hex = f"{mac_num:012X}"
    return normalize_mac(mac_hex)

def get_all_system_mac_addresses() -> List[str]:
    """Get all unique non-zero MAC addresses on the system"""
    macs = set()
    primary = get_system_mac_address()
    if primary and primary != "00:00:00:00:00:00":
        macs.add(primary)
        
    try:
        import psutil
        for interface, addrs in psutil.net_if_addrs().items():
            for addr in addrs:
                if hasattr(psutil, 'AF_LINK') and addr.family == psutil.AF_LINK:
                    norm = normalize_mac(addr.address)
                    if norm and norm != "00:00:00:00:00:00" and is_valid_mac_pattern(norm):
                        macs.add(norm)
    except Exception:
        pass
        
    return list(macs) if macs else [primary]

def compute_sha256_hash(data_bytes: bytes) -> str:
    """Compute SHA-256 hash string for payload data"""
    return hashlib.sha256(data_bytes).hexdigest()

def safe_parse_datetime(dt_str: Optional[str]) -> Optional[datetime]:
    """Safely parse ISO datetime string supporting Python 3.8 ISO strings with 'Z' suffix"""
    if not dt_str:
        return None
    try:
        clean_str = str(dt_str).strip()
        if clean_str.endswith("Z"):
            clean_str = clean_str[:-1]
        if "T" in clean_str:
            parts = clean_str.split("T")
            date_part = parts[0]
            time_part = parts[1].split("+")[0].split("-")[0]
            return datetime.fromisoformat(f"{date_part}T{time_part}")
        return datetime.strptime(clean_str, "%Y-%m-%d")
    except Exception:
        try:
            return datetime.fromisoformat(str(dt_str).strip().replace("Z", "+00:00"))
        except Exception:
            return None


def generate_license_key(
    mac_address: str,
    company_name: str,
    expiration_days: Optional[int] = 365,
    private_key: Optional[ed25519.Ed25519PrivateKey] = None
) -> str:
    """
    Generate a cryptographically signed license key string using Ed25519 and SHA-256.
    Matches PDF specification format.
    """
    if not private_key:
        private_key, _ = get_or_create_keypair()

    norm_mac = normalize_mac(mac_address)
    issued_at = datetime.utcnow()
    expires_at = (issued_at + timedelta(days=expiration_days)) if expiration_days else None

    # Step 1: Base claims
    base_claims = {
        "customer": company_name.strip(),
        "mac_address": norm_mac,
        "issued_at": issued_at.isoformat(),
        "expires_at": expires_at.isoformat() if expires_at else None,
        "license_version": "2.0"
    }

    # Step 2: Compute SHA-256 checksum of base claims
    claims_bytes = json.dumps(base_claims, sort_keys=True, separators=(",", ":")).encode("utf-8")
    sha256_checksum = compute_sha256_hash(claims_bytes)

    # Step 3: Full payload including SHA-256 hash
    payload = {
        **base_claims,
        "sha256_checksum": sha256_checksum
    }

    # Step 4: Canonicalize payload bytes for Ed25519 signature
    payload_bytes = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")

    # Step 5: Sign payload bytes with Ed25519
    signature_bytes = private_key.sign(payload_bytes)

    # Step 6: Package into document object with base64url encoded fields
    document = {
        "payload": _encode_b64url(payload_bytes),
        "signature": _encode_b64url(signature_bytes)
    }

    # Step 7: Serialize final document to base64url string
    doc_json_bytes = json.dumps(document, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return _encode_b64url(doc_json_bytes)

def verify_license_key(
    license_key_str: str,
    target_macs: Optional[List[str]] = None,
    public_key: Optional[ed25519.Ed25519PublicKey] = None
) -> Tuple[bool, Optional[Dict[str, Any]], str, Dict[str, Any]]:
    """
    Verify license key using Ed25519 signature verification, SHA-256 hash check, MAC pattern matching & expiration.
    Returns: (is_valid, payload_dict, message, verification_details)
    """
    if not public_key:
        public_key = get_public_key()

    if not target_macs:
        target_macs = get_all_system_mac_addresses()

    norm_target_macs = [normalize_mac(m) for m in target_macs if m]

    details = {
        "signature_valid": False,
        "sha256_valid": False,
        "mac_pattern_valid": False,
        "mac_match_valid": False,
        "expiration_valid": False,
        "customer": None,
        "mac_address": None,
        "issued_at": None,
        "expires_at": None,
        "sha256_hash": None,
        "signature_ed25519": None
    }

    try:
        clean_key = license_key_str.strip()

        # Handle RSA JSON License Format (License/ directory & License_management)
        if clean_key.startswith("{") and ("LicenseId" in clean_key or "Fingerprint" in clean_key):
            if not verify_rsa_license_data:
                return False, None, "RSA License Verifier module not available", details

            try:
                is_valid, msg, rsa_details = verify_rsa_license_data(clean_key)

                details["signature_valid"] = rsa_details.get("signature_valid", False)
                details["mac_pattern_valid"] = True
                details["mac_match_valid"] = rsa_details.get("fingerprint_match", False)
                details["expiration_valid"] = rsa_details.get("expiration_valid", False)
                details["customer"] = rsa_details.get("product") or "ToolCrib Customer"
                details["mac_address"] = rsa_details.get("fingerprint")
                details["expires_at"] = rsa_details.get("expiry")
                details["sha256_valid"] = True
                details["sha256_hash"] = rsa_details.get("fingerprint")
                details["signature_ed25519"] = rsa_details.get("license_id")

                payload = {
                    "customer": details["customer"],
                    "mac_address": details["mac_address"],
                    "expires_at": details["expires_at"],
                    "license_id": rsa_details.get("license_id")
                }
                return is_valid, payload, msg, details
            except Exception as rsa_err:
                return False, None, f"RSA License Verification failed: {str(rsa_err)}", details

        # Decode outer document (Ed25519 Format)
        doc_bytes = _decode_b64url(clean_key)
        document = json.loads(doc_bytes.decode('utf-8'))

        payload_b64 = document.get("payload")
        signature_b64 = document.get("signature")

        if not payload_b64 or not signature_b64:
            return False, None, "Invalid license key format: Missing payload or signature field", details

        details["signature_ed25519"] = signature_b64

        # Decode payload and signature
        payload_bytes = _decode_b64url(payload_b64)
        signature_bytes = _decode_b64url(signature_b64)

        # 1. Cryptographic Ed25519 signature check
        try:
            public_key.verify(signature_bytes, payload_bytes)
            details["signature_valid"] = True
        except Exception:
            return False, None, "Ed25519 cryptographic signature verification failed (tampered key or invalid signature)", details

        # 2. Parse claims JSON
        payload = json.loads(payload_bytes.decode('utf-8'))
        details["customer"] = payload.get("customer") or payload.get("company_name")
        details["mac_address"] = payload.get("mac_address")
        details["issued_at"] = payload.get("issued_at")
        details["expires_at"] = payload.get("expires_at")
        details["sha256_hash"] = payload.get("sha256_checksum")

        # 3. SHA-256 payload integrity check
        sha256_checksum = payload.get("sha256_checksum")
        if sha256_checksum:
            # Recompute hash over all payload keys except sha256_checksum (supports extra claims)
            all_claims_except_hash = {k: v for k, v in payload.items() if k != "sha256_checksum"}
            recomputed_bytes = json.dumps(all_claims_except_hash, sort_keys=True, separators=(",", ":")).encode("utf-8")
            expected_hash = compute_sha256_hash(recomputed_bytes)

            # Fallback check on standard base claims if extra claims were not included
            if sha256_checksum != expected_hash:
                base_claims = {
                    "customer": payload.get("customer"),
                    "mac_address": payload.get("mac_address"),
                    "issued_at": payload.get("issued_at"),
                    "expires_at": payload.get("expires_at"),
                    "license_version": payload.get("license_version", "2.0")
                }
                base_bytes = json.dumps(base_claims, sort_keys=True, separators=(",", ":")).encode("utf-8")
                expected_hash = compute_sha256_hash(base_bytes)

            if sha256_checksum == expected_hash:
                details["sha256_valid"] = True
            else:
                return False, payload, "SHA-256 payload hash verification failed (claims tampered)", details
        else:
            # Hash directly over payload bytes if no explicit checksum field
            details["sha256_hash"] = compute_sha256_hash(payload_bytes)
            details["sha256_valid"] = True

        # 4. Check MAC pattern
        license_mac = normalize_mac(payload.get("mac_address", ""))
        if is_valid_mac_pattern(license_mac):
            details["mac_pattern_valid"] = True
        else:
            return False, payload, f"Invalid MAC address pattern in license: '{license_mac}'", details

        # 5. Check MAC match against system NICs
        if license_mac in norm_target_macs:
            details["mac_match_valid"] = True
        else:
            return False, payload, f"License bound to MAC ({license_mac}), which does not match server MACs ({', '.join(norm_target_macs)})", details

        # 6. Check Expiration
        expires_at_str = payload.get("expires_at")
        if expires_at_str:
            expires_at = safe_parse_datetime(expires_at_str)
            if expires_at and datetime.utcnow() > expires_at:
                return False, payload, f"License expired on {expires_at.strftime('%Y-%m-%d %H:%M:%S UTC')}", details

        details["expiration_valid"] = True
        return True, payload, "License is valid", details

    except Exception as e:
        return False, None, f"Failed to parse or verify license key: {str(e)}", details

