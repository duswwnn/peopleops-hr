const $$=id=>document.getElementById(id);let me=null;let view='dashboard';
function escapeHTML(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
async function fetchJSON(url){const r=await fetch(url,{credentials:'same-origin',cache:'no-store'});if(!r.ok)throw new Error(`${r.status}: ${await r.text()}`);return r.json();}
function table(rows){if(!rows.length)return '<p class="muted">등록된 자료가 없습니다.</p>';const keys=Object.keys(rows[0]);return `<div class="panel"><table><thead><tr>${keys.map(k=>`<th>${escapeHTML(k)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${keys.map(k=>`<td>${escapeHTML(row[k])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;}
async function load(v){view=v;document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('selected',b.dataset.view===v));const titles={dashboard:'종합 대시보드',employees:'직원명부',technical_staff:'기술인력 보유현황표',certificates:'자격증',technical:'기술등급',licenses:'보유 면허',industries:'업종 등록',users:'인사팀 계정'};$$('title').textContent=titles[v];$$('body').textContent='자료를 조회하고 있습니다…';try{if(v==='dashboard'){const m=new Date().toISOString().slice(0,7);const d=await fetchJSON('/api/summary?month='+m);$$('body').innerHTML=`<div class="cards"><div class="card"><small>등록 직원</small><strong>${d.employees}명</strong></div><div class="card"><small>${escapeHTML(m)} 월말 재직</small><strong>${d.monthEnd}명</strong></div><div class="card"><small>입사</small><strong>${d.hires.length}명</strong></div><div class="card"><small>퇴사</small><strong>${d.leaves.length}명</strong></div></div><div class="dashboard-chart-grid"><section class="trend-panel"><div class="trend-heading"><div><h3>월별 재직 인원 추이</h3><p class="muted">각 월 말일 기준 · 입사일과 퇴사일로 계산</p></div><label>조회 연도 <select id="trendYear"></select></label></div><div id="trendChart" class="trend-chart"><p class="muted">인원 추이를 불러오고 있습니다…</p></div></section><section class="trend-panel workplace-panel"><div class="trend-heading"><div><h3>사업장별 월말 재직 인원</h3><p class="muted">오산본사 · 과천지사 비교</p></div><span id="workplaceYearLabel" class="muted"></span></div><div id="workplaceChart" class="trend-chart"><p class="muted">사업장별 인원을 불러오는 중입니다…</p></div></section></div><section><div class="toolbar"><label>조회 월 <input id="month" type="month" value="${m}"></label><button id="monthGo">조회</button></div><h3>입사자</h3><div id="hires">${table(d.hires)}</div><h3>퇴사자</h3><div id="leaves">${table(d.leaves)}</div></section>`;$$('monthGo').onclick=async()=>{try{const z=await fetchJSON('/api/summary?month='+$$('month').value);$$('hires').innerHTML=table(z.hires);$$('leaves').innerHTML=table(z.leaves);}catch(e){alert(e.message)}};await initHeadcountTrend();return;}
if(v==='users'){if(me.role!=='admin'){throw new Error('공용 비밀번호에서는 사용자 관리 기능이 비활성화되어 있습니다.')}const d=await fetchJSON('/api/admin-users');$$('body').innerHTML=table(d.rows);return;}
if(v==='employees'){await showAllEmployees();return;}
if(v==='technical_staff'){await showEmployeeDirectory();return;}

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
function certificateType(x){
 const s=clean(x.certificate_name).replace(/\s+/g,'');
 const fallback=clean(x.certificate_level).replace(/\s+/g,'');
 const type=(t)=>t.includes('산업기사')?'산업기사':t.includes('기능장')?'기능장':t.includes('기술사')?'기술사':t.endsWith('기사')?'기사':'';
 return type(s)||type(fallback);
}
function drawDirectory(){
 const q=clean($$('dirSearch').value).toLowerCase();
 const keys=['workplace','department','grade','field','certificate','license'];
 const f=Object.fromEntries(keys.map(k=>[k,clean($$('dir_'+k).value)]));
 const filtered=directoryRows.filter(r=>{
  if(!r.certificates?.length && !r.grades?.length && !r.licenses?.length)return false;
  const words=[r.employee_no,r.name,r.department,r.workplace,r.job_title,...r.grades.map(x=>x.technical_field+' '+x.grade),...r.certificates.map(x=>x.certificate_name+' '+x.certificate_level),...r.licenses.map(x=>x.license_type),...r.industries.map(x=>x.industry_name)].join(' ').toLowerCase();
  if(q&&!words.includes(q))return false;
  const has=(array,key,value)=>!value||array.some(item=>clean(item[key]).includes(value));
  return (!f.workplace||r.workplace===f.workplace)&&(!f.department||r.department===f.department)&&has(r.grades,'grade',f.grade)&&has(r.grades,'technical_field',f.field)&&has(r.certificates,'certificate_name',f.certificate)&&has(r.licenses,'license_type',f.license);
 });
 const marks=['산업기사','기사','기능장','기술사'];
 const hasGrade=(r,g)=>r.grades.some(x=>clean(x.grade).includes(g));
 const countCertificates=g=>filtered.reduce((n,r)=>n+r.certificates.filter(c=>certificateType(c)===g).length,0);
 const uniqueCertPeople=g=>filtered.filter(r=>r.certificates.some(c=>certificateType(c)===g)).length;
 const countAll=filtered.reduce((n,r)=>n+r.certificates.length,0);
 const physicalRows=filtered.reduce((n,r)=>n+Math.max(1,r.certificates.length),0);
 $$('dirCount').textContent=`조회 직원 ${filtered.length}명 / 전체 기술인력 ${directoryRows.filter(r=>r.certificates?.length||r.grades?.length||r.licenses?.length).length}명 · 표시 자격증 ${countAll}건`;
 const totalGrades=gradeOrder.map(g=>filtered.filter(r=>hasGrade(r,g)).length);
 const totalCerts=marks.map(countCertificates);
 const totalUniqueCerts=marks.map(uniqueCertPeople);
 const licensed=filtered.filter(r=>r.licenses.length>0).length;
 const footer=`<tr class="excel-total-row"><th colspan="4">합계 (직원 ${filtered.length}명 · 자격증 ${countAll}건)</th><td class="field-col">-</td>${totalGrades.map(n=>`<td>${n}명</td>`).join('')}<td>${countAll}건</td>${totalCerts.map(n=>`<td>${n}건</td>`).join('')}<td>${licensed}명</td></tr>`;
 const gradeMarks=(r,g)=>hasGrade(r,g)?'○':'';
 const makeRows=r=>{
  const certificates=r.certificates.length?r.certificates:[null];
  return certificates.map((cert,index)=>{
    const first=index===0;
    const type=cert?certificateType(cert):'';
    return `<tr data-emp-id="${r.id}" class="${first?'person-first':'person-continuation'}">
     <td class="workplace-col">${first?textOrDash(r.workplace):'<span class="repeat-mark">〃</span>'}</td>
     <td class="dept-col">${first?textOrDash(r.department):'<span class="repeat-mark">〃</span>'}</td>
     <td>${first?textOrDash(r.job_title):'<span class="repeat-mark">〃</span>'}</td>
     <td class="name-col">${first?`<button type="button" class="employee-link" data-edit-id="${r.id}">${escapeHTML(r.name)}</button>`:`<button type="button" class="employee-link" data-edit-id="${r.id}" aria-label="${escapeHTML(r.name)} 정보 수정">${escapeHTML(r.name)}</button>`}</td>
     <td class="field-col">${first?textOrDash([...new Set(r.grades.map(x=>clean(x.technical_field)).filter(Boolean))].join(' / ')):'<span class="repeat-mark">〃</span>'}</td>
     ${gradeOrder.map(g=>`<td class="mark">${first?gradeMarks(r,g):''}</td>`).join('')}
     <td class="certificate-col">${cert?escapeHTML(cert.certificate_name):'<span class="dim">-</span>'}</td>
     ${marks.map(g=>`<td class="mark">${type===g?'○':''}</td>`).join('')}
     <td class="license-col">${first?textOrDash([...new Set(r.licenses.map(x=>x.license_type).map(clean).filter(Boolean))].join(' / ')):'<span class="repeat-mark">〃</span>'}</td>
    </tr>`;
  }).join('');
 };
 $$('dirResult').innerHTML=`<div class="excel-scroll"><table class="excel-directory"><colgroup><col style="width:120px"><col style="width:145px"><col style="width:110px"><col style="width:104px"><col style="width:112px">${Array(4).fill('<col style="width:67px">').join('')}<col style="width:188px">${Array(4).fill('<col style="width:75px">').join('')}<col style="width:245px"></colgroup><thead><tr class="group-header"><th rowspan="2">사 업 장</th><th rowspan="2">부 서</th><th rowspan="2">직 책</th><th rowspan="2">성 명</th><th colspan="5">건설기술인</th><th colspan="5">국가기술자격</th><th rowspan="2">등록 면허</th></tr><tr class="sub-header"><th>분야</th><th>초급</th><th>중급</th><th>고급</th><th>특급</th><th>자격증</th><th>산업기사</th><th>기사</th><th>기능장</th><th>기술사</th></tr></thead><tbody>${physicalRows?filtered.map(makeRows).join(''):'<tr><td class="empty-row" colspan="15">조회된 직원이 없습니다.</td></tr>'}</tbody><tfoot>${footer}</tfoot></table></div><p class="muted tiny">자격증은 1건당 1행으로 표시합니다. 기사·산업기사 합계는 자격증 개수(건), 기술등급 합계는 보유 직원 수(명)입니다. 동일 직원의 인원수는 중복 합산하지 않습니다. 필터 적용 시 합계가 함께 바뀝니다.</p>`;
}
async function showEmployeeDirectory(){
 const data=await fetchJSON('/api/directory');directoryRows=data.rows||[];
 const fields=[['workplace','사업장',r=>[r.workplace]],['department','부서',r=>[r.department]],['grade','기술등급',r=>r.grades.map(x=>x.grade)],['field','기술분야',r=>r.grades.map(x=>x.technical_field)],['certificate','국가기술자격',r=>r.certificates.map(x=>x.certificate_name)],['license','등록 면허',r=>r.licenses.map(x=>x.license_type)]];
 $$('body').innerHTML=`<section class="directory"><div class="directory-head"><div><h2>기술인력 보유현황표</h2><p class="muted">엑셀형 2단 제목 · 자격증별 개별 행 · 실시간 D1 조회</p></div><div class="directory-actions"><button id="dirReset" type="button">필터 초기화</button></div></div><div class="directory-filters"><label class="directory-search">통합검색<input id="dirSearch" type="search" placeholder="성명·부서·자격증·면허 검색"></label>${fields.map(([k,label,getter])=>controlSelect('dir_'+k,label,k==='workplace'?['오산본사','과천지사']:uniqOpts(directoryRows,getter))).join('')}</div><p class="muted" id="dirCount"></p><div id="dirResult"></div><p class="muted tiny">좌우로 스크롤하여 모든 열을 확인할 수 있습니다. '○'는 해당 등급의 보유 기록을 뜻합니다. 맨 아래 기술등급 합계는 직원 수(명), 자격증 등급 합계는 실제 자격증 개수(건)로 계산합니다. 한 사람이 서로 다른 등급을 가진 경우 각 등급에 각각 포함됩니다. 등록 면허 열에는 면허·업종등록 내역을 함께 표시합니다. 개인정보가 담긴 엑셀은 GitHub에 올리지 마세요.</p></section>`;
 $$('dirSearch').addEventListener('input',drawDirectory);fields.forEach(([key])=>$$('dir_'+key).addEventListener('change',drawDirectory));
 $$('dirResult').addEventListener('click',e=>{const target=e.target.closest('[data-edit-id]');if(target)openEmployeeEditor(directoryRows.find(r=>r.id===Number(target.dataset.editId)));});
 $$('dirReset').onclick=()=>{$$('dirSearch').value='';fields.forEach(([key])=>$$('dir_'+key).value='');drawDirectory()};drawDirectory();
}


async function showAllEmployees(){
 const d=await fetchJSON('/api/directory');
 directoryRows=d.rows||[];
 $$('body').innerHTML=`<section class="directory all-employees"><div class="directory-head"><div><h2>직원명부</h2><p class="muted">자격증 보유 여부와 관계없이 전체 직원을 관리합니다. 종합 대시보드 인원 집계 기준입니다.</p></div><div class="directory-actions"><button id="allAdd" class="primary">+ 직원 추가</button><button id="allImport">엑셀 일괄 업로드</button></div></div><div class="directory-filters"><label>직원 검색<input id="allSearch" type="search" placeholder="사번·성명·부서 검색"></label><label>사업장<select id="allWorkplace"><option value="">전체</option><option>오산본사</option><option>과천지사</option></select></label><label>재직 상태<select id="allStatus"><option value="">전체</option><option value="active">재직</option><option value="former">퇴사</option></select></label></div><p id="allCount" class="muted"></p><div id="allResult" class="excel-scroll"></div></section>`;
 const draw=()=>{
  const q=clean($$('allSearch').value).toLowerCase(),site=$$('allWorkplace').value,status=$$('allStatus').value;
  const today=new Date().toLocaleDateString('en-CA');
  const rows=directoryRows.filter(r=>{
   if(q&&!String([r.employee_no,r.name,r.department,r.job_title].join(' ')).toLowerCase().includes(q))return false;
   if(site&&r.workplace!==site)return false;
   const active=(!r.hire_date||r.hire_date<=today)&&(!r.termination_date||r.termination_date>today);
   return !status||(status==='active'?active:!active&&!!r.termination_date&&r.termination_date<=today);
  });
  $$('allCount').textContent=`조회 ${rows.length}명 / 전체 ${directoryRows.length}명`;
  $$('allResult').innerHTML=`<table class="excel-directory all-staff-table"><thead><tr><th>사번</th><th>사업장</th><th>부서</th><th>직책</th><th>성명</th><th>입사일</th><th>퇴사일</th><th>자격증</th><th>정보 수정</th></tr></thead><tbody>${rows.length?rows.map(r=>`<tr><td>${textOrDash(r.employee_no)}</td><td>${textOrDash(r.workplace)}</td><td>${textOrDash(r.department)}</td><td>${textOrDash(r.job_title)}</td><td>${escapeHTML(r.name)}</td><td>${textOrDash(r.hire_date)}</td><td>${textOrDash(r.termination_date)}</td><td>${r.certificates?.length||0}건</td><td><button class="employee-link" data-edit-id="${r.id}">수정</button></td></tr>`).join(''):'<tr><td colspan="9">조회된 직원이 없습니다.</td></tr>'}</tbody></table>`;
 };
 ['allSearch','allWorkplace','allStatus'].forEach(id=>$$ (id).addEventListener(id==='allSearch'?'input':'change',draw));
 $$('allAdd').onclick=()=>openEmployeeEditor();$$('allImport').onclick=openImportModal;
 $$('allResult').addEventListener('click',e=>{let t=e.target.closest('[data-edit-id]');if(t)openEmployeeEditor(directoryRows.find(r=>r.id===Number(t.dataset.editId)))});
 draw();
}

// Employee editor and workbook import - same-origin API, no direct DB access from browser.
const splitItems=s=>String(s||'').split(/\r?\n|;/).map(x=>x.trim()).filter(Boolean);
function editorTemplate(e={}){
 const edit=!!e.id;
 const cert=(e.certificates||[]).map(x=>x.certificate_name).join('\n');
 const grades=(e.grades||[]).map(x=>[x.technical_field,x.grade].join(' | ')).join('\n');
 const licenses=(e.licenses||[]).map(x=>x.license_type).join('\n');
 const val=k=>escapeHTML(e[k]||'');
 return `<div class="modal-shade" id="editModal"><form class="editor-card" id="employeeForm"><div class="editor-top"><h2>${edit?'직원 정보 수정':'직원 추가'}</h2><button type="button" data-close>✕</button></div><p class="muted">자격증·기술등급·면허는 한 줄에 하나씩 입력합니다.</p>
 <div class="editor-grid"><label>사번 (중복 확인 기준)<input name="employee_no" value="${val('employee_no')}" placeholder="예: EMP001" ${edit?'readonly':''}></label><label>성명 *<input name="name" required maxlength="100" value="${val('name')}"></label>
 <label>사업장<select name="workplace"><option value="">선택</option>${['오산본사','과천지사'].map(x=>`<option value="${x}" ${e.workplace===x?'selected':''}>${x}</option>`).join('')}</select></label><label>부서<input name="department" value="${val('department')}"></label>
 <label>직책<input name="job_title" value="${val('job_title')}"></label><label>입사일<input name="hire_date" type="date" value="${val('hire_date')}"></label><label>퇴사일<input name="termination_date" type="date" value="${val('termination_date')}"></label></div>
 <div class="editor-grid"><label>국가기술자격증<textarea name="certs" placeholder="전기기사\n전기산업기사">${escapeHTML(cert)}</textarea></label><label>건설기술인 (분야 | 등급)<textarea name="grades" placeholder="전기 | 고급\n기계 | 중급">${escapeHTML(grades)}</textarea></label><label>등록 면허<textarea name="licenses" placeholder="전기공사업">${escapeHTML(licenses)}</textarea></label></div>
 <p id="editFeedback" role="status" class="error-line"></p><div class="editor-actions"><button type="button" data-close>취소</button><button class="primary" type="submit">${edit?'변경 내용 저장':'직원 등록'}</button></div></form></div>`;
}
function setModal(html){document.getElementById('modalRoot')?.remove();const root=document.createElement('div');root.id='modalRoot';root.innerHTML=html;document.body.append(root);root.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>root.remove());}
async function sendManage(payload){const r=await fetch('/api/manage',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify(payload)});const data=await r.json().catch(()=>({}));if(!r.ok)throw Error(data.error||`저장 실패 (${r.status})`);return data;}
function formEntry(form,original){const v=k=>form.elements.namedItem(k).value.trim();return {id:original?.id,employee_no:v('employee_no'),name:v('name'),workplace:v('workplace'),department:v('department'),job_title:v('job_title'),hire_date:v('hire_date'),termination_date:v('termination_date'),certificates:splitItems(v('certs')).map(certificate_name=>({certificate_name})),grades:splitItems(v('grades')).map(s=>{const [technical_field,grade]=s.split('|').map(x=>x.trim());return {technical_field,grade:grade||''}}),licenses:splitItems(v('licenses')).map(license_type=>({license_type}))};}
function openEmployeeEditor(employee){setModal(editorTemplate(employee));const form=document.getElementById('employeeForm');form.onsubmit=async e=>{e.preventDefault();const feedback=document.getElementById('editFeedback');const btn=form.querySelector('button[type=submit]');btn.disabled=true;try{await sendManage({action:'save',mode:employee?'update':'create',employee:formEntry(form,employee)});document.getElementById('modalRoot').remove();await load(view==='technical_staff'?'technical_staff':'employees');}catch(err){feedback.textContent=err.message}finally{btn.disabled=false}};}
function columnMap(h){const s=String(h||'').replace(/\s+/g,'').toLowerCase();if(/^(사번|직원번호|employee_no)$/.test(s))return 'employee_no';if(/^(성명|이름|name)$/.test(s))return 'name';if(/사업장|근무지/.test(s))return 'workplace';if(/^(부서|소속)$/.test(s))return 'department';if(/^(직책|직급|직위)$/.test(s))return 'job_title';if(/입사일/.test(s))return 'hire_date';if(/퇴사일/.test(s))return 'termination_date';if(/(국가기술자격|자격증명|자격증)$/.test(s))return 'certificates';if(/^(기술분야|분야)$/.test(s))return 'field';if(/^(기술등급|등급|초급|중급|고급|특급)$/.test(s))return s==='초급'||s==='중급'||s==='고급'||s==='특급'?'grade_'+s:'grade';if(/^(등록면허|보유면허|면허)$/.test(s))return 'licenses';if(/^(업종등록|업종)$/.test(s))return 'industries';return null;}
function normalizeGrid(grid){const headerIndex=grid.findIndex(row=>row.some(c=>['성명','이름'].includes(String(c??'').replace(/\s/g,''))));if(headerIndex<0)throw Error('엑셀에서 성명 헤더를 찾지 못했습니다. 제공된 양식에 성명 열을 포함해 주세요.');const h=grid[headerIndex].map(columnMap);let group='';for(let i=0;i<h.length;i++){const raw=String(grid[headerIndex][i]||'').replace(/\s/g,'');if(raw.includes('건설기술인'))group='grades';if(raw.includes('국가기술자격'))group='certificates';}
 const rows=[];for(const vals of grid.slice(headerIndex+1)){const obj={certificates:[],grades:[],licenses:[],industries:[]};let field='',grade='';let seen=false;for(let i=0;i<h.length;i++){const key=h[i];let v=String(vals[i]??'').trim();if(!key||!v)continue;if(key==='certificates')obj.certificates.push(...splitItems(v).map(certificate_name=>({certificate_name})));else if(key==='licenses')obj.licenses.push(...splitItems(v).map(license_type=>({license_type})));else if(key==='industries')obj.industries.push(...splitItems(v).map(industry_name=>({industry_name})));else if(key==='field')field=v;else if(key==='grade')grade=v;else if(key.startsWith('grade_')){if(v==='○'||v==='O'||v==='o'||v==='1'||v==='✓'||v==='✔')grade=key.slice(6);}else if((key==='hire_date'||key==='termination_date')&&/^\d{5}$/.test(v)){obj[key]=new Date((Number(v)-25569)*86400000).toISOString().slice(0,10);}else obj[key]=v;seen=true;}if(field||grade)obj.grades.push({technical_field:field,grade});if(obj.name&&!/^합계|소계|계$/.test(obj.name)){for(const k of ['certificates','grades','licenses','industries'])if(!obj[k].length)delete obj[k];rows.push(obj);}if(rows.length>3000)throw Error('한 번에 3,000명까지만 처리할 수 있습니다.');}if(!rows.length)throw Error('직원 자료가 없습니다. 헤더와 성명 열을 확인하세요.');return rows;}
function csvRows(text){const out=[];let row=[],field='',quote=false;for(let i=0;i<text.length;i++){const c=text[i];if(quote){if(c==='"'&&text[i+1]==='"'){field+='"';i++;}else if(c==='"')quote=false;else field+=c;}else if(c==='"')quote=true;else if(c===','){row.push(field);field='';}else if(c==='\n'){row.push(field);out.push(row);row=[];field='';}else if(c!=='\r')field+=c;}row.push(field);if(row.some(x=>x))out.push(row);return out;}
async function parseUpload(file){if(/\.csv$/i.test(file.name))return normalizeGrid(csvRows((await file.text()).replace(/^\ufeff/,'')));if(!/\.xlsx$/i.test(file.name))throw Error('xlsx 또는 CSV 파일만 올릴 수 있습니다.');return normalizeGrid(await readXlsx(file));}
let importRows=[];
function openImportModal(){setModal(`<div class="modal-shade" id="importModal"><div class="editor-card"><div class="editor-top"><h2>엑셀 일괄 업로드</h2><button type="button" data-close>✕</button></div><p class="muted">파일 내용은 먼저 브라우저에서 미리보기로 확인됩니다. 저장 전에는 서버로 전송하지 않습니다. 같은 사번이 있으면 기본적으로 건너뜁니다.</p><label>엑셀 파일 (.xlsx 또는 .csv)<input id="importFile" type="file" accept=".xlsx,.csv"></label><label>중복 처리<select id="importMode"><option value="skip">기존 직원 건너뛰기 (권장)</option><option value="upsert">기존 직원 덮어쓰기</option></select></label><div class="import-preview" id="importPreview">파일을 선택해 주세요.</div><p id="importStatus" role="status"></p><div class="editor-actions"><button type="button" data-close>취소</button><button class="primary" type="button" id="importConfirm" disabled>확인 후 저장</button></div></div></div>`);
 const input=document.getElementById('importFile'), status=document.getElementById('importStatus'),preview=document.getElementById('importPreview'),confirm=document.getElementById('importConfirm');importRows=[];
 input.onchange=async()=>{confirm.disabled=true;importRows=[];status.textContent='파일을 분석 중입니다…';try{const file=input.files[0];if(!file)return;if(file.size>5*1024*1024)throw Error('파일은 5MB 이하만 지원합니다.');importRows=await parseUpload(file);const duplicate=importRows.filter(x=>x.employee_no&&directoryRows.some(r=>r.employee_no===x.employee_no)).length;const missing=importRows.filter(x=>!x.employee_no).length;preview.innerHTML=`<strong>미리보기 ${importRows.length}명 · 기존 사번 중복 ${duplicate}명 · 사번 없음 ${missing}명</strong><div class="mini-scroll"><table><thead><tr><th>사번</th><th>성명</th><th>사업장</th><th>부서</th><th>자격증</th></tr></thead><tbody>${importRows.slice(0,20).map(x=>`<tr><td>${escapeHTML(x.employee_no||'')}</td><td>${escapeHTML(x.name)}</td><td>${escapeHTML(x.workplace||'')}</td><td>${escapeHTML(x.department||'')}</td><td>${escapeHTML(x.certificates.map(c=>c.certificate_name).join(' / '))}</td></tr>`).join('')}</tbody></table></div><small>미리보기 상위 20명 표시. 사번이 없는 직원은 이름·부서가 동일한 경우 중복으로 판단합니다.</small>`;confirm.disabled=false;status.textContent='검토한 뒤 저장을 눌러 주세요.';}catch(e){preview.textContent=e.message;status.textContent='';}};
 confirm.onclick=async()=>{if(!importRows.length)return;confirm.disabled=true;let created=0,updated=0,skipped=0,errors=[];for(let i=0;i<importRows.length;i+=10){status.textContent=`저장 중 ${Math.min(i+10,importRows.length)} / ${importRows.length}`;try{const res=await sendManage({action:'import',mode:document.getElementById('importMode').value,rows:importRows.slice(i,i+10)});for(const entry of res.results){if(entry.status==='created')created++;else if(entry.status==='updated')updated++;else if(entry.status==='skipped')skipped++;else errors.push(`${i+entry.row}행: ${entry.error||'오류'}`);}}catch(e){errors.push(`${i+1}~${i+10}행: ${e.message}`);break;}}
 status.textContent=`완료: 신규 ${created}명, 수정 ${updated}명, 건너뜀 ${skipped}명, 오류 ${errors.length}건${errors.length?'\n'+errors.slice(0,12).join('\n'):''}`;await load(view==='technical_staff'?'technical_staff':'employees');};}


// D1 기준 월말 재직 인원 추이: 관리 화면의 검색 필터와 무관한 전 직원 통계.
async function initHeadcountTrend(){
 const sel=$$('trendYear');
 if(!sel)return;
 const current=new Date().getFullYear();
 for(let y=current;y>=Math.max(2000,current-10);y--){const o=document.createElement('option');o.value=String(y);o.textContent=y+'년';sel.appendChild(o);}
 sel.onchange=()=>{drawHeadcountTrend(Number(sel.value));drawWorkplaceTrend(Number(sel.value));};
 await Promise.all([drawHeadcountTrend(current),drawWorkplaceTrend(current)]);
}
async function drawHeadcountTrend(year){
 const target=$$('trendChart');
 if(!target)return;
 target.innerHTML='<p class="muted">데이터를 불러오는 중입니다…</p>';
 try {
  const data=await fetchJSON('/api/headcount-trend?year='+year);
  if(!$$('trendChart')||view!=='dashboard')return;
  const months=data.months||[];
  if(months.length!==12)throw new Error('월별 데이터가 완전하지 않습니다.');
  const max=Math.max(1,...months.map(d=>d.headcount));
  const width=840, height=260, left=43, right=20, top=29, bottom=42;
  const plotW=width-left-right, plotH=height-top-bottom;
  const x=(i)=>left+(i+.5)*plotW/12;
  const y=(n)=>top+plotH*(1-n/max);
  const points=months.map((d,i)=>x(i)+','+y(d.headcount)).join(' ');
  const grid=[0,.25,.5,.75,1].map(t=>{
   const level=Math.round(max*t);const yy=y(max*t);
   return `<line x1="${left}" y1="${yy}" x2="${width-right}" y2="${yy}" stroke="#e5eaf0"/><text x="${left-8}" y="${yy+4}" text-anchor="end" font-size="12" fill="#64748b">${level}</text>`;
  }).join('');
  const labels=months.map((d,i)=>`<text x="${x(i)}" y="${height-18}" text-anchor="middle" font-size="12" fill="#475569">${d.month}월</text>`).join('');
  const dots=months.map((d,i)=>`<circle cx="${x(i)}" cy="${y(d.headcount)}" r="5" fill="#235a96"><title>${d.month}월 말 ${d.headcount}명</title></circle><text x="${x(i)}" y="${Math.max(13,y(d.headcount)-11)}" text-anchor="middle" font-size="12" fill="#142c49">${d.headcount}</text>`).join('');
  const lines=months.map((d,i)=>`<tr><td>${d.month}월</td><td>${d.headcount}명</td><td>${d.hires}명</td><td>${d.leaves}명</td><td>${i===0?'–':((d.headcount-months[i-1].headcount)>0?'+':'')+(d.headcount-months[i-1].headcount)+'명'}</td></tr>`).join('');
  target.innerHTML=`<div class="trend-scroll"><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${year}년 1월부터 12월까지 월말 재직 인원 꺾은선 그래프">${grid}<polyline points="${points}" fill="none" stroke="#235a96" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>${dots}${labels}</svg></div><details class="trend-details"><summary>월별 인원 상세표 보기</summary><div class="trend-table-scroll"><table><thead><tr><th>월</th><th>월말 재직</th><th>입사</th><th>퇴사</th><th>전월 대비</th></tr></thead><tbody>${lines}</tbody></table></div></details><p class="trend-note">※ 말일에 퇴사한 직원은 그 달 월말 재직 인원에서 제외합니다. 미래 월은 등록된 입·퇴사 예정일을 반영한 예상치입니다.</p>`;
 }catch(e){if($$('trendChart'))$$('trendChart').innerHTML=`<div class="error">${escapeHTML(e.message)}</div>`;}
}

// 사업장별 12개월 월말 재직 인원 비교: 전체 직원명부에서 사업장+입퇴사일 기준
async function drawWorkplaceTrend(year){
 const target=$$('workplaceChart');
 if(!target)return;
 const yearLabel=$$('workplaceYearLabel');
 if(yearLabel)yearLabel.textContent=year+'년';
 target.innerHTML='<p class="muted">사업장별 인원을 불러오는 중입니다…</p>';
 try {
  const result=await fetchJSON('/api/workplace-trend?year='+year);
  if(view!=='dashboard'||!$$('workplaceChart')||Number($$('trendYear')?.value)!==year)return;
  const a=result.months||[];
  if(a.length!==12)throw new Error('월별 사업장 자료를 확인할 수 없습니다.');
  const max=Math.max(1,...a.flatMap(d=>[d.osan,d.gwacheon]));
  const W=720,H=254,L=40,R=15,T=26,B=37,PW=W-L-R,PH=H-T-B;
  const x=i=>L+(i+.5)*PW/12;
  const y=n=>T+PH*(1-n/max);
  const series=[{key:'osan',name:'오산본사',color:'#2563a6'},{key:'gwacheon',name:'과천지사',color:'#e48b36'}];
  const grid=[0,.25,.5,.75,1].map(t=>`<line x1="${L}" y1="${y(max*t)}" x2="${W-R}" y2="${y(max*t)}" stroke="#e5eaf0"/><text x="${L-8}" y="${y(max*t)+4}" text-anchor="end" font-size="12" fill="#64748b">${Math.round(max*t)}</text>`).join('');
  const labels=a.map((d,i)=>`<text x="${x(i)}" y="${H-12}" text-anchor="middle" font-size="12" fill="#475569">${d.month}월</text>`).join('');
  const curves=series.map(s=>`<polyline points="${a.map((d,i)=>x(i)+','+y(d[s.key])).join(' ')}" fill="none" stroke="${s.color}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>${a.map((d,i)=>`<circle cx="${x(i)}" cy="${y(d[s.key])}" r="4" fill="${s.color}"><title>${d.month}월 ${s.name} ${d[s.key]}명</title></circle>`).join('')}`).join('');
  const rows=a.map(d=>`<tr><td>${d.month}월</td><td>${d.osan}명</td><td>${d.gwacheon}명</td><td>${d.unassigned}명</td></tr>`).join('');
  target.innerHTML=`<div class="workplace-legend"><span><i style="background:#2563a6"></i>오산본사</span><span><i style="background:#e48b36"></i>과천지사</span></div><div class="trend-scroll"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${year}년 오산본사와 과천지사의 월말 재직 인원 비교">${grid}${curves}${labels}</svg></div><details class="trend-details"><summary>사업장별 월별 인원표 보기</summary><div class="trend-table-scroll"><table><thead><tr><th>월</th><th>오산본사</th><th>과천지사</th><th>사업장 미지정·기타</th></tr></thead><tbody>${rows}</tbody></table></div></details><p class="trend-note">※ 직원명부의 사업장을 기준으로 계산합니다. 사업장 미지정·기타 인원은 별도 표에서 확인할 수 있습니다.</p>`;
 }catch(e){if($$('workplaceChart'))$$('workplaceChart').innerHTML=`<div class="error">${escapeHTML(e.message)}</div>`;}
}
