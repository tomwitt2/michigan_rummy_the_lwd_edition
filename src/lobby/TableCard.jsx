import React from 'react';

const RULE_LABELS = {
    allowAdjacentWilds: 'Adjacent wilds',
    allowLargeSets: 'Large sets',
    mustPlayDiscardPickup: 'Must play pickup',
    hintLayoff: 'Lay-off hints',
    hintSwapWild: 'Swap hints',
};

export const TableCard = ({ match, playerName, onJoin }) => {
    const { matchID, players, setupData } = match;
    const numPlayers = players.length;
    const seated = players.filter(p => p.name);
    const openSeats = numPlayers - seated.length;
    const rules = setupData?.rules || {};
    const enabledRules = Object.entries(rules).filter(([, v]) => v).map(([k]) => RULE_LABELS[k] || k);
    const alreadySeated = seated.some(p => p.name === playerName);

    return (
        <div style={{
            background: 'linear-gradient(135deg, #1a5c2a 0%, #2d8a4e 100%)',
            borderRadius: '12px',
            padding: '20px',
            color: 'white',
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            minWidth: '280px',
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontWeight: 'bold', fontSize: '16px' }}>
                    {setupData?.tableName || `Table ${matchID.slice(0, 6)}`}
                </span>
                <span style={{
                    background: openSeats > 0 ? 'rgba(255,255,255,0.2)' : 'rgba(231,76,60,0.6)',
                    padding: '3px 10px',
                    borderRadius: '12px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                }}>
                    {seated.length}/{numPlayers} players
                </span>
            </div>

            {/* Seat grid */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
                {players.map((p, i) => (
                    <div key={i} style={{
                        background: p.name ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.2)',
                        borderRadius: '6px',
                        padding: '4px 10px',
                        fontSize: '13px',
                        fontWeight: p.name ? 'bold' : 'normal',
                        fontStyle: p.name ? 'normal' : 'italic',
                        opacity: p.name ? 1 : 0.7,
                    }}>
                        {p.name || 'Empty'}
                    </div>
                ))}
            </div>

            {/* Rules summary */}
            {enabledRules.length > 0 && (
                <div style={{ fontSize: '11px', opacity: 0.8, marginBottom: '12px' }}>
                    Rules: {enabledRules.join(', ')}
                </div>
            )}

            {/* Join button */}
            {openSeats > 0 && !alreadySeated && (
                <button
                    onClick={() => onJoin(matchID)}
                    style={{
                        width: '100%',
                        padding: '10px',
                        border: '2px solid rgba(255,255,255,0.5)',
                        borderRadius: '8px',
                        background: 'rgba(255,255,255,0.15)',
                        color: 'white',
                        fontSize: '14px',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        textTransform: 'uppercase',
                        letterSpacing: '1px',
                    }}
                >Sit Down</button>
            )}
            {alreadySeated && (
                <div style={{ textAlign: 'center', fontSize: '13px', opacity: 0.7, fontStyle: 'italic' }}>
                    You are seated at this table
                </div>
            )}
        </div>
    );
};
