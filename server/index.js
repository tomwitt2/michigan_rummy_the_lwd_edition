/**
 * boardgame.io multiplayer server.
 *
 * Hosts the Lobby REST API and SocketIO transport for real-time game play.
 * In production (Docker), also serves the static frontend from dist/.
 */
import { Server, Origins } from 'boardgame.io/dist/cjs/server.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { LWDRummyMultiplayer } from '../src/game/gameDefinition.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || '8001', 10);
const isProd = process.env.NODE_ENV === 'production';

const server = Server({
    games: [LWDRummyMultiplayer],
    origins: isProd
        ? [Origins.LOCALHOST]
        : [Origins.LOCALHOST_IN_DEVELOPMENT],
});

// Expose the match seed for replay saves (not available via playerView)
server.router.get('/games/lwd-rummy/:matchID/seed', async (ctx) => {
    const { matchID } = ctx.params;
    try {
        const { initialState } = await server.db.fetch(matchID, { initialState: true });
        const seed = initialState?.plugins?.random?.data?.seed;
        if (!seed) {
            ctx.status = 404;
            ctx.body = { error: 'Seed not found' };
            return;
        }
        ctx.body = { seed };
    } catch (err) {
        ctx.status = 500;
        ctx.body = { error: 'Failed to fetch seed' };
    }
});

// In production, serve the Vite-built frontend
if (isProd) {
    const distPath = path.resolve(__dirname, '..', 'dist');
    const serve = (await import('koa-static')).default;
    server.app.use(serve(distPath));
}

server.run(PORT, () => {
    console.log(`boardgame.io server running on port ${PORT}`);
});
