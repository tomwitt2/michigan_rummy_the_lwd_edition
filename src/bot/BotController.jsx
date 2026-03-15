/**
 * BotController — invisible React component that drives bot turns.
 *
 * Subscribes to the boardgame.io client state. When the current player
 * is a bot, it executes moves with a configurable delay so the human
 * can follow the action.
 *
 * Key insight: boardgame.io fires subscribe callbacks synchronously
 * during move dispatch. Since actingRef is still true at that point,
 * the callback skips. So after each turn ends we schedule a deferred
 * re-check via setTimeout to pick up the next bot's turn.
 */

import { useEffect, useRef } from 'react';
import { decideNextAction } from './strategies.js';

const MIN_ACTION_DELAY = 150; // ms — minimum pause even at delay=0

export function BotController({ client, botConfigs, botDelay, humanPlayerID }) {
    const actingRef = useRef(false);
    const timeoutRef = useRef(null);
    const unmountedRef = useRef(false);

    // Store latest props in refs so the long-lived callbacks always see current values
    const botConfigsRef = useRef(botConfigs);
    botConfigsRef.current = botConfigs;
    const botDelayRef = useRef(botDelay);
    botDelayRef.current = botDelay;

    useEffect(() => {
        unmountedRef.current = false;

        function getDelayMs() {
            return Math.max(MIN_ACTION_DELAY, (botDelayRef.current ?? 2) * 1000);
        }

        function scheduleCheck() {
            // Deferred re-check after a bot finishes its turn
            timeoutRef.current = setTimeout(() => {
                if (!unmountedRef.current && !actingRef.current) {
                    tryStartBotTurn();
                }
            }, MIN_ACTION_DELAY);
        }

        function tryStartBotTurn() {
            if (actingRef.current || unmountedRef.current) return;

            const state = client.getState();
            if (!state || !state.G || !state.ctx || state.ctx.gameover) return;

            const currentPlayer = state.ctx.currentPlayer;
            const botConfig = botConfigsRef.current[currentPlayer];
            if (!botConfig) return; // human's turn

            actingRef.current = true;

            function doNextAction() {
                if (unmountedRef.current) {
                    actingRef.current = false;
                    return;
                }

                const s = client.getState();
                if (!s || s.ctx.currentPlayer !== currentPlayer || s.ctx.gameover) {
                    // Turn ended or game over — restore human view and recheck
                    client.updatePlayerID(humanPlayerID);
                    actingRef.current = false;
                    scheduleCheck();
                    return;
                }

                const action = decideNextAction(s.G, s.ctx, currentPlayer, botConfig.level);
                if (!action) {
                    // Bot is stuck — force discard as fallback
                    const hand = s.G.players[currentPlayer]?.hand;
                    if (hand && hand.length > 0 && s.G.hasDrawn) {
                        client.updatePlayerID(currentPlayer);
                        client.moves.discardCard(0);
                        client.updatePlayerID(humanPlayerID);
                    }
                    actingRef.current = false;
                    scheduleCheck();
                    return;
                }

                // Switch to bot, make move, switch back — synchronous block
                client.updatePlayerID(currentPlayer);
                client.moves[action.action](...action.args);
                client.updatePlayerID(humanPlayerID);

                if (action.action === 'discardCard') {
                    // Turn over — recheck for next bot
                    actingRef.current = false;
                    scheduleCheck();
                    return;
                }

                // Schedule next action within this turn
                timeoutRef.current = setTimeout(doNextAction, getDelayMs());
            }

            // Initial delay before first bot action
            timeoutRef.current = setTimeout(doNextAction, getDelayMs());
        }

        // Subscribe to state changes
        const unsub = client.subscribe(() => {
            if (!actingRef.current) {
                tryStartBotTurn();
            }
        });

        // Check immediately
        tryStartBotTurn();

        return () => {
            unmountedRef.current = true;
            unsub();
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            actingRef.current = false;
        };
    }, [client, humanPlayerID]);

    return null;
}
