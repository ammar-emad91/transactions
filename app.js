window.onerror=function(m,u,l){var a=document.getElementById('app');if(a){var p=document.createElement('p');p.style.cssText='color:#ff7b72;direction:ltr;text-align:left;padding:8px';p.textContent='خطأ: '+m+' (سطر '+l+')';a.append(p);}};
const pad=n=>String(n).padStart(2,'0');
const START=199000, PER_DAY=365, D0=Date.UTC(2023,0,1), D1=Date.UTC(2028,11,31);
const MN=['January','February','March','April','May','June','July','August','September','October','November','December'];
const $app=document.getElementById('app');
let sb=null, session=null, names=Array.from({length:10},(_,i)=>'الشركة '+(i+1));
let me=null, actRows=[], actFilter='', usersList=[], gateTab='login';
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
  const {data,error}=await sb.from('allocations').select('num,alloc_date,username').eq('company',c).order('num',{ascending:false}).limit(1000);
  if(c!==sel) return;
  histRows=error?[]:data; paintHistory();
}
function startPolling(){clearInterval(timer);timer=setInterval(()=>{if(tab==='main'&&session&&me)loadHistory();},10000);}
function paintHistory(){
  const box=document.getElementById('hist'); if(!box) return; box.textContent='';
  if(!histRows.length){box.append(h('p',{class:'msg'},'لا توجد أرقام محفوظة لهذه الشركة بعد'));return;}
  const by={}; histRows.forEach(r=>{(by[r.alloc_date]=by[r.alloc_date]||[]).push(r);});
  Object.keys(by).sort().reverse().slice(0,150).forEach(d=>{const it=by[d].sort((a,b)=>a.num-b.num);
    box.append(h('details',{class:'day'},h('summary',{},d+' — '+it.length+' رقم — آخر رقم '+it[it.length-1].num),
      h('div',{class:'nums'},it.map(r=>r.num+' ('+(r.username||'-')+')').join('   '))));});
}
async function doLookup(){
  const v=Number(document.getElementById('lk').value), out=document.getElementById('lkout');
  if(!Number.isInteger(v)||v<START||v>999999){out.className='msg err';out.textContent='أدخل رقماً بين 199000 و 999999';return;}
  if(sel===null){out.className='msg err';out.textContent='اختر الشركة أولاً';return;}
  const idx=Math.floor((v-START)/PER_DAY); if(idx>2191){out.className='msg err';out.textContent='الرقم خارج نطاق التواريخ';return;}
  const {data}=await sb.from('allocations').select('num').eq('company',sel).eq('num',v).maybeSingle();
  out.className='msg'; out.textContent=(data?'✔ الرقم مستخدم':'○ الرقم غير مستخدم')+' — تاريخه '+dateOf(idx)+' — '+names[sel];
}
async function api(fn,args){
  const {data,error}=await sb.rpc(fn,args);
  if(error) return {ok:false,error:error.message||'خطأ في الاتصال'};
  return data||{ok:false,error:'لا توجد استجابة'};
}
const cred=()=>({p_user:me.username,p_pass:me.pass});
async function getNumber(){
  if(busy||sel===null||!dateVal||!me) return; busy=true; result={wait:true}; paintResult();
  const r=await api('allocate_number',{...cred(),p_company:sel,p_date:dateVal});
  if(!r.ok){result={err:r.error};if(/انتهت الجلسة/.test(r.error||'')){me=null;try{sessionStorage.removeItem('tx_me');}catch(e){}}}
  else{result={num:r.num,date:dateVal,co:sel};loadHistory();}
  busy=false; if(me)paintResult(); else render();
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
function setMe(username,role,pass){
  me={username,role,pass};try{sessionStorage.setItem('tx_me',JSON.stringify(me));}catch(e){}
}
const isAdmin=()=>me&&me.role==='admin';
function gateView(){
  const p=h('input',{type:'password',placeholder:'الرمز العام للدخول',autocomplete:'off'}), m=h('p',{class:'msg err'});
  const go=async()=>{m.textContent='';const {error}=await sb.auth.signInWithPassword({email:APP_EMAIL,password:p.value});
    if(error)m.textContent='الرمز غير صحيح';};
  p.onkeydown=e=>{if(e.key==='Enter')go();};
  return h('div',{class:'card'},h('h1',{},'🔒 مولّد أرقام المعاملات'),p,h('div',{class:'gap'}),h('button',{class:'btn',onclick:go},'دخول'),m);
}
function accountView(){
  const reg=gateTab==='register';
  const u=h('input',{type:'text',placeholder:'اسم المستخدم (إنجليزي صغير/أرقام)',autocomplete:'username',autocapitalize:'none'});
  const p=h('input',{type:'password',placeholder:reg?'رمزك الشخصي (6 أحرف فأكثر)':'رمزك الشخصي',autocomplete:reg?'new-password':'current-password'});
  const p2=h('input',{type:'password',placeholder:'أعد كتابة الرمز'});
  const m=h('p',{class:'msg err'});
  const login=async(name,pass)=>{const r=await api('employee_login',{p_user:name,p_pass:pass});
    if(!r.ok){m.textContent=r.error;return;} setMe(r.username,r.role,pass); tab='main'; await afterLogin(); render();};
  const go=async()=>{m.textContent='';const name=u.value.trim().toLowerCase();
    if(!name||!p.value){m.textContent='أدخل اسم المستخدم والرمز';return;}
    if(reg){if(p.value!==p2.value){m.textContent='الرمزان غير متطابقين';return;}
      const r=await api('employee_register',{p_user:name,p_pass:p.value});
      if(!r.ok){m.textContent=r.error;return;}}
    await login(name,p.value);};
  [p,p2].forEach(e=>e.onkeydown=ev=>{if(ev.key==='Enter')go();});
  const tabs=h('div',{class:'row'},
    h('button',{class:'btn ghost',style:reg?'':'border-color:var(--ac)',onclick:()=>{gateTab='login';render();}},'دخول'),
    h('button',{class:'btn ghost',style:reg?'border-color:var(--ac)':'',onclick:()=>{gateTab='register';render();}},'إنشاء حساب جديد'));
  return h('div',{class:'card'},h('h1',{},'حسابك الشخصي'),
    h('p',{class:'msg'},reg?'أنشئ اسماً ورمزاً خاصين بك. سيُسجَّل اسمك مع كل رقم تحجزه.':'ادخل باسمك ورمزك الشخصي'),tabs,
    u,h('div',{class:'gap'}),p,h('div',{class:'gap'}),reg?p2:'',reg?h('div',{class:'gap'}):'',h('button',{class:'btn',onclick:go},reg?'إنشاء الحساب والدخول':'دخول'),m);
}
async function afterLogin(){await loadNames();if(sel!==null)loadHistory();startPolling();}

async function loadActivity(){
  const r=await api('get_activity',cred()); actRows=r.ok?r.rows:[]; paintActivity();
}
function actText(r){
  if(r.action==='allocate') return 'حجز الرقم '+r.num+' — '+(names[r.company]||('شركة '+(r.company+1)))+' — '+r.alloc_date;
  if(r.action==='login') return 'تسجيل دخول';
  if(r.action==='register') return 'إنشاء حساب جديد';
  if(r.action==='password') return 'غيّر رمزه';
  return r.details||r.action;
}
function paintActivity(){
  const box=document.getElementById('act'); if(!box) return; box.textContent='';
  const rows=actFilter?actRows.filter(r=>r.username===actFilter):actRows;
  const cnt={}; actRows.filter(r=>r.action==='allocate').forEach(r=>{cnt[r.username]=(cnt[r.username]||0)+1;});
  const sm=document.getElementById('actsum'); if(sm) sm.textContent=Object.keys(cnt).map(k=>k+': '+cnt[k]+' رقم').join('   |   ')||'لا توجد أرقام محجوزة';
  if(!rows.length){box.append(h('p',{class:'msg'},'لا توجد عمليات'));return;}
  rows.forEach(r=>box.append(h('div',{class:'day'},new Date(r.ts).toLocaleString('en-GB')+' — '+(r.username||'-')+' — '+actText(r))));
}
function activityView(){
  const users=[...new Set(actRows.map(r=>r.username).filter(Boolean))];
  const f=h('select',{});f.append(h('option',{value:''},'كل المستخدمين'));
  users.forEach(u=>{const o=h('option',{value:u},u);if(u===actFilter)o.selected=true;f.append(o);});
  f.onchange=()=>{actFilter=f.value;paintActivity();};
  return h('div',{class:'card'},h('h2',{},'سجل النشاط (آخر 300 عملية)'),f,h('p',{id:'actsum',class:'msg'}),h('div',{id:'act'}));
}
async function loadUsers(){const r=await api('admin_list_users',cred());usersList=r.ok?r.rows:[];paintUsers();}
function paintUsers(){
  const box=document.getElementById('ulist'); if(!box) return; box.textContent='';
  usersList.forEach(u=>{
    const st=h('span',{class:'msg'},(u.role==='admin'?'مدير':'مستخدم')+' — '+(u.active?'فعّال':'موقوف'));
    const b1=h('button',{class:'btn ghost',onclick:async()=>{const r=await api('admin_set_active',{...cred(),p_target:u.username,p_active:!u.active});
      if(!r.ok)alert(r.error);loadUsers();}},u.active?'إيقاف':'تفعيل');
    const b2=h('button',{class:'btn ghost',onclick:async()=>{const np=prompt('رمز جديد للمستخدم '+u.username+' (6 أحرف فأكثر):');if(!np)return;
      const r=await api('admin_reset_password',{...cred(),p_target:u.username,p_new:np});alert(r.ok?'تم تغيير الرمز':r.error);}},'تغيير الرمز');
    box.append(h('div',{class:'day'},h('div',{class:'row',style:'margin:0'},h('b',{},u.username),st),
      u.username===me.username?'':h('div',{class:'row',style:'margin:6px 0 0;justify-content:flex-start'},b1,b2)));});
}
function settingsView(){
  const ins=names.map((n,i)=>{const e=h('input',{value:n,maxlength:'40'});e.dataset.i=i;return e;}), m=h('p',{class:'msg'});
  const saveNames=async()=>{const nn=ins.map(e=>e.value.trim()||('الشركة '+(+e.dataset.i+1)));
    const r=await api('admin_save_names',{...cred(),p_names:nn});
    if(!r.ok){m.className='msg err';m.textContent=r.error;}else{names=nn;m.className='msg';m.textContent='تم حفظ الأسماء';}};
  return h('div',{},
    h('div',{class:'card'},h('h2',{},'أسماء الشركات'),...ins.flatMap(e=>[e,h('div',{class:'gap'})]),h('button',{class:'btn',onclick:saveNames},'حفظ الأسماء'),m),
    h('div',{class:'card'},h('h2',{},'المستخدمون'),h('div',{id:'ulist'})),
    passwordCard());
}
function passwordCard(){
  const np=h('input',{type:'password',placeholder:'رمزك الشخصي الجديد (6 أحرف فأكثر)'}), m=h('p',{class:'msg'});
  const go=async()=>{const r=await api('change_my_password',{...cred(),p_new:np.value});
    if(!r.ok){m.className='msg err';m.textContent=r.error;return;}
    setMe(me.username,me.role,np.value);np.value='';m.className='msg';m.textContent='تم تغيير رمزك';};
  return h('div',{class:'card'},h('h2',{},'تغيير رمزي الشخصي'),np,h('div',{class:'gap'}),h('button',{class:'btn',onclick:go},'تغيير الرمز'),m);
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
function logout(){me=null;try{sessionStorage.removeItem('tx_me');}catch(e){}sb.auth.signOut();}
function render(){
  $app.textContent='';
  if(!session){$app.append(gateView());return;}
  if(!me){$app.append(accountView());return;}
  const nav=h('div',{});
  if(isAdmin()){
    [['main','الرئيسية'],['act','📋 النشاط'],['set','⚙ إعدادات']].forEach(([k,t])=>{
      nav.append(h('button',{class:'btn ghost',style:tab===k?'border-color:var(--ac)':'',onclick:()=>{tab=k;if(k==='act')loadActivity();if(k==='set')loadUsers();render();}},t),' ');});
  } else {
    nav.append(h('button',{class:'btn ghost',style:tab==='pw'?'border-color:var(--ac)':'',onclick:()=>{tab=tab==='pw'?'main':'pw';render();}},tab==='pw'?'← رجوع':'🔑 رمزي'),' ');
  }
  nav.append(h('button',{class:'btn ghost',onclick:logout},'خروج'));
  $app.append(h('h1',{style:'margin:0 0 8px'},'أرقام المعاملات'),nav,
    h('p',{class:'msg'},'المستخدم: '+me.username+(isAdmin()?' (مدير)':'')));
  if(tab==='set'&&isAdmin()){$app.append(settingsView());paintUsers();return;}
  if(tab==='act'&&isAdmin()){$app.append(activityView());paintActivity();return;}
  if(tab==='pw'&&!isAdmin()){$app.append(passwordCard());return;}
  $app.append(mainView()); paintResult(); paintHistory();
}

function start(){
  if(SUPABASE_URL.startsWith('PASTE')||SUPABASE_KEY.startsWith('PASTE')){
    $app.textContent='';$app.append(h('div',{class:'card'},h('p',{class:'msg err'},'لم يتم لصق إعدادات Supabase في ملف config.js بعد.')));return;}
  sb=supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
  sb.auth.onAuthStateChange((ev,s)=>{
    if(ev==='TOKEN_REFRESHED'||ev==='USER_UPDATED'){session=s;return;}
    session=s;
    setTimeout(async()=>{
      if(session){
        if(!me){try{const sv=JSON.parse(sessionStorage.getItem('tx_me')||'null');
          if(sv){const r=await api('employee_login',{p_user:sv.username,p_pass:sv.pass});if(r.ok)setMe(r.username,r.role,sv.pass);else sessionStorage.removeItem('tx_me');}}catch(e){}}
        if(me)await afterLogin();
      } else {clearInterval(timer);me=null;sel=null;result=null;tab='main';histRows=[];}
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
