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
    // Columnas reales de la pestaña Videos: A=fecha, B=producto, C=marca, D=obs, E=mes
    const mes = (r[4] || '').trim();
    const marca = (r[2] || '').trim();
    if (!mes || !marca) continue;
    out.push({
      mes,
      fecha: (r[0] || '').trim(),
      producto: (r[1] || '').trim(),
      marca,
      obs: (r[3] || '').trim(),
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

export function computeRuta(monthView, todayDate, endDay) {
  const pool = [];
  for (const b of monthView.brands) {
    const rem = Math.max(b.meta - b.pub, 0);
    for (let i = 0; i < rem; i++) pool.push(b.marca);
  }
  const days = [];
  for (let d = todayDate.getDate(); d <= endDay; d++) {
    days.push(new Date(todayDate.getFullYear(), todayDate.getMonth(), d));
  }
  if (!pool.length || !days.length) return [];

  const perDay = Math.ceil(pool.length / days.length);
  const out = [];
  let idx = 0;
  for (const day of days) {
    const slot = pool.slice(idx, idx + perDay);
    idx += slot.length;
    const counts = new Map();
    for (const m of slot) counts.set(m, (counts.get(m) || 0) + 1);
    out.push({
      date: day, total: slot.length,
      brands: [...counts.entries()].map(([marca, n]) => ({ marca, n })),
    });
    if (idx >= pool.length) break;
  }
  return out;
}

export function buildContracts(contractObjs) {
  const map = new Map();
  for (const c of contractObjs) {
    if (!map.has(c.mes)) map.set(c.mes, []);
    map.get(c.mes).push({ marca: c.marca, contratados: c.contratados, key: normalizeBrand(c.marca) });
  }
  return map;
}

export function buildMonths(videoObjs, contractsMap, todayYM) {
  const monthsSet = new Set(videoObjs.map(v => v.mes));
  monthsSet.add(todayYM);
  const months = [...monthsSet].sort().reverse(); // más nuevo primero

  return months.map(mes => {
    const vids = videoObjs.filter(v => v.mes === mes);
    const contract = contractsMap.get(mes) || [];
    const hasContract = contractsMap.has(mes);

    const counts = new Map();
    for (const v of vids) {
      const k = normalizeBrand(v.marca);
      counts.set(k, (counts.get(k) || 0) + 1);
    }

    const brands = contract.map(c => {
      const pub = counts.get(c.key) || 0;
      return {
        marca: c.marca, pub, meta: c.contratados,
        complete: pub >= c.contratados,
        pct: c.contratados ? Math.min(pub / c.contratados, 1) : 0,
      };
    });

    const contractKeys = new Set(contract.map(c => c.key));
    const extraMap = new Map();
    for (const v of vids) {
      const k = normalizeBrand(v.marca);
      if (contractKeys.has(k)) continue;
      if (!extraMap.has(k)) extraMap.set(k, { marca: v.marca, pub: 0 });
      extraMap.get(k).pub++;
    }
    const extraBrands = [...extraMap.values()];

    const totalPub = brands.reduce((s, b) => s + b.pub, 0);
    const totalMeta = brands.reduce((s, b) => s + b.meta, 0);
    const pct = totalMeta ? Math.min(totalPub / totalMeta, 1) : 0;

    let lastDate = null;
    for (const v of vids) {
      const d = videoDate(v.mes, v.fecha);
      if (!lastDate || d > lastDate) lastDate = d;
    }

    return {
      mes, label: monthLabel(mes), isCurrent: mes === todayYM, hasContract,
      brands, extraBrands, totalPub, totalMeta, pct, lastDate, videos: vids,
    };
  });
}
