/* =========================================================
   RENDER
========================================================= */
function renderAll(){
  renderLanes();
  renderFlowEndHandle();
  renderDividers();
  renderNodes();
  renderEdges();
  renderInspector();
  renderColumnList();
  renderFlowList();
  document.getElementById('fileName').value = state.name;
  markDirty();
}

function renderDividers(){
  stage.querySelectorAll('.divider').forEach(el => el.remove());
  (state.dividers || []).forEach(div => {
    const el = document.createElement('div');
    el.className = 'divider' + (div.style==='solid'?' divider-solid':'');
    if (selection?.type === 'divider' && selection.id === div.id) el.classList.add('selected');
    el.dataset.color = div.color || 'neutral';
    el.dataset.id = div.id;
    el.style.left = div.x+'px';
    el.style.top = div.y+'px';
    el.style.width = div.w+'px';
    el.innerHTML = `
      <div class="divider-line"></div>
      ${div.label ? `<div class="divider-label" data-div-label="${div.id}">${escapeHtml(div.label)}</div>` : ''}
      <div class="divider-handle" data-div-resize="${div.id}"></div>
    `;
    stage.insertBefore(el, edgesSvg);
  });
}

function renderLanes(){
  stage.querySelectorAll('.lane').forEach(el => el.remove());
  const lx = state.laneX ?? 60;
  const lw = state.laneW ?? 1400;
  state.lanes.forEach(lane => {
    const el = document.createElement('div');
    el.className = 'lane';
    el.dataset.color = lane.color;
    el.dataset.id = lane.id;
    el.style.left = lx+'px';
    el.style.top = lane.y+'px';
    el.style.width = lw+'px';
    el.style.height = lane.h+'px';
    el.innerHTML = `
      <div class="lane-head" data-lane-head="${lane.id}">${escapeHtml(lane.name)}</div>
      <div class="lane-resize" data-lane-resize="${lane.id}"></div>
    `;
    stage.insertBefore(el, edgesSvg);
  });
  // sync laneW input
  const inp = document.getElementById('laneWInput');
  if (inp) inp.value = lw;
}

function renderFlowEndHandle(){
  stage.querySelectorAll('.flow-end-handle').forEach(el => el.remove());
  if (!state.lanes.length) return;
  const lx = state.laneX ?? 60;
  const lw = state.laneW ?? 1400;
  const minY = Math.min(...state.lanes.map(l => l.y));
  const maxY = Math.max(...state.lanes.map(l => l.y + (l.h ?? 200)));
  const el = document.createElement('div');
  el.className = 'flow-end-handle';
  el.title = 'Arrastar para ajustar largura do fluxo';
  el.style.left = (lx + lw - 4) + 'px';
  el.style.top = minY + 'px';
  el.style.height = (maxY - minY) + 'px';
  el.innerHTML = `<div class="flow-end-label">⟵ largura</div>`;
  stage.appendChild(el);

  el.addEventListener('mousedown', e => {
    e.stopPropagation();
    el.classList.add('dragging');
    const startX = e.clientX;
    const startW = state.laneW ?? 1400;
    snapshot();
    function mm(ev){
      const ddx = (ev.clientX - startX) / zoom;
      state.laneW = Math.max(400, Math.round((startW + ddx) / 20) * 20);
      el.style.left = ((state.laneX ?? 60) + state.laneW - 4) + 'px';
      stage.querySelectorAll('.lane').forEach(lane => lane.style.width = state.laneW + 'px');
      const inp = document.getElementById('laneWInput');
      if (inp) inp.value = state.laneW;
    }
    function mu(){
      el.classList.remove('dragging');
      window.removeEventListener('mousemove', mm);
      window.removeEventListener('mouseup', mu);
      renderLanes();
    }
    window.addEventListener('mousemove', mm);
    window.addEventListener('mouseup', mu);
  });
}

function renderNodes(){
  stage.querySelectorAll('.node').forEach(el => el.remove());
  state.nodes.forEach(node => {
    const el = document.createElement('div');
    el.className = 'node';
    if (selection?.type === 'node' && selection.id === node.id) el.classList.add('selected');
    el.dataset.id = node.id;
    el.dataset.color = node.color || 'neutral';
    el.dataset.shape = node.shape || 'rect';
    el.style.left = node.x+'px';
    el.style.top = node.y+'px';
    if (node.w) el.style.width = node.w+'px';

    el.innerHTML = `
      <div class="node-body">
        <div class="node-title">${escapeHtml(node.title || 'Sem título')}</div>
        ${node.subtitle ? `<div class="node-sub">${escapeHtml(node.subtitle)}</div>` : ''}
      </div>
    `;

    if (selection?.type === 'node' && selection.id === node.id){
      el.insertAdjacentHTML('beforeend', `
        <div class="handle t" data-side="t"></div>
        <div class="handle b" data-side="b"></div>
        <div class="handle l" data-side="l"></div>
        <div class="handle r" data-side="r"></div>
      `);
    }
    stage.appendChild(el);
    // custom color override
    if (node.color === '_custom' && node._customColor){
      const nb = el.querySelector('.node-body');
      if (nb){ nb.style.background = node._customColor; nb.style.borderColor = node._customColor; }
    }
  });
  // mede todos de uma vez e renderiza edges uma única vez (evita flicker/concorrência)
  requestAnimationFrame(() => {
    state.nodes.forEach(node => {
      const el = stage.querySelector(`.node[data-id="${node.id}"]`);
      if (el){ node._w = el.offsetWidth; node._h = el.offsetHeight; }
    });
    renderEdges();
  });
}

function renderSelection(){
  // mais leve: só atualiza classes/handles
  stage.querySelectorAll('.node').forEach(el => {
    const id = el.dataset.id;
    el.classList.toggle('selected', selection?.type==='node' && selection.id===id);
    el.querySelectorAll('.handle').forEach(h => h.remove());
    if (selection?.type==='node' && selection.id===id){
      el.insertAdjacentHTML('beforeend', `
        <div class="handle t" data-side="t"></div>
        <div class="handle b" data-side="b"></div>
        <div class="handle l" data-side="l"></div>
        <div class="handle r" data-side="r"></div>
      `);
    }
  });
  // edges
  edgesSvg.querySelectorAll('.edge-path').forEach(p => {
    p.classList.toggle('selected', selection?.type==='edge' && selection.id===p.dataset.id);
  });
  // dividers
  stage.querySelectorAll('.divider').forEach(el => {
    el.classList.toggle('selected', selection?.type==='divider' && selection.id===el.dataset.id);
  });
  // lanes
  stage.querySelectorAll('.lane').forEach(el => {
    el.classList.toggle('lane-selected', selection?.type==='lane' && selection.id===el.dataset.id);
  });
}

function renderEdges(){
  // ensure svg size fits stage
  edgesSvg.setAttribute('width', '5000');
  edgesSvg.setAttribute('height', '3500');
  edgesSvg.innerHTML = `
    <defs>
      ${COLORS.map(c => `
        <marker id="arr-${c.id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="${c.css}"/>
        </marker>
      `).join('')}
    </defs>
  `;

  state.edges.forEach(edge => {
    const src = state.nodes.find(n => n.id === edge.from);
    const dst = state.nodes.find(n => n.id === edge.to);
    if (!src || !dst) return;
    const sBox = nodeBox(src);
    const dBox = nodeBox(dst);

    let srcSide = edge.fromSide;
    let dstSide = edge.toSide;
    if (!srcSide || !dstSide){
      const auto = chooseAutoSides(sBox, dBox);
      srcSide = srcSide || auto[0];
      dstSide = dstSide || auto[1];
    }

    const obs = obstacles([src.id, dst.id]);
    const pts = routeEdge(sBox, srcSide, dBox, dstSide, obs);
    const d = pointsToPath(pts);
    const color = edge.color || 'neutral';
    const dash = edge.style === 'dashed' ? '5 4' : '';
    const stroke = colorVal(color);

    // path invisível pra clique
    const hit = document.createElementNS('http://www.w3.org/2000/svg','path');
    hit.setAttribute('class','edge-hit');
    hit.setAttribute('d', d);
    hit.dataset.id = edge.id;
    hit.addEventListener('click', () => selectEdge(edge.id));
    edgesSvg.appendChild(hit);

    const path = document.createElementNS('http://www.w3.org/2000/svg','path');
    path.setAttribute('class','edge-path');
    if (selection?.type==='edge' && selection.id===edge.id) path.classList.add('selected');
    path.setAttribute('d', d);
    path.setAttribute('stroke', stroke);
    path.setAttribute('marker-end', `url(#arr-${color})`);
    if (dash) path.setAttribute('stroke-dasharray', dash);
    path.dataset.id = edge.id;
    path.addEventListener('click', () => selectEdge(edge.id));
    edgesSvg.appendChild(path);

    // label
    if (edge.label){
      // pega ponto do meio do caminho
      const midIdx = Math.floor(pts.length/2);
      const a = pts[midIdx-1] || pts[0];
      const b = pts[midIdx] || pts[pts.length-1];
      const mx = (a.x+b.x)/2;
      const my = (a.y+b.y)/2;
      const text = document.createElementNS('http://www.w3.org/2000/svg','text');
      text.setAttribute('class','edge-label');
      text.setAttribute('x', mx);
      text.setAttribute('y', my);
      text.setAttribute('text-anchor','middle');
      text.setAttribute('dominant-baseline','middle');
      text.setAttribute('fill', stroke);
      text.textContent = edge.label;
      // mede background
      edgesSvg.appendChild(text);
      const bb = text.getBBox();
      const bg = document.createElementNS('http://www.w3.org/2000/svg','rect');
      bg.setAttribute('class','edge-label-bg');
      bg.setAttribute('x', bb.x - 4);
      bg.setAttribute('y', bb.y - 2);
      bg.setAttribute('width', bb.width + 8);
      bg.setAttribute('height', bb.height + 4);
      bg.setAttribute('rx', 3);
      edgesSvg.insertBefore(bg, text);
    }
  });
}

/* =========================================================
   SELEÇÃO + INSPECTOR
========================================================= */
function selectNode(id){
  selection = { type:'node', id };
  renderSelection();
  renderInspector();
}
function selectEdge(id){
  selection = { type:'edge', id };
  renderSelection();
  renderInspector();
}
function selectLane(id){
  selection = { type:'lane', id };
  renderSelection();
  renderInspector();
}
function selectDivider(id){
  selection = { type:'divider', id };
  renderSelection();
  renderInspector();
}

function renderInspector(){
  if (!selection){
    inspector.innerHTML = `
      <div class="insp-empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2l2 7h7l-5.5 4 2 7L12 16l-5.5 4 2-7L3 9h7z"/>
        </svg>
        <div>Selecione um bloco, seta ou coluna no canvas pra ver as opções de edição.</div>
      </div>`;
    return;
  }
  if (selection.type === 'node'){
    const n = state.nodes.find(x => x.id===selection.id);
    if (!n) return;
    inspector.innerHTML = `
      <div class="insp-group">
        <div class="insp-label">Título</div>
        <input class="insp-input" id="i-title" value="${escapeAttr(n.title || '')}"/>
      </div>
      <div class="insp-group">
        <div class="insp-label">Legenda (subtítulo)</div>
        <textarea class="insp-textarea" id="i-sub" placeholder="Texto curto explicando o bloco...">${escapeHtml(n.subtitle || '')}</textarea>
      </div>
      <div class="insp-group">
        <div class="insp-label">Cor do bloco</div>
        <div class="swatches">
          ${COLORS.map(c => `
            <div class="sw ${n.color===c.id?'active':''}"
                 style="background:${c.css};${c.id==='neutral'?'border-color:#666;':''}"
                 data-color="${c.id}"
                 title="${c.label}"></div>`).join('')}
        </div>
        <div style="display:flex;gap:.4rem;margin-top:.4rem;align-items:center">
          <input type="color" id="i-colorpicker" value="${n._customColor||'#a89dff'}"
            style="width:2rem;height:2rem;border:none;border-radius:.3rem;cursor:pointer;background:none;padding:0;flex-shrink:0"/>
          <input class="insp-input" id="i-colorhex" placeholder="#hex ou rgb(...)"
            value="${n._customColor||''}" style="flex:1;font-size:.72rem;font-family:monospace"/>
        </div>
      </div>
      <div class="insp-group">
        <div class="insp-label">Forma</div>
        <select class="insp-select" id="i-shape">
          <option value="rect" ${(n.shape||'rect')==='rect'?'selected':''}>Retângulo</option>
          <option value="pill" ${n.shape==='pill'?'selected':''}>Pílula</option>
          <option value="diamond" ${n.shape==='diamond'?'selected':''}>Decisão (losango)</option>
          <option value="circle" ${n.shape==='circle'?'selected':''}>Círculo</option>
          <option value="hexagon" ${n.shape==='hexagon'?'selected':''}>Hexágono</option>
          <option value="parallelogram" ${n.shape==='parallelogram'?'selected':''}>Paralelogramo</option>
        </select>
      </div>
      <div class="insp-group">
        <div class="insp-label">Largura</div>
        <input class="insp-input" type="number" min="120" max="320" id="i-w" value="${n.w || 180}"/>
      </div>
      <div class="insp-group">
        <div class="insp-label">Ações</div>
        <div class="insp-actions">
          <button class="insp-btn" id="i-dup">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            Duplicar
          </button>
          <button class="insp-btn insp-btn-danger" id="i-del">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
            Excluir
          </button>
        </div>
      </div>
    `;
    // bindings
    document.getElementById('i-title').addEventListener('input', e => {
      n.title = e.target.value;
      renderNodes(); renderSelection();
    });
    document.getElementById('i-title').addEventListener('change', snapshot);
    document.getElementById('i-sub').addEventListener('input', e => {
      n.subtitle = e.target.value;
      renderNodes(); renderSelection();
    });
    document.getElementById('i-sub').addEventListener('change', snapshot);
    document.getElementById('i-w').addEventListener('input', e => {
      n.w = parseInt(e.target.value);
      renderNodes(); renderSelection();
    });
    document.getElementById('i-w').addEventListener('change', snapshot);
    // custom color picker
    const picker = document.getElementById('i-colorpicker');
    const hexInp = document.getElementById('i-colorhex');
    function applyCustomColor(val){
      n._customColor = val;
      n.color = '_custom';
      const nb = stage.querySelector(`.node[data-id="${n.id}"] .node-body`);
      if (nb){ nb.style.background = val; nb.style.borderColor = val; }
      inspector.querySelectorAll('.sw').forEach(s => s.classList.remove('active'));
    }
    picker.addEventListener('input', e => applyCustomColor(e.target.value));
    picker.addEventListener('change', snapshot);
    hexInp.addEventListener('change', e => {
      const v = e.target.value.trim();
      if (v){ picker.value = v.startsWith('#') ? v : '#888888'; applyCustomColor(v); snapshot(); }
    });
    document.getElementById('i-shape').addEventListener('change', e => {
      snapshot(); n.shape = e.target.value;
      renderNodes(); renderSelection();
    });
    inspector.querySelectorAll('.sw').forEach(sw => {
      sw.addEventListener('click', () => {
        snapshot();
        n.color = sw.dataset.color;
        renderNodes(); renderSelection(); renderInspector();
      });
    });
    document.getElementById('i-dup').onclick = () => {
      snapshot();
      const copy = { ...n, id: uid(), x: n.x+20, y: n.y+20 };
      state.nodes.push(copy);
      selection = { type:'node', id: copy.id };
      renderNodes(); renderEdges(); renderInspector();
    };
    document.getElementById('i-del').onclick = () => deleteSelection();
  }
  else if (selection.type === 'edge'){
    const e = state.edges.find(x => x.id===selection.id);
    if (!e) return;
    inspector.innerHTML = `
      <div class="insp-group">
        <div class="insp-label">Legenda da seta</div>
        <input class="insp-input" id="i-elabel" value="${escapeAttr(e.label || '')}" placeholder="Ex: aprovado, rejeitado..."/>
      </div>
      <div class="insp-group">
        <div class="insp-label">Estilo</div>
        <div class="arrow-styles">
          ${ARROW_STYLES.map(s => `
            <div class="as-item ${e.style===s.id || (!e.style && s.id==='solid')?'active':''}" data-style="${s.id}">
              <svg viewBox="0 0 60 12">
                <line x1="2" y1="6" x2="58" y2="6" stroke="currentColor" stroke-width="1.6"
                  ${s.id==='dashed'?'stroke-dasharray="5 4"':''}/>
                <polygon points="56,3 60,6 56,9" fill="currentColor"/>
              </svg>
            </div>
          `).join('')}
        </div>
      </div>
      <div class="insp-group">
        <div class="insp-label">Cor</div>
        <div class="swatches">
          ${COLORS.map(c => `
            <div class="sw ${(e.color||'neutral')===c.id?'active':''}"
                 style="background:${c.css};${c.id==='neutral'?'border-color:#666;':''}"
                 data-color="${c.id}"
                 title="${c.label}"></div>`).join('')}
        </div>
      </div>
      <div class="insp-group">
        <div class="insp-label">Origem · saída</div>
        <select class="insp-select" id="i-fromSide">
          <option value="">Automático</option>
          <option value="t" ${e.fromSide==='t'?'selected':''}>Topo</option>
          <option value="b" ${e.fromSide==='b'?'selected':''}>Base</option>
          <option value="l" ${e.fromSide==='l'?'selected':''}>Esquerda</option>
          <option value="r" ${e.fromSide==='r'?'selected':''}>Direita</option>
        </select>
      </div>
      <div class="insp-group">
        <div class="insp-label">Destino · entrada</div>
        <select class="insp-select" id="i-toSide">
          <option value="">Automático</option>
          <option value="t" ${e.toSide==='t'?'selected':''}>Topo</option>
          <option value="b" ${e.toSide==='b'?'selected':''}>Base</option>
          <option value="l" ${e.toSide==='l'?'selected':''}>Esquerda</option>
          <option value="r" ${e.toSide==='r'?'selected':''}>Direita</option>
        </select>
      </div>
      <div class="insp-group">
        <div class="insp-actions">
          <button class="insp-btn insp-btn-danger" id="i-edel">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/></svg>
            Excluir seta
          </button>
        </div>
      </div>
    `;
    document.getElementById('i-elabel').addEventListener('input', ev => { e.label = ev.target.value; renderEdges() });
    document.getElementById('i-elabel').addEventListener('change', snapshot);
    inspector.querySelectorAll('.sw').forEach(sw => sw.onclick = () => { snapshot(); e.color = sw.dataset.color; renderEdges(); renderInspector() });
    inspector.querySelectorAll('.as-item').forEach(it => it.onclick = () => { snapshot(); e.style = it.dataset.style; renderEdges(); renderInspector() });
    document.getElementById('i-fromSide').onchange = ev => { snapshot(); e.fromSide = ev.target.value || null; renderEdges() };
    document.getElementById('i-toSide').onchange = ev => { snapshot(); e.toSide = ev.target.value || null; renderEdges() };
    document.getElementById('i-edel').onclick = () => deleteSelection();
  }
  else if (selection.type === 'lane'){
    const l = state.lanes.find(x => x.id===selection.id);
    if (!l) return;
    inspector.innerHTML = `
      <div class="insp-group">
        <div class="insp-label">Nome da faixa</div>
        <input class="insp-input" id="i-lname" value="${escapeAttr(l.name)}"/>
      </div>
      <div class="insp-group">
        <div class="insp-label">Cor</div>
        <div class="swatches">
          ${COLORS.map(c => `
            <div class="sw ${l.color===c.id?'active':''}"
                 style="background:${c.css};${c.id==='neutral'?'border-color:#666;':''}"
                 data-color="${c.id}"
                 title="${c.label}"></div>`).join('')}
        </div>
      </div>
      <div class="insp-group">
        <div class="insp-label">Altura da faixa</div>
        <input class="insp-input" type="number" min="80" max="800" id="i-lh" value="${l.h ?? 200}"/>
      </div>
      <div class="insp-group">
        <div class="insp-label">Largura do fluxo (todas as faixas)</div>
        <input class="insp-input" type="number" min="400" max="4000" step="100" id="i-lw" value="${state.laneW ?? 1400}"/>
      </div>
      <div class="insp-group">
        <div class="insp-actions">
          <button class="insp-btn insp-btn-danger" id="i-ldel">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/></svg>
            Excluir faixa
          </button>
        </div>
      </div>
    `;
    document.getElementById('i-lname').addEventListener('input', e => { l.name = e.target.value; renderLanes(); renderColumnList() });
    document.getElementById('i-lname').addEventListener('change', snapshot);
    document.getElementById('i-lh').addEventListener('input', e => { l.h = parseInt(e.target.value)||80; renderLanes() });
    document.getElementById('i-lh').addEventListener('change', snapshot);
    document.getElementById('i-lw').addEventListener('input', e => { state.laneW = Math.max(400, parseInt(e.target.value)||1400); renderLanes() });
    document.getElementById('i-lw').addEventListener('change', snapshot);
    inspector.querySelectorAll('.sw').forEach(sw => sw.onclick = () => { snapshot(); l.color = sw.dataset.color; renderLanes(); renderInspector(); renderColumnList() });
    document.getElementById('i-ldel').onclick = () => {
      snapshot();
      state.lanes = state.lanes.filter(x => x.id !== l.id);
      selection = null;
      renderAll();
    };
  }
  else if (selection.type === 'divider'){
    const d = state.dividers.find(x => x.id===selection.id);
    if (!d) return;
    inspector.innerHTML = `
      <div class="insp-group">
        <div class="insp-label">Legenda da linha</div>
        <input class="insp-input" id="i-dlabel" value="${escapeAttr(d.label || '')}" placeholder="Ex: Fase 1, Sprint A..."/>
      </div>
      <div class="insp-group">
        <div class="insp-label">Estilo</div>
        <div class="arrow-styles">
          ${ARROW_STYLES.map(s => `
            <div class="as-item ${(d.style||'dashed')===s.id?'active':''}" data-style="${s.id}">
              <svg viewBox="0 0 60 12">
                <line x1="2" y1="6" x2="58" y2="6" stroke="currentColor" stroke-width="1.6"
                  ${s.id==='dashed'?'stroke-dasharray="5 4"':''}/>
              </svg>
            </div>
          `).join('')}
        </div>
      </div>
      <div class="insp-group">
        <div class="insp-label">Cor</div>
        <div class="swatches">
          ${COLORS.map(c => `
            <div class="sw ${(d.color||'neutral')===c.id?'active':''}"
                 style="background:${c.css};${c.id==='neutral'?'border-color:#666;':''}"
                 data-color="${c.id}" title="${c.label}"></div>`).join('')}
        </div>
      </div>
      <div class="insp-group">
        <div class="insp-label">Largura</div>
        <input class="insp-input" type="number" min="80" max="3000" id="i-dw" value="${Math.round(d.w)}"/>
      </div>
      <div class="insp-group">
        <div class="insp-actions">
          <button class="insp-btn" id="i-dfit">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/></svg>
            Ajustar às colunas
          </button>
          <button class="insp-btn insp-btn-danger" id="i-ddel">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/></svg>
            Excluir
          </button>
        </div>
      </div>
    `;
    document.getElementById('i-dlabel').addEventListener('input', e => { d.label = e.target.value; renderDividers(); renderSelection() });
    document.getElementById('i-dlabel').addEventListener('change', snapshot);
    document.getElementById('i-dw').addEventListener('input', e => { d.w = parseInt(e.target.value)||80; renderDividers(); renderSelection() });
    document.getElementById('i-dw').addEventListener('change', snapshot);
    inspector.querySelectorAll('.sw').forEach(sw => sw.onclick = () => { snapshot(); d.color = sw.dataset.color; renderDividers(); renderSelection(); renderInspector() });
    inspector.querySelectorAll('.as-item').forEach(it => it.onclick = () => { snapshot(); d.style = it.dataset.style; renderDividers(); renderSelection(); renderInspector() });
    document.getElementById('i-dfit').onclick = () => {
      snapshot();
      d.x = state.laneX ?? 60;
      d.w = state.laneW ?? 1400;
      renderDividers(); renderSelection(); renderInspector();
    };
    document.getElementById('i-ddel').onclick = () => deleteSelection();
  }
}

function deleteSelection(){
  if (!selection) return;
  closeNodeQuickEdit();
  snapshot();
  if (selection.type === 'node'){
    state.nodes = state.nodes.filter(n => n.id !== selection.id);
    state.edges = state.edges.filter(e => e.from !== selection.id && e.to !== selection.id);
  } else if (selection.type === 'edge'){
    state.edges = state.edges.filter(e => e.id !== selection.id);
  } else if (selection.type === 'lane'){
    state.lanes = state.lanes.filter(l => l.id !== selection.id);
  } else if (selection.type === 'divider'){
    state.dividers = state.dividers.filter(d => d.id !== selection.id);
  }
  selection = null;
  renderAll();
}

/* =========================================================
   PAINEL DE COLUNAS
========================================================= */
function renderColumnList(){
  const list = document.getElementById('colList');
  list.innerHTML = '';
  state.lanes.forEach(lane => {
    const row = document.createElement('div');
    row.className = 'col-row';
    row.innerHTML = `
      <span class="col-row-dot" style="background:${colorVal(lane.color)}"></span>
      <input class="col-row-name" value="${escapeAttr(lane.name)}"/>
      <button class="col-row-del" title="Remover coluna">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/></svg>
      </button>
    `;
    const inp = row.querySelector('.col-row-name');
    inp.addEventListener('input', e => { lane.name = e.target.value; renderLanes() });
    inp.addEventListener('change', snapshot);
    inp.addEventListener('focus', () => selectLane(lane.id));
    row.querySelector('.col-row-dot').addEventListener('click', () => selectLane(lane.id));
    row.querySelector('.col-row-del').onclick = () => {
      snapshot();
      state.lanes = state.lanes.filter(l => l.id !== lane.id);
      if (selection?.type==='lane' && selection.id===lane.id) selection = null;
      renderAll();
    };
    list.appendChild(row);
  });
}

function renderFlowList(){
  const data = loadFlows();
  const list = document.getElementById('flowList');
  list.innerHTML = '';
  if (!data.flows.length){
    list.innerHTML = `<div style="font-size:.7rem;color:var(--mut);text-align:center;padding:.8rem 0">Nenhum fluxo salvo ainda</div>`;
    return;
  }
  data.flows.forEach(f => {
    const item = document.createElement('div');
    item.className = 'flow-item';
    if (f.id === data.current) item.classList.add('current');
    item.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" style="width:.85rem;height:.85rem;color:var(--mut);flex-shrink:0">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
      </svg>
      <span class="flow-item-name">${escapeHtml(f.name)}</span>
      <button class="flow-item-del" title="Excluir">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/></svg>
      </button>
    `;
    item.addEventListener('click', e => {
      if (e.target.closest('.flow-item-del')) return;
      // carrega
      state = JSON.parse(JSON.stringify(f.data));
      if (!state.dividers) state.dividers = [];
      migrateLanes(state);
      data.current = f.id;
      saveFlows(data);
      undoStack = []; redoStack = [];
      selection = null;
      renderAll();
      toast('Fluxo carregado');
    });
    item.querySelector('.flow-item-del').onclick = (e) => {
      e.stopPropagation();
      if (!confirm(`Excluir o fluxo "${f.name}"?`)) return;
      data.flows = data.flows.filter(x => x.id !== f.id);
      if (data.current === f.id) data.current = null;
      saveFlows(data);
      renderFlowList();
    };
    list.appendChild(item);
  });
}

function showNodeQuickEdit(node){
  closeNodeQuickEdit();
  const popup = document.createElement('div');
  popup.className = 'node-popup';
  popup.id = 'nodePopup';
  const nH = node._h || 50;
  popup.style.left = node.x + 'px';
  popup.style.top = (node.y + nH + 10) + 'px';
  const shapes = [
    {id:'rect',          label:'Retângulo',   path:'<rect x="2" y="5" width="36" height="14" rx="2" fill="currentColor"/>'},
    {id:'pill',          label:'Pílula',      path:'<rect x="2" y="5" width="36" height="14" rx="7" fill="currentColor"/>'},
    {id:'diamond',       label:'Decisão',     path:'<polygon points="20,2 38,10 20,18 2,10" fill="currentColor"/>'},
    {id:'circle',        label:'Círculo',     path:'<circle cx="20" cy="10" r="8" fill="currentColor"/>'},
    {id:'hexagon',       label:'Hexágono',    path:'<polygon points="10,2 30,2 38,10 30,18 10,18 2,10" fill="currentColor"/>'},
    {id:'parallelogram', label:'Paral.',      path:'<polygon points="8,2 38,2 32,18 2,18" fill="currentColor"/>'},
  ];
  popup.innerHTML = `
    <div class="node-popup-title">Forma · tamanho</div>
    <div class="node-popup-shapes">
      ${shapes.map(s => `
        <button class="nps-btn ${(node.shape||'rect')===s.id?'active':''}" data-shape="${s.id}">
          <svg viewBox="0 0 40 20">${s.path}</svg>
          ${s.label}
        </button>`).join('')}
    </div>
    <div class="node-popup-row">
      <span class="node-popup-label">Largura</span>
      <input type="range" class="node-popup-slider" id="npwSlider" min="120" max="300" step="10" value="${node.w||180}"/>
      <span class="node-popup-val" id="npwVal">${node.w||180}px</span>
    </div>
  `;
  stage.appendChild(popup);
  popup.querySelectorAll('.nps-btn').forEach(btn => {
    btn.addEventListener('click', ev => {
      ev.stopPropagation();
      snapshot();
      node.shape = btn.dataset.shape;
      popup.querySelectorAll('.nps-btn').forEach(b => b.classList.toggle('active', b.dataset.shape===node.shape));
      renderNodes(); renderSelection(); renderInspector();
      // reposition popup after re-render
      const el = stage.querySelector(`.node[data-id="${node.id}"]`);
      if (el) popup.style.top = (node.y + el.offsetHeight + 10) + 'px';
    });
  });
  document.getElementById('npwSlider').addEventListener('input', ev => {
    node.w = parseInt(ev.target.value);
    document.getElementById('npwVal').textContent = node.w + 'px';
    const el = stage.querySelector(`.node[data-id="${node.id}"]`);
    if (el){ el.style.width = node.w + 'px'; renderEdges(); }
  });
  document.getElementById('npwSlider').addEventListener('change', snapshot);
}
function closeNodeQuickEdit(){
  document.getElementById('nodePopup')?.remove();
}
