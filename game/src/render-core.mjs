// Matematica de presentacion de MiniTown (paleta, visual de edificios, camara).
// ESM puro: sin imports, sin Date, sin Math.random, sin DOM/three, sin estado mutable de modulo.
// Ver knowledge/contracts/minitown-render-core.md

const TWO_PI = Math.PI * 2;

// Mezcla lineal redondeada de dos colores 0..255 por factor k en [0,1].
function mixColor(night, day, k) {
  return [
    Math.round(night[0] + (day[0] - night[0]) * k),
    Math.round(night[1] + (day[1] - night[1]) * k),
    Math.round(night[2] + (day[2] - night[2]) * k),
  ];
}

// Factor de altura por etapa de obra: foundation < frame < built=1.0, foundation > 0.
function stageFactor(stage) {
  if (stage === 'foundation') return 0.2;
  if (stage === 'frame') return 0.6;
  return 1.0; // built (y cualquier otra => terminado)
}

export function paletteAt(game, t) {
  const P = game.PALETTE;
  const frac = t - Math.floor(t); // t modulo 1
  const daylight = (1 - Math.cos(TWO_PI * frac)) / 2;
  return {
    sky: mixColor(P.skyNight, P.skyDay, daylight),
    ground: mixColor(P.groundNight, P.groundDay, daylight),
    sunIntensity: daylight,
    ambient: daylight, // en [0,1], creciente con daylight
    windowGlow: P.windowGlowMax * (1 - daylight),
    streetlight: P.streetlightMax * (1 - daylight),
  };
}

// Estilo voxel elegido deterministicamente por variant (modulo protegido, igual que VARIANTS).
// Devuelve { model, styleName } o { model: null, styleName: null } si el kind no tiene modelos.
function styleFor(game, kind, level, variant) {
  const styles = game.BUILDING_MODELS ? game.BUILDING_MODELS[kind] : null;
  if (!styles || styles.length === 0) return { model: null, styleName: null };
  const style = styles[((variant % styles.length) + styles.length) % styles.length];
  return { model: style.perLevel[level - 1], styleName: style.name };
}

export function buildingVisual(game, building) {
  const { kind, level, stage, variant } = building;
  const variants = game.VARIANTS[kind];
  const v = variants[((variant % variants.length) + variants.length) % variants.length];
  const heightPerLevel = game.KINDS[kind].heightPerLevel;
  const base = heightPerLevel[level - 1];
  const style = styleFor(game, kind, level, variant);
  return {
    height: base * stageFactor(stage),
    body: v.body,
    roof: v.roof,
    trim: v.trim,
    stage: String(stage),
    model: style.model,
    styleName: style.styleName,
  };
}

export function moverVisual(game, type, id) {
  const prefix = type === 'car' ? 'car_' : 'person_';
  const keys = Object.keys(game.VOXELS).filter(k => k.startsWith(prefix)).sort();
  const n = keys.length;
  const idx = ((id % n) + n) % n;
  return keys[idx];
}

// Stub Capa 0 (contrato minitown-render-voxel-buildings): implementacion pendiente.
export function voxelBuildingScale(bounds, w, d, height) { return null; }

export function cameraFrame(town) {
  const target = [town.w / 2, 0, town.h / 2];
  const maxSide = Math.max(town.w, town.h);
  const dist = maxSide * 1.4;      // distancia suficiente para abarcar el lado mayor
  const elevDeg = 55;               // semi-cenital, dentro de 45..65
  const elevRad = elevDeg * Math.PI / 180;
  const py = dist * Math.sin(elevRad);
  const horiz = dist * Math.cos(elevRad);
  return {
    position: [target[0], py, target[2] + horiz],
    target,
  };
}
