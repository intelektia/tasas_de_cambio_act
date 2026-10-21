# Cobertura del suelo y tasas de cambio · Actividad 3

Proyecto Educativo Innovador (PEI) «Matemáticas y Percepción Remota» · Experiencia educativa Matemáticas · Facultad de Ciencias Agrícolas, Universidad Veracruzana.
Responsable: Dr. Gustavo Ortiz Hernández. Integrantes: Dra. Luz Amelia Sánchez Landero, Dr. Gustavo Ortiz Hernández y Dra. Dora Trejo Aguilar.

Práctica guiada para Ingeniería en Agronomía: estimar la cobertura del suelo (vegetación, suelo desnudo o construido y agua) en dos años con Sentinel-2 y Google Earth Engine, y calcular a mano su tasa de cambio en una de cinco zonas de la región central de Veracruz.

**Tutorial y cuadernillo:** https://intelektia.github.io/tasas_de_cambio_act/

## Archivos

| Archivo | Contenido |
|---|---|
| `index.html` | Tutorial paso a paso y cuadernillo: registro del equipo, subida de imágenes, preguntas, cálculo verificado de diferencias y tasas, gráficas y generación del reporte PDF (máx. 7 páginas). |
| `cobertura_tasas_cambio.js` | Script para el Code Editor de Earth Engine (también va incluido en `index.html` con botón «Copiar código»). |
| `logos/` | Logosímbolo de la Universidad Veracruzana (Wikimedia Commons, «Logo-UV.jpg», CC BY-SA 4.0) y logo de la Facultad de Ciencias Agrícolas Xalapa (proporcionado por el docente). |
| `actividad-3-eminus.txt` | Texto sugerido para crear la actividad en Eminus. |

## Método (resumen)

- **Imágenes:** `COPERNICUS/S2_SR_HARMONIZED`, compuesto anual (mediana) con nubes enmascaradas por Cloud Score+ (`cs_cdf ≥ 0.60`). Año inicial 2019–2021, año final 2023–2025 (predeterminado 2019 y 2025).
- **Bandas:** B2, B3, B4, B8, B11, B12, más NDVI y NDWI para el clasificador.
- **Zonas (≈ 15 × 15 km):** Xalapa; Veracruz–Boca del Río; Medellín de Bravo–Mandinga; La Antigua–Cardel–Chachalacas; Alvarado.
- **Entrenamiento:** polígonos dibujados por el equipo; hasta 500 píxeles por clase; 70 % entrena un Random Forest (100 árboles) por año y 30 % se reserva para la matriz de confusión (sensibilidad, especificidad y precisión).
- **Superficies:** suma de `ee.Image.pixelArea()` por clase, en hectáreas.

Si modificas `cobertura_tasas_cambio.js`, copia también el código nuevo dentro del bloque `<script type="text/plain" id="codigoGEE">` de `index.html`, que es el que usa el botón «Copiar código».

El cuadernillo guarda el avance en el navegador (IndexedDB) y permite exportarlo e importarlo como `.json`. El PDF se genera en el navegador con jsPDF; no se envía ningún dato a un servidor.
