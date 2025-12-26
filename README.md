# DragMate ♟️🎲

**DragMate** is a real-time multiplayer strategy playground built with **React**, **TypeScript**, **Vite**, and **TailwindCSS**.
It features both **Chess** and **Backgammon** games with a premium "Liquid Glass" aesthetic, seamless drag-and-drop interactions, and optimized mobile experience.

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

- **Frontend**: React + TypeScript + Vite
- **Styling**: TailwindCSS + Custom CSS Variables
- **State Management**: React Hooks + LocalStorage (for local/demo sync)
- **Drag & Drop**: `@dnd-kit/core`
- **Logic**: `chess.js` (Chess), Custom implementation (Backgammon)
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

- **Rooms**: Game state is synchronized via `localStorage` in this demo version (simulating a backend). Room IDs share state across tabs.
- **Turns**: The game strictly enforces turn-based entry. You can only drag your own pieces/checkers when it's your turn.
- **AI Mode**: In local/single-player mode, the standard opponent is an AI bot that responds after a brief "thinking" delay.

## Project Structure

- `src/App.tsx`: Main routing and layout.
- `src/components/Lobby/`: Room creation and game selection.
- `src/components/Game/`: Game containers and HUDs.
- `src/components/ChessBoard/`: Chess visual logic.
- `src/components/BackgammonBoard/`: Backgammon visual logic.
- `src/logic/`: Game rules and AI engines.
