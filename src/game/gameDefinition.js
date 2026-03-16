/**
 * Server-compatible game definition for multiplayer.
 *
 * Unlike createGame() which uses closures for rules/playerNames,
 * this version reads rules from setupData passed at match creation time.
 * This is required because the server needs a single static game object.
 */
import { LWDRummyBase } from './logic.js';

const defaultRules = {
    allowAdjacentWilds: false,
    allowLargeSets: false,
    mustPlayDiscardPickup: false,
    hintLayoff: false,
    hintSwapWild: false,
};

export const LWDRummyMultiplayer = {
    ...LWDRummyBase,
    name: 'lwd-rummy',

    setup: ({ ctx, random }, setupData) => {
        const baseState = LWDRummyBase.setup({ ctx, random });
        const rules = setupData?.rules || defaultRules;
        const playerNames = setupData?.playerNames || {};
        return { ...baseState, rules, playerNames };
    },
};
