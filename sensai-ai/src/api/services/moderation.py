import json
import sqlite3
from typing import Dict, Any
from pathlib import Path
from openai import AsyncOpenAI, OpenAI
from pydantic import BaseModel
from ..models import ModerationResult
from ..settings import settings
from ..config import sqlite_db_path

class ModerationOutput(BaseModel):
    is_flagged: bool
    severity: str  # "low", "medium", "high"
    reason: str
    action: str  # "approve", "flag", "remove"
    confidence: float

def validate_openai_api_key_for_moderation(openai_api_key: str) -> bool:
    """Validate OpenAI API key for moderation, similar to llm.py pattern"""
    if not openai_api_key or len(openai_api_key) < 10:
        return None
        
    client = OpenAI(api_key=openai_api_key)
    try:
        models = client.models.list()
        model_ids = [model.id for model in models.data]
        return True  # API key is valid
    except Exception:
        return None

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

async def moderate_content(content: str, post_id: int, user_id: int, content_type: str = "post") -> ModerationResult:
    """
    Moderate content using OpenAI's moderation API.
    """
    try:
        # Check if OpenAI API key is available and valid
        if not settings.openai_api_key:
            print(f"OpenAI API key not configured, skipping moderation for {content_type} {post_id}")
            result = ModerationResult(
                is_flagged=False,
                severity="low",
                reason="Moderation skipped - API key not configured",
                action="approve",
                confidence=1.0
            )
            await log_moderation_result(content_type, post_id, user_id, content, result)
            return result
        
        # Validate API key
        api_key_validation = validate_openai_api_key_for_moderation(settings.openai_api_key)
        if api_key_validation is None:
            print(f"Invalid OpenAI API key, skipping moderation for {content_type} {post_id}")
            result = ModerationResult(
                is_flagged=False,
                severity="low",
                reason="Moderation skipped - Invalid API key",
                action="approve",
                confidence=1.0
            )
            await log_moderation_result(content_type, post_id, user_id, content, result)
            return result
        
        # Create client using the validated API key
        client = AsyncOpenAI(api_key=settings.openai_api_key)
        
        # Use OpenAI's moderation endpoint
        response = await client.moderations.create(input=content)
        
        moderation = response.results[0]
        
        if moderation.flagged:
            # Determine severity and action based on categories
            high_severity_categories = ['hate', 'violence', 'sexual/minors']
            medium_severity_categories = ['harassment', 'self-harm']
            
            flagged_categories = [cat for cat, flagged in moderation.categories.model_dump().items() if flagged]
            
            if any(cat in high_severity_categories for cat in flagged_categories):
                severity = "high"
                action = "remove"
            elif any(cat in medium_severity_categories for cat in flagged_categories):
                severity = "medium"
                action = "flag"
            else:
                severity = "low"
                action = "flag"
            
            result = ModerationResult(
                is_flagged=True,
                severity=severity,
                reason=f"Flagged for: {', '.join(flagged_categories)}",
                action=action,
                confidence=max(moderation.category_scores.model_dump().values())
            )
        else:
            result = ModerationResult(
                is_flagged=False,
                severity="low", 
                reason="Content approved",
                action="approve",
                confidence=1.0 - max(moderation.category_scores.model_dump().values())
            )
        
        # Log the moderation result
        await log_moderation_result(content_type, post_id, user_id, content, result)
        return result
            
    except Exception as e:
        print(f"Error in content moderation: {e}")
        # Default to approved if moderation fails
        result = ModerationResult(
            is_flagged=False,
            severity="low",
            reason=f"Moderation error: {str(e)}",
            action="approve", 
            confidence=0.5
        )
        await log_moderation_result(content_type, post_id, user_id, content, result)
        return result