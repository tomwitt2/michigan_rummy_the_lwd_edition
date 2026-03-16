/**
 * Server URL configuration for the lobby API.
 *
 * In development with Vite proxy, this is empty (requests go to same origin).
 * In production/Docker, set VITE_SERVER_URL to the server's address.
 */
export const SERVER_URL = import.meta.env.VITE_SERVER_URL || '';

export const GAME_NAME = 'lwd-rummy';
