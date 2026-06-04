import os

from openai import OpenAI


def load_local_env(path: str = ".env.local") -> None:
    if not os.path.exists(path):
        return

    with open(path, "r", encoding="utf-8") as env_file:
        for line in env_file:
            raw = line.strip()
            if not raw or raw.startswith("#") or "=" not in raw:
                continue

            key, value = raw.split("=", 1)
            os.environ[key.strip()] = value.strip()


def read_env(*names: str) -> str:
    for name in names:
        value = os.getenv(name, "").strip()
        if value:
            return value

    raise RuntimeError(f"Missing env: {' / '.join(names)}")


def main() -> None:
    # Load env from multiple possible locations
    for env_path in [".env.local", ".env", "Samples/TypeScript/Demo/.env"]:
        load_local_env(env_path)

    client = OpenAI(
        base_url=read_env("CHATBOT_FALLBACK_BASE_URL", "CHATBOT_LLM_FALLBACK_BASE_URL", "VITE_MEGALLM_BASE_URL"),
        api_key=read_env("CHATBOT_FALLBACK_API_KEY", "CHATBOT_LLM_FALLBACK_API_KEY", "VITE_MEGALLM_API_KEY"),
    )

    response = client.chat.completions.create(
        model=read_env("CHATBOT_FALLBACK_MODEL_1", "CHATBOT_LLM_FALLBACK_MODEL_1", "VITE_MEGALLM_MODEL"),
        max_tokens=40,
        messages=[
            {"role": "user", "content": "Halo, cek singkat apakah fallback chatbot aktif."},
        ],
    )

    print(response)


if __name__ == "__main__":
    main()

