# DragMate ♟️🎲

**DragMate** is a real-time multiplayer strategy playground built with **React**, **TypeScript**, **Vite**, and **TailwindCSS**, backed by an **authoritative Node + Socket.IO server**.
It features **Chess**, **Backgammon**, **Okey**, and **101** with a premium "Liquid Glass" aesthetic, seamless drag-and-drop interactions, and optimized mobile experience.

## Features

### ♟️ Chess
- **Real-time Multiplayer**: Challenge friends via room ID.
- **Single Player vs AI**: Play against an adaptive AI engine (Stockfish-lite logic).
- **Move Validation**: Full implementation of chess rules via `chess.js`.
- **Drag & Drop**: Smooth interaction using `@dnd-kit/core`.

### 🎲 Backgammon
- **Smart Moves**: Drag a checker to the sum of two dice (e.g., 3+5=8) to execute a combined move instantly.
- **Dynamic Dice**: Dice visual update based on player turn (White/Black themes).
- **Mobile Optimized**: Full-width square board on mobile with a "Collect" bar at the bottom for better ergonomics.
- **Game Over Screens**: Visual victory/defeat overlays with rematch options.

### 🎨 UI & UX
- **Liquid Glass Aesthetic**: Modern, translucent UI components with blurred backdrops.
- **Responsive Design**: Carefully tuned for both desktop and mobile play.
- **Animations**: Smooth entry animations for pieces, dice, and overlays.

## Tech Stack

- **Frontend**: React + TypeScript + Vite (deployed to GitHub Pages)
- **Backend**: Node + Express + Socket.IO (authoritative game server, deployed to Render — see [`server/`](server/))
- **Styling**: TailwindCSS + Custom CSS Variables
- **Real-time**: Socket.IO (per-seat authoritative state push)
- **Drag & Drop**: `@dnd-kit/core`
- **Logic**: `chess.js` (Chess), custom engines (Backgammon, Okey, 101) — shared by client (hints) and server (authority)
- **Icons**: `lucide-react`

---

## Getting Started

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Run the dev server**
   ```bash
   npm run dev
   ```

3. Open the printed URL in your browser (usually `http://localhost:5173`).

---

## How It Works

- **Authoritative server**: For online play, the Node + Socket.IO server (in [`server/`](server/)) owns all game state, RNG (dice/deck), move validation, scoring and the AI. Clients send *intents* (e.g. `{from,to}`) and receive per-seat state pushes — so a client can't inject illegal moves, and in Okey/101 opponents' tiles and the draw order are never sent to your browser.
- **Rooms**: The server allocates a 6-char room id. A durable session token in `localStorage` lets you refresh/reconnect and reclaim your seat.
- **Turns**: Turn ownership is enforced server-side, not just in the UI.
- **AI Mode**: Local single-player runs entirely client-side against a bot; online AI seats are driven by the server (so a host disconnect never stalls them).

## Backend & Deployment

- **Run the server locally**: `cd server && npm install && npm run dev` (listens on `:4000`).
- **Client → server URL**: `VITE_WS_URL` (see [`.env.example`](.env.example)); defaults to `http://localhost:4000` in dev. The gh-pages production build reads [`.env.production`](.env.production).
- **Deploy the server**: [`render.yaml`](render.yaml) is a Render Blueprint — free-tier Web Service, CORS allowing the gh-pages origin, WSS via Render's HTTPS domain.
- **Deploy the client**: `npm run deploy` (builds and publishes `dist/` to GitHub Pages).

## Project Structure

- `src/App.tsx`: Main routing and layout.
- `src/components/Lobby/`: Room creation and game selection.
- `src/components/Game/`: Game containers and HUDs.
- `src/components/ChessBoard/`: Chess visual logic.
- `src/components/BackgammonBoard/`: Backgammon visual logic.
- `src/logic/`: Game rules and AI engines.
