const searchInput = document.querySelector('#search');
const statusSelect = document.querySelector('#status');
const moodSelect = document.querySelector('#mood');
const gradeSelect = document.querySelector('#grade');
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
let ratingsIndex = {};
let readerTextSize = Number(localStorage.getItem('tiwa-reader-size')||19);
let wideReading = localStorage.getItem('tiwa-reader-width')==='wide';
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
  const grade=gradeSelect.value;
  return inventory.filter(w=>{
    const hay=[w.Title,w.Form,w['Subject / mood tags']].join(' ').toLocaleLowerCase();
    const rating=ratingsIndex[`${w.Title}||${w.Form}`];
    const gradeMatch=!grade||(grade==='unrated'?(!rating||!rating.count):!!rating&&rating.count>0&&rating.average>=Number(grade));
    return gradeMatch&&(!activeCategory||categoryOf(w)===activeCategory)&&(!q||hay.includes(q))&&(!statusSelect.value||w['Completion status']===statusSelect.value)&&(!moodSelect.value||tags(w).includes(moodSelect.value));
  });
}
function renderCategoryNav(){
  const counts=Object.fromEntries(categories.map(category=>[category,inventory.filter(w=>categoryOf(w)===category).length]));
  categoryNav.innerHTML=categories.map(category=>`<button class="category-card ${activeCategory===category?'selected':''}" type="button" data-category="${esc(category)}" aria-pressed="${activeCategory===category}"><span class="category-number">${String(categories.indexOf(category)+1).padStart(2,'0')}</span><span class="category-name">${esc(category)}</span><span class="category-count">${String(counts[category]).padStart(2,'0')} ${counts[category]===1?'work':'works'}</span><span class="category-arrow" aria-hidden="true">↗</span></button>`).join('');
}
function renderReadingText(text, isNovel){
  const toc=document.querySelector('#reader-toc');
  const body=document.querySelector('#reader-body');
  const lines=String(text||'').replace(/\r/g,'').split('\n');
  const headings=[];
  const pattern=/^(?:chapter\s+|part\s+|book\s+|prologue\s*$|epilogue\s*$|interlude\s*$)(.{0,100})$/i;
  const markup=lines.map((line,index)=>{
    const trimmed=line.trim();
    const isHeading=isNovel&&trimmed&&pattern.test(trimmed);
    if(isHeading){const id=`section-${headings.length+1}`;headings.push({id,title:trimmed});return `<span class="reader-section-heading" id="${id}">${esc(line)}</span>`}
    return esc(line);
  }).join('\n');
  body.innerHTML=markup;
  if(isNovel&&headings.length){toc.innerHTML=`<p class="eyebrow">Contents</p><div>${headings.map(h=>`<a href="#${h.id}">${esc(h.title)}</a>`).join('')}</div>`;toc.hidden=false}else{toc.innerHTML='';toc.hidden=true}
}
function applyReaderPreferences(){
  document.querySelector('#reader-body').style.setProperty('--reader-size',`${readerTextSize}px`);
  document.querySelector('.reader-article').classList.toggle('wide-reading',wideReading);
  document.querySelector('#reader-layer').classList.toggle('night-reading',localStorage.getItem('tiwa-reader-theme')==='dark');
  document.querySelector('#reader-layer').classList.toggle('focus-reading',localStorage.getItem('tiwa-reader-focus')==='on');
  document.querySelector('#width-toggle').setAttribute('aria-pressed',String(wideReading));
  document.querySelector('#theme-toggle').setAttribute('aria-pressed',String(localStorage.getItem('tiwa-reader-theme')==='dark'));
  document.querySelector('#focus-toggle').setAttribute('aria-pressed',String(localStorage.getItem('tiwa-reader-focus')==='on'));
  document.querySelector('#theme-toggle').textContent=localStorage.getItem('tiwa-reader-theme')==='dark'?'Light theme':'Dark theme';
  document.querySelector('#focus-toggle').textContent=localStorage.getItem('tiwa-reader-focus')==='on'?'Exit focus':'Focus mode';
}
async function loadRatingIndex(){
  try{const response=await fetch('/api/ratings?summary=all',{cache:'no-store'});if(!response.ok)return;ratingsIndex=await response.json();render()}catch(_){/* Ratings remain optional if unavailable. */}
}
function renderStartHere(){
  const picks=[['Carpe Diem','Short story'],['5 Minutes','Short story'],['Child Abuse in Our Backyard','Short story']];
  const root=document.querySelector('#start-works');
  root.innerHTML=picks.map(([title,form])=>{const w=inventory.find(item=>item.Title===title&&item.Form===form);return w?`<button class="start-work" type="button" data-work="${esc(w.Title)}" data-form="${esc(w.Form)}"><span class="start-form">${esc(categoryOf(w))}</span><span class="start-name">${esc(w.Title)}</span><span class="start-mood">${esc(w['Primary mood']||tags(w).join(' · '))}</span><span class="row-arrow" aria-hidden="true">↗</span></button>`:''}).join('');
}
function openWork(w, updateHistory=true){
  previousFocus=document.activeElement;
  document.querySelector('#reader-form').textContent=categoryOf(w);
  document.querySelector('#reader-title').textContent=w.Title;
  const credit=document.querySelector('#reader-credit');
  credit.textContent=w['Co-author']?`Co-written with ${w['Co-author']}`:'';
  credit.hidden=!w['Co-author'];
  const status=document.querySelector('#reader-status');
  status.textContent=w['Completion status'];
  status.classList.toggle('incomplete',w['Completion status']==='Incomplete');
  document.querySelector('#reader-tags').textContent=w['Primary mood'] || tags(w).join(' · ');
  const full=fullText[`${w.Title}||${w.Form}`];
  renderReadingText(full?.text||'',categoryOf(w)==='Novel');
  document.querySelector('#reader-body').hidden=!full;
  document.querySelector('#reader-unavailable').hidden=!!full;
  const words=(full?.text||'').trim().split(/\s+/).filter(Boolean).length;
  document.querySelector('#reading-estimate').textContent=words?`${words.toLocaleString()} words · ${Math.max(1,Math.ceil(words/220))} min read`:'';
  applyReaderPreferences();
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
  document.querySelector('#reader-layer').scrollTop=0;
  updateReadingProgress();
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
fetch('cms-archive.json').then(async response=>{
  if(!response.ok)throw new Error('Could not load archive file');
  return response.json();
}).then(({works:rows})=>{
  inventory=rows; fullText=Object.fromEntries(rows.map(w=>[`${w.Title}||${w.Form}`,{text:w.text||''}]));
  renderCategoryNav();
  renderStartHere();
  loadRatingIndex();
  const options=[...new Set(rows.flatMap(tags))].sort((a,b)=>a.localeCompare(b));
  moodSelect.insertAdjacentHTML('beforeend',options.map(tag=>`<option value="${esc(tag)}">${esc(tag)}</option>`).join(''));
  render();
  const match=workFromHash();
  if(match)openWork(match,false);
}).catch(()=>{worksRoot.innerHTML='<p class="empty">The catalogue could not be loaded. Please open the archive through a local web server.</p>'});
for(const el of [searchInput,statusSelect,moodSelect,gradeSelect])el.addEventListener('input',render);
categoryNav.addEventListener('click',e=>{const button=e.target.closest('[data-category]');if(!button)return;activeCategory=activeCategory===button.dataset.category?'':button.dataset.category;renderCategoryNav();render();document.querySelector('#works').scrollIntoView({behavior:'smooth',block:'start'})});
document.querySelector('#reset').addEventListener('click',()=>{searchInput.value='';statusSelect.value='';moodSelect.value='';gradeSelect.value='';activeCategory='';renderCategoryNav();render()});
worksRoot.addEventListener('click',e=>{const row=e.target.closest('[data-work]');if(row){const work=inventory.find(w=>w.Title===row.dataset.work&&w.Form===row.dataset.form);if(work)openWork(work)}});
document.querySelector('#start-works').addEventListener('click',e=>{const row=e.target.closest('[data-work]');if(!row)return;const work=inventory.find(w=>w.Title===row.dataset.work&&w.Form===row.dataset.form);if(work)openWork(work)});
document.querySelector('#reader-back').addEventListener('click',()=>closeReader());
document.querySelector('#reader-home').addEventListener('click',e=>{e.preventDefault();goHomeFromReader()});
document.querySelector('#reader-footer-home').addEventListener('click',e=>{e.preventDefault();goHomeFromReader()});
document.querySelector('#reader-footer-about').addEventListener('click',e=>{e.preventDefault();goHomeFromReader();setTimeout(()=>document.querySelector('#about').scrollIntoView({behavior:'smooth'}),100)});
relatedRoot.addEventListener('click',e=>{const row=e.target.closest('[data-work]');if(!row)return;const work=inventory.find(w=>w.Title===row.dataset.work&&w.Form===row.dataset.form);if(work)openWork(work)});
ratingRoot.addEventListener('click',e=>{const button=e.target.closest('[data-score]');if(button)submitRating(Number(button.dataset.score))});
ratingRoot.addEventListener('pointerover',e=>{const button=e.target.closest('[data-score]');if(button)paintRating(Number(button.dataset.score))});
ratingRoot.addEventListener('pointerleave',()=>paintRating(activeUserRating));
ratingRoot.addEventListener('focusin',e=>{const button=e.target.closest('[data-score]');if(button)paintRating(Number(button.dataset.score))});
ratingRoot.addEventListener('focusout',()=>paintRating(activeUserRating));
function updateReadingProgress(){
  const layer=document.querySelector('#reader-layer');
  const max=layer.scrollHeight-layer.clientHeight;
  const amount=max>0?Math.min(100,Math.max(0,layer.scrollTop/max*100)):0;
  document.querySelector('#reading-progress-fill').style.width=`${amount}%`;
}
document.querySelector('#reader-layer').addEventListener('scroll',updateReadingProgress,{passive:true});
document.querySelector('#text-smaller').addEventListener('click',()=>{readerTextSize=Math.max(15,readerTextSize-1);localStorage.setItem('tiwa-reader-size',String(readerTextSize));applyReaderPreferences()});
document.querySelector('#text-larger').addEventListener('click',()=>{readerTextSize=Math.min(26,readerTextSize+1);localStorage.setItem('tiwa-reader-size',String(readerTextSize));applyReaderPreferences()});
document.querySelector('#width-toggle').addEventListener('click',()=>{wideReading=!wideReading;localStorage.setItem('tiwa-reader-width',wideReading?'wide':'narrow');applyReaderPreferences()});
document.querySelector('#theme-toggle').addEventListener('click',()=>{localStorage.setItem('tiwa-reader-theme',localStorage.getItem('tiwa-reader-theme')==='dark'?'light':'dark');applyReaderPreferences()});
document.querySelector('#focus-toggle').addEventListener('click',()=>{localStorage.setItem('tiwa-reader-focus',localStorage.getItem('tiwa-reader-focus')==='on'?'off':'on');applyReaderPreferences()});
document.querySelector('#copy-link').addEventListener('click',async e=>{try{await navigator.clipboard.writeText(location.href);e.currentTarget.textContent='Link copied';setTimeout(()=>e.currentTarget.textContent='Copy link',1800)}catch(_){e.currentTarget.textContent='Copy unavailable'}});
document.querySelector('#print-work').addEventListener('click',()=>window.print());
const contactForm=document.querySelector('#contact-form');
document.querySelector('#contact-started').value=String(Date.now());
contactForm.addEventListener('submit',async e=>{
  e.preventDefault();const status=document.querySelector('#contact-status');const data=new FormData(contactForm);
  status.textContent='Sending…';
  let contactWindow=window.open('about:blank','_blank');
  try{const response=await fetch('/api/contact',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:data.get('name'),email:data.get('email'),message:data.get('message'),website:data.get('website'),started_at:Number(data.get('started_at'))})});
    const result=await response.json();if(!response.ok)throw new Error(result.error||'Please try again later.');
    const subject=encodeURIComponent(`Message from ${data.get('name')}`);const body=encodeURIComponent(`${data.get('message')}\n\nFrom: ${data.get('name')} <${data.get('email')}>`);
    if(contactWindow)contactWindow.location.href=`mailto:thomasigou1@gmail.com?subject=${subject}&body=${body}`;else throw new Error('Please allow pop-ups to open your email app.');status.textContent='Your email app is opening with your message ready to send.';contactForm.reset();document.querySelector('#contact-started').value=String(Date.now());
  }catch(error){if(contactWindow)contactWindow.close();status.textContent=error.message||'Could not open your email. Please try again.'}
});
window.addEventListener('popstate',()=>{const match=workFromHash();if(match)openWork(match,false);else closeReader(false)});
document.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();searchInput.focus()}if(e.key==='Escape'&&!reader.hidden)closeReader()});
