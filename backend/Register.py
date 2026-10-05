from typing import List
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from passlib.context import CryptContext
from models import User, ActiveSession, Company
from schemas import UserCreate, UserResponse, UserLogin, CompanyCreate, CompanyResponse
from db import get_db
# pyrefly: ignore [missing-import]
import jwt
from datetime import datetime, timedelta
from sqlalchemy import func
import secrets

router = APIRouter()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

from license_utils import get_secret_key

SECRET_KEY = get_secret_key()

# Store temporary reset tokens (in a real application, use Redis or a database)
password_reset_tokens = {}

def create_access_token(data: dict, expires_delta: timedelta = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(hours=2) # 2 Hours token expiration for session security
    to_encode.update({"exp": expire, "iat": datetime.utcnow()})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm="HS256")
    return encoded_jwt


@router.get("/companies", response_model=List[CompanyResponse], tags=["Companies"])
def get_all_companies(db: Session = Depends(get_db)):
    try:
        companies = db.query(Company).filter(Company.is_active == "yes").order_by(Company.id).all()
        return companies
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to fetch companies")

@router.post("/companies", response_model=CompanyResponse, tags=["Companies"])
def create_company(company: CompanyCreate, db: Session = Depends(get_db)):
    existing = db.query(Company).filter(func.lower(Company.company_name) == func.lower(company.company_name.strip())).first()
    if existing:
        if company.address and company.address.strip():
            existing.address = company.address.strip()
        if company.phone and company.phone.strip():
            existing.phone = company.phone.strip()
        if company.email and company.email.strip():
            existing.email = company.email.strip()
        db.commit()
        db.refresh(existing)
        return existing

    safe_name = "".join(c for c in company.company_name if c.isalnum()).lower() or "company"
    company_email = company.email.strip() if company.email and company.email.strip() else f"info@{safe_name}_{secrets.token_hex(4)}.com"

    new_company = Company(
        company_name=company.company_name.strip(),
        address=company.address.strip() if company.address else "",
        phone=company.phone or "",
        email=company_email
    )
    try:
        db.add(new_company)
        db.commit()
        db.refresh(new_company)
        return new_company
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to create company: {str(e)}")

@router.post("/register", response_model=UserResponse)
def register_user(user: UserCreate, db: Session = Depends(get_db)):
    # Check if user already exists
    if db.query(User).filter(User.employee_id == user.employee_id).first():
        raise HTTPException(status_code=400, detail="Employee ID already registered")

    # Validate role
    valid_roles = ['operator', 'supervisor', 'officer']
    if user.role.lower() not in valid_roles:
        raise HTTPException(status_code=400, detail="Invalid role. Must be operator, supervisor, or officer")

    # Validate company_id if provided and update company phone, email & address
    if user.company_id is not None:
        company = db.query(Company).filter(Company.id == user.company_id).first()
        if not company:
            raise HTTPException(status_code=400, detail="Specified Company ID does not exist")

        # Sync/update company's details from registration data
        if user.contact and user.contact.strip():
            company.phone = user.contact.strip()
        if user.email and user.email.strip():
            company.email = user.email.strip()
        if user.address and user.address.strip():
            company.address = user.address.strip()

    # Create new user
    hashed_password = pwd_context.hash(user.password)
    db_user = User(
        employee_name=user.employee_name,
        employee_id=user.employee_id,
        password=hashed_password,
        role=user.role.lower(),
        department=user.department,
        contact=user.contact,
        company_id=user.company_id
    )

    try:
        db.add(db_user)
        db.commit()
        db.refresh(db_user)
        return db_user
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to register user: {str(e)}")

@router.post("/login")
def login_user(user_credentials: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.employee_id == user_credentials.employee_id).first()
    if not user:
        raise HTTPException(
            status_code=401,
            detail="Invalid credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    if not pwd_context.verify(user_credentials.password, user.password):
        raise HTTPException(
            status_code=401,
            detail="Invalid credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Check if user is a supervisor or officer
    if user.role in ['supervisor', 'officer']:
        # Check if another user with the same role is already logged in
        active_session = db.query(ActiveSession).filter(ActiveSession.role == user.role).first()
        if active_session:
            raise HTTPException(
                status_code=403,
                detail=f"Another {user.role} ({active_session.employee_name}) is already logged in"
            )
        
        # Create new active session
        new_session = ActiveSession(
            employee_id=user.employee_id,
            employee_name=user.employee_name,
            role=user.role,
            company_id=user.company_id
        )
        db.add(new_session)
        try:
            db.commit()
        except Exception as e:
            db.rollback()
            raise HTTPException(status_code=500, detail=f"Failed to create session: {str(e)}")
    
    # Create access token with comprehensive payload
    access_token = create_access_token(
        data={
            "sub": user.employee_id,
            "role": user.role,
            "employee_name": user.employee_name,
            "company_id": user.company_id
        }
    )
    
    # Get company name if company_id exists
    company_name = None
    if user.company_id:
        company = db.query(Company).filter(Company.id == user.company_id).first()
        if company:
            company_name = company.company_name

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "employee_id": user.employee_id,
            "employee_name": user.employee_name,
            "role": user.role,
            "department": user.department,
            "contact": user.contact,
            "company_id": user.company_id,
            "company_name": company_name
        }
    }

@router.post("/logout")
def logout_user(employee_id: str, db: Session = Depends(get_db)):
    # Remove active session if exists
    session = db.query(ActiveSession).filter(ActiveSession.employee_id == employee_id).first()
    if session:
        db.delete(session)
        try:
            db.commit()
        except Exception as e:
            db.rollback()
            raise HTTPException(status_code=500, detail="Failed to logout")
    
    return {"message": "Logged out successfully"}

@router.get("/active-sessions")
def get_active_sessions(db: Session = Depends(get_db)):
    sessions = db.query(ActiveSession).all()
    return {
        "supervisor": next((s for s in sessions if s.role == "supervisor"), None),
        "officer": next((s for s in sessions if s.role == "officer"), None)
    }

@router.post("/forgot-password")
def forgot_password(employee_id: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.employee_id == employee_id).first()
    if not user:
        # For security, don't reveal if the user exists or not
        return {"message": "If the employee ID exists, a reset token will be sent"}
    
    # Generate reset token
    reset_token = secrets.token_urlsafe(32)
    password_reset_tokens[reset_token] = {
        "employee_id": employee_id,
        "expires": datetime.utcnow() + timedelta(minutes=30)
    }
    
    # Return the reset token directly
    return {
        "message": "Reset token generated successfully",
        "reset_token": reset_token,
        "expires_in": "30 minutes"
    }

@router.post("/reset-password")
def reset_password(token: str, new_password: str, db: Session = Depends(get_db)):
    # Verify token
    token_data = password_reset_tokens.get(token)
    if not token_data:
        raise HTTPException(status_code=400, detail="Invalid or expired token")
    
    if datetime.utcnow() > token_data["expires"]:
        password_reset_tokens.pop(token, None)
        raise HTTPException(status_code=400, detail="Token has expired")
    
    # Update password
    user = db.query(User).filter(User.employee_id == token_data["employee_id"]).first()
    if not user:
        raise HTTPException(status_code=400, detail="User not found")
    
    user.password = pwd_context.hash(new_password)
    
    try:
        db.commit()
        # Remove used token
        password_reset_tokens.pop(token, None)
        return {"message": "Password updated successfully"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to update password")

@router.get("/users", response_model=List[UserResponse])
def get_all_users(db: Session = Depends(get_db)):
    try:
        users = db.query(User).order_by(User.id).all()
        # Attach company_name from Company table
        company_map = {c.id: c.company_name for c in db.query(Company).all()}
        for u in users:
            if u.company_id and u.company_id in company_map:
                u.company_name = company_map[u.company_id]
        return users
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to fetch users")

@router.delete("/users/{employee_id}")
def delete_user(employee_id: str, db: Session = Depends(get_db)):
    try:
        user = db.query(User).filter(User.employee_id == employee_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Don't allow deleting the last officer
        if user.role == "officer":
            officer_count = db.query(User).filter(User.role == "officer").count()
            if officer_count <= 1:
                raise HTTPException(status_code=400, detail="Cannot delete the last officer account")
        
        db.delete(user)
        db.commit()
        return {"message": "User deleted successfully"}
    except HTTPException as he:
        raise he
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to delete user")
