# Cómo generar elementos (edificios, props) con estilos

Guía autocontenida para que una IA (o un humano) agregue contenido nuevo a MiniTown
**sin tocar código**: todo el arte y el balance viven como dato en
[`game/GAME.md`](../game/GAME.md), validados por el perfil `minitown` (que compone al
perfil `voxel`) y compilados al artefacto que consume el motor.

Hay dos caminos, y producen exactamente el mismo tipo de líneas YAML:

1. **A mano**: editás `game/GAME.md`, sellás, lintéas, exportás, corrés la suite.
2. **Visual**: abrís [`game/voxel-editor.html`](../game/voxel-editor.html) en un server
   estático, modelás con el mouse y pegás las líneas YAML que exporta.

---

## Modelo de datos

Cada elemento voxel se arma en cuatro colecciones del frontmatter de `GAME.md`, de abajo
hacia arriba: **materials → prefabs → structures → buildingModels**.

### `materials` — la paleta

Colores RGB (0..255) referenciados por nombre en MAYÚSCULA. Todo material que use un
prefab tiene que existir acá.

```yaml
materials:
  WALL_TERRA: { color: [214, 132, 92] }
  ROOF_BROWN: { color: [150, 66, 48] }
  GLASS: { color: [150, 200, 230] }
```

### `prefabs` — el modelo voxel

Un modelo se define por `size: [ancho, alto, profundidad]` y sus celdas. Dos formas de
llenar celdas, combinables:

- `fill: MAT` — rellena TODO el volumen con ese material (paredes macizas).
- `cells: [{ x, y, z, m }, ...]` — coloca/sobrescribe celdas puntuales (techo, ventanas,
  puerta). Un `cell` sobre una posición ya llena por `fill` la reemplaza.

```yaml
prefabs:
  casa_terra_l1: { size: [4, 4, 4], fill: WALL_TERRA, cells: [{ x: 0, y: 3, z: 0, m: ROOF_BROWN }, { x: 1, y: 1, z: 0, m: GLASS }, { x: 2, y: 0, z: 0, m: TRUNK }] }
```

El eje **y es la altura**; `y: 0` es el piso. La puerta suele ser una columna de `TRUNK`
o `WOOD_NORD` en `z: 0`; las ventanas, celdas `GLASS`.

### `structures` — el envoltorio 1:1

Por cada prefab de edificio hay una structure con el **mismo nombre**, que coloca el
prefab en el origen. Es lo que el perfil voxel deriva a `VOXELS[nombre]` y lo que
referencia `buildingModels`.

```yaml
structures:
  casa_terra_l1: { place: [{ prefab: casa_terra_l1, at: [0, 0, 0] }] }
```

### `buildingModels` — los estilos por kind y nivel

Agrupa structures en estilos, por kind de edificio. Cada estilo es
`{ name, perLevel: [nivel1, nivel2, nivel3] }` y cada entrada de `perLevel` referencia una
structure existente.

```yaml
buildingModels:
  residential: [{ name: terracota, perLevel: [casa_terra_l1, casa_terra_l2, casa_terra_l3] }, { name: nordica, perLevel: [casa_nord_l1, casa_nord_l2, casa_nord_l3] }]
```

En runtime, `buildingVisual` elige un estilo de forma **determinista** por `(kind,
variant)` y dibuja la structure del **nivel construido**, escalada al lote
(`voxelBuildingScale`). Si un kind no tiene modelos, cae al edificio procedural (cajas
`body/roof/trim`) intacto — por eso `buildingModels` es opcional.

---

## Reglas duras

Si cualquiera de estas falla, el lint no da 0/0 y el motor no exporta:

- **YAML `yaml-min`, todo en una línea por entrada**: mapas por indentación, listas y
  objetos en flujo `[ ... ]` / `{ ... }`, con espacio tras `{`, `,` y `:`. Sin anchors,
  sin multilínea, sin comillas en los nombres de material. Copiá el estilo exacto de los
  prefabs existentes.
- **Kinds válidos** para las claves de `buildingModels`: `residential`, `shop`,
  `workspace`, `farm`, `warehouse`, `market`. Cualquier otro es error.
- **Exactamente 3 niveles** en cada `perLevel` (niveles 1..3), ni más ni menos.
- **`name` no vacío y único** dentro de su kind.
- **Refs a structures existentes**: cada entrada de `perLevel` tiene que ser una clave de
  `structures`; el error nombra la referencia rota.
- **Material existente**: todo material citado por un prefab existe en `materials`.
- **Altura creciente si querés que el nivel se lea**: no es obligatorio para pasar el
  lint, pero el estilo del juego (y el oráculo del contenido demo) espera que el modelo
  de nivel N+1 sea más alto que el de N, para que el progreso de la obra se note. Base
  compacta recomendada: 3x3 a 5x5; el render la escala al lote.
- **Detalle mínimo de una casa legible**: >= 12 voxeles y >= 3 materiales distintos
  (pared, techo y ventana como piso), no un cubo liso.

---

## Flujo a mano: editar → sellar → lint → export → test

Desde la raíz del repo, en orden:

```bash
# 1. Editar game/GAME.md (materials / prefabs / structures / buildingModels)

# 2. Re-sellar: recalcula dataSha256 del frontmatter (obligatorio tras cualquier edición)
node game/tools/game-seal.js game/GAME.md

# 3. Lint: tiene que dar 0 errores / 0 warnings
node game/tools/game-lint.js game/GAME.md

# 4. Exportar el artefacto que consume el motor
node game/tools/game-export.js game/GAME.md game/game-data.generated.js

# 5. Suite completa (incluye los oráculos sellados de datos, perfil y editor)
node --test tests/game/*.mjs
```

Si el lint marca "data no sellada", te olvidaste del paso 2. Si un test de datos marca
drift, te olvidaste del paso 4.

---

## Flujo visual: el editor voxel

`game/voxel-editor.html` es un editor 3D en Three.js cableado a los datos del juego. Su
lógica pura vive en [`game/src/editor-core.mjs`](../game/src/editor-core.mjs) (mapa de
celdas, normalización, import/export YAML).

1. Servir el repo y abrir la página:

   ```bash
   python -m http.server 8321
   # abrir http://localhost:8321/game/voxel-editor.html
   ```

2. La **paleta** sale de `window.GAME.MATERIALS`: un botón por material, con su color.
3. **Click izquierdo** coloca un voxel del material elegido; **Shift+click** borra; botón
   derecho orbita; rueda hace zoom. Podés **importar** un prefab existente desde el
   selector (carga sus celdas para partir de una base).
4. Poné un **nombre** válido (`^[a-z][a-z0-9_]*$`) y **exportá**: la página escribe las
   **dos líneas** YAML (el `prefab` y su `structure`), con un comentario que indica en qué
   sección de `GAME.md` pegar cada una.
5. Pegá esas líneas en `prefabs:` y `structures:`, agregá la referencia en
   `buildingModels:` si el modelo es un edificio, y seguí el flujo a mano desde el paso 2
   (sellar → lint → export → test).

El editor no reimplementa nada: usa las funciones puras de `editor-core.mjs`, así que el
YAML que exporta pasa el lint sin retoques.
