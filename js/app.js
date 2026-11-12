/* js/app.js — actions, the delegated event handlers, and startup (render). Loaded last.
   Plain script, no IIFE: the app's files share the global scope and index.html loads them in a fixed order
   (i18n → model → teachers → data → views → excel → app). Code that runs at load may only use earlier files. */

/* ---------- actions (pure-ish rules) ---------- */
var CYCLE={none:"online",online:"late",present:"late",late:"absent",absent:"none"};
function setAtt(sid,st,note){
  var k=akey(state.date,state.classId,sid), prev=db.attendance[k]||{};
  var n = note!=null ? note : (prev.note||"");
  if (st==="none" && !n && !expectedStatus(state.date,state.classId,sid)) delete db.attendance[k]; else db.attendance[k]={status:st,note:n,at:Date.now()};
}
function startGb(){
  var d=state.date, cid=state.classId;
  var players=rosterOf(db,cid,d).filter(function(s){ return isPlayerStatus(attStatus(d,cid,s.id)); }).map(function(s){return s.id;});
  if (!players.length) return;
  var id=uid("g");
  db.gbSessions[id]={id:id,classId:cid,date:d,status:"active",playerIds:players,joinedAt:{},seats:seatingOn()?visibleSeats(seatingFor(cid,d).map,cid,d):{},layout:seatingOn()?seatingFor(cid,d).layout:"4x3",teacher:seatingFor(cid,d).teacher,questionCount:1,currentQ:1,startedAt:Date.now()};
  db.gbQuestions[qkey(id,1)]={phase:"first"};
  state.sessionId=id; state.q=1; state.view="gb"; persist();
}
var lastTap={sid:null,t:0};
function isDouble(sid){ var now=Date.now(), d=(lastTap.sid===sid && now-lastTap.t<DOUBLE_MS); lastTap = d ? {sid:null,t:0} : {sid:sid,t:now}; return d; }
var GB_CYCLE={"":"◎","◎":"O","O":"△","△":"X","X":""};
function gbTap(sid){
  var s=db.gbSessions[state.sessionId], q=state.q, ph=db.gbQuestions[qkey(s.id,q)].phase;
  if (ph==="closed") return false;
  var k=mkey(s.id,q,sid), m=db.gbMarks[k], mk=(m&&m.mark)||"", cm=m?m.comment:"";
  var next = mk in GB_CYCLE ? GB_CYCLE[mk] : "";
  if (!next && !cm) delete db.gbMarks[k];
  else { db.gbMarks[k]={mark:next||null,phase:"first",comment:cm,overridden:false}; if (next) db.gbMarks[k].at=(mk&&m.at)||Date.now(); }   // at: first marked on this question (kept while cycling; cleared with 미표시) → tie-break
  return true;
}
function qHasMarks(s,q){ var pre=s.id+"_"+q+"_"; return Object.keys(db.gbMarks).some(function(k){ var m=db.gbMarks[k]; return k.indexOf(pre)===0 && (m.mark||m.comment); }); }
// 골든벨 리셋: deletes this class's Golden Bell for this one date (session, questions, marks, comments) and starts a fresh one at Q1
// from the current attendance and seating. Other classes and dates, attendance, 숙제 and 자리배치 are not touched.
function resetGb(s){
  if (!s) return;
  sessionsOf(s.classId,s.date).forEach(function(g){
    ["gbQuestions","gbMarks"].forEach(function(col){ Object.keys(db[col]).forEach(function(k){ if (k.indexOf(g.id+"_")===0) delete db[col][k]; }); });
    delete db.gbSessions[g.id];
  });
  state.confirm=null; state.sheet=null; state.expanded={}; state.classId=s.classId; state.date=s.date;
  startGb();   // sets view "gb" at Q1 when someone can play
  if (state.view==="gb" && db.gbSessions[state.sessionId]){ save(t("gbResetDone")); }
  else { state.view="class"; state.sessionId=null; save(t("gbResetNoPlayers")); }
  render(); window.scrollTo(0,0);
}
function endSession(s){
  // the auto-opened next question is dropped if nothing was recorded on it
  if (s.questionCount>1 && !qHasMarks(s,s.currentQ)){ delete db.gbQuestions[qkey(s.id,s.currentQ)]; s.questionCount--; s.currentQ=s.questionCount; }
  else closeQuestion(s,s.currentQ);
  s.status="ended"; s.endedAt=Date.now(); state.confirm=null; state.view="results"; state.expanded={}; save(); render(); window.scrollTo(0,0);
}
function closeQuestion(s,q){   // closing only locks the question; unmarked students stay unmarked (미표시)
  db.gbQuestions[qkey(s.id,q)].phase="closed";
}

app.addEventListener("click",function(ev){
  if (suppressClick){ suppressClick=false; ev.preventDefault(); return; }
  var el=ev.target.closest("[data-act]"); if (!el) return;
  var a=el.getAttribute("data-act"), s;
  switch(a){
    case "pinOpen": state.pin=""; state.pinErr=false; state.confirm=null; state.sheet={kind:"pin"}; render(); break;
    case "pinKey": pinPress(el.getAttribute("data-k")); break;
    case "pinDel": pinPress("del"); break;
    case "go": if (el.getAttribute("data-view")!=="pick") state.pickUnlocked=false; state.view=el.getAttribute("data-view"); state.confirm=null; state.sheet=null; state.seatSel=null; render(); window.scrollTo(0,0); break;
    case "lang": locale=locale==="ko"?"en":"ko"; store.set(LOCALE_KEY,locale); render(); break;
    case "shift": {
      var dir=+el.getAttribute("data-n"), sc=state.view==="class"?classById(state.classId):null;
      var nd=sc ? stepLesson(sc,state.date,dir) : addDays(state.date,dir);   // class page: jump to the class's prev/next lesson
      if (nd){ state.date=nd; state.sheet=null; state.seatSel=null; render(); }
      break;
    }
    case "setDate": state.date=el.getAttribute("data-date"); state.seatSel=null; render(); break;
    case "goToday": state.date=todayIso(); state.seatSel=null; render(); break;
    case "openClass": state.classId=el.getAttribute("data-cid"); state.view="class"; state.seatSel=null; render(); window.scrollTo(0,0); break;
    case "hw": { var hs=el.getAttribute("data-sid"); hwSet(state.date,state.classId,hs,!hwGet(state.date,state.classId,hs).h); save(); render(); break; }
    case "hwK": { var ks=el.getAttribute("data-sid"), kk=el.getAttribute("data-k"), kx=hwGet(state.date,state.classId,ks), np=kx.p, nr=kx.r; if (kk==="p") np=!np; else nr=!nr; hwWrite(state.date,state.classId,ks,np,nr); save(); render(); break; }
    case "hwSheetK": { var ta6=document.getElementById("hwNoteInput"); if (ta6) state.sheet.note=ta6.value; var k6=el.getAttribute("data-k"); state.sheet[k6]=!state.sheet[k6]; render(); break; }
    case "hwNote": { var ns=el.getAttribute("data-sid"), nx0=hwGet(state.date,state.classId,ns); state.sheet={kind:"hwNote",sid:ns,on:nx0.h,p:nx0.p,r:nx0.r,note:nx0.note}; render(); var ti=document.getElementById("hwNoteInput"); if (ti) ti.focus(); break; }
    case "hwSheetSet": { var ta3=document.getElementById("hwNoteInput"); if (ta3) state.sheet.note=ta3.value; state.sheet.on=el.getAttribute("data-on")==="1"; render(); break; }
    case "hwQuick": { var ta4=document.getElementById("hwNoteInput"), qv=el.getAttribute("data-q"), cur4=(ta4?ta4.value:state.sheet.note).trim();
      state.sheet.note = cur4 ? (cur4.indexOf(qv)>=0 ? cur4 : cur4+", "+qv) : qv; render(); var tb=document.getElementById("hwNoteInput"); if (tb){ tb.focus(); tb.setSelectionRange(tb.value.length,tb.value.length); } break; }
    case "hwSaveNote": { var ta5=document.getElementById("hwNoteInput"); var nt5=ta5?ta5.value.trim():state.sheet.note.trim(); if (hwTwo()) hwWrite(state.date,state.classId,state.sheet.sid,state.sheet.p,state.sheet.r,nt5); else hwSet(state.date,state.classId,state.sheet.sid,state.sheet.on,nt5); state.sheet=null; save(); render(); break; }
    case "hwAll": { var live=rosterOf(db,state.classId,state.date).filter(function(s){ return hwEligible(state.date,state.classId,s.id); });   // 등원 + 지각 students only
      var allOn=live.length>0 && live.every(function(s){ return hwGet(state.date,state.classId,s.id).done; });
      live.forEach(function(s){ hwSet(state.date,state.classId,s.id,!allOn); }); save(); render(); break; }
    case "expConfirm": { rosterOf(db,state.classId,state.date).forEach(function(s){ if (isExpected(state.date,state.classId,s.id)) setAtt(s.id,attStatus(state.date,state.classId,s.id)); }); save(t("expDone")); render(); break; }
    case "cycle": { var sid=el.getAttribute("data-sid"); if (isDouble(sid)) setAtt(sid,"present"); else setAtt(sid,CYCLE[attStatus(state.date,state.classId,sid)]); save(); render(); break; }
    case "markAll": rosterOf(db,state.classId,state.date).forEach(function(x){ if (attStatus(state.date,state.classId,x.id)==="none") setAtt(x.id,"present"); }); save(); render(); break;
    case "sheetAtt": { // choosing a state saves (with any typed note) and closes the sheet
      var ta=document.getElementById("noteInput");
      setAtt(state.sheet.sid, el.getAttribute("data-st"), ta ? ta.value.trim() : state.sheet.note);
      state.sheet=null; save(); render(); break;
    }
    case "saveAtt": { var ta2=document.getElementById("noteInput"); setAtt(state.sheet.sid,state.sheet.st,ta2?ta2.value.trim():""); state.sheet=null; save(); render(); break; }
    case "closeSheet": state.sheet=null; render(); break;
    case "gbStart": if (!sessionsOf(state.classId,state.date).length) startGb(); render(); window.scrollTo(0,0); break;
    case "openSession": {
      s=db.gbSessions[el.getAttribute("data-id")]; state.sessionId=s.id;
      if (s.status==="active"){ state.q=s.currentQ; state.view="gb"; } else { state.view="results"; state.expanded={}; }
      render(); window.scrollTo(0,0); break;
    }
    case "resume": s=db.gbSessions[state.sessionId]; state.q=s.currentQ; state.view="gb"; render(); window.scrollTo(0,0); break;
    case "qnav": { s=db.gbSessions[state.sessionId]; var nq=state.q+(+el.getAttribute("data-n")); if (nq>=1&&nq<=s.questionCount){ state.q=nq; state.confirm=null; render(); } break; }
    case "toCurrent": state.q=db.gbSessions[state.sessionId].currentQ; render(); break;
    case "gbTap": if (gbTap(el.getAttribute("data-sid"))){ save(); render(); } break;
    case "phase": db.gbQuestions[qkey(state.sessionId,state.q)].phase=el.getAttribute("data-to"); save(t("ph_"+el.getAttribute("data-to"))); render(); break;
    case "closeQ": {   // closing a question immediately opens the next one
      s=db.gbSessions[state.sessionId]; var cl=state.q; closeQuestion(s,cl);
      s.questionCount++; s.currentQ=s.questionCount; db.gbQuestions[qkey(s.id,s.currentQ)]={phase:"first"}; state.q=s.currentQ;
      save(t("nextStarted",{a:cl,b:s.currentQ})); render(); window.scrollTo(0,0); break;
    }
    case "nextQ": { s=db.gbSessions[state.sessionId]; s.questionCount++; s.currentQ=s.questionCount; db.gbQuestions[qkey(s.id,s.currentQ)]={phase:"first"}; state.q=s.currentQ; persist(); render(); window.scrollTo(0,0); break; }
    case "askEndGb": s=db.gbSessions[state.sessionId]; if (qHasMarks(s,s.currentQ)){ state.confirm="endGb"; render(); } else endSession(s); break;
    case "endGbDo": endSession(db.gbSessions[state.sessionId]); break;
    case "cancelConfirm": state.confirm=null; render(); break;
    case "askResetGb": state.confirm="resetGb"; state.sheet=null; render(); break;
    case "resetGbDo": resetGb(db.gbSessions[state.sessionId]); break;
    case "addPlayerOpen": state.sheet={kind:"addPlayer"}; render(); break;
    case "addPlayer": state.sheet={kind:"addPlayer",pick:el.getAttribute("data-sid")}; if (seatingOn()){ render(); break; }
    // falls through: without seating, picking the student adds them right away
    case "addPlayerSeat": {
      s=db.gbSessions[state.sessionId]; var aid=state.sheet.pick, idx=seatingOn()?el.getAttribute("data-idx"):"";
      s.playerIds.push(aid); s.joinedAt=s.joinedAt||{}; s.joinedAt[aid]=s.currentQ;
      var ak=akey(s.date,s.classId,aid), pa=db.attendance[ak]||{};
      db.attendance[ak]={status:"late",note:pa.note||"",at:Date.now()};            // a late joiner is marked 지각 in attendance
      if (idx!==""){
        s.seats=s.seats||{}; s.seats[idx]=aid;
        var sfa=seatingFor(s.classId,s.date), full=sfa.map; Object.keys(full).forEach(function(i){ if (full[i]===aid) delete full[i]; });
        full[idx]=aid; db.seating[seatKey(s.date,s.classId)]={layout:s.layout||sfa.layout,seats:full,teacher:s.teacher||sfa.teacher};
      }
      state.sheet=null; save(t("added",{name:studentById(aid).name})); render(); break;
    }
    case "cell": openGbSheet(+el.getAttribute("data-q"), el.getAttribute("data-sid")); break;
    case "toggleRow": { var rid=el.getAttribute("data-sid"); state.expanded[rid]=!state.expanded[rid]; render(); break; }
    case "sheetMark": { var c2=document.getElementById("cmInput"); if (c2) state.sheet.comment=c2.value; state.sheet.mark=el.getAttribute("data-m"); render(); break; }
    case "saveGb": {
      s=db.gbSessions[state.sessionId]; var sh=state.sheet, k=mkey(s.id,sh.q,sh.st), orig=db.gbMarks[k];
      var cm=(document.getElementById("cmInput")||{value:""}).value.trim(), mk=sh.mark||null;
      var qph=(db.gbQuestions[qkey(s.id,sh.q)]||{}).phase||"closed";
      var changed=(orig&&orig.mark||null)!==mk;
      if (!mk && !cm) delete db.gbMarks[k];
      else { db.gbMarks[k]={mark:mk,phase:(orig&&orig.mark&&!changed)?orig.phase:qph,comment:cm,overridden:changed?(!!mk):(orig?!!orig.overridden:false)};
        var at0=mk ? (orig&&orig.mark ? orig.at : Date.now()) : null; if (at0) db.gbMarks[k].at=at0; }   // editing a mark keeps its original time
      state.sheet=null; save(); render(); break;
    }
    /* ----- 자리배치 출석 (seat screen on the class page) ----- */
    case "saChip": { var cs=el.getAttribute("data-sid"); state.seatSel = (state.seatSel&&state.seatSel.sid===cs&&state.seatSel.from==null) ? null : {sid:cs,from:null}; render(); break; }
    case "saCancel": state.seatSel=null; render(); break;
    case "saSet": {   // unseated student → 온라인 / 결석 / 미체크 (stays unseated)
      if (!state.seatSel) break;
      var ss=state.seatSel.sid, fS=seatingFor(state.classId,state.date), stale=false;
      Object.keys(fS.map).forEach(function(i){ if (fS.map[i]===ss){ delete fS.map[i]; stale=true; } });   // drop a hidden leftover seat
      setAtt(ss,el.getAttribute("data-st"));
      if (stale) seatWrite(fS.map); else { state.seatSel=null; save(); }
      render(); break;
    }
    case "saClose": {   // 마감: unseated students with no status → 결석; 온라인 (and everything else) stays
      var nC=0; rosterOf(db,state.classId,state.date).forEach(function(x){ if (attStatus(state.date,state.classId,x.id)==="none"){ setAtt(x.id,"absent"); nC++; } });
      state.seatSel=null; if (nC) save(t("saClosed",{n:nC})); else toast(t("saCloseNone")); render(); break;
    }
    case "saMove": {   // from the long-press sheet: pick the student up, the next seat tap puts them down (status and memo kept)
      var mv=el.getAttribute("data-sid"), mi=seatIdxOf(state.classId,state.date,mv);
      state.sheet=null; state.seatSel = mi!=null ? {sid:mv,from:mi} : null; render(); break;
    }
    case "saSeat": {
      var ix=el.getAttribute("data-idx"), cd=state.date, cc=state.classId, fullS=seatingFor(cc,cd).map, visS=visibleSeats(fullS,cc,cd), occS=visS[ix]||null, selS=state.seatSel;
      if (selS && selS.from!=null){   // moving a seated student: empty seat → move, taken seat → swap, same seat → cancel
        if (selS.from!==ix){
          Object.keys(fullS).forEach(function(i){ if (fullS[i]===selS.sid) delete fullS[i]; });
          if (occS) fullS[selS.from]=occS;
          fullS[ix]=selS.sid; seatWrite(fullS);
        } else state.seatSel=null;
        render(); break;
      }
      if (occS){   // tap a seated student: 등원 → 지각 → 미체크 (seat freed, back to the list)
        if (attStatus(cd,cc,occS)==="present"){ setAtt(occS,"late"); state.seatSel=null; save(); }
        else { delete fullS[ix]; setAtt(occS,"none"); seatWrite(fullS); }
        render(); break;
      }
      if (!selS) break;   // empty seat with nobody selected
      var stN=seatStatusFor(classById(cc),cd,selS.sid);
      Object.keys(fullS).forEach(function(i){ if (fullS[i]===selS.sid) delete fullS[i]; });
      fullS[ix]=selS.sid; setAtt(selS.sid,stN); seatWrite(fullS);   // one save: seating + attendance
      render(); break;
    }
    case "openSeat": state.view="seat"; state.seatSel=null; state.confirm=null; render(); window.scrollTo(0,0); break;
    case "seatTray": { var ts=el.getAttribute("data-sid"); state.seatSel = (state.seatSel&&state.seatSel.sid===ts) ? null : {sid:ts,from:null}; render(); break; }
    case "seatCell": {
      var idx=el.getAttribute("data-idx"), full=seatingFor(state.classId,state.date).map, vis=visibleSeats(full,state.classId,state.date), occ=vis[idx]||null, sel=state.seatSel;
      if (!sel){ if (occ){ state.seatSel={sid:occ,from:idx}; render(); } break; }
      if (sel.from===idx){ state.seatSel=null; render(); break; }
      Object.keys(full).forEach(function(i){ if (full[i]===sel.sid) delete full[i]; });
      if (occ && sel.from!=null) full[sel.from]=occ;   // swap two seated students
      full[idx]=sel.sid;                                // an unseated occupant (if any) returns to the tray
      seatWrite(full); render(); break;
    }
    case "unseat": { var f2=seatingFor(state.classId,state.date).map, us=state.seatSel.sid; Object.keys(f2).forEach(function(i){ if (f2[i]===us) delete f2[i]; }); seatWrite(f2); render(); break; }
    case "layout": {
      var nl=el.getAttribute("data-l"), sf2=seatingFor(state.classId,state.date);
      if (nl===sf2.layout) break;
      if (Object.keys(visibleSeats(sf2.map,state.classId,state.date)).length){ state.confirm="layout:"+nl; render(); break; }
      seatWrite({},nl); render(); break;
    }
    case "seatView": store.set(SEAT_VIEW_KEY,el.getAttribute("data-v")); render(); break;
    case "teacherSide": {   // always allowed; never clears seats. Also follows into a 골든벨 running for this lesson.
      var side=el.getAttribute("data-side"), sfT=seatingFor(state.classId,state.date);
      if (side===sfT.teacher) break;
      seatWrite(sfT.map,sfT.layout,side);
      Object.keys(db.gbSessions).forEach(function(k){ var g=db.gbSessions[k]; if (g.classId===state.classId && g.date===state.date && g.status==="active") g.teacher=side; });
      persist(); render(); break;
    }
    case "layoutDo": state.confirm=null; seatWrite({},el.getAttribute("data-l")); render(); break;
    case "askClearSeats": state.confirm="clearSeats"; render(); break;
    case "clearSeatsDo": state.confirm=null; seatWrite({}); render(); break;
    case "exportFmt": { state.sheet.fmt=el.getAttribute("data-f"); if (state.sheet.fmt==="log" && state.sheet.preset==="month"){ var rt=presetRange("today"); state.sheet.preset="today"; state.sheet.start=rt[0]; state.sheet.end=rt[1]; } render(); break; }
    case "exportOpen": { var pr=presetRange("today"); state.sheet={kind:"export",fmt:"log",preset:"today",start:pr[0],end:pr[1],classes:{},seating:false,busy:false}; render(); break; }
    case "exportPreset": { var pp=el.getAttribute("data-p"); state.sheet.preset=pp; if (pp!=="custom"){ var r3=presetRange(pp); state.sheet.start=r3[0]; state.sheet.end=r3[1]; } render(); break; }
    case "exportRun": runExport(); break;
    case "askReset": state.confirm="reset"; render(); break;
    case "pickTeacher": T=teacherById(el.getAttribute("data-tid")); store.set(TEACHER_KEY,T.id); state={view:"home",date:state.date,classId:null,sessionId:null,q:1,sheet:null,confirm:null,expanded:{},seatSel:null}; render(); window.scrollTo(0,0); break;
    case "settingsOpen": state.sheet={kind:"settings"}; state.confirm=null; render(); break;
    case "setOpt": { var ok=el.getAttribute("data-k"), ov=el.getAttribute("data-v"); db.settings[T.id]=db.settings[T.id]||{}; db.settings[T.id][ok]= ok==="seating" ? (ov==="att" ? "att" : ov==="on") : ov; state.seatSel=null; save(); render(); break; }   // seating: false 끄기 · true 켜기 · "att" 자리배치 출석
    case "backupSave": backupSave(); break;
    case "restoreDo": {
      var cf=state.confirm; if (!cf) break;
      if (cf.kind==="legacy"){
        var before=JSON.stringify(db);
        try { var res=importLegacy({legacy:cf.legacy,db:cf.data}); state.confirm=null; state.sheet=null; if (persist()) toast(t("legacyDone",{name:res.teacher.name,n:res.n})); }
        catch(e){ db=JSON.parse(before); state.confirm=null; toast(t("backupBad")); }
      } else {
        db=Object.assign(emptyDb(),JSON.parse(JSON.stringify(cf.data))); TEACHERS.forEach(function(x){ mergeTeacher(db,x); });
        state.confirm=null; state.sheet=null; save(t("restoreDone"));
      }
      render(); break;
    }
    case "restoreMerge": {
      var cm=state.confirm; if (!cm || cm.kind!=="restore") break;
      var before2=JSON.stringify(db), nm=0;
      try { nm=mergeBackup(JSON.parse(JSON.stringify(cm.data))); state.confirm=null; state.sheet=null; if (persist()) toast(nm?t("mergeDone",{n:nm}):t("mergeNone")); }
      catch(e){ db=JSON.parse(before2); state.confirm=null; toast(t("backupBad")); }
      render(); break;
    }
    case "resetDo": wipeTeacher(db,T.id); mergeTeacher(db,T); state={view:"home",date:todayIso(),classId:null,sessionId:null,q:1,sheet:null,confirm:null,expanded:{},seatSel:null}; save(t("resetDone")); render(); break;
  }
});
function openGbSheet(q,sid){
  var m=getMark(state.sessionId,q,sid);
  state.sheet={kind:"gb",q:q,st:sid,mark:m&&m.mark?m.mark:"",comment:m&&m.comment?m.comment:""};
  render();
}
app.addEventListener("change",function(ev){
  if (state.sheet && state.sheet.kind==="export"){
    var sh=state.sheet, el2=ev.target;
    if (el2.id==="exStart" && el2.value) sh.start=el2.value;
    else if (el2.id==="exEnd" && el2.value) sh.end=el2.value;
    else if (el2.id==="exSeat") sh.seating=el2.checked;
    else if (el2.hasAttribute("data-exc")) sh.classes[el2.getAttribute("data-exc")]=el2.checked;
    else return;
    render(); return;
  }
  if (ev.target.id==="backupFile" && ev.target.files && ev.target.files[0]){ var bf=ev.target.files[0]; ev.target.value=""; backupLoad(bf); return; }
  if (ev.target.id==="datePick" && ev.target.value){ state.date=ev.target.value; state.sheet=null; state.seatSel=null; render(); }
});
document.addEventListener("keydown",function(ev){
  if (state.sheet && state.sheet.kind==="pin"){ if (/^[0-9]$/.test(ev.key)){ pinPress(ev.key); return; } if (ev.key==="Backspace"){ pinPress("del"); return; } }
  if (ev.key==="Escape" && state.sheet){ state.sheet=null; render(); } });

/* long-press on tiles → sheet */
// The press is cancelled when the finger moves (PRESS_MOVE_PX) or the page scrolls, so a scroll that starts on a tile never opens
// a sheet. suppressClick only swallows the click that ends the long-press itself: every new touch clears it, so the next tap
// always registers.
var pressTimer=null, suppressClick=false, pressAt=null, PRESS_MOVE_PX=10;
app.addEventListener("pointerdown",function(ev){
  suppressClick=false;
  var tile=ev.target.closest("button.tile"); if (!tile) return;   // 숙제 tiles: tap only
  clearTimeout(pressTimer); pressAt={x:ev.clientX,y:ev.clientY};
  pressTimer=setTimeout(function(){
    var sid=tile.getAttribute("data-sid");
    if (state.view==="class") state.sheet={kind:"att",sid:sid,st:attStatus(state.date,state.classId,sid),note:attNote(state.date,state.classId,sid)};
    else if (state.view==="gb"){ openGbSheet(state.q,sid); suppressClick=true; setTimeout(function(){suppressClick=false;},700); return; }
    else return;
    suppressClick=true; render();
    setTimeout(function(){ suppressClick=false; },700);
  },450);
});
["pointerup","pointercancel","pointerleave"].forEach(function(n){ app.addEventListener(n,function(){ clearTimeout(pressTimer); }); });
app.addEventListener("pointermove",function(ev){ if (pressAt && (Math.abs(ev.clientX-pressAt.x)>PRESS_MOVE_PX || Math.abs(ev.clientY-pressAt.y)>PRESS_MOVE_PX)){ clearTimeout(pressTimer); pressAt=null; } });
window.addEventListener("scroll",function(){ clearTimeout(pressTimer); pressAt=null; },{passive:true,capture:true});
app.addEventListener("contextmenu",function(ev){ if (ev.target.closest(".tile")) ev.preventDefault(); });

// Another tab (or, later, another device via the storage adapter) changed the records: reload and redraw.
// Shared storage: the records in memory are always replaced at once (the next save must not write stale ones back), but an
// open sheet is left alone so a memo being typed is not lost; the page redraws when the sheet closes.
store.onRemoteChange(STORE_KEY,function(){
  db=load();
  if (store.shared){ if (!state.sheet) render(); return; }
  state.confirm=null; render(); toast(t("remoteReload"));
});
// "저장 중 / 저장 안 됨": shown only while changes have not reached shared storage yet.
function syncBadge(s){
  var el=document.getElementById("sync"); if (!el) return;
  if (!s || !s.pending){ el.hidden=true; return; }
  el.hidden=false; el.className=s.state==="failed"?"failed":""; el.textContent=t(s.state==="failed"?"syncFailed":"syncSaving",{n:s.pending});
}
if (store.shared){
  store.onStatus(syncBadge); syncBadge(store.status());
  store.onImported(function(n){ toast(t("syncImported",{n:n})); });
  store.ready().then(function(){ db=load(); if (!state.sheet) render(); });   // the first pull may have finished before this file loaded
}

// 자리배치 출석: keep the status line (등원 / 지각 rule and the Seoul clock) current while the class page is open.
// Only those two elements are replaced, so a touch in progress and the scroll position are left alone.
var SEAT_RULE_REFRESH_MS=15000;
setInterval(function(){
  if (state.view!=="class" || !T || !seatAttOn()) return;
  var c=classById(state.classId), rule=document.getElementById("saRule"), help=document.getElementById("saHelp");
  if (!c || !rule) return;
  rule.outerHTML=seatRuleHtml(c,state.date);
  if (help) help.innerHTML=seatHelpInner(c,state.date);
},SEAT_RULE_REFRESH_MS);

render();
if (!store.ok) toast(t("storageOff"));
