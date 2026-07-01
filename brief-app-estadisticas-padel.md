# Brief de producto: App de estadísticas de pádel en vivo (PWA)

## 1. Contexto y objetivo

Se requiere el desarrollo de una **Progressive Web Application (PWA)** para registrar en vivo, mediante carga manual, las estadísticas de un partido de pádel. El objetivo no es detectar automáticamente los golpes con IA (queda fuera de alcance en esta primera versión), sino ofrecer una **interfaz táctil ultra rápida** para que una persona presente en el partido (entrenador, jugador en el banco, o un tercero) pueda registrar cada punto en pocos segundos, sin distraerse del juego.

Con esos datos se generarán reportes y estadísticas por jugador, por pareja y por partido (efectividad de golpes, tipos de punto ganado/perdido, etc.).

**Por qué PWA:** permite instalarse en el celular como una app (ícono, pantalla completa), funcionar offline (clave porque en una cancha puede no haber buena señal), y evita pasar por las app stores para iterar rápido. Se recomienda mantener este enfoque.

---

## 2. Usuario y caso de uso principal

- **Usuario:** una persona junto a la cancha, con el celular en mano, durante un partido en vivo.
- **Contexto de uso:** de pie o sentado, mirando el partido, con poco tiempo entre punto y punto (a veces 5-10 segundos). La UI tiene que poder usarse **sin mirar demasiado la pantalla** y con pocos toques.
- **Resultado esperado:** al finalizar el partido, un set de estadísticas navegables (por jugador, por golpe, por set) y un historial punto por punto que puede revisarse después.

---

## 3. Conceptos del dominio (pádel)

Para que el equipo entienda el vocabulario que va a modelar:

- Un partido lo juegan **2 parejas** (equipo 1 y equipo 2), 2 jugadores por equipo.
- Dentro de cada pareja hay una posición **"drive"** (lado derecho) y **"revés"** (lado izquierdo).
- **Puntuación:** similar al tenis — 0, 15, 30, 40, juego. Se necesitan 6 juegos para ganar un set (con diferencia de 2; en 6-6 se juega tie-break a 7). Partido a mejor de 3 sets (configurable a 1 o 5). Existe la variante de **"punto de oro"** (golden point, sin ventaja en 40-40) — debe ser una opción configurable por partido.
Dependiendo el torneo la regla de puntuación varía, existe la regla de PUNTO DE ORO (en la mayoría de los partidos amateur) y sucede que cuando se llega a 40 iguales el equipo que resta elige elige de qué lado quiere que le saquen, el que gana el punto de oro gana el game. En torneos oficiales de primer padel se usa el formato STAR POINT, donde luego del 3er DEUCE se juega un punto de oro
- **Tipos de golpe habituales a catalogar** (ver detalle en sección 5): volea de derecha, volea de revés, bandeja, víbora, remate, globo, resto, saque, bajada, chiquita/dejada, contrapared, doble pared, rulo, gancho, remate x3, Recuperación fuera de pista.
- **Forma en que termina un punto:**
  - **Winner** (golpe ganador directo).
  - **Error no forzado** (el rival regala el punto).
  - **Error forzado** (el rival erra por la presión del golpe anterior).
  - **Punto por doble pared / 3 paredes** (situaciones específicas del pádel donde la pelota sale de la cancha tras rebotar en las paredes).	
Si la pelota golpea en el cuerpo de algún jugador termina

---

## 4. Alcance funcional del MVP

### 4.1 Configuración previa al partido
- Alta de jugadores (nombre, y opcionalmente club/apodo).
- Armado de las 2 parejas y asignación de posición (drive/revés) por partido — la posición puede cambiarse punto a punto si rotan, pero por defecto se fija al inicio.
- Configuración del formato: cantidad de sets, con/sin punto de oro, con/sin tie-break, con punto de oro o starpoint.

### 4.2 Captura en vivo (pantalla principal, la más crítica)
Esta es la pantalla que hay que optimizar al máximo para velocidad. Flujo propuesto (validar con diseño/UX, pero como referencia de partida):

1. **Cancha dibujada esquemáticamente** en pantalla, con los 4 jugadores representados en sus posiciones (equipo 1 arriba/abajo según convención, equipo 2 del otro lado).
2. **Paso 1 — Tocar al jugador** que terminó el punto (el que hizo el último golpe).
3. **Paso 2 — Seleccionar el golpe** con el que se definió el punto: al tocar al jugador se despliega un selector rápido (idealmente un menú radial o de "arrastrar y soltar" alrededor del jugador, como vos proponés) con los golpes más comunes para esa posición. Ejemplo de interacción: tocás al jugador y sin soltar arrastrás hacia el ícono "remate" → suelta ahí.
4. **Paso 3 — Seleccionar el resultado**: winner / error forzado (propio o del rival) / error no forzado. Esto puede integrarse en el mismo gesto (por ejemplo, arrastrar a la derecha = winner, arrastrar a la izquierda = error) para ahorrar un toque.
5. El sistema **calcula solo** el marcador (15-0, 30-15, deuce, etc.) a partir de quién ganó el punto — el usuario no debería tener que tipear el score manualmente, solo indicar quién ganó el punto y cómo.
6. Botón de **"deshacer último punto"** siempre visible y accesible (los errores de carga en vivo son inevitables).
7. Indicador visual permanente del marcador actual (set, juegos, puntos) para que el usuario pueda verificar de un vistazo que coincide con la cancha real.

> **Objetivo de UX medible:** cargar un punto completo en 2-3 toques/gestos y menos de 3 segundos. Esto debería ser un criterio de aceptación explícito para el equipo de diseño/desarrollo.

### 4.3 Historial y edición
- Lista cronológica de puntos del partido, editable (por si hay que corregir algo cargado en vivo).
- Posibilidad de marcar un punto como "revisar después" con un toque, para no frenar la carga en vivo si hay duda, y completarlo/corregirlo en el entretiempo o al final.

### 4.4 Estadísticas y reportes (post-partido, pero también consultables en vivo)
- Por jugador: cantidad de puntos ganados/perdidos, desglose por tipo de golpe, % de efectividad por golpe (winners / (winners + errores) sobre los intentos registrados con ese golpe), ratio winners vs. errores no forzados.
- Por pareja/equipo: puntos ganados por tipo de jugada, evolución del marcador por set.
- Comparativas entre jugadores o entre partidos históricos del mismo jugador (requiere persistencia entre partidos, ver sección 6).
- Exportación de datos (CSV / PDF) para compartir o analizar externamente.

### 4.5 Multi-partido / historial
- Guardar partidos anteriores y poder consultar estadísticas acumuladas de un jugador a lo largo del tiempo, no solo por partido.

---

## 5. Modelo de datos propuesto (referencia inicial, ajustable por el equipo)

```
Jugador
 - id, nombre, apodo (opcional)

Equipo (por partido)
 - id, jugador_drive_id, jugador_reves_id

Partido
 - id, fecha, equipo1_id, equipo2_id
 - formato (cantidad_sets, punto_de_oro: bool, tiebreak: bool)
 - estado (en curso / finalizado)

Set
 - id, partido_id, numero, juegos_equipo1, juegos_equipo2, resultado_tiebreak (opcional)

Juego (game)
 - id, set_id, numero, ganador_equipo_id

Punto
 - id, juego_id, timestamp
 - jugador_id (quién define el punto)
 - tipo_golpe (enum: volea_derecha, volea_reves, bandeja, vibora, remate,
              globo, resto, saque, bajada, chiquita, contrapared,
              doble_pared, rulo, otro)
 - resultado (enum: winner, error_no_forzado, error_forzado)
 - equipo_ganador_id (derivado, pero conviene guardarlo desnormalizado
   para queries rápidas de estadísticas)
 - marcador_resultante (15-0, 30-15, etc. — derivado y cacheado)
 - nota (texto libre, opcional)
```

**Nota importante:** conviene guardar el `tipo_golpe` y el `resultado` como campos separados y no combinados en un solo enum, para poder cruzar estadísticas ("efectividad de remate" = winners de remate / total de remates registrados).

---

## 6. Requisitos no funcionales (críticos para este producto)

- **Offline-first:** el partido puede jugarse sin conexión a internet. Los datos se guardan localmente (IndexedDB) y se sincronizan a un backend cuando hay conexión disponible. Esto es innegociable dado el contexto de uso (canchas sin buen wifi/datos).
- **Velocidad de interacción:** la pantalla de captura es el corazón del producto. Priorizar gestos simples (tap, drag) sobre formularios o menús anidados.
- **Instalable como PWA:** ícono en pantalla de inicio, funcionamiento en pantalla completa, service worker para offline.
- **Responsive pero mobile-first:** el uso real es 100% en celular durante el partido; el uso en desktop/tablet sería solo para revisar estadísticas después.
- **Tolerancia a errores de carga:** función de deshacer, edición posterior, sin bloqueos que impidan seguir cargando si algo no cierra (ej. discrepancia de marcador).

---

## 7. Stack tecnológico sugerido (para que el equipo lo valide/ajuste)

- **Frontend:** React o Vue + Vite, con service worker (Workbox) para funcionalidad PWA.
- **Almacenamiento local:** IndexedDB (vía Dexie.js o similar) para persistencia offline.
- **Sincronización/backend:** API REST o backend serverless (para cuando haya conexión) + base de datos en la nube (Postgres/Firebase) para historial multi-dispositivo y multi-partido.
- **Gráficos de estadísticas:** librería de charts liviana (Chart.js, Recharts).
- **Autenticación:** simple (email o Google), solo para asociar partidos guardados a un usuario/entrenador.

*(Esto es una sugerencia de partida — el equipo de ingeniería puede tener preferencias propias de stack; lo importante para el producto es offline-first + PWA + captura ultra rápida.)*

---

## 8. Fuera de alcance del MVP (pero a tener en cuenta a futuro)

- Detección automática de golpes por visión artificial / IA (mencionado como posible v2, no en este desarrollo).
- Múltiples usuarios cargando el mismo partido en simultáneo desde distintos dispositivos.
- Transmisión en vivo del marcador a espectadores (link público para seguir el partido).
- Integración con torneos/ligas (rankings, brackets).

---

## 9. Preguntas abiertas para definir con el equipo antes de arrancar

1. ¿La app la va a usar principalmente una sola persona/entrenador para sus propios partidos, o se busca que varios usuarios distintos generen partidos de forma independiente (multi-tenant)? Esto define si hace falta login desde el día uno.
2. ¿Se necesita ver estadísticas en vivo durante el partido (ej. mientras se juega el segundo set, ver stats del primero), o alcanza con verlas al finalizar?
3. ¿El catálogo de golpes debe ser fijo o configurable por el usuario (agregar/quitar tipos de golpe)?
4. ¿Hace falta soporte para dobles con rotación de posición (drive/revés) durante el partido, o se fija una vez al inicio?
5. ¿Es necesario un backend con cuenta de usuario desde el MVP, o el primer entregable puede ser 100% local (sin backend) y la sincronización se agrega después?

---

**Resumen para el equipo:** el producto es una PWA offline-first cuyo diferencial no es la sofisticación de las estadísticas sino la **velocidad y simplicidad de la captura en vivo** (cancha visual, tap + drag, 2-3 gestos por punto). Todo el diseño técnico debe subordinarse a ese objetivo de UX.
