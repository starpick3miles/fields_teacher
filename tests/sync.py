"""Shared-storage acceptance test (Playwright + Chromium), handoff brief Task 2.

Runs the real page against tests/sync_server.py, a stand-in for the backend. It proves the sync layer in js/sync.js
(queue, per-record upload, pull, conflicts, import, offline) — not the Firestore adapter, which needs a Firebase project.
Each browser context has its own empty localStorage, so a new context = another phone, a private tab or cleared site data.

Run from the repo root:  python3 tests/sync.py      (setup: tests/README.md)
"""
import json, os, subprocess, sys, time, urllib.request
from playwright.sync_api import sync_playwright
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE); sys.path.insert(0,HERE)
from sync_server import make_server
PORT=os.environ.get('PORT','8768'); BPORT=int(os.environ.get('BACKEND_PORT','8769'))
web=subprocess.Popen([sys.executable,'-m','http.server',PORT,'-d',ROOT],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
backend,store=make_server(BPORT); time.sleep(1)
URL='http://localhost:%s/'%PORT; BURL='http://127.0.0.1:%d'%BPORT
CHROME=os.environ.get('CHROME_PATH'); out=os.path.join(HERE,'out'); os.makedirs(out,exist_ok=True)
errors=[]; CID='jhj-m3'; D='2026-11-16'
REMOTE="window.FIELDS_REMOTE={kind:'http',url:'%s',pollMs:400};"%BURL
def check(cond,msg):
    print(('PASS ' if cond else 'FAIL ')+msg)
    if not cond: errors.append(msg)
def recs(): return {k:v for k,v in store.rec.items()}
def live(prefix): return {k:json.loads(v['v']) for k,v in store.rec.items() if k.startswith(prefix) and not v['d']}
def ready(p): p.wait_for_selector('#app > *',timeout=15000)
def settle(p,ms=1200): p.wait_for_timeout(ms)
def lesson(p,d=D,cid=CID):
    p.goto(URL); ready(p)
    if p.locator('[data-act="pickTeacher"]').count(): p.click('[data-act="pickTeacher"][data-tid="jhj"]')
    p.evaluate('([d,c])=>{state.date=d; state.classId=c; state.view="class"; render();}',[d,cid]); p.wait_for_timeout(150)
def tile(p,i): return p.locator('.grid button.tile[data-act="cycle"]').nth(i)
def st(p,sid,d=D,cid=CID): return p.evaluate('([d,c,s])=>attStatus(d,c,s)',[d,cid,sid])
def fresh(b,extra=''):
    c=b.new_context(accept_downloads=True,viewport={'width':360,'height':800}); c.add_init_script(REMOTE+extra)
    c.route('https://fonts.**',lambda r: r.fulfill(status=200,body=''))
    p=c.new_page(); p.on('pageerror',lambda e: errors.append('pageerror: '+str(e))); return c,p
try:
  with sync_playwright() as pw:
    b=pw.chromium.launch(executable_path=CHROME,args=['--no-sandbox']) if CHROME else pw.chromium.launch()

    # ---- browser A enters records; they reach shared storage record by record ----
    ca,A=fresh(b); lesson(A)
    check(A.evaluate('store.shared===true'),'app runs with shared storage on')
    sids=[tile(A,i).get_attribute('data-sid') for i in range(4)]
    tile(A,0).click(); tile(A,1).click(); tile(A,1).click(); A.wait_for_timeout(400)   # 0 → 온라인, 1 → 지각 (double tap would be 등원; these are slow taps)
    A.evaluate('([s])=>{setAtt(s,"present"); hwSet(state.date,state.classId,s,true,"3쪽만"); save(); render();}',[sids[2]])
    settle(A)
    a0=st(A,sids[0]); a1=st(A,sids[1])
    att=live('attendance/%s_%s_'%(D,CID)); hw=live('homework/%s_%s_'%(D,CID))
    check(len(att)==3 and att['attendance/%s_%s_%s'%(D,CID,sids[0])]['status']==a0 and len(hw)==1,'A: 3 attendance records and 1 homework record are in shared storage, one entry each')
    check(not any(k=='fields-attendance-v1' or len(v['v'] or '')>5000 for k,v in store.rec.items()),'no whole-store blob is uploaded')
    check(A.locator('#sync').is_hidden(),'A: no pending badge once saved')
    A.goto(URL); ready(A); check('공유 저장소' in A.inner_text('.foot') and '이 기기에만' not in A.inner_text('.foot'),'home wording says shared storage, not "this device only"')
    A.click('[data-act="settingsOpen"]'); check('이 기기에만' not in A.inner_text('.sheet'),'settings wording updated'); A.click('.sheet .btn.primary[data-act="closeSheet"]')

    # ---- browser B (a different phone / private tab): same records ----
    cb,B=fresh(b); lesson(B); settle(B)
    check(st(B,sids[0])==a0 and st(B,sids[1])==a1 and st(B,sids[2])=='present' and B.evaluate('([s])=>hwGet(state.date,state.classId,s).note',[sids[2]])=='3쪽만','B (empty browser) shows A\'s attendance, homework and note')
    check(a0 in B.locator('.grid button.tile[data-sid="%s"]'%sids[0]).get_attribute('class') or B.locator('.grid button.tile[data-sid="%s"] .st'%sids[0]).inner_text()!='','B: the lesson page is redrawn with them')

    # ---- clear site data on A and reload: nothing is lost ----
    A.evaluate('localStorage.clear()'); lesson(A); settle(A)
    check(st(A,sids[0])==a0 and st(A,sids[2])=='present','A after clearing site data: records come back from shared storage')

    # ---- two phones, same lesson, different students at the same time ----
    w0=store.writes
    A.evaluate('([s])=>{setAtt(s,"absent"); save(); render();}',[sids[3]]); B.evaluate('([s])=>{setAtt(s,"late"); save(); render();}',[sids[0]])
    settle(A); settle(B,600)
    check(st(A,sids[0])=='late' and st(A,sids[3])=='absent' and st(B,sids[0])=='late' and st(B,sids[3])=='absent','two phones mark different students at once: both changes kept on both')
    check(store.writes-w0==2,'  …with exactly 2 record writes (%d)'%(store.writes-w0))
    # same student: the later change wins everywhere
    A.evaluate('([s])=>{setAtt(s,"online"); save(); render();}',[sids[1]]); A.wait_for_timeout(300)
    B.evaluate('([s])=>{setAtt(s,"absent"); save(); render();}',[sids[1]]); settle(A); settle(B,600)
    check(st(A,sids[1])=='absent' and st(B,sids[1])=='absent','same student on two phones: the later change wins on both')

    # ---- memo sheet open while another phone saves: typing is not lost ----
    bx=tile(A,0).bounding_box(); A.evaluate('window.scrollTo(0,0)'); bx=tile(A,0).bounding_box()
    A.mouse.move(bx['x']+20,bx['y']+20); A.mouse.down(); A.wait_for_timeout(650); A.mouse.up(); A.fill('#noteInput','감기')
    B.evaluate('([s])=>{setAtt(s,"present"); save(); render();}',[sids[3]]); settle(A)
    check(A.locator('#noteInput').count()==1 and A.input_value('#noteInput')=='감기' and A.evaluate('([s])=>attStatus(state.date,state.classId,s)',[sids[3]])=='present','open memo sheet survives a remote change; the data is already current underneath')
    A.click('[data-act="saveAtt"]'); settle(A)
    check(live('attendance/%s_%s_%s'%(D,CID,sids[0])).popitem()[1]['note']=='감기','  …and the memo then saves')

    # ---- offline: taps stay instant, pending state visible, everything arrives later ----
    ca.set_offline(True); w1=store.writes
    for i,s in enumerate(['absent','online','late']): A.evaluate('([s,v])=>{setAtt(s,v); save(); render();}',[sids[i],s])
    A.wait_for_timeout(700)
    check([st(A,sids[i]) for i in range(3)]==['absent','online','late'] and store.writes==w1,'offline: 3 marks show at once and nothing has reached shared storage')
    check(A.locator('#sync').is_visible() and '저장 안 됨' in A.inner_text('#sync') and '3' in A.inner_text('#sync'),'offline: "저장 안 됨 · 3건 대기" is shown (%s)'%A.inner_text('#sync'))
    check(A.evaluate('document.documentElement.scrollWidth<=window.innerWidth'),'no horizontal scroll at 360px with the badge showing')
    # the page itself cannot reload with no network (there is no service worker), so the reload is tested with only the backend unreachable
    ca.route(BURL+'/**',lambda r: r.abort()); ca.set_offline(False); A.wait_for_timeout(500); A.goto(URL); ready(A); A.wait_for_timeout(900)   # give the browser a moment to notice it is online again
    check(A.locator('#sync').is_visible() and '3' in A.inner_text('#sync') and store.writes==w1,'backend unreachable + reload: the queue survives and is still shown (%s)'%A.inner_text('#sync'))
    ca.unroute(BURL+'/**'); settle(A,6500); settle(B,600); lesson(A)
    check(store.writes-w1==3 and [st(B,sids[i]) for i in range(3)]==['absent','online','late'] and A.locator('#sync').is_hidden(),'back online: all 3 reach shared storage and B, badge gone')

    # ---- one-time import of records left in a browser by the earlier app ----
    # fixture: the published app's store format (js source of the published artifact): homework tags, hwx per-book homework,
    # lessonMemo with several memos, extra per-teacher settings, and a class this branch does not have
    T0=1794400000000; K=lambda s: '2026-11-10_jhj-t6_'+s
    fx={'classes':[],'students':[],'enrollments':[],'partnerAtt':{},'seeded':{},
        'attendance':{K('s-강리안'):{'status':'late','note':'버스','at':T0},K('s-김강윤'):{'status':'present','note':'','at':T0+1},'2026-11-10_gyk-a1_s-가나다':{'status':'present','note':'','at':T0+2}},
        'homework':{K('s-강리안'):{'h':True,'note':'','tags':['일부만 함'],'at':T0+3}},
        'hwx':{'calc':{K('s-강리안'):{'h':True,'note':'연산 2쪽','tags':[],'at':T0+4}}},
        'lessonMemo':{'2026-11-10_jhj-t6':{'items':['진도 3단원','준비물: 자'],'at':T0+5}},
        'seating':{'2026-11-10_jhj-t6':{'layout':'4x3','seats':{'8':'s-강리안'},'teacher':'L','at':T0+6}},
        'gbSessions':{'gfix1':{'id':'gfix1','classId':'jhj-t6','date':'2026-11-10','status':'ended','playerIds':['s-강리안'],'joinedAt':{},'seats':{},'layout':'4x3','questionCount':1,'currentQ':1,'startedAt':T0+7,'endedAt':T0+9}},
        'gbQuestions':{'gfix1_1':{'phase':'closed'}},'gbMarks':{'gfix1_1_s-강리안':{'mark':'◎','phase':'first','comment':'','overridden':False,'at':T0+8}},
        'settings':{'jhj':{'seating':True,'hw':'one','memo':True,'hwTypes':['main','calc']}}}
    n_fx=3+1+1+1+1+1+1+1+1   # 11 teacher records
    # shared storage already has a NEWER version of one of them → it must win
    urllib.request.urlopen(urllib.request.Request(BURL+'/seed',data=json.dumps([{'id':'attendance/'+K('s-김강윤'),'v':json.dumps({'status':'absent','note':'','at':T0+5000},ensure_ascii=False),'t':T0+5000},{'id':'settings/jhj','v':json.dumps({'seating':'att'}),'t':T0+5000}]).encode('utf8'),method='POST'))
    w2=store.writes
    cc,C=fresh(b,"if(!localStorage.getItem('fx')){localStorage.setItem('fx','1');localStorage.setItem('fields-attendance-v1',%s);localStorage.setItem('fields-teacher','jhj');}"%json.dumps(json.dumps(fx,ensure_ascii=False)))
    C.goto(URL); ready(C)
    try: C.wait_for_function('document.getElementById("toast").textContent.indexOf("옮겼어요")>=0',timeout=8000); msg=C.inner_text('#toast')
    except Exception: msg=''
    settle(C,800)
    check(str(n_fx-2) in msg,'import: one line tells the teacher how many records were brought over (%s)'%msg)
    r=store.rec
    check(json.loads(r['attendance/'+K('s-강리안')]['v'])['note']=='버스' and json.loads(r['hwx:calc/'+K('s-강리안')]['v'])['note']=='연산 2쪽' and json.loads(r['lessonMemo/2026-11-10_jhj-t6']['v'])['items']==['진도 3단원','준비물: 자'] and json.loads(r['homework/'+K('s-강리안')]['v'])['tags']==['일부만 함'] and 'gbMarks/gfix1_1_s-강리안' in r and 'seating/2026-11-10_jhj-t6' in r and 'attendance/2026-11-10_gyk-a1_s-가나다' in r,
          'import: every old record is in shared storage, including fields this branch has no screen for (tags, hwx, lessonMemo, unknown class)')
    check(json.loads(r['attendance/'+K('s-김강윤')]['v'])['status']=='absent' and C.evaluate('(k)=>db.attendance[k].status',K('s-김강윤'))=='absent' and json.loads(r['settings/jhj']['v'])=={'seating':'att'},'import: newer shared records are not overwritten (and replace the old local ones)')
    w3=store.writes; C.reload(); ready(C); settle(C,1500)
    C2=cc.new_page(); C2.goto(URL); ready(C2); settle(C2,1000)
    check(store.writes==w3 and '옮겼어요' not in C.inner_text('#toast'),'import runs only once (no writes on reload or in a second tab), nothing duplicated')
    check(len([k for k in r if k.startswith('attendance/2026-11-10_jhj-t6_')])==2,'  …one entry per (date, class, student)')
    check(B.evaluate('(k)=>{db=load(); return (db.attendance[k]||{}).note}',K('s-강리안'))=='버스' or (settle(B,800) or B.evaluate('(k)=>(db.attendance[k]||{}).note',K('s-강리안'))=='버스'),'the imported records show on the other phone')

    # ---- seeded history: loaded once, never overwrites a teacher's record ----
    k9='attendance/2026-11-09_jhj-m3_'+sids[0]
    seeded_before=A.evaluate('(k)=>db.attendance[k]||null','2026-11-09_jhj-m3_'+sids[0])
    A.evaluate('([s])=>{state.date="2026-11-09"; setAtt(s,"absent","아픔"); save(); render();}',[sids[0]]); settle(A)
    cd,Dv=fresh(b); lesson(Dv,'2026-11-09'); Dv.evaluate('()=>{save();}'); settle(Dv,1800)   # a brand-new phone seeds its own history, then saves
    check(seeded_before is not None and not seeded_before.get('at') and json.loads(store.rec[k9]['v'])['note']=='아픔' and st(Dv,sids[0],'2026-11-09')=='absent','a new phone\'s seeded history does not overwrite the teacher\'s record')
    check(store.rec['seeded/jhj|realAtt|m3|2026-11-09']['t']==0,'  …seeded flags and history are stored once, as "only if absent"')

    # ---- 초기화 clears only that teacher ----
    ecid=A.evaluate('db.classes.filter(c=>c.teacherId==="eje")[0].id'); ek='2026-11-17_%s_s-테스트'%ecid
    A.evaluate('(k)=>{db.attendance[k]={status:"absent",note:"",at:Date.now()}; persist();}',ek); settle(A)
    A.goto(URL); ready(A); A.click('[data-act="settingsOpen"]'); A.click('[data-act="askReset"]')
    check('모든 기기' in A.inner_text('.sheet'),'reset confirm says it applies on every device')
    A.click('[data-act="resetDo"]'); settle(A,1800); settle(B,800)
    mine=[k for k,v in store.rec.items() if k.startswith('attendance/') and '_jhj-' in k and not v['d'] and json.loads(v['v']).get('at')]
    check(not mine and not store.rec['attendance/'+ek]['d'] and 'settings/jhj' in store.rec and store.rec['settings/jhj']['d'],'초기화: 정혜진\'s entered records and settings are removed from shared storage; 엄지은\'s record stays (%d left)'%len(mine))
    check(B.evaluate('([d,c,s])=>{const r=db.attendance[d+"_"+c+"_"+s]; return !r||!r.at;}',[D,CID,sids[0]]) and B.evaluate('(k)=>!!db.attendance[k]',ek),'  …and the other phone follows')

    # ---- backup exports the shared data; 합치기 restores into it ----
    B.goto(URL); ready(B); B.click('[data-act="settingsOpen"]')
    with B.expect_download() as dl: B.click('[data-act="backupSave"]')
    bpath=os.path.join(out,'sync_backup.json'); dl.value.save_as(bpath); bk=json.load(open(bpath,encoding='utf8'))
    check(ek in bk['db']['attendance'] and bk['db']['lessonMemo']['2026-11-10_jhj-t6']['items'][0]=='진도 3단원' and 'calc' in bk['db'].get('hwx',{}),'백업 저장 on B contains records entered on other phones, incl. the imported hwx / lessonMemo')
    mk='2026-11-18_jhj-w6_s-구교준'; old=json.loads(json.dumps(bk)); old['db']['attendance'][mk]={'status':'late','note':'합치기','at':T0}; old['db']['attendance'][ek]={'status':'present','note':'','at':1}
    mpath=os.path.join(out,'sync_merge.json'); json.dump(old,open(mpath,'w',encoding='utf8'),ensure_ascii=False)
    B.set_input_files('#backupFile',mpath); B.wait_for_timeout(400)
    check(B.locator('[data-act="restoreMerge"]').count()==1 and '모든 기기' in B.inner_text('.sheet'),'restore asks first, offers 합치기, and warns that replacing applies to every device')
    B.click('[data-act="restoreMerge"]'); B.wait_for_timeout(200); mt=B.inner_text('#toast'); settle(B,1500)
    check('1건' in mt and json.loads(store.rec['attendance/'+mk]['v'])['note']=='합치기' and json.loads(store.rec['attendance/'+ek]['v'])['status']=='absent','합치기 brings in the 1 missing record and keeps the newer shared one (%s)'%mt)

    check(not [e for e in errors if e.startswith('pageerror')],'no page errors')
    b.close()
finally:
  web.terminate(); backend.shutdown()
print('ERRORS:',errors)
sys.exit(1 if errors else 0)
