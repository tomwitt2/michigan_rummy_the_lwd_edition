import React from 'react';
import { Client } from 'boardgame.io/react';
import { SocketIO } from 'boardgame.io/multiplayer';
import { LWDRummyMultiplayer } from '../game/gameDefinition.js';
import { Board } from './Board.jsx';
import { SERVER_URL } from '../lobby/config.js';
import { MultiplayerBotController } from '../bot/MultiplayerBotController.jsx';
import { getMatchSeed } from '../lobby/lobbyApi.js';

/** Wrapper that syncs lobby player names and fetches seed for replay on game over. */
const BoardWithNameSync = (props) => {
    const syncedRef = React.useRef(false);
    const [gameSeed, setGameSeed] = React.useState(null);

    React.useEffect(() => {
        if (syncedRef.current || !props.G || !props.moves || !props.matchData) return;
        syncedRef.current = true;
        for (const player of props.matchData) {
            if (player.name && props.G.playerNames?.[String(player.id)] !== player.name) {
                props.moves.setPlayerName({ id: String(player.id), name: player.name });
            }
        }
    }, [props.G, props.moves, props.matchData]);

    // Fetch the seed when the game ends so replay saves work
    React.useEffect(() => {
        if (!props.ctx?.gameover || gameSeed) return;
        getMatchSeed(props.matchID).then(setGameSeed).catch(() => {});
    }, [props.ctx?.gameover, props.matchID, gameSeed]);

    return <Board {...props} gameSeed={gameSeed} />;
};

export const MultiplayerGameBoard = ({ matchID, playerID, credentials, botCredentials = {}, botConfigs = {}, onLeave }) => {
    const [GameClient] = React.useState(() =>
        Client({
            game: LWDRummyMultiplayer,
            board: BoardWithNameSync,
            multiplayer: SocketIO({ server: SERVER_URL || window.location.origin }),
        })
    );

    const hasBots = Object.keys(botCredentials).length > 0;

    return (
        <>
            <GameClient
                matchID={matchID}
                playerID={playerID}
                credentials={credentials}
                onNewGame={onLeave}
            />
            {hasBots && (
                <MultiplayerBotController
                    matchID={matchID}
                    botCredentials={botCredentials}
                    botConfigs={botConfigs}
                />
            )}
        </>
    );
};
