// Politica y crecimiento de MiniTown — modulo ESM PURO (sin imports, sin Date, sin Math.random).
// Ver knowledge/contracts/minitown-policy.md. Estado (policy/immigrants/emigrants) vive en `town`
// y es 100% JSON-serializable (lo persiste minitown-save).

// kinds cuyo empleo (capacity de edificios ocupados) cuenta como oferta laboral.
const WORK_KINDS = { workspace: true, farm: true, warehouse: true, market: true };

function clamp01(v) {
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

// Instala el estado de politica en el town si falta. IDEMPOTENTE: no pisa lo existente.
export function ensurePolicy(town, game) {
  const POLICY = game.POLICY;
  if (!town.policy) town.policy = { taxRate: POLICY.taxDefault };
  if (typeof town.immigrants !== 'number') town.immigrants = 0;
  if (typeof town.emigrants !== 'number') town.emigrants = 0;
  return town.policy;
}

// Cupos de vivienda libres (capacidad de casas ocupadas menos residentes actuales).
function freeHousing(town, ag) {
  let cap = 0;
  for (const b of town.buildings) if (b.kind === 'residential' && b.occupied) cap += b.capacity;
  return cap - ag.residents.length;
}

// Atractividad en 0..1: bienes en mercados, empleo disponible e impuestos bajos.
export function attractiveness(town, ag, game) {
  const POLICY = game.POLICY;
  const residents = ag.residents.length;
  let stockTotal = 0;
  let jobsTotal = 0;
  for (const b of town.buildings) {
    if (b.kind === 'market' && typeof b.stock === 'number') stockTotal += b.stock;
    if (WORK_KINDS[b.kind] && b.occupied) jobsTotal += b.capacity;
  }
  const goodsScore = Math.min(1, stockTotal / Math.max(1, residents * POLICY.goodsPerResident));
  const jobsScore = Math.min(1, jobsTotal / Math.max(1, residents));
  const taxScore = 1 - clamp01((town.policy.taxRate - POLICY.taxBaseline) / (POLICY.taxMax - POLICY.taxBaseline));
  const w = POLICY.weights;
  return w.goods * goodsScore + w.jobs * jobsScore + w.lowTax * taxScore;
}

// Un tick de politica: recauda impuestos y actualiza las colas de migracion.
export function tickPolicy(town, game, dt, ag) {
  const POLICY = game.POLICY;
  const days = dt / game.SIM.dayLengthSec;
  const residents = ag.residents.length;
  town.money += residents * town.policy.taxRate * days;
  const att = attractiveness(town, ag, game);
  // Gate: nadie se muda a una ciudad de la que se huye (att por debajo del umbral).
  if (att >= POLICY.leaveBelow) {
    town.immigrants += POLICY.baseImmigrationPerDay * att * days;
    const cap = Math.max(0, freeHousing(town, ag)) + 1;
    if (town.immigrants > cap) town.immigrants = cap;
  } else {
    town.emigrants += POLICY.emigrationPerDay * (POLICY.leaveBelow - att) / POLICY.leaveBelow * days;
  }
}
