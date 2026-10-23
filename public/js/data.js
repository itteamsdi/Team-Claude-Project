/* SDI HR data layer (PHP version).
   Talks to api.php on this server. Sign-in is handled by the server (login.php);
   this page only loads for a signed-in person. Every call sends the CSRF token,
   and the server checks permissions on every call (src/Access.php). */
window.DB = {
  user:null, mode:"cloud", currentId:null, items:[], saveTimer:null,
  sessionId:null, poller:null, _lastAppliedAt:null, _pendingRemote:null, _pendingAt:null,
  org:[], isAdmin:false, myEmail:"", canEditCurrent:false, isPartyCurrent:false,
  client:true,   // kept so older checks such as "if(DB.client)" still read as signed in

  /* ---- server calls ---- */
  csrf(){ const m=document.querySelector('meta[name="csrf-token"]'); return m?m.content:""; },
  async api(action, params){
    let res;
    try{
      res=await fetch("api.php",{ method:"POST", credentials:"same-origin",
        headers:{ "Content-Type":"application/json", "X-CSRF-Token":this.csrf() },
        body: JSON.stringify(Object.assign({action}, params||{})) });
    }catch(e){ throw new Error("Couldn't reach the server. Check your connection and try again."); }
    let out={}; try{ out=await res.json(); }catch(e){}
    if(out && out.signed_out){ location.href="login.php"; throw new Error("Your session has ended. Sign in again."); }
    if(!res.ok || !out || !out.ok) throw new Error((out&&out.error)||("The server returned an error ("+res.status+")."));
    return out.data||{};
  },

  /* ---- boot ---- */
  async init(){
    if(!this.sessionId) this.sessionId="sess-"+Math.random().toString(36).slice(2);
    let boot={}; try{ boot=JSON.parse(document.getElementById("boot-data").textContent||"{}"); }catch(e){}
    this.user={ email:boot.email||"", name:boot.name||boot.email||"" };
    await this.afterLogin(!!boot.isAdmin);
  },

  signOut(){
    this.stopPoll();
    if(this.saveTimer){ clearTimeout(this.saveTimer); this.saveTimer=null; this.flushSave(); }
    const f=document.getElementById("logout-form"); if(f) f.submit();
  },
  backToReviews(){
    this.stopPoll(); this.currentId=null; this.applyReadonly(false);
    const p=document.getElementById("auth-pill"); if(p) p.classList.remove("show");
    if(typeof showTab==="function") showTab("review");
    this.loadReviews();
  },

  async afterLogin(isAdmin){
    this.err("");
    this.myEmail=((this.user.email)||"").toLowerCase();
    const mail=this.user.email||"", nm=this.user.name||mail;
    const set=(id,v)=>{const e=document.getElementById(id); if(e) e.textContent=v;};
    set("auth-user-name",nm); set("auth-user-mail",mail);
    set("auth-avatar",(nm||"?").trim().charAt(0).toUpperCase());
    this.isAdmin=!!isAdmin;
    await this.loadOrg();
    const ab=document.getElementById("auth-admin-btn"); if(ab) ab.style.display=this.isAdmin?"block":"none";
    const tb=document.getElementById("tb-team"); if(tb) tb.style.display=this.isAdmin?"":"none";
    this.refreshNewReviewOptions();
    await this.loadReviews();
    this.currentId=null;
    this.mode="cloud";
    if(typeof showTab==="function") showTab("review");   // land in the app on the reviews list
  },

  /* ---- reviews ---- */
  async loadReviews(){
    const box=document.getElementById("auth-review-list");
    box.innerHTML='<div class="auth-empty">Loading…</div>';
    try{ this.items=(await this.api("reviews.list")).items||[]; }
    catch(e){ box.innerHTML='<div class="auth-empty">Couldn\'t load reviews: '+this.esc(e.message)+'</div>'; return; }
    // Signed-off reviews move to 1-2-1 History; this list shows work in progress.
    const active=this.items.filter(it=>!this.signState(it).complete);
    const doneN=this.items.length-active.length;
    const histLink=doneN?'<button class="hr-btn ghost" style="margin-top:6px;" onclick="showTab(\'history\')">📚 '+doneN+' signed-off review'+(doneN===1?"":"s")+' in 1-2-1 History →</button>':'';
    if(!active.length){ box.innerHTML='<div class="auth-empty">No open reviews — create one below.</div>'+histLink; return; }
    box.innerHTML=active.map(it=>{
      const sg=this.signState(it);
      const who=(it.employee_name||it.employee_email||"Review")+(it.manager_name?(" · mgr "+it.manager_name):"");
      const canDel = !!it.can_delete;
      return '<div class="auth-review" onclick="DB.openReview(\''+DB.esc(String(it.id))+'\')">'
        +'<div><div class="auth-review-t">'+DB.esc(it.employee_name||"Review")+'</div>'
        +'<div class="auth-review-m">'+DB.esc(who)+(it.review_date?(" · "+String(it.review_date).slice(0,10)):"")+'</div></div>'
        +'<div style="display:flex;align-items:center;gap:8px;flex-shrink:0;">'
        +'<span class="auth-review-badge '+(sg.partial?"auth-badge-sign":"auth-badge-open")+'">'+(sg.partial?"Awaiting sign-off":"Open")+'</span>'
        +(canDel?'<button class="auth-del" title="Delete this review" onclick="event.stopPropagation();DB.deleteReview(\''+DB.esc(String(it.id))+'\')">&times;</button>':'')
        +'</div></div>';
    }).join("")+histLink;
  },

  openReview(id){
    const it=this.items.find(x=>String(x.id)===String(id)); if(!it) return;
    let obj={}; try{ obj=(typeof it.state==="string")?JSON.parse(it.state||"{}"):(it.state||{}); }catch(e){ obj={}; }
    this.currentId=id; this.mode="cloud";
    this._lastAppliedAt=it.updated_at||null;
    const emp=((it.employee_email)||"").toLowerCase();
    const empRow=this.org.find(m=>(m.email||"").toLowerCase()===emp);
    this.isPartyCurrent = (emp===this.myEmail) || !!(empRow && (empRow.manager_email||"").toLowerCase()===this.myEmail);
    this.applyLock(it);
    this.applyState(obj);
    this.hideGate();
    if(typeof showTab==="function") showTab("review");   // show the review area (sidebar + sections)
    const sg=this.signState(it);
    this.setPill(sg.complete?"🔒 Signed off":(sg.partial?"Awaiting sign-off":(this.canEditCurrent?"Saved ✓":"View only")));
    this.startPoll();
  },

  /* ---- sign-off + lock (enforced on the server in src/Api/ReviewsApi.php) ---- */
  currentRow(){ return this.items.find(x=>String(x.id)===String(this.currentId))||null; },
  signState(row){
    row=row||{};
    const complete=(row.status||"")==="Complete";
    const emp=!!row.employee_signed_at, mgr=!!row.manager_signed_at;
    return { emp, mgr, complete, partial:!complete&&(emp||mgr), locked:complete||emp||mgr };
  },
  // Which signature the signed-in user gives on this review: "employee", "manager" or null.
  signerRole(row){
    if(!row) return null;
    const emp=(row.employee_email||"").toLowerCase(), mgr=(row.manager_email||"").toLowerCase();
    if(emp && emp===this.myEmail) return "employee";
    if(mgr ? mgr===this.myEmail : this.isAdmin) return "manager";
    return null;
  },
  applyLock(row){
    row=row||this.currentRow(); if(!row) return;
    const sg=this.signState(row);
    this.canEditCurrent = !!this.isPartyCurrent && !sg.locked;
    let msg="";
    if(sg.complete) msg="🔒 Signed off and locked"+(row.completed_at?(" on "+this.fmtDate(row.completed_at)):"")+" — this review is part of the 1-2-1 history and can no longer be changed.";
    else if(sg.partial) msg="✍ Sign-off in progress — editing is paused. To make changes, withdraw the signature on the Review summary page.";
    this.applyReadonly(!this.canEditCurrent,msg);
    this.renderSignoff();
  },
  updateRow(row){
    if(!row) return;
    const i=this.items.findIndex(x=>String(x.id)===String(row.id));
    if(i>=0) this.items[i]=Object.assign({},this.items[i],row); else this.items.unshift(row);
  },
  // Pick up sign-off changes made by the other person (from polling).
  syncRow(row){
    const before=JSON.stringify(this.signState(this.currentRow()));
    this.updateRow(row);
    if(JSON.stringify(this.signState(row))!==before){
      this.applyLock(row);
      const sg=this.signState(row);
      this.setPill(sg.complete?"🔒 Signed off":(sg.partial?"Awaiting sign-off":"Saved ✓"));
    }
  },
  personName(email){
    const r=this.org.find(m=>(m.email||"").toLowerCase()===(email||"").toLowerCase());
    return (r&&r.full_name)||email||"";
  },
  fmtDate(ts,withTime){
    if(!ts) return "";
    const d=new Date(ts); if(isNaN(d)) return String(ts);
    const o={day:"numeric",month:"short",year:"numeric"}; if(withTime){ o.hour="2-digit"; o.minute="2-digit"; }
    return d.toLocaleString("en-GB",o);
  },
  renderSignoff(){
    const el=document.getElementById("so-panel"); if(!el) return;
    if(this.mode!=="cloud" || !this.currentId){
      el.innerHTML='<div class="hr-note">Sign-off is available when you are signed in and working on a shared review.</div>';
      return;
    }
    const row=this.currentRow(); if(!row){ el.innerHTML=""; return; }
    const sg=this.signState(row), role=this.signerRole(row);
    const sig=(label,email,at,by)=>'<div class="so-sig'+(at?" done":"")+'"><div class="so-role">'+label+'</div>'
      +'<div class="so-who">'+DB.esc(this.personName(by||email)||"—")+'</div>'
      +'<div class="so-when">'+(at?("✓ Signed "+DB.esc(this.fmtDate(at,true))):"Awaiting signature")+'</div></div>';
    let html=sg.complete?'<div class="so-locked">🔒 Complete — signed off by both and locked'+(row.completed_at?(" on "+DB.esc(this.fmtDate(row.completed_at))):"")+'. It now sits in 1-2-1 History.</div>':"";
    html+='<div class="so-sigs">'
      +sig("Employee",row.employee_email,row.employee_signed_at,row.employee_signed_by)
      +sig("Line manager",row.manager_email,row.manager_signed_at,row.manager_signed_by)+'</div>';
    const btns=[];
    if(!sg.complete && role){
      const mine=role==="employee"?sg.emp:sg.mgr;
      if(!mine) btns.push('<button class="hr-btn approve" onclick="DB.signOff()">✍ Sign off as '+(role==="employee"?"employee":"line manager")+'</button>');
      else btns.push('<button class="hr-btn ghost" onclick="DB.withdrawSignoff()">Withdraw my signature</button>');
    }
    if(sg.complete && this.isAdmin) btns.push('<button class="hr-btn ghost" onclick="DB.reopenReview()">🔓 Reopen review (admin)</button>');
    if(sg.complete) btns.push('<button class="hr-btn ghost" onclick="showTab(\'history\')">📚 View 1-2-1 History</button>');
    html+='<div class="so-actions">'+btns.join("")+'</div>';
    if(!sg.complete) html+='<div class="hr-note" style="margin-top:8px;">'+(role
      ?"Signing confirms you agree this review is final. Editing is paused once anyone has signed; it is locked for good when both have signed."
      :"Only the employee and their line manager can sign off this review.")+'</div>';
    el.innerHTML=html;
  },
  async _signRpc(fn,okMsg){
    let row=null;
    try{ row=(await this.api(fn,{ id:String(this.currentId) })).item; }
    catch(e){ (window.HR&&HR.error?HR.error:alert)("Couldn't update sign-off: "+e.message); await this.refreshCurrent(); return; }
    if(row){ this.updateRow(row); if(row.updated_at) this._lastAppliedAt=row.updated_at; }
    this.applyLock(row);
    const sg=this.signState(row);
    this.setPill(sg.complete?"🔒 Signed off":(sg.partial?"Awaiting sign-off":"Saved ✓"));
    if(typeof toast==="function") toast(sg.complete?"✓ Review signed off and locked":okMsg);
  },
  async signOff(){
    const row=this.currentRow(), role=this.signerRole(row); if(!row||!role) return;
    const sg=this.signState(row);
    const other=role==="employee"?"line manager":"employee";
    const otherSigned=role==="employee"?sg.mgr:sg.emp;
    if(!confirm(otherSigned
      ? "Sign off this review?\n\nThe "+other+" has already signed, so this will mark the review Complete and lock it permanently. It will move to 1-2-1 History."
      : "Sign off this review?\n\nEditing will be paused for both of you until the "+other+" signs (you can withdraw your signature before then). Once both have signed, the review is locked.")) return;
    // Save the latest edits first so both signatures cover the same content.
    if(this.canEditCurrent){
      if(!S.signoff) S.signoff={};
      if(!S.signoff.dateAgreed){ S.signoff.dateAgreed=new Date().toISOString().slice(0,10); restoreSignoff(); }
      clearTimeout(this.saveTimer); this.saveTimer=null;
      if(!(await this.flushSave())){ (window.HR&&HR.error?HR.error:alert)("Your latest changes couldn't be saved, so the review hasn't been signed. Check your connection and try again."); return; }
    }
    await this._signRpc("reviews.sign","✍ Signed — waiting for the "+other);
  },
  async withdrawSignoff(){
    if(!confirm("Withdraw your signature? The review becomes editable again, and both of you will need to sign off again.")) return;
    await this._signRpc("reviews.unsign","Signature withdrawn — the review can be edited again");
  },
  async reopenReview(){
    if(!this.isAdmin) return;
    if(!confirm("Reopen this signed-off review?\n\nBoth signatures will be cleared and the review becomes editable again. The employee and line manager will need to sign it off again.")) return;
    await this._signRpc("reviews.reopen","Review reopened");
  },

  async createReview(){
    const email=this.val("auth-new-emp");
    if(!email){ this.err("Choose the team member this review is for."); return; }
    this.err("");
    const emp=this.org.find(x=>(x.email||"").toLowerCase()===email.toLowerCase());
    const name=emp?(emp.full_name||email):email;
    const mgrEmail=emp?(emp.manager_email||""):"";
    const mgr=this.org.find(x=>(x.email||"").toLowerCase()===(mgrEmail||"").toLowerCase());
    const mgrName=mgr?(mgr.full_name||mgrEmail):mgrEmail;
    const fresh=freshState();
    fresh.meta={empName:name, empRole:"", date:"", mgrName:mgrName};
    fresh.signoff={empEmail:email, mgrEmail:mgrEmail};
    let data;
    try{ data=(await this.api("reviews.create",{ employee_email:email, state:fresh })).item; }
    catch(e){ this.err("Couldn't create the review: "+e.message); return; }
    this.items.unshift(data);
    this.openReview(data.id);
  },

  async deleteReview(id){
    const it=this.items.find(x=>String(x.id)===String(id));
    const name=(it&&(it.employee_name||it.employee_email))||"this review";
    if(!confirm('Delete "'+name+'" permanently?\nThis removes it for everyone and cannot be undone.')) return;
    this.err("");
    try{ await this.api("reviews.delete",{ id:String(id) }); }
    catch(e){ this.err("Couldn't delete: "+e.message); return; }
    if(String(this.currentId)===String(id)){ this.currentId=null; this.stopPoll(); }
    await this.loadReviews();
  },

  /* ---- state <-> UI ---- */
  applyState(obj){
    const fresh=freshState();
    Object.keys(fresh).forEach(k=>{ S[k]=fresh[k]; });
    Object.keys(obj||{}).forEach(k=>{ S[k]=obj[k]; });
    renderAll();
  },

  /* ---- saving ---- */
  scheduleSave(){ clearTimeout(this.saveTimer); this.setPill("Saving…",true);
    this.saveTimer=setTimeout(()=>{ this.saveTimer=null; this.flushSave(); },800); },
  async flushSave(){
    if(!this.currentId) return false;
    if(!this.canEditCurrent) return false;   // locked / signed — the server would refuse anyway
    S._editor=this.sessionId;
    const patch={ state:S, employee_name:(S.meta&&S.meta.empName)||"",
      review_date:(S.meta&&S.meta.date)?S.meta.date:null };
    try{
      const data=await this.api("reviews.save",Object.assign({ id:String(this.currentId) },patch));
      if(data&&data.updated_at) this._lastAppliedAt=data.updated_at;
      this.setPill("Saved ✓");
      return true;
    }catch(e){
      console.warn("Cloud save failed:",e);
      if(/signed off|locked|sign-off/i.test(e.message||"")){ this.refreshCurrent(); return false; }  // the other person just signed
      this.setPill("⚠ Not saved — "+(e.message||"check your connection"),false,true);
      return false;
    }
  },

  /* ---- live view: lightweight polling so both parties stay in sync ---- */
  startPoll(){ this.stopPoll(); this.poller=setInterval(()=>this.poll(),5000); },
  stopPoll(){ if(this.poller){ clearInterval(this.poller); this.poller=null; } },
  async poll(){
    if(!this.currentId || document.hidden) return;
    try{
      const data=(await this.api("reviews.get",{ id:String(this.currentId) })).item;
      if(!data) return;
      this.syncRow(data);
      if(data.updated_at===this._lastAppliedAt) return;
      const st=data.state||{};
      if(st._editor && st._editor===this.sessionId){ this._lastAppliedAt=data.updated_at; return; } // my own save
      const ae=document.activeElement;
      const typing = ae && (ae.tagName==="INPUT"||ae.tagName==="TEXTAREA") && !ae.closest("#auth-gate");
      if(typing || this.saveTimer){ this._pendingRemote=st; this._pendingAt=data.updated_at; this.setPill("Update available — finish typing…"); return; }
      this.applyRemote(st,data.updated_at);
    }catch(e){ /* transient/offline — try again next tick */ }
  },
  applyRemote(st,ts){
    const cur=(typeof currentSi!=="undefined")?currentSi:0;
    this.applyState(st);
    try{ showSection(cur); }catch(e){}
    if(ts) this._lastAppliedAt=ts;
    this.setPill("Updated by the other editor ✓");
  },
  async refreshCurrent(){
    if(!this.currentId) return;
    this.setPill("Refreshing…",true);
    let data=null;
    try{ data=(await this.api("reviews.get",{ id:String(this.currentId) })).item; }catch(e){}
    if(!data){ this.setPill("⚠ Couldn't refresh",false,true); return; }
    this._pendingRemote=null;
    this.updateRow(data);
    this.applyRemote(data.state||{}, data.updated_at);
    this.applyLock(data);
  },

  /* ---- org chart / reporting structure ---- */
  async loadOrg(){
    try{
      this.org=(await this.api("org.list")).members||[];
    }catch(e){ this.org=[]; }
    const me=this.org.find(m=>(m.email||"").toLowerCase()===this.myEmail);
    if(me) this.isAdmin = me.role==="admin";
  },
  refreshNewReviewOptions(){
    const sel=document.getElementById("auth-new-emp"); if(!sel) return;
    let people = this.isAdmin ? this.org.slice()
                              : this.org.filter(m=>(m.manager_email||"").toLowerCase()===this.myEmail);
    people = people.sort((a,b)=>((a.full_name||a.email)+"").localeCompare((b.full_name||b.email)+""));
    sel.innerHTML = '<option value="">'+(people.length?"Select a team member…":"No direct reports to review")+'</option>'
      + people.map(m=>'<option value="'+DB.esc(m.email)+'">'+DB.esc(m.full_name||m.email)+(m.manager_email?"":" (top)")+'</option>').join("");
  },
  openTeam(){ if(!this.isAdmin) return; this.teamErr(""); this.teamOk(""); this.showTemp(null); this.renderTeam(); document.getElementById("team-gate").classList.add("show"); },
  closeTeam(){ document.getElementById("team-gate").classList.remove("show"); },
  teamErr(m){ const e=document.getElementById("team-err"); if(e){ e.textContent=m||""; e.classList.toggle("show",!!m);} },
  teamOk(m){ const e=document.getElementById("team-ok"); if(e){ e.textContent=m||""; e.classList.toggle("show",!!m);} },
  renderTeam(){
    const byEmail={}; this.org.forEach(m=>byEmail[(m.email||"").toLowerCase()]=m);
    const sorted=this.org.slice().sort((a,b)=>((a.full_name||a.email)+"").localeCompare((b.full_name||b.email)+""));
    const mgr=document.getElementById("team-mgr");
    if(mgr){ mgr.innerHTML='<option value="">Reports to… (none = top)</option>'
      + sorted.map(m=>'<option value="'+DB.esc(m.email)+'">'+DB.esc(m.full_name||m.email)+'</option>').join(""); }
    const list=document.getElementById("team-list");
    if(!list) return;
    if(!this.org.length){ list.innerHTML='<div class="auth-empty">No one added yet.</div>'; return; }
    list.innerHTML=sorted.map(m=>{
      const mr=byEmail[(m.manager_email||"").toLowerCase()];
      const reportsTo=mr?("reports to "+(mr.full_name||mr.email)):"top of org";
      return '<div class="team-member"><div><div class="tm-name">'+DB.esc(m.full_name||m.email)+'</div>'
        +'<div class="tm-meta">'+DB.esc(m.email)+' · '+DB.esc(reportsTo)+'</div>'
        +((m.job_title||m.department)?'<div class="tm-meta">'+DB.esc([m.job_title,m.department].filter(Boolean).join(" · "))+'</div>':'')+'</div>'
        +'<div class="tm-actions">'+(m.is_ceo?'<span class="tm-role admin">CEO</span>':'')+(m.is_finance?'<span class="tm-role admin">Finance</span>':'')
        +'<span class="tm-role '+(m.role==="admin"?"admin":"member")+'">'+(m.role==="admin"?"Admin":"Member")+'</span>'
        +'<button class="tm-reset" title="Load into the form above to change name, job title, department, manager or role" onclick="DB.editMember(\''+DB.esc(m.email)+'\')">Edit</button>'
        +((m.email||"").toLowerCase()!==this.myEmail
          ?'<button class="tm-reset" title="Give this person a new one-time password" onclick="DB.resetPassword(\''+DB.esc(m.email)+'\')">'+(m.has_account===false?"Create sign-in":"Reset password")+'</button>'
           +'<button class="auth-del" title="Remove from org" onclick="DB.removeMember(\''+DB.esc(m.email)+'\')">&times;</button>':'')
        +'</div></div>';
    }).join("");
  },
  showTemp(email,pw){
    const el=document.getElementById("team-temp"); if(!el) return;
    if(!email||!pw){ el.hidden=true; el.textContent=""; return; }
    el.innerHTML='<b>One-time password for '+DB.esc(email)+'</b><br><code>'+DB.esc(pw)+'</code>'
      +'<button class="tm-reset" onclick="DB.copyTemp(this)" data-pw="'+DB.esc(pw)+'">Copy</button><br>'
      +'Give this to them in person or by phone, not by email. It works once: they choose their own password when they sign in. It is not shown again.';
    el.hidden=false;
  },
  copyTemp(btn){
    const pw=btn.getAttribute("data-pw")||"";
    if(navigator.clipboard&&navigator.clipboard.writeText){
      navigator.clipboard.writeText(pw).then(()=>{ btn.textContent="Copied"; },()=>{});
    }
  },
  editMember(email){
    const m=this.org.find(x=>(x.email||"").toLowerCase()===(email||"").toLowerCase()); if(!m) return;
    document.getElementById("team-name").value=m.full_name||"";
    document.getElementById("team-email").value=m.email||"";
    document.getElementById("team-role").value=m.role==="admin"?"admin":"member";
    document.getElementById("team-mgr").value=m.manager_email||"";
    document.getElementById("team-jobtitle").value=m.job_title||"";
    document.getElementById("team-dept").value=m.department||"";
    document.getElementById("team-finance").checked=!!m.is_finance;
    document.getElementById("team-ceo").checked=!!m.is_ceo;
    this.teamOk("Editing "+(m.full_name||m.email)+". Change the details above, then save.");
  },
  async invite(){
    if(!this.isAdmin){ this.teamErr("Admins only."); return; }
    const full_name=this.val("team-name"), email=this.val("team-email");
    const role=document.getElementById("team-role").value;
    const manager_email=document.getElementById("team-mgr").value||"";
    if(!email){ this.teamErr("Enter the person's work email."); return; }
    this.teamErr(""); this.teamOk(""); this.showTemp(null);
    let out;
    const job_title=this.val("team-jobtitle"), department=this.val("team-dept");
    const is_finance=document.getElementById("team-finance").checked, is_ceo=document.getElementById("team-ceo").checked;
    try{ out=await this.api("org.save",{ email, full_name, manager_email, role, job_title, department, is_finance, is_ceo }); }
    catch(e){ this.teamErr(e.message); return; }
    this.org=out.members||this.org;
    this.renderTeam(); this.refreshNewReviewOptions();
    ["team-name","team-email","team-jobtitle","team-dept"].forEach(id=>{ const e=document.getElementById(id); if(e) e.value=""; });
    ["team-finance","team-ceo"].forEach(id=>{ const e=document.getElementById(id); if(e) e.checked=false; });
    if(out.temporary_password){ this.teamOk("Added "+email+"."); this.showTemp(email,out.temporary_password); }
    else this.teamOk("Saved the details for "+email+".");
  },
  async resetPassword(email){
    if(!this.isAdmin) return;
    if(!confirm("Give "+email+" a new one-time password?\nTheir current password stops working and they are signed out.")) return;
    this.teamErr(""); this.teamOk(""); this.showTemp(null);
    try{ const out=await this.api("org.resetPassword",{ email }); this.showTemp(email,out.temporary_password); await this.loadOrg(); this.renderTeam(); }
    catch(e){ this.teamErr(e.message); }
  },
  async removeMember(email){
    if(!this.isAdmin) return;
    if(!confirm("Remove "+email+" from the org chart?\nThey will no longer be able to sign in. Their past reviews and forms are kept.")) return;
    try{ const out=await this.api("org.remove",{ email }); this.org=out.members||[]; }
    catch(e){ this.teamErr("Couldn't remove: "+e.message); return; }
    this.renderTeam(); this.refreshNewReviewOptions();
  },
  applyReadonly(on,msg){
    document.body.classList.toggle("ro-mode",!!on);
    const t=document.getElementById("ro-banner-text");
    if(t) t.textContent=msg||"👁 View only — you can see this review, but only the employee and their direct line manager can make changes.";
  },

  /* ---- misc UI ---- */
  showGate(){}, hideGate(){},
  setPill(text,spin,error){ const p=document.getElementById("auth-pill"),t=document.getElementById("auth-pill-text");
    if(!p) return; p.classList.add("show"); p.style.background=error?"#7f1d1d":"#1e3a5f";
    const who=(S.meta&&S.meta.empName)?(" · "+S.meta.empName):"";
    t.innerHTML=(spin?'<span class="auth-spin"></span> ':'')+DB.esc(text+who); },
  err(m){ const e=document.getElementById("auth-err");
    if(!e){ if(m && typeof toast==="function") toast(m); return; }
    e.textContent=m||""; e.classList.toggle("show",!!m); },
  ok(m){ const e=document.getElementById("auth-ok"); if(!e) return;
    e.textContent=m||""; e.classList.toggle("show",!!m); },
  val(id){ const el=document.getElementById(id); return el?(el.value||"").trim():""; },
  esc(s){ return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;"); }
};

/* Repaint the whole UI from S (used after loading/switching a shared review). */
function renderAll(){
  [initResponses,buildSidebar,buildHome,buildSections,buildCfoKpis,restoreCfoNote,restoreMeta,restoreSignoff,loadPrep]
    .forEach(fn=>{try{fn();}catch(e){console.warn(e);}});
  try{const ce=document.getElementById("mgr-commitment");if(ce)ce.value=S.mgrCommitment||"";}catch(e){}
  try{["prep-q1","prep-q2","prep-q3"].forEach((id,i)=>{const el=document.getElementById(id);if(el)el.value=(S.prep&&S.prep["q"+(i+1)])||"";});}catch(e){}
  try{showSection(0);}catch(e){}
  try{if(S.ratings&&S.ratings["kpi"]){const kr=S.ratings["kpi"];document.querySelectorAll(".kpi-star").forEach((st,i)=>{st.style.color=i<kr.stars?"var(--amber)":"#e5e7eb";});const kn=document.getElementById("kpi-rating-note");if(kn)kn.value=kr.note||"";}}catch(e){}
  try{if(S.qtrs){Object.entries(S.qtrs).forEach(([k,v])=>{const el=document.getElementById("qtr-"+k);if(el&&v){el.textContent=v==="pass"?"✓":"✗";el.style.color="var(--ink)";el.style.borderColor=v==="pass"?"#6ee7b7":"#fca5a5";}});}}catch(e){}
}

/* A complete blank review object (matches the app's state shape). */
function freshState(){
  return { ratings:{}, wb:{}, trendHistory:[], prev:{}, prevRatings:{}, responses:{},
    qsliders:{}, qratings:{}, qtrs:{}, cfo:{}, cfoNote:"",
    actions:[{text:"",owner:"",ownerType:"",date:"",source:"",status:"open"}],
    meta:{empName:"",empRole:"",date:"",mgrName:""}, signoff:{},
    carryForward:[], mgrCommitment:"", prep:{}, reflSelf:{}, rc:{}, reflNote:"" };
}

/* Route every save to the server when a review is open and you can edit it.
   With no review open there is nothing to save. */
saveState = function(){
  if(window.DB && DB.currentId && DB.canEditCurrent) DB.scheduleSave();
};

/* Apply any deferred live update once the user stops editing a field. */
document.addEventListener("focusout", function(){
  setTimeout(function(){
    if(window.DB && DB.mode==="cloud" && DB._pendingRemote && !DB.saveTimer){
      var ae=document.activeElement;
      var typing = ae && (ae.tagName==="INPUT"||ae.tagName==="TEXTAREA") && !ae.closest("#auth-gate");
      if(!typing){ var st=DB._pendingRemote, ts=DB._pendingAt; DB._pendingRemote=null; DB.applyRemote(st,ts); }
    }
  },300);
});

/* Start once the page has loaded (hr.js defines showTab). */
window.addEventListener("DOMContentLoaded", function(){ DB.init(); });
