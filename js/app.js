/* =========================================================
   SAVE / NEW / FILENAME
========================================================= */
document.getElementById('saveBtn').onclick = () => {
  let name = document.getElementById('fileName').value.trim();
  if (!name || name === 'Fluxo sem título'){
    name = prompt('Nome do fluxo:', name || 'Meu fluxo') || 'Fluxo sem título';
    document.getElementById('fileName').value = name;
  }
  state.name = name;
  const data = loadFlows();
  // se já tem id atual, atualiza; senão cria
  let cur = data.flows.find(f => f.id === data.current);
  if (!cur){
    cur = { id: uid(), name: state.name, data: JSON.parse(JSON.stringify(state)) };
    data.flows.unshift(cur);
    data.current = cur.id;
  } else {
    cur.name = state.name;
    cur.data = JSON.parse(JSON.stringify(state));
  }
  saveFlows(data);
  savedStateHash = hashState();
  markDirty();
  renderFlowList();
  toast('Salvo localmente');
};

document.getElementById('newBtn').onclick = () => {
  if (state.nodes.length || state.lanes.length){
    if (!confirm('Criar um novo fluxo? Mudanças não salvas serão perdidas.')) return;
  }
  state = DEFAULT_STATE();
  const data = loadFlows();
  data.current = null;
  saveFlows(data);
  undoStack = []; redoStack = [];
  selection = null;
  renderAll();
};

document.getElementById('fileName').addEventListener('input', e => { state.name = e.target.value });

/* =========================================================
   EXPORT
========================================================= */
document.getElementById('exportBtn').onclick = () => {
  const choice = prompt('Exportar como:\n1 — JSON (editável depois)\n2 — SVG (imagem vetorial)\n3 — PNG (imagem)\n\nDigite 1, 2 ou 3:', '1');
  if (!choice) return;
  if (choice === '1') exportJSON();
  else if (choice === '2') exportSVG();
  else if (choice === '3') exportPNG();
};

function exportJSON(){
  const blob = new Blob([JSON.stringify(state, null, 2)], { type:'application/json' });
  download(blob, `${state.name || 'fluxo'}.json`);
  toast('JSON exportado');
}

function buildExportSvg(st){
  st = st || state;
  // calcula bbox
  let minX=Infinity, minY=Infinity, maxX=-Infinity, maxY=-Infinity;
  const _elx = st.laneX ?? 60;
  const _elw = st.laneW ?? 1400;
  st.lanes.forEach(l => {
    minX = Math.min(minX, _elx); minY = Math.min(minY, l.y);
    maxX = Math.max(maxX, _elx+_elw); maxY = Math.max(maxY, l.y+(l.h??200));
  });
  st.nodes.forEach(n => {
    const b = nodeBox(n);
    minX = Math.min(minX, b.x); minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x+b.w); maxY = Math.max(maxY, b.y+b.h);
  });
  (st.dividers||[]).forEach(d => {
    minX = Math.min(minX, d.x); minY = Math.min(minY, d.y-12);
    maxX = Math.max(maxX, d.x+d.w); maxY = Math.max(maxY, d.y+12);
  });
  if (!isFinite(minX)){ minX=0; minY=0; maxX=400; maxY=300 }
  const pad = 40;
  minX -= pad; minY -= pad; maxX += pad; maxY += pad;
  const w = maxX-minX, h = maxY-minY;

  const colorMap = Object.fromEntries(COLORS.map(c => [c.id, c.css]));
  const laneFills = {
    acc: 'rgba(28,22,48,.6)', blue:'rgba(18,28,52,.6)', grn:'rgba(14,32,22,.6)',
    amb:'rgba(35,25,12,.6)', red:'rgba(40,15,18,.5)', pnk:'rgba(40,15,28,.5)',
    cyn:'rgba(12,32,32,.5)', white:'rgba(255,255,255,.05)', neutral:'rgba(255,255,255,.02)',
  };
  const nodeFills = {
    acc: 'rgba(30,28,52,.95)', blue:'rgba(18,28,52,.95)', grn:'rgba(14,32,22,.95)',
    amb:'rgba(35,25,12,.95)', red:'rgba(40,15,18,.95)', pnk:'rgba(40,15,28,.95)',
    cyn:'rgba(12,32,32,.95)', white:'rgba(45,45,55,.95)', neutral:'rgba(22,22,29,.95)',
  };

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minY} ${w} ${h}" width="${w}" height="${h}" font-family="Sora, sans-serif">`;
  svg += `<rect x="${minX}" y="${minY}" width="${w}" height="${h}" fill="#0f0f13"/>`;
  svg += `<defs>`;
  COLORS.forEach(c => {
    svg += `<marker id="exp-arr-${c.id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" fill="${c.css}"/>
    </marker>`;
  });
  svg += `</defs>`;
  // lanes (horizontal rows)
  const _slx = st.laneX ?? 60;
  const _slw = st.laneW ?? 1400;
  st.lanes.forEach(l => {
    const lh = l.h ?? 200;
    svg += `<rect x="${_slx}" y="${l.y}" width="${_slw}" height="${lh}" rx="11" ry="11" fill="${laneFills[l.color]}" stroke="${colorMap[l.color]}" stroke-opacity=".4" stroke-width="1"/>`;
    svg += `<rect x="${_slx}" y="${l.y}" width="34" height="${lh}" fill="${laneFills[l.color]}" stroke="none"/>`;
    svg += `<line x1="${_slx+34}" y1="${l.y+1}" x2="${_slx+34}" y2="${l.y+lh-1}" stroke="${colorMap[l.color]}" stroke-opacity=".2" stroke-width="1"/>`;
    svg += `<text font-size="9" font-weight="700" letter-spacing="1.4" fill="${colorMap[l.color]}" text-anchor="middle" transform="translate(${_slx+17},${l.y+lh/2}) rotate(-90)">${escapeHtml(l.name.toUpperCase())}</text>`;
  });
  // dividers
  (st.dividers||[]).forEach(d => {
    const col = colorMap[d.color] || '#888';
    const dash = (d.style==='solid') ? '' : ' stroke-dasharray="6 4"';
    svg += `<line x1="${d.x}" y1="${d.y}" x2="${d.x+d.w}" y2="${d.y}" stroke="${col}" stroke-opacity=".55" stroke-width="1.5"${dash}/>`;
    if (d.label){
      const lw = d.label.length*6.5 + 14;
      svg += `<rect x="${d.x+10}" y="${d.y-9}" width="${lw}" height="18" rx="4" fill="#0f0f13" stroke="${col}" stroke-opacity=".5"/>`;
      svg += `<text x="${d.x+10+lw/2}" y="${d.y+4}" text-anchor="middle" font-size="10" font-weight="700" letter-spacing=".8" fill="${col}">${escapeHtml(d.label.toUpperCase())}</text>`;
    }
  });
  // edges
  st.edges.forEach(edge => {
    const src = st.nodes.find(n => n.id===edge.from);
    const dst = st.nodes.find(n => n.id===edge.to);
    if (!src || !dst) return;
    const sBox = nodeBox(src);
    const dBox = nodeBox(dst);
    let srcSide = edge.fromSide, dstSide = edge.toSide;
    if (!srcSide || !dstSide){
      const auto = chooseAutoSides(sBox, dBox);
      srcSide = srcSide || auto[0]; dstSide = dstSide || auto[1];
    }
    const obs = obstacles([src.id, dst.id]);
    const pts = routeEdge(sBox, srcSide, dBox, dstSide, obs);
    const d = pointsToPath(pts);
    const color = edge.color || 'neutral';
    const dash = edge.style === 'dashed' ? ' stroke-dasharray="5 4"' : '';
    svg += `<path d="${d}" fill="none" stroke="${colorMap[color]}" stroke-width="1.6" marker-end="url(#exp-arr-${color})"${dash}/>`;
    if (edge.label){
      const midIdx = Math.floor(pts.length/2);
      const a = pts[midIdx-1] || pts[0];
      const b = pts[midIdx] || pts[pts.length-1];
      const mx = (a.x+b.x)/2, my=(a.y+b.y)/2;
      svg += `<rect x="${mx - edge.label.length*3.5}" y="${my-7}" width="${edge.label.length*7}" height="14" rx="3" fill="#0f0f13" stroke="#2a2a36"/>`;
      svg += `<text x="${mx}" y="${my+3}" text-anchor="middle" font-size="10" font-weight="600" fill="${colorMap[color]}">${escapeHtml(edge.label)}</text>`;
    }
  });
  // nodes
  st.nodes.forEach(n => {
    const b = nodeBox(n);
    const c = n.color || 'neutral';
    const shape = n.shape || 'rect';
    const rx = shape === 'pill' ? Math.min(b.h/2, 20) : (shape === 'circle' ? b.w/2 : 9);
    const cx = b.x + b.w/2, cy = b.y + b.h/2;
    if (shape === 'diamond'){
      svg += `<polygon points="${cx},${b.y} ${b.x+b.w},${cy} ${cx},${b.y+b.h} ${b.x},${cy}" fill="${nodeFills[c]}" stroke="${colorMap[c]}" stroke-opacity=".55" stroke-width="1"/>`;
    } else if (shape === 'hexagon'){
      const hw = b.w*0.25, hx = b.x, hy = b.y, ww = b.w, hh = b.h;
      svg += `<polygon points="${hx+hw},${hy} ${hx+ww-hw},${hy} ${hx+ww},${hy+hh/2} ${hx+ww-hw},${hy+hh} ${hx+hw},${hy+hh} ${hx},${hy+hh/2}" fill="${nodeFills[c]}" stroke="${colorMap[c]}" stroke-opacity=".55" stroke-width="1"/>`;
    } else if (shape === 'parallelogram'){
      const off = b.w*0.14;
      svg += `<polygon points="${b.x+off},${b.y} ${b.x+b.w},${b.y} ${b.x+b.w-off},${b.y+b.h} ${b.x},${b.y+b.h}" fill="${nodeFills[c]}" stroke="${colorMap[c]}" stroke-opacity=".55" stroke-width="1"/>`;
    } else {
      svg += `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="${rx}" fill="${nodeFills[c]}" stroke="${colorMap[c]}" stroke-opacity=".55" stroke-width="1"/>`;
    }
    svg += `<text x="${cx}" y="${cy - (n.subtitle?5:0)}" text-anchor="middle" dominant-baseline="middle" font-size="11" font-weight="600" fill="${colorMap[c]}">${escapeHtml(n.title || '')}</text>`;
    if (n.subtitle){
      svg += `<text x="${cx}" y="${cy+10}" text-anchor="middle" dominant-baseline="middle" font-size="9" fill="#8888aa">${escapeHtml(n.subtitle)}</text>`;
    }
  });
  svg += `</svg>`;
  return svg;
}

function wrapText(text, maxWidth, charW){
  const max = Math.floor(maxWidth / charW);
  const words = text.split(/\s+/);
  const lines = [];
  let cur = '';
  for (const w of words){
    if ((cur + ' ' + w).trim().length > max){
      if (cur) lines.push(cur);
      cur = w;
    } else {
      cur = (cur ? cur + ' ' : '') + w;
    }
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 3);
}

function exportSVG(){
  const svg = buildExportSvg();
  const blob = new Blob([svg], { type:'image/svg+xml' });
  download(blob, `${state.name || 'fluxo'}.svg`);
  toast('SVG exportado');
}

function exportPNG(){
  const svg = buildExportSvg();
  const blob = new Blob([svg], { type:'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = img.width * 2;
    canvas.height = img.height * 2;
    const ctx = canvas.getContext('2d');
    ctx.scale(2,2);
    ctx.drawImage(img, 0, 0);
    canvas.toBlob(b => {
      download(b, `${state.name || 'fluxo'}.png`);
      URL.revokeObjectURL(url);
      toast('PNG exportado');
    }, 'image/png');
  };
  img.src = url;
}

function download(blob, filename){
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/* =========================================================
   MODO APRESENTAÇÃO (visualizar versão final)
========================================================= */
const presentOverlay = document.getElementById('presentOverlay');

function openPresent(){
  if (!state.nodes.length && !state.lanes.length){
    document.getElementById('presentSvgHost').innerHTML =
      `<div class="present-empty">Nada pra mostrar ainda.<br>Adicione blocos e colunas no editor.</div>`;
  } else {
    document.getElementById('presentSvgHost').innerHTML = buildExportSvg();
  }
  document.getElementById('presentTitle').textContent = state.name || 'Fluxo';
  presentOverlay.classList.add('show');
}
function closePresent(){ presentOverlay.classList.remove('show'); }

document.getElementById('presentBtn').onclick = () => {
  if (!state.nodes.length && !state.lanes.length){
    openPresent(); return;
  }
  const svg = buildExportSvg();
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>${escapeHtml(state.name||'Fluxo')}</title><style>*{margin:0;padding:0;box-sizing:border-box}body{background:#0f0f13;display:flex;align-items:flex-start;justify-content:center;min-height:100vh;padding:2rem}svg{max-width:100%;height:auto;border-radius:.8rem;box-shadow:0 12px 60px rgba(0,0,0,.5)}</style></head><body>${svg}</body></html>`;
  const blob = new Blob([html], {type:'text/html'});
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 60000);
};
document.getElementById('presentClose').onclick = closePresent;
document.getElementById('presentExportPng').onclick = exportPNG;
document.getElementById('presentExportSvg').onclick = exportSVG;

/* =========================================================
   GALERIA DE FLUXOS (menu com todos os fluxos)
========================================================= */
const galleryOverlay = document.getElementById('galleryOverlay');

function thumbFor(st){
  try {
    if (!st.nodes?.length && !st.lanes?.length) return null;
    return buildExportSvg(st);
  } catch { return null; }
}

function renderGallery(){
  const data = loadFlows();
  const grid = document.getElementById('galleryGrid');
  document.getElementById('galleryCount').textContent = data.flows.length;
  grid.innerHTML = '';

  // card "novo"
  const novo = document.createElement('div');
  novo.className = 'gallery-card gallery-new-card';
  novo.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>
    <span>Novo fluxo</span>`;
  novo.onclick = () => { closeGallery(); document.getElementById('newBtn').click(); };
  grid.appendChild(novo);

  data.flows.forEach(f => {
    const card = document.createElement('div');
    card.className = 'gallery-card' + (f.id === data.current ? ' current' : '');
    const thumb = thumbFor(f.data);
    const nodeCount = (f.data.nodes||[]).length;
    const laneCount = (f.data.lanes||[]).length;
    card.innerHTML = `
      <div class="gallery-thumb">${thumb || '<span class="gallery-thumb-empty">fluxo vazio</span>'}</div>
      <div class="gallery-card-foot">
        <div class="gallery-card-info">
          <div class="gallery-card-name">${escapeHtml(f.name)}</div>
          <div class="gallery-card-meta">${nodeCount} bloco${nodeCount!==1?'s':''} · ${laneCount} coluna${laneCount!==1?'s':''}</div>
        </div>
        <button class="gallery-card-del" title="Excluir">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/></svg>
        </button>
      </div>`;
    card.addEventListener('click', e => {
      if (e.target.closest('.gallery-card-del')) return;
      state = JSON.parse(JSON.stringify(f.data));
      if (!state.dividers) state.dividers = [];
      migrateLanes(state);
      const d = loadFlows();
      d.current = f.id;
      saveFlows(d);
      undoStack = []; redoStack = [];
      selection = null;
      renderAll();
      closeGallery();
      toast('Fluxo carregado');
    });
    card.querySelector('.gallery-card-del').onclick = (e) => {
      e.stopPropagation();
      if (!confirm(`Excluir o fluxo "${f.name}"?`)) return;
      const d = loadFlows();
      d.flows = d.flows.filter(x => x.id !== f.id);
      if (d.current === f.id) d.current = null;
      saveFlows(d);
      renderGallery();
      renderFlowList();
    };
    grid.appendChild(card);
  });
}

function openGallery(){ renderGallery(); galleryOverlay.classList.add('show'); }
function closeGallery(){ galleryOverlay.classList.remove('show'); }

document.getElementById('galleryBtn').onclick = openGallery;
document.getElementById('galleryClose').onclick = closeGallery;
galleryOverlay.addEventListener('click', e => {
  if (e.target === galleryOverlay) closeGallery();
});

/* =========================================================
   IMPORT JSON
========================================================= */
document.getElementById('importBtn').onclick = () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json,.json';
  input.onchange = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const obj = JSON.parse(reader.result);
        if (!obj.nodes || !obj.lanes) throw new Error('JSON inválido');
        if (!obj.dividers) obj.dividers = [];
        migrateLanes(obj);
        state = obj;
        undoStack = []; redoStack = [];
        selection = null;
        renderAll();
        toast('Importado');
      } catch(err){
        alert('Arquivo inválido: ' + err.message);
      }
    };
    reader.readAsText(file);
  };
  input.click();
};

/* =========================================================
   ATALHOS
========================================================= */
window.addEventListener('keydown', e => {
  // Esc fecha overlays (têm prioridade)
  if (e.key === 'Escape' && galleryOverlay.classList.contains('show')){
    closeGallery(); return;
  }
  if (e.key === 'Escape' && presentOverlay.classList.contains('show')){
    closePresent(); return;
  }
  // ignora se está digitando em input/textarea
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey){ e.preventDefault(); undo() }
  else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key==='z' && e.shiftKey))){ e.preventDefault(); redo() }
  else if ((e.ctrlKey || e.metaKey) && e.key === 's'){ e.preventDefault(); document.getElementById('saveBtn').click() }
  else if (e.key === 'Delete' || e.key === 'Backspace'){
    if (selection){ e.preventDefault(); deleteSelection() }
  } else if (e.key === 'Escape'){
    selection = null; renderInspector(); renderSelection();
  }
});

document.getElementById('undoBtn').onclick = undo;
document.getElementById('redoBtn').onclick = redo;


function showHint(txt){
  const h = document.getElementById('canvasHint');
  document.getElementById('canvasHintText').textContent = txt;
  h.classList.add('visible');
  setTimeout(() => h.classList.remove('visible'), 4000);
}
