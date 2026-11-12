/* js/model.js — dates, data model helpers (keys, attendance, homework, seating), 골든벨 점수
   Plain script, no IIFE: the app's files share the global scope and index.html loads them in a fixed order
   (i18n → model → teachers → data → views → excel → app). Code that runs at load may only use earlier files. */

/* ---------- dates ---------- */
function pad(n){ return String(n).padStart(2,"0"); }
function iso(d){ return d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate()); }
function parse(s){ var p=s.split("-").map(Number); return new Date(p[0],p[1]-1,p[2]); }
function addDays(s,n){ var d=parse(s); d.setDate(d.getDate()+n); return iso(d); }
function todayIso(){ return iso(new Date()); }
function wd(s){ return parse(s).getDay(); }
function wdName(i){ return new Intl.DateTimeFormat(locale==="ko"?"ko-KR":"en-US",{weekday:"short"}).format(new Date(2026,9,11+i)); }
function fmtDate(s){ return s+" ("+wdName(wd(s))+")"; }
function shortDate(s){ var d=parse(s); return (d.getMonth()+1)+"/"+d.getDate()+" ("+wdName(d.getDay())+")"; }
var WEEK=[1,2,3,4,5,6,0];
function daysLabel(days){ return WEEK.filter(function(i){return days.indexOf(i)>=0;}).map(wdName).join(locale==="ko"?"":"·"); }

function esc(s){ return String(s).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];}); }
function hash(s){ var h=2166136261; for (var i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619); } return h>>>0; }
function uid(p){ return p+Date.now().toString(36)+Math.floor(Math.random()*1e4).toString(36); }

/* ---------- data model (mirrors spec §6) ----------
   classes, students, enrollments (date ranges)
   attendance["date_classId_studentId"] = {status, note}
   gbSessions[id] = {id, classId, date, status, playerIds[], joinedAt{sid:q}, questionCount, currentQ, startedAt}
   gbQuestions["sessionId_q"] = {phase: first|retry|hint|closed}
   gbMarks["sessionId_q_studentId"] = {mark: ◎|O|△|X|null, phase, comment, overridden}
--------------------------------------------------- */
function noGb(c){ return !!c.levelup; }   // 레벨업 특강 only. 부담임 (B, sub:true) days also run 골든벨 (Jay, 2026-11-11); sub now only drives the 부담임 tag
function activeOn(e,d){ return e.start<=d && (!e.end || d<e.end); }
function akey(d,c,s){ return d+"_"+c+"_"+s; }
function studentById(id){ for (var i=0;i<db.students.length;i++) if (db.students[i].id===id) return db.students[i]; return null; }
function classById(id){ for (var i=0;i<db.classes.length;i++) if (db.classes[i].id===id) return db.classes[i]; return null; }
function byName(a,b){ return a.name.localeCompare(b.name,"ko"); }
function rosterOf(data,cid,d){
  var out=[];
  data.enrollments.forEach(function(e){
    if (e.classId===cid && activeOn(e,d)){ var s=data.students.filter(function(x){return x.id===e.studentId;})[0]; if (s && out.indexOf(s)<0) out.push(s); }
  });
  return out.sort(byName);
}
// Attendance received before class (e.g. the academy's 수업일지 sheet). It is the default for that lesson until the teacher
// changes or confirms it: a teacher record in db.attendance always wins; expected values are never written on their own.
// Names as on the roster; "*" = everyone else on the roster that day.
function expectedStatus(d,c,s){   // per teacher: TEACHERS[].expected, keyed by her own class ids
  var cl=classById(c), T0=cl&&teacherOf(cl), m=T0 && T0.expected && T0.expected[d] && T0.expected[d][cl.rawId]; if (!m) return null;
  var st=studentById(s); if (!st) return null;
  return m[st.name] || m["*"] || null;
}
function isExpected(d,c,s){ return !db.attendance[akey(d,c,s)] && !!expectedStatus(d,c,s); }
function attStatus(d,c,s){ var r=db.attendance[akey(d,c,s)]; return r ? r.status : (expectedStatus(d,c,s) || "none"); }
// 숙제 확인, per lesson: db.homework["date_classId_studentId"] = {h:bool, at}. One check per student: 연습 and 리뷰 were
// combined (원장 feedback, 2026-11-10). Records from the two-box version ({p, r}) count as done if either box was checked.
// Each record may carry a teacher comment (note) per student per lesson (Jay, 2026-11-10).
// Two modes, per teacher (setting "hw"): "one" = a single check {h}; "two" = 연습 / 리뷰 boxes {p, r}. Records written in one
// mode read sensibly in the other: h counts as both boxes, and either box counts as h. done = the mode's notion of complete.
function hwGet(d,c,s){ var x=db.homework && db.homework[akey(d,c,s)];
  var h=!!(x && (x.h || x.p || x.r)), p=!!(x && (x.p || x.h)), r=!!(x && (x.r || x.h));
  return {h:h, p:p, r:r, done: hwTwo() ? (p && r) : h, note:(x && x.note) || "", set:!!x}; }
function hwWrite(d,c,s,p,r,note){ db.homework=db.homework||{}; var cur=hwGet(d,c,s), n=note===undefined?cur.note:note;
  db.homework[akey(d,c,s)] = hwTwo() ? {p:!!p,r:!!r,note:n,at:Date.now()} : {h:!!(p||r),note:n,at:Date.now()}; }
// 숙제 확인 covers students in the room for that lesson, 등원 and 지각: the teacher checks the textbook in person (Jay, 2026-11-10).
// 온라인 / 결석 / 미체크 students are left out of the list, the counts, "모두 했어요" and the Excel exports.
// Records already stored for them are kept, and come back if the student is changed to 등원.
function hwEligible(d,c,s){ var st=attStatus(d,c,s); return st==="present"||st==="late"; }
function hwSet(d,c,s,on,note){ hwWrite(d,c,s,on,on,note); }
var HW_QUICK=["책 안 가져옴","일부만 함","채점 안 함","오답 정리 안 함","질문 올림","다시 해 오기"];
function attNote(d,c,s){ var r=db.attendance[akey(d,c,s)]; return r && r.note ? r.note : ""; }

var PHASE_IDX={first:0,hint:1,closed:2};
var DOUBLE_MS=320;
function isPlayerStatus(st){ return st==="present"||st==="online"||st==="late"; }
function markCls(m){ return (m==="◎"||m==="O")?"ok":m==="△"?"mid":m==="X"?"bad":"none"; }
var ATT_CLS={present:"ok",online:"on",late:"mid",absent:"bad",none:"none"};
var ATT_KEYS=["present","online","late","absent","none"];
function qkey(sid,q){ return sid+"_"+q; }
function mkey(sid,q,st){ return sid+"_"+q+"_"+st; }
function getMark(sid,q,st){ return db.gbMarks[mkey(sid,q,st)]||null; }
function played(sess,q,st){ var j=(sess.joinedAt&&sess.joinedAt[st])||1; return sess.playerIds.indexOf(st)>=0 && q>=j; }
/* ---------- 골든벨 점수 (Jay, 2026-11-11) ----------
   Per question: ◎ 5, O 4, △ 3, X 2, 미표시 or 미참가 (–) 1. A session's score is the sum over its questions; max = 5 x questions.
   A question counts once it is settled (closed, or the session ended). The open question counts only for students already marked,
   so the live standings move as the teacher taps. Ranking = standard competition ranking (ties share a rank: 1, 1, 3).
   Nothing is stored: scores are always computed from gbMarks, so editing a mark later re-scores the session. */
var GB_PTS={"◎":5,"O":4,"△":3,"X":2}, GB_PTS_NONE=1, GB_PTS_MAX=5;
function gbQSettled(s,q){ var qd=db.gbQuestions[qkey(s.id,q)]; return s.status==="ended" || !!(qd && qd.phase==="closed"); }
function gbQPts(s,q,sid){   // points for one question, or null when it does not count yet
  var m=played(s,q,sid) ? getMark(s.id,q,sid) : null, mk=m&&m.mark;
  if (mk && GB_PTS[mk]) return GB_PTS[mk];
  return gbQSettled(s,q) ? GB_PTS_NONE : null;
}
function gbRankRows(rows){   // rows: [{p, pts}] -> sorted, with .rank (ties share)
  rows.sort(function(a,b){ return b.pts-a.pts || byName(a.p,b.p); });
  rows.forEach(function(r,i){ r.rank = (i && rows[i-1].pts===r.pts) ? rows[i-1].rank : i+1; });
  return rows;
}
function gbScores(s,upTo){   // session standings through question upTo (default: all)
  var Q=Math.min(upTo||s.questionCount,s.questionCount);
  var rows=s.playerIds.map(studentById).filter(Boolean).map(function(p){
    var pts=0, n=0; for (var q=1;q<=Q;q++){ var x=gbQPts(s,q,p.id); if (x!=null){ pts+=x; n++; } }
    return {p:p,pts:pts,n:n,max:n*GB_PTS_MAX};
  });
  return gbRankRows(rows);
}
function gbQRank(s,q){   // ranking for one question; students with no points yet are left out
  var rows=[]; s.playerIds.map(studentById).filter(Boolean).forEach(function(p){ var x=gbQPts(s,q,p.id); if (x!=null) rows.push({p:p,pts:x}); });
  return gbRankRows(rows);
}
function gbRankHtml(rows,showMax){
  return '<ol class="rk">'+rows.map(function(r){ return '<li'+(r.rank===1&&r.pts>0?' class="top"':'')+'><span class="rn">'+r.rank+'</span><span class="nm">'+esc(r.p.name)+'</span><span class="pt">'+r.pts+(showMax?' <small>/ '+r.max+'</small>':' <small>'+t("ptsUnit")+'</small>')+'</span></li>'; }).join("")+'</ol>';
}
function seatKey(d,c){ return d+"_"+c; }
function inRoom(d,c,sid){ var st=attStatus(d,c,sid); return st==="present"||st==="late"; }
// 자리배치 is a per-teacher setting (seatingOn()). Off: no button, no seat snapshot in 골든벨, no seat picker for late joiners,
// nothing in the Excel exports. Stored seating data is kept untouched either way.
function seatingFor(cid,d){  // stored map for this day, else the most recent earlier one (prefill)
  var k=seatKey(d,cid), r=db.seating[k];
  if (r) return {map:Object.assign({},r.seats),layout:r.layout||"4x3",teacher:r.teacher||"L",src:"saved"};
  var best=null; Object.keys(db.seating).forEach(function(x){ var p=x.split("_"); if (p[1]===cid && p[0]<d && (!best||p[0]>best)) best=p[0]; });
  if (!best){   // no seating yet: keep the side the teacher last used for this class (default: far left)
    var side="L", at="";
    Object.keys(db.seating).forEach(function(x){ var p=x.split("_"); if (p[1]===cid && db.seating[x].teacher && p[0]>at){ at=p[0]; side=db.seating[x].teacher; } });
    return {map:{},layout:"4x3",teacher:side,src:"none"};
  }
  r=db.seating[seatKey(best,cid)];
  return {map:Object.assign({},r.seats),layout:r.layout||"4x3",teacher:r.teacher||"L",src:"prev"};
}
// Front row under the seat grid: the 선생님 block sits in the far-left or far-right column (seating record .teacher = "L" | "R";
// older records without it = "L"). In 자리배치 the block is a button that moves it to the other side.
function frontRowHtml(layout,side,interactive,aide){   // aide: drawn from the back of the room, so the desk shows on the mirrored side
  var c3=colsOf(layout)===3, other=side==="R"?"L":"R", vis=aide?other:side;
  var desk=interactive ? '<button class="tdesk" data-act="teacherSide" data-side="'+other+'" aria-label="'+t("teacherDesk")+' · '+t("teacherTapHint")+'">🧑‍🏫 '+t("teacherDesk")+'<small>⇄ '+t("teacherSwap")+'</small></button>'
                       : '<div class="tdesk">🧑‍🏫 '+t("teacherDesk")+'</div>';
  var line='<div class="front">'+t("frontOnly")+'</div>';
  return '<div class="frontrow'+(c3?' c3':'')+(aide?' top':'')+'">'+(vis==="R"?line+desk:desk+line)+'</div>';
}
// 보는 위치 in 자리배치 (per device): "T" = teacher at the front (default), "A" = 보조교사 at the back of the room.
// The 보조교사 view is the same room turned 180°: back row at the bottom (nearest the 보조교사), left and right swapped,
// and the teacher's front row on top. Only the drawing changes; seat numbers and saved seating are the same in both views.
var SEAT_VIEW_KEY="fields-seat-view";
function seatView(){ return store.get(SEAT_VIEW_KEY)==="A" ? "A" : "T"; }
// The room as drawn from the current 보는 위치 (used by 골든벨 and the late-joiner seat picker; 자리배치 draws its own).
// cell(i) returns the html for real seat index i; the indices never change, only the drawing order and the front/back bars.
function seatRoomHtml(layout,side,cell){
  var aide=seatView()==="A", h='<div class="seatwrap">'+(aide?frontRowHtml(layout,side,false,true):'')+'<div class="seats'+(colsOf(layout)===3?' c3':'')+'">';
  for (var k=0;k<12;k++) h+=cell(aide?11-k:k);
  return h+'</div>'+(aide?'<div class="front back">'+t("backAide")+'</div>':frontRowHtml(layout,side,false))+'</div>';
}
function seatViewSeg(){
  return '<div class="sideseg viewseg"><span class="lbl2">👀 '+t("seatViewLbl")+'</span>'+[["T","viewT"],["A","viewA"]].map(function(x){ return '<button data-act="seatView" data-v="'+x[0]+'" aria-pressed="'+(seatView()===x[0])+'">'+t(x[1])+'</button>'; }).join("")+'</div>';
}
function teacherSideFor(cid,d,sess){ return (sess && sess.teacher) || seatingFor(cid,d).teacher; }
function colsOf(layout){ return layout==="3x4" ? 3 : 4; }
function visibleSeats(map,cid,d){ var m={}; Object.keys(map).forEach(function(i){ if (inRoom(d,cid,map[i])) m[i]=map[i]; }); return m; }
// A class meets on its own days (this teacher) plus partnerDays (the co-teacher's session of the same class).
function lessonDays(c){ return c.days.concat(c.partnerDays||[]); }
function isLessonDay(c,d){ return lessonDays(c).indexOf(wd(d))>=0 && (!c.start || c.start<=d) && (!c.end || d<=c.end); }
function roleTag(c,d){   // her role on her own day; the other teacher's role on the partner's (view-only) day
  if (!c.role) return "";
  var mine=c.role==="A"?"roleA":"roleB", other=c.role==="A"?"roleBDay":"roleADay";
  return isPartnerDay(c,d) ? ' <span class="lvtag rp">'+t(other)+'</span>' : ' <span class="lvtag '+(c.role==="A"?"ra":"rb")+'">'+t(mine)+'</span>';
}
function isPartnerDay(c,d){ return (c.partnerDays||[]).indexOf(wd(d))>=0; }
function stepLesson(c,d,dir){   // previous/next date this class meets; null if none within 2 weeks (or before its start)
  for (var i=1;i<=14;i++){ var x=addDays(d,dir*i); if ((c.start && x<c.start) || (c.end && x>c.end)) return null; if (isLessonDay(c,x)) return x; }
  return null;
}
function partnerStatus(d,c,s){ return (db.partnerAtt && db.partnerAtt[akey(d,c,s)]) || "none"; }
function sessionsOf(cid,d){ return Object.keys(db.gbSessions).map(function(k){return db.gbSessions[k];}).filter(function(s){return s.classId===cid&&s.date===d;}).sort(function(a,b){return a.startedAt-b.startedAt;}); }
