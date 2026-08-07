// ===== FORMAT LEVEL =====
//
// VGC plays at 50 and Smogon singles at 100, and both get played here, so the
// level is a property of the format rather than of one tool. It is stored the
// same way the theme and the language are.
//
// The damage calculator deliberately does NOT read this. There the level is per
// Pokemon -- attacker and defender can differ -- and it already travels in the
// shared URL as `al`/`dl`. A global override would quietly change the result of
// links that are already out there.
const KEY = 'pkutils_level';
const listeners = [];

let level = Number(localStorage.getItem(KEY)) === 100 ? 100 : 50;

export const getLevel = () => level;

export function setLevel(next) {
  level = next === 100 ? 100 : 50;
  localStorage.setItem(KEY, String(level));
  listeners.forEach(cb => cb(level));
}

export const onLevelChange = cb => listeners.push(cb);
