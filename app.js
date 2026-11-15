const searchInput = document.querySelector('#search');
const statusSelect = document.querySelector('#status');
const moodSelect = document.querySelector('#mood');
const worksRoot = document.querySelector('#works');
const categoryNav = document.querySelector('#category-nav');
const reader = document.querySelector('#reader-layer');
const categories = ['Short story','Poetry','Novel','Play','Script'];
const categoryMap = {'Short story':'Short story','Poem':'Poetry','Novel':'Novel','Stage play':'Play','Stage sketch':'Play','Screenplay':'Script','Song / lyrics':'Script','Prose fiction — form unclear':'Short story','Essay / prose fragment':'Short story'};
const relatedRoot = document.querySelector('#related-works');
const ratingRoot = document.querySelector('#rating-control');
let activeRatingWorkId = '';
let activeUserRating = 0;
let fallbackVoterId = '';
let inventory = [];
let fullText = {};
let activeCategory = '';
let previousFocus = null;

const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const categoryOf = item => item.Category || categoryMap[item.Form] || 'Short story';
const tags = item => String(item['Subject / mood tags'] || '').split(';').map(s => s.trim()).filter(Boolean);
function relatedWorks(work){
  const ownTags=new Set(tags(work));
  return inventory.filter(candidate=>candidate!==work).map(candidate=>{
    const shared=tags(candidate).filter(tag=>ownTags.has(tag)).length;
    const score=shared*3+(candidate['Primary mood']===work['Primary mood']?2:0)+(categoryOf(candidate)===categoryOf(work)?1.5:0)+(candidate.Form===work.Form?1:0);
    return {work:candidate,score};
  }).sort((a,b)=>b.score-a.score||a.work.Title.localeCompare(b.work.Title)).slice(0,Math.min(3,inventory.length-1)).map(result=>result.work);
}
function getVoterId(){
  try{
    let id=localStorage.getItem('tiwa-rating-voter');
    if(!id){id=crypto.randomUUID();localStorage.setItem('tiwa-rating-voter',id)}
    return id;
  }catch(_){if(!fallbackVoterId)fallbackVoterId=crypto.randomUUID();return fallbackVoterId}
}
function showRating(data){
  if(data.work_id!==activeRatingWorkId)return;
  activeUserRating=Number(data.your_rating||0);
  document.querySelector('#rating-summary').textContent=data.count?`${Number(data.average).toFixed(1)} / 5 · ${data.count} ${data.count===1?'rating':'ratings'}`:'No ratings yet';
  paintRating(activeUserRating);
}
function paintRating(score){
  ratingRoot.querySelectorAll('[data-score]').forEach(button=>{
    const selected=Number(button.dataset.score)<=score;
    button.classList.toggle('selected',selected);
    button.setAttribute('aria-pressed',String(Number(button.dataset.score)===activeUserRating));
  });
}
async function loadRating(workId){
  activeRatingWorkId=workId;
  const summary=document.querySelector('#rating-summary');
  const message=document.querySelector('#rating-message');
  summary.textContent='Loading ratings…';message.textContent='';
  activeUserRating=0;
  ratingRoot.querySelectorAll('button').forEach(button=>{button.disabled=false;button.classList.remove('selected');button.setAttribute('aria-pressed','false')});
  try{
    const query=new URLSearchParams({work_id:workId,voter_id:getVoterId()});
    const response=await fetch(`/api/ratings?${query}`,{cache:'no-store'});
    if(!response.ok)throw new Error('Ratings unavailable');
    showRating(await response.json());
  }catch(_){if(activeRatingWorkId===workId){summary.textContent='Ratings are temporarily unavailable';message.textContent='Please try again later.'}}
}
async function submitRating(score){
  const workId=activeRatingWorkId;
  if(!workId)return;
  const buttons=[...ratingRoot.querySelectorAll('button')];
  buttons.forEach(button=>button.disabled=true);
  document.querySelector('#rating-message').textContent='Saving your rating…';
  try{
    const response=await fetch('/api/ratings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({work_id:workId,voter_id:getVoterId(),score})});
    if(!response.ok)throw new Error('Rating could not be saved');
    const data=await response.json();
    if(workId!==activeRatingWorkId)return;
    showRating(data);
    document.querySelector('#rating-message').textContent='Your rating is saved. You can change it anytime.';
  }catch(_){if(workId===activeRatingWorkId)document.querySelector('#rating-message').textContent='Could not save your rating. Please try again.'}
  finally{if(workId===activeRatingWorkId)buttons.forEach(button=>button.disabled=false)}
}
function filtered(){
  const q=searchInput.value.trim().toLocaleLowerCase();
  return inventory.filter(w=>{
    const hay=[w.Title,w.Form,w['Subject / mood tags']].join(' ').toLocaleLowerCase();
    return (!activeCategory||categoryOf(w)===activeCategory)&&(!q||hay.includes(q))&&(!statusSelect.value||w['Completion status']===statusSelect.value)&&(!moodSelect.value||tags(w).includes(moodSelect.value));
  });
}
function renderCategoryNav(){
  const counts=Object.fromEntries(categories.map(category=>[category,inventory.filter(w=>categoryOf(w)===category).length]));
  categoryNav.innerHTML=categories.map(category=>`<button class="category-card ${activeCategory===category?'selected':''}" type="button" data-category="${esc(category)}" aria-pressed="${activeCategory===category}"><span class="category-number">${String(categories.indexOf(category)+1).padStart(2,'0')}</span><span class="category-name">${esc(category)}</span><span class="category-count">${String(counts[category]).padStart(2,'0')} ${counts[category]===1?'work':'works'}</span><span class="category-arrow" aria-hidden="true">↗</span></button>`).join('');
}
function openWork(w, updateHistory=true){
  previousFocus=document.activeElement;
  document.querySelector('#reader-form').textContent=categoryOf(w);
  document.querySelector('#reader-title').textContent=w.Title;
  const status=document.querySelector('#reader-status');
  status.textContent=w['Completion status'];
  status.classList.toggle('incomplete',w['Completion status']==='Incomplete');
  document.querySelector('#reader-tags').textContent=w['Primary mood'] || tags(w).join(' · ');
  const full=fullText[`${w.Title}||${w.Form}`];
  document.querySelector('#reader-body').textContent=full?.text || '';
  document.querySelector('#reader-body').hidden=!full;
  document.querySelector('#reader-unavailable').hidden=!!full;
  relatedRoot.innerHTML=relatedWorks(w).map(item=>`<button class="related-row" type="button" data-form="${esc(item.Form)}" data-work="${esc(item.Title)}"><span class="related-name">${esc(item.Title)}</span><span class="related-meta"><span>${esc(categoryOf(item))}</span><span>${esc(item['Completion status'])}</span></span><span class="related-mood">${esc(item['Primary mood']||tags(item).join(' · '))}</span><span class="row-arrow" aria-hidden="true">↗</span></button>`).join('');
  loadRating(`${w.Title}||${w.Form}`);
  reader.dataset.category=categoryOf(w);
  reader.dataset.form=w.Form;
  reader.hidden=false;
  reader.setAttribute('aria-hidden','false');
  document.body.classList.add('reading');
  if(updateHistory)history.pushState({work:`${w.Title}||${w.Form}`},'',`#read/${encodeURIComponent(w.Title)}?form=${encodeURIComponent(w.Form)}`);
  document.querySelector('#reader-back').focus();
  window.scrollTo(0,0);
}
function workFromHash(){
  if(!location.hash.startsWith('#read/'))return null;
  const [titlePart,query='']=location.hash.slice(6).split('?');
  const title=decodeURIComponent(titlePart);
  const form=new URLSearchParams(query).get('form');
  return inventory.find(w=>w.Title===title&&(!form||w.Form===form)) || null;
}
function closeReader(updateHistory=true){
  if(reader.hidden)return;
  reader.hidden=true;
  reader.setAttribute('aria-hidden','true');
  document.body.classList.remove('reading');
  if(updateHistory&&location.hash.startsWith('#read/')){
    history.replaceState({},'', '#collection');
    document.querySelector('#collection').scrollIntoView({behavior:'smooth',block:'start'});
    document.querySelector('#collection-title').focus({preventScroll:true});
  }else if(previousFocus?.focus)previousFocus.focus();
}
function goHomeFromReader(){
  if(reader.hidden)return;
  reader.hidden=true;
  reader.setAttribute('aria-hidden','true');
  document.body.classList.remove('reading');
  history.replaceState({},'', '#top');
  window.scrollTo({top:0,behavior:'smooth'});
  document.querySelector('#top').focus({preventScroll:true});
}
function render(){
  const items=filtered();
  document.querySelector('#result-count').textContent=items.length;
  const groups=new Map();
  for(const item of items){const key=categoryOf(item);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(item)}
  const sorted=[...groups.entries()].sort((a,b)=>categories.indexOf(a[0])-categories.indexOf(b[0]));
  if(!items.length){worksRoot.innerHTML='<p class="empty">Nothing in the catalogue matches those filters.</p>';return}
  worksRoot.innerHTML=sorted.map(([category,rows])=>`<section class="form-section"><div class="form-heading"><h3>${esc(category)}</h3><span>${String(rows.length).padStart(2,'0')} ${rows.length===1?'work':'works'}</span></div>${rows.map(w=>`<button class="work-row" type="button" data-form="${esc(w.Form)}" data-work="${esc(w.Title)}"><span class="work-title">${esc(w.Title)}</span><span class="work-labels"><span class="status ${w['Completion status']==='Incomplete'?'incomplete':''}">${esc(w['Completion status'])}</span><span class="work-mood">${esc(w['Primary mood'] || tags(w).join(' · '))}</span></span><span class="row-arrow" aria-hidden="true">↗</span></button>`).join('')}</section>`).join('');
}
Promise.all([fetch('archive.json'),fetch('writing-content.json')]).then(async ([catalogue,content])=>{
  if(!catalogue.ok||!content.ok)throw new Error('Could not load archive files');
  return [await catalogue.json(),await content.json()];
}).then(([rows,writing])=>{
  inventory=rows; fullText=writing;
  renderCategoryNav();
  const options=[...new Set(rows.flatMap(tags))].sort((a,b)=>a.localeCompare(b));
  moodSelect.insertAdjacentHTML('beforeend',options.map(tag=>`<option value="${esc(tag)}">${esc(tag)}</option>`).join(''));
  render();
  const match=workFromHash();
  if(match)openWork(match,false);
}).catch(()=>{worksRoot.innerHTML='<p class="empty">The catalogue could not be loaded. Please open the archive through a local web server.</p>'});
for(const el of [searchInput,statusSelect,moodSelect])el.addEventListener('input',render);
categoryNav.addEventListener('click',e=>{const button=e.target.closest('[data-category]');if(!button)return;activeCategory=activeCategory===button.dataset.category?'':button.dataset.category;renderCategoryNav();render();document.querySelector('#works').scrollIntoView({behavior:'smooth',block:'start'})});
document.querySelector('#reset').addEventListener('click',()=>{searchInput.value='';statusSelect.value='';moodSelect.value='';activeCategory='';renderCategoryNav();render()});
worksRoot.addEventListener('click',e=>{const row=e.target.closest('[data-work]');if(row){const work=inventory.find(w=>w.Title===row.dataset.work&&w.Form===row.dataset.form);if(work)openWork(work)}});
document.querySelector('#reader-back').addEventListener('click',()=>closeReader());
document.querySelector('#reader-home').addEventListener('click',e=>{e.preventDefault();goHomeFromReader()});
relatedRoot.addEventListener('click',e=>{const row=e.target.closest('[data-work]');if(!row)return;const work=inventory.find(w=>w.Title===row.dataset.work&&w.Form===row.dataset.form);if(work)openWork(work)});
ratingRoot.addEventListener('click',e=>{const button=e.target.closest('[data-score]');if(button)submitRating(Number(button.dataset.score))});
ratingRoot.addEventListener('pointerover',e=>{const button=e.target.closest('[data-score]');if(button)paintRating(Number(button.dataset.score))});
ratingRoot.addEventListener('pointerleave',()=>paintRating(activeUserRating));
ratingRoot.addEventListener('focusin',e=>{const button=e.target.closest('[data-score]');if(button)paintRating(Number(button.dataset.score))});
ratingRoot.addEventListener('focusout',()=>paintRating(activeUserRating));
window.addEventListener('popstate',()=>{const match=workFromHash();if(match)openWork(match,false);else closeReader(false)});
document.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();searchInput.focus()}if(e.key==='Escape'&&!reader.hidden)closeReader()});
