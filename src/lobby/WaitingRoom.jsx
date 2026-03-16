import React from 'react';
import { getMatch, joinMatch, leaveMatch } from './lobbyApi.js';

const AddBotDialog = ({ seatIndex, onConfirm, onCancel }) => {
    const [level, setLevel] = React.useState('advanced');
    const [delay, setDelay] = React.useState(2);

    return (
        <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
            <div style={{
                background: 'white', borderRadius: '12px', padding: '24px',
                maxWidth: '340px', width: '90%', fontFamily: '"Arial", sans-serif',
            }}>
                <h3 style={{ margin: '0 0 16px', color: '#2c3e50' }}>Add Bot to Seat {seatIndex}</h3>

                <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontWeight: 'bold', fontSize: '13px', color: '#555', marginBottom: '6px' }}>
                        Intelligence
                    </label>
                    <div style={{ display: 'flex', gap: '6px' }}>
                        {[['newbie', 'Newbie'], ['average', 'Average'], ['advanced', 'Advanced']].map(([val, label]) => (
                            <button
                                key={val}
                                onClick={() => setLevel(val)}
                                style={{
                                    flex: 1, padding: '8px 0', border: '2px solid',
                                    borderColor: val === level ? '#8e44ad' : '#ddd',
                                    borderRadius: '6px',
                                    background: val === level ? '#8e44ad' : 'white',
                                    color: val === level ? 'white' : '#333',
                                    fontSize: '13px', fontWeight: 'bold', cursor: 'pointer',
                                }}
                            >{label}</button>
                        ))}
                    </div>
                </div>

                <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', fontWeight: 'bold', fontSize: '13px', color: '#555', marginBottom: '6px' }}>
                        Playing Speed
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '12px', color: '#888' }}>Fast</span>
                        <input
                            type="range"
                            min={0} max={5} step={0.5}
                            value={delay}
                            onChange={(e) => setDelay(parseFloat(e.target.value))}
                            style={{ flex: 1, cursor: 'pointer' }}
                        />
                        <span style={{ fontSize: '12px', color: '#888' }}>Slow</span>
                        <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#555', minWidth: '30px', textAlign: 'right' }}>
                            {delay}s
                        </span>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                        onClick={onCancel}
                        style={{
                            flex: 1, padding: '10px', border: '2px solid #ddd', borderRadius: '8px',
                            background: 'white', color: '#666', fontSize: '14px', fontWeight: 'bold',
                            cursor: 'pointer',
                        }}
                    >Cancel</button>
                    <button
                        onClick={() => onConfirm({ level, delay })}
                        style={{
                            flex: 1, padding: '10px', border: 'none', borderRadius: '8px',
                            background: '#8e44ad', color: 'white', fontSize: '14px', fontWeight: 'bold',
                            cursor: 'pointer',
                        }}
                    >Add Bot</button>
                </div>
            </div>
        </div>
    );
};

export const WaitingRoom = ({ matchID, playerID, credentials, playerName, onGameStart, onLeave }) => {
    const [match, setMatch] = React.useState(null);
    const [error, setError] = React.useState(null);
    const botCredentialsRef = React.useRef({}); // { [playerID]: credentials }
    const botConfigsRef = React.useRef({});
    const [botConfigs, setBotConfigs] = React.useState({}); // { [playerID]: { level, delay } }
    const [addBotSeat, setAddBotSeat] = React.useState(null); // seat index for dialog

    // Sync botConfigs state to ref so polling effect always reads latest value
    React.useEffect(() => { botConfigsRef.current = botConfigs; }, [botConfigs]);

    const isCreator = playerID === '0';
    const players = match?.players || [];
    const seated = players.filter(p => p.name);
    // Poll match state
    React.useEffect(() => {
        let active = true;
        const poll = async () => {
            try {
                const data = await getMatch(matchID);
                if (!active) return;
                setMatch(data);
                setError(null);

                // Auto-start when all seats filled
                const filledCount = data.players.filter(p => p.name).length;
                if (filledCount === data.players.length) {
                    onGameStart(data, botCredentialsRef.current, botConfigsRef.current);
                }
            } catch (err) {
                if (active) setError(err.message);
            }
        };
        poll();
        const interval = setInterval(poll, 2000);
        return () => { active = false; clearInterval(interval); };
    }, [matchID, onGameStart]);

    const handleLeave = async () => {
        try {
            await leaveMatch(matchID, { playerID, credentials });
        } catch (err) {
            // Ignore leave errors — might already be removed
        }
        onLeave();
    };

    const handleFillBot = async (seatIndex, config) => {
        try {
            const { playerCredentials } = await joinMatch(matchID, {
                playerID: String(seatIndex),
                playerName: `Bot ${seatIndex}`,
            });
            botCredentialsRef.current[String(seatIndex)] = playerCredentials;
            setBotConfigs(prev => ({ ...prev, [String(seatIndex)]: config }));
        } catch (err) {
            setError(`Failed to add bot: ${err.message}`);
        }
    };

    if (!match) {
        return (
            <div style={{ padding: '40px', fontFamily: '"Arial", sans-serif', textAlign: 'center' }}>
                <h2 style={{ color: '#2c3e50' }}>Loading table...</h2>
                {error && <p style={{ color: '#e74c3c' }}>{error}</p>}
            </div>
        );
    }

    const setupData = match.setupData || {};

    return (
        <div style={{ padding: '40px', fontFamily: '"Arial", sans-serif', maxWidth: '500px', margin: '0 auto', textAlign: 'center' }}>
            <h1 style={{ color: '#2c3e50', textTransform: 'uppercase', letterSpacing: '2px' }}>Michigan Rummy</h1>
            <h2 style={{ color: '#666', fontWeight: 'normal' }}>
                {setupData.tableName || `Table ${matchID.slice(0, 6)}`}
            </h2>

            <div style={{ fontSize: '14px', color: '#888', marginBottom: '20px' }}>
                Waiting for players... ({seated.length}/{players.length})
            </div>

            {/* Seat visualization */}
            <div style={{
                background: 'linear-gradient(135deg, #1a5c2a 0%, #2d8a4e 100%)',
                borderRadius: '16px',
                padding: '24px',
                marginBottom: '24px',
            }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {players.map((p, i) => (
                        <div key={i} style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            background: p.name ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)',
                            borderRadius: '8px',
                            padding: '12px 16px',
                        }}>
                            <span style={{
                                width: '28px', height: '28px', borderRadius: '50%',
                                background: p.name ? '#27ae60' : 'rgba(255,255,255,0.1)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: 'white', fontWeight: 'bold', fontSize: '13px',
                                border: '2px solid rgba(255,255,255,0.3)',
                            }}>
                                {i}
                            </span>
                            <span style={{
                                flex: 1, color: 'white', fontSize: '15px',
                                fontWeight: p.name ? 'bold' : 'normal',
                                fontStyle: p.name ? 'normal' : 'italic',
                                opacity: p.name ? 1 : 0.6,
                                textAlign: 'left',
                            }}>
                                {p.name || 'Waiting for player...'}
                            </span>
                            {botConfigs[String(i)] && (
                                <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)' }}>
                                    {botConfigs[String(i)].level} / {botConfigs[String(i)].delay}s
                                </span>
                            )}
                            {isCreator && !p.name && (
                                <button
                                    onClick={() => setAddBotSeat(i)}
                                    style={{
                                        padding: '5px 12px',
                                        border: '1px solid rgba(255,255,255,0.4)',
                                        borderRadius: '6px',
                                        background: 'rgba(255,255,255,0.1)',
                                        color: 'white',
                                        fontSize: '12px',
                                        cursor: 'pointer',
                                        fontWeight: 'bold',
                                    }}
                                >+ Bot</button>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Rules summary */}
            {setupData.rules && (() => {
                const enabled = Object.entries(setupData.rules).filter(([, v]) => v);
                if (enabled.length === 0) return null;
                return (
                    <div style={{ fontSize: '13px', color: '#888', marginBottom: '20px', textAlign: 'left' }}>
                        <strong>Rules:</strong>{' '}
                        {enabled.map(([k]) => {
                            const labels = {
                                allowAdjacentWilds: 'Adjacent wilds',
                                allowLargeSets: 'Large sets',
                                mustPlayDiscardPickup: 'Must play pickup',
                                hintLayoff: 'Lay-off hints',
                                hintSwapWild: 'Swap hints',
                            };
                            return labels[k] || k;
                        }).join(', ')}
                    </div>
                );
            })()}

            {error && <p style={{ color: '#e74c3c', fontSize: '13px' }}>{error}</p>}

            <button
                onClick={handleLeave}
                style={{
                    padding: '12px 24px', border: '2px solid #e74c3c', borderRadius: '8px',
                    background: 'white', color: '#e74c3c', fontSize: '14px', fontWeight: 'bold',
                    cursor: 'pointer',
                }}
            >Leave Table</button>

            {addBotSeat !== null && (
                <AddBotDialog
                    seatIndex={addBotSeat}
                    onConfirm={(config) => {
                        handleFillBot(addBotSeat, config);
                        setAddBotSeat(null);
                    }}
                    onCancel={() => setAddBotSeat(null)}
                />
            )}
        </div>
    );
};
