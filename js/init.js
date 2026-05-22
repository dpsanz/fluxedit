/* =========================================================
   MIGRAÇÃO (fluxos antigos: colunas verticais → faixas horizontais)
========================================================= */
function migrateLanes(st){
  if (!st.laneW && st.lanes?.length && st.lanes[0].w !== undefined){
    // old model: each lane has x/y/w, shared laneHeight
    const minX = Math.min(...st.lanes.map(l => l.x));
    const maxX = Math.max(...st.lanes.map(l => l.x + l.w));
    st.laneX = minX;
    st.laneW = maxX - minX;
    const laneH = (st.laneHeight || 600) / st.lanes.length;
    st.lanes.forEach((l, i) => {
      l.y = 60 + i * (laneH + 10);
      l.h = laneH;
      delete l.x; delete l.w;
    });
    delete st.laneHeight;
  }
  if (!st.laneX) st.laneX = 60;
  if (!st.laneW) st.laneW = 1400;
  st.lanes?.forEach(l => { if (!l.h) l.h = 200; });
  st.nodes?.forEach(n => { if (!n.shape) n.shape = 'rect'; });
}

/* =========================================================
   SEED INICIAL (demo)
========================================================= */
function seedDemo(){
  // se há fluxo salvo atual, carrega; senão demo
  const data = loadFlows();
  if (data.current){
    const f = data.flows.find(x => x.id === data.current);
    if (f){ state = JSON.parse(JSON.stringify(f.data)); if (!state.dividers) state.dividers = []; migrateLanes(state); return }
  }
  // demo horizontal: fluxo de desenvolvimento
  const [fase1, fase2, fase3] = state.lanes;
  const lx = (state.laneX ?? 60) + 60;
  state.nodes = [
    { id:uid(), title:'Início',           subtitle:'Demanda recebida',   color:'acc',  shape:'pill',         x:lx,      y:fase1.y+60, w:160 },
    { id:uid(), title:'Análise',          subtitle:'Revisão técnica',    color:'blue', shape:'rect',         x:lx+220,  y:fase1.y+60, w:160 },
    { id:uid(), title:'Aprovado?',        subtitle:'Decisão de prioridade',color:'amb',shape:'diamond',      x:lx+450,  y:fase2.y+55, w:160 },
    { id:uid(), title:'Desenvolvimento',  subtitle:'Implementação',      color:'grn',  shape:'rect',         x:lx+660,  y:fase2.y+60, w:170 },
    { id:uid(), title:'Homologação',      subtitle:'Testes e validação', color:'blue', shape:'hexagon',      x:lx+880,  y:fase3.y+55, w:160 },
    { id:uid(), title:'Entrega',          subtitle:'Deploy em produção', color:'grn',  shape:'pill',         x:lx+1090, y:fase3.y+60, w:150 },
  ];
  state.laneW = Math.max(state.laneW, 1400);
  const [n0,n1,n2,n3,n4,n5] = state.nodes;
  state.edges = [
    { id:uid(), from:n0.id, to:n1.id, fromSide:'r', toSide:'l', color:'neutral', style:'solid' },
    { id:uid(), from:n1.id, to:n2.id, fromSide:'r', toSide:'l', color:'neutral', style:'solid' },
    { id:uid(), from:n2.id, to:n3.id, fromSide:'r', toSide:'l', color:'amb',     style:'solid', label:'aprovado' },
    { id:uid(), from:n3.id, to:n4.id, fromSide:'r', toSide:'l', color:'neutral', style:'solid' },
    { id:uid(), from:n4.id, to:n5.id, fromSide:'r', toSide:'l', color:'grn',     style:'solid' },
  ];
}

/* =========================================================
   INIT
========================================================= */
migrateLanes(state);
seedDemo();
savedStateHash = hashState();
applyTransform();
renderAll();

// força recálculo do tamanho depois do render
setTimeout(() => { renderEdges() }, 50);

// Theme toggle
document.getElementById('themeBtn').onclick = () => {
  const current = document.body.dataset.theme;
  document.body.dataset.theme = current === 'daycoval' ? '' : 'daycoval';
  document.getElementById('themeBtn').title = document.body.dataset.theme === 'daycoval' ? 'Tema padrão' : 'Tema Daycoval';
};

// Snap toggle
const stageBg = document.querySelector('.stage-bg');
function updateSnapBtn(){
  const btn = document.getElementById('snapBtn');
  if (!btn) return;
  btn.classList.toggle('active-toggle', snapEnabled);
  stageBg.classList.toggle('snap-active', snapEnabled);
  btn.title = snapEnabled ? 'Snap ativado (S)' : 'Snap desativado (S)';
}
document.getElementById('snapBtn').onclick = () => {
  snapEnabled = !snapEnabled;
  updateSnapBtn();
};
// 'S' key shortcut for snap
window.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  if (e.key === 's' || e.key === 'S'){
    if (!e.ctrlKey && !e.metaKey){ snapEnabled = !snapEnabled; updateSnapBtn(); }
  }
});
updateSnapBtn();
