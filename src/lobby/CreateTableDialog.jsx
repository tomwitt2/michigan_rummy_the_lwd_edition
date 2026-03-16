import React from 'react';

const defaultRules = {
    allowAdjacentWilds: false,
    allowLargeSets: false,
    mustPlayDiscardPickup: false,
    hintLayoff: false,
    hintSwapWild: false,
};

export const CreateTableDialog = ({ onCreateTable, onCancel }) => {
    const [numPlayers, setNumPlayers] = React.useState(4);
    const [tableName, setTableName] = React.useState('');
    const [rules, setRules] = React.useState(defaultRules);

    const handleCreate = () => {
        onCreateTable({
            numPlayers,
            setupData: {
                tableName: tableName.trim() || undefined,
                rules,
            },
        });
    };

    return (
        <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
            <div style={{
                background: 'white', borderRadius: '12px', padding: '30px',
                maxWidth: '450px', width: '90%', maxHeight: '80vh', overflow: 'auto',
                fontFamily: '"Arial", sans-serif',
            }}>
                <h2 style={{ margin: '0 0 20px', color: '#2c3e50' }}>Start a Table</h2>

                <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontWeight: 'bold', fontSize: '14px', color: '#555', marginBottom: '6px' }}>
                        Table Name (optional)
                    </label>
                    <input
                        type="text"
                        value={tableName}
                        onChange={e => setTableName(e.target.value)}
                        placeholder="e.g. Family Game Night"
                        maxLength={30}
                        style={{
                            width: '100%', padding: '10px 12px', border: '2px solid #ddd', borderRadius: '8px',
                            fontSize: '14px', outline: 'none', boxSizing: 'border-box',
                        }}
                    />
                </div>

                <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontWeight: 'bold', fontSize: '14px', color: '#555', marginBottom: '6px' }}>
                        Number of Seats
                    </label>
                    <div style={{ display: 'flex', gap: '6px' }}>
                        {[2, 3, 4, 5, 6, 7, 8].map(n => (
                            <button
                                key={n}
                                onClick={() => setNumPlayers(n)}
                                style={{
                                    flex: 1, padding: '10px 0', border: '2px solid',
                                    borderColor: n === numPlayers ? '#27ae60' : '#ddd',
                                    borderRadius: '8px',
                                    background: n === numPlayers ? '#27ae60' : 'white',
                                    color: n === numPlayers ? 'white' : '#333',
                                    fontSize: '16px', fontWeight: 'bold', cursor: 'pointer',
                                }}
                            >{n}</button>
                        ))}
                    </div>
                </div>

                <div style={{ background: '#f8f9fa', padding: '16px', borderRadius: '10px', marginBottom: '20px' }}>
                    <h3 style={{ margin: '0 0 12px', fontSize: '14px', color: '#555' }}>Rules</h3>
                    {[
                        ['allowAdjacentWilds', 'Allow adjacent wild cards in runs'],
                        ['allowLargeSets', 'Allow sets larger than 4 cards (multi-deck)'],
                        ['mustPlayDiscardPickup', 'Discard pickup must be played immediately'],
                        ['hintLayoff', 'Lay Off button hinting'],
                        ['hintSwapWild', 'Wild Swap button hinting'],
                    ].map(([key, label]) => (
                        <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '13px', marginTop: '8px' }}>
                            <input
                                type="checkbox"
                                checked={rules[key]}
                                onChange={e => setRules({ ...rules, [key]: e.target.checked })}
                                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                            />
                            {label}
                        </label>
                    ))}
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                        onClick={onCancel}
                        style={{
                            flex: 1, padding: '12px', border: '2px solid #ddd', borderRadius: '8px',
                            background: 'white', color: '#666', fontSize: '14px', fontWeight: 'bold',
                            cursor: 'pointer',
                        }}
                    >Cancel</button>
                    <button
                        onClick={handleCreate}
                        style={{
                            flex: 1, padding: '12px', border: 'none', borderRadius: '8px',
                            background: '#27ae60', color: 'white', fontSize: '14px', fontWeight: 'bold',
                            cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '1px',
                        }}
                    >Create Table</button>
                </div>
            </div>
        </div>
    );
};
