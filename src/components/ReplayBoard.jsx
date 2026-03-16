import React from 'react';
import { ReplayEngine } from '../replay/ReplayEngine.js';
import { ReplayControls } from '../replay/ReplayControls.jsx';
import { Board } from './Board.jsx';

export const ReplayBoard = ({ replayData, onExit }) => {
    const engineRef = React.useRef(null);
    const [, forceUpdate] = React.useReducer(x => x + 1, 0);
    const [liveMode, setLiveMode] = React.useState(false);
    const [liveState, setLiveState] = React.useState(null);

    if (!engineRef.current) {
        engineRef.current = new ReplayEngine(replayData);
    }
    const engine = engineRef.current;

    React.useEffect(() => {
        return () => engine.stop();
    }, [engine]);

    const handlePlayFromHere = React.useCallback(() => {
        const client = engine.getClient();
        // Subscribe to state changes from the live client
        const unsubscribe = client.subscribe(state => {
            if (state) setLiveState({ ...state });
        });
        // Store unsubscribe for cleanup
        engineRef.current._liveUnsubscribe = unsubscribe;
        // Trigger initial state
        setLiveState({ ...client.getState() });
        setLiveMode(true);
    }, [engine]);

    // Chat and bullet messages from replay data
    const replayChatMessages = replayData.chatMessages || [];
    const replayBulletMessages = replayData.bulletMessages || [];

    // Live mode — render Board connected to the real client
    if (liveMode) {
        const client = engine.getClient();
        const state = liveState || client.getState();
        if (!state) return <div>Loading...</div>;

        // Ensure client playerID matches the current player so moves are authorized
        const currentPlayer = state.ctx.currentPlayer;
        if (client.playerID !== currentPlayer) {
            client.updatePlayerID(currentPlayer);
        }

        return (
            <div>
                <div style={{
                    background: '#1a6e3a', color: 'white', padding: '8px 16px',
                    display: 'flex', alignItems: 'center', gap: '12px',
                    fontSize: '13px', borderBottom: '2px solid #0f4d28',
                }}>
                    <span style={{ fontWeight: 'bold', color: '#f1c40f' }}>LIVE — Resumed from replay step {engine.currentStep + 1}/{engine.totalSteps}</span>
                    <span style={{ flex: 1 }} />
                    <button
                        style={{ padding: '4px 12px', borderRadius: '4px', border: 'none', background: '#e74c3c', color: 'white', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}
                        onClick={() => {
                            engineRef.current._liveUnsubscribe?.();
                            onExit();
                        }}
                    >Exit Game</button>
                </div>
                <div style={{ display: 'flex', fontFamily: '"Arial", sans-serif' }}>
                    <div style={{ flex: 1, minWidth: 0, padding: '8px 20px 20px' }}>
                        <Board
                            G={state.G}
                            ctx={state.ctx}
                            playerID={state.ctx.currentPlayer}
                            moves={client.moves}
                            log={state.log}
                            gameSeed={replayData.seed}
                            initialChat={replayChatMessages}
                            initialBullets={replayBulletMessages}
                        />
                    </div>
                </div>
            </div>
        );
    }

    // Replay mode
    const state = engine.getState();
    if (!state) return <div>Loading replay...</div>;

    // Filter chat messages to those at or before the current replay position
    const currentRound = state.G.round;
    const currentTurn = state.ctx.turn;
    const filteredChat = replayChatMessages.filter(msg =>
        msg.round < currentRound || (msg.round === currentRound && msg.turn <= currentTurn)
    );

    return (
        <div>
            <ReplayControls engine={engine} onExit={onExit} onStateChange={forceUpdate} onPlayFromHere={handlePlayFromHere} />
            <div style={{ display: 'flex', fontFamily: '"Arial", sans-serif' }}>
                <div style={{ flex: 1, minWidth: 0, padding: '8px 20px 20px' }}>
                    <Board
                        G={state.G}
                        ctx={state.ctx}
                        playerID={state.ctx.currentPlayer}
                        moves={new Proxy({}, { get: () => () => {} })}
                        isReplay={true}
                        replayChat={filteredChat}
                        replayBullets={replayBulletMessages}
                    />
                </div>
            </div>
        </div>
    );
};
