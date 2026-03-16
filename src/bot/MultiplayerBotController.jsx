/**
 * MultiplayerBotController — drives bot players via separate authenticated clients.
 *
 * Unlike the local BotController which impersonates bots on a single client,
 * this creates individual SocketIO clients for each bot seat, each authenticated
 * with its own credentials from the lobby join.
 */

import { useEffect, useRef } from 'react';
import { Client as BGClient } from 'boardgame.io/client';
import { SocketIO } from 'boardgame.io/multiplayer';
import { LWDRummyMultiplayer } from '../game/gameDefinition.js';
import { SERVER_URL } from '../lobby/config.js';
import { decideNextAction } from './strategies.js';

const MIN_ACTION_DELAY = 150;
const DEFAULT_DELAY = 2;
const DEFAULT_LEVEL = 'advanced';

export function MultiplayerBotController({ matchID, botCredentials, botConfigs = {} }) {
    const clientsRef = useRef(null);
    const unmountedRef = useRef(false);
    const timersRef = useRef([]);

    useEffect(() => {
        unmountedRef.current = false;
        const botIDs = Object.keys(botCredentials);
        if (botIDs.length === 0) return;

        const server = SERVER_URL || window.location.origin;
        const clients = {};

        for (const botID of botIDs) {
            const client = BGClient({
                game: LWDRummyMultiplayer,
                multiplayer: SocketIO({ server }),
            });
            // Explicitly set identity — constructor may not wire these for SocketIO
            client.updatePlayerID(botID);
            client.updateMatchID(matchID);
            client.updateCredentials(botCredentials[botID]);
            clients[botID] = { client, acting: false };
            client.start();
        }

        clientsRef.current = clients;

        function getDelayMs(botID) {
            const delay = botConfigs[botID]?.delay ?? DEFAULT_DELAY;
            return Math.max(MIN_ACTION_DELAY, delay * 1000);
        }

        function getLevel(botID) {
            return botConfigs[botID]?.level || DEFAULT_LEVEL;
        }

        function scheduleCheck(botID) {
            const timer = setTimeout(() => {
                if (!unmountedRef.current) {
                    tryBotTurn(botID);
                }
            }, MIN_ACTION_DELAY);
            timersRef.current.push(timer);
        }

        function tryBotTurn(botID) {
            const entry = clients[botID];
            if (!entry || entry.acting || unmountedRef.current) return;

            const state = entry.client.getState();
            if (!state || !state.G || !state.ctx || state.ctx.gameover) return;
            if (state.ctx.currentPlayer !== botID) return;

            entry.acting = true;

            function doNextAction() {
                if (unmountedRef.current) {
                    entry.acting = false;
                    return;
                }

                const s = entry.client.getState();
                if (!s || s.ctx.currentPlayer !== botID || s.ctx.gameover) {
                    entry.acting = false;
                    return;
                }

                const action = decideNextAction(s.G, s.ctx, botID, getLevel(botID));
                if (!action) {
                    // Fallback: force discard
                    const hand = s.G.players[botID]?.hand;
                    if (hand && hand.length > 0 && s.G.hasDrawn) {
                        entry.client.moves.discardCard(0);
                    }
                    entry.acting = false;
                    return;
                }

                entry.client.moves[action.action](...action.args);

                if (action.action === 'discardCard') {
                    entry.acting = false;
                    return;
                }

                // Schedule next action within this turn
                const timer = setTimeout(doNextAction, getDelayMs(botID));
                timersRef.current.push(timer);
            }

            const timer = setTimeout(doNextAction, getDelayMs(botID));
            timersRef.current.push(timer);
        }

        function checkBotVotes(botID) {
            const entry = clients[botID];
            if (!entry) return;
            const s = entry.client.getState();
            if (!s || !s.G || s.ctx.gameover) return;
            if (s.G.flipCount === 0) return;
            // Vote if any non-bot has voted
            const hasHumanVote = Object.entries(s.G.votes || {}).some(
                ([id, v]) => v && !clients[id]
            );
            if (hasHumanVote && !s.G.votes?.[botID]) {
                entry.client.moves.voteEndRound({ voterID: botID });
            }
        }

        // Subscribe each bot client
        const unsubs = [];
        for (const botID of botIDs) {
            const unsub = clients[botID].client.subscribe(() => {
                if (!clients[botID].acting) {
                    checkBotVotes(botID);
                    tryBotTurn(botID);
                }
            });
            unsubs.push(unsub);
        }

        return () => {
            unmountedRef.current = true;
            unsubs.forEach(u => u());
            timersRef.current.forEach(t => clearTimeout(t));
            for (const botID of botIDs) {
                clients[botID].client.stop();
            }
            clientsRef.current = null;
        };
    }, [matchID, botCredentials, botConfigs]);

    return null;
}
