// ===== SEARCH TERM NORMALISATION =====
//
// One definition, used by the global search index and by the filter on every
// page. It lived inside search-index.js and only the nav search folded accents,
// so `puno fuego` found nothing in #/moves while the nav found Puño Fuego --
// half the app teaching one rule and half teaching another.
//
// It sits in its own dependency-free module rather than being exported from
// search-index.js: that file pulls in data.js, forms.js and tools.js, and the
// eleven page filters that need this must not drag the whole index (and its
// import cycle risk with api.js) along with it.
//
// \p{M} rather than a range of combining marks typed by hand: with the literal
// characters in the source, any trip through an editor that normalises the file
// stops matching without raising a single error.
//
// The apostrophe folds to ASCII after the accents, and it has to be applied to
// both sides -- the name and the typed term -- so one line covers both. The
// datasets store "Farfetch’d" with U+2019, which is on no ordinary keyboard:
// typing "farfetch'd" gave 0 results where typing less ("farfetch") gave 3.
// U+00B4 has no canonical decomposition, so it survives the NFD above and has
// to be named here alongside the typographic quotes.
//
// What it deliberately does NOT fold is punctuation: "type: null" matches,
// "type null" does not, and "porygon-z" matches where "porygon z" does not.
// Folding hyphens and colons would make unrelated names collide.
export const norm = s => (s || '').toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')
  .replace(/[’‘`´]/g, "'");
