const $$=id=>document.getElementById(id);let me=null;let view='dashboard';
function escapeHTML(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
async function fetchJSON(url){const r=await fetch(url,{credentials:'same-origin',cache:'no-store'});if(!r.ok)throw new Error(`${r.status}: ${await r.text()}`);return r.json();}
function table(rows){if(!rows.length)return '<p class="muted">등록된 자료가 없습니다.</p>';const keys=Object.keys(rows[0]);return `<div class="panel"><table><thead><tr>${keys.map(k=>`<th>${escapeHTML(k)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${keys.map(k=>`<td>${escapeHTML(row[k])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;}
async function load(v){view=v;document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('selected',b.dataset.view===v));const titles={dashboard:'종합 대시보드',employees:'직원 명부',certificates:'자격증',technical:'기술등급',licenses:'보유 면허',industries:'업종 등록',users:'인사팀 계정'};$$('title').textContent=titles[v];$$('body').textContent='자료를 조회하고 있습니다…';try{if(v==='dashboard'){const m=new Date().toISOString().slice(0,7);const d=await fetchJSON('/api/summary?month='+m);$$('body').innerHTML=`<div class="cards"><div class="card"><small>등록 직원</small><strong>${d.employees}명</strong></div><div class="card"><small>${escapeHTML(m)} 월말 재직</small><strong>${d.monthEnd}명</strong></div><div class="card"><small>입사</small><strong>${d.hires.length}명</strong></div><div class="card"><small>퇴사</small><strong>${d.leaves.length}명</strong></div></div><section><div class="toolbar"><label>조회 월 <input id="month" type="month" value="${m}"></label><button id="monthGo">조회</button></div><h3>입사자</h3><div id="hires">${table(d.hires)}</div><h3>퇴사자</h3><div id="leaves">${table(d.leaves)}</div></section>`;$$('monthGo').onclick=async()=>{try{const z=await fetchJSON('/api/summary?month='+$$('month').value);$$('hires').innerHTML=table(z.hires);$$('leaves').innerHTML=table(z.leaves);}catch(e){alert(e.message)}};return;}
if(v==='users'){if(me.role!=='admin'){throw new Error('공용 비밀번호에서는 사용자 관리 기능이 비활성화되어 있습니다.')}const d=await fetchJSON('/api/admin-users');$$('body').innerHTML=table(d.rows);return;}
if(v==='employees'){await showEmployeeDirectory();return;}

const d=await fetchJSON('/api/data?table='+encodeURIComponent(v));$$('body').innerHTML=`<p class="muted">조회 결과: ${d.rows.length}건 (최대 500건)</p>`+table(d.rows);
}catch(e){$$('body').innerHTML=`<div class="error">${escapeHTML(e.message)}</div>`;}}
async function initApp(){try{const d=await fetchJSON('/api/me');me=d.user;$$('login').hidden=true;$$('shell').hidden=false;$$('identity').textContent='관리자 로그인';document.querySelectorAll('nav button').forEach(b=>{b.onclick=()=>load(b.dataset.view);if(b.dataset.view==='users')b.hidden=true});await load('dashboard');}catch(e){$$('shell').hidden=true;$$('login').hidden=false;$$('loginerror').textContent='';}}
$$('loginform').addEventListener('submit',async e=>{e.preventDefault();$$('loginerror').textContent='';const btn=$$('loginbutton');btn.disabled=true;try{const r=await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({username:$$('username').value,password:$$('password').value})});const d=await r.json();if(!r.ok)throw new Error(d.error||'로그인 실패');$$('password').value='';await initApp();}catch(err){$$('loginerror').textContent=err.message;}finally{btn.disabled=false;}});
$$('logout').addEventListener('click',async()=>{await fetch('/api/logout',{method:'POST',credentials:'same-origin'});location.reload();});
initApp();


let directoryRows=[];
const clean=(v)=>String(v??'').trim();
const listText=(v)=>Array.isArray(v)?v.filter(Boolean).join(' / '):clean(v);
const gradeOrder=['초급','중급','고급','특급'];
function uniqOpts(rows, getter){return [...new Set(rows.flatMap(r=>getter(r)).map(clean).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ko'));}
function controlSelect(id,label,options){return `<label>${label}<select id="${id}"><option value="">전체</option>${options.map(x=>`<option value="${escapeHTML(x)}">${escapeHTML(x)}</option>`).join('')}</select></label>`;}
function textOrDash(s){const t=listText(s);return t?escapeHTML(t):'<span class="dim">-</span>';}
function cellTags(values){return values.length?values.map(s=>`<span class="pill">${escapeHTML(s)}</span>`).join(' '):'<span class="dim">-</span>';}
function drawDirectory(){
 const q=clean($$('dirSearch').value).toLowerCase();
 const filters=['department','workplace','grade','field','certificate','license','industry'];
 const selected=Object.fromEntries(filters.map(k=>[k,clean($$('dir_'+k).value)]));
 const filtered=directoryRows.filter(r=>{
  const haystack=[r.employee_no,r.name,r.department,r.workplace,r.job_title,...r.grades.map(x=>x.technical_field+' '+x.grade),...r.certificates.map(x=>x.certificate_name+' '+x.certificate_level),...r.licenses.map(x=>x.license_type),...r.industries.map(x=>x.industry_name)].join(' ').toLowerCase();
  if(q&&!haystack.includes(q))return false;
  const has=(arr,field,val)=>!val||arr.some(x=>clean(x[field]).includes(val));
  return (!selected.department||r.department===selected.department)&&(!selected.workplace||r.workplace===selected.workplace)
   &&has(r.grades,'grade',selected.grade)&&has(r.grades,'technical_field',selected.field)
   &&has(r.certificates,'certificate_name',selected.certificate)&&has(r.licenses,'license_type',selected.license)
   &&has(r.industries,'industry_name',selected.industry);
 });
 $$('dirCount').textContent=`조회 ${filtered.length}명 / 전체 ${directoryRows.length}명`;
 const gradeMarks=(r,g)=>r.grades.some(x=>clean(x.grade).includes(g))?'○':'';
 const certMarks=(r,g)=>hasCert(r,g)?'○':'';
 // 직원별 보유 여부를 집계합니다. 자격증이 여러 건이어도 해당 등급은 1명으로 계산합니다.
 const hasGrade=(r,g)=>r.grades.some(x=>clean(x.grade).includes(g));
 // 자격증 명칭을 우선하여 등급을 판별합니다.
 // 산업기사에는 '기사'가 포함되므로 반드시 산업기사를 먼저 확인합니다.
 const certClass=(x)=>{
  const name=clean(x.certificate_name).replace(/\s+/g,'');
  const level=clean(x.certificate_level).replace(/\s+/g,'');
  const classify=(s)=>{
   if(s.includes('산업기사'))return '산업기사';
   if(s.includes('기능장'))return '기능장';
   if(s.includes('기술사'))return '기술사';
   if(s.includes('기사'))return '기사';
   return '';
  };
  return classify(name)||classify(level);
 };
 const certTypes=['산업기사','기사','기능장','기술사'];
 const hasCert=(r,g)=>r.certificates.some(x=>certClass(x)===g);
 const totalGrades=gradeOrder.map(g=>filtered.filter(r=>hasGrade(r,g)).length);
 const totalCerts=certTypes.map(g=>filtered.filter(r=>hasCert(r,g)).length);
 const certHolders=filtered.filter(r=>r.certificates.length>0).length;
 const licensed=filtered.filter(r=>r.licenses.length>0||r.industries.length>0).length;
 const footer=`<tr class="excel-total-row"><th colspan="3">합계 (${filtered.length}명)</th><td class="field-col">-</td>${totalGrades.map(n=>`<td>${n}명</td>`).join('')}<td>${certHolders}명</td>${totalCerts.map(n=>`<td>${n}명</td>`).join('')}<td>${licensed}명</td></tr>`;
 const row=(r)=>`<tr><td class="dept-col">${textOrDash(r.department)}</td><td>${textOrDash(r.job_title)}</td><td class="name-col">${textOrDash(r.name)}</td><td class="field-col">${textOrDash([...new Set(r.grades.map(x=>clean(x.technical_field)).filter(Boolean))].join(' / '))}</td>${gradeOrder.map(g=>`<td class="mark">${gradeMarks(r,g)}</td>`).join('')}<td class="certificate-col">${textOrDash([...new Set(r.certificates.map(x=>clean(x.certificate_name)).filter(Boolean))].join(' / '))}</td>${['산업기사','기사','기능장','기술사'].map(g=>`<td class="mark">${certMarks(r,g)}</td>`).join('')}<td class="license-col">${textOrDash([...new Set([...r.licenses.map(x=>x.license_type),...r.industries.map(x=>x.industry_name)].map(clean).filter(Boolean))].join(' / '))}</td></tr>`;
 $$('dirResult').innerHTML=`<div class="excel-scroll"><table class="excel-directory"><colgroup><col style="width:145px"><col style="width:110px"><col style="width:104px"><col style="width:112px">${Array(4).fill('<col style="width:67px">').join('')}<col style="width:188px">${Array(4).fill('<col style="width:75px">').join('')}<col style="width:245px"></colgroup><thead><tr class="group-header"><th rowspan="2">부 서</th><th rowspan="2">직 책</th><th rowspan="2">성 명</th><th colspan="5">건설기술인</th><th colspan="5">국가기술자격</th><th rowspan="2">등록 면허</th></tr><tr class="sub-header"><th>분야</th><th>초급</th><th>중급</th><th>고급</th><th>특급</th><th>자격증</th><th>산업기사</th><th>기사</th><th>기능장</th><th>기술사</th></tr></thead><tbody>${filtered.length?filtered.map(row).join(''):'<tr><td class="empty-row" colspan="14">조회된 직원이 없습니다.</td></tr>'}</tbody><tfoot>${footer}</tfoot></table></div>`;
}
async function showEmployeeDirectory(){
 const data=await fetchJSON('/api/directory');directoryRows=data.rows||[];
 const fields=[['department','부서',r=>[r.department]],['workplace','사업장',r=>[r.workplace]],['grade','기술등급',r=>r.grades.map(x=>x.grade)],['field','기술분야',r=>r.grades.map(x=>x.technical_field)],['certificate','국가기술자격',r=>r.certificates.map(x=>x.certificate_name)],['license','등록 면허',r=>r.licenses.map(x=>x.license_type)],['industry','업종 등록',r=>r.industries.map(x=>x.industry_name)]];
 $$('body').innerHTML=`<section class="directory"><div class="directory-head"><div><h2>기술인력 보유현황표</h2><p class="muted">엑셀 샘플과 동일한 2단 제목·열 순서 · 한 직원 한 행 · 실시간 D1 조회</p></div><button id="dirReset" type="button">필터 초기화</button></div><div class="directory-filters"><label class="directory-search">통합검색<input id="dirSearch" type="search" placeholder="성명·부서·자격증·면허 검색"></label>${fields.map(([k,label,getter])=>controlSelect('dir_'+k,label,uniqOpts(directoryRows,getter))).join('')}</div><p class="muted" id="dirCount"></p><div id="dirResult"></div><p class="muted tiny">좌우로 스크롤하여 모든 열을 확인할 수 있습니다. '○'는 해당 등급의 보유 기록을 뜻합니다. 맨 아래 합계는 현재 필터 결과의 직원 수를 기준으로 자동 변경되며, 같은 등급 자격증을 여러 장 보유해도 1명으로 계산합니다. 한 사람이 서로 다른 등급을 가진 경우 각 등급에 각각 포함됩니다. 등록 면허 열에는 면허·업종등록 내역을 함께 표시합니다. 개인정보가 담긴 엑셀은 GitHub에 올리지 마세요.</p></section>`;
 $$('dirSearch').addEventListener('input',drawDirectory);fields.forEach(([key])=>$$('dir_'+key).addEventListener('change',drawDirectory));
 $$('dirReset').onclick=()=>{$$('dirSearch').value='';fields.forEach(([key])=>$$('dir_'+key).value='');drawDirectory()};drawDirectory();
}
