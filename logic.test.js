import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCSV } from './logic.js';
import { normalizeBrand } from './logic.js';
import { videosFromCSV, contractsFromCSV } from './logic.js';
import { monthLabel, videoDate, fmtDayMonth } from './logic.js';
import { buildContracts, buildMonths } from './logic.js';
import { computeRuta } from './logic.js';

test('parseCSV: filas y columnas simples', () => {
  const rows = parseCSV('a,b,c\n1,2,3');
  assert.deepEqual(rows, [['a', 'b', 'c'], ['1', '2', '3']]);
});

test('parseCSV: comillas con comas adentro', () => {
  const rows = parseCSV('"Kind Patches, MB",Joyspring');
  assert.deepEqual(rows, [['Kind Patches, MB', 'Joyspring']]);
});

test('parseCSV: comillas escapadas', () => {
  const rows = parseCSV('"dice ""hola""",x');
  assert.deepEqual(rows, [['dice "hola"', 'x']]);
});

test('normalizeBrand: minúsculas y trim', () => {
  assert.equal(normalizeBrand('  JoySpring '), 'joyspring');
  assert.equal(normalizeBrand('joyspring'), 'joyspring');
});

test('normalizeBrand: variantes de Kind Patches colapsan', () => {
  assert.equal(normalizeBrand('Kind Patches MB'), 'kind patches');
  assert.equal(normalizeBrand('Kind Patches Red'), 'kind patches');
  assert.equal(normalizeBrand('Kind Patches (?)'), 'kind patches');
  assert.equal(normalizeBrand('Kind Patches '), 'kind patches');
});

test('normalizeBrand: vacío o nulo', () => {
  assert.equal(normalizeBrand(''), '');
  assert.equal(normalizeBrand(null), '');
});

test('videosFromCSV: mapea columnas (A=fecha,B=producto,C=marca,D=obs,E=mes) y saltea encabezado + vacíos', () => {
  const rows = [
    ['fecha', 'producto', 'Marca', 'observaciones', 'mes'],
    ['10/06', 'para patrol', 'Joyspring', '', '2026-06'],
    ['', '', '', '', ''],                 // vacía -> se saltea
    ['11/06', 'x', '', '', '2026-06'],    // sin marca -> se saltea
    ['12/06', 'y', 'K2O', 'nota', ''],    // sin mes -> se saltea
  ];
  assert.deepEqual(videosFromCSV(rows), [
    { mes: '2026-06', fecha: '10/06', producto: 'para patrol', marca: 'Joyspring', obs: '' },
  ]);
});

test('contractsFromCSV: parsea contratados a número', () => {
  const rows = [
    ['mes', 'marca', 'contratados'],
    ['2026-06', 'Joyspring', '30'],
    ['2026-06', '', ''],  // sin marca -> se saltea
  ];
  assert.deepEqual(contractsFromCSV(rows), [
    { mes: '2026-06', marca: 'Joyspring', contratados: 30 },
  ]);
});

test('monthLabel: mes-año en español capitalizado', () => {
  assert.equal(monthLabel('2026-06'), 'Junio 2026');
  assert.equal(monthLabel('2026-11'), 'Noviembre 2026');
});

test('videoDate: arma la fecha desde mes + día de fecha', () => {
  const d = videoDate('2026-06', '10/06');
  assert.equal(d.getFullYear(), 2026);
  assert.equal(d.getMonth(), 5); // junio = 5
  assert.equal(d.getDate(), 10);
});

test('fmtDayMonth: día + mes abreviado', () => {
  assert.equal(fmtDayMonth(new Date(2026, 6, 10)), '10 jul');
});

const CONTRACTS = [
  { mes: '2026-06', marca: 'Joyspring', contratados: 2 },
  { mes: '2026-06', marca: 'Kind Patches', contratados: 1 },
  { mes: '2026-07', marca: 'Joyspring', contratados: 2 },
];
const VIDEOS = [
  { mes: '2026-06', fecha: '10/06', producto: 'a', marca: 'Joyspring', obs: '' },
  { mes: '2026-06', fecha: '11/06', producto: 'b', marca: 'joyspring', obs: '' },
  { mes: '2026-06', fecha: '12/06', producto: 'c', marca: 'Kind Patches MB', obs: '' },
  { mes: '2026-06', fecha: '09/06', producto: 'd', marca: 'Medicube', obs: '' }, // no-retainer
  { mes: '2026-07', fecha: '02/07', producto: 'e', marca: 'Joyspring', obs: '' },
];

test('buildContracts: agrupa por mes y agrega key normalizada', () => {
  const map = buildContracts(CONTRACTS);
  assert.equal(map.get('2026-06').length, 2);
  assert.equal(map.get('2026-06')[1].key, 'kind patches');
});

test('buildMonths: cuenta por marca contra el contrato del mes', () => {
  const months = buildMonths(VIDEOS, buildContracts(CONTRACTS), '2026-07');
  // orden: más nuevo primero
  assert.deepEqual(months.map(m => m.mes), ['2026-07', '2026-06']);

  const jun = months.find(m => m.mes === '2026-06');
  const joy = jun.brands.find(b => b.marca === 'Joyspring');
  assert.equal(joy.pub, 2);           // "Joyspring" + "joyspring"
  assert.equal(joy.meta, 2);
  assert.equal(joy.complete, true);
  const kp = jun.brands.find(b => b.marca === 'Kind Patches');
  assert.equal(kp.pub, 1);            // "Kind Patches MB" cuenta
  assert.equal(jun.totalPub, 3);
  assert.equal(jun.totalMeta, 3);
  assert.equal(jun.extraBrands.length, 1); // Medicube
  assert.equal(jun.extraBrands[0].marca, 'Medicube');
});

test('buildMonths: mes actual sin videos aparece igual', () => {
  const months = buildMonths([], buildContracts(CONTRACTS), '2026-08');
  const ago = months.find(m => m.mes === '2026-08');
  assert.ok(ago);
  assert.equal(ago.isCurrent, true);
  assert.equal(ago.totalPub, 0);
});

test('computeRuta: reparte lo que falta en los días restantes', () => {
  const mv = { brands: [
    { marca: 'Joyspring', pub: 0, meta: 4 },
    { marca: 'K2O', pub: 0, meta: 2 },
  ] };
  const ruta = computeRuta(mv, new Date(2026, 6, 29), 31); // 29,30,31 -> 3 días, 6 videos
  const totalRepartido = ruta.reduce((s, d) => s + d.total, 0);
  assert.equal(totalRepartido, 6); // reparte TODO lo que falta
  assert.ok(ruta.length <= 3);     // no inventa días fuera de mes
});

test('computeRuta: intercala marcas y no las amontona en bloque', () => {
  const mv = { brands: [
    { marca: 'Joyspring', pub: 0, meta: 6 },
    { marca: 'K2O', pub: 0, meta: 6 },
  ] };
  const ruta = computeRuta(mv, new Date(2026, 6, 1), 6); // 6 días, 12 videos (2/día)
  assert.equal(ruta.reduce((s, d) => s + d.total, 0), 12);
  // cada marca repartida pareja: nunca más de 2 de la misma marca en un día
  for (const d of ruta) for (const b of d.brands) {
    assert.ok(b.n <= 2, `${b.marca} amontonada: ${b.n} en un día`);
  }
  // las dos marcas aparecen a lo largo del mes (no una toda al principio y otra toda al final)
  const joyDays = ruta.filter(d => d.brands.some(b => b.marca === 'Joyspring')).length;
  const k2oDays = ruta.filter(d => d.brands.some(b => b.marca === 'K2O')).length;
  assert.ok(joyDays >= 3 && k2oDays >= 3, `mal repartidas: Joy en ${joyDays} días, K2O en ${k2oDays}`);
});

test('computeRuta: vacío si no falta nada', () => {
  const mv = { brands: [{ marca: 'Joyspring', pub: 5, meta: 4 }] };
  assert.deepEqual(computeRuta(mv, new Date(2026, 6, 29), 31), []);
});
