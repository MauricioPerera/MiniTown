/**
 * profiles/minitown.js — Perfil "MiniTown" del Protocolo GAME (city-sim cozy god-game).
 *
 * COMPONE al perfil `voxel`: reutiliza sus refs/rules/derive para materials/prefabs/
 * structures (arte voxel) SIN copiarlos a mano, y agrega las colecciones de MiniTown
 * (zonas, variantes, etapas, paleta dia/noche, horarios, balance, textos, nombres).
 *
 * Isomorfo (UMD): en Node compone `require('./voxel')`; en navegador
 * `window.GameProfiles.voxel`. Frontera dato/logica: el perfil solo valida y deriva
 * datos; la simulacion y el render son de contratos posteriores.
 */
(function (factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') (window.GameProfiles = window.GameProfiles || {})['minitown'] = api;
})(function () {

  // --- Composicion del perfil voxel (isomorfa) ---
  const voxel = (typeof module !== 'undefined' && module.exports && typeof require !== 'undefined')
    ? require('./voxel')
    : ((typeof window !== 'undefined' && window.GameProfiles) ? window.GameProfiles.voxel : null);
  if (!voxel) throw new Error('minitown: no se pudo componer el perfil voxel (falta require(\'./voxel\') o window.GameProfiles.voxel)');

  const rgbOk = c => Array.isArray(c) && c.length === 3 && c.every(v => typeof v === 'number' && v >= 0 && v <= 255);
  const intsUp = (a, min) => Array.isArray(a) && a.length === 3 &&
    a.every(n => Number.isInteger(n) && n >= min) && a[1] >= a[0] && a[2] >= a[1];

  // mt-schedule-order (REQUERIDA): wake < workStart < workEnd < sleep estricto.
  function ruleScheduleOrder({ data, add }) {
    for (const [name, s] of Object.entries(data.schedules || {})) {
      const o = s || {};
      if (!(o.wake < o.workStart && o.workStart < o.workEnd && o.workEnd < o.sleep))
        add('error', 'mt-schedule-order', 'schedule ' + name + ': horario no estrictamente creciente (wake<workStart<workEnd<sleep): ' + JSON.stringify(o));
    }
  }

  // mt-variant-color (REQUERIDA): body/roof/trim de cada variante son rgb 0..255.
  function ruleVariantColor({ data, add }) {
    for (const [kind, list] of Object.entries(data.buildingVariants || {})) {
      const arr = Array.isArray(list) ? list : [];
      for (let i = 0; i < arr.length; i++) {
        const v = arr[i] || {};
        for (const part of ['body', 'roof', 'trim'])
          if (!rgbOk(v[part]))
            add('error', 'mt-variant-color', kind + '[' + i + '].' + part + ' rgb fuera de 0..255: ' + JSON.stringify(v[part]));
      }
    }
  }

  // mt-schedule-range: cada hora en 0..24.
  function ruleScheduleRange({ data, add }) {
    for (const [name, s] of Object.entries(data.schedules || {}))
      for (const k of ['wake', 'workStart', 'workEnd', 'sleep']) {
        const v = (s || {})[k];
        if (typeof v !== 'number' || v < 0 || v > 24)
          add('error', 'mt-schedule-range', 'schedule ' + name + '.' + k + ' fuera de 0..24: ' + v);
      }
  }

  // mt-kinds: exactamente los 6 kinds (residential|shop|workspace|farm|warehouse|market);
  // capacityPerLevel 3 enteros >=1 no decrecientes; heightPerLevel 3 numeros > 0.
  const KINDS6 = 'farm,market,residential,shop,warehouse,workspace';
  function ruleKinds({ data, add }) {
    if (!('buildingKinds' in data)) return;
    const kinds = data.buildingKinds || {};
    const got = Object.keys(kinds).sort().join(',');
    if (got !== KINDS6)
      add('error', 'mt-kinds', 'buildingKinds debe ser exactamente los 6 kinds (' + KINDS6 + '), no: ' + got);
    for (const [k, spec] of Object.entries(kinds)) {
      const s = spec || {};
      if (!intsUp(s.capacityPerLevel, 1))
        add('error', 'mt-kinds', k + '.capacityPerLevel debe ser 3 enteros >=1 no decrecientes: ' + JSON.stringify(s.capacityPerLevel));
      const h = s.heightPerLevel;
      if (!Array.isArray(h) || h.length !== 3 || !h.every(n => typeof n === 'number' && n > 0))
        add('error', 'mt-kinds', k + '.heightPerLevel debe ser 3 numeros > 0: ' + JSON.stringify(h));
    }
  }

  // mt-palette: cielo nocturno frio (b>=r); windowGlowMax y streetlightMax en (0,1].
  function rulePalette({ data, add }) {
    if (!('palette' in data)) return;
    const p = data.palette || {};
    for (const k of ['skyDay', 'skyNight', 'groundDay', 'groundNight'])
      if (!rgbOk(p[k])) add('error', 'mt-palette', 'palette.' + k + ' rgb invalido: ' + JSON.stringify(p[k]));
    if (rgbOk(p.skyNight) && p.skyNight[2] < p.skyNight[0])
      add('error', 'mt-palette', 'palette.skyNight debe ser frio (b >= r): ' + JSON.stringify(p.skyNight));
    for (const k of ['windowGlowMax', 'streetlightMax'])
      if (!(typeof p[k] === 'number' && p[k] > 0 && p[k] <= 1))
        add('error', 'mt-palette', 'palette.' + k + ' fuera de (0,1]: ' + p[k]);
  }

  // mt-sim: dayLengthSec>0, walkSpeed>0, carSpeed>walkSpeed; arrays 3 enteros >=1 no decrecientes.
  function ruleSim({ data, add }) {
    if (!('sim' in data)) return;
    const s = data.sim || {};
    if (!(typeof s.dayLengthSec === 'number' && s.dayLengthSec > 0))
      add('error', 'mt-sim', 'sim.dayLengthSec debe ser > 0: ' + s.dayLengthSec);
    if (!(typeof s.walkSpeed === 'number' && s.walkSpeed > 0))
      add('error', 'mt-sim', 'sim.walkSpeed debe ser > 0: ' + s.walkSpeed);
    if (!(typeof s.carSpeed === 'number' && s.carSpeed > s.walkSpeed))
      add('error', 'mt-sim', 'sim.carSpeed debe superar a walkSpeed: ' + s.carSpeed + ' vs ' + s.walkSpeed);
    for (const k of ['residentsPerHouseLevel', 'jobsPerWorkspaceLevel'])
      if (!intsUp(s[k], 1))
        add('error', 'mt-sim', 'sim.' + k + ' debe ser 3 enteros >=1 no decrecientes: ' + JSON.stringify(s[k]));
  }

  // mt-stages: foundation|frame|built con durationSec > 0.
  function ruleStages({ data, add }) {
    if (!('stages' in data)) return;
    const got = Object.keys(data.stages || {}).sort().join(',');
    if (got !== 'built,foundation,frame')
      add('error', 'mt-stages', 'stages debe ser exactamente foundation|frame|built, no: ' + got);
    for (const [k, st] of Object.entries(data.stages || {}))
      if (!(typeof (st || {}).durationSec === 'number' && st.durationSec > 0))
        add('error', 'mt-stages', 'stages.' + k + '.durationSec debe ser > 0: ' + (st || {}).durationSec);
  }

  // mt-texts: todas las claves presentes, strings no vacios (v2 suma las de economia).
  function ruleTexts({ data, add }) {
    if (!('texts' in data)) return;
    const t = data.texts || {};
    for (const k of ['home', 'shop', 'workspace', 'residents', 'workers', 'shoppers', 'underConstruction', 'vacant',
      'farm', 'warehouse', 'market', 'money', 'stock', 'noFunds'])
      if (!(typeof t[k] === 'string' && t[k].length > 0))
        add('error', 'mt-texts', 'texts.' + k + ' faltante o vacio');
  }

  // mt-econ (v2 economia): valida la coleccion `econ` cuando esta presente. Rangos exactos
  // segun contrato: placementCost mapa con los 6 kinds enteros >=1; startingMoney entero
  // >= 3x el minimo costo; salePrice > 0; farmRatePerLevel 3 numeros > 0 no decrecientes;
  // cartLoad entero >=1; farmCap/warehouseCap/marketCap enteros >= cartLoad; restockBelow
  // entero en [1, marketCap]; cartSpeed > 0.
  const numGt0 = v => typeof v === 'number' && v > 0;
  function ruleEcon({ data, add }) {
    if (!('econ' in data)) return;
    const e = data.econ || {};
    const err = m => add('error', 'mt-econ', m);
    const pc = e.placementCost;
    const pcOk = pc && typeof pc === 'object' && Object.keys(pc).sort().join(',') === KINDS6;
    if (!pcOk) err('econ.placementCost debe cubrir exactamente los 6 kinds (' + KINDS6 + '): ' + JSON.stringify(pc && Object.keys(pc)));
    const costs = pcOk ? Object.values(pc) : [];
    for (const [k, c] of Object.entries(pc || {}))
      if (!(Number.isInteger(c) && c >= 1)) err('econ.placementCost.' + k + ' debe ser entero >= 1: ' + c);
    const minCost = costs.length ? Math.min(...costs) : null;
    if (!(Number.isInteger(e.startingMoney) && minCost != null && e.startingMoney >= 3 * minCost))
      err('econ.startingMoney debe ser entero >= 3x el costo minimo (' + (minCost != null ? 3 * minCost : '?') + '): ' + e.startingMoney);
    if (!numGt0(e.salePrice)) err('econ.salePrice debe ser numero > 0: ' + e.salePrice);
    const fr = e.farmRatePerLevel;
    if (!(Array.isArray(fr) && fr.length === 3 && fr.every(numGt0) && fr[1] >= fr[0] && fr[2] >= fr[1]))
      err('econ.farmRatePerLevel debe ser 3 numeros > 0 no decrecientes: ' + JSON.stringify(fr));
    if (!(Number.isInteger(e.cartLoad) && e.cartLoad >= 1)) err('econ.cartLoad debe ser entero >= 1: ' + e.cartLoad);
    const load = Number.isInteger(e.cartLoad) ? e.cartLoad : 1;
    for (const k of ['farmCap', 'warehouseCap', 'marketCap'])
      if (!(Number.isInteger(e[k]) && e[k] >= load)) err('econ.' + k + ' debe ser entero >= cartLoad (' + load + '): ' + e[k]);
    const cap = Number.isInteger(e.marketCap) ? e.marketCap : Infinity;
    if (!(Number.isInteger(e.restockBelow) && e.restockBelow >= 1 && e.restockBelow <= cap))
      err('econ.restockBelow debe ser entero en [1, marketCap]: ' + e.restockBelow);
    if (!numGt0(e.cartSpeed)) err('econ.cartSpeed debe ser numero > 0: ' + e.cartSpeed);
  }

  // mt-audio (audio cozy): valida la coleccion `audio` cuando esta presente. Rangos exactos
  // segun contrato: masterGain y gains de eventos en (0,1]; niveles de ambient en 0..1;
  // durs de eventos en (0,3]; escala de >=5 notas ascendentes en 100..2000 Hz.
  const inUnit = v => typeof v === 'number' && v > 0 && v <= 1;   // (0,1]
  const in01c = v => typeof v === 'number' && v >= 0 && v <= 1;   // [0,1]
  function ruleAudio({ data, add }) {
    if (!('audio' in data)) return;
    const a = data.audio || {};
    const err = m => add('error', 'mt-audio', m);
    if (!inUnit(a.masterGain)) err('audio.masterGain debe estar en (0,1]: ' + a.masterGain);
    const amb = a.ambient || {};
    for (const k of ['birdsMax', 'cricketsMax', 'windBase', 'padMax'])
      if (!in01c(amb[k])) err('audio.ambient.' + k + ' debe estar en 0..1: ' + amb[k]);
    const sc = a.scale;
    if (!(Array.isArray(sc) && sc.length >= 5)) {
      err('audio.scale debe ser una lista de >=5 notas: ' + JSON.stringify(sc));
    } else {
      for (let i = 0; i < sc.length; i++) {
        if (!(typeof sc[i] === 'number' && sc[i] >= 100 && sc[i] <= 2000))
          err('audio.scale[' + i + '] fuera de 100..2000 Hz: ' + sc[i]);
        if (i > 0 && !(sc[i] > sc[i - 1])) err('audio.scale debe ser ascendente (indice ' + i + '): ' + sc[i]);
      }
    }
    const ev = a.events || {};
    for (const k of ['place', 'buildDone', 'sale']) {
      const e = ev[k] || {};
      if (!inUnit(e.gain)) err('audio.events.' + k + '.gain debe estar en (0,1]: ' + e.gain);
      if (!(typeof e.dur === 'number' && e.dur > 0 && e.dur <= 3)) err('audio.events.' + k + '.dur debe estar en (0,3]: ' + e.dur);
    }
  }

  // mt-names: >=20 nombres unicos.
  function ruleNames({ data, add }) {
    if (!('names' in data)) return;
    const n = data.names;
    if (!Array.isArray(n) || n.length < 20 || new Set(n).size !== n.length)
      add('error', 'mt-names', 'names debe ser una lista de >=20 nombres unicos (tiene ' + (Array.isArray(n) ? n.length : 'no-lista') + ')');
  }

  const mtDerive = [
    { key: 'KINDS', from: 'buildingKinds' },
    { key: 'VARIANTS', from: 'buildingVariants' },
    { key: 'STAGES', from: 'stages' },
    { key: 'PALETTE', from: 'palette' },
    { key: 'SCHEDULES', from: 'schedules' },
    { key: 'SIM', from: 'sim' },
    { key: 'TEXTS', from: 'texts' },
    { key: 'NAMES', from: 'names', default: [] },
    { key: 'ECON', from: 'econ' },
    { key: 'AUDIO', from: 'audio' },
  ];

  return {
    id: 'minitown',
    specVersion: '0.1',
    sections: [
      'Overview', 'Building Kinds', 'Building Variants', 'Stages', 'Palette',
      'Schedules', 'Sim', 'Econ', 'Audio', 'Texts', 'Names', 'Materials', 'Prefabs', 'Structures',
      "Do's and Don'ts",
    ],
    required: ['version', 'name', 'profile'],
    // Reutiliza las referencias del perfil voxel (prefab/structure -> materials/prefabs).
    refs: (voxel.refs || []).slice(),
    // Reutiliza las reglas voxel (materiales, prefabs, estructuras) y agrega las de MiniTown.
    rules: (voxel.rules || []).concat([
      ruleScheduleOrder, ruleVariantColor, ruleScheduleRange, ruleKinds,
      rulePalette, ruleSim, ruleStages, ruleTexts, ruleNames, ruleEcon, ruleAudio,
    ]),
    // Reutiliza el derive voxel (MATERIALS/PREFABS/STRUCTURES/VOXELS) y agrega las colecciones sim.
    derive: (voxel.derive || []).concat(mtDerive),
  };
});
