/**
 * Replay Storage — save/load game replays as JSON files.
 *
 * A replay file contains the game config, random seed, and the
 * boardgame.io action log. This is sufficient to deterministically
 * reproduce any game state by replaying actions against a fresh
 * client initialised with the same seed.
 */

/**
 * Build a replay data object from a running game.
 * @param {object} params
 * @param {string} params.seed - The random seed used for this game
 * @param {object} params.gameConfig - { numPlayers, rules, playerNames }
 * @param {Array}  params.log - boardgame.io action log (props.log)
 * @returns {object} Replay data ready for serialisation
 */
export function buildReplayData({ seed, gameConfig, log, chatMessages, bulletMessages }) {
    const data = {
        version: 1,
        timestamp: new Date().toISOString(),
        gameConfig,
        seed,
        log: log.map(entry => entry.action),
    };
    if (chatMessages && chatMessages.length > 0) {
        data.chatMessages = chatMessages;
    }
    if (bulletMessages && bulletMessages.length > 0) {
        data.bulletMessages = bulletMessages;
    }
    return data;
}

/**
 * Download replay data as a JSON file.
 */
export function downloadReplay(replayData) {
    const json = JSON.stringify(replayData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    a.href = url;
    a.download = `lwd-rummy-replay-${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * Load a replay file from a File object (from <input type="file">).
 * @param {File} file
 * @returns {Promise<object>} Parsed replay data
 */
export function loadReplayFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const data = JSON.parse(reader.result);
                if (!data.version || !data.seed || !data.log) {
                    reject(new Error('Invalid replay file format'));
                    return;
                }
                resolve(data);
            } catch (e) {
                reject(new Error('Failed to parse replay file: ' + e.message));
            }
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsText(file);
    });
}
