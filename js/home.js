// ===== HOME PAGE =====
export function renderHome(container) {
  container.innerHTML = `
    <div class="home-hero">
      <div class="pokeball-icon-lg"></div>
      <h1>POKE<span class="accent">UTILS</span></h1>
      <p>Tu guia Pokemon retro definitiva</p>
    </div>

    <div class="home-grid">
      <a href="#/pokedex" class="home-card">
        <div class="icon">📖</div>
        <div class="label">POKEDEX</div>
        <div class="desc">Los 1025 Pokemon con stats, tipos y habilidades</div>
      </a>
      <a href="#/types" class="home-card">
        <div class="icon">⚡</div>
        <div class="label">TIPOS</div>
        <div class="desc">Tabla de tipos interactiva con debilidades y resistencias</div>
      </a>
      <a href="#/moves" class="home-card">
        <div class="icon">💥</div>
        <div class="label">MOVIMIENTOS</div>
        <div class="desc">Todos los movimientos con tipo, poder y descripcion</div>
      </a>
      <a href="#/abilities" class="home-card">
        <div class="icon">✨</div>
        <div class="label">HABILIDADES</div>
        <div class="desc">Lista completa de habilidades y sus efectos</div>
      </a>
      <a href="#/items" class="home-card">
        <div class="icon">🎒</div>
        <div class="label">OBJETOS</div>
        <div class="desc">Objetos con imagen, descripcion y categoria</div>
      </a>
      <a href="#/natures" class="home-card">
        <div class="icon">🧬</div>
        <div class="label">NATURALEZAS</div>
        <div class="desc">Las 25 naturalezas y sus modificadores de stats</div>
      </a>
      <a href="#/calculator" class="home-card">
        <div class="icon">🔢</div>
        <div class="label">CALCULADORA</div>
        <div class="desc">Calcula IVs, EVs y stats de tus Pokemon</div>
      </a>
    </div>
  `;
}
