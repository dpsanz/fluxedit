/* =========================================================
   ESTADO + MODELO
========================================================= */
const COLORS = [
  { id:'neutral', label:'Neutro',   css:'rgba(255,255,255,.08)' },
  { id:'acc',     label:'Roxo',     css:'#a89dff' },
  { id:'blue',    label:'Azul',     css:'#93c5ff' },
  { id:'grn',     label:'Verde',    css:'#6ee7b7' },
  { id:'amb',     label:'Âmbar',    css:'#f5a623' },
  { id:'red',     label:'Vermelho', css:'#f87880' },
  { id:'pnk',     label:'Rosa',     css:'#f78fb5' },
  { id:'cyn',     label:'Ciano',    css:'#7df0f3' },
  { id:'white',   label:'Branco',   css:'#ffffff' },
];

const ARROW_STYLES = [
  { id:'solid',  label:'Sólida'    },
  { id:'dashed', label:'Tracejada' },
];

const DEFAULT_STATE = () => ({
  name: 'Fluxo sem título',
  lanes: [
    { id: uid(), name: 'Fase 1', color: 'acc',  y: 60,  h: 200 },
    { id: uid(), name: 'Fase 2', color: 'blue', y: 280, h: 200 },
    { id: uid(), name: 'Fase 3', color: 'grn',  y: 500, h: 200 },
  ],
  laneX: 60,
  laneW: 1400,
  nodes: [],
  edges: [],
  dividers: [],
});

function uid(){ return Math.random().toString(36).slice(2,10); }

let state = DEFAULT_STATE();
let snapEnabled = true;
const SNAP_SIZE = 20;
function snapVal(v){ return snapEnabled ? Math.round(v / SNAP_SIZE) * SNAP_SIZE : v; }
let selection = null; // { type:'node'|'edge'|'lane', id }
let zoom = 1;
let pan = { x: 40, y: 30 };
let undoStack = [];
let redoStack = [];
let savedStateHash = null;
function hashState(){ return JSON.stringify(state); }
function markDirty(){
  const isDirty = hashState() !== savedStateHash;
  document.getElementById('saveBtn')?.classList.toggle('btn-dirty', isDirty);
}

const stage = document.getElementById('stage');
const canvasWrap = document.getElementById('canvasWrap');
const edgesSvg = document.getElementById('edgesSvg');
const inspector = document.getElementById('inspector');

/* =========================================================
   HISTÓRICO (undo/redo)
========================================================= */
function syncUndoRedo(){
  const u = document.getElementById('undoBtn');
  const r = document.getElementById('redoBtn');
  if (u) u.style.opacity = undoStack.length ? '1' : '0.3';
  if (r) r.style.opacity = redoStack.length ? '1' : '0.3';
}
function snapshot(){
  undoStack.push(JSON.stringify(state));
  if (undoStack.length > 50) undoStack.shift();
  redoStack = [];
  syncUndoRedo();
  markDirty();
}
function undo(){
  if (!undoStack.length) return;
  redoStack.push(JSON.stringify(state));
  state = JSON.parse(undoStack.pop());
  selection = null;
  renderAll();
  syncUndoRedo();
}
function redo(){
  if (!redoStack.length) return;
  undoStack.push(JSON.stringify(state));
  state = JSON.parse(redoStack.pop());
  selection = null;
  renderAll();
  syncUndoRedo();
}

/* =========================================================
   PERSISTÊNCIA (localStorage)
========================================================= */
const STORAGE_KEY = 'fluxos_v1';

function loadFlows(){
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { flows:[], current:null };
    return JSON.parse(raw);
  } catch { return { flows:[], current:null } }
}
function saveFlows(data){
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)) } catch(e){ console.warn(e) }
}

let toastTimer;
function toast(msg){
  const t = document.getElementById('toast');
  t.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
    <span>${escapeHtml(msg)}</span>`;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 1800);
}

/* =========================================================
   UTILS
========================================================= */
function escapeHtml(s){
  return String(s||'').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}
function escapeAttr(s){ return escapeHtml(s) }
