/* js/data.js — teacher PIN, settings, seeding (mergeTeacher), load / persist / save, backup
   Plain script, no IIFE: the app's files share the global scope and index.html loads them in a fixed order
   (i18n → model → teachers → data → views → excel → app). Code that runs at load may only use earlier files. */

var TEACHER_KEY="fields-teacher";
// Switching teachers on a device needs the 6-digit password (Jay, 2026-11-10). Only a hash is kept in the page.
// This is a lock against casual switching, not real security: the check runs in the browser. The first pick on a new device is free.
var PIN_HASH=1711874463;
function pinOk(p){ return hash("fields-pin|"+p)===PIN_HASH; }
function pinSheet(){
  var p=state.pin||"", err=!!state.pinErr, dots="";
  for (var i=0;i<6;i++) dots+='<i class="'+(i<p.length?"f":"")+'"></i>';
  var keys=["1","2","3","4","5","6","7","8","9","","0","del"];
  return '<div class="scrim" data-act="closeSheet"></div><div class="sheet pinsheet" role="dialog" aria-modal="true" aria-label="'+t("pinTitle")+'"><h2>🔒 '+t("pinTitle")+'</h2><p class="hint">'+t("pinHint")+'</p>'+
    '<div class="pindots'+(err?" err":"")+'" aria-label="'+p.length+'/6">'+dots+'</div><p class="pinmsg" role="alert">'+(err?t("pinWrong"):"")+'</p><div class="pinpad">'+
    keys.map(function(k){ return k==="" ? '<span></span>' : k==="del" ? '<button class="fn" data-act="pinDel">⌫ '+t("pinDel")+'</button>' : '<button data-act="pinKey" data-k="'+k+'">'+k+'</button>'; }).join("")+
    '</div></div>';
}
function pinPress(k){
  if (k==="del"){ state.pin=(state.pin||"").slice(0,-1); state.pinErr=false; render(); return; }
  state.pin=((state.pin||"")+k).slice(0,6); state.pinErr=false;
  if (state.pin.length===6){
    if (pinOk(state.pin)){ state.pin=""; state.pickUnlocked=true; state.view="pick"; state.sheet=null; render(); window.scrollTo(0,0); return; }
    state.pin=""; state.pinErr=true;
  }
  render();
}
function teacherById(id){ for (var i=0;i<TEACHERS.length;i++) if (TEACHERS[i].id===id) return TEACHERS[i]; return null; }
var T=teacherById(store.get(TEACHER_KEY));   // the teacher using this device (null → picker)
function teacherOf(c){ return teacherById(c.teacherId); }
function myClasses(){ return T ? db.classes.filter(function(c){ return c.teacherId===T.id; }) : []; }
// per-teacher feature settings: db.settings[teacherId] = {seating, hw}; defaults come from TEACHERS
function setting(k){ var s=T && db.settings && db.settings[T.id]; return s && (k in s) ? s[k] : (T ? T.defaults[k] : null); }
function seatingOn(){ return !!setting("seating"); }
function hwTwo(){ return setting("hw")==="two"; }

var REAL_CODE={P:"present",L:"late",A:"absent",E:"present"};   // E = 조퇴 (left early): 등원 + note
var REAL_NOTE={E:"조퇴"};
var SEAT_ORDER=[8,9,10,11,4,5,6,7,0,1,2,3];   // fill the front row (bottom of the screen) first
// History lessons added to TEACHERS after v1 (11/10 16:00). Devices that ran v1 still need these seeded.
var ADDED_AFTER_V1={"eje|h6|2026-11-03":1,"eje|h6|2026-11-05":1};
function sidOf(name){ return "s-"+name; }
function emptyDb(){ return {classes:[],students:[],enrollments:[],attendance:{},partnerAtt:{},homework:{},gbSessions:{},gbQuestions:{},gbMarks:{},seating:{},settings:{},seeded:{}}; }
// Adds/updates a teacher's classes, students and enrollments (every load, so config edits reach saved devices), and seeds
// her history (real attendance, partner days, sample 골든벨) once per device. Records she entered are never touched.
function mergeTeacher(data,T0){
  var has=function(arr,id){ return arr.some(function(o){return o.id===id;}); };
  T0.classes.forEach(function(c){
    var cid=T0.id+"-"+c.id;
    var obj={id:cid,rawId:c.id,teacherId:T0.id,name:c.name,days:c.days,partnerDays:c.partnerDays||[],partner:c.partner||"",time:c.time,levelup:!!c.levelup,sub:!!c.sub,role:c.role||null,start:c.start||null,end:c.end||null,log:c.log||null,plan:c.plan||null,rosterPending:!c.roster.length&&!(T0.extraEnroll||[]).some(function(x){return x.classId===c.id;})};
    var cur=data.classes.filter(function(o){return o.id===cid;})[0];
    if (cur) Object.assign(cur,obj); else data.classes.push(obj);
    c.roster.forEach(function(nm){
      var sid=sidOf(nm); if (!has(data.students,sid)) data.students.push({id:sid,name:nm});
      var eid="e-"+cid+"-"+sid; if (!has(data.enrollments,eid)) data.enrollments.push({id:eid,studentId:sid,classId:cid,start:c.start||"2026-09-01",end:c.end?addDays(c.end,1):null});
    });
  });
  (T0.extraEnroll||[]).forEach(function(x){
    var sid=sidOf(x.name), cid=T0.id+"-"+x.classId, eid="e-"+cid+"-"+sid;
    if (!has(data.students,sid)) data.students.push({id:sid,name:x.name});   // a new student who isn't on any roster yet
    if (!has(data.enrollments,eid)) data.enrollments.push({id:eid,studentId:sid,classId:cid,start:x.start,end:null});
  });
  // History is seeded once per (teacher, class, date, kind), so lessons added to the config later still reach devices that
  // already have data, and a record the teacher cleared is never brought back.
  var once=function(k){ k=T0.id+"|"+k; if (data.seeded[k]) return false; data.seeded[k]=true; return true; };
  if (data.seeded[T0.id]===true){   // devices seeded by v1 (one flag per teacher): treat everything shipped in v1 as done
    delete data.seeded[T0.id];
    T0.classes.forEach(function(c){ ["realAtt","partnerAtt"].forEach(function(src){ Object.keys((T0[src]||{})[c.id]||{}).forEach(function(d){ if (!ADDED_AFTER_V1[T0.id+"|"+c.id+"|"+d]) { data.seeded[T0.id+"|"+src+"|"+c.id+"|"+d]=true; data.seeded[T0.id+"|gb|"+c.id+"|"+d]=true; } }); }); });
  }
  var today=todayIso();
  // roster order for the history strings = config roster, then extra enrollments
  var order=function(c){ return c.roster.map(sidOf).concat((T0.extraEnroll||[]).filter(function(x){return x.classId===c.id;}).map(function(x){return sidOf(x.name);})); };
  T0.classes.forEach(function(c){
    var cid=T0.id+"-"+c.id, ros=order(c);
    Object.keys((T0.partnerAtt||{})[c.id]||{}).forEach(function(d){
      if (!once("partnerAtt|"+c.id+"|"+d)) return;
      T0.partnerAtt[c.id][d].split("").forEach(function(code,i){ var k=akey(d,cid,ros[i]); if (REAL_CODE[code] && !data.partnerAtt[k]) data.partnerAtt[k]=REAL_CODE[code]; });
    });
    Object.keys((T0.realAtt||{})[c.id]||{}).forEach(function(d){
      if (!once("realAtt|"+c.id+"|"+d)) return;
      T0.realAtt[c.id][d].split("").forEach(function(code,i){ var k=akey(d,cid,ros[i]); if (REAL_CODE[code] && !data.attendance[k]) data.attendance[k]={status:REAL_CODE[code],note:REAL_NOTE[code]||""}; });
    });
    if (!T0.sampleGb || c.levelup || c.sub) return;
    // Sample 골든벨 on past real lessons (no comments on real students); marks follow a stable per-student tendency.
    Object.keys((T0.realAtt||{})[c.id]||{}).filter(function(d){return d<today;}).sort().forEach(function(d){
      if (!once("gb|"+c.id+"|"+d)) return;
      if (Object.keys(data.gbSessions).some(function(k){ return data.gbSessions[k].classId===cid && data.gbSessions[k].date===d; })) return;
      var status=function(id){ var a=data.attendance[akey(d,cid,id)]; return a?a.status:"none"; };
      var players=rosterOf(data,cid,d).map(function(s){return s.id;}).filter(function(id){ return isPlayerStatus(status(id)); });
      if (!players.length) return;
      var sid="g-"+cid+"-"+d, Q=4+hash(sid)%4;
      data.gbSessions[sid]={id:sid,classId:cid,date:d,status:"ended",playerIds:players,joinedAt:{},seats:{},layout:"4x3",questionCount:Q,currentQ:Q,startedAt:1,sample:true};
      for (var q=1;q<=Q;q++){
        data.gbQuestions[qkey(sid,q)]={phase:"closed"};
        var hard=hash(sid+"q"+q)%30;
        players.forEach(function(st){
          var skill=hash(cid+st)%30, r=(hash(sid+q+st)%70)+hard-skill+15;
          var mark=r<40?"◎":r<58?"O":r<75?"△":r<93?"X":null;
          if (mark) data.gbMarks[mkey(sid,q,st)]={mark:mark,phase:"first",comment:"",overridden:false};
        });
      }
    });
  });
}
// Removes every record of one teacher's classes (used by "초기화" before re-seeding her)
function wipeTeacher(data,tid){
  var mine={}; data.classes.forEach(function(c){ if (c.teacherId===tid) mine[c.id]=true; });
  ["attendance","partnerAtt","homework","seating"].forEach(function(col){ Object.keys(data[col]).forEach(function(k){ if (mine[k.split("_")[1]]) delete data[col][k]; }); });
  Object.keys(data.gbSessions).forEach(function(sid){ if (!mine[data.gbSessions[sid].classId]) return; delete data.gbSessions[sid];
    ["gbQuestions","gbMarks"].forEach(function(col){ Object.keys(data[col]).forEach(function(k){ if (k.indexOf(sid+"_")===0) delete data[col][k]; }); }); });
  Object.keys(data.seeded).forEach(function(k){ if (k===tid || k.indexOf(tid+"|")===0) delete data.seeded[k]; }); delete data.settings[tid];
}
function load(){
  var data=null;
  try { var raw=store.get(STORE_KEY); if (raw){ var x=JSON.parse(raw); if (x && x.gbSessions) data=x; } } catch(e){}
  data=Object.assign(emptyDb(),data||{});
  TEACHERS.forEach(function(T0){ mergeTeacher(data,T0); });
  return data;
}
var db=load();
function persist(){ var ok=store.set(STORE_KEY,JSON.stringify(db)); if (!ok) toast(t("saveFail")); return ok; }
function save(msg){ if (persist()) toast(msg||t("saved")); }

/* ---------- backup (JSON) ----------
   Export: this device's whole store. Import accepts either
   - a backup of this app ({app:"fields-attendance"}) → replaces this device's data after a confirm, or
   - a backup from a teacher's old single-teacher app ({legacy:"<storage key>", db}) → merged into that teacher's
     classes; the old app's records win over what this page ships (sample 골든벨 on the same lesson is replaced). */
var APP_ID="fields-attendance";
function importLegacy(payload){
  var T0=null; TEACHERS.forEach(function(x){ if (x.legacyKey===payload.legacy) T0=x; });
  if (!T0) throw {code:"unknown"};
  var x=payload.db, raw={}; T0.classes.forEach(function(c){ raw[c.id]=T0.id+"-"+c.id; });
  var sname={}; (x.students||[]).forEach(function(s){ sname[s.id]=s.name; });
  var ms=function(id){ var n=sname[id]; if (!n) return null; var sid=sidOf(n); if (!studentById(sid)) db.students.push({id:sid,name:n}); return sid; };
  var n=0, mapKey=function(k){ var p=k.split("_"); if (p.length!==3 || !raw[p[1]]) return null; var s=ms(p[2]); return s ? akey(p[0],raw[p[1]],s) : null; };
  ["attendance","partnerAtt","homework"].forEach(function(col){ Object.keys(x[col]||{}).forEach(function(k){ var nk=mapKey(k); if (nk){ db[col][nk]=x[col][k]; n++; } }); });
  var mapSeats=function(m){ var o={}; Object.keys(m||{}).forEach(function(i){ var s=ms(m[i]); if (s) o[i]=s; }); return o; };
  Object.keys(x.seating||{}).forEach(function(k){ var p=k.split("_"); if (!raw[p[1]]) return; var r=x.seating[k]; db.seating[p[0]+"_"+raw[p[1]]]=Object.assign({},r,{seats:mapSeats(r.seats)}); n++; });
  Object.keys(x.gbSessions||{}).forEach(function(oid){
    var s=x.gbSessions[oid], cid=raw[s.classId]; if (!cid) return;
    // one Golden Bell per class per day: drop whatever this device has for that lesson
    Object.keys(db.gbSessions).forEach(function(k){ var o=db.gbSessions[k]; if (o.classId===cid && o.date===s.date){ delete db.gbSessions[k];
      ["gbQuestions","gbMarks"].forEach(function(col){ Object.keys(db[col]).forEach(function(kk){ if (kk.indexOf(k+"_")===0) delete db[col][kk]; }); }); } });
    var nid="L-"+T0.id+"-"+String(oid).replace(/_/g,"-"), joined={};
    Object.keys(s.joinedAt||{}).forEach(function(st){ var m=ms(st); if (m) joined[m]=s.joinedAt[st]; });
    db.gbSessions[nid]=Object.assign({},s,{id:nid,classId:cid,playerIds:(s.playerIds||[]).map(ms).filter(Boolean),joinedAt:joined,seats:mapSeats(s.seats)});
    Object.keys(x.gbQuestions||{}).forEach(function(k){ if (k.indexOf(oid+"_")===0) db.gbQuestions[nid+k.slice(String(oid).length)]=x.gbQuestions[k]; });
    Object.keys(x.gbMarks||{}).forEach(function(k){ if (k.indexOf(oid+"_")!==0) return; var p=k.slice(String(oid).length+1).split("_"), st=ms(p[1]); if (st) db.gbMarks[mkey(nid,p[0],st)]=x.gbMarks[k]; });
    n++;
  });
  return {teacher:T0,n:n};
}
