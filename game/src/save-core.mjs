// game/src/save-core.mjs — persistencia fiel del pueblo.
// Modulo ESM PURO: sin imports, sin Date, sin random. Todo el estado de MiniTown
// (town + agentes + economia) es JSON-serializable por contrato; aca lo capitalizamos.
// Ver knowledge/contracts/minitown-save.md.

// Version del formato en disco. Un save con `v` distinta se descarta al restaurar.
export const SAVE_VERSION = 1;

// serializeState({town, ag, eco}) -> {v, town, ag, eco}
// - `town` va SIN el campo `game` (se reata al cargar); clon profundo, el original
//   no se muta y no comparte referencias con el save.
// - Determinista: serializar dos veces produce bytes identicos (sin reloj ni random).
export function serializeState(state) {
  const { game, ...townRest } = state.town;
  return {
    v: SAVE_VERSION,
    town: JSON.parse(JSON.stringify(townRest)),
    ag: JSON.parse(JSON.stringify(state.ag)),
    eco: JSON.parse(JSON.stringify(state.eco)),
  };
}

// restoreState(data, game) -> {town, ag, eco} con town.game = game (por referencia),
// o null ante CUALQUIER dato invalido (null, string, sin town/ag/eco, v distinta).
// Jamas lanza.
export function restoreState(data, game) {
  if (!data || typeof data !== 'object') return null;
  if (data.v !== SAVE_VERSION) return null;
  const { town, ag, eco } = data;
  if (!town || typeof town !== 'object') return null;
  if (!ag || typeof ag !== 'object') return null;
  if (!eco || typeof eco !== 'object') return null;
  return { town: { ...town, game }, ag, eco };
}
