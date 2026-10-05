#!/usr/bin/env python3
"""
ToolCrib License Key Generator CLI Tool
Usage:
    python generate_license.py --mac "00:1A:2B:3C:4D:5E" --company "ACME Tooling Inc." --days 365
"""

import argparse
import sys
import os

# Add backend directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from license_utils import generate_license_key, verify_license_key, get_system_mac_address

def main():
    parser = argparse.ArgumentParser(description="ToolCrib Software License Key Generator")
    parser.add_argument("--mac", type=str, help="Target Server MAC Address (e.g. 00:1A:2B:3C:4D:5E). If omitted, uses current machine MAC.")
    parser.add_argument("--company", type=str, required=True, help="Customer / Company Name")
    parser.add_argument("--days", type=int, default=365, help="License validity duration in days (Default: 365). Set to 0 for perpetual.")
    parser.add_argument("--out", type=str, help="Optional output file path to save license key (.lic)")

    args = parser.parse_args()

    target_mac = args.mac or get_system_mac_address()
    days = None if args.days <= 0 else args.days

    print("\n==========================================")
    print("      ToolCrib License Key Generator      ")
    print("==========================================")
    print(f"Company: {args.company}")
    print(f"MAC Address: {target_mac}")
    print(f"Validity: {days if days else 'Perpetual (No Expiration)'} days")
    print("------------------------------------------")

    key = generate_license_key(
        mac_address=target_mac,
        company_name=args.company,
        expiration_days=days
    )

    is_valid, payload, msg, details = verify_license_key(key, target_macs=[target_mac])

    if not is_valid:
        print(f"Error validating generated key: {msg}")
        sys.exit(1)

    print(f"Ed25519 Signature Verified: {details.get('signature_valid')}")
    print(f"SHA-256 Hash Checksum: {details.get('sha256_hash')}")
    print(f"MAC Address Pattern: {details.get('mac_address')} (Valid Pattern: {details.get('mac_pattern_valid')})")

    print("\nGENERATED LICENSE KEY:")
    print("------------------------------------------")
    print(key)
    print("------------------------------------------\n")

    if args.out:
        with open(args.out, "w") as f:
            f.write(key)
        print(f"License key saved successfully to: {args.out}")

if __name__ == "__main__":
    main()
