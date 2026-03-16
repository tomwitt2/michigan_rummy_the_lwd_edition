import { isWild, analyzeRun, RANKS } from '../game/logic';

export const SUIT_ICONS = { H: '♥', D: '♦', C: '♣', S: '♠' };
export const SUIT_COLORS = { H: '#e74c3c', D: '#e74c3c', C: '#2c3e50', S: '#2c3e50' };

export const Card = ({ card, selected, onClick, wild, selectionIndex, highlighted, pinned, onTogglePin, draggable, onDragStart, onDragEnd }) => (
    <div
        draggable={draggable}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onClick={onClick}
        style={{
            width: '65px',
            height: '95px',
            border: selected ? '3px solid #3498db' : pinned ? '2px solid #e67e22' : highlighted ? '3px solid #1abc9c' : '1px solid #ccc',
            borderRadius: '6px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: highlighted ? '#e8f8f5' : wild ? '#fff9c4' : 'white',
            cursor: draggable ? 'grab' : 'pointer',
            userSelect: 'none',
            boxShadow: selected ? '0 0 8px #3498db' : highlighted ? '0 0 8px rgba(26,188,156,0.6)' : 'none',
            position: 'relative',
            transition: 'all 0.1s ease',
            transform: selected ? 'translateY(-5px)' : 'none'
        }}
    >
        {onTogglePin && (
            <div
                onClick={(e) => { e.stopPropagation(); onTogglePin(); }}
                title={pinned ? 'Unpin card' : 'Pin card (excluded from sorting)'}
                style={{
                    position: 'absolute',
                    top: '2px',
                    left: '2px',
                    fontSize: '12px',
                    cursor: 'pointer',
                    opacity: pinned ? 1 : 0.25,
                    transition: 'opacity 0.15s',
                    lineHeight: 1,
                    zIndex: 5,
                }}
                onMouseEnter={(e) => { if (!pinned) e.currentTarget.style.opacity = '0.7'; }}
                onMouseLeave={(e) => { if (!pinned) e.currentTarget.style.opacity = '0.25'; }}
            >📌</div>
        )}
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
export const getInferredRank = (meld, cardIndex, round) => {
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
