/* js/excel.js — Excel export (ExcelJS): 공식 출석부 / 수업일지 layout (buildLogbook), 기록 요약 (buildWorkbook), runExport, export sheet
   Plain script, no IIFE: the app's files share the global scope and index.html loads them in a fixed order
   (i18n → model → teachers → data → views → excel → app). Code that runs at load may only use earlier files. */

/* ---------- Excel export ---------- */
// Builds a structured .xlsx in the browser (ExcelJS, loaded on demand) and downloads it (js/files.js).
// Pinned to exceljs@4.4.0; the integrity hash makes the browser refuse the file if the CDN ever serves anything else.
// To upgrade: change the version, then recompute the hash (README → "Updating ExcelJS").
var EXCELJS_URL="https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js";
var EXCELJS_SRI="sha384-Pqp51FUN2/qzfxZxBCtF0stpc9ONI6MYZpVqmo8m20SoaQCzf+arZvACkLkirlPz";
var XL={ ok:["FFDDF2E5","FF137044"], on:["FFD9F1F4","FF0B6E7D"], mid:["FFFCEFD2","FF8A5100"], bad:["FFFCE3E0","FFB3261E"],
         none:["FFFFFFFF","FF5A6573"], na:["FFF3F5F8","FF5A6573"], head:["FFE6EBFB","FF2346C8"] };
function loadExcelJS(){
  if (window.ExcelJS) return Promise.resolve();
  return new Promise(function(res,rej){ var s=document.createElement("script"); s.src=EXCELJS_URL; s.integrity=EXCELJS_SRI; s.crossOrigin="anonymous"; s.onload=function(){res();}; s.onerror=function(){rej(new Error("load"));}; document.head.appendChild(s); });
}
function mondayOf(d){ var w=wd(d); return addDays(d, w===0?-6:1-w); }
function presetRange(p){
  var td=todayIso();
  if (p==="today") return [td,td];
  if (p==="week") return [mondayOf(td),td];
  return [td.slice(0,8)+"01",td];   // month
}
var MAX_RANGE_DAYS=366;
function rangeDays(a,b){ return Math.round((parse(b)-parse(a))/864e5)+1; }
function datesBetween(a,b){ var out=[]; for (var d=a; d<=b && out.length<400; d=addDays(d,1)) out.push(d); return out; }
function classDates(c,a,b){   // scheduled dates, plus any date with records (e.g. makeup)
  var set={};
  var td=todayIso();
  datesBetween(a,b).forEach(function(d){ if (d<=td && c.days.indexOf(wd(d))>=0 && (!c.start || c.start<=d) && (!c.end || d<=c.end)) set[d]=1; });
  Object.keys(db.attendance).forEach(function(k){ var p=k.split("_"); if (p[1]===c.id && p[0]>=a && p[0]<=b) set[p[0]]=1; });
  Object.keys(db.gbSessions).forEach(function(k){ var s=db.gbSessions[k]; if (s.classId===c.id && s.date>=a && s.date<=b) set[s.date]=1; });
  return Object.keys(set).sort();
}
function firstDay(c){ var d=Math.min.apply(null,c.days.map(function(w){return w===0?7:w;})); return d; }
function classesInRange(a,b){ return myClasses().filter(function(c){ return classDates(c,a,b).length; }).sort(function(x,y){ return (firstDay(x)-firstDay(y)) || x.time.localeCompare(y.time) || x.name.localeCompare(y.name,"ko"); }); }
function sheetName(base,used){
  var n=String(base).replace(/[\[\]:*?\/\\]/g,"-").slice(0,31), i=2, out=n;
  while (used[out]) { var suf="("+(i++)+")"; out=n.slice(0,31-suf.length)+suf; }
  used[out]=1; return out;
}
function style(cell,kind,bold){
  var c=XL[kind]; cell.fill={type:"pattern",pattern:"solid",fgColor:{argb:c[0]}};
  cell.font={color:{argb:c[1]},bold:!!bold}; cell.alignment={horizontal:"center",vertical:"middle"};
  cell.border={top:{style:"thin",color:{argb:"FFDBE0E7"}},bottom:{style:"thin",color:{argb:"FFDBE0E7"}},left:{style:"thin",color:{argb:"FFDBE0E7"}},right:{style:"thin",color:{argb:"FFDBE0E7"}}};
}
function mdLabel(d){ var x=parse(d); return (x.getMonth()+1)+"/"+x.getDate()+"("+wdName(x.getDay())+")"; }


/* ---------- 수업일지 export (academy's class-log sheet layout) ----------
   One sheet per lesson (class × date) in the academy's own layout:
   header (날짜 / 시각 / 반명 / 시수 / 목표 진도 / 사고력 과제 / 공통 연산 과제 / 안내 사항)
   + table 연번 · 이름 · 상담기록 1–4주차 · 출석 · 과제(연습 · 리뷰 · 현재 연산 교재 · 연산 진도 · 연산 진도율) · 질문 · 특이사항 (+ 골든벨).
   Filled from the app: date, class, roster, 출석, attendance notes, 골든벨 marks.
   Prefilled from the 대치 2611 진도표 (that week's plan): 목표 진도, 공통 연산 과제, notices → 안내 사항(수업 후).
   Everything else is left for the teacher, with the same dropdowns (상담기록, 출석, 시수, ☐/☑). */
function logPlan(cid,d){
  var c=classById(cid), T0=c&&teacherOf(c), w=-1; ((T0&&T0.planWeeks)||[]).forEach(function(m,i){ if (d>=m && d<addDays(m,7)) w=i; });
  var raw=(w>=0 && c.plan) ? (c.plan[w]||"") : "", out={goal:[],calc:[],after:[]};
  raw.split("\n").map(function(s){return s.trim();}).filter(Boolean).forEach(function(line){
    var paren=/^\(.*\)$/.test(line), inner=paren?line.slice(1,-1).trim():line;
    if (/연산|더클셈|기적/.test(inner) && !/공지/.test(inner)) out.calc.push(inner);
    else if (paren) out.after.push(inner);
    else out.goal.push(line);
  });
  return {goal:out.goal.join(" / "),calc:out.calc.join(" / "),after:out.after.join(" / ")};
}
function hhmm(ms){ var x=new Date(ms); return pad(x.getHours())+":"+pad(x.getMinutes()); }
var LOG_MARK_COL={"◎":["FFDDF2E5","FF137044"],"O":["FFDDF2E5","FF137044"],"△":["FFFCEFD2","FF8A5100"],"X":["FFFCE3E0","FFB3261E"],"·":["FFFFFFFF","FF9BA7B5"],"–":["FFF1F3F6","FF9BA7B5"]};
var LOG_ATT_COL={"등원":["FFD6E6FB","FF1F4E9E"],"온라인":["FFD9F1F4","FF0B6E7D"],"지각":["FFFCEFD2","FF8A5100"],"결석":["FFFCE3E0","FFB3261E"]};
function logName(n){ return String(n).replace(/(\d+|[A-Z])$/,""); }   // 강태현2 → 강태현, 박준우B → 박준우 (roster disambiguators)
function buildLogbook(a,b,classIds){
  var wb=new ExcelJS.Workbook(), used={}, n=0;
  wb.creator="학원 출석부";
  var NAVY="FF2E3A8C", LINE={style:"thin",color:{argb:"FFC9CED6"}}, BOX={top:LINE,bottom:LINE,left:LINE,right:LINE};
  var ATT={present:"등원",online:"온라인",late:"지각",absent:"결석",none:""};
  function put(ws,addr,val,o){
    o=o||{}; var c=ws.getCell(addr); c.value=val;
    c.font={bold:!!o.bold,size:o.size||11,color:{argb:o.color||"FF1F2937"}};
    c.alignment={horizontal:o.align||"center",vertical:"middle",wrapText:true};
    if (o.fill) c.fill={type:"pattern",pattern:"solid",fgColor:{argb:o.fill}};
    c.border=BOX; return c;
  }
  function box(ws,r1,c1,r2,c2,val,o){ if (r1!==r2||c1!==c2) ws.mergeCells(r1,c1,r2,c2); for (var r=r1;r<=r2;r++) for (var c=c1;c<=c2;c++) ws.getCell(r,c).border=BOX; return put(ws,ws.getCell(r1,c1).address,val,o); }
  function list(cell,items){ cell.dataValidation={type:"list",allowBlank:true,formulae:['"'+items.join(",")+'"']}; }
  var classes=classesInRange(a,b).filter(function(c){ return classIds.indexOf(c.id)>=0; });
  classes.forEach(function(c){
    classDates(c,a,b).filter(function(d){ return !isPartnerDay(c,d); }).forEach(function(d){
      var meta=c.log||{code:c.name,slot:"",hours:"3시간"}, plan=logPlan(c.id,d), x=parse(d);
      var ws=wb.addWorksheet(sheetName(pad(x.getMonth()+1)+pad(x.getDate())+" "+meta.code,used),{views:[{state:"frozen",ySplit:8}]}); n++;
      var widths=[6,11,11,11,11,11,13,7,7,18,10,11,16,22,14];
      widths.forEach(function(w,i){ ws.getColumn(i+1).width=w; });
      var L={bold:true,color:NAVY,fill:"FFF4F6FA"}, V={color:"FF4F5B93"};
      // --- header block ---
      box(ws,1,5,1,6,"날짜",L); box(ws,1,7,1,14,(x.getMonth()+1)+"월 "+x.getDate()+"일",{bold:true,size:16,color:NAVY});
      box(ws,2,2,2,2,"시각",L); box(ws,2,3,2,4,meta.slot,{bold:true,size:14,color:NAVY});
      box(ws,3,2,4,2,"반명",L); box(ws,3,3,4,4,meta.code,{bold:true,size:14,color:NAVY});
      box(ws,5,2,5,2,"시수",L); var hrs=box(ws,5,3,5,4,meta.hours,{fill:"FFE9ECF1"}); list(hrs,["1시간","2시간","3시간"]);
      box(ws,2,5,2,6,"목표 진도",L);       box(ws,2,7,2,14,plan.goal,V);
      box(ws,3,5,3,6,"사고력 과제",L);     box(ws,3,7,3,14,"",V);
      box(ws,4,5,4,6,"공통 연산 과제",L);  box(ws,4,7,4,14,plan.calc,V);
      box(ws,5,5,6,5,"안내 사항",L); box(ws,5,6,5,6,"(수업 전)",L); box(ws,6,6,6,6,"(수업 후)",L);
      box(ws,5,7,5,14,"",V); box(ws,6,7,6,14,plan.after,V);
      [1,2,3,4,5,6].forEach(function(r){ ws.getRow(r).height=r===1?30:24; });
      // --- table header ---
      var H={bold:true,fill:"FFF4F6FA"};
      box(ws,7,1,8,1,"연번",H); box(ws,7,2,8,2,"이름",H); box(ws,7,3,7,6,"상담기록",H);
      ["1주차","2주차","3주차","4주차"].forEach(function(s,i){ box(ws,8,3+i,8,3+i,s,H); });
      box(ws,7,7,8,7,"출석",H); box(ws,7,8,7,12,"과제",H);
      if (hwTwo()){ box(ws,8,8,8,8,"연습",H); box(ws,8,9,8,9,"리뷰",H); } else box(ws,8,8,8,9,"숙제",H);   // one-check mode merges 연습 + 리뷰
      ["현재 연산 교재","연산 진도","연산 진도율"].forEach(function(s,i){ box(ws,8,10+i,8,10+i,s,H); });   // 연습 + 리뷰 combined
      box(ws,7,13,8,13,"질문",H); box(ws,7,14,8,14,"특이사항",H);
      var sess=sessionsOf(c.id,d)[0], Q=0;
      if (sess){
        Q=sess.questionCount; if (sess.status==="active" && Q>1 && !qHasMarks(sess,Q)) Q--;
        box(ws,7,15,7,16+Q,"골든벨",H);
        for (var qi=1;qi<=Q;qi++){ box(ws,8,14+qi,8,14+qi,"Q"+qi,H); ws.getColumn(14+qi).width=6; }
        box(ws,8,15+Q,8,15+Q,"점수",H); box(ws,8,16+Q,8,16+Q,"순위",H); ws.getColumn(15+Q).width=9; ws.getColumn(16+Q).width=7;
      }
      ws.getRow(7).height=22; ws.getRow(8).height=30;
      // --- students ---
      var roster=rosterOf(db,c.id,d), r=9, gsc={}, gmax=0;
      if (sess) gbScores(sess).forEach(function(x){ gsc[x.p.id]=x; gmax=Math.max(gmax,x.max); });
      roster.forEach(function(s,i){
        put(ws,"A"+r,i+1); put(ws,"B"+r,logName(s.name),{align:"center"});
        for (var k=0;k<4;k++){ var cc=put(ws,ws.getCell(r,3+k).address,"-",{fill:"FFE9ECF1",color:"FF5A6573"}); list(cc,["-","상담완료"]); }
        var st=attStatus(d,c.id,s.id), AC=LOG_ATT_COL[ATT[st]]||["FFE9ECF1","FF1F2937"], ac=put(ws,"G"+r,ATT[st],{fill:AC[0],color:AC[1],bold:true}); list(ac,["등원","온라인","지각","결석"]);
        var hw=hwGet(d,c.id,s.id), hwIn=hwEligible(d,c.id,s.id);
        if (!hwIn){ box(ws,r,8,r,9,"–",{fill:"FFE9ECF1",color:"FF9BA7B5"}); hw={note:""}; }   // not in the room (등원/지각) → no homework check
        else if (hwTwo()) [["H","p"],["I","r"]].forEach(function(x2,ix){ var on2=hw[x2[1]], cb2=put(ws,x2[0]+r,on2?"☑":"☐",{size:14,bold:on2,color:on2?"FF137044":"FF1F2937",fill:on2?"FFDDF2E5":null}); list(cb2,["☐","☑"]); if (ix===0 && hw.note) cb2.note="숙제: "+hw.note; });
        else { var hon=hw.h, cb=box(ws,r,8,r,9,hon?"☑":"☐",{size:14,bold:hon,color:hon?"FF137044":"FF1F2937",fill:hon?"FFDDF2E5":null}); list(cb,["☐","☑"]); if (hw.note) cb.note="숙제: "+hw.note; }
        put(ws,"J"+r,"",{fill:"FFE9ECF1"}); ["K","L","M"].forEach(function(col){ put(ws,col+r,""); });
        var notes=[], an=attNote(d,c.id,s.id); if (an) notes.push(an); if (hw.note) notes.push("숙제: "+hw.note);
        for (var q=1;q<=Q;q++){
          var pl=played(sess,q,s.id), m=pl?getMark(sess.id,q,s.id):null, mk=!pl?"–":(m&&m.mark?m.mark:"·");
          var MC=LOG_MARK_COL[mk]||LOG_MARK_COL["·"], gc=put(ws,ws.getCell(r,14+q).address,mk,{bold:true,size:12,fill:MC[0],color:MC[1]});
          if (m && m.comment){ gc.note="Q"+q+" "+(m.mark||"·")+": "+m.comment; notes.push("Q"+q+" "+(m.mark||"·")+": "+m.comment); }
        }
        if (Q){ var g0=gsc[s.id];   // 골든벨 점수 (◎5 O4 △3 X2 미표시·미참가 1) and rank in the class that day
          put(ws,ws.getCell(r,15+Q).address,g0?g0.pts:"–",{bold:true,size:12,fill:g0?(g0.rank===1?"FFDDF2E5":null):"FFF1F3F6",color:g0?(g0.rank===1?"FF137044":"FF1F2937"):"FF9BA7B5"});
          put(ws,ws.getCell(r,16+Q).address,g0?g0.rank:"–",{bold:!!g0&&g0.rank<=3,fill:g0?null:"FFF1F3F6",color:g0?"FF1F2937":"FF9BA7B5"}); }
        put(ws,"N"+r,notes.join("\n"),{align:"left"});
        ws.getRow(r).height=Math.max(22,16*notes.length+6); r++;
      });
      var last=Math.max(9,r-1);
      // 골든벨 footer: correct before hint (◎ + O) / players, per question
      if (Q){
        box(ws,r,1,r,14,"골든벨 정답 (◎+O) / 참가",{bold:true,align:"right",fill:"FFF4F6FA",color:NAVY});
        for (var q2=1;q2<=Q;q2++){
          var np=0, nc=0; roster.forEach(function(s){ if (!played(sess,q2,s.id)) return; np++; var m=getMark(sess.id,q2,s.id); if (m && (m.mark==="◎"||m.mark==="O")) nc++; });
          put(ws,ws.getCell(r,14+q2).address,nc+"/"+np,{bold:true,fill:"FFF4F6FA",color:NAVY});
        }
        put(ws,ws.getCell(r,15+Q).address,"만점 "+gmax,{bold:true,fill:"FFF4F6FA",color:NAVY}); put(ws,ws.getCell(r,16+Q).address,"",{fill:"FFF4F6FA"});
        ws.getRow(r).height=22; r++;
      }
      // 수업 기록 (class-time log): when each part of the lesson was recorded
      r++;
      var atts=roster.map(function(s){ return db.attendance[akey(d,c.id,s.id)]; }).filter(function(x){ return x && x.at; }).map(function(x){ return x.at; }).sort();
      var nExp=roster.filter(function(s){ return isExpected(d,c.id,s.id); }).length;
      var attTxt = atts.length ? (hhmm(atts[0])+(atts.length>1&&hhmm(atts[atts.length-1])!==hhmm(atts[0])?" – "+hhmm(atts[atts.length-1])+" (마지막 수정)":"")) : (nExp?"미리 받은 출석 정보 (수업 중 확인 안 됨)":"기록 시각 없음");
      if (atts.length && nExp) attTxt+=" · "+nExp+"명은 미리 받은 정보 그대로";
      var gbTxt;
      if (noGb(c)) gbTxt=c.sub?"부담임 수업 · 골든벨 없음":"레벨업 특강 · 골든벨 없음";
      else if (!sess) gbTxt="진행 안 함";
      else gbTxt=(sess.startedAt>1e12?hhmm(sess.startedAt):"시각 없음")+(sess.endedAt?" – "+hhmm(sess.endedAt):sess.status==="active"?" – (진행 중)":"")+" · "+Q+"문제 · 참가 "+sess.playerIds.length+"명";
      var srec=seatingOn()?db.seating[seatKey(d,c.id)]:null, gseat=seatingOn()&&sess&&sess.seats&&Object.keys(sess.seats).length?sess.seats:null;
      var seatMap=gseat || (srec?visibleSeats(srec.seats||{},c.id,d):null), seatLayout=(gseat?sess.layout:srec&&srec.layout)||"4x3";
      var nSeat=seatMap?Object.keys(seatMap).length:0;
      var seatTxt=nSeat ? ((srec&&srec.at?hhmm(srec.at)+" 저장 · ":"")+nSeat+"명 배치"+(gseat?" (골든벨 시작 때 기준)":"")) : "없음";
      box(ws,r,1,r,14,"수업 기록",{bold:true,color:NAVY,fill:"FFF4F6FA",align:"left"}); ws.getRow(r).height=22; r++;
      var hwRos=roster.filter(function(s){ return hwEligible(d,c.id,s.id); });   // 등원 + 지각 students only
      var hwRecs=hwRos.map(function(s){ return db.homework && db.homework[akey(d,c.id,s.id)]; }).filter(Boolean), hwDoneN=hwRos.filter(function(s){ return hwGet(d,c.id,s.id).done; }).length;
      var hwAt=hwRecs.map(function(x){ return x.at; }).filter(function(x){ return x>1e12; }).sort(), hwNoteN=hwRos.filter(function(s){ return hwGet(d,c.id,s.id).note; }).length;
      var hwTxt=hwRecs.length ? (hwDoneN+" / "+hwRos.length+"명 완료 (등원·지각 학생)"+(hwNoteN?" · 메모 "+hwNoteN+"명":"")+(hwAt.length?" · "+hhmm(hwAt[hwAt.length-1])+" 마지막 체크":"")) : "체크 안 함";
      [["출석 체크",attTxt],["숙제 확인",hwTxt],["골든벨",gbTxt]].concat(seatingOn()?[["자리배치",seatTxt]]:[]).forEach(function(p){
        box(ws,r,1,r,2,p[0],{bold:true,color:NAVY,fill:"FFF4F6FA"}); box(ws,r,3,r,14,p[1],{align:"left"}); ws.getRow(r).height=22; r++;
      });
      // 자리배치 grid (teacher's view: back row on top, front row at the bottom)
      if (nSeat){
        r++;
        var cols=colsOf(seatLayout), rows=12/cols;
        box(ws,r,1,r+rows,2,"자리배치",{bold:true,color:NAVY,fill:"FFF4F6FA"});
        for (var rr=0;rr<rows;rr++){
          for (var cc2=0;cc2<cols;cc2++){
            var sid2=seatMap[String(rr*cols+cc2)], st2=sid2?studentById(sid2):null;
            put(ws,ws.getCell(r+rr,3+cc2).address,st2?logName(st2.name):"",{bold:!!st2,fill:st2?"FFFFFFFF":"FFF1F3F6"});
          }
          ws.getRow(r+rr).height=26;
        }
        var tSide=teacherSideFor(c.id,d,gseat?sess:null), tCol=tSide==="R"?2+cols:3;
        box(ws,r+rows,tCol,r+rows,tCol,"선생님",{bold:true,color:"FFFFFFFF",fill:"FF1F2937"});
        box(ws,r+rows,tSide==="R"?3:4,r+rows,tSide==="R"?1+cols:2+cols,"앞",{bold:true,color:"FF5A6573",fill:"FFE9ECF1"}); ws.getRow(r+rows).height=20;
        r+=rows+1;
      }
      // colours follow the value, so a dropdown change in Excel recolours the cell
      function rule(top,txt,col){ return {type:"expression",formulae:[top+'="'+txt+'"'],style:{fill:{type:"pattern",pattern:"solid",bgColor:{argb:col[0]}},font:{color:{argb:col[1]},bold:true}}}; }
      ws.addConditionalFormatting({ref:"G9:G"+last,rules:Object.keys(LOG_ATT_COL).map(function(k){ return rule("G9",k,LOG_ATT_COL[k]); })});
      ws.addConditionalFormatting({ref:"C9:F"+last,rules:[rule("C9","상담완료",["FFDDF2E5","FF137044"])]});
      ws.pageSetup={orientation:"landscape",fitToPage:true,fitToWidth:1,fitToHeight:0,paperSize:9};
    });
  });
  return {wb:wb, classes:n};
}

function buildWorkbook(a,b,classIds){
  // 기록 요약 workbook (redesigned 2026-11-11 with the 골든벨 점수 system):
  //   요약 sheet (one row per class) → one sheet per class → 코멘트 sheet.
  //   Class sheet blocks share the same date columns: 출석 → 숙제 → 골든벨 점수 → 골든벨 회차별 순위 → 골든벨 표시 → 자리배치.
  //   골든벨: ◎5 O4 △3 X2 미표시·미참가 1 per question (gbScores). 득점률 = points ÷ max over the sessions the student played.
  //   The three 골든벨 blocks list students in the same order: 득점률 high → low.
  var wb=new ExcelJS.Workbook(), used={}, comments=[], overview=[];
  wb.creator="필즈 출석부"; wb.created=new Date();
  var FONT="맑은 고딕", NAVY="FF1F2A5C", INK="FF1F2937", MUTE="FF5A6573", HEADF="FFE9EDF7";
  var LINE={style:"thin",color:{argb:"FFD3D9E2"}}, BOX={top:LINE,bottom:LINE,left:LINE,right:LINE};
  function put(ws,r,c,val,o){
    o=o||{}; var k=o.kind?XL[o.kind]:null, cell=ws.getCell(r,c); cell.value=val;
    cell.font={name:FONT,size:o.size||10,bold:!!o.bold,color:{argb:o.color||(k?k[1]:INK)}};
    cell.alignment={horizontal:o.align||"center",vertical:"middle",wrapText:!!o.wrap};
    var f=o.fill||(k?k[0]:null); if (f) cell.fill={type:"pattern",pattern:"solid",fgColor:{argb:f}};
    if (!o.plain) cell.border=BOX; if (o.fmt) cell.numFmt=o.fmt; if (o.note) cell.note=o.note;
    return cell;
  }
  function head(ws,r,c,val){ return put(ws,r,c,val,{bold:true,fill:HEADF,color:NAVY}); }
  function nameCell(ws,r,val,o){ o=o||{}; return put(ws,r,1,val,{bold:true,align:"left",fill:o.fill,color:o.color}); }
  function merge(ws,r,c1,c2){ if (c2>c1) ws.mergeCells(r,c1,r,c2); }
  function band(ws,r,W,text){ merge(ws,r,1,W); put(ws,r,1,text,{bold:true,size:11,color:"FFFFFFFF",fill:NAVY,align:"left",plain:true}); ws.getRow(r).height=22; return r+1; }
  function noteLine(ws,r,W,text){ merge(ws,r,1,W); put(ws,r,1,text,{size:9,color:MUTE,align:"left",plain:true}); return r+1; }
  function title(ws,W,text,sub){
    merge(ws,1,1,W); put(ws,1,1,text,{bold:true,size:16,color:NAVY,align:"left",plain:true}); ws.getRow(1).height=30;
    merge(ws,2,1,W); put(ws,2,1,sub,{size:10,color:MUTE,align:"left",plain:true}); ws.getRow(2).height=18;
    for (var c=1;c<=W;c++) ws.getCell(2,c).border={bottom:{style:"medium",color:{argb:NAVY}}};
  }
  function pct(n,d){ return d ? n/d : null; }
  function putPct(ws,r,c,v,o){ o=Object.assign({},o||{}); o.fmt="0%"; return put(ws,r,c,v==null?"–":v,v==null?{kind:"na"}:o); }
  var period=a+(a===b?"":" ~ "+b), stamp=todayIso(), teacher=T?T.name+" 선생님":"";
  var classes=classesInRange(a,b).filter(function(c){ return classIds.indexOf(c.id)>=0; });
  var ATT_LABEL={present:t("present"),online:t("online"),late:t("late"),absent:t("absent"),none:""};
  var ATT_KEYS2=["present","online","late","absent","none"], MARKS=["◎","O","△","X"];
  var ov=wb.addWorksheet(sheetName("요약",used),{views:[{state:"frozen",ySplit:4}]});

  classes.forEach(function(c){
    var dates=classDates(c,a,b), nD=dates.length, NS=6, S0=2+nD, W=Math.max(1+nD+NS,10);
    var ws=wb.addWorksheet(sheetName(c.name,used),{views:[{state:"frozen",xSplit:1,ySplit:2}]});
    var studs={}; dates.forEach(function(d){ rosterOf(db,c.id,d).forEach(function(s){ studs[s.id]=s; }); });
    var list=Object.keys(studs).map(function(k){return studs[k];}).sort(byName);
    var onRoster={}; dates.forEach(function(d){ onRoster[d]={}; rosterOf(db,c.id,d).forEach(function(s){ onRoster[d][s.id]=1; }); });
    title(ws,W,c.name,[period,teacher,"수업 "+nD+"회","학생 "+list.length+"명","내보낸 날짜 "+stamp].filter(Boolean).join("  ·  "));
    var r=4, stat={c:c,lessons:nD,students:list.length,attIn:0,attAll:0,hwOn:0,hwAll:0,gbN:0,gbPts:0,gbMax:0};

    // --- 출석 (가나다) ---
    r=band(ws,r,W,t("gb_xl_att")+"  ·  가나다 순");
    head(ws,r,1,t("nameCol")); dates.forEach(function(d,i){ head(ws,r,2+i,mdLabel(d)); });
    ATT_KEYS2.forEach(function(k,i){ put(ws,r,S0+i,t(k),{kind:ATT_CLS[k],bold:true}); }); head(ws,r,S0+5,"출석률");
    r++;
    var dayIn={}, dayAll={};
    list.forEach(function(s){
      var cnt={present:0,online:0,late:0,absent:0,none:0};
      nameCell(ws,r,s.name);
      dates.forEach(function(d,i){
        if (!onRoster[d][s.id]){ put(ws,r,2+i,"–",{kind:"na"}); return; }
        var st=attStatus(d,c.id,s.id), note=attNote(d,c.id,s.id); cnt[st]++;
        dayAll[d]=(dayAll[d]||0)+1; if (st!=="absent" && st!=="none") dayIn[d]=(dayIn[d]||0)+1;
        put(ws,r,2+i,ATT_LABEL[st],{kind:ATT_CLS[st],note:note||null});
      });
      ATT_KEYS2.forEach(function(k,i){ put(ws,r,S0+i,cnt[k],{bold:true,color:cnt[k]?INK:"FFB6BEC9"}); });
      var inN=cnt.present+cnt.online+cnt.late, den=inN+cnt.absent; stat.attIn+=inN; stat.attAll+=den;
      putPct(ws,r,S0+5,pct(inN,den),{bold:true});
      r++;
    });
    nameCell(ws,r,"출석 인원",{fill:HEADF,color:NAVY});
    dates.forEach(function(d,i){ put(ws,r,2+i,(dayIn[d]||0)+" / "+(dayAll[d]||0),{bold:true,fill:HEADF,color:NAVY}); });
    for (var z=0;z<5;z++) put(ws,r,S0+z,"",{fill:HEADF}); putPct(ws,r,S0+5,pct(stat.attIn,stat.attAll),{bold:true,fill:HEADF,color:NAVY});
    r++; r=noteLine(ws,r,W,"출석률 = (등원 + 온라인 + 지각) ÷ 체크한 수업 · 빈칸 = 미체크 · – = 그날 반에 없음 · 메모는 셀 메모");

    // --- 숙제 (가나다) ---
    var hwDates=dates.filter(function(d){ return !isPartnerDay(c,d); });
    var hwAny=hwDates.some(function(d){ return list.some(function(s){ return hwGet(d,c.id,s.id).set; }); });   // no 숙제 records in the range → no block
    if (hwDates.length && hwAny){
      r++; r=band(ws,r,W,t("hw")+"  ·  가나다 순");
      head(ws,r,1,t("nameCol"));
      dates.forEach(function(d,i){ var own=hwDates.indexOf(d)>=0; if (own) head(ws,r,2+i,mdLabel(d)); else put(ws,r,2+i,"",{kind:"na"}); });
      head(ws,r,S0,"했어요"); head(ws,r,S0+1,"안 했어요"); head(ws,r,S0+2,"완료율");
      r++;
      list.forEach(function(s){
        var nOn=0, nOff=0;
        nameCell(ws,r,s.name);
        dates.forEach(function(d,i){
          if (hwDates.indexOf(d)<0){ put(ws,r,2+i,"",{kind:"na"}); return; }
          if (!onRoster[d][s.id] || !hwEligible(d,c.id,s.id)){ put(ws,r,2+i,"–",{kind:"na"}); return; }   // not in the class / not in the room that day
          var x=hwGet(d,c.id,s.id);
          if (!x.set){ put(ws,r,2+i,""); return; }
          put(ws,r,2+i,hwTwo()?(x.p?"☑":"☐")+(x.r?"☑":"☐"):(x.h?"☑":"☐"),{kind:x.done?"ok":"none",size:12,note:x.note||null}); if (x.done) nOn++; else nOff++;
          if (x.note) comments.push([d,c.name,s.name,"숙제",x.h?"☑":"☐",x.note]);
        });
        stat.hwOn+=nOn; stat.hwAll+=nOn+nOff;
        put(ws,r,S0,nOn,{bold:true}); put(ws,r,S0+1,nOff,{bold:true,color:nOff?XL.bad[1]:"FFB6BEC9"}); putPct(ws,r,S0+2,pct(nOn,nOn+nOff),{bold:true});
        r++;
      });
      r=noteLine(ws,r,W,(hwTwo()?"연습 · 리뷰 순서로 ":"")+"☑ 했어요 · ☐ 안 했어요 · 빈칸 = 체크 안 함 · – = 교실에 없음 (온라인·결석·미체크) · 메모는 셀 메모");
    }

    // --- 골든벨: 점수 → 회차별 순위 → 표시 ---
    var sess={}; Object.keys(db.gbSessions).forEach(function(k){ var s=db.gbSessions[k]; if (s.classId===c.id && dates.indexOf(s.date)>=0) sess[s.date]=s; });
    if (!noGb(c) && Object.keys(sess).length){
      var SC={}; dates.forEach(function(d){ var S=sess[d]; if (!S) return;
        var rows0=gbScores(S), by={}, mx=0, sum=0; rows0.forEach(function(x){ by[x.p.id]=x; mx=Math.max(mx,x.max); sum+=x.pts; });
        SC[d]={by:by,max:mx,n:rows0.length,avg:rows0.length?sum/rows0.length:0}; stat.gbN++; });
      var rows=list.map(function(s){
        var cnt={"◎":0,"O":0,"△":0,"X":0,"·":0}, cells=[], pts=0, max=0, n=0, m=0;
        dates.forEach(function(d){
          var S=sess[d]; if (!S){ cells.push(null); return; }
          if (onRoster[d][s.id]) m++;
          var x=SC[d].by[s.id]; if (!x){ cells.push({txt:"–"}); return; }
          var Q=S.questionCount; if (S.status==="active" && Q>1 && !qHasMarks(S,Q)) Q--;
          var txt="", notes=[];
          for (var q=1;q<=Q;q++){
            if (!played(S,q,s.id)){ txt+="–"; continue; }
            var mm=getMark(S.id,q,s.id), mk=mm&&mm.mark?mm.mark:"·"; txt+=mk; cnt[mk]++;
            if (mm && mm.comment){ notes.push("Q"+q+" "+mk+": "+mm.comment); comments.push([d,c.name,s.name,"Q"+q,mk,mm.comment]); }
          }
          pts+=x.pts; max+=x.max; n++;
          cells.push({txt:txt,note:notes.join("\n"),pts:x.pts,max:x.max,rank:x.rank,of:SC[d].n});
        });
        stat.gbPts+=pts; stat.gbMax+=max;
        return {s:s,cells:cells,cnt:cnt,pts:pts,max:max,n:n,m:m,pct:max?pts/max:-1};
      }).sort(function(x,y){ return (y.pct-x.pct) || x.s.name.localeCompare(y.s.name,"ko"); });
      rows.forEach(function(x,i){ x.rank = x.pct<0 ? null : (i && rows[i-1].pct===x.pct) ? rows[i-1].rank : i+1; });
      function gbHead(extra){
        head(ws,r,1,t("nameCol"));
        dates.forEach(function(d,i){ if (sess[d]) head(ws,r,2+i,mdLabel(d)); else put(ws,r,2+i,"",{kind:"na"}); });
        extra.forEach(function(h,i){ head(ws,r,S0+i,h); }); r++;
      }
      // 점수
      r++; r=band(ws,r,W,t("gb")+" 점수  ·  득점률 높은 순");
      gbHead(["합계","만점","득점률","참가","순위"]);
      rows.forEach(function(x){
        nameCell(ws,r,x.s.name);
        x.cells.forEach(function(cv,i){
          if (!cv){ put(ws,r,2+i,"",{kind:"na"}); return; }
          if (cv.pts==null){ put(ws,r,2+i,"–",{kind:"na"}); return; }
          put(ws,r,2+i,cv.pts,{kind:cv.rank===1?"ok":"none",bold:cv.rank===1,color:cv.rank===1?null:INK,note:cv.rank+"위 / "+cv.of+"명 · 만점 "+cv.max});
        });
        if (x.n){ put(ws,r,S0,x.pts,{bold:true}); put(ws,r,S0+1,x.max,{color:MUTE}); if (x.max) putPct(ws,r,S0+2,x.pts/x.max,{bold:true}); else put(ws,r,S0+2,"–",{kind:"na"});   /* a 골든벨 with no scored question yet: 0/0 would write NaN, which Excel cannot read */ put(ws,r,S0+3,x.n+" / "+x.m); put(ws,r,S0+4,x.rank,{bold:true,kind:x.rank===1?"ok":null}); }
        else { for (var e=0;e<5;e++) put(ws,r,S0+e,e===3?"0 / "+x.m:"–",{kind:"na"}); }
        r++;
      });
      [["만점",function(d){return SC[d].max;},null],["반 평균",function(d){return Math.round(SC[d].avg*10)/10;},"0.0"],["참가 인원",function(d){return SC[d].n;},null]].forEach(function(f){
        nameCell(ws,r,f[0],{fill:HEADF,color:NAVY});
        dates.forEach(function(d,i){ if (sess[d]) put(ws,r,2+i,f[1](d),{bold:true,fill:HEADF,color:NAVY,fmt:f[2]}); else put(ws,r,2+i,"",{kind:"na"}); });
        for (var e=0;e<5;e++) put(ws,r,S0+e,"",{fill:HEADF});
        if (f[0]==="반 평균") putPct(ws,r,S0+2,pct(stat.gbPts,stat.gbMax),{bold:true,fill:HEADF,color:NAVY});
        r++;
      });
      r=noteLine(ws,r,W,"문제당 ◎ 5 · O 4 · △ 3 · X 2 · 미표시/미참가 1 · 만점 = 5 × 문제 수 · 득점률 = 합계 ÷ 참가한 회차의 만점 · 초록 = 그날 1위 · – = 불참");
      // 회차별 순위
      r++; r=band(ws,r,W,t("gb")+" 회차별 순위");
      gbHead(["1위","2위","3위"]);
      rows.forEach(function(x){
        var top=[0,0,0];
        nameCell(ws,r,x.s.name);
        x.cells.forEach(function(cv,i){
          if (!cv){ put(ws,r,2+i,"",{kind:"na"}); return; }
          if (cv.rank==null){ put(ws,r,2+i,"–",{kind:"na"}); return; }
          if (cv.rank<=3) top[cv.rank-1]++;
          put(ws,r,2+i,cv.rank,{kind:cv.rank===1?"ok":cv.rank<=3?"on":"none",bold:cv.rank<=3,color:cv.rank<=3?null:INK});
        });
        top.forEach(function(v,i){ put(ws,r,S0+i,v,{bold:true,color:v?INK:"FFB6BEC9"}); });
        r++;
      });
      r=noteLine(ws,r,W,"그날 골든벨 점수의 반 안 순위 · 합계 동점이면 문제별 1위를 더 많이 한 학생이 위 (다음은 2위 횟수…) · 그래도 같으면 같은 순위 (1, 1, 3) · 오른쪽 = 1 · 2 · 3위를 한 횟수");
      // 표시
      r++; r=band(ws,r,W,t("gb")+" 표시  ·  문제 순서대로");
      gbHead(MARKS.concat([t("unmarked")]));
      rows.forEach(function(x){
        nameCell(ws,r,x.s.name);
        x.cells.forEach(function(cv,i){
          if (!cv){ put(ws,r,2+i,"",{kind:"na"}); return; }
          put(ws,r,2+i,cv.txt,{kind:cv.txt==="–"?"na":"none",align:cv.txt==="–"?"center":"left",color:cv.txt==="–"?null:INK,note:cv.note||null});
        });
        MARKS.concat(["·"]).forEach(function(k,i){ put(ws,r,S0+i,x.cnt[k],{bold:true,color:x.cnt[k]?INK:"FFB6BEC9"}); });
        r++;
      });
      r=noteLine(ws,r,W,"셀 = 그날 문제 순서대로의 표시 (Q1…) · (·) 미표시 · (–) 미참가 · 코멘트는 셀 메모와 코멘트 시트");
    }

    // --- 자리배치 (one grid per lesson with saved seating; two per row) ---
    var seatDays=(seatingOn()?dates:[]).map(function(d){
      var S=sess[d], map=null, layout="4x3";
      if (S && S.seats && Object.keys(S.seats).length){ map=S.seats; layout=S.layout||"4x3"; }
      else { var rec=db.seating[seatKey(d,c.id)]; if (rec){ map=visibleSeats(rec.seats||{},c.id,d); layout=rec.layout||"4x3"; } }
      return map && Object.keys(map).length ? {d:d,map:map,layout:layout,teacher:teacherSideFor(c.id,d,S&&S.seats&&Object.keys(S.seats).length?S:null)} : null;
    }).filter(Boolean);
    if (seatDays.length){
      r++; r=band(ws,r,W,t("seatBtn")+"  ·  앞 = 선생님 쪽 (아래)");
      for (var k=0;k<seatDays.length;k+=2){
        var pair=seatDays.slice(k,k+2), maxRows=0;
        pair.forEach(function(sd,j){
          var cols=colsOf(sd.layout), nRows=12/cols, c0=2+j*5;
          put(ws,r,c0,mdLabel(sd.d)+" · "+(sd.layout==="3x4"?t("layout34"):t("layout43")),{bold:true,color:MUTE,align:"left",plain:true});
          for (var rr=0;rr<nRows;rr++) for (var cc=0;cc<cols;cc++){
            var sid=sd.map[String(rr*cols+cc)], st=sid&&studentById(sid);
            put(ws,r+1+rr,c0+cc,st?st.name:"",{kind:st?"none":"na",bold:!!st,color:st?INK:null});
          }
          var tc=sd.teacher==="R"?c0+cols-1:c0, f0=sd.teacher==="R"?c0:c0+1;
          put(ws,r+1+nRows,tc,t("teacherDesk"),{bold:true,color:"FFFFFFFF",fill:INK});
          ws.mergeCells(r+1+nRows,f0,r+1+nRows,f0+cols-2); put(ws,r+1+nRows,f0,t("frontOnly"),{kind:"na",bold:true});
          maxRows=Math.max(maxRows,nRows);
        });
        r+=maxRows+3;
      }
    }
    ws.getColumn(1).width=14;
    for (var i=2;i<=W;i++) ws.getColumn(i).width=11;
    for (var rr2=4;rr2<r;rr2++) if (!ws.getRow(rr2).height) ws.getRow(rr2).height=19;
    ws.pageSetup={orientation:W>9?"landscape":"portrait",fitToPage:true,fitToWidth:1,fitToHeight:0,paperSize:9,horizontalCentered:true,
      margins:{left:0.4,right:0.4,top:0.6,bottom:0.6,header:0.3,footer:0.3},printTitlesRow:"1:2"};
    ws.headerFooter={oddFooter:"&L&8필즈 출석부 · "+period+"&C&8&P / &N&R"+stamp};
    overview.push(stat);
  });

  // --- 요약 sheet ---
  var OH=["반","요일 · 시간","수업","학생","출석률","숙제 완료율","골든벨","골든벨 평균 득점률"], OW=OH.length;
  title(ov,OW,"기록 요약",[period,teacher,"반 "+classes.length+"개","내보낸 날짜 "+stamp].filter(Boolean).join("  ·  "));
  OH.forEach(function(h,i){ head(ov,4,1+i,h); }); ov.getRow(4).height=22;
  var tot={l:0,ai:0,aa:0,ho:0,ha:0,g:0,gp:0,gm:0};
  overview.forEach(function(x,i){
    var r=5+i; put(ov,r,1,x.c.name,{bold:true,align:"left"}); put(ov,r,2,daysLabel(x.c.days)+" "+x.c.time);
    put(ov,r,3,x.lessons); put(ov,r,4,x.students);
    putPct(ov,r,5,pct(x.attIn,x.attAll)); putPct(ov,r,6,pct(x.hwOn,x.hwAll));
    put(ov,r,7,noGb(x.c)?"–":x.gbN,noGb(x.c)?{kind:"na"}:{}); putPct(ov,r,8,pct(x.gbPts,x.gbMax),{bold:true});
    ov.getRow(r).height=20;
    tot.l+=x.lessons; tot.ai+=x.attIn; tot.aa+=x.attAll; tot.ho+=x.hwOn; tot.ha+=x.hwAll; tot.g+=x.gbN; tot.gp+=x.gbPts; tot.gm+=x.gbMax;
  });
  var tr=5+overview.length, TO={bold:true,fill:HEADF,color:NAVY};
  put(ov,tr,1,"전체",{bold:true,fill:HEADF,color:NAVY,align:"left"}); put(ov,tr,2,"",TO); put(ov,tr,3,tot.l,TO); put(ov,tr,4,"",TO);
  putPct(ov,tr,5,pct(tot.ai,tot.aa),TO); putPct(ov,tr,6,pct(tot.ho,tot.ha),TO); put(ov,tr,7,tot.g,TO); putPct(ov,tr,8,pct(tot.gp,tot.gm),TO);
  ov.getRow(tr).height=20;
  var nr=tr+2;
  ["출석률 = (등원 + 온라인 + 지각) ÷ 체크한 수업 (미체크 제외)",
   "숙제 완료율 = 했어요 ÷ 확인한 횟수 (교실에 온 학생만)",
   "골든벨 점수: 문제당 ◎ 5 · O 4 · △ 3 · X 2 · 미표시/미참가 1 · 만점 = 5 × 문제 수",
   "골든벨 평균 득점률 = 받은 점수 합계 ÷ 참가한 회차의 만점 합계 · 레벨업 특강은 골든벨 없음",
   "반별 시트: 출석 → 숙제 → 골든벨 점수 → 회차별 순위 → 표시" + (seatingOn()?" → 자리배치":"")].forEach(function(s){ nr=noteLine(ov,nr,OW,s); });
  [22,14,8,8,10,12,9,18].forEach(function(w,i){ ov.getColumn(1+i).width=w; });
  ov.pageSetup={orientation:"landscape",fitToPage:true,fitToWidth:1,fitToHeight:0,paperSize:9,horizontalCentered:true,margins:{left:0.4,right:0.4,top:0.6,bottom:0.6,header:0.3,footer:0.3}};
  ov.headerFooter={oddFooter:"&L&8필즈 출석부 · "+period+"&C&8&P / &N&R"+stamp};

  // --- 코멘트 sheet ---
  var cs=wb.addWorksheet(sheetName(t("comment"),used),{views:[{state:"frozen",ySplit:1}]});
  var hdr=[t("gb_xl_date"),t("gb_xl_class"),t("nameCol"),"구분",t("markLbl"),t("comment")];
  hdr.forEach(function(h,i){ head(cs,1,1+i,h); }); cs.getRow(1).height=22;
  comments.sort(function(x,y){ return x[0].localeCompare(y[0]) || x[1].localeCompare(y[1],"ko") || x[2].localeCompare(y[2],"ko"); });
  comments.forEach(function(row,i){ row.forEach(function(v,j){ put(cs,2+i,1+j,j===0?mdLabel(v):v,{align:j===5||j===1||j===2?"left":"center",wrap:j===5,bold:j===2}); }); });
  if (!comments.length){ cs.mergeCells(2,1,2,6); put(cs,2,1,"이 기간에 남긴 코멘트가 없어요",{color:MUTE,plain:true}); }
  [11,18,11,7,7,60].forEach(function(w,i){ cs.getColumn(1+i).width=w; });
  cs.autoFilter={from:{row:1,column:1},to:{row:Math.max(1,1+comments.length),column:6}};
  cs.pageSetup={orientation:"landscape",fitToPage:true,fitToWidth:1,fitToHeight:0,paperSize:9,printTitlesRow:"1:1"};
  return {wb:wb, classes:classes.length};
}

async function runExport(){
  var sh=state.sheet; if (!sh || sh.busy) return;
  var a=sh.start, b=sh.end, ids=Object.keys(sh.classes).filter(function(k){return sh.classes[k];});
  sh.busy=true; render();
  try {
    if (rangeDays(a,b)>MAX_RANGE_DAYS) throw {code:"too_long"};
    await loadExcelJS();
    var uiLocale=locale, built, filename;
    locale="ko";   // the Excel file is always Korean (sheet names, headers, weekdays, filename), whatever the UI language
    try { var isLog=sh.fmt!=="summary"; built=isLog?buildLogbook(a,b,ids):buildWorkbook(a,b,ids); if (!built.classes) throw {code:"empty"}; filename=(a===b?a:a+"_"+b)+"_"+(isLog?"공식출석부":t("gb_xl_file"))+".xlsx"; } finally { locale=uiLocale; }
    var buf=await built.wb.xlsx.writeBuffer();
    var blob=new Blob([buf],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
    await FieldsFiles.saveBlob(filename,blob);
    state.sheet=null; render(); toast(t("exportSaved"));
  } catch(e){
    sh.busy=false; render();
    var code=e&&e.code;
    toast(code==="empty"?t("exportNoClasses"): code==="too_long"?t("exportTooLong"): code==="declined"?t("exportDeclined"): code==="rate_limited"?t("exportBusy"): (e&&e.message==="load")?t("exportLoadFail"): (code?t("exportUnavailable"):t("exportFailed")));
  }
}
function exportSheet(){
  var sh=state.sheet, cl=classesInRange(sh.start,sh.end);
  cl.forEach(function(c){ if (!(c.id in sh.classes)) sh.classes[c.id]=true; });
  var chosen=cl.filter(function(c){return sh.classes[c.id];}).length, tooLong=sh.start<=sh.end && rangeDays(sh.start,sh.end)>MAX_RANGE_DAYS, valid=sh.start<=sh.end && !tooLong && chosen>0;
  var presets=[["today",t("presetToday")],["week",t("presetWeek")],["month",t("presetMonth")],["custom",t("presetCustom")]];
  return '<div class="scrim" data-act="closeSheet"></div><div class="sheet" role="dialog" aria-modal="true" aria-label="'+t("exportTitle")+'">'+
    '<h2>'+t("exportTitle")+'</h2><span class="lbl">'+t("fmtLbl")+'</span>'+
    '<div class="presetseg">'+[["log",t("fmtLog")],["summary",t("fmtSum")]].map(function(p){ return '<button data-act="exportFmt" data-f="'+p[0]+'" aria-pressed="'+((sh.fmt||"log")===p[0])+'">'+p[1]+'</button>'; }).join("")+'</div>'+
    '<p class="metaline">'+t(sh.fmt==="summary"?"fmtSumHint":"fmtLogHint")+'</p>'+
    '<span class="lbl">'+t("exportRange")+'</span>'+
    '<div class="presetseg">'+presets.map(function(p){ return '<button data-act="exportPreset" data-p="'+p[0]+'" aria-pressed="'+(sh.preset===p[0])+'">'+p[1]+'</button>'; }).join("")+'</div>'+
    (sh.preset==="custom" ? '<div class="daterow"><input type="date" id="exStart" value="'+sh.start+'" aria-label="start"><span>~</span><input type="date" id="exEnd" value="'+sh.end+'" aria-label="end"></div>'
                          : '<p class="metaline">'+fmtDate(sh.start)+(sh.start===sh.end?'':' ~ '+fmtDate(sh.end))+'</p>')+
    (tooLong?'<p class="metaline" style="color:var(--bad)">'+t("exportTooLong")+'</p>':'')+
    '<span class="lbl">'+t("exportClasses")+'</span>'+
    (cl.length ? '<div class="pick">'+cl.map(function(c){ return '<label class="chk"><input type="checkbox" id="exc-'+c.id+'" data-exc="'+c.id+'"'+(sh.classes[c.id]?' checked':'')+'><span>'+esc(c.name)+' <span class="muted">· '+daysLabel(c.days)+' '+c.time+'</span></span></label>'; }).join("")+'</div>' : '<p class="metaline">'+t("exportNoClasses")+'</p>')+
    '<div class="row"><button class="btn" data-act="closeSheet">'+t("cancel")+'</button><button class="btn primary" data-act="exportRun"'+(valid&&!sh.busy?'':' disabled')+'>'+(sh.busy?t("exporting"):t("exportDo"))+'</button></div></div>';
}
