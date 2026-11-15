const searchInput = document.querySelector('#search');
const statusSelect = document.querySelector('#status');
const moodSelect = document.querySelector('#mood');
const worksRoot = document.querySelector('#works');
const reader = document.querySelector('#reader-layer');
let inventory = [];
let fullText = {};
let previousFocus = null;

const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const formOrder = ['Short story','Poem','Novel','Stage play','Stage sketch','Screenplay','Song / lyrics'];
const formName = form => ({'Short story':'Short stories','Poem':'Poetry','Novel':'Novel','Stage play':'Stage','Stage sketch':'Stage','Screenplay':'Screen & audio','Song / lyrics':'Screen & audio'}[form] || form);
const tags = item => String(item['Subject / mood tags'] || '').split(';').map(s => s.trim()).filter(Boolean);
function filtered(){
  const q=searchInput.value.trim().toLocaleLowerCase();
  return inventory.filter(w=>{
    const hay=[w.Title,w.Form,w['Subject / mood tags']].join(' ').toLocaleLowerCase();
    return (!q||hay.includes(q))&&(!statusSelect.value||w['Completion status']===statusSelect.value)&&(!moodSelect.value||tags(w).includes(moodSelect.value));
  });
}
function openWork(w, updateHistory=true){
  previousFocus=document.activeElement;
  document.querySelector('#reader-form').textContent=w.Form;
  document.querySelector('#reader-title').textContent=w.Title;
  const status=document.querySelector('#reader-status');
  status.textContent=w['Completion status'];
  status.classList.toggle('incomplete',w['Completion status']==='Incomplete');
  document.querySelector('#reader-tags').textContent=w['Primary mood'] || tags(w).join(' · ');
  const full=fullText[`${w.Title}||${w.Form}`];
  document.querySelector('#reader-body').textContent=full?.text || '';
  document.querySelector('#reader-body').hidden=!full;
  document.querySelector('#reader-unavailable').hidden=!!full;
  reader.hidden=false;
  reader.setAttribute('aria-hidden','false');
  document.body.classList.add('reading');
  if(updateHistory)history.pushState({work:`${w.Title}||${w.Form}`},'',`#read/${encodeURIComponent(w.Title)}`);
  document.querySelector('#reader-back').focus();
  window.scrollTo(0,0);
}
function closeReader(updateHistory=true){
  if(reader.hidden)return;
  reader.hidden=true;
  reader.setAttribute('aria-hidden','true');
  document.body.classList.remove('reading');
  if(updateHistory&&location.hash.startsWith('#read/'))history.back();
  else if(previousFocus?.focus)previousFocus.focus();
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
  worksRoot.innerHTML=sorted.map(([form,rows])=>`<section class="form-section"><div class="form-heading"><h3>${esc(form)}</h3><span>${String(rows.length).padStart(2,'0')} ${rows.length===1?'work':'works'}</span></div>${rows.map((w,i)=>`<button class="work-row" type="button" data-form="${esc(w.Form)}" data-work="${esc(w.Title)}"><span class="work-title">${esc(w.Title)}</span><span class="work-labels"><span class="status ${w['Completion status']==='Incomplete'?'incomplete':''}">${esc(w['Completion status'])}</span><span class="work-mood">${esc(w['Primary mood'] || tags(w).join(' · '))}</span></span><span class="row-arrow" aria-hidden="true">↗</span></button>`).join('')}</section>`).join('');
}
Promise.all([fetch('archive.json'),fetch('writing-content.json')]).then(async ([catalogue,content])=>{
  if(!catalogue.ok||!content.ok)throw new Error('Could not load archive files');
  return [await catalogue.json(),await content.json()];
}).then(([rows,writing])=>{
  inventory=rows.filter(w=>w.Title!=='Bathroom. Breakdown. Pause:'); fullText=writing;
  document.querySelector('#result-count').textContent=inventory.length;
  const options=[...new Set(inventory.flatMap(tags))].sort((a,b)=>a.localeCompare(b));
  moodSelect.insertAdjacentHTML('beforeend',options.map(tag=>`<option value="${esc(tag)}">${esc(tag)}</option>`).join(''));
  render();
  const match=location.hash.startsWith('#read/')&&inventory.find(w=>decodeURIComponent(location.hash.slice(6))===w.Title);
  if(match)openWork(match,false);
}).catch(()=>{worksRoot.innerHTML='<p class="empty">The catalogue could not be loaded. Please open the archive through a local web server.</p>'});
for(const el of [searchInput,statusSelect,moodSelect])el.addEventListener('input',render);
document.querySelector('#reset').addEventListener('click',()=>{searchInput.value='';statusSelect.value='';moodSelect.value='';render()});
worksRoot.addEventListener('click',e=>{const row=e.target.closest('[data-work]');if(row){const work=inventory.find(w=>w.Title===row.dataset.work&&w.Form===row.dataset.form);if(work)openWork(work)}});
document.querySelector('#reader-back').addEventListener('click',()=>closeReader());
window.addEventListener('popstate',()=>{if(location.hash.startsWith('#read/')){const work=inventory.find(w=>decodeURIComponent(location.hash.slice(6))===w.Title);if(work)openWork(work,false)}else closeReader(false)});
document.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();searchInput.focus()}if(e.key==='Escape'&&!reader.hidden)closeReader()});
