import React from 'react';

const STORAGE_KEY = 'lwd-rummy-player-name';

export const PlayerIdentity = ({ onReady }) => {
    const [name, setName] = React.useState(() => localStorage.getItem(STORAGE_KEY) || '');

    const handleSubmit = (e) => {
        e.preventDefault();
        const trimmed = name.trim();
        if (!trimmed) return;
        localStorage.setItem(STORAGE_KEY, trimmed);
        onReady(trimmed);
    };

    return (
        <div style={{ padding: '40px', fontFamily: '"Arial", sans-serif', maxWidth: '400px', margin: '0 auto', textAlign: 'center' }}>
            <h1 style={{ color: '#2c3e50', textTransform: 'uppercase', letterSpacing: '2px' }}>Michigan Rummy</h1>
            <h2 style={{ color: '#666', fontWeight: 'normal' }}>Online Play</h2>
            <form onSubmit={handleSubmit} style={{ marginTop: '30px' }}>
                <label style={{ display: 'block', marginBottom: '10px', fontSize: '14px', color: '#555', fontWeight: 'bold' }}>
                    Enter your name to join the lobby
                </label>
                <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Your name"
                    maxLength={25}
                    autoFocus
                    style={{
                        width: '100%', padding: '12px 16px', border: '2px solid #ddd', borderRadius: '8px',
                        fontSize: '16px', outline: 'none', boxSizing: 'border-box',
                    }}
                    onFocus={e => e.target.style.borderColor = '#3498db'}
                    onBlur={e => e.target.style.borderColor = '#ddd'}
                />
                <button
                    type="submit"
                    disabled={!name.trim()}
                    style={{
                        width: '100%', padding: '12px', border: 'none', borderRadius: '8px',
                        background: name.trim() ? '#27ae60' : '#ddd', color: name.trim() ? 'white' : '#999',
                        fontSize: '16px', fontWeight: 'bold', cursor: name.trim() ? 'pointer' : 'default',
                        marginTop: '12px', textTransform: 'uppercase', letterSpacing: '1px',
                    }}
                >Enter Lobby</button>
            </form>
        </div>
    );
};
