import json
import math
from typing import List, Dict, Any
import requests
from collections import defaultdict
import os 
from datetime import datetime

from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.outputs import ChatResult, ChatGeneration


# =========================
# 0. CONFIG
# =========================

API_ENDPOINT = "https://ctwa92wg1b.execute-api.us-east-1.amazonaws.com/prod/invoke"
TEAM_ID = "team_the_great_hack_2025_051"
API_TOKEN = "5NDNdyHT3R1unAT7u6kKCTHBbIajpmX-LhiJKSFYb-M" # <-- fill this in

ASSETS = ["NVDA", "TSLA", "GOLD"]
HEADLINES_PATH = "top_headlines_gnews.json"


# =========================
# 1. CUSTOM LLM (HACKATHON GATEWAY) FOR LANGCHAIN
# =========================

def extract_json_object(text: str) -> dict:
    """
    Try to pull out the first top-level JSON object from the model output.
    """
    text = text.strip()
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise ValueError(f"Could not find JSON in LLM output:\n{text}")
    json_str = text[start:end+1]
    return json.loads(json_str)

def save_json(path: str, obj) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, indent=2, ensure_ascii=False)

class HackathonChatModel(BaseChatModel):
    """
    Minimal LangChain-compatible chat model that calls the hackathon endpoint.
    """

    model: str = "us.anthropic.claude-3-5-sonnet-20241022-v2:0"

    def _call_api(self, messages: List[Dict[str, str]]) -> str:
        payload = {
            "team_id": TEAM_ID,
            "api_token": API_TOKEN,
            "model": self.model,
            "messages": messages,
            "max_tokens": 1024,
        }

        response = requests.post(
            API_ENDPOINT,
            headers={
                "Content-Type": "application/json",
                "X-Team-ID": TEAM_ID,
                "X-API-Token": API_TOKEN,
            },
            json=payload,
            timeout=60,
        )

        try:
            data = response.json()
        except Exception:
            raise ValueError(f"Non-JSON response from server: {response.text}")

        # ---- FIX: Check for errors gracefully ----
        if "content" not in data:
            # Print entire response for debugging
            print("\n❌ API error response:")
            print(json.dumps(data, indent=2))

            # Extract readable message
            if "error" in data:
                raise RuntimeError(f"API returned error: {data['error']}")
            if "message" in data:
                raise RuntimeError(f"API error message: {data['message']}")
            raise RuntimeError(f"Unexpected API response: {data}")

        # Anthropic-style: content = [{"type":"text","text":"..."}]
        return data["content"][0]["text"]


    def _generate(
        self,
        messages: List[Any],
        stop: List[str] | None = None,
        **kwargs: Any,
    ) -> ChatResult:
        # Convert LangChain messages to API message format
        api_messages = []
        for m in messages:
            role = "user"
            if isinstance(m, SystemMessage):
                role = "system"
            elif isinstance(m, HumanMessage):
                role = "user"
            api_messages.append({"role": role, "content": m.content})

        text = self._call_api(api_messages)
        gen = ChatGeneration(message=HumanMessage(content=text))  # message type doesn't matter much here
        return ChatResult(generations=[gen])

    @property
    def _llm_type(self) -> str:
        return "hackathon-chat-model"


# =========================
# 2. DATA LOADING + SYNTHETIC SOCIAL
# =========================

def load_headlines(path: str) -> Dict[str, str]:
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    # expect: {"1": "headline text", "2": "...", ...}
    return data


def create_synthetic_social(n_per_asset: int = 100) -> List[Dict[str, Any]]:
    """
    Create synthetic Reddit/Twitter-style comments for NVDA, TSLA, GOLD.
    """
    comments: List[Dict[str, Any]] = []
    moods = ["bearish", "mixed", "bullish"]
    comment_id = 1

    for asset in ASSETS:
        for i in range(n_per_asset):
            mood = moods[i % len(moods)]
            if mood == "bearish":
                text = f"People are worried that {asset} could sell off if macro data stays weak."
            elif mood == "mixed":
                text = f"Some think {asset} is overvalued, others say it's fairly priced for growth."
            else:  # bullish
                if asset in ("NVDA", "TSLA"):
                    text = f"Everyone is hyped about {asset} because of AI and long-term innovation."
                else:
                    text = f"Lots of users call {asset} the safest hedge right now."

            comments.append({
                "id": f"social_{comment_id}",
                "asset": asset,
                "mood": mood,
                "text": text,
            })
            comment_id += 1

    return comments


# =========================
# 3. NEWS AGENT (LLM) → CLAIMS
# =========================

NEWS_SYSTEM_PROMPT = """
You are a financial news sentiment agent.

Your job:
- Read a batch of news headlines with IDs.
- ONLY focus on these assets: NVDA, TSLA, GOLD.
- Group headlines into CLAIMS per asset.
- A claim is one sentence like: "NVIDIA may face headwinds from higher rates."
- Each claim must list WHICH headline IDs support it.

Return STRICT JSON with:
{
  "claims": [
    {
      "claim_id": "news_<asset>_<index>",
      "asset": "NVDA" | "TSLA" | "GOLD",
      "source_agent": "news",
      "text": "<one sentence claim>",
      "evidence_ids": ["<headline_id_1>", "<headline_id_2>", ...]
    },
    ...
  ]
}

Rules:
- Ignore headlines that are clearly unrelated to NVDA, TSLA, or GOLD.
- At least 1 evidence_id per claim.
- claim_id must be unique within this batch.
- Do not include any commentary outside the JSON.
"""


def build_news_user_prompt(batch: Dict[str, str]) -> str:
    """
    batch: {"1": "headline 1", "2": "headline 2", ...}
    """
    lines = ["Here are the headlines with IDs:"]
    for hid, text in batch.items():
        lines.append(f"{hid}: {text}")
    return "\n".join(lines)


def generate_news_claims_for_batch(llm, batch: dict):
    user_prompt = build_news_user_prompt(batch)
    full_prompt = NEWS_SYSTEM_PROMPT + "\n\n" + user_prompt

    messages = [
        HumanMessage(content=full_prompt)
    ]

    res = llm.invoke(messages)
    raw = res.content.strip()
    # Optional: debug print
    # print("RAW LLM OUTPUT (truncated):", raw[:400], "\n---\n")

    data = extract_json_object(raw)
    return data.get("claims", [])



def generate_news_claims_for_all(
    llm: HackathonChatModel,
    headlines: Dict[str, str],
    batch_size: int = 50,
) -> List[Dict[str, Any]]:
    ids = list(headlines.keys())
    total = len(ids)
    all_claims: List[Dict[str, Any]] = []

    num_batches = math.ceil(total / batch_size)
    for i in range(num_batches):
        start = i * batch_size
        end = min((i + 1) * batch_size, total)
        batch_ids = ids[start:end]
        batch = {hid: headlines[hid] for hid in batch_ids}
        claims = generate_news_claims_for_batch(llm, batch)
        all_claims.extend(claims)
    return all_claims


# =========================
# 4. SOCIAL AGENT (LLM) → CLAIMS
# =========================

SOCIAL_SYSTEM_PROMPT = """
You are a social sentiment agent reading Reddit/Twitter style comments.

Your job:
- Read a batch of comments with IDs.
- All comments are already tagged with one of: NVDA, TSLA, GOLD.
- Group comments into CLAIMS per asset.
- A claim is one sentence like: "Retail traders are optimistic about NVDA."

Return STRICT JSON with:
{
  "claims": [
    {
      "claim_id": "social_<asset>_<index>",
      "asset": "NVDA" | "TSLA" | "GOLD",
      "source_agent": "social",
      "text": "<one sentence claim>",
      "evidence_ids": ["<comment_id_1>", "<comment_id_2>", ...]
    },
    ...
  ]
}

Rules:
- Use at least one comment per claim.
- Try to aggregate similar opinions into a few clear claims per asset.
- claim_id must be unique within this batch.
- Do not include any commentary outside the JSON.
"""


def build_social_user_prompt(batch: List[Dict[str, Any]]) -> str:
    """
    batch: [{"id": "social_1", "asset": "NVDA", "text": "...", "mood": "bearish"}, ...]
    """
    lines = ["Here are social comments with IDs and assets:"]
    for item in batch:
        lines.append(f"{item['id']} ({item['asset']}): {item['text']}")
    return "\n".join(lines)


def generate_social_claims_for_batch(
    llm: HackathonChatModel,
    batch: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    user_prompt = build_social_user_prompt(batch)
    full_prompt = SOCIAL_SYSTEM_PROMPT + "\n\n" + user_prompt

    messages = [
        HumanMessage(content=full_prompt)
    ]

    res = llm.invoke(messages)
    raw = res.content.strip()
    data = extract_json_object(raw)
    return data.get("claims", [])


def generate_social_claims_for_all(
    llm: HackathonChatModel,
    comments: List[Dict[str, Any]],
    batch_size: int = 50,
) -> List[Dict[str, Any]]:
    total = len(comments)
    all_claims: List[Dict[str, Any]] = []

    num_batches = math.ceil(total / batch_size)
    for i in range(num_batches):
        start = i * batch_size
        end = min((i + 1) * batch_size, total)
        batch = comments[start:end]
        claims = generate_social_claims_for_batch(llm, batch)
        all_claims.extend(claims)
    return all_claims


# =========================
# 5. MASTER AGGREGATOR (NO LLM) → FINAL CLAIMS + PARAGRAPHS
# =========================

MASTER_SYSTEM_PROMPT = """
You are the MASTER AGGREGATOR for a single asset.

You will be given:
- The asset ticker (e.g., NVDA, TSLA, GOLD)
- A list of upstream claims, each with:
  - claim_id
  - source_agent ("news" or "social")
  - text

Your job:
1. Read ALL upstream claims for this asset (news + social together).
2. Identify themes and merge similar ideas into a small set of combined claims.
3. Each combined claim can be 1–3 short sentences (a mini-paragraph).
4. Each combined claim MUST list the upstream claim_ids it is based on.
5. You MUST cover all upstream claim_ids: every upstream claim_id you see must appear in at least one combined claim.
6. You must NOT invent new claim_ids.

Return STRICT JSON ONLY in this shape:

{
  "combined_claims": [
    {
      "final_claim_id": "<ASSET>_combined_1",
      "asset": "<ASSET>",
      "text": "<one short combined claim, may be 1–3 sentences>",
      "upstream_claim_ids": ["claim_id_1", "claim_id_7", "claim_id_9"]
    },
    {
      "final_claim_id": "<ASSET>_combined_2",
      "asset": "<ASSET>",
      "text": "<another combined claim>",
      "upstream_claim_ids": ["claim_id_2", "claim_id_3"]
    }
  ]
}

Guidelines:
- Aim for about 3–8 combined claims per asset.
- Group by meaning: e.g., AI growth, macro risk, valuation, regulation, sentiment.
- Be concise, neutral, and factual.
- Do not output anything outside the JSON.
""".strip()

def build_master_user_prompt(asset: str, upstream_claims: List[Dict[str, Any]]) -> str:
    """
    Format all upstream claims for a single asset as plain text for the master LLM.
    """
    lines = [f"Asset: {asset}", "", "Upstream claims:"]
    for c in upstream_claims:
        claim_id = c["claim_id"]
        source = c.get("source_agent", "unknown")
        text = c["text"]
        lines.append(f"- {claim_id} [{source}]: {text}")
    return "\n".join(lines)

def run_master_aggregator_for_asset(
    llm: HackathonChatModel,
    asset: str,
    upstream_claims: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """
    Call the master LLM for a single asset and return combined_claims.
    """
    user_prompt = build_master_user_prompt(asset, upstream_claims)
    full_prompt = MASTER_SYSTEM_PROMPT + "\n\n" + user_prompt

    messages = [HumanMessage(content=full_prompt)]
    res = llm.invoke(messages)
    raw = res.content.strip()

    data = extract_json_object(raw)
    combined = data.get("combined_claims", [])

    # Optional safety: inject asset if missing
    for c in combined:
        c.setdefault("asset", asset)

    return combined

def build_master_claims(
    llm: HackathonChatModel,
    upstream_claims: List[Dict[str, Any]]
) -> Dict[str, List[Dict[str, Any]]]:
    """
    Use the MASTER LLM to combine news + social claims per asset into
    a smaller set of higher-level final claims.

    Output:
    {
      "NVDA": [
        {
          "final_claim_id": "NVDA_combined_1",
          "asset": "NVDA",
          "text": "... (1–3 sentences)",
          "upstream_claim_ids": ["news_NVDA_1", "social_NVDA_2", ...]
        },
        ...
      ],
      "TSLA": [...],
      "GOLD": [...]
    }
    """
    # group upstream claims by asset
    by_asset: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    for c in upstream_claims:
        asset = c["asset"]
        by_asset[asset].append(c)

    master_by_asset: Dict[str, List[Dict[str, Any]]] = {}

    for asset, claims in by_asset.items():
        if not claims:
            continue
        combined_claims = run_master_aggregator_for_asset(llm, asset, claims)
        master_by_asset[asset] = combined_claims

    return master_by_asset


def build_asset_paragraph(
    asset: str,
    final_claims: List[Dict[str, Any]]
) -> str:
    """
    Build a single paragraph for one asset.
    Each sentence is a claim and cites the upstream claim_ids used.
    """
    sentences: List[str] = []
    for fc in final_claims:
        refs = ", ".join(fc["upstream_claim_ids"])
        sentence = f"{fc['text']} ({refs})."
        sentences.append(sentence)
    return " ".join(sentences)

def normalize_claim_ids(claims: List[Dict[str, Any]], source_tag: str) -> List[Dict[str, Any]]:
    """
    Ensure every claim has a unique claim_id of the form:
      <source_tag>_<asset>_<running_index>

    Example:
      news_NVDA_1, news_NVDA_2, ...
      social_TSLA_1, social_TSLA_2, ...
    """
    counters: Dict[str, int] = {}
    for c in claims:
        asset = c.get("asset", "UNKNOWN")
        counters.setdefault(asset, 0)
        counters[asset] += 1
        new_id = f"{source_tag}_{asset}_{counters[asset]}"
        c["claim_id"] = new_id
    return claims




# =========================
# 6. END-TO-END RUN
# =========================

def main():
    llm = HackathonChatModel()

    # Step 1: load 1000 news headlines
    headlines = load_headlines(HEADLINES_PATH)

    # Step 2: create synthetic Reddit/Twitter style comments
    social_comments = create_synthetic_social(n_per_asset=100)
    run_id = datetime.now().strftime("%Y%m%d_%H%M%S")
    run_dir = os.path.join("runs", run_id)


    # Step 3: upstream agents → claims
    print("Generating news claims...")
    news_claims = generate_news_claims_for_all(llm, headlines, batch_size=50)
    news_claims = normalize_claim_ids(news_claims, source_tag="news")
    save_json(os.path.join(run_dir, "news_claims_output.json"), news_claims)

    print("Generating social claims...")
    social_claims = generate_social_claims_for_all(llm, social_comments, batch_size=50)
    social_claims = normalize_claim_ids(social_claims, source_tag="social")
    save_json(os.path.join(run_dir, "social_claims_output.json"), social_claims)

    all_upstream_claims = news_claims + social_claims
    save_json(os.path.join(run_dir, "all_upstream_claims.json"), all_upstream_claims)

    # Step 4: master aggregator → final claims per asset
    master_claims_by_asset = build_master_claims(llm, all_upstream_claims)
    save_json(os.path.join(run_dir, "master_claims_by_asset.json"), master_claims_by_asset)


    # Step 5: build final paragraphs for your portfolio assets
    portfolio_assets = ASSETS
    for asset in portfolio_assets:
        final_claims = master_claims_by_asset.get(asset, [])
        print(f"\n=== {asset} SUMMARY ===")
        if not final_claims:
            print("No claims for this asset.")
            continue

        paragraph = build_asset_paragraph(asset, final_claims)
        print(paragraph)

    # Optional: show one full chain for debugging / observability
    example_asset = "NVDA"
    final_claims = master_claims_by_asset.get(example_asset, [])
    if final_claims:
        example_fc = final_claims[0]
        print(f"\nChain for one {example_asset} final claim:")
        print("Final claim ID:", example_fc["final_claim_id"])
        print("Final claim text:", example_fc["text"])
        print("Upstream claim IDs:", example_fc["upstream_claim_ids"])


if __name__ == "__main__":
    main()
