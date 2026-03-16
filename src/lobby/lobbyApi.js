/**
 * Thin wrapper around the boardgame.io Lobby REST API.
 */
import { SERVER_URL, GAME_NAME } from './config.js';

const BASE = () => `${SERVER_URL}/games/${GAME_NAME}`;

async function request(url, options = {}) {
    const res = await fetch(url, {
        headers: { 'Content-Type': 'application/json' },
        ...options,
    });
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Lobby API error ${res.status}: ${text}`);
    }
    return res.json();
}

/** List open matches (excludes finished games). */
export async function listMatches() {
    const data = await request(`${BASE()}?isGameover=false`);
    return data.matches || [];
}

/** Get metadata for a specific match. */
export async function getMatch(matchID) {
    return request(`${BASE()}/${matchID}`);
}

/** Create a new match. Returns { matchID }. */
export async function createMatch({ numPlayers, setupData, unlisted = false }) {
    return request(`${BASE()}/create`, {
        method: 'POST',
        body: JSON.stringify({ numPlayers, setupData, unlisted }),
    });
}

/** Join a match. Returns { playerID, playerCredentials }. */
export async function joinMatch(matchID, { playerID, playerName, data } = {}) {
    return request(`${BASE()}/${matchID}/join`, {
        method: 'POST',
        body: JSON.stringify({ playerID, playerName, data }),
    });
}

/** Leave a match. */
export async function leaveMatch(matchID, { playerID, credentials }) {
    return request(`${BASE()}/${matchID}/leave`, {
        method: 'POST',
        body: JSON.stringify({ playerID, credentials }),
    });
}

/** Fetch the PRNG seed for a match (for replay saves). */
export async function getMatchSeed(matchID) {
    const data = await request(`${BASE()}/${matchID}/seed`);
    return data.seed;
}

/** Update player metadata (name, data). */
export async function updatePlayer(matchID, { playerID, credentials, newName, data }) {
    return request(`${BASE()}/${matchID}/update`, {
        method: 'POST',
        body: JSON.stringify({ playerID, credentials, newName, data }),
    });
}
