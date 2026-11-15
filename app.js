const searchInput = document.querySelector('#search');
const statusSelect = document.querySelector('#status');
const moodSelect = document.querySelector('#mood');
const worksRoot = document.querySelector('#works');
const dialog = document.querySelector('#work-dialog');
let inventory = [];

const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const formOrder = ['Short story','Poem','Novel','Stage play','Stage sketch','Screenplay','Song / lyrics'];
const formName = form => ({'Short story':'Short stories','Poem':'Poetry','Novel':'Novel','Stage play':'Stage','Stage sketch':'Stage','Screenplay':'Screen & audio','Song / lyrics':'Screen & audio'}[form] || form);
function tags(item){return String(item['Subject / mood tags'] || '').split(';').map(s=>s.trim()).filter(Boolean)}
function filtered(){
  const q=searchInput.value.trim().toLocaleLowerCase();
  return inventory.filter(w=>{
    const hay=[w.Title,w.Form,w['Subject / mood tags'],w['Primary mood'],w['Inventory note']].join(' ').toLocaleLowerCase();
    return (!q||hay.includes(q))&&(!statusSelect.value||w['Completion status']===statusSelect.value)&&(!moodSelect.value||tags(w).includes(moodSelect.value));
  });
}
function showWork(w){
  document.querySelector('#dialog-form').textContent=w.Form;
  document.querySelector('#dialog-title').textContent=w.Title;
  document.querySelector('#dialog-meta').textContent=`${w['Completion status']} · ${w['Primary mood'] || 'Mood not tagged'}`;
  document.querySelector('#dialog-tags').textContent=tags(w).join('  ·  ');
  document.querySelector('#dialog-note').textContent=w['Inventory note'] || w['Form detail'] || 'A work in the archive.';
  dialog.showModal();
}
function render(){
  const items=filtered();
  document.querySelector('#result-count').textContent=items.length;
  const groups=new Map();
  for(const item of items){const key=formName(item.Form);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(item)}
  const sorted=[...groups.entries()].sort((a,b)=>{
    const ai=formOrder.findIndex(f=>formName(f)===a[0]),bi=formOrder.findIndex(f=>formName(f)===b[0]);return (ai<0?99:ai)-(bi<0?99:bi);
  });
  if(!items.length){worksRoot.innerHTML='<p class="empty">Nothing in the catalogue matches those filters.</p>';return}
  worksRoot.innerHTML=sorted.map(([form,rows])=>`<section class="form-section"><div class="form-heading"><h3>${esc(form)}</h3><span>${String(rows.length).padStart(2,'0')} ${rows.length===1?'work':'works'}</span></div>${rows.map(w=>`<article class="work-row" tabindex="0" role="button" data-work="${esc(w.Title)}" aria-label="Open ${esc(w.Title)}"><span><span class="work-title">${esc(w.Title)}</span>${w['Form detail']&&w['Form detail']!==w.Form?`<span class="work-sub">${esc(w['Form detail'])}</span>`:''}</span><span class="status ${w['Completion status']==='Incomplete'?'incomplete':''}">${esc(w['Completion status'])}</span><span class="row-arrow" aria-hidden="true">↗</span></article>`).join('')}</section>`).join('');
}
fetch('archive.json').then(r=>{if(!r.ok)throw new Error('Could not load archive');return r.json()}).then(rows=>{
  inventory=rows;
  const options=[...new Set(rows.flatMap(tags))].sort((a,b)=>a.localeCompare(b));
  moodSelect.insertAdjacentHTML('beforeend',options.map(tag=>`<option value="${esc(tag)}">${esc(tag)}</option>`).join(''));
  render();
}).catch(()=>{worksRoot.innerHTML='<p class="empty">The catalogue could not be loaded. Please open the archive through a local web server.</p>'});
for(const el of [searchInput,statusSelect,moodSelect])el.addEventListener('input',render);
document.querySelector('#reset').addEventListener('click',()=>{searchInput.value='';statusSelect.value='';moodSelect.value='';render()});
worksRoot.addEventListener('click',e=>{const row=e.target.closest('[data-work]');if(row){const work=inventory.find(w=>w.Title===row.dataset.work);if(work)showWork(work)}});
worksRoot.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches('[data-work]')){e.preventDefault();const work=inventory.find(w=>w.Title===e.target.dataset.work);if(work)showWork(work)}});
document.querySelector('.dialog-close').addEventListener('click',()=>dialog.close());
dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close()});
document.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();searchInput.focus()}});
