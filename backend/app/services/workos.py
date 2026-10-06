import os
import workos

_client: workos.WorkOSClient | None = None


def get_client() -> workos.WorkOSClient:
    global _client
    if _client is None:
        _client = workos.WorkOSClient(
            api_key=os.environ["WORKOS_API_KEY"],
            client_id=os.environ["WORKOS_CLIENT_ID"],
        )
    return _client
