// Nucleo puro del editor voxel de MiniTown (modelo de celdas, import/export de prefabs GAME.md).
// ESM puro: sin imports, sin Date, sin Math.random, sin DOM/three, sin estado mutable de modulo.
// Ver knowledge/contracts/minitown-editor-core.md

// Clave canonica "x,y,z" de una celda.
function key(x, y, z) { return x + ',' + y + ',' + z; }

// Rellena grid con `fill` en cada celda del volumen w*h*d (muta y devuelve grid).
function fillGrid(grid, w, h, d, fill) {
  for (let x = 0; x < w; x++)
    for (let y = 0; y < h; y++)
      for (let z = 0; z < d; z++) grid[key(x, y, z)] = fill;
  return grid;
}

// Expande fill (si existe) a todo el size y aplica cells como override (semantica del perfil voxel).
export function fromPrefab(prefab) {
  const [w, h, d] = prefab.size || [0, 0, 0];
  const grid = prefab.fill ? fillGrid({}, w, h, d, prefab.fill) : {};
  for (const c of (prefab.cells || [])) grid[key(c.x, c.y, c.z)] = c.m; // overrides
  return grid;
}

// Nuevo mapa con la celda seteada (reemplaza el material si ya estaba ocupada). No muta el argumento.
export function setCell(cells, x, y, z, m) {
  return { ...cells, [key(x, y, z)]: m };
}

// Nuevo mapa sin la celda indicada. No muta el argumento.
export function removeCell(cells, x, y, z) {
  const out = { ...cells };
  delete out[key(x, y, z)];
  return out;
}

// {min:[x,y,z], max:[x,y,z]} de las celdas, o null si no hay ninguna.
export function bounds(cells) {
  const keys = Object.keys(cells);
  if (keys.length === 0) return null;
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const k of keys) {
    const p = k.split(',').map(Number);
    for (let i = 0; i < 3; i++) {
      if (p[i] < min[i]) min[i] = p[i];
      if (p[i] > max[i]) max[i] = p[i];
    }
  }
  return { min, max };
}

// Prefab NORMALIZADO: min desplazado a (0,0,0), size = max+1 por eje, celdas ordenadas por y,z,x.
export function toPrefab(cells) {
  const b = bounds(cells);
  const min = b ? b.min : [0, 0, 0];
  const max = b ? b.max : [-1, -1, -1];
  const size = [max[0] - min[0] + 1, max[1] - min[1] + 1, max[2] - min[2] + 1];
  const list = Object.keys(cells).map(k => {
    const p = k.split(',').map(Number);
    return { x: p[0] - min[0], y: p[1] - min[1], z: p[2] - min[2], m: cells[k] };
  });
  list.sort((a, c) => (a.y - c.y) || (a.z - c.z) || (a.x - c.x));
  return { size, cells: list };
}

// Lista de problemas: modelo sin celdas, o material que no existe en `materials` (lo nombra). Valido -> [].
export function validateModel(prefab, materials) {
  const findings = [];
  const cells = (prefab && prefab.cells) || [];
  if (cells.length === 0) findings.push('modelo sin celdas');
  for (const c of cells) {
    if (!(c.m in materials)) findings.push('material desconocido: ' + c.m);
  }
  return findings;
}

// Nombre valido para clave de GAME.md: snake_case minuscula que empieza con letra.
export function validName(name) {
  return /^[a-z][a-z0-9_]*$/.test(name);
}

// UNA celda como flujo yaml-min byte-compatible con GAME.md (material sin comillas).
function cellLine(c) {
  return '{ x: ' + c.x + ', y: ' + c.y + ', z: ' + c.z + ', m: ' + c.m + ' }';
}

// UNA linea `name: { size: [w, h, d], cells: [...] }` en el estilo exacto de GAME.md.
export function prefabLine(name, prefab) {
  const [w, h, d] = prefab.size;
  const cells = prefab.cells.map(cellLine).join(', ');
  return name + ': { size: [' + w + ', ' + h + ', ' + d + '], cells: [' + cells + '] }';
}

// UNA linea `name: { place: [{ prefab: name, at: [0, 0, 0] }] }` que coloca el prefab 1:1 en el origen.
export function structureLine(name) {
  return name + ': { place: [{ prefab: ' + name + ', at: [0, 0, 0] }] }';
}
