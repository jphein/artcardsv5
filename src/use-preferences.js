import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { db, id } from "./db";
import { useCurrentUser } from "./auth-button";

const DEFAULTS = {
  layoutMode: "chaos",
  viewMode: "table",
  spreadType: "three",
  dockOpen: false,
  animationSpeed: "normal",
  autoDeal: false,
  defaultScale: 1.0,
};

const LOCALSTORAGE_KEY = "artcards_preferences";

function readLocalPrefs() {
  try {
    const raw = localStorage.getItem(LOCALSTORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeLocalPrefs(prefs) {
  try {
    localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // ignore quota errors
  }
}

export default function usePreferences() {
  const { user } = useCurrentUser();
  const userId = user ? user.id : null;

  // Local-only state for logged-out users
  const [localPrefs, setLocalPrefs] = useState(readLocalPrefs);

  // Debounce timer refs — one per key to avoid collisions
  const debounceTimers = useRef({});

  // InstantDB query: fetch all preferences for this user
  const query = userId
    ? { preferences: { $: { where: { userId } } } }
    : null;
  const { data } = db.useQuery(query);
  const dbPrefs = data?.preferences || [];

  // Build a flat object from InstantDB rows
  const dbPrefsMap = useMemo(() => {
    const map = {};
    dbPrefs.forEach((row) => {
      map[row.key] = row.value;
    });
    return map;
  }, [dbPrefs]);

  // Merged prefs: defaults < stored < override
  const prefs = useMemo(() => {
    const stored = userId ? dbPrefsMap : localPrefs;
    return { ...DEFAULTS, ...stored };
  }, [userId, dbPrefsMap, localPrefs]);

  // setPref: write to InstantDB (debounced) or localStorage
  const setPref = useCallback(
    (key, value) => {
      if (!userId) {
        // Logged out: update localStorage immediately
        setLocalPrefs((prev) => {
          const next = { ...prev, [key]: value };
          writeLocalPrefs(next);
          return next;
        });
        return;
      }

      // Logged in: debounce InstantDB writes (300ms per key)
      if (debounceTimers.current[key]) {
        clearTimeout(debounceTimers.current[key]);
      }

      debounceTimers.current[key] = setTimeout(() => {
        // Find existing row for this key
        const existing = dbPrefs.find(
          (row) => row.key === key && row.userId === userId
        );

        if (existing) {
          db.transact(
            db.tx.preferences[existing.id].update({ value })
          );
        } else {
          db.transact(
            db.tx.preferences[id()].update({
              userId,
              key,
              value,
            })
          );
        }

        delete debounceTimers.current[key];
      }, 300);
    },
    [userId, dbPrefs]
  );

  // Cleanup debounce timers on unmount
  useEffect(() => {
    const timers = debounceTimers.current;
    return () => {
      Object.values(timers).forEach(clearTimeout);
    };
  }, []);

  // Memoize the return tuple to avoid creating a new array reference every render,
  // which would cause unnecessary re-renders in consuming components
  return useMemo(() => [prefs, setPref], [prefs, setPref]);
}
