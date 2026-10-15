
const SDM_REFS=[
  {code:"SDM 4.2 & 4.3",label:"Employee Well-being & Work-Life Balance"},
  {code:"SDM 2.1.3 & 3.7",label:"Recognising Achievements & Coaching"},
  {code:"SDM 4.1",label:"Performance Expectations Clarity"},
  {code:"SDM 4.4 & 1.1.4",label:"DEIB & Leadership Direction"},
  {code:"SDM 3.7 & 3.2",label:"Coaching, Development & Training"},
  {code:"SDM 2.2.2 & 2.3",label:"Communication & Team Building"},
  {code:"SDM 5 & 1.6",label:"Resources & Strategic Planning"},
  {code:"SDM 4.1 & 2.2.3",label:"Voice of Employees & Manager Responsibilities"}
];
const SDM_KPI={code:"SDM 8",label:"Management Information & Performance Results"};
const EVP=["Commit to our brand & values","Value each other","Be proactive and forward thinking","Support & inspire each other","Care","Have respect","Be trusting","Be professional","Contribute to a positive culture","Be open and honest"];

const KPIS=[
  {id:"happy",   name:"😊 Happiness",    max:10, target:"Track trend over time"},
  {id:"energy",  name:"⚡ Energy",        max:5,  target:"Watch if consistently < 3"},
];

const CFO_KPIS=[
  {id:"revenue",      name:"Revenue",                              desc:"Total income against plan for the review period. Include recurring and one-off revenue where relevant."},
  {id:"forecast",     name:"Revenue Forecast vs Actual Variance",  desc:"How close were revenue forecasts to actuals? Flag consistent over or under-forecasting and root cause."},
  {id:"grossproft",   name:"Gross Profit",                         desc:"Total gross profit against plan for the review period. Include any one-off items and note key variances."},
  {id:"margin",       name:"Gross Margin %",                       desc:"Gross profit as a percentage of revenue. Flag any deviation from budgeted margin and note key drivers."},
  {id:"ebitda",       name:"EBITDA",                               desc:"Earnings before interest, tax, depreciation and amortisation. Key indicator of operational performance."},
  {id:"cashflow",     name:"Cash Flow",                            desc:"Net cash position vs forecast. Note any timing issues, deferred revenue or working capital concerns."},
  {id:"opex",         name:"Opex vs Budget",                       desc:"Operating expenditure against budget. Note any material overspends, underspends or reforecast items."},
  {id:"debtors",      name:"Debtor Days",                          desc:"Average days outstanding on accounts receivable. Flag any aged debt or collection concerns."},
  {id:"headcount",    name:"Team & Fractional",                    desc:"Full team headcount vs plan, including fractional and part-time roles. Actual over target = too many people (red). Note any changes, vacancies, or leavers."},
  {id:"peoplecosts",  name:"People Costs",                          desc:"Total people cost vs budget. Include salaries, benefits, contractors, and any unplanned spend."},
];

function buildCfoKpis(){
  if(!S.cfo)S.cfo={};
  const g=document.getElementById('cfo-kpi-grid');
  if(!g)return;
  g.innerHTML=CFO_KPIS.map((k,ki)=>{
    const d=S.cfo[k.id]||{target:'',actual:'',rag:'',note:''};
    return `<div class="cfo-kpi" id="cfo-${k.id}">
      <div class="cfo-kpi-name"><span style="font-size:10px;font-weight:700;color:var(--muted);margin-right:5px;">5.${ki+1}</span>${k.name}</div>
      <div class="cfo-kpi-desc">${k.desc}</div>
      <div class="cfo-kpi-fields">
        <div class="cfo-kpi-field"><label>Target</label><input type="text" placeholder="${k.id==='margin'?'e.g. 66.2%':k.id==='debtors'?'e.g. 30 days':k.id==='headcount'?'e.g. 10':k.id==='peoplecosts'?'e.g. £920k':'e.g. £1.2m'}" value="${esc(fmtKpi(d.target||''))}" oninput="setCfo('${k.id}','target',stripKpi(this.value))" onblur="this.value=fmtKpi(this.value)" onfocus="this.value=stripKpi(this.value)"></div>
        <div class="cfo-kpi-field"><label>Actual</label><input type="text" placeholder="${k.id==='margin'?'e.g. 64.8%':k.id==='debtors'?'e.g. 45 days':k.id==='headcount'?'e.g. 12':k.id==='peoplecosts'?'e.g. £800k':'e.g. £1.35m'}" value="${esc(fmtKpi(d.actual||''))}" oninput="setCfo('${k.id}','actual',stripKpi(this.value))" onblur="this.value=fmtKpi(this.value)" onfocus="this.value=stripKpi(this.value)"></div>
        <div class="cfo-rag">
          <label>RAG</label>
          <div class="cfo-rag-btns">
            <button class="cfo-rag-btn r${d.rag==='r'?' active':''}" onclick="setCfo('${k.id}','rag','r');this.parentNode.querySelectorAll('.cfo-rag-btn').forEach(b=>b.classList.remove('active'));this.classList.add('active')">R</button>
            <button class="cfo-rag-btn a${d.rag==='a'?' active':''}" onclick="setCfo('${k.id}','rag','a');this.parentNode.querySelectorAll('.cfo-rag-btn').forEach(b=>b.classList.remove('active'));this.classList.add('active')">A</button>
            <button class="cfo-rag-btn g${d.rag==='g'?' active':''}" onclick="setCfo('${k.id}','rag','g');this.parentNode.querySelectorAll('.cfo-rag-btn').forEach(b=>b.classList.remove('active'));this.classList.add('active')">G</button>
          </div>
        </div>
      </div>
      <div style="margin-top:9px;"><input type="text" placeholder="Commentary / context for this metric…" value="${esc(d.note||'')}" oninput="setCfo('${k.id}','note',this.value)" style="width:100%;border:1px solid var(--border);border-radius:5px;padding:5px 8px;font-size:11.5px;color:var(--ink);background:var(--surface);box-sizing:border-box;"></div>
    </div>`;
  }).join('');
  if(document.getElementById('cfo-overall-note'))
    document.getElementById('cfo-overall-note').value=S.cfoNote||'';
}

function buildActions(){
  if(!S.actions||!S.actions.length) S.actions=[{text:'',owner:'',ownerType:'',date:'',source:'',status:'open'}];
  const tbody=document.getElementById('act-tbody');
  if(!tbody) return;
  tbody.innerHTML=S.actions.map((a,i)=>{
    const st=a.status||'open';
    const stBtns=[
      {v:'open',  icon:'⏳', lbl:'Open'},
      {v:'done',  icon:'✅', lbl:'Done'},
      {v:'missed',icon:'❌', lbl:'Not done'}
    ].map(b=>`<button onclick="setAction(${i},'status','${b.v}')" style="background:${st===b.v?(b.v==='done'?'#dcfce7':b.v==='missed'?'#fee2e2':'#fef3c7'):'#f3f4f6'};border:1px solid ${st===b.v?(b.v==='done'?'#86efac':b.v==='missed'?'#fca5a5':'#fde68a'):'#e5e7eb'};border-radius:5px;padding:3px 8px;font-size:11px;cursor:pointer;white-space:nowrap;">${b.icon} ${b.lbl}</button>`).join('');
    const owBtns=['Manager','Employee'].map(o=>`<button onclick="setAction(${i},'ownerType','${o}')" style="background:${(a.ownerType||''===o)?'#1e3a5f':'#f3f4f6'};color:${(a.ownerType||''===o)?'#fff':'var(--ink)'};border:1px solid ${(a.ownerType||''===o)?'#1e3a5f':'#e5e7eb'};border-radius:5px;padding:3px 8px;font-size:11px;cursor:pointer;">${o}</button>`).join('');
    return `<tr style="opacity:${st==='done'?'0.6':'1'};">
      <td><div class="act-num">${i+1}</div></td>
      <td><input type="text" class="inline-in" placeholder="Describe the action…" value="${esc(a.text)}" oninput="setAction(${i},'text',this.value)" style="text-decoration:${st==='done'?'line-through':'none'};"></td>
      <td><div style="display:flex;gap:4px;flex-wrap:wrap;">${owBtns}</div></td>
      <td><div style="display:flex;gap:4px;flex-wrap:wrap;">${stBtns}</div></td>
      <td style="display:flex;gap:6px;align-items:center;">
        <input type="date" class="inline-in" value="${esc(a.date)}" oninput="setAction(${i},'date',this.value)" style="flex:1;">
        <button onclick="removeAction(${i})" style="background:none;border:none;color:#d1d5db;font-size:16px;cursor:pointer;padding:0 2px;line-height:1;" title="Remove">×</button>
      </td>
    </tr>`;
  }).join('');
  const tr=document.createElement('tr');
  tr.innerHTML=`<td colspan="5" style="padding:8px 14px;">
"><button onclick="addAction()" style="background:none;border:1px dashed var(--border);color:var(--muted);border-radius:5px;padding:5px 14px;font-size:12px;cursor:pointer;width:100%;">+ Add action</button></td>`;
  tbody.appendChild(tr);
}

function setAction(i,field,val){
  if(!S.actions[i])S.actions[i]={text:'',owner:'',date:'',source:''};
  S.actions[i][field]=val;
  autosave();
}

function addActionFromQ(qText,sectionTitle){
  if(!S.actions)S.actions=[];
  S.actions.push({text:qText,owner:'',date:'',source:sectionTitle||''});
  autosave();
  toast('Added to Agreed Actions — go to Summary to complete it');
}

function addAction(){
  if(!S.actions)S.actions=[];
  S.actions.push({text:'',owner:'',date:'',source:''});
  buildActions();
  autosave();
}

function removeAction(i){
  if(S.actions.length<=1)return;
  S.actions.splice(i,1);
  buildActions();
  autosave();
}

function setCfo(id,field,val){
  if(!S.cfo)S.cfo={};
  if(!S.cfo[id])S.cfo[id]={target:'',actual:'',rag:'',note:''};
  S.cfo[id][field]=val;
  // Auto-calculate RAG when both target and actual are filled
  if(field==='target'||field==='actual'){
    const t=parseFloat((S.cfo[id].target||'').replace(/[^0-9.-]/g,''));
    const a=parseFloat((S.cfo[id].actual||'').replace(/[^0-9.-]/g,''));
    if(!isNaN(t)&&!isNaN(a)&&t!==0){
      const lowerIsBetter=['debtors','opex'];
      const pct=a/t;
      let autoRag;
      if(lowerIsBetter.includes(id)){
        // Lower actual = better: ≤100% is green, 100-120% is amber, >120% is red
        autoRag=pct<=1?'g':pct<=1.2?'a':'r';
      } else {
        // Higher actual = better: ≥100% is green, 80-99% is amber, <80% is red
        autoRag=pct>=1?'g':pct>=0.8?'a':'r';
      }
      S.cfo[id].rag=autoRag;
      const btns=document.querySelectorAll(`#cfo-${id} .cfo-rag-btn`);
      btns.forEach(b=>b.classList.toggle('active',b.classList.contains(autoRag)));
    }
  }
  autosave();
}

const IND_Q=[
  {happy:"How happy are you feeling right now?",                   energy:"How energised are you feeling today?"},
  {happy:"How energised do you feel about your work?",             energy:"How energised do you feel when you reflect on what you've achieved?"},
  {happy:"How satisfied are you with your role right now?",        energy:"How energised does your day-to-day work make you feel?"},
  {happy:"How connected do you feel to our goals?",                energy:"How energised do you feel about working towards our goals?"},
  {happy:"How excited do you feel about your growth here?",        energy:"How energised do you feel about the growth opportunities available to you?"},
  {happy:"How positive do you feel about your working relationships?", energy:"How energised are you by your working relationships?"},
  {happy:"How optimistic do you feel about future resourcing?",    energy:"How energised do you feel about the resources and support available to you?"},
  {happy:"How comfortable do you feel wrapping up this review?",   energy:"How energised do you feel leaving this review today?"},
];

// 8 sections — questions split where previously double-barrelled, all audit improvements applied
const SECTIONS=[
  { icon:"🌱", title:"Check-in & Wellbeing",
    desc:"The human opener — no agenda. A chance to understand how the employee is really feeling. Listen more than you speak.",
    sda:[{ref:"3.1.2",label:"Wellbeing in a Service Desk environment"},{ref:"3.1.4–3.1.5",label:"Work-life balance"},{ref:"3.4.1",label:"Emotional resilience"},{ref:"3.4.2–3.4.4",label:"Signs of positive & negative stress"}],
    bps:[{ref:"6.7",label:"Work-life Blend"},{ref:"6.9",label:"Workplace Wellbeing"}],
    sdaReason:"The SDI® Standard defines wellbeing, work-life balance and emotional resilience as professional competencies — not peripheral concerns. Including this conversation in every review reflects a commitment to upholding these principles internally, not just advocating for them externally. This section is evidence of that commitment.",
    sdm:[{ref:"4.2",label:"Employee Well-being"},{ref:"4.3",label:"Work-Life Balance"}],
    rows:[
      {q:"How are you doing today?",sl:"notgreat",
       emp:"", mgr:"", a:null},
      {q:"How are you doing outside of work?",sl:"notgreat",
       emp:"", mgr:"", a:null},
      {q:"How are you feeling about your energy levels and workload right now?",sl:"notgreat",
       emp:"", mgr:"", a:null},
      {q:"Are you managing to keep your hours within contract each month?",sl:"yn%",
       emp:"", mgr:"", a:null},
      {q:"Does your work feel meaningful to you right now?",sl:"meaningful",
       emp:"", mgr:"", a:null},
    ]},

  { icon:"⭐", title:"Reflection & Achievements", evp:true,
    desc:"Strengths before strategy. Recognising what someone has done well builds confidence and creates a positive foundation before any evaluative conversation. This is also where EVP behaviours are explored.",
    sda:[{ref:"1.3.5–1.3.7",label:"Service Desk values — beliefs & behaviours"},{ref:"1.5.1",label:"Personal accountability"},{ref:"1.6.2–1.6.3",label:"Service attitude & its impact"},{ref:"1.7.3",label:"SDA role in an effective team"}],
    bps:[{ref:"3.6",label:"Personal Performance Reviews"},{ref:"6.3",label:"Employee Happiness"}],
    sdaReason:"The SDI® Standard defines values as active guides to behaviour and decision-making — not aspirational statements. Holding ourselves to the same expectation means our values should be visible in how we actually work together, not just how we describe ourselves. This conversation is where we test that honestly.",
    sdm:[{ref:"2.1.3",label:"Recognising Achievements"},{ref:"3.7",label:"Coaching"}],
    rows:[
      {q:"What's one thing you're proud of since we last met?",sl:null,
       emp:"", mgr:"", a:null},
      {q:"How have you lived EVP since we last met? Can you give a specific example?",sl:null,
       emp:"", mgr:"", a:null},
      {q:"Is there anything you wanted to raise last time but held back from saying?",sl:null,
       emp:"", mgr:"", a:null},
    ]},

  { icon:"💼", title:"Role Clarity & Day-to-Day",
    desc:"People do their best work when they know what's expected. This section establishes role clarity before any goal discussion — there's no point talking about where we're going if someone is unclear about where they stand today.",
    sda:[{ref:"1.2.1",label:"Role of the Service Desk Analyst"},{ref:"1.2.2",label:"Responsibilities of the SDA"},{ref:"1.4.1",label:"Purpose of organisational policies"},{ref:"3.1.1",label:"Performance expectations clarity"}],
    bps:[{ref:"3.1",label:"Role Profiles"},{ref:"6.10",label:"Workload Management"}],
    sdaReason:"The SDI® Standard identifies performance expectations clarity as a key factor in employee experience. Clarity of role and responsibility should never be assumed — checking in on this regularly reflects the standard we set for others and applies it equally to ourselves.",
    sdm:[{ref:"4.1",label:"Performance Expectations Clarity"},{ref:"2.2.3",label:"Manager Responsibilities"}],
    rows:[
      {q:"Do you feel clear on what's expected of you in your role?",sl:"yn",
       emp:"", mgr:"", a:null},
      {q:"Has anything about your responsibilities changed since our last review?",sl:"yn",
       emp:"", mgr:"", a:null},
      {q:"What part of your role energises you most?",sl:null,
       emp:"", mgr:"", a:null},
      {q:"What's the one thing that wastes the most time in your week?",sl:null,
       emp:"", mgr:"", a:null},
    ]},

  { icon:"🎯", title:"Goals, Strategy & Belonging",
    desc:"With role clarity established, we connect to the bigger picture. This section explores alignment with company goals, surfaces blockers early, and asks whether the employee feels their voice genuinely shapes things here.",
    sda:[{ref:"1.3.1–1.3.4",label:"Vision & mission — strategic alignment"},{ref:"3.2.1–3.2.2",label:"Diversity, Equity, Inclusion & Belonging"},{ref:"3.3.1",label:"Challenger Safety"}],
    bps:[{ref:"6.8",label:"Inclusion & Belonging"},{ref:"6.12",label:"Challenger Safety"}],
    sdaReason:"The SDI® Standard defines Challenger Safety as a prerequisite for trust, innovation and continual improvement — and DEIB as foundational to a healthy team culture. This section ensures we are genuinely creating those conditions here, not just advocating for them elsewhere.",
    sdm:[{ref:"4.4",label:"DEIB & Belonging"},{ref:"1.1.4",label:"Leadership Direction"}],
    rows:[
      {q:"Are there any goals that feel out of reach right now?",sl:"yninv",
       emp:"", mgr:"", a:null},
      {q:"What would need to change to make them achievable?",sl:null,
       emp:"", mgr:"", a:null},
      {q:"Do you feel like what you do here makes a difference?",sl:"yn",
       emp:"", mgr:"", a:null},
      {q:"If you could make one hire for the company, what role would have the biggest impact?",sl:null,
       emp:"", mgr:"", a:null},
    ]},

  { icon:"🚀", title:"Growth & Development",
    desc:"Investing in people's growth is one of the most powerful ways to retain talent. This section covers career ambitions, learning needs, and readiness for the future — including how the employee feels about new technology and the evolving nature of their role.",
    sda:[{ref:"3.1.1",label:"Personal & career development"},{ref:"3.1.3",label:"Benefits of wellbeing — engagement"},{ref:"7.1.4–7.1.5",label:"AI in ITSM — analyst readiness"},{ref:"1.7.4",label:"Collaboration & skills development"}],
    bps:[{ref:"3.5",label:"Career Development Programme"},{ref:"6.1",label:"Personal Development"},{ref:"6.6",label:"Career Development Opportunities"}],
    sdaReason:"The SDI® Standard names personal and career development as core components of a positive employee experience. Investing in people's growth with genuine intent — not just as a process — is how that commitment becomes real and consistent.",
    sdm:[{ref:"3.7",label:"Coaching"},{ref:"3.2",label:"Staff Development & Training"}],
    rows:[
      {q:"Where would you like to be in your career in the next 6–12 months?",sl:null,
       emp:"", mgr:"", a:null},
      {q:"What does the organisation need to do to help you get there?",sl:null,
       emp:"", mgr:"", a:null},
      {q:"Is there something you've been keen to try but haven't had the chance to yet?",sl:"yn",
       emp:"", mgr:"", a:null},
      {q:"How confident do you feel about working with new technology and AI tools?",sl:"conf",
       emp:"", mgr:"", a:null},
    ]},

  { icon:"💬", title:"Relationships & Communication",
    desc:"Strong communication underpins everything. This section is deliberately two-way — it asks the employee how they experience communication, and invites the manager to reflect on what they could do better. That mutuality builds trust.",
    sda:[{ref:"2.1.1–2.1.3",label:"Communication — methods & barriers"},{ref:"2.3.1–2.3.3",label:"Active listening & paraphrasing"},{ref:"1.7.1–1.7.2",label:"Teamwork & responsibilities"},{ref:"1.8.1–1.8.2",label:"Relationship management"}],
    bps:[{ref:"3.12",label:"Communication Personalisation"},{ref:"3.14",label:"Promoting Teamwork"}],
    sdaReason:"The SDI® Standard places communication and active listening among its highest-weighted principles — and defines them as shared responsibilities, not one-sided skills. Making this section two-way, including asking what the manager could do better, is a direct reflection of that.",
    sdm:[{ref:"2.2.2",label:"Communication Skills"},{ref:"2.3",label:"Team Building"}],
    rows:[
      {q:"How well do you feel we communicate with each other?",sl:"comm",
       emp:"", mgr:"", a:null},
      {q:"Is there anything you'd like more or less of from me?",sl:"morel",
       emp:"", mgr:"", a:null},
      {q:"How useful is the feedback you receive — and what would make it even better?",sl:"useful",
       emp:"", mgr:"", a:null},
    ]},

  { icon:"🏗️", title:"Resource & Future Planning",
    desc:"The people doing the work every day have the clearest view of where the gaps are. This section invites the employee to think strategically — providing ground-level insight that directly informs hiring decisions and how the organisation plans ahead.",
    sda:[{ref:"3.1.1",label:"Workload management & employee autonomy"},{ref:"3.4.5–3.4.6",label:"Responsibility to manage stress"},{ref:"4.15.3",label:"Service Desk contribution to continual improvement"}],
    bps:[{ref:"6.4",label:"Employee Engagement"},{ref:"6.5",label:"Voice of the Employee"},{ref:"6.11",label:"Employee Autonomy & Empowerment"}],
    sdaReason:"The SDI® Standard identifies workload management and the shared responsibility to address unsustainable pressure as explicit parts of a healthy employee experience. It also recognises that the people closest to the work are the best source of improvement insight — treating every team member as a strategic voice, not just a resource.",
    sdm:[{ref:"5.1",label:"Resources"},{ref:"1.6",label:"Strategic Planning"}],
    rows:[
      {q:"Is there anything about your workload that needs addressing?",sl:"yn",
       emp:"", mgr:"", a:null},
      {q:"What resources or support would help you do your best work?",sl:null,
       emp:"", mgr:"", a:null},
      {q:"Looking 12 months ahead, how do you see your role evolving?",sl:null,
       emp:"", mgr:"", a:null},
    ]},

  { icon:"📣", title:"Feedback & Close",
    desc:"The employee's open floor — a space to raise anything that hasn't come up elsewhere, share suggestions, or flag things that need to go further. Ending the review here signals that their voice genuinely matters, and that this is a conversation, not an appraisal.",
    sda:[{ref:"3.3.1",label:"Challenger Safety — open dialogue"},{ref:"4.15.3",label:"Continual improvement through feedback"},{ref:"1.1.2",label:"Service Desk activities — manage feedback & improvement"}],
    bps:[{ref:"6.5",label:"Voice of the Employee"},{ref:"6.12",label:"Challenger Safety"}],
    sdaReason:"The SDI® Standard defines Challenger Safety and continual improvement through feedback as foundational principles — not aspirational ones. Closing every review with an open floor demonstrates those principles in practice, signalling that feedback flows upward and that every person in this team is a contributor to how we improve.",
    sdm:[{ref:"4.1",label:"Voice of Employees"},{ref:"2.2.3",label:"Manager Responsibilities"}],
    rows:[
      {q:"Is there anything you've wanted to say today but haven't felt comfortable raising — including anything you'd like to escalate to the Chair?",sl:"chair",
       emp:"", mgr:"", a:null},
      {q:"Is there any feedback you'd like to share — about the team, the business, our culture, or anything else?",sl:"yn",
       emp:"", mgr:"", a:null},
      {q:"Is there anything you'd like me to raise with senior leadership on your behalf?",sl:"yn",
       emp:"", mgr:"", a:null},
      {q:"What's one thing that would make our working relationship even better going forward?",sl:null,
       emp:"", mgr:"", a:null},
    ]},
];


// STATE
let currentSi=0;
const S={ratings:{},wb:{},trendHistory:[],prev:{},prevRatings:{},responses:{},qsliders:{},qratings:{},qtrs:{},cfo:{},cfoNote:'',actions:[{text:'',owner:'',date:'',source:''}],meta:{empName:'',empRole:'',date:'',mgrName:''},signoff:{}};

// HELPERS
const countEmoji=id=>{
  const c={struggling:0,good:0,great:0};
  SECTIONS.forEach((_,si)=>{const v=S.wb[id+'_'+si]||0;if(v===1)c.struggling++;else if(v===3)c.good++;else if(v===5)c.great++;});
  // Include KPI section
  const kv=S.wb[id+'_kpi']||0;if(kv===1)c.struggling++;else if(kv===3)c.good++;else if(kv===5)c.great++;
  return c;
};
const emojiSpread=id=>{const c=countEmoji(id);const total=c.struggling+c.good+c.great;if(!total)return'—';return(c.struggling?'😔 '+c.struggling+' ':'')+(c.good?'🙂 '+c.good+' ':'')+(c.great?'😊 '+c.great:'');};
const dominantEmoji=id=>{
  const c=countEmoji(id);
  const total=c.struggling+c.good+c.great;
  if(!total)return'—';
  const dom=c.great>=c.good&&c.great>=c.struggling?{em:'😊',lbl:'Great',n:c.great}:c.good>=c.struggling?{em:'🙂',lbl:'Good',n:c.good}:{em:'😔',lbl:'Struggling',n:c.struggling};
  const flag=c.struggling>0&&dom.em!=='😔'?'<div style="font-size:10px;color:var(--muted);margin-top:3px;">😔 '+c.struggling+' struggling</div>':'';
  return'<div style="font-size:15px;font-weight:700;color:var(--ink);">'+dom.em+' '+dom.lbl+'</div><div style="font-size:11px;color:var(--muted);">'+dom.n+' of '+total+'</div>'+flag;
};
const vc=(v,max)=>{const p=v/max;return p>=.7?'high':p>=.4?'mid':'low';};
const stH=(n,sz=15)=>{let h='';for(let i=1;i<=5;i++)h+=`<span style="color:${i<=n?'var(--amber)':'#e5e7eb'};font-size:${sz}px;">★</span>`;return h;};
const avgW=id=>{const v=SECTIONS.map((_,si)=>S.wb[`${id}_${si}`]||0).filter(x=>x>0);return v.length?v.reduce((a,b)=>a+b,0)/v.length:0;};
const esc=s=>String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');

// PERSISTENCE
// Reviews are saved to the server by DB.scheduleSave() (see data.js), which
// replaces this function once data.js loads. Nothing is kept in browser storage.
function saveState(){}

function loadState(){
  try{
    if(window.EXPORTED_STATE){
      Object.keys(window.EXPORTED_STATE).forEach(k=>{if(k in S) S[k]=window.EXPORTED_STATE[k];});
      return;
    }
  }catch(e){console.warn('Load failed:',e);}
}


function clearState(){
  if(!window._resetConfirmed){
    window._resetConfirmed=true;
    const btn=document.querySelector('.sb-reset');
    if(btn){btn.textContent='⚠️ Tap again to confirm';btn.style.background='#dc2626';btn.style.color='#fff';}
    setTimeout(function(){
      window._resetConfirmed=false;
      if(btn){btn.textContent='↺ Reset review';btn.style.background='';btn.style.color='';}
    },3000);
    return;
  }
  window._resetConfirmed=false;
  const btn=document.querySelector('.sb-reset');
  if(btn){btn.textContent='↺ Reset review';btn.style.background='';btn.style.color='';}
  try{window.EXPORTED_STATE=null;}catch(e){}
  Object.assign(S,{
    ratings:{},wb:{},prev:{},prevRatings:{},responses:{},qsliders:{},qratings:{},
    cfo:{},cfoNote:'',trendHistory:[],carryForward:[],
    mgrCommitment:'',prep:{},reflSelf:{},
    meta:{empName:'',empRole:'',date:'',mgrName:''},signoff:{},
    actions:[{text:'',owner:'',ownerType:'',date:'',source:'',status:'open'}]
  });
  try{restoreSignoff();}catch(e){}
  // Force clear all visual emoji selections immediately
  document.querySelectorAll('.sel-struggling,.sel-good,.sel-great').forEach(function(b){
    b.classList.remove('sel-struggling','sel-good','sel-great');
  });
  // Clear all textareas
  document.querySelectorAll('.resp-area').forEach(function(t){t.value='';});
  // Clear star ratings
  document.querySelectorAll('.kpi-star,.rat-star').forEach(function(st){st.style.color='#e5e7eb';});
  initResponses();buildCfoKpis();buildSidebar();buildHome();buildSections();
  const ce=document.getElementById('mgr-commitment');if(ce)ce.value='';
  ['prep-q1','prep-q2','prep-q3'].forEach(function(id){const el=document.getElementById(id);if(el)el.value='';});
  showHome();
  toast('Review reset — all responses cleared');
}

function fmtKpi(v){
  if(!v)return v;
  const prefix=v.match(/^[£$€%]*/)?.[0]||'';
  const num=v.replace(/[^0-9.]/g,'');
  if(!num)return v;
  const parts=num.split('.');
  parts[0]=parts[0].replace(/\B(?=(\d{3})+(?!\d))/g,',');
  return prefix+parts.join('.');
}
function stripKpi(v){return v?v.replace(/,/g,''):v;}

function setKpiRating(val){
  if(!S.ratings['kpi'])S.ratings['kpi']={stars:0,note:''};
  S.ratings['kpi'].stars=S.ratings['kpi'].stars===val?0:val;
  document.querySelectorAll('.kpi-star').forEach((st,i)=>{
    st.style.color=i<S.ratings['kpi'].stars?'var(--amber)':'#e5e7eb';
  });
  autosave();
}
function setKpiNote(val){
  if(!S.ratings['kpi'])S.ratings['kpi']={stars:0,note:''};
  S.ratings['kpi'].note=val;
  autosave();
}

function buildKpiInds(){
  const g=document.getElementById('kpi-ind-grid');
  if(!g) return;
  const q={happy:"How are you feeling about this section?",energy:"How energised do you feel about this section?"};
  g.innerHTML='';
  KPIS.forEach(function(k){
    const v=S.wb[k.id+'_kpi']||0;
    const sel=v===0?null:v<=2?'struggling':v<=3?'good':'great';
    const item=document.createElement('div');
    item.className='ind-item';
    item.innerHTML='<div class="ind-label">'+k.name+'</div><div class="ind-desc">'+(q[k.id]||'')+'</div>';
    const wrap=document.createElement('div');
    wrap.className='q-rate-wrap';
    wrap.style.marginTop='8px';
    [{val:1,lbl:'😔 Struggling',cls:'struggling'},{val:3,lbl:'🙂 Good',cls:'good'},{val:5,lbl:'😊 Great',cls:'great'}].forEach(function(o){
      const btn=document.createElement('button');
      btn.className='q-rate-btn'+(sel===o.cls?' sel-'+o.cls:'');
      btn.textContent=o.lbl;
      (function(id,val){btn.onclick=function(){setWBtn(id,'kpi',val);};})(k.id,o.val);
      wrap.appendChild(btn);
    });
    item.appendChild(wrap);
    g.appendChild(item);
  });
}
function setPrevEmoji(id,val){
  if(!S.prev)S.prev={};
  S.prev[id]=S.prev[id]===val?null:val;
  document.querySelectorAll('.prev-emoji-btn[data-id="'+id+'"]').forEach(function(b){
    b.classList.toggle('sel-great', b.dataset.val===val&&val==='great'&&S.prev[id]===val);
    b.classList.toggle('sel-good', b.dataset.val===val&&val==='good'&&S.prev[id]===val);
    b.classList.toggle('sel-struggling', b.dataset.val===val&&val==='struggling'&&S.prev[id]===val);
    if(b.dataset.val!==S.prev[id]) b.className='q-rate-btn prev-emoji-btn';
  });
  refreshPrev();
  autosave();
}

function savePrep(){
  S.prep=S.prep||{};
  ['prep-q1','prep-q2','prep-q3'].forEach(function(id){
    const el=document.getElementById(id);
    if(el) S.prep[id]=el.value;
  });
  autosave();
}
function loadPrep(){
  if(!S.prep) return;
  ['prep-q1','prep-q2','prep-q3'].forEach(function(id){
    const el=document.getElementById(id);
    if(el && S.prep[id]) el.value=S.prep[id];
  });
}
function getRitualCard(si){
  if(si!==0) return '';
  return '<div style="background:linear-gradient(135deg,#1e3a5f,#2d5a8e);border-radius:8px;margin:16px 22px 4px;padding:16px 20px;display:flex;gap:14px;align-items:flex-start;">'
    +'<div style="font-size:22px;flex-shrink:0;">🤝</div>'
    +'<div><div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:rgba(255,255,255,.5);margin-bottom:4px;">Opening &#8212; manager reads aloud</div>'
    +'<div style="font-size:13px;color:#fff;line-height:1.7;font-style:italic;">&#8220;This is your time. There are no wrong answers and nothing said here goes beyond this room unless we agree otherwise. I&#39;m here to listen.&#8221;</div>'
    +'</div></div>';
}
function saveMgrCommitment(val){
  S.mgrCommitment=val;
  autosave();
}

function getTrendLight(avg){
  if(!avg) return null;
  const v=parseFloat(avg);
  if(v<2) return {light:'🔴',label:'Needs attention',col:'#dc2626'};
  if(v<3) return {light:'🟡',label:'Below expectations',col:'#d97706'};
  if(v<4) return {light:'🟢',label:'Meeting expectations',col:'#16a34a'};
  if(v<5) return {light:'🟢',label:'Exceeding',col:'#15803d'};
  return {light:'🟢',label:'Outstanding',col:'#166534'};
}

function buildTrend(){
  const el=document.getElementById('sum-trend');
  if(!el) return;
  const history=S.trendHistory||[];
  const scores=SECTIONS.map((_,i)=>(S.ratings[i]||{}).stars||0).filter(x=>x>0);
  const kpiRated=(S.ratings['kpi']||{}).stars>0?1:0;
  const rated=scores.length+kpiRated;
  const avgScore=rated?(scores.reduce((a,b)=>a+b,0)+((S.ratings['kpi']||{}).stars||0))/(rated):null;
  const current=avgScore?parseFloat(avgScore.toFixed(1)):null;
  
  // Build display — up to 3 past + current
  let html='<div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;">';
  
  // Past reviews
  history.slice(-3).forEach(function(h,i){
    const t=getTrendLight(h.avg);
    if(!t) return;
    html+='<div style="text-align:center;">'
      +'<div style="font-size:28px;">'+t.light+'</div>'
      +'<div style="font-size:10px;color:var(--muted);margin-top:3px;">Review '+(i+1)+'</div>'
      +'<div style="font-size:10px;font-weight:700;color:'+t.col+';">'+esc(String(h.avg))+'/5</div>'
      +'</div>';
    if(i<history.slice(-3).length-1||current){
      html+='<div style="font-size:18px;color:#d1d5db;">→</div>';
    }
  });
  
  // Current review
  if(current){
    const t=getTrendLight(current);
    html+='<div style="text-align:center;background:#f0f4fa;border-radius:8px;padding:8px 14px;">'
      +'<div style="font-size:28px;">'+t.light+'</div>'
      +'<div style="font-size:10px;color:var(--muted);margin-top:3px;">This review</div>'
      +'<div style="font-size:11px;font-weight:700;color:'+t.col+';">'+current+'/5</div>'
      +'</div>';
  } else {
    html+='<div style="font-size:12px;color:var(--muted);font-style:italic;">Rate sections to see trend</div>';
  }
  
  if(!history.length&&!current){
    html='<div style="font-size:12px;color:var(--muted);font-style:italic;">Trends across signed-off reviews are shown in the 1-2-1 History tab.</div>';
  }
  
  html+='</div>';
  el.innerHTML=html;
}

function calcWellbeingScore(){
  // Q1.1-1.5 are section 0 (si=0), rows 0-4
  // emoji values: struggling=1, good=2, great=3
  // yn%: great=3(yes=good), struggling=1(no=bad) for Q1.4 (managing hours)
  // notgreat: struggling=1, good=2, great=3
  // meaningful: struggling=1, good=2, great=3
  const vals=[];
  for(let ri=0;ri<5;ri++){
    const key='0_'+ri;
    const qr=(S.qratings||{})[key]||null;
    if(qr){
      const score=qr==='struggling'?1:qr==='good'?2:qr==='great'?3:null;
      if(score) vals.push(score);
    }
  }
  if(!vals.length) return null;
  return (vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(2);
}

function getWellbeingBand(score){
  const v=parseFloat(score);
  if(v<1.5) return {light:'🔴',label:'Low — needs attention',col:'#dc2626',bg:'#fee2e2'};
  if(v<2.5) return {light:'🟡',label:'Moderate — worth monitoring',col:'#d97706',bg:'#fef3c7'};
  return {light:'🟢',label:'Good — healthy',col:'#16a34a',bg:'#dcfce7'};
}

function buildWellbeingScore(){
  const el=document.getElementById('sum-wellbeing-score');
  if(!el) return;
  const score=calcWellbeingScore();
  if(!score){
    el.innerHTML='<div style="font-size:12px;color:var(--muted);font-style:italic;">Complete Section 1 questions to generate the wellbeing index.</div>';
    return;
  }
  const band=getWellbeingBand(score);
  const pct=((parseFloat(score)-1)/2)*100;
  el.innerHTML=
    '<div style="display:flex;align-items:center;gap:16px;">'
    +'<div style="text-align:center;">'
    +'<div style="font-size:36px;">'+band.light+'</div>'
    +'<div style="font-size:11px;font-weight:700;color:'+band.col+';margin-top:4px;">'+parseFloat(score).toFixed(1)+' / 3</div>'
    +'</div>'
    +'<div style="flex:1;">'
    +'<div style="font-size:13px;font-weight:600;color:var(--ink);margin-bottom:6px;">'+band.label+'</div>'
    +'<div style="background:#e5e7eb;border-radius:99px;height:8px;overflow:hidden;">'
    +'<div style="background:'+band.col+';height:8px;border-radius:99px;width:'+pct+'%;transition:width .4s;"></div>'
    +'</div>'
    +'<div style="font-size:10px;color:var(--muted);margin-top:5px;">Based on '+[0,1,2,3,4].filter(ri=>(S.qratings||{})['0_'+ri]).length+' of 5 Section 1 responses</div>'
    +'</div>'
    +'</div>';
}

const REFL_SELF=[
  {id:'rs1',q:'How well did I listen in this conversation?',type:'comm'},
  {id:'rs2',q:'Did I let the employee lead more than me?',type:'yn'},
  {id:'rs3',q:'Did I follow up on all actions from last time?',type:'yna'}
];

function setReflSelf(id,val){
  if(!S.reflSelf) S.reflSelf={};
  S.reflSelf[id]=S.reflSelf[id]===val?null:val;
  buildReflSelf();
  calcReflScore();
  autosave();
}

function buildReflSelf(){
  const el=document.getElementById('refl-self');
  if(!el) return;
  el.innerHTML=REFL_SELF.map(function(q){
    const v=(S.reflSelf||{})[q.id]||null;
    let btns='';
    if(q.type==='comm'){
      btns='<button class="q-rate-btn '+(v==='struggling'?'sel-struggling':'')+'" onclick="setReflSelf(\''+q.id+'\',\'struggling\')">😔 Poorly</button>'
          +'<button class="q-rate-btn '+(v==='good'?'sel-good':'')+'" onclick="setReflSelf(\''+q.id+'\',\'good\')">🙂 OK</button>'
          +'<button class="q-rate-btn '+(v==='great'?'sel-great':'')+'" onclick="setReflSelf(\''+q.id+'\',\'great\')">😊 Well</button>';
    } else if(q.type==='yn'){
      btns='<button class="q-rate-btn '+(v==='great'?'sel-great':'')+'" onclick="setReflSelf(\''+q.id+'\',\'great\')">😊 Yes</button>'
          +'<button class="q-rate-btn '+(v==='struggling'?'sel-struggling':'')+'" onclick="setReflSelf(\''+q.id+'\',\'struggling\')">😔 No</button>';
    } else {
      btns='<button class="q-rate-btn '+(v==='great'?'sel-great':'')+'" onclick="setReflSelf(\''+q.id+'\',\'great\')">😊 Yes</button>'
          +'<button class="q-rate-btn '+(v==='good'?'sel-good':'')+'" onclick="setReflSelf(\''+q.id+'\',\'good\')">🙂 N/A</button>'
          +'<button class="q-rate-btn '+(v==='struggling'?'sel-struggling':'')+'" onclick="setReflSelf(\''+q.id+'\',\'struggling\')">😔 No</button>';
    }
    return '<div class="refl-item" style="flex-direction:column;gap:6px;">'
      +'<div style="font-size:12.5px;font-weight:500;color:var(--ink);">'+q.q+'</div>'
      +'<div class="q-rate-wrap">'+btns+'</div>'
      +'</div>';
  }).join('');
}

function calcReflScore(){
  const el=document.getElementById('refl-score');
  if(!el) return;
  const rs=S.reflSelf||{};
  const vals=REFL_SELF.map(function(q){
    const v=rs[q.id];
    if(!v) return null;
    return v==='great'?3:v==='good'?2:1;
  }).filter(function(v){return v!==null;});
  if(!vals.length){el.innerHTML='';return;}
  const avg=vals.reduce(function(a,b){return a+b;},0)/vals.length;
  const pct=((avg-1)/2)*100;
  const col=avg>=2.5?'#16a34a':avg>=1.5?'#d97706':'#dc2626';
  const lbl=avg>=2.5?'Strong conversation':avg>=1.5?'Good, room to improve':'Needs reflection';
  el.innerHTML='<div style="margin-top:14px;padding:12px 16px;background:#f8f9fb;border-radius:8px;border-left:3px solid '+col+';">'
    +'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">'
    +'<span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:'+col+';">Conversation quality</span>'
    +'<span style="font-size:13px;font-weight:700;color:'+col+';">'+avg.toFixed(1)+' / 3</span>'
    +'</div>'
    +'<div style="background:#e5e7eb;border-radius:99px;height:6px;"><div style="background:'+col+';height:6px;border-radius:99px;width:'+pct+'%;"></div></div>'
    +'<div style="font-size:11px;color:var(--muted);margin-top:5px;">'+lbl+'</div>'
    +'</div>';
}

function buildCarryForward(){
  const el=document.getElementById('sum-carry');
  if(!el) return;
  const cf=S.carryForward||[];
  if(!cf.length){el.style.display='none';return;}
  el.style.display='block';
  el.innerHTML='<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#d97706;margin-bottom:10px;">⚠️ Outstanding from last review</div>'
    +cf.map(function(a,i){return '<div style="display:flex;align-items:flex-start;gap:10px;padding:8px 12px;background:#fffbeb;border:1px solid #fde68a;border-radius:7px;margin-bottom:6px;">'
      +'<span style="font-size:16px;flex-shrink:0;">⏳</span>'
      +'<div style="flex:1;font-size:12.5px;color:var(--ink);">'+esc(a.text)+'<span style="font-size:10px;color:var(--muted);margin-left:8px;">'+esc(a.ownerType||'')+'</span></div>'
      +'</div>';}).join('');
}
function setQtr(key){
  if(!S.qtrs)S.qtrs={};
  const cur=S.qtrs[key]||null;
  S.qtrs[key]=cur===null?'pass':cur==='pass'?'fail':null;
  const el=document.getElementById('qtr-'+key);
  if(el){
    const v=S.qtrs[key];
    el.textContent=v==='pass'?'✓':v==='fail'?'✗':'·';
    el.style.background=v==='pass'?'var(--surface)':v==='fail'?'var(--surface)':'var(--surface)';
    el.style.color=v==='pass'?'var(--ink)':v==='fail'?'var(--ink)':'#d1d5db';
    el.style.borderColor=v==='pass'?'#6ee7b7':v==='fail'?'#fca5a5':'var(--border)';
  }
  autosave();
}
function setWBtn(id,si,val){
  const key=id+'_'+si;
  S.wb[key]=S.wb[key]===val?0:val;
  if(si==='kpi'){
    buildKpiInds();
  } else {
    buildSections();
    showSection(currentSi);
  }
  autosave();
}
function setQPct(key,val){
  if(!S.qratings)S.qratings={};
  S.qratings[key+'_pct']=val;
  autosave();
}
function setQRating(key,val){
  if(!S.qratings)S.qratings={};
  S.qratings[key]=S.qratings[key]===val?null:val;
  buildSections();
  showSection(currentSi);
  autosave();
}
let _saveTimer;
function autosave(){clearTimeout(_saveTimer);_saveTimer=setTimeout(saveState,600);}

function restoreCfoNote(){const el=document.getElementById('cfo-overall-note');if(el)el.value=S.cfoNote||'';}

function buildCfoGrid(){
  buildCfoKpis();
  restoreCfoNote();
}


function updateMeta(){
  if(!S.meta)S.meta={empName:'',empRole:'',date:'',mgrName:''};
  S.meta.empName=document.getElementById('sb-emp-name').value;
  S.meta.empRole=document.getElementById('sb-emp-role').value;
  S.meta.date=document.getElementById('sb-date').value;
  S.meta.mgrName=document.getElementById('sb-mgr-name').value;
  const n=S.meta.empName||'Employee Name';
  const r=S.meta.empRole||'Job Title';
  const d=S.meta.date||'Date';
  const m=S.meta.mgrName||'Manager Name';
  const meta=document.querySelector('.sum-hdr .meta');
  if(meta)meta.innerHTML=`${esc(n)} &nbsp;·&nbsp; ${esc(r)} &nbsp;·&nbsp; ${esc(d)}`;
  const soEmp=document.getElementById('so-emp-name');
  const soMgr=document.getElementById('so-mgr-name');
  if(soEmp&&!soEmp.matches(':focus'))soEmp.value=S.meta.empName||'';
  if(soMgr&&!soMgr.matches(':focus'))soMgr.value=S.meta.mgrName||'';
  autosave();
}
function restoreMeta(){
  if(!S.meta)return;
  const fields=['sb-emp-name','sb-emp-role','sb-date','sb-mgr-name'];
  const vals=[S.meta.empName,S.meta.empRole,S.meta.date,S.meta.mgrName];
  fields.forEach((id,i)=>{const el=document.getElementById(id);if(el&&vals[i])el.value=vals[i];});
  const soEmp=document.getElementById('so-emp-name');
  const soMgr=document.getElementById('so-mgr-name');
  if(soEmp&&S.meta.empName)soEmp.value=S.meta.empName;
  if(soMgr&&S.meta.mgrName)soMgr.value=S.meta.mgrName;
  updateMeta();
}

// SIGN-OFF FIELDS (emails, chair, dates) — saved with the review
const SIGNOFF_FIELDS={empEmail:'so-emp-email',mgrEmail:'so-mgr-email',chairName:'so-chair-name',chairEmail:'so-chair-email',dateAgreed:'so-date-agreed',nextReview:'so-next-review'};
function setSignoff(k,v){if(!S.signoff)S.signoff={};S.signoff[k]=v;autosave();}
function restoreSignoff(){
  const so=S.signoff||{};
  Object.keys(SIGNOFF_FIELDS).forEach(k=>{const el=document.getElementById(SIGNOFF_FIELDS[k]);if(el&&!el.matches(':focus'))el.value=so[k]||'';});
  if(window.DB&&typeof DB.renderSignoff==='function')DB.renderSignoff();
}

// SIDEBAR TOGGLE
function toggleSidebar(){
  const sb=document.getElementById('sidebar');
  const btn=document.getElementById('sb-toggle');
  const collapsed=sb.classList.toggle('collapsed');
  btn.classList.toggle('at-edge',collapsed);
  btn.textContent=collapsed?'☰':'✕';
}

// INIT RESPONSES — pre-populate from hardcoded data, preserve any edits
function initResponses(){
  SECTIONS.forEach((s,si)=>{
    s.rows.forEach((row,ri)=>{
      const key=`${si}_${ri}`;
      if(!S.responses[key]) S.responses[key]={emp:row.emp||'', mgr:row.mgr||'', pmr:row.a?row.a.text:''};
    });
  });
}

function setQSlider(key,field,val,elId){
  if(!S.qsliders[key])S.qsliders[key]={emp:0,mgr:0};
  S.qsliders[key][field]=parseInt(val);
  const el=document.getElementById(elId);
  if(el){el.textContent=val>0?val:'—';el.style.color=field==='emp'?'var(--blue)':'var(--navy)';}
  autosave();
}
function setResp(key,field,val){
  if(!S.responses[key])S.responses[key]={emp:'',mgr:'',pmr:''};
  S.responses[key][field]=val;
  autosave();
}

// SIDEBAR
function buildSidebar(){
  document.getElementById('sb-nav').innerHTML=
    `<div class="nav-item" onclick="showHow()" data-idx="how"><span>How to use</span></div>`+
    `<div class="nav-item" onclick="showGoals()" data-idx="goals"><span>SDI® Goals 2026</span></div>`+
    `<div class="nav-item" onclick="showHome()" data-idx="home"><span>Overview</span></div>`+
    SECTIONS.map((s,i)=>`<div class="nav-item" onclick="showSection(${i})" data-idx="${i}"><span>${i>3?i+2:i+1}. ${s.title}</span><span class="nav-dot ${(S.ratings[i]||{}).stars>0?'filled':''}"></span></div>${i===3?`<div class="nav-item" onclick="showKpi()" data-idx="kpi"><span>5. Key Performance Indicators</span><span class="nav-dot ${(S.ratings['kpi']||{}).stars>0?'filled':''}"></span></div>`:''}`).join('');
}

// HOME
function buildHome(){
  const rated=SECTIONS.filter((_,i)=>(S.ratings[i]||{}).stars>0).length;
  const pct=Math.round(rated/SECTIONS.length*100);
  const fill=document.getElementById('home-prog-fill');
  const count=document.getElementById('home-prog-count');
  if(fill)fill.style.width=pct+'%';
  if(count)count.textContent=`${rated} of ${SECTIONS.length} rated`;
  document.getElementById('home-grid').innerHTML=SECTIONS.map((s,i)=>{
    const st=(S.ratings[i]||{}).stars||0;
    let sh='';for(let j=1;j<=5;j++)sh+=j<=st?'<span>★</span>':'<span class="e">★</span>';
    const descShort=s.desc.length>80?s.desc.slice(0,80).trim()+'…':s.desc;
    return `<div class="hcard ${st>0?'rated':''}" onclick="showSection(${i})">
      <div class="hcard-icon">${s.icon}</div>
      <div style="flex:1;min-width:0;">
        <div class="hcard-num">Section ${i+1}</div>
        <div class="hcard-title">${s.title}</div>
        <div class="hcard-desc">${descShort}</div>
        <div class="hcard-stars">${sh}</div>
      </div>
    </div>`;
  }).join('');
}

// SECTIONS
function buildSections(){
  document.getElementById('sec-container').innerHTML=SECTIONS.map((s,si)=>{
    const r=S.ratings[si]||{stars:0,note:'',selfStars:0,selfNote:''};
    const lq=IND_Q[si];

    const rows=s.rows.map((row,ri)=>{
      const key=`${si}_${ri}`;
      const rd=S.responses[key]||{emp:row.emp||'',mgr:row.mgr||'',pmr:''};
      const qr=(S.qratings||{})[key]||null;
      const empCell=`<div class="resp-wrap"><div class="resp-label lbl-emp">Employee</div><textarea class="resp-area ea" placeholder="Employee to complete…" oninput="setResp('${key}','emp',this.value)">${esc(rd.emp)}</textarea>${row.sl==="useful"?`<div class="q-rate-wrap"><button class="q-rate-btn ${qr==='struggling'?'sel-struggling':''}" onclick="setQRating('${key}','struggling')">😔 Not useful</button><button class="q-rate-btn ${qr==='good'?'sel-good':''}" onclick="setQRating('${key}','good')">🙂 Somewhat</button><button class="q-rate-btn ${qr==='great'?'sel-great':''}" onclick="setQRating('${key}','great')">😊 Very useful</button></div>`:row.sl==="morel"?`<div class="q-rate-wrap"><button class="q-rate-btn ${qr==='great'?'sel-great':''}" onclick="setQRating('${key}','great')">😊 More</button><button class="q-rate-btn ${qr==='good'?'sel-good':''}" onclick="setQRating('${key}','good')">🙂 About right</button><button class="q-rate-btn ${qr==='struggling'?'sel-struggling':''}" onclick="setQRating('${key}','struggling')">😔 Less</button></div>`:row.sl==="yninv"?`<div class="q-rate-wrap"><button class="q-rate-btn ${qr==='struggling'?'sel-struggling':''}" onclick="setQRating('${key}','struggling')">😔 Yes</button><button class="q-rate-btn ${qr==='great'?'sel-great':''}" onclick="setQRating('${key}','great')">😊 No</button></div>`:row.sl==="meaningful"?`<div class="q-rate-wrap"><button class="q-rate-btn ${qr==='struggling'?'sel-struggling':''}" onclick="setQRating('${key}','struggling')">😔 Not really</button><button class="q-rate-btn ${qr==='good'?'sel-good':''}" onclick="setQRating('${key}','good')">🙂 Somewhat</button><button class="q-rate-btn ${qr==='great'?'sel-great':''}" onclick="setQRating('${key}','great')">😊 Yes, very</button></div>`:row.sl==="notgreat"?`<div class="q-rate-wrap"><button class="q-rate-btn ${qr==='struggling'?'sel-struggling':''}" onclick="setQRating('${key}','struggling')">😔 Not great</button><button class="q-rate-btn ${qr==='good'?'sel-good':''}" onclick="setQRating('${key}','good')">🙂 OK</button><button class="q-rate-btn ${qr==='great'?'sel-great':''}" onclick="setQRating('${key}','great')">😊 Good</button></div>`:row.sl==="yn%"?`<div class="q-rate-wrap"><button class="q-rate-btn ${qr==='great'?'sel-great':''}" onclick="setQRating('${key}','great')">😊 Yes</button><button class="q-rate-btn ${qr==='struggling'?'sel-struggling':''}" onclick="setQRating('${key}','struggling')">😔 No</button></div><div style="display:inline-flex;align-items:center;gap:8px;margin-top:10px;background:#f0f4fa;border:1px solid #c2d0e8;border-radius:8px;padding:7px 12px;"><span style="font-size:11px;font-weight:400;color:#4b6a8a;white-space:nowrap;">% Hours beyond Contract</span><input type="number" min="0" max="100" placeholder="0" value="${esc((S.qratings||{})[key+'_pct']||'')}" oninput="setQPct('${key}',this.value)" style="width:52px;border:1px solid #c2d0e8;border-radius:5px;padding:4px 6px;font-size:13px;font-weight:400;text-align:center;font-family:Arial,sans-serif;color:#1e3a5f;background:#fff;"><span style="font-size:13px;font-weight:400;color:#4b6a8a;">%</span></div>`:row.sl==="%"?`<div style="display:inline-flex;align-items:center;gap:8px;margin-top:10px;background:#f0f4fa;border:1px solid #c2d0e8;border-radius:8px;padding:7px 12px;"><span style="font-size:11px;font-weight:400;color:#4b6a8a;white-space:nowrap;">% Hours beyond Contract</span><input type="number" min="0" max="100" placeholder="0" value="${esc((S.qratings||{})[key+'_pct']||'')}" oninput="setQPct('${key}',this.value)" style="width:52px;border:1px solid #c2d0e8;border-radius:5px;padding:4px 6px;font-size:13px;font-weight:400;text-align:center;font-family:Arial,sans-serif;color:#1e3a5f;background:#fff;"><span style="font-size:13px;font-weight:400;color:#4b6a8a;">%</span></div>`:row.sl==="chair"?`<div class="q-rate-wrap"><button class="q-rate-btn ${qr==='great'?'sel-great':''}" onclick="setQRating('${key}','great')">💬 Yes</button><button class="q-rate-btn ${qr==='struggling'?'sel-struggling':''}" onclick="setQRating('${key}','struggling')">😔 No</button><button class="q-rate-btn ${qr==='good'?'sel-good':''}" onclick="setQRating('${key}','good')">🪑 Escalate</button></div>`:row.sl==="mol"?`<div class="q-rate-wrap"><button class="q-rate-btn ${qr==='great'?'sel-great':''}" onclick="setQRating('${key}','great')">😊 More</button><button class="q-rate-btn ${qr==='struggling'?'sel-struggling':''}" onclick="setQRating('${key}','struggling')">😔 Less</button></div>`:row.sl==="comm"?`<div class="q-rate-wrap"><button class="q-rate-btn ${qr==='struggling'?'sel-struggling':''}" onclick="setQRating('${key}','struggling')">😔 Poorly</button><button class="q-rate-btn ${qr==='good'?'sel-good':''}" onclick="setQRating('${key}','good')">🙂 OK</button><button class="q-rate-btn ${qr==='great'?'sel-great':''}" onclick="setQRating('${key}','great')">😊 Well</button></div>`:row.sl==="conf"?`<div class="q-rate-wrap"><button class="q-rate-btn ${qr==='great'?'sel-great':''}" onclick="setQRating('${key}','great')">😊 Confident</button><button class="q-rate-btn ${qr==='struggling'?'sel-struggling':''}" onclick="setQRating('${key}','struggling')">😔 Not confident</button></div>`:row.sl==="yn"?`<div class="q-rate-wrap"><button class="q-rate-btn ${qr==='great'?'sel-great':''}" onclick="setQRating('${key}','great')">😊 Yes</button><button class="q-rate-btn ${qr==='struggling'?'sel-struggling':''}" onclick="setQRating('${key}','struggling')">😔 No</button></div>`:row.sl?`<div class="q-rate-wrap"><button class="q-rate-btn ${qr==='struggling'?'sel-struggling':''}" onclick="setQRating('${key}','struggling')">😔 Struggling</button><button class="q-rate-btn ${qr==='good'?'sel-good':''}" onclick="setQRating('${key}','good')">🙂 Good</button><button class="q-rate-btn ${qr==='great'?'sel-great':''}" onclick="setQRating('${key}','great')">😊 Great</button></div>`:''}</div>`
      const mgrCell=`<div class="resp-wrap"><div class="resp-label lbl-mgr">Manager</div><textarea class="resp-area ma" placeholder="Manager to complete…" oninput="setResp('${key}','mgr',this.value)">${esc(rd.mgr)}</textarea></div>`;
      const pmrCell=`<div class="resp-wrap"><div class="resp-label lbl-pmr">Chair note</div><textarea class="resp-area pa" placeholder="Chair to add notes…" oninput="setResp('${key}','pmr',this.value)">${esc(rd.pmr)}</textarea></div>`;
      return `<tr><td style="width:28%;vertical-align:top;"><div class="q-text"><div style="display:flex;gap:7px;align-items:flex-start;"><span class="q-num" style="flex-shrink:0;">${si<4?si+1:si+2}.${ri+1}</span><span>${row.q}</span></div></div><div style="margin-top:6px;"><button class="act-q-btn" onclick="addActionFromQ('${esc(row.q)}','${esc(s.title)}')" title="Add as action" style="font-size:10px;padding:2px 8px;">+ Add as action</button></div>${row.sub?`<div class="q-sub">${row.sub}</div>`:''}
      </td><td style="width:24%">${empCell}</td><td style="width:24%">${mgrCell}</td><td style="width:24%">${pmrCell}</td></tr>`;
    }).join('');

    const inds=KPIS.map(k=>{
      const key=`${k.id}_${si}`;const v=S.wb[key]||0;
      const sel=v===0?null:v<=2?'struggling':v<=3?'good':'great';
      const map={'struggling':1,'good':3,'great':5};
      return `<div class="ind-item"><div class="ind-label">${k.name}</div><div class="ind-desc">${lq[k.id]}</div><div class="q-rate-wrap" style="margin-top:8px;"><button id="wb-btn-${k.id}-${si}-struggling" class="q-rate-btn ${sel==='struggling'?'sel-struggling':''}" onclick="setWBtn('${k.id}',${si},1)" class="q-rate-btn ${sel==='struggling'?'sel-struggling':''}">😔 Struggling</button><button id="wb-btn-${k.id}-${si}-good" class="q-rate-btn ${sel==='good'?'sel-good':''}" onclick="setWBtn('${k.id}',${si},3)">🙂 Good</button><button id="wb-btn-${k.id}-${si}-great" class="q-rate-btn ${sel==='great'?'sel-great':''}" onclick="setWBtn('${k.id}',${si},5)">😊 Great</button></div></div>`;
    }).join('');

    let stH2='';for(let i=1;i<=5;i++)stH2+=`<span class="star ${i<=(r.stars||0)?'lit':''}" data-si="${si}" data-v="${i}" onclick="setRating(${si},${i})">★</span>`;

    const secNum=si>3?si+2:si+1;
    const prev=si===4?`<button class="btn btn-ghost" onclick="showKpi()">← 5. Key Performance Indicators</button>`:si>0?`<button class="btn btn-ghost" onclick="showSection(${si-1})">← ${si>4?si+1:si}. ${SECTIONS[si-1].title}</button>`:`<button class="btn btn-ghost" onclick="showHome()">← Overview</button>`;
    const next=si===3?`<button class="btn btn-navy" onclick="showKpi()">Next: 5. Key Performance Indicators →</button>`:si<SECTIONS.length-1?`<button class="btn btn-navy" onclick="showSection(${si+1})">Next: ${si>=3?si+3:si+2}. ${SECTIONS[si+1].title} →</button>`:`<button class="btn btn-red" onclick="showSummary()">View summary →</button>`;

    const sdaStrip=s.sda&&s.sda.length
      ?`<div class="sda-strip">
          <div class="sda-strip-header">
            <span class="sda-strip-title">📋 Alignment to SDI Standard V9.0</span>
            <span class="sda-strip-sub">This section reflects the following SDI Professional Standard competencies</span>
          </div>
          <div style="display:flex;align-items:flex-start;gap:6px;margin-bottom:6px;">
            <span style="background:linear-gradient(135deg,rgba(2,132,199,0.9),rgba(3,105,161,0.85));color:#fff;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;padding:3px 8px;border-radius:5px;white-space:nowrap;margin-top:2px;box-shadow:0 2px 8px rgba(2,132,199,0.3),inset 0 1px 0 rgba(255,255,255,0.25);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,0.2);">SDA</span>
            <div style="display:flex;flex-wrap:wrap;gap:4px;">${s.sda.map(t=>`<span style="background:linear-gradient(135deg,rgba(255,255,255,0.85),rgba(224,242,254,0.6));border:1px solid rgba(2,132,199,0.2);border-radius:6px;padding:2px 9px;font-size:11px;box-shadow:inset 0 1px 0 rgba(255,255,255,0.9),0 1px 3px rgba(2,132,199,0.08);backdrop-filter:blur(4px);"><span style="font-weight:700;color:#0369a1;">${t.ref}</span> <span style="color:#374151;">${t.label}</span></span>`).join('')}</div>
          </div>
          ${s.sdm&&s.sdm.length?`<div style="display:flex;align-items:flex-start;gap:6px;margin-bottom:6px;">
            <span style="background:linear-gradient(135deg,rgba(217,119,6,0.9),rgba(180,83,9,0.85));color:#fff;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;padding:3px 8px;border-radius:5px;white-space:nowrap;margin-top:2px;box-shadow:0 2px 8px rgba(217,119,6,0.3),inset 0 1px 0 rgba(255,255,255,0.25);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,0.2);">SDM</span>
            <div style="display:flex;flex-wrap:wrap;gap:4px;">${s.sdm.map(t=>`<span style="background:linear-gradient(135deg,rgba(255,255,255,0.85),rgba(254,243,199,0.6));border:1px solid rgba(217,119,6,0.2);border-radius:6px;padding:2px 9px;font-size:11px;box-shadow:inset 0 1px 0 rgba(255,255,255,0.9),0 1px 3px rgba(217,119,6,0.08);backdrop-filter:blur(4px);"><span style="font-weight:700;color:#b45309;">${t.ref}</span> <span style="color:#374151;">${t.label}</span></span>`).join('')}</div>
          </div>`:''}
          ${s.bps&&s.bps.length?`<div style="display:flex;align-items:flex-start;gap:6px;margin-bottom:6px;">
            <span style="background:linear-gradient(135deg,rgba(5,150,105,0.9),rgba(4,120,87,0.85));color:#fff;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;padding:3px 8px;border-radius:5px;white-space:nowrap;margin-top:2px;box-shadow:0 2px 8px rgba(5,150,105,0.3),inset 0 1px 0 rgba(255,255,255,0.25);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,0.2);">SDC</span>
            <div style="display:flex;flex-wrap:wrap;gap:4px;">${s.bps.map(t=>`<span style="background:linear-gradient(135deg,rgba(255,255,255,0.85),rgba(209,250,229,0.6));border:1px solid rgba(5,150,105,0.2);border-radius:6px;padding:2px 9px;font-size:11px;box-shadow:inset 0 1px 0 rgba(255,255,255,0.9),0 1px 3px rgba(5,150,105,0.08);backdrop-filter:blur(4px);"><span style="font-weight:700;color:#059669;">${t.ref}</span> <span style="color:#374151;">${t.label}</span></span>`).join('')}</div>
          </div>`:''}
          ${s.sdaReason?`<div class="sda-strip-reason">${s.sdaReason}</div>`:''}
        </div>`
      :'';
    const ritualCard=si===0?'<div style="background:linear-gradient(135deg,#1e3a5f,#2d5a8e);border-radius:8px;margin:16px 22px 4px;padding:16px 20px;display:flex;gap:14px;align-items:flex-start;"><div style="font-size:22px;flex-shrink:0;">🤝</div><div><div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:rgba(255,255,255,.5);margin-bottom:4px;">Opening &#8212; manager to read aloud</div><div style="font-size:13px;color:#fff;line-height:1.7;font-style:italic;">&#8220;This is your time. There are no wrong answers and nothing said here goes beyond this room unless we agree otherwise. I&#39;m here to listen.&#8221;</div></div></div>':'';
    return `<div id="sec-${si}" class="sec-card" style="display:none;">
      <div class="sec-head"><h2><span class="sec-num-badge">${si>3?si+2:si+1}</span> ${s.icon} ${s.title}</h2><span class="sec-n">Section ${si>3?si+2:si+1} of 9</span></div>
      ${getRitualCard(si)}<div style="padding:10px 22px 12px;border-bottom:1px solid var(--border);background:#fafbff;font-size:12.5px;color:var(--muted);line-height:1.6;">${s.evp?`<span style="display:inline-block;background:var(--red);color:#fff;font-size:10px;font-weight:700;padding:1px 6px;border-radius:3px;margin-right:6px;vertical-align:middle;">EVP</span>`:''}${s.desc}${s.evp?`<div style="display:flex;flex-wrap:nowrap;gap:6px;margin-top:8px;overflow-x:auto;padding-bottom:4px;">${EVP.map(v=>`<span class="evp-pill">${v}</span>`).join('')}</div>`:''}</div>
      ${sdaStrip}
      <table class="qt">
        <thead><tr><th style="width:28%">Question</th><th style="width:24%">Employee Response<br><span style="font-weight:400;color:var(--blue);text-transform:none;letter-spacing:0;font-size:10px;">Employee</span></th><th style="width:24%">Manager Response<br><span style="font-weight:400;color:var(--muted);text-transform:none;letter-spacing:0;font-size:10px;">(Manager — during or after)</span></th><th style="width:24%">Chair Note<br><span style="font-weight:400;color:var(--ink);text-transform:none;letter-spacing:0;font-size:10px;">Chair</span></th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      ${si===7?`<div style='background:#fff;border:2px solid #1e3a5f;border-radius:10px;margin:16px 22px 4px;padding:16px 20px;'><div style='display:flex;align-items:center;gap:10px;margin-bottom:10px;'><div style='font-size:18px;'>🎯</div><div><div style='font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#1e3a5f;margin-bottom:2px;'>Manager commitment</div><div style='font-size:12px;color:var(--muted);'>Before our next review, I commit to&hellip;</div></div></div><textarea id='mgr-commitment' rows='3' placeholder='Write your commitment to your employee here&hellip;' oninput='saveMgrCommitment(this.value)' style='width:100%;border:1px solid var(--border);border-radius:6px;padding:8px 10px;font-size:12.5px;font-family:Arial,sans-serif;resize:vertical;box-sizing:border-box;color:var(--ink);'>${esc(S.mgrCommitment||'')}</textarea></div>`:''}\n      <div class="indicators">
        <div class="ind-title"><span class="ind-emp-badge">Employee</span> How are you feeling about this section?</div>
        
        <div class="ind-grid">${inds}</div>
      </div>
      
      <div class="rating-footer"><label>Manager rating:</label><div class="stars">${stH2}</div><input class="rating-note" type="text" placeholder="Add a note for this section…" value="${esc(r.note||'')}" oninput="setNote(${si},this.value)"></div>
      
      <div class="nav-btns">${prev}<div class="pips" id="pips-${si}"></div>${next}</div>
    </div>`;
  }).join('');
  SECTIONS.forEach((_,si)=>renderPips(si));
}

function renderPips(si){
  const w=document.getElementById(`pips-${si}`);if(!w)return;
  w.innerHTML=SECTIONS.map((_,i)=>`<div class="pip ${i===si?'cur':(S.ratings[i]||{}).stars>0?'done':''}"></div>`).join('');
}

// SETTERS
function setRating(si,val){
  if(!S.ratings[si])S.ratings[si]={stars:0,note:'',selfStars:0,selfNote:''};
  S.ratings[si].stars=S.ratings[si].stars===val?0:val;
  document.querySelectorAll(`.star[data-si="${si}"]`).forEach(el=>el.classList.toggle('lit',parseInt(el.dataset.v)<=S.ratings[si].stars));
  SECTIONS.forEach((_,i)=>renderPips(i));
  buildSidebar();buildHome();
  toast(`${SECTIONS[si].title} rated ${S.ratings[si].stars>0?S.ratings[si].stars+'/5':'cleared'}`);
  autosave();
}
function setSelf(si,val){
  if(!S.ratings[si])S.ratings[si]={stars:0,note:'',selfStars:0,selfNote:''};
  S.ratings[si].selfStars=S.ratings[si].selfStars===val?0:val;
  document.querySelectorAll(`.sstar[data-si="${si}"]`).forEach(el=>el.classList.toggle('lit',parseInt(el.dataset.sv)<=S.ratings[si].selfStars));
  autosave();
}
function setSelfNote(si,val){if(!S.ratings[si])S.ratings[si]={stars:0,note:'',selfStars:0,selfNote:''};S.ratings[si].selfNote=val;autosave();}
function setNote(si,val){if(!S.ratings[si])S.ratings[si]={stars:0,note:'',selfStars:0,selfNote:''};S.ratings[si].note=val;autosave();}
function setW(id,si,val,span){
  const v=parseInt(val);S.wb[`${id}_${si}`]=v;
  const k=KPIS.find(k=>k.id===id);const cls=v>0?vc(v,k.max):'';
  span.textContent=v>0?v:'—';span.className=`kv ${cls}`;
  if(id==='happy'&&si===0)document.getElementById('stat-happy').textContent=v>0?v+'/10':'—';
  autosave();
}

// SUMMARY
function buildSummary(){
  const scores=SECTIONS.map((_,i)=>(S.ratings[i]||{}).stars||0).filter(x=>x>0);
  const rated=scores.length;
  const overall=rated?Math.round(scores.reduce((a,b)=>a+b,0)/rated):0;
  const avgScore=rated?(scores.reduce((a,b)=>a+b,0)/rated).toFixed(1):null;

  const kpiRated=(S.ratings['kpi']||{}).stars>0?1:0;
  document.getElementById('stat-rated').textContent=`${rated+kpiRated}/${SECTIONS.length+1}`;
  const shEl=document.getElementById('stat-happy');if(shEl)shEl.innerHTML=dominantEmoji('happy');
  const seEl=document.getElementById('stat-energy');if(seEl)seEl.innerHTML=dominantEmoji('energy');
  document.getElementById('sum-stars').innerHTML=stH(overall,20);

  // Section table — with previous rating input and trend
  const trendIcon=(prev,curr)=>{
    if(!prev||!curr) return '<span style="color:#d1d5db;font-size:13px;">—</span>';
    if(curr>prev) return `<span style="color:var(--green);font-size:15px;font-weight:700;">↑</span><span style="font-size:11px;color:var(--green);margin-left:3px;">+${curr-prev}</span>`;
    if(curr<prev) return `<span style="color:var(--red);font-size:15px;font-weight:700;">↓</span><span style="font-size:11px;color:var(--red);margin-left:3px;">${curr-prev}</span>`;
    return '<span style="color:var(--muted);font-size:13px;">→</span>';
  };
  const prevStarsHtml=(si)=>{
    const pv=S.prevRatings[si]||0;
    let h='<div style="display:flex;gap:3px;">';
    for(let i=1;i<=5;i++) h+=`<span style="font-size:16px;cursor:pointer;color:${i<=pv?'#a855f7':'#e5e7eb'};transition:color .1s;" onclick="setPrevRating(${si},${i})" title="Set last review rating to ${i}">★</span>`;
    h+='</div>';
    if(pv>0) h+=`<div style="font-size:10px;color:#a855f7;margin-top:2px;">${pv}/5 last review</div>`;
    else h+=`<div style="font-size:10px;color:#d1d5db;margin-top:2px;">Click to set</div>`;
    return h;
  };

  document.getElementById('sum-tbody').innerHTML=
    SECTIONS.map((s,i)=>{
      const r=S.ratings[i]||{};
      const pv=S.prevRatings[i]||0;
      const cv=r.stars||0;
      const kr=S.ratings['kpi']||{};
      const kcv=kr.stars||0;
      const kpiRow=i===3?`<tr><td><span class="sec-name">📊 Key Performance Indicators</span></td><td><div style="font-size:10px;color:#d1d5db;">—</div></td><td>${kcv>0?stH(kcv):'<span class="no-rating">Not rated</span>'}</td><td style="text-align:center;">—</td><td>${kr.note?'<span class="sum-note">'+esc(kr.note)+'</span>':'<span class="no-rating">No notes</span>'}</td></tr>`:'';
      return kpiRow+`<tr>
        <td><span class="sec-name">${i<4?i+1:i+2}. ${s.icon} ${s.title}</span></td>
        <td>${prevStarsHtml(i)}</td>
        <td>${cv>0?stH(cv):'<span class="no-rating">Not rated</span>'}</td>
        <td style="text-align:center;">${trendIcon(pv||null, cv||null)}</td>
        <td>${r.note?`<span class="sum-note">${esc(r.note)}</span>`:'<span class="no-rating">No notes</span>'}</td>
      </tr>`;
    }).join('')+
    `<tr class="overall-row">
      <td><span class="sec-name" style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;">Overall Manager Rating</span></td>
      <td>${Object.keys(S.prevRatings).length>0?stH(Math.round(Object.values(S.prevRatings).reduce((a,b)=>a+b,0)/Object.values(S.prevRatings).length)):'<span class="no-rating">—</span>'}</td>
      <td>${overall>0?stH(overall):'<span class="no-rating">—</span>'}</td>
      <td style="text-align:center;">${(()=>{const p=Object.values(S.prevRatings);const prevAvg=p.length?Math.round(p.reduce((a,b)=>a+b,0)/p.length):0;return trendIcon(prevAvg||null,overall||null);})()}</td>
      <td></td>
      <td>${avgScore?(()=>{
        const av=parseFloat(avgScore);
        const lbl=av<2?'Needs attention':av<3?'Below expectations':av<4?'Meeting expectations':av<5?'Exceeding':'Outstanding';
        const col=av<2?'#991b1b':av<3?'#92400e':av<4?'#065f46':'#1e40af';
        const bg=av<2?'#fee2e2':av<3?'#fef3c7':av<4?'#d1fae5':'#dbeafe';
        return `<div style="display:flex;align-items:center;gap:8px;justify-content:flex-end;"><span style="font-size:14px;font-weight:700;color:var(--ink);">Avg ${avgScore}/5</span><span style="background:${bg};color:${col};border-radius:99px;padding:3px 10px;font-size:10.5px;font-weight:700;white-space:nowrap;">${lbl}</span></div>`;
      })():''}</td>
    </tr>
    <tr><td colspan="6" style="padding:8px 12px;font-size:11px;color:var(--muted);border-top:1px solid var(--border);background:var(--surface);"><span style="font-weight:600;color:var(--ink);">Rating guide:</span> &nbsp;<span style="color:#f59e0b;font-weight:700;">★</span> 1 Needs attention &nbsp;·&nbsp; <span style="color:#f59e0b;font-weight:700;">★★</span> 2 Below expectations &nbsp;·&nbsp; <span style="color:#f59e0b;font-weight:700;">★★★</span> 3 Meeting expectations &nbsp;·&nbsp; <span style="color:#f59e0b;font-weight:700;">★★★★</span> 4 Exceeding &nbsp;·&nbsp; <span style="color:#f59e0b;font-weight:700;">★★★★★</span> 5 Outstanding</td></tr>`;

  // KPI summary
  let kh=`<div style="padding:12px 18px 4px;font-size:12px;color:var(--muted);line-height:1.5;">Emoji selections across all 8 sections. A dip in a specific section is often more informative than the overall average.</div><div class="kpi-sum-grid">`;
  KPIS.forEach(k=>{
    const c=countEmoji(k.id);const total=c.struggling+c.good+c.great;
    const dominant=c.great>=c.good&&c.great>=c.struggling?'great':c.good>=c.struggling?'good':'struggling';
    const cls=total===0?'':dominant==='great'?'high':dominant==='good'?'mid':'low';
    kh+=`<div class="kpi-sum-item"><div class="kpi-sum-name">${k.name}</div>
    <div style="display:flex;gap:10px;margin:8px 0;flex-wrap:wrap;">
      ${c.struggling?'<span style="background:var(--surface);color:var(--ink);border-radius:99px;padding:3px 10px;font-size:12px;font-weight:600;">😔 '+c.struggling+' Struggling</span>':''}
      ${c.good?'<span style="background:var(--surface);color:var(--ink);border-radius:99px;padding:3px 10px;font-size:12px;font-weight:600;">🙂 '+c.good+' Good</span>':''}
      ${c.great?'<span style="background:var(--surface);color:var(--ink);border-radius:99px;padding:3px 10px;font-size:12px;font-weight:600;">😊 '+c.great+' Great</span>':''}
      ${!total?'<span style="color:#d1d5db;font-size:12px;">Not completed</span>':''}
    </div>
    <div class="kpi-sum-label">${k.target}</div></div>`;
  });
  kh+=`</div><div style="padding:0 18px 16px;"><div style="font-size:11px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin:4px 0 10px;">Section breakdown</div>
      <table style="width:100%;border-collapse:collapse;font-size:12px;">
        <thead><tr>
          <th style="text-align:left;padding:6px 10px;background:var(--surface);border-bottom:1px solid var(--border);color:var(--muted);">Section</th>
          ${KPIS.map(k=>'<th style="text-align:center;padding:6px 10px;background:var(--surface);border-bottom:1px solid var(--border);color:var(--muted);">'+k.name+'</th>').join('')}
        </tr></thead>
        <tbody>
          ${(()=>{
            const cell=(v)=>{const em=v===1?'😔':v===3?'🙂':v===5?'😊':null;const bg=v===1?'var(--surface)':v===3?'var(--surface)':v===5?'var(--surface)':'transparent';const tc='var(--ink)';return '<td style="text-align:center;padding:4px 8px;border-bottom:1px solid var(--border);">'+(em?'<span style="background:'+bg+';color:'+tc+';border-radius:99px;padding:2px 10px;font-size:14px;">'+em+'</span>':'<span style="color:#d1d5db;">—</span>')+'</td>';};
            const dashCells=KPIS.map(function(k){return cell(S.wb[k.id+'_kpi']||0);}).join('');
            let rows='';
            SECTIONS.forEach((sec,si)=>{
              if(si===3) rows+='<tr><td style="padding:6px 10px;border-bottom:1px solid var(--border);font-weight:500;">5. 📊 Key Performance Indicators</td>'+dashCells+'</tr>';
              rows+='<tr><td style="padding:6px 10px;border-bottom:1px solid var(--border);font-weight:500;">'+(si<4?si+1:si+2)+'. '+sec.icon+' '+sec.title+'</td>'+KPIS.map(k=>cell(S.wb[k.id+'_'+si]||0)).join('')+'</tr>';
            });
            return rows;
          })()}
        </tbody>
      </table>
    </div>`;
  document.getElementById('kpi-sum').innerHTML=kh;

  buildTrend();
  buildWellbeingScore();
  buildCarryForward();
  // Manager commitment
  const cmtEl=document.getElementById('sum-commitment');
  if(cmtEl) cmtEl.textContent=S.mgrCommitment||'No commitment recorded yet.';
  // Actions
  buildActions();

  refreshPrev();
}

function setPrevRating(si,val){S.prevRatings[si]=S.prevRatings[si]===val?0:val;buildSummary();autosave();}

// COMPARISON
function upPrev(id,val,max){S.prev[id]=parseFloat(val);refreshPrev();autosave();}
function refreshPrev(){
  const domVal={struggling:1,good:2,great:3};
  KPIS.forEach(k=>{
    const nE=document.getElementById('pvn-'+k.id);
    const aE=document.getElementById('pa-'+k.id);
    const cE=document.getElementById('pc-'+k.id);
    const oE=document.getElementById('pvo-'+k.id);
    if(!nE)return;
    nE.innerHTML=dominantEmoji(k.id);
    nE.style.fontSize='12px';
    const prev=S.prev?S.prev[k.id]:null;
    const c=countEmoji(k.id);
    const total=c.struggling+c.good+c.great;
    const curr=total===0?null:c.great>=c.good&&c.great>=c.struggling?'great':c.good>=c.struggling?'good':'struggling';
    if(oE) oE.innerHTML=prev?'<span style="font-size:13px;font-weight:600;">'+{struggling:'😔 Struggling',good:'🙂 Good',great:'😊 Great'}[prev]+'</span>':'<span style="color:#d1d5db;font-size:11px;">Not set</span>';
    if(prev&&curr){
      const pv=domVal[prev],cv=domVal[curr];
      if(cv>pv){aE.textContent='↑';aE.className='prev-arrow up';}
      else if(cv<pv){aE.textContent='↓';aE.className='prev-arrow down';}
      else{aE.textContent='→';aE.className='prev-arrow';}
      cE.textContent=cv>pv?'Improved':cv<pv?'Declined':'No change';
      cE.className='prev-change'+(cv>pv?' up':cv<pv?' down':'');
    } else {
      aE.textContent='→';aE.className='prev-arrow';
      cE.textContent='';cE.className='prev-change';
    }
  });
  buildCfoKpis();
}

// NAVIGATION
function showGoals(){hideAll();document.getElementById('page-goals').classList.add('active');setNav('goals');}
function showKpi(){hideAll();document.getElementById('page-kpi').classList.add('active');setNav('kpi');buildCfoKpis();buildKpiInds();restoreCfoNote();}
function showHome(){hideAll();document.getElementById('page-home').classList.add('active');setNav('home');buildHome();}
function showHow(){hideAll();document.getElementById('page-how').classList.add('active');setNav('how');}
function showSection(si){currentSi=si;hideAll();document.getElementById('page-sections').classList.add('active');SECTIONS.forEach((_,i)=>{const e=document.getElementById(`sec-${i}`);if(e)e.style.display=i===si?'block':'none';});setNav(si);renderPips(si);}
function showSummary(){hideAll();document.getElementById('page-summary').classList.add('active');setNav('summary');buildSummary();buildReflection();}
function hideAll(){document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));}
function setNav(idx){document.querySelectorAll('.nav-item').forEach(el=>el.classList.toggle('active',el.dataset.idx==idx));}
function toast(msg){const t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');clearTimeout(window._tt);window._tt=setTimeout(()=>t.classList.remove('show'),2000);}

// INIT
// Ensure sidebar is expanded on load
{const sb2=document.getElementById('sidebar');const sbt2=document.getElementById('sb-toggle');if(sb2)sb2.classList.remove('collapsed');if(sbt2){sbt2.classList.remove('at-edge');sbt2.textContent='✕';}}
// Init sequence — each step wrapped to prevent one failure stopping the chain
try{loadState();}catch(e){console.warn('loadState:',e);}
try{initResponses();}catch(e){console.warn('initResponses:',e);}
try{buildSidebar();}catch(e){console.warn('buildSidebar:',e);}
try{buildHome();}catch(e){console.warn('buildHome:',e);}
try{buildSections();}catch(e){console.warn('buildSections:',e);}
try{buildCfoKpis();}catch(e){console.warn('buildCfoKpis:',e);}
try{restoreCfoNote();}catch(e){console.warn('restoreCfoNote:',e);}
try{restoreMeta();}catch(e){console.warn('restoreMeta:',e);}
try{restoreSignoff();}catch(e){console.warn('restoreSignoff:',e);}
try{loadPrep();}catch(e){console.warn('loadPrep:',e);}
try{const ce=document.getElementById('mgr-commitment');if(ce&&S.mgrCommitment)ce.value=S.mgrCommitment;}catch(e){}
try{showSection(0);}catch(e){console.warn('showSection:',e);}
try{if(S.ratings&&S.ratings['kpi']){const kr=S.ratings['kpi'];document.querySelectorAll('.kpi-star').forEach((st,i)=>{st.style.color=i<kr.stars?'var(--amber)':'#e5e7eb';});const kn=document.getElementById('kpi-rating-note');if(kn)kn.value=kr.note||'';}}catch(e){}
try{if(S.prev){['happy','energy'].forEach(function(id){const v=S.prev[id];if(v){const btns=document.querySelectorAll('.prev-emoji-btn[data-id="'+id+'"]');btns.forEach(function(b){if(b.dataset.val===v)b.classList.add('sel-'+v);});}});}}catch(e){}
try{if(S.qtrs){Object.entries(S.qtrs).forEach(([k,v])=>{const el=document.getElementById('qtr-'+k);if(el&&v){el.textContent=v==='pass'?'✓':'✗';el.style.background=v==='pass'?'var(--surface)':'var(--surface)';el.style.color=v==='pass'?'var(--ink)':'var(--ink)';el.style.borderColor=v==='pass'?'#6ee7b7':'#fca5a5';}});}}catch(e){}
const REFLECTIONS=[
  {id:"r1",tag:"rt-watch",label:"The employee gave consistently short or positive answers to every open question",          sub:"One-word responses across the board may indicate surface-level engagement, not genuine openness."},
  {id:"r2",tag:"rt-watch",label:"They didn't raise anything critical, difficult, or negative",                             sub:"A review with zero concerns is not necessarily a good sign — it may mean they don't feel safe raising them."},
  {id:"r3",tag:"rt-good", label:"They pushed back, disagreed, or offered an opinion I didn't expect",                     sub:"Disagreement is a strong positive signal of psychological safety."},
  {id:"r4",tag:"rt-good", label:"They brought up a concern or problem unprompted — before I asked",                       sub:"Volunteering difficult information requires trust. Note it and acknowledge it."},
  {id:"r5",tag:"rt-watch",label:"The conversation felt like they were telling me what I wanted to hear",                  sub:"Did their tone change when topics got sensitive? Worth reflecting on honestly."},
  {id:"r6",tag:"rt-act",  label:"They mentioned feeling overwhelmed, under-resourced, or unable to keep up",              sub:"This is an early warning. Even if framed positively, it needs a follow-up action."},
  {id:"r7",tag:"rt-good", label:"They admitted to a mistake, a gap in their knowledge, or something they're unsure of",  sub:"Vulnerability requires safety. One of the healthiest signals you can observe."},
  {id:"r8",tag:"rt-watch",label:"Their indicator scores seem inconsistent with how the conversation actually felt",        sub:"If they rated 9/10 but flagged serious workload concerns, the scores may not reflect reality."},
  {id:"r9",tag:"rt-act",  label:"I talked more than they did in this review",                                             sub:"A 1-2-1 should be 70% employee, 30% manager. If reversed, adjust for next time."},
];

function buildReflection(){
  buildReflSelf();
  calcReflScore();
  const list=document.getElementById('refl-list');
  if(!list) return;
  list.innerHTML=REFLECTIONS.map(r=>`<div class="refl-item">
    <div class="refl-check ${(S.rc||{})[r.id]?'checked':''} " onclick="toggleR('${r.id}',this)"></div>
    <div class="refl-text"><span class="rtag ${r.tag}">${r.tag==='rt-good'?'Positive':r.tag==='rt-watch'?'Watch':'Act'}</span>${r.label}<div class="refl-sub">${r.sub}</div></div>
  </div>`).join('');
  const ta=document.getElementById('refl-note-ta');
  if(ta) ta.value=S.reflNote||'';
}

function toggleR(id,el){
  S.rc=S.rc||{};
  S.rc[id]=!S.rc[id];
  el.classList.toggle('checked',S.rc[id]);
  autosave();
}

// INIT
// Ensure sidebar is expanded on load
const _sb=document.getElementById('sidebar');
const _sbt=document.getElementById('sb-toggle');
if(_sb){_sb.classList.remove('collapsed');}
if(_sbt){_sbt.classList.remove('at-edge');_sbt.textContent='✕';}
try{loadState();}catch(e){console.warn('loadState:',e);}
try{initResponses();}catch(e){console.warn('initResponses:',e);}
try{buildSidebar();}catch(e){console.warn('buildSidebar:',e);}
try{buildHome();}catch(e){console.warn('buildHome:',e);}
try{buildSections();}catch(e){console.warn('buildSections:',e);}
try{buildCfoKpis();}catch(e){console.warn('buildCfoKpis:',e);}
try{restoreCfoNote();}catch(e){console.warn('restoreCfoNote:',e);}
try{restoreMeta();}catch(e){console.warn('restoreMeta:',e);}
try{restoreSignoff();}catch(e){console.warn('restoreSignoff:',e);}
try{loadPrep();}catch(e){console.warn('loadPrep:',e);}
try{const ce=document.getElementById('mgr-commitment');if(ce&&S.mgrCommitment)ce.value=S.mgrCommitment;}catch(e){}
try{showSection(0);}catch(e){console.warn('showSection:',e);}
try{if(S.qtrs){Object.entries(S.qtrs).forEach(([k,v])=>{const el=document.getElementById('qtr-'+k);if(el&&v){el.textContent=v==='pass'?'✓':'✗';el.style.color=v==='pass'?'var(--ink)':'var(--ink)';}});}}catch(e){}
