import json
import math
from typing import List, Dict, Any
import requests
from collections import defaultdict
import os
from datetime import datetime
from dotenv import load_dotenv

from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.outputs import ChatResult, ChatGeneration

# Load environment variables from .env file
load_dotenv()

# =========================
# 0. CONFIG
# =========================

API_ENDPOINT = "https://ctwa92wg1b.execute-api.us-east-1.amazonaws.com/prod/invoke"
TEAM_ID = "team_the_great_hack_2025_051"
API_TOKEN = "5NDNdyHT3R1unAT7u6kKCTHBbIajpmX-LhiJKSFYb-M"

# Twitter API Configuration (loaded from .env file)
TWITTER_BEARER_TOKEN = os.getenv("TWITTER_BEARER_TOKEN", "")

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
    json_str = text[start:end + 1]
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

def load_headlines(path: str) -> Dict[str, Dict[str, Any]]:
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    # expect: {"1": {"id": 1, "title": "...", "source": "...", "publishedAt": "..."}, ...}
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
# 2a. TWITTER DATA FETCHING
# =========================

def calculate_engagement_weight(public_metrics: dict) -> float:
    """
    Calculate influence weight based on tweet engagement using log scale.

    Examples:
    - 0-5 engagement → weight ~0.5 (minimal engagement)
    - 10 engagement → weight ~1.0 (baseline)
    - 100 engagement → weight ~2.0 (good engagement)
    - 1,000 engagement → weight ~3.0 (viral/influential)
    - 10,000+ engagement → weight ~4.0+ (highly viral)
    """
    likes = public_metrics.get('like_count', 0)
    retweets = public_metrics.get('retweet_count', 0)
    replies = public_metrics.get('reply_count', 0)

    # Combined engagement score (retweets worth 2x since they're stronger signals)
    total_engagement = likes + (retweets * 2) + replies

    if total_engagement < 5:
        return 0.5  # Minimal engagement

    # Log10 scale: 10 engagement = 1.0, 100 = 2.0, 1000 = 3.0
    return math.log10(total_engagement)


def fetch_tweets(query: str, n: int) -> List[Dict[str, Any]]:
    """
    Fetch up to n tweets using the X 'Search recent Posts' endpoint.
    Returns tweets with engagement metrics for weighting.
    """
    if not TWITTER_BEARER_TOKEN:
        raise RuntimeError(
            "TWITTER_BEARER_TOKEN not set. "
            "Please add it to your .env file or set it as an environment variable."
        )

    headers = {"Authorization": f"Bearer {TWITTER_BEARER_TOKEN}"}
    params: Dict[str, Any] = {
        "query": query,
        "max_results": 100,  # Allowed range: 10–100
        "tweet.fields": "text,lang,public_metrics"  # Added public_metrics for engagement
    }

    tweets: List[Dict[str, Any]] = []
    next_token = None
    SEARCH_URL = "https://api.x.com/2/tweets/search/recent"

    while len(tweets) < n:
        if next_token:
            params["next_token"] = next_token
        elif "next_token" in params:
            del params["next_token"]

        try:
            r = requests.get(SEARCH_URL, headers=headers, params=params, timeout=30)
        except requests.exceptions.RequestException as e:
            print(f"❌ Request error for query '{query}': {e}")
            break

        if r.status_code != 200:
            print(f"❌ X API error ({r.status_code}) for query '{query}':")
            print(f"   {r.text}")
            break

        try:
            data = r.json()
        except Exception as e:
            print(f"❌ Failed to parse JSON response: {e}")
            break

        # Check for API errors
        if "errors" in data:
            print(f"❌ X API returned errors for query '{query}':")
            print(json.dumps(data["errors"], indent=2))
            break

        meta = data.get("meta", {})
        result_count = meta.get("result_count", 0)

        if result_count == 0 or "data" not in data:
            print(f"ℹ️  No tweets returned for query: {query}")
            break

        for tweet in data["data"]:
            # Only process English tweets
            if tweet.get("lang") != "en":
                continue

            text = tweet.get("text", "").strip()
            if not text:
                continue

            # Extract engagement metrics
            metrics = tweet.get("public_metrics", {})
            likes = metrics.get("like_count", 0)
            retweets = metrics.get("retweet_count", 0)
            replies = metrics.get("reply_count", 0)

            total_engagement = likes + (retweets * 2) + replies

            tweets.append({
                "id": f"twitter_{tweet['id']}",
                "text": text,
                "likes": likes,
                "retweets": retweets,
                "replies": replies,
                "total_engagement": total_engagement,
                "engagement_weight": calculate_engagement_weight(metrics)
            })

            if len(tweets) >= n:
                break

        # Pagination
        next_token = meta.get("next_token")
        if not next_token:
            break

    return tweets


def fetch_twitter_data_for_assets(
        assets: List[str],
        tweets_per_asset: int = 100
) -> List[Dict[str, Any]]:
    """
    Fetch real Twitter data for specified assets with engagement-based weighting.

    Returns data in format compatible with Social Agent:
    [
      {
        "id": "twitter_123",
        "asset": "NVDA",
        "text": "Tweet text...",
        "likes": 234,
        "retweets": 89,
        "replies": 45,
        "total_engagement": 457,
        "engagement_weight": 2.66
      },
      ...
    ]
    """
    # Twitter search queries for each asset (removed FINANCE)
    queries = {
        "NVDA": "(NVDA OR NVIDIA) lang:en -is:retweet",
        "TSLA": "(TSLA OR Tesla) lang:en -is:retweet",
        "GOLD": "(GOLD OR gold price OR gold market) lang:en -is:retweet"
    }

    all_comments = []

    for asset in assets:
        if asset not in queries:
            print(f"⚠️  Warning: No query defined for asset '{asset}', skipping...")
            continue

        query = queries[asset]
        print(f"📡 Fetching tweets for {asset} with query: {query}")

        try:
            tweets = fetch_tweets(query, tweets_per_asset)

            # Tag each tweet with the asset
            for tweet in tweets:
                tweet["asset"] = asset

            all_comments.extend(tweets)
            print(f"✅ Fetched {len(tweets)} tweets for {asset}")

        except Exception as e:
            print(f"❌ Error fetching tweets for {asset}: {e}")
            continue

    print(f"\n📊 Total tweets fetched: {len(all_comments)}")

    # Show engagement statistics
    if all_comments:
        engagements = [t.get("total_engagement", 0) for t in all_comments]
        weights = [t.get("engagement_weight", 0) for t in all_comments]

        print(f"   Engagement range: {min(engagements)} - {max(engagements)}")
        print(f"   Average engagement: {sum(engagements) / len(engagements):.1f}")
        print(f"   Weight range: {min(weights):.2f} - {max(weights):.2f}")
        print(f"   Average weight: {sum(weights) / len(weights):.2f}")

    return all_comments


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

Heuristics: 
- When you make a claim, you also have to add a weight to it internally, based on how much each headline supports it. 
- the weight could be added by analyzing 2 important factors: The source and the data of publication. 
- Add more weightage to an evidence if it is from a reputed source such as 
[
 'Financial Times',
 'BBC',
 'The Guardian',
 'Bloomberg.com',
 'The New York Times',
 'CNBC',
 'Harvard Business Review',
 'MIT News',
 'International Monetary Fund',
 'S&P Global',
 'AP News',
 'Fortune',
 'NPR',
 'WIRED',
 'Forbes',
 'Business Insider',
 'The Times',
 'The Economic Times',
 'The Hindu',
 'CNN'
]

- and if it is recent (published most recently given today's date and time is 16/11/2025 12:09 pm UTC)
- you are basically weighing the evidences based on their credibility and recency. 
- Important detail: the total weight must sum to 1 for each claim. so if there r 3 data sources, weight it accordingly such that w1+w2+w3 = 1. 
Return STRICT JSON with:
{
  "claims": [
    {
      "claim_id": "news_<asset>_<index>",
      "asset": "NVDA" | "TSLA" | "GOLD",
      "source_agent": "news",
      "text": "<one sentence claim>",
      "evidence_ids": ["<headline_id_1>", "<headline_id_2>", ...],
      "weight": {"<headline_id_1>": w1, "<headline_id_2>": w2 ......"<headline_id_n>": wn}
    },
    ...
  ]
}

Rules:
- Ignore headlines that are clearly unrelated to NVDA, TSLA, or GOLD.
- At least 1 evidence_id per claim, but try to group multiple ids demonstrating the same claim. The more the better. But make sure the evidences are talking about the same idea.
- claim_id must be unique within this batch.
- Do not include any commentary outside the JSON.

"""


def build_news_user_prompt(batch: Dict[str, Dict[str, Any]]) -> str:
    """
    batch: {
      "1": {"id": 1, "title": "...", "source": "...", "publishedAt": "..."},
      "2": {...},
      ...
    }
    """
    lines = ["Here are the headlines with IDs (including source and publication date):"]
    for hid, info in batch.items():
        title = info.get("title", "")
        source = info.get("source", "")
        published_at = info.get("publishedAt", "")
        # id is the key `hid`; internal "id" field is redundant for the agent
        lines.append(
            f"{hid}: {title} [source: {source} | publishedAt: {published_at}]"
        )
    return "\n".join(lines)


def generate_news_claims_for_batch(llm, batch: Dict[str, Dict[str, Any]]):
    user_prompt = build_news_user_prompt(batch)
    full_prompt = NEWS_SYSTEM_PROMPT + "\n\n" + user_prompt

    messages = [
        HumanMessage(content=full_prompt)
    ]

    res = llm.invoke(messages)
    raw = res.content.strip()

    data = extract_json_object(raw)
    return data.get("claims", [])


def generate_news_claims_for_all(
        llm: HackathonChatModel,
        headlines: Dict[str, Dict[str, Any]],
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

        # now each batch entry is a dict with title/source/publishedAt etc.
        batch = {hid: headlines[hid] for hid in batch_ids}

        claims = generate_news_claims_for_batch(llm, batch)
        all_claims.extend(claims)

    return all_claims


# =========================
# 4. SOCIAL AGENT (LLM) → CLAIMS
# =========================

SOCIAL_SYSTEM_PROMPT = """
You are a social sentiment agent reading Twitter posts about stocks.

Your job:
- Read a batch of Twitter posts with IDs and ENGAGEMENT METRICS.
- All posts are tagged with one of: NVDA, TSLA, GOLD.
- Group posts into CLAIMS per asset.
- A claim is one sentence like: "Retail traders are optimistic about NVDA."

Heuristics:
- When you make a claim, you must add a weight to it internally, based on how much each tweet supports it.
- The weight is based on ENGAGEMENT (likes + retweets*2 + replies).
- Higher engagement = more influential/viral tweet = higher weight.
- Engagement levels:
  * 0-10 engagement: Low influence (weight ~0.1-0.3)
  * 10-100 engagement: Moderate influence (weight ~0.3-0.5)
  * 100-1000 engagement: High influence (weight ~0.5-0.7)
  * 1000+ engagement: Viral/Very high influence (weight ~0.7-1.0)

- Important: Total weight must sum to 1 for each claim. If 3 tweets support a claim, weight them based on relative engagement: w1+w2+w3 = 1.

Return STRICT JSON with:
{
  "claims": [
    {
      "claim_id": "social_<asset>_<index>",
      "asset": "NVDA" | "TSLA" | "GOLD",
      "source_agent": "social",
      "text": "<one sentence claim>",
      "evidence_ids": ["<tweet_id_1>", "<tweet_id_2>", ...],
      "weight": {"<tweet_id_1>": w1, "<tweet_id_2>": w2, ..., "<tweet_id_n>": wn}
    },
    ...
  ]
}

Rules:
- Use at least one tweet per claim, but group multiple tweets with similar sentiment.
- Prioritize high-engagement tweets when forming claims.
- If conflicting sentiments exist, favor higher engagement.
- claim_id must be unique within this batch.
- Do not include any commentary outside the JSON.
"""


def build_social_user_prompt(batch: List[Dict[str, Any]]) -> str:
    """
    batch: [{"id": "twitter_1", "asset": "NVDA", "text": "...",
             "total_engagement": 450, "engagement_weight": 2.66, "likes": 234, "retweets": 89}, ...]
    """
    lines = ["Here are Twitter posts with IDs, assets, and ENGAGEMENT metrics:"]
    lines.append("(Engagement = likes + retweets*2 + replies)")
    lines.append("")

    # Sort by engagement (descending) to show most influential first
    batch_sorted = sorted(batch, key=lambda x: x.get('total_engagement', 0), reverse=True)

    for item in batch_sorted:
        engagement = item.get('total_engagement', 0)
        weight = item.get('engagement_weight', 1.0)
        likes = item.get('likes', 0)
        retweets = item.get('retweets', 0)

        lines.append(
            f"{item['id']} ({item['asset']}) "
            f"[engagement={engagement}, weight={weight:.1f}] "
            f"(👍{likes} 🔄{retweets}): {item['text']}"
        )

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
  - weights (both news and social have weight dictionaries)

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
      "upstream_claim_ids": ["news_asset_1", "social_asset_2", "news_asset_3"],
      "weight": null
    },
    {
      "final_claim_id": "<ASSET>_combined_2",
      "asset": "<ASSET>",
      "text": "<another combined claim>",
      "upstream_claim_ids": ["claim_id_2", "claim_id_3"],
      "weight": null
    }
  ]
}

Guidelines:
- Aim for about 3–8 combined claims per asset between both news and social sources.
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

    # Step 2: Fetch real Twitter data (with fallback to synthetic)
    print("Fetching social data from Twitter...")
    try:
        social_comments = fetch_twitter_data_for_assets(ASSETS, tweets_per_asset=100)

        # Fallback to synthetic if no tweets fetched
        if not social_comments:
            print("⚠️  No Twitter data fetched, falling back to synthetic data...")
            social_comments = create_synthetic_social(n_per_asset=100)
    except Exception as e:
        print(f"❌ Error fetching Twitter data: {e}")
        print("⚠️  Falling back to synthetic data...")
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
