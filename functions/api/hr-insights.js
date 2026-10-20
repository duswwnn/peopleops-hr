import {authenticate,fail,json} from '../_lib/auth.js';

const kstDate=()=>{
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
 const part=k=>parts.find(x=>x.type===k)?.value;
 return `${part('year')}-${part('month')}-${part('day')}`;
};
const validDate=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x);
const addYear=s=>{
 const y=Number(s.slice(0,4)),m=Number(s.slice(5,7)),d=Number(s.slice(8,10));
 const dt=new Date(Date.UTC(y+1,m-1,d));
 return dt.toISOString().slice(0,10);
};
export async function onRequestGet({request,env}){
 try{
  await authenticate(request,env);
  const today=kstDate(),year=today.slice(0,4),start=`${year}-01-01`;
  const cutoff=new Date(Date.parse(today+'T00:00:00Z')+30*86400000).toISOString().slice(0,10);
  const [employeeResponse,transferResponse]=await Promise.all([
   env.DB.prepare('SELECT id,name,hire_date,termination_date,department FROM employees').all(),
   env.DB.prepare('SELECT employee_id,effective_date,from_workplace,to_workplace FROM workplace_transfers').all()
  ]);
  const employees=employeeResponse.results||[];
  const transferRows=transferResponse.results||[];
  const hasOccurred=date=>validDate(date)&&date<=today;
  const inYear=date=>hasOccurred(date)&&date>=start;
  const hires=employees.filter(e=>inYear(e.hire_date)).length;
  const leaves=employees.filter(e=>inYear(e.termination_date)).length;
  const transfers=transferRows.filter(t=>inYear(t.effective_date)).length;
  const anniversaries=employees.flatMap(e=>{
   if(!validDate(e.hire_date)||e.hire_date>today||(validDate(e.termination_date)&&e.termination_date<=today))return [];
   const oneYear=addYear(e.hire_date);
   return oneYear>=today&&oneYear<=cutoff?[{name:e.name,hire_date:e.hire_date,anniversary_date:oneYear,department:e.department||''}]:[];
  }).sort((a,b)=>a.anniversary_date.localeCompare(b.anniversary_date)||String(a.name).localeCompare(String(b.name),'ko'));
  const events=[];
  for(const e of employees){
   if(hasOccurred(e.hire_date))events.push({date:e.hire_date,name:e.name,type:'hire',id:e.id});
   if(hasOccurred(e.termination_date))events.push({date:e.termination_date,name:e.name,type:'leave',id:e.id});
  }
  const byId=new Map(employees.map(e=>[Number(e.id),e]));
  for(const t of transferRows){
   const person=byId.get(Number(t.employee_id));
   if(person&&hasOccurred(t.effective_date))events.push({date:t.effective_date,name:person.name,type:'transfer',id:t.employee_id,from_workplace:t.from_workplace||'',to_workplace:t.to_workplace||''});
  }
  events.sort((a,b)=>b.date.localeCompare(a.date)||({leave:0,transfer:1,hire:2}[a.type]-{leave:0,transfer:1,hire:2}[b.type])||Number(b.id)-Number(a.id));
  return json({today,hires,leaves,transfers,anniversaries,recent:events.slice(0,5)});
 }catch(e){return fail(e)}
}
