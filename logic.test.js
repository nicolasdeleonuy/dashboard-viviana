import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCSV } from './logic.js';
import { normalizeBrand } from './logic.js';

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
