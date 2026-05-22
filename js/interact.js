/* =========================================================
   ZOOM E PAN
========================================================= */
function applyTransform(){
  stage.style.transform = `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`;
  document.getElementById('zoomLabel').textContent = Math.round(zoom*100)+'%';
}
function setZoom(z, cx, cy){
  const oldZ = zoom;
  zoom = Math.max(0.2, Math.min(2.5, z));
  if (cx !== undefined){
    // zoom relativo ao ponto
    pan.x = cx - (cx - pan.x) * (zoom/oldZ);
    pan.y = cy - (cy - pan.y) * (zoom/oldZ);
  }
  applyTransform();
}

canvasWrap.addEventListener('wheel', e => {
  if (e.ctrlKey || e.metaKey){
    e.preventDefault();
    const rect = canvasWrap.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    setZoom(zoom * (e.deltaY < 0 ? 1.1 : 0.9), cx, cy);
  } else if (e.shiftKey){
    // Shift + scroll = movimento horizontal
    e.preventDefault();
    pan.x -= (e.deltaY || e.deltaX);
    applyTransform();
  } else {
    pan.x -= e.deltaX;
    pan.y -= e.deltaY;
    applyTransform();
  }
}, { passive:false });

// pan com botão do meio ou espaço
let isPanning = false;
let panStart = null;
canvasWrap.addEventListener('mousedown', e => {
  if (!e.target.closest('.node-popup')) closeNodeQuickEdit();
  if (e.target === canvasWrap || e.target.classList.contains('stage-bg')) {
    if (e.button === 0){
      selection = null;
      renderInspector();
      renderSelection();
    }
  }
  if (e.button === 1 || (e.button === 0 && e.altKey)){
    e.preventDefault();
    isPanning = true;
    panStart = { x:e.clientX - pan.x, y:e.clientY - pan.y };
    canvasWrap.style.cursor = 'grabbing';
  }
});
window.addEventListener('mousemove', e => {
  if (isPanning){
    pan.x = e.clientX - panStart.x;
    pan.y = e.clientY - panStart.y;
    applyTransform();
  }
});
window.addEventListener('mouseup', () => {
  if (isPanning){ isPanning = false; canvasWrap.style.cursor = '' }
});

document.getElementById('zoomIn').onclick = () => setZoom(zoom*1.15, canvasWrap.clientWidth/2, canvasWrap.clientHeight/2);
document.getElementById('zoomOut').onclick = () => setZoom(zoom*0.87, canvasWrap.clientWidth/2, canvasWrap.clientHeight/2);
document.getElementById('zoomFit').onclick = () => {
  // ajusta para mostrar todos os nodes
  if (!state.nodes.length && !state.lanes.length){
    zoom = 1; pan = { x:40, y:30 }; applyTransform(); return;
  }
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  const _lx = state.laneX ?? 60;
  const _lw = state.laneW ?? 1400;
  state.lanes.forEach(l => {
    minX = Math.min(minX, _lx);
    minY = Math.min(minY, l.y);
    maxX = Math.max(maxX, _lx + _lw);
    maxY = Math.max(maxY, l.y + l.h);
  });
  state.nodes.forEach(n => {
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + (n.w || 180));
    maxY = Math.max(maxY, n.y + (n.h || 50));
  });
  const pad = 60;
  const w = maxX-minX+pad*2;
  const h = maxY-minY+pad*2;
  const sx = canvasWrap.clientWidth / w;
  const sy = canvasWrap.clientHeight / h;
  zoom = Math.min(sx, sy, 1.5);
  pan.x = -minX*zoom + pad;
  pan.y = -minY*zoom + pad;
  applyTransform();
};

/* =========================================================
   DRAG: nodes e lanes
========================================================= */
let dragState = null;

stage.addEventListener('mousedown', e => {
  const handle = e.target.closest('.handle');
  if (handle){
    // iniciar criação de conexão
    e.stopPropagation();
    const nodeEl = handle.closest('.node');
    const id = nodeEl.dataset.id;
    startConnect(id, handle.dataset.side, e);
    return;
  }
  const laneResize = e.target.closest('[data-lane-resize]');
  if (laneResize){
    e.stopPropagation();
    const id = laneResize.dataset.laneResize;
    const lane = state.lanes.find(l => l.id===id);
    snapshot();
    dragState = { type:'lane-resize', id, startY:e.clientY, startH:lane.h };
    return;
  }
  const divResize = e.target.closest('[data-div-resize]');
  if (divResize){
    e.stopPropagation();
    const id = divResize.dataset.divResize;
    const d = state.dividers.find(x => x.id===id);
    selectDivider(id);
    snapshot();
    dragState = { type:'div-resize', id, startX:e.clientX, startW:d.w };
    return;
  }
  const dividerEl = e.target.closest('.divider');
  if (dividerEl){
    e.stopPropagation();
    const id = dividerEl.dataset.id;
    selectDivider(id);
    const d = state.dividers.find(x => x.id===id);
    snapshot();
    dragState = { type:'divider', id, startX:e.clientX, startY:e.clientY, origX:d.x, origY:d.y };
    return;
  }
  const laneHead = e.target.closest('[data-lane-head]');
  if (laneHead){
    e.stopPropagation();
    const id = laneHead.dataset.laneHead;
    selectLane(id);
    const lane = state.lanes.find(l => l.id===id);
    snapshot();
    dragState = { type:'lane', id, startY:e.clientY, origY:lane.y };
    return;
  }
  const rhEl = e.target.closest('.rh');
  if (rhEl && !e.target.closest('.handle')) {
    const nodeEl = rhEl.closest('.node');
    if (nodeEl) {
      const nodeId = nodeEl.dataset.id;
      const node = state.nodes.find(n => n.id === nodeId);
      if (node) {
        e.stopPropagation();
        dragState = {
          type: 'node-resize',
          id: nodeId,
          axis: rhEl.dataset.rh,
          startX: e.clientX,
          startY: e.clientY,
          startW: node._w || node.w || 180,
          startH: node._h || node.h || 50,
        };
        return;
      }
    }
  }
  const nodeEl = e.target.closest('.node');
  if (nodeEl){
    e.stopPropagation();
    const id = nodeEl.dataset.id;
    selectNode(id);
    const n = state.nodes.find(x => x.id===id);
    snapshot();
    dragState = { type:'node', id, startX:e.clientX, startY:e.clientY, origX:n.x, origY:n.y };
    nodeEl.classList.add('dragging');
    return;
  }
  // click on empty stage area → deselect
  if (e.button === 0 && !e.target.closest('.lane-head') && !e.target.closest('.lane-resize')){
    selection = null;
    renderInspector();
    renderSelection();
  }
});

window.addEventListener('mousemove', e => {
  if (!dragState) return;
  const dx = (e.clientX - dragState.startX) / zoom;
  const dy = (e.clientY - dragState.startY) / zoom;
  if (dragState.type === 'node'){
    const n = state.nodes.find(x => x.id===dragState.id);
    n.x = snapVal(dragState.origX + dx);
    n.y = snapVal(dragState.origY + dy);
    const el = stage.querySelector(`.node[data-id="${n.id}"]`);
    el.style.left = n.x+'px'; el.style.top = n.y+'px';
    renderEdges();
  } else if (dragState.type === 'lane'){
    const l = state.lanes.find(x => x.id===dragState.id);
    l.y = snapVal(dragState.origY + dy);
    const el = stage.querySelector(`.lane[data-id="${l.id}"]`);
    el.style.top = l.y+'px';
  } else if (dragState.type === 'lane-resize'){
    const ddy = (e.clientY - dragState.startY) / zoom;
    const l = state.lanes.find(x => x.id===dragState.id);
    l.h = Math.max(80, dragState.startH + ddy);
    const el = stage.querySelector(`.lane[data-id="${l.id}"]`);
    el.style.height = l.h+'px';
  } else if (dragState.type === 'divider'){
    const d = state.dividers.find(x => x.id===dragState.id);
    d.x = snapVal(dragState.origX + dx);
    d.y = snapVal(dragState.origY + dy);
    const el = stage.querySelector(`.divider[data-id="${d.id}"]`);
    el.style.left = d.x+'px'; el.style.top = d.y+'px';
  } else if (dragState.type === 'div-resize'){
    const ddx = (e.clientX - dragState.startX) / zoom;
    const d = state.dividers.find(x => x.id===dragState.id);
    d.w = Math.max(80, dragState.startW + ddx);
    const el = stage.querySelector(`.divider[data-id="${d.id}"]`);
    el.style.width = d.w+'px';
  } else if (dragState.type === 'node-resize') {
    const node = state.nodes.find(n => n.id === dragState.id);
    if (node) {
      const ddx = (e.clientX - dragState.startX) / zoom;
      const ddy = (e.clientY - dragState.startY) / zoom;
      const axis = dragState.axis;
      if (axis === 'se' || axis === 'e') {
        node.w = Math.max(80, snapVal(dragState.startW + ddx));
      }
      if (axis === 'se' || axis === 's') {
        node.h = Math.max(30, snapVal(dragState.startH + ddy));
      }
      const el = stage.querySelector(`.node[data-id="${node.id}"]`);
      if (el) {
        if (axis === 'se' || axis === 'e') el.style.width = node.w + 'px';
        if (axis === 'se' || axis === 's') el.style.height = node.h + 'px';
      }
      renderEdges();
    }
  }
});
window.addEventListener('mouseup', e => {
  if (dragState){
    if (dragState.type === 'node-resize') snapshot();
    stage.querySelectorAll('.node.dragging').forEach(el => el.classList.remove('dragging'));
    dragState = null;
  }
});

/* =========================================================
   CRIAÇÃO DE CONEXÕES (handles)
========================================================= */
let connectState = null;
function startConnect(fromId, side, e){
  connectState = { fromId, side };
  // cria linha de preview
  const svg = edgesSvg;
  const preview = document.createElementNS('http://www.w3.org/2000/svg','path');
  preview.setAttribute('class','preview-line');
  svg.appendChild(preview);
  connectState.preview = preview;

  function mm(ev){
    const pt = clientToStage(ev.clientX, ev.clientY);
    const src = state.nodes.find(n => n.id===fromId);
    const sBox = nodeBox(src);
    const start = portOnSide(sBox, side);
    const startOut = pushOut(start, side, 18);
    const d = `M ${start.x} ${start.y} L ${startOut.x} ${startOut.y} L ${pt.x} ${pt.y}`;
    preview.setAttribute('d', d);
  }
  function mu(ev){
    window.removeEventListener('mousemove', mm);
    window.removeEventListener('mouseup', mu);
    preview.remove();
    // detectar bloco de destino
    const target = document.elementFromPoint(ev.clientX, ev.clientY);
    const nodeEl = target?.closest('.node');
    if (nodeEl && nodeEl.dataset.id !== fromId){
      const toId = nodeEl.dataset.id;
      // detectar lado mais próximo
      const r = nodeEl.getBoundingClientRect();
      const cx = ev.clientX - r.left;
      const cy = ev.clientY - r.top;
      const fromLeft = cx;
      const fromRight = r.width - cx;
      const fromTop = cy;
      const fromBottom = r.height - cy;
      const min = Math.min(fromLeft, fromRight, fromTop, fromBottom);
      let toSide = 'l';
      if (min === fromRight) toSide = 'r';
      else if (min === fromTop) toSide = 't';
      else if (min === fromBottom) toSide = 'b';

      snapshot();
      const edge = {
        id: uid(),
        from: fromId,
        to: toId,
        fromSide: side,
        toSide,
        color: 'neutral',
        style: 'solid',
      };
      state.edges.push(edge);
      selectEdge(edge.id);
      renderEdges();
    }
    connectState = null;
  }
  window.addEventListener('mousemove', mm);
  window.addEventListener('mouseup', mu);
}

function clientToStage(clientX, clientY){
  const rect = canvasWrap.getBoundingClientRect();
  const x = (clientX - rect.left - pan.x) / zoom;
  const y = (clientY - rect.top - pan.y) / zoom;
  return { x, y };
}

/* =========================================================
   DUPLO CLIQUE: editar título inline
========================================================= */
stage.addEventListener('dblclick', e => {
  const nodeEl = e.target.closest('.node');
  if (nodeEl){
    const id = nodeEl.dataset.id;
    const n = state.nodes.find(x => x.id===id);
    selectNode(id);
    showNodeQuickEdit(n);
    return;
  }
  const laneHead = e.target.closest('[data-lane-head]');
  if (laneHead){
    selectLane(laneHead.dataset.laneHead);
    setTimeout(() => {
      const inp = document.getElementById('i-lname');
      if (inp){ inp.focus(); inp.select(); }
    }, 30);
    return;
  }
  const dividerEl = e.target.closest('.divider');
  if (dividerEl){
    selectDivider(dividerEl.dataset.id);
    setTimeout(() => {
      const inp = document.getElementById('i-dlabel');
      if (inp){ inp.focus(); inp.select(); }
    }, 30);
  }
});

/* =========================================================
   DRAG da biblioteca para o canvas
========================================================= */
document.querySelectorAll('.lib-item').forEach(item => {
  item.addEventListener('mousedown', e => {
    e.preventDefault();
    const color = item.dataset.color;
    const shape = item.dataset.shape || 'rect';
    const ghost = document.createElement('div');
    ghost.style.cssText = `position:fixed;left:${e.clientX-60}px;top:${e.clientY-15}px;
      background:rgba(22,22,29,.95);border:1px solid ${colorVal(color)};
      border-radius:.5rem;padding:.5rem .7rem;font-size:.75rem;font-weight:600;
      color:${colorVal(color)};pointer-events:none;z-index:1000;
      box-shadow:0 4px 18px rgba(0,0,0,.6);`;
    ghost.textContent = 'Novo bloco';
    document.body.appendChild(ghost);

    function mm(ev){
      ghost.style.left = (ev.clientX-60)+'px';
      ghost.style.top = (ev.clientY-15)+'px';
    }
    function mu(ev){
      window.removeEventListener('mousemove', mm);
      window.removeEventListener('mouseup', mu);
      ghost.remove();
      const rect = canvasWrap.getBoundingClientRect();
      if (ev.clientX >= rect.left && ev.clientX <= rect.right &&
          ev.clientY >= rect.top  && ev.clientY <= rect.bottom){
        const pt = clientToStage(ev.clientX, ev.clientY);
        addNode({ color, shape, x: pt.x-60, y: pt.y-15 });
      }
    }
    window.addEventListener('mousemove', mm);
    window.addEventListener('mouseup', mu);
  });
});

function addNode(opts={}){
  snapshot();
  const nodeCount = state.nodes.length + 1;
  state.laneW = Math.max(state.laneW ?? 1400, nodeCount * 180 + 200);
  const defaultTitles = { label:'Título', hline:'', 'arrow-r':'', 'arrow-d':'', 'icon':'' };
  const n = {
    id: uid(),
    title: opts.title ?? (defaultTitles[opts.shape] ?? 'Novo bloco'),
    subtitle: opts.subtitle || '',
    color: opts.color || 'neutral',
    shape: opts.shape || 'rect',
    icon: opts.icon || undefined,
    x: opts.x ?? 200,
    y: opts.y ?? 120,
    w: opts.shape === 'icon' ? 40 : 180,
  };
  state.nodes.push(n);
  selection = { type:'node', id: n.id };
  renderNodes(); renderEdges(); renderInspector();
}

document.getElementById('addLaneBtn').onclick = () => {
  snapshot();
  const lastY = state.lanes.length ? Math.max(...state.lanes.map(l => l.y + (l.h ?? 200))) + 10 : 60;
  const usedColors = state.lanes.map(l => l.color);
  const available = COLORS.find(c => c.id !== 'neutral' && !usedColors.includes(c.id))?.id || 'neutral';
  state.lanes.push({
    id: uid(),
    name: 'Nova faixa',
    color: available,
    y: lastY,
    h: 200,
  });
  renderAll();
};

document.getElementById('addDividerBtn').onclick = () => {
  snapshot();
  if (!state.dividers) state.dividers = [];
  // largura: cobre toda a área das faixas
  const lx = state.laneX ?? 60;
  const lw = state.laneW ?? 1400;
  let x = lx, w = lw;
  // posição vertical: no centro da viewport atual
  const pt = clientToStage(canvasWrap.getBoundingClientRect().left + canvasWrap.clientWidth/2,
                           canvasWrap.getBoundingClientRect().top + canvasWrap.clientHeight/2);
  const d = {
    id: uid(),
    label: 'Nova faixa',
    color: 'neutral',
    style: 'dashed',
    x,
    y: Math.round(pt.y/5)*5,
    w,
  };
  state.dividers.push(d);
  selection = { type:'divider', id: d.id };
  renderDividers(); renderInspector();
  // muda pra aba blocos não é necessário
};
document.querySelectorAll('.lt').forEach(t => {
  t.onclick = () => {
    document.querySelectorAll('.lt').forEach(x => x.classList.remove('active'));
    document.querySelectorAll('.pane').forEach(x => x.classList.remove('active'));
    t.classList.add('active');
    document.querySelector(`.pane[data-pane="${t.dataset.tab}"]`).classList.add('active');
  };
});

// laneW input in lanes pane
document.getElementById('laneWInput').addEventListener('input', e => {
  state.laneW = Math.max(400, parseInt(e.target.value)||1400);
  renderLanes();
});
document.getElementById('laneWInput').addEventListener('change', snapshot);

// Populate symbol library
const iconLibEl = document.getElementById('iconLib');
if (iconLibEl && typeof NODE_ICONS !== 'undefined') {
  Object.entries(NODE_ICONS).forEach(([key, val]) => {
    const item = document.createElement('div');
    item.className = 'lib-item';
    item.dataset.shape = 'icon';
    item.dataset.color = 'neutral';
    item.dataset.icon = key;
    item.innerHTML = `
      <div class="lib-item-shape">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:1.4rem;height:1.4rem">${val.path}</svg>
      </div>
      <div class="lib-item-name">${val.label}</div>
    `;
    iconLibEl.appendChild(item);
    // attach drag handler
    item.addEventListener('mousedown', e => {
      if (e.button !== 0) return;
      e.preventDefault();
      const ghost = item.cloneNode(true);
      ghost.style.cssText = 'position:fixed;opacity:.7;pointer-events:none;z-index:9999;width:60px';
      document.body.appendChild(ghost);
      function mm(ev) {
        ghost.style.left = (ev.clientX - 30) + 'px';
        ghost.style.top  = (ev.clientY - 30) + 'px';
      }
      function mu(ev) {
        window.removeEventListener('mousemove', mm);
        window.removeEventListener('mouseup', mu);
        ghost.remove();
        const rect = canvasWrap.getBoundingClientRect();
        if (ev.clientX >= rect.left && ev.clientX <= rect.right &&
            ev.clientY >= rect.top  && ev.clientY <= rect.bottom) {
          const pt = clientToStage(ev.clientX, ev.clientY);
          addNode({ shape: 'icon', icon: key, color: 'neutral', x: pt.x - 20, y: pt.y - 20 });
        }
      }
      window.addEventListener('mousemove', mm);
      window.addEventListener('mouseup', mu);
    });
  });
}
