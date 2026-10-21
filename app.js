const $$=id=>document.getElementById(id);let me=null;let view='dashboard';
function escapeHTML(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
async function fetchJSON(url){const r=await fetch(url,{credentials:'same-origin',cache:'no-store'});if(!r.ok)throw new Error(`${r.status}: ${await r.text()}`);return r.json();}
function table(rows, koreanHeaders=false){if(!rows.length)return '<p class="muted">등록된 자료가 없습니다.</p>';const keys=Object.keys(rows[0]);const labels={name:'성명',hire_date:'입사일',termination_date:'퇴사일',department:'부서'};return `<div class="panel"><table><thead><tr>${keys.map(k=>`<th>${escapeHTML(koreanHeaders?(labels[k]||k):k)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${keys.map(k=>`<td>${escapeHTML(row[k])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;}
async function load(v){view=v;document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('selected',b.dataset.view===v));const titles={dashboard:'종합 대시보드',employees:'직원명부',technical_staff:'기술인력 보유현황표',certificates:'자격증',technical:'기술등급',licenses:'보유 면허',industries:'업종 등록',users:'인사팀 계정'};$$('title').textContent=titles[v];$$('body').textContent='자료를 조회하고 있습니다…';try{if(v==='dashboard'){
 $$('body').innerHTML=`<div id="hrInsights" class="hr-insights"><p class="muted">추가 인사 통계를 불러오는 중입니다…</p></div>
 <div class="dashboard-chart-grid"><section class="trend-panel"><div class="trend-heading"><div><h3>월별 재직 인원 추이</h3><p class="muted">각 월 말일 기준 · 입사일과 퇴사일로 계산</p></div><div class="trend-actions"><label>조회 연도 <select id="trendYear"></select></label><button type="button" id="downloadTrendExcel" class="export-excel">엑셀 다운로드 (.xlsx)</button></div></div><div id="trendChart" class="trend-chart"><p class="muted">인원 추이를 불러오고 있습니다…</p></div></section>
 <section class="trend-panel workplace-panel"><div class="trend-heading"><div><h3>사업장별 월말 재직 인원</h3><p class="muted">오산본사 · 과천지사 비교</p></div><span id="workplaceYearLabel" class="muted"></span></div><div id="workplaceChart" class="trend-chart"><p class="muted">사업장별 인원을 불러오는 중입니다…</p></div></section></div>
 <section id="hrRecentBottom" class="hr-recent-bottom"><div class="hr-recent-heading"><h3>최근 인사 변동 내역</h3><span class="muted">입사 · 퇴사 · 사업장 이동 / 최근 5건</span></div><div id="hrRecentBottomContent"><p class="muted">인사 변동 내역을 불러오는 중입니다…</p></div></section>`;
 await Promise.all([initHeadcountTrend(),loadHrInsights()]);return;}
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
 const type=(t)=>t.includes('산업기사')?'산업기사':t.includes('기능사')?'기능사':t.includes('기술사')?'기술사':t.endsWith('기사')?'기사':'';
 return type(s)||type(fallback);
}
function isDepartedEmployee(r){
 const termination=clean(r.termination_date).slice(0,10);
 // 퇴사일 당일부터 기술인력 보유현황표에서는 제외합니다.
 const today=new Date().toLocaleDateString('en-CA');
 return /^\d{4}-\d{2}-\d{2}$/.test(termination)&&termination<=today;
}
function filterTechnicalEmployees(rows,q='',f={}){
 return rows.filter(r=>{
  // 기술인력 표는 재직자만 조회합니다. 직원명부와 D1 원본은 변경하지 않습니다.
  if(isDepartedEmployee(r))return false;
  if(!r.certificates?.length&&!r.grades?.length&&!r.licenses?.length)return false;
  const words=[r.employee_no,r.name,r.department,r.workplace,r.job_title,...(r.grades||[]).map(x=>x.technical_field+' '+x.grade),...(r.certificates||[]).map(x=>x.certificate_name+' '+x.certificate_level),...(r.licenses||[]).map(x=>x.license_type),...(r.industries||[]).map(x=>x.industry_name)].join(' ').toLowerCase();
  if(q&&!words.includes(q))return false;
  const has=(arr,key,v)=>!v||(arr||[]).some(item=>clean(item[key]).includes(v));
  return (!f.workplace||r.workplace===f.workplace)&&(!f.department||r.department===f.department)&&has(r.grades,'grade',f.grade)&&has(r.grades,'technical_field',f.field)&&has(r.certificates,'certificate_name',f.certificate)&&has(r.licenses,'license_type',f.license);
 });
}
// 자격증 필터는 직원만이 아니라 해당 직원의 자격증 행에도 적용합니다.
// 기존 D1 데이터나 원본 directoryRows 객체는 변경하지 않습니다.
function matchingTechnicalCertificateRows(rows,certificate=''){
 const selected=clean(certificate);
 if(!selected)return rows;
 return rows.map(r=>({...r,certificates:(r.certificates||[]).filter(c=>clean(c.certificate_name)===selected)}));
}
// 직원명부: 입사일이 빠른 직원부터 표시하며 미입력자는 맨 아래로 배치합니다.
function sortEmployeesByHireDate(rows){
 return [...rows].sort((a,b)=>{
  const ad=String(a.hire_date||'').trim(), bd=String(b.hire_date||'').trim();
  // 입사일을 우선 정렬하고, 같은 입사일이면 사번의 자연스러운 오름차순으로 정렬합니다.
  if(ad!==bd){
   if(!ad)return 1;
   if(!bd)return -1;
   return ad.localeCompare(bd);
  }
  const an=String(a.employee_no??'').trim(), bn=String(b.employee_no??'').trim();
  if(!an&&!bn)return 0;
  if(!an)return 1;
  if(!bn)return -1;
  return an.localeCompare(bn,'ko',{numeric:true,sensitivity:'base'});
 });
}
function filterAllEmployees(rows,q='',site='',status='',department=''){
 const today=new Date().toLocaleDateString('en-CA');
 return sortEmployeesByHireDate(rows.filter(r=>{
  if(q&&!String([r.employee_no,r.name,r.department,r.job_title].join(' ')).toLowerCase().includes(q))return false;
  if(site&&r.workplace!==site)return false;
  if(department&&clean(r.department)!==department)return false;
  const active=(!r.hire_date||r.hire_date<=today)&&(!r.termination_date||r.termination_date>today);
  return !status||(status==='active'?active:!active&&!!r.termination_date&&r.termination_date<=today);
 }));
}
function drawDirectory(){
 const q=clean($$('dirSearch').value).toLowerCase();
 const keys=['workplace','department','grade','field','certificate','license'];
 const f=Object.fromEntries(keys.map(k=>[k,clean($$('dir_'+k).value)]));
 const filtered=sortEmployeesByHireDate(matchingTechnicalCertificateRows(filterTechnicalEmployees(directoryRows,q,f),f.certificate));
 const marks=['산업기사','기사','기능사','기술사'];
 const hasGrade=(r,g)=>r.grades.some(x=>clean(x.grade).includes(g));
 const countCertificates=g=>filtered.reduce((n,r)=>n+r.certificates.filter(c=>certificateType(c)===g).length,0);
 const uniqueCertPeople=g=>filtered.filter(r=>r.certificates.some(c=>certificateType(c)===g)).length;
 const countAll=filtered.reduce((n,r)=>n+r.certificates.length,0);
 const physicalRows=filtered.reduce((n,r)=>n+Math.max(1,r.certificates.length),0);
 $$('dirCount').textContent=`조회 직원 ${filtered.length}명 / 전체 기술인력 ${filterTechnicalEmployees(directoryRows).length}명 · 표시 자격증 ${countAll}건`;
 const totalGrades=gradeOrder.map(g=>filtered.filter(r=>hasGrade(r,g)).length);
 const totalCerts=marks.map(countCertificates);
 const totalUniqueCerts=marks.map(uniqueCertPeople);
 const licensed=filtered.filter(r=>r.licenses.length>0).length;
 const footer=`<tr class="excel-total-row"><th colspan="4">합계 (직원 ${filtered.length}명 · 자격증 ${countAll}건)</th><td class="field-col"></td>${totalGrades.map(n=>`<td>${n}명</td>`).join('')}<td>${countAll}건</td>${totalCerts.map(n=>`<td>${n}건</td>`).join('')}<td>${licensed}명</td></tr>`;
 const gradeMarks=(r,g)=>hasGrade(r,g)?'○':'';
 const technicalCell=(value)=>{const v=listText(value);return v?escapeHTML(v):'';};
 const makeRows=r=>{
  const certificates=r.certificates.length?r.certificates:[null];
  const span=certificates.length;
  const rowspan=span>1?` rowspan="${span}"`:'';
  // 동일 직원의 공통 정보는 실제 셀 병합(rowspan)으로 한 번만 출력합니다.
  // 자격증별 열은 각각 별도 행에 유지하여 검색 결과와 건수 합계를 보존합니다.
  return certificates.map((cert,index)=>{
    const first=index===0;
    const type=cert?certificateType(cert):'';
    const common=first?`
     <td class="workplace-col merged-person-cell"${rowspan}>${technicalCell(r.workplace)}</td>
     <td class="dept-col merged-person-cell"${rowspan}>${technicalCell(r.department)}</td>
     <td class="merged-person-cell"${rowspan}>${technicalCell(r.job_title)}</td>
     <td class="name-col merged-person-cell"${rowspan}><button type="button" class="employee-link" data-edit-id="${r.id}">${escapeHTML(r.name)}</button></td>
     <td class="field-col merged-person-cell"${rowspan}>${escapeHTML([...new Set(r.grades.map(x=>clean(x.technical_field)).filter(Boolean))].join(' / '))}</td>
     ${gradeOrder.map(g=>`<td class="mark merged-person-cell"${rowspan}>${gradeMarks(r,g)}</td>`).join('')}`:'';
    const license=first?`<td class="license-col merged-person-cell"${rowspan}>${technicalCell([...new Set(r.licenses.map(x=>x.license_type).map(clean).filter(Boolean))].join(' / '))}</td>`:'';
    return `<tr data-emp-id="${r.id}" class="${first?'person-first':'person-continuation'}">
     ${common}
     <td class="certificate-col">${cert?escapeHTML(cert.certificate_name):''}</td>
     ${marks.map(g=>`<td class="mark">${type===g?'○':''}</td>`).join('')}
     ${license}
    </tr>`;
  }).join('');
 };
 $$('dirResult').innerHTML=`<div class="excel-scroll"><table class="excel-directory"><colgroup><col style="width:120px"><col style="width:145px"><col style="width:110px"><col style="width:104px"><col style="width:112px">${Array(4).fill('<col style="width:67px">').join('')}<col style="width:188px">${Array(4).fill('<col style="width:75px">').join('')}<col style="width:245px"></colgroup><thead><tr class="group-header"><th rowspan="2">사 업 장</th><th rowspan="2">부 서</th><th rowspan="2">직 책</th><th rowspan="2">성 명</th><th colspan="5">건설기술인</th><th colspan="5">국가기술자격</th><th rowspan="2">등록 면허</th></tr><tr class="sub-header"><th>분야</th><th>초급</th><th>중급</th><th>고급</th><th>특급</th><th>자격증</th><th>산업기사</th><th>기사</th><th>기능사</th><th>기술사</th></tr></thead><tbody>${physicalRows?filtered.map(makeRows).join(''):'<tr><td class="empty-row" colspan="15">조회된 직원이 없습니다.</td></tr>'}</tbody><tfoot>${footer}</tfoot></table></div><p class="muted tiny">자격증은 1건당 1행으로 표시합니다. 기사·산업기사 합계는 자격증 개수(건), 기술등급 합계는 보유 직원 수(명)입니다. 동일 직원의 인원수는 중복 합산하지 않습니다. 필터 적용 시 합계가 함께 바뀝니다.</p>`;
}
async function showEmployeeDirectory(){
 const data=await fetchJSON('/api/directory');directoryRows=data.rows||[];
 const fields=[['workplace','사업장',r=>[r.workplace]],['department','부서',r=>[r.department]],['grade','기술등급',r=>r.grades.map(x=>x.grade)],['field','기술분야',r=>r.grades.map(x=>x.technical_field)],['certificate','국가기술자격',r=>r.certificates.map(x=>x.certificate_name)],['license','등록 면허',r=>r.licenses.map(x=>x.license_type)]];
 $$('body').innerHTML=`<section class="directory"><div class="directory-head"><div class="directory-actions"><button id="dirReset" type="button">필터 초기화</button><button id="dirExportAll" type="button" class="export-excel">전체 엑셀 다운로드</button><button id="dirExportFiltered" type="button" class="export-excel">조회 결과 다운로드</button></div></div><div class="directory-filters"><label class="directory-search">통합검색<input id="dirSearch" type="search" placeholder="성명·부서·자격증·면허 검색"></label>${fields.map(([k,label,getter])=>controlSelect('dir_'+k,label,k==='workplace'?['오산본사','과천지사']:uniqOpts(directoryRows,getter))).join('')}</div><p class="muted" id="dirCount"></p><div id="dirResult"></div><p class="muted tiny">좌우로 스크롤하여 모든 열을 확인할 수 있습니다. '○'는 해당 등급의 보유 기록을 뜻합니다. 맨 아래 기술등급 합계는 직원 수(명), 자격증 등급 합계는 실제 자격증 개수(건)로 계산합니다. 한 사람이 서로 다른 등급을 가진 경우 각 등급에 각각 포함됩니다. 등록 면허 열에는 면허·업종등록 내역을 함께 표시합니다. </p></section>`;
 $$('dirSearch').addEventListener('input',drawDirectory);fields.forEach(([key])=>$$('dir_'+key).addEventListener('change',drawDirectory));
 $$('dirResult').addEventListener('click',e=>{const target=e.target.closest('[data-edit-id]');if(target)openEmployeeEditor(directoryRows.find(r=>r.id===Number(target.dataset.editId)));});
 $$('dirReset').onclick=()=>{$$('dirSearch').value='';fields.forEach(([key])=>$$('dir_'+key).value='');drawDirectory()};
 $$('dirExportAll').onclick=()=>exportPeopleOpsExcel('technical',false,$$('dirExportAll'));
 $$('dirExportFiltered').onclick=()=>exportPeopleOpsExcel('technical',true,$$('dirExportFiltered'));
 drawDirectory();
}


async function showAllEmployees(){
 const d=await fetchJSON('/api/directory');
 directoryRows=d.rows||[];
 $$('body').innerHTML=`<section class="directory all-employees"><div class="directory-head"><div><p class="muted">자격증 보유 여부와 관계없이 전체 직원을 관리합니다. 종합 대시보드 인원 집계 기준입니다.</p></div><div class="directory-actions"><button id="allAdd" class="primary">+ 직원 추가</button><button id="allImport">엑셀 일괄 업로드</button><button id="allExportAll" type="button" class="export-excel">전체 엑셀 다운로드</button><button id="allExportFiltered" type="button" class="export-excel">조회 결과 다운로드</button></div></div><div class="directory-filters"><label>직원 검색<input id="allSearch" type="search" placeholder="사번·성명 검색"></label><label>사업장<select id="allWorkplace"><option value="">전체</option><option>오산본사</option><option>과천지사</option></select></label><label>부서<select id="allDepartment"><option value="">전체</option>${uniqOpts(directoryRows,r=>[r.department]).map(x=>`<option value="${escapeHTML(x)}">${escapeHTML(x)}</option>`).join('')}</select></label><label>재직 상태<select id="allStatus"><option value="">전체</option><option value="active">재직</option><option value="former">퇴사</option></select></label></div><p id="allCount" class="muted"></p><div id="allResult" class="excel-scroll"></div></section>`;
 const draw=()=>{
  const q=clean($$('allSearch').value).toLowerCase(),site=$$('allWorkplace').value,status=$$('allStatus').value,department=$$('allDepartment').value;
  const rows=filterAllEmployees(directoryRows,q,site,status,department);
  $$('allCount').textContent=`조회 ${rows.length}명 / 전체 ${directoryRows.length}명`;
  $$('allResult').innerHTML=`<table class="excel-directory all-staff-table"><thead><tr><th>사번</th><th>사업장</th><th>부서</th><th>직책</th><th>성명</th><th>입사일</th><th>퇴사일</th><th>자격증</th><th>사업장 이동</th><th>정보 수정</th></tr></thead><tbody>${rows.length?rows.map(r=>`<tr><td>${textOrDash(r.employee_no)}</td><td>${textOrDash(r.workplace)}</td><td>${textOrDash(r.department)}</td><td>${textOrDash(r.job_title)}</td><td>${escapeHTML(r.name)}</td><td>${textOrDash(r.hire_date)}</td><td>${textOrDash(r.termination_date)}</td><td>${r.certificates?.length||0}건</td><td><button class="employee-link" data-transfer-id="${r.id}">이력 관리</button></td><td><button class="employee-link" data-edit-id="${r.id}">수정</button></td></tr>`).join(''):'<tr><td colspan="10">조회된 직원이 없습니다.</td></tr>'}</tbody></table>`;
 };
 ['allSearch','allWorkplace','allDepartment','allStatus'].forEach(id=>$$ (id).addEventListener(id==='allSearch'?'input':'change',draw));
 $$('allAdd').onclick=()=>openEmployeeEditor();$$('allImport').onclick=openImportModal;
 $$('allExportAll').onclick=()=>exportPeopleOpsExcel('employees',false,$$('allExportAll'));
 $$('allExportFiltered').onclick=()=>exportPeopleOpsExcel('employees',true,$$('allExportFiltered'));
 $$('allResult').addEventListener('click',e=>{const transfer=e.target.closest('[data-transfer-id]');if(transfer){openWorkplaceHistory(directoryRows.find(r=>r.id===Number(transfer.dataset.transferId)));return;}let t=e.target.closest('[data-edit-id]');if(t)openEmployeeEditor(directoryRows.find(r=>r.id===Number(t.dataset.editId)))});
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
 <label>직책<input name="job_title" value="${val('job_title')}"></label><label>수습 종료일<input name="probation_end_date" type="date"></label><label>계약 만료일<input name="contract_end_date" type="date"></label><label>입사일<input name="hire_date" type="date" value="${val('hire_date')}"></label><label>퇴사일<input name="termination_date" type="date" value="${val('termination_date')}"></label></div>
 <div class="editor-grid"><label>국가기술자격증<textarea name="certs" placeholder="전기기사\n전기산업기사">${escapeHTML(cert)}</textarea></label><label>건설기술인 (분야 | 등급)<textarea name="grades" placeholder="전기 | 고급\n기계 | 중급">${escapeHTML(grades)}</textarea></label><label>등록 면허<textarea name="licenses" placeholder="전기공사업">${escapeHTML(licenses)}</textarea></label></div>
 <p id="editFeedback" role="status" class="error-line"></p><div class="editor-actions">${edit?'<button type="button" class="employee-delete" id="deleteEmployeeButton">직원 삭제</button>':''}<button type="button" data-close>취소</button><button class="primary" type="submit">${edit?'변경 내용 저장':'직원 등록'}</button></div></form></div>`;
}
function setModal(html){document.getElementById('modalRoot')?.remove();const root=document.createElement('div');root.id='modalRoot';root.innerHTML=html;document.body.append(root);root.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>root.remove());}
async function sendManage(payload){const r=await fetch('/api/manage',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify(payload)});const data=await r.json().catch(()=>({}));if(!r.ok)throw Error(data.error||`저장 실패 (${r.status})`);return data;}
function formEntry(form,original){const v=k=>form.elements.namedItem(k).value.trim();return {id:original?.id,employee_no:v('employee_no'),name:v('name'),workplace:v('workplace'),department:v('department'),job_title:v('job_title'),hire_date:v('hire_date'),termination_date:v('termination_date'),certificates:splitItems(v('certs')).map(certificate_name=>({certificate_name})),grades:splitItems(v('grades')).map(s=>{const [technical_field,grade]=s.split('|').map(x=>x.trim());return {technical_field,grade:grade||''}}),licenses:splitItems(v('licenses')).map(license_type=>({license_type}))};}
function openEmployeeEditor(employee){setModal(editorTemplate(employee));const form=document.getElementById('employeeForm');
 if(employee?.id){fetchJSON('/api/hr-schedule?employee_id='+encodeURIComponent(employee.id)).then(x=>{
  if(!form.isConnected)return;
  form.elements.namedItem('probation_end_date').value=x.probation_end_date||'';
  form.elements.namedItem('contract_end_date').value=x.contract_end_date||'';
 }).catch(e=>{const feedback=document.getElementById('editFeedback');if(feedback)feedback.textContent='예정 일정 조회 실패: '+e.message;});}

 const deleteButton=document.getElementById('deleteEmployeeButton');
 if(deleteButton&&employee){deleteButton.onclick=async()=>{
  const warning=`${employee.name} 직원의 모든 등록 정보를 완전히 삭제합니다.\n\n자격증·기술등급·등록면허·사업장 이동 이력도 함께 삭제되며 복구할 수 없습니다.\n퇴사 직원이라면 삭제하지 않고 퇴사일을 등록하세요.\n\n계속하려면 아래 입력창에 직원의 성명을 정확히 입력하세요.`;
  const answer=window.prompt(warning,'');
  if(answer===null)return;
  if(answer.trim()!==String(employee.name).trim()){window.alert('직원 성명이 일치하지 않아 삭제하지 않았습니다.');return;}
  if(!window.confirm(`정말 ${employee.name} 직원 정보를 영구 삭제하시겠습니까?`))return;
  const feedback=document.getElementById('editFeedback');deleteButton.disabled=true;
  try{await sendManage({action:'delete',employee_id:employee.id,confirm_name:answer.trim()});document.getElementById('modalRoot')?.remove();await load(view==='technical_staff'?'technical_staff':'employees');}
  catch(err){feedback.textContent=err.message;deleteButton.disabled=false;}
 };}
form.onsubmit=async e=>{e.preventDefault();const feedback=document.getElementById('editFeedback');const btn=form.querySelector('button[type=submit]');btn.disabled=true;try{const saved=await sendManage({action:'save',mode:employee?'update':'create',employee:formEntry(form,employee)});
 const savedId=employee?.id||saved.result?.id;
 if(!savedId)throw Error('직원 저장 결과에서 ID를 확인하지 못했습니다.');
 const scheduleResponse=await fetch('/api/hr-schedule',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({employee_id:savedId,probation_end_date:form.elements.namedItem('probation_end_date').value,contract_end_date:form.elements.namedItem('contract_end_date').value})});
 const scheduleResult=await scheduleResponse.json().catch(()=>({}));
 if(!scheduleResponse.ok)throw Error('직원정보는 저장됐지만 예정 일정 저장에 실패했습니다: '+(scheduleResult.error||scheduleResponse.status));
 document.getElementById('modalRoot').remove();await load(view==='technical_staff'?'technical_staff':'employees');}catch(err){feedback.textContent=err.message}finally{btn.disabled=false}};}
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



// D1의 두 집계 API에서 값을 읽어 Excel 2007+ (.xlsx) 1개 시트로 내보냅니다.
// 외부 CDN / 전송 없이 브라우저에서만 ZIP(OpenXML)을 생성합니다.
function excelXml(s){return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');}
function excelCol(n){let s='';for(n++;n;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s;}
function zipStored(entries){
 const encoder=new TextEncoder(),chunks=[],directory=[];let offset=0;
 const crcTable=new Uint32Array(256);for(let i=0;i<256;i++){let c=i;for(let k=0;k<8;k++)c=(c&1)?(0xEDB88320^(c>>>1)):(c>>>1);crcTable[i]=c>>>0;}
 const crc32=b=>{let c=0xFFFFFFFF;for(const x of b)c=crcTable[(c^x)&255]^(c>>>8);return (c^0xFFFFFFFF)>>>0;};
 const u16=(v)=>[v&255,(v>>>8)&255],u32=v=>[v&255,(v>>>8)&255,(v>>>16)&255,(v>>>24)&255];
 for(const [filename,body] of entries){
  const name=encoder.encode(filename),data=encoder.encode(body),crc=crc32(data);
  const local=new Uint8Array([80,75,3,4,20,0,0,8,0,0,0,0,0,0,...u32(crc),...u32(data.length),...u32(data.length),...u16(name.length),0,0]);
  chunks.push(local,name,data);
  directory.push({name,crc,size:data.length,offset});offset+=local.length+name.length+data.length;
 }
 let dirLength=0;
 for(const e of directory){
  const head=new Uint8Array([80,75,1,2,20,0,20,0,0,8,0,0,0,0,0,0,...u32(e.crc),...u32(e.size),...u32(e.size),...u16(e.name.length),0,0,0,0,0,0,0,0,0,0,0,0,...u32(e.offset)]);
  chunks.push(head,e.name);dirLength+=head.length+e.name.length;
 }
 chunks.push(new Uint8Array([80,75,5,6,0,0,0,0,...u16(directory.length),...u16(directory.length),...u32(dirLength),...u32(offset),0,0]));
 return new Blob(chunks,{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
}
function createHeadcountWorkbook(year,rows){
 const headers=['월','전체 월말 재직(명)','입사(명)','퇴사(명)','전월 대비(명)','오산본사(명)','과천지사(명)','사업장 미지정·기타(명)'];
 const cells=[headers,...rows];
 const xmlRows=cells.map((r,ri)=>`<row r="${ri+1}">${r.map((v,ci)=>{
  const ref=excelCol(ci)+(ri+1);
  return typeof v==='number'&&Number.isFinite(v)?`<c r="${ref}"><v>${v}</v></c>`:`<c r="${ref}" t="inlineStr"><is><t>${excelXml(v)}</t></is></c>`;
 }).join('')}</row>`).join('');
 const sheet=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:H${cells.length}"/><sheetViews><sheetView workbookViewId="0"/></sheetViews><sheetFormatPr defaultRowHeight="15"/><sheetData>${xmlRows}</sheetData><autoFilter ref="A1:H${cells.length}"/></worksheet>`;
 const wb='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="월별 인원 현황" sheetId="1" r:id="rId1"/></sheets></workbook>';
 const rel='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>';
 const rootrel='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>';
 const types='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>';
 return zipStored([['[Content_Types].xml',types],['_rels/.rels',rootrel],['xl/workbook.xml',wb],['xl/_rels/workbook.xml.rels',rel],['xl/worksheets/sheet1.xml',sheet]]);
}

// 직원명부/기술인력 현황 엑셀(.xlsx) - 동일 인증 세션의 D1 데이터를 사용합니다.
function createPeopleOpsWorkbook(title,headers,records){
 const cells=[headers,...records];
 const rowXml=cells.map((r,ri)=>`<row r="${ri+1}">${r.map((v,ci)=>{
  const ref=excelCol(ci)+(ri+1);
  return typeof v==='number'&&Number.isFinite(v)?`<c r="${ref}"><v>${v}</v></c>`:`<c r="${ref}" t="inlineStr"><is><t>${excelXml(v)}</t></is></c>`;
 }).join('')}</row>`).join('');
 const last=excelCol(headers.length-1),endRow=cells.length;
 const sheet=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:${last}${endRow}"/><sheetViews><sheetView workbookViewId="0"/></sheetViews><sheetFormatPr defaultRowHeight="18"/><sheetData>${rowXml}</sheetData><autoFilter ref="A1:${last}${endRow}"/></worksheet>`;
 const wb=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${excelXml(title)}" sheetId="1" r:id="rId1"/></sheets></workbook>`;
 const rel='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>';
 const rootrel='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>';
 const types='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>';
 return zipStored([['[Content_Types].xml',types],['_rels/.rels',rootrel],['xl/workbook.xml',wb],['xl/_rels/workbook.xml.rels',rel],['xl/worksheets/sheet1.xml',sheet]]);
}
function peopleOpsExcelRows(mode,rows){
 if(mode==='employees')return {
  title:'직원명부',headers:['사번','사업장','부서','직책','성명','입사일','퇴사일','자격증 보유 건수'],
  records:rows.map(r=>[r.employee_no||'',r.workplace||'',r.department||'',r.job_title||'',r.name||'',r.hire_date||'',r.termination_date||'',r.certificates?.length||0])
 };
 const marks=['산업기사','기사','기능사','기술사'];
 const hasGrade=(r,g)=>(r.grades||[]).some(x=>clean(x.grade).includes(g));
 const headers=['사업장','부서','직책','성명','건설기술인 분야','초급','중급','고급','특급','자격증','산업기사','기사','기능사','기술사','등록 면허'];
 const records=[];
 for(const r of rows){
  const certs=r.certificates?.length?r.certificates:[null];
  for(const [i,cert] of certs.entries()){
   const type=cert?certificateType(cert):'';
   records.push([i?'':r.workplace||'',i?'':r.department||'',i?'':r.job_title||'',r.name||'',i?'':[...new Set((r.grades||[]).map(g=>clean(g.technical_field)).filter(Boolean))].join(' / '),...gradeOrder.map(g=>i?'':hasGrade(r,g)?'○':''),cert?.certificate_name||'',...marks.map(t=>type===t?'○':''),i?'':[...new Set((r.licenses||[]).map(l=>clean(l.license_type)).filter(Boolean))].join(' / ')]);
  }
 }
 records.push(['합계 (직원 '+rows.length+'명 / 자격증 '+rows.reduce((n,r)=>n+(r.certificates?.length||0),0)+'건)','','','','',...gradeOrder.map(g=>rows.filter(r=>hasGrade(r,g)).length),rows.reduce((n,r)=>n+(r.certificates?.length||0),0),...marks.map(type=>rows.reduce((n,r)=>n+(r.certificates||[]).filter(c=>certificateType(c)===type).length,0)),rows.filter(r=>r.licenses?.length).length]);
 return {title:'기술인력 보유현황표',headers,records};
}
async function exportPeopleOpsExcel(mode,filtered,button){
 const old=button.textContent;button.disabled=true;button.textContent='엑셀 생성 중…';
 try{
  // 다운로드 직전 서버 데이터를 다시 읽어 화면 갱신 전 누락을 방지합니다.
  const d=await fetchJSON('/api/directory');
  let rows=d.rows||[];
  if(mode==='employees'){
   rows=filtered?filterAllEmployees(rows,clean($$('allSearch')?.value).toLowerCase(),$$('allWorkplace')?.value||'', $$('allStatus')?.value||'', $$('allDepartment')?.value||''):sortEmployeesByHireDate(rows);
  }else{
   const q=filtered?clean($$('dirSearch')?.value).toLowerCase():'';
   const keys=['workplace','department','grade','field','certificate','license'];
   const f=Object.fromEntries(keys.map(k=>[k,filtered?clean($$('dir_'+k)?.value):'']));
   rows=sortEmployeesByHireDate(matchingTechnicalCertificateRows(filterTechnicalEmployees(rows,q,f),f.certificate));
  }
  const {title,headers,records}=peopleOpsExcelRows(mode,rows);
  const blob=createPeopleOpsWorkbook(title,headers,records);
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;
  a.download=`PeopleOps_${mode==='employees'?'직원명부':'기술인력보유현황표'}_${filtered?'조회결과':'전체'}_${new Date().toISOString().slice(0,10)}.xlsx`;
  document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);
 }catch(e){alert('엑셀 다운로드 실패: '+e.message)}finally{button.disabled=false;button.textContent=old;}
}
// 월말 재직 인원은 해당 월 마지막 날이 실제로 지난 경우에만 확정값으로 표시합니다.
// 현재 월(진행 중) 및 미래 월은 비워 두며, 지난 연도의 12개월은 전부 표시합니다.
function isCompletedMonth(year, month){
 const today=new Date();
 const end=new Date(Number(year),Number(month),0);
 return end.getFullYear()<today.getFullYear() ||
  (end.getFullYear()===today.getFullYear() && end.getMonth()<today.getMonth());
}

async function downloadTrendExcel(year,btn){
 if(!Number.isInteger(year))return;
 btn.disabled=true;const old=btn.textContent;btn.textContent='엑셀 생성 중…';
 try{
  const [total,work]=await Promise.all([fetchJSON('/api/headcount-trend?year='+year),fetchJSON('/api/workplace-trend?year='+year)]);
  if((total.months||[]).length!==12||(work.months||[]).length!==12)throw new Error('12개월 데이터가 완전하지 않습니다.');
  const workplaces=new Map(work.months.map(r=>[Number(r.month),r]));
  const rows=total.months.map((r,i)=>{
   const w=workplaces.get(Number(r.month));if(!w)throw new Error('사업장 월별 자료가 누락됐습니다.');
   if(!isCompletedMonth(year,Number(r.month)))return [r.month+'월','','','','','','',''];
   const prev=total.months[i-1];
   return [r.month+'월',Number(r.headcount)||0,Number(r.hires)||0,Number(r.leaves)||0,i?Number(r.headcount)-Number(prev.headcount):'',Number(w.osan)||0,Number(w.gwacheon)||0,Number(w.unassigned)||0];
  });
  const blob=createHeadcountWorkbook(year,rows),url=URL.createObjectURL(blob),link=document.createElement('a');
  link.href=url;link.download=`PeopleOps_${year}년_월별재직인원.xlsx`;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }catch(e){alert('엑셀 다운로드 실패: '+e.message);}finally{btn.disabled=false;btn.textContent=old;}
}

// D1 기준 월말 재직 인원 추이: 관리 화면의 검색 필터와 무관한 전 직원 통계.
async function initHeadcountTrend(){
 const sel=$$('trendYear');
 if(!sel)return;
 const current=new Date().getFullYear();
 for(let y=current;y>=Math.max(2000,current-10);y--){const o=document.createElement('option');o.value=String(y);o.textContent=y+'년';sel.appendChild(o);}
 sel.onchange=()=>{drawHeadcountTrend(Number(sel.value));drawWorkplaceTrend(Number(sel.value));};
 const exportBtn=$$('downloadTrendExcel');if(exportBtn)exportBtn.onclick=()=>downloadTrendExcel(Number(sel.value),exportBtn);
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
  const completed=months.filter(d=>isCompletedMonth(year,d.month));
  const max=Math.max(1,...completed.map(d=>d.headcount));
  const width=840, height=260, left=43, right=20, top=29, bottom=42;
  const plotW=width-left-right, plotH=height-top-bottom;
  const x=(i)=>left+(i+.5)*plotW/12;
  const y=(n)=>top+plotH*(1-n/max);
  const points=months.map((d,i)=>isCompletedMonth(year,d.month)?x(i)+','+y(d.headcount):null).filter(Boolean).join(' ');
  const grid=[0,.25,.5,.75,1].map(t=>{
   const level=Math.round(max*t);const yy=y(max*t);
   return `<line x1="${left}" y1="${yy}" x2="${width-right}" y2="${yy}" stroke="#e5eaf0"/><text x="${left-8}" y="${yy+4}" text-anchor="end" font-size="12" fill="#64748b">${level}</text>`;
  }).join('');
  const labels=months.map((d,i)=>`<text x="${x(i)}" y="${height-18}" text-anchor="middle" font-size="12" fill="#475569">${d.month}월</text>`).join('');
  const dots=months.map((d,i)=>!isCompletedMonth(year,d.month)?'':`<circle cx="${x(i)}" cy="${y(d.headcount)}" r="5" fill="#A6A1DE"><title>${d.month}월 말 ${d.headcount}명</title></circle><text x="${x(i)}" y="${Math.max(13,y(d.headcount)-11)}" text-anchor="middle" font-size="12" fill="#142c49">${d.headcount}</text>`).join('');
  const lines=months.map((d,i)=>!isCompletedMonth(year,d.month)?`<tr><td>${d.month}월</td><td colspan="4" style="color:#94a3b8;text-align:center">미마감</td></tr>`:`<tr><td>${d.month}월</td><td>${d.headcount}명</td><td>${d.hires}명</td><td>${d.leaves}명</td><td>${i===0?'–':((d.headcount-months[i-1].headcount)>0?'+':'')+(d.headcount-months[i-1].headcount)+'명'}</td></tr>`).join('');
  target.innerHTML=`<div class="trend-scroll"><svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" style="width:100%;height:240px;display:block" role="img" aria-label="${year}년 1월부터 12월까지 월말 재직 인원 꺾은선 그래프">${grid}<polyline points="${points}" fill="none" stroke="#A6A1DE" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>${dots}${labels}</svg></div><details class="trend-details"><summary>월별 인원 상세표 보기</summary><div class="trend-table-scroll"><table><thead><tr><th>월</th><th>월말 재직</th><th>입사</th><th>퇴사</th><th>전월 대비</th></tr></thead><tbody>${lines}</tbody></table></div></details><p class="trend-note">※ 월말 당일 퇴사한 직원도 해당 월의 월말 재직 인원에 포함합니다. 현재 월과 미래 월의 월말 인원은 마감 전이므로 표시하지 않습니다.</p>`;
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
  const completed=a.filter(d=>isCompletedMonth(year,d.month));
  const max=Math.max(1,...completed.flatMap(d=>[d.osan,d.gwacheon]));
  const W=840,H=260,L=43,R=20,T=29,B=42,PW=W-L-R,PH=H-T-B;
  const x=i=>L+(i+.5)*PW/12;
  const y=n=>T+PH*(1-n/max);
  const series=[{key:'osan',name:'오산본사',color:'#A6A1DE'},{key:'gwacheon',name:'과천지사',color:'#F3C58C'}];
  const grid=[0,.25,.5,.75,1].map(t=>`<line x1="${L}" y1="${y(max*t)}" x2="${W-R}" y2="${y(max*t)}" stroke="#e5eaf0"/><text x="${L-8}" y="${y(max*t)+4}" text-anchor="end" font-size="12" fill="#64748b">${Math.round(max*t)}</text>`).join('');
  const labels=a.map((d,i)=>`<text x="${x(i)}" y="${H-12}" text-anchor="middle" font-size="12" fill="#475569">${d.month}월</text>`).join('');
  const curves=series.map(s=>{
   const labelDy=s.key==='osan'?-10:16;
   return `<polyline points="${a.map((d,i)=>isCompletedMonth(year,d.month)?x(i)+','+y(d[s.key]):null).filter(Boolean).join(' ')}" fill="none" stroke="${s.color}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>${a.map((d,i)=>{
    if(!isCompletedMonth(year,d.month))return '';
    const cy=y(d[s.key]);
    const labelY=Math.max(14,Math.min(H-8,cy+labelDy));
    return `<circle cx="${x(i)}" cy="${cy}" r="4" fill="${s.color}"><title>${d.month}월 ${s.name} ${d[s.key]}명</title></circle><text x="${x(i)}" y="${labelY}" text-anchor="middle" font-size="12" font-weight="600" fill="${s.color}">${d[s.key]}</text>`;
   }).join('')}`;
  }).join('');
  const rows=a.map(d=>isCompletedMonth(year,d.month)?`<tr><td>${d.month}월</td><td>${d.osan}명</td><td>${d.gwacheon}명</td></tr>`:`<tr><td>${d.month}월</td><td colspan="2" style="color:#94a3b8;text-align:center">미마감</td></tr>`).join('');
  target.style.position='relative';
  target.innerHTML=`<div class="workplace-legend" style="position:absolute;top:-24px;right:0;margin:0;z-index:1"><span><i style="background:#A6A1DE"></i>오산본사</span><span><i style="background:#F3C58C"></i>과천지사</span></div><div class="trend-scroll"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style="width:100%;height:240px;display:block" role="img" aria-label="${year}년 오산본사와 과천지사의 월말 재직 인원 비교">${grid}${curves}${labels}</svg></div><details class="trend-details"><summary>사업장별 월별 인원표 보기</summary><div class="trend-table-scroll"><table><thead><tr><th>월</th><th>오산본사</th><th>과천지사</th></tr></thead><tbody>${rows}</tbody></table></div></details>`;
 }catch(e){if($$('workplaceChart'))$$('workplaceChart').innerHTML=`<div class="error">${escapeHTML(e.message)}</div>`;}
}


// 인사발령: 직원 원본은 유지하고 별도의 사업장 이동 이력에 날짜별 이동 기록을 저장합니다.
async function openWorkplaceHistory(employee){
 if(!employee)return;
 document.getElementById('historyModal')?.remove();
 const dialog=document.createElement('div');dialog.id='historyModal';dialog.className='modal-shade';
 dialog.innerHTML=`<div class="editor-card hr-history-card"><div class="editor-top"><h2>${escapeHTML(employee.name)} · 사업장 이동 이력</h2><button type="button" data-close-history>✕</button></div>
 <p class="muted">현재 사업장: <strong>${escapeHTML(employee.workplace||'미지정')}</strong> · 이동일을 기준으로 과거 월별 인원이 계산됩니다.</p>
 <div id="historyList"><p class="muted">이력을 조회하는 중입니다…</p></div>
 <form id="historyForm" class="hr-history-form"><label>이동일<input type="date" name="effective_date" required></label><label>이동할 사업장<select name="to_workplace" required><option value="">선택</option><option value="오산본사">오산본사</option><option value="과천지사">과천지사</option></select></label><label>발령 메모 (선택)<input name="notes" maxlength="200" placeholder="예: 지사 전근"></label><button class="primary" type="submit">이동 이력 등록</button></form>
 <p class="muted tiny">과거 이력 수정·삭제는 현재 지원하지 않습니다. 잘못 입력한 경우 관리자 확인 후 데이터 정정이 필요합니다. 같은 직원의 이동은 날짜 순서대로 등록하세요.</p></div>`;
 document.body.appendChild(dialog);
 dialog.querySelector('[data-close-history]').onclick=()=>dialog.remove();
 dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.remove()});
 async function refresh(){
  try{
   const d=await fetchJSON('/api/workplace-history?employee_id='+employee.id);
   const records=d.rows||[];
   dialog.querySelector('#historyList').innerHTML=records.length?`<div class="trend-table-scroll"><table><thead><tr><th>이동일</th><th>이전 사업장</th><th>새 사업장</th><th>메모</th></tr></thead><tbody>${records.map(r=>`<tr><td>${escapeHTML(r.effective_date)}</td><td>${escapeHTML(r.from_workplace||'미지정')}</td><td>${escapeHTML(r.to_workplace)}</td><td>${escapeHTML(r.notes||'')}</td></tr>`).join('')}</tbody></table></div>`:'<p class="muted">등록된 이동 이력이 없습니다.</p>';
  }catch(e){dialog.querySelector('#historyList').innerHTML=`<p class="error">${escapeHTML(e.message)} · D1 마이그레이션을 먼저 실행해 주세요.</p>`;}
 }
 dialog.querySelector('#historyForm').onsubmit=async e=>{
  e.preventDefault();const form=e.currentTarget;const submit=form.querySelector('button[type=submit]');submit.disabled=true;
  try{
   const payload={employee_id:employee.id,effective_date:form.elements.effective_date.value,to_workplace:form.elements.to_workplace.value,notes:form.elements.notes.value};
   const res=await fetch('/api/workplace-history',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify(payload)});
   const result=await res.json();if(!res.ok)throw new Error(result.error||'이동 이력 저장 실패');
   await refresh();form.reset();
   await showAllEmployees(); // 직원명부에 최신 사업장 반영
   alert('사업장 이동 이력이 등록되었습니다. 월별 그래프에도 반영됩니다.');
  }catch(err){alert(err.message)}finally{submit.disabled=false;}
 };
 await refresh();
}

async function loadHrInsights(){
 const box=$$('hrInsights');if(!box)return;
 try{
  const d=await fetchJSON('/api/hr-insights');
  let schedule=null;let scheduleError='';
  try{schedule=await fetchJSON('/api/hr-schedule')}catch(e){scheduleError=e.message}
  if(view!=='dashboard'||!$$('hrInsights'))return;
  const entries=Array.isArray(d.recent)?d.recent:[];
  const due=Array.isArray(d.anniversaries)?d.anniversaries:[];
  const metric=(label,value,note,icon)=>`<div class="hr-kpi"><small>${icon} ${label}</small><strong>${value}</strong><span class="hr-kpi-note">${note}</span></div>`;
  const types={hire:'입사',leave:'퇴사',transfer:'사업장 이동'};
  const dateLabel=s=>/^\d{4}-\d{2}-\d{2}$/.test(s||'')?`${s.slice(5,7)}.${s.slice(8,10)}`:escapeHTML(s||'');
  const recent=entries.length?`<div class="hr-recent-scroll"><table class="hr-recent-table"><thead><tr><th>날짜</th><th>직원</th><th>구분</th></tr></thead><tbody>${entries.map(r=>`<tr><td>${dateLabel(r.date)}</td><td>${escapeHTML(r.name)}</td><td><span class="hr-event-label hr-event-${escapeHTML(r.type)}">${types[r.type]||'기타'}${r.type==='transfer'&&r.from_workplace&&r.to_workplace?` · ${escapeHTML(String(r.from_workplace).replace(/본사$|지사$/g,''))}→${escapeHTML(String(r.to_workplace).replace(/본사$|지사$/g,''))}`:''}</span></td></tr>`).join('')}</tbody></table></div>`:'<p class="muted">최근 인사 변동 내역이 없습니다.</p>';
  const scheduleEvents=Array.isArray(schedule?.events)?schedule.events:[];
  const scheduleRows=(type)=>scheduleEvents.filter(x=>x.type===type);
  const scheduleTable=(rows,type)=>rows.length?`<div class="hr-recent-scroll"><table class="hr-recent-table"><thead><tr><th>직원</th><th>예정일</th><th>부서</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${escapeHTML(r.name)}</td><td>${escapeHTML(r.due_date)}</td><td>${escapeHTML(r.department||'')}</td></tr>`).join('')}</tbody></table></div>`:`<p class="muted">향후 30일 이내 ${type} 예정자가 없습니다.</p>`;
  const detail=`<details class="hr-anniversary-details hr-schedule-integrated"><summary>인사업무 예정일정 · 상세보기</summary><div class="hr-schedule-integrated-body">
    <section class="hr-schedule-group"><h4>입사 1주년 예정자 <span>${due.length}명</span></h4>${due.length?`<div class="hr-recent-scroll"><table class="hr-recent-table"><thead><tr><th>직원</th><th>입사일</th><th>1주년 예정일</th><th>부서</th></tr></thead><tbody>${due.map(r=>`<tr><td>${escapeHTML(r.name)}</td><td>${escapeHTML(r.hire_date)}</td><td>${escapeHTML(r.anniversary_date)}</td><td>${escapeHTML(r.department||'')}</td></tr>`).join('')}</tbody></table></div>`:'<p class="muted">향후 30일 이내 입사 1주년 예정자가 없습니다.</p>'}</section>
    <section class="hr-schedule-group"><h4>수습기간 종료 예정 <span>${scheduleRows('probation').length}명</span></h4>${scheduleError?`<p class="muted">일정 조회 오류: ${escapeHTML(scheduleError)}</p>`:scheduleTable(scheduleRows('probation'),'수습 종료')}</section>
    <section class="hr-schedule-group"><h4>계약 만료 예정 <span>${scheduleRows('contract').length}명</span></h4>${scheduleError?`<p class="muted">일정 조회 오류: ${escapeHTML(scheduleError)}</p>`:scheduleTable(scheduleRows('contract'),'계약 만료')}</section>
  </div></details>`;
  const recentBottom=$$('hrRecentBottomContent');if(recentBottom)recentBottom.innerHTML=recent;
  box.innerHTML=`<div class="hr-insight-title"><h3>인사관리 인사이트</h3><span class="muted">${escapeHTML(d.today)} 기준</span></div>
   <div class="hr-kpis">
    ${metric('올해 입사자',`${Number(d.hires)||0}명`,'1월~현재','↗')}
    ${metric('올해 퇴사자',`${Number(d.leaves)||0}명`,'1월~현재','↘')}
    ${metric('올해 사업장 이동',`${Number(d.transfers)||0}건`,'오산 ↔ 과천','⇄')}
    ${metric('입사 1주년 예정',`${due.length}명`,'향후 30일 이내','◷')}
   </div>${detail}`;
 }catch(err){if($$('hrInsights'))$$('hrInsights').innerHTML=`<p class="muted">인사관리 인사이트를 불러오지 못했습니다: ${escapeHTML(err.message)}</p>`;if($$('hrRecentBottomContent'))$$('hrRecentBottomContent').innerHTML=`<p class="muted">인사 변동 내역을 불러오지 못했습니다.</p>`;}
}


async function loadHrSchedule(){
 const target=$$('hrSchedule');if(!target)return;
 try{
  const data=await fetchJSON('/api/hr-schedule');if(!$$('hrSchedule')||view!=='dashboard')return;
  const ev=data.events||[];
  const dates=ev.length?`<div class="hr-schedule-table-wrap"><table class="hr-schedule-table"><thead><tr><th>예정일</th><th>직원</th><th>부서</th><th>구분</th></tr></thead><tbody>${ev.map(x=>`<tr><td>${escapeHTML(x.due_date)}</td><td>${escapeHTML(x.name)}</td><td>${escapeHTML(x.department)}</td><td><span class="hr-schedule-tag ${x.type==='contract'?'contract':'probation'}">${x.type==='contract'?'계약 만료':'수습 종료'}</span></td></tr>`).join('')}</tbody></table></div>`:'<p class="muted">향후 30일 내 예정된 수습 종료·계약 만료 일정이 없습니다.</p>';
  target.innerHTML=`<div class="hr-schedule-summary"><div><span>수습기간 종료 예정</span><strong>${Number(data.probation_count)||0}명</strong></div><div><span>계약 만료 예정</span><strong>${Number(data.contract_count)||0}명</strong></div></div>${dates}<p class="muted tiny">직원명부 → 직원 수정에서 수습 종료일과 계약 만료일을 입력하면 자동 반영됩니다.</p>`;
 }catch(e){if(target.isConnected)target.innerHTML='<p class="error">일정을 불러오지 못했습니다: '+escapeHTML(e.message)+'</p>';}
}
