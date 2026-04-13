from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from app.core.dependencies import get_current_user, check_role
from app.database import get_db
from app.config import settings
from bson import ObjectId
from datetime import datetime, timezone
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/chat", tags=["chat"])

# ─── Schemas ───────────────────────────────────────────────
class ChatMessageRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=500)

class ChatMessageResponse(BaseModel):
    sender: str
    message: str
    timestamp: str

# ─── Clinical System Prompt (Strict Scope) ─────────────────
CLINICAL_SYSTEM_PROMPT = """You are ProthexaI Clinical Assistant.

You ONLY answer questions related to:
- Prosthetic biomechanics
- Gait symmetry and stride metrics
- Skin risk and temperature monitoring
- Pressure distribution
- Rehabilitation tracking
- Device performance insights

If a question is unrelated to these topics, respond:
"I can only assist with prosthetic and clinical monitoring topics."

Keep responses concise, medically accurate, and professional.
Do not provide general knowledge or unrelated advice."""

# ─── Gemini Chat Engine ────────────────────────────────────
_genai_client = None

def _get_genai_client():
    global _genai_client
    try:
        if _genai_client is None:
            from google import genai
            _genai_client = genai.Client(api_key=settings.GEMINI_API_KEY)
        return _genai_client
    except Exception as e:
        logger.error(f"Failed to initialize GenAI Client: {e}")
        return None

def _get_fallback_response(user_message: str) -> str:
    """Simple rule-based fallback when AI is unavailable."""
    msg = user_message.lower()
    
    if any(word in msg for word in ["pain", "hurt", "sore", "rubbing", "blister", "red"]):
        return "I'm having trouble connecting to the AI analysis, but based on your keywords: Please check your residual limb for any redness or pressure marks immediately. If pain persists, contact your prosthetist."
    
    if any(word in msg for word in ["gait", "walk", "step", "speed", "balance"]):
        return "I'm currently offline, but you can view your detailed gait metrics (symmetry, step length, cadence) directly on the 'Gait Analysis' tab of your dashboard."
        
    if any(word in msg for word in ["battery", "charge", "power"]):
        return "Please ensure your device is charged. For specific hardware issues, refer to your device manual or contact support."
    
    return "I am currently unable to access the advanced clinical AI. Please check your internet connection or try again later. In the meantime, you can review your daily metrics on the dashboard."

async def _generate_chat_response(user_message: str, history: list) -> str:
    """Generate a response from Gemini given the user message and conversation history."""
    try:
        client = _get_genai_client()
        
        if not client:
            logger.warning("GenAI client not initialized, using fallback.")
            return _get_fallback_response(user_message)
        
        # Build conversation context from history (last 10 messages for performance)
        recent_history = history[-10:] if len(history) > 10 else history
        
        # Format history for GenAI SDK
        contents = []
        for msg in recent_history:
            role = "user" if msg["sender"] == "user" else "model"
            contents.append({"role": role, "parts": [{"text": msg["message"]}]})
        
        # Add current message
        contents.append({"role": "user", "parts": [{"text": user_message}]})
        
        from google.genai import types
        response = client.models.generate_content(
            model="gemini-1.5-flash", # Switched to 1.5-flash to resolve 2.0-flash quota issues
            contents=contents,
            config=types.GenerateContentConfig(
                system_instruction=CLINICAL_SYSTEM_PROMPT,
                max_output_tokens=500,
                temperature=0.7
            )
        )
        
        if not response or not response.text:
            return "I'm currently unable to process your request. Please try again."
        
        return response.text
    except Exception as e:
        logger.error(f"Gemini Chat Error: {str(e)}")
        # Return fallback instead of generic error
        return _get_fallback_response(user_message)

# ─── Helper: Resolve patient_id ────────────────────────────
async def _resolve_patient_id(current_user: dict):
    db = get_db()
    user_id = current_user["_id"]
    profile = await db["patient_profiles"].find_one({
        "$or": [
            {"user_id": user_id},
            {"user_id": str(user_id)}
        ]
    })
    if not profile:
        raise HTTPException(status_code=404, detail="Patient profile not found.")
    return profile["_id"]

# ─── GET /chat/history ─────────────────────────────────────
@router.get("/history")
async def get_chat_history(current_user: dict = Depends(check_role("patient"))):
    db = get_db()
    patient_id = await _resolve_patient_id(current_user)
    
    session = await db["patient_chat_sessions"].find_one(
        {"patient_id": patient_id},
        sort=[("updated_at", -1)]
    )
    
    if not session:
        return {"messages": []}
    
    messages = session.get("messages", [])
    
    # Serialize timestamps
    for msg in messages:
        if isinstance(msg.get("timestamp"), datetime):
            msg["timestamp"] = msg["timestamp"].isoformat()
    
    return {"messages": messages}

# ─── POST /chat/message ───────────────────────────────────
@router.post("/message", response_model=ChatMessageResponse)
async def send_chat_message(
    payload: ChatMessageRequest,
    current_user: dict = Depends(check_role("patient"))
):
    db = get_db()
    patient_id = await _resolve_patient_id(current_user)
    user_id = str(current_user["_id"])
    now = datetime.now(timezone.utc)
    
    # Find or create session
    session = await db["patient_chat_sessions"].find_one(
        {"patient_id": patient_id, "session_status": "active"}
    )
    
    if not session:
        # Create new session
        session = {
            "patient_id": patient_id,
            "user_id": user_id,
            "session_status": "active",
            "messages": [],
            "created_at": now,
            "updated_at": now
        }
        result = await db["patient_chat_sessions"].insert_one(session)
        session["_id"] = result.inserted_id
    
    existing_messages = session.get("messages", [])
    
    # 1. Append user message
    user_msg = {
        "sender": "user",
        "message": payload.message,
        "timestamp": now
    }
    
    # 2. Generate AI response using Gemini
    ai_response_text = await _generate_chat_response(payload.message, existing_messages)
    
    assistant_msg = {
        "sender": "assistant",
        "message": ai_response_text,
        "timestamp": datetime.now(timezone.utc)
    }
    
    # 3. Update session in MongoDB
    await db["patient_chat_sessions"].update_one(
        {"_id": session["_id"]},
        {
            "$push": {
                "messages": {
                    "$each": [user_msg, assistant_msg]
                }
            },
            "$set": {"updated_at": datetime.now(timezone.utc)}
        }
    )
    
    return {
        "sender": "assistant",
        "message": ai_response_text,
        "timestamp": assistant_msg["timestamp"].isoformat()
    }
