from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
import json
import os
from datetime import datetime

app = FastAPI()

# Allow all origins so the tracker JS can POST webhooks
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

connected_clients = []

# ─── Local JSON storage ───
DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
os.makedirs(DATA_DIR, exist_ok=True)

# Resume counter from existing files so numbering is continuous across restarts
def _get_next_counter():
    existing = [int(f.split(".")[0]) for f in os.listdir(DATA_DIR) if f.endswith(".json") and f.split(".")[0].isdigit()]
    return max(existing, default=0) + 1

event_counter = _get_next_counter()


def save_event(event_data):
    """Save a single event as a numbered JSON file."""
    global event_counter
    filepath = os.path.join(DATA_DIR, f"{event_counter}.json")
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(event_data, f, indent=2, ensure_ascii=False)
    event_counter += 1
    return filepath


@app.post("/webhook")
async def webhook(request: Request):
    data = await request.json()
    timestamp = datetime.now().isoformat()

    # Unwrap batched events: { batch_timestamp, events: [...] }
    if "events" in data and isinstance(data["events"], list):
        events = data["events"]
    else:
        # Single event payload
        events = [data]

    disconnected = []
    for event in events:
        payload = {
            "data": event,
            "received_at": event.get("timestamp", timestamp),
        }

        # Save to local JSON file
        save_event(payload)

        msg = json.dumps(payload)
        for client in connected_clients:
            try:
                await client.send_text(msg)
            except Exception:
                disconnected.append(client)

    # Clean up disconnected clients
    for client in disconnected:
        if client in connected_clients:
            connected_clients.remove(client)

    return {"status": "received"}


@app.get("/api/events")
async def get_events():
    """Return all saved events, sorted by file number."""
    files = [f for f in os.listdir(DATA_DIR) if f.endswith(".json") and f.split(".")[0].isdigit()]
    files.sort(key=lambda f: int(f.split(".")[0]))
    events = []
    for f in files:
        try:
            with open(os.path.join(DATA_DIR, f), "r", encoding="utf-8") as fh:
                events.append(json.load(fh))
        except Exception:
            pass
    return events


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    connected_clients.append(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        connected_clients.remove(websocket)


@app.get("/", response_class=HTMLResponse)
async def home():
    return """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Behaviour Tracker — Live Dashboard</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
    <style>
        *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

        :root {
            --bg-primary: #0b0e14;
            --bg-secondary: #12161f;
            --bg-card: #161b27;
            --bg-card-hover: #1a2030;
            --border: #1e2636;
            --border-accent: #2a3548;
            --text-primary: #e6edf3;
            --text-secondary: #8b949e;
            --text-muted: #545d68;
            --accent-blue: #58a6ff;
            --accent-purple: #bc8cff;
            --accent-green: #3fb950;
            --accent-orange: #d29922;
            --accent-red: #f85149;
            --accent-cyan: #39d2c0;
            --accent-pink: #f778ba;
            --gradient-1: linear-gradient(135deg, #58a6ff 0%, #bc8cff 100%);
            --gradient-2: linear-gradient(135deg, #3fb950 0%, #39d2c0 100%);
            --shadow-sm: 0 1px 3px rgba(0,0,0,0.3);
            --shadow-md: 0 4px 16px rgba(0,0,0,0.4);
            --shadow-lg: 0 8px 32px rgba(0,0,0,0.5);
            --radius: 12px;
            --radius-sm: 8px;
        }

        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            background: var(--bg-primary);
            color: var(--text-primary);
            min-height: 100vh;
            overflow-x: hidden;
        }

        /* ─── Header ─── */
        .header {
            position: sticky;
            top: 0;
            z-index: 100;
            background: rgba(11, 14, 20, 0.85);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            border-bottom: 1px solid var(--border);
            padding: 16px 32px;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }

        .header-left {
            display: flex;
            align-items: center;
            gap: 14px;
        }

        .logo {
            width: 36px;
            height: 36px;
            border-radius: 10px;
            background: var(--gradient-1);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 18px;
            font-weight: 700;
            color: #fff;
            box-shadow: 0 0 20px rgba(88,166,255,0.3);
        }

        .header h1 {
            font-size: 18px;
            font-weight: 600;
            letter-spacing: -0.3px;
        }

        .header h1 span {
            color: var(--text-secondary);
            font-weight: 400;
        }

        .header-right {
            display: flex;
            align-items: center;
            gap: 16px;
        }

        .connection-badge {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 6px 14px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 500;
            border: 1px solid var(--border);
            background: var(--bg-secondary);
            transition: all 0.3s ease;
        }

        .connection-badge.connected {
            border-color: rgba(63,185,80,0.3);
            background: rgba(63,185,80,0.08);
            color: var(--accent-green);
        }

        .connection-badge.disconnected {
            border-color: rgba(248,81,73,0.3);
            background: rgba(248,81,73,0.08);
            color: var(--accent-red);
        }

        .connection-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: var(--accent-green);
            animation: pulse-dot 2s ease-in-out infinite;
        }

        .disconnected .connection-dot {
            background: var(--accent-red);
            animation: none;
        }

        @keyframes pulse-dot {
            0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(63,185,80,0.4); }
            50% { opacity: 0.7; box-shadow: 0 0 0 6px rgba(63,185,80,0); }
        }

        .btn {
            padding: 7px 16px;
            border-radius: var(--radius-sm);
            border: 1px solid var(--border);
            background: var(--bg-secondary);
            color: var(--text-secondary);
            font-size: 12px;
            font-weight: 500;
            font-family: inherit;
            cursor: pointer;
            transition: all 0.2s ease;
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .btn:hover {
            background: var(--bg-card-hover);
            color: var(--text-primary);
            border-color: var(--border-accent);
        }

        .btn-danger:hover {
            border-color: rgba(248,81,73,0.4);
            color: var(--accent-red);
            background: rgba(248,81,73,0.08);
        }

        /* ─── Stats Bar ─── */
        .stats-bar {
            display: flex;
            gap: 12px;
            padding: 16px 32px;
            border-bottom: 1px solid var(--border);
            background: var(--bg-secondary);
            overflow-x: auto;
        }

        .stat-card {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 12px 18px;
            border-radius: var(--radius-sm);
            border: 1px solid var(--border);
            background: var(--bg-card);
            min-width: 160px;
            transition: all 0.3s ease;
        }

        .stat-card:hover {
            border-color: var(--border-accent);
            transform: translateY(-1px);
        }

        .stat-icon {
            width: 36px;
            height: 36px;
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 16px;
        }

        .stat-icon.blue   { background: rgba(88,166,255,0.12); color: var(--accent-blue); }
        .stat-icon.green  { background: rgba(63,185,80,0.12);  color: var(--accent-green); }
        .stat-icon.purple { background: rgba(188,140,255,0.12); color: var(--accent-purple); }
        .stat-icon.orange { background: rgba(210,153,34,0.12); color: var(--accent-orange); }
        .stat-icon.cyan   { background: rgba(57,210,192,0.12); color: var(--accent-cyan); }

        .stat-info { display: flex; flex-direction: column; gap: 2px; }

        .stat-value {
            font-size: 20px;
            font-weight: 700;
            letter-spacing: -0.5px;
            font-variant-numeric: tabular-nums;
        }

        .stat-label {
            font-size: 11px;
            color: var(--text-secondary);
            text-transform: uppercase;
            letter-spacing: 0.5px;
            font-weight: 500;
        }

        /* ─── Main Content ─── */
        .main {
            max-width: 1200px;
            margin: 0 auto;
            padding: 24px 32px;
        }

        .section-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 16px;
        }

        .section-title {
            font-size: 14px;
            font-weight: 600;
            color: var(--text-secondary);
            text-transform: uppercase;
            letter-spacing: 0.8px;
        }

        .events-feed {
            display: flex;
            flex-direction: column;
            gap: 10px;
        }

        /* ─── Event Card ─── */
        .event-card {
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: var(--radius);
            overflow: hidden;
            transition: all 0.3s ease;
            animation: slideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .event-card:hover {
            border-color: var(--border-accent);
            box-shadow: var(--shadow-md);
        }

        @keyframes slideIn {
            from { opacity: 0; transform: translateY(-16px) scale(0.98); }
            to   { opacity: 1; transform: translateY(0) scale(1); }
        }

        .event-card-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 14px 18px;
            border-bottom: 1px solid var(--border);
            cursor: pointer;
            user-select: none;
        }

        .event-card-header:hover {
            background: var(--bg-card-hover);
        }

        .event-meta {
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .event-type-badge {
            padding: 4px 10px;
            border-radius: 6px;
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        /* Event type colors */
        .badge-page_view        { background: rgba(88,166,255,0.12);  color: var(--accent-blue);   border: 1px solid rgba(88,166,255,0.2); }
        .badge-session_start    { background: rgba(63,185,80,0.12);   color: var(--accent-green);  border: 1px solid rgba(63,185,80,0.2); }
        .badge-session_end      { background: rgba(248,81,73,0.12);   color: var(--accent-red);    border: 1px solid rgba(248,81,73,0.2); }
        .badge-click            { background: rgba(188,140,255,0.12); color: var(--accent-purple); border: 1px solid rgba(188,140,255,0.2); }
        .badge-scroll_depth     { background: rgba(210,153,34,0.12);  color: var(--accent-orange); border: 1px solid rgba(210,153,34,0.2); }
        .badge-add_to_cart      { background: rgba(57,210,192,0.12);  color: var(--accent-cyan);   border: 1px solid rgba(57,210,192,0.2); }
        .badge-purchase         { background: rgba(247,120,186,0.12); color: var(--accent-pink);   border: 1px solid rgba(247,120,186,0.2); }
        .badge-product_view     { background: rgba(88,166,255,0.12);  color: var(--accent-blue);   border: 1px solid rgba(88,166,255,0.2); }
        .badge-default          { background: rgba(139,148,158,0.12); color: var(--text-secondary); border: 1px solid rgba(139,148,158,0.2); }

        .event-name {
            font-size: 14px;
            font-weight: 500;
        }

        .event-time {
            font-size: 12px;
            color: var(--text-muted);
            font-family: 'JetBrains Mono', monospace;
            font-weight: 400;
        }

        .event-expand-icon {
            color: var(--text-muted);
            transition: transform 0.25s ease;
            font-size: 12px;
        }

        .event-card.expanded .event-expand-icon {
            transform: rotate(180deg);
        }

        .event-card-body {
            max-height: 0;
            overflow: hidden;
            transition: max-height 0.35s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .event-card.expanded .event-card-body {
            max-height: 2000px;
        }

        .event-data-grid {
            padding: 16px 18px;
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
            gap: 10px;
        }

        .data-field {
            display: flex;
            flex-direction: column;
            gap: 4px;
            padding: 10px 14px;
            border-radius: var(--radius-sm);
            background: var(--bg-secondary);
            border: 1px solid var(--border);
        }

        .data-field-key {
            font-size: 11px;
            color: var(--text-muted);
            text-transform: uppercase;
            letter-spacing: 0.5px;
            font-weight: 600;
        }

        .data-field-value {
            font-size: 13px;
            color: var(--text-primary);
            font-family: 'JetBrains Mono', monospace;
            font-weight: 400;
            word-break: break-all;
        }

        .data-field-value.url {
            color: var(--accent-blue);
            text-decoration: none;
        }

        /* Nested object display */
        .nested-object {
            padding: 16px 18px;
            border-top: 1px solid var(--border);
        }

        .nested-title {
            font-size: 12px;
            font-weight: 600;
            color: var(--text-secondary);
            margin-bottom: 10px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .nested-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
            gap: 8px;
        }

        /* Raw JSON toggle */
        .raw-json-toggle {
            padding: 10px 18px;
            border-top: 1px solid var(--border);
            display: flex;
            justify-content: flex-end;
        }

        .raw-json-content {
            padding: 0 18px 16px;
            display: none;
        }

        .raw-json-content.visible {
            display: block;
        }

        .raw-json-content pre {
            background: var(--bg-primary);
            border: 1px solid var(--border);
            border-radius: var(--radius-sm);
            padding: 14px;
            font-family: 'JetBrains Mono', monospace;
            font-size: 12px;
            color: var(--text-secondary);
            overflow-x: auto;
            line-height: 1.6;
            max-height: 400px;
            overflow-y: auto;
        }

        /* ─── Empty State ─── */
        .empty-state {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 80px 20px;
            text-align: center;
        }

        .empty-icon {
            width: 72px;
            height: 72px;
            border-radius: 20px;
            background: var(--bg-card);
            border: 1px solid var(--border);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 32px;
            margin-bottom: 20px;
            animation: float 3s ease-in-out infinite;
        }

        @keyframes float {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-8px); }
        }

        .empty-state h2 {
            font-size: 18px;
            font-weight: 600;
            margin-bottom: 8px;
        }

        .empty-state p {
            font-size: 14px;
            color: var(--text-secondary);
            max-width: 360px;
            line-height: 1.5;
        }

        /* ─── Toast notification ─── */
        .toast {
            position: fixed;
            bottom: 24px;
            right: 24px;
            padding: 12px 20px;
            border-radius: var(--radius-sm);
            background: var(--bg-card);
            border: 1px solid var(--border);
            color: var(--text-primary);
            font-size: 13px;
            font-weight: 500;
            box-shadow: var(--shadow-lg);
            transform: translateY(100px);
            opacity: 0;
            transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
            z-index: 200;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .toast.show {
            transform: translateY(0);
            opacity: 1;
        }

        /* ─── Scrollbar ─── */
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: var(--border-accent); border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: var(--text-muted); }

        /* ─── Responsive ─── */
        @media (max-width: 768px) {
            .header { padding: 12px 16px; }
            .stats-bar { padding: 12px 16px; }
            .main { padding: 16px; }
            .event-data-grid { grid-template-columns: 1fr; }
            .stat-card { min-width: 130px; }
        }
    </style>
</head>
<body>

    <!-- ─── Header ─── -->
    <header class="header">
        <div class="header-left">
            <div class="logo">B</div>
            <h1>Behaviour Tracker <span>— Live Dashboard</span></h1>
        </div>
        <div class="header-right">
            <div id="connectionBadge" class="connection-badge disconnected">
                <div class="connection-dot"></div>
                <span id="connectionText">Connecting...</span>
            </div>
            <button class="btn" onclick="toggleAutoScroll()" id="scrollBtn">
                ⬇ Auto-scroll
            </button>
            <button class="btn btn-danger" onclick="clearEvents()">
                ✕ Clear
            </button>
        </div>
    </header>

    <!-- ─── Stats Bar ─── -->
    <div class="stats-bar">
        <div class="stat-card">
            <div class="stat-icon blue">📡</div>
            <div class="stat-info">
                <div class="stat-value" id="totalEvents">0</div>
                <div class="stat-label">Total Events</div>
            </div>
        </div>
        <div class="stat-card">
            <div class="stat-icon green">👁</div>
            <div class="stat-info">
                <div class="stat-value" id="pageViews">0</div>
                <div class="stat-label">Page Views</div>
            </div>
        </div>
        <div class="stat-card">
            <div class="stat-icon purple">🖱</div>
            <div class="stat-info">
                <div class="stat-value" id="clicks">0</div>
                <div class="stat-label">Clicks</div>
            </div>
        </div>
        <div class="stat-card">
            <div class="stat-icon orange">📜</div>
            <div class="stat-info">
                <div class="stat-value" id="scrolls">0</div>
                <div class="stat-label">Scroll Events</div>
            </div>
        </div>
        <div class="stat-card">
            <div class="stat-icon cyan">🛒</div>
            <div class="stat-info">
                <div class="stat-value" id="commerce">0</div>
                <div class="stat-label">Commerce</div>
            </div>
        </div>
    </div>

    <!-- ─── Events Feed ─── -->
    <div class="main">
        <div class="section-header">
            <div class="section-title">Live Events Feed</div>
            <div class="event-time" id="lastEventTime">Waiting for events...</div>
        </div>
        <div class="events-feed" id="eventsFeed">
            <div class="empty-state" id="emptyState">
                <div class="empty-icon">📡</div>
                <h2>Listening for events</h2>
                <p>Webhook events will appear here in real time as they are received from your tracker.</p>
            </div>
        </div>
    </div>

    <!-- ─── Toast ─── -->
    <div class="toast" id="toast"></div>

    <script>
        // ─── State ─── 
        let autoScroll = true;
        let eventCount = 0;
        let stats = { page_view: 0, click: 0, scroll_depth: 0, commerce: 0, session: 0 };

        // ─── WebSocket ─── 
        let ws;
        let reconnectTimer;

        function connectWS() {
            const wsProto = location.protocol === "https:" ? "wss://" : "ws://";
            ws = new WebSocket(wsProto + location.host + "/ws");

            ws.onopen = () => {
                const badge = document.getElementById("connectionBadge");
                badge.className = "connection-badge connected";
                document.getElementById("connectionText").textContent = "Connected";
                showToast("🟢 Connected to server");
            };

            ws.onclose = () => {
                const badge = document.getElementById("connectionBadge");
                badge.className = "connection-badge disconnected";
                document.getElementById("connectionText").textContent = "Disconnected";
                showToast("🔴 Connection lost — retrying...");
                clearTimeout(reconnectTimer);
                reconnectTimer = setTimeout(connectWS, 3000);
            };

            ws.onerror = () => {
                ws.close();
            };

            ws.onmessage = (event) => {
                try {
                    const payload = JSON.parse(event.data);
                    addEvent(payload.data, payload.received_at);
                } catch (e) {
                    console.error("Failed to parse event", e);
                }
            };
        }

        connectWS();

        // ─── Load saved history on page load ───
        async function loadHistory() {
            try {
                const res = await fetch("/api/events");
                const events = await res.json();
                if (events.length > 0) {
                    const emptyState = document.getElementById("emptyState");
                    if (emptyState) emptyState.style.display = "none";
                }
                // Add oldest first, newest on top
                events.forEach(ev => {
                    addEvent(ev.data, ev.received_at, true);
                });
            } catch(e) {
                console.error("Failed to load history", e);
            }
        }
        loadHistory();

        // ─── Add Event ─── 
        function addEvent(data, receivedAt, fromHistory = false) {
            // Hide empty state
            const emptyState = document.getElementById("emptyState");
            if (emptyState) emptyState.style.display = "none";

            eventCount++;
            const eventName = data.event || data.action || data.type || "unknown";
            const normalizedName = eventName.toLowerCase().replace(/[\\s-]+/g, "_");

            // Update stats
            updateStats(normalizedName);

            // Update last event time
            const timeStr = new Date(receivedAt).toLocaleTimeString();
            document.getElementById("lastEventTime").textContent = "Last event: " + timeStr;

            // Build card
            const card = document.createElement("div");
            card.className = fromHistory ? "event-card" : "event-card";
            if (!fromHistory) card.style.animation = "slideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1)";
            card.innerHTML = buildCardHTML(data, normalizedName, eventName, receivedAt, eventCount);

            // Insert at top
            const feed = document.getElementById("eventsFeed");
            feed.insertBefore(card, feed.firstChild);

            // Keep max 500 events in DOM
            while (feed.children.length > 501) {
                feed.removeChild(feed.lastChild);
            }

            if (!fromHistory && autoScroll) {
                window.scrollTo({ top: 0, behavior: "smooth" });
            }
        }

        function buildCardHTML(data, normalizedName, eventName, receivedAt, idx) {
            const badgeClass = getBadgeClass(normalizedName);
            const timeStr = new Date(receivedAt).toLocaleTimeString("en-US", {
                hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit"
            });

            // Separate top-level simple values from nested objects
            const simpleFields = {};
            const nestedFields = {};
            const skipKeys = ["event", "action", "type"];

            for (const [k, v] of Object.entries(data)) {
                if (skipKeys.includes(k)) continue;
                if (v !== null && typeof v === "object" && !Array.isArray(v)) {
                    nestedFields[k] = v;
                } else {
                    simpleFields[k] = v;
                }
            }

            let html = `
                <div class="event-card-header" onclick="toggleCard(this)">
                    <div class="event-meta">
                        <span class="event-type-badge ${badgeClass}">${eventName}</span>
                        <span class="event-name">#${idx}</span>
                    </div>
                    <div style="display:flex;align-items:center;gap:14px;">
                        <span class="event-time">${timeStr}</span>
                        <span class="event-expand-icon">▼</span>
                    </div>
                </div>
                <div class="event-card-body">
                    <div class="event-data-grid">
            `;

            // Simple fields
            for (const [k, v] of Object.entries(simpleFields)) {
                const displayVal = formatValue(k, v);
                html += `
                    <div class="data-field">
                        <div class="data-field-key">${formatKey(k)}</div>
                        <div class="data-field-value${isUrl(v) ? ' url' : ''}">${displayVal}</div>
                    </div>
                `;
            }

            html += `</div>`;

            // Nested objects
            for (const [section, obj] of Object.entries(nestedFields)) {
                html += `
                    <div class="nested-object">
                        <div class="nested-title">${formatKey(section)}</div>
                        <div class="nested-grid">
                `;
                for (const [k, v] of Object.entries(obj)) {
                    const displayVal = formatValue(k, v);
                    html += `
                        <div class="data-field">
                            <div class="data-field-key">${formatKey(k)}</div>
                            <div class="data-field-value${isUrl(v) ? ' url' : ''}">${displayVal}</div>
                        </div>
                    `;
                }
                html += `</div></div>`;
            }

            // Raw JSON toggle
            html += `
                    <div class="raw-json-toggle">
                        <button class="btn" onclick="event.stopPropagation(); toggleRawJSON(this);">
                            { } Raw JSON
                        </button>
                    </div>
                    <div class="raw-json-content">
                        <pre>${syntaxHighlight(JSON.stringify(data, null, 2))}</pre>
                    </div>
                </div>
            `;

            return html;
        }

        // ─── Helpers ─── 

        function getBadgeClass(name) {
            const map = {
                page_view: "badge-page_view",
                session_start: "badge-session_start",
                session_end: "badge-session_end",
                click: "badge-click",
                click_event: "badge-click",
                scroll_depth: "badge-scroll_depth",
                add_to_cart: "badge-add_to_cart",
                remove_from_cart: "badge-add_to_cart",
                purchase: "badge-purchase",
                checkout: "badge-purchase",
                product_view: "badge-product_view",
                product_click: "badge-product_view",
            };
            return map[name] || "badge-default";
        }

        function formatKey(key) {
            return key.replace(/_/g, " ").replace(/\\b\\w/g, c => c.toUpperCase());
        }

        function formatValue(key, val) {
            if (val === null || val === undefined) return '<span style="color:var(--text-muted)">null</span>';
            if (typeof val === "boolean") return val ? '✓ true' : '✗ false';
            if (Array.isArray(val)) return JSON.stringify(val);
            if (isUrl(val)) return `<a href="${val}" target="_blank" style="color:var(--accent-blue);text-decoration:none;">${truncate(String(val), 60)}</a>`;
            return escapeHtml(truncate(String(val), 120));
        }

        function isUrl(val) {
            return typeof val === "string" && (val.startsWith("http://") || val.startsWith("https://"));
        }

        function truncate(str, len) {
            return str.length > len ? str.slice(0, len) + "…" : str;
        }

        function escapeHtml(str) {
            const div = document.createElement("div");
            div.textContent = str;
            return div.innerHTML;
        }

        function syntaxHighlight(json) {
            json = json.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
            return json.replace(
                /(\"(\\\\u[a-zA-Z0-9]{4}|\\\\[^u]|[^\\\\\"])*\"(\\s*:)?|\\b(true|false|null)\\b|-?\\d+(?:\\.\\d*)?(?:[eE][+\\-]?\\d+)?)/g,
                function (match) {
                    let color = "var(--accent-orange)"; // number
                    if (/^\"/.test(match)) {
                        if (/:$/.test(match)) {
                            color = "var(--accent-blue)"; // key
                        } else {
                            color = "var(--accent-green)"; // string
                        }
                    } else if (/true|false/.test(match)) {
                        color = "var(--accent-purple)"; // bool
                    } else if (/null/.test(match)) {
                        color = "var(--text-muted)"; // null
                    }
                    return '<span style="color:' + color + '">' + match + "</span>";
                }
            );
        }

        function updateStats(name) {
            document.getElementById("totalEvents").textContent = eventCount;

            if (name === "page_view") {
                stats.page_view++;
                document.getElementById("pageViews").textContent = stats.page_view;
            } else if (name.includes("click")) {
                stats.click++;
                document.getElementById("clicks").textContent = stats.click;
            } else if (name.includes("scroll")) {
                stats.scroll_depth++;
                document.getElementById("scrolls").textContent = stats.scroll_depth;
            } else if (["add_to_cart", "remove_from_cart", "purchase", "checkout", "product_view", "product_click"].includes(name)) {
                stats.commerce++;
                document.getElementById("commerce").textContent = stats.commerce;
            }
        }

        // ─── UI Actions ─── 

        function toggleCard(headerEl) {
            headerEl.parentElement.classList.toggle("expanded");
        }

        function toggleRawJSON(btn) {
            const content = btn.parentElement.nextElementSibling;
            content.classList.toggle("visible");
            btn.textContent = content.classList.contains("visible") ? "✕ Hide JSON" : "{ } Raw JSON";
        }

        function clearEvents() {
            const feed = document.getElementById("eventsFeed");
            feed.innerHTML = `
                <div class="empty-state" id="emptyState">
                    <div class="empty-icon">📡</div>
                    <h2>Listening for events</h2>
                    <p>Webhook events will appear here in real time as they are received from your tracker.</p>
                </div>
            `;
            eventCount = 0;
            stats = { page_view: 0, click: 0, scroll_depth: 0, commerce: 0, session: 0 };
            document.getElementById("totalEvents").textContent = "0";
            document.getElementById("pageViews").textContent = "0";
            document.getElementById("clicks").textContent = "0";
            document.getElementById("scrolls").textContent = "0";
            document.getElementById("commerce").textContent = "0";
            document.getElementById("lastEventTime").textContent = "Waiting for events...";
        }

        let autoScrollEnabled = true;
        function toggleAutoScroll() {
            autoScroll = !autoScroll;
            const btn = document.getElementById("scrollBtn");
            btn.textContent = autoScroll ? "⬇ Auto-scroll" : "⏸ Paused";
            btn.style.borderColor = autoScroll ? "var(--border)" : "var(--accent-orange)";
            btn.style.color = autoScroll ? "var(--text-secondary)" : "var(--accent-orange)";
        }

        function showToast(msg) {
            const toast = document.getElementById("toast");
            toast.textContent = msg;
            toast.classList.add("show");
            setTimeout(() => toast.classList.remove("show"), 3000);
        }
    </script>
</body>
</html>
"""
