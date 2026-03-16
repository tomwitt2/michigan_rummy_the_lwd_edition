import { useState } from 'react';

const STORAGE_KEY = 'lwd-rummy-prefs';

function loadAll() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    } catch {
        return {};
    }
}

function saveAll(prefs) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

/**
 * React hook that persists a preference in localStorage.
 * Works like useState but reads the initial value from storage
 * and writes back on every update.
 */
export function usePreference(key, defaultValue) {
    const [value, setValue] = useState(() => {
        const prefs = loadAll();
        return prefs[key] !== undefined ? prefs[key] : defaultValue;
    });

    const setAndPersist = (next) => {
        setValue(prev => {
            const resolved = typeof next === 'function' ? next(prev) : next;
            const prefs = loadAll();
            prefs[key] = resolved;
            saveAll(prefs);
            return resolved;
        });
    };

    return [value, setAndPersist];
}
