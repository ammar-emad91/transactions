window.onerror=function(m,u,l){var a=document.getElementById('app');if(a){var p=document.createElement('p');p.style.cssText='color:#ff7b72;direction:ltr;text-align:left;padding:8px';p.textContent='خطأ: '+m+' (سطر '+l+')';a.append(p);}};
const pad=n=>String(n).padStart(2,'0');
const START=199000, PER_DAY=365, D0=Date.UTC(2023,0,1), D1=Date.UTC(2028,11,31);
const MN=['January','February','March','April','May','June','July','August','September','October','November','December'];
const $app=document.getElementById('app');
let sb=null, session=null, names=Array.from({length:10},(_,i)=>'الشركة '+(i+1));
let sel=null, dateVal=clampToday(), result=null, busy=false, tab='main', histRows=[], timer=null;

function h(tag,props={},...kids){const e=document.createElement(tag);
  for(const k in props){if(k==='class')e.className=props[k];else if(k.startsWith('on'))e[k]=props[k];else e.setAttribute(k,props[k]);}
  kids.flat().forEach(c=>e.append(c instanceof Node?c:document.createTextNode(c)));return e;}
function clampToday(){const n=new Date();let t=Date.UTC(n.getFullYear(),n.getMonth(),n.getDate());
  t=Math.min(Math.max(t,D0),D1);const d=new Date(t);return d.getUTCFullYear()+'-'+pad(d.getUTCMonth()+1)+'-'+pad(d.getUTCDate());}
const dateOf=i=>{const d=new Date(D0+i*864e5);return d.getUTCFullYear()+'-'+pad(d.getUTCMonth()+1)+'-'+pad(d.getUTCDate());};

async function loadNames(){
  const {data}=await sb.from('config').select('names').eq('id',1).maybeSingle();
  if(data&&Array.isArray(data.names)&&data.names.length===10) names=data.names;
}
async function loadHistory(){
  if(sel===null||!session){histRows=[];paintHistory();return;}
  const c=sel;
  const {data,error}=await sb.from('allocations').select('num,alloc_date').eq('company',c).order('num',{ascending:false}).limit(1000);
  if(c!==sel) return;
  histRows=error?[]:data; paintHistory();
}
function startPolling(){clearInterval(timer);timer=setInterval(()=>{if(tab==='main'&&session)loadHistory();},10000);}
function paintHistory(){
  const box=document.getElementById('hist'); if(!box) return; box.textContent='';
  if(!histRows.length){box.append(h('p',{class:'msg'},'لا توجد أرقام محفوظة لهذه الشركة بعد'));return;}
  const by={}; histRows.forEach(r=>{(by[r.alloc_date]=by[r.alloc_date]||[]).push(r.num);});
  Object.keys(by).sort().reverse().slice(0,150).forEach(d=>{const it=by[d].sort((a,b)=>a-b);
    box.append(h('details',{class:'day'},h('summary',{},d+' — '+it.length+' رقم — آخر رقم '+it[it.length-1]),h('div',{class:'nums'},it.join('  '))));});
}
async function doLookup(){
  const v=Number(document.getElementById('lk').value), out=document.getElementById('lkout');
  if(!Number.isInteger(v)||v<START||v>999999){out.className='msg err';out.textContent='أدخل رقماً بين 199000 و 999999';return;}
  if(sel===null){out.className='msg err';out.textContent='اختر الشركة أولاً';return;}
  const idx=Math.floor((v-START)/PER_DAY); if(idx>2191){out.className='msg err';out.textContent='الرقم خارج نطاق التواريخ';return;}
  const {data}=await sb.from('allocations').select('num').eq('company',sel).eq('num',v).maybeSingle();
  out.className='msg'; out.textContent=(data?'✔ الرقم مستخدم':'○ الرقم غير مستخدم')+' — تاريخه '+dateOf(idx)+' — '+names[sel];
}
async function getNumber(){
  if(busy||sel===null||!dateVal) return; busy=true; result={wait:true}; paintResult();
  const {data,error}=await sb.rpc('allocate_number',{p_company:sel,p_date:dateVal});
  if(error) result={err:error.message||'تعذّر الحفظ'}; else {result={num:data,date:dateVal,co:sel};loadHistory();}
  busy=false; paintResult();
}
function paintResult(){
  const box=document.getElementById('res'); if(!box) return; box.textContent='';
  const b=document.getElementById('go'); if(b) b.disabled=busy||sel===null;
  if(!result) return;
  if(result.wait) box.append(h('p',{class:'msg'},'جارٍ الحجز…'));
  else if(result.err) box.append(h('p',{class:'msg err'},result.err));
  else box.append(h('div',{class:'big'},String(result.num)),h('p',{class:'msg'},names[result.co]+' — '+result.date),
    h('button',{class:'btn ghost',style:'display:block;margin:8px auto 0',onclick:()=>{try{navigator.clipboard.writeText(String(result.num));}catch(e){}}},'نسخ الرقم'));
}
function dateSelects(){
  const [y,m,d]=dateVal.split('-').map(Number); const dim=new Date(Date.UTC(y,m,0)).getUTCDate();
  const upd=(yy,mm,dd)=>{dd=Math.min(dd,new Date(Date.UTC(yy,mm,0)).getUTCDate());dateVal=yy+'-'+pad(mm)+'-'+pad(dd);result=null;render();};
  const mk=(label,opts,val,fn)=>{const s=h('select',{});opts.forEach(([v,t])=>{const o=h('option',{value:v},t);if(v===val)o.selected=true;s.append(o);});
    s.onchange=()=>fn(+s.value);return h('div',{},h('label',{},label),s);};
  return h('div',{class:'three'},
    mk('السنة',[2023,2024,2025,2026,2027,2028].map(v=>[v,String(v)]),y,v=>upd(v,m,d)),
    mk('الشهر',MN.map((t,i)=>[i+1,(i+1)+' - '+t]),m,v=>upd(y,v,d)),
    mk('اليوم',Array.from({length:dim},(_,i)=>[i+1,String(i+1)]),d,v=>upd(y,m,v)));
}
function lockView(){
  const p=h('input',{type:'password',placeholder:'الرمز السري',autocomplete:'current-password'}), m=h('p',{class:'msg err'});
  const go=async()=>{m.textContent='';const {error}=await sb.auth.signInWithPassword({email:APP_EMAIL,password:p.value});if(error)m.textContent='الرمز غير صحيح';};
  p.onkeydown=e=>{if(e.key==='Enter')go();};
  return h('div',{class:'card'},h('h1',{},'🔒 مولّد أرقام المعاملات'),p,h('div',{class:'gap'}),h('button',{class:'btn',onclick:go},'دخول'),m);
}
function settingsView(){
  const ins=names.map((n,i)=>{const e=h('input',{value:n,maxlength:'40'});e.dataset.i=i;return e;}), m=h('p',{class:'msg'});
  const saveNames=async()=>{const nn=ins.map(e=>e.value.trim()||('الشركة '+(+e.dataset.i+1)));
    const {error}=await sb.from('config').upsert({id:1,names:nn});
    if(error){m.className='msg err';m.textContent='تعذّر الحفظ';}else{names=nn;m.className='msg';m.textContent='تم حفظ الأسماء';}};
  const np=h('input',{type:'password',placeholder:'رمز سري جديد (6 أحرف على الأقل)'}), m2=h('p',{class:'msg'});
  const savePass=async()=>{if(np.value.length<6){m2.className='msg err';m2.textContent='الرمز قصير (6 أحرف على الأقل)';return;}
    const {error}=await sb.auth.updateUser({password:np.value});
    if(error){m2.className='msg err';m2.textContent='تعذّر التغيير: '+error.message;}else{np.value='';m2.className='msg';m2.textContent='تم تغيير الرمز';}};
  return h('div',{},
    h('div',{class:'card'},h('h2',{},'أسماء الشركات'),...ins.flatMap(e=>[e,h('div',{class:'gap'})]),h('button',{class:'btn',onclick:saveNames},'حفظ الأسماء'),m),
    h('div',{class:'card'},h('h2',{},'تغيير الرمز السري'),np,h('div',{class:'gap'}),h('button',{class:'btn',onclick:savePass},'تغيير الرمز'),m2));
}
function mainView(){
  const grid=h('div',{class:'grid'});
  names.forEach((n,i)=>grid.append(h('button',{class:'co'+(sel===i?' on':''),onclick:()=>{sel=i;result=null;histRows=[];loadHistory();render();}},n)));
  const lk=h('input',{id:'lk',type:'number',inputmode:'numeric',placeholder:'تحقق من رقم (199000-999999)'});
  return h('div',{},
    h('div',{class:'card'},h('h2',{},'1) اختر الشركة'),grid),
    h('div',{class:'card'},h('h2',{},'2) اختر التاريخ'),dateSelects(),h('div',{class:'gap'}),
      h('button',{id:'go',class:'btn',onclick:getNumber},'احصل على الرقم التسلسلي'),h('div',{id:'res'})),
    h('div',{class:'card'},h('h2',{},'التحقق من رقم'),lk,h('div',{class:'gap'}),h('button',{class:'btn ghost',style:'width:100%',onclick:doLookup},'تحقق'),h('p',{id:'lkout',class:'msg'})),
    h('div',{class:'card'},h('h2',{},sel===null?'السجل':'السجل — '+names[sel]),h('div',{id:'hist'})));
}
function render(){
  $app.textContent='';
  if(!session){$app.append(lockView());return;}
  $app.append(h('div',{class:'row'},h('h1',{style:'margin:0'},'أرقام المعاملات'),
    h('div',{},h('button',{class:'btn ghost',onclick:()=>{tab=tab==='main'?'set':'main';render();}},tab==='main'?'⚙ إعدادات':'← رجوع'),' ',
    h('button',{class:'btn ghost',onclick:()=>sb.auth.signOut()},'🔒'))));
  if(tab==='set'){$app.append(settingsView());return;}
  $app.append(mainView()); paintResult(); paintHistory();
}

function start(){
  if(SUPABASE_URL.startsWith('PASTE')||SUPABASE_KEY.startsWith('PASTE')){
    $app.textContent='';$app.append(h('div',{class:'card'},h('p',{class:'msg err'},'لم يتم لصق إعدادات Supabase في ملف config.js بعد.')));return;}
  sb=supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
  sb.auth.onAuthStateChange((ev,s)=>{
    session=s;
    setTimeout(async()=>{
      if(session){await loadNames();if(sel!==null)loadHistory();startPolling();}
      else{clearInterval(timer);sel=null;result=null;tab='main';histRows=[];}
      render();
    },0);
  });
}
if(typeof supabase!=='undefined'){start();}
else{
  const sc=document.createElement('script');sc.src='https://unpkg.com/@supabase/supabase-js@2';
  sc.onload=start;
  sc.onerror=()=>{$app.textContent='';$app.append(h('div',{class:'card'},h('p',{class:'msg err'},'تعذّر تحميل مكتبة Supabase. تحقق من الإنترنت أو عطّل مانع الإعلانات وأعد المحاولة.')));};
  document.head.append(sc);
}
