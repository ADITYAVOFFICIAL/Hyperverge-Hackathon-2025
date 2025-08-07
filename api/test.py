from openai import OpenAI

# A partial list of the keys from your search results for testing purposes
keys_to_test = [
    "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"
]

def check_key_validity(api_key):
    """
    Checks if an OpenAI API key is valid by attempting to list models.
    """
    try:
        # Initialize the client with the API key
        client = OpenAI(api_key=api_key)
        
        # Make a simple, low-cost API call to test authentication
        client.models.list()
        
        return True
    except Exception as e:
        # If any exception occurs, the key is likely invalid or expired
        return False

# Iterate through the keys and print their status
print("Starting API key validation...")
for i, key in enumerate(keys_to_test):
    # To avoid printing the full key, show only a portion of it
    key_preview = f"{key[:5]}...{key[-4:]}"
    is_valid = check_key_validity(key)
    if is_valid:
        print(f"  - Key #{i + 1} ({key_preview}): VALID")
    else:
        print(f"  - Key #{i + 1} ({key_preview}): INVALID")

print("\nValidation complete.")

