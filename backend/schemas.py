from pydantic import BaseModel, constr, validator
from typing import Optional, Literal
from datetime import datetime

class CompanyBase(BaseModel):
    company_name: str
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None

class CompanyCreate(CompanyBase):
    pass

class CompanyResponse(CompanyBase):
    id: int
    is_active: Optional[str] = "yes"
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True
        orm_mode = True

class UserBase(BaseModel):
    employee_id: str
    employee_name: str
    role: str
    department: str
    contact: str
    company_id: Optional[int] = None
    company_name: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None

class UserCreate(UserBase):
    password: str

class UserResponse(UserBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True
        orm_mode = True

class UserLogin(BaseModel):
    employee_id: str
    password: str

class ToolsListBase(BaseModel):
    Item_Description: Optional[str] = None
    Range_in_mm: Optional[str] = None
    Identification_Code: Optional[str] = None
    Make: Optional[str] = None
    Quantity: Optional[int] = None
    Location: Optional[str] = None
    Gauge: Optional[str] = None
    Remarks: Optional[str] = None
    status: Optional[str] = "not_available"

    @validator('status')
    def validate_status(cls, v):
        allowed = ["available", "not_available"]
        if v not in allowed:
            raise ValueError(f'Status must be one of {allowed}')
        return v

    class Config:
        from_attributes = True
        orm_mode = True

class ToolsListCreate(ToolsListBase):
    pass

class ToolsListUpdate(ToolsListBase):
    pass

class ToolsList(ToolsListBase):
    Sl_no: int

    class Config:
        from_attributes = True
        orm_mode = True

class ToolRequestBase(BaseModel):
    tool_sl_no: int
    operator_id: str
    operator_name: str
    department: Optional[str] = None
    contact: Optional[str] = None
    purpose: str
    project_details: str

class ToolRequestCreate(ToolRequestBase):
    pass

class ToolRequestResponse(ToolRequestBase):
    id: int
    unique_request_id: str
    request_date: datetime
    status: str
    supervisor_id: Optional[str] = None
    supervisor_name: Optional[str] = None
    response_date: Optional[datetime] = None
    collected: str = "no"
    returned: str = "no"

    @validator('returned')
    def validate_returned(cls, v):
        allowed = ["yes", "no", "issue"]
        if v not in allowed:
            raise ValueError(f'Returned status must be one of {allowed}')
        return v

    class Config:
        orm_mode = True

class ToolRequestApprove(BaseModel):
    supervisor_id: str
    supervisor_name: str
    status: str

    class Config:
        from_attributes = True
        orm_mode = True

class ToolsReturnedBase(BaseModel):
    tool_sl_no: int
    operator_id: str
    operator_name: str
    department: Optional[str] = None
    contact: Optional[str] = None
    purpose: str
    project_details: str
    condition_on_return: Optional[str] = None
    remarks: Optional[str] = None
    status: str = "pending"

class ToolsReturnedCreate(BaseModel):
    tool_sl_no: int
    operator_id: str
    operator_name: str
    department: Optional[str] = None
    contact: Optional[str] = None
    purpose: str
    project_details: str
    condition_on_return: Optional[str] = None
    remarks: Optional[str] = None
    status: str = "pending"
    unique_request_id: str

class ToolsReturnedResponse(ToolsReturnedBase):
    id: int
    unique_request_id: str
    request_date: datetime
    supervisor_id: Optional[str] = None
    supervisor_name: Optional[str] = None
    collected_date: Optional[datetime] = None

    class Config:
        from_attributes = True
        orm_mode = True

class ToolIssueBase(BaseModel):
    tool_sl_no: int
    operator_id: str
    operator_name: str
    department: Optional[str] = None
    contact: Optional[str] = None
    severity: str
    category: str
    description: str
    purpose: Optional[str] = None
    project_details: Optional[str] = None
    unique_request_id: str  # Make it required again
    officer_status: str = "pending"
    supervisor_status: str = "pending"

    @validator('severity')
    def validate_severity(cls, v):
        allowed = ["low", "medium", "high"]
        if v not in allowed:
            raise ValueError(f'Severity must be one of {allowed}')
        return v

    @validator('officer_status')
    def validate_officer_status(cls, v):
        allowed = ["pending", "approved", "rejected"]
        if v not in allowed:
            raise ValueError(f'Officer status must be one of {allowed}')
        return v

    @validator('supervisor_status')
    def validate_supervisor_status(cls, v):
        allowed = ["pending", "approved", "rejected"]
        if v not in allowed:
            raise ValueError(f'Supervisor status must be one of {allowed}')
        return v

    @validator('unique_request_id')
    def validate_unique_request_id(cls, v):
        if not v:
            raise ValueError('unique_request_id is required')
        return v

class ToolIssueCreate(ToolIssueBase):
    pass

class ToolIssueResponse(ToolIssueBase):
    id: int
    unique_request_id: str
    report_date: datetime
    officer_id: Optional[str] = None
    officer_name: Optional[str] = None
    officer_approval_date: Optional[datetime] = None
    supervisor_id: Optional[str] = None
    supervisor_name: Optional[str] = None
    supervisor_approval_date: Optional[datetime] = None

    class Config:
        from_attributes = True
        orm_mode = True

class ToolIssueApprove(BaseModel):
    action: str  # "approve" or "reject"
    officer_id: Optional[str] = None
    officer_name: Optional[str] = None
    supervisor_id: Optional[str] = None
    supervisor_name: Optional[str] = None

    @validator('action')
    def validate_action(cls, v):
        allowed = ["approve", "reject"]
        if v not in allowed:
            raise ValueError(f'Action must be one of {allowed}')
        return v

    class Config:
        from_attributes = True
        orm_mode = True

class NewToolRequestCreate(BaseModel):
    Item_Description: str
    Range_in_mm: Optional[str] = None
    Identification_Code: Optional[str] = None
    Make: Optional[str] = None
    Quantity: int
    Location: Optional[str] = None
    Gauge: Optional[str] = None
    Remarks: Optional[str] = None
    supervisor_id: str
    supervisor_name: str
    project_details: Optional[str] = None
    project_number: Optional[str] = None

class NewToolRequestResponse(BaseModel):
    id: int
    Item_Description: str
    Range_in_mm: Optional[str] = None
    Identification_Code: Optional[str] = None
    Make: Optional[str] = None
    Quantity: int
    Location: Optional[str] = None
    Gauge: Optional[str] = None
    Remarks: Optional[str] = None
    supervisor_id: str
    supervisor_name: str
    project_details: Optional[str] = None
    project_number: Optional[str] = None
    request_date: datetime
    status: str
    officer_id: Optional[str] = None
    officer_name: Optional[str] = None
    response_date: Optional[datetime] = None

    class Config:
        orm_mode = True

class NewToolRequestApproval(BaseModel):
    officer_id: str
    officer_name: str
    status: str  # approved or rejected

    @validator('status')
    def validate_status(cls, v):
        allowed = ["approved", "rejected"]
        if v not in allowed:
            raise ValueError(f'Status must be one of {allowed}')
        return v

    class Config:
        from_attributes = True
        orm_mode = True