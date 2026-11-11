# API del DENUE (INEGI) — Guía técnica para desarrollo

> **Fecha de elaboración:** 10 de noviembre de 2026
> **Fuente principal:** documentación oficial del INEGI — <https://www.inegi.org.mx/servicios/api_denue.html>
> **Estado:** documento de investigación. Los puntos marcados con ⚠️ son discrepancias o comportamientos reportados por la comunidad que **deben validarse con pruebas reales** antes de producción.

---

## 1. ¿Qué es el DENUE y qué ofrece su API?

El **Directorio Estadístico Nacional de Unidades Económicas (DENUE)** es el directorio de establecimientos de México que publica el INEGI. Su API permite consultar datos de **identificación, ubicación, actividad económica y tamaño** de millones de establecimientos, a nivel nacional, por entidad federativa y por municipio.

- La página de la API habla de "más de 5 millones" de establecimientos; la interfaz de consulta de la edición basada en los Censos Económicos 2024 habla de "más de 6 millones".
- No incluye actividades agropecuarias y forestales (no son objeto del DENUE).
- La información se publica en **ediciones periódicas** (la documentación metodológica lista ediciones 05 y 11 de cada año, p. ej. 05/2025; la edición 2026/05 se publicó el 20 de mayo de 2026). Conviene confirmar cuál es la edición vigente al integrar.
- El INEGI corrigió 12 registros (nombre y razón social) de la edición 2026/05 el 29 de mayo de 2026; la versión corregida es la vigente en API, descarga masiva e interfaz. Si se guarda una copia local, hay que prever re-sincronización.

### Datos disponibles por establecimiento

| Dato | Dato |
|---|---|
| ID del establecimiento | Nombre de la unidad económica |
| Razón social | Clase de actividad económica |
| Estrato (personal ocupado) | Tipo de vialidad, calle, número exterior e interior |
| Colonia / asentamiento | Código postal |
| Localidad, municipio y entidad | Teléfono, correo electrónico, sitio web |
| Tipo de establecimiento (fijo / semifijo) | Latitud y longitud |
| Centro comercial, tipo y número de local | Corredor industrial (según método) |

---

## 2. Requisitos y acceso

### 2.1 Token

Todas las consultas requieren un **token** (número único) que va como **último segmento de la URL**. Es gratuito y se genera a nombre de quien lo solicita.

#### Cómo obtener el token del DENUE

1. Entrar al formulario oficial de generación de token del DENUE:
   **<https://www.inegi.org.mx/app/api/denue/tokenVerify/tokenverify.html>**
   (también se llega desde la página de la API, <https://www.inegi.org.mx/servicios/api_denue.html>, en la sección "Cómo obtener un token").
2. Capturar los datos que solicita el formulario ("Generar token"), incluido un **correo electrónico válido**.
3. Revisar el correo: el token **se entrega por email**, normalmente en cuestión de minutos (revisar también spam).
4. Guardar el token en un gestor de secretos o variable de entorno (ver 2.2) y probarlo con una consulta sencilla:

   ```bash
   curl -s "https://www.inegi.org.mx/app/api/denue/v1/consulta/Ficha/4292348/TU_TOKEN"
   ```

   Si el token es válido, devuelve un arreglo JSON con el establecimiento. Si no, la respuesta será vacía o de error (ver checklist en la sección 9).

> ⚠️ El formulario se carga dinámicamente y no se pudo inspeccionar su lista exacta de campos al preparar este documento. El flujo "formulario → correo → token por email" se confirma en la documentación de proyectos que lo consumen, pero conviene que la persona que haga el registro verifique los campos requeridos.

#### Puntos importantes

- **El token del DENUE es distinto** al de la API de Indicadores / BIE del INEGI. No son intercambiables. Si el proyecto usa ambas APIs, hay que generar **dos tokens**:

  | API | Dónde se genera |
  |---|---|
  | **DENUE** (esta guía) | <https://www.inegi.org.mx/app/api/denue/tokenVerify/tokenverify.html> |
  | Indicadores / Banco de Indicadores (BIE/BISE) | <https://www.inegi.org.mx/app/desarrolladores/generatoken/Usuarios/token_Verify> |

- **Token personal por responsable:** conviene que el equipo registre un token a nombre de un correo institucional/compartido del proyecto (no personal), para no depender de una sola persona si hay que regenerarlo.
- **No usar el token de ejemplo del INEGI en producción.** Algunos proyectos de terceros usan un token público de ejemplo que, según su propia documentación, puede ser revocado en cualquier momento.
- **Un token por entorno (opcional pero recomendable):** si INEGI permite generar más de uno con el mismo correo, usar uno para desarrollo y otro para producción. No está documentado si hay límite; validarlo al registrar.
- **Si el token se compromete o deja de funcionar:** volver al formulario y generar uno nuevo; la documentación oficial no describe un proceso de revocación. Para dudas, el INEGI lista el correo de atención a usuarios `atencion.usuarios@inegi.org.mx` en sus documentos metodológicos del DENUE, y la página de la API tiene un formulario de preguntas.

#### Dónde guardarlo

```bash
# .env (nunca versionar)
DENUE_TOKEN=tu_token
```

En Laravel, leer desde `config/services.php` (`env('DENUE_TOKEN')`); en despliegues con Coolify u otro orquestador, definirlo como variable de entorno secreta del servicio, no dentro de la imagen ni del repositorio.

### 2.2 URL base

```
https://www.inegi.org.mx/app/api/denue/v1/consulta/{Metodo}/{parametros...}/{token}
```

> Algunos paquetes antiguos (p. ej. `inegiR`) usan el host previo `www3.inegi.org.mx/sistemas/api/denue/v1/consulta/`. Para desarrollo nuevo usar el host `www.inegi.org.mx/app/api/...` y **siempre HTTPS**.

### 2.3 Convenciones generales

- Método HTTP: **GET**. Todos los parámetros van en la **ruta** (no hay query string ni body).
- Formato de respuesta: **JSON** (arreglo de objetos).
- Parámetros de texto con espacios o acentos: **codificar en URL** (`urlencode` / `encodeURIComponent`).
- Comodín para "todos": en los métodos de búsqueda por texto, la palabra `todos` (la doc en inglés dice "all"); en los métodos por área/clave, el valor `0` (o `00` para entidad en algunos métodos).
- Paginación en los métodos que la soportan: **registro inicial** y **registro final** (p. ej. `1` y `10`).

---

## 3. Catálogos de códigos

### 3.1 Entidades federativas (2 dígitos)

| Clave | Entidad | Clave | Entidad |
|---|---|---|---|
| 00 | Todas (comodín) | 17 | Morelos |
| 01 | Aguascalientes | 18 | Nayarit |
| 02 | Baja California | 19 | Nuevo León |
| 03 | Baja California Sur | 20 | Oaxaca |
| 04 | Campeche | 21 | Puebla |
| 05 | Coahuila | 22 | Querétaro |
| 06 | Colima | 23 | Quintana Roo |
| 07 | Chiapas | 24 | San Luis Potosí |
| 08 | Chihuahua | 25 | Sinaloa |
| 09 | Ciudad de México | 26 | Sonora |
| 10 | Durango | 27 | Tabasco |
| 11 | Guanajuato | 28 | Tamaulipas |
| 12 | Guerrero | 29 | Tlaxcala |
| 13 | Hidalgo | 30 | Veracruz |
| 14 | Jalisco | 31 | Yucatán |
| 15 | México | 32 | Zacatecas |
| 16 | Michoacán | | |

### 3.2 Claves geográficas por nivel

| Nivel | Dígitos | Ejemplo |
|---|---|---|
| Entidad | 2 | `01` |
| Municipio | 3 (dentro de la entidad) | `001` |
| Localidad | 4 | `0001` |
| AGEB | 4 | `2000` |
| Manzana | 3 | `043` |

Para **Cuantificar**, el área geográfica se expresa concatenada: entidad (2) = `01`; municipio (5) = `01001`; localidad (9) = `010010001`.

### 3.3 Actividad económica (SCIAN)

| Nivel | Dígitos | Ejemplo |
|---|---|---|
| Sector | 2 | `46` |
| Subsector | 3 | `464` |
| Rama | 4 | `4641` |
| Subrama | 5 | `46411` (solo en Cuantificar) |
| Clase | 6 | `464111` |

> El catálogo SCIAN completo se descarga desde el INEGI (hay versiones 2018 y 2023). No lo provee la API; conviene cargarlo localmente para traducir giros ("tortillerías") a código.

### 3.4 Estratos (tamaño por personal ocupado)

| Código | Rango |
|---|---|
| 0 | Todos los tamaños |
| 1 | 0 a 5 personas |
| 2 | 6 a 10 personas |
| 3 | 11 a 30 personas |
| 4 | 31 a 50 personas |
| 5 | 51 a 100 personas |
| 6 | 101 a 250 personas |
| 7 | 251 y más |

---

## 4. Endpoints (métodos)

Son **7 métodos**. Todos devuelven JSON y cuelgan de la URL base de la sección 2.2.

| Método | Para qué sirve | Paginación |
|---|---|---|
| [`Buscar`](#41-buscar) | Establecimientos cerca de una coordenada (radio en metros) | No |
| [`Ficha`](#42-ficha) | Detalle de un establecimiento por ID | No |
| [`Nombre`](#43-nombre) | Búsqueda por nombre o razón social, opcional por entidad | Sí |
| [`BuscarEntidad`](#44-buscarentidad) | Búsqueda por texto, opcional por entidad | Sí |
| [`BuscarAreaAct`](#45-buscarareaact) | Búsqueda por área geográfica fina + actividad + nombre | Sí |
| [`BuscarAreaActEstr`](#46-buscarareaactestr) | Igual que el anterior, más filtro por estrato | Sí |
| [`Cuantificar`](#47-cuantificar) | Conteo de establecimientos por actividad / área / estrato | No |

### 4.1 Buscar

Establecimientos que cumplen una condición dentro de un radio alrededor de un punto.

```
GET /Buscar/{condicion}/{lat},{lon}/{metros}/{token}
```

| Parámetro | Descripción |
|---|---|
| `condicion` | Palabra(s) a buscar en nombre, razón social, calle, colonia, clase de actividad, entidad, municipio y localidad. `todos` para no filtrar. |
| `lat,lon` | Coordenadas en grados decimales, formato **latitud,longitud**. |
| `metros` | Radio de búsqueda. **Máximo 5,000 m.** |
| `token` | Token del DENUE. |

Ejemplo (del sitio oficial):

```
https://www.inegi.org.mx/app/api/denue/v1/consulta/Buscar/camiones/21.85717833,-102.28487238/250/{TOKEN}
```

Campos de respuesta (orden documentado, 21): Id, Nombre, Razón social, Clase de actividad, Estrato, Tipo de vialidad, Calle, Número exterior, Número interior, Colonia, CP, Ubicación (localidad, municipio, entidad), Teléfono, Correo, Sitio web, Tipo de establecimiento, Longitud, Latitud, Centro comercial, Tipo de centro comercial, Número de local.

### 4.2 Ficha

Datos completos de un establecimiento.

```
GET /Ficha/{id}/{token}
```

| Parámetro | Descripción |
|---|---|
| `id` | ID único del establecimiento (campo `Id` obtenido en cualquier búsqueda). |

Ejemplo:

```
https://www.inegi.org.mx/app/api/denue/v1/consulta/Ficha/4292348/{TOKEN}
```

Mismos 21 campos que `Buscar`. La respuesta es un arreglo; el registro viene en la posición `[0]`.

### 4.3 Nombre

Búsqueda por **nombre del establecimiento o razón social**.

```
GET /Nombre/{nombre}/{entidad}/{registro_inicial}/{registro_final}/{token}
```

| Parámetro | Descripción |
|---|---|
| `nombre` | Texto a buscar en nombre o razón social. |
| `entidad` | Clave de 2 dígitos (`01`–`32`); `00` para todas. |
| `registro_inicial` | Primer registro a devolver (inicia en 1). |
| `registro_final` | Último registro a devolver. |

Ejemplo:

```
https://www.inegi.org.mx/app/api/denue/v1/consulta/Nombre/MARRIOTT/1/1/10/{TOKEN}
```

Campos: los mismos 21 de `Buscar`. En los ejemplos oficiales también aparecen `tipo_corredor_industrial`, `nom_corredor_industrial` y `numero_local`.

### 4.4 BuscarEntidad

Búsqueda por **texto libre** (mismos campos que `Buscar` para la condición), limitada a una entidad.

```
GET /BuscarEntidad/{condicion}/{entidad}/{registro_inicial}/{registro_final}/{token}
```

| Parámetro | Descripción |
|---|---|
| `condicion` | Palabra(s) a buscar; `todos` para no filtrar. |
| `entidad` | `01`–`32`; `00` para todas. |
| `registro_inicial` / `registro_final` | Rango de paginación. |

Ejemplo:

```
https://www.inegi.org.mx/app/api/denue/v1/consulta/BuscarEntidad/restaurantes/14/1/10/{TOKEN}
```

Campos documentados: 18 (los de `Buscar` hasta Latitud, sin centro comercial ni número de local).

### 4.5 BuscarAreaAct

Búsqueda con **filtros por área geográfica fina y por actividad económica**.

```
GET /BuscarAreaAct/{entidad}/{municipio}/{localidad}/{ageb}/{manzana}/{sector}/{subsector}/{rama}/{clase}/{nombre}/{registro_inicial}/{registro_final}/{id}/{token}
```

| Parámetro | Descripción | "Todos" |
|---|---|---|
| `entidad` | 2 dígitos | `00` |
| `municipio` | 3 dígitos (`001`) | `0` |
| `localidad` | 4 dígitos (`0001`) | `0` |
| `ageb` | 4 dígitos (`2000`) | `0` |
| `manzana` | 3 dígitos (`043`) | `0` |
| `sector` | 2 dígitos (`46`) | `0` |
| `subsector` | 3 dígitos (`464`) | `0` |
| `rama` | 4 dígitos (`4641`) | `0` |
| `clase` | 6 dígitos (`464112`) | `0` |
| `nombre` | Nombre del establecimiento | — |
| `registro_inicial` / `registro_final` | Paginación | — |
| `id` | ID de establecimiento | `0` |

Ejemplo del sitio oficial (⚠️ ver nota de discrepancia abajo):

```
https://www.inegi.org.mx/app/api/denue/v1/consulta/BuscarAreaAct/01/0/0/0/0/0/0/0/0/oxxo/1/15/{TOKEN}
```

> ⚠️ **Discrepancia en la documentación oficial:** la tabla de parámetros incluye `id`, pero la URL de ejemplo **no trae ese segmento** (tiene 9 valores de área/actividad + nombre + 1 + 15 + token). En `BuscarAreaActEstr` el ejemplo sí lo incluye. Probar ambas variantes (con y sin `/0` antes del token) y fijar la que responda correctamente.

Campos documentados (28): los 18 base + tipo y nombre de corredor industrial, número de local, AGEB, manzana, edificio, e identificadores de clase, sector, subsector y rama.

### 4.6 BuscarAreaActEstr

Igual que `BuscarAreaAct`, con filtro adicional por **estrato**.

```
GET /BuscarAreaActEstr/{entidad}/{municipio}/{localidad}/{ageb}/{manzana}/{sector}/{subsector}/{rama}/{clase}/{nombre}/{registro_inicial}/{registro_final}/{id}/{estrato}/{token}
```

Los parámetros son los de `BuscarAreaAct` más `estrato` (ver sección 3.4; `0` = todos).

Ejemplo oficial:

```
https://www.inegi.org.mx/app/api/denue/v1/consulta/BuscarAreaActEstr/01/0/0/0/0/0/0/0/0/oxxo/1/15/0/1/{TOKEN}
```

> ⚠️ La tabla oficial describe `clase` con el texto de "rama de 4 dígitos"; parece error de redacción (en `BuscarAreaAct` la clase es de 6 dígitos). Validar con una consulta real.

Campos documentados (33): los de `BuscarAreaAct` más subrama, tipo de asentamiento, **fecha de registro del establecimiento** y **clave del área geográfica**.

### 4.7 Cuantificar

**Conteo** de establecimientos (no devuelve el detalle).

```
GET /Cuantificar/{actividad}/{area}/{estrato}/{token}
```

| Parámetro | Descripción |
|---|---|
| `actividad` | Código SCIAN de 2 a 6 dígitos. Varios códigos separados por coma (`111,112`). `0` = todas. |
| `area` | Código geográfico de 2 (entidad), 5 (municipio) o 9 (localidad) dígitos. Varios separados por coma. `0` = todo el país. |
| `estrato` | `0`–`7` (ver sección 3.4). |

Ejemplo oficial:

```
https://www.inegi.org.mx/app/api/denue/v1/consulta/Cuantificar/111,112/01001,01005/0/{TOKEN}
```

Campos de respuesta (3): clave de actividad, clave del área geográfica y **total de establecimientos** para esa combinación.

---

## 5. Esquema de respuesta (JSON)

Nombres de propiedad observados en los ejemplos JavaScript oficiales:

| Propiedad | Contenido |
|---|---|
| `Id` | ID del establecimiento |
| `Nombre` | Nombre de la unidad económica |
| `Razon_social` | Razón social |
| `Clase_actividad` | Nombre de la clase de actividad |
| `Estrato` | Personal ocupado (rango) |
| `Tipo_vialidad` | Tipo de vialidad |
| `Calle` | Nombre de la vialidad |
| `Num_Exterior` | Número exterior o km |
| `Num_Interior` | Número o letra interior |
| `Colonia` | Asentamiento humano |
| `CP` | Código postal |
| `Ubicacion` | Localidad, municipio y entidad (texto) |
| `Telefono` | Teléfono |
| `Correo_e` | Correo electrónico |
| `Sitio_internet` | Sitio web |
| `Tipo` | Tipo de establecimiento |
| `Latitud` / `Longitud` | Coordenadas |
| `CentroComercial` / `TipoCentroComercial` / `NumLocal` | Datos de centro comercial |

> ⚠️ **Orden de latitud/longitud:** la lista de campos de la documentación pone *Longitud* antes que *Latitud*, y el vector de etiquetas del ejemplo JS pone *Latitud* antes que *Longitud*. **Usar siempre las propiedades por nombre (`Latitud`, `Longitud`), no por posición**, y validar con un registro conocido.
>
> ⚠️ Para los métodos con más campos (`BuscarAreaAct`, `BuscarAreaActEstr`, `Cuantificar`) la documentación solo da el orden de los campos, no los nombres de propiedad. Inspeccionar una respuesta real y documentar el esquema en el proyecto.

---

## 6. Ejemplos de uso

> Reemplazar `{TOKEN}` por el token del DENUE. **No dejar el token hardcodeado**: usar variable de entorno o secreto del despliegue.

### 6.1 cURL

```bash
export DENUE_TOKEN="tu_token"

# Negocios cerca de un punto (radio 500 m, giro "farmacia")
curl -s "https://www.inegi.org.mx/app/api/denue/v1/consulta/Buscar/farmacia/21.85717833,-102.28487238/500/${DENUE_TOKEN}"

# Detalle de un establecimiento
curl -s "https://www.inegi.org.mx/app/api/denue/v1/consulta/Ficha/4292348/${DENUE_TOKEN}"

# Conteo por municipio y actividad
curl -s "https://www.inegi.org.mx/app/api/denue/v1/consulta/Cuantificar/311830/01001/0/${DENUE_TOKEN}"
```

### 6.2 Python

```python
import os
import requests
from urllib.parse import quote

BASE = "https://www.inegi.org.mx/app/api/denue/v1/consulta"
TOKEN = os.environ["DENUE_TOKEN"]


def denue_get(metodo: str, *params) -> list[dict]:
    """Arma la ruta, codifica cada segmento y devuelve el JSON."""
    ruta = "/".join(quote(str(p), safe=",") for p in params)
    url = f"{BASE}/{metodo}/{ruta}/{TOKEN}"
    r = requests.get(url, timeout=30)
    r.raise_for_status()
    data = r.json()
    # ⚠️ Reportado por la comunidad: a veces el JSON llega doblemente codificado
    if isinstance(data, str):
        import json
        data = json.loads(data)
    return data


def cerca_de(condicion: str, lat: float, lon: float, metros: int = 250):
    return denue_get("Buscar", condicion, f"{lat},{lon}", metros)


def por_entidad(condicion: str, entidad: str, ini: int = 1, fin: int = 100):
    return denue_get("BuscarEntidad", condicion, entidad, ini, fin)


def contar(actividad: str, area: str = "0", estrato: int = 0):
    return denue_get("Cuantificar", actividad, area, estrato)


if __name__ == "__main__":
    for e in cerca_de("farmacia", 21.85717833, -102.28487238, 500)[:5]:
        print(e["Id"], e["Nombre"], e["Latitud"], e["Longitud"])
```

### 6.3 PHP / Laravel

```php
<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;

class DenueClient
{
    private string $base = 'https://www.inegi.org.mx/app/api/denue/v1/consulta';

    public function __construct(private string $token = '')
    {
        $this->token = $token ?: config('services.denue.token');
    }

    private function get(string $metodo, array $params): array
    {
        $ruta = collect($params)
            ->map(fn ($p) => rawurlencode((string) $p))
            ->implode('/');

        $json = Http::timeout(30)
            ->retry(2, 500)
            ->get("{$this->base}/{$metodo}/{$ruta}/{$this->token}")
            ->throw()
            ->json();

        // ⚠️ Reportado por la comunidad: JSON doblemente codificado en algunos casos
        return is_string($json) ? json_decode($json, true) : ($json ?? []);
    }

    public function cerca(string $condicion, float $lat, float $lon, int $metros = 250): array
    {
        return $this->get('Buscar', [$condicion, "{$lat},{$lon}", $metros]);
    }

    public function ficha(int|string $id): array
    {
        return $this->get('Ficha', [$id]);
    }

    public function porEntidad(string $condicion, string $entidad, int $ini = 1, int $fin = 100): array
    {
        return $this->get('BuscarEntidad', [$condicion, $entidad, $ini, $fin]);
    }

    public function contar(string $actividad, string $area = '0', int $estrato = 0): array
    {
        return $this->get('Cuantificar', [$actividad, $area, $estrato]);
    }
}
```

`config/services.php`:

```php
'denue' => [
    'token' => env('DENUE_TOKEN'),
],
```

### 6.4 Paginación (patrón recomendado)

```python
def todos_en_entidad(condicion: str, entidad: str, lote: int = 100):
    ini = 1
    while True:
        fin = ini + lote - 1
        pagina = por_entidad(condicion, entidad, ini, fin)
        if not pagina:
            break
        yield from pagina
        if len(pagina) < lote:
            break
        ini = fin + 1
```

---

## 7. Buenas prácticas y riesgos

1. **El token viaja en la URL.** Consumir la API desde el **backend** (no desde JavaScript de navegador, como hacen los ejemplos oficiales), y evitar que aparezca en logs de acceso, proxies o herramientas de monitoreo. Si se usa `httpx`/similares, silenciar el log de URLs.
2. **Caché.** El DENUE se actualiza por ediciones (aprox. dos veces al año), no en tiempo real. Cachear respuestas (por ejemplo 24 h a 30 días según el caso) reduce latencia y carga.
3. **Reintentos con backoff** ante errores de red o respuestas vacías. La documentación oficial no publica cuotas ni códigos de error; tratar cualquier límite como desconocido y medirlo.
4. **Codificar siempre** los segmentos de texto (acentos, espacios, `ñ`, `&`).
5. **Validar el tipo de respuesta**: aceptar tanto un arreglo como un string JSON (ver nota en sección 6).
6. **Dedupe por `Id`** cuando se combinan varias consultas (p. ej. una cuadrícula de búsquedas por radio).
7. **Grandes volúmenes:** si se necesita el universo completo (no una consulta puntual), el INEGI ofrece **descarga masiva** de los archivos del DENUE; suele ser mejor que paginar la API millones de veces.
8. **Re-sincronización:** si se guarda una copia local, programar actualización al salir cada edición y ante notas de corrección del INEGI.

---

## 8. Comportamientos reportados por la comunidad (no oficiales) ⚠️

Provienen de wrappers de terceros (paquetes MCP/R) y deben verificarse antes de depender de ellos:

| Observación | Origen |
|---|---|
| Máximo de **100 registros por consulta** en métodos paginados (`fin - inicio`) | Descripción de un servidor MCP de terceros (`denue-mcp`) |
| En `Cuantificar`, pedir el total nacional con área `00` devuelve 0; usar área `0` o sumar por estado | Notas del paquete `mcp-inegi` |
| En búsquedas por área, `00` es comodín de entidad; la palabra `todos` no funciona como comodín ahí | Notas del paquete `mcp-inegi` |
| A veces el JSON llega **doblemente codificado** (un string que contiene la lista) | Notas del paquete `mcp-inegi` |

---

## 9. Checklist de validación antes de integrar

- [ ] Generar el token del DENUE en el formulario oficial (sección 2.1) con un correo del proyecto y guardarlo como secreto.
- [ ] Probar el token con `Ficha` (ID `4292348` del ejemplo oficial).
- [ ] Si el proyecto también usa la API de Indicadores, generar su token por separado.
- [ ] Confirmar la URL de `BuscarAreaAct` con y sin el segmento `id`.
- [ ] Confirmar orden y nombres reales de `Latitud` / `Longitud`.
- [ ] Documentar el esquema real de `BuscarAreaAct`, `BuscarAreaActEstr` y `Cuantificar`.
- [ ] Medir el máximo real de registros por página.
- [ ] Probar `Cuantificar` con área `0` vs `00`.
- [ ] Probar caracteres especiales en `condicion` y `nombre`.
- [ ] Medir tiempos de respuesta y comportamiento ante ráfagas de consultas.
- [ ] Decidir estrategia de caché y de re-sincronización por edición.

---

## 10. Referencias

- API del DENUE (documentación oficial): <https://www.inegi.org.mx/servicios/api_denue.html>
- Generar token del DENUE: <https://www.inegi.org.mx/app/api/denue/tokenVerify/tokenverify.html>
- Generar token de la API de Indicadores (distinto): <https://www.inegi.org.mx/app/desarrolladores/generatoken/Usuarios/token_Verify>
- Interfaz de consulta del DENUE: <https://www.inegi.org.mx/app/mapa/denue/>
- Nota de corrección edición 2026/05 (29 de mayo de 2026): <https://www.inegi.org.mx/app/mapa/denue/nota.pdf>
- Documento metodológico DENUE (05/2025): <https://www.inegi.org.mx/contenidos/productos/prod_serv/contenidos/espanol/bvinegi/productos/nueva_estruc/889463922780.pdf>
- Wrappers de comunidad consultados: `inegiR` (R, CRAN), `mcp-inegi` (PyPI), `denue-mcp` (GitHub/Glama). Proyectos independientes, sin afiliación con el INEGI.
