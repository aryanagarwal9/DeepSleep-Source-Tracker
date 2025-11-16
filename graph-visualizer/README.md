# SourceTrace Graph Visualizer

A real-time graph visualization tool for analyzing and exploring claims about financial assets (NVDA, TSLA, GOLD) from news and social media sources. Built with React, Cytoscape.js for graph visualization, and FastAPI for the backend.

## Features

- Interactive graph visualization of claims and their relationships
- Real-time filtering by asset, sentiment, and source
- AI-powered chat interface for querying claims
- Citation tracking and highlighting
- Support for multiple data sources (news, social media)

## Tech Stack

**Frontend:**
- React 19
- Vite (build tool)
- Cytoscape.js (graph visualization)
- TailwindCSS (styling)
- Lucide React (icons)

**Backend:**
- FastAPI (Python web framework)
- Uvicorn (ASGI server)
- LangChain (LLM integration)
- Pydantic (data validation)

## Prerequisites

- Node.js (v18 or higher recommended)
- Python 3.8+
- npm or yarn package manager
- pip (Python package manager)

## Installation

### 1. Clone the Repository

```bash
git clone <repository-url>
cd "Great Agent Hack Visualiser/graph-visualizer"
```

### 2. Frontend Setup

Install frontend dependencies:

```bash
npm install
```

### 3. Backend Setup

Navigate to the backend directory and install Python dependencies:

```bash
cd backend
pip install -r requirements.txt
```

Or use a virtual environment (recommended):

```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 4. Environment Variables

Create a `.env` file in the `graph-visualizer` directory with the following:

```env
TWITTER_BEARER_TOKEN=your_twitter_bearer_token_here
```

**Note:** Replace `your_twitter_bearer_token_here` with your actual Twitter API bearer token if using Twitter data integration.

## Running the Application

The application consists of two parts that need to run simultaneously:

### Option 1: Run Both Services Separately

**Terminal 1 - Backend Server:**

```bash
# From the graph-visualizer/backend directory
python main.py
```

The backend API will start on `http://localhost:8000`

You can verify it's running by visiting: `http://localhost:8000/`

**Terminal 2 - Frontend Development Server:**

```bash
# From the graph-visualizer directory
npm run dev
```

The frontend will start on `http://localhost:5173` (or another port if 5173 is occupied)

### Option 2: Using the Main Runner

Alternatively, you can use the main runner script (if configured):

```bash
# From the graph-visualizer directory
python main_runner.py
```

## API Endpoints

The backend provides the following endpoints:

- `GET /` - Health check and API status
- `GET /api/data` - Get all claims data (upstream + master claims)
- `POST /api/chat` - Chat interface for querying claims
  - Request body: `{"question": "string", "selected_asset": "string"}`
- `GET /api/claims/{asset}` - Get claims for a specific asset (NVDA, TSLA, or GOLD)

## Project Structure

```
graph-visualizer/
├── backend/
│   ├── data/                  # Sample data files
│   ├── llm_agent.py          # LLM integration logic
│   ├── main.py               # FastAPI application
│   └── requirements.txt      # Python dependencies
├── src/
│   ├── components/           # React components
│   │   ├── AssetSelector.jsx
│   │   ├── ChatPanel.jsx
│   │   ├── FiltersPanel.jsx
│   │   ├── GraphVisualizer.jsx
│   │   ├── Header.jsx
│   │   └── NodeDetailsPanel.jsx
│   ├── constants/            # Configuration and constants
│   ├── hooks/                # Custom React hooks
│   ├── utils/                # Utility functions
│   ├── App.jsx               # Main App component
│   └── main.jsx              # Entry point
├── .env                      # Environment variables
├── package.json              # Node dependencies
├── vite.config.js           # Vite configuration
└── tailwind.config.js       # Tailwind CSS configuration
```

## Available Scripts

### Frontend Scripts

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run preview  # Preview production build
npm run lint     # Run ESLint
```

### Backend

```bash
python backend/main.py  # Start FastAPI server with auto-reload
```

## Development

### Adding New Features

1. **Frontend components**: Add to `src/components/`
2. **API endpoints**: Add to `backend/main.py`
3. **Graph styles**: Modify `src/constants/cytoscapeStyles.js`
4. **Data transformations**: Update `src/utils/dataTransformer.js`

### Hot Module Replacement

The development setup includes HMR:
- Frontend changes reload instantly
- Backend changes auto-reload when using `uvicorn.run(..., reload=True)`

## Troubleshooting

### Port Already in Use

If ports 5173 or 8000 are already in use:

**Frontend:** Vite will automatically try the next available port

**Backend:** Modify the port in `backend/main.py`:
```python
uvicorn.run(app, host="0.0.0.0", port=8001, reload=True)
```

### CORS Issues

The backend is configured to allow all origins in development. If you encounter CORS errors, check that the backend server is running.

### Missing Dependencies

If you encounter import errors:

**Frontend:**
```bash
rm -rf node_modules package-lock.json
npm install
```

**Backend:**
```bash
pip install -r backend/requirements.txt --upgrade
```

## Data Format

The application expects claims data in the following structure:

```json
{
  "all_upstream_claims": [...],
  "master_claims_by_asset": {
    "NVDA": [...],
    "TSLA": [...],
    "GOLD": [...]
  }
}
```

Sample data should be placed in `backend/data/sample_data.json`

## Production Build

To build for production:

```bash
# Build frontend
npm run build

# The build output will be in the dist/ directory
# Serve using a static file server or integrate with your backend
```

## Contributing

1. Create a feature branch
2. Make your changes
3. Test thoroughly
4. Submit a pull request

## License

[Add your license here]

## Support

For issues or questions, please open an issue in the repository.