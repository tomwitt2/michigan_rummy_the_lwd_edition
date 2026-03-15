/**
 * Bot character names drawn from classic TV shows.
 */

export const BOT_NAMES = [
    // The Brady Bunch
    'Greg', 'Marcia', 'Peter', 'Jan', 'Bobby', 'Cindy', 'Alice',
    // The Partridge Family
    'Keith', 'Laurie', 'Danny', 'Tracy', 'Chris', 'Shirley',
    // Scooby-Doo
    'Scooby', 'Shaggy', 'Velma', 'Daphne', 'Fred', 'Scrappy',
];

/**
 * Pick `count` unique bot names, avoiding any already in `usedNames`.
 */
export function pickBotNames(count, usedNames = []) {
    const available = BOT_NAMES.filter(n => !usedNames.includes(n));
    const shuffled = [...available].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
}
