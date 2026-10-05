from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from datetime import datetime
from typing import Dict, Any

from db import get_db
from models import LicenseInfo
from license_utils import (
    get_system_mac_address,
    get_all_system_mac_addresses,
    verify_license_key,
    normalize_mac,
    safe_parse_datetime
)

router = APIRouter(prefix="/api/license", tags=["License"])

def mask_mac(mac: str) -> str:
    if not mac:
        return "****"
    parts = mac.split(":")
    if len(parts) == 6:
        return f"{parts[0]}:{parts[1]}:**:**:**:{parts[5]}"
    return f"{mac[:5]}******{mac[-2:]}"

@router.get("/system-info")
def get_system_info():
    """Return masked host system info for display without exposing network hardware details"""
    raw_mac = get_system_mac_address()
    return {
        "primary_mac": mask_mac(raw_mac)
    }

@router.get("/status")
def get_license_status(db: Session = Depends(get_db)):
    """Check active license status in database and verify MAC address + expiration"""
    macs = get_all_system_mac_addresses()
    
    # Query latest active license
    active_license = db.query(LicenseInfo).filter(LicenseInfo.is_active == "yes").order_by(LicenseInfo.id.desc()).first()
    
    if not active_license:
        return {
            "is_valid": False,
            "status": "unlicensed",
            "message": "No active software license key installed",
            "days_remaining": 0,
            "license_info": None
        }
        
    is_valid, payload, message, details = verify_license_key(active_license.license_key, target_macs=macs)
    
    days_remaining = None
    if payload and payload.get("expires_at"):
        exp_dt = safe_parse_datetime(payload["expires_at"])
        if exp_dt:
            delta = exp_dt - datetime.utcnow()
            days_remaining = max(0, delta.days)
        
    return {
        "is_valid": is_valid,
        "status": "active" if is_valid else "invalid",
        "message": "License active & verified" if is_valid else message,
        "days_remaining": days_remaining,
        "license_info": {
            "company_name": active_license.company_name,
            "expires_at": active_license.expires_at.isoformat() if active_license.expires_at else None
        } if active_license else None
    }

@router.post("/validate")
def validate_license(license_key: str = Body(..., embed=True)):
    """
    Validate license key string without exposing raw hashes, MAC lists, or signatures in network tab.
    """
    macs = get_all_system_mac_addresses()
    is_valid, payload, message, details = verify_license_key(license_key.strip(), target_macs=macs)
    
    customer = (payload.get("customer") or payload.get("company_name")) if payload else None
    expires_at = payload.get("expires_at") if payload else None

    return {
        "is_valid": is_valid,
        "message": message,
        "customer": customer,
        "expires_at": expires_at,
        "signature_valid": details.get("signature_valid", False),
        "host_match_valid": details.get("mac_match_valid", False),
        "sha256_valid": details.get("sha256_valid", False)
    }

from models import LicenseInfo, Company

@router.post("/activate")
def activate_license(
    payload_body: Dict[str, Any] = Body(...),
    db: Session = Depends(get_db)
):
    """Activate a new license key after verification and save company details to database"""
    license_key = payload_body.get("license_key", "").strip()
    if not license_key:
        raise HTTPException(status_code=400, detail="License key string is required")

    macs = get_all_system_mac_addresses()
    is_valid, payload, message, details = verify_license_key(license_key, target_macs=macs)
    
    if not is_valid or not payload:
        raise HTTPException(status_code=400, detail=f"License Activation Failed: {message}")
        
    customer_from_payload = payload.get("customer") or payload.get("company_name") or "Valued Customer"
    company_name_input = payload_body.get("company_name")
    company_name_final = company_name_input.strip() if company_name_input and company_name_input.strip() else customer_from_payload

    address = payload_body.get("address", "").strip() if payload_body.get("address") else "N/A"
    phone = payload_body.get("phone", "").strip() if payload_body.get("phone") else "N/A"
    email = payload_body.get("email", "").strip() if payload_body.get("email") else "N/A"
    project_name = payload_body.get("project_name", "").strip() if payload_body.get("project_name") else "ToolCrib System"

    # Create or update Company in toolcrib.companies table
    company = db.query(Company).filter(Company.company_name == company_name_final).first()
    if not company:
        company = Company(
            company_name=company_name_final,
            address=address,
            phone=phone,
            email=email,
            project_name=project_name,
            is_active="yes"
        )
        db.add(company)
        db.flush()
    else:
        if address and address != "N/A": company.address = address
        if phone: company.phone = phone
        if email: company.email = email
        if project_name and project_name != "ToolCrib System": company.project_name = project_name
        db.flush()

    # Deactivate existing active licenses
    db.query(LicenseInfo).filter(LicenseInfo.is_active == "yes").update({"is_active": "no"})
    
    issued_at = safe_parse_datetime(payload.get("issued_at")) or datetime.utcnow()
    expires_at = safe_parse_datetime(payload.get("expires_at"))
    
    new_license = LicenseInfo(
        license_key=license_key,
        mac_address=payload.get("mac_address", macs[0]),
        company_id=company.id,
        company_name=company.company_name,
        issued_at=issued_at,
        expires_at=expires_at,
        sha256_hash=details.get("sha256_hash"),
        signature_ed25519=details.get("signature_ed25519"),
        is_active="yes"
    )
    
    try:
        db.add(new_license)
        db.commit()
        db.refresh(new_license)
        return {
            "message": "License key activated successfully and company registered!",
            "status": "active",
            "company_id": company.id,
            "company_name": new_license.company_name,
            "project_name": company.project_name,
            "expires_at": new_license.expires_at.isoformat() if new_license.expires_at else "Perpetual"
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to save license key: {str(e)}")

