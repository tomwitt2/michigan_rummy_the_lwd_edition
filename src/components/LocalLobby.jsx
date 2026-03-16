import React from 'react';
import { pickBotNames } from '../bot/botNames.js';
import { loadReplayFile } from '../replay/replayStorage.js';

export const LocalLobby = ({ onStart, onReplay }) => {
    const fileInputRef = React.useRef(null);
    const [players, setPlayers] = React.useState([
        { name: '', isBot: false, botLevel: 'advanced' },
        { name: '', isBot: false, botLevel: 'advanced' },
    ]);
    const [rules, setRules] = React.useState({ allowAdjacentWilds: false, allowLargeSets: false, mustPlayDiscardPickup: false, hintLayoff: false, hintSwapWild: false });
    const [botDelay, setBotDelay] = React.useState(2);
    const [devSeed, setDevSeed] = React.useState('');

    const addPlayer = () => {
        if (players.length < 8) setPlayers([...players, { name: '', isBot: false, botLevel: 'advanced' }]);
    };
    const removePlayer = (idx) => {
        if (players.length > 2) setPlayers(players.filter((_, i) => i !== idx));
    };
    const updateName = (idx, name) => {
        setPlayers(players.map((p, i) => i === idx ? { ...p, name } : p));
    };
    const toggleBot = (idx) => {
        setPlayers(players.map((p, i) => {
            if (i !== idx) return p;
            const isBot = !p.isBot;
            const usedNames = players.filter((pp, j) => j !== idx && pp.isBot).map(pp => pp.name);
            const name = isBot ? pickBotNames(1, usedNames)[0] || `Bot ${idx}` : '';
            return { ...p, isBot, name, botLevel: p.botLevel || 'average' };
        }));
    };
    const setBotLevel = (idx, level) => {
        setPlayers(players.map((p, i) => i === idx ? { ...p, botLevel: level } : p));
    };
    const fillWithBots = () => {
        const usedNames = players.filter(p => p.isBot).map(p => p.name);
        const humanNames = players.filter(p => !p.isBot && p.name.trim()).map(p => p.name.trim());
        // Fill empty slots, ensure at least 4 players
        let newPlayers = [...players];
        while (newPlayers.length < 4) {
            newPlayers.push({ name: '', isBot: false, botLevel: 'advanced' });
        }
        const botsNeeded = [];
        newPlayers.forEach((p, i) => {
            if (!p.isBot && !p.name.trim()) botsNeeded.push(i);
        });
        const names = pickBotNames(botsNeeded.length, [...usedNames, ...humanNames]);
        botsNeeded.forEach((idx, j) => {
            newPlayers[idx] = { name: names[j] || `Bot ${idx}`, isBot: true, botLevel: 'advanced' };
        });
        setPlayers(newPlayers);
    };

    const hasBots = players.some(p => p.isBot);

    return (
        <div style={{ padding: '40px', fontFamily: '"Arial", sans-serif', maxWidth: '500px', margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <h1 style={{ color: '#2c3e50', textTransform: 'uppercase', letterSpacing: '2px', textAlign: 'center', margin: 0 }}>
                    Michigan Rummy
                </h1>
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', lineHeight: 1.1, color: '#888', fontSize: '0.55em', fontWeight: 'normal' }}>
                    <span><strong>L</strong>ott</span>
                    <span><strong>W</strong>ittbrodt</span>
                    <span><strong>D</strong>logolpolski</span>
                </div>
            </div>
            <h2 style={{ color: '#666', textAlign: 'center', fontWeight: 'normal' }}>Game Setup</h2>

            <div style={{ background: '#f8f9fa', padding: '20px', borderRadius: '10px', marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '15px' }}>
                    <h3 style={{ margin: 0 }}>Players ({players.length})
                        {(() => { const d = Math.ceil(players.length / 5); return (
                            <span style={{ fontWeight: 'normal', fontSize: '12px', color: '#888', marginLeft: '8px' }}>
                                {d} {d === 1 ? 'deck' : 'decks'} ({d * 52} cards)
                            </span>
                        ); })()}
                    </h3>
                    <button
                        onClick={fillWithBots}
                        style={{
                            padding: '5px 12px', border: '1px solid #8e44ad', borderRadius: '6px',
                            background: '#f5eef8', color: '#8e44ad', cursor: 'pointer', fontSize: '12px',
                            fontWeight: 'bold',
                        }}
                    >Fill with Bots</button>
                </div>
                {players.map((p, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                        <span style={{ width: '24px', fontWeight: 'bold', color: '#999', textAlign: 'right' }}>{i}</span>
                        <input
                            type="text"
                            placeholder={`Player ${i}`}
                            value={p.name}
                            onChange={(e) => updateName(i, e.target.value)}
                            maxLength={25}
                            readOnly={p.isBot}
                            style={{
                                flex: 1, padding: '8px 12px', border: '1px solid #ddd', borderRadius: '6px',
                                fontSize: '14px', outline: 'none',
                                background: p.isBot ? '#f5eef8' : 'white',
                                color: p.isBot ? '#8e44ad' : 'inherit',
                            }}
                            onFocus={(e) => e.target.style.borderColor = '#3498db'}
                            onBlur={(e) => e.target.style.borderColor = '#ddd'}
                        />
                        <label
                            title="Toggle bot"
                            style={{
                                display: 'flex', alignItems: 'center', gap: '3px', cursor: 'pointer',
                                fontSize: '11px', color: p.isBot ? '#8e44ad' : '#aaa', fontWeight: 'bold',
                                whiteSpace: 'nowrap',
                            }}
                        >
                            <input
                                type="checkbox"
                                checked={p.isBot}
                                onChange={() => toggleBot(i)}
                                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                            />
                            Bot
                        </label>
                        {p.isBot && (
                            <select
                                value={p.botLevel}
                                onChange={(e) => setBotLevel(i, e.target.value)}
                                style={{
                                    padding: '4px 6px', border: '1px solid #ccc', borderRadius: '4px',
                                    fontSize: '12px', background: 'white', cursor: 'pointer',
                                }}
                            >
                                <option value="newbie">Newbie</option>
                                <option value="average">Average</option>
                                <option value="advanced">Advanced</option>
                            </select>
                        )}
                        {players.length > 2 && (
                            <button
                                onClick={() => removePlayer(i)}
                                style={{
                                    width: '30px', height: '30px', borderRadius: '50%', border: 'none',
                                    background: '#e74c3c', color: 'white', cursor: 'pointer', fontSize: '16px',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold',
                                }}
                            >-</button>
                        )}
                    </div>
                ))}
                {players.length < 8 && (
                    <button
                        onClick={addPlayer}
                        style={{
                            width: '100%', padding: '8px', border: '2px dashed #bbb', borderRadius: '6px',
                            background: 'transparent', cursor: 'pointer', fontSize: '14px', color: '#888',
                            marginTop: '4px',
                        }}
                    >+ Add Player</button>
                )}

                {hasBots && (
                    <div style={{ marginTop: '12px', padding: '10px', background: '#fff', borderRadius: '6px', border: '1px solid #e8daef' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: '#555' }}>
                            <span style={{ fontWeight: 'bold', whiteSpace: 'nowrap' }}>Bot Delay:</span>
                            <input
                                type="range"
                                min={0} max={7} step={0.5}
                                value={botDelay}
                                onChange={(e) => setBotDelay(parseFloat(e.target.value))}
                                style={{ flex: 1, cursor: 'pointer' }}
                            />
                            <span style={{ minWidth: '30px', textAlign: 'right', fontWeight: 'bold' }}>{botDelay}s</span>
                        </label>
                    </div>
                )}
            </div>

            <div style={{ background: '#f8f9fa', padding: '20px', borderRadius: '10px', marginBottom: '20px' }}>
                <h3 style={{ margin: '0 0 15px 0' }}>Rules</h3>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '14px' }}>
                    <input
                        type="checkbox"
                        checked={rules.allowAdjacentWilds}
                        onChange={(e) => setRules({ ...rules, allowAdjacentWilds: e.target.checked })}
                        style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                    Allow adjacent wild cards in runs
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '14px', marginTop: '10px' }}>
                    <input
                        type="checkbox"
                        checked={rules.allowLargeSets}
                        onChange={(e) => setRules({ ...rules, allowLargeSets: e.target.checked })}
                        style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                    Allow sets larger than 4 cards (multi-deck)
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '14px', marginTop: '10px' }}>
                    <input
                        type="checkbox"
                        checked={rules.mustPlayDiscardPickup}
                        onChange={(e) => setRules({ ...rules, mustPlayDiscardPickup: e.target.checked })}
                        style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                    Discard pickup must be played immediately (meld, lay off, or swap wild)
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '14px', marginTop: '10px' }}>
                    <input
                        type="checkbox"
                        checked={rules.hintLayoff}
                        onChange={(e) => setRules({ ...rules, hintLayoff: e.target.checked })}
                        style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                    Lay Off button hinting (highlights when a lay off is possible)
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '14px', marginTop: '10px' }}>
                    <input
                        type="checkbox"
                        checked={rules.hintSwapWild}
                        onChange={(e) => setRules({ ...rules, hintSwapWild: e.target.checked })}
                        style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                    Wild Swap button hinting (highlights when a swap is possible)
                </label>
            </div>

            <button
                onClick={() => {
                    const playerNames = {};
                    players.forEach((p, i) => {
                        if (p.name.trim()) playerNames[i] = p.name.trim();
                    });
                    const bots = {};
                    players.forEach((p, i) => {
                        if (p.isBot) bots[String(i)] = { level: p.botLevel };
                    });
                    onStart({ numPlayers: players.length, playerNames, rules, bots, botDelay, seed: devSeed || undefined });
                }}
                style={{
                    width: '100%', padding: '14px', border: 'none', borderRadius: '8px',
                    background: '#27ae60', color: 'white', fontSize: '18px', fontWeight: 'bold',
                    cursor: 'pointer', letterSpacing: '1px', textTransform: 'uppercase',
                }}
            >Start Game</button>

            {import.meta.env.DEV && (
                <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
                    <input
                        type="text"
                        placeholder="Seed (optional)"
                        value={devSeed}
                        onChange={(e) => setDevSeed(e.target.value.trim())}
                        style={{
                            flex: 1, padding: '8px 12px', border: '2px dashed #888', borderRadius: '8px',
                            fontSize: '13px', color: '#555', outline: 'none',
                        }}
                    />
                    {onReplay && (
                        <>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".json"
                                style={{ display: 'none' }}
                                onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;
                                    try {
                                        const data = await loadReplayFile(file);
                                        onReplay(data);
                                    } catch (err) {
                                        alert('Failed to load replay: ' + err.message);
                                    }
                                    e.target.value = '';
                                }}
                            />
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                style={{
                                    padding: '8px 16px', border: '2px dashed #888', borderRadius: '8px',
                                    background: 'transparent', color: '#888', fontSize: '13px', fontWeight: 'bold',
                                    cursor: 'pointer', whiteSpace: 'nowrap',
                                }}
                            >Replay</button>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};
