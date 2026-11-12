/* js/views.js — UI state, toast, and the views (home, class, seat, 골든벨, results, picker, settings), render()
   Plain script, no IIFE: the app's files share the global scope and index.html loads them in a fixed order
   (i18n → model → teachers → data → views → excel → app). Code that runs at load may only use earlier files. */

/* ---------- UI state ---------- */
var state={view:"home",date:todayIso(),classId:null,sessionId:null,q:1,sheet:null,confirm:null,expanded:{},seatSel:null};
var app=document.getElementById("app");
var toastTimer;
function toast(msg){ var el=document.getElementById("toast"); el.textContent=msg; el.classList.add("show"); clearTimeout(toastTimer); toastTimer=setTimeout(function(){el.classList.remove("show");},1400); }

var CAL='<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 17.2h.01M12 17.2h.01" stroke-width="2.6"/></svg>';

function topbar(backView){
  var left = backView ? '<button class="back" data-act="go" data-view="'+backView+'"><span>‹</span>'+t("back")+'</button>' : '<span class="brand">'+(T?esc(T.name)+' '+t("teacherSuffix"):t("appName"))+'</span>';
  var right = CONFIG.ENABLE_LANG_TOGGLE ? '<button class="langbtn" data-act="lang" aria-label="Language">'+t("langBtn")+'</button>' : '';
  return '<header class="top"><div class="top-in">'+left+right+'</div></header>';
}
function dateNav(){
  var isToday=state.date===todayIso(), c=state.view==="class"?classById(state.classId):null;
  var prev=c?stepLesson(c,state.date,-1):"x", next=c?stepLesson(c,state.date,1):"x";
  return '<div class="datenav">'+
    '<button class="navbtn" data-act="shift" data-n="-1" aria-label="'+(c?t("prevLesson"):t("prevDay"))+'"'+(prev?'':' disabled')+'>‹</button>'+
    '<div class="datelabel"><span class="date">'+fmtDate(state.date)+'</span>'+
      (isToday?'<span class="todaypill">'+t("today")+'</span>':'<button class="linkbtn" data-act="goToday">'+t("today")+'</button>')+'</div>'+
    '<button class="navbtn" data-act="shift" data-n="1" aria-label="'+(c?t("nextLesson"):t("nextDay"))+'"'+(next?'':' disabled')+'>›</button>'+
    '<label class="calbtn" aria-label="'+t("pickDate")+'">'+CAL+'<input type="date" id="datePick" value="'+state.date+'"></label>'+
  '</div>';
}

/* ---------- S1 class list ---------- */
function classCard(c,scheduled){
  var r=rosterOf(db,c.id,state.date), tot=r.length;
  var chk=r.filter(function(s){return attStatus(state.date,c.id,s.id)!=="none";}).length;
  var lab,cls;
  if (!tot){ lab=c.rosterPending?t("rosterPending"):t("noStudents"); cls="empty"; }
  else if (chk===tot){ lab=t("done"); cls="done"; }
  else if (!chk){ lab=scheduled?t("notStarted"):t("notToday"); cls=scheduled?"todo":"off"; }
  else { lab=t("remaining",{n:tot-chk}); cls="part"; }
  return '<li><button class="card'+(scheduled?'':' off')+'" data-act="openClass" data-cid="'+c.id+'">'+
    '<span class="ctime">'+c.time+'</span>'+
    '<span class="cmain"><span class="cname">'+esc(c.name)+(c.levelup?' <span class="lvtag">'+t("levelup")+'</span>':c.sub?' <span class="lvtag">'+t("subTag")+'</span>':roleTag(c,state.date))+'</span><span class="cmeta">'+daysLabel(c.days)+' · '+t("students",{n:tot})+'</span></span>'+
    '<span class="cstat st-'+cls+'">'+lab+'</span>'+
    '<span class="bar"><i style="width:'+(tot?Math.round(chk/tot*100):0)+'%"></i></span>'+
  '</button></li>';
}
function viewHome(){
  var dow=wd(state.date);
  var list=myClasses().filter(function(c){ return c.days.indexOf(dow)>=0 && (!c.start || c.start<=state.date) && (!c.end || state.date<=c.end); }).sort(function(a,b){ return a.time.localeCompare(b.time); });   // only this day's classes
  var h=topbar(null)+'<main class="wrap">'+dateNav()+'<h2 class="sec">'+t("classes")+'</h2>';
  if (list.length) h+='<ul class="cards">'+list.map(function(c){ return classCard(c,true); }).join("")+'</ul>';
  else {
    var nx=null; for (var i=1;i<=7 && !nx;i++){ var x=addDays(state.date,i); if (myClasses().some(function(c){return c.days.indexOf(wd(x))>=0 && (!c.end || x<=c.end);})) nx=x; }
    h+='<p class="hint">'+t("noClassDay")+'</p>'+(nx?'<button class="btn block" data-act="setDate" data-date="'+nx+'">'+t("nextClassDay")+' · '+fmtDate(nx)+'</button>':'');
  }
  h+='<button class="btn outline block" data-act="exportOpen">📊 '+t("exportBtn")+'</button>';
  h+='<div class="foot"><span>'+t(store.shared?"sharedNote":"localNote")+'</span><button class="linkbtn" data-act="settingsOpen">⚙ '+t("settings")+'</button></div>';
  h+='</main>';
  if (state.sheet && state.sheet.kind==="export") h+=exportSheet();
  if (state.sheet && state.sheet.kind==="settings") h+=settingsSheet();
  if (state.sheet && state.sheet.kind==="pin") h+=pinSheet();
  return h;
}

/* ---------- S2 attendance ---------- */
function viewClass(){
  var c=classById(state.classId); if (!c){ state.view="home"; return viewHome(); }
  var d=state.date, r=rosterOf(db,c.id,d), today=todayIso();
  if (!isLessonDay(c,d)){   // reached by the calendar or "오늘" on a day this class doesn't meet
    var pv=stepLesson(c,d,-1), nx=stepLesson(c,d,1);
    return topbar("home")+'<main class="wrap">'+dateNav()+
      '<div class="classhead"><h1><span class="t">'+c.time+'</span>'+esc(c.name)+'</h1></div><p class="hint">'+t("noLessonDay")+'</p><div class="row" style="justify-content:center">'+
      (pv?'<button class="btn" data-act="setDate" data-date="'+pv+'">‹ '+t("prevLesson")+' · '+shortDate(pv)+'</button>':'')+
      (nx?'<button class="btn" data-act="setDate" data-date="'+nx+'">'+t("nextLesson")+' · '+shortDate(nx)+' ›</button>':'')+'</div></main>';
  }
  if (isPartnerDay(c,d)){   // the co-teacher's session: view only
    var pc={present:0,online:0,late:0,absent:0,none:0};
    r.forEach(function(s){ pc[partnerStatus(d,c.id,s.id)]++; });
    var ph=topbar("home")+'<main class="wrap">'+dateNav()+
      '<div class="classhead"><h1><span class="t">'+c.time+'</span>'+esc(c.name)+roleTag(c,d)+'</h1><span class="cmeta">'+daysLabel([wd(d)])+' · '+t("partnerMeta",{name:esc(c.partner||"")})+' · '+t("students",{n:r.length})+'</span></div>'+
      '<p class="banner partner">'+t(c.role==="A"?"partnerBannerB":c.role==="B"?"partnerBannerA":"partnerBanner",{name:esc(c.partner||"")})+'</p>'+
      '<div class="summary five">'+ATT_KEYS.map(function(k){ return '<div class="chip '+ATT_CLS[k]+'"><b>'+pc[k]+'</b>'+t(k)+'</div>'; }).join("")+'</div>'+
      '<div class="grid">'+r.map(function(s){ var st=partnerStatus(d,c.id,s.id); return '<div class="tile ro s-'+ATT_CLS[st]+'"><span class="nm">'+esc(s.name)+'</span><span class="st">'+t(st)+'</span></div>'; }).join("")+'</div>'+
      '<p class="hint">'+t("partnerHint")+'</p></main>';
    return ph;
  }
  var cnt={present:0,online:0,late:0,absent:0,none:0};
  r.forEach(function(s){ cnt[attStatus(d,c.id,s.id)]++; });
  var h=topbar("home")+'<main class="wrap">'+dateNav()+
    '<div class="classhead"><h1><span class="t">'+c.time+'</span>'+esc(c.name)+roleTag(c,d)+'</h1><span class="cmeta">'+daysLabel(c.days)+' · '+t("students",{n:r.length})+'</span></div>';
  var nExp=r.filter(function(s){ return isExpected(d,c.id,s.id); }).length;
  if (nExp) h+='<div class="expbar"><span>'+t("expBanner",{n:nExp})+'</span><button class="btn outline" data-act="expConfirm">'+t("expConfirm")+'</button></div>';
  if (d<today) h+='<p class="banner">'+t("editingPast")+'</p>';
  if (d>today) h+='<p class="banner">'+t("futureDate")+'</p>';
  if (!r.length) return h+'<p class="hint">'+(c.rosterPending?t("rosterPendingHint"):t("emptyClass"))+'</p></main>';
  h+='<div class="summary five">'+ATT_KEYS.map(function(k){ return '<div class="chip '+ATT_CLS[k]+'"><b>'+cnt[k]+'</b>'+t(k)+'</div>'; }).join("")+'</div>';
  if (seatAttOn()) h+=seatAttHtml(c,d,r);   // 자리배치 출석: the seat screen takes the place of the name cards
  else h+='<div class="grid">'+r.map(function(s){
    var st=attStatus(d,c.id,s.id), nt=attNote(d,c.id,s.id), ex=isExpected(d,c.id,s.id);
    return '<button class="tile s-'+ATT_CLS[st]+(ex?' exp':'')+'" data-act="cycle" data-sid="'+s.id+'" aria-label="'+esc(s.name)+', '+t(st)+(ex?' ('+t("expTag")+')':'')+'"><span class="nm">'+esc(s.name)+'</span><span class="st">'+t(st)+(ex?' · '+t("expTag"):'')+'</span>'+(nt?'<span class="dot" aria-hidden="true"></span>':'')+'</button>';
  }).join("")+'</div><p class="hint">'+t("noteHint")+'</p>';

  // 숙제 확인: one card per student — tap the card body to toggle 했어요 / 안 했어요, ✎ to write a comment
  var hr=r.filter(function(s){ return hwEligible(d,c.id,s.id); }), hwOut=r.length-hr.length;
  var hwN=0, hwNotes=0, hwAllDone=hr.length>0;
  hr.forEach(function(s){ var x=hwGet(d,c.id,s.id); if (x.note) hwNotes++; if (x.done) hwN++; else hwAllDone=false; });
  h+='<section class="hwsec" aria-labelledby="hwTitle"><div class="sechead"><h2 class="sec" id="hwTitle">📒 '+t("hw")+'</h2><span class="hwcount" aria-live="polite">'+t("hwCount",{a:hwN,n:hr.length})+(hwNotes?' · <span class="muted">'+t("hwNoteCount",{n:hwNotes})+'</span>':'')+'</span></div>'+
     '<div class="hwbar" role="progressbar" aria-valuemin="0" aria-valuemax="'+hr.length+'" aria-valuenow="'+hwN+'"><span style="width:'+(hr.length?Math.round(hwN*100/hr.length):0)+'%"></span></div>'+
     (hr.length ? '' : '<p class="hint">'+t("hwNone")+'</p>')+
     '<div class="hwgrid">'+hr.map(function(s){ var x=hwGet(d,c.id,s.id), on=x.done, ab=false;
       var lab=on?t("hwDone"):(ab?t("hwAbsent"):t("hwTodo")), body;
       if (hwTwo())   // 연습 / 리뷰: name on top, two toggles below
         body='<div class="hwhead2"><span class="nm">'+esc(s.name)+'</span>'+(ab&&!x.p&&!x.r?'<span class="st">'+t("hwAbsent")+'</span>':'')+'</div><div class="hwpair">'+
           ['p','r'].map(function(k){ var v=x[k], nm=t(k==="p"?"hwP":"hwR"); return '<button class="hwk'+(v?' on':'')+'" data-act="hwK" data-sid="'+s.id+'" data-k="'+k+'" role="checkbox" aria-checked="'+v+'" aria-label="'+esc(s.name)+' '+nm+'">'+(v?'☑':'☐')+' '+nm+'</button>'; }).join("")+'</div>';
       else body='<button class="hwmain" data-act="hw" data-sid="'+s.id+'" role="checkbox" aria-checked="'+on+'" aria-label="'+esc(s.name)+', '+t("hw")+' '+lab+'">'+
           '<span class="ck" aria-hidden="true">'+(on?'✓':'')+'</span><span class="hwtx"><span class="nm">'+esc(s.name)+'</span><span class="st">'+lab+'</span></span></button>';
       return '<div class="hwcard'+(on?' on':'')+(ab&&!on?' ab':'')+(x.note?' hasnote':'')+'">'+body+
         '<button class="hwnote" data-act="hwNote" data-sid="'+s.id+'" aria-label="'+esc(s.name)+' '+t("hwNoteTitle")+(x.note?': '+esc(x.note):'')+'">'+
           (x.note?'<span class="nt">'+esc(x.note)+'</span>':'<span class="ph">✎ '+t("hwNoteBtn")+'</span>')+'</button></div>';
     }).join("")+'</div>'+
     (hr.length ? '<button class="btn block hwall" data-act="hwAll">'+(hwAllDone?t("hwAllOff"):'✓ '+t("hwAllOn"))+'</button>' : '')+
     (hwOut && hr.length ? '<p class="hint">'+t("hwOut",{n:hwOut})+'</p>' : '')+
     '<p class="hint">'+t(hwTwo()?"hwHint2":"hwHint")+'</p></section>';

  // Golden Bell section
  var players=cnt.present+cnt.online+cnt.late, sess=sessionsOf(c.id,d);
  h+='<section class="gbsec"><div class="sechead"><h2 class="sec">'+t("gb")+'</h2><span class="muted">'+t("gbPlayers",{n:players})+'</span></div>';
  var vis=visibleSeats(seatingFor(c.id,d).map,c.id,d), inroom=cnt.present+cnt.late;
  if (seatingOn() && !seatAttOn()) h+='<button class="btn block" data-act="openSeat">🪑 '+t("seatBtn")+' <span class="muted">· '+t("seatCount",{a:Object.keys(vis).length,b:inroom})+'</span></button>';
  var gs=sess[0];   // one Golden Bell per class per day
  if (noGb(c)){
    h+='<p class="hint">'+t(c.sub?"subNoGb":"levelupNoGb")+'</p>';   // 레벨업 특강: attendance + seating only
  } else if (!gs){
    h+='<button class="btn outline block" data-act="gbStart"'+(players?'':' disabled')+'>🔔 '+t("gbStart")+'</button>';
    if (!players) h+='<p class="hint">'+t("gbNeedAtt")+'</p>';
  } else {
    h+='<button class="sess" data-act="openSession" data-id="'+gs.id+'"><span><b>🔔 '+(gs.status==="active"?t("gbResume"):t("gbView"))+'</b> <span class="muted">· '+t("gbQs",{n:gs.questionCount})+' · '+t("gbPlayers",{n:gs.playerIds.length})+'</span></span><span class="pill '+(gs.status==="active"?"live":"ended")+'">'+(gs.status==="active"?t("gbLive"):t("gbEnded"))+'</span></button>';
    h+='<p class="hint">'+t("gbOnePerDay")+'</p>';
  }
  h+='</section></main>';
  if (state.sheet && state.sheet.kind==="att") h+=attSheet(c);
  if (state.sheet && state.sheet.kind==="hwNote") h+=hwSheet(c);
  return h;
}
function hwSheet(c){
  var s=studentById(state.sheet.sid), on=state.sheet.on, sp=state.sheet.p, sr=state.sheet.r;
  return '<div class="scrim" data-act="closeSheet"></div><div class="sheet" role="dialog" aria-modal="true" aria-label="'+esc(s.name)+' '+t("hwNoteTitle")+'">'+
    '<h2>'+esc(s.name)+' <span class="muted">'+t("hwNoteTitle")+' · '+shortDate(state.date)+'</span></h2>'+
    (hwTwo()
      ? '<div class="seg two"><button class="ok" data-act="hwSheetK" data-k="p" aria-pressed="'+sp+'">'+(sp?'☑':'☐')+' '+t("hwP")+'</button><button class="ok" data-act="hwSheetK" data-k="r" aria-pressed="'+sr+'">'+(sr?'☑':'☐')+' '+t("hwR")+'</button></div>'
      : '<div class="seg two"><button class="ok" data-act="hwSheetSet" data-on="1" aria-pressed="'+on+'">✓ '+t("hwDone")+'</button><button class="none" data-act="hwSheetSet" data-on="0" aria-pressed="'+(!on)+'">'+t("hwTodo")+'</button></div>')+
    '<label class="lbl" for="hwNoteInput">'+t("note")+'</label><textarea id="hwNoteInput" rows="3" placeholder="'+t("hwNotePh")+'">'+esc(state.sheet.note)+'</textarea>'+
    '<div class="lbl">'+t("hwQuick")+'</div><div class="chips">'+HW_QUICK.map(function(q){ return '<button class="qchip" data-act="hwQuick" data-q="'+esc(q)+'">'+esc(q)+'</button>'; }).join("")+'</div>'+
    '<div class="row"><button class="btn" data-act="closeSheet">'+t("cancel")+'</button><button class="btn primary" data-act="hwSaveNote">'+t("save")+'</button></div></div>';
}
function attSheet(c){
  var s=studentById(state.sheet.sid), st=state.sheet.st;
  // 자리배치 출석: a seated student can be moved to another seat from here, keeping status and memo (Jay, 2026-11-13)
  var canMove=seatAttOn() && seatIdxOf(c.id,state.date,s.id)!=null;
  return '<div class="scrim" data-act="closeSheet"></div><div class="sheet" role="dialog" aria-modal="true" aria-label="'+esc(s.name)+'">'+
    '<h2>'+esc(s.name)+' <span class="muted">'+esc(c.name)+' · '+shortDate(state.date)+'</span></h2>'+
    (canMove?'<button class="btn outline block" data-act="saMove" data-sid="'+s.id+'">'+t("saMove")+'</button>':'')+
    '<div class="seg five att">'+ATT_KEYS.map(function(k){ return '<button class="'+ATT_CLS[k]+'" data-act="sheetAtt" data-st="'+k+'" aria-pressed="'+(k===st)+'">'+t(k)+'</button>'; }).join("")+'</div>'+
    '<label class="lbl" for="noteInput">'+t("note")+'</label><textarea id="noteInput" rows="3" placeholder="'+t("notePh")+'">'+esc(state.sheet.note)+'</textarea>'+
    '<div class="row"><button class="btn" data-act="closeSheet">'+t("cancel")+'</button><button class="btn primary" data-act="saveAtt">'+t("save")+'</button></div></div>';
}

/* ---------- 자리배치 출석 (seat screen inside the class page; setting "seating" = "att") ----------
   Everyone starts unseated (미체크). Tap a student chip, then an empty seat: the student is seated and gets 등원 or 지각 from
   the Seoul clock (seatAutoStatus). Tap a seated student: 등원 → 지각 → 미체크 (seat freed). Unseated students can be set
   온라인 / 결석 / 미체크 from the action row. It writes the same db.attendance and db.seating records as the name cards and
   🪑 자리배치, so 숙제, 골든벨 and the exports need nothing new. */
function seatIdxOf(cid,d,sid){ var m=visibleSeats(seatingFor(cid,d).map,cid,d), f=null; Object.keys(m).forEach(function(i){ if (m[i]===sid) f=i; }); return f; }
function seatRuleHtml(c,d){   // status line; refreshed every 15 s by app.js
  var now=seoulNow(), st=classStartMin(c), cls, txt, clock="";
  if (d!==now.ymd || st==null){ cls="neutral"; txt=t(d>now.ymd?"saRuleFuture":"saRulePast"); }
  else {
    var s=hmOf(st), l=hmOf(st+SEAT_LATE_GRACE_MIN), lateAt=(st+SEAT_LATE_GRACE_MIN)*60; clock=now.hm;
    if (now.sec<st*60){ cls="ok"; txt=t("saRuleBefore",{s:s,l:l}); }
    else if (now.sec<lateAt){ cls="mid"; txt=t("saRuleGrace",{n:Math.ceil((lateAt-now.sec)/60),l:l}); }
    else { cls="bad"; txt=t("saRuleLate",{l:l}); }
  }
  return '<div class="sarule '+cls+'" id="saRule"><span class="tx">'+txt+'</span>'+(clock?'<span class="ck" aria-label="'+t("saClock")+' '+clock+'">'+clock+'</span>':'')+'</div>';
}
function seatHelpInner(c,d){
  var sel=state.seatSel, p=sel&&studentById(sel.sid); if (!p) return t("saHelp");
  if (sel.from!=null) return t("saHelpMove",{name:esc(p.name)});
  return t("saHelpSel",{name:esc(p.name),st:t(seatStatusFor(c,d,p.id))});
}
// Status a student gets when seated now. One who is already 등원 / 지각 on record but has no seat (after a layout change, or added
// to 골든벨 without a seat) keeps that status; everyone else, 예정 included, gets it from the clock.
function seatStatusFor(c,d,sid){ var r=db.attendance[akey(d,c.id,sid)]; return (r && (r.status==="present"||r.status==="late")) ? r.status : seatAutoStatus(c,d); }
function seatAttHtml(c,d,r){
  var sf=seatingFor(c.id,d), map=visibleSeats(sf.map,c.id,d), lay=sf.layout, aide=seatView()==="A", sel=state.seatSel;
  if (sel && !r.some(function(s){ return s.id===sel.sid; })) sel=state.seatSel=null;
  var seated={}; Object.keys(map).forEach(function(i){ seated[map[i]]=1; });
  var lastIdx=null; if (sel && sel.from==null){ var pv=seatPrevMap(c.id,d); Object.keys(pv).forEach(function(i){ if (pv[i]===sel.sid && !map[i]) lastIdx=String(i); }); }
  var h=seatRuleHtml(c,d)+'<p class="helpline" id="saHelp">'+seatHelpInner(c,d)+'</p>';
  h+='<div class="seatwrap">'+(aide?frontRowHtml(lay,sf.teacher,true,true):'')+'<div class="seats'+(colsOf(lay)===3?' c3':'')+'">';
  for (var k=0;k<12;k++){
    var i=aide?11-k:k, o=map[String(i)], p=o&&studentById(o);
    if (p){ var st=attStatus(d,c.id,o), nt=attNote(d,c.id,o);
      h+='<button class="tile s-'+ATT_CLS[st]+(sel&&sel.from===String(i)?' sel':'')+'" data-act="saSeat" data-idx="'+i+'" data-sid="'+o+'" aria-label="'+esc(p.name)+', '+t(st)+'"><span class="nm">'+esc(p.name)+'</span><span class="st">'+t(st)+'</span>'+(nt?'<span class="dot" aria-hidden="true"></span>':'')+'</button>';
    }
    else if (sel && String(i)===lastIdx) h+='<button class="seat target last" data-act="saSeat" data-idx="'+i+'">'+t("saLast")+'<small>'+esc(studentById(sel.sid).name)+'</small></button>';
    else h+='<button class="seat'+(sel?' target':'')+'" data-act="saSeat" data-idx="'+i+'">'+t(sel?"saHere":"emptySeat")+'</button>';
  }
  h+='</div>'+(aide?'<div class="front back">'+t("backAide")+'</div>':frontRowHtml(lay,sf.teacher,true))+'</div>';
  var tray=r.filter(function(s){ return !seated[s.id]; });
  h+='<div class="sahead"><h2 class="sec">'+t("saTray",{n:tray.length})+'</h2><button class="btn danger pill" data-act="saClose">'+t("saClose")+'</button></div>';
  h+= tray.length ? '<div class="tray sa">'+tray.map(function(s){ var st=attStatus(d,c.id,s.id), ex=isExpected(d,c.id,s.id);
      return '<button class="chipbtn'+(st==="none"?'':' sa-'+ATT_CLS[st])+(sel&&sel.sid===s.id?' sel':'')+'" data-act="saChip" data-sid="'+s.id+'" aria-pressed="'+!!(sel&&sel.sid===s.id)+'">'+esc(s.name)+(st==="none"?'':' · '+t(st))+(ex?' · '+t("expTag"):'')+'</button>'; }).join("")+'</div>'
    : '<p class="hint">'+t("allSeated")+'</p>';
  if (sel && sel.from==null) h+='<div class="sarow"><button class="on" data-act="saSet" data-st="online">'+t("online")+'</button><button class="bad" data-act="saSet" data-st="absent">'+t("absent")+'</button><button class="none" data-act="saSet" data-st="none">'+t("none")+'</button><button data-act="saCancel">'+t("cancel")+'</button></div>';
  else if (sel) h+='<button class="btn block" data-act="saCancel">'+t("cancel")+'</button>';
  // room setup: 보는 위치 and layout (the 선생님 block in the front row switches sides)
  h+=seatViewSeg();
  if (state.confirm && typeof state.confirm==="string" && state.confirm.indexOf("layout:")===0)
    h+='<p class="hint" style="color:var(--bad)">'+t("layoutConfirm")+'</p><div class="row"><button class="btn" data-act="cancelConfirm">'+t("cancel")+'</button><button class="btn danger" data-act="layoutDo" data-l="'+state.confirm.slice(7)+'">'+t("layoutDo")+'</button></div>';
  else h+='<div class="layoutseg">'+["4x3","3x4"].map(function(l){ var kk=l==="4x3"?"43":"34"; return '<button data-act="layout" data-l="'+l+'" aria-pressed="'+(lay===l)+'">'+t("layout"+kk)+'<small>'+t("layout"+kk+"s")+'</small></button>'; }).join("")+'</div>';
  return h;
}

/* ---------- S2b seating (자리배치) ---------- */
function viewSeat(){
  var c=classById(state.classId); if (!c){ state.view="home"; return viewHome(); }
  var d=state.date, sf=seatingFor(c.id,d), map=visibleSeats(sf.map,c.id,d), sel=state.seatSel;
  var roster=rosterOf(db,c.id,d), present=roster.filter(function(st){return inRoom(d,c.id,st.id);});
  var online=roster.filter(function(st){return attStatus(d,c.id,st.id)==="online";});
  var seated={}; Object.keys(map).forEach(function(i){ seated[map[i]]=1; });
  var tray=present.filter(function(p){return !seated[p.id];});
  var h=topbar("class")+'<main class="wrap">'+
    '<div class="classhead"><h1><span class="t">'+c.time+'</span>'+esc(c.name)+'</h1><span class="cmeta">'+fmtDate(d)+' · '+t("seatCount",{a:Object.keys(map).length,b:present.length})+'</span></div>';
  if (!present.length) return h+'<p class="hint">'+t("noPresent")+'</p></main>';
  if (sf.src==="prev") h+='<p class="banner" style="background:var(--accent-soft);color:var(--accent)">'+t("prefilled")+'</p>';
  var lay=sf.layout;
  if (state.confirm && state.confirm.indexOf("layout:")===0)
    h+='<p class="hint" style="color:var(--bad)">'+t("layoutConfirm")+'</p><div class="row"><button class="btn" data-act="cancelConfirm">'+t("cancel")+'</button><button class="btn danger" data-act="layoutDo" data-l="'+state.confirm.slice(7)+'">'+t("layoutDo")+'</button></div>';
  else h+='<div class="layoutseg">'+["4x3","3x4"].map(function(l){ var k=l==="4x3"?"43":"34"; return '<button data-act="layout" data-l="'+l+'" aria-pressed="'+(lay===l)+'">'+t("layout"+k)+'<small>'+t("layout"+k+"s")+'</small></button>'; }).join("")+'</div>';
  var aide=seatView()==="A";
  h+=seatViewSeg();
  h+='<div class="sideseg"><span class="lbl2">🧑‍🏫 '+t("teacherSideLbl")+(aide?'<small>'+t("teacherRef")+'</small>':'')+'</span>'+["L","R"].map(function(x){ return '<button data-act="teacherSide" data-side="'+x+'" aria-pressed="'+(sf.teacher===x)+'">'+t(x==="L"?"sideL":"sideR")+'</button>'; }).join("")+'</div>';
  h+='<p class="helpline">'+(sel?t("seatSel",{name:esc(studentById(sel.sid).name)}):t("seatIdle"))+'</p>';
  h+='<div class="seatwrap">'+(aide?frontRowHtml(lay,sf.teacher,true,true):'')+'<div class="seats'+(colsOf(lay)===3?' c3':'')+'">';
  for (var k=0;k<12;k++){
    var i=aide?11-k:k, o=map[String(i)];   // 보조교사 view: reversed order = rows flipped and columns mirrored
    if (o) h+='<button class="seat filled'+(sel&&sel.from===String(i)?' sel':'')+'" data-act="seatCell" data-idx="'+i+'">'+esc(studentById(o).name)+'</button>';
    else h+='<button class="seat'+(sel?' target':'')+'" data-act="seatCell" data-idx="'+i+'">'+t("emptySeat")+'</button>';
  }
  h+='</div>'+(aide?'<div class="front back">'+t("backAide")+'</div>':frontRowHtml(lay,sf.teacher,true))+'</div>';
  if (sel && sel.from!=null) h+='<button class="btn block" data-act="unseat">'+t("unseat")+'</button>';
  h+='<h2 class="sec">'+t("unseated",{n:tray.length})+'</h2>';
  h+= tray.length ? '<div class="tray">'+tray.map(function(p){ return '<button class="chipbtn'+(sel&&sel.sid===p.id?' sel':'')+'" data-act="seatTray" data-sid="'+p.id+'">'+esc(p.name)+'</button>'; }).join("")+'</div>' : '<p class="hint">'+t("allSeated")+'</p>';
  if (online.length) h+='<p class="hint">'+t("onlineNote",{names:online.map(function(x){return esc(x.name);}).join(", ")})+'</p>';
  if (state.confirm==="clearSeats") h+='<p class="hint" style="color:var(--bad)">'+t("clearConfirm")+'</p><div class="row"><button class="btn" data-act="cancelConfirm">'+t("cancel")+'</button><button class="btn danger" data-act="clearSeatsDo">'+t("clearSeats")+'</button></div>';
  else h+='<div class="row"><button class="btn danger" data-act="askClearSeats"'+(Object.keys(map).length?'':' disabled')+'>'+t("clearSeats")+'</button><button class="btn primary" data-act="go" data-view="class" style="flex:1">'+t("seatDone")+'</button></div>';
  return h+'</main>';
}
function seatWrite(full,layout,side){ var sf=seatingFor(state.classId,state.date); db.seating[seatKey(state.date,state.classId)]={layout:layout||sf.layout,seats:full,teacher:side||sf.teacher,at:Date.now()}; state.seatSel=null; save(); }

/* ---------- S3 Golden Bell question ---------- */
function viewGb(){
  var s=db.gbSessions[state.sessionId]; if (!s){ state.view="class"; return viewClass(); }
  var c=classById(s.classId), q=state.q, qd=db.gbQuestions[qkey(s.id,q)]||{phase:"first"}, ph=qd.phase==="hint"?"first":qd.phase;   // old "hint" phase = open
  var players=s.playerIds.map(studentById).filter(Boolean).sort(byName);
  var inQ=players.filter(function(p){return played(s,q,p.id);});
  var cnt={"◎":0,"O":0,"△":0,"X":0,none:0};
  inQ.forEach(function(p){ var m=getMark(s.id,q,p.id); cnt[m&&m.mark?m.mark:"none"]++; });
  var h=topbar("class")+'<main class="wrap withbar">';
  h+='<div class="gbhead"><span class="cmeta">'+esc(c.name)+' · '+shortDate(s.date)+' · '+t("gbPlayers",{n:s.playerIds.length})+'</span>'+
     '<div class="qnav"><button class="navbtn" data-act="qnav" data-n="-1"'+(q>1?'':' disabled')+' aria-label="prev">‹</button>'+
     '<div class="qtitle"><b>Q'+q+'</b><span class="phase ph-'+ph+'">'+t("ph_"+ph)+'</span></div>'+
     '<button class="navbtn" data-act="qnav" data-n="1"'+(q<s.questionCount?'':' disabled')+' aria-label="next">›</button></div></div>';
  h+='<p class="instr">'+t("in_"+ph)+'</p>';
  h+='<div class="summary five">'+
    '<div class="chip ok"><b>'+cnt["◎"]+'</b>◎</div><div class="chip ok"><b>'+cnt["O"]+'</b>O</div>'+
    '<div class="chip mid"><b>'+cnt["△"]+'</b>△</div><div class="chip bad"><b>'+cnt["X"]+'</b>X</div>'+
    '<div class="chip none"><b>'+cnt.none+'</b>'+t("unmarked")+'</div></div>';
  function gbTile(p){
    if (!played(s,q,p.id)) return '<div class="tile s-none locked"><span class="nm">'+esc(p.name)+'</span><span class="mk">–</span></div>';
    var m=getMark(s.id,q,p.id), mk=m&&m.mark?m.mark:"", cls=mk?markCls(mk):"none";
    var locked = ph==="closed";
    return '<button class="tile s-'+cls+(locked&&mk?' locked':'')+'" data-act="gbTap" data-sid="'+p.id+'" aria-label="'+esc(p.name)+(mk?', '+mk:'')+'">'+
      '<span class="nm">'+esc(p.name)+'</span><span class="mk">'+(mk||'&nbsp;')+'</span>'+
      (m&&m.comment?'<span class="dot" aria-hidden="true"></span>':'')+(locked&&mk&&ph!=="closed"?'<span class="lock" aria-hidden="true">🔒</span>':'')+'</button>';
  }
  h+=seatGridHtml(seatingOn()?(s.seats||{}):{}, s.layout||"4x3", players, gbTile, teacherSideFor(s.classId,s.date,s));
  h+='<p class="hint">'+t("gbHelp")+'</p>';
  var qr=gbQRank(s,q);
  if (qr.length){
    h+='<h2 class="sec">'+t("rankQ")+' · Q'+q+'</h2><p class="rkq">'+qr.map(function(r){ return r.rank+'. '+esc(r.p.name)+' '+r.pts; }).join(' · ')+'</p>';
    h+='<h2 class="sec">'+t("rankNow",{n:q})+'</h2>'+gbRankHtml(gbScores(s,q),true)+'<p class="hint">'+t("scoreKey")+'</p>';
  }
  var roster=rosterOf(db,s.classId,s.date).filter(function(st){return s.playerIds.indexOf(st.id)<0;});
  if (roster.length && s.status==="active") h+='<button class="linkbtn" style="align-self:center" data-act="addPlayerOpen">+ '+t("addPlayer")+'</button>';
  if (s.status==="active") h+='<button class="linkbtn" style="align-self:center;color:var(--bad)" data-act="askResetGb">↺ '+t("gbReset")+'</button>';
  h+='</main>';

  // action bar
  var a='<div class="actbar"><div class="actbar-in">';
  if (state.confirm==="resetGb"){
    var nMarks=Object.keys(db.gbMarks).filter(function(k){ return k.indexOf(s.id+"_")===0 && db.gbMarks[k] && db.gbMarks[k].mark; }).length;
    a+='<p class="actnote">'+t("gbResetAsk",{cls:esc(c.name),date:shortDate(s.date),q:s.questionCount,m:nMarks})+'</p><div class="actrow"><button class="btn" data-act="cancelConfirm">'+t("cancel")+'</button><button class="btn danger" data-act="resetGbDo">'+t("gbResetDo")+'</button></div>';
  } else if (state.confirm==="endGb"){
    a+='<p class="actnote">'+t("confirmEnd")+'</p><div class="actrow"><button class="btn" data-act="cancelConfirm">'+t("cancel")+'</button><button class="btn danger" data-act="endGbDo">'+t("confirmEndDo")+'</button></div>';
  } else if (q!==s.currentQ){
    a+='<div class="actrow"><button class="btn primary" data-act="toCurrent">'+t("toCurrent",{n:s.currentQ})+'</button></div>';
  } else if (ph!=="closed"){
    a+='<div class="actrow"><button class="btn primary" data-act="closeQ">'+t("closeQ")+(cnt.none?' ('+t("unmarked")+' '+cnt.none+')':'')+'</button></div>';
    a+='<div class="actrow"><button class="btn danger" data-act="askEndGb">'+t("endGb")+'</button></div>';
  } else {
    a+='<div class="actrow"><button class="btn primary" data-act="nextQ">'+t("nextQ")+' (Q'+(q+1)+')</button></div><div class="actrow"><button class="btn danger" data-act="endGbDo">'+t("endGb")+'</button></div>';
  }
  a+='</div></div>';
  h+=a;
  if (state.sheet && state.sheet.kind==="gb") h+=gbSheet(s);
  if (state.sheet && state.sheet.kind==="addPlayer") h+=addPlayerSheet(s,roster);
  return h;
}
function gbSheet(s){
  var sh=state.sheet, p=studentById(sh.st);
  var orig=getMark(s.id,sh.q,sh.st);
  var info = orig && orig.mark ? t("recorded",{p:t("ph_"+orig.phase)})+(orig.overridden?' · '+t("overridden"):'') : '';
  var opts=[["◎","ok"],["O","ok"],["△","mid"],["X","bad"],["","none"]];
  var notPlayed = !played(s,sh.q,sh.st);
  return '<div class="scrim" data-act="closeSheet"></div><div class="sheet" role="dialog" aria-modal="true" aria-label="'+esc(p.name)+'">'+
    '<h2>'+esc(p.name)+' <span class="muted">Q'+sh.q+' · '+shortDate(s.date)+'</span></h2>'+
    (notPlayed ? '<p class="metaline">'+t("notPlayed")+'</p><div class="row"><button class="btn" data-act="closeSheet">'+t("cancel")+'</button></div></div>' :
    (info?'<p class="metaline">'+info+'</p>':'')+
    '<span class="lbl">'+t("markLbl")+'</span><div class="seg five">'+opts.map(function(o){ return '<button class="'+o[1]+'" data-act="sheetMark" data-m="'+o[0]+'" aria-pressed="'+(sh.mark===o[0])+'">'+(o[0]||t("noMark"))+'</button>'; }).join("")+'</div>'+
    '<label class="lbl" for="cmInput">'+t("comment")+'</label><textarea id="cmInput" rows="3" placeholder="'+t("commentPh")+'">'+esc(sh.comment)+'</textarea>'+
    '<div class="row"><button class="btn" data-act="closeSheet">'+t("cancel")+'</button><button class="btn primary" data-act="saveGb">'+t("save")+'</button></div></div>');
}
function seatGridHtml(seats, layout, players, tileFn, side){
  if (!Object.keys(seats).length) return '<div class="grid">'+players.map(tileFn).join("")+'</div>';
  var byId={}, seated={};
  players.forEach(function(p){ byId[p.id]=p; });
  Object.keys(seats).forEach(function(i){ if (byId[seats[i]]) seated[seats[i]]=1; });
  var h=seatViewSeg()+seatRoomHtml(layout,side||"L",function(i){ var sid=seats[String(i)]; return (sid && byId[sid]) ? tileFn(byId[sid]) : '<div class="tile seat-empty" aria-hidden="true"></div>'; });
  var rest=players.filter(function(p){ return !seated[p.id]; });
  if (rest.length) h+='<h2 class="sec">'+t("noSeatSec")+'</h2><div class="grid">'+rest.map(tileFn).join("")+'</div>';
  return h;
}
function addPlayerSheet(s,roster){
  if (state.sheet.pick){
    var p=studentById(state.sheet.pick), seats=s.seats||{};
    return '<div class="scrim" data-act="closeSheet"></div><div class="sheet" role="dialog" aria-modal="true" aria-label="'+t("addPlayerTitle")+'">'+
      '<h2>'+t("pickSeat",{name:esc(p.name)})+'</h2>'+seatRoomHtml(s.layout,teacherSideFor(s.classId,s.date,s),function(i){ var o=seats[String(i)]; return o ? '<button class="seat filled" disabled>'+esc(studentById(o).name)+'</button>' : '<button class="seat target" data-act="addPlayerSeat" data-idx="'+i+'">'+t("emptySeat")+'</button>'; })+
      '<div class="row"><button class="btn" data-act="closeSheet">'+t("cancel")+'</button><button class="btn" data-act="addPlayerSeat" data-idx="">'+t("addNoSeat")+'</button></div></div>';
  }
  return '<div class="scrim" data-act="closeSheet"></div><div class="sheet" role="dialog" aria-modal="true" aria-label="'+t("addPlayerTitle")+'">'+
    '<h2>'+t("addPlayerTitle")+'</h2><p class="metaline">'+t("addPlayerNote")+'</p><div class="pick">'+
    roster.map(function(st){ return '<button data-act="addPlayer" data-sid="'+st.id+'">'+esc(st.name)+' <span class="muted">· '+t(attStatus(s.date,s.classId,st.id))+'</span></button>'; }).join("")+
    '</div><div class="row"><button class="btn" data-act="closeSheet">'+t("cancel")+'</button></div></div>';
}

/* ---------- S4 results (layout A) ---------- */
function viewResults(){
  var s=db.gbSessions[state.sessionId]; if (!s){ state.view="class"; return viewClass(); }
  var c=classById(s.classId), Q=s.questionCount, qs=[]; for (var i=1;i<=Q;i++) qs.push(i);
  var players=s.playerIds.map(studentById).filter(Boolean).sort(byName);
  var idx=sessionsOf(s.classId,s.date).indexOf(s)+1;
  var h=topbar("class")+'<main class="wrap">'+
    '<div class="classhead"><h1 style="font-size:22px">'+t("results")+'</h1><span class="cmeta">'+esc(c.name)+' · '+shortDate(s.date)+' · '+t("gbQs",{n:Q})+'</span></div>';
  h+='<div class="legend">'+
    '<span><i class="lg m-ok">◎</i>'+t("legendFirst")+'</span><span><i class="lg m-ok">O</i>'+t("legendRetry")+'</span>'+
    '<span><i class="lg m-mid">△</i>'+t("legendHint")+'</span><span><i class="lg m-bad">X</i>'+t("legendX")+'</span>'+
    '<span><i class="lg m-none">·</i>'+t("unmarked")+'</span><span><i class="lg m-na">–</i>'+t("legendNa")+'</span><span><i class="lg m-na"><span class="dot"></span></i>'+t("legendCm")+'</span></div>';
  var sc=gbScores(s), scBy={}; sc.forEach(function(r){ scBy[r.p.id]=r; });
  h+='<h2 class="sec">'+(s.status==="ended"?t("rankFinal"):t("rankNow",{n:s.currentQ}))+'</h2>'+gbRankHtml(sc,true)+'<p class="hint">'+t("scoreKey")+'</p>';
  h+='<div class="mx-wrap"><table class="mx"><thead><tr><th class="nm">'+t("nameCol")+'</th>'+qs.map(function(q){return '<th>Q'+q+'</th>';}).join("")+'<th>'+t("ptsCol")+'</th><th>'+t("rankCol")+'</th></tr></thead><tbody>';
  players.forEach(function(p){
    var open=!!state.expanded[p.id];
    h+='<tr><th class="nm" scope="row"><button class="namebtn" data-act="toggleRow" data-sid="'+p.id+'" aria-expanded="'+open+'"><span class="car">'+(open?'▾':'▸')+'</span>'+esc(p.name)+'</button></th>';
    qs.forEach(function(q){
      if (!played(s,q,p.id)){ h+='<td><button class="cell m-na" data-act="cell" data-q="'+q+'" data-sid="'+p.id+'">–</button></td>'; return; }
      var m=getMark(s.id,q,p.id), mk=m&&m.mark?m.mark:"";
      h+='<td><button class="cell m-'+(mk?markCls(mk):"none")+'" data-act="cell" data-q="'+q+'" data-sid="'+p.id+'" aria-label="'+esc(p.name)+' Q'+q+' '+(mk||'-')+(m&&m.comment?' •':'')+'">'+(mk||'·')+(m&&m.comment?'<span class="dot" aria-hidden="true"></span>':'')+'</button></td>';
    });
    var r0=scBy[p.id]; h+='<td><b>'+(r0?r0.pts:'')+'</b></td><td>'+(r0?r0.rank:'')+'</td></tr>';
    if (open){
      var items=qs.map(function(q){ var m=getMark(s.id,q,p.id); return m&&m.comment ? '<div class="cm"><b>Q'+q+' '+(m.mark||'')+'</b><span>"'+esc(m.comment)+'"</span></div>' : ''; }).join("");
      h+='<tr class="exp"><td colspan="'+(Q+3)+'"><div class="in">'+(items||'<span class="muted">'+t("noComments")+'</span>')+'</div></td></tr>';
    }
  });
  h+='</tbody><tfoot><tr><th class="nm">'+t("footRow")+'</th>'+qs.map(function(q){
    var n=0, ok=0;
    players.forEach(function(p){ if (!played(s,q,p.id)) return; n++; var m=getMark(s.id,q,p.id); if (m && (m.mark==="◎"||m.mark==="O")) ok++; });
    return '<td>'+ok+'/'+n+'</td>';
  }).join("")+'<td></td><td></td></tr></tfoot></table></div>';
  h+='<p class="hint">'+t("tapHint")+'</p>';
  if (s.status==="active") h+='<button class="btn primary block" data-act="resume">'+t("resume")+'</button>';
  h+='</main>';
  if (state.sheet && state.sheet.kind==="gb") h+=gbSheet(s);
  return h;
}

/* ---------- teacher picker + settings ---------- */
function viewPick(){
  var h=topbar(T?"home":null)+'<main class="wrap"><h2 class="sec">'+t("pickTitle")+'</h2><p class="hint">'+t("pickHint")+'</p><ul class="cards">';
  TEACHERS.forEach(function(x){
    var n=db.classes.filter(function(c){ return c.teacherId===x.id && (!c.end || c.end>=todayIso()); }).length;
    h+='<li><button class="card" data-act="pickTeacher" data-tid="'+x.id+'"><span class="ctime">👤</span><span class="cmain"><span class="cname">'+esc(x.name)+' '+t("teacherSuffix")+'</span><span class="cmeta">'+t("pickClasses",{n:n})+'</span></span>'+(T&&T.id===x.id?'<span class="cstat st-done">'+t("pickCurrent")+'</span>':'')+'</button></li>';
  });
  return h+'</ul></main>';
}
function settingsSheet(){
  var sm=seatMode(), two=hwTwo(), cf=state.confirm;
  var h='<div class="scrim" data-act="closeSheet"></div><div class="sheet" role="dialog" aria-modal="true" aria-label="'+t("settings")+'"><h2>⚙ '+t("settings")+' <span class="muted">· '+esc(T.name)+' '+t("teacherSuffix")+'</span></h2>'+
    '<button class="btn block" data-act="pinOpen">🔒 '+t("switchTeacher")+'</button>'+
    '<span class="lbl">'+t("setSeating")+'</span><div class="seg three">'+[["off","off"],["on","on"],["att","seatAttOpt"]].map(function(o){ return '<button class="acc" data-act="setOpt" data-k="seating" data-v="'+o[0]+'" aria-pressed="'+(sm===o[0])+'">'+t(o[1])+'</button>'; }).join("")+'</div>'+
    '<div class="optdesc"><b>'+t("seatT_"+sm)+'</b><span>'+t("seatD_"+sm)+'</span></div>'+
    '<span class="lbl">'+t("setHw")+'</span><div class="seg two"><button class="ok" data-act="setOpt" data-k="hw" data-v="one" aria-pressed="'+(!two)+'">'+t("hwOne")+'</button><button class="ok" data-act="setOpt" data-k="hw" data-v="two" aria-pressed="'+two+'">'+t("hwTwoLbl")+'</button></div>'+
    '<p class="metaline">'+t("setHint")+'</p>'+
    '<span class="lbl">'+t("backup")+'</span><div class="row"><button class="btn" data-act="backupSave">💾 '+t("backupSave")+'</button><label class="btn" for="backupFile">📂 '+t("backupLoad")+'</label></div>'+
    '<input type="file" id="backupFile" accept=".json,application/json" hidden><p class="metaline">'+t(store.shared?"sharedBackupHint":"backupHint")+'</p>';
  var lb=store.get(LAST_BACKUP_KEY); h+='<p class="metaline"'+(lb?'':' style="color:var(--warn)"')+'>'+(lb?t("lastBackup",{date:fmtStamp(lb)}):t("noBackupYet"))+'</p>';
  if (cf && (cf.kind==="restore" || cf.kind==="legacy")){
    var ask = cf.kind==="restore" ? t(store.shared?"restoreAskShared":"restoreAsk",{date:cf.when}) : t("legacyAsk",{name:esc(cf.name)});
    h+='<p class="metaline" style="color:var(--bad)">'+ask+'</p><p class="metaline">'+t("restoreCounts",{a:cf.counts.attendance,h:cf.counts.homework,g:cf.counts.gb})+'</p>'+
       '<button class="btn block" data-act="backupSave">💾 '+t("backupFirst")+'</button>'+
       (cf.kind==="restore"?'<p class="metaline">'+t("mergeHint")+'</p>':'')+
       '<div class="row"><button class="btn" data-act="cancelConfirm">'+t("cancel")+'</button>'+(cf.kind==="restore"?'<button class="btn primary" data-act="restoreMerge">'+t("restoreMerge")+'</button>':'')+'<button class="btn danger" data-act="restoreDo">'+t(cf.kind==="restore"?"restoreDo":"legacyDo")+'</button></div>';
  }
  else if (cf==="reset") h+='<p class="metaline" style="color:var(--bad)">'+t(store.shared?"resetConfirmShared":"resetConfirm",{name:esc(T.name)})+'</p><div class="row"><button class="btn" data-act="cancelConfirm">'+t("cancel")+'</button><button class="btn danger" data-act="resetDo">'+t("resetDo")+'</button></div>';
  else h+='<button class="linkbtn" style="align-self:center" data-act="askReset">'+t("reset")+'</button>';
  return h+'<button class="btn primary block" data-act="closeSheet">'+t("close")+'</button></div>';
}
function saveFile(filename,blob){ return FieldsFiles.saveBlob(filename,blob); }
async function backupSave(){
  try {
    var now=new Date(), name=iso(now)+"_"+pad(now.getHours())+pad(now.getMinutes())+"_출석부_백업.json";
    await saveFile(name,new Blob([JSON.stringify({app:APP_ID,version:1,savedAt:now.toISOString(),db:db})],{type:"application/json"}));
    store.set(LAST_BACKUP_KEY,now.toISOString()); if (state.sheet && state.sheet.kind==="settings") render();
    toast(t("backupSaved"));
  } catch(e){ toast(e&&e.code==="declined"?t("exportDeclined"):e&&e.code?t("exportUnavailable"):t("exportFailed")); }
}
// Restore: validate the file (js/backup.js) → ask → replace. Nothing on the device changes before the teacher confirms.
function fmtStamp(isoStr){ if (!isoStr) return t("restoreNoDate"); var d=new Date(isoStr); return isNaN(d) ? t("restoreNoDate") : iso(d)+" "+pad(d.getHours())+":"+pad(d.getMinutes()); }
function backupLoad(file){
  FieldsFiles.readText(file).then(function(text){
    var r=FieldsBackup.parse(text,APP_ID);
    if (!r.ok){ if (window.console) console.warn("backup rejected:",r.reason); toast(t("backupBad")); return; }
    if (r.kind==="legacy"){
      var T0=null; TEACHERS.forEach(function(x){ if (x.legacyKey===r.legacy) T0=x; });
      if (!T0){ toast(t("backupBad")); return; }
      state.confirm={kind:"legacy",data:r.db,legacy:r.legacy,name:T0.name,counts:r.counts};
    } else state.confirm={kind:"restore",data:r.db,when:fmtStamp(r.savedAt),counts:r.counts};
    render();
  }).catch(function(){ toast(t("backupBad")); });
}
function render(){
  document.documentElement.lang=locale;
  if (!T) state.view="pick";
  else if (state.view==="pick" && !state.pickUnlocked) state.view="home";   // the picker needs the password once a teacher is set
  var v=state.view;
  document.getElementById("toast").style.bottom = v==="gb" ? "" : "calc(24px + env(safe-area-inset-bottom,0px))";
  app.innerHTML = v==="pick"?viewPick() : v==="class"?viewClass() : v==="seat"?viewSeat() : v==="gb"?viewGb() : v==="results"?viewResults() : viewHome();
}
