---
type: 'Task Contract'
title: 'Clima: lluvia y nieve deterministas que cambian el pueblo'
description: 'Sistema de clima sembrado y persistente (despejado/lluvia/nieve) con consecuencias reales: la lluvia riega las granjas, la nieve pausa la produccion y frena a los peatones, el pueblo se oscurece y blanquea, y llueve tambien en el audio. Estado en town (persiste en el save), efectos como datos en GAME.md.'
tags: ['minitown', 'weather', 'rain', 'snow', 'simulation']

task: minitown-weather
intent: "Agregar lluvia y nieve deterministas que cambien de verdad la simulacion, el aspecto y el sonido del pueblo."
target: game/src/weather-core.mjs
signature: "def tickWeather(town: dict, game: dict, dt: float) -> None:"
test_command: "node --test tests/game/test_weather_core.mjs"
budget:
  max_cyclomatic_complexity: 10
  max_nesting_depth: 4
tests: "tests/game/test_weather_core.mjs"
tests_sha256: "fca87807c363179cd7a90dc4453fa69a5a3f4a39cf3404470c6079e84ee9bbeb"
touch_only: ['game/src/weather-core.mjs', 'game/GAME.md', 'game/profiles/minitown.js', 'game/game-data.generated.js', 'game/src/sim-core.mjs', 'game/src/agents.mjs', 'game/src/render.mjs', 'game/minitown.html']
deps_allowed: []
forbids: ['network', 'assets-binarios', 'Math.random', 'Date']
---

# Contract: minitown-weather

## Intent
El pueblo cozy necesita clima con consecuencias, no confeti: lluvia que riega, nieve que
frena y blanquea. El estado vive en `town` (el guardado de [minitown-save](./minitown-save.md)
lo persiste gratis, y `ensureWeather` repara saves viejos sin clima). Los modulos ya
sellados (sim-core, agents) NO ganan imports: solo leen el campo plano
`town.weatherMods` con fallback neutro — sus oraculos siguen verdes tal cual.

## Interface
```python
def tickWeather(town: dict, game: dict, dt: float) -> None:
    """game/src/weather-core.mjs (ESM PURO: sin imports, sin Date, sin Math.random;
    PRNG mulberry32 con estado serializable DENTRO de town.weather).
    - ensureWeather(town, game, seed) -> town.weather (lo crea si falta, junto a
      town.weatherMods = {farmRate:1, walkSpeed:1}; arranca type 'clear'). Devuelve
      el estado. Repara towns/saves sin clima.
    - tickWeather(town, game, dt): dt en segundos reales (horas de juego =
      dt / SIM.dayLengthSec * 24). Maquina de estados: clear -> (rain | snow |
      clear) por WEATHER.chance con el PRNG; duraciones sorteadas en
      [<tipo>MinH, <tipo>MaxH]; rain/snow -> clear. `intensity` 0..1 con rampa
      suave (subida/bajada, sin saltos >0.35 por 0.1 h). Mantiene
      town.weatherMods interpolando entre 1 y el mul del tipo por intensity
      (rainFarmMul, snowFarmMul, rainWalkMul, snowWalkMul). `cover` (manto de
      nieve 0..1) crece nevando a razon de snowCoverH horas hasta 1 y se
      derrite (monotono) sin nieve.
    - weatherFx(weather, WEATHER) -> {rain, snow, darken, groundWhite, sound}
      todos 0..1: rain/snow = intensity del tipo activo, darken <= darkenMax,
      groundWhite = cover, sound <= rainSoundMax (solo lluvia)."""
```
Datos nuevos en GAME.md (coleccion `weather` -> derive `WEATHER`):
- `periods`: clearMinH/clearMaxH/rainMinH/rainMaxH/snowMinH/snowMaxH (> 0, max >= min).
- `chance`: rain + snow en 0..1 con suma <= 1 (el resto re-sortea despejado).
- `effects`: rainFarmMul >= 1, snowFarmMul = 0, rainWalkMul en (0,1], snowWalkMul en (0,1).
- `visuals`: darkenMax y rainSoundMax en 0..1, snowCoverH > 0.
- TEXTS += weatherClear, weatherRain, weatherSnow (espanol ASCII).
- Regla `mt-weather` en el perfil (error ante rangos invalidos, p.ej. chance.rain 2).

Integraciones minimas en modulos sellados (UNA linea de efecto en cada uno, sin imports):
- sim-core.mjs: produccion de granja x `(town.weatherMods?.farmRate ?? 1)`.
- agents.mjs: velocidad a pie x `(town.weatherMods?.walkSpeed ?? 1)` (los autos no).

UI (render.mjs + minitown.html):
- Llamar ensureWeather al arrancar (tambien tras restaurar un save) con seed fija, y
  tickWeather en el loop.
- Lluvia: particulas simples (lineas/puntos que caen, ~200-400 instancias recicladas)
  moduladas por fx.rain; nieve: copos lentos con deriva por fx.snow.
- Luz: atenuar sol/ambiente por fx.darken; suelo: mezclar el color del pasto hacia
  blanco nieve por fx.groundWhite (y opcionalmente techos).
- Audio: capa de ruido de lluvia en el motor existente con ganancia fx.sound
  (rampas, como el viento).
- HUD: indicador del clima actual (TEXTS.weather*). window.MT suma `weather()` que
  devuelve {type, intensity, fx} para verificacion del PM.

## Invariants
- `node --test tests/game/test_weather_core.mjs` 5/5 y TODA la suite tests/game/ verde
  (oraculos sellados de sim/agents/econ/save intactos: sin weatherMods todo es x1).
- Determinista: misma semilla, mismo clima; JSON round-trip a mitad de tormenta
  continua identico.
- Los fixtures viejos (sin WEATHER en el game) no rompen: sim/agents usan fallback 1;
  weather-core solo se invoca desde la UI.

## Examples
- 300 h de juego con semilla fija: se ven los 3 climas, duraciones dentro de los rangos.
- Lluvia plena: farmRate ~= rainFarmMul (riega), fx.sound > 0 (se escucha).
- Nieve plena 6 h: suelo blanco (groundWhite > 0.9), peatones a snowWalkMul, granjas
  paradas; al despejar, el manto se derrite monotono.

## Do / Don't
- DO: reusar los patrones existentes (mulberry32 de agents, rampas del audio, grupos
  de instancias del render).
- DO: particulas baratas (un solo BufferGeometry/Points por tipo esta bien).
- DON'T: clima dentro de tick() de sim-core (el reloj del clima es de weather-core y
  lo llama la UI); Math.random/Date en NINGUN modulo; tocar tests ni otros contratos;
  romper la firma de ambientMix ni de ningun export sellado.

## Tests
Congelados por el PM en `tests/game/test_weather_core.mjs` (sellados con `tests_sha256`):
WEATHER del artefacto + mt-weather, maquina de estados determinista con duraciones
acotadas e intensidad suave, weatherMods honrados por sim-core y agents, fx (acumulacion
y derretimiento de nieve, sonido de lluvia acotado), determinismo y persistencia.

## Constraints
- PARAR y reportar si un test congelado parece incorrecto, si mantener verdes los
  oraculos previos exigiera cambiar su semantica, o si algo pide tocar fuera de
  touch_only.
