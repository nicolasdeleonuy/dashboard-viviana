import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCSV } from './logic.js';
import { normalizeBrand } from './logic.js';
import { videosFromCSV, contractsFromCSV } from './logic.js';

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

test('videosFromCSV: mapea columnas y saltea encabezado + vacíos', () => {
  const rows = [
    ['mes', 'fecha', 'producto', 'marca', 'obs'],
    ['2026-06', '10/06', 'para patrol', 'Joyspring', ''],
    ['', '', '', '', ''],              // vacía -> se saltea
    ['2026-06', '11/06', 'x', '', ''], // sin marca -> se saltea
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
