"""자리배치 출석 acceptance test (Playwright + Chromium).

The device time zone is America/New_York and the clock is frozen, so the 등원 / 지각 rule is proven to follow the Seoul
clock and not the phone's. Covers the handoff brief's timing table, flow, integration and regression checks.

Run from the repo root:  python3 tests/seat_att.py      (setup: tests/README.md)
Uses 정혜진's 초2-E2-1 (jhj-m3, Monday 15:00, partner day Friday): 2026-11-16 is "today", 2026-11-02 a past lesson
with no seeded attendance, 2026-11-13 the partner's day.
"""
import json, os, re, subprocess, sys, time
from playwright.sync_api import sync_playwright
HERE=os.path.dirname(os.path.abspath(__file__))
ROOT=os.path.dirname(HERE)
PORT=os.environ.get('PORT','8766')
srv=subprocess.Popen([sys.executable,os.path.join(os.path.dirname(os.path.abspath(__file__)),'serve.py'),PORT,ROOT],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
time.sleep(1)
URL='http://localhost:%s/'%PORT
VENDOR=os.path.join(HERE,'vendor','exceljs.min.js')
EXCEL=open(VENDOR,'rb').read() if os.path.exists(VENDOR) else None
CHROME=os.environ.get('CHROME_PATH')
out=os.path.join(HERE,'out'); os.makedirs(out,exist_ok=True)
errors=[]
CID='jhj-m3'; TODAY='2026-11-16'; PAST='2026-11-02'; PARTNER='2026-11-13'
HANGUL=re.compile('[가-힣]')
def check(cond,msg):
    print(('PASS ' if cond else 'FAIL ')+msg)
    if not cond: errors.append(msg)
def ready(p): p.wait_for_selector('#app > *',timeout=15000)
def setdate(p,d):
    p.evaluate('''(d)=>{const i=document.getElementById("datePick"); i.value=d; i.dispatchEvent(new Event("change",{bubbles:true}));}''',d); p.wait_for_timeout(150)
def openclass(p,d):
    p.goto(URL); ready(p); setdate(p,d); p.click('[data-act="openClass"][data-cid="%s"]'%CID); p.wait_for_timeout(200)
def mode(p,v):
    p.goto(URL); ready(p); p.click('[data-act="settingsOpen"]'); p.click('[data-act="setOpt"][data-k="seating"][data-v="%s"]'%v); p.wait_for_timeout(150)
def att(p,d,sid): return p.evaluate('([d,c,s])=>attStatus(d,c,s)',[d,CID,sid])
def rec(p,d,sid): return p.evaluate('([d,c,s])=>db.attendance[d+"_"+c+"_"+s]||null',[d,CID,sid])
def seats(p,d): return p.evaluate('([d,c])=>(db.seating[d+"_"+c]||{seats:{}}).seats',[d,CID])
def stored(p): return json.loads(p.evaluate('localStorage.getItem("fields-attendance-v1")'))
def seat_first(p):
    """select the first unseated chip, put the student in the first empty seat; returns the student id"""
    chip=p.locator('[data-act="saChip"]').first; sid=chip.get_attribute('data-sid'); chip.click()
    p.locator('.seats button.seat').first.click(); p.wait_for_timeout(120); return sid
def noscroll(p): return p.evaluate('document.documentElement.scrollWidth<=window.innerWidth')
try:
  with sync_playwright() as pw:
    b=pw.chromium.launch(executable_path=CHROME,args=['--no-sandbox']) if CHROME else pw.chromium.launch()
    ctx=b.new_context(accept_downloads=True,viewport={'width':360,'height':800},timezone_id='America/New_York')
    ctx.add_init_script('window.FIELDS_REMOTE=null;')   # local only: never write to the real Firebase project
    if EXCEL: ctx.route('https://cdn.jsdelivr.net/**',lambda r: r.fulfill(status=200,body=EXCEL,headers={'content-type':'application/javascript','access-control-allow-origin':'*'}))
    ctx.route('https://fonts.**',lambda r: r.fulfill(status=200,body=''))
    pg=ctx.new_page()
    pg.on('pageerror',lambda e: errors.append('pageerror: '+str(e)))
    pg.clock.set_fixed_time('2026-11-16T05:50:00Z')   # Seoul 14:50, New York 00:50
    pg.goto(URL); ready(pg)
    check(pg.evaluate('Intl.DateTimeFormat().resolvedOptions().timeZone')=='America/New_York','device time zone is not Seoul')
    pg.click('[data-act="pickTeacher"][data-tid="jhj"]'); pg.wait_for_timeout(200)

    # ---- settings: default 켜기, old stored values still read, three options ----
    pg.click('[data-act="settingsOpen"]')
    pressed=lambda: pg.locator('[data-k="seating"][aria-pressed="true"]').get_attribute('data-v')
    check(pressed()=='on' and pg.locator('[data-k="seating"]').count()==3,'default mode is 켜기, three options shown')
    for old,want in [(True,'on'),(False,'off'),('att','att')]:
        pg.evaluate('(v)=>{db.settings.jhj={seating:v}; persist(); render();}',old)
        check(pressed()==want,'stored seating=%r reads as %s'%(old,want))
    pg.evaluate('()=>{delete db.settings.jhj; persist();}')
    mode(pg,'off'); check(stored(pg)['settings']['jhj']['seating'] is False,'끄기 is stored as false (unchanged format)')
    mode(pg,'on');  check(stored(pg)['settings']['jhj']['seating'] is True,'켜기 is stored as true (unchanged format)')

    # ---- 끄기 / 켜기 behave as before ----
    mode(pg,'off'); openclass(pg,TODAY)
    check(pg.locator('.grid button.tile[data-act="cycle"]').count()>0 and pg.locator('[data-act="openSeat"]').count()==0 and pg.locator('#saRule').count()==0,'끄기: name cards, no 자리배치 button, no seat screen')
    mode(pg,'on'); openclass(pg,TODAY)
    check(pg.locator('.grid button.tile[data-act="cycle"]').count()>0 and pg.locator('[data-act="openSeat"]').count()==1 and pg.locator('#saRule').count()==0,'켜기: name cards and the 자리배치 button')

    # ---- 자리배치 출석: start state ----
    mode(pg,'att'); check(stored(pg)['settings']['jhj']['seating']=='att','자리배치 출석 is stored as "att"')
    pg.evaluate('([c])=>{db.seating["2026-10-26_"+c]={layout:"4x3",teacher:"L",seats:{"5":db.enrollments.filter(e=>e.classId===c)[0].studentId},at:1}; persist();}',[CID])   # an earlier lesson's seating
    openclass(pg,TODAY)
    n=pg.locator('[data-act="saChip"]').count()
    check(pg.locator('#saRule').count()==1 and pg.locator('.grid button.tile[data-act="cycle"]').count()==0 and pg.locator('[data-act="openSeat"]').count()==0,'seat screen replaces the name cards; 🪑 button hidden')
    check(n>=10 and pg.locator('.seats button.tile').count()==0,'everyone starts unseated, no prefill from the earlier lesson (%d chips)'%n)
    pg.locator('[data-act="saChip"]').first.click()
    check(pg.locator('.seat.last').count()==1 and pg.locator('.sarow button').count()==4,'selecting a student shows the 지난 자리 hint and the action row')
    pg.locator('[data-act="saChip"]').first.click()
    check(pg.locator('.sarow').count()==0,'tapping the chip again deselects')

    # ---- timing table (Seoul time; device is in New York) ----
    for utc,seoul,want,cls in [('05:50:00','14:50','present','ok'),('06:00:00','15:00:00','present','mid'),('06:04:59','15:04:59','present','mid'),('06:05:00','15:05:00','late','bad'),('09:30:00','18:30','late','bad')]:
        pg.clock.set_fixed_time('2026-11-16T%sZ'%utc); pg.evaluate('render()')
        ok_line=cls in pg.locator('#saRule').get_attribute('class') and seoul[:5] in pg.inner_text('#saRule')
        sid=seat_first(pg); got=att(pg,TODAY,sid)
        check(got==want and ok_line,'seated at Seoul %s → %s (status line %s, clock shown)'%(seoul,got,cls))
        check(sid in seats(pg,TODAY).values() and rec(pg,TODAY,sid) is not None,'  …seating and attendance both saved')
    saved=stored(pg)
    check(len(saved['seating'][TODAY+'_'+CID]['seats'])==5 and sum(1 for k in saved['attendance'] if k.startswith(TODAY+'_'+CID))==5,'localStorage holds 5 seats and 5 attendance records')

    # ---- flow on today's lesson ----
    late=pg.locator('.seats button.tile.s-mid').first; sid=late.get_attribute('data-sid'); late.click(); pg.wait_for_timeout(120)
    check(att(pg,TODAY,sid)=='none' and sid not in seats(pg,TODAY).values() and pg.locator('[data-act="saChip"][data-sid="%s"]'%sid).count()==1,'지각 → tap → 미체크: seat freed, student back in the list')
    pres=pg.locator('.seats button.tile.s-ok').first; sid=pres.get_attribute('data-sid'); pres.click(); pg.wait_for_timeout(120)
    check(att(pg,TODAY,sid)=='late' and sid in seats(pg,TODAY).values(),'등원 → tap → 지각 (stays seated)')
    chip=pg.locator('[data-act="saChip"]').first; sid=chip.get_attribute('data-sid'); chip.click(); pg.click('[data-act="saSet"][data-st="absent"]'); pg.wait_for_timeout(100)
    a1=att(pg,TODAY,sid); pg.click('[data-act="saChip"][data-sid="%s"]'%sid); pg.click('[data-act="saSet"][data-st="none"]'); pg.wait_for_timeout(100)
    check(a1=='absent' and att(pg,TODAY,sid)=='none' and rec(pg,TODAY,sid) is None,'결석 → 미체크 from the action row (record removed)')
    chip=pg.locator('[data-act="saChip"]').first; on_sid=chip.get_attribute('data-sid'); chip.click(); pg.click('[data-act="saSet"][data-st="online"]'); pg.wait_for_timeout(100)
    pg.click('[data-act="saClose"]'); pg.wait_for_timeout(150)
    ros=pg.evaluate('([d,c])=>rosterOf(db,c,d).map(s=>[s.id,attStatus(d,c,s.id)])',[TODAY,CID])
    seated=set(seats(pg,TODAY).values())
    check(att(pg,TODAY,on_sid)=='online' and all(st=='absent' for i,st in ros if i not in seated and i!=on_sid) and all(st in('present','late') for i,st in ros if i in seated),'마감: the rest → 결석, 온라인 kept, seated students untouched')

    # ---- long-press: memo sheet + 자리 옮기기; the next tap always registers ----
    pg.evaluate('window.scrollTo(0,0)'); pg.wait_for_timeout(150)   # raw mouse events need the tile clear of the sticky summary
    tile=pg.locator('.seats button.tile').first; sid=tile.get_attribute('data-sid'); st0=att(pg,TODAY,sid); bx=tile.bounding_box()
    pg.mouse.move(bx['x']+20,bx['y']+20); pg.mouse.down(); pg.mouse.move(bx['x']+60,bx['y']+20); pg.wait_for_timeout(650)
    check(pg.locator('.sheet').count()==0,'long-press is cancelled when the finger moves')
    pg.mouse.move(5,5); pg.mouse.up()   # release away from the tile: a mouse drag that ends on it would count as a click
    check(att(pg,TODAY,sid)==st0,'  …and the cancelled press changed nothing')
    pg.mouse.move(bx['x']+20,bx['y']+20); pg.mouse.down(); pg.wait_for_timeout(650); pg.mouse.up(); pg.wait_for_timeout(100)
    check(pg.locator('.sheet #noteInput').count()==1 and pg.locator('[data-act="saMove"]').count()==1 and att(pg,TODAY,sid)==st0,'long-press opens the memo sheet with 자리 옮기기 (status unchanged)')
    old=[k for k,v in seats(pg,TODAY).items() if v==sid][0]
    pg.click('[data-act="saMove"]'); pg.locator('.seats button.seat').last.click(); pg.wait_for_timeout(120)
    new=[k for k,v in seats(pg,TODAY).items() if v==sid]
    check(new and new[0]!=old and att(pg,TODAY,sid)==st0,'자리 옮기기 moves the seat (%s → %s) and keeps %s'%(old,new and new[0],st0))
    t2=pg.locator('.seats button.tile[data-sid="%s"]'%sid); want2='late' if st0=='present' else 'none'; t2.click(); pg.wait_for_timeout(120)
    check(att(pg,TODAY,sid)==want2,'the tap right after a long-press registers')

    # ---- integration ----
    inroom=[i for i,st in pg.evaluate('([d,c])=>rosterOf(db,c,d).map(s=>[s.id,attStatus(d,c,s.id)])',[TODAY,CID]) if st in('present','late')]
    check(pg.locator('.hwcard').count()==len(inroom) and len(inroom)>0,'숙제 확인 lists only seated (등원·지각) students: %d'%len(inroom))
    check(noscroll(pg),'no horizontal scroll at 360px (seat screen, ko)')
    pg.click('[data-act="gbStart"]'); pg.wait_for_timeout(200)
    g=pg.evaluate('()=>{const s=db.gbSessions[state.sessionId]; return {seats:s.seats,players:s.playerIds};}')
    check(g['seats']==seats(pg,TODAY) and on_sid in g['players'] and pg.locator('.seats').count()==1,'골든벨 starts with this screen\'s seats; the 온라인 student plays without one')
    check(noscroll(pg),'no horizontal scroll at 360px (골든벨)')
    pg.goto(URL); ready(pg)
    for fmt in ['log','summary']:
        pg.click('[data-act="exportOpen"]'); pg.click('[data-act="exportFmt"][data-f="%s"]'%fmt); pg.wait_for_timeout(150)
        pg.evaluate('([d])=>{state.sheet.preset="custom"; state.sheet.start=d; state.sheet.end=d; render();}',[TODAY])
        try:
            with pg.expect_download(timeout=20000) as dl: pg.click('[data-act="exportRun"]')
            path=os.path.join(out,'seatatt_'+fmt+'.xlsx'); dl.value.save_as(path)
            txt=''
            try:
                import openpyxl
                wb=openpyxl.load_workbook(path); txt=' '.join(str(c.value) for ws in wb for row in ws.iter_rows() for c in row if c.value is not None)
                check('자리배치' in txt and '지각' in txt,'export %s contains the seating block and attendance'%fmt)
            except ImportError:
                import zipfile   # no openpyxl: read the sheet XML directly
                z=zipfile.ZipFile(path); xml=' '.join(z.read(n).decode('utf8') for n in z.namelist() if n.endswith('.xml'))
                check('자리배치' in xml and '지각' in xml and '<v>NaN</v>' not in xml,'export %s contains the seating block and attendance, no invalid cells'%fmt)
        except Exception as e: check(False,'export %s: %s'%(fmt,str(e)[:80]))
        pg.goto(URL); ready(pg)

    # ---- past lesson: always 등원, 지각 only by tapping ----
    pg.clock.set_fixed_time('2026-11-16T09:30:00Z'); openclass(pg,PAST)
    check('neutral' in pg.locator('#saRule').get_attribute('class'),'past lesson: neutral status line')
    sid=seat_first(pg); a=att(pg,PAST,sid)
    pg.click('.seats button.tile[data-sid="%s"]'%sid); pg.wait_for_timeout(100); b2=att(pg,PAST,sid)
    pg.click('.seats button.tile[data-sid="%s"]'%sid); pg.wait_for_timeout(100)
    check(a=='present' and b2=='late' and att(pg,PAST,sid)=='none' and sid not in seats(pg,PAST).values(),'past lesson at Seoul 18:30: 등원; tap → 지각; tap → 미체크 (seat freed)')

    # ---- partner day stays view-only ----
    pg.evaluate('([d,c])=>{state.date=d; state.classId=c; state.view="class"; render();}',[PARTNER,CID])   # the home list only shows her own days
    check(pg.locator('.tile.ro').count()>0 and pg.locator('[data-act="saSeat"],[data-act="saChip"],[data-act="cycle"]').count()==0,'partner day is view-only in 자리배치 출석 mode')

    # ---- layouts, 보조교사 view, 선생님 side ----
    openclass(pg,TODAY)
    before=seats(pg,TODAY)
    pg.click('[data-act="seatView"][data-v="A"]'); pg.wait_for_timeout(100)
    check(pg.locator('.front.back').count()==1 and seats(pg,TODAY)==before,'보조교사 view redraws the room, saved seats unchanged')
    pg.click('[data-act="seatView"][data-v="T"]'); pg.click('button.tdesk'); pg.wait_for_timeout(100)
    check(pg.evaluate('([d,c])=>db.seating[d+"_"+c].teacher',[TODAY,CID])=='R' and seats(pg,TODAY)==before,'선생님 side switches, seats kept')
    pg.click('[data-act="layout"][data-l="3x4"]'); pg.wait_for_timeout(100)
    check(pg.locator('[data-act="layoutDo"]').count()==1,'changing layout with students seated asks first')
    pg.click('[data-act="cancelConfirm"]')

    # ---- every teacher, every weekday: no errors in 자리배치 출석 mode ----
    tids=pg.evaluate('TEACHERS.map(x=>x.id)'); opened=0
    for tid in tids:
        pg.evaluate('(tid)=>{T=teacherById(tid); db.settings[tid]=Object.assign({},db.settings[tid],{seating:"att"}); state.view="home"; state.sheet=null; render();}',tid)
        for d in ['2026-11-16','2026-11-17','2026-11-18','2026-11-19','2026-11-20','2026-11-21','2026-11-22']:
            for cid in pg.evaluate('(d)=>{state.date=d; state.view="home"; render(); return [...document.querySelectorAll("[data-act=openClass]")].map(e=>e.getAttribute("data-cid"));}',d):
                pg.evaluate('([d,c])=>{state.date=d; state.classId=c; state.view="class"; state.seatSel=null; render();}',[d,cid]); opened+=1
                if not noscroll(pg): check(False,'horizontal scroll: %s %s'%(cid,d))
    check(opened>20 and not [e for e in errors if e.startswith('pageerror')],'opened %d lessons for %d teachers across the week without errors'%(opened,len(tids)))

    # ---- English UI ----
    pg.evaluate('()=>{T=teacherById("jhj"); render();}'); openclass(pg,TODAY); pg.click('[data-act="lang"]'); pg.wait_for_timeout(150)
    parts=[pg.inner_text('#saRule'),pg.inner_text('#saHelp'),pg.inner_text('.sahead'),pg.inner_text('.layoutseg'),pg.inner_text('.viewseg')]
    pg.locator('[data-act="saChip"]').first.click(); parts+=[pg.locator('.sarow').inner_text()]; pg.click('[data-act="saCancel"]')
    check(noscroll(pg),'no horizontal scroll at 360px (seat screen, en)')
    pg.goto(URL); ready(pg); pg.click('[data-act="settingsOpen"]'); parts+=[pg.inner_text('.seg.three'),pg.inner_text('.optdesc')]
    check(noscroll(pg),'no horizontal scroll at 360px (settings, en)')
    bad=[x for x in parts if HANGUL.search(x)]
    check(not bad,'English UI: no Korean in the new strings %s'%bad[:2])
    missing=pg.evaluate('Object.keys(I18N.ko).filter(k=>!(k in I18N.en)).concat(Object.keys(I18N.en).filter(k=>!(k in I18N.ko)))')
    check(not missing,'every string has both ko and en %s'%missing[:5])
    pg.locator('.sheet .btn.primary[data-act="closeSheet"]').click(); pg.click('[data-act="lang"]')
    pg.screenshot(path=os.path.join(out,'seat_att_home.png'))
    openclass(pg,TODAY); pg.screenshot(path=os.path.join(out,'seat_att.png'),full_page=True)
    b.close()
finally:
  srv.terminate()
print('ERRORS:',errors)
sys.exit(1 if errors else 0)
