import os
from openai import OpenAI

client = OpenAI(
    base_url="https://ai.megallm.io/v1",
    api_key="sk-mega-2ec83eff7294c005a8173d1e37912c49.8472b66891288cbb05ce683d32c74ca2186103c4c1c8eb3aaea0047e934a21aa"
)

response = client.chat.completions.create(
    model="openai-gpt-oss-120b",
    messages=[
        {"role": "user", "content": "Hello, world!"}
    ]
)

print(response)
