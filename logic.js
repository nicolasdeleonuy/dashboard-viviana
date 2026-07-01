// Funciones puras del dashboard de Viviana. Sin DOM, sin fetch: testeables con node --test.

// Parser CSV RFC 4180
export function parseCSV(text) {
  const rows = [];
  let row = [], field = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i], n = text[i + 1];
    if (inQ) {
      if (c === '"' && n === '"') { field += '"'; i++; }
      else if (c === '"') { inQ = false; }
      else { field += c; }
    } else {
      if (c === '"') { inQ = true; }
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\r' && n === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; }
      else if (c === '\n' || c === '\r') { row.push(field); rows.push(row); row = []; field = ''; }
      else { field += c; }
    }
  }
  if (row.length || field) { row.push(field); rows.push(row); }
  return rows;
}

export function videosFromCSV(rows) {
  const out = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const mes = (r[0] || '').trim();
    const marca = (r[3] || '').trim();
    if (!mes || !marca) continue;
    out.push({
      mes,
      fecha: (r[1] || '').trim(),
      producto: (r[2] || '').trim(),
      marca,
      obs: (r[4] || '').trim(),
    });
  }
  return out;
}

export function contractsFromCSV(rows) {
  const out = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const mes = (r[0] || '').trim();
    const marca = (r[1] || '').trim();
    if (!mes || !marca) continue;
    out.push({ mes, marca, contratados: parseInt(r[2], 10) || 0 });
  }
  return out;
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MESES_ABBR = ['ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export function monthLabel(mes) {
  const [y, m] = mes.split('-').map(Number);
  const name = MESES[m - 1] || mes;
  return name.charAt(0).toUpperCase() + name.slice(1) + ' ' + y;
}

export function videoDate(mes, fecha) {
  const [y, m] = mes.split('-').map(Number);
  const day = parseInt(String(fecha).split('/')[0], 10) || 1;
  return new Date(y, m - 1, day);
}

export function fmtDayMonth(date) {
  return date.getDate() + ' ' + MESES_ABBR[date.getMonth()];
}

// Normaliza el nombre de marca a una clave comparable.
// Colapsa todas las variantes de "Kind Patches" (MB, Red, (?), con espacio) a una sola.
export function normalizeBrand(raw) {
  const s = (raw || '').trim().toLowerCase();
  if (s.startsWith('kind patches')) return 'kind patches';
  return s;
}
