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
  if(error){ alert("Save failed: "+error.message); return; }
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
  if(error){ alert("Save failed: "+error.message); return; }
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
  if(error){ alert("Submit failed: "+error.message); return; }
  if(typeof toast==="function") toast("Submitted for Paul's approval"); HR.buildJD();
};
HR.adminSaveJD = async function(emp){
  const html=HR.strip(document.getElementById("jd-edit").innerHTML);
  const [,error]=await HR.call("jd.publish",{employee_email:emp,content:html});
  if(error){ alert("Save failed: "+error.message); return; }
  if(typeof toast==="function") toast("Published"); HR.buildJD();
};
HR.approveJD = async function(emp){
  const [res,error]=await HR.call("jd.approve",{employee_email:emp});
  if(!error && res && !res.approved){ HR.buildJD(); return; }
  if(error){ alert("Approve failed: "+error.message); return; }
  if(typeof toast==="function") toast("Approved & published"); HR.buildJD();
};
HR.rejectJD = async function(emp){
  const [,error]=await HR.call("jd.reject",{employee_email:emp});
  if(error){ alert("Reject failed: "+error.message); return; }
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
    <div class="hist-wrap"><table class="hist-tbl"><thead><tr><th>Review date</th><th>Reviewer</th><th>Overall rating</th><th>Change</th><th>Wellbeing</th><th>Signed off</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
    <div class="hr-note" style="margin-top:10px;">Signed-off reviews open read-only. “Change” compares each review’s overall rating with the previous one.</div></div>`;
};

async function showSelfCert(){ hrShow("page-selfcert","selfcert"); await HR.buildSelfCert(); }
HR.buildSelfCert = async function(){
  const el=document.getElementById("page-selfcert"); if(!el) return; if(HR.needCloud(el)) return;
  const me=HR.orgRow(DB.myEmail)||{}; const mgr=HR.orgRow((me.manager_email||""))||{};
  el.innerHTML=`<div class="sdi-doc">`
   +HR.hero("Service Desk Institute® · Confidential","Self-Certification Form","For sickness absences of <strong>7 calendar days or fewer</strong>. Complete on your return; it routes to "+DB.esc(mgr.full_name||"your line manager")+" for the return-to-work step.","Owner","Paul M Rodrigues")
   +HR.docBlock("self_cert")
   +`<div class="sdi-form-sec"><div class="sfs-head"><span class="num">1</span> Employee details</div><div class="sfs-body">
       <div class="hr-grid2"><div class="hr-field"><label>Full name</label><input id="sc-name" value="${DB.esc(me.full_name||(DB.user&&DB.user.name)||"")}"></div><div class="hr-field"><label>Line manager</label><input id="sc-mgr" value="${DB.esc(mgr.full_name||"")}" readonly></div></div></div></div>
     <div class="sdi-form-sec"><div class="sfs-head"><span class="num">2</span> Absence details</div><div class="sfs-body">
       <div class="hr-grid3"><div class="hr-field"><label>First day of absence</label><input type="date" id="sc-first"></div><div class="hr-field"><label>Last day</label><input type="date" id="sc-last"></div><div class="hr-field"><label>Date returned</label><input type="date" id="sc-return"></div></div></div></div>
     <div class="sdi-form-sec"><div class="sfs-head"><span class="num">3</span> Reason &amp; cause</div><div class="sfs-body">
       <div class="hr-field"><label>Reason for absence</label><textarea id="sc-reason" rows="2"></textarea></div>
       <div class="hr-grid2"><div class="hr-field"><label>Consulted a doctor?</label><select id="sc-doctor"><option>No</option><option>Yes</option></select></div><div class="hr-field"><label>Work-related?</label><select id="sc-work"><option>No</option><option>Yes</option></select></div></div></div></div>
     <div class="sdi-form-sec"><div class="sfs-head"><span class="num">4</span> Declaration</div><div class="sfs-body">
       <div class="sdi-decl">I certify that I was unable to work for the period shown because of the reason given, and that this information is true and complete. I understand that absences of more than 7 calendar days require a fit note, and that knowingly giving false information may be treated as a disciplinary matter.</div>
       <div class="hr-field"><label>Signed — type your full name</label><input id="sc-sign" placeholder="Your full name"></div>
       <button class="hr-btn" onclick="HR.submitSelfCert()">Submit${mgr.full_name?(" to "+DB.esc(mgr.full_name)):""}</button></div></div>
   </div><div id="sc-lists"></div>`;
  HR.renderSubs("self_cert","sc-lists");
};
HR.submitSelfCert = async function(){
  const g=id=>document.getElementById(id);
  if(!g("sc-first").value || !g("sc-sign").value){ alert("Enter the first day of absence and sign the declaration."); return; }
  const data={name:g("sc-name").value,first:g("sc-first").value,last:g("sc-last").value,ret:g("sc-return").value,reason:g("sc-reason").value,doctor:g("sc-doctor").value,work:g("sc-work").value,signed:g("sc-sign").value,signDate:new Date().toISOString().slice(0,10)};
  const [,error]=await HR.call("submissions.create",{type:"self_cert",data});
  if(error){ alert("Submit failed: "+error.message); return; }
  if(typeof toast==="function") toast("Self-certification submitted"); HR.buildSelfCert();
};

/* ---------- Expense Claim (employee submits; line manager authorises) ---------- */
async function showExpenses(){ hrShow("page-expenses","expenses"); await HR.buildExpenses(); }
HR.buildExpenses = async function(){
  const el=document.getElementById("page-expenses"); if(!el) return; if(HR.needCloud(el)) return;
  const me=HR.orgRow(DB.myEmail)||{}; const mgr=HR.orgRow((me.manager_email||""))||{};
  if(!HR._expItems) HR._expItems=[{date:"",cat:"Travel",desc:"",cc:"",amount:""}];
  el.innerHTML=`<div class="sdi-doc">`
   +HR.hero("Service Desk Institute® · Confidential","Expense Claim Form","Reclaim business expenses. Car mileage is reimbursed at <strong>35p per mile</strong>. Submits to "+DB.esc(mgr.full_name||"your line manager")+" for authorisation.","Owner","Paul M Rodrigues")
   +HR.docBlock("expense")
   +`<div class="sdi-form-sec"><div class="sfs-head"><span class="num">1</span> Claimant details</div><div class="sfs-body">
       <div class="hr-grid2"><div class="hr-field"><label>Full name</label><input id="ex-name" value="${DB.esc(me.full_name||(DB.user&&DB.user.name)||"")}"></div><div class="hr-field"><label>Claim period / month</label><input id="ex-period" placeholder="e.g. July 2026"></div></div></div></div>
     <div class="sdi-form-sec"><div class="sfs-head"><span class="num">2</span> Expense items</div><div class="sfs-body">
       <table class="exp-tbl"><thead><tr><th>Date</th><th>Category</th><th>What it was for</th><th>Cost centre</th><th>Amount £</th><th></th></tr></thead><tbody id="ex-rows"></tbody></table>
       <button class="hr-btn ghost" onclick="HR.addExpRow()">+ Add item</button>
       <div class="hr-grid3" style="margin-top:12px;"><div class="hr-field"><label>Mileage (miles)</label><input id="ex-miles" type="number" oninput="HR.calcExp()"></div><div class="hr-field"><label>Mileage £ (35p/mi)</label><input id="ex-mileamt" readonly></div><div class="hr-field"><label>Total £</label><input id="ex-total" readonly></div></div></div></div>
     <div class="sdi-form-sec"><div class="sfs-head"><span class="num">3</span> Declaration</div><div class="sfs-body">
       <div class="sdi-decl">I certify that the expenses claimed were necessarily incurred by me wholly and exclusively for SDI business, that they comply with the Expenses policy, and that valid receipts or invoices are attached for each item. Submitting false or fabricated claims is gross misconduct.</div>
       <div class="hr-field"><label>Signed — type your full name</label><input id="ex-sign" placeholder="Your full name"></div>
       <button class="hr-btn" onclick="HR.submitExpense()">Submit for authorisation</button></div></div>
   </div><div id="ex-lists"></div>`;
  HR.renderExpRows(); HR.calcExp(); HR.renderSubs("expense","ex-lists");
};
HR.addExpRow = function(){ HR._expItems.push({date:"",cat:"Travel",desc:"",cc:"",amount:""}); HR.renderExpRows(); };
HR.renderExpRows = function(){
  const tb=document.getElementById("ex-rows"); if(!tb) return;
  const cats=["Travel","Mileage","Accommodation","Subsistence","Equipment","Other"];
  tb.innerHTML=HR._expItems.map((it,i)=>`<tr class="exp-row"><td><input type="date" value="${DB.esc(it.date)}" onchange="HR._expItems[${i}].date=this.value"></td><td><select onchange="HR._expItems[${i}].cat=this.value">${cats.map(c=>`<option ${c===it.cat?"selected":""}>${c}</option>`).join("")}</select></td><td><input value="${DB.esc(it.desc)}" oninput="HR._expItems[${i}].desc=this.value"></td><td><input value="${DB.esc(it.cc)}" oninput="HR._expItems[${i}].cc=this.value"></td><td><input type="number" value="${DB.esc(it.amount)}" oninput="HR._expItems[${i}].amount=this.value;HR.calcExp()"></td><td><button class="hr-btn ghost" style="padding:4px 8px;" onclick="HR._expItems.splice(${i},1);HR.renderExpRows();HR.calcExp();">×</button></td></tr>`).join("");
};
HR.calcExp = function(){
  const miles=parseFloat((document.getElementById("ex-miles")||{}).value)||0, mile=miles*0.35;
  const items=HR._expItems.reduce((s,it)=>s+(parseFloat(it.amount)||0),0);
  const ma=document.getElementById("ex-mileamt"), tot=document.getElementById("ex-total");
  if(ma) ma.value="£"+mile.toFixed(2); if(tot) tot.value="£"+(items+mile).toFixed(2);
};
HR.submitExpense = async function(){
  const g=id=>document.getElementById(id);
  if(!g("ex-sign").value){ alert("Sign the declaration to submit."); return; }
  const miles=parseFloat(g("ex-miles").value)||0;
  const total=+(HR._expItems.reduce((s,it)=>s+(parseFloat(it.amount)||0),0)+miles*0.35).toFixed(2);
  const data={name:g("ex-name").value,period:g("ex-period").value,items:HR._expItems.slice(),miles,mileageAmt:+(miles*0.35).toFixed(2),total,signed:g("ex-sign").value,signDate:new Date().toISOString().slice(0,10)};
  const [,error]=await HR.call("submissions.create",{type:"expense",data});
  if(error){ alert("Submit failed: "+error.message); return; }
  HR._expItems=[{date:"",cat:"Travel",desc:"",cc:"",amount:""}];
  if(typeof toast==="function") toast("Expense claim submitted"); HR.buildExpenses();
};

/* ---------- shared: my submissions + manager "to authorise" list ---------- */
HR.renderSubs = async function(type,mountId){
  const mount=document.getElementById(mountId); if(!mount) return;
  const [sl]=await HR.call("submissions.list",{type}); const subs=(sl&&sl.items)||[];
  const mine=subs.filter(s=>(s.employee_email||"").toLowerCase()===DB.myEmail);
  const toAction=subs.filter(s=>HR.iAmLineMgrOf(s.employee_email) && s.status==="submitted");
  let html="";
  if(toAction.length) html+=`<h3 style="margin-top:22px;">⚑ Awaiting your ${type==="dse"?"review":"authorisation"} (${toAction.length})</h3>`+toAction.map(s=>HR.subRow(s,type,true)).join("");
  const plural={self_cert:"self-certifications",expense:"claims",flex_work:"flexible working requests",dse:"DSE assessments"}[type]||"submissions";
  html+=`<h3 style="margin-top:22px;">Your ${plural}</h3>`+(mine.length?mine.map(s=>HR.subRow(s,type,false)).join(""):`<div class="hr-note">None yet.</div>`);
  mount.innerHTML=html;
};
HR.subRow = function(s,type,action){
  const d=s.data||{};
  let summary;
  if(type==="expense") summary="£"+((d.total!=null?d.total:0))+(d.period?(" · "+d.period):"");
  else if(type==="flex_work") summary=((d.changeTypes&&d.changeTypes.length)?d.changeTypes.join(", "):"Flexible working request")+(d.effectiveDate?(" · from "+d.effectiveDate):"");
  else if(type==="dse") summary="Workstation self-assessment"+(d.date?(" · "+d.date):"");
  else summary=((d.first||"?"))+" → "+(d.ret||d.last||"?");
  const md=(s.manager_data&&s.manager_data.note)?`<div class="hr-note" style="margin:3px 0 0;">Manager note: ${DB.esc(s.manager_data.note)}</div>`:"";
  let btns;
  if(type==="flex_work"||type==="dse"){
    btns=` <button class="hr-btn ghost" style="padding:4px 10px;" onclick="HR.openSubmission('${s.id}')">${action?(type==="dse"?"Review":"Decide"):"Open"}</button>`;
  } else {
    btns=action?` <button class="hr-btn approve" style="padding:4px 10px;" onclick="HR.decide('${s.id}','authorised')">Authorise</button> <button class="hr-btn reject" style="padding:4px 10px;" onclick="HR.decide('${s.id}','rejected')">Reject</button>`:"";
  }
  return `<div class="hr-list-item"><div><b>${DB.esc(s.employee_email)}</b><div class="hr-note" style="margin:2px 0 0;">${DB.esc(summary)}</div>${md}</div><div style="display:flex;align-items:center;gap:8px;"><span class="hr-status ${s.status}">${s.status}</span>${btns}</div></div>`;
};
HR.decide = async function(id,status){
  const note=(prompt(status==="authorised"?"Optional note (e.g. return-to-work discussion held / approved):":"Optional reason for rejection:","")||"");
  const [,error]=await HR.call("submissions.decide",{id,status,note});
  if(error){ alert("Update failed: "+error.message); return; }
  if(typeof toast==="function") toast("Marked "+status);
  if(document.getElementById("page-selfcert").classList.contains("active")) HR.buildSelfCert(); else HR.buildExpenses();
};

/* ============ Flexible Working Request (type flex_work) ============ */
HR.FW_CHANGES=["Reduced hours","Compressed hours","Different start / finish times","Different working days","Working from home","Job share","Other"];
HR.FW_REASONS=["Burden of additional costs","Detrimental effect on meeting customer demand","Inability to reorganise work among existing staff","Inability to recruit additional staff","Detrimental impact on quality","Detrimental impact on performance","Insufficient work during proposed periods","Planned structural changes"];
async function showFlexWork(){ hrShow("page-flexwork","flexwork"); await HR.buildFlexWork(); }
HR.buildFlexWork = async function(){
  const el=document.getElementById("page-flexwork"); if(!el) return; if(HR.needCloud(el)) return;
  const me=HR.orgRow(DB.myEmail)||{}; const mgr=HR.orgRow((me.manager_email||""))||{};
  const chk=HR.FW_CHANGES.map(c=>`<label style="display:block;margin:4px 0;font-size:12.5px;"><input type="checkbox" class="fw-chg" value="${DB.esc(c)}"> ${DB.esc(c)}</label>`).join("");
  el.innerHTML=`<div class="sdi-doc">`
   +HR.hero("Service Desk Institute® · Flexible Working · Statutory Request","Flexible Working Request","A statutory request to change how, when or where you work — a day-one right. Routes to "+DB.esc(mgr.full_name||"your line manager")+" for a decision.","Owner","Paul M Rodrigues")
   +HR.docBlock("flex_work")
   +`<div class="sdi-form-sec"><div class="sfs-head"><span class="num">1</span> Your details</div><div class="sfs-body">
     <div class="hr-grid2"><div class="hr-field"><label>Full name</label><input id="fw-name" value="${DB.esc(me.full_name||(DB.user&&DB.user.name)||"")}"></div><div class="hr-field"><label>Job title</label><input id="fw-jobtitle" value=""></div></div>
     <div class="hr-grid2"><div class="hr-field"><label>Department</label><input id="fw-dept" value="${DB.esc(me.department||"")}"></div><div class="hr-field"><label>Line manager</label><input id="fw-mgr" value="${DB.esc(mgr.full_name||"")}" readonly></div></div>
     <div class="hr-field"><label>Date of this request</label><input type="date" id="fw-reqdate"></div></div></div>
   <div class="sdi-form-sec"><div class="sfs-head"><span class="num">2</span> Your current working pattern</div><div class="sfs-body">
     <div class="hr-field"><label>Describe your current days, hours and place of work</label><textarea id="fw-current" rows="2" placeholder="e.g. Mon–Fri, 9:00–17:30, fully remote…"></textarea></div></div></div>
   <div class="sdi-form-sec"><div class="sfs-head"><span class="num">3</span> The change you are requesting</div><div class="sfs-body">
     <div class="hr-field"><label>Type of change (tick all that apply)</label>${chk}</div>
     <div class="hr-field"><label>Describe the new working pattern you would like</label><textarea id="fw-newpattern" rows="2" placeholder="Set out the exact days, hours and location you are proposing…"></textarea></div>
     <div class="hr-field"><label>Date you would like the change to take effect</label><input type="date" id="fw-effective"></div></div></div>
   <div class="sdi-form-sec"><div class="sfs-head"><span class="num">4</span> Statutory statement &amp; previous requests</div><div class="sfs-body">
     <label style="display:block;font-size:12.5px;margin-bottom:8px;"><input type="checkbox" id="fw-statutory"> I confirm that this is a statutory request for flexible working.</label>
     <div class="hr-field"><label>Have you made a flexible working request in the last 12 months?</label><label style="font-size:12.5px;margin-right:14px;"><input type="radio" name="fw-prev" value="No" checked> No</label><label style="font-size:12.5px;"><input type="radio" name="fw-prev" value="Yes"> Yes</label></div>
     <div class="hr-field"><label>If yes, date of that request</label><input type="date" id="fw-prevdate"></div></div></div>
   <div class="sdi-form-sec"><div class="sfs-head"><span class="num">5</span> Effect on the business</div><div class="sfs-body">
     <div class="hr-field"><label>What effect, if any, would this change have on SDI — and how could that be dealt with? (optional)</label><textarea id="fw-effect" rows="2" placeholder="e.g. impact on cover, meetings, customers — and your suggestions…"></textarea></div></div></div>
   <div class="sdi-form-sec"><div class="sfs-head"><span class="num">6</span> Declaration</div><div class="sfs-body">
     <div class="sdi-decl">The information I have given on this form is correct and complete. I understand that if my request is approved the change may first be made on a trial or fixed-term basis, and that a permanent change to my contract will only be made after a formal review and written agreement from both parties.</div>
     <div class="hr-field"><label>Signed — type your full name</label><input id="fw-sign" placeholder="Your full name"></div>
     <button class="hr-btn" onclick="HR.submitFlexWork()">Submit${mgr.full_name?(" to "+DB.esc(mgr.full_name)):""}</button></div></div>
   </div><div id="fw-lists"></div>`;
  HR.renderSubs("flex_work","fw-lists");
};
HR.submitFlexWork = async function(){
  const g=id=>document.getElementById(id);
  if(!g("fw-sign").value){ alert("Sign the declaration to submit."); return; }
  const changeTypes=[...document.querySelectorAll(".fw-chg:checked")].map(c=>c.value);
  const prev=(document.querySelector('input[name="fw-prev"]:checked')||{}).value||"No";
  const data={ name:g("fw-name").value, jobTitle:g("fw-jobtitle").value, dept:g("fw-dept").value, mgr:g("fw-mgr").value, reqDate:g("fw-reqdate").value, currentPattern:g("fw-current").value, changeTypes, newPattern:g("fw-newpattern").value, effectiveDate:g("fw-effective").value, statutory:g("fw-statutory").checked, prevRequest:prev, prevDate:g("fw-prevdate").value, effect:g("fw-effect").value, signed:g("fw-sign").value, signDate:new Date().toISOString().slice(0,10) };
  const [,error]=await HR.call("submissions.create",{type:"flex_work",data});
  if(error){ alert("Submit failed: "+error.message); return; }
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
  const me=HR.orgRow(DB.myEmail)||{}; const mgr=HR.orgRow((me.manager_email||""))||{};
  HR._dseFlat=[]; let n=0; let groupsHtml="";
  HR.DSE_GROUPS.forEach((grp,gi)=>{
    const rows=grp.items.map(q=>{
      const i=n++; HR._dseFlat.push({group:grp.title,q});
      return `<tr><td style="padding:6px 4px;font-size:12px;">${DB.esc(q)}</td>
        <td style="padding:6px 8px;white-space:nowrap;"><label style="font-size:12px;margin-right:10px;"><input type="radio" name="dse-q${i}" value="Yes"> Yes</label><label style="font-size:12px;"><input type="radio" name="dse-q${i}" value="No"> No</label></td>
        <td style="padding:6px 4px;"><input id="dse-n${i}" placeholder="Note (optional)" style="width:100%;border:1px solid var(--border);border-radius:5px;padding:5px 6px;font-size:11.5px;box-sizing:border-box;"></td></tr>`;
    }).join("");
    groupsHtml+=`<div class="sdi-form-sec"><div class="sfs-head"><span class="num">${gi+2}</span> ${DB.esc(grp.title)}</div><div class="sfs-body"><table style="width:100%;border-collapse:collapse;"><tbody>${rows}</tbody></table></div></div>`;
  });
  const nIssues=HR.DSE_GROUPS.length+2, nDecl=nIssues+1;
  el.innerHTML=`<div class="sdi-doc">`
   +HR.hero("Service Desk Institute® · Health &amp; Safety · Home Working","DSE Workstation Self-Assessment","A quick self-check of your home workstation. Answer each item Yes (fine) or No (needs attention). Routes to "+DB.esc(mgr.full_name||"your line manager")+".","Owner","Paul M Rodrigues")
   +HR.docBlock("dse")
   +`<div class="sdi-form-sec"><div class="sfs-head"><span class="num">1</span> Your details</div><div class="sfs-body">
     <div class="hr-grid2"><div class="hr-field"><label>Full name</label><input id="dse-name" value="${DB.esc(me.full_name||(DB.user&&DB.user.name)||"")}"></div><div class="hr-field"><label>Department</label><input id="dse-dept" value="${DB.esc(me.department||"")}"></div></div>
     <div class="hr-grid2"><div class="hr-field"><label>Line manager</label><input id="dse-mgr" value="${DB.esc(mgr.full_name||"")}" readonly></div><div class="hr-field"><label>Where you work (room / setup)</label><input id="dse-where" placeholder="e.g. home office, spare room desk"></div></div>
     <div class="hr-field"><label>Date of assessment</label><input type="date" id="dse-date"></div></div></div>`
   +groupsHtml
   +`<div class="sdi-form-sec"><div class="sfs-head"><span class="num">${nIssues}</span> Issues &amp; support</div><div class="sfs-body">
     <div class="hr-field"><label>Anything you marked “No”, or any discomfort/concern you cannot resolve yourself</label><textarea id="dse-issues" rows="2" placeholder="Describe anything that needs attention…"></textarea></div>
     <div class="hr-grid2"><div class="hr-field"><label>Need equipment or support to fix an issue?</label><select id="dse-support"><option>No</option><option>Yes</option></select></div><div class="hr-field"><label>Would you like an eyesight test?</label><select id="dse-eye"><option>No</option><option>Yes</option></select></div></div></div></div>
   <div class="sdi-form-sec"><div class="sfs-head"><span class="num">${nDecl}</span> Declaration</div><div class="sfs-body">
     <div class="sdi-decl">I confirm that I have carried out this assessment of my own home workstation, that the answers above are accurate, and that I will take reasonable care of my own health and safety and cooperate with any follow-up. I understand I should raise any concerns I cannot resolve myself promptly.</div>
     <div class="hr-field"><label>Signed — type your full name</label><input id="dse-sign" placeholder="Your full name"></div>
     <button class="hr-btn" onclick="HR.submitDse()">Submit${mgr.full_name?(" to "+DB.esc(mgr.full_name)):""}</button></div></div>
   </div><div id="dse-lists"></div>`;
  HR.renderSubs("dse","dse-lists");
};
HR.submitDse = async function(){
  const g=id=>document.getElementById(id);
  if(!g("dse-sign").value){ alert("Sign the declaration to submit."); return; }
  const answers=(HR._dseFlat||[]).map((it,i)=>({group:it.group,q:it.q,ans:(document.querySelector('input[name="dse-q'+i+'"]:checked')||{}).value||"",note:(g("dse-n"+i)||{}).value||""}));
  const data={ name:g("dse-name").value, dept:g("dse-dept").value, mgr:g("dse-mgr").value, where:g("dse-where").value, date:g("dse-date").value, answers, issues:g("dse-issues").value, needSupport:g("dse-support").value, eyeTest:g("dse-eye").value, signed:g("dse-sign").value, signDate:new Date().toISOString().slice(0,10) };
  const [,error]=await HR.call("submissions.create",{type:"dse",data});
  if(error){ alert("Submit failed: "+error.message); return; }
  if(typeof toast==="function") toast("DSE self-assessment submitted"); HR.buildDse();
};

/* ============ Manager detail view (shared by flex_work + dse) ============ */
HR.ro = function(label,val){ return `<div class="hr-field"><label>${DB.esc(label)}</label><div style="font-size:12.5px;white-space:pre-wrap;">${DB.esc((val==null||val==="")?"—":String(val))}</div></div>`; };
HR.openSubmission = async function(id){
  const [sg]=await HR.call("submissions.get",{id}); const s=(sg&&sg.item)||null;
  if(!s) return;
  const type=s.type, pageId=type==="flex_work"?"page-flexwork":"page-dse";
  const el=document.getElementById(pageId); if(!el) return;
  const d=s.data||{}, m=s.manager_data||{};
  const canManage=HR.iAmLineMgrOf(s.employee_email)||DB.isAdmin;
  const back=`<button class="hr-btn ghost" onclick="${type==="flex_work"?"HR.buildFlexWork()":"HR.buildDse()"}">← Back</button>`;
  const emp = type==="flex_work" ? HR.fwEmpView(d) : HR.dseEmpView(d);
  const mgrSec = type==="flex_work" ? HR.fwMgrSection(s,canManage) : HR.dseMgrSection(s,canManage);
  el.innerHTML=`<div class="sdi-doc"><div style="margin-bottom:12px;">${back}</div>`
    +HR.hero("Service Desk Institute® · "+(type==="flex_work"?"Flexible Working":"DSE Self-Assessment"),(type==="flex_work"?"Flexible Working Request":"DSE Self-Assessment"),"Submitted by "+DB.esc(s.employee_email)+" · status: "+DB.esc(s.status),"Reference",String(s.id).slice(0,8))
    +emp+mgrSec+`</div>`;
};
HR.fwEmpView = function(d){
  return `<div class="sdi-form-sec"><div class="sfs-head"><span class="num">1</span> Employee request</div><div class="sfs-body">`
    +`<div class="hr-grid2">${HR.ro("Full name",d.name)}${HR.ro("Job title",d.jobTitle)}</div>`
    +`<div class="hr-grid2">${HR.ro("Department",d.dept)}${HR.ro("Line manager",d.mgr)}</div>`
    +HR.ro("Date of request",d.reqDate)
    +HR.ro("Current working pattern",d.currentPattern)
    +HR.ro("Type of change",(d.changeTypes||[]).join(", "))
    +HR.ro("Proposed new pattern",d.newPattern)
    +HR.ro("Requested effective date",d.effectiveDate)
    +HR.ro("Statutory request confirmed",d.statutory?"Yes":"No")
    +HR.ro("Previous request in last 12 months",d.prevRequest+(d.prevDate?(" ("+d.prevDate+")"):""))
    +HR.ro("Effect on the business",d.effect)
    +HR.ro("Signed",d.signed+(d.signDate?(" · "+d.signDate):""))
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
    +HR.ro("Signed",d.signed+(d.signDate?(" · "+d.signDate):""))
    +`</div></div>`;
};
HR.fwMgrSection = function(s,canManage){
  const m=s.manager_data||{};
  if(!canManage){
    if(!m.outcome) return `<div class="hr-note" style="margin-top:12px;">Awaiting the line manager's decision.</div>`;
    return `<div class="sdi-form-sec"><div class="sfs-head"><span class="num">7</span> Decision (line manager)</div><div class="sfs-body">`
      +HR.ro("Outcome",m.outcome)+HR.ro("Meeting held on",m.meetingDate)
      +(m.declineReasons&&m.declineReasons.length?HR.ro("Decline reasons",m.declineReasons.join(", ")):"")
      +HR.ro("Trial / review",m.trialReview)+HR.ro("Agreed effective date",m.agreedDate)+HR.ro("Notes",m.notes)+HR.ro("Signed",m.mgrSign+(m.mgrDate?(" · "+m.mgrDate):""))+`</div></div>`;
  }
  const reasons=HR.FW_REASONS.map(r=>`<label style="display:block;margin:3px 0;font-size:12px;"><input type="checkbox" class="fwm-reason" value="${DB.esc(r)}" ${(m.declineReasons||[]).includes(r)?"checked":""}> ${DB.esc(r)}</label>`).join("");
  const oc=m.outcome||"";
  return `<div class="sdi-form-sec"><div class="sfs-head"><span class="num">7</span> Decision — for the line manager</div><div class="sfs-body">
    <div class="hr-field"><label>Meeting held on</label><input type="date" id="fwm-meeting" value="${DB.esc(m.meetingDate||"")}"></div>
    <div class="hr-field"><label>Outcome</label><label style="font-size:12.5px;margin-right:12px;"><input type="radio" name="fwm-outcome" value="approved" ${oc==="approved"?"checked":""}> Approved</label><label style="font-size:12.5px;margin-right:12px;"><input type="radio" name="fwm-outcome" value="trial" ${oc==="trial"?"checked":""}> Approved on trial</label><label style="font-size:12.5px;"><input type="radio" name="fwm-outcome" value="declined" ${oc==="declined"?"checked":""}> Declined</label></div>
    <div class="hr-field"><label>If declined, the business reason(s) — statutory grounds</label>${reasons}</div>
    <div class="hr-grid2"><div class="hr-field"><label>Trial period / review date (if on trial)</label><input id="fwm-trial" value="${DB.esc(m.trialReview||"")}" placeholder="e.g. 3-month trial, review 01/11/2026"></div><div class="hr-field"><label>Agreed effective date</label><input type="date" id="fwm-agreed" value="${DB.esc(m.agreedDate||"")}"></div></div>
    <div class="hr-field"><label>Notes / summary of discussion</label><textarea id="fwm-notes" rows="2">${DB.esc(m.notes||"")}</textarea></div>
    <div class="hr-grid2"><div class="hr-field"><label>Line manager name &amp; signature</label><input id="fwm-sign" value="${DB.esc(m.mgrSign||"")}"></div><div class="hr-field"><label>Date</label><input type="date" id="fwm-date" value="${DB.esc(m.mgrDate||"")}"></div></div>
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
    <div class="hr-field"><label>Actions agreed to address any issues</label><textarea id="dsem-actions" rows="2" placeholder="Equipment provided, guidance given, adjustments…">${DB.esc(m.actions||"")}</textarea></div>
    <div class="hr-grid2"><div class="hr-field"><label>Review date</label><input type="date" id="dsem-review" value="${DB.esc(m.reviewDate||"")}"></div><div class="hr-field"><label>Reviewed by (name &amp; signature)</label><input id="dsem-reviewer" value="${DB.esc(m.reviewer||"")}"></div></div>
    <button class="hr-btn" onclick="HR.saveManagerSection('${s.id}','dse')">Save review</button></div></div>`;
};
HR.saveManagerSection = async function(id,type){
  const g=x=>document.getElementById(x);
  let manager_data, status;
  if(type==="flex_work"){
    const outcome=(document.querySelector('input[name="fwm-outcome"]:checked')||{}).value;
    if(!outcome){ alert("Select an outcome (Approved / Trial / Declined)."); return; }
    manager_data={ by:DB.myEmail, meetingDate:g("fwm-meeting").value, outcome, declineReasons:[...document.querySelectorAll(".fwm-reason:checked")].map(c=>c.value), trialReview:g("fwm-trial").value, agreedDate:g("fwm-agreed").value, notes:g("fwm-notes").value, mgrSign:g("fwm-sign").value, mgrDate:g("fwm-date").value };
    status=outcome;
  } else {
    manager_data={ by:DB.myEmail, actions:g("dsem-actions").value, reviewDate:g("dsem-review").value, reviewer:g("dsem-reviewer").value };
    status="reviewed";
  }
  const [,error]=await HR.call("submissions.saveManagerSection",{id,manager_data});
  if(error){ alert("Save failed: "+error.message); return; }
  if(typeof toast==="function") toast("Saved");
  if(type==="flex_work") HR.buildFlexWork(); else HR.buildDse();
};
