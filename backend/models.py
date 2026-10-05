from sqlalchemy import Column, Integer, String, DateTime, func, ForeignKey, Enum, CheckConstraint
from db import Base
import enum

class Company(Base):
    __tablename__ = "companies"
    __table_args__ = {'schema': 'toolcrib'}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    company_name = Column(String, nullable=False)
    address = Column(String)
    phone = Column(String)
    email = Column(String)
    project_name = Column(String)
    created_at = Column(DateTime, default=func.now())
    is_active = Column(String, default="yes")

class User(Base):
    __tablename__ = "users"
    __table_args__ = {'schema': 'toolcrib'}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    employee_name = Column(String, nullable=False, index=True)
    employee_id = Column(String, unique=True, nullable=False, index=True)
    password = Column(String, nullable=False)
    role = Column(String, nullable=False)  # 'operator', 'supervisor', 'officer'
    department = Column(String)
    contact = Column(String)
    company_id = Column(Integer, ForeignKey('toolcrib.companies.id'), nullable=True)
    created_at = Column(DateTime, default=func.now())

class ToolsList(Base):
    __tablename__ = "tools_list"
    __table_args__ = {'schema': 'toolcrib'}

    Sl_no = Column(Integer, primary_key=True, index=True, autoincrement=True)
    Item_Description = Column(String)
    Range_in_mm = Column(String)
    Identification_Code = Column(String)
    Make = Column(String)
    Quantity = Column(Integer)
    Location = Column(String)
    Gauge = Column(String)
    Remarks = Column(String)
    status = Column(String, default="not_available")  # available or not_available

class ToolRequest(Base):
    __tablename__ = "tool_requests"
    __table_args__ = (
        CheckConstraint("returned IN ('yes', 'no', 'issue')", name='check_returned_status'),
        {'schema': 'toolcrib'}
    )

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    unique_request_id = Column(String, nullable=False, unique=True, index=True)
    tool_sl_no = Column(Integer, ForeignKey('toolcrib.tools_list.Sl_no'), nullable=False)
    operator_id = Column(String, nullable=False)
    operator_name = Column(String, nullable=False)
    department = Column(String)
    contact = Column(String)
    purpose = Column(String)
    project_details = Column(String)
    request_date = Column(DateTime, default=func.now())
    status = Column(String, default="pending")  # pending, approved, rejected
    supervisor_id = Column(String)
    supervisor_name = Column(String)
    response_date = Column(DateTime)
    collected = Column(String, default="no")  # yes/no
    returned = Column(String, default="no")  # yes/no/issue

class ToolsReturned(Base):
    __tablename__ = "tools_returned"
    __table_args__ = {'schema': 'toolcrib'}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    unique_request_id = Column(String, ForeignKey('toolcrib.tool_requests.unique_request_id'), nullable=False, index=True)
    tool_sl_no = Column(Integer, ForeignKey('toolcrib.tools_list.Sl_no'), nullable=False)
    operator_id = Column(String, nullable=False)
    operator_name = Column(String, nullable=False)
    department = Column(String)
    contact = Column(String)
    purpose = Column(String, nullable=False)
    project_details = Column(String, nullable=False)
    request_date = Column(DateTime, default=func.now())
    condition_on_return = Column(String)
    remarks = Column(String)
    supervisor_id = Column(String)
    supervisor_name = Column(String)
    status = Column(String, default="pending")  # pending, collected
    collected_date = Column(DateTime)
    request_id = Column(Integer, ForeignKey('toolcrib.tool_requests.id'), nullable=True)

class ToolIssue(Base):
    __tablename__ = "tool_issues"
    __table_args__ = {'schema': 'toolcrib'}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    unique_request_id = Column(String, ForeignKey('toolcrib.tool_requests.unique_request_id'), nullable=False, index=True)
    tool_sl_no = Column(Integer, ForeignKey('toolcrib.tools_list.Sl_no'), nullable=False)
    operator_id = Column(String, nullable=False)
    operator_name = Column(String, nullable=False)
    department = Column(String, nullable=True)
    contact = Column(String, nullable=True)
    report_date = Column(DateTime, default=func.now())
    severity = Column(String, nullable=False)  # low, medium, high
    category = Column(String, nullable=False)  #breakage calibration, other
    description = Column(String, nullable=False)
    purpose = Column(String, nullable=True)
    project_details = Column(String, nullable=True)
    officer_status = Column(String, default="pending", nullable=False)  # pending, approved, rejected
    officer_id = Column(String)
    officer_name = Column(String)
    officer_approval_date = Column(DateTime)
    supervisor_status = Column(String, default="pending", nullable=False)  # pending, approved, rejected
    supervisor_id = Column(String)
    supervisor_name = Column(String)
    supervisor_approval_date = Column(DateTime)

class NewToolRequest(Base):
    __tablename__ = "new_tool_requests"
    __table_args__ = {'schema': 'toolcrib'}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    Item_Description = Column(String, nullable=False)
    Range_in_mm = Column(String)
    Identification_Code = Column(String)
    Make = Column(String)
    Quantity = Column(Integer, nullable=False)
    Location = Column(String)
    Gauge = Column(String)
    Remarks = Column(String)
    supervisor_id = Column(String, nullable=False)
    supervisor_name = Column(String, nullable=False)
    project_details = Column(String)
    project_number = Column(String)
    request_date = Column(DateTime, default=func.now())
    status = Column(String, default="pending")  # pending, approved, rejected
    officer_id = Column(String)
    officer_name = Column(String)
    response_date = Column(DateTime)

class ActiveSession(Base):
    __tablename__ = "active_sessions"
    __table_args__ = {'schema': 'toolcrib'}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    employee_id = Column(String, ForeignKey('toolcrib.users.employee_id'), nullable=False, unique=True)
    employee_name = Column(String, nullable=False)
    role = Column(String, nullable=False)  # 'supervisor' or 'officer'
    company_id = Column(Integer, nullable=True)
    login_time = Column(DateTime, default=func.now())

class LicenseInfo(Base):
    __tablename__ = "license_info"
    __table_args__ = {'schema': 'toolcrib'}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    license_key = Column(String, nullable=False)
    mac_address = Column(String, nullable=False)
    company_id = Column(Integer, ForeignKey('toolcrib.companies.id'), nullable=True)
    company_name = Column(String, nullable=True)
    issued_at = Column(DateTime, nullable=False)
    expires_at = Column(DateTime, nullable=True)  # Null means perpetual
    sha256_hash = Column(String, nullable=True)
    signature_ed25519 = Column(String, nullable=True)
    is_active = Column(String, default="yes")
    activated_at = Column(DateTime, default=func.now())