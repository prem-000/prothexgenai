from pydantic import BaseModel, Field, validator
from typing import List, Optional
from datetime import datetime

class AnalysisRequest(BaseModel):
    # Backward compatibility: record_id can still be accepted but is optional
    record_id: Optional[str] = None
    
    # ML Features per PRD
    step_length: float = Field(default=0.0)
    cadence: float = Field(default=0.0)
    speed: float = Field(default=0.0)
    symmetry: float = Field(default=0.0)
    temperature: float = Field(default=0.0)
    moisture: float = Field(default=0.0)
    pressure: float = Field(default=0.0)
    wear_hours: float = Field(default=0.0)

class AnalysisResponse(BaseModel):
    risk_level: str
    gait_score: float
    pressure_risk: float
    skin_risk: float
    # Optional metadata if needed by frontend/debug
    execution_time_ms: Optional[float] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class AnalysisMetadata(BaseModel):
    user_id: str
    execution_time_ms: float
    timestamp: datetime
    record_id: str
