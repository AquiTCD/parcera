
import asyncio
import httpx

async def main():
    url = "http://127.0.0.1:10101/audio_query"
    params = {"speaker": 888753760, "text": "test"}
    print(f"Connecting to {url}...")
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(url, params=params)
            response.raise_for_status()
            print("Success!")
            print(response.json())
        except Exception as e:
            print(f"Failed: {e}")

if __name__ == "__main__":
    asyncio.run(main())
