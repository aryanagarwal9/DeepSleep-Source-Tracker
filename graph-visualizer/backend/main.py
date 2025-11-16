import json
import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any

from llm_agent import HackathonChatModel, query_claims


# =========================
# FASTAPI APP SETUP
# =========================

app = FastAPI(title="SourceTrace")

# Enable CORS for local development - must be very permissive for dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins in development
    allow_credentials=False,  # Can't use credentials with allow_origins=["*"]
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)


# =========================
# DATA LOADING
# =========================

SAMPLE_DATA_PATH = os.path.join(os.path.dirname(__file__), "data", "sample_data.json")

def load_sample_data() -> Dict[str, Any]:
    """Load the sample claims data from JSON file."""
    with open(SAMPLE_DATA_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


# Load data once at startup
try:
    CLAIMS_DATA = load_sample_data()
    print(f"✅ Loaded claims data: {len(CLAIMS_DATA.get('all_upstream_claims', []))} upstream claims")
except Exception as e:
    print(f"❌ Error loading sample data: {e}")
    CLAIMS_DATA = {"all_upstream_claims": [], "master_claims_by_asset": {}}


# Initialize LLM
llm = HackathonChatModel()


# =========================
# REQUEST/RESPONSE MODELS
# =========================

class ChatRequest(BaseModel):
    question: str
    selected_asset: str = None


class ChatResponse(BaseModel):
    answer: str
    citations: Dict[str, str]
    highlight_claim_ids: List[str]


# =========================
# API ENDPOINTS
# =========================

@app.get("/")
async def root():
    """Health check endpoint."""
    return {
        "status": "ok",
        "message": "Source Trace Visualizer API is running",
        "upstream_claims_count": len(CLAIMS_DATA.get("all_upstream_claims", [])),
        "assets": list(CLAIMS_DATA.get("master_claims_by_asset", {}).keys())
    }


@app.get("/api/data")
async def get_data():
    """
    Get all claims data (upstream + master claims).
    """
    return CLAIMS_DATA


@app.post("/api/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    Handle chat queries. Uses LLM to answer questions about the claims
    and returns relevant claim IDs to highlight on the graph.
    """
    if not request.question or not request.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty")

    try:
        # Query the LLM
        result = query_claims(llm, request.question, CLAIMS_DATA, request.selected_asset)

        return ChatResponse(
            answer=result.get("answer", "I couldn't generate an answer."),
            citations=result.get("citations", {}),
            highlight_claim_ids=result.get("relevant_claim_ids", [])
        )
    except Exception as e:
        print(f"❌ Error processing chat request: {e}")
        raise HTTPException(status_code=500, detail=f"Error processing request: {str(e)}")


@app.get("/api/claims/{asset}")
async def get_claims_by_asset(asset: str):
    """
    Get all claims for a specific asset.
    """
    asset = asset.upper()

    if asset not in ["NVDA", "TSLA", "GOLD"]:
        raise HTTPException(status_code=404, detail=f"Asset {asset} not found")

    # Filter upstream claims
    upstream = [
        c for c in CLAIMS_DATA.get("all_upstream_claims", [])
        if c.get("asset") == asset
    ]

    # Get master claims
    master = CLAIMS_DATA.get("master_claims_by_asset", {}).get(asset, [])

    return {
        "asset": asset,
        "upstream_claims": upstream,
        "master_claims": master
    }


# =========================
# RUN SERVER
# =========================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
