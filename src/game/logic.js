/**
 * LWD Rummy logic for boardgame.io
 */

export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
export const SUITS = ['H', 'D', 'C', 'S'];

function createDeck() {
    const deck = [];
    for (const suit of SUITS) {
        for (const rank of RANKS) {
            deck.push({ rank, suit });
        }
    }
    return deck;
}

export function getCardValue(card, roundIndex) {
    if (isWild(card, roundIndex)) return 25;
    if (card.rank === 'A') return 1;
    if (['J', 'Q', 'K'].includes(card.rank)) return 10;
    return parseInt(card.rank) || 10; // '10' rank is already handled or returns NaN -> 10
}

export function isWild(card, roundIndex) {
    const wildRank = RANKS[roundIndex % 13];
    return card.rank === wildRank;
}

export function isValidSet(cards, roundIndex, rules = {}) {
    if (cards.length < 3) return false;

    // Determine target rank from non-wild-ranked cards.
    // Wild-ranked cards matching the target rank are treated as naturals.
    const wildRank = RANKS[roundIndex % 13];
    let targetRank = null;
    for (const c of cards) {
        if (c.rank !== wildRank) {
            if (targetRank === null) targetRank = c.rank;
            else if (c.rank !== targetRank) return false;
        }
    }
    // If all cards are wild-ranked, they all share that rank → naturals
    if (targetRank === null) targetRank = wildRank;

    const naturals = [];
    const wilds = [];
    for (const c of cards) {
        if (c.rank === targetRank) {
            naturals.push(c); // natural (including wild-ranked cards matching the set rank)
        } else if (c.rank === wildRank) {
            wilds.push(c); // wild-ranked but different rank than target
        } else {
            return false; // non-wild card that doesn't match
        }
    }

    // Wild Density: Wilds <= Natural
    if (wilds.length > naturals.length) return false;

    if (!rules.allowLargeSets) {
        // Standard: max 4 cards (one per suit), no duplicate suits among naturals
        if (cards.length > 4) return false;
        const suits = naturals.map(c => c.suit);
        if (new Set(suits).size !== suits.length) return false;
    }

    return true;
}

/**
 * Analyze a run in a specific card order.
 * Wild-ranked cards that fit naturally (correct rank AND suit for their position)
 * are treated as naturals rather than wilds.
 *
 * Returns null if invalid, or { suit, startValue, roles, naturals, wilds }
 * where roles[i] = 'natural' | 'wild' for each card.
 */
export function analyzeRun(cards, roundIndex) {
    const wildRank = RANKS[roundIndex % 13];

    // Find suit and anchor from non-wild-ranked cards
    let suit = null;
    let anchorIdx = -1;
    let anchorValue = -1;

    for (let i = 0; i < cards.length; i++) {
        if (cards[i].rank !== wildRank) {
            const s = cards[i].suit;
            if (suit === null) suit = s;
            else if (s !== suit) return null; // mixed suits
            if (anchorIdx === -1) {
                anchorIdx = i;
                anchorValue = RANKS.indexOf(cards[i].rank);
            }
        }
    }

    // If all cards are wild-ranked they share the same rank → can't form a run
    if (suit === null) {
        // Unless they have different suits and there's exactly one suit...
        // Actually all same rank can never be a sequence, so:
        return null;
    }

    const startValue = anchorValue - anchorIdx;
    if (startValue < 0) return null;

    const roles = [];
    let naturals = 0, wilds = 0;

    for (let i = 0; i < cards.length; i++) {
        const expected = startValue + i;
        if (expected > 12) return null;

        if (cards[i].rank === wildRank) {
            // Can this wild-ranked card serve as natural here?
            if (RANKS.indexOf(cards[i].rank) === expected && cards[i].suit === suit) {
                roles.push('natural');
                naturals++;
            } else {
                roles.push('wild');
                wilds++;
            }
        } else {
            if (RANKS.indexOf(cards[i].rank) !== expected) return null;
            roles.push('natural');
            naturals++;
        }
    }

    if (wilds > naturals) return null; // density
    return { suit, startValue, roles, naturals, wilds };
}

/**
 * Normalize a run's card order so cards are in ascending sequence.
 */
export function normalizeRunOrder(cards, roundIndex) {
    if (analyzeRun(cards, roundIndex)) return cards;
    const reversed = [...cards].reverse();
    if (analyzeRun(reversed, roundIndex)) return reversed;
    return cards; // fallback
}

export function isValidRun(cards, roundIndex, rules = {}) {
    if (cards.length < 3) return false;

    function tryOrder(orderedCards) {
        const analysis = analyzeRun(orderedCards, roundIndex);
        if (!analysis) return false;

        // Adjacent wilds check (only cards used AS wilds)
        if (!rules.allowAdjacentWilds) {
            for (let i = 0; i < orderedCards.length - 1; i++) {
                if (analysis.roles[i] === 'wild' && analysis.roles[i + 1] === 'wild') {
                    return false;
                }
            }
        }
        return true;
    }

    return tryOrder(cards) || tryOrder([...cards].reverse());
}

export const LWDRummyBase = {
    name: 'lwd-rummy',

    setup: ({ ctx, random }) => {
        const numDecks = Math.ceil(ctx.numPlayers / 5);
        const deckParts = Array.from({ length: numDecks }, () => createDeck());
        const deck = random.Shuffle(deckParts.flat());
        const players = {};
        for (let i = 0; i < ctx.numPlayers; i++) {
            // First player (0) gets 8 cards, others get 7
            const count = i === 0 ? 8 : 7;
            players[i] = {
                hand: deck.splice(0, count),
                isOnBoard: false,
                score: 0,
            };
        }

        return {
            deck,
            discardPile: [],
            players,
            board: [],
            round: 0,
            hasDrawn: false,
            isFirstTurn: true,
            scoreHistory: [],
            playedMeldsIndices: [], // Track melds created in the current turn
            flipCount: 0,
            flipHistory: [], // flipCount per completed round (for debug)
            votes: {}, // maps playerID -> boolean
            nextRoundStarter: null,
            drewFromDiscard: false,
            mustMeldAfterDiscard: false,
            playedCardThisTurn: false,
            discardDrawnCard: null,
            turnUndoStack: [],
        };
    },

    moves: {
        drawCard: ({ G, ctx, random }, fromDeck = true) => {
            if (G.hasDrawn || G.isFirstTurn) return;

            if (fromDeck) {
                if (G.deck.length === 0) {
                    // FLIP SHUFFLE
                    if (G.discardPile.length <= 1) return; // Nothing to flip
                    const topCard = G.discardPile.pop();
                    G.deck = random.Shuffle([...G.discardPile]);
                    G.discardPile = [topCard];
                    G.flipCount++;
                }
                const card = G.deck.pop();
                if (!card) return;
                G.players[ctx.currentPlayer].hand.push(card);
                G.hasDrawn = true;
            } else {
                if (!G.discardPile || G.discardPile.length === 0) return;
                const card = G.discardPile.pop();
                G.players[ctx.currentPlayer].hand.push(card);
                G.hasDrawn = true;
                G.drewFromDiscard = true;
                G.mustMeldAfterDiscard = !!(G.rules && G.rules.mustPlayDiscardPickup);
                if (G.mustMeldAfterDiscard) {
                    G.discardDrawnCard = card;
                }
            }
        },

        setPlayerName: ({ G }, { id, name }) => {
            if (name && typeof name === 'string') {
                G.playerNames[String(id)] = name.trim().slice(0, 25);
            }
        },

        undoDiscardDraw: ({ G, ctx }) => {
            // Only allowed when must-play-discard rule is active and no card has been played yet
            if (!G.mustMeldAfterDiscard || G.playedCardThisTurn) return;
            if (!G.discardDrawnCard) return;

            const player = G.players[ctx.currentPlayer];
            const drawn = G.discardDrawnCard;
            const idx = player.hand.findIndex(c => c.rank === drawn.rank && c.suit === drawn.suit);
            if (idx === -1) return;

            // Put it back on the discard pile and reset draw state
            player.hand.splice(idx, 1);
            G.discardPile.push(drawn);
            G.hasDrawn = false;
            G.drewFromDiscard = false;
            G.mustMeldAfterDiscard = false;
            G.discardDrawnCard = null;
        },

        undoLastAction: ({ G, ctx }) => {
            if (G.turnUndoStack.length === 0) return;
            const snapshot = G.turnUndoStack.pop();
            const player = G.players[ctx.currentPlayer];
            player.hand = snapshot.hand;
            G.board = snapshot.board;
            G.playedCardThisTurn = snapshot.playedCardThisTurn;
        },

        voteEndRound: ({ G, ctx }, { voterID } = {}) => {
            if (G.flipCount === 0) return;
            // Allow specifying a voter (for bot auto-votes), default to current player
            const pid = voterID != null ? String(voterID) : ctx.currentPlayer;
            G.votes[pid] = !G.votes[pid];

            // Majority Check
            const totalVotes = Object.values(G.votes).filter(v => v).length;
            if (totalVotes > ctx.numPlayers / 2) {
                G.forceEndRound = true;
            }
        },

        playMeld: ({ G, ctx, events }, melds) => {
            const player = G.players[ctx.currentPlayer];

            // Must draw unless it's the very first turn of the round (P0 with 8 cards)
            if (!G.hasDrawn && !G.isFirstTurn) return;

            // Normalize: Ensure melds is an array, even if a single object was passed
            const meldList = Array.isArray(melds) ? melds : (melds ? [melds] : []);

            const validMelds = meldList.filter(m =>
                (m && m.type === 'set' && isValidSet(m.cards, G.round, G.rules)) ||
                (m && m.type === 'run' && isValidRun(m.cards, G.round, G.rules))
            );

            if (validMelds.length > 0) {
                player.isOnBoard = true;
                validMelds.forEach(meld => {
                    const newIndex = G.board.length;
                    // Deep copy meld to avoid mutating frozen action payload on replay
                    const boardMeld = {
                        ...meld,
                        owner: ctx.currentPlayer,
                        cards: meld.type === 'run' ? normalizeRunOrder([...meld.cards], G.round) : [...meld.cards],
                    };
                    G.board.push(boardMeld);
                    G.playedMeldsIndices.push(newIndex);
                    G.playedCardThisTurn = true;

                    meld.cards.forEach(card => {
                        const index = player.hand.findIndex(c => c.rank === card.rank && c.suit === card.suit);
                        if (index !== -1) player.hand.splice(index, 1);
                    });
                });

                // If hand is empty, end the turn (triggers round-end scoring)
                if (player.hand.length === 0) {
                    G.isFirstTurn = false;
                    events.endTurn();
                }
            }
        },

        retractMeld: ({ G, ctx }, meldIndex) => {
            if (!G.playedMeldsIndices.includes(meldIndex)) return;

            const player = G.players[ctx.currentPlayer];
            const meld = G.board[meldIndex];

            // Return cards to hand
            player.hand.push(...meld.cards);

            // Remove from board
            G.board.splice(meldIndex, 1);

            // Re-index remaining playedMeldsIndices
            G.playedMeldsIndices = G.playedMeldsIndices
                .filter(i => i !== meldIndex)
                .map(i => i > meldIndex ? i - 1 : i);

            // Check if player is still "on board" (has any other melds left)
            // This is simplified; real rummy might require you to stay on if you've already melded before.
            // But if it's the *initial* turn and you retract everything, you're not on board.
            // However, the rules usually say once you're on, you're on. 
            // We'll leave isOnBoard=true for simplicity unless the user specifies otherwise.
        },

        layOff: ({ G, ctx, events }, { cardIndex, meldIndex, position }) => {
            const player = G.players[ctx.currentPlayer];
            if (!player.isOnBoard) return;
            if (!G.hasDrawn && !G.isFirstTurn) return;
            if (cardIndex >= player.hand.length) return;

            const card = player.hand[cardIndex];
            const meld = G.board[meldIndex];
            const newCards = position === 'start' ? [card, ...meld.cards] : [...meld.cards, card];
            const valid = meld.type === 'set' ? isValidSet(newCards, G.round, G.rules) : isValidRun(newCards, G.round, G.rules);

            if (valid) {
                // Snapshot before mutation for undo support
                G.turnUndoStack.push({
                    hand: JSON.parse(JSON.stringify(player.hand)),
                    board: JSON.parse(JSON.stringify(G.board)),
                    playedCardThisTurn: G.playedCardThisTurn,
                    action: 'layOff',
                });

                player.hand.splice(cardIndex, 1);
                G.board[meldIndex].cards = meld.type === 'run'
                    ? normalizeRunOrder(newCards, G.round)
                    : newCards;
                G.playedCardThisTurn = true;

                // If hand is empty, end the turn (triggers round-end scoring)
                if (player.hand.length === 0) {
                    G.isFirstTurn = false;
                    events.endTurn();
                }
            }
        },

        swapWild: ({ G, ctx }, { cardIndex, meldIndex, cardInMeldIndex }) => {
            const player = G.players[ctx.currentPlayer];
            if (!player.isOnBoard) return;
            if (!G.hasDrawn && !G.isFirstTurn) return;

            const naturalCard = player.hand[cardIndex];
            const wildCard = G.board[meldIndex].cards[cardInMeldIndex];

            if (isWild(wildCard, G.round)) {
                const meld = G.board[meldIndex];

                // Skip wild-ranked cards serving as naturals in runs
                if (meld.type === 'run') {
                    const roles = analyzeRun(meld.cards, G.round)?.roles;
                    if (roles && roles[cardInMeldIndex] === 'natural') return;
                }

                // The swap card must match what the wild represents:
                // Set: must match the set's rank
                // Run: must match the expected rank AND suit at that position
                if (meld.type === 'set') {
                    const targetRank = meld.cards.find(c => !isWild(c, G.round))?.rank;
                    if (targetRank && naturalCard.rank !== targetRank) return;
                } else {
                    const analysis = analyzeRun(meld.cards, G.round);
                    if (analysis) {
                        const expectedRankIdx = analysis.startValue + cardInMeldIndex;
                        if (RANKS.indexOf(naturalCard.rank) !== expectedRankIdx) return;
                        if (naturalCard.suit !== analysis.suit) return;
                    }
                }

                // Snapshot before any mutation for undo support
                const undoSnapshot = {
                    hand: JSON.parse(JSON.stringify(player.hand)),
                    board: JSON.parse(JSON.stringify(G.board)),
                    playedCardThisTurn: G.playedCardThisTurn,
                    action: 'swapWild',
                };

                G.board[meldIndex].cards[cardInMeldIndex] = naturalCard;
                G.turnUndoStack.push(undoSnapshot);
                if (G.board[meldIndex].type === 'run') {
                    G.board[meldIndex].cards = normalizeRunOrder(G.board[meldIndex].cards, G.round);
                }
                player.hand.splice(cardIndex, 1, wildCard);
                G.playedCardThisTurn = true;
            }
        },

        reorderHand: ({ G, ctx }, { startIndex, endIndex }) => {
            const player = G.players[ctx.currentPlayer];
            const [removed] = player.hand.splice(startIndex, 1);
            player.hand.splice(endIndex, 0, removed);
        },

        sortHand: ({ G, ctx }, { newOrder }) => {
            const player = G.players[ctx.currentPlayer];
            if (newOrder.length !== player.hand.length) return;
            const reordered = newOrder.map(i => player.hand[i]);
            player.hand = reordered;
        },

        discardCard: ({ G, ctx, events }, cardIndex) => {
            if (!G.hasDrawn && !G.isFirstTurn) return;
            // If drew from discard and rule requires immediate play, must play a card first
            if (G.mustMeldAfterDiscard && !G.playedCardThisTurn) return;

            if (cardIndex < G.players[ctx.currentPlayer].hand.length) {
                const card = G.players[ctx.currentPlayer].hand.splice(cardIndex, 1)[0];
                G.discardPile.push(card);
                G.isFirstTurn = false;
                events.endTurn();
            }
        },
    },

    turn: {
        minMoves: 1,
        order: {
            first: ({ G, ctx }) => G.round % ctx.numPlayers,
            next: ({ G, ctx }) => {
                // nextRoundStarter is set in onEnd during round transitions;
                // cleared in onBegin (which receives a mutable Immer draft).
                // Do NOT modify G here — it may be frozen.
                if (G.nextRoundStarter != null) {
                    return G.nextRoundStarter;
                }
                return (ctx.playOrderPos + 1) % ctx.numPlayers;
            },
        },
        onBegin: ({ G }) => {
            G.hasDrawn = false;
            G.playedMeldsIndices = [];
            G.forceEndRound = false;
            G.nextRoundStarter = null;
            G.drewFromDiscard = false;
            G.mustMeldAfterDiscard = false;
            G.playedCardThisTurn = false;
            G.discardDrawnCard = null;
            G.turnUndoStack = [];
        },
        onEnd: ({ G, ctx, random, events }) => {
            const isWinner = G.players[ctx.currentPlayer].hand.length === 0;
            const isVotedOut = G.forceEndRound;

            if (isWinner || isVotedOut) {
                const roundResults = {
                    round: G.round,
                    scores: {},
                    winner: isWinner ? ctx.currentPlayer : 'None (Vote)',
                    dealer: (G.round) % ctx.numPlayers
                };

                for (let id in G.players) {
                    const points = G.players[id].hand.reduce((acc, card) => acc + getCardValue(card, G.round), 0);
                    G.players[id].score += points;
                    roundResults.scores[id] = points;
                    roundResults.remainingHands = roundResults.remainingHands || {};
                    roundResults.remainingHands[id] = [...G.players[id].hand];
                }

                G.scoreHistory.push(roundResults);
                G.flipHistory.push(G.flipCount);

                if (G.round < 12) {
                    G.round++;
                    const numDecks = Math.ceil(ctx.numPlayers / 5);
                    const deckParts = Array.from({ length: numDecks }, () => createDeck());
                    const deck = random.Shuffle(deckParts.flat());
                    // First player for round R = R % numPlayers (consistent with setup)
                    const firstPlayer = G.round % ctx.numPlayers;
                    for (let id in G.players) {
                        const count = id === String(firstPlayer) ? 8 : 7;
                        G.players[id].hand = deck.splice(0, count);
                        G.players[id].isOnBoard = false;
                    }
                    G.deck = deck;
                    G.discardPile = [];
                    G.board = [];
                    G.hasDrawn = false;
                    G.isFirstTurn = true;
                    G.playedMeldsIndices = [];
                    G.flipCount = 0;
                    G.votes = {};
                    G.forceEndRound = false;
                    G.nextRoundStarter = G.round % ctx.numPlayers;
                } else {
                    // Final round — determine winner(s) by lowest score
                    const scores = Object.entries(G.players).map(([id, p]) => ({ id, score: p.score }));
                    const minScore = Math.min(...scores.map(s => s.score));
                    const winners = scores.filter(s => s.score === minScore).map(s => s.id);
                    events.endGame({ winner: winners.length === 1 ? winners[0] : winners });
                }
            }
        }
    },
};

// Keep backward-compatible export
export const LWDRummy = LWDRummyBase;

export function createGame(gameOptions = {}) {
    const gameRules = gameOptions.rules || { allowAdjacentWilds: false, allowLargeSets: false, mustPlayDiscardPickup: false, hintLayoff: false, hintSwapWild: false };
    const gamePlayerNames = gameOptions.playerNames || {};

    const result = {
        ...LWDRummyBase,
        setup: ({ ctx, random }) => {
            const baseState = LWDRummyBase.setup({ ctx, random });
            return { ...baseState, rules: gameRules, playerNames: gamePlayerNames };
        },
    };
    // Pass seed through for deterministic replay
    if (gameOptions.seed) {
        result.seed = gameOptions.seed;
    }
    return result;
}
