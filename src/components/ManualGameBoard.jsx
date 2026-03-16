import React from 'react';
import { Client as BGClient } from 'boardgame.io/client';
import { createGame } from '../game/logic';
import { BotController } from '../bot/BotController.jsx';
import { Board } from './Board.jsx';

/** Wrapper for manual-client mode (used when bots are present) */
export const ManualGameBoard = ({ gameConfig, onNewGame }) => {
    const clientRef = React.useRef(null);
    const seedRef = React.useRef(null);
    const [gameState, setGameState] = React.useState(null);

    if (!clientRef.current) {
        const seed = gameConfig.seed || Date.now().toString(36).slice(-10);
        seedRef.current = seed;
        const game = createGame({
            rules: gameConfig.rules,
            playerNames: gameConfig.playerNames,
            seed,
        });
        const client = BGClient({ game, numPlayers: gameConfig.numPlayers, playerID: '0' });
        client.start();
        clientRef.current = client;
    }

    React.useEffect(() => {
        const client = clientRef.current;
        if (!client) return;
        const unsub = client.subscribe(state => {
            if (state) setGameState({ ...state });
        });
        // Get initial state
        const initial = client.getState();
        if (initial) setGameState({ ...initial });
        return () => { unsub(); client.stop(); };
    }, []);

    if (!gameState) return <div>Loading...</div>;

    return (
        <div style={{ display: 'flex', fontFamily: '"Arial", sans-serif' }}>
            <div style={{ flex: 1, minWidth: 0, padding: '8px 20px 20px' }}>
                <Board
                    G={gameState.G}
                    ctx={gameState.ctx}
                    moves={clientRef.current.moves}
                    playerID="0"
                    log={gameState.log || []}
                    gameSeed={seedRef.current}
                    isActive={gameState.ctx?.currentPlayer === '0'}
                    onNewGame={onNewGame}
                />
            </div>
            <BotController
                client={clientRef.current}
                botConfigs={gameConfig.bots}
                botDelay={gameConfig.botDelay}
                humanPlayerID="0"
            />
        </div>
    );
};
