window.HR = { _expItems:null, _jdEmail:null, _handbook:null, _jdTemplate:null, _hbObserver:null };
HR.strip = function(h){ return (h||"").replace(/<script[\s\S]*?<\/script>/gi,"").replace(/\son\w+="[^"]*"/gi,""); };  // quick tidy only; the server cleans all HTML properly
/* Call the server; returns [data, error] so the screens below read like the original. */
HR.call = async function(action,params){ try{ return [await DB.api(action,params), null]; }catch(e){ return [null, e]; } };
HR.hero = function(eyebrow,title,subHtml,rlbl,rval){
  return `<div class="sdi-hero"><div class="sdi-hero-l"><div class="sdi-hero-ey">${DB.esc(eyebrow)}</div><div class="sdi-hero-title">${DB.esc(title)}</div>`
    +(subHtml?`<div class="sdi-hero-sub">${subHtml}</div>`:``)+`</div>`
    +((rlbl||rval)?`<div class="sdi-hero-r"><div class="lbl">${DB.esc(rlbl||"")}</div><div class="val">${DB.esc(rval||"")}</div></div>`:``)+`</div>`;
};
HR.ALIGN={
  self_cert:{rows:[
    {k:"sda",tags:[{ref:"SDA 3.1.2",label:"Wellbeing in a Service Desk environment"},{ref:"3.1.4–3.1.5",label:"Work-life balance"},{ref:"3.4.1",label:"Emotional resilience"},{ref:"1.4.1",label:"Purpose of organisational policies"},{ref:"1.5.1",label:"Personal accountability"}]},
    {k:"sdc",tags:[{ref:"SDC 6.9",label:"Workplace Wellbeing"}]}
  ],support:"Supports People Management (Concept 3) and Professionalism &amp; ethics (9.4) of the SDI Global Best Practice Standard."},
  expense:{rows:[
    {k:"sda",tags:[{ref:"SDA 1.4.1",label:"Purpose of organisational policies"},{ref:"1.5.1",label:"Personal accountability"},{ref:"1.6.2–1.6.3",label:"Service attitude & its impact"}]}
  ],support:"Supports Professionalism &amp; ethics (Concept 9.4) of the SDI Global Best Practice Standard."},
  flex_work:{rows:[
    {k:"sda",tags:[{ref:"SDA 3.1.4–3.1.5",label:"Work-life balance"},{ref:"3.2.1–3.2.2",label:"DEIB"}]},
    {k:"sdc",tags:[{ref:"SDC 6.7",label:""},{ref:"6.8",label:""},{ref:"6.10",label:""}]}
  ],support:""},
  dse:{rows:[
    {k:"sda",tags:[{ref:"SDA 3.1.2",label:"Wellbeing in a Service Desk environment"},{ref:"3.1.3",label:""},{ref:"3.4.1",label:"Emotional resilience"}]},
    {k:"sdc",tags:[{ref:"SDC 6.7",label:"Work-life Blend"},{ref:"6.9",label:"Workplace Wellbeing"}]}
  ],support:""}
};
HR.docCtrl=function(){
  return `<div class="doc-ctrl"><div class="dc"><div class="dc-lbl">Owner</div><div class="dc-val">Paul M Rodrigues (Chair &amp; CEO)</div></div><div class="dc"><div class="dc-lbl">Version</div><div class="dc-val">1.0 · 2026</div></div><div class="dc"><div class="dc-lbl">Review cycle</div><div class="dc-val">Annual — next review 2027</div></div><div class="dc"><div class="dc-lbl">Classification</div><div class="dc-val">Internal</div></div></div>`;
};
HR.docBlock=function(type){
  const a=HR.ALIGN[type]||{rows:[],support:""};
  const rows=a.rows.map(r=>`<div class="align-row"><span class="align-lbl ${r.k}">${r.k.toUpperCase()}</span>${r.tags.map(t=>`<span class="align-tag"><b>${DB.esc(t.ref)}</b>${t.label?(" "+DB.esc(t.label)):""}</span>`).join("")}</div>`).join("");
  const box=`<div class="align-box"><div class="align-title">📋 Alignment to SDI Standard V9.0</div><div class="align-sub">This form reflects the following SDI Professional Standard competencies</div>${rows}${a.support?`<div class="align-support">${a.support}</div>`:""}</div>`;
  return HR.docCtrl()+box;
};
HR.orgRow = function(email){ return DB.org.find(m=>(m.email||"").toLowerCase()===(email||"").toLowerCase()); };
HR.iAmLineMgrOf = function(email){ const r=HR.orgRow(email); return !!(r && (r.manager_email||"").toLowerCase()===DB.myEmail); };
HR.needCloud = function(el){ if(window.DB && DB.client && DB.myEmail) return false; el.innerHTML='<div class="doc-card">Please sign in to use this section.</div>'; return true; };
function hrShow(pageId,nav){ if(typeof hideAll==="function") hideAll(); const p=document.getElementById(pageId); if(p) p.classList.add("active"); if(typeof setNav==="function") setNav(nav); }

/* Top-level tab controller. The 1-2-1 Review is one tab; on it we show the
   reviews list until a review is opened. Other tabs are full-width documents. */
function showTab(tab){
  document.querySelectorAll(".topbar-tab").forEach(b=>b.classList.toggle("active", b.dataset.tab===tab));
  const sb=document.getElementById("sidebar");
  if(tab==="review"){
    if(window.DB && DB.mode==="cloud" && !DB.currentId){
      if(sb) sb.style.display="none";
      if(typeof hideAll==="function") hideAll();
      const p=document.getElementById("page-reviews"); if(p) p.classList.add("active");
    } else {
      if(sb) sb.style.display="";
      try{ if(typeof currentSi!=="undefined" && currentSi!=null) showSection(currentSi); else showGoals(); }
      catch(e){ try{ showGoals(); }catch(_){} }
    }
  } else {
    if(sb) sb.style.display="none";
    if(tab==="handbook") showHandbook();
    else if(tab==="jd") showJD();
    else if(tab==="selfcert") showSelfCert();
    else if(tab==="expenses") showExpenses();
    else if(tab==="flexwork") showFlexWork();
    else if(tab==="dse") showDse();
    else if(tab==="followup") showFollowup();
    else if(tab==="history") showHistory();
  }
  try{ window.scrollTo(0,0); }catch(e){}
}

/* ---------- Staff Handbook (shared; admin edits) ---------- */
async function showHandbook(){ hrShow("page-handbook","handbook"); await HR.buildHandbook(); }
HR.buildHandbook = async function(){
  const el=document.getElementById("page-handbook"); if(!el) return;
  let content="<p>No handbook loaded.</p>";
  const [hb,hbErr]=await HR.call("docs.get",{key:"handbook"});
  if(hb&&hb.content) content=hb.content; else if(hbErr) content='<p>Couldn\'t load the handbook: '+DB.esc(hbErr.message)+'</p>';
  HR._handbook=content;
  const admin=!!DB.isAdmin;
  el.innerHTML=(admin?`<div style="text-align:right;margin-bottom:8px;"><button class="hr-btn" onclick="HR.editHandbook()">✎ Edit handbook</button></div>`:``)
    +`<div class="hb-layout"><nav class="hb-toc" id="hb-toc"></nav>`
    +`<div class="sdi-doc">`
    +HR.hero("Service Desk Institute® · Confidential","Staff Handbook","Your guide to how we work — reviewed annually. We exist to <strong>Surprise, Delight and Inspire</strong>.","Edition","2026")
    +HR.docCtrl()
    +`<div class="sdi-body" id="handbook-body">${content}</div></div></div>`;
  HR.makeCollapsible();
  HR.buildHandbookToc();
};
HR.buildHandbookToc = function(){
  const body=document.getElementById("handbook-body"), toc=document.getElementById("hb-toc");
  if(!body||!toc) return;
  const heads=[...body.querySelectorAll("h2")];
  if(!heads.length){ toc.style.display="none"; return; }
  const items=heads.map((h,i)=>{
    const id="hb-sec-"+i; h.id=id;
    const raw=(h.textContent||("Section "+(i+1))).trim();
    const m=raw.match(/^(\d+|DOC)\s+(.+)$/i);
    const num=m?(/^\d+$/.test(m[1])?m[1]:"▸"):"";
    const title=m?m[2]:raw;
    let grp="";
    if(num==="1") grp=`<div class="hb-grp">Welcome</div>`;
    else if(num==="2") grp=`<div class="hb-grp">Policies (A–Z)</div>`;
    return grp+`<a data-target="${id}" onclick="HR.gotoHb('${id}')"><span class="hb-num">${DB.esc(num)}</span><span>${DB.esc(title)}</span></a>`;
  }).join("");
  toc.innerHTML=`<div class="hb-toc-head"><div class="hb-toc-brand">Service Desk Institute®</div><div class="hb-toc-sub">Staff Handbook</div><div class="hb-toc-ver">2026 Edition</div></div>`
    +`<div class="hb-fold"><button onclick="HR.foldHb(false)">⇢ Expand all</button><button onclick="HR.foldHb(true)">⇡ Collapse all</button></div>`
    +`<div class="hb-toc-list">${items}</div>`;
  if(HR._hbObserver){ try{HR._hbObserver.disconnect();}catch(e){} }
  try{
    HR._hbObserver=new IntersectionObserver((ents)=>{
      ents.forEach(e=>{ if(e.isIntersecting){ document.querySelectorAll("#hb-toc a").forEach(a=>a.classList.toggle("active", a.dataset.target===e.target.id)); } });
    },{rootMargin:"-70px 0px -75% 0px", threshold:0});
    heads.forEach(h=>HR._hbObserver.observe(h));
  }catch(e){}
};
HR.gotoHb = function(id){
  const t=document.getElementById(id);
  if(t){ const sec=t.closest(".hb-sec"); if(sec) sec.classList.remove("collapsed"); t.scrollIntoView({behavior:"smooth",block:"start"}); }
  document.querySelectorAll("#hb-toc a").forEach(a=>a.classList.toggle("active", a.dataset.target===id));
};
/* Wrap each H2 + its following content into a collapsible section card (like the original). */
HR.makeCollapsible = function(body){
  body = (typeof body==="string") ? document.getElementById(body) : (body||document.getElementById("handbook-body"));
  if(!body) return;
  if(body.querySelector(".hb-sec")) return;   // already done
  const nodes=[...body.childNodes];
  const frag=document.createDocumentFragment();
  let pre=null, curBody=null;
  const flushPre=()=>{ if(pre && pre.childNodes.length) frag.appendChild(pre); pre=null; };
  nodes.forEach(n=>{
    if(n.nodeType===1 && n.tagName==="H2"){
      flushPre();
      const sec=document.createElement("div"); sec.className="hb-sec";
      const head=document.createElement("div"); head.className="hb-sec-head";
      head.onclick=function(){ this.parentNode.classList.toggle("collapsed"); };
      head.appendChild(n);
      const chev=document.createElement("span"); chev.className="hb-chevron"; chev.textContent="▾";
      head.appendChild(chev);
      curBody=document.createElement("div"); curBody.className="hb-sec-body";
      sec.appendChild(head); sec.appendChild(curBody);
      frag.appendChild(sec);
    } else if(curBody){ curBody.appendChild(n); }
    else { if(!pre){ pre=document.createElement("div"); pre.className="hb-pre"; } pre.appendChild(n); }
  });
  flushPre();
  body.innerHTML=""; body.appendChild(frag);
};
HR.foldHb = function(collapse){ document.querySelectorAll("#handbook-body .hb-sec").forEach(s=>s.classList.toggle("collapsed",!!collapse)); };
HR.foldJD = function(collapse){ document.querySelectorAll("#jd-view-body .hb-sec").forEach(s=>s.classList.toggle("collapsed",!!collapse)); };
HR.editHandbook = function(){
  const el=document.getElementById("page-handbook");
  el.innerHTML=`<div class="hr-head"><h1>Edit Staff Handbook</h1><div><button class="hr-btn ghost" onclick="showHandbook()">Cancel</button> <button class="hr-btn" onclick="HR.saveHandbook()">Save &amp; publish to all</button></div></div><div class="hr-note">Editing the company-wide handbook. Saving publishes it to everyone immediately.</div><div class="hr-editor" id="handbook-edit" contenteditable="true">${HR._handbook||""}</div>`;
};
HR.saveHandbook = async function(){
  const html=HR.strip(document.getElementById("handbook-edit").innerHTML);
  const [,error]=await HR.call("docs.save",{key:"handbook",content:html});
  if(error){ HR.error("Save failed: "+error.message); return; }
  if(typeof toast==="function") toast("Handbook updated"); showHandbook();
};

/* ---------- Job Description (per-person; line mgr proposes, admin approves) ---------- */
async function showJD(){ hrShow("page-jd","jd"); await HR.buildJD(); }
HR.pickJD = function(email){ HR._jdEmail=(email||"").toLowerCase(); HR.buildJD(); };
HR.getJDTemplate = async function(){
  if(HR._jdTemplate!=null) return HR._jdTemplate;
  const [d]=await HR.call("docs.get",{key:"jd_template"});
  HR._jdTemplate=(d&&d.content)||"";
  return HR._jdTemplate;
};
HR.saveJDTemplate = async function(){
  const html=HR.strip(document.getElementById("jd-edit").innerHTML);
  const [saved,error]=await HR.call("docs.save",{key:"jd_template",content:html});
  if(error){ HR.error("Save failed: "+error.message); return; }
  HR._jdTemplate=(saved&&saved.content)||html;
  if(typeof toast==="function") toast("Master template saved"); HR.buildJD();
};
HR.buildJD = async function(){
  const el=document.getElementById("page-jd"); if(!el) return; if(HR.needCloud(el)) return;
  const admin=!!DB.isAdmin;
  const tpl=await HR.getJDTemplate();
  let people = admin ? DB.org.slice() : DB.org.filter(m=>(m.manager_email||"").toLowerCase()===DB.myEmail);
  const meRow=HR.orgRow(DB.myEmail); if(meRow && !people.find(p=>(p.email||"").toLowerCase()===DB.myEmail)) people.unshift(meRow);
  if(!people.length) people=[{email:DB.myEmail, full_name:(DB.user&&DB.user.name)||DB.myEmail}];
  const validTpl = (HR._jdEmail==="__template__" && admin);
  if(!HR._jdEmail || (!validTpl && !people.find(p=>(p.email||"").toLowerCase()===HR._jdEmail))) HR._jdEmail=(people[0].email||"").toLowerCase();
  const emp=HR._jdEmail;
  const opts=(admin?`<option value="__template__" ${emp==="__template__"?"selected":""}>★ Master template</option>`:"")
    +people.map(p=>{const e=(p.email||"").toLowerCase();return `<option value="${DB.esc(e)}" ${e===emp?"selected":""}>${DB.esc(p.full_name||p.email)}${e===DB.myEmail?" (you)":""}</option>`;}).join("");
  const sel=`<select class="hr-sel" onchange="HR.pickJD(this.value)">`+opts+`</select>`;

  // Admin-only: edit the master template that every new job description starts from.
  if(emp==="__template__"){
    el.innerHTML=`<div class="hr-head"><h1>Job Description</h1>${sel}</div>`
      +`<div class="hr-note">This is the <b>master template</b> (the SDI Head of Customer Engagement job description). Every new job description starts from this. Editing here updates the template for future job descriptions — it does not change anyone's existing one.</div>`
      +`<div class="hr-editor" id="jd-edit" contenteditable="true">${tpl}</div>`
      +`<div style="margin-top:10px;"><button class="hr-btn" onclick="HR.saveJDTemplate()">Save master template</button></div>`;
    return;
  }

  const empName=(HR.orgRow(emp)||{}).full_name||emp;
  const [jdRes]=await HR.call("jd.get",{employee_email:emp}); const jd=(jdRes&&jdRes.item)||null;
  const live=(jd&&jd.content)||"", pending=(jd&&jd.pending_content)||"";
  const iAmMgr=HR.iAmLineMgrOf(emp);
  let body="";
  if(admin){
    if(pending) body+=`<div class="hr-pending"><b>⏳ Proposed change awaiting your approval</b> — submitted by ${DB.esc(jd.pending_by||"")}.<div style="margin-top:8px;"><button class="hr-btn approve" onclick="HR.approveJD('${DB.esc(emp)}')">✓ Approve &amp; publish</button> <button class="hr-btn reject" onclick="HR.rejectJD('${DB.esc(emp)}')">✗ Reject</button></div><div class="sdi-doc" style="margin-top:10px;"><div class="sdi-body">${pending}</div></div></div>`;
    body+=`<div class="hr-note">Editing <b>${DB.esc(empName)}</b>'s job description (starts from the master template). As admin, changes publish immediately.</div><div class="hr-editor" id="jd-edit" contenteditable="true">${live||tpl||""}</div><div style="margin-top:10px;"><button class="hr-btn" onclick="HR.adminSaveJD('${DB.esc(emp)}')">Save &amp; publish</button></div>`;
  } else if(iAmMgr){
    if(pending) body+=`<div class="hr-pending">⏳ Your proposed change is awaiting Paul's approval.</div>`;
    body+=`<div class="hr-note">You are ${DB.esc(empName)}'s line manager. Edit below (starts from the master template) and submit for Paul's approval — it goes live only once approved.</div><div class="hr-editor" id="jd-edit" contenteditable="true">${pending||live||tpl||""}</div><div style="margin-top:10px;"><button class="hr-btn" onclick="HR.submitJD('${DB.esc(emp)}')">Submit for Paul's approval</button></div>`;
  } else {
    const showContent = live || tpl;
    const placeholder = !live && !!tpl;
    body+= showContent
      ? `<div class="sdi-doc">${HR.hero("Service Desk Institute® · Job Description",empName,placeholder?"Placeholder — based on the master template until a specific version is saved.":"","Post-holder",empName)}`
        +HR.docCtrl()
        +`<div style="display:flex;gap:8px;margin-bottom:12px;"><button class="hr-btn ghost" onclick="HR.foldJD(false)">⊕ Expand all</button><button class="hr-btn ghost" onclick="HR.foldJD(true)">⊖ Collapse all</button></div>`
        +`<div class="sdi-body" id="jd-view-body">${showContent}</div></div>`
      : `<div class="hr-note">No job description on file yet.</div>`;
    if(pending && emp===DB.myEmail) body+=`<div class="hr-note">An update to your job description is awaiting approval.</div>`;
  }
  el.innerHTML=`<div class="hr-head"><h1>Job Description</h1>${sel}</div>`+body;
  const jvb=document.getElementById("jd-view-body"); if(jvb) HR.makeCollapsible(jvb);
  if(admin) HR.renderJDPending(el);
};
HR.renderJDPending = async function(el){
  try{ const [pr]=await HR.call("jd.pending"); const data=(pr&&pr.items)||[];
    if(data&&data.length){ const box=document.createElement("div"); box.innerHTML=`<h3 style="margin-top:22px;">Pending approvals (${data.length})</h3>`+data.map(d=>`<div class="hr-list-item"><div>${DB.esc(d.employee_email)} — proposed by ${DB.esc(d.pending_by||"")}</div><button class="hr-btn ghost" onclick="HR.pickJD('${DB.esc(d.employee_email)}')">Review</button></div>`).join(""); el.appendChild(box); }
  }catch(e){}
};
HR.submitJD = async function(emp){
  const html=HR.strip(document.getElementById("jd-edit").innerHTML);
  const [,error]=await HR.call("jd.submit",{employee_email:emp,content:html});
  if(error){ HR.error("Submit failed: "+error.message); return; }
  if(typeof toast==="function") toast("Submitted for Paul's approval"); HR.buildJD();
};
HR.adminSaveJD = async function(emp){
  const html=HR.strip(document.getElementById("jd-edit").innerHTML);
  const [,error]=await HR.call("jd.publish",{employee_email:emp,content:html});
  if(error){ HR.error("Save failed: "+error.message); return; }
  if(typeof toast==="function") toast("Published"); HR.buildJD();
};
HR.approveJD = async function(emp){
  const [res,error]=await HR.call("jd.approve",{employee_email:emp});
  if(!error && res && !res.approved){ HR.buildJD(); return; }
  if(error){ HR.error("Approve failed: "+error.message); return; }
  if(typeof toast==="function") toast("Approved & published"); HR.buildJD();
};
HR.rejectJD = async function(emp){
  const [,error]=await HR.call("jd.reject",{employee_email:emp});
  if(error){ HR.error("Reject failed: "+error.message); return; }
  if(typeof toast==="function") toast("Rejected"); HR.buildJD();
};

/* ---------- Self-Certification (employee submits; line manager completes RTW) ---------- */
/* ============ Follow-Up to 1-2-1 (read-only summary of the open review's actions) ============ */
function showFollowup(){ hrShow("page-followup","followup"); HR.buildFollowup(); }
HR.buildFollowup = function(){
  const el=document.getElementById("page-followup"); if(!el) return;
  const who=(typeof S!=="undefined"&&S.meta&&S.meta.empName)||"";
  const hasReview=(window.DB&&DB.currentId)||who;
  if(!hasReview){
    el.innerHTML=`<div class="sdi-doc">${HR.hero("Service Desk Institute® · 1-2-1 Follow-Up","Follow-Up to 1-2-1","Open a 1-2-1 review to see its agreed actions and follow-up here.","","")}<div class="hr-note" style="margin-top:12px;">No review is open. Go to the <b>1-2-1 Review</b> tab, open a review, then come back.</div></div>`;
    return;
  }
  const acts=((typeof S!=="undefined"&&S.actions)||[]).filter(a=>a&&(a.text||"").trim());
  const rows=acts.length?acts.map((a,i)=>{
    const st=a.status||"open";
    const cls=st==="done"?"authorised":(st==="missed"?"rejected":"submitted");
    const lbl=st==="done"?"Done":(st==="missed"?"Not done":"Open");
    const meta=[a.ownerType?("Owner: "+a.ownerType):"",a.date?("Due "+a.date):"",a.source?("From: "+a.source):""].filter(Boolean).join(" · ");
    return `<div class="hr-list-item"><div><b>${i+1}. ${DB.esc(a.text)}</b>${meta?`<div class="hr-note" style="margin:2px 0 0;">${DB.esc(meta)}</div>`:""}</div><span class="hr-status ${cls}">${lbl}</span></div>`;
  }).join(""):`<div class="hr-note">No agreed actions captured yet. Add them in the review via the “+ Add as action” buttons or the Feedback &amp; Close summary.</div>`;
  el.innerHTML=`<div class="sdi-doc">`
    +HR.hero("Service Desk Institute® · 1-2-1 Follow-Up","Follow-Up to 1-2-1","The points discussed in the 1-2-1 to take away and action"+(who?(" — "+DB.esc(who)):"")+", with progress tracked against each.","Review",who||"—")
    +`<div style="margin-bottom:12px;"><button class="hr-btn ghost" onclick="HR.buildFollowup()">↻ Refresh</button></div>`
    +`<div class="doc-card">${rows}</div></div>`;
};
/* ---------- 1-2-1 History (signed-off, locked reviews) ---------- */
async function showHistory(){ hrShow("page-history","history"); await HR.buildHistory(); }
HR._histEmp=null;
// Overall rating (avg of section + KPI stars) and wellbeing index, as used on the summary page.
HR.reviewScores = function(st){
  st=st||{}; const r=st.ratings||{};
  const stars=SECTIONS.map((_,i)=>(r[i]||{}).stars||0).filter(x=>x>0);
  const kpi=(r.kpi||{}).stars||0; if(kpi>0) stars.push(kpi);
  const avg=stars.length?+(stars.reduce((a,b)=>a+b,0)/stars.length).toFixed(1):null;
  const wv=[]; for(let i=0;i<5;i++){ const q=(st.qratings||{})["0_"+i]; const v=q==="struggling"?1:q==="good"?2:q==="great"?3:null; if(v) wv.push(v); }
  const wb=wv.length?+(wv.reduce((a,b)=>a+b,0)/wv.length).toFixed(2):null;
  return {avg,wb};
};
HR.pickHistory = function(e){ HR._histEmp=e; HR.buildHistory(); };
HR.buildHistory = async function(){
  const el=document.getElementById("page-history"); if(!el) return; if(HR.needCloud(el)) return;
  el.innerHTML=`<div class="doc-card">Loading…</div>`;
  await DB.loadReviews();
  const done=DB.items.filter(r=>DB.signState(r).complete).map(r=>{
    let st={}; try{ st=(typeof r.state==="string")?JSON.parse(r.state||"{}"):(r.state||{}); }catch(e){}
    const when=(st.signoff&&st.signoff.dateAgreed)||r.review_date||r.completed_at||"";
    return Object.assign({_st:st,_when:String(when).slice(0,10)},HR.reviewScores(st),{row:r});
  });
  const byEmp={}; done.forEach(d=>{ const e=(d.row.employee_email||"").toLowerCase(); (byEmp[e]=byEmp[e]||[]).push(d); });
  const emails=Object.keys(byEmp).sort((a,b)=>DB.personName(a).localeCompare(DB.personName(b)));
  const head=HR.hero("Service Desk Institute® · 1-2-1 History","1-2-1 History","Signed-off 1-2-1 reviews. Once the employee and line manager have both signed, a review is locked and kept here as a permanent record.","","");
  if(!emails.length){
    el.innerHTML=`<div class="sdi-doc">${head}<div class="hr-note" style="margin-top:12px;">No signed-off reviews yet. Open a review, go to <b>View summary</b>, and use the Sign-off section once it is finished.</div></div>`;
    return;
  }
  let emp=HR._histEmp; if(!emp||!byEmp[emp]) emp=byEmp[DB.myEmail]?DB.myEmail:emails[0];
  HR._histEmp=emp;
  const list=byEmp[emp].slice().sort((a,b)=>(a._when||"").localeCompare(b._when||""));   // oldest → newest
  const sel=emails.length>1?`<select class="hr-sel" onchange="HR.pickHistory(this.value)">${emails.map(e=>`<option value="${DB.esc(e)}" ${e===emp?"selected":""}>${DB.esc(DB.personName(e))}${e===DB.myEmail?" (you)":""} — ${byEmp[e].length}</option>`).join("")}</select>`:"";
  const rated=list.filter(d=>d.avg!=null);
  const latest=rated.length?rated[rated.length-1].avg:null;
  const mean=rated.length?(rated.reduce((a,d)=>a+d.avg,0)/rated.length).toFixed(1):null;
  const stats=`<div class="hist-stats">
    <div class="hist-stat"><div class="lbl">Signed-off reviews</div><div class="val">${list.length}</div></div>
    <div class="hist-stat"><div class="lbl">Latest overall rating</div><div class="val">${latest!=null?latest+"/5":"—"}</div></div>
    <div class="hist-stat"><div class="lbl">Average across history</div><div class="val">${mean!=null?mean+"/5":"—"}</div></div></div>`;
  let prev=null;
  const rows=list.map(d=>{
    const t=d.avg!=null?getTrendLight(d.avg):null;
    let chg="—";
    if(d.avg!=null && prev!=null){ const x=+(d.avg-prev).toFixed(1); chg=x>0?`<span style="color:#15803d;font-weight:700;">▲ ${x}</span>`:x<0?`<span style="color:#dc2626;font-weight:700;">▼ ${Math.abs(x)}</span>`:`<span style="color:var(--muted);">＝</span>`; }
    if(d.avg!=null) prev=d.avg;
    const wb=d.wb!=null?getWellbeingBand(d.wb):null;
    const r=d.row;
    return {html:`<tr>
      <td><b>${DB.esc(d._when?DB.fmtDate(d._when):"—")}</b></td>
      <td>${DB.esc(DB.personName(r.employee_email)||r.employee_email||"—")}</td>
      <td>${DB.esc(r.manager_name||DB.personName(r.manager_email)||"—")}</td>
      <td>${t?`${t.light} <b>${d.avg}/5</b> <span style="color:var(--muted);font-size:11px;">${DB.esc(t.label)}</span>`:"—"}</td>
      <td>${chg}</td>
      <td>${wb?`${wb.light} ${DB.esc(wb.label.split(" — ")[0])}`:"—"}</td>
      <td style="font-size:11.5px;color:var(--muted);">🔒 ${DB.esc(DB.fmtDate(r.completed_at))}</td>
      <td><button class="hr-btn ghost" style="padding:4px 10px;" onclick="DB.openReview('${DB.esc(String(r.id))}')">Open</button></td></tr>`};
  }).reverse().map(x=>x.html).join("");   // newest first
  el.innerHTML=`<div class="sdi-doc">${head}
    <div class="hr-head" style="margin-top:14px;"><h1 style="font-size:15pt;">${DB.esc(DB.personName(emp))}</h1>${sel}</div>
    ${stats}
    <div class="hist-wrap"><table class="hist-tbl"><thead><tr><th>Review date</th><th>Employee</th><th>Reviewer</th><th>Overall rating</th><th>Change</th><th>Wellbeing</th><th>Signed off</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
    <div class="hr-note" style="margin-top:10px;">Signed-off reviews open read-only. “Change” compares each review’s overall rating with the previous one.</div></div>`;
};

/* ============ Shared helpers for the routed forms (added after initial testing, Oct 2026) ============ */
HR.today = function(){ const d=new Date(); return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); };
HR.money = function(n){ return "£"+(Number(n)||0).toFixed(2); };
HR.name = function(email){ return DB.personName(email)||email||""; };
HR.dt = function(ts){ return ts?DB.fmtDate(ts,true):""; };

/* A pop-up box in the page (replaces the browser's plain white alert/prompt boxes).
   Resolves to false on Cancel, or true / the typed text on OK. */
HR.modal = function(o){
  o=o||{};
  let m=document.getElementById("hr-modal");
  if(!m){ m=document.createElement("div"); m.id="hr-modal"; m.setAttribute("role","dialog"); m.setAttribute("aria-modal","true"); document.body.appendChild(m); }
  m.className=o.error?"error":"";
  const input=o.input?(o.input==="textarea"?`<textarea id="hm-input" rows="3" placeholder="${DB.esc(o.placeholder||"")}"></textarea>`:`<input id="hm-input" placeholder="${DB.esc(o.placeholder||"")}">`):"";
  m.innerHTML=`<div class="hm-card"><div class="hm-head">${DB.esc(o.title||(o.error?"Please check":"Confirm"))}</div>`
    +`<div class="hm-body">${o.html||DB.esc(o.body||"")}${input?`<div style="white-space:normal;">${input}</div>`:""}<div id="hm-err" class="hr-errbox" style="margin:10px 0 0;"></div></div>`
    +`<div class="hm-foot">${o.cancel===false?"":`<button class="hr-btn ghost" id="hm-cancel">${DB.esc(o.cancel||"Cancel")}</button>`}<button class="hr-btn ${o.okClass||""}" id="hm-ok">${DB.esc(o.ok||"OK")}</button></div></div>`;
  m.classList.add("show");
  return new Promise(resolve=>{
    const close=v=>{ m.classList.remove("show"); document.removeEventListener("keydown",key); resolve(v); };
    const key=e=>{ if(e.key==="Escape") close(false); };
    document.addEventListener("keydown",key);
    const c=document.getElementById("hm-cancel"); if(c) c.onclick=()=>close(false);
    document.getElementById("hm-ok").onclick=()=>{
      if(!o.input){ close(true); return; }
      const v=(document.getElementById("hm-input").value||"").trim();
      if(o.required && !v){ const e=document.getElementById("hm-err"); e.textContent=o.required; e.classList.add("show"); return; }
      close(v||"");
    };
    const f=document.getElementById("hm-input")||document.getElementById("hm-ok"); if(f) f.focus();
  });
};
HR.error = function(msg){ return HR.modal({title:"Something needs your attention",body:String(msg||""),error:true,ok:"OK",cancel:false}); };

/* Check a form. Each check is {label, ok, el}; failing fields are outlined in red and listed
   by name in a red box, so the message always matches what is actually missing. */
HR.validate = function(boxId, checks){
  const box=document.getElementById(boxId);
  const scope=(box&&box.closest(".sdi-doc"))||document;
  scope.querySelectorAll(".invalid").forEach(e=>e.classList.remove("invalid"));
  const bad=checks.filter(c=>!c.ok);
  bad.forEach(c=>{ (Array.isArray(c.el)?c.el:[c.el]).forEach(e=>{ if(e){ e.classList.add("invalid"); const clear=()=>{ e.classList.remove("invalid"); }; e.addEventListener("input",clear,{once:true}); e.addEventListener("change",clear,{once:true}); } }); });
  if(!box) return !bad.length;
  if(!bad.length){ box.classList.remove("show"); box.innerHTML=""; return true; }
  const labels=[...new Set(bad.map(c=>c.label))];
  box.innerHTML=`⚠ Please complete the following before submitting:<ul>${labels.map(l=>`<li>${DB.esc(l)}</li>`).join("")}</ul>`;
  box.classList.add("show");
  try{ box.scrollIntoView({behavior:"smooth",block:"center"}); }catch(e){}
  return false;
};
HR.serverError = function(boxId, err){
  const box=document.getElementById(boxId);
  if(!box){ HR.error(err.message); return; }
  box.innerHTML="⚠ "+DB.esc(err.message); box.classList.add("show");
  try{ box.scrollIntoView({behavior:"smooth",block:"center"}); }catch(e){}
};
HR.val = function(id){ const e=document.getElementById(id); return e?(e.value||"").trim():""; };
HR.radio = function(name){ return (document.querySelector('input[name="'+name+'"]:checked')||{}).value||""; };
HR.opts = function(name,values,type,checked,extra){
  return values.map(v=>`<label class="opt"><input type="${type||"radio"}" name="${name}" value="${DB.esc(v)}" ${(Array.isArray(checked)?checked.includes(v):checked===v)?"checked":""} ${extra||""}> <span>${DB.esc(v)}</span></label>`).join("");
};
HR.myRows = function(){ const me=HR.orgRow(DB.myEmail)||{}; const mgr=HR.orgRow(me.manager_email||"")||{}; return {me,mgr}; };
HR.amFinance = function(){ const r=HR.orgRow(DB.myEmail); return !!(r&&r.is_finance); };
HR.trailHtml = function(md){
  const t=(md&&md.trail)||[];
  if(!t.length) return "";
  const lbl={authorised:"Authorised",rejected:"Rejected",approved:"Approved",payment_authorised:"Payment authorised",paid:"Marked as paid",trial:"Approved on trial",declined:"Declined",reviewed:"Reviewed"};
  return `<div class="sdi-form-sec"><div class="sfs-head"><span class="num">⏱</span> Audit trail</div><div class="sfs-body"><ul class="trail">`
    +t.map(e=>`<li><b>${DB.esc(lbl[e.status]||e.status)}</b> by ${DB.esc(HR.name(e.by))} · ${DB.esc(HR.dt(e.at))}${e.note?`<div class="hr-note" style="margin:2px 0 0;">“${DB.esc(e.note)}”</div>`:""}</li>`).join("")
    +`</ul></div></div>`;
};

/* ---------- Self-Certification (employee submits; line manager authorises) ---------- */
async function showSelfCert(){ hrShow("page-selfcert","selfcert"); await HR.buildSelfCert(); }
HR.buildSelfCert = async function(){
  const el=document.getElementById("page-selfcert"); if(!el) return; if(HR.needCloud(el)) return;
  const {me,mgr}=HR.myRows();
  el.innerHTML=`<div class="sdi-doc">`
   +HR.hero("Service Desk Institute® · Confidential","Self-Certification Form","For sickness absences of <strong>7 calendar days or fewer</strong>. Complete on your return; it routes to "+DB.esc(mgr.full_name||"your line manager")+" for the return-to-work step.","Owner","Paul M Rodrigues")
   +HR.docBlock("self_cert")
   +`<div class="hr-note">Fields marked <span class="req"></span> must be completed.</div>`
   +`<div class="sdi-form-sec"><div class="sfs-head"><span class="num">1</span> Employee details</div><div class="sfs-body">
       <div class="hr-grid2"><div class="hr-field"><label>Full name</label><input id="sc-name" value="${DB.esc(me.full_name||(DB.user&&DB.user.name)||"")}"></div><div class="hr-field"><label>Line manager</label><input id="sc-mgr" value="${DB.esc(mgr.full_name||"")}" readonly></div></div></div></div>
     <div class="sdi-form-sec"><div class="sfs-head"><span class="num">2</span> Absence details</div><div class="sfs-body">
       <div class="hr-grid3"><div class="hr-field"><label class="req">First day of absence</label><input type="date" id="sc-first"></div><div class="hr-field"><label class="req">Last day of absence</label><input type="date" id="sc-last"></div><div class="hr-field"><label class="req">Date returned</label><input type="date" id="sc-return"></div></div></div></div>
     <div class="sdi-form-sec"><div class="sfs-head"><span class="num">3</span> Reason &amp; cause</div><div class="sfs-body">
       <div class="hr-field"><label class="req">Reason for absence</label><textarea id="sc-reason" rows="2"></textarea></div>
       <div class="hr-grid2"><div class="hr-field"><label>Consulted a doctor?</label><select id="sc-doctor"><option>No</option><option>Yes</option></select></div><div class="hr-field"><label>Work-related?</label><select id="sc-work"><option>No</option><option>Yes</option></select></div></div></div></div>
     <div class="sdi-form-sec"><div class="sfs-head"><span class="num">4</span> Declaration</div><div class="sfs-body">
       <div class="sdi-decl">I certify that I was unable to work for the period shown because of the reason given, and that this information is true and complete. I understand that absences of more than 7 calendar days require a fit note, and that knowingly giving false information may be treated as a disciplinary matter.</div>
       <div class="hr-field"><label class="req">Signed — type your full name</label><input id="sc-sign" placeholder="Your full name"></div>
       <div id="sc-err" class="hr-errbox"></div>
       <button class="hr-btn" onclick="HR.submitSelfCert()">Submit${mgr.full_name?(" to "+DB.esc(mgr.full_name)):""}</button></div></div>
   </div><div id="sc-lists"></div>`;
  HR.renderSubs("self_cert","sc-lists");
};
HR.submitSelfCert = async function(){
  const g=id=>document.getElementById(id), v=HR.val;
  const checks=[
    {label:"First day of absence",ok:!!v("sc-first"),el:g("sc-first")},
    {label:"Last day of absence",ok:!!v("sc-last"),el:g("sc-last")},
    {label:"Date returned",ok:!!v("sc-return"),el:g("sc-return")},
    {label:"Reason for absence",ok:!!v("sc-reason"),el:g("sc-reason")},
    {label:"Declaration (type your full name)",ok:!!v("sc-sign"),el:g("sc-sign")}
  ];
  if(v("sc-first")&&v("sc-last")) checks.push({label:"The last day of absence cannot be before the first day",ok:v("sc-last")>=v("sc-first"),el:g("sc-last")});
  if(v("sc-last")&&v("sc-return")) checks.push({label:"The date you returned cannot be before the last day of absence",ok:v("sc-return")>=v("sc-last"),el:g("sc-return")});
  if(!HR.validate("sc-err",checks)) return;
  const data={name:v("sc-name"),first:v("sc-first"),last:v("sc-last"),ret:v("sc-return"),reason:v("sc-reason"),doctor:g("sc-doctor").value,work:g("sc-work").value,signed:v("sc-sign")};
  const [,error]=await HR.call("submissions.create",{type:"self_cert",data});
  if(error){ HR.serverError("sc-err",error); return; }
  if(typeof toast==="function") toast("Self-certification submitted"); HR.buildSelfCert();
};

/* ---------- shared lists: things to action, your own, and history you can see ---------- */
HR.renderSubs = async function(type,mountId){
  const mount=document.getElementById(mountId); if(!mount) return;
  const [sl,err]=await HR.call("submissions.list",{type}); const subs=(sl&&sl.items)||[];
  if(err){ mount.innerHTML=`<div class="hr-errbox show">Couldn't load the list: ${DB.esc(err.message)}</div>`; return; }
  const mine=subs.filter(s=>(s.employee_email||"").toLowerCase()===DB.myEmail);
  const toAction=subs.filter(s=>(s.employee_email||"").toLowerCase()!==DB.myEmail && (HR.iAmLineMgrOf(s.employee_email)||(DB.isAdmin&&!HR.orgRow(s.employee_email)?.manager_email)) && s.status==="submitted");
  const others=subs.filter(s=>(s.employee_email||"").toLowerCase()!==DB.myEmail && !toAction.includes(s));
  const plural={self_cert:"self-certifications",flex_work:"flexible working requests",dse:"DSE assessments"}[type]||"submissions";
  let html="";
  if(toAction.length) html+=`<h3 style="margin-top:22px;">⚑ Awaiting your ${type==="dse"?"review":(type==="flex_work"?"decision":"authorisation")} (${toAction.length})</h3>`+toAction.map(s=>HR.subRow(s,type,true)).join("");
  html+=`<h3 style="margin-top:22px;">Your ${plural}</h3>`+(mine.length?mine.map(s=>HR.subRow(s,type,false)).join(""):`<div class="hr-note">None yet.</div>`);
  if(others.length) html+=`<h3 style="margin-top:22px;">📚 History — ${plural} you can see (${others.length})</h3><div class="hr-note">Previous requests and decisions for the people you manage or oversee. Open any one to see the full form and who decided it, and when.</div>`+others.map(s=>HR.subRow(s,type,false)).join("");
  mount.innerHTML=html;
};
HR.subRow = function(s,type,action){
  const d=s.data||{}, m=s.manager_data||{};
  let summary;
  if(type==="flex_work") summary=((d.changeTypes&&d.changeTypes.length)?d.changeTypes.join(", "):"Flexible working request")+(d.effectiveDate?(" · from "+d.effectiveDate):"")+(d.duration?(" · "+d.duration+(d.endDate?(" to "+d.endDate):"")):"");
  else if(type==="dse") summary="Workstation self-assessment"+(d.date?(" · "+d.date):"");
  else summary=((d.first||"?"))+" → "+(d.last||"?")+(d.ret?(" · returned "+d.ret):"");
  const when="Submitted "+DB.fmtDate(s.submitted_at)+(s.decided_at?(" · "+(s.status)+" by "+HR.name(s.decided_by)+" on "+DB.fmtDate(s.decided_at)):"");
  const note=m.note?`<div class="hr-note" style="margin:3px 0 0;">Manager note: ${DB.esc(m.note)}</div>`:"";
  let btns;
  if(type==="flex_work"||type==="dse"){
    btns=` <button class="hr-btn ghost" style="padding:4px 10px;" onclick="HR.openSubmission('${s.id}')">${action?(type==="dse"?"Review":"Decide"):"Open"}</button>`;
  } else {
    btns=action?` <button class="hr-btn approve" style="padding:4px 10px;" onclick="HR.decide('${s.id}','authorised')">Authorise</button> <button class="hr-btn reject" style="padding:4px 10px;" onclick="HR.decide('${s.id}','rejected')">Reject</button>`:"";
  }
  return `<div class="hr-list-item"><div><b>${DB.esc(HR.name(s.employee_email))}</b><div class="hr-note" style="margin:2px 0 0;">${DB.esc(summary)}</div><div class="hr-note" style="margin:2px 0 0;">${DB.esc(when)}</div>${note}</div><div style="display:flex;align-items:center;gap:8px;"><span class="hr-status ${s.status}">${DB.esc(s.status)}</span>${btns}</div></div>`;
};
/* Self-certification decision: a note box with Cancel, which really cancels. */
HR.decide = async function(id,status){
  const note=await HR.modal({
    title:status==="authorised"?"Authorise self-certification":"Reject self-certification",
    body:status==="authorised"?"Add a note if you wish (for example, return-to-work discussion held).":"Please give the reason for rejecting.",
    input:"textarea", required:status==="rejected"?"Enter a reason for rejecting.":"",
    ok:status==="authorised"?"Authorise":"Reject", okClass:status==="authorised"?"approve":"reject"
  });
  if(note===false) return;   // Cancel: nothing happens
  const [,error]=await HR.call("submissions.decide",{id,status,note});
  if(error){ HR.error("Update failed: "+error.message); return; }
  if(typeof toast==="function") toast("Marked "+status);
  HR.buildSelfCert();
};

/* ============ Expense Claim (employee → line manager approves → finance authorises payment → paid) ============ */
HR.EXP_CATS=["Travel (public or non-private)","Mileage","Accommodation","Subsistence","Equipment","Other"];
HR.MILEAGE_RATE=0.35;
HR._expFiles=[]; HR._cc=null; HR._ccManage=false;
HR.EXP_STATUS={submitted:"Awaiting line manager",approved:"Approved – awaiting finance",authorised:"Approved – awaiting finance",payment_authorised:"Payment authorised",paid:"Paid",rejected:"Rejected"};
HR.expBadge=function(st){ return `<span class="hr-status exp-${DB.esc(st)}">${DB.esc(HR.EXP_STATUS[st]||st)}</span>`; };
HR.newExpItem=function(){ return {date:"",cat:"",desc:"",cc:"",miles:"",amount:"",receipt:""}; };
HR.expMonths=function(){
  const out=[], d=new Date(); d.setDate(1);
  for(let i=0;i<13;i++){ out.push(d.toLocaleString("en-GB",{month:"long"})+" "+d.getFullYear()); d.setMonth(d.getMonth()-1); }
  return out;
};
HR.loadCostCentres=async function(force){
  if(HR._cc && !force) return HR._cc;
  const [r]=await HR.call("costCentres.list");
  HR._cc=((r&&r.items)||[]); HR._ccManage=!!(r&&r.can_manage);
  return HR._cc;
};
async function showExpenses(){ hrShow("page-expenses","expenses"); await HR.buildExpenses(); }
HR.buildExpenses = async function(){
  if(HR._ccNext){ HR._ccNext=false; return HR.showCostCentres(); }
  const el=document.getElementById("page-expenses"); if(!el) return; if(HR.needCloud(el)) return;
  const {me,mgr}=HR.myRows();
  await HR.loadCostCentres();
  if(!HR._expItems){ HR._expItems=[HR.newExpItem()]; HR._expFiles=[null]; }
  const months=HR.expMonths();
  el.innerHTML=`<div class="sdi-doc">`
   +HR.hero("Service Desk Institute® · Confidential","Expense Claim Form","Reclaim business expenses. Car mileage is reimbursed at <strong>35p per mile</strong>. Your line manager approves the claim, then the finance team authorises payment.","Owner","Paul M Rodrigues")
   +HR.docBlock("expense")
   +(HR._ccManage?`<div style="text-align:right;margin-bottom:8px;"><button class="hr-btn ghost" onclick="HR.showCostCentres()">⚙ Manage cost centres</button></div>`:"")
   +`<div class="hr-note">Fields marked <span class="req"></span> must be completed.</div>`
   +`<div class="sdi-form-sec"><div class="sfs-head"><span class="num">1</span> Claimant details</div><div class="sfs-body">
       <div class="hr-grid2"><div class="hr-field"><label class="req">Full name</label><input id="ex-name" value="${DB.esc(me.full_name||(DB.user&&DB.user.name)||"")}"></div>
       <div class="hr-field"><label class="req">Claim period / month</label><select id="ex-period"><option value="">Select month…</option>${months.map(m=>`<option ${HR._expPeriod===m?"selected":""}>${DB.esc(m)}</option>`).join("")}</select></div></div>
       <div class="hr-field"><label>Line manager (approves)</label><input value="${DB.esc(mgr.full_name||"—")}" readonly></div></div></div>
     <div class="sdi-form-sec"><div class="sfs-head"><span class="num">2</span> Expense items</div><div class="sfs-body">
       <div class="hr-note">Add one line per item. For car mileage choose <b>Mileage</b>, enter the miles and say what the journey was for — the amount is worked out at 35p per mile. Use <b>Travel (public or non-private)</b> for trains, buses, taxis, flights, parking and similar.</div>
       <div class="hist-wrap"><table class="exp-tbl"><thead><tr><th class="req">Date</th><th class="req">Category</th><th class="req">What it was for</th><th class="req">Cost centre</th><th>Miles</th><th class="req">Amount £</th><th class="req">Receipt attached?</th><th>Receipt file</th><th></th></tr></thead><tbody id="ex-rows"></tbody></table></div>
       <button class="hr-btn ghost" onclick="HR.addExpRow()">+ Add item</button>
       <div class="exp-total">Total amount claimed <b id="ex-total">£0.00</b></div></div></div>
     <div class="sdi-form-sec"><div class="sfs-head"><span class="num">3</span> Declaration</div><div class="sfs-body">
       <div class="sdi-decl">I certify that the expenses claimed were necessarily incurred by me wholly and exclusively for SDI business, that they comply with the Expenses policy, and that valid receipts or invoices are attached for each item marked as having one. Submitting false or fabricated claims is gross misconduct.</div>
       <div class="hr-field"><div class="opt-group" id="ex-decl-wrap"><label class="opt"><input type="checkbox" id="ex-decl"> <span>I agree with the declaration above <span class="req"></span></span></label></div></div>
       <div class="hr-field"><label class="req">Signed — type your full name</label><input id="ex-sign" placeholder="Your full name"></div>
       <div id="ex-err" class="hr-errbox"></div>
       <button class="hr-btn" id="ex-submit" onclick="HR.submitExpense()">Submit for approval</button></div></div>
   </div><div id="ex-lists"></div>`;
  document.getElementById("ex-period").onchange=function(){ HR._expPeriod=this.value; };
  HR.renderExpRows(); HR.calcExp(); HR.renderExpenseLists("ex-lists");
};
HR.addExpRow = function(){ HR._expItems.push(HR.newExpItem()); HR._expFiles.push(null); HR.renderExpRows(); };
HR.removeExpRow = function(i){ HR._expItems.splice(i,1); HR._expFiles.splice(i,1); if(!HR._expItems.length){ HR._expItems=[HR.newExpItem()]; HR._expFiles=[null]; } HR.renderExpRows(); HR.calcExp(); };
HR.setExp = function(i,k,v){
  const it=HR._expItems[i]; it[k]=v;
  if(k==="cat"||k==="receipt"){ HR.renderExpRows(); }
  if(k==="miles"){ const a=document.getElementById("ex-amt-"+i); if(a) a.value=(parseFloat(v)>0)?(parseFloat(v)*HR.MILEAGE_RATE).toFixed(2):""; }
  HR.calcExp();
};
HR.setExpFile = function(i,input){ HR._expFiles[i]=(input.files&&input.files[0])||null; };
HR.renderExpRows = function(){
  const tb=document.getElementById("ex-rows"); if(!tb) return;
  const ccNames=(HR._cc||[]).map(c=>c.name);
  tb.innerHTML=HR._expItems.map((it,i)=>{
    const mileage=it.cat==="Mileage";
    const ccOpts=[...ccNames]; if(it.cc && !ccOpts.includes(it.cc)) it.cc="";
    const f=HR._expFiles[i];
    return `<tr class="exp-row" data-i="${i}">
      <td style="min-width:120px;"><input type="date" id="ex-date-${i}" value="${DB.esc(it.date)}" onchange="HR.setExp(${i},'date',this.value)"></td>
      <td style="min-width:150px;"><select id="ex-cat-${i}" onchange="HR.setExp(${i},'cat',this.value)"><option value="">Select…</option>${HR.EXP_CATS.map(c=>`<option ${c===it.cat?"selected":""}>${DB.esc(c)}</option>`).join("")}</select></td>
      <td style="min-width:160px;"><input id="ex-desc-${i}" value="${DB.esc(it.desc)}" placeholder="${mileage?"Journey from / to and purpose":"What it was for"}" oninput="HR.setExp(${i},'desc',this.value)"></td>
      <td style="min-width:140px;"><select id="ex-cc-${i}" onchange="HR.setExp(${i},'cc',this.value)"><option value="">Select…</option>${ccOpts.map(c=>`<option ${c===it.cc?"selected":""}>${DB.esc(c)}</option>`).join("")}</select></td>
      <td style="width:80px;">${mileage?`<input type="number" min="0" step="0.1" id="ex-miles-${i}" value="${DB.esc(it.miles)}" oninput="HR.setExp(${i},'miles',this.value)">`:`<span class="hr-note">—</span>`}</td>
      <td style="width:95px;">${mileage?`<input id="ex-amt-${i}" value="${(parseFloat(it.miles)>0)?(parseFloat(it.miles)*HR.MILEAGE_RATE).toFixed(2):""}" readonly title="Miles × 35p">`:`<input type="number" min="0" step="0.01" id="ex-amt-${i}" value="${DB.esc(it.amount)}" oninput="HR.setExp(${i},'amount',this.value)">`}</td>
      <td style="width:90px;"><select id="ex-rec-${i}" onchange="HR.setExp(${i},'receipt',this.value)"><option value="">Select…</option><option ${it.receipt==="Yes"?"selected":""}>Yes</option><option ${it.receipt==="No"?"selected":""}>No</option></select></td>
      <td style="min-width:150px;">${it.receipt==="Yes"?`<input type="file" id="ex-file-${i}" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onchange="HR.setExpFile(${i},this)">${f?`<div class="hr-note" style="margin:2px 0 0;">Chosen: ${DB.esc(f.name)}</div>`:""}`:`<span class="hr-note">${it.receipt==="No"?"No receipt":"—"}</span>`}</td>
      <td><button class="hr-btn ghost" style="padding:4px 8px;" title="Remove this line" onclick="HR.removeExpRow(${i})">×</button></td></tr>`;
  }).join("");
};
HR.expItemAmount = function(it){ return it.cat==="Mileage" ? (parseFloat(it.miles)||0)*HR.MILEAGE_RATE : (parseFloat(it.amount)||0); };
HR.calcExp = function(){
  const tot=HR._expItems.reduce((s,it)=>s+Math.round(HR.expItemAmount(it)*100)/100,0);
  const t=document.getElementById("ex-total"); if(t) t.textContent=HR.money(tot);
  return tot;
};
HR.submitExpense = async function(){
  const g=id=>document.getElementById(id), v=HR.val;
  const checks=[
    {label:"Full name",ok:!!v("ex-name"),el:g("ex-name")},
    {label:"Claim period / month",ok:!!v("ex-period"),el:g("ex-period")}
  ];
  HR._expItems.forEach((it,i)=>{
    const n="Item "+(i+1)+": ";
    checks.push({label:n+"date",ok:!!it.date,el:g("ex-date-"+i)});
    checks.push({label:n+"category",ok:!!it.cat,el:g("ex-cat-"+i)});
    checks.push({label:n+(it.cat==="Mileage"?"what the mileage was for":"what it was for"),ok:!!(it.desc||"").trim(),el:g("ex-desc-"+i)});
    checks.push({label:n+"cost centre",ok:!!it.cc,el:g("ex-cc-"+i)});
    if(it.cat==="Mileage") checks.push({label:n+"miles",ok:parseFloat(it.miles)>0,el:g("ex-miles-"+i)});
    else if(it.cat) checks.push({label:n+"amount",ok:parseFloat(it.amount)>0,el:g("ex-amt-"+i)});
    checks.push({label:n+"receipt attached? (Yes or No)",ok:!!it.receipt,el:g("ex-rec-"+i)});
    if(it.receipt==="Yes") checks.push({label:n+"choose the receipt file (or change to No)",ok:!!HR._expFiles[i],el:g("ex-file-"+i)});
    const f=HR._expFiles[i];
    if(it.receipt==="Yes" && f){
      checks.push({label:n+"receipt must be a PDF, JPG or PNG",ok:/\.(pdf|jpe?g|png)$/i.test(f.name),el:g("ex-file-"+i)});
      checks.push({label:n+"receipt file is larger than 10 MB",ok:f.size<=10*1024*1024,el:g("ex-file-"+i)});
    }
  });
  checks.push({label:"Declaration tick box",ok:g("ex-decl").checked,el:g("ex-decl-wrap")});
  checks.push({label:"Declaration (type your full name)",ok:!!v("ex-sign"),el:g("ex-sign")});
  if(!HR.validate("ex-err",checks)) return;
  const items=HR._expItems.map(it=>({date:it.date,cat:it.cat,desc:(it.desc||"").trim(),cc:it.cc,miles:it.cat==="Mileage"?it.miles:"",amount:it.cat==="Mileage"?"":it.amount,receipt:it.receipt}));
  const data={name:v("ex-name"),period:v("ex-period"),items,declAgree:true,signed:v("ex-sign")};
  const btn=g("ex-submit"); if(btn){ btn.disabled=true; btn.textContent="Submitting…"; }
  const [res,error]=await HR.call("submissions.create",{type:"expense",data});
  if(error){ if(btn){ btn.disabled=false; btn.textContent="Submit for approval"; } HR.serverError("ex-err",error); return; }
  const failed=[];
  for(let i=0;i<HR._expFiles.length;i++){
    const f=HR._expFiles[i]; if(!f || HR._expItems[i].receipt!=="Yes") continue;
    try{ await HR.uploadFile(res.id,i,f); }catch(e){ failed.push("Item "+(i+1)+" ("+f.name+"): "+e.message); }
  }
  HR._expItems=null; HR._expFiles=[]; HR._expPeriod="";
  if(failed.length) await HR.error("Your claim was submitted, but these receipts did not upload:\n\n"+failed.join("\n")+"\n\nOpen the claim under “Your claims” and use “Add receipt” to try again.");
  else if(typeof toast==="function") toast("Expense claim submitted");
  HR.buildExpenses();
};
HR.uploadFile = async function(submissionId,itemIndex,file){
  const fd=new FormData(); fd.append("submission_id",submissionId); if(itemIndex!=null) fd.append("item",String(itemIndex)); fd.append("file",file);
  let res;
  try{ res=await fetch("upload.php",{method:"POST",credentials:"same-origin",headers:{"X-CSRF-Token":DB.csrf()},body:fd}); }
  catch(e){ throw new Error("Couldn't reach the server."); }
  let out={}; try{ out=await res.json(); }catch(e){}
  if(out && out.signed_out){ location.href="login.php"; throw new Error("Your session has ended."); }
  if(!res.ok||!out.ok) throw new Error((out&&out.error)||("Upload failed ("+res.status+")."));
  return out.data.file;
};

/* Lists on the expenses page: approvals, finance queues, your claims and the full history. */
HR._expFilter={who:"",status:""};
HR.renderExpenseLists = async function(mountId){
  const mount=document.getElementById(mountId); if(!mount) return;
  const [sl,err]=await HR.call("submissions.list",{type:"expense"});
  if(err){ mount.innerHTML=`<div class="hr-errbox show">Couldn't load claims: ${DB.esc(err.message)}</div>`; return; }
  const subs=(sl&&sl.items)||[], fin=!!(sl&&sl.is_finance);
  const notMine=s=>(s.employee_email||"").toLowerCase()!==DB.myEmail;
  const toApprove=subs.filter(s=>notMine(s) && s.status==="submitted" && (HR.iAmLineMgrOf(s.employee_email)||(DB.isAdmin&&!HR.orgRow(s.employee_email)?.manager_email)));
  const toAuthorise=fin?subs.filter(s=>notMine(s) && (s.status==="approved"||s.status==="authorised")):[];
  const toPay=fin?subs.filter(s=>notMine(s) && s.status==="payment_authorised"):[];
  const mine=subs.filter(s=>!notMine(s));
  const others=subs.filter(notMine);
  let html="";
  const block=(title,list,note)=>list.length?`<h3 style="margin-top:22px;">${title} (${list.length})</h3>${note?`<div class="hr-note">${note}</div>`:""}`+HR.expTable(list,true):"";
  html+=block("⚑ Awaiting your approval",toApprove,"Open a claim to review every line and receipt before approving or rejecting it.");
  html+=block("💷 Approved — awaiting payment authorisation",toAuthorise,"Approved by the line manager. Review and authorise payment, or reject.");
  html+=block("✅ Payment authorised — to be paid",toPay,"Mark each claim as paid once the payment has been made.");
  html+=`<h3 style="margin-top:22px;">Your claims</h3>`+(mine.length?HR.expTable(mine,false):`<div class="hr-note">None yet.</div>`);
  if(others.length){
    const people=[...new Set(others.map(s=>(s.employee_email||"").toLowerCase()))].sort((a,b)=>HR.name(a).localeCompare(HR.name(b)));
    const f=HR._expFilter;
    const shown=others.filter(s=>(!f.who||(s.employee_email||"").toLowerCase()===f.who)&&(!f.status||s.status===f.status||(f.status==="approved"&&s.status==="authorised")));
    html+=`<h3 style="margin-top:22px;">📚 Expense history (${others.length})</h3>`
      +`<div class="hr-note">Every claim you can see — for the people you manage (and the managers below you)${fin?", and for everyone as finance":""} — with who approved it, whether payment was authorised and whether it has been paid. Open any claim to review it in full.</div>`
      +`<div class="hr-filter"><select onchange="HR._expFilter.who=this.value;HR.renderExpenseLists('${mountId}')"><option value="">Everyone</option>${people.map(p=>`<option value="${DB.esc(p)}" ${f.who===p?"selected":""}>${DB.esc(HR.name(p))}</option>`).join("")}</select>`
      +`<select onchange="HR._expFilter.status=this.value;HR.renderExpenseLists('${mountId}')"><option value="">Any status</option>${["submitted","approved","payment_authorised","paid","rejected"].map(st=>`<option value="${st}" ${f.status===st?"selected":""}>${DB.esc(HR.EXP_STATUS[st])}</option>`).join("")}</select></div>`
      +(shown.length?HR.expTable(shown,true):`<div class="hr-note">No claims match.</div>`);
  }
  mount.innerHTML=html;
};
HR.expTable = function(list,showWho){
  const rows=list.map(s=>{
    const d=s.data||{}, m=s.manager_data||{};
    const lm=m.lm?`${m.lm.decision==="rejected"?"Rejected":"Approved"} by ${HR.name(m.lm.by)}<br><span class="hr-note">${DB.fmtDate(m.lm.at)}</span>`:(s.status==="authorised"?`Approved by ${HR.name(s.decided_by)}<br><span class="hr-note">${DB.fmtDate(s.decided_at)}</span>`:"—");
    const fn=m.finance?`${m.finance.decision==="rejected"?"Rejected":"Authorised"} by ${HR.name(m.finance.by)}<br><span class="hr-note">${DB.fmtDate(m.finance.at)}</span>`:"—";
    const paid=m.paid?`${DB.esc(DB.fmtDate(m.paid.on||m.paid.at))}`:"—";
    return `<tr>${showWho?`<td><b>${DB.esc(HR.name(s.employee_email))}</b></td>`:""}<td>${DB.esc(d.period||"—")}</td><td><b>${HR.money(d.total)}</b></td><td>${DB.esc(DB.fmtDate(s.submitted_at))}</td><td>${HR.expBadge(s.status)}</td><td style="font-size:11.5px;">${lm}</td><td style="font-size:11.5px;">${fn}</td><td>${paid}</td><td><button class="hr-btn ghost" style="padding:4px 10px;" onclick="HR.openExpense('${s.id}')">Review</button></td></tr>`;
  }).join("");
  return `<div class="hist-wrap"><table class="hist-tbl"><thead><tr>${showWho?"<th>Employee</th>":""}<th>Period</th><th>Total</th><th>Submitted</th><th>Status</th><th>Line manager</th><th>Finance</th><th>Paid</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`;
};

/* Full claim, with the right actions for whoever is looking at it. */
HR.openExpense = async function(id){
  const el=document.getElementById("page-expenses"); if(!el) return;
  const [sg,err]=await HR.call("submissions.get",{id}); const s=(sg&&sg.item)||null;
  if(!s){ HR.error(err?err.message:"That claim was not found."); return; }
  const d=s.data||{}, m=s.manager_data||{}, files=s.files||[];
  const emp=(s.employee_email||"").toLowerCase(), mine=emp===DB.myEmail;
  const isLM=HR.iAmLineMgrOf(emp)||(DB.isAdmin&&!HR.orgRow(emp)?.manager_email);
  const fin=HR.amFinance();
  const fileLinks=i=>files.filter(f=>f.item_index===i).map(f=>`<a href="file.php?id=${encodeURIComponent(f.id)}" target="_blank" rel="noopener">📎 ${DB.esc(f.name)}</a>`).join("<br>");
  const items=(d.items||[]).map((it,i)=>`<tr><td>${DB.esc(it.date||"")}</td><td>${DB.esc(it.cat||"")}</td><td>${DB.esc(it.desc||"")}</td><td>${DB.esc(it.cc||"")}</td><td>${it.miles?DB.esc(String(it.miles)):"—"}</td><td style="text-align:right;">${HR.money(it.amount)}</td><td>${DB.esc(it.receipt||"—")}</td><td style="font-size:11.5px;">${fileLinks(i)||(it.receipt==="Yes"?`<span style="color:#b91c1c;">Not uploaded</span>`:"")}</td></tr>`).join("");
  const legacy=(d.miles>0)?`<tr><td colspan="4">Mileage (older claim format)</td><td>${DB.esc(String(d.miles))}</td><td style="text-align:right;">${HR.money(d.mileageAmt)}</td><td colspan="2"></td></tr>`:"";
  const loose=files.filter(f=>f.item_index==null).map(f=>`<a href="file.php?id=${encodeURIComponent(f.id)}" target="_blank" rel="noopener">📎 ${DB.esc(f.name)}</a>`).join(" · ");
  let action="";
  const st=s.status==="authorised"?"approved":s.status;
  const acts=Array.isArray(s.actions)?s.actions:[];   // buttons decided by the server
  if(acts.includes("approve")){
    action=HR.expActionBox("Line manager approval","Approve this claim to send it to the finance team, or reject it with a reason.",[["approve","✓ Approve","approve"],["reject","✗ Reject","reject"]],id);
  } else if(acts.includes("authorise_payment")){
    action=HR.expActionBox("Finance — authorise payment","Check the claim and receipts, then authorise payment or reject it with a reason.",[["authorise_payment","✓ Authorise payment","approve"],["reject","✗ Reject","reject"]],id);
  } else if(acts.includes("mark_paid")){
    action=HR.expActionBox("Finance — record payment","Enter the date the payment was made.",[["mark_paid","✓ Mark as paid","approve"]],id,true);
  }
  if(mine && s.status==="submitted"){
    action+=`<div class="sdi-form-sec"><div class="sfs-head"><span class="num">+</span> Add a receipt</div><div class="sfs-body">
      <div class="hr-grid2"><div class="hr-field"><label>Which line is it for?</label><select id="exa-item">${(d.items||[]).map((it,i)=>`<option value="${i}">Item ${i+1}: ${DB.esc(it.desc||it.cat||"")}</option>`).join("")}<option value="">The whole claim</option></select></div>
      <div class="hr-field"><label>File (PDF, JPG or PNG, up to 10 MB)</label><input type="file" id="exa-file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"></div></div>
      <div id="exa-err" class="hr-errbox"></div><button class="hr-btn" onclick="HR.addReceipt('${s.id}')">Upload receipt</button></div></div>`;
  }
  el.innerHTML=`<div class="sdi-doc"><div style="margin-bottom:12px;"><button class="hr-btn ghost" onclick="HR.buildExpenses()">← Back to expenses</button></div>`
    +HR.hero("Service Desk Institute® · Expense Claim","Expense claim — "+(d.period||""),"Claimed by "+DB.esc(HR.name(emp))+" · submitted "+DB.esc(DB.fmtDate(s.submitted_at)),"Total",HR.money(d.total))
    +`<div style="margin-bottom:10px;">Status: ${HR.expBadge(s.status)}</div>`
    +`<div class="sdi-form-sec"><div class="sfs-head"><span class="num">1</span> Claimant</div><div class="sfs-body"><div class="hr-grid2">${HR.ro("Full name",d.name)}${HR.ro("Claim period / month",d.period)}</div></div></div>`
    +`<div class="sdi-form-sec"><div class="sfs-head"><span class="num">2</span> Expense items</div><div class="sfs-body"><div class="hist-wrap"><table class="hist-tbl"><thead><tr><th>Date</th><th>Category</th><th>What it was for</th><th>Cost centre</th><th>Miles</th><th>Amount</th><th>Receipt?</th><th>File</th></tr></thead><tbody>${items}${legacy}</tbody></table></div>`
    +`<div class="exp-total">Total amount claimed <b>${HR.money(d.total)}</b></div>${loose?`<div class="hr-note">Other attachments: ${loose}</div>`:""}</div></div>`
    +`<div class="sdi-form-sec"><div class="sfs-head"><span class="num">3</span> Declaration</div><div class="sfs-body">${HR.ro("Signed",(d.signed||"")+(d.signDate?(" · "+d.signDate):""))}</div></div>`
    +HR.trailHtml(m)+action+`</div>`;
  try{ window.scrollTo(0,0); }catch(e){}
};
HR.expActionBox = function(title,intro,buttons,id,paidDate){
  return `<div class="sdi-form-sec"><div class="sfs-head"><span class="num">✓</span> ${DB.esc(title)}</div><div class="sfs-body">
    <div class="hr-note">${DB.esc(intro)}</div>
    ${paidDate?`<div class="hr-field"><label class="req">Date paid</label><input type="date" id="exa-paid" value="${HR.today()}"></div>`:""}
    <div class="hr-field"><label>Comment${buttons.some(b=>b[0]==="reject")?" (required if rejecting)":" (optional)"}</label><textarea id="exa-note" rows="2"></textarea></div>
    <div id="exa-err" class="hr-errbox"></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;">${buttons.map(b=>`<button class="hr-btn ${b[2]}" onclick="HR.expenseStep('${id}','${b[0]}')">${b[1]}</button>`).join("")}<button class="hr-btn ghost" onclick="HR.buildExpenses()">Cancel</button></div></div></div>`;
};
HR.expenseStep = async function(id,step){
  const note=HR.val("exa-note");
  const checks=[];
  if(step==="reject") checks.push({label:"A comment explaining why the claim is rejected",ok:!!note,el:document.getElementById("exa-note")});
  if(step==="mark_paid") checks.push({label:"Date paid",ok:!!HR.val("exa-paid"),el:document.getElementById("exa-paid")});
  if(!HR.validate("exa-err",checks)) return;
  const params={id,step,note}; if(step==="mark_paid") params.paid_on=HR.val("exa-paid");
  const [res,error]=await HR.call("submissions.expenseAction",params);
  if(error){ HR.serverError("exa-err",error); return; }
  if(typeof toast==="function") toast("Claim: "+(HR.EXP_STATUS[res.status]||res.status));
  HR.openExpense(id);
};
HR.addReceipt = async function(id){
  const fi=document.getElementById("exa-file"), f=fi&&fi.files&&fi.files[0];
  if(!HR.validate("exa-err",[{label:"Choose a file to upload",ok:!!f,el:fi}])) return;
  const item=HR.val("exa-item");
  try{ await HR.uploadFile(id,item===""?null:parseInt(item,10),f); }catch(e){ HR.serverError("exa-err",e); return; }
  if(typeof toast==="function") toast("Receipt uploaded"); HR.openExpense(id);
};

/* Cost Centres menu item (finance team and CEO): open the expenses page, then the cost centre list. */
HR.openCostCentres = async function(){
  if(typeof showExpenses==="function"){ HR._ccNext=true; showExpenses(); }
  else HR.showCostCentres();
};
/* Finance team and CEO: manage the cost centre list. */
HR.showCostCentres = async function(){
  const el=document.getElementById("page-expenses"); if(!el) return;
  await HR.loadCostCentres(true);
  el.innerHTML=`<div class="sdi-doc"><div style="margin-bottom:12px;"><button class="hr-btn ghost" onclick="HR.buildExpenses()">← Back to expenses</button></div>`
    +HR.hero("Service Desk Institute® · Finance","Cost centres","The list offered on every expense claim. Renaming or deleting a cost centre does not change claims already submitted.","","")
    +`<div class="sdi-form-sec"><div class="sfs-head"><span class="num">1</span> Current cost centres</div><div class="sfs-body">`
    +((HR._cc||[]).map(c=>`<div class="cc-row"><input id="cc-${c.id}" value="${DB.esc(c.name)}" maxlength="100"><button class="hr-btn" onclick="HR.saveCostCentre(${c.id})">Save</button><button class="hr-btn reject" onclick="HR.removeCostCentre(${c.id})">Delete</button></div>`).join("")||`<div class="hr-note">No cost centres yet.</div>`)
    +`</div></div><div class="sdi-form-sec"><div class="sfs-head"><span class="num">2</span> Add a cost centre</div><div class="sfs-body"><div class="cc-row"><input id="cc-new" placeholder="Name" maxlength="100"><button class="hr-btn" onclick="HR.saveCostCentre(null)">+ Add</button></div><div id="cc-err" class="hr-errbox"></div></div></div></div>`;
};
HR.saveCostCentre = async function(id){
  const name=HR.val(id==null?"cc-new":"cc-"+id);
  if(!HR.validate("cc-err",[{label:"Enter a name for the cost centre",ok:!!name,el:document.getElementById(id==null?"cc-new":"cc-"+id)}])) return;
  const p={name}; if(id!=null) p.id=String(id);
  const [,error]=await HR.call("costCentres.save",p);
  if(error){ HR.serverError("cc-err",error); return; }
  if(typeof toast==="function") toast("Cost centres updated"); HR.showCostCentres();
};
HR.removeCostCentre = async function(id){
  const c=(HR._cc||[]).find(x=>x.id===id);
  if(!(await HR.modal({title:"Delete cost centre",body:"Delete “"+(c?c.name:"")+"”? It will no longer be offered on new claims. Past claims keep it.",ok:"Delete",okClass:"reject"}))) return;
  const [,error]=await HR.call("costCentres.remove",{id:String(id)});
  if(error){ HR.serverError("cc-err",error); return; }
  if(typeof toast==="function") toast("Cost centre deleted"); HR.showCostCentres();
};

/* ============ Flexible Working Request (type flex_work) ============ */
HR.FW_CHANGES=["Reduced hours","Compressed hours","Different start / finish times","Different working days","Change of location","Job share","Other"];
HR.FW_REASONS=["Burden of additional costs","Detrimental effect on meeting customer demand","Inability to reorganise work among existing staff","Inability to recruit additional staff","Detrimental impact on quality","Detrimental impact on performance","Insufficient work during proposed periods","Planned structural changes"];
async function showFlexWork(){ hrShow("page-flexwork","flexwork"); await HR.buildFlexWork(); }
HR.buildFlexWork = async function(){
  const el=document.getElementById("page-flexwork"); if(!el) return; if(HR.needCloud(el)) return;
  const {me,mgr}=HR.myRows();
  el.innerHTML=`<div class="sdi-doc">`
   +HR.hero("Service Desk Institute® · Flexible Working · Statutory Request","Flexible Working Request","A statutory request to change how, when or where you work — a day-one right. Routes to "+DB.esc(mgr.full_name||"your line manager")+" for a decision.","Owner","Paul M Rodrigues")
   +HR.docBlock("flex_work")
   +`<div class="hr-note">Fields marked <span class="req"></span> must be completed.</div>`
   +`<div class="sdi-form-sec"><div class="sfs-head"><span class="num">1</span> Your details</div><div class="sfs-body">
     <div class="hr-grid2"><div class="hr-field"><label class="req">Full name</label><input id="fw-name" value="${DB.esc(me.full_name||(DB.user&&DB.user.name)||"")}"></div><div class="hr-field"><label class="req">Job title</label><input id="fw-jobtitle" value="${DB.esc(me.job_title||"")}"></div></div>
     <div class="hr-grid2"><div class="hr-field"><label class="req">Department</label><input id="fw-dept" value="${DB.esc(me.department||"")}"></div><div class="hr-field"><label>Line manager</label><input id="fw-mgr" value="${DB.esc(mgr.full_name||"")}" readonly></div></div>
     ${(!me.job_title||!me.department)?`<div class="hr-field-hint">Job title and department fill in automatically once an admin adds them to your details in Manage Team.</div>`:""}
     <div class="hr-field"><label class="req">Date of this request</label><input type="date" id="fw-reqdate" value="${HR.today()}"></div></div></div>
   <div class="sdi-form-sec"><div class="sfs-head"><span class="num">2</span> Your current working pattern</div><div class="sfs-body">
     <div class="hr-field"><label class="req">Describe your current days, hours and place of work</label><textarea id="fw-current" rows="2" placeholder="e.g. Mon–Fri, 9:00–17:30, office-based in…"></textarea></div></div></div>
   <div class="sdi-form-sec"><div class="sfs-head"><span class="num">3</span> The change you are requesting</div><div class="sfs-body">
     <div class="hr-field"><label class="req">Type of change (tick all that apply)</label><div class="opt-group" id="fw-chg-wrap">${HR.opts("fw-chg",HR.FW_CHANGES,"checkbox",[])}</div></div>
     <div class="hr-field"><label class="req">Describe the new working pattern you would like</label><textarea id="fw-newpattern" rows="2" placeholder="Set out the exact days, hours and location you are proposing…"></textarea></div>
     <div class="hr-field"><label class="req">Date you would like the change to take effect</label><input type="date" id="fw-effective"></div>
     <div class="hr-field"><label class="req">Is this a permanent or temporary change?</label><div class="opt-group" id="fw-dur-wrap">${HR.opts("fw-dur",["Permanent","Temporary"],"radio","",`onchange="HR.fwToggle()"`)}</div></div>
     <div class="hr-field" id="fw-end-row" style="display:none;"><label class="req">End date of the temporary change</label><input type="date" id="fw-enddate"></div></div></div>
   <div class="sdi-form-sec"><div class="sfs-head"><span class="num">4</span> Statutory statement &amp; previous requests</div><div class="sfs-body">
     <div class="hr-field"><div class="opt-group" id="fw-stat-wrap"><label class="opt"><input type="checkbox" id="fw-statutory"> <span>I confirm that this is a statutory request for flexible working. <span class="req"></span></span></label></div></div>
     <div class="hr-field"><label class="req">Have you made a flexible working request in the last 12 months?</label><div class="opt-group" id="fw-prev-wrap">${HR.opts("fw-prev",["No","Yes"],"radio","",`onchange="HR.fwToggle()"`)}</div></div>
     <div class="hr-field" id="fw-prev-row" style="display:none;"><label class="req">Date of that request</label><input type="date" id="fw-prevdate"><div class="hr-field-hint">So we know which earlier request you mean.</div></div></div></div>
   <div class="sdi-form-sec"><div class="sfs-head"><span class="num">5</span> Effect on the business</div><div class="sfs-body">
     <div class="hr-field"><label>What effect, if any, would this change have on SDI — and how could that be dealt with? (optional)</label><textarea id="fw-effect" rows="2" placeholder="e.g. impact on cover, meetings, customers — and your suggestions…"></textarea></div></div></div>
   <div class="sdi-form-sec"><div class="sfs-head"><span class="num">6</span> Declaration</div><div class="sfs-body">
     <div class="sdi-decl">The information I have given on this form is correct and complete. I understand that if my request is approved the change may first be made on a trial or fixed-term basis, and that a permanent change to my contract will only be made after a formal review and written agreement from both parties.</div>
     <div class="hr-field"><label class="req">Signed — type your full name</label><input id="fw-sign" placeholder="Your full name"></div>
     <div id="fw-err" class="hr-errbox"></div>
     <button class="hr-btn" onclick="HR.submitFlexWork()">Submit${mgr.full_name?(" to "+DB.esc(mgr.full_name)):""}</button></div></div>
   </div><div id="fw-lists"></div>`;
  HR.renderSubs("flex_work","fw-lists");
};
HR.fwToggle = function(){
  const tmp=HR.radio("fw-dur")==="Temporary", prev=HR.radio("fw-prev")==="Yes";
  const e=document.getElementById("fw-end-row"); if(e) e.style.display=tmp?"":"none";
  const p=document.getElementById("fw-prev-row"); if(p) p.style.display=prev?"":"none";
};
HR.submitFlexWork = async function(){
  const g=id=>document.getElementById(id), v=HR.val;
  const changeTypes=[...document.querySelectorAll('input[name="fw-chg"]:checked')].map(c=>c.value);
  const dur=HR.radio("fw-dur"), prev=HR.radio("fw-prev");
  const checks=[
    {label:"Full name",ok:!!v("fw-name"),el:g("fw-name")},
    {label:"Job title",ok:!!v("fw-jobtitle"),el:g("fw-jobtitle")},
    {label:"Department",ok:!!v("fw-dept"),el:g("fw-dept")},
    {label:"Date of this request",ok:!!v("fw-reqdate"),el:g("fw-reqdate")},
    {label:"Current working pattern",ok:!!v("fw-current"),el:g("fw-current")},
    {label:"Type of change",ok:changeTypes.length>0,el:g("fw-chg-wrap")},
    {label:"New working pattern",ok:!!v("fw-newpattern"),el:g("fw-newpattern")},
    {label:"Date you would like the change to take effect",ok:!!v("fw-effective"),el:g("fw-effective")},
    {label:"Permanent or temporary",ok:!!dur,el:g("fw-dur-wrap")}
  ];
  if(dur==="Temporary"){
    checks.push({label:"End date of the temporary change",ok:!!v("fw-enddate"),el:g("fw-enddate")});
    if(v("fw-enddate")&&v("fw-effective")) checks.push({label:"The end date must be after the date the change takes effect",ok:v("fw-enddate")>v("fw-effective"),el:g("fw-enddate")});
  }
  checks.push({label:"Statutory request confirmation",ok:g("fw-statutory").checked,el:g("fw-stat-wrap")});
  checks.push({label:"Previous request in the last 12 months (Yes or No)",ok:!!prev,el:g("fw-prev-wrap")});
  if(prev==="Yes") checks.push({label:"Date of the previous request",ok:!!v("fw-prevdate"),el:g("fw-prevdate")});
  checks.push({label:"Declaration (type your full name)",ok:!!v("fw-sign"),el:g("fw-sign")});
  if(!HR.validate("fw-err",checks)) return;
  const data={ name:v("fw-name"), jobTitle:v("fw-jobtitle"), dept:v("fw-dept"), mgr:v("fw-mgr"), reqDate:v("fw-reqdate"), currentPattern:v("fw-current"), changeTypes, newPattern:v("fw-newpattern"), effectiveDate:v("fw-effective"), duration:dur, endDate:dur==="Temporary"?v("fw-enddate"):"", statutory:g("fw-statutory").checked, prevRequest:prev, prevDate:prev==="Yes"?v("fw-prevdate"):"", effect:v("fw-effect"), signed:v("fw-sign") };
  const [,error]=await HR.call("submissions.create",{type:"flex_work",data});
  if(error){ HR.serverError("fw-err",error); return; }
  if(typeof toast==="function") toast("Flexible working request submitted"); HR.buildFlexWork();
};

/* ============ Home Working DSE Self-Assessment (type dse) ============ */
HR.DSE_GROUPS=[
  {title:"Display screen",items:["The characters on screen are clear and easy to read","Text size and screen brightness/contrast are comfortable","The screen tilts, and is about an arm's length away","The top of the screen is roughly at eye level","The screen is free from glare and distracting reflections"]},
  {title:"Keyboard & mouse",items:["The keyboard is separate from the screen and can be positioned comfortably","There is space to rest your hands/wrists in front of the keyboard","The mouse (or other pointer) is close and works smoothly","Your wrists are straight and relaxed when typing"]},
  {title:"Laptop & devices",items:["If a laptop is your main device, you use it with a separate keyboard and mouse","If a laptop is your main device, it is raised on a stand/riser or you use a separate monitor so the top of the screen is near eye level","You have the equipment you need for a comfortable setup, or know how to request it"]},
  {title:"Chair, desk & posture",items:["Your chair is stable and its height can be adjusted","The chair back supports your lower back","Your feet rest flat on the floor (or on a footrest)","There is enough space on the desk for your equipment and documents","You can sit with relaxed shoulders and forearms roughly horizontal"]},
  {title:"Your environment",items:["Lighting is adequate for your tasks","Temperature and ventilation are comfortable","Noise levels let you concentrate","There is enough room to change position and vary movement","Cables and equipment are tidy and free from trip hazards"]},
  {title:"Electrical & equipment safety",items:["Sockets are not overloaded and extension leads are not daisy-chained together","Cables, plugs and chargers are in good condition and free from visible damage","Equipment is positioned so it will not overheat and cables are kept clear of walkways"]},
  {title:"Working routine & eyes",items:["You take regular short breaks or change activity away from the screen","You can rest and refocus your eyes regularly","You know how to raise a health, safety or workstation concern"]},
  {title:"Workspace & wellbeing",items:["You have a suitable, dedicated space to work in","You can stay in regular contact with your team and do not feel isolated","You are able to switch off at the end of the day and keep a healthy work-life boundary"]}
];
async function showDse(){ hrShow("page-dse","dse"); await HR.buildDse(); }
HR.buildDse = async function(){
  const el=document.getElementById("page-dse"); if(!el) return; if(HR.needCloud(el)) return;
  const {me,mgr}=HR.myRows();
  HR._dseFlat=[]; let n=0; let groupsHtml="";
  HR.DSE_GROUPS.forEach((grp,gi)=>{
    const rows=grp.items.map(q=>{
      const i=n++; HR._dseFlat.push({group:grp.title,q});
      return `<tr><td style="padding:6px 4px;font-size:12px;">${DB.esc(q)} <span class="req"></span></td>
        <td style="padding:6px 8px;white-space:nowrap;"><div class="opt-group" id="dse-w${i}" style="flex-wrap:nowrap;margin:0;">${HR.opts("dse-q"+i,["Yes","No"],"radio","")}</div></td>
        <td style="padding:6px 4px;"><input id="dse-n${i}" placeholder="Note (optional)" style="width:100%;border:1px solid var(--border);border-radius:5px;padding:5px 6px;font-size:11.5px;box-sizing:border-box;"></td></tr>`;
    }).join("");
    groupsHtml+=`<div class="sdi-form-sec"><div class="sfs-head"><span class="num">${gi+2}</span> ${DB.esc(grp.title)}</div><div class="sfs-body"><table style="width:100%;border-collapse:collapse;"><tbody>${rows}</tbody></table></div></div>`;
  });
  const nIssues=HR.DSE_GROUPS.length+2, nDecl=nIssues+1;
  el.innerHTML=`<div class="sdi-doc">`
   +HR.hero("Service Desk Institute® · Health &amp; Safety · Home Working","DSE Workstation Self-Assessment","A quick self-check of your home workstation. Answer each item Yes (fine) or No (needs attention). Routes to "+DB.esc(mgr.full_name||"your line manager")+".","Owner","Paul M Rodrigues")
   +HR.docBlock("dse")
   +`<div class="hr-note">All fields marked <span class="req"></span> must be completed. The note next to each question is optional.</div>`
   +`<div class="sdi-form-sec"><div class="sfs-head"><span class="num">1</span> Your details</div><div class="sfs-body">
     <div class="hr-grid2"><div class="hr-field"><label class="req">Full name</label><input id="dse-name" value="${DB.esc(me.full_name||(DB.user&&DB.user.name)||"")}"></div><div class="hr-field"><label class="req">Department</label><input id="dse-dept" value="${DB.esc(me.department||"")}"></div></div>
     <div class="hr-grid2"><div class="hr-field"><label>Line manager</label><input id="dse-mgr" value="${DB.esc(mgr.full_name||"")}" readonly></div><div class="hr-field"><label class="req">Where you work (room / setup)</label><input id="dse-where" placeholder="e.g. home office, spare room desk"></div></div>
     <div class="hr-field"><label class="req">Date of assessment</label><input type="date" id="dse-date" value="${HR.today()}"></div></div></div>`
   +groupsHtml
   +`<div class="sdi-form-sec"><div class="sfs-head"><span class="num">${nIssues}</span> Issues &amp; support</div><div class="sfs-body">
     <div class="hr-field"><label class="req">Anything you marked “No”, or any discomfort/concern you cannot resolve yourself</label><textarea id="dse-issues" rows="2" placeholder="Describe anything that needs attention, or write “None”."></textarea></div>
     <div class="hr-grid2"><div class="hr-field"><label class="req">Need equipment or support to fix an issue?</label><select id="dse-support"><option value="">Select…</option><option>No</option><option>Yes</option></select></div><div class="hr-field"><label class="req">Would you like an eyesight test?</label><select id="dse-eye"><option value="">Select…</option><option>No</option><option>Yes</option></select></div></div></div></div>
   <div class="sdi-form-sec"><div class="sfs-head"><span class="num">${nDecl}</span> Declaration</div><div class="sfs-body">
     <div class="sdi-decl">I confirm that I have carried out this assessment of my own home workstation, that the answers above are accurate, and that I will take reasonable care of my own health and safety and cooperate with any follow-up. I understand I should raise any concerns I cannot resolve myself promptly.</div>
     <div class="hr-field"><label class="req">Signed — type your full name</label><input id="dse-sign" placeholder="Your full name"></div>
     <div id="dse-err" class="hr-errbox"></div>
     <button class="hr-btn" onclick="HR.submitDse()">Submit${mgr.full_name?(" to "+DB.esc(mgr.full_name)):""}</button></div></div>
   </div><div id="dse-lists"></div>`;
  HR.renderSubs("dse","dse-lists");
};
HR.submitDse = async function(){
  const g=id=>document.getElementById(id), v=HR.val;
  const answers=(HR._dseFlat||[]).map((it,i)=>({group:it.group,q:it.q,ans:HR.radio("dse-q"+i),note:v("dse-n"+i)}));
  const unanswered=answers.map((a,i)=>a.ans?null:i).filter(i=>i!==null);
  const checks=[
    {label:"Full name",ok:!!v("dse-name"),el:g("dse-name")},
    {label:"Department",ok:!!v("dse-dept"),el:g("dse-dept")},
    {label:"Where you work",ok:!!v("dse-where"),el:g("dse-where")},
    {label:"Date of assessment",ok:!!v("dse-date"),el:g("dse-date")},
    {label:"Answer Yes or No to every question ("+unanswered.length+" not answered)",ok:!unanswered.length,el:unanswered.map(i=>g("dse-w"+i))},
    {label:"Issues & support (write “None” if nothing needs attention)",ok:!!v("dse-issues"),el:g("dse-issues")},
    {label:"Need equipment or support",ok:!!v("dse-support"),el:g("dse-support")},
    {label:"Eyesight test",ok:!!v("dse-eye"),el:g("dse-eye")},
    {label:"Declaration (type your full name)",ok:!!v("dse-sign"),el:g("dse-sign")}
  ];
  if(!HR.validate("dse-err",checks)) return;
  const data={ name:v("dse-name"), dept:v("dse-dept"), mgr:v("dse-mgr"), where:v("dse-where"), date:v("dse-date"), answers, issues:v("dse-issues"), needSupport:v("dse-support"), eyeTest:v("dse-eye"), signed:v("dse-sign") };
  const [,error]=await HR.call("submissions.create",{type:"dse",data});
  if(error){ HR.serverError("dse-err",error); return; }
  if(typeof toast==="function") toast("DSE self-assessment submitted"); HR.buildDse();
};

/* ============ Detail view (shared by flex_work + dse) ============ */
HR.ro = function(label,val){ return `<div class="hr-field"><label>${DB.esc(label)}</label><div style="font-size:12.5px;white-space:pre-wrap;">${DB.esc((val==null||val==="")?"—":String(val))}</div></div>`; };
HR.openSubmission = async function(id){
  const [sg,err]=await HR.call("submissions.get",{id}); const s=(sg&&sg.item)||null;
  if(!s){ HR.error(err?err.message:"That form was not found."); return; }
  const type=s.type, pageId=type==="flex_work"?"page-flexwork":"page-dse";
  const el=document.getElementById(pageId); if(!el) return;
  const d=s.data||{};
  const emp=(s.employee_email||"").toLowerCase();
  const canManage=emp!==DB.myEmail && (HR.iAmLineMgrOf(emp)||(DB.isAdmin&&!HR.orgRow(emp)?.manager_email)) && s.status==="submitted";
  const back=`<button class="hr-btn ghost" onclick="${type==="flex_work"?"HR.buildFlexWork()":"HR.buildDse()"}">← Back</button>`;
  const empView = type==="flex_work" ? HR.fwEmpView(d) : HR.dseEmpView(d);
  const mgrSec = type==="flex_work" ? HR.fwMgrSection(s,canManage) : HR.dseMgrSection(s,canManage);
  el.innerHTML=`<div class="sdi-doc"><div style="margin-bottom:12px;">${back}</div>`
    +HR.hero("Service Desk Institute® · "+(type==="flex_work"?"Flexible Working":"DSE Self-Assessment"),(type==="flex_work"?"Flexible Working Request":"DSE Self-Assessment"),"Submitted by "+DB.esc(HR.name(emp))+" on "+DB.esc(DB.fmtDate(s.submitted_at))+" · status: "+DB.esc(s.status),"Reference",String(s.id).slice(0,8))
    +empView+mgrSec+HR.trailHtml(s.manager_data)+`</div>`;
  try{ window.scrollTo(0,0); }catch(e){}
};
HR.fwEmpView = function(d){
  return `<div class="sdi-form-sec"><div class="sfs-head"><span class="num">1</span> Employee request</div><div class="sfs-body">`
    +`<div class="hr-grid2">${HR.ro("Full name",d.name)}${HR.ro("Job title",d.jobTitle)}</div>`
    +`<div class="hr-grid2">${HR.ro("Department",d.dept)}${HR.ro("Line manager",d.mgr)}</div>`
    +HR.ro("Date of request",d.reqDate)
    +HR.ro("Current working pattern",d.currentPattern)
    +HR.ro("Type of change",(d.changeTypes||[]).join(", "))
    +HR.ro("Proposed new pattern",d.newPattern)
    +`<div class="hr-grid2">${HR.ro("Requested effective date",d.effectiveDate)}${HR.ro("Permanent or temporary",d.duration?(d.duration+(d.endDate?(" — ends "+d.endDate):"")):"")}</div>`
    +HR.ro("Statutory request confirmed",d.statutory?"Yes":"No")
    +HR.ro("Previous request in last 12 months",(d.prevRequest||"")+(d.prevDate?(" ("+d.prevDate+")"):""))
    +HR.ro("Effect on the business",d.effect)
    +HR.ro("Signed",(d.signed||"")+(d.signDate?(" · "+d.signDate):""))
    +`</div></div>`;
};
HR.dseEmpView = function(d){
  const rows=(d.answers||[]).map(a=>`<tr><td style="padding:5px 4px;font-size:11.5px;">${DB.esc(a.q)}</td><td style="padding:5px 8px;font-weight:700;color:${a.ans==="No"?"var(--red)":"var(--navy)"};">${DB.esc(a.ans||"—")}</td><td style="padding:5px 4px;font-size:11.5px;color:var(--muted);">${DB.esc(a.note||"")}</td></tr>`).join("");
  return `<div class="sdi-form-sec"><div class="sfs-head"><span class="num">1</span> Employee assessment</div><div class="sfs-body">`
    +`<div class="hr-grid2">${HR.ro("Full name",d.name)}${HR.ro("Department",d.dept)}</div>`
    +`<div class="hr-grid2">${HR.ro("Line manager",d.mgr)}${HR.ro("Where they work",d.where)}</div>`
    +HR.ro("Date of assessment",d.date)
    +`<table style="width:100%;border-collapse:collapse;margin-top:8px;"><thead><tr><th style="text-align:left;font-size:9.5px;text-transform:uppercase;color:var(--muted);padding:4px;">Item</th><th style="text-align:left;font-size:9.5px;text-transform:uppercase;color:var(--muted);padding:4px;">Answer</th><th style="text-align:left;font-size:9.5px;text-transform:uppercase;color:var(--muted);padding:4px;">Note</th></tr></thead><tbody>${rows}</tbody></table>`
    +`<div style="margin-top:10px;">${HR.ro("Issues / discomfort noted",d.issues)}</div>`
    +`<div class="hr-grid2">${HR.ro("Needs equipment/support",d.needSupport)}${HR.ro("Eyesight test requested",d.eyeTest)}</div>`
    +HR.ro("Signed",(d.signed||"")+(d.signDate?(" · "+d.signDate):""))
    +`</div></div>`;
};
HR.fwMgrSection = function(s,canManage){
  const m=s.manager_data||{};
  const ocLbl={approved:"Approved",trial:"Approved on trial",declined:"Declined"};
  if(!canManage){
    if(!m.outcome) return `<div class="hr-note" style="margin-top:12px;">Awaiting the line manager's decision.</div>`;
    return `<div class="sdi-form-sec"><div class="sfs-head"><span class="num">7</span> Decision (line manager)</div><div class="sfs-body">`
      +HR.ro("Outcome",ocLbl[m.outcome]||m.outcome)+HR.ro("Meeting held on",m.meetingDate)
      +(m.declineReasons&&m.declineReasons.length?HR.ro("Decline reasons",m.declineReasons.join(", ")):"")
      +HR.ro("Trial / review",m.trialReview)+HR.ro("Agreed effective date",m.agreedDate)+HR.ro("Notes",m.notes)
      +HR.ro("Signed",(m.mgrSign||"")+(m.mgrDate?(" · "+m.mgrDate):""))
      +HR.ro("Recorded by",HR.name(s.decided_by)+(s.decided_at?(" · "+HR.dt(s.decided_at)):""))+`</div></div>`;
  }
  return `<div class="sdi-form-sec"><div class="sfs-head"><span class="num">7</span> Decision — for the line manager</div><div class="sfs-body">
    <div class="hr-note">Fields marked <span class="req"></span> must be completed. Once saved, the decision is final and kept in the history.</div>
    <div class="hr-field"><label class="req">Meeting held on</label><input type="date" id="fwm-meeting" value="${HR.today()}"></div>
    <div class="hr-field"><label class="req">Outcome</label><div class="opt-group" id="fwm-outcome-wrap">
      <label class="opt"><input type="radio" name="fwm-outcome" value="approved"> <span>Approved</span></label>
      <label class="opt"><input type="radio" name="fwm-outcome" value="trial"> <span>Approved on trial</span></label>
      <label class="opt"><input type="radio" name="fwm-outcome" value="declined"> <span>Declined</span></label></div></div>
    <div class="hr-field"><label>If declined, the business reason(s) — statutory grounds (at least one if declined)</label><div class="opt-group stack" id="fwm-reasons-wrap">${HR.opts("fwm-reason",HR.FW_REASONS,"checkbox",[])}</div></div>
    <div class="hr-grid2"><div class="hr-field"><label>Trial period / review date (required if on trial)</label><input id="fwm-trial" placeholder="e.g. 3-month trial, review 01/11/2026"></div><div class="hr-field"><label>Agreed effective date</label><input type="date" id="fwm-agreed"></div></div>
    <div class="hr-field"><label>Notes / summary of discussion</label><textarea id="fwm-notes" rows="2"></textarea></div>
    <div class="hr-grid2"><div class="hr-field"><label class="req">Line manager signature — type your full name</label><input id="fwm-sign"></div><div class="hr-field"><label class="req">Date</label><input type="date" id="fwm-date" value="${HR.today()}"></div></div>
    <div id="fwm-err" class="hr-errbox"></div>
    <button class="hr-btn" onclick="HR.saveManagerSection('${s.id}','flex_work')">Save decision</button></div></div>`;
};
HR.dseMgrSection = function(s,canManage){
  const m=s.manager_data||{};
  if(!canManage){
    if(!m.actions && !m.reviewer) return `<div class="hr-note" style="margin-top:12px;">Awaiting the line manager's review.</div>`;
    return `<div class="sdi-form-sec"><div class="sfs-head"><span class="num">12</span> Action &amp; review (line manager)</div><div class="sfs-body">`
      +HR.ro("Actions agreed",m.actions)+HR.ro("Review date",m.reviewDate)+HR.ro("Reviewed by",m.reviewer)+`</div></div>`;
  }
  return `<div class="sdi-form-sec"><div class="sfs-head"><span class="num">12</span> Action &amp; review — for the line manager</div><div class="sfs-body">
    <div class="hr-field"><label class="req">Actions agreed to address any issues</label><textarea id="dsem-actions" rows="2" placeholder="Equipment provided, guidance given, adjustments… or “None needed”">${DB.esc(m.actions||"")}</textarea></div>
    <div class="hr-grid2"><div class="hr-field"><label>Review date</label><input type="date" id="dsem-review" value="${DB.esc(m.reviewDate||"")}"></div><div class="hr-field"><label class="req">Reviewed by (name &amp; signature)</label><input id="dsem-reviewer" value="${DB.esc(m.reviewer||"")}"></div></div>
    <div id="dsem-err" class="hr-errbox"></div>
    <button class="hr-btn" onclick="HR.saveManagerSection('${s.id}','dse')">Save review</button></div></div>`;
};
HR.saveManagerSection = async function(id,type){
  const g=x=>document.getElementById(x), v=HR.val;
  let manager_data, box;
  if(type==="flex_work"){
    box="fwm-err";
    const outcome=HR.radio("fwm-outcome");
    const reasons=[...document.querySelectorAll('input[name="fwm-reason"]:checked')].map(c=>c.value);
    const checks=[
      {label:"Meeting held on",ok:!!v("fwm-meeting"),el:g("fwm-meeting")},
      {label:"Outcome",ok:!!outcome,el:g("fwm-outcome-wrap")}
    ];
    if(outcome==="declined") checks.push({label:"Business reason(s) for declining",ok:reasons.length>0,el:g("fwm-reasons-wrap")});
    if(outcome==="trial") checks.push({label:"Trial period / review date",ok:!!v("fwm-trial"),el:g("fwm-trial")});
    checks.push({label:"Line manager signature",ok:!!v("fwm-sign"),el:g("fwm-sign")});
    checks.push({label:"Date signed",ok:!!v("fwm-date"),el:g("fwm-date")});
    if(!HR.validate(box,checks)) return;
    manager_data={ meetingDate:v("fwm-meeting"), outcome, declineReasons:outcome==="declined"?reasons:[], trialReview:v("fwm-trial"), agreedDate:v("fwm-agreed"), notes:v("fwm-notes"), mgrSign:v("fwm-sign"), mgrDate:v("fwm-date") };
  } else {
    box="dsem-err";
    if(!HR.validate(box,[{label:"Actions agreed",ok:!!v("dsem-actions"),el:g("dsem-actions")},{label:"Reviewed by (name & signature)",ok:!!v("dsem-reviewer"),el:g("dsem-reviewer")}])) return;
    manager_data={ actions:v("dsem-actions"), reviewDate:v("dsem-review"), reviewer:v("dsem-reviewer") };
  }
  const [,error]=await HR.call("submissions.saveManagerSection",{id,manager_data});
  if(error){ HR.serverError(box,error); return; }
  if(typeof toast==="function") toast("Saved");
  HR.openSubmission(id);
};
