## DragMate ♟

**DragMate** is a real‑time‑style chess playground built with **React**, **TypeScript**, **Vite**, **chess.js**, and **@dnd-kit**.
It lets two players share a room and play chess by dragging pieces on a modern, animated board. In demo mode you can also use it locally without a backend.

### Tech stack

- **Frontend**: React + TypeScript + Vite
- **Board / Drag & Drop**: `@dnd-kit/core`
- **Chess rules & validation**: `chess.js`
- **State sync (demo)**: `localStorage` polling via `useGameRoom`

---

### Getting started

- **Install dependencies**

```bash
npm install
```

- **Run the dev server**

```bash
npm run dev
```

Then open the printed URL in your browser (usually `http://localhost:5173`).

---

### How rooms, colors, and turns work

- **Creating / joining a room**
  - From the lobby UI you can create a room (a short alphanumeric ID is generated).
  - Share this room ID with a friend; they can join from the lobby by entering the same ID.
  - Under the hood, room data is stored in `localStorage` under the key `dragmate-rooms`.

- **Player colors**
  - The **first player** in a room becomes **White**.
  - The **second player** (joining from another tab/browser) becomes **Black**.
  - The game board orients itself based on your color: White sees rank 1 at the bottom, Black sees rank 8 at the bottom.

- **Turn logic**
  - Turn information is derived from the FEN and stored in the room as `turn: 'w' | 'b'`.
  - After each valid move, the FEN and `turn` are updated in `localStorage` via `useGameRoom.updateMove`.
  - The sidebar shows:
    - **“Your Turn”** if `room.turn` matches your color.
    - **“Waiting…”** when it is your opponent’s turn.

- **Who can move which pieces**
  - You can **only drag your own color’s pieces**.
  - You can **only drag when it is your turn**.
  - Any attempted drag that does not result in a legal move (per `chess.js`) is ignored.

---

### Project structure (high level)

- `src/App.tsx` – main app shell and routing between lobby and game
- `src/components/Lobby/` – room creation/join UI
- `src/components/Game/` – game screen, status panel, and board container
- `src/components/ChessBoard/` – board rendering and drag‑and‑drop logic
- `src/components/Piece/` – visual representation of a chess piece
- `src/hooks/useGameRoom.ts` – room state, users, and FEN/turn syncing via `localStorage`
- `src/logic/chessLogic.ts` – thin wrapper around `chess.js` for creating a game, validating moves, and reading game state

---

### Notes

- The current implementation uses `localStorage` polling to simulate real‑time updates.
- A Firebase‑backed or WebSocket‑backed implementation can be wired in later by swapping out the logic in `useGameRoom`.
