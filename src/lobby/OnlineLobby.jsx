import React from 'react';
import { listMatches, joinMatch, createMatch, getMatch } from './lobbyApi.js';
import { TableCard } from './TableCard.jsx';
import { CreateTableDialog } from './CreateTableDialog.jsx';
import { WaitingRoom } from './WaitingRoom.jsx';
import { MultiplayerGameBoard } from '../components/MultiplayerGameBoard.jsx';

const SESSION_KEY = 'lwd-rummy-session';

function saveSession(data) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(data));
}

function loadSession() {
    try {
        return JSON.parse(localStorage.getItem(SESSION_KEY));
    } catch { return null; }
}

function clearSession() {
    localStorage.removeItem(SESSION_KEY);
}

export const OnlineLobby = ({ playerName, onBack }) => {
    const [matches, setMatches] = React.useState([]);
    const [error, setError] = React.useState(null);
    const [showCreate, setShowCreate] = React.useState(false);
    const [joinedMatch, setJoinedMatch] = React.useState(null); // { matchID, playerID, credentials }
    const [activeGame, setActiveGame] = React.useState(null);
    const [reconnecting, setReconnecting] = React.useState(true);

    // Attempt to reconnect to a saved session on mount
    React.useEffect(() => {
        const session = loadSession();
        if (!session) { setReconnecting(false); return; }

        getMatch(session.matchID).then(match => {
            // Verify our seat is still ours
            const seat = match.players.find(p => String(p.id) === session.playerID);
            if (!seat || seat.name !== session.playerName) {
                clearSession();
                setReconnecting(false);
                return;
            }

            if (session.activeGame) {
                // Reconnect directly to the game
                setActiveGame(session.activeGame);
            } else {
                // Reconnect to the waiting room
                setJoinedMatch({
                    matchID: session.matchID,
                    playerID: session.playerID,
                    credentials: session.credentials,
                });
            }
            setReconnecting(false);
        }).catch(() => {
            clearSession();
            setReconnecting(false);
        });
    }, []);

    // Poll open matches
    React.useEffect(() => {
        if (joinedMatch) return; // Stop polling when in waiting room
        let active = true;
        const poll = async () => {
            try {
                const data = await listMatches();
                if (active) {
                    setMatches(data);
                    setError(null);
                }
            } catch (err) {
                if (active) setError(err.message);
            }
        };
        poll();
        const interval = setInterval(poll, 3000);
        return () => { active = false; clearInterval(interval); };
    }, [joinedMatch]);

    const handleCreateTable = async ({ numPlayers, setupData }) => {
        try {
            const { matchID } = await createMatch({ numPlayers, setupData });
            // Auto-join creator to seat 0
            const { playerCredentials } = await joinMatch(matchID, {
                playerID: '0',
                playerName,
            });
            setShowCreate(false);
            const match = { matchID, playerID: '0', credentials: playerCredentials };
            setJoinedMatch(match);
            saveSession({ ...match, playerName });
        } catch (err) {
            setError(`Failed to create table: ${err.message}`);
        }
    };

    const handleJoinTable = async (matchID) => {
        try {
            // Find first open seat
            const match = matches.find(m => m.matchID === matchID);
            if (!match) return;
            const openSeat = match.players.find(p => !p.name);
            if (!openSeat) {
                setError('No open seats at this table.');
                return;
            }
            const { playerCredentials } = await joinMatch(matchID, {
                playerID: String(openSeat.id),
                playerName,
            });
            const match = { matchID, playerID: String(openSeat.id), credentials: playerCredentials };
            setJoinedMatch(match);
            saveSession({ ...match, playerName });
        } catch (err) {
            setError(`Failed to join: ${err.message}`);
        }
    };

    const handleGameStart = React.useCallback((matchData, botCredentials, botConfigs) => {
        const game = {
            matchID: joinedMatch.matchID,
            playerID: joinedMatch.playerID,
            credentials: joinedMatch.credentials,
            botCredentials: botCredentials || {},
            botConfigs: botConfigs || {},
        };
        setActiveGame(game);
        saveSession({ matchID: game.matchID, playerID: game.playerID, credentials: game.credentials, playerName, activeGame: game });
    }, [joinedMatch, playerName]);

    const handleLeaveTable = () => {
        setJoinedMatch(null);
        clearSession();
    };

    // Reconnecting — show loading
    if (reconnecting) {
        return (
            <div style={{ padding: '40px', fontFamily: '"Arial", sans-serif', textAlign: 'center' }}>
                <h2 style={{ color: '#2c3e50' }}>Reconnecting...</h2>
            </div>
        );
    }

    // Show game board if game started
    if (activeGame) {
        return (
            <MultiplayerGameBoard
                matchID={activeGame.matchID}
                playerID={activeGame.playerID}
                credentials={activeGame.credentials}
                botCredentials={activeGame.botCredentials}
                botConfigs={activeGame.botConfigs}
                onLeave={() => {
                    setActiveGame(null);
                    setJoinedMatch(null);
                    clearSession();
                }}
            />
        );
    }

    // Show waiting room if joined
    if (joinedMatch) {
        return (
            <WaitingRoom
                matchID={joinedMatch.matchID}
                playerID={joinedMatch.playerID}
                credentials={joinedMatch.credentials}
                playerName={playerName}
                onGameStart={handleGameStart}
                onLeave={handleLeaveTable}
            />
        );
    }

    const openMatches = matches.filter(m => {
        const seated = m.players.filter(p => p.name).length;
        return seated < m.players.length;
    });

    return (
        <div style={{ padding: '40px', fontFamily: '"Arial", sans-serif', maxWidth: '700px', margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <h1 style={{ color: '#2c3e50', textTransform: 'uppercase', letterSpacing: '2px', margin: 0 }}>
                            Michigan Rummy
                        </h1>
                        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', lineHeight: 1.1, color: '#888', fontSize: '0.55em', fontWeight: 'normal' }}>
                            <span><strong>L</strong>ott</span>
                            <span><strong>W</strong>ittbrodt</span>
                            <span><strong>D</strong>logolpolski</span>
                        </div>
                    </div>
                    <h2 style={{ color: '#666', fontWeight: 'normal', margin: '4px 0 0' }}>Online Lobby</h2>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '14px', color: '#888' }}>Playing as</div>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#2c3e50' }}>{playerName}</div>
                </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginBottom: '24px' }}>
                <button
                    onClick={() => setShowCreate(true)}
                    style={{
                        padding: '12px 24px', border: 'none', borderRadius: '8px',
                        background: '#27ae60', color: 'white', fontSize: '16px', fontWeight: 'bold',
                        cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '1px',
                    }}
                >Start a Table</button>
                <button
                    onClick={onBack}
                    style={{
                        padding: '12px 24px', border: '2px solid #ddd', borderRadius: '8px',
                        background: 'white', color: '#666', fontSize: '14px', fontWeight: 'bold',
                        cursor: 'pointer',
                    }}
                >Back</button>
            </div>

            {error && (
                <div style={{
                    padding: '10px 16px', background: '#fdecea', border: '1px solid #e74c3c',
                    borderRadius: '8px', color: '#c0392b', fontSize: '14px', marginBottom: '16px',
                }}>
                    {error}
                </div>
            )}

            {openMatches.length === 0 ? (
                <div style={{
                    padding: '40px', textAlign: 'center', color: '#888', fontSize: '16px',
                    background: '#f8f9fa', borderRadius: '12px',
                }}>
                    No open tables. Start one!
                </div>
            ) : (
                <div style={{ display: 'grid', gap: '16px', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
                    {openMatches.map(m => (
                        <TableCard
                            key={m.matchID}
                            match={m}
                            playerName={playerName}
                            onJoin={handleJoinTable}
                        />
                    ))}
                </div>
            )}

            {showCreate && (
                <CreateTableDialog
                    onCreateTable={handleCreateTable}
                    onCancel={() => setShowCreate(false)}
                />
            )}
        </div>
    );
};
