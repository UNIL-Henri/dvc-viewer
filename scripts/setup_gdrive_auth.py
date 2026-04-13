import os
import json
from google_auth_oauthlib.flow import InstalledAppFlow

SCOPES = ['https://www.googleapis.com/auth/drive.file']

def main():
    print("Welcome to DVC-Viewer Google Drive Auth Setup!")
    print("Please ensure you have downloaded your OAuth 2.0 Desktop Client Credentials JSON.")
    creds_file = input("Enter path to credentials.json: ").strip()

    if not os.path.exists(creds_file):
        print("File not found.")
        return

    flow = InstalledAppFlow.from_client_secrets_file(creds_file, SCOPES)
    creds = flow.run_local_server(port=0)

    token_data = {
        "token": creds.token,
        "refresh_token": creds.refresh_token,
        "token_uri": creds.token_uri,
        "client_id": creds.client_id,
        "client_secret": creds.client_secret,
        "scopes": creds.scopes
    }

    print("\n✅ Authentication successful!")
    print("\nSet these environment variables in your deployment:\n")

    with open(creds_file, "r") as f:
        print(f"export DVC_GDRIVE_CREDENTIALS='{json.dumps(json.load(f))}'")

    print(f"export DVC_GDRIVE_TOKEN='{json.dumps(token_data)}'")

if __name__ == "__main__":
    main()
