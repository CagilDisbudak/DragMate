import { useState, useEffect } from 'react';

export interface GameRoom {
    fen: string;
    whitePlayer: string;
    blackPlayer: string;
    turn: 'w' | 'b';
    lastMove?: any;
}

// Mock user ID for demo purposes
const DEMO_USER_ID = 'demo-user-' + Math.random().toString(36).substring(7);

// Helper to read/write rooms from localStorage
const getRooms = (): Record<string, GameRoom> => {
    const data = localStorage.getItem('dragmate-rooms');
    return data ? JSON.parse(data) : {};
};

const saveRooms = (rooms: Record<string, GameRoom>) => {
    localStorage.setItem('dragmate-rooms', JSON.stringify(rooms));
};

const generateRoomId = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
};

export const useGameRoom = (roomId: string | null) => {
    const [room, setRoom] = useState<GameRoom | null>(null);
    const [userId] = useState<string>(DEMO_USER_ID);
    const [loading, setLoading] = useState(true);
    const [isAuthLoading] = useState(false); // No auth needed for mock

    useEffect(() => {
        console.log('🎮 Using DEMO MODE with localStorage');
        setLoading(false);
    }, []);

    useEffect(() => {
        if (!roomId) {
            setLoading(false);
            return;
        }

        const rooms = getRooms();
        const currentRoom = rooms[roomId];

        if (currentRoom) {
            setRoom(currentRoom);
        } else {
            setRoom(null);
        }
        setLoading(false);

        // Poll for changes (simulating real-time updates)
        const interval = setInterval(() => {
            const updatedRooms = getRooms();
            const updatedRoom = updatedRooms[roomId];
            if (updatedRoom) {
                setRoom(updatedRoom);
            }
        }, 500);

        return () => clearInterval(interval);
    }, [roomId]);

    const createRoom = async () => {
        const id = generateRoomId();
        const newRoom: GameRoom = {
            fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
            whitePlayer: userId,
            blackPlayer: '',
            turn: 'w',
        };

        const rooms = getRooms();
        rooms[id] = newRoom;
        saveRooms(rooms);

        console.log('✅ Demo room created with ID:', id);
        return id;
    };

    const joinRoom = async (id: string) => {
        const rooms = getRooms();
        const targetRoom = rooms[id];

        if (targetRoom) {
            if (!targetRoom.whitePlayer) {
                targetRoom.whitePlayer = userId;
            } else if (!targetRoom.blackPlayer && targetRoom.whitePlayer !== userId) {
                targetRoom.blackPlayer = userId;
            }
            saveRooms(rooms);
            console.log('✅ Joined demo room:', id);
        } else {
            console.error('❌ Room not found:', id);
            alert('Room not found.');
        }
    };

    const updateMove = async (fen: string) => {
        if (!roomId) return;

        const rooms = getRooms();
        const targetRoom = rooms[roomId];

        if (targetRoom) {
            targetRoom.fen = fen;
            targetRoom.turn = fen.split(' ')[1] as 'w' | 'b';
            saveRooms(rooms);
        }
    };

    return { room, userId, loading, isAuthLoading, createRoom, joinRoom, updateMove };
};
