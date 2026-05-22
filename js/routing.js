/* =========================================================
   ROTEAMENTO DE SETAS (ortogonal, evita blocos)
========================================================= */
// Algoritmo: para cada aresta, encontramos pontos de saída/entrada
// nas bordas dos nodes (com base no side preferencial),
// e construímos um caminho ortogonal que tenta desviar dos outros blocos
// usando uma grade simples.

const GRID = 10;
const PAD = 14;   // afastamento mínimo dos blocos

function nodeBox(n){
  const w = n._w || n.w || 180;
  const h = n._h || n.h || 50;
  return { x:n.x, y:n.y, w, h, cx:n.x+w/2, cy:n.y+h/2, shape: n.shape||'rect' };
}

function obstacles(excludeIds){
  return state.nodes.filter(n => !excludeIds.includes(n.id)).map(n => {
    const b = nodeBox(n);
    return { x:b.x-PAD, y:b.y-PAD, w:b.w+PAD*2, h:b.h+PAD*2 };
  });
}

// Generate bypass waypoints around an obstacle rect
function bypassPoints(obs, horizontal){
  const cx = obs.x + obs.w/2, cy = obs.y + obs.h/2;
  if (horizontal){
    return [
      obs.y - PAD*2,        // go above
      obs.y + obs.h + PAD*2, // go below
    ];
  } else {
    return [
      obs.x - PAD*2,        // go left
      obs.x + obs.w + PAD*2, // go right
    ];
  }
}

function inRect(pt, r){
  return pt.x >= r.x && pt.x <= r.x+r.w && pt.y >= r.y && pt.y <= r.y+r.h;
}

function segmentIntersectsRect(p1, p2, r){
  // segmento ortogonal (horizontal ou vertical)
  if (p1.x === p2.x){
    const x = p1.x;
    if (x < r.x || x > r.x+r.w) return false;
    const y1 = Math.min(p1.y, p2.y), y2 = Math.max(p1.y, p2.y);
    return !(y2 < r.y || y1 > r.y+r.h);
  } else {
    const y = p1.y;
    if (y < r.y || y > r.y+r.h) return false;
    const x1 = Math.min(p1.x, p2.x), x2 = Math.max(p1.x, p2.x);
    return !(x2 < r.x || x1 > r.x+r.w);
  }
}

function pathBlocked(points, obs){
  for (let i=0;i<points.length-1;i++){
    for (const r of obs){
      if (segmentIntersectsRect(points[i], points[i+1], r)) return true;
    }
  }
  return false;
}

function portOnSide(box, side){
  if (box.shape === 'parallelogram'){
    switch(side){
      case 't': return { x: box.x + box.w*0.57, y: box.y - 1, dir:'t' };
      case 'b': return { x: box.x + box.w*0.43, y: box.y + box.h + 1, dir:'b' };
      case 'l': return { x: box.x + box.w*0.07, y: box.cy, dir:'l' };
      case 'r': return { x: box.x + box.w*0.93, y: box.cy, dir:'r' };
    }
  }
  switch(side){
    case 't': return { x: box.cx, y: box.y - 1, dir:'t' };
    case 'b': return { x: box.cx, y: box.y + box.h + 1, dir:'b' };
    case 'l': return { x: box.x - 1, y: box.cy, dir:'l' };
    case 'r': return { x: box.x + box.w + 1, y: box.cy, dir:'r' };
  }
}

function routeEdge(src, srcSide, dst, dstSide, obs){
  const s = portOnSide(src, srcSide);
  const t = portOnSide(dst, dstSide);
  const offset = 22;
  const sOut = pushOut(s, srcSide, offset);
  const tOut = pushOut(t, dstSide, offset);

  const candidates = [];
  const midX = (sOut.x + tOut.x) / 2;
  const midY = (sOut.y + tOut.y) / 2;

  // Basic 2-bend routes
  candidates.push([s, sOut, {x:tOut.x, y:sOut.y}, tOut, t]);
  candidates.push([s, sOut, {x:sOut.x, y:tOut.y}, tOut, t]);
  candidates.push([s, sOut, {x:midX, y:sOut.y}, {x:midX, y:tOut.y}, tOut, t]);
  candidates.push([s, sOut, {x:sOut.x, y:midY}, {x:tOut.x, y:midY}, tOut, t]);

  // Bypass routes at multiple distances
  for (const gap of [70, 120, 180, 260]){
    const r  = Math.max(sOut.x, tOut.x) + gap;
    const l  = Math.min(sOut.x, tOut.x) - gap;
    const tp = Math.min(sOut.y, tOut.y) - gap;
    const bt = Math.max(sOut.y, tOut.y) + gap;
    candidates.push([s, sOut, {x:r,  y:sOut.y}, {x:r,  y:tOut.y}, tOut, t]);
    candidates.push([s, sOut, {x:l,  y:sOut.y}, {x:l,  y:tOut.y}, tOut, t]);
    candidates.push([s, sOut, {x:sOut.x, y:tp}, {x:tOut.x, y:tp}, tOut, t]);
    candidates.push([s, sOut, {x:sOut.x, y:bt}, {x:tOut.x, y:bt}, tOut, t]);
  }

  // Obstacle-specific bypasses: for each blocking obstacle, generate routes that go around it
  for (const ob of obs){
    const aboveY = ob.y - PAD*3;
    const belowY = ob.y + ob.h + PAD*3;
    const leftX  = ob.x - PAD*3;
    const rightX = ob.x + ob.w + PAD*3;
    candidates.push([s, sOut, {x:sOut.x, y:aboveY}, {x:tOut.x, y:aboveY}, tOut, t]);
    candidates.push([s, sOut, {x:sOut.x, y:belowY}, {x:tOut.x, y:belowY}, tOut, t]);
    candidates.push([s, sOut, {x:leftX,  y:sOut.y}, {x:leftX,  y:tOut.y}, tOut, t]);
    candidates.push([s, sOut, {x:rightX, y:sOut.y}, {x:rightX, y:tOut.y}, tOut, t]);
    // 3-segment routes going around obstacle corners
    candidates.push([s, sOut, {x:sOut.x, y:aboveY}, {x:tOut.x, y:aboveY}, tOut, t]);
    candidates.push([s, sOut, {x:leftX,  y:sOut.y}, {x:leftX,  y:tOut.y}, tOut, t]);
  }

  // Pick shortest clear route
  let best = null, bestLen = Infinity;
  for (const c of candidates){
    if (!pathBlocked(c, obs)){
      const len = pathLength(c);
      if (len < bestLen){ bestLen = len; best = c; }
    }
  }
  if (best) return best;

  // Fallback: shortest even if crossing (never leaves user hanging)
  let fallback = candidates[0], fLen = pathLength(fallback);
  for (const c of candidates){
    const len = pathLength(c);
    if (len < fLen){ fLen = len; fallback = c; }
  }
  return fallback;
}

function pushOut(p, side, d){
  switch(side){
    case 't': return { x:p.x, y:p.y - d };
    case 'b': return { x:p.x, y:p.y + d };
    case 'l': return { x:p.x - d, y:p.y };
    case 'r': return { x:p.x + d, y:p.y };
  }
}
function pathLength(pts){
  let l = 0;
  for (let i=0;i<pts.length-1;i++){
    l += Math.abs(pts[i].x - pts[i+1].x) + Math.abs(pts[i].y - pts[i+1].y);
  }
  return l;
}

function chooseAutoSides(srcBox, dstBox){
  // Escolhe sides automaticamente se não definidos: maior gap dita direção
  const dx = dstBox.cx - srcBox.cx;
  const dy = dstBox.cy - srcBox.cy;
  if (Math.abs(dx) >= Math.abs(dy)){
    return dx >= 0 ? ['r','l'] : ['l','r'];
  } else {
    return dy >= 0 ? ['b','t'] : ['t','b'];
  }
}

function pointsToPath(pts){
  // gera path com cantos ligeiramente arredondados
  const r = 6;
  if (pts.length < 2) return '';
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i=1;i<pts.length-1;i++){
    const prev = pts[i-1], cur = pts[i], next = pts[i+1];
    // direção de entrada
    const inDx = Math.sign(cur.x - prev.x), inDy = Math.sign(cur.y - prev.y);
    const outDx = Math.sign(next.x - cur.x), outDy = Math.sign(next.y - cur.y);
    if (inDx === outDx && inDy === outDy){
      // colinear, sem canto
      d += ` L ${cur.x} ${cur.y}`;
    } else {
      // canto
      const rr = Math.min(r,
        Math.abs(cur.x - prev.x)/2,
        Math.abs(cur.y - prev.y)/2,
        Math.abs(cur.x - next.x)/2,
        Math.abs(cur.y - next.y)/2
      );
      const p1 = { x: cur.x - inDx*rr, y: cur.y - inDy*rr };
      const p2 = { x: cur.x + outDx*rr, y: cur.y + outDy*rr };
      d += ` L ${p1.x} ${p1.y} Q ${cur.x} ${cur.y} ${p2.x} ${p2.y}`;
    }
  }
  d += ` L ${pts[pts.length-1].x} ${pts[pts.length-1].y}`;
  return d;
}

function colorVal(c){
  const obj = COLORS.find(x => x.id===c);
  return obj ? obj.css : '#888';
}
