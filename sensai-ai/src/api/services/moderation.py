import json
import sqlite3
import asyncio
from typing import Any, Dict

from google import genai
from google.genai import types

from ..models import ModerationResult
from ..config import sqlite_db_path

async def log_moderation_result(content_type: str, content_id: int, user_id: int, content: str, result: ModerationResult):
    """Log moderation result to database"""
    try:
        with sqlite3.connect(sqlite_db_path) as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO moderation_logs 
                (content_type, content_id, user_id, content, is_flagged, severity, reason, action, confidence)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                content_type, content_id, user_id, content,
                result.is_flagged, result.severity, result.reason, result.action, result.confidence
            ))
            conn.commit()
    except Exception as e:
        print(f"Error logging moderation result: {e}")

def _build_prompt(content: str) -> str:
    # Model is instructed to output strict JSON only.
    return f"""
You are a content moderator. Analyze the INPUT and return ONLY a JSON object with these exact keys:
- is_flagged: boolean (true if violates policy)
- severity: one of "low", "medium", "high"
- reason: short string explaining key categories involved
- action: one of "approve", "flag", "remove"
- confidence: float from 0.0 to 1.0 (your confidence in the decision)

Policies to detect include (non-exhaustive): sexual (non-CSAM), CSAM (must be flagged as prohibited), hate, harassment, dangerous (illegal activities, self-harm), toxic, violent, profanity, illicit (drugs, firearms, tobacco, gambling).
Consider satire, quoting, or counterspeech. If clearly non-violative, set is_flagged=false, action="approve".

Determine action:
- "remove": severe or clearly prohibited content (e.g., CSAM, explicit threats, incitement to violence, sexual/minors).
- "flag": borderline, context-dependent, or medium severity (needs human review).
- "approve": benign content.

Return JSON ONLY. Do not include any explanation outside the JSON.

INPUT:
{content}
""".strip()

def _parse_json_safely(text: str) -> Dict[str, Any]:
    # Try direct parse; if fails, attempt to extract JSON object.
    try:
        return json.loads(text)
    except Exception:
        # Heuristic: find first '{' and last '}'.
        start = text.find("{")
        end = text.rfind("}")
        if start != -1 and end != -1 and end > start:
            try:
                return json.loads(text[start:end+1])
            except Exception:
                pass
    return {}

async def moderate_content(content: str, post_id: int, user_id: int, content_type: str = "post") -> ModerationResult:
    """
    Moderate content using Google Gemini. API key is embedded per request.
    """
    # Replace with your actual Gemini API key
    GEMINI_API_KEY = "AIzaSyD5p2TV0337a5NxaWXDhM9J1uYLbjBPt-M"

    try:
        client = genai.Client(api_key=GEMINI_API_KEY)

        prompt = _build_prompt(content)

        # Disable blocking so the model always returns a classification.
        safety_settings = [
            types.SafetySetting(category=types.HarmCategory.HARM_CATEGORY_HATE_SPEECH,        threshold=types.HarmBlockThreshold.BLOCK_NONE),
            types.SafetySetting(category=types.HarmCategory.HARM_CATEGORY_HARASSMENT,         threshold=types.HarmBlockThreshold.BLOCK_NONE),
            types.SafetySetting(category=types.HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,  threshold=types.HarmBlockThreshold.BLOCK_NONE),
            types.SafetySetting(category=types.HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,  threshold=types.HarmBlockThreshold.BLOCK_NONE),
            types.SafetySetting(category=types.HarmCategory.HARM_CATEGORY_CIVIC_INTEGRITY,    threshold=types.HarmBlockThreshold.BLOCK_NONE),
        ]

        config = types.GenerateContentConfig(
            temperature=0,
            safety_settings=safety_settings,
        )

        # Run in a worker thread to avoid blocking the event loop.
        response = await asyncio.to_thread(
            client.models.generate_content,
            model="gemini-2.0-flash-lite",
            contents=prompt,
            config=config,
        )

        text = getattr(response, "text", None) or ""
        data = _parse_json_safely(text)

        # Map to ModerationResult with safe defaults.
        is_flagged = bool(data.get("is_flagged", data.get("violation", False)))
        severity = str(data.get("severity", "low")).lower()
        if severity not in {"low", "medium", "high"}:
            severity = "low"

        reason = data.get("reason") or ("Content approved" if not is_flagged else "Flagged content")

        action = str(data.get("action", "approve")).lower()
        if action not in {"approve", "flag", "remove"}:
            action = "approve" if not is_flagged else "flag"

        try:
            confidence = float(data.get("confidence", 0.9 if not is_flagged else 0.8))
        except Exception:
            confidence = 0.9 if not is_flagged else 0.8

        result = ModerationResult(
            is_flagged=is_flagged,
            severity=severity,
            reason=reason,
            action=action,
            confidence=confidence,
        )

        await log_moderation_result(content_type, post_id, user_id, content, result)
        return result

    except Exception as e:
        print(f"Error in content moderation (Gemini): {e}")
        # Default to approved if moderation fails
        result = ModerationResult(
            is_flagged=False,
            severity="low",
            reason=f"Moderation error: {str(e)}",
            action="approve",
            confidence=0.5,
        )
        await log_moderation_result(content_type, post_id, user_id, content, result)
        return result