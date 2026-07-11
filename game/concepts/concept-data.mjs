// MiniTown — datos puros de concepto (estados del pueblo + paleta dia/noche).
// Modulo ESM PURO: sin imports, sin red, sin reloj, sin random. Deterministico.
// Consumido tal cual por tests/game/test_concept_data.mjs y por concepts.html.
// Contrato: knowledge/contracts/concept-visuals.md

export const GRID = { w: 24, h: 18 };

// --- Catalogo maestro de edificios del MISMO pueblo -------------------------
// Cada entrada fija la posicion y el kind; la posicion NO cambia entre estados.
// Los estados solo eligen que subconjunto existe y con que stage/level, de modo
// que un edificio temprano reaparece identico o crecido en la misma celda.
const PLOTS = {
  // Bloque A: hilera residencial (arriba-izquierda), 3 casas pegadas.
  a1: { x: 2, y: 2, w: 2, h: 2, kind: 'residential' },
  a2: { x: 4, y: 2, w: 2, h: 2, kind: 'residential' },
  a3: { x: 6, y: 2, w: 2, h: 2, kind: 'residential' },
  // Bloque B: tiendas (arriba-centro), 2 locales pegados.
  b1: { x: 11, y: 2, w: 2, h: 2, kind: 'shop' },
  b2: { x: 13, y: 2, w: 2, h: 2, kind: 'shop' },
  // Bloque C: oficina (arriba-derecha), 1 edificio.
  c1: { x: 18, y: 2, w: 3, h: 2, kind: 'workspace' },
  // Bloque D: mixto residencial + tienda (centro-izquierda).
  d1: { x: 2, y: 7, w: 2, h: 2, kind: 'residential' },
  d2: { x: 4, y: 7, w: 2, h: 2, kind: 'shop' },
  // Bloque E: complejo de trabajo (centro), 2 edificios pegados.
  e1: { x: 9, y: 7, w: 3, h: 3, kind: 'workspace' },
  e2: { x: 12, y: 7, w: 2, h: 3, kind: 'workspace' },
  // Bloque F: barrio residencial (abajo-izquierda), 3 casas pegadas.
  f1: { x: 2, y: 12, w: 2, h: 2, kind: 'residential' },
  f2: { x: 4, y: 12, w: 2, h: 2, kind: 'residential' },
  f3: { x: 6, y: 12, w: 2, h: 2, kind: 'residential' },
  // Bloque G: tiendas (abajo-centro), 2 locales pegados.
  g1: { x: 12, y: 12, w: 2, h: 2, kind: 'shop' },
  g2: { x: 14, y: 12, w: 2, h: 2, kind: 'shop' },
  // Bloque H: oficina (abajo-derecha), 1 edificio.
  h1: { x: 19, y: 12, w: 3, h: 3, kind: 'workspace' },
};

// Construye un edificio del catalogo con stage/level dados (posicion inmutable).
function make(id, stage, level) {
  const p = PLOTS[id];
  return { x: p.x, y: p.y, w: p.w, h: p.h, kind: p.kind, stage, level };
}

// Caminos = perimetro de los bloques: celdas vecinas (8 direcciones) a algun
// edificio que no sean edificio y esten dentro de la grilla. Los edificios de un
// bloque estan pegados (comparten borde), asi que nunca queda camino entre medio;
// las calles solo bordean los bloques y llenan los huecos entre ellos.
function computeRoads(buildings) {
  const occupied = new Set();
  for (const b of buildings) {
    for (let dx = 0; dx < b.w; dx++) {
      for (let dy = 0; dy < b.h; dy++) occupied.add(`${b.x + dx},${b.y + dy}`);
    }
  }
  const roads = new Set();
  for (const key of occupied) {
    const [cx, cy] = key.split(',').map(Number);
    for (let nx = cx - 1; nx <= cx + 1; nx++) {
      for (let ny = cy - 1; ny <= cy + 1; ny++) {
        const inGrid = nx >= 0 && ny >= 0 && nx < GRID.w && ny < GRID.h;
        const nk = `${nx},${ny}`;
        if (inGrid && !occupied.has(nk)) roads.add(nk);
      }
    }
  }
  return [...roads].map(k => k.split(',').map(Number));
}

// Edificios del pueblo ya crecido: los 16 lotes, todos 'built', niveles 1..3.
const GROWN_BUILDINGS = [
  make('a1', 'built', 2), make('a2', 'built', 1), make('a3', 'built', 3),
  make('b1', 'built', 2), make('b2', 'built', 3),
  make('c1', 'built', 2),
  make('d1', 'built', 1), make('d2', 'built', 2),
  make('e1', 'built', 3), make('e2', 'built', 2),
  make('f1', 'built', 1), make('f2', 'built', 2), make('f3', 'built', 1),
  make('g1', 'built', 2), make('g2', 'built', 3),
  make('h1', 'built', 3),
];

// Pueblo en obra: primer nucleo (bloques A, B y D) en distintas etapas.
const CONSTRUCTION_BUILDINGS = [
  make('a1', 'built', 1), make('a2', 'frame', 1), make('a3', 'foundation', 1),
  make('b1', 'frame', 1), make('b2', 'foundation', 1),
  make('d1', 'built', 1), make('d2', 'foundation', 1),
];

export const TOWN_STATES = [
  {
    id: 'empty',
    name: 'Terreno vacio',
    description: 'El valle antes de la primera piedra: solo pasto y horizonte.',
    timeOfDay: 0.5,
    buildings: [],
    roads: [],
    people: 0,
    cars: 0,
  },
  {
    id: 'construction',
    name: 'Pueblo en construccion',
    description: 'Se levantan las primeras casas y tiendas; hay obra a medio hacer.',
    timeOfDay: 0.35,
    buildings: CONSTRUCTION_BUILDINGS,
    roads: computeRoads(CONSTRUCTION_BUILDINGS),
    people: 3,
    cars: 1,
  },
  {
    id: 'grown',
    name: 'Pueblo crecido',
    description: 'MiniTown en su esplendor diurno: barrios, comercios y oficinas.',
    timeOfDay: 0.5,
    buildings: GROWN_BUILDINGS,
    roads: computeRoads(GROWN_BUILDINGS),
    people: 14,
    cars: 6,
  },
  {
    id: 'night',
    name: 'Pueblo de noche',
    description: 'El mismo pueblo crecido bajo la noche: ventanas y farolas encendidas.',
    timeOfDay: 0.9,
    buildings: GROWN_BUILDINGS,
    roads: computeRoads(GROWN_BUILDINGS),
    people: 8,
    cars: 4,
  },
];

// --- Paleta dia/noche continua y ciclica ------------------------------------
function lerp(a, b, k) { return a + (b - a) * k; }

function mixRGB(night, day, k) {
  return [
    Math.round(lerp(night[0], day[0], k)),
    Math.round(lerp(night[1], day[1], k)),
    Math.round(lerp(night[2], day[2], k)),
  ];
}

// Colores extremos (redondos, dentro de 0..255). Noche = cielo frio (b >= r).
const SKY_NIGHT = [20, 28, 60];
const SKY_DAY = [150, 200, 235];
const GROUND_NIGHT = [30, 40, 45];
const GROUND_DAY = [120, 170, 110];

// t en [0,1); 0 = medianoche, 0.5 = mediodia. t se toma modulo 1 (t=1 => 0 exacto).
export function dayNightPalette(t) {
  const tt = t - Math.floor(t);
  // daylight: 0 en medianoche, 1 en mediodia; suave y ciclico (periodo 1).
  const daylight = (1 - Math.cos(2 * Math.PI * tt)) / 2;
  const night = 1 - daylight;
  return {
    sky: mixRGB(SKY_NIGHT, SKY_DAY, daylight),
    ground: mixRGB(GROUND_NIGHT, GROUND_DAY, daylight),
    ambient: 0.15 + 0.5 * daylight,
    sunIntensity: daylight,
    windowGlow: 0.9 * night,
    streetlight: 0.95 * night,
  };
}
