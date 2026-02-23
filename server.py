fast api server :
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request
from fastapi.responses import HTMLResponse
import json

app = FastAPI()

connected_clients = []

@app.post("/webhook")
async def webhook(request: Request):
    data = await request.json()
    
    # Send new webhook to all connected browsers
    for client in connected_clients:
        await client.send_text(json.dumps(data, indent=2))
    
    return {"status": "received"}


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
    <html>
        <body>
            <h1>Live Webhooks</h1>
            <pre id="output"></pre>

            <script>
                const ws = new WebSocket("ws://" + location.host + "/ws");
                ws.onmessage = function(event) {
                    const output = document.getElementById("output");
                    output.textContent = event.data + "\\n\\n" + output.textContent;
                };
            </script>
        </body>
    </html>
    """