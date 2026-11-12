"""End-to-end check of the static site (Playwright + Chromium).

Covers: teacher pick, attendance saved to localStorage and kept across reload, both Excel
exports download as .xlsx, backup save, bad backup files rejected, restore asks before
replacing, and the cross-tab reload hook.

Run from the repo root:  python3 tests/e2e.py      (setup: tests/README.md)
"""
import json, os, subprocess, time, sys
from playwright.sync_api import sync_playwright
HERE=os.path.dirname(os.path.abspath(__file__))
ROOT=os.path.dirname(HERE)
PORT=os.environ.get('PORT','8765')
srv=subprocess.Popen([sys.executable,os.path.join(os.path.dirname(os.path.abspath(__file__)),'serve.py'),PORT,ROOT],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
time.sleep(1)
URL='http://localhost:%s/'%PORT
# Offline runs: put the pinned build at tests/vendor/exceljs.min.js and it is served for the CDN URL
# (the page's integrity hash still verifies it). Without the file the real CDN is used.
VENDOR=os.path.join(HERE,'vendor','exceljs.min.js')
EXCEL=open(VENDOR,'rb').read() if os.path.exists(VENDOR) else None
CHROME=os.environ.get('CHROME_PATH')   # optional: use an installed Chrome instead of Playwright's Chromium
out=os.path.join(HERE,'out'); os.makedirs(out,exist_ok=True)
errors=[]
def ready(p): p.wait_for_selector('#app > *',timeout=15000)   # the app has rendered (fixed waits alone are flaky on a slow load)
def go(p): p.goto(URL); ready(p)
def check(cond,msg):
    print(('PASS ' if cond else 'FAIL ')+msg)
    if not cond: errors.append(msg)
try:
  with sync_playwright() as p:
    b=p.chromium.launch(executable_path=CHROME,args=['--no-sandbox']) if CHROME else p.chromium.launch()
    ctx=b.new_context(accept_downloads=True,viewport={'width':420,'height':900})
    # serve the pinned ExcelJS bytes for the CDN URL (sandbox has no internet); SRI still verifies them
    if EXCEL: ctx.route('https://cdn.jsdelivr.net/**',lambda r: r.fulfill(status=200,body=EXCEL,headers={'content-type':'application/javascript','access-control-allow-origin':'*'}))
    ctx.route('https://fonts.**',lambda r: r.fulfill(status=200,body=''))
    pg=ctx.new_page()
    pg.on('pageerror',lambda e: errors.append('pageerror: '+str(e)))
    go(pg); pg.wait_for_timeout(500)
    # pick a teacher
    pg.click('[data-act="pickTeacher"][data-tid="jhj"]'); pg.wait_for_timeout(300)
    check('정혜진' in pg.inner_text('.brand'),'teacher picked')
    # go to a Monday with classes and mark attendance
    pg.evaluate('''()=>{const i=document.getElementById("datePick"); i.value="2026-11-09"; i.dispatchEvent(new Event("change",{bubbles:true}));}''')
    pg.wait_for_timeout(300)
    pg.click('[data-act="openClass"]'); pg.wait_for_timeout(300)
    tile=pg.locator('button.tile').first; tile.click(); pg.wait_for_timeout(500)
    stored=json.loads(pg.evaluate('localStorage.getItem("fields-attendance-v1")'))
    edited=[k for k,v in stored['attendance'].items() if v.get('at')]
    check(len(edited)==1,'attendance tap saved to localStorage (%d edited)'%len(edited))
    pg.reload(); ready(pg); pg.wait_for_timeout(500)
    stored2=json.loads(pg.evaluate('localStorage.getItem("fields-attendance-v1")'))
    check(edited and stored2['attendance'][edited[0]]==stored['attendance'][edited[0]],'record survives reload')
    check('정혜진' in pg.inner_text('.brand'),'teacher survives reload')
    # Excel export (summary + log)
    for fmt in ['log','summary']:
        pg.click('[data-act="exportOpen"]'); pg.wait_for_timeout(200)
        pg.click(f'[data-act="exportFmt"][data-f="{fmt}"]'); pg.click('[data-act="exportPreset"][data-p="month"]'); pg.wait_for_timeout(200)
        with pg.expect_download(timeout=20000) as dl: pg.click('[data-act="exportRun"]')
        d=dl.value; path=os.path.join(out,d.suggested_filename); d.save_as(path)
        check(d.suggested_filename.endswith('.xlsx') and os.path.getsize(path)>3000,f'xlsx download {fmt}: {d.suggested_filename} ({os.path.getsize(path)} B)')
        pg.wait_for_timeout(300)
    # backup save
    pg.click('[data-act="settingsOpen"]'); pg.wait_for_timeout(200)
    check('아직 백업' in pg.inner_text('.sheet'),'no-backup-yet notice shown')
    with pg.expect_download() as dl: pg.click('[data-act="backupSave"]')
    bpath=os.path.join(out,dl.value.suggested_filename); dl.value.save_as(bpath)
    bk=json.load(open(bpath)); check(bk['app']=='fields-attendance' and 'db' in bk,'backup json downloaded: '+dl.value.suggested_filename)
    pg.wait_for_timeout(300)
    check('마지막 백업' in pg.inner_text('.sheet'),'last-backup time shown')
    # bad files rejected, nothing changed
    snap=pg.evaluate('localStorage.getItem("fields-attendance-v1")')
    bad=[('garbage.json','not json{'),('other.json','{"hello":1}'),('broken.json',json.dumps({'app':'fields-attendance','version':1,'db':{'gbSessions':{},'attendance':{'x':{'status':'??'}}}}))]
    for name,txt in bad:
        open(os.path.join(out,name),'w').write(txt)
        pg.set_input_files('#backupFile',os.path.join(out,name)); pg.wait_for_timeout(300)
        check('읽지 못했어요' in pg.inner_text('#toast') and pg.locator('[data-act="restoreDo"]').count()==0,f'rejected {name}')
    check(pg.evaluate('localStorage.getItem("fields-attendance-v1")')==snap,'store untouched after bad files')
    # make a change after backup, then restore → change gone, confirm required
    go(pg); pg.wait_for_timeout(300)
    pg.evaluate('''()=>{const i=document.getElementById("datePick"); i.value="2026-11-09"; i.dispatchEvent(new Event("change",{bubbles:true}));}'''); pg.wait_for_timeout(300)
    pg.click('[data-act="openClass"]'); pg.wait_for_timeout(300)
    pg.locator('button.tile').nth(1).click(); pg.wait_for_timeout(500)
    after=json.loads(pg.evaluate('localStorage.getItem("fields-attendance-v1")'))
    n_after=len([1 for v in after['attendance'].values() if v.get('at')])
    go(pg); pg.wait_for_timeout(400)
    pg.click('[data-act="settingsOpen"]'); pg.wait_for_timeout(200)
    pg.set_input_files('#backupFile',bpath); pg.wait_for_timeout(400)
    txt=pg.inner_text('.sheet')
    check('지금 기록은 지워져요' in txt and '출석' in txt,'restore asks for confirmation with counts')
    still=json.loads(pg.evaluate('localStorage.getItem("fields-attendance-v1")'))
    check(len([1 for v in still['attendance'].values() if v.get('at')])==n_after,'store unchanged while confirm is pending')
    pg.click('[data-act="restoreDo"]'); pg.wait_for_timeout(400)
    rest=json.loads(pg.evaluate('localStorage.getItem("fields-attendance-v1")'))
    check(len([1 for v in rest['attendance'].values() if v.get('at')])==1 and n_after==2,'restore replaced records (2 edits → 1 from backup)')
    # cross-tab reload hook
    pg2=ctx.new_page(); go(pg2); pg2.wait_for_timeout(400)
    pg.evaluate('''()=>{const d=JSON.parse(localStorage.getItem("fields-attendance-v1")); d.attendance["2026-11-09_jhj-m3_s-김규원"]={status:"absent",note:"x",at:1}; localStorage.setItem("fields-attendance-v1",JSON.stringify(d));}''')
    pg2.wait_for_timeout(400)
    check('다른 탭' in pg2.inner_text('#toast'),'other tab reloads on change')
    # name-card tap cycle (published app order), 전부 등원, and the 정고은 config
    cyc=pg.evaluate('()=>{let s="none",o=[];for(let i=0;i<5;i++){s=CYCLE[s];o.push(s);}return o.join(">");}')
    check(cyc=='present>online>late>absent>none','tap cycle 등원 → 온라인 → 지각 → 결석 → 미체크 (%s)'%cyc)
    aa=pg.evaluate('''()=>{const c=myClasses()[0], d=stepLesson(c,addDays(todayIso(),7),1); state.view="class"; state.classId=c.id; state.date=d; render();
      const r=rosterOf(db,c.id,d), before=r.filter(s=>attStatus(d,c.id,s.id)==="none").length, btn=document.querySelector('[data-act="attAll"]');
      if(!btn) return {before:before,btn:false};
      setAtt(r[0].id,"absent"); render(); document.querySelector('[data-act="attAll"]').click();
      const st=r.map(s=>attStatus(d,c.id,s.id));
      return {before:before,btn:true,first:st[0],rest:st.slice(1).every(x=>x==="present"),gone:!document.querySelector('[data-act="attAll"]')}; }''')
    check(aa.get('btn') and aa['before']>1 and aa['first']=='absent' and aa['rest'] and aa['gone'],'전부 등원 marks only 미체크 students, keeps 결석, then hides %s'%aa)
    jg=pg.evaluate('()=>{const t=TEACHERS.find(x=>x.id==="jge"); return t?[t.name,t.classes.length,db.classes.filter(c=>c.teacherId==="jge").length,t.classes.reduce((a,c)=>a+c.roster.length,0)]:null;}')
    check(jg==['정고은',10,10,71],'정고은 seeded: 10 classes, 71 roster entries %s'%jg)
    # 골든벨 tie-break: equal points → the student marked first ranks higher; no times → shared rank (not saved)
    tb=pg.evaluate('''()=>{const ids=db.students.slice(0,4).map(s=>s.id), s={id:"tb-test",classId:"x",date:"2026-11-09",status:"active",playerIds:ids,joinedAt:{},questionCount:2,currentQ:2};
      db.gbQuestions["tb-test_1"]={phase:"closed"}; db.gbQuestions["tb-test_2"]={phase:"closed"};
      const put=(q,i,mark,at)=>{db.gbMarks["tb-test_"+q+"_"+ids[i]]=Object.assign({mark:mark,phase:"first",comment:"",overridden:false},at?{at:at}:{});};
      put(1,0,"◎",2000); put(1,1,"◎",1000); put(1,2,"O",0); put(1,3,"O",0);
      const q1=gbQRank(s,1).map(r=>[ids.indexOf(r.p.id),r.rank]);
      put(2,0,"◎",0); put(2,1,"◎",0);
      const all=gbScores(s).map(r=>[ids.indexOf(r.p.id),r.pts,r.rank]);
      Object.keys(db.gbMarks).forEach(k=>{ if(k.indexOf("tb-test_")===0) delete db.gbMarks[k]; }); delete db.gbQuestions["tb-test_1"]; delete db.gbQuestions["tb-test_2"];
      return {q1:q1,all:all}; }''')
    r1=dict(tb['q1']); ra={i:(p,r) for i,p,r in tb['all']}
    check(r1[1]==1 and r1[0]==2 and r1[2]==3 and r1[3]==3,'골든벨 tie: earlier ◎ ranks 1st, later ◎ 2nd, untimed O share 3rd %s'%tb['q1'])
    check(ra[1]==(10,1) and ra[0]==(10,2) and ra[2]==(5,3) and ra[3]==(5,3),'골든벨 tie carries into session standings %s'%tb['all'])
    pg.screenshot(path=os.path.join(out,'home.png'))
    b.close()
finally:
  srv.terminate()
print('ERRORS:',errors)
sys.exit(1 if errors else 0)
