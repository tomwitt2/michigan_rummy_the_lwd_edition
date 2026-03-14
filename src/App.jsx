import React from 'react';
import { Client } from 'boardgame.io/react';
import { createGame, isWild, isValidSet, isValidRun, analyzeRun, RANKS } from './game/logic';
import { buildReplayData, downloadReplay, loadReplayFile } from './replay/replayStorage.js';
import { ReplayEngine } from './replay/ReplayEngine.js';
import { ReplayControls } from './replay/ReplayControls.jsx';

// Game initialized dynamically via createGame()

const SUIT_ICONS = { H: '♥', D: '♦', C: '♣', S: '♠' };
const SUIT_COLORS = { H: '#e74c3c', D: '#e74c3c', C: '#2c3e50', S: '#2c3e50' };

const Card = ({ card, selected, onClick, wild, selectionIndex, draggable, onDragStart, onDragEnd }) => (
    <div
        draggable={draggable}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onClick={onClick}
        style={{
            width: '65px',
            height: '95px',
            border: selected ? '3px solid #3498db' : '1px solid #ccc',
            borderRadius: '6px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: wild ? '#fff9c4' : 'white',
            cursor: draggable ? 'grab' : 'pointer',
            userSelect: 'none',
            boxShadow: selected ? '0 0 8px #3498db' : 'none',
            position: 'relative',
            transition: 'all 0.1s ease',
            transform: selected ? 'translateY(-5px)' : 'none'
        }}
    >
        {selected && (
            <div style={{
                position: 'absolute',
                top: '-10px',
                right: '-10px',
                background: '#3498db',
                color: 'white',
                borderRadius: '50%',
                width: '20px',
                height: '20px',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold',
                zIndex: 10
            }}>
                {selectionIndex + 1}
            </div>
        )}
        <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{card.rank}</div>
        <div style={{ fontSize: '32px', color: SUIT_COLORS[card.suit] }}>{SUIT_ICONS[card.suit]}</div>
        {wild && <div style={{ fontSize: '9px', position: 'absolute', bottom: '2px', fontWeight: 'bold', color: '#f39c12' }}>WILD</div>}
    </div>
);

// Helper to determine what a card represents in a meld.
// Returns null if the card is natural (including wild-ranked cards used as naturals).
const getInferredRank = (meld, cardIndex, round) => {
    const cards = meld.cards;
    if (!isWild(cards[cardIndex], round)) return null;

    if (meld.type === 'set') {
        // In a set, wild-ranked cards matching the set's rank are naturals
        const wildRank = RANKS[round % 13];
        const targetRank = cards.find(c => c.rank !== wildRank)?.rank || wildRank;
        if (cards[cardIndex].rank === targetRank) return null; // natural
        return targetRank;
    }

    // Run: use analyzeRun to determine if this wild-ranked card is natural
    const analysis = analyzeRun(cards, round);
    if (analysis && analysis.roles[cardIndex] === 'natural') return null;

    // Card is used as a wild — infer what it represents
    if (!analysis) return '?';
    const inferredValue = analysis.startValue + cardIndex;
    if (inferredValue < 0 || inferredValue > 12) return '?';
    const rank = RANKS[inferredValue];
    return rank ? `${rank}${SUIT_ICONS[analysis.suit]}` : '?';
};

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }
    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }
    componentDidCatch(error, errorInfo) {
        console.error('ErrorBoundary caught:', error, errorInfo);
        this.setState({ errorInfo });
    }
    render() {
        if (this.state.hasError) {
            return (
                <div style={{ padding: '30px', fontFamily: 'Arial, sans-serif' }}>
                    <div style={{
                        background: '#fef2f2', border: '2px solid #e74c3c', borderRadius: '8px',
                        padding: '20px', maxWidth: '600px', margin: '0 auto',
                    }}>
                        <h2 style={{ color: '#c0392b', margin: '0 0 10px' }}>Something went wrong</h2>
                        <p style={{ color: '#333', margin: '0 0 10px' }}>
                            An error occurred while rendering the game. This can happen when interacting
                            with the game out of turn order via the debug panel.
                        </p>
                        <pre style={{
                            background: '#fff', border: '1px solid #ddd', borderRadius: '4px',
                            padding: '10px', fontSize: '12px', overflow: 'auto', maxHeight: '150px',
                            color: '#c0392b',
                        }}>{this.state.error?.message}{this.state.error?.stack && '\n\n' + this.state.error.stack}</pre>
                        <button
                            onClick={() => this.setState({ hasError: false, error: null, errorInfo: null })}
                            style={{
                                marginTop: '12px', padding: '8px 20px', borderRadius: '6px', border: 'none',
                                background: '#3498db', color: 'white', cursor: 'pointer', fontSize: '14px',
                                fontWeight: 'bold',
                            }}
                        >Try to Recover</button>
                    </div>
                </div>
            );
        }
        return this.props.children;
    }
}

const TableRing = ({ numPlayers, currentPlayer, playerID, playerNames }) => {
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
        const label = playerNames?.[i]?.[0]?.toUpperCase() || String(i);

        return { x, y, isActive, isViewer, label, id: i };
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
                </div>
            ))}
        </div>
    );
};

const Scoreboard = ({ G, numPlayers, playerNames, currentPlayer, onRename, editingNameId, nameInputRef, onCommitName, onCancelEdit }) => {
    const rounds = RANKS; // A through K (13 rounds)

    return (
        <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', textAlign: 'center', fontSize: '14px', width: '100%' }}>
                <thead>
                    <tr style={{ background: '#f8f9fa' }}>
                        <th style={{ border: '1px solid #ddd', padding: '8px' }}>Rd</th>
                        {Array.from({ length: numPlayers }).map((_, i) => {
                            const isActive = String(i) === String(currentPlayer);
                            return (
                                <th key={i} style={{
                                    border: '1px solid #ddd', padding: '8px',
                                    background: isActive ? '#fff3cd' : undefined,
                                    boxShadow: isActive ? 'inset 0 3px 0 #f39c12' : 'none',
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
                                            color: isActive ? '#e67e22' : undefined,
                                            fontWeight: 'bold',
                                            cursor: onRename ? 'text' : 'default',
                                            borderBottom: onRename ? '2px dashed transparent' : 'none',
                                        }}
                                            onClick={() => onRename?.(i)}
                                            onMouseEnter={e => { if (onRename) e.target.style.borderBottomColor = '#aaa'; }}
                                            onMouseLeave={e => { if (onRename) e.target.style.borderBottomColor = 'transparent'; }}
                                            title={onRename ? 'Click to rename' : ''}
                                        >
                                            {playerNames?.[i] || `Player ${i}`}
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
                            <tr key={roundIdx} style={{ background: isCurrentRound ? '#fff9c4' : 'transparent' }}>
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
                                    const isWinner = roundHistory?.winner === String(pId);

                                    return (
                                        <td key={pId} style={{ border: '1px solid #ddd', padding: '5px', position: 'relative' }}>
                                            {roundHistory ? (
                                                <>
                                                    <span style={{ fontSize: '16px' }}>{runningTotal}</span>
                                                    <sup style={{ color: '#e74c3c', marginLeft: '2px', fontWeight: 'bold' }}>
                                                        {isWinner ? '🏆' : `+${roundScore}`}
                                                    </sup>
                                                </>
                                            ) : (
                                                isCurrentRound ? '...' : ''
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
                        {Array.from({ length: numPlayers }).map((_, i) => (
                            <td key={i} style={{ border: '1px solid #ddd', padding: '8px', fontSize: '18px' }}>
                                {G.players[i].score}
                            </td>
                        ))}
                    </tr>
                </tfoot>
            </table>
        </div>
    );
};

const Board = (props) => {
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
    const [scoreDrawerOpen, setScoreDrawerOpen] = React.useState(false);
    const [scoreDrawerLocked, setScoreDrawerLocked] = React.useState(false);
    const [scoreboardWidth, setScoreboardWidth] = React.useState(600);
    const isDraggingDivider = React.useRef(false);
    // Layoff target picker: { cardIndex, targets: [{ meldIndex, position }] } or null
    const [layoffPick, setLayoffPick] = React.useState(null);
    // Per-player hold indices — persists when switching players via debug panel
    const holdIndicesRef = React.useRef({});
    const getHoldIndex = () => holdIndicesRef.current[playerID] || 0;
    const [holdIndex, _setHoldIndex] = React.useState(getHoldIndex);
    const setHoldIndex = (valOrFn) => {
        _setHoldIndex(prev => {
            const next = typeof valOrFn === 'function' ? valOrFn(prev) : valOrFn;
            holdIndicesRef.current[playerID] = next;
            return next;
        });
    };
    // Restore hold index when playerID changes (debug panel switch)
    const prevPlayerID = React.useRef(playerID);
    React.useEffect(() => {
        if (playerID !== prevPlayerID.current) {
            prevPlayerID.current = playerID;
            _setHoldIndex(holdIndicesRef.current[playerID] || 0);
        }
    }, [playerID]);
    const handCardsRef = React.useRef(null);
    const [holdTrackWidth, setHoldTrackWidth] = React.useState(200);
    // Player name editing — which player ID is being edited (null = none)
    const [editingNameId, setEditingNameId] = React.useState(null);
    // Wild card sort mode: 'in-place' | 'left' | 'right'
    const [wildSortMode, setWildSortMode] = React.useState('in-place');

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

    // Measure cards container width for hold slider track
    React.useEffect(() => {
        const measure = () => {
            if (handCardsRef.current) {
                const children = handCardsRef.current.children;
                if (children.length > 0) {
                    const last = children[children.length - 1];
                    const containerLeft = handCardsRef.current.getBoundingClientRect().left;
                    const lastRight = last.getBoundingClientRect().right;
                    setHoldTrackWidth(lastRight - containerLeft);
                }
            }
        };
        measure();
        window.addEventListener('resize', measure);
        return () => window.removeEventListener('resize', measure);
    });

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
            if (tag === 'INPUT' || tag === 'TEXTAREA') return;
            const key = e.key.toLowerCase();
            const sel = selectedRef.current;

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
                const cardIndex = sel[0];
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
                moves.discardCard(sel[0]);
                setSelectedIndices([]);
            }

            // MELD ('m')
            if (key === 'm' && sel.length >= 3) {
                const selectedCards = sel.map(i => G.players[playerID].hand[i]);
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
                sel.forEach(cardIdx => doLayoff(cardIdx));
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

            // NUMBER KEYS select/deselect cards (1-9, 0=10)
            const digit = e.key === '0' ? 10 : parseInt(e.key);
            if (digit >= 1 && digit <= 10 && digit <= G.players[playerID].hand.length) {
                toggleSelect(digit - 1);
            }

            // ESCAPE cancels layoff picker
            if (key === 'Escape') {
                setLayoffPick(null);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [G, ctx, moves, playerID]);

    if (!G || !G.players) return <div>Loading...</div>;

    const player = G.players[playerID];
    const isMyTurn = ctx.currentPlayer === playerID;

    // Auto-clear selection when hand shrinks (card was played/discarded)
    // Decrement holdIndex for each card removed from the held region (left of marker)
    const prevHandLen = React.useRef(player.hand.length);
    const prevSelection = React.useRef([]);
    // Snapshot selection before it gets cleared, so we know which cards were played
    React.useEffect(() => {
        prevSelection.current = selectedRef.current.slice();
    });
    React.useEffect(() => {
        if (player.hand.length < prevHandLen.current) {
            const cardsRemoved = prevHandLen.current - player.hand.length;
            const oldHold = holdIndicesRef.current[playerID] || 0;
            // Count how many removed cards were in the held region (index < holdIndex)
            const sel = prevSelection.current;
            let heldCardsRemoved = 0;
            if (sel.length > 0 && sel.length === cardsRemoved) {
                // We know exactly which cards were removed
                heldCardsRemoved = sel.filter(i => i < oldHold).length;
            } else {
                // Fallback: clamp only (e.g. cards removed by other means)
                heldCardsRemoved = Math.max(0, oldHold - player.hand.length);
            }
            selectedRef.current = [];
            _setSelectedIndices([]);
            setLayoffPick(null);
            setHoldIndex(prev => Math.max(0, prev - heldCardsRemoved));
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
        const sortStart = holdIndex;
        if (sortStart >= hand.length) return;

        // Build index array for the sortable portion
        const sortableIndices = [];
        for (let i = sortStart; i < hand.length; i++) sortableIndices.push(i);

        // Sort: primary by rank value (low to high), secondary by suit
        // Wild cards get special rank based on wildSortMode
        const sortRank = (card) => {
            if (isWild(card, G.round)) {
                if (wildSortMode === 'left') return -1;
                if (wildSortMode === 'right') return 14;
            }
            return RANKS.indexOf(card.rank);
        };
        sortableIndices.sort((a, b) => {
            const ca = hand[a], cb = hand[b];
            const ra = sortRank(ca), rb = sortRank(cb);
            if (ra !== rb) return ra - rb;
            return SUIT_ORDER[ca.suit] - SUIT_ORDER[cb.suit];
        });

        // Second pass: reorder same-rank groups to maximize suit adjacency
        // For each group of same-rank cards, pick the permutation that best
        // connects suits with the cards before and after the group.
        let i = 0;
        while (i < sortableIndices.length) {
            let j = i;
            const rank = RANKS.indexOf(hand[sortableIndices[i]].rank);
            while (j < sortableIndices.length && RANKS.indexOf(hand[sortableIndices[j]].rank) === rank) j++;
            if (j - i > 1) {
                // Look at the suit of the card after this group (what we want to lead into)
                const nextSuit = j < sortableIndices.length ? hand[sortableIndices[j]].suit : null;
                // Look at the suit of the card before this group (what we want to continue from)
                const prevSuit = i > 0 ? hand[sortableIndices[i - 1]].suit : null;
                const group = sortableIndices.slice(i, j);
                // Sort group: put cards matching prevSuit first, then others, then matching nextSuit last
                group.sort((a, b) => {
                    const sa = hand[a].suit, sb = hand[b].suit;
                    // Card matching nextSuit goes last (to be adjacent to the next card)
                    if (sa === nextSuit && sb !== nextSuit) return 1;
                    if (sb === nextSuit && sa !== nextSuit) return -1;
                    // Card matching prevSuit goes first (to be adjacent to the previous card)
                    if (sa === prevSuit && sb !== prevSuit) return -1;
                    if (sb === prevSuit && sa !== prevSuit) return 1;
                    return SUIT_ORDER[sa] - SUIT_ORDER[sb];
                });
                for (let k = 0; k < group.length; k++) sortableIndices[i + k] = group[k];
            }
            i = j;
        }

        // Build full new order: held cards stay in place, sorted cards follow
        const newOrder = [];
        for (let i = 0; i < sortStart; i++) newOrder.push(i);
        for (const idx of sortableIndices) newOrder.push(idx);

        moves.sortHand({ newOrder });
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
                    color: 'white', padding: '20px 30px', textAlign: 'center',
                    borderBottom: '4px solid #f1c40f',
                }}>
                    <h2 style={{ margin: '0 0 10px', fontSize: '28px', letterSpacing: '3px', color: '#f1c40f' }}>
                        GAME OVER
                    </h2>
                    <div style={{ fontSize: '20px', marginBottom: '12px' }}>
                        {winners.length === 1 ? (
                            <span>{getPlayerName(winners[0])} wins!</span>
                        ) : (
                            <span>Tie: {winners.map(id => getPlayerName(id)).join(' & ')}!</span>
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
                    <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'center', gap: '10px' }}>
                        {log && props.gameSeed && (
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
                                    });
                                    downloadReplay(replayData);
                                }}
                                style={{
                                    padding: '8px 20px', borderRadius: '6px', border: '2px solid #f1c40f',
                                    background: 'transparent', color: '#f1c40f', cursor: 'pointer',
                                    fontSize: '14px', fontWeight: 'bold',
                                }}
                            >Save Replay</button>
                        )}
                    </div>
                </div>
            )}
            <div style={{ display: 'flex', fontFamily: '"Arial", sans-serif', marginRight: '310px' }}>
                {/* Main game area */}
                <div style={{ flex: 1, minWidth: 0, padding: '8px 20px 20px' }}>
                <div>
                        <div style={{ borderBottom: '2px solid #333', paddingBottom: '2px', display: 'flex', alignItems: 'stretch', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                                <div>
                                    <h1 style={{ color: '#2c3e50', margin: '0 0 1px 0', fontSize: '1.4em', textTransform: 'uppercase', letterSpacing: '2px' }}>
                                        LWD Rummy
                                    </h1>
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
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '8px', marginTop: '4px', marginBottom: '6px' }}>
                            <div style={{ background: '#eee', padding: '4px 10px', borderRadius: '6px', flex: 1, fontSize: '13px' }}>
                                <p style={{ margin: '2px 0' }}><strong>Draw Pile:</strong> {G.deck.length} cards</p>
                                <p style={{ margin: '2px 0' }}><strong>Discard Pile:</strong> {G.discardPile?.length > 0 ?
                                    <span style={{ color: SUIT_COLORS[G.discardPile[G.discardPile.length - 1].suit], fontSize: '20px', fontWeight: 'bold' }}>
                                        {G.discardPile[G.discardPile.length - 1].rank}{SUIT_ICONS[G.discardPile[G.discardPile.length - 1].suit]}
                                        <span style={{ color: '#666', fontSize: '11px', fontWeight: 'normal', marginLeft: '4px' }}>
                                            ({G.discardPile.length} cards)
                                        </span>
                                    </span> : 'Empty'}
                                </p>
                                {G.flipCount > 0 && (
                                    <p style={{ margin: '2px 0', fontSize: '11px', color: '#8e44ad' }}>
                                        <strong>Flip Shuffles:</strong> {G.flipCount}
                                    </p>
                                )}
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
                            <span style={{ flex: 1 }} />
                            <span
                                onClick={() => setWildSortMode(m => m === 'in-place' ? 'left' : m === 'left' ? 'right' : 'in-place')}
                                title={`Wild sort: ${wildSortMode === 'left' ? 'wilds sort to left' : wildSortMode === 'right' ? 'wilds sort to right' : 'wilds sort in place'}\nClick to cycle`}
                                style={{
                                    fontSize: '11px', cursor: 'pointer', userSelect: 'none',
                                    padding: '1px 6px', borderRadius: '4px', border: '1px solid #dbb',
                                    background: wildSortMode === 'in-place' ? '#f0f0f0' : '#fff9c4',
                                    color: '#666', fontWeight: 'bold',
                                }}
                            >W: {wildSortMode === 'left' ? '◀' : wildSortMode === 'right' ? '▶' : '—'} (c)</span>
                            <button
                                onClick={sortHand}
                                title="Sort hand by rank (held cards stay in place)"
                                style={{
                                    padding: '2px 8px', borderRadius: '4px', border: '1px solid #bbb',
                                    background: '#f0f0f0', color: '#555', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold',
                                }}
                            >Sort Cards (s)</button>
                        </div>
                        <div
                            style={{ background: '#f5f5f5', padding: '8px 12px', borderRadius: '8px' }}
                        >
                            <div
                                ref={handCardsRef}
                                style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'flex-start' }}
                                onDragOver={(e) => e.preventDefault()}
                            >
                                {player.hand.map((card, i) => (
                                    <div
                                        key={`card-${i}-${card.rank}-${card.suit}`}
                                        onDragOver={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            if (dragIndex !== null && dragIndex !== i) setDropTarget(i);
                                        }}
                                        onDrop={(e) => {
                                            e.preventDefault();
                                            if (dragIndex !== null && dragIndex !== i) {
                                                moves.reorderHand({ startIndex: dragIndex, endIndex: i });
                                                setSelectedIndices([]);
                                                if (holdIndex > 0) {
                                                    if (dragIndex < holdIndex && i >= holdIndex) setHoldIndex(holdIndex - 1);
                                                    else if (dragIndex >= holdIndex && i < holdIndex) setHoldIndex(holdIndex + 1);
                                                }
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
                                ))}
                            </div>
                            {/* Hold slider track — inside grey box, width matches cards */}
                            <div style={{ position: 'relative', height: '28px', marginTop: '6px', width: `${holdTrackWidth}px` }}>
                                {/* Left line (held region) — glowing */}
                                {holdIndex > 0 && (
                                    <div style={{
                                        position: 'absolute', top: '8px', left: 0,
                                        width: `${(holdIndex / player.hand.length) * 100}%`,
                                        height: '2px', background: '#e74c3c', borderRadius: '1px',
                                        boxShadow: '0 0 6px 1px rgba(231, 76, 60, 0.5)',
                                    }} />
                                )}
                                {/* Right line (sortable region) — plain grey */}
                                <div style={{
                                    position: 'absolute', top: '8px',
                                    left: `${(holdIndex / player.hand.length) * 100}%`,
                                    right: 0,
                                    height: '2px', background: '#ccc', borderRadius: '1px',
                                }} />
                                {/* Triangle marker + "Hold" label */}
                                <div style={{
                                    position: 'absolute', top: '0px',
                                    left: `${(holdIndex / player.hand.length) * 100}%`,
                                    transform: 'translateX(-6px)',
                                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                                    pointerEvents: 'none',
                                }}>
                                    {/* Up-facing triangle, centered on line (top=9px is line center, triangle is 12px tall, so top=3px) */}
                                    <div style={{
                                        width: 0, height: 0,
                                        borderLeft: '6px solid transparent',
                                        borderRight: '6px solid transparent',
                                        borderBottom: `12px solid ${holdIndex > 0 ? '#e74c3c' : '#bbb'}`,
                                        marginTop: '3px',
                                    }} />
                                    {holdIndex > 0 && (
                                        <span style={{
                                            fontSize: '7px', fontWeight: 'bold',
                                            color: '#e74c3c', marginTop: '1px',
                                            lineHeight: 1, whiteSpace: 'nowrap',
                                        }}>Hold</span>
                                    )}
                                </div>
                                {/* Invisible range input on top for interaction */}
                                <input
                                    type="range"
                                    min={0}
                                    max={player.hand.length}
                                    value={holdIndex}
                                    onChange={(e) => setHoldIndex(Number(e.target.value))}
                                    title={holdIndex > 0 ? `${holdIndex} held · ${player.hand.length - holdIndex} sortable` : 'Slide right to hold cards from sorting'}
                                    style={{
                                        position: 'absolute', top: 0, left: '-6px',
                                        width: 'calc(100% + 12px)', height: '28px',
                                        appearance: 'none', WebkitAppearance: 'none',
                                        background: 'transparent', cursor: 'pointer', margin: 0,
                                        opacity: 0,
                                    }}
                                />
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
                                            moves.discardCard(safeSelection[0]);
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
                                            const sel = selectedRef.current.filter(i => i < G.players[playerID].hand.length);
                                            if (sel.length < 3) return;
                                            const selectedCards = sel.map(i => G.players[playerID].hand[i]);
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
                                            const sel = selectedRef.current.filter(i => i < G.players[playerID].hand.length);
                                            if (sel.length === 0 || !isMyTurn) return;
                                            sel.forEach(cardIdx => doLayoff(cardIdx));
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
                                            const sel = selectedRef.current.filter(i => i < G.players[playerID].hand.length);
                                            if (sel.length !== 1 || !isMyTurn) return;
                                            const cardIndex = sel[0];
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
                            <span>n=draw pile · o=discard pile · d=discard · m=meld · l=lay off · w=wild swap · u=undo · s=sort · c=cycle wild sort</span>
                            {log && props.gameSeed && (
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
                                        });
                                        downloadReplay(replayData);
                                    }}
                                    style={{ padding: '2px 8px', borderRadius: '3px', border: '1px solid #bbb', background: '#f0f0f0', color: '#555', cursor: 'pointer', fontSize: '10px' }}
                                >Save Replay</button>
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
                                <span>— click a green [+] on a valid meld</span>
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
                                            {pickStartTarget && (
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
                                                        fontSize: '16px', fontWeight: 'bold', lineHeight: 1,
                                                    }}
                                                    title="Place card here (start)"
                                                >+</button>
                                            )}
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
                                            {pickEndTarget && (
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
                                                        fontSize: '16px', fontWeight: 'bold', lineHeight: 1,
                                                    }}
                                                    title="Place card here (end)"
                                                >+</button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Scoreboard flyout tab — positioned on the right edge */}
                {!(scoreDrawerOpen || scoreDrawerLocked) && (
                    <div
                        onClick={() => setScoreDrawerOpen(true)}
                        title="Open Scoreboard"
                        style={{
                            position: 'fixed', right: '310px', top: '120px', zIndex: 10,
                            width: '24px', height: '48px', cursor: 'pointer',
                            background: '#3498db', borderRadius: '6px 0 0 6px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                    >
                        <span style={{ color: 'white', fontSize: '16px', lineHeight: 1 }}>&#9664;</span>
                    </div>
                )}

                {/* Draggable divider + Scoreboard panel */}
                {(scoreDrawerOpen || scoreDrawerLocked) && (
                    <>
                        {/* Draggable divider */}
                        <div
                            onMouseDown={(e) => {
                                e.preventDefault();
                                isDraggingDivider.current = true;
                                const startX = e.clientX;
                                const startWidth = scoreboardWidth;
                                const onMouseMove = (ev) => {
                                    if (!isDraggingDivider.current) return;
                                    const delta = startX - ev.clientX;
                                    setScoreboardWidth(Math.max(300, Math.min(900, startWidth + delta)));
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
                                onClick={() => { setScoreDrawerOpen(false); setScoreDrawerLocked(false); }}
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
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                <h3 style={{ margin: 0 }}>Scoreboard</h3>
                                <button
                                    onClick={() => setScoreDrawerLocked(prev => !prev)}
                                    title={scoreDrawerLocked ? 'Unlock scoreboard' : 'Lock scoreboard open'}
                                    style={{
                                        padding: '4px 10px', borderRadius: '4px', border: '1px solid #ddd',
                                        background: scoreDrawerLocked ? '#f39c12' : '#f0f0f0',
                                        color: scoreDrawerLocked ? 'white' : '#555',
                                        cursor: 'pointer', fontSize: '13px',
                                    }}
                                >{scoreDrawerLocked ? '🔒' : '📌'}</button>
                            </div>
                            <Scoreboard G={G} numPlayers={ctx.numPlayers} playerNames={G.playerNames} currentPlayer={ctx.currentPlayer}
                                onRename={(id) => startEditName(String(id))}
                                editingNameId={editingNameId}
                                nameInputRef={nameInputRef}
                                onCommitName={(id) => commitName(String(id))}
                                onCancelEdit={() => setEditingNameId(null)}
                            />
                        </div>
                    </>
                )}
            </div>
        </ErrorBoundary>
    );
};

const Lobby = ({ onStart, onReplay }) => {
    const fileInputRef = React.useRef(null);
    const [players, setPlayers] = React.useState([
        { name: '' },
        { name: '' },
    ]);
    const [rules, setRules] = React.useState({ allowAdjacentWilds: false, allowLargeSets: false, mustPlayDiscardPickup: false, hintLayoff: false, hintSwapWild: false });

    const addPlayer = () => {
        if (players.length < 8) setPlayers([...players, { name: '' }]);
    };
    const removePlayer = (idx) => {
        if (players.length > 2) setPlayers(players.filter((_, i) => i !== idx));
    };
    const updateName = (idx, name) => {
        setPlayers(players.map((p, i) => i === idx ? { ...p, name } : p));
    };

    return (
        <div style={{ padding: '40px', fontFamily: '"Arial", sans-serif', maxWidth: '500px', margin: '0 auto' }}>
            <h1 style={{ color: '#2c3e50', textTransform: 'uppercase', letterSpacing: '2px', textAlign: 'center' }}>
                LWD Rummy
            </h1>
            <h2 style={{ color: '#666', textAlign: 'center', fontWeight: 'normal' }}>Game Setup</h2>

            <div style={{ background: '#f8f9fa', padding: '20px', borderRadius: '10px', marginBottom: '20px' }}>
                <h3 style={{ margin: '0 0 15px 0' }}>Players ({players.length})</h3>
                {players.map((p, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                        <span style={{ width: '24px', fontWeight: 'bold', color: '#999', textAlign: 'right' }}>{i}</span>
                        <input
                            type="text"
                            placeholder={`Player ${i}`}
                            value={p.name}
                            onChange={(e) => updateName(i, e.target.value)}
                            maxLength={25}
                            style={{
                                flex: 1, padding: '8px 12px', border: '1px solid #ddd', borderRadius: '6px',
                                fontSize: '14px', outline: 'none',
                            }}
                            onFocus={(e) => e.target.style.borderColor = '#3498db'}
                            onBlur={(e) => e.target.style.borderColor = '#ddd'}
                        />
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
                    onStart({ numPlayers: players.length, playerNames, rules });
                }}
                style={{
                    width: '100%', padding: '14px', border: 'none', borderRadius: '8px',
                    background: '#27ae60', color: 'white', fontSize: '18px', fontWeight: 'bold',
                    cursor: 'pointer', letterSpacing: '1px', textTransform: 'uppercase',
                }}
            >Start Game</button>

            {import.meta.env.DEV && onReplay && (
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
                            width: '100%', padding: '12px', border: '2px dashed #888', borderRadius: '8px',
                            background: 'transparent', color: '#888', fontSize: '14px', fontWeight: 'bold',
                            cursor: 'pointer', marginTop: '12px',
                        }}
                    >Replay Prior Game</button>
                </>
            )}
        </div>
    );
};

const ReplayBoard = ({ replayData, onExit }) => {
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
                        />
                    </div>
                </div>
            </div>
        );
    }

    // Replay mode
    const state = engine.getState();
    if (!state) return <div>Loading replay...</div>;

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
                    />
                </div>
            </div>
        </div>
    );
};

const App = () => {
    const [gameConfig, setGameConfig] = React.useState(null);
    const [replayData, setReplayData] = React.useState(null);
    const clientRef = React.useRef(null);
    const seedRef = React.useRef(null);

    if (replayData) {
        return <ReplayBoard replayData={replayData} onExit={() => { setReplayData(null); clientRef.current = null; }} />;
    }

    if (!gameConfig) {
        return <Lobby onStart={setGameConfig} onReplay={setReplayData} />;
    }

    if (!clientRef.current) {
        const seed = Date.now().toString(36).slice(-10);
        seedRef.current = seed;
        const game = createGame({
            rules: gameConfig.rules,
            playerNames: gameConfig.playerNames,
            seed,
        });
        clientRef.current = Client({
            game,
            board: Board,
            numPlayers: gameConfig.numPlayers,
            debug: true,
        });
    }

    const GameClient = clientRef.current;
    return (
        <div>
            <GameClient playerID="0" gameSeed={seedRef.current} />
        </div>
    );
};

export default App;
