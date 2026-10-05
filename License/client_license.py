#!/usr/bin/env python3
"""
ToolCrib Client License Validator & Hardware Fingerprinter (Python Replacement for C# Client.cs)
Usage:
    python client_license.py --request
    python client_license.py --verify license_TC-10001.json
"""

import os
import sys
import re
import json
import uuid
import hashlib
import platform
import subprocess
import argparse
import base64
from datetime import datetime
from typing import Dict, Any, Tuple, Optional, List

from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography.hazmat.primitives import serialization, hashes

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PUBLIC_KEY_PEM = os.path.join(BASE_DIR, "public_key.pem")

# Fallback Embedded Public Key if public_key.pem is missing
EMBEDDED_PUBLIC_KEY_PEM = """-----BEGIN PUBLIC KEY-----
MIIBojANBgkqhkiG9w0BAQEFAAOCAY8AMIIBigKCAYEAuvdPaReF7QFyERVs8TGd
i5G9tI/0tTzxOAAi5AVyL4cRCzTOFN2qLXXFqKPLmy6gF4FuqH4Ht07JrZtmgHms
3ckPlkNUV1IKOlZ5tMkqmPqL4ZgG4lUuy3JwuoZQ4tuOWC3vZipfis1cq2/5dYED
n16RMRwnlewDubYK61wlN0d5g2j2FrK0M6FHhjuOuk3/qyclOzLkYRLH3aARjHRL
4BqOoZR/gj698jUMhc+QsUXtqTo2TBQgB4lunad+qoOfg9OfOWvNX2KRTrZgDUkY
VfoHk5reYmqY7KKFBzV0ybuFSeHJn7Jfrh6PYMJTtMLzoBH1zmpgFJBpW7xViHB+
Ckre9k6TtoF72egc59WsPzxsnA4ajvspmvyeEFx+NXNMWj1qPB/YRFegZ/zcPC6P
Ti6vMhIoHsOKhmBCv4Kl8T8PQUDmsO7dt4Z/sr6k7mZPhaSaAoj8gJzC+he9iXYo
i06LsihNNJS9SRb3Kg0Q7Isx69++xtU3cdtqe2fCAWIBAgMBAAE=
-----END PUBLIC KEY-----"""


def _run_cmd(cmd: str) -> str:
    """Run command quietly and return trimmed output"""
    try:
        out = subprocess.check_output(cmd, shell=True, stderr=subprocess.DEVNULL)
        return out.decode('utf-8', errors='ignore').strip()
    except Exception:
        return ""


def get_mac_address() -> str:
    """Get primary MAC address"""
    try:
        import psutil
        for interface, addrs in psutil.net_if_addrs().items():
            for addr in addrs:
                if hasattr(psutil, 'AF_LINK') and addr.family == psutil.AF_LINK:
                    mac = addr.address.replace("-", "").replace(":", "").upper()
                    if mac and mac != "000000000000":
                        return mac
    except Exception:
        pass

    mac_num = uuid.getnode()
    return f"{mac_num:012X}"


def get_system_uuid() -> str:
    """Get System UUID from WMI / WMIC / PowerShell"""
    if platform.system() == "Windows":
        val = _run_cmd("powershell (Get-CimInstance -ClassName Win32_ComputerSystemProduct).UUID")
        if val:
            return val
        val = _run_cmd("wmic csproduct get uuid")
        lines = [l.strip() for l in val.splitlines() if l.strip() and "UUID" not in l]
        if lines:
            return lines[0]
    return "UNKNOWN_UUID"


def get_motherboard_serial() -> str:
    """Get Motherboard Serial Number"""
    if platform.system() == "Windows":
        val = _run_cmd("powershell (Get-CimInstance -ClassName Win32_BaseBoard).SerialNumber")
        if val:
            return val
        val = _run_cmd("wmic baseboard get serialnumber")
        lines = [l.strip() for l in val.splitlines() if l.strip() and "SerialNumber" not in l]
        if lines:
            return lines[0]
    return "UNKNOWN_MB"


def get_bios_serial() -> str:
    """Get BIOS Serial Number"""
    if platform.system() == "Windows":
        val = _run_cmd("powershell (Get-CimInstance -ClassName Win32_BIOS).SerialNumber")
        if val:
            return val
        val = _run_cmd("wmic bios get serialnumber")
        lines = [l.strip() for l in val.splitlines() if l.strip() and "SerialNumber" not in l]
        if lines:
            return lines[0]
    return "UNKNOWN_BIOS"


def get_disk_serials() -> str:
    """Get Physical Disk Serials"""
    if platform.system() == "Windows":
        val = _run_cmd("powershell (Get-CimInstance -ClassName Win32_DiskDrive).SerialNumber")
        if val:
            serials = sorted([s.strip() for s in val.splitlines() if s.strip()])
            return ",".join(serials)
    return "UNKNOWN_DISK"


def generate_fingerprint(mac: str, uuid_str: str, mb_serial: str, bios_serial: str, disk_serials: str) -> str:
    """Compute 64-char SHA-256 machine fingerprint matching C# Client.cs logic"""
    raw_str = (
        f"{mac.upper()}|"
        f"{uuid_str.upper()}|"
        f"{mb_serial.upper()}|"
        f"{bios_serial.upper()}|"
        f"{disk_serials.upper()}"
    )
    return hashlib.sha256(raw_str.encode('utf-8')).hexdigest().upper()


def get_machine_info() -> Dict[str, str]:
    """Gather complete hardware information and SHA-256 fingerprint"""
    mac = get_mac_address()
    sys_uuid = get_system_uuid()
    mb = get_motherboard_serial()
    bios = get_bios_serial()
    disk = get_disk_serials()
    fingerprint = generate_fingerprint(mac, sys_uuid, mb, bios, disk)

    return {
        "MacAddress": mac,
        "SystemUuid": sys_uuid,
        "MotherboardSerial": mb,
        "BiosSerial": bios,
        "DiskSerial": disk,
        "Fingerprint": fingerprint
    }


def generate_machine_request_file(out_path: str = None) -> str:
    """Save machine_request.txt containing hardware info and fingerprint"""
    info = get_machine_info()
    if not out_path:
        out_path = os.path.join(BASE_DIR, "machine_request.txt")

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(info, f, indent=2)

    print("\n==========================================")
    print("      HARDWARE MACHINE REQUEST GENERATED   ")
    print("==========================================")
    print(f"MAC Address:         {info['MacAddress']}")
    print(f"System UUID:         {info['SystemUuid']}")
    print(f"Motherboard Serial:  {info['MotherboardSerial']}")
    print(f"BIOS Serial:         {info['BiosSerial']}")
    print(f"Disk Serials:        {info['DiskSerial']}")
    print(f"SHA-256 Fingerprint: {info['Fingerprint']}")
    print("------------------------------------------")
    print(f"Saved Machine Request File: {out_path}\n")
    return out_path


def load_public_key() -> rsa.RSAPublicKey:
    """Load RSA public key from public_key.pem or embedded constant"""
    key_pem = None
    if os.path.exists(PUBLIC_KEY_PEM):
        with open(PUBLIC_KEY_PEM, "r", encoding="utf-8") as f:
            key_pem = f.read()

    if not key_pem or "BEGIN PUBLIC KEY" not in key_pem:
        key_pem = EMBEDDED_PUBLIC_KEY_PEM

    return serialization.load_pem_public_key(key_pem.encode('utf-8'))


def verify_license_data(license_json_or_dict: Any) -> Tuple[bool, str, Dict[str, Any]]:
    """
    Verify RSA license data against current host machine fingerprint and RSA public key.
    Returns: (is_valid, status_message, verification_details)
    """
    details = {
        "license_id": None,
        "product": None,
        "expiry": None,
        "fingerprint": None,
        "signature_valid": False,
        "fingerprint_match": False,
        "expiration_valid": False
    }

    try:
        if isinstance(license_json_or_dict, str):
            license_data = json.loads(license_json_or_dict.strip())
        else:
            license_data = license_json_or_dict

        license_id = license_data.get("LicenseId", "").strip()
        fingerprint = license_data.get("Fingerprint", "").strip().upper()
        product = license_data.get("Product", "").strip()
        expiry_str = license_data.get("Expiry", "").strip()
        signature_b64 = license_data.get("Signature", "").strip()

        details["license_id"] = license_id
        details["fingerprint"] = fingerprint
        details["product"] = product
        details["expiry"] = expiry_str

        if not license_id or not fingerprint or not signature_b64:
            return False, "Invalid license format: Missing LicenseId, Fingerprint, or Signature", details

        # 1. Verify RSA Signature over LicenseId|Fingerprint|Product|Expiry
        data_to_verify = f"{license_id}|{fingerprint}|{product}|{expiry_str}"
        data_bytes = data_to_verify.encode('utf-8')
        signature_bytes = base64.b64decode(signature_b64)

        pub_key = load_public_key()
        try:
            pub_key.verify(
                signature_bytes,
                data_bytes,
                padding.PKCS1v15(),
                hashes.SHA256()
            )
            details["signature_valid"] = True
        except Exception:
            return False, "RSA signature verification failed (license tampered or wrong public key)", details

        # 2. Check Host Hardware Fingerprint Match
        current_info = get_machine_info()
        current_fp = current_info["Fingerprint"]

        # Match either exact 64-char fingerprint OR MAC address match
        if fingerprint == current_fp or current_info["MacAddress"] in fingerprint:
            details["fingerprint_match"] = True
        else:
            # Secondary check: MAC match in network adapters
            current_mac = current_info["MacAddress"]
            if current_mac and len(current_mac) >= 8 and current_mac in fingerprint:
                details["fingerprint_match"] = True
            else:
                return False, f"Hardware Fingerprint mismatch (License: {fingerprint[:12]}..., Machine: {current_fp[:12]}...)", details

        # 3. Expiration Date Check
        if expiry_str:
            clean_expiry = expiry_str.rstrip("Z")
            if "T" in clean_expiry:
                expiry_dt = datetime.fromisoformat(clean_expiry)
            else:
                expiry_dt = datetime.strptime(clean_expiry, "%Y-%m-%d")

            if datetime.utcnow() > expiry_dt:
                return False, f"License expired on {expiry_dt.strftime('%Y-%m-%d')}", details

        details["expiration_valid"] = True
        return True, "License is valid and verified", details

    except Exception as e:
        return False, f"License verification error: {str(e)}", details


def main():
    parser = argparse.ArgumentParser(description="ToolCrib Python Client License Validator")
    parser.add_argument("--request", action="store_true", help="Generate machine_request.txt file")
    parser.add_argument("--verify", type=str, help="Path to license.json file to verify")

    args = parser.parse_args()

    if args.request:
        generate_machine_request_file()
    elif args.verify:
        if not os.path.exists(args.verify):
            print(f"Error: License file not found: {args.verify}")
            sys.exit(1)
        with open(args.verify, "r", encoding="utf-8") as f:
            lic_json = f.read()

        is_valid, msg, details = verify_license_data(lic_json)
        print("\n==========================================")
        print("      ToolCrib License Verification       ")
        print("==========================================")
        print(f"Status:       {'[VALID LICENSE]' if is_valid else '[INVALID LICENSE]'}")
        print(f"Message:      {msg}")
        print(f"License ID:   {details.get('license_id')}")
        print(f"Product:      {details.get('product')}")
        print(f"Expiry:       {details.get('expiry')}")
        print(f"RSA Signature: {'[Verified]' if details.get('signature_valid') else '[Invalid]'}")
        print(f"Fingerprint:  {'[Host Match]' if details.get('fingerprint_match') else '[Host Mismatch]'}")
        print("------------------------------------------\n")
    else:
        info = get_machine_info()
        print("\nMachine Information:")
        print(json.dumps(info, indent=2))
        print("\nUse --request to output machine_request.txt, or --verify license.json to check a license.")


if __name__ == "__main__":
    main()
