/**
 * ReplayEngine — deterministic replay of a saved game.
 *
 * Creates a headless boardgame.io client with the same seed,
 * then dispatches recorded actions one at a time.
 */
import { Client } from 'boardgame.io/client';
import { createGame } from '../game/logic.js';

export class ReplayEngine {
    /**
     * @param {object} replayData - Loaded replay data (from replayStorage)
     */
    constructor(replayData) {
        this.replayData = replayData;
        this.actions = replayData.log.filter(a => !a.automatic && a.type !== 'GAME_EVENT');
        this.currentStep = -1; // before any action
        this.snapshots = []; // cached state snapshots for fast backward nav

        const game = createGame({
            rules: replayData.gameConfig.rules,
            playerNames: replayData.gameConfig.playerNames,
            seed: replayData.seed,
        });

        this.client = Client({
            game,
            numPlayers: replayData.gameConfig.numPlayers,
        });
        this.client.start();

        // Cache the initial state (step -1)
        this.snapshots.push(this._captureState());
    }

    _captureState() {
        const state = this.client.getState();
        return {
            G: state.G,
            ctx: state.ctx,
            log: state.log || [],
        };
    }

    /** Get the current game state */
    getState() {
        return this.client.getState();
    }

    /** Get total number of replayable actions */
    get totalSteps() {
        return this.actions.length;
    }

    /** Step forward one action. Returns false if at end. */
    stepForward() {
        if (this.currentStep >= this.actions.length - 1) return false;
        this.currentStep++;
        const action = this.actions[this.currentStep];
        this.client.store.dispatch(action);
        this.snapshots[this.currentStep + 1] = this._captureState();
        return true;
    }

    /** Step backward one action. Returns false if at start. */
    stepBack() {
        if (this.currentStep < 0) return false;
        this.currentStep--;
        // Re-initialize and replay from scratch up to currentStep
        this._replayTo(this.currentStep);
        return true;
    }

    /** Jump to a specific step index (-1 = initial state). */
    jumpTo(targetStep) {
        if (targetStep < -1 || targetStep >= this.actions.length) return;
        if (targetStep === this.currentStep) return;

        if (targetStep > this.currentStep) {
            // Fast forward from current position
            for (let i = this.currentStep + 1; i <= targetStep; i++) {
                this.currentStep = i;
                this.client.store.dispatch(this.actions[i]);
            }
            this.snapshots[this.currentStep + 1] = this._captureState();
        } else {
            this._replayTo(targetStep);
        }
    }

    /** Internal: rebuild state up to targetStep by replaying from start */
    _replayTo(targetStep) {
        // Reset client
        this.client.reset();
        this.currentStep = -1;

        // Replay actions up to target
        for (let i = 0; i <= targetStep; i++) {
            this.currentStep = i;
            this.client.store.dispatch(this.actions[i]);
        }
        this.snapshots[this.currentStep + 1] = this._captureState();
    }

    /** Get a description of the current action (for display) */
    getCurrentActionInfo() {
        if (this.currentStep < 0) return { description: 'Game Start' };
        const action = this.actions[this.currentStep];
        const payload = action.payload || {};
        const move = payload.type || 'unknown';
        const player = payload.playerID || '?';
        const args = payload.args || [];

        let description = `Player ${player}: ${move}`;
        if (move === 'drawCard') {
            description += args[0] ? ' (deck)' : ' (discard)';
        } else if (move === 'discardCard') {
            description += ` [index ${args[0]}]`;
        } else if (move === 'playMeld') {
            const meld = args[0];
            if (meld && meld.type) {
                description += ` (${meld.type}: ${meld.cards?.map(c => c.rank + c.suit).join(' ')})`;
            }
        } else if (move === 'layOff') {
            const info = args[0];
            if (info) description += ` [card ${info.cardIndex} → meld ${info.meldIndex}]`;
        } else if (move === 'swapWild') {
            const info = args[0];
            if (info) description += ` [card ${info.cardIndex} ↔ meld ${info.meldIndex}[${info.cardInMeldIndex}]]`;
        }
        return { description, move, player, args };
    }

    /** Returns the underlying boardgame.io client for live play */
    getClient() {
        return this.client;
    }

    /** Check if the game has ended at the current replay position */
    isGameOver() {
        const state = this.client.getState();
        return state?.ctx?.gameover != null;
    }

    /** Check if replay is at the last step */
    isAtEnd() {
        return this.currentStep >= this.actions.length - 1;
    }

    stop() {
        this.client.stop();
    }
}
