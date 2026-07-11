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

  // mt-kinds: exactamente residential|shop|workspace; capacityPerLevel 3 enteros >=1 no
  // decrecientes; heightPerLevel 3 numeros > 0.
  function ruleKinds({ data, add }) {
    if (!('buildingKinds' in data)) return;
    const kinds = data.buildingKinds || {};
    const got = Object.keys(kinds).sort().join(',');
    if (got !== 'residential,shop,workspace')
      add('error', 'mt-kinds', 'buildingKinds debe ser exactamente residential|shop|workspace, no: ' + got);
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

  // mt-texts: todas las claves presentes, strings no vacios.
  function ruleTexts({ data, add }) {
    if (!('texts' in data)) return;
    const t = data.texts || {};
    for (const k of ['home', 'shop', 'workspace', 'residents', 'workers', 'shoppers', 'underConstruction', 'vacant'])
      if (!(typeof t[k] === 'string' && t[k].length > 0))
        add('error', 'mt-texts', 'texts.' + k + ' faltante o vacio');
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
  ];

  return {
    id: 'minitown',
    specVersion: '0.1',
    sections: [
      'Overview', 'Building Kinds', 'Building Variants', 'Stages', 'Palette',
      'Schedules', 'Sim', 'Texts', 'Names', 'Materials', 'Prefabs', 'Structures',
      "Do's and Don'ts",
    ],
    required: ['version', 'name', 'profile'],
    // Reutiliza las referencias del perfil voxel (prefab/structure -> materials/prefabs).
    refs: (voxel.refs || []).slice(),
    // Reutiliza las reglas voxel (materiales, prefabs, estructuras) y agrega las de MiniTown.
    rules: (voxel.rules || []).concat([
      ruleScheduleOrder, ruleVariantColor, ruleScheduleRange, ruleKinds,
      rulePalette, ruleSim, ruleStages, ruleTexts, ruleNames,
    ]),
    // Reutiliza el derive voxel (MATERIALS/PREFABS/STRUCTURES/VOXELS) y agrega las colecciones sim.
    derive: (voxel.derive || []).concat(mtDerive),
  };
});
