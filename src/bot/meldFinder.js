/**
 * Meld-finding algorithms for bot players.
 *
 * All candidate melds are validated through the game's own
 * isValidSet / isValidRun functions to guarantee correctness.
 */

import { RANKS, SUITS, isWild, isValidSet, isValidRun, getCardValue } from '../game/logic.js';

// ─── helpers ────────────────────────────────────────────────

/** Card identity string for deduplication */
function cardKey(card) {
    return `${card.rank}${card.suit}`;
}

/** Check if two card arrays share any card (by index in hand) */
function overlaps(indicesA, indicesB) {
    return indicesA.some(i => indicesB.includes(i));
}

// ─── SET finding ────────────────────────────────────────────

/**
 * Find all valid sets in hand.
 * Returns array of { type: 'set', cards: [...], indices: [...] }
 */
export function findAllSets(hand, roundIndex, rules = {}) {
    const results = [];
    const wildRank = RANKS[roundIndex % 13];

    // Group hand indices by rank
    const byRank = {};
    const wildIndices = [];
    for (let i = 0; i < hand.length; i++) {
        const card = hand[i];
        if (card.rank === wildRank) {
            // Wild-ranked cards: could be natural in a set of their own rank, or wild elsewhere
            wildIndices.push(i);
        }
        if (!byRank[card.rank]) byRank[card.rank] = [];
        byRank[card.rank].push(i);
    }

    for (const rank of RANKS) {
        const rankIndices = byRank[rank] || [];
        if (rankIndices.length === 0) continue;

        // Natural cards of this rank (includes wild-ranked cards that match this rank)
        const naturalIndices = rankIndices.filter(i => hand[i].rank === rank);

        // Available wilds (wild-ranked cards NOT of this rank)
        const availableWilds = wildIndices.filter(i => hand[i].rank !== rank);

        // Try sets of size 3 and 4 (or larger if rules allow)
        const maxSize = rules.allowLargeSets ? naturalIndices.length + availableWilds.length : 4;

        // Generate combinations of naturals
        const naturalCombos = combinations(naturalIndices, Math.min(naturalIndices.length, maxSize));

        for (const natCombo of naturalCombos) {
            // Try adding 0..N wilds
            const maxWilds = Math.min(availableWilds.length, natCombo.length); // density rule
            for (let nw = 0; nw <= maxWilds; nw++) {
                const total = natCombo.length + nw;
                if (total < 3) continue;
                if (!rules.allowLargeSets && total > 4) continue;

                // Pick first nw wilds
                const wildCombo = availableWilds.slice(0, nw);
                const indices = [...natCombo, ...wildCombo];
                const cards = indices.map(i => hand[i]);

                if (isValidSet(cards, roundIndex, rules)) {
                    results.push({ type: 'set', cards, indices });
                }
            }
        }
    }

    return results;
}

// ─── RUN finding ────────────────────────────────────────────

/**
 * Find all valid runs in hand.
 * Returns array of { type: 'run', cards: [...], indices: [...] }
 */
export function findAllRuns(hand, roundIndex, rules = {}) {
    const results = [];
    const wildRank = RANKS[roundIndex % 13];

    // Group hand indices by suit (non-wild cards only)
    const bySuit = { H: [], D: [], C: [], S: [] };
    const wildIndices = [];

    for (let i = 0; i < hand.length; i++) {
        const card = hand[i];
        if (card.rank === wildRank && !(card.suit in bySuit && RANKS.indexOf(card.rank) >= 0)) {
            // This is a wild card — but it could also be natural in a run of its own suit
            // We'll handle that by including it in its suit group too
        }
        bySuit[card.suit].push(i);
        if (card.rank === wildRank) {
            wildIndices.push(i);
        }
    }

    for (const suit of SUITS) {
        const suitIndices = bySuit[suit];
        if (suitIndices.length === 0) continue;

        // Sort by rank value
        const sorted = suitIndices
            .map(i => ({ idx: i, val: RANKS.indexOf(hand[i].rank) }))
            .sort((a, b) => a.val - b.val);

        // Available wilds from OTHER suits (to use as actual wilds in this suit's run)
        const otherWilds = wildIndices.filter(i => hand[i].suit !== suit);

        // Try all starting positions and lengths
        for (let startPos = 0; startPos < sorted.length; startPos++) {
            const startVal = sorted[startPos].val;

            // Build a run starting from startVal, collecting cards and inserting wilds for gaps
            for (let runLen = 3; runLen <= 13; runLen++) {
                const endVal = startVal + runLen - 1;
                if (endVal > 12) break;

                const runIndices = [];
                const usedWilds = [];
                let valid = true;

                for (let v = startVal; v <= endVal; v++) {
                    // Find a card in this suit at this rank value
                    const match = sorted.find(s =>
                        s.val === v && !runIndices.includes(s.idx) && !usedWilds.includes(s.idx)
                    );
                    if (match) {
                        runIndices.push(match.idx);
                    } else {
                        // Try to fill with an other-suit wild
                        const wild = otherWilds.find(i => !runIndices.includes(i) && !usedWilds.includes(i));
                        if (wild !== undefined) {
                            runIndices.push(wild);
                            usedWilds.push(wild);
                        } else {
                            valid = false;
                            break;
                        }
                    }
                }

                if (!valid) break; // can't extend further
                if (runIndices.length < 3) continue;

                const cards = runIndices.map(i => hand[i]);
                if (isValidRun(cards, roundIndex, rules)) {
                    results.push({ type: 'run', cards, indices: runIndices });
                }
            }
        }
    }

    return results;
}

// ─── Optimal meld combination ───────────────────────────────

/**
 * Find the best non-overlapping combination of melds that uses the most cards.
 * Uses greedy approach: sort by card count descending, pick non-overlapping.
 */
export function findBestMeldCombination(allMelds) {
    // Sort by number of cards descending
    const sorted = [...allMelds].sort((a, b) => b.indices.length - a.indices.length);

    const selected = [];
    const usedIndices = new Set();

    for (const meld of sorted) {
        if (meld.indices.some(i => usedIndices.has(i))) continue;
        selected.push(meld);
        meld.indices.forEach(i => usedIndices.add(i));
    }

    return selected;
}

// ─── Layoff finding ─────────────────────────────────────────

/**
 * Find all valid layoff options for cards in hand onto board melds.
 * Returns array of { cardIndex, meldIndex, position: 'start'|'end' }
 */
export function findLayoffOptions(hand, board, roundIndex, rules = {}) {
    const options = [];

    for (let cardIdx = 0; cardIdx < hand.length; cardIdx++) {
        const card = hand[cardIdx];
        for (let meldIdx = 0; meldIdx < board.length; meldIdx++) {
            const meld = board[meldIdx];

            // Try adding to start
            const withStart = [card, ...meld.cards];
            if (meld.type === 'set' ? isValidSet(withStart, roundIndex, rules)
                : isValidRun(withStart, roundIndex, rules)) {
                options.push({ cardIndex: cardIdx, meldIndex: meldIdx, position: 'start' });
            }

            // Try adding to end
            const withEnd = [...meld.cards, card];
            if (meld.type === 'set' ? isValidSet(withEnd, roundIndex, rules)
                : isValidRun(withEnd, roundIndex, rules)) {
                options.push({ cardIndex: cardIdx, meldIndex: meldIdx, position: 'end' });
            }
        }
    }

    return options;
}

// ─── Wild swap finding ──────────────────────────────────────

/**
 * Find all valid wild swap options.
 * Returns array of { cardIndex, meldIndex, cardInMeldIndex }
 */
export function findWildSwapOptions(hand, board, roundIndex) {
    const options = [];

    for (let cardIdx = 0; cardIdx < hand.length; cardIdx++) {
        const card = hand[cardIdx];
        if (isWild(card, roundIndex)) continue; // must swap a natural card

        for (let meldIdx = 0; meldIdx < board.length; meldIdx++) {
            const meld = board[meldIdx];
            for (let cIdx = 0; cIdx < meld.cards.length; cIdx++) {
                if (!isWild(meld.cards[cIdx], roundIndex)) continue;

                // Check if replacing wild with this card keeps the meld valid
                const newCards = [...meld.cards];
                newCards[cIdx] = card;

                if (meld.type === 'set') {
                    // Card must match set rank
                    const targetRank = meld.cards.find(c => !isWild(c, roundIndex))?.rank;
                    if (targetRank && card.rank !== targetRank) continue;
                    if (isValidSet(newCards, roundIndex)) {
                        options.push({ cardIndex: cardIdx, meldIndex: meldIdx, cardInMeldIndex: cIdx });
                    }
                } else {
                    // For runs, card must match expected rank AND suit
                    if (isValidRun(newCards, roundIndex)) {
                        options.push({ cardIndex: cardIdx, meldIndex: meldIdx, cardInMeldIndex: cIdx });
                    }
                }
            }
        }
    }

    return options;
}

// ─── Card evaluation for discard decisions ──────────────────

/**
 * Evaluate how valuable a card is to keep (higher = more valuable to keep).
 * Used by bot strategies to choose which card to discard.
 */
export function evaluateCard(card, cardIndex, hand, roundIndex) {
    // Wild cards are extremely valuable
    if (isWild(card, roundIndex)) return 100;

    let score = 0;

    // Check for pairs (same rank)
    const sameRank = hand.filter((c, i) => i !== cardIndex && c.rank === card.rank);
    score += sameRank.length * 15; // pair=15, triplet=30

    // Check for run potential (same suit, adjacent rank)
    const cardVal = RANKS.indexOf(card.rank);
    const sameSuit = hand.filter((c, i) => i !== cardIndex && c.suit === card.suit);
    for (const c of sameSuit) {
        const diff = Math.abs(RANKS.indexOf(c.rank) - cardVal);
        if (diff === 1) score += 12; // adjacent
        if (diff === 2) score += 5;  // one gap (wild could fill)
    }

    // Lower point value cards are slightly better to keep (less penalty if stuck)
    score -= getCardValue(card, roundIndex) * 0.5;

    return score;
}

// ─── Hand value calculation ─────────────────────────────────

/**
 * Calculate total point value of a hand (for vote-to-end decisions).
 */
export function handValue(hand, roundIndex) {
    return hand.reduce((sum, card) => sum + getCardValue(card, roundIndex), 0);
}

// ─── Utility: combinations ──────────────────────────────────

/**
 * Generate all combinations of `arr` with size >= minSize.
 * Returns array of arrays.
 */
function combinations(arr, maxSize) {
    const results = [];

    function recurse(start, current) {
        if (current.length >= 3) {
            results.push([...current]);
        }
        if (current.length >= maxSize) return;
        for (let i = start; i < arr.length; i++) {
            current.push(arr[i]);
            recurse(i + 1, current);
            current.pop();
        }
    }

    recurse(0, []);
    return results;
}
