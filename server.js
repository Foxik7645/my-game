import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import http from "http";
import { Server as SocketIOServer } from "socket.io";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server);

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const DB_FILE = path.join(__dirname, "db.json");

function loadState() {
  try {
    const raw = fs.readFileSync(DB_FILE, "utf-8");
    return JSON.parse(raw);
  } catch (e) {
    return { buildings: [], territories: [] };
  }
}

let state = loadState();

function saveState() {
  fs.writeFileSync(DB_FILE, JSON.stringify(state, null, 2), "utf-8");
}

function uid() {
  return (
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 8)
  );
}

// --- API ---
app.get("/api/state", (req, res) => {
  res.json(state);
});

app.post("/api/build", (req, res) => {
  const { lat, lng, type, owner } = req.body || {};
  if (typeof lat !== "number" || typeof lng !== "number" || typeof type !== "string") {
    return res.status(400).json({ ok: false, error: "Invalid payload" });
  }
  const building = {
    id: uid(),
    lat,
    lng,
    type,
    owner: typeof owner === "string" ? owner : null,
    createdAt: Date.now()
  };
  state.buildings.push(building);
  saveState();
  io.emit("new-building", building);
  res.json({ ok: true, building });
});

// (опционально) territories
app.post("/api/territory", (req, res) => {
  const { coords, name, color, owner } = req.body || {};
  if (!Array.isArray(coords) || coords.length < 3) {
    return res.status(400).json({ ok: false, error: "Invalid polygon" });
  }
  const territory = {
    id: uid(),
    coords, // [[lat, lng], [lat, lng], ...]
    name: typeof name === "string" ? name : "Territory",
    color: typeof color === "string" ? color : "#3388ff",
    owner: typeof owner === "string" ? owner : null,
    createdAt: Date.now()
  };
  state.territories.push(territory);
  saveState();
  io.emit("new-territory", territory);
  res.json({ ok: true, territory });
});

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);
  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("Server listening on http://localhost:" + PORT);
});
