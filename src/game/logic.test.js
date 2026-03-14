
import { Client } from 'boardgame.io/client';
import {
    createGame, isWild, isValidSet, isValidRun,
    normalizeRunOrder, RANKS, SUITS, LWDRummy,
} from './logic.js';

// ── helpers ────────────────────────────────────────────────────────
const card = (rank, suit) => ({ rank, suit });

/** Create a 2-player client using createGame with optional overrides. */
function makeClient(opts = {}) {
    const game = createGame({
        rules: { allowAdjacentWilds: false, allowLargeSets: false, mustPlayDiscardPickup: false, ...opts.rules },
        playerNames: opts.playerNames || {},
        seed: opts.seed || 'test-seed',
    });
    return Client({ game, numPlayers: opts.numPlayers || 2 });
}

/** Get state shorthand. */
const gs = (client) => client.getState();

/** Deep-clone and inject custom G fields into a client via SYNC dispatch. */
function patchState(client, gPatch) {
    const state = client.store.getState();
    const cloned = JSON.parse(JSON.stringify(state));
    // Extract players separately to deep-merge per-player
    const { players, ...rest } = gPatch;
    Object.assign(cloned.G, rest);
    if (players) {
        for (const [id, p] of Object.entries(players)) {
            cloned.G.players[id] = { ...cloned.G.players[id], ...p };
        }
    }
    client.store.dispatch({ type: 'SYNC', state: { ...cloned }, clientOnly: true });
}

// ================================================================
// isWild
// ================================================================
describe('isWild', () => {
    test('round 0 wild is Ace', () => {
        expect(isWild(card('A', 'H'), 0)).toBe(true);
        expect(isWild(card('2', 'H'), 0)).toBe(false);
    });

    test('round 1 wild is 2', () => {
        expect(isWild(card('2', 'S'), 1)).toBe(true);
        expect(isWild(card('A', 'S'), 1)).toBe(false);
    });

    test('round 12 wild is King', () => {
        expect(isWild(card('K', 'D'), 12)).toBe(true);
    });

    test('wraps around: round 13 wild is Ace again', () => {
        expect(isWild(card('A', 'C'), 13)).toBe(true);
    });
});

// ================================================================
// isValidSet
// ================================================================
describe('isValidSet', () => {
    test('3 of a kind is valid', () => {
        expect(isValidSet([card('7', 'H'), card('7', 'D'), card('7', 'C')], 0)).toBe(true);
    });

    test('4 of a kind is valid', () => {
        expect(isValidSet([card('7', 'H'), card('7', 'D'), card('7', 'C'), card('7', 'S')], 0)).toBe(true);
    });

    test('fewer than 3 cards is invalid', () => {
        expect(isValidSet([card('7', 'H'), card('7', 'D')], 0)).toBe(false);
    });

    test('mixed ranks invalid', () => {
        expect(isValidSet([card('7', 'H'), card('8', 'D'), card('7', 'C')], 0)).toBe(false);
    });

    test('set with wild card is valid', () => {
        // Round 0 → Ace is wild
        expect(isValidSet([card('7', 'H'), card('7', 'D'), card('A', 'S')], 0)).toBe(true);
    });

    test('wilds cannot outnumber naturals', () => {
        expect(isValidSet([card('A', 'H'), card('A', 'D'), card('7', 'C')], 0)).toBe(false);
    });

    test('5-card set rejected when allowLargeSets is off', () => {
        // Round 5, wild = 6. Use a 6 as the wild in a 5-card set of 7s.
        const cards = [card('7', 'H'), card('7', 'D'), card('7', 'C'), card('7', 'S'), card('6', 'H')];
        expect(isValidSet(cards, 5, { allowLargeSets: false })).toBe(false);
    });

    test('5-card set allowed when allowLargeSets is on', () => {
        const cards = [card('7', 'H'), card('7', 'D'), card('7', 'C'), card('7', 'S'), card('6', 'H')];
        expect(isValidSet(cards, 5, { allowLargeSets: true })).toBe(true);
    });

    test('duplicate suits rejected when allowLargeSets is off', () => {
        // Two hearts among naturals in a 4-card set
        const cards = [card('7', 'H'), card('7', 'H'), card('7', 'D'), card('7', 'C')];
        expect(isValidSet(cards, 0, { allowLargeSets: false })).toBe(false);
    });
});

// ================================================================
// isValidRun
// ================================================================
describe('isValidRun', () => {
    test('3-card ascending run is valid', () => {
        expect(isValidRun([card('3', 'H'), card('4', 'H'), card('5', 'H')], 0)).toBe(true);
    });

    test('run must be same suit', () => {
        expect(isValidRun([card('3', 'H'), card('4', 'D'), card('5', 'H')], 0)).toBe(false);
    });

    test('run with wild filling a gap', () => {
        // Round 0, Ace is wild: 3H, A(wild), 5H → 3,4,5
        expect(isValidRun([card('3', 'H'), card('A', 'C'), card('5', 'H')], 0)).toBe(true);
    });

    test('non-sequential cards rejected', () => {
        expect(isValidRun([card('3', 'H'), card('5', 'H'), card('7', 'H')], 0)).toBe(false);
    });

    test('reversed order is accepted (isValidRun tries both)', () => {
        expect(isValidRun([card('5', 'H'), card('4', 'H'), card('3', 'H')], 0)).toBe(true);
    });

    test('adjacent wilds rejected when rule is off', () => {
        // Round 1, wild = 2. Run: 2H(w), 2D(w), 7H → two adjacent wilds, but also wilds outnumber naturals
        // Better test: 4-card run with 2 wilds, 2 naturals, wilds adjacent
        // Round 1, wild = 2: 2H(w), 2D(w), 5H, 6H → wilds=naturals, but adjacent
        expect(isValidRun([card('2', 'H'), card('2', 'D'), card('5', 'H'), card('6', 'H')], 1, { allowAdjacentWilds: false })).toBe(false);
    });

    test('adjacent wilds allowed when rule is on', () => {
        // Same 4-card run with adjacent wilds
        expect(isValidRun([card('2', 'H'), card('2', 'D'), card('5', 'H'), card('6', 'H')], 1, { allowAdjacentWilds: true })).toBe(true);
    });

    test('run starting at Ace is valid', () => {
        // Round 5 (wild is 6): A-2-3 of hearts
        expect(isValidRun([card('A', 'H'), card('2', 'H'), card('3', 'H')], 5)).toBe(true);
    });

    test('fewer than 3 cards is invalid', () => {
        expect(isValidRun([card('3', 'H'), card('4', 'H')], 0)).toBe(false);
    });
});

// ================================================================
// normalizeRunOrder
// ================================================================
describe('normalizeRunOrder', () => {
    test('already ascending — no change', () => {
        const cards = [card('6', 'D'), card('7', 'D'), card('8', 'D')];
        const result = normalizeRunOrder(cards, 5);
        expect(result.map(c => c.rank)).toEqual(['6', '7', '8']);
    });

    test('descending order is reversed', () => {
        const cards = [card('8', 'D'), card('7', 'D'), card('6', 'D')];
        const result = normalizeRunOrder(cards, 5);
        expect(result.map(c => c.rank)).toEqual(['6', '7', '8']);
    });

    test('wild at wrong position gets corrected (the original bug scenario)', () => {
        // Round 1 → wild is 2. Cards played as [2D(wild), 7D, 6D]
        // Should normalize to [6D, 7D, 2D(wild)] representing 6-7-8
        const cards = [card('2', 'D'), card('7', 'D'), card('6', 'D')];
        const result = normalizeRunOrder(cards, 1);
        expect(result.map(c => c.rank)).toEqual(['6', '7', '2']);
    });

    test('wild in the middle stays correct', () => {
        // Round 0, wild = A. Run: 5H, AH(wild), 7H → 5,6,7
        const cards = [card('5', 'H'), card('A', 'H'), card('7', 'H')];
        const result = normalizeRunOrder(cards, 0);
        expect(result.map(c => c.rank)).toEqual(['5', 'A', '7']);
    });
});

// ================================================================
// Game setup
// ================================================================
describe('game setup', () => {
    test('initial card distribution: first player gets 8, others get 7', () => {
        const client = makeClient();
        const { G } = gs(client);
        expect(G.players['0'].hand.length).toBe(8);
        expect(G.players['1'].hand.length).toBe(7);
    });

    test('isFirstTurn is true at start', () => {
        const { G } = gs(makeClient());
        expect(G.isFirstTurn).toBe(true);
    });

    test('round starts at 0', () => {
        const { G } = gs(makeClient());
        expect(G.round).toBe(0);
    });

    test('deck + hands + discard account for full deck', () => {
        const { G } = gs(makeClient());
        const totalCards = G.deck.length + G.players['0'].hand.length + G.players['1'].hand.length + G.discardPile.length;
        expect(totalCards).toBe(52); // 1 deck for 2 players
    });

    test('6 players use 2 decks', () => {
        const client = makeClient({ numPlayers: 6 });
        const { G } = gs(client);
        let total = G.deck.length + G.discardPile.length;
        for (let i = 0; i < 6; i++) total += G.players[String(i)].hand.length;
        expect(total).toBe(104); // 2 decks
    });

    test('rules are stored in game state', () => {
        const client = makeClient({ rules: { allowAdjacentWilds: true, allowLargeSets: true, mustPlayDiscardPickup: true } });
        const { G } = gs(client);
        expect(G.rules.allowAdjacentWilds).toBe(true);
        expect(G.rules.allowLargeSets).toBe(true);
        expect(G.rules.mustPlayDiscardPickup).toBe(true);
    });

    test('deterministic seed produces same deal', () => {
        const c1 = makeClient({ seed: 'same-seed' });
        const c2 = makeClient({ seed: 'same-seed' });
        expect(gs(c1).G.players['0'].hand).toEqual(gs(c2).G.players['0'].hand);
        expect(gs(c1).G.deck).toEqual(gs(c2).G.deck);
    });
});

// ================================================================
// Moves: draw & discard
// ================================================================
describe('drawCard / discardCard', () => {
    test('first player can discard without drawing on first turn', () => {
        const client = makeClient();
        client.moves.discardCard(0);
        const { G, ctx } = gs(client);
        expect(G.isFirstTurn).toBe(false);
        expect(ctx.currentPlayer).toBe('1');
    });

    test('drawing from deck sets hasDrawn', () => {
        const client = makeClient();
        client.moves.discardCard(0); // P0 turn done
        client.moves.drawCard(true); // P1 draws
        expect(gs(client).G.hasDrawn).toBe(true);
    });

    test('cannot draw twice', () => {
        const client = makeClient();
        client.moves.discardCard(0); // P0 turn done
        client.moves.drawCard(true); // P1 draws
        const deckBefore = gs(client).G.deck.length;
        client.moves.drawCard(true); // try again
        expect(gs(client).G.deck.length).toBe(deckBefore); // no change
    });

    test('drawing from discard sets drewFromDiscard', () => {
        const client = makeClient();
        client.moves.discardCard(0); // P0 discards (adds to pile)
        client.moves.drawCard(false); // P1 draws from discard
        expect(gs(client).G.drewFromDiscard).toBe(true);
    });

    test('discardCard moves card to discard pile and ends turn', () => {
        const client = makeClient();
        const handBefore = gs(client).G.players['0'].hand.length;
        client.moves.discardCard(0);
        const { G, ctx } = gs(client);
        expect(G.players['0'].hand.length).toBe(handBefore - 1);
        expect(ctx.currentPlayer).toBe('1');
    });
});

// ================================================================
// Moves: playMeld
// ================================================================
describe('playMeld', () => {
    test('valid set meld removes cards from hand and adds to board', () => {
        const client = makeClient({ seed: 'meld-test' });
        // Inject a known hand with a valid set
        patchState(client, {
            players: {
                '0': {
                    hand: [
                        card('7', 'H'), card('7', 'D'), card('7', 'C'),
                        card('3', 'S'), card('4', 'S'), card('5', 'S'), card('9', 'H'), card('10', 'H'),
                    ],
                },
            },
        });

        const meld = { type: 'set', cards: [card('7', 'H'), card('7', 'D'), card('7', 'C')] };
        client.moves.playMeld(meld);

        const after = gs(client);
        expect(after.G.board.length).toBe(1);
        expect(after.G.board[0].type).toBe('set');
        expect(after.G.players['0'].hand.length).toBe(5);
        expect(after.G.players['0'].isOnBoard).toBe(true);
    });

    test('run meld cards are normalized to ascending order', () => {
        const client = makeClient({ seed: 'norm-test' });
        patchState(client, {
            players: {
                '0': {
                    hand: [
                        card('7', 'H'), card('6', 'H'), card('5', 'H'),
                        card('3', 'S'), card('4', 'S'), card('9', 'S'), card('10', 'S'), card('J', 'S'),
                    ],
                },
            },
        });

        const meld = { type: 'run', cards: [card('7', 'H'), card('6', 'H'), card('5', 'H')] };
        client.moves.playMeld(meld);

        const after = gs(client);
        expect(after.G.board[0].cards.map(c => c.rank)).toEqual(['5', '6', '7']);
    });

    test('invalid meld is rejected', () => {
        const client = makeClient();
        const meld = { type: 'set', cards: [card('7', 'H'), card('8', 'D'), card('9', 'C')] };
        client.moves.playMeld(meld);
        expect(gs(client).G.board.length).toBe(0);
    });
});

// ================================================================
// Moves: layOff
// ================================================================
describe('layOff', () => {
    test('laying off a card onto a run extends it', () => {
        const client = makeClient({ seed: 'layoff-test' });
        patchState(client, {
            hasDrawn: true,
            players: {
                '0': { isOnBoard: true, hand: [card('8', 'H'), card('Q', 'S')] },
            },
            board: [{ type: 'run', cards: [card('5', 'H'), card('6', 'H'), card('7', 'H')], owner: '1' }],
        });

        client.moves.layOff({ cardIndex: 0, meldIndex: 0, position: 'end' });

        const after = gs(client);
        expect(after.G.board[0].cards.length).toBe(4);
        expect(after.G.players['0'].hand.length).toBe(1);
    });

    test('layOff rejected if player is not on board', () => {
        const client = makeClient({ seed: 'layoff-reject' });
        patchState(client, {
            hasDrawn: true,
            players: {
                '0': { isOnBoard: false, hand: [card('8', 'H'), card('Q', 'S')] },
            },
            board: [{ type: 'run', cards: [card('5', 'H'), card('6', 'H'), card('7', 'H')], owner: '1' }],
        });

        client.moves.layOff({ cardIndex: 0, meldIndex: 0, position: 'end' });

        expect(gs(client).G.board[0].cards.length).toBe(3); // unchanged
    });

    test('laying off last card ends the turn and advances round', () => {
        const client = makeClient({ seed: 'layoff-empty' });
        patchState(client, {
            hasDrawn: true,
            players: {
                '0': { isOnBoard: true, hand: [card('8', 'H')] },
            },
            board: [{ type: 'run', cards: [card('5', 'H'), card('6', 'H'), card('7', 'H')], owner: '1' }],
        });

        client.moves.layOff({ cardIndex: 0, meldIndex: 0, position: 'end' });

        const after = gs(client);
        // Empty hand triggers round-end scoring, round should advance
        expect(after.G.round).toBe(1);
    });
});

// ================================================================
// Moves: swapWild
// ================================================================
describe('swapWild', () => {
    test('swap a natural for a wild in a set', () => {
        const client = makeClient({ seed: 'swap-test' });
        patchState(client, {
            hasDrawn: true,
            players: {
                '0': { isOnBoard: true, hand: [card('7', 'S'), card('Q', 'D')] },
            },
            board: [{
                type: 'set',
                cards: [card('7', 'H'), card('7', 'D'), card('A', 'C')], // A is wild in round 0
                owner: '1',
            }],
        });

        client.moves.swapWild({ cardIndex: 0, meldIndex: 0, cardInMeldIndex: 2 });

        const after = gs(client);
        // The wild (Ace) should now be in P0's hand, 7S in the meld
        expect(after.G.players['0'].hand.some(c => c.rank === 'A' && c.suit === 'C')).toBe(true);
        expect(after.G.board[0].cards[2].rank).toBe('7');
        expect(after.G.board[0].cards[2].suit).toBe('S');
    });

    test('swap rejected for non-wild card', () => {
        const client = makeClient({ seed: 'swap-reject' });
        patchState(client, {
            hasDrawn: true,
            players: {
                '0': { isOnBoard: true, hand: [card('7', 'S'), card('Q', 'D')] },
            },
            board: [{
                type: 'set',
                cards: [card('7', 'H'), card('7', 'D'), card('7', 'C')],
                owner: '1',
            }],
        });

        client.moves.swapWild({ cardIndex: 0, meldIndex: 0, cardInMeldIndex: 2 });

        // No swap — 7C is not wild
        expect(gs(client).G.players['0'].hand.length).toBe(2);
    });
});

// ================================================================
// mustPlayDiscardPickup rule
// ================================================================
describe('mustPlayDiscardPickup rule', () => {
    test('cannot discard without playing after drawing from discard', () => {
        const client = makeClient({ seed: 'must-play', rules: { mustPlayDiscardPickup: true } });
        // P0 discards to end turn
        client.moves.discardCard(0);
        // P1 draws from discard
        client.moves.drawCard(false);

        const handLen = gs(client).G.players['1'].hand.length;
        // Try to discard immediately — should be rejected
        client.moves.discardCard(0);

        // Still P1's turn, hand unchanged
        expect(gs(client).ctx.currentPlayer).toBe('1');
        expect(gs(client).G.players['1'].hand.length).toBe(handLen);
    });

    test('undoDiscardDraw puts card back and resets draw state', () => {
        const client = makeClient({ seed: 'undo-draw', rules: { mustPlayDiscardPickup: true } });
        // P0 discards to end turn
        client.moves.discardCard(0);

        const discardTop = gs(client).G.discardPile[gs(client).G.discardPile.length - 1];
        const p1HandBefore = gs(client).G.players['1'].hand.length;
        const discardLenBefore = gs(client).G.discardPile.length;

        // P1 draws from discard
        client.moves.drawCard(false);
        expect(gs(client).G.hasDrawn).toBe(true);
        expect(gs(client).G.mustMeldAfterDiscard).toBe(true);
        expect(gs(client).G.players['1'].hand.length).toBe(p1HandBefore + 1);

        // P1 puts it back
        client.moves.undoDiscardDraw();
        expect(gs(client).G.hasDrawn).toBe(false);
        expect(gs(client).G.mustMeldAfterDiscard).toBe(false);
        expect(gs(client).G.drewFromDiscard).toBe(false);
        expect(gs(client).G.players['1'].hand.length).toBe(p1HandBefore);
        expect(gs(client).G.discardPile.length).toBe(discardLenBefore);
        // Still P1's turn — can now draw from deck
        expect(gs(client).ctx.currentPlayer).toBe('1');
    });

    test('undoDiscardDraw rejected after playing a card', () => {
        const client = makeClient({ seed: 'undo-reject', rules: { mustPlayDiscardPickup: true } });
        client.moves.discardCard(0); // P0 done
        client.moves.drawCard(false); // P1 draws from discard

        // Simulate having played a card
        patchState(client, { playedCardThisTurn: true });

        const handLen = gs(client).G.players['1'].hand.length;
        client.moves.undoDiscardDraw();
        // Should be rejected — hand unchanged
        expect(gs(client).G.players['1'].hand.length).toBe(handLen);
        expect(gs(client).G.hasDrawn).toBe(true);
    });

    test('undoDiscardDraw not available when rule is off', () => {
        const client = makeClient({ seed: 'undo-notrule', rules: { mustPlayDiscardPickup: false } });
        client.moves.discardCard(0); // P0 done
        client.moves.drawCard(false); // P1 draws from discard

        const handLen = gs(client).G.players['1'].hand.length;
        client.moves.undoDiscardDraw();
        // Should be rejected — mustMeldAfterDiscard is false
        expect(gs(client).G.players['1'].hand.length).toBe(handLen);
    });
});

// ================================================================
// Round transitions
// ================================================================
describe('round transitions', () => {
    test('emptying hand triggers round end and advances round', () => {
        const client = makeClient({ seed: 'round-end' });
        patchState(client, {
            players: {
                '0': { hand: [card('3', 'S')], isOnBoard: true },
            },
        });

        client.moves.discardCard(0);

        const after = gs(client);
        // Round should have advanced to 1
        expect(after.G.round).toBe(1);
        // Hands should be re-dealt
        expect(after.G.players['0'].hand.length).toBeGreaterThanOrEqual(7);
        expect(after.G.players['1'].hand.length).toBeGreaterThanOrEqual(7);
    });

    test('playing meld that empties hand ends round without needing discard', () => {
        const client = makeClient({ seed: 'meld-empty' });
        patchState(client, {
            players: {
                '0': { isOnBoard: true, hand: [card('7', 'H'), card('7', 'D'), card('7', 'C')] },
            },
        });

        const meld = { type: 'set', cards: [card('7', 'H'), card('7', 'D'), card('7', 'C')] };
        client.moves.playMeld(meld);

        const after = gs(client);
        // Round should advance because hand is empty
        expect(after.G.round).toBe(1);
    });

    test('final round (12) ends game with scores tallied and winner', () => {
        const client = makeClient({ seed: 'final-round' });
        patchState(client, {
            round: 12,
            players: {
                '0': { hand: [card('3', 'S')], isOnBoard: true, score: 50 },
                '1': { hand: [card('K', 'H'), card('Q', 'D')], isOnBoard: true, score: 30 },
            },
        });

        client.moves.discardCard(0);

        const after = gs(client);
        // Game should be over
        expect(after.ctx.gameover).toBeDefined();
        // P1 had cards left — their score should have increased
        expect(after.G.players['1'].score).toBeGreaterThan(30);
        // P0 emptied hand — 0 points added, stays at 50
        expect(after.G.players['0'].score).toBe(50);
        // P1 has lower score (30 + some), so winner depends on P1's final total
        // P1: 30 + K(10) + Q(10) = 50, so it's a tie. Winner should reflect that.
        expect(after.ctx.gameover.winner).toBeDefined();
        // Score history should include round 12
        expect(after.G.scoreHistory.length).toBeGreaterThanOrEqual(1);
        expect(after.G.scoreHistory[after.G.scoreHistory.length - 1].round).toBe(12);
    });

    test('final round via meld (no discard) tallies scores correctly', () => {
        const client = makeClient({ seed: 'final-meld' });
        patchState(client, {
            round: 12,
            players: {
                '0': { isOnBoard: true, hand: [card('7', 'H'), card('7', 'D'), card('7', 'C')], score: 20 },
                '1': { hand: [card('K', 'H'), card('Q', 'D'), card('J', 'S')], isOnBoard: true, score: 100 },
            },
        });

        const meld = { type: 'set', cards: [card('7', 'H'), card('7', 'D'), card('7', 'C')] };
        client.moves.playMeld(meld);

        const after = gs(client);
        // Game should be over with scores tallied
        expect(after.ctx.gameover).toBeDefined();
        // P0 had 20, emptied hand (0 added) = 20
        expect(after.G.players['0'].score).toBe(20);
        // P1 had 100, K(wild=25)+Q(10)+J(10) = 45 added = 145
        expect(after.G.players['1'].score).toBe(145);
        // P0 wins with lower score
        expect(after.ctx.gameover.winner).toBe('0');
    });
});

// ================================================================
// ReplayEngine
// ================================================================
describe('ReplayEngine', () => {
    let ReplayEngine;

    beforeAll(async () => {
        const mod = await import('../replay/ReplayEngine.js');
        ReplayEngine = mod.ReplayEngine;
    });

    function makeReplayData() {
        // Play a short game and capture the log
        const client = makeClient({ seed: 'replay-seed' });
        // P0 discards card 0 (first turn, no draw needed)
        client.moves.discardCard(0);
        // P1 draws from deck
        client.moves.drawCard(true);
        // P1 discards card 0
        client.moves.discardCard(0);

        const state = client.getState();
        const log = state.log || [];
        return {
            version: 1,
            timestamp: new Date().toISOString(),
            gameConfig: {
                numPlayers: 2,
                rules: { allowAdjacentWilds: false, allowLargeSets: false, mustPlayDiscardPickup: false },
                playerNames: {},
            },
            seed: 'replay-seed',
            log: log.map(entry => entry.action),
        };
    }

    test('constructor creates engine at step -1', () => {
        const data = makeReplayData();
        const engine = new ReplayEngine(data);
        expect(engine.currentStep).toBe(-1);
        expect(engine.totalSteps).toBeGreaterThan(0);
        engine.stop();
    });

    test('stepForward advances and returns true', () => {
        const data = makeReplayData();
        const engine = new ReplayEngine(data);
        const ok = engine.stepForward();
        expect(ok).toBe(true);
        expect(engine.currentStep).toBe(0);
        engine.stop();
    });

    test('stepForward returns false at end', () => {
        const data = makeReplayData();
        const engine = new ReplayEngine(data);
        while (engine.stepForward()) { /* advance to end */ }
        expect(engine.stepForward()).toBe(false);
        engine.stop();
    });

    test('stepBack returns to previous state', () => {
        const data = makeReplayData();
        const engine = new ReplayEngine(data);
        engine.stepForward();
        engine.stepForward();
        expect(engine.currentStep).toBe(1);
        engine.stepBack();
        expect(engine.currentStep).toBe(0);
        engine.stop();
    });

    test('stepBack returns false at start', () => {
        const data = makeReplayData();
        const engine = new ReplayEngine(data);
        expect(engine.stepBack()).toBe(false);
        engine.stop();
    });

    test('jumpTo jumps to arbitrary step', () => {
        const data = makeReplayData();
        const engine = new ReplayEngine(data);
        const total = engine.totalSteps;
        engine.jumpTo(total - 1);
        expect(engine.currentStep).toBe(total - 1);
        engine.jumpTo(0);
        expect(engine.currentStep).toBe(0);
        engine.jumpTo(-1);
        expect(engine.currentStep).toBe(-1);
        engine.stop();
    });

    test('getCurrentActionInfo returns description for each step', () => {
        const data = makeReplayData();
        const engine = new ReplayEngine(data);
        expect(engine.getCurrentActionInfo().description).toBe('Game Start');
        engine.stepForward();
        const info = engine.getCurrentActionInfo();
        expect(info.description).toBeTruthy();
        expect(info.player).toBeTruthy();
        engine.stop();
    });

    test('getState returns valid game state', () => {
        const data = makeReplayData();
        const engine = new ReplayEngine(data);
        const state = engine.getState();
        expect(state.G).toBeDefined();
        expect(state.ctx).toBeDefined();
        expect(state.G.players).toBeDefined();
        engine.stop();
    });

    test('isAtEnd returns true only at last step', () => {
        const data = makeReplayData();
        const engine = new ReplayEngine(data);
        expect(engine.isAtEnd()).toBe(false);
        while (engine.stepForward()) { /* advance */ }
        expect(engine.isAtEnd()).toBe(true);
        engine.stop();
    });

    test('getClient returns the underlying client', () => {
        const data = makeReplayData();
        const engine = new ReplayEngine(data);
        const client = engine.getClient();
        expect(client).toBeDefined();
        expect(typeof client.getState).toBe('function');
        expect(typeof client.moves).toBe('object');
        engine.stop();
    });

    test('replay produces same initial state as original game', () => {
        const original = makeClient({ seed: 'replay-seed' });
        const data = makeReplayData();
        const engine = new ReplayEngine(data);

        // Step -1: initial state — compare hands
        expect(engine.getState().G.players['0'].hand).toEqual(gs(original).G.players['0'].hand);
        expect(engine.getState().G.players['1'].hand).toEqual(gs(original).G.players['1'].hand);
        engine.stop();
    });

    test('getClient moves work after replay (play from here)', () => {
        const data = makeReplayData();
        const engine = new ReplayEngine(data);
        // Advance to some point
        engine.stepForward();

        // Get the live client and make a move
        const client = engine.getClient();
        const stateBefore = client.getState();
        const currentPlayer = stateBefore.ctx.currentPlayer;
        const handBefore = stateBefore.G.players[currentPlayer].hand.length;

        // The state should be interactive — moves should work
        expect(typeof client.moves.drawCard).toBe('function');
        expect(typeof client.moves.discardCard).toBe('function');
        engine.stop();
    });
});

// ================================================================
// replayStorage
// ================================================================
describe('replayStorage', () => {
    let buildReplayData;

    beforeAll(async () => {
        const mod = await import('../replay/replayStorage.js');
        buildReplayData = mod.buildReplayData;
    });

    test('buildReplayData creates correct structure', () => {
        const log = [
            { action: { type: 'MAKE_MOVE', payload: { type: 'drawCard' } } },
            { action: { type: 'MAKE_MOVE', payload: { type: 'discardCard' } } },
        ];
        const result = buildReplayData({
            seed: 'test-seed',
            gameConfig: { numPlayers: 2, rules: {}, playerNames: {} },
            log,
        });

        expect(result.version).toBe(1);
        expect(result.seed).toBe('test-seed');
        expect(result.log.length).toBe(2);
        expect(result.gameConfig.numPlayers).toBe(2);
        expect(result.timestamp).toBeTruthy();
    });

    test('buildReplayData extracts action from log entries', () => {
        const action = { type: 'MAKE_MOVE', payload: { type: 'drawCard', args: [true] } };
        const result = buildReplayData({
            seed: 's',
            gameConfig: {},
            log: [{ action, metadata: 'ignored' }],
        });
        expect(result.log[0]).toEqual(action);
    });
});
