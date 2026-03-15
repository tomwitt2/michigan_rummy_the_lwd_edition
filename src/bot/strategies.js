/**
 * Bot decision strategies — Newbie, Average, Advanced.
 *
 * Each call to `decideNextAction` examines the current game state
 * and returns the single next action the bot should take, or null
 * if the bot's turn is effectively stuck (shouldn't happen).
 *
 * Return format: { action: string, args: any[] }
 */

import {
    findAllSets, findAllRuns, findBestMeldCombination,
    findLayoffOptions, findWildSwapOptions, evaluateCard, handValue,
} from './meldFinder.js';
import { RANKS, isWild } from '../game/logic.js';

const SUIT_ORDER = { H: 0, D: 1, C: 2, S: 3 };

// ─── Turn-level state to prevent repeated actions ───────────

const turnState = { turn: -1, playerID: null, swappedThisTurn: false, needsSort: false };

function resetTurnStateIfNeeded(ctx, playerID) {
    if (turnState.turn !== ctx.turn || turnState.playerID !== playerID) {
        turnState.turn = ctx.turn;
        turnState.playerID = playerID;
        turnState.swappedThisTurn = false;
        turnState.needsSort = true; // sort after initial draw
    }
}

// ─── Sort helper (wilds to the left) ────────────────────────

function buildSortOrder(hand, roundIndex) {
    const indices = hand.map((_, i) => i);
    const sortRank = (card) => {
        if (isWild(card, roundIndex)) return -1; // wilds to left
        return RANKS.indexOf(card.rank);
    };
    indices.sort((a, b) => {
        const ra = sortRank(hand[a]), rb = sortRank(hand[b]);
        if (ra !== rb) return ra - rb;
        return SUIT_ORDER[hand[a].suit] - SUIT_ORDER[hand[b].suit];
    });
    return indices;
}

// ─── Main entry point ───────────────────────────────────────

export function decideNextAction(G, ctx, playerID, level) {
    resetTurnStateIfNeeded(ctx, playerID);

    // Sort hand when needed (after draw, wild swap, discard pickup)
    const player = G.players[playerID];
    if (player && (G.hasDrawn || G.isFirstTurn) && turnState.needsSort) {
        turnState.needsSort = false;
        const newOrder = buildSortOrder(player.hand, G.round);
        return { action: 'sortHand', args: [{ newOrder }] };
    }

    const fn = { newbie: newbieDecide, average: averageDecide, advanced: advancedDecide }[level];
    if (!fn) return null;
    return fn(G, ctx, playerID);
}

// ─── NEWBIE ─────────────────────────────────────────────────

function newbieDecide(G, ctx, playerID) {
    const player = G.players[playerID];
    if (!player) return null;

    // Step 1: Draw (always from deck)
    if (!G.hasDrawn && !G.isFirstTurn) {
        return { action: 'drawCard', args: [true] };
    }

    // Step 2: Try to play a meld (first one found)
    const sets = findAllSets(player.hand, G.round, G.rules);
    const runs = findAllRuns(player.hand, G.round, G.rules);
    const allMelds = [...sets, ...runs];

    if (allMelds.length > 0) {
        const meld = allMelds[0];
        return {
            action: 'playMeld',
            args: [{ type: meld.type, cards: meld.cards }],
        };
    }

    // Step 3: Skip layoffs and wild swaps

    // Step 4: Discard random card
    if (player.hand.length > 0) {
        const idx = Math.floor(Math.random() * player.hand.length);
        return { action: 'discardCard', args: [idx] };
    }

    return null;
}

// ─── AVERAGE ────────────────────────────────────────────────

function averageDecide(G, ctx, playerID) {
    const player = G.players[playerID];
    if (!player) return null;

    // Step 1: Draw
    if (!G.hasDrawn && !G.isFirstTurn) {
        // Check if discard top completes a meld
        if (G.discardPile.length > 0) {
            const topCard = G.discardPile[G.discardPile.length - 1];
            const hypothetical = [...player.hand, topCard];
            const sets = findAllSets(hypothetical, G.round, G.rules);
            const runs = findAllRuns(hypothetical, G.round, G.rules);
            // Check if any meld uses the top card (last index)
            const topIdx = hypothetical.length - 1;
            const useTop = [...sets, ...runs].some(m => m.indices.includes(topIdx));
            if (useTop) {
                return { action: 'drawCard', args: [false] }; // draw from discard
            }
        }
        return { action: 'drawCard', args: [true] }; // draw from deck
    }

    // Step 2: Play all valid melds at once
    const sets = findAllSets(player.hand, G.round, G.rules);
    const runs = findAllRuns(player.hand, G.round, G.rules);
    const allMelds = [...sets, ...runs];
    const best = findBestMeldCombination(allMelds);

    if (best.length > 0) {
        const meldsToPlay = best.map(m => ({ type: m.type, cards: m.cards }));
        return { action: 'playMeld', args: [meldsToPlay] };
    }

    // Step 3: Layoffs (if on board)
    if (player.isOnBoard && G.board.length > 0) {
        const layoffs = findLayoffOptions(player.hand, G.board, G.round, G.rules);
        if (layoffs.length > 0) {
            const lo = layoffs[0];
            return { action: 'layOff', args: [lo] };
        }
    }

    // Step 4: Skip wild swaps

    // Step 5: Discard — highest value card not part of a partial meld
    return discardSmart(player.hand, G.round);
}

// ─── ADVANCED ───────────────────────────────────────────────

function advancedDecide(G, ctx, playerID) {
    const player = G.players[playerID];
    if (!player) return null;

    // Step 1: Draw — consider discard even for partial meld improvement
    if (!G.hasDrawn && !G.isFirstTurn) {
        if (G.discardPile.length > 0) {
            const topCard = G.discardPile[G.discardPile.length - 1];
            const hypothetical = [...player.hand, topCard];
            const topIdx = hypothetical.length - 1;

            // Check if it completes a meld
            const sets = findAllSets(hypothetical, G.round, G.rules);
            const runs = findAllRuns(hypothetical, G.round, G.rules);
            const useTop = [...sets, ...runs].some(m => m.indices.includes(topIdx));
            if (useTop) {
                return { action: 'drawCard', args: [false] };
            }

            // Check if it improves partial melds (pair → 3, or extends a 2-card run potential)
            if (isWild(topCard, G.round)) {
                // Always pick up wilds
                return { action: 'drawCard', args: [false] };
            }

            // Check for pair improvement
            const sameRank = player.hand.filter(c => c.rank === topCard.rank);
            if (sameRank.length >= 2) {
                return { action: 'drawCard', args: [false] }; // makes a set
            }
        }
        return { action: 'drawCard', args: [true] };
    }

    // Step 2: Play optimal meld combination
    const sets = findAllSets(player.hand, G.round, G.rules);
    const runs = findAllRuns(player.hand, G.round, G.rules);
    const allMelds = [...sets, ...runs];
    const best = findBestMeldCombination(allMelds);

    if (best.length > 0) {
        const meldsToPlay = best.map(m => ({ type: m.type, cards: m.cards }));
        return { action: 'playMeld', args: [meldsToPlay] };
    }

    // Step 3: Aggressive layoffs
    if (player.isOnBoard && G.board.length > 0) {
        const layoffs = findLayoffOptions(player.hand, G.board, G.round, G.rules);
        if (layoffs.length > 0) {
            // Prefer laying off highest value cards first
            layoffs.sort((a, b) => {
                const va = evaluateCard(player.hand[a.cardIndex], a.cardIndex, player.hand, G.round);
                const vb = evaluateCard(player.hand[b.cardIndex], b.cardIndex, player.hand, G.round);
                return va - vb; // lower keep-value = lay off first? No, lay off highest point cards
            });
            // Actually: lay off the card with lowest keep-value (least useful to hold)
            const lo = layoffs[0];
            return { action: 'layOff', args: [lo] };
        }
    }

    // Step 4: Wild swaps (once per turn to prevent ping-pong loops)
    if (player.isOnBoard && G.board.length > 0 && !turnState.swappedThisTurn) {
        const swaps = findWildSwapOptions(player.hand, G.board, G.round);
        if (swaps.length > 0) {
            turnState.swappedThisTurn = true;
            turnState.needsSort = true; // wild comes into hand
            return { action: 'swapWild', args: [swaps[0]] };
        }
    }

    // Step 5: Vote to end round if hand value is low and deck has been reshuffled
    if (G.flipCount > 0 && !G.votes?.[playerID]) {
        const hv = handValue(player.hand, G.round);
        if (hv <= 15) {
            return { action: 'voteEndRound', args: [] };
        }
    }

    // Step 6: Strategic discard
    return discardSmart(player.hand, G.round);
}

// ─── Shared: smart discard ──────────────────────────────────

function discardSmart(hand, roundIndex) {
    if (hand.length === 0) return null;

    // Score each card — discard the one with lowest keep-value
    let worstIdx = 0;
    let worstScore = Infinity;

    for (let i = 0; i < hand.length; i++) {
        const score = evaluateCard(hand[i], i, hand, roundIndex);
        if (score < worstScore) {
            worstScore = score;
            worstIdx = i;
        }
    }

    return { action: 'discardCard', args: [worstIdx] };
}
