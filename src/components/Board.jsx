import React from 'react';
import { isWild, isValidSet, isValidRun, analyzeRun, RANKS } from '../game/logic';
import { buildReplayData, downloadReplay } from '../replay/replayStorage.js';
import { Card, SUIT_ICONS, SUIT_COLORS, getInferredRank } from './Card.jsx';
import { ErrorBoundary } from './ErrorBoundary.jsx';

const TableRing = ({ numPlayers, currentPlayer, playerID, playerNames, dealer, firstPlayer }) => {
    const size = 110;
    const center = size / 2;
    const radius = 38;
    const viewerIdx = parseInt(playerID);

    const players = Array.from({ length: numPlayers }, (_, i) => {
        // Offset so the viewer is always at the bottom (6 o'clock)
        const offset = (i - viewerIdx + numPlayers) % numPlayers;
        // Start at bottom (PI/2) and go clockwise
        const angle = (offset / numPlayers) * 2 * Math.PI + Math.PI / 2;
        const x = center + radius * Math.cos(angle);
        const y = center + radius * Math.sin(angle);
        const isActive = String(i) === String(currentPlayer);
        const isViewer = i === viewerIdx;
        const isDealer = dealer != null && i === dealer;
        const isFirst = firstPlayer != null && i === firstPlayer;
        const label = playerNames?.[i]?.[0]?.toUpperCase() || String(i);

        return { x, y, isActive, isViewer, isDealer, isFirst, label, id: i };
    });

    return (
        <div style={{ position: 'relative', width: `${size}px`, height: `${size}px`, flexShrink: 0 }}>
            {/* Ring circle */}
            <svg width={size} height={size} style={{ position: 'absolute', top: 0, left: 0 }}>
                <circle cx={center} cy={center} r={radius} fill="none" stroke="#ddd" strokeWidth="2" />
            </svg>
            {/* Player dots */}
            {players.map(p => (
                <div key={p.id} style={{
                    position: 'absolute',
                    left: `${p.x - 14}px`,
                    top: `${p.y - 14}px`,
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '13px',
                    fontWeight: 'bold',
                    color: p.isActive ? 'white' : (p.isViewer ? '#2c3e50' : '#666'),
                    background: p.isActive ? '#f39c12' : (p.isViewer ? '#d5e8f0' : '#ecf0f1'),
                    border: p.isActive ? '2px solid #e67e22' : (p.isViewer ? '2px solid #3498db' : '1px solid #bdc3c7'),
                    boxShadow: p.isActive ? '0 0 10px #f39c12' : 'none',
                    transition: 'all 0.3s ease',
                    zIndex: 2,
                }} title={playerNames?.[p.id] || `Player ${p.id}`}>
                    {p.label}
                    {p.isFirst && (
                        <div style={{
                            position: 'absolute', top: '-10px', left: '50%', transform: 'translateX(-50%)',
                            width: '16px', height: '16px', zIndex: 3,
                        }}>
                            <svg viewBox="0 0 16 16" width="16" height="16">
                                <rect x="1" y="2" width="14" height="12" rx="2" fill="#27ae60" stroke="#1e8449" strokeWidth="0.8" />
                                <text x="8" y="9.5" textAnchor="middle" fontSize="7" fontWeight="bold" fill="white">1</text>
                            </svg>
                        </div>
                    )}
                    {p.isDealer && (
                        <div style={{
                            position: 'absolute', bottom: '-10px', left: '50%', transform: 'translateX(-50%)',
                            width: '16px', height: '16px', zIndex: 3,
                        }}>
                            <svg viewBox="0 0 16 16" width="16" height="16">
                                <rect x="1" y="2" width="14" height="12" rx="2" fill="#e74c3c" stroke="#c0392b" strokeWidth="0.8" />
                                <text x="8" y="9.5" textAnchor="middle" fontSize="7" fontWeight="bold" fill="white">D</text>
                            </svg>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
};

const ORDINAL_LABELS = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'];

const Scoreboard = ({ G, numPlayers, playerNames, currentPlayer, onRename, editingNameId, nameInputRef, onCommitName, onCancelEdit }) => {
    const rounds = RANKS; // A through K (13 rounds)
    const isGameOver = G.scoreHistory?.length >= 13;

    // Compute final rankings (lower score = better rank)
    const rankings = React.useMemo(() => {
        if (!isGameOver) return null;
        const scores = Array.from({ length: numPlayers }).map((_, i) => ({ id: i, score: G.players[i].score }));
        scores.sort((a, b) => a.score - b.score);
        const rankMap = {};
        let rank = 0;
        for (let j = 0; j < scores.length; j++) {
            if (j > 0 && scores[j].score !== scores[j - 1].score) rank = j;
            rankMap[scores[j].id] = rank;
        }
        return rankMap;
    }, [isGameOver, numPlayers, G.players]);

    return (
        <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', textAlign: 'center', fontSize: '14px', width: '100%' }}>
                <thead>
                    <tr style={{ background: '#f8f9fa' }}>
                        <th style={{ border: '1px solid #ddd', padding: '8px' }}>Rd</th>
                        {Array.from({ length: numPlayers }).map((_, i) => {
                            const isActive = !isGameOver && String(i) === String(currentPlayer);
                            const isWinner = isGameOver && rankings?.[i] === 0;
                            return (
                                <th key={i} style={{
                                    border: '1px solid #ddd', padding: '8px',
                                    background: isWinner ? '#fff8e1' : isActive ? '#fff3cd' : undefined,
                                    boxShadow: isWinner ? 'inset 0 3px 0 #f1c40f' : isActive ? 'inset 0 3px 0 #f39c12' : 'none',
                                }}>
                                    {editingNameId === String(i) ? (
                                        <input
                                            ref={nameInputRef}
                                            defaultValue={playerNames?.[i] || `Player ${i}`}
                                            maxLength={25}
                                            onBlur={() => onCommitName(i)}
                                            onKeyDown={e => {
                                                e.stopPropagation();
                                                if (e.key === 'Enter') onCommitName(i);
                                                if (e.key === 'Escape') onCancelEdit();
                                            }}
                                            style={{ fontSize: '13px', fontWeight: 'bold', border: '2px solid #3498db', borderRadius: '4px', padding: '2px 4px', width: '90px', textAlign: 'center' }}
                                        />
                                    ) : (
                                        <span style={{
                                            color: isWinner ? '#d4a017' : isActive ? '#e67e22' : undefined,
                                            fontWeight: 'bold',
                                            cursor: onRename ? 'text' : 'default',
                                            borderBottom: onRename ? '2px dashed transparent' : 'none',
                                        }}
                                            onClick={() => onRename?.(i)}
                                            onMouseEnter={e => { if (onRename) e.target.style.borderBottomColor = '#aaa'; }}
                                            onMouseLeave={e => { if (onRename) e.target.style.borderBottomColor = 'transparent'; }}
                                            title={onRename ? 'Click to rename' : ''}
                                        >
                                            {isWinner ? '🏆 ' : ''}{playerNames?.[i] || `Player ${i}`}
                                        </span>
                                    )}
                                    <div style={{ fontSize: '10px', fontWeight: 'normal', color: '#888' }}>
                                        {G.players[i]?.hand?.length ?? '?'} cards
                                    </div>
                                </th>
                            );
                        })}
                    </tr>
                </thead>
                <tbody>
                    {rounds.map((rank, roundIdx) => {
                        const isCurrentRound = G.round === roundIdx;
                        const roundHistory = G.scoreHistory?.find(h => h.round === roundIdx);
                        const dealerId = roundIdx % numPlayers;

                        return (
                            <tr key={roundIdx} style={{ background: isCurrentRound && !isGameOver ? '#fff9c4' : 'transparent' }}>
                                <td style={{ border: '1px solid #ddd', padding: '5px', fontWeight: 'bold' }}>
                                    {rank} <span style={{ fontSize: '10px', color: '#999' }} title="Dealer">({playerNames?.[dealerId]?.[0] || dealerId})</span>
                                </td>
                                {Array.from({ length: numPlayers }).map((_, pId) => {
                                    let runningTotal = 0;
                                    // Calculate running total up to this round
                                    for (let i = 0; i <= roundIdx; i++) {
                                        const h = G.scoreHistory?.find(hist => hist.round === i);
                                        if (h) runningTotal += h.scores[pId] || 0;
                                    }

                                    const roundScore = roundHistory?.scores[pId];
                                    const isRoundWinner = roundHistory?.winner === String(pId);

                                    return (
                                        <td key={pId} style={{ border: '1px solid #ddd', padding: '5px', position: 'relative' }}>
                                            {roundHistory ? (
                                                <>
                                                    <span style={{ fontSize: '16px' }}>{runningTotal}</span>
                                                    <sup style={{ color: '#e74c3c', marginLeft: '2px', fontWeight: 'bold' }}>
                                                        {isRoundWinner ? <span style={{ color: '#27ae60', fontWeight: 'bold' }}>0</span> : `+${roundScore}`}
                                                    </sup>
                                                </>
                                            ) : (
                                                isCurrentRound && !isGameOver ? '...' : ''
                                            )}
                                        </td>
                                    );
                                })}
                            </tr>
                        );
                    })}
                </tbody>
                <tfoot>
                    <tr style={{ background: '#eee', fontWeight: 'bold' }}>
                        <td style={{ border: '1px solid #ddd', padding: '8px' }}>Total</td>
                        {Array.from({ length: numPlayers }).map((_, i) => {
                            const isWinner = isGameOver && rankings?.[i] === 0;
                            const rank = rankings?.[i];
                            return (
                                <td key={i} style={{
                                    border: '1px solid #ddd', padding: '8px', fontSize: '18px',
                                    background: isWinner ? '#fff8e1' : undefined,
                                    color: isWinner ? '#d4a017' : undefined,
                                }}>
                                    {G.players[i].score}
                                    {isGameOver && rank != null && (
                                        <div style={{
                                            display: 'inline-block', marginLeft: '6px',
                                            padding: '1px 6px', borderRadius: '10px', fontSize: '10px',
                                            fontWeight: 'bold', verticalAlign: 'middle',
                                            background: rank === 0 ? '#f1c40f' : rank === 1 ? '#bdc3c7' : rank === 2 ? '#cd7f32' : '#e0e0e0',
                                            color: rank <= 2 ? 'white' : '#666',
                                        }}>
                                            {ORDINAL_LABELS[rank] || `${rank + 1}th`}
                                        </div>
                                    )}
                                </td>
                            );
                        })}
                    </tr>
                </tfoot>
            </table>
        </div>
    );
};

const ChatPanel = ({ messages, onSend, numPlayers, getPlayerName, currentPlayer, chatInputRef, readOnly, bullets, onDeleteBullet }) => {
    const scrollRef = React.useRef(null);
    const [chatPlayerID, setChatPlayerID] = React.useState(currentPlayer);
    const [isBullet, setIsBullet] = React.useState(false);

    // Update default sender when current player changes
    React.useEffect(() => { setChatPlayerID(currentPlayer); }, [currentPlayer]);

    // Auto-scroll to bottom on new messages
    React.useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, [messages.length]);

    // Count bullets for the currently selected sender
    const senderBulletCount = (bullets || []).filter(b => b.playerID === chatPlayerID).length;
    const bulletLimitReached = senderBulletCount >= 3;

    // Turn off bullet toggle if limit reached
    React.useEffect(() => {
        if (bulletLimitReached && isBullet) setIsBullet(false);
    }, [bulletLimitReached, isBullet]);

    const handleSubmit = (e) => {
        e.preventDefault();
        const text = chatInputRef.current?.value?.trim();
        if (!text) return;
        onSend(chatPlayerID, text, isBullet);
        chatInputRef.current.value = '';
    };

    // Group bullets by player for the bullet list display
    const bulletsByPlayer = {};
    (bullets || []).forEach(b => {
        if (!bulletsByPlayer[b.playerID]) bulletsByPlayer[b.playerID] = [];
        bulletsByPlayer[b.playerID].push(b);
    });

    return (
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: '16px', borderTop: '1px solid #ddd', paddingTop: '10px' }}>
            <h4 style={{ margin: '0 0 6px', fontSize: '13px', color: '#555' }}>Chat</h4>
            <div ref={scrollRef} style={{
                flex: 1, minHeight: '80px', maxHeight: '200px', overflowY: 'auto',
                background: '#fff', border: '1px solid #ddd', borderRadius: '4px',
                padding: '6px', fontSize: '12px',
            }}>
                {messages.length === 0 && <div style={{ color: '#bbb', fontStyle: 'italic' }}>No messages yet</div>}
                {messages.map(msg => (
                    <div key={msg.id} style={{
                        marginBottom: '4px',
                        ...(msg.isBullet ? { background: '#fef9e7', borderLeft: '3px solid #f39c12', paddingLeft: '5px', borderRadius: '2px' } : {}),
                    }}>
                        {msg.isBullet && <span style={{ marginRight: '4px' }} title="Bullet">&#x2022;</span>}
                        <span style={{ fontWeight: 'bold', color: '#2c3e50' }}>{msg.playerName}</span>
                        <span style={{ color: '#999', fontSize: '10px', marginLeft: '4px' }}>R{msg.round + 1}</span>
                        <span style={{ marginLeft: '6px' }}>{msg.text}</span>
                    </div>
                ))}
            </div>
            {!readOnly && (
                <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '4px', marginTop: '6px', alignItems: 'center' }}>
                    <select
                        value={chatPlayerID}
                        onChange={e => setChatPlayerID(e.target.value)}
                        style={{ padding: '3px 4px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '12px', width: '70px' }}
                    >
                        {Array.from({ length: numPlayers }).map((_, i) => (
                            <option key={i} value={String(i)}>{getPlayerName(String(i))}</option>
                        ))}
                    </select>
                    <input
                        ref={chatInputRef}
                        type="text"
                        placeholder={isBullet ? 'Enter a bullet... (t)' : 'Type a message... (t)'}
                        maxLength={200}
                        onKeyDown={e => e.stopPropagation()}
                        style={{
                            flex: 1, padding: '3px 6px', borderRadius: '4px', fontSize: '12px',
                            border: isBullet ? '1px solid #f39c12' : '1px solid #ccc',
                            background: isBullet ? '#fef9e7' : '#fff',
                        }}
                    />
                    <button
                        type="button"
                        title={bulletLimitReached ? `${getPlayerName(chatPlayerID)} has used all 3 bullets` : 'Toggle bullet mode'}
                        onClick={() => { if (!bulletLimitReached) setIsBullet(b => !b); }}
                        style={{
                            padding: '3px 8px', borderRadius: '4px', border: 'none', cursor: bulletLimitReached ? 'not-allowed' : 'pointer',
                            fontSize: '14px', fontWeight: 'bold', lineHeight: 1,
                            background: isBullet ? '#f39c12' : '#e0e0e0',
                            color: isBullet ? 'white' : (bulletLimitReached ? '#bbb' : '#555'),
                            opacity: bulletLimitReached && !isBullet ? 0.5 : 1,
                        }}
                    >&#x2022;</button>
                    <button type="submit" style={{
                        padding: '3px 10px', borderRadius: '4px', border: 'none',
                        background: isBullet ? '#f39c12' : '#3498db', color: 'white', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold',
                    }}>{isBullet ? 'Add' : 'Send'}</button>
                </form>
            )}
            {(bullets || []).length > 0 && (
                <div style={{ marginTop: '10px', borderTop: '1px solid #ddd', paddingTop: '8px' }}>
                    <h4 style={{ margin: '0 0 6px', fontSize: '13px', color: '#555' }}>The Bullet List</h4>
                    {Object.keys(bulletsByPlayer).map(pid => (
                        <div key={pid} style={{ marginBottom: '6px' }}>
                            <div style={{ fontWeight: 'bold', fontSize: '12px', color: '#2c3e50', marginBottom: '2px' }}>{getPlayerName(pid)}</div>
                            {bulletsByPlayer[pid].map(b => (
                                <div key={b.id} style={{
                                    fontSize: '12px', paddingLeft: '10px', marginBottom: '2px',
                                    display: 'flex', alignItems: 'flex-start', gap: '4px',
                                }}>
                                    <span style={{ color: '#f39c12', flexShrink: 0 }}>&#x2022;</span>
                                    <span style={{ flex: 1 }}>{b.text}</span>
                                    {!readOnly && onDeleteBullet && (
                                        <button
                                            onClick={() => onDeleteBullet(b.id)}
                                            title="Remove bullet"
                                            style={{
                                                border: 'none', background: 'none', color: '#ccc', cursor: 'pointer',
                                                fontSize: '11px', padding: '0 2px', lineHeight: 1, flexShrink: 0,
                                            }}
                                        >&times;</button>
                                    )}
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export const Board = (props) => {
    const { G, ctx, playerID, moves, log } = props;
    const [selectedIndices, _setSelectedIndices] = React.useState([]);
    const selectedRef = React.useRef([]);
    const setSelectedIndices = (val) => {
        const next = typeof val === 'function' ? val(selectedRef.current) : val;
        selectedRef.current = next;
        _setSelectedIndices(next);
    };
    const [dragIndex, setDragIndex] = React.useState(null);
    const [dropTarget, setDropTarget] = React.useState(null);

    // Local sort order: maps display position → actual hand index.
    // Allows sorting/reordering without a boardgame.io move (works off-turn).
    const [localOrder, setLocalOrder] = React.useState(() => []);
    const prevHandRef = React.useRef(null);
    React.useEffect(() => {
        const hand = G.players?.[playerID]?.hand;
        if (!hand) return;
        if (hand === prevHandRef.current) return; // same reference, no change
        const oldHand = prevHandRef.current;
        prevHandRef.current = hand;
        setLocalOrder(prev => {
            if (!oldHand || prev.length === 0) return hand.map((_, i) => i);

            // Match old display-ordered cards to new hand indices
            const available = hand.map((c, i) => ({ key: c.rank + c.suit, idx: i, used: false }));
            const newOrder = [];
            for (const oldActualIdx of prev) {
                const oldCard = oldHand[oldActualIdx];
                if (!oldCard) continue;
                const oldKey = oldCard.rank + oldCard.suit;
                const match = available.find(a => !a.used && a.key === oldKey);
                if (match) {
                    match.used = true;
                    newOrder.push(match.idx);
                }
            }
            // Append any new cards (e.g. drawn card) at end
            for (const a of available) {
                if (!a.used) newOrder.push(a.idx);
            }
            return newOrder.length === hand.length ? newOrder : hand.map((_, i) => i);
        });
    });
    const toActual = (displayIdx) => localOrder[displayIdx] ?? displayIdx;

    const [scoreDrawerOpen, setScoreDrawerOpen] = React.useState(true);
    const [scoreboardWidth, setScoreboardWidth] = React.useState(600);
    const isDraggingDivider = React.useRef(false);
    // Layoff target picker: { cardIndex, targets: [{ meldIndex, position }] } or null
    const [layoffPick, setLayoffPick] = React.useState(null);
    const handCardsRef = React.useRef(null);
    // Player name editing — which player ID is being edited (null = none)
    const [editingNameId, setEditingNameId] = React.useState(null);
    // Wild card sort mode: 'in-place' | 'left' | 'right'
    const [wildSortMode, setWildSortMode] = React.useState('in-place');
    // Chat system
    const [chatMessages, setChatMessages] = React.useState(props.initialChat || []);
    const [bulletMessages, setBulletMessages] = React.useState(props.initialBullets || []);
    const [includeChatInReplay, setIncludeChatInReplay] = React.useState(true);
    const chatInputRef = React.useRef(null);
    const sendChat = (senderID, text, isBullet) => {
        const msg = {
            id: Date.now() + '-' + Math.random().toString(36).slice(2, 6),
            playerID: senderID,
            playerName: G.playerNames?.[String(senderID)] || `Player ${senderID}`,
            text,
            timestamp: Date.now(),
            round: G.round,
            turn: ctx.turn,
            isBullet: !!isBullet,
        };
        setChatMessages(prev => [...prev, msg]);
        if (isBullet) {
            setBulletMessages(prev => [...prev, msg]);
        }
    };
    const deleteBullet = (bulletId) => {
        setBulletMessages(prev => prev.filter(b => b.id !== bulletId));
        // Also remove bullet flag from chat stream
        setChatMessages(prev => prev.map(m => m.id === bulletId ? { ...m, isBullet: false } : m));
    };

    // Detect flip shuffles and auto-post chat message
    const prevFlipCountRef = React.useRef(G.flipCount);
    const prevRoundRef = React.useRef(G.round);
    React.useEffect(() => {
        if (G.round !== prevRoundRef.current) {
            // Round changed — reset tracking
            prevFlipCountRef.current = 0;
            prevRoundRef.current = G.round;
        }
        if (G.flipCount > prevFlipCountRef.current) {
            const currentPlayer = ctx.currentPlayer;
            sendChat(currentPlayer, `Draw deck flip shuffled during round ${G.round + 1}`);
            prevFlipCountRef.current = G.flipCount;
        }
    }, [G.flipCount, G.round]);

    const getPlayerName = (id) => G.playerNames?.[String(id)] || `Player ${id}`;
    const nameInputRef = React.useRef(null);
    const startEditName = (id) => {
        setEditingNameId(String(id));
    };
    const commitName = (id) => {
        const val = nameInputRef.current?.value?.trim() || `Player ${id}`;
        moves.setPlayerName({ id: String(id), name: val });
        setEditingNameId(null);
    };

    // Focus and select-all exactly once when the name input appears
    React.useEffect(() => {
        if (editingNameId != null && nameInputRef.current) {
            nameInputRef.current.focus();
            nameInputRef.current.select();
        }
    }, [editingNameId]);

    // Find all valid (meldIndex, position) targets for laying off a card
    const findLayoffTargets = React.useCallback((card) => {
        const targets = [];
        for (let meldIdx = 0; meldIdx < G.board.length; meldIdx++) {
            const meld = G.board[meldIdx];
            if (meld.type === 'set') {
                if (isValidSet([card, ...meld.cards], G.round, G.rules))
                    targets.push({ meldIndex: meldIdx, position: 'start' });
                else if (isValidSet([...meld.cards, card], G.round, G.rules))
                    targets.push({ meldIndex: meldIdx, position: 'end' });
            } else if (meld.type === 'run') {
                if (isValidRun([card, ...meld.cards], G.round, G.rules))
                    targets.push({ meldIndex: meldIdx, position: 'start' });
                if (isValidRun([...meld.cards, card], G.round, G.rules))
                    targets.push({ meldIndex: meldIdx, position: 'end' });
            }
        }
        return targets;
    }, [G.board, G.round, G.rules]);

    // Execute a layoff: if one target, auto-place; if multiple, show picker
    const doLayoff = React.useCallback((cardIdx) => {
        const card = G.players[playerID]?.hand[cardIdx];
        if (!card) return;
        const targets = findLayoffTargets(card);
        if (targets.length === 0) return;
        if (targets.length === 1) {
            moves.layOff({ cardIndex: cardIdx, meldIndex: targets[0].meldIndex, position: targets[0].position });
        } else {
            setLayoffPick({ cardIndex: cardIdx, targets });
        }
    }, [G.players, playerID, findLayoffTargets, moves]);

    React.useEffect(() => {
        if (props.isReplay) return; // No keyboard shortcuts in replay mode
        const handleKeyDown = (e) => {
            // Don't fire shortcuts while any text input is focused
            const tag = document.activeElement?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
            const key = e.key.toLowerCase();
            const sel = selectedRef.current;
            // Stop single-letter keys from propagating to the boardgame.io debug panel
            if (key.length === 1) {
                e.stopPropagation();
            }

            // DRAW PILE ('n' — new card)
            if (key === 'n' && !G.hasDrawn && isMyTurn) {
                moves.drawCard(true);
            }

            // DISCARD PILE ('o' — old card)
            if (key === 'o' && !G.hasDrawn && isMyTurn && G.discardPile.length > 0) {
                moves.drawCard(false);
            }

            // WILD SWAP ('w')
            if (key === 'w' && sel.length === 1 && isMyTurn) {
                const cardIndex = toActual(sel[0]);
                const card = G.players[playerID].hand[cardIndex];

                let swapped = false;
                for (let meldIdx = 0; meldIdx < G.board.length && !swapped; meldIdx++) {
                    const meld = G.board[meldIdx];
                    const analysis = meld.type === 'run' ? analyzeRun(meld.cards, G.round) : null;
                    const roles = analysis?.roles;
                    for (let cIdx = 0; cIdx < meld.cards.length && !swapped; cIdx++) {
                        if (!isWild(meld.cards[cIdx], G.round)) continue;
                        if (roles && roles[cIdx] === 'natural') continue;
                        // Card must match exactly what the wild represents
                        if (meld.type === 'set') {
                            const targetRank = meld.cards.find(x => !isWild(x, G.round))?.rank;
                            if (targetRank && card.rank !== targetRank) continue;
                        } else if (analysis) {
                            const expectedRankIdx = analysis.startValue + cIdx;
                            if (RANKS.indexOf(card.rank) !== expectedRankIdx || card.suit !== analysis.suit) continue;
                        }
                        moves.swapWild({ cardIndex, meldIndex: meldIdx, cardInMeldIndex: cIdx });
                        swapped = true;
                    }
                }
                if (swapped) setSelectedIndices([]);
            }

            // DISCARD ('d')
            if (key === 'd' && sel.length === 1 && (G.hasDrawn || G.isFirstTurn) && isMyTurn) {
                moves.discardCard(toActual(sel[0]));
                setSelectedIndices([]);
            }

            // MELD ('m')
            if (key === 'm' && sel.length >= 3) {
                const selectedCards = sel.map(i => G.players[playerID].hand[toActual(i)]);
                let type = null;
                if (isValidSet(selectedCards, G.round, G.rules)) type = 'set';
                else if (isValidRun(selectedCards, G.round, G.rules)) type = 'run';

                if (type) {
                    moves.playMeld({ type, cards: selectedCards });
                    setSelectedIndices([]);
                } else {
                    alert('Not a valid Set or Run!\nRemember: Selection order matters for runs with wild cards.');
                }
            }

            // LAY OFF ('l')
            if (key === 'l' && sel.length > 0) {
                sel.forEach(displayIdx => doLayoff(toActual(displayIdx)));
                setSelectedIndices([]);
            }

            // UNDO last layoff/swap ('u')
            if (key === 'u' && isMyTurn && G.turnUndoStack?.length > 0) {
                moves.undoLastAction();
            }

            // SORT CARDS ('s')
            if (key === 's') {
                sortHand();
            }

            // CYCLE WILD SORT ('c')
            if (key === 'c') {
                setWildSortMode(m => m === 'in-place' ? 'left' : m === 'left' ? 'right' : 'in-place');
            }

            // NUMBER KEYS — when layoff picker is active, select a target position
            const digit = e.key === '0' ? 10 : parseInt(e.key);
            if (layoffPick && digit >= 1 && digit <= 9) {
                const targetIndex = digit - 1;
                if (targetIndex < layoffPick.targets.length) {
                    const t = layoffPick.targets[targetIndex];
                    moves.layOff({ cardIndex: layoffPick.cardIndex, meldIndex: t.meldIndex, position: t.position });
                    setLayoffPick(null);
                    setSelectedIndices([]);
                }
                return;
            }

            // NUMBER KEYS select/deselect cards (1-9, 0=10)
            if (digit >= 1 && digit <= 10 && digit <= G.players[playerID].hand.length) {
                toggleSelect(digit - 1);
            }

            // CHAT ('t' — talk)
            if (key === 't') {
                e.preventDefault();
                chatInputRef.current?.focus();
            }

            // ESCAPE cancels layoff picker
            if (key === 'Escape') {
                setLayoffPick(null);
            }

            // TAB — switch to next player in debug panel (dev only)
            if (e.key === 'Tab' && import.meta.env.DEV) {
                e.preventDefault();
                const nextPlayer = String((parseInt(playerID) + 1) % ctx.numPlayers);
                // boardgame.io debug panel renders player buttons as:
                //   <button class="player svelte-19aan9p">0</button>
                for (const btn of document.querySelectorAll('button.player.svelte-19aan9p')) {
                    if (btn.textContent.trim() === nextPlayer) {
                        btn.click();
                        document.activeElement?.blur();
                        return;
                    }
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [G, ctx, moves, playerID, layoffPick]);

    if (!G || !G.players) return <div>Loading...</div>;

    const player = G.players[playerID];
    const isMyTurn = ctx.currentPlayer === playerID;

    // Auto-clear selection when hand shrinks (card was played/discarded)
    const prevHandLen = React.useRef(player.hand.length);
    React.useEffect(() => {
        if (player.hand.length < prevHandLen.current) {
            selectedRef.current = [];
            _setSelectedIndices([]);
            setLayoffPick(null);
        }
        prevHandLen.current = player.hand.length;
    }, [player.hand.length]);

    // Sanitize: filter out any stale indices beyond current hand size
    const safeSelection = selectedIndices.filter(i => i < player.hand.length);

    // Hint computations for Lay Off and Swap Wild buttons
    // Returns: 'available' | 'not-on-board' | false
    const layoffHint = React.useMemo(() => {
        if (!G.rules?.hintLayoff || G.board.length === 0) return false;
        // Only hint for natural (non-wild) cards — wilds can still be laid off but don't trigger the hint
        const hasTarget = player.hand.some(c => !isWild(c, G.round) && findLayoffTargets(c).length > 0);
        if (!hasTarget) return false;
        return player.isOnBoard ? 'available' : 'not-on-board';
    }, [G.rules?.hintLayoff, G.board, player.hand, player.isOnBoard, G.round, findLayoffTargets]);

    const swapWildHint = React.useMemo(() => {
        // Returns: 'available' | 'not-on-board' | false
        if (!G.rules?.hintSwapWild || G.board.length === 0) return false;
        for (const c of player.hand) {
            if (isWild(c, G.round)) continue; // wilds can't swap for wilds
            for (const meld of G.board) {
                const analysis = meld.type === 'run' ? analyzeRun(meld.cards, G.round) : null;
                const roles = analysis?.roles;
                for (let cIdx = 0; cIdx < meld.cards.length; cIdx++) {
                    if (!isWild(meld.cards[cIdx], G.round)) continue;
                    if (roles && roles[cIdx] === 'natural') continue;
                    // Card must match exactly what the wild represents
                    if (meld.type === 'set') {
                        const targetRank = meld.cards.find(x => !isWild(x, G.round))?.rank;
                        if (targetRank && c.rank !== targetRank) continue;
                    } else if (analysis) {
                        const expectedRankIdx = analysis.startValue + cIdx;
                        if (RANKS.indexOf(c.rank) !== expectedRankIdx || c.suit !== analysis.suit) continue;
                    }
                    return player.isOnBoard ? 'available' : 'not-on-board';
                }
            }
        }
        return false;
    }, [G.rules?.hintSwapWild, G.board, player.hand, player.isOnBoard, G.round, G.rules]);

    const toggleSelect = (i) => {
        setSelectedIndices(prev => {
            if (prev.includes(i)) {
                return prev.filter(idx => idx !== i);
            } else {
                return [...prev, i];
            }
        });
    };

    const SUIT_ORDER = { H: 0, D: 1, C: 2, S: 3 };

    const sortHand = () => {
        const hand = player.hand;
        const sorted = [...localOrder];

        const sortRank = (card) => {
            if (isWild(card, G.round)) {
                if (wildSortMode === 'left') return -1;
                if (wildSortMode === 'right') return 14;
            }
            return RANKS.indexOf(card.rank);
        };
        sorted.sort((a, b) => {
            const ca = hand[a], cb = hand[b];
            const ra = sortRank(ca), rb = sortRank(cb);
            if (ra !== rb) return ra - rb;
            return SUIT_ORDER[ca.suit] - SUIT_ORDER[cb.suit];
        });

        // Second pass: reorder same-rank groups to maximize suit adjacency
        let i = 0;
        while (i < sorted.length) {
            let j = i;
            const rank = RANKS.indexOf(hand[sorted[i]].rank);
            while (j < sorted.length && RANKS.indexOf(hand[sorted[j]].rank) === rank) j++;
            if (j - i > 1) {
                const nextSuit = j < sorted.length ? hand[sorted[j]].suit : null;
                const prevSuit = i > 0 ? hand[sorted[i - 1]].suit : null;
                const group = sorted.slice(i, j);
                group.sort((a, b) => {
                    const sa = hand[a].suit, sb = hand[b].suit;
                    if (sa === nextSuit && sb !== nextSuit) return 1;
                    if (sb === nextSuit && sa !== nextSuit) return -1;
                    if (sa === prevSuit && sb !== prevSuit) return -1;
                    if (sb === prevSuit && sa !== prevSuit) return 1;
                    return SUIT_ORDER[sa] - SUIT_ORDER[sb];
                });
                for (let k = 0; k < group.length; k++) sorted[i + k] = group[k];
            }
            i = j;
        }

        setLocalOrder(sorted);
        setSelectedIndices([]);
    };

    // Game-over state
    const gameOver = ctx.gameover;
    const winners = React.useMemo(() => {
        if (!gameOver) return [];
        // Find lowest score(s)
        const scores = Object.entries(G.players).map(([id, p]) => ({ id, score: p.score }));
        const minScore = Math.min(...scores.map(s => s.score));
        return scores.filter(s => s.score === minScore).map(s => s.id);
    }, [gameOver, G.players]);

    return (
        <ErrorBoundary>
            {/* Game Over Banner */}
            {gameOver && (
                <div style={{
                    background: 'linear-gradient(135deg, #2c3e50, #34495e)',
                    color: 'white', padding: '10px 30px', textAlign: 'center',
                    borderBottom: '4px solid #f1c40f',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', flexWrap: 'wrap', marginBottom: '10px' }}>
                        <h2 style={{ margin: 0, fontSize: '28px', letterSpacing: '3px', color: '#f1c40f' }}>
                            GAME OVER
                        </h2>
                        <span style={{ fontSize: '20px' }}>
                            {winners.length === 1 ? (
                                <span>{getPlayerName(winners[0])} wins!</span>
                            ) : (
                                <span>Tie: {winners.map(id => getPlayerName(id)).join(' & ')}!</span>
                            )}
                        </span>
                        {log && props.gameSeed && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <button
                                    onClick={() => {
                                        const replayData = buildReplayData({
                                            seed: props.gameSeed,
                                            gameConfig: {
                                                numPlayers: ctx.numPlayers,
                                                rules: G.rules,
                                                playerNames: G.playerNames,
                                            },
                                            log,
                                            chatMessages: includeChatInReplay ? chatMessages : undefined,
                                            bulletMessages: bulletMessages.length > 0 ? bulletMessages : undefined,
                                        });
                                        downloadReplay(replayData);
                                    }}
                                    style={{
                                        padding: '5px 16px', borderRadius: '6px', border: '2px solid #f1c40f',
                                        background: 'transparent', color: '#f1c40f', cursor: 'pointer',
                                        fontSize: '14px', fontWeight: 'bold',
                                    }}
                                >Save Replay</button>
                                {chatMessages.length > 0 && (
                                    <label style={{ color: '#bdc3c7', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <input type="checkbox" checked={includeChatInReplay} onChange={e => setIncludeChatInReplay(e.target.checked)} />
                                        Include Chat
                                    </label>
                                )}
                                {props.onNewGame && (
                                    <button
                                        onClick={props.onNewGame}
                                        style={{
                                            padding: '5px 16px', borderRadius: '6px', border: '2px solid #27ae60',
                                            background: '#27ae60', color: 'white', cursor: 'pointer',
                                            fontSize: '14px', fontWeight: 'bold',
                                        }}
                                    >{props.matchData ? 'Leave Game' : 'New Game'}</button>
                                )}
                            </div>
                        )}
                        {/* Flip/reshuffle stats (debug) */}
                        {G.flipHistory && G.flipHistory.some(f => f > 0) && (
                            <div style={{
                                background: 'rgba(255,255,255,0.1)', borderRadius: '6px',
                                padding: '2px 10px', fontSize: '11px', color: '#95a5a6',
                                marginLeft: 'auto', whiteSpace: 'nowrap',
                            }}>
                                Reshuffles: {G.flipHistory.reduce((a, b) => a + b, 0)} total
                                ({G.flipHistory.map((f, i) => f > 0 ? `R${i + 1}:${f}` : null).filter(Boolean).join(', ')})
                            </div>
                        )}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', flexWrap: 'wrap' }}>
                        {Object.entries(G.players).map(([id, p]) => {
                            const isWinner = winners.includes(id);
                            return (
                                <div key={id} style={{
                                    background: isWinner ? 'rgba(241,196,15,0.2)' : 'rgba(255,255,255,0.1)',
                                    border: isWinner ? '2px solid #f1c40f' : '1px solid rgba(255,255,255,0.2)',
                                    borderRadius: '8px', padding: '10px 20px', minWidth: '120px',
                                }}>
                                    <div style={{ fontSize: '14px', color: isWinner ? '#f1c40f' : '#bdc3c7', marginBottom: '4px' }}>
                                        {isWinner ? '🏆 ' : ''}{getPlayerName(id)}
                                    </div>
                                    <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
                                        {p.score}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
            <div style={{ display: 'flex', fontFamily: '"Arial", sans-serif', marginRight: props.onNewGame ? 0 : '310px' }}>
                {/* Main game area */}
                <div style={{ flex: 1, minWidth: 0, padding: '8px 20px 20px' }}>
                <div>
                        <div style={{ borderBottom: '2px solid #333', paddingBottom: '2px', display: 'flex', alignItems: 'stretch', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <h1 style={{ color: '#2c3e50', margin: '0', fontSize: '1.4em', textTransform: 'uppercase', letterSpacing: '2px' }}>
                                            Michigan Rummy
                                        </h1>
                                        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', lineHeight: 1.1, color: '#888', fontSize: '0.55em', fontWeight: 'normal' }}>
                                            <span><strong>L</strong>ott</span>
                                            <span><strong>W</strong>ittbrodt</span>
                                            <span><strong>D</strong>logolpolski</span>
                                        </div>
                                    </div>
                                <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.1em' }}>
                                {editingNameId === playerID ? (
                                    <input
                                        ref={nameInputRef}
                                        defaultValue={getPlayerName(playerID)}
                                        maxLength={25}
                                        onBlur={() => commitName(playerID)}
                                        onKeyDown={e => {
                                            e.stopPropagation(); // prevent bubbling to the shortcut handler
                                            if (e.key === 'Enter') commitName(playerID);
                                            if (e.key === 'Escape') setEditingNameId(null);
                                        }}
                                        style={{ fontSize: '1em', fontWeight: 'bold', border: '2px solid #3498db', borderRadius: '4px', padding: '2px 6px', width: '240px' }}
                                    />
                                ) : (
                                    <span
                                        onClick={() => startEditName(playerID)}
                                        title="Click to rename"
                                        style={{ cursor: 'text', borderBottom: '2px dashed transparent' }}
                                        onMouseEnter={e => e.target.style.borderBottomColor = '#aaa'}
                                        onMouseLeave={e => e.target.style.borderBottomColor = 'transparent'}
                                    >
                                        {getPlayerName(playerID)}
                                    </span>
                                )}
                                <span style={{ fontSize: '0.8em', fontWeight: 'normal', color: '#666' }}>
                                    {isMyTurn ? '— YOUR TURN' : ''}
                                </span>
                            </h2>
                                </div>
                                <span style={{ fontSize: '13px', color: '#555', fontWeight: 'bold', whiteSpace: 'nowrap', marginBottom: '1px' }}>
                                    Round {G.round + 1} · Wild: {RANKS[G.round % 13]}
                                </span>
                            </div>
                            <TableRing
                                numPlayers={ctx.numPlayers}
                                currentPlayer={ctx.currentPlayer}
                                playerID={playerID}
                                playerNames={G.playerNames}
                                firstPlayer={ctx.gameover ? null : G.round % ctx.numPlayers}
                                dealer={ctx.gameover ? null : (G.round + ctx.numPlayers - 1) % ctx.numPlayers}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '8px', marginTop: '4px', marginBottom: '6px' }}>
                            <div style={{ background: '#eee', padding: '6px 10px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                                {/* Draw Pile card */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <div
                                        onClick={() => { if (!G.hasDrawn) moves.drawCard(true); }}
                                        title={`Draw Pile (n) — ${G.deck.length} cards`}
                                        style={{
                                            width: '48px', height: '68px', borderRadius: '5px',
                                            border: '1px solid #999',
                                            background: 'linear-gradient(135deg, #1a5276 0%, #2471a3 40%, #1a5276 60%, #154360 100%)',
                                            cursor: !G.hasDrawn ? 'pointer' : 'default',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            boxShadow: '1px 1px 3px rgba(0,0,0,0.2)',
                                            position: 'relative',
                                        }}
                                    >
                                        {/* Card back pattern */}
                                        <div style={{
                                            width: '38px', height: '58px', borderRadius: '3px',
                                            border: '1px solid rgba(255,255,255,0.3)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            pointerEvents: 'none',
                                        }}>
                                            <div style={{
                                                width: '30px', height: '50px', borderRadius: '2px',
                                                background: 'repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(255,255,255,0.1) 3px, rgba(255,255,255,0.1) 6px)',
                                                border: '1px solid rgba(255,255,255,0.2)',
                                            }} />
                                        </div>
                                    </div>
                                    <div style={{ fontSize: '11px', color: '#555', lineHeight: 1.3 }}>
                                        <div style={{ fontWeight: 'bold' }}>Draw Pile (n)</div>
                                        <div>{G.deck.length} cards</div>
                                        {G.flipCount > 0 && <div style={{ color: '#8e44ad', fontSize: '10px' }}>Flips: {G.flipCount}</div>}
                                    </div>
                                </div>
                                {/* Discard Pile card */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    {(() => {
                                        const topCard = G.discardPile?.length > 0 ? G.discardPile[G.discardPile.length - 1] : null;
                                        return (
                                            <div
                                                onClick={() => { if (!G.hasDrawn && topCard) moves.drawCard(false); }}
                                                title={topCard ? `Discard Pile (o) — ${topCard.rank}${SUIT_ICONS[topCard.suit]} (${G.discardPile.length} cards)` : 'Discard Pile — Empty'}
                                                style={{
                                                    width: '48px', height: '68px', borderRadius: '5px',
                                                    border: topCard ? '1px solid #ccc' : '1px dashed #bbb',
                                                    background: topCard ? 'white' : '#f5f5f5',
                                                    cursor: !G.hasDrawn && topCard ? 'pointer' : 'default',
                                                    display: 'flex', flexDirection: 'column',
                                                    alignItems: 'center', justifyContent: 'center',
                                                    boxShadow: topCard ? '1px 1px 3px rgba(0,0,0,0.15)' : 'none',
                                                }}
                                            >
                                                {topCard ? (<>
                                                    <div style={{ fontSize: '16px', fontWeight: 'bold', lineHeight: 1, pointerEvents: 'none' }}>{topCard.rank}</div>
                                                    <div style={{ fontSize: '22px', color: SUIT_COLORS[topCard.suit], lineHeight: 1, pointerEvents: 'none' }}>{SUIT_ICONS[topCard.suit]}</div>
                                                </>) : (
                                                    <div style={{ color: '#ccc', fontSize: '20px', lineHeight: 1, pointerEvents: 'none' }}>&#x2205;</div>
                                                )}
                                            </div>
                                        );
                                    })()}
                                    <div style={{ fontSize: '11px', color: '#555', lineHeight: 1.3 }}>
                                        <div style={{ fontWeight: 'bold' }}>Discard Pile (o)</div>
                                        <div>{G.discardPile?.length || 0} cards</div>
                                    </div>
                                </div>
                            </div>
                            <div style={{ background: '#eee', padding: '4px 10px', borderRadius: '6px', flex: 1, fontSize: '13px' }}>
                                <p style={{ margin: '2px 0' }}><strong>Score:</strong> {player.score}</p>
                                <p style={{ margin: '2px 0' }}><strong>Status:</strong> <span style={{ fontWeight: 'bold', color: player.isOnBoard ? '#27ae60' : '#e74c3c' }}>{player.isOnBoard ? 'On the Board' : 'Not on the Board'}</span></p>
                                {G.flipCount > 0 && (
                                    <div style={{ marginTop: '3px' }}>
                                        <button
                                            onClick={() => moves.voteEndRound()}
                                            style={{
                                                fontSize: '11px',
                                                padding: '3px 8px',
                                                background: G.votes[playerID] ? '#27ae60' : '#f39c12',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '4px',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            {G.votes[playerID] ? 'Voted to End' : 'Vote to End Round'}
                                        </button>
                                        <span style={{ fontSize: '11px', marginLeft: '5px' }}>
                                            ({Object.values(G.votes).filter(v => v).length}/{ctx.numPlayers})
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                            <h3 style={{ margin: 0, fontSize: '14px' }}>Your Hand ({player.hand.length} cards)</h3>
                            <span style={{ fontSize: '11px', color: '#999' }}>Click cards in order for runs.</span>
                        </div>
                        <div
                            style={{ background: '#f5f5f5', padding: '8px 12px', borderRadius: '8px' }}
                        >
                            <div
                                ref={handCardsRef}
                                style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'flex-start' }}
                                onDragOver={(e) => e.preventDefault()}
                            >
                                {localOrder.map((actualIdx, i) => {
                                    const card = player.hand[actualIdx];
                                    if (!card) return null;
                                    return (
                                    <div
                                        key={`card-${actualIdx}-${card.rank}-${card.suit}`}
                                        onDragOver={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            if (dragIndex !== null && dragIndex !== i) setDropTarget(i);
                                        }}
                                        onDrop={(e) => {
                                            e.preventDefault();
                                            if (dragIndex !== null && dragIndex !== i) {
                                                setLocalOrder(prev => {
                                                    const next = [...prev];
                                                    const [removed] = next.splice(dragIndex, 1);
                                                    next.splice(i, 0, removed);
                                                    return next;
                                                });
                                                setSelectedIndices([]);
                                            }
                                            setDragIndex(null);
                                            setDropTarget(null);
                                        }}
                                        style={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            gap: '2px',
                                            borderLeft: dropTarget === i && dragIndex !== null && dragIndex > i ? '3px solid #3498db' : '3px solid transparent',
                                            borderRight: dropTarget === i && dragIndex !== null && dragIndex < i ? '3px solid #3498db' : '3px solid transparent',
                                            transition: 'border-color 0.15s ease',
                                            opacity: dragIndex === i ? 0.3 : 1,
                                        }}
                                    >
                                        <span style={{ fontSize: '10px', color: '#999', fontWeight: 'bold' }}>{i + 1}</span>
                                        <Card
                                            card={card}
                                            wild={isWild(card, G.round)}
                                            selected={safeSelection.includes(i)}
                                            selectionIndex={safeSelection.indexOf(i)}
                                            onClick={() => { if (dragIndex === null) toggleSelect(i); }}
                                            draggable={true}
                                            onDragStart={(e) => {
                                                setDragIndex(i);
                                                e.dataTransfer.effectAllowed = 'move';
                                            }}
                                            onDragEnd={() => {
                                                setDragIndex(null);
                                                setDropTarget(null);
                                            }}
                                        />
                                    </div>
                                    );
                                })}
                            </div>
                            {/* Sort controls — below cards, left-aligned */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                                <span
                                    onClick={() => setWildSortMode(m => m === 'in-place' ? 'left' : m === 'left' ? 'right' : 'in-place')}
                                    title={`Wild sort: ${wildSortMode === 'left' ? 'wilds sort to left' : wildSortMode === 'right' ? 'wilds sort to right' : 'wilds sort in place'}\nClick to cycle`}
                                    style={{
                                        fontSize: '11px', cursor: 'pointer', userSelect: 'none',
                                        padding: '1px 6px', borderRadius: '4px', border: '1px solid #dbb',
                                        background: wildSortMode === 'in-place' ? '#f0f0f0' : '#fff9c4',
                                        color: '#666', fontWeight: 'bold',
                                    }}
                                >Wild Placement: {wildSortMode === 'left' ? '◀' : wildSortMode === 'right' ? '▶' : '—'} (c)</span>
                                <button
                                    onClick={sortHand}
                                    title="Sort hand by rank"
                                    style={{
                                        padding: '2px 8px', borderRadius: '4px', border: '1px solid #bbb',
                                        background: '#f0f0f0', color: '#555', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold',
                                    }}
                                >Sort Cards (s)</button>
                            </div>
                        </div>

                        {/* Draw alert — shown when player must draw to continue */}
                        {isMyTurn && !G.hasDrawn && !G.isFirstTurn && (
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                margin: '4px 0',
                                padding: '5px 10px',
                                background: '#fff3cd',
                                border: '1px solid #ffc107',
                                borderRadius: '6px',
                                fontSize: '13px',
                                color: '#856404',
                                fontWeight: 'bold'
                            }}>
                                ⚠️ Draw a card to continue:
                                <button onClick={() => moves.drawCard(true)} style={{
                                    padding: '3px 10px', borderRadius: '4px', border: 'none',
                                    background: '#2980b9', color: 'white', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px'
                                }}>
                                    Draw Pile (n) · {G.deck.length}
                                </button>
                                {G.discardPile.length > 0 && (
                                    <button onClick={() => moves.drawCard(false)} style={{
                                        padding: '3px 10px', borderRadius: '4px', border: 'none',
                                        background: '#8e44ad', color: 'white', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px'
                                    }}>
                                        Discard Pile (o) · {G.discardPile.length}
                                    </button>
                                )}
                            </div>
                        )}

                        {/* Must-meld alert — shown when discard pickup must be played */}
                        {isMyTurn && G.mustMeldAfterDiscard && !G.playedCardThisTurn && (
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: '8px',
                                margin: '4px 0', padding: '5px 10px',
                                background: '#f8d7da', border: '1px solid #f5c6cb', borderRadius: '6px',
                                fontSize: '13px', color: '#721c24', fontWeight: 'bold',
                            }}>
                                You drew from discard — you must play that card (meld, lay off, or swap wild) before discarding.
                                <button
                                    onClick={() => moves.undoDiscardDraw()}
                                    style={{
                                        marginLeft: 'auto', padding: '3px 10px', borderRadius: '4px',
                                        border: '1px solid #c0392b', background: '#e74c3c', color: 'white',
                                        cursor: 'pointer', fontWeight: 'bold', fontSize: '12px', whiteSpace: 'nowrap',
                                    }}
                                    title="Put the discard pickup back and draw from the deck instead"
                                >Put Back</button>
                            </div>
                        )}

                        {/* Action buttons */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', margin: '4px 0' }}>
                            {/* Discard — active when 1 card selected and have drawn */}
                            {(() => {
                                const mustMeldFirst = G.mustMeldAfterDiscard && !G.playedCardThisTurn;
                                const canDiscard = safeSelection.length === 1 && (G.hasDrawn || G.isFirstTurn) && isMyTurn && !mustMeldFirst;
                                return (
                                    <button
                                        disabled={!canDiscard}
                                        onClick={() => {
                                            if (!canDiscard) return;
                                            moves.discardCard(toActual(safeSelection[0]));
                                            setSelectedIndices([]);
                                        }}
                                        style={{
                                            padding: '4px 10px', borderRadius: '4px', border: 'none', fontSize: '12px', cursor: canDiscard ? 'pointer' : 'default',
                                            background: canDiscard ? '#e74c3c' : '#ddd', color: canDiscard ? 'white' : '#999', fontWeight: 'bold'
                                        }}
                                    >Discard (d)</button>
                                );
                            })()}

                            {/* Meld — active when 3+ cards selected */}
                            {(() => {
                                const canMeld = safeSelection.length >= 3 && isMyTurn;
                                return (
                                    <button
                                        onClick={() => {
                                            const sel = selectedRef.current.filter(i => i < localOrder.length);
                                            if (sel.length < 3) return;
                                            const selectedCards = sel.map(i => G.players[playerID].hand[toActual(i)]);
                                            let type = null;
                                            if (isValidSet(selectedCards, G.round, G.rules)) type = 'set';
                                            else if (isValidRun(selectedCards, G.round, G.rules)) type = 'run';
                                            if (type) { moves.playMeld({ type, cards: selectedCards }); setSelectedIndices([]); }
                                            else alert('Not a valid Set or Run!\nRemember: Selection order matters for runs with wild cards.');
                                        }}
                                        style={{
                                            padding: '4px 10px', borderRadius: '4px', border: 'none', fontSize: '12px', cursor: canMeld ? 'pointer' : 'default',
                                            background: canMeld ? '#27ae60' : '#ddd', color: canMeld ? 'white' : '#999', fontWeight: 'bold'
                                        }}
                                    >Meld (m)</button>
                                );
                            })()}

                            {/* Lay Off — hinted when rule enabled */}
                            {(() => {
                                const hinting = G.rules?.hintLayoff;
                                const hintAvailable = hinting && layoffHint === 'available' && isMyTurn;
                                const hintNotOnBoard = hinting && layoffHint === 'not-on-board' && isMyTurn;
                                return (
                                    <button
                                        onClick={() => {
                                            const sel = selectedRef.current.filter(i => i < localOrder.length);
                                            if (sel.length === 0 || !isMyTurn) return;
                                            sel.forEach(displayIdx => doLayoff(toActual(displayIdx)));
                                            setSelectedIndices([]);
                                        }}
                                        style={{
                                            padding: '4px 10px', borderRadius: '4px', fontSize: '12px', cursor: 'pointer', fontWeight: 'bold',
                                            background: hintAvailable ? '#2ecc71' : hintNotOnBoard ? '#a9dfbf' : '#f0f0f0',
                                            color: hintAvailable ? 'white' : hintNotOnBoard ? '#1e8449' : '#555',
                                            border: hintAvailable ? '1px solid #27ae60' : hintNotOnBoard ? '2px dashed #27ae60' : '1px solid #bbb',
                                        }}
                                        title={hintNotOnBoard ? 'Lay off possible but you must meld first to get on the board' : ''}
                                    >Lay Off (l){hintNotOnBoard ? '*' : ''}</button>
                                );
                            })()}

                            {/* Swap Wild — hinted when rule enabled */}
                            {(() => {
                                const hinting = G.rules?.hintSwapWild;
                                const hintAvailable = hinting && swapWildHint === 'available' && isMyTurn;
                                const hintNotOnBoard = hinting && swapWildHint === 'not-on-board' && isMyTurn;
                                return (
                                    <button
                                        onClick={() => {
                                            const sel = selectedRef.current.filter(i => i < localOrder.length);
                                            if (sel.length !== 1 || !isMyTurn) return;
                                            const cardIndex = toActual(sel[0]);
                                            const card = G.players[playerID].hand[cardIndex];
                                            for (let meldIdx = 0; meldIdx < G.board.length; meldIdx++) {
                                                const meld = G.board[meldIdx];
                                                const analysis = meld.type === 'run' ? analyzeRun(meld.cards, G.round) : null;
                                                const roles = analysis?.roles;
                                                for (let cIdx = 0; cIdx < meld.cards.length; cIdx++) {
                                                    if (!isWild(meld.cards[cIdx], G.round)) continue;
                                                    if (roles && roles[cIdx] === 'natural') continue;
                                                    // Card must match exactly what the wild represents
                                                    if (meld.type === 'set') {
                                                        const targetRank = meld.cards.find(x => !isWild(x, G.round))?.rank;
                                                        if (targetRank && card.rank !== targetRank) continue;
                                                    } else if (analysis) {
                                                        const expectedRankIdx = analysis.startValue + cIdx;
                                                        if (RANKS.indexOf(card.rank) !== expectedRankIdx || card.suit !== analysis.suit) continue;
                                                    }
                                                    moves.swapWild({ cardIndex, meldIndex: meldIdx, cardInMeldIndex: cIdx });
                                                    setSelectedIndices([]);
                                                    return;
                                                }
                                            }
                                        }}
                                        style={{
                                            padding: '4px 10px', borderRadius: '4px', fontSize: '12px', cursor: 'pointer', fontWeight: 'bold',
                                            background: hintAvailable ? '#8e44ad' : hintNotOnBoard ? '#d5b8e8' : '#f0f0f0',
                                            color: hintAvailable ? 'white' : hintNotOnBoard ? '#6c3483' : '#555',
                                            border: hintAvailable ? '1px solid #7d3c98' : hintNotOnBoard ? '2px dashed #8e44ad' : '1px solid #bbb',
                                        }}
                                        title={hintNotOnBoard ? 'Swap possible but you must meld first to get on the board' : ''}
                                    >Wild Swap (w){hintNotOnBoard ? '*' : ''}</button>
                                );
                            })()}

                            {/* Undo last layoff/swap */}
                            {isMyTurn && G.turnUndoStack?.length > 0 && (
                                <button
                                    onClick={() => moves.undoLastAction()}
                                    style={{
                                        padding: '4px 10px', borderRadius: '4px', fontSize: '12px', cursor: 'pointer', fontWeight: 'bold',
                                        background: '#e67e22', color: 'white', border: '1px solid #d35400',
                                    }}
                                    title={`Undo last ${G.turnUndoStack[G.turnUndoStack.length - 1]?.action === 'swapWild' ? 'wild swap' : 'lay off'} (u)`}
                                >Undo (u)</button>
                            )}
                        </div>

                        <div style={{ fontSize: '10px', color: '#aaa', marginBottom: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>n=draw pile · o=discard pile · d=discard · m=meld · l=lay off · w=wild swap · u=undo · s=sort · c=cycle wild sort · t=chat</span>
                            {log && props.gameSeed && (
                                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    {chatMessages.length > 0 && (
                                        <label style={{ fontSize: '10px', color: '#999', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}>
                                            <input type="checkbox" checked={includeChatInReplay} onChange={e => setIncludeChatInReplay(e.target.checked)} style={{ width: '12px', height: '12px' }} />
                                            Chat
                                        </label>
                                    )}
                                    <button
                                        onClick={() => {
                                            const replayData = buildReplayData({
                                                seed: props.gameSeed,
                                                gameConfig: {
                                                    numPlayers: ctx.numPlayers,
                                                    rules: G.rules,
                                                    playerNames: G.playerNames,
                                                },
                                                log,
                                                chatMessages: includeChatInReplay ? chatMessages : undefined,
                                                bulletMessages: bulletMessages.length > 0 ? bulletMessages : undefined,
                                            });
                                            downloadReplay(replayData);
                                        }}
                                        style={{ padding: '2px 8px', borderRadius: '3px', border: '1px solid #bbb', background: '#f0f0f0', color: '#555', cursor: 'pointer', fontSize: '10px' }}
                                    >Save Replay</button>
                                </span>
                            )}
                        </div>

                        <h3 style={{ margin: '8px 0 4px', fontSize: '14px' }}>Board Melds</h3>
                        {layoffPick && (
                            <div style={{
                                background: '#eafaf1', border: '1px solid #27ae60', borderRadius: '6px',
                                padding: '6px 12px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '10px',
                                fontSize: '13px', color: '#1e8449',
                            }}>
                                <strong>Choose where to place your card</strong>
                                <span>— click a numbered position or press its key</span>
                                <button
                                    onClick={() => setLayoffPick(null)}
                                    style={{
                                        marginLeft: 'auto', padding: '2px 8px', borderRadius: '4px',
                                        border: '1px solid #aaa', background: '#f0f0f0', cursor: 'pointer', fontSize: '12px',
                                    }}
                                >Cancel</button>
                            </div>
                        )}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                            {G.board.length === 0 ? <p>No melds on board.</p> : G.board.map((meld, i) => {
                                const isRetractable = G.playedMeldsIndices.includes(i) && isMyTurn;
                                const pickStartTarget = layoffPick?.targets.find(t => t.meldIndex === i && t.position === 'start');
                                const pickEndTarget = layoffPick?.targets.find(t => t.meldIndex === i && t.position === 'end');
                                const isPickTarget = pickStartTarget || pickEndTarget;
                                return (
                                    <div key={i} style={{
                                        border: isPickTarget ? '2px solid #27ae60' : isRetractable ? '2px solid #3498db' : '1px solid #aaa',
                                        padding: '10px',
                                        borderRadius: '8px',
                                        background: isPickTarget ? '#eafaf1' : 'white',
                                        position: 'relative',
                                        cursor: isRetractable && !layoffPick ? 'pointer' : 'default',
                                        boxShadow: isPickTarget ? '0 0 6px #27ae60' : isRetractable ? '0 0 5px #3498db' : 'none'
                                    }}
                                        onClick={() => !layoffPick && isRetractable && moves.retractMeld(i)}
                                        title={isRetractable && !layoffPick ? 'Click to retract' : ''}
                                    >
                                        <div style={{ fontSize: '10px', fontWeight: 'bold', marginBottom: '5px', color: '#7f8c8d' }}>
                                            {meld.type.toUpperCase()}
                                            {meld.owner != null && (
                                                <span style={{ marginLeft: '5px', color: '#555' }}>
                                                    — {getPlayerName(meld.owner)}
                                                </span>
                                            )}
                                            {isRetractable && !layoffPick && <span style={{ marginLeft: '5px', color: '#3498db' }}>(RETRACTABLE)</span>}
                                        </div>
                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                            {pickStartTarget && (() => {
                                                const targetNum = layoffPick.targets.findIndex(t => t.meldIndex === i && t.position === 'start') + 1;
                                                return (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        moves.layOff({ cardIndex: layoffPick.cardIndex, meldIndex: i, position: 'start' });
                                                        setLayoffPick(null);
                                                        setSelectedIndices([]);
                                                    }}
                                                    style={{
                                                        padding: '2px 6px', borderRadius: '4px', border: '2px solid #27ae60',
                                                        background: '#27ae60', color: 'white', cursor: 'pointer',
                                                        fontSize: '14px', fontWeight: 'bold', lineHeight: 1,
                                                        minWidth: '24px',
                                                    }}
                                                    title={`Place card here (start) — press ${targetNum}`}
                                                >{targetNum}</button>
                                                );
                                            })()}
                                            {meld.cards.map((c, j) => {
                                                const inferred = getInferredRank(meld, j, G.round);
                                                return (
                                                    <div key={j} style={{ textAlign: 'center' }}>
                                                        <div style={{ color: SUIT_COLORS[c.suit], fontWeight: 'bold', fontSize: '22px' }}>
                                                            {c.rank}{SUIT_ICONS[c.suit]}
                                                        </div>
                                                        {inferred && (
                                                            <div style={{ fontSize: '16px', color: '#f39c12', fontWeight: 'bold' }}>
                                                                ({inferred})
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                            {pickEndTarget && (() => {
                                                const targetNum = layoffPick.targets.findIndex(t => t.meldIndex === i && t.position === 'end') + 1;
                                                return (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        moves.layOff({ cardIndex: layoffPick.cardIndex, meldIndex: i, position: 'end' });
                                                        setLayoffPick(null);
                                                        setSelectedIndices([]);
                                                    }}
                                                    style={{
                                                        padding: '2px 6px', borderRadius: '4px', border: '2px solid #27ae60',
                                                        background: '#27ae60', color: 'white', cursor: 'pointer',
                                                        fontSize: '14px', fontWeight: 'bold', lineHeight: 1,
                                                        minWidth: '24px',
                                                    }}
                                                    title={`Place card here (end) — press ${targetNum}`}
                                                >{targetNum}</button>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Scoreboard flyout tab — positioned on the right edge */}
                {!scoreDrawerOpen && (
                    <div
                        onClick={() => setScoreDrawerOpen(true)}
                        title="Open Scoreboard"
                        style={{
                            position: 'fixed', right: props.onNewGame ? 0 : '310px', top: '120px', zIndex: 10,
                            width: '24px', height: '48px', cursor: 'pointer',
                            background: '#3498db', borderRadius: '6px 0 0 6px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                    >
                        <span style={{ color: 'white', fontSize: '16px', lineHeight: 1 }}>&#9664;</span>
                    </div>
                )}

                {/* Draggable divider + Scoreboard panel */}
                {scoreDrawerOpen && (
                    <>
                        {/* Draggable divider */}
                        <div
                            onMouseDown={(e) => {
                                e.preventDefault();
                                isDraggingDivider.current = true;
                                const startX = e.clientX;
                                const startWidth = scoreboardWidth;
                                const debugPanelWidth = props.onNewGame ? 0 : 310;
                                const minGameArea = 350; // ~4 cards + padding
                                const onMouseMove = (ev) => {
                                    if (!isDraggingDivider.current) return;
                                    const delta = startX - ev.clientX;
                                    const maxWidth = window.innerWidth - debugPanelWidth - minGameArea;
                                    setScoreboardWidth(Math.max(300, Math.min(maxWidth, startWidth + delta)));
                                };
                                const onMouseUp = () => {
                                    isDraggingDivider.current = false;
                                    document.removeEventListener('mousemove', onMouseMove);
                                    document.removeEventListener('mouseup', onMouseUp);
                                    document.body.style.cursor = '';
                                    document.body.style.userSelect = '';
                                };
                                document.addEventListener('mousemove', onMouseMove);
                                document.addEventListener('mouseup', onMouseUp);
                                document.body.style.cursor = 'col-resize';
                                document.body.style.userSelect = 'none';
                            }}
                            style={{
                                width: '6px', flexShrink: 0, cursor: 'col-resize',
                                background: '#ddd', transition: 'background 0.15s',
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = '#aaa'}
                            onMouseLeave={(e) => { if (!isDraggingDivider.current) e.currentTarget.style.background = '#ddd'; }}
                        />
                        {/* Scoreboard panel */}
                        <div style={{
                            width: `${scoreboardWidth}px`, flexShrink: 0,
                            padding: '20px', overflowY: 'auto', background: '#fafafa',
                            position: 'relative',
                        }}>
                            {/* Collapse tab on right edge of scoreboard */}
                            <div
                                onClick={() => setScoreDrawerOpen(false)}
                                title="Close Scoreboard"
                                style={{
                                    position: 'absolute', right: 0, top: '120px',
                                    width: '24px', height: '48px', cursor: 'pointer',
                                    background: '#3498db', borderRadius: '0 6px 6px 0',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}
                            >
                                <span style={{ color: 'white', fontSize: '16px', lineHeight: 1 }}>&#9654;</span>
                            </div>
                            <h3 style={{ margin: '0 0 10px' }}>Scoreboard
                                {(() => { const d = Math.ceil(ctx.numPlayers / 5); return (
                                    <span style={{ fontWeight: 'normal', fontSize: '11px', color: '#888', marginLeft: '8px' }}>
                                        {d} {d === 1 ? 'deck' : 'decks'} ({d * 52} cards)
                                    </span>
                                ); })()}
                            </h3>
                            <Scoreboard G={G} numPlayers={ctx.numPlayers} playerNames={G.playerNames} currentPlayer={ctx.currentPlayer}
                                onRename={(id) => startEditName(String(id))}
                                editingNameId={editingNameId}
                                nameInputRef={nameInputRef}
                                onCommitName={(id) => commitName(String(id))}
                                onCancelEdit={() => setEditingNameId(null)}
                            />
                            <ChatPanel
                                messages={props.replayChat || chatMessages}
                                onSend={sendChat}
                                numPlayers={ctx.numPlayers}
                                getPlayerName={getPlayerName}
                                currentPlayer={ctx.currentPlayer}
                                chatInputRef={chatInputRef}
                                readOnly={!!props.isReplay}
                                bullets={props.replayBullets || bulletMessages}
                                onDeleteBullet={!props.isReplay ? deleteBullet : undefined}
                            />
                        </div>
                    </>
                )}
            </div>
        </ErrorBoundary>
    );
};
