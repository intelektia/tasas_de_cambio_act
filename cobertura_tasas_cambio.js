// =====================================================================
//  COBERTURA DEL SUELO Y TASAS DE CAMBIO · REGIÓN CENTRAL DE VERACRUZ
//  PEI «Matemáticas y Percepción Remota» · EE Matemáticas
//  Facultad de Ciencias Agrícolas, Universidad Veracruzana
//  Docente responsable: Dr. Gustavo Ortiz Hernández
//  1) Abre https://code.earthengine.google.com/  2) Pega TODO este código
//  3) Pulsa Run UNA sola vez  4) Trabaja con el panel de la izquierda.
//  Datos: Copernicus Sentinel-2 SR Harmonized + Cloud Score+ (Google).
//  Versión didáctica 2026-10-21. No requiere assets privados.
// =====================================================================

// ---------------------------------------------------------------------
// 0. RESPALDO DE POLÍGONOS (opcional)
// Run borra los polígonos dibujados. Si los perdiste, pega aquí, en lugar
// de null, el texto que generó «Respaldar polígonos» (empieza con { y
// termina con }) y pulsa Run otra vez.
// ---------------------------------------------------------------------
var RESPALDO = null;

// ---------------------------------------------------------------------
// 1. CONFIGURACIÓN (no es necesario cambiar nada de aquí hacia abajo)
// ---------------------------------------------------------------------
var ZONAS = [
  {nombre: 'Xalapa y alrededores', municipio: 'Xalapa',
   caja: [-96.985, 19.4725, -96.835, 19.6075], punto: [-96.9270, 19.5410],
   pistas: 'Agua: Laguna del Castillo (este) y Lagos del Dique (centro). ' +
     'Vegetación: cafetales y bosque al sur y oeste. ' +
     'Suelo/construido: centro de Xalapa, Banderilla y fraccionamientos nuevos.'},
  {nombre: 'Veracruz y Boca del Río', municipio: 'Veracruz',
   caja: [-96.235, 19.0975, -96.085, 19.2325], punto: [-96.1342, 19.1738],
   pistas: 'Agua: mar abierto (lejos de la espuma), Laguna Olmeca y Río Jamapa. ' +
     'Vegetación: humedal de Tembladeras y pastizales del oeste. ' +
     'Suelo/construido: puerto, centro y zonas industriales.'},
  {nombre: 'Medellín de Bravo y Laguna de Mandinga', municipio: 'Medellín de Bravo',
   caja: [-96.185, 18.9725, -96.035, 19.1075], punto: [-96.1470, 19.0432],
   pistas: 'Agua: Laguna de Mandinga, Río Jamapa y mar. ' +
     'Vegetación: manglar, pastizales y potreros. ' +
     'Suelo/construido: fraccionamientos nuevos, Riviera Veracruzana y playas.'},
  {nombre: 'La Antigua, José Cardel y Chachalacas', municipio: 'La Antigua',
   caja: [-96.435, 19.3025, -96.285, 19.4375], punto: [-96.3774, 19.3711],
   pistas: 'Agua: ríos La Antigua y Actopan, y mar. ' +
     'Vegetación: cañaverales, manglar y selva baja. ' +
     'Suelo/construido: José Cardel, La Antigua, dunas de Chachalacas y parcelas recién cosechadas.'},
  {nombre: 'Alvarado y su laguna', municipio: 'Alvarado',
   caja: [-95.875, 18.7075, -95.725, 18.8425], punto: [-95.7607, 18.7711],
   pistas: 'Agua: Laguna de Alvarado, Río Papaloapan y mar. ' +
     'Vegetación: manglar, popal y pastizales. ' +
     'Suelo/construido: ciudad de Alvarado, dunas y playa.'}
];
var ANIOS_INICIO = ['2019', '2020', '2021'];
var ANIOS_FIN = ['2023', '2024', '2025'];

// Mismas clases y colores que en las actividades 1 y 2.
var CLASES = [
  {nombre: 'Vegetación', corto: 'Vegetación', abrev: 'Veg.', color: '39b878'},
  {nombre: 'Suelo desnudo o construido', corto: 'Suelo/construido', abrev: 'Suelo', color: 'e2ae66'},
  {nombre: 'Agua', corto: 'Agua', abrev: 'Agua', color: '4c9de8'}
];
var COLORES = CLASES.map(function(c) { return c.color; });

// Las cuatro bandas conocidas (B2, B3, B4, B8) + dos del infrarrojo de onda
// corta (B11, B12), que separan mejor agua, suelo y construcciones.
var BANDAS = ['B2', 'B3', 'B4', 'B8', 'B11', 'B12'];
var NOMBRES_BANDA = ['B2 azul', 'B3 verde', 'B4 rojo', 'B8 NIR', 'B11 SWIR1', 'B12 SWIR2'];
var ONDAS = [490, 560, 665, 842, 1610, 2190];
// El clasificador usa las 6 bandas y dos índices calculados con ellas.
var VARIABLES = BANDAS.concat(['NDVI', 'NDWI']);

var CRS = 'EPSG:32614';
var ESCALA = 10;
var PROY = ee.Projection(CRS).atScale(ESCALA);
var UMBRAL_CS = 0.60;          // Cloud Score+: 1 = despejado, 0 = nube
var MUESTRAS_POR_CLASE = 500;  // píxeles por clase tomados de los polígonos
var SEMILLA = 42;

var VIS_RGB = {bands: ['B4', 'B3', 'B2'], min: 0.01, max: 0.26, gamma: 1.15};
var VIS_FALSO = {bands: ['B8', 'B4', 'B3'], min: 0.01, max: 0.45};
var VIS_COB = {min: 0, max: 2, palette: COLORES};

// ---------------------------------------------------------------------
// 2. DATOS: compuesto anual (mediana) sin nubes
// ---------------------------------------------------------------------
var S2 = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED');
var CSPLUS = ee.ImageCollection('GOOGLE/CLOUD_SCORE_PLUS/V1/S2_HARMONIZED');

function compuestoAnual(anio, region) {
  var inicio = ee.Date.fromYMD(anio, 1, 1);
  var col = S2.filterBounds(region)
    .filterDate(inicio, inicio.advance(1, 'year'))
    .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 60))
    .select(BANDAS)
    .linkCollection(CSPLUS, ['cs_cdf']);
  // Una sola mediana de píxeles despejados: más ligera para la memoria de Earth Engine.
  var refl = col.map(function(img) {
    return img.select(BANDAS).updateMask(img.select('cs_cdf').gte(UMBRAL_CS));
  }).median()
    .multiply(0.0001)
    .setDefaultProjection(PROY)
    .clip(region);
  var ndvi = refl.normalizedDifference(['B8', 'B4']).rename('NDVI');
  var ndwi = refl.normalizedDifference(['B3', 'B8']).rename('NDWI');
  return refl.addBands(ndvi).addBands(ndwi).set('escenas', col.size());
}

// ---------------------------------------------------------------------
// 3. ESTADO DE LA APLICACIÓN
// ---------------------------------------------------------------------
var S = {
  cargado: false, zona: null, aoi: null, ini: null, fin: null,
  compIni: null, compFin: null, clasIni: null, clasFin: null,
  valIni: null, valFin: null, ocupado: false, comparando: false,
  ultimaCapa: null, confirmarBorrado: false
};

// ---------------------------------------------------------------------
// 4. MAPAS
// ---------------------------------------------------------------------
var mapa = ui.Map();
mapa.setOptions('HYBRID');
mapa.setControlVisibility({drawingToolsControl: false});
mapa.style().set('cursor', 'crosshair');

var dibujo = mapa.drawingTools();
dibujo.setShown(false);
dibujo.setLinked(false);
var capas = CLASES.map(function(c) {
  var capa = ui.Map.GeometryLayer({geometries: null, name: c.corto, color: c.color});
  dibujo.layers().add(capa);
  return capa;
});

var leyenda = ui.Panel({style: {position: 'bottom-left', padding: '6px 10px'}});
leyenda.add(ui.Label('Clases', {fontWeight: 'bold', margin: '0 0 4px 0'}));
CLASES.forEach(function(c) {
  leyenda.add(ui.Panel([
    ui.Label('', {backgroundColor: '#' + c.color, padding: '7px', margin: '2px 6px 2px 0'}),
    ui.Label(c.nombre, {margin: '2px 0'})
  ], ui.Panel.Layout.flow('horizontal')));
});
mapa.add(leyenda);

var aviso = ui.Label('', {position: 'top-center', shown: false, padding: '6px 10px',
  backgroundColor: '#fff8d6', fontSize: '13px', whiteSpace: 'pre-wrap'});
mapa.add(aviso);

// Mapas para la comparación con cortina (inicio | fin)
var mapaIzq = ui.Map();
var mapaDer = ui.Map();
[mapaIzq, mapaDer].forEach(function(m) {
  m.setOptions('HYBRID');
  m.setControlVisibility({layerList: false, drawingToolsControl: false, fullscreenControl: false});
});
var rotuloIzq = ui.Label('', {position: 'top-left', fontWeight: 'bold', padding: '4px 8px'});
var rotuloDer = ui.Label('', {position: 'top-right', fontWeight: 'bold', padding: '4px 8px'});
mapaIzq.add(rotuloIzq);
mapaDer.add(rotuloDer);
var enlaceMapas = ui.Map.Linker([mapaIzq, mapaDer]);
var cortina = ui.SplitPanel({firstPanel: mapaIzq, secondPanel: mapaDer,
  orientation: 'horizontal', wipe: true, style: {stretch: 'both'}});

// ---------------------------------------------------------------------
// 5. PANEL DE CONTROL
// ---------------------------------------------------------------------
var panel = ui.Panel({style: {width: '400px', padding: '8px 12px'}});
var ESTILO_PASO = {fontWeight: 'bold', fontSize: '15px', margin: '16px 0 4px 0', color: '#0b5d4b'};
var ESTILO_NOTA = {fontSize: '12px', color: '#555', margin: '2px 0 6px 0', whiteSpace: 'pre-wrap'};

function avisar(texto, esError) {
  estado.setValue(texto);
  estado.style().set('color', esError ? '#b00020' : '#333');
  aviso.setValue(texto);
  aviso.style().set({shown: true, backgroundColor: esError ? '#ffe3e3' : '#fff8d6'});
}

function boton(texto, accion) {
  return ui.Button({label: texto, onClick: accion, style: {stretch: 'horizontal'}});
}

function enlace(texto) {
  return ui.Label(texto, {fontSize: '12px', margin: '2px 8px'});
}

panel.add(ui.Label('Cobertura del suelo y tasas de cambio', {fontWeight: 'bold', fontSize: '19px', margin: '4px 0 0 0'}));
panel.add(ui.Label('PEI «Matemáticas y Percepción Remota»\n' +
  'Experiencia educativa: Matemáticas\n' +
  'Facultad de Ciencias Agrícolas, Universidad Veracruzana\n' +
  'Docente responsable: Dr. Gustavo Ortiz Hernández', ESTILO_NOTA));
var estado = ui.Label('Elige tu zona y tus años, y pulsa «Cargar imágenes».', {fontSize: '13px', whiteSpace: 'pre-wrap'});
panel.add(estado);

// --- Paso 1
panel.add(ui.Label('1 · Zona de trabajo y años', ESTILO_PASO));
var selZona = ui.Select({
  items: ZONAS.map(function(z, i) { return {label: (i + 1) + '. ' + z.nombre, value: String(i)}; }),
  value: '0', style: {stretch: 'horizontal'}
});
panel.add(selZona);
var selIni = ui.Select({items: ANIOS_INICIO, value: '2019'});
var selFin = ui.Select({items: ANIOS_FIN, value: '2025'});
panel.add(ui.Panel([ui.Label('Año inicial', {margin: '14px 4px 0 8px'}), selIni,
                    ui.Label('Año final', {margin: '14px 4px 0 8px'}), selFin],
                   ui.Panel.Layout.flow('horizontal')));
panel.add(boton('▶ Cargar imágenes', function() { cargar(); }));
var infoZona = ui.Label('', ESTILO_NOTA);
panel.add(infoZona);
var selComparar = ui.Select({items: ['Color verdadero', 'Falso color', 'Cobertura'], value: 'Color verdadero',
  onChange: function() { if (S.comparando) actualizarComparacion(); }});
var btnComparar = ui.Button({label: '⇆ Comparar inicio | fin (cortina)', onClick: function() { alternarComparacion(); },
  style: {stretch: 'horizontal'}});
panel.add(ui.Panel([selComparar, btnComparar], ui.Panel.Layout.flow('horizontal')));
var descargasImg = ui.Panel();
panel.add(descargasImg);

// --- Paso 2
panel.add(ui.Label('2 · Polígonos de entrenamiento', ESTILO_PASO));
panel.add(ui.Label('Elige una clase y haz clic en el mapa para marcar cada vértice. ' +
  'Cierra el polígono con doble clic. Dibuja al menos 3 polígonos por clase, ' +
  'repartidos en la zona y en sitios que NO cambiaron entre ambos años.', ESTILO_NOTA));
var contadores = [];
CLASES.forEach(function(c, i) {
  var contador = ui.Label('0 polígonos', {margin: '14px 0 0 6px', fontSize: '12px'});
  contadores.push(contador);
  panel.add(ui.Panel([
    ui.Label('', {backgroundColor: '#' + c.color, padding: '10px', margin: '10px 4px 0 0'}),
    ui.Button({label: 'Dibujar: ' + c.corto, onClick: function() { dibujar(i); }, style: {width: '230px'}}),
    contador
  ], ui.Panel.Layout.flow('horizontal')));
});
var btnBorrar = ui.Button({label: '🗑 Borrar todo', onClick: function() { borrarTodo(); }});
panel.add(ui.Panel([
  ui.Button({label: '⏹ Terminar', onClick: function() { terminarDibujo(); }}),
  ui.Button({label: '↶ Deshacer', onClick: function() { deshacer(); }}),
  btnBorrar
], ui.Panel.Layout.flow('horizontal')));
var pistas = ui.Label('', ESTILO_NOTA);
panel.add(pistas);
panel.add(boton('💾 Respaldar polígonos', function() { respaldar(); }));
var cajaRespaldo = ui.Textbox({style: {stretch: 'horizontal', shown: false}});
var notaRespaldo = ui.Label('', ESTILO_NOTA);
panel.add(notaRespaldo);
panel.add(cajaRespaldo);

// --- Paso 3
panel.add(ui.Label('3 · Firmas espectrales', ESTILO_PASO));
panel.add(boton('📈 Calcular firmas espectrales', function() { calcularFirmas(); }));
var panelFirmas = ui.Panel();
panel.add(panelFirmas);

// --- Paso 4
panel.add(ui.Label('4 · Cobertura estimada y superficies', ESTILO_PASO));
panel.add(boton('🗺 Clasificar inicio y fin', function() { clasificar(); }));
var panelCobertura = ui.Panel();
panel.add(panelCobertura);

// --- Paso 5
panel.add(ui.Label('5 · Evaluación (opcional)', ESTILO_PASO));
panel.add(ui.Label('Usa el 30 % de los píxeles de tus polígonos que el modelo NO vio al entrenar.', ESTILO_NOTA));
panel.add(boton('✅ Evaluar exactitud', function() { evaluar(); }));
var panelEvaluacion = ui.Panel();
panel.add(panelEvaluacion);

panel.add(ui.Label('Gráficas y tablas: el botón ↗ de cada una abre una ventana para descargar PNG o CSV.', ESTILO_NOTA));
panel.add(ui.Label('Datos: Copernicus Sentinel-2 (ESA), Cloud Score+ (Google), límites FAO GAUL. ' +
  'Ejercicio didáctico: no sustituye un inventario oficial.', ESTILO_NOTA));

ui.root.clear();
ui.root.setLayout(ui.Panel.Layout.flow('horizontal'));
ui.root.add(panel);
ui.root.add(mapa);

// ---------------------------------------------------------------------
// 6. FUNCIONES DE LA INTERFAZ
// ---------------------------------------------------------------------
function cargar() {
  if (S.ocupado) { avisar('Espera a que termine el cálculo anterior.'); return; }
  if (S.comparando) alternarComparacion();
  var iz = parseInt(selZona.getValue(), 10);
  if (S.zona !== null && S.zona !== iz && totalPoligonos() > 0) {
    capas.forEach(function(capa) { capa.geometries().reset([]); });
    actualizarContadores();
  }
  var z = ZONAS[iz];
  S.zona = iz;
  S.ini = parseInt(selIni.getValue(), 10);
  S.fin = parseInt(selFin.getValue(), 10);
  S.aoi = ee.Geometry.Rectangle(z.caja, null, false);
  S.compIni = compuestoAnual(S.ini, S.aoi);
  S.compFin = compuestoAnual(S.fin, S.aoi);
  S.clasIni = S.clasFin = S.valIni = S.valFin = null;
  S.cargado = true;
  panelFirmas.clear();
  panelCobertura.clear();
  panelEvaluacion.clear();
  pistas.setValue('Sugerencias para ' + z.nombre + ': ' + z.pistas);
  redibujarCapas();
  mapa.centerObject(S.aoi, 13);

  infoZona.setValue('Calculando número de escenas y área...');
  ee.Dictionary({
    ini: S.compIni.get('escenas'),
    fin: S.compFin.get('escenas'),
    ha: S.aoi.area(1).divide(10000)
  }).evaluate(function(r, err) {
    if (err) { infoZona.setValue('Error: ' + err); return; }
    infoZona.setValue(z.nombre + ' · área de trabajo ≈ ' + formato(r.ha, 0) + ' ha\n' +
      'Compuesto ' + S.ini + ': mediana de ' + r.ini + ' escenas · ' +
      'Compuesto ' + S.fin + ': mediana de ' + r.fin + ' escenas');
  });

  descargasImg.clear();
  descargasImg.add(ui.Label('Imágenes PNG para tu reporte (clic → se abre en otra pestaña → guardar). Pueden tardar hasta 1-2 min:', ESTILO_NOTA));
  enlacePNG('Color verdadero ' + S.ini, S.compIni.visualize(VIS_RGB), descargasImg);
  enlacePNG('Color verdadero ' + S.fin, S.compFin.visualize(VIS_RGB), descargasImg);
  avisar('Imágenes ' + S.ini + ' y ' + S.fin + ' cargadas (pueden tardar unos segundos en verse).\n' +
    'Compara ambos años con la cortina y luego dibuja tus polígonos (paso 2).');
}

function redibujarCapas() {
  var z = ZONAS[S.zona];
  var muni = ee.FeatureCollection('FAO/GAUL/2015/level2').filterBounds(ee.Geometry.Point(z.punto));
  var capasMapa = [
    ui.Map.Layer(S.compIni, VIS_FALSO, 'Falso color ' + S.ini, false),
    ui.Map.Layer(S.compFin, VIS_FALSO, 'Falso color ' + S.fin, false),
    ui.Map.Layer(S.compIni, VIS_RGB, 'Color verdadero ' + S.ini, false),
    ui.Map.Layer(S.compFin, VIS_RGB, 'Color verdadero ' + S.fin, true)
  ];
  if (S.clasIni) {
    capasMapa.push(ui.Map.Layer(S.clasIni, VIS_COB, 'Cobertura ' + S.ini, false));
    capasMapa.push(ui.Map.Layer(S.clasFin, VIS_COB, 'Cobertura ' + S.fin, true));
  }
  capasMapa.push(ui.Map.Layer(muni.style({color: 'ff66ff', fillColor: '00000000', width: 2}), {},
    'Límite municipal de ' + z.municipio + ' (referencia)', true, 0.8));
  capasMapa.push(ui.Map.Layer(contornoAOI(), {}, 'Área de trabajo'));
  mapa.layers().reset(capasMapa);
}

function contornoAOI() {
  return ee.FeatureCollection([ee.Feature(S.aoi)]).style({color: 'ffffff', fillColor: '00000000', width: 3});
}

function enlacePNG(etiqueta, imagenVis, destino) {
  var lbl = enlace('⏳ ' + etiqueta + ' (preparando...)');
  destino.add(lbl);
  imagenVis.getThumbURL({region: S.aoi, dimensions: 1000, format: 'png'}, function(url, err) {
    if (err || !url) { lbl.setValue('⚠ ' + etiqueta + ': ' + err); return; }
    lbl.setValue('⬇ ' + etiqueta + ' (PNG)');
    lbl.setUrl(url);
    lbl.style().set({color: '#1a73e8'});
  });
}

function dibujar(i) {
  if (!S.cargado) { avisar('Primero carga la zona y los años (paso 1).', true); return; }
  if (S.comparando) alternarComparacion();
  dibujo.setSelected(capas[i]);
  dibujo.setShape('polygon');
  dibujo.draw();
  avisar('Dibujando: ' + CLASES[i].nombre + '. Clic = vértice; doble clic = cerrar polígono.\n' +
    'Puedes seguir dibujando de esta clase; cambia de clase con su botón.');
}

function terminarDibujo() {
  dibujo.setShape(null);
  dibujo.stop();
  avisar('Dibujo detenido. Puedes mover vértices haciendo clic sobre un polígono.');
}

function totalPoligonos() {
  return capas.reduce(function(s, capa) { return s + capa.geometries().length(); }, 0);
}

function actualizarContadores() {
  capas.forEach(function(capa, i) {
    var n = capa.geometries().length();
    contadores[i].setValue(n + (n === 1 ? ' polígono' : ' polígonos'));
    contadores[i].style().set('color', n >= 3 ? '#0b7a3b' : '#b00020');
  });
}

function cambioPoligonos(geometria, capa) {
  if (capa) S.ultimaCapa = capa;
  S.confirmarBorrado = false;
  btnBorrar.setLabel('🗑 Borrar todo');
  actualizarContadores();
  if (S.clasIni) {
    avisar('Cambiaste los polígonos: vuelve a calcular las firmas y a clasificar para actualizar resultados.');
  }
}
dibujo.onDraw(cambioPoligonos);
dibujo.onEdit(cambioPoligonos);
dibujo.onErase(cambioPoligonos);

function deshacer() {
  var capa = S.ultimaCapa;
  if (!capa || capa.geometries().length() === 0) {
    avisar('No hay un polígono reciente para deshacer.'); return;
  }
  var lista = capa.geometries();
  lista.remove(lista.get(lista.length() - 1));
  cambioPoligonos(null, null);
  avisar('Se eliminó el último polígono de ' + capa.getName() + '.');
}

function borrarTodo() {
  if (!S.confirmarBorrado) {
    S.confirmarBorrado = true;
    btnBorrar.setLabel('¿Seguro? clic otra vez');
    return;
  }
  capas.forEach(function(capa) { capa.geometries().reset([]); });
  cambioPoligonos(null, null);
  avisar('Se borraron todos los polígonos.');
}

function poligonosFC() {
  var feats = [];
  capas.forEach(function(capa, i) {
    capa.geometries().forEach(function(g) {
      feats.push(ee.Feature(g, {clase: i, nombre: CLASES[i].nombre}));
    });
  });
  return ee.FeatureCollection(feats);
}

function listo(minimo) {
  if (!S.cargado) { avisar('Primero carga la zona y los años (paso 1).', true); return false; }
  if (S.ocupado) { avisar('Espera a que termine el cálculo anterior.'); return false; }
  var faltan = CLASES.filter(function(c, i) { return capas[i].geometries().length() < minimo; })
    .map(function(c) { return c.nombre; });
  if (faltan.length) {
    avisar('Necesitas al menos ' + minimo + ' polígonos de: ' + faltan.join(', ') + '.', true);
    return false;
  }
  return true;
}

function respaldar() {
  if (totalPoligonos() === 0) { avisar('Aún no hay polígonos para respaldar.'); return; }
  poligonosFC().evaluate(function(fc, err) {
    if (err) { avisar('No se pudo respaldar: ' + err, true); return; }
    var datos = {zona: S.zona, ini: S.ini, fin: S.fin, poligonos: fc.features.map(function(f) {
      return {clase: f.properties.clase, tipo: f.geometry.type, coords: redondear(f.geometry.coordinates)};
    })};
    var texto = JSON.stringify(datos);
    cajaRespaldo.setValue(texto);
    cajaRespaldo.style().set('shown', true);
    notaRespaldo.setValue('Haz clic en el cuadro de abajo, pulsa Ctrl+A y Ctrl+C, y pégalo en un archivo de texto. ' +
      'Para recuperarlo: pégalo en lugar de null en «var RESPALDO = null;» (línea 18) y pulsa Run.');
    print('RESPALDO DE POLÍGONOS (' + datos.poligonos.length + ' polígonos)', texto);
    avisar('Respaldo listo: cópialo del cuadro que apareció bajo el botón «Respaldar polígonos».');
  });
}

function redondear(x) {
  if (typeof x === 'number') return Math.round(x * 1e6) / 1e6;
  return x.map(redondear);
}

function aclarar(hex) {
  // Mezcla el color con blanco (45 % color) para distinguir el año inicial
  return [0, 2, 4].map(function(k) {
    var v = Math.round(parseInt(hex.substr(k, 2), 16) * 0.45 + 255 * 0.55);
    return ('0' + v.toString(16)).slice(-2);
  }).join('');
}

function formato(x, dec) {
  var s = Number(x).toFixed(dec);
  var partes = s.split('.');
  partes[0] = partes[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return partes.join('.');
}

// --- Paso 3: firmas espectrales -------------------------------------
function calcularFirmas() {
  if (!listo(1)) return;
  S.ocupado = true;
  avisar('Calculando las firmas espectrales de tus polígonos...');
  var fc = poligonosFC();
  var reductor = ee.Reducer.mean()
    .combine({reducer2: ee.Reducer.stdDev(), sharedInputs: true})
    .combine({reducer2: ee.Reducer.count(), sharedInputs: true});
  var res = {};
  [['ini', S.compIni], ['fin', S.compFin]].forEach(function(par) {
    CLASES.forEach(function(c, i) {
      res[par[0] + i] = par[1].select(BANDAS).reduceRegion({
        reducer: reductor, geometry: fc.filter(ee.Filter.eq('clase', i)).geometry(),
        crs: CRS, scale: ESCALA, maxPixels: 1e9, tileScale: 4
      });
    });
  });
  ee.Dictionary(res).evaluate(function(r, err) {
    S.ocupado = false;
    if (err) { avisar('Error al calcular firmas: ' + err, true); return; }
    mostrarFirmas(r);
    descargaPoligonos(fc);
  });
}

function mostrarFirmas(r) {
  panelFirmas.clear();
  var periodos = [['ini', S.ini], ['fin', S.fin]];
  var cols = [{id: 'x', label: 'Longitud de onda (nm)', type: 'number'}];
  var series = {};
  var k = 0;
  CLASES.forEach(function(c, i) {
    periodos.forEach(function(p, j) {
      cols.push({id: p[0] + i, label: c.corto + ' ' + p[1], type: 'number'});
      series[k] = j ? {color: '#' + c.color, lineDashStyle: [6, 4], pointShape: 'triangle'}
                    : {color: '#' + c.color, pointShape: 'circle'};
      k++;
    });
  });
  var filas = BANDAS.map(function(b, bi) {
    var celdas = [{v: ONDAS[bi], f: NOMBRES_BANDA[bi] + ' (' + ONDAS[bi] + ' nm)'}];
    CLASES.forEach(function(c, i) {
      periodos.forEach(function(p) {
        var v = r[p[0] + i][b + '_mean'];
        celdas.push({v: v === null ? null : Math.round(v * 10000) / 10000});
      });
    });
    return {c: celdas};
  });
  var grafica = ui.Chart({cols: cols, rows: filas}, 'LineChart', {
    title: 'Firmas espectrales medias · ' + ZONAS[S.zona].nombre,
    hAxis: {title: 'Longitud de onda (nm)', viewWindow: {min: 400, max: 2300},
            ticks: ONDAS.map(function(w, bi) { return {v: w, f: BANDAS[bi]}; })},
    vAxis: {title: 'Reflectancia (0–1)', viewWindow: {min: 0}},
    lineWidth: 2, pointSize: 6, series: series,
    legend: {position: 'top', maxLines: 3},
    chartArea: {left: 55, top: 40, width: '85%', height: '62%'}
  });
  grafica.style().set({height: '380px'});
  panelFirmas.add(ui.Label('Línea continua = ' + S.ini + ' · línea punteada = ' + S.fin, ESTILO_NOTA));
  panelFirmas.add(grafica);

  // Tabla: promedio ± desviación estándar por banda
  var tcols = [{label: 'Clase', type: 'string'}, {label: 'Año', type: 'string'}];
  BANDAS.forEach(function(b) { tcols.push({label: b, type: 'number'}); });
  tcols.push({label: 'Píxeles', type: 'number'});
  var tfilas = [];
  var pocos = [];
  CLASES.forEach(function(c, i) {
    periodos.forEach(function(p) {
      var d = r[p[0] + i];
      var celdas = [{v: c.corto}, {v: String(p[1])}];
      BANDAS.forEach(function(b) {
        var m = d[b + '_mean'], s = d[b + '_stdDev'];
        celdas.push(m === null ? {v: null} :
          {v: Math.round(m * 10000) / 10000, f: m.toFixed(4) + ' ± ' + (s || 0).toFixed(4)});
      });
      var n = d.B2_count || 0;
      celdas.push({v: n});
      if (n < 50 && pocos.indexOf(c.nombre) < 0) pocos.push(c.nombre);
      tfilas.push({c: celdas});
    });
  });
  var tabla = ui.Chart({cols: tcols, rows: tfilas}, 'Table', {allowHtml: false});
  panelFirmas.add(ui.Label('Tabla de datos: reflectancia media ± desviación estándar', ESTILO_NOTA));
  panelFirmas.add(tabla);

  // Píxeles de entrenamiento seleccionados por clase (todos los de tus polígonos)
  var pcols = [{label: 'Clase', type: 'string'}, {label: 'Polígonos', type: 'number'},
               {label: 'Píxeles seleccionados', type: 'number'}, {label: 'Superficie (ha)', type: 'number'}];
  var pfilas = CLASES.map(function(c, i) {
    var a = r['ini' + i].B2_count || 0, b = r['fin' + i].B2_count || 0;
    var n = Math.max(a, b);
    return {c: [{v: c.nombre}, {v: capas[i].geometries().length()},
      {v: n, f: a === b ? formato(n, 0) : formato(a, 0) + ' (' + S.ini + ') / ' + formato(b, 0) + ' (' + S.fin + ')'},
      {v: n * 0.01, f: formato(n * 0.01, 2)}]};
  });
  panelFirmas.add(ui.Label('Píxeles de entrenamiento por clase (todos los píxeles dentro de tus polígonos; ' +
    'cada píxel mide 10 m × 10 m = 0.01 ha). Anótalos en tu cuadernillo.', ESTILO_NOTA));
  panelFirmas.add(ui.Chart({cols: pcols, rows: pfilas}, 'Table'));

  // Varianza de la reflectancia (desviación estándar al cuadrado) por banda y clase
  var vcols = [{label: 'Banda', type: 'string'}];
  var vseries = {};
  var vk = 0;
  CLASES.forEach(function(c) {
    periodos.forEach(function(p, j) {
      vcols.push({label: c.corto + ' ' + p[1], type: 'number'});
      vseries[vk++] = {color: '#' + (j ? c.color : aclarar(c.color))};
    });
  });
  var vfilas = BANDAS.map(function(b, bi) {
    var celdas = [{v: NOMBRES_BANDA[bi]}];
    CLASES.forEach(function(c, i) {
      periodos.forEach(function(p) {
        var s = r[p[0] + i][b + '_stdDev'];
        celdas.push({v: s === null || s === undefined ? null : Math.round(s * s * 1e6) / 1e3});
      });
    });
    return {c: celdas};
  });
  var gvar = ui.Chart({cols: vcols, rows: vfilas}, 'ColumnChart', {
    title: 'Varianza de la reflectancia por banda (× 1000) · ' + ZONAS[S.zona].nombre,
    vAxis: {title: 'Varianza × 1000', viewWindow: {min: 0}},
    series: vseries, legend: {position: 'top', maxLines: 3},
    chartArea: {left: 50, top: 60, width: '86%', height: '60%'}
  });
  gvar.style().set({height: '360px'});
  panelFirmas.add(ui.Label('Varianza: qué tan diferentes son entre sí los píxeles de una clase ' +
    '(tono claro = ' + S.ini + ', intenso = ' + S.fin + '). Barras altas = clase heterogénea, más difícil de clasificar.', ESTILO_NOTA));
  panelFirmas.add(gvar);

  if (pocos.length) {
    avisar('Firmas listas, pero hay pocos píxeles en: ' + pocos.join(', ') +
      '. Dibuja polígonos más grandes o más numerosos.', true);
  } else {
    avisar('Firmas listas. Descarga la gráfica (botón ↗) y la tabla para tu reporte.');
  }
}

function descargaPoligonos(fc) {
  var destino = ui.Panel();
  panelFirmas.add(destino);
  var relleno = ee.Image().byte().paint(fc, 'clase').visualize({min: 0, max: 2, palette: COLORES, opacity: 0.65});
  var borde = ee.Image().byte().paint(fc, 0, 2).visualize({palette: ['ffffff']});
  enlacePNG('Polígonos de entrenamiento sobre ' + S.fin, S.compFin.visualize(VIS_RGB).blend(relleno).blend(borde), destino);
  var lbl = enlace('⏳ Polígonos en formato KML (preparando...)');
  destino.add(lbl);
  fc.getDownloadURL('kml', ['clase', 'nombre'], 'poligonos_entrenamiento', function(url, err) {
    if (err || !url) { lbl.setValue('⚠ KML: ' + err); return; }
    lbl.setValue('⬇ Polígonos de entrenamiento (KML, para Google Earth)');
    lbl.setUrl(url);
    lbl.style().set({color: '#1a73e8'});
  });
}

// --- Paso 4: clasificación y superficies ----------------------------
function entrenar(comp, fc) {
  var claseImg = ee.Image().byte().paint(fc, 'clase').rename('clase');
  var muestras = comp.select(VARIABLES).addBands(claseImg).stratifiedSample({
    numPoints: MUESTRAS_POR_CLASE, classBand: 'clase', region: fc.geometry(),
    scale: ESCALA, seed: SEMILLA, tileScale: 4, geometries: false
  }).randomColumn('azar', SEMILLA);
  // 70 % entrena el modelo; 30 % se guarda para evaluarlo (paso 5).
  var entrenamiento = muestras.filter(ee.Filter.lt('azar', 0.7));
  var validacion = muestras.filter(ee.Filter.gte('azar', 0.7));
  var modelo = ee.Classifier.smileRandomForest({numberOfTrees: 100, seed: SEMILLA})
    .train({features: entrenamiento, classProperty: 'clase', inputProperties: VARIABLES});
  return {
    mapa: comp.select(VARIABLES).classify(modelo).rename('clase').toByte(),
    validacion: validacion.classify(modelo)
  };
}

function superficies(clas, escala) {
  return ee.Image.pixelArea().divide(10000).rename('ha').addBands(clas).reduceRegion({
    reducer: ee.Reducer.sum().group({groupField: 1, groupName: 'clase'}),
    geometry: S.aoi, crs: CRS, scale: escala, maxPixels: 1e10, tileScale: 8
  }).get('groups');
}

function clasificar() {
  if (!listo(2)) return;
  S.ocupado = true;
  avisar('Entrenando Random Forest y clasificando ' + S.ini + ' y ' + S.fin + '... (puede tardar 1-2 min)');
  var fc = poligonosFC();
  var rIni = entrenar(S.compIni, fc);
  var rFin = entrenar(S.compFin, fc);
  S.clasIni = rIni.mapa; S.clasFin = rFin.mapa;
  S.valIni = rIni.validacion; S.valFin = rFin.validacion;
  redibujarCapas();
  panelCobertura.clear();
  panelEvaluacion.clear();
  panelCobertura.add(ui.Label('Calculando superficies...', ESTILO_NOTA));
  calcularSuperficies(ESCALA);
  var destino = ui.Panel();
  panelCobertura.add(destino);
  destino.add(ui.Label('Mapas PNG para tu reporte (pueden tardar 1-2 min en abrir):', ESTILO_NOTA));
  enlacePNG('Cobertura ' + S.ini, S.clasIni.visualize(VIS_COB), destino);
  enlacePNG('Cobertura ' + S.fin, S.clasFin.visualize(VIS_COB), destino);
}

function calcularSuperficies(escala) {
  ee.Dictionary({ini: superficies(S.clasIni, escala), fin: superficies(S.clasFin, escala)})
    .evaluate(function(r, err) {
      if (err) {
        if (escala === ESCALA) {
          avisar('El cálculo a ' + escala + ' m tardó demasiado; reintentando a ' + (escala * 2) + ' m...');
          calcularSuperficies(escala * 2);
        } else {
          S.ocupado = false;
          avisar('Error al calcular superficies: ' + err + '\nEspera un minuto y vuelve a pulsar «Clasificar».', true);
        }
        return;
      }
      S.ocupado = false;
      mostrarSuperficies(r, escala);
    });
}

function mostrarSuperficies(r, escala) {
  function haDe(grupos, i) {
    var g = (grupos || []).filter(function(x) { return x.clase === i; })[0];
    return g ? g.sum : 0;
  }
  var filas = [];
  var tIni = 0, tFin = 0;
  CLASES.forEach(function(c, i) {
    var a = haDe(r.ini, i), b = haDe(r.fin, i);
    tIni += a; tFin += b;
    filas.push({c: [{v: c.nombre}, {v: a, f: formato(a, 2)}, {v: b, f: formato(b, 2)}]});
  });
  filas.push({c: [{v: 'TOTAL'}, {v: tIni, f: formato(tIni, 2)}, {v: tFin, f: formato(tFin, 2)}]});
  var tabla = ui.Chart({
    cols: [{label: 'Clase', type: 'string'},
           {label: 'Superficie ' + S.ini + ' (ha)', type: 'number'},
           {label: 'Superficie ' + S.fin + ' (ha)', type: 'number'}],
    rows: filas
  }, 'Table');
  panelCobertura.widgets().set(0, ui.Label('Superficie por clase (hectáreas). Copia estos valores ' +
    'exactamente en tu cuadernillo; ahí calcularás la diferencia y la tasa de cambio.' +
    (escala > ESCALA ? '\n(Calculado con píxeles de ' + escala + ' m por tiempo de cómputo.)' : ''), ESTILO_NOTA));
  panelCobertura.insert(1, tabla);
  avisar('Clasificación lista. Revisa las capas «Cobertura» y la tabla de superficies.\n' +
    'Activa y desactiva capas (Layers) o usa la cortina con «Cobertura» para comparar.');
}

// --- Paso 5: evaluación ------------------------------------------------
function evaluar() {
  if (!S.valIni) { avisar('Primero clasifica (paso 4).', true); return; }
  if (S.ocupado) { avisar('Espera a que termine el cálculo anterior.'); return; }
  S.ocupado = true;
  avisar('Calculando matrices de confusión...');
  var orden = [0, 1, 2];
  ee.Dictionary({
    ini: S.valIni.errorMatrix('clase', 'classification', orden).array(),
    fin: S.valFin.errorMatrix('clase', 'classification', orden).array()
  }).evaluate(function(r, err) {
    S.ocupado = false;
    if (err) { avisar('Error en la evaluación: ' + err, true); return; }
    mostrarEvaluacion(r);
  });
}

function mostrarEvaluacion(r) {
  panelEvaluacion.clear();
  var metricas = [];
  [['ini', S.ini], ['fin', S.fin]].forEach(function(p) {
    var m = r[p[0]];
    var total = 0;
    m.forEach(function(fila) { fila.forEach(function(v) { total += v; }); });
    var cols = [{label: 'Real ↓ / Mapa →', type: 'string'}];
    CLASES.forEach(function(c) { cols.push({label: c.abrev, type: 'number'}); });
    cols.push({label: 'Total', type: 'number'});
    var filas = CLASES.map(function(c, i) {
      var celdas = [{v: c.abrev}];
      m[i].forEach(function(v) { celdas.push({v: v}); });
      celdas.push({v: m[i].reduce(function(a, b) { return a + b; }, 0)});
      return {c: celdas};
    });
    panelEvaluacion.add(ui.Label('Matriz de confusión ' + p[1] + ' (' + total + ' píxeles de validación)',
      {fontWeight: 'bold', fontSize: '13px', margin: '8px 0 2px 0'}));
    panelEvaluacion.add(ui.Chart({cols: cols, rows: filas}, 'Table'));
    CLASES.forEach(function(c, i) {
      var vp = m[i][i];
      var fn = m[i].reduce(function(a, b) { return a + b; }, 0) - vp;
      var fp = m.reduce(function(a, fila) { return a + fila[i]; }, 0) - vp;
      var vn = total - vp - fn - fp;
      metricas.push({clase: c.abrev, anio: p[1], vp: vp, fn: fn, fp: fp, vn: vn,
        sens: vp + fn ? 100 * vp / (vp + fn) : 0,
        esp: vn + fp ? 100 * vn / (vn + fp) : 0,
        prec: vp + fp ? 100 * vp / (vp + fp) : 0});
    });
  });

  var tcols = ['Clase', 'Año', 'VP', 'FN', 'FP', 'VN', 'Sens. %', 'Espec. %', 'Prec. %']
    .map(function(t, i) { return {label: t, type: i < 2 ? 'string' : 'number'}; });
  var tfilas = metricas.map(function(x) {
    return {c: [{v: x.clase}, {v: String(x.anio)}, {v: x.vp}, {v: x.fn}, {v: x.fp}, {v: x.vn},
      {v: Math.round(x.sens * 10) / 10}, {v: Math.round(x.esp * 10) / 10}, {v: Math.round(x.prec * 10) / 10}]};
  });
  panelEvaluacion.add(ui.Label('VP = verdaderos positivos · FN = falsos negativos · FP = falsos positivos · ' +
    'VN = verdaderos negativos', ESTILO_NOTA));
  panelEvaluacion.add(ui.Chart({cols: tcols, rows: tfilas}, 'Table'));

  var gfilas = metricas.map(function(x) {
    return {c: [{v: x.clase + ' ' + x.anio}, {v: Math.round(x.sens * 10) / 10},
      {v: Math.round(x.esp * 10) / 10}, {v: Math.round(x.prec * 10) / 10}]};
  });
  var grafica = ui.Chart({
    cols: [{label: 'Clase y año', type: 'string'}, {label: 'Sensibilidad', type: 'number'},
           {label: 'Especificidad', type: 'number'}, {label: 'Precisión', type: 'number'}],
    rows: gfilas
  }, 'ColumnChart', {
    title: 'Evaluación por clase (%) · ' + ZONAS[S.zona].nombre,
    vAxis: {title: '%', viewWindow: {min: 0, max: 100}},
    colors: ['#2f6fb0', '#e08a1e', '#8a4fbf'],
    legend: {position: 'bottom'},
    chartArea: {left: 45, top: 40, width: '88%', height: '60%'}
  });
  grafica.style().set({height: '340px'});
  panelEvaluacion.add(grafica);
  panelEvaluacion.add(ui.Label('Sensibilidad = VP/(VP+FN): de lo que realmente es la clase, cuánto encontró.\n' +
    'Especificidad = VN/(VN+FP): de lo que NO es la clase, cuánto descartó bien.\n' +
    'Precisión = VP/(VP+FP): de lo que el mapa llamó esa clase, cuánto era correcto.\n' +
    'Ojo: los píxeles de validación vienen de tus mismos polígonos, así que estos valores tienden a ser optimistas.',
    ESTILO_NOTA));
  avisar('Evaluación lista. Descarga la gráfica (↗) y captura las tablas para tu reporte.');
}

// --- Comparación con cortina -------------------------------------------
function actualizarComparacion() {
  var modo = selComparar.getValue();
  var izq = S.compIni, der = S.compFin, vis = VIS_RGB;
  if (modo === 'Falso color') vis = VIS_FALSO;
  if (modo === 'Cobertura') {
    if (!S.clasIni) {
      avisar('La cobertura estará disponible después del paso 4. Mostrando color verdadero.');
      selComparar.setValue('Color verdadero', false);
      modo = 'Color verdadero';
    } else {
      izq = S.clasIni; der = S.clasFin; vis = VIS_COB;
    }
  }
  mapaIzq.layers().reset([ui.Map.Layer(izq, vis, modo + ' ' + S.ini),
    ui.Map.Layer(contornoAOI(), {}, 'Área de trabajo')]);
  mapaDer.layers().reset([ui.Map.Layer(der, vis, modo + ' ' + S.fin),
    ui.Map.Layer(contornoAOI(), {}, 'Área de trabajo')]);
  rotuloIzq.setValue('◀ ' + S.ini + ' · ' + modo);
  rotuloDer.setValue(modo + ' · ' + S.fin + ' ▶');
}

function alternarComparacion() {
  if (!S.cargado) { avisar('Primero carga la zona y los años (paso 1).', true); return; }
  if (!S.comparando) {
    var b = mapa.getBounds();
    var z = mapa.getZoom();
    terminarDibujo();
    actualizarComparacion();
    ui.root.widgets().set(1, cortina);
    mapaIzq.setCenter((b[0] + b[2]) / 2, (b[1] + b[3]) / 2, z);
    S.comparando = true;
    btnComparar.setLabel('↩ Volver al mapa de trabajo');
    estado.setValue('Arrastra la barra central para comparar ' + S.ini + ' (izquierda) con ' + S.fin + ' (derecha).');
  } else {
    ui.root.widgets().set(1, mapa);
    S.comparando = false;
    btnComparar.setLabel('⇆ Comparar inicio | fin (cortina)');
    estado.setValue('De vuelta en el mapa de trabajo.');
  }
}

// ---------------------------------------------------------------------
// 7. INICIO (y recuperación del respaldo, si existe)
// ---------------------------------------------------------------------
mapa.setCenter(-96.45, 19.15, 9);
actualizarContadores();
if (typeof RESPALDO === 'string') RESPALDO = JSON.parse(RESPALDO);
if (RESPALDO && RESPALDO.poligonos) {
  selZona.setValue(String(RESPALDO.zona), false);
  if (RESPALDO.ini) selIni.setValue(String(RESPALDO.ini), false);
  if (RESPALDO.fin) selFin.setValue(String(RESPALDO.fin), false);
  RESPALDO.poligonos.forEach(function(p) {
    var g = p.tipo === 'MultiPolygon' ? ee.Geometry.MultiPolygon(p.coords) : ee.Geometry.Polygon(p.coords);
    capas[p.clase].geometries().add(g);
  });
  actualizarContadores();
  cargar();
  avisar('Se recuperaron ' + RESPALDO.poligonos.length + ' polígonos del respaldo.');
}
