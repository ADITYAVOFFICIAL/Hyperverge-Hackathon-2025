import os
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

# Try to get API key from environment, with fallback to direct value
api_key = os.getenv("OPENAI_API_KEY") or "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"

client = OpenAI(api_key=api_key)

try:
    # Test with a simple moderation call
    response = client.moderations.create(input="Hello, this is a test message")
    print("✅ OpenAI API key is working!")
    print(f"Flagged: {response.results[0].flagged}")
except Exception as e:
    print(f"❌ OpenAI API error: {e}")