---
type: 'Task Contract'
title: 'Sonido cozy: ambiente procedural dia/noche y efectos de eventos'
description: 'Audio 100% sintetizado con WebAudio (sin assets): pajaros de dia, grillos de noche, viento y pad suaves que siguen el ciclo horario, campanitas pentatonicas para eventos (colocar, obra lista, venta), con parametros como datos en GAME.md, nucleo puro testeable y toggle persistente en la UI.'
tags: ['minitown', 'audio', 'webaudio', 'ambient', 'cozy']

task: minitown-audio
intent: "Darle sonido ambiente y efectos cozy al pueblo, sintetizados y gobernados por datos."
target: game/src/audio-core.mjs
signature: "def ambientMix(audio: dict, t: float) -> dict:"
test_command: "node --test tests/game/test_audio_core.mjs"
budget:
  max_cyclomatic_complexity: 10
  max_nesting_depth: 4
tests: "tests/game/test_audio_core.mjs"
tests_sha256: "de315cdbf97e136c6bfe19f4bd2f101f6bb12f506f04acb1b0c19cc1c1575707"
touch_only: ['game/src/audio-core.mjs', 'game/GAME.md', 'game/profiles/minitown.js', 'game/game-data.generated.js', 'game/src/render.mjs', 'game/minitown.html']
deps_allowed: []
forbids: ['network', 'assets-binarios', 'npm']
---

# Contract: minitown-audio

## Intent
El pueblo se ve cozy; ahora tambien tiene que sonar cozy. Sin assets binarios ni
dependencias: TODO se sintetiza con WebAudio, y los numeros que definen el caracter
(niveles, escala de notas, envolventes de eventos) viven en GAME.md como cualquier otro
balance. El nucleo puro (mezcla por hora, notas por indice) queda testeable en Node sin
AudioContext.

## Interface
```python
def ambientMix(audio: dict, t: float) -> dict:
    """game/src/audio-core.mjs (ESM PURO, sin imports, sin WebAudio, sin Date/random).
    t en [0,1) hora del dia (0 medianoche, 0.5 mediodia), tratado modulo 1.
    Devuelve {'birds':0..1, 'crickets':0..1, 'wind':0..1, 'pad':0..1}: pajaros
    pico de dia y ~0 (<=0.05) a medianoche, grillos pico de noche y ~0 a
    mediodia, transiciones SUAVES (sin saltos > 0.2 por delta t de 0.01),
    ciclica (ambientMix(a,1) identico a ambientMix(a,0)). Los topes vienen de
    audio.ambient: birdsMax, cricketsMax, windBase, padMax (birdsMax 0 =>
    birds 0 siempre).
    chimeFor(audio, k) -> audio.scale[k % len(scale)] (nota determinista)."""
```
Datos nuevos en `game/GAME.md` (coleccion `audio` -> clave derivada `AUDIO`):
- `masterGain` en (0,1].
- `ambient`: `birdsMax`, `cricketsMax`, `windBase`, `padMax` en 0..1 (elegir valores
  sutiles: esto es ambiente, no protagonista).
- `scale`: >=5 frecuencias Hz ASCENDENTES en 100..2000 (pentatonica mayor recomendada,
  p.ej. C4 E4 G4 A4 C5 E5 — suena cozy sin disonancias).
- `events`: `place`, `buildDone`, `sale`, cada uno `{gain: (0,1], dur: (0,3]}` (y los
  campos extra que el motor quiera: tipo de envolvente, detune, etc.).
Perfil `minitown.js`: derive suma `{key:'AUDIO', from:'audio'}` y regla `mt-audio`
(error si audio presente trae masterGain/gains fuera de (0,1], durs fuera de (0,3],
escala corta/no ascendente/fuera de rango).

Capa de UI (render.mjs + minitown.html), motor WebAudio chico y prolijo:
- AudioContext creado/resumido recien tras el PRIMER gesto del usuario (politica de
  autoplay); boton de sonido en la toolbar (icono altavoz), estado persistido en
  localStorage `minitown-sound` ('on'/'off', default 'on' pero sin sonar hasta el gesto).
- Ambiente continuo: viento = ruido (buffer de ruido generado por codigo, LFO suave de
  ganancia), pajaros = chirps FM cortos disparados a intervalos irregulares
  DETERMINISTAS (PRNG sembrado, patron mulberry32 como agents.mjs) escalados por
  mix.birds, grillos = pulsos agudos periodicos escalados por mix.crickets, pad = 2-3
  osciladores suaves (acorde de la escala) a mix.pad. Actualizar la mezcla ~2 veces por
  segundo con ambientMix(AUDIO, timeOfDay(town)) y rampas (linearRampToValueAtTime),
  jamas saltos de ganancia (clicks).
- Eventos: colocar bloque ok -> nota `place` (chimeFor con un contador); edificio que
  pasa a 'built' -> `buildDone`; venta (town.money sube por tickEconomy) -> `sale`
  suave. Envolventes cortas (attack ~5ms, release exponencial), gains de AUDIO.events.
- Silencio total cuando el toggle esta off (masterGain a 0 con rampa) y en pestana
  oculta no acumular eventos.
- `window.MT` suma `audio: {enabled(), toggle(), ctxState()}` para verificacion del PM.

## Invariants
- `node --test tests/game/test_audio_core.mjs` 4/4 y TODA la suite tests/game/ verde
  (el oraculo de datos exige no-drift del generado tras tocar GAME.md; sus asserts de
  derive/TEXTS son minimos, AUDIO no los rompe).
- audio-core.mjs puro: sin imports, sin WebAudio, sin reloj, sin random.
- Nada de assets binarios, fetch de audio, ni dependencias.
- Sin gesto del usuario no se crea/resume el AudioContext (cero warnings de autoplay
  en consola).

## Examples
- Mediodia: pajaros audibles, cero grillos; medianoche: grillos + viento, cero pajaros;
  atardecer: crossfade suave.
- Colocar 3 bloques seguidos -> tres notas ascendentes de la escala (contador ciclando).
- Toggle off -> silencio (rampa), recargar la pagina -> sigue off (persistido).

## Do / Don't
- DO: ganancias siempre con rampas; un solo AudioContext; nodos reutilizados (no crear
  osciladores por frame — solo por evento/chirp, con stop() y desconexion).
- DO: mantener el patron de codigo de render.mjs (secciones comentadas, helpers chicos).
- DON'T: reproducir nada antes del primer gesto; Tone.js ni libs; assets; tocar
  sim-core/agents/economy/save-core ni tests ni otros contratos.

## Tests
Congelados por el PM en `tests/game/test_audio_core.mjs` (sellados con `tests_sha256`):
forma de AUDIO en el artefacto real, fisica de la mezcla (dia/noche, ciclica, suave,
topes de datos mandan), chimeFor determinista, y regla mt-audio. Suite completa verde.

## Constraints
- PARAR y reportar si un test congelado parece incorrecto o si algo exige tocar fuera
  de touch_only.
