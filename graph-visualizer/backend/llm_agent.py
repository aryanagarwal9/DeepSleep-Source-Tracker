import json
from typing import List, Dict, Any
import requests

from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.outputs import ChatResult, ChatGeneration


# =========================
# CONFIG
# =========================

API_ENDPOINT = "https://ctwa92wg1b.execute-api.us-east-1.amazonaws.com/prod/invoke"
TEAM_ID = "team_the_great_hack_2025_051"
API_TOKEN = "5NDNdyHT3R1unAT7u6kKCTHBbIajpmX-LhiJKSFYb-M"


# =========================
# CUSTOM LLM (HACKATHON GATEWAY) FOR LANGCHAIN
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
            "max_tokens": 2048,
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

        # Check for errors gracefully
        if "content" not in data:
            print("\n❌ API error response:")
            print(json.dumps(data, indent=2))

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
        gen = ChatGeneration(message=HumanMessage(content=text))
        return ChatResult(generations=[gen])

    @property
    def _llm_type(self) -> str:
        return "hackathon-chat-model"


# =========================
# CHAT QUERY HANDLER
# =========================

CHAT_SYSTEM_PROMPT = """
You are an AI assistant that helps users understand financial claims data.

You will be given:
1. A user's question about financial claims
2. All available claims data (news claims, social claims, and master claims for NVDA, TSLA, and GOLD)

Your job:
1. Answer the user's question clearly and concisely based on the provided claims data
2. Identify which claim IDs are most relevant to the user's question
3. Return your response in STRICT JSON format

Response format:
{
  "answer": "<your detailed answer to the user's question>",
  "relevant_claim_ids": ["<claim_id_1>", "<claim_id_2>", ...]
}

Guidelines:
- Be factual and base your answer only on the provided claims data
- Include 1-5 most relevant claim IDs in the relevant_claim_ids array
- If no claims are relevant, return an empty array
- Keep your answer concise but informative
- Do not include any text outside the JSON structure
""".strip()


def build_chat_user_prompt(user_question: str, claims_data: Dict[str, Any]) -> str:
    """
    Format the user's question and all claims data for the LLM.
    """
    lines = [
        f"User question: {user_question}",
        "",
        "=== AVAILABLE CLAIMS DATA ===",
        "",
        "## All Upstream Claims (News and Social):"
    ]

    for claim in claims_data.get("all_upstream_claims", []):
        lines.append(
            f"- {claim['claim_id']} [{claim['source_agent']}] ({claim['asset']}): {claim['text']}"
        )

    lines.append("")
    lines.append("## Master Claims by Asset:")

    for asset, master_claims in claims_data.get("master_claims_by_asset", {}).items():
        lines.append(f"\n### {asset}:")
        for claim in master_claims:
            upstream_ids = ", ".join(claim.get("upstream_claim_ids", []))
            lines.append(
                f"- {claim['final_claim_id']}: {claim['text']} (based on: {upstream_ids})"
            )

    return "\n".join(lines)


def query_claims(llm: HackathonChatModel, user_question: str, claims_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Query the LLM with a user question and claims data.
    Returns: {"answer": str, "relevant_claim_ids": List[str]}
    """
    user_prompt = build_chat_user_prompt(user_question, claims_data)
    full_prompt = CHAT_SYSTEM_PROMPT + "\n\n" + user_prompt

    messages = [HumanMessage(content=full_prompt)]
    res = llm.invoke(messages)
    raw = res.content.strip()

    try:
        data = extract_json_object(raw)
        return {
            "answer": data.get("answer", ""),
            "relevant_claim_ids": data.get("relevant_claim_ids", [])
        }
    except Exception as e:
        # Fallback if JSON parsing fails
        return {
            "answer": raw,
            "relevant_claim_ids": []
        }
