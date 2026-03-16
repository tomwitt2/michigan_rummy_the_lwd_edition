import React from 'react';
import { Client as ReactClient } from 'boardgame.io/react';
import { createGame } from './game/logic';
import { LocalLobby } from './components/LocalLobby.jsx';
import { ReplayBoard } from './components/ReplayBoard.jsx';
import { ManualGameBoard } from './components/ManualGameBoard.jsx';
import { Board } from './components/Board.jsx';
import { PlayerIdentity } from './lobby/PlayerIdentity.jsx';
import { OnlineLobby } from './lobby/OnlineLobby.jsx';

const App = () => {
    const [mode, setMode] = React.useState(null); // null = landing, 'local', 'online'
    const [gameConfig, setGameConfig] = React.useState(null);
    const [replayData, setReplayData] = React.useState(null);
    const [onlinePlayerName, setOnlinePlayerName] = React.useState(null);
    const clientRef = React.useRef(null);
    const seedRef = React.useRef(null);

    // Replay mode
    if (replayData) {
        return <ReplayBoard replayData={replayData} onExit={() => { setReplayData(null); clientRef.current = null; }} />;
    }

    // Online mode: name entry → lobby
    if (mode === 'online') {
        if (!onlinePlayerName) {
            return <PlayerIdentity onReady={setOnlinePlayerName} />;
        }
        return <OnlineLobby playerName={onlinePlayerName} onBack={() => { setOnlinePlayerName(null); setMode(null); }} />;
    }

    // Local mode: lobby → game
    if (mode === 'local') {
        if (!gameConfig) {
            return <LocalLobby onStart={setGameConfig} onReplay={setReplayData} />;
        }

        const hasBots = gameConfig.bots && Object.keys(gameConfig.bots).length > 0;
        if (hasBots) {
            return <ManualGameBoard gameConfig={gameConfig} onNewGame={() => { clientRef.current = null; setGameConfig(null); }} />;
        }

        if (!clientRef.current) {
            const seed = gameConfig.seed || Date.now().toString(36).slice(-10);
            seedRef.current = seed;
            const game = createGame({ rules: gameConfig.rules, playerNames: gameConfig.playerNames, seed });
            clientRef.current = ReactClient({ game, board: Board, numPlayers: gameConfig.numPlayers, debug: true });
        }
        const GameClient = clientRef.current;
        return (
            <div>
                <GameClient playerID="0" gameSeed={seedRef.current} onNewGame={() => { clientRef.current = null; setGameConfig(null); }} />
            </div>
        );
    }

    // Landing page — mode selector
    return (
        <div style={{ padding: '60px 40px', fontFamily: '"Arial", sans-serif', maxWidth: '400px', margin: '0 auto', textAlign: 'center' }}>
            <h1 style={{ color: '#2c3e50', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '8px' }}>
                Michigan Rummy
            </h1>
            <p style={{ color: '#888', fontSize: '14px', marginBottom: '40px' }}>Choose how to play</p>

            <button
                onClick={() => setMode('local')}
                style={{
                    width: '100%', padding: '16px', border: 'none', borderRadius: '10px',
                    background: '#27ae60', color: 'white', fontSize: '18px', fontWeight: 'bold',
                    cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '1px',
                    marginBottom: '12px',
                }}
            >Local Game</button>
            <p style={{ color: '#999', fontSize: '12px', margin: '0 0 24px' }}>
                Play on this device with bots or pass-and-play
            </p>

            <button
                onClick={() => setMode('online')}
                style={{
                    width: '100%', padding: '16px', border: 'none', borderRadius: '10px',
                    background: '#2980b9', color: 'white', fontSize: '18px', fontWeight: 'bold',
                    cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '1px',
                    marginBottom: '12px',
                }}
            >Online Game</button>
            <p style={{ color: '#999', fontSize: '12px', margin: 0 }}>
                Join the lobby and play with others on the network
            </p>
        </div>
    );
};

export default App;
