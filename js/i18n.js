/* js/i18n.js — CONFIG, storage keys, I18N strings (ko/en), t()
   Plain script, no IIFE: the app's files share the global scope and index.html loads them in a fixed order
   (i18n → model → teachers → data → views → excel → app). Code that runs at load may only use earlier files. */

/* ============================================================
   CONFIG — 언어 전환 버튼 켜기/끄기
   false: 버튼이 사라지고 모든 화면이 한국어로 고정됩니다.
   ============================================================ */
var CONFIG = { ENABLE_LANG_TOGGLE: true, DEFAULT_LOCALE: "ko" };

var STORE_KEY = "fields-attendance-v1";   // one store for every teacher on this device (old single-teacher apps used academy-jhj-v5 / academy-eje-v1)
var LOCALE_KEY = "academy-locale";
var LAST_BACKUP_KEY = "fields-last-backup";
// All persistence goes through js/storage.js (localStorage today; swap the adapter there for Firebase later).
var store = window.FieldsStorage;

/* ---------- i18n ---------- */
var I18N = {
  ko: {
    appName:"필즈 출석부", teacherSuffix:"선생님", pickTitle:"선생님을 골라 주세요", pickHint:"이 기기에서 쓸 선생님이에요. 나중에 ⚙ 설정에서 바꿀 수 있어요.", pickClasses:"맡은 반 {n}개", pickCurrent:"사용 중",
    settings:"설정", switchTeacher:"선생님 바꾸기", pinTitle:"비밀번호 입력", pinHint:"선생님을 바꾸려면 6자리 비밀번호를 입력해 주세요", pinWrong:"비밀번호가 틀렸어요", pinDel:"지우기", setSeating:"자리배치", on:"켜기", off:"끄기",
    seatAttOpt:"자리배치 출석", seatT_off:"자리배치 끄기", seatD_off:"출석은 이름 카드로, 자리배치 버튼은 숨겨요.", seatT_on:"자리배치 켜기", seatD_on:"지금처럼: 이름 카드로 출석한 뒤, 🪑 자리배치에서 따로 자리를 정해요.", seatT_att:"자리배치 출석", seatD_att:"출석과 자리배치를 한 화면에서. 자리를 탭하는 것이 곧 출석이에요. 이름 카드 출석 화면은 나오지 않아요.",
    saRuleBefore:"{s} 시작 · {l} 전까지 앉으면 등원", saRuleGrace:"수업 시작 · {n}분 뒤({l})부터 지각", saRuleLate:"{l} 지남 · 지금 앉으면 지각", saRulePast:"지난 수업 · 앉으면 등원 (지각은 앉은 칸 탭)", saRuleFuture:"예정된 수업 · 앉으면 등원 (지각은 앉은 칸 탭)", saClock:"서울 시각",
    saHelp:"학생 탭 → 자리 탭 · 앉은 칸 탭: 등원 → 지각 → 미체크 · 길게 누르면 메모·자리 옮기기", saHelpSel:"<b>{name}</b> → 자리 탭 = {st} · 또는 온라인 / 결석 / 미체크", saHelpMove:"<b>{name}</b> → 옮길 자리를 탭하세요 · 출석은 그대로예요",
    saTray:"아직 안 앉은 학생 ({n})", saClose:"마감 · 남은 학생 결석", saClosed:"미체크 {n}명 → 결석", saCloseNone:"미체크 학생이 없어요", saHere:"여기", saLast:"지난 자리", saMove:"🪑 자리 옮기기", setHw:"숙제 확인 방식", hwOne:"한 번에 확인", hwTwoLbl:"연습 · 리뷰 따로", setHint:"설정은 선생님마다 따로 저장돼요. 바꿔도 지난 기록은 지워지지 않아요.",
    backup:"백업", backupSave:"백업 저장", backupLoad:"백업 불러오기", backupHint:"기록은 이 기기에만 있어요. 가끔 백업 파일을 저장해 두세요. 예전 선생님별 출석부의 백업 파일도 불러올 수 있어요.",
    backupSaved:"백업 파일을 저장했어요", backupBad:"백업 파일을 읽지 못했어요", legacyDone:"{name} 선생님 기록 {n}건을 가져왔어요", restoreConfirm:"{date} 백업으로 이 기기의 모든 기록을 바꿀까요?", restoreDo:"바꾸기", restoreDone:"백업으로 되돌렸어요", close:"닫기", localNote:"기록은 이 기기에만 저장돼요.", levelup:"레벨업 특강", levelupNoGb:"레벨업 특강 · 골든벨 없음", subTag:"부담임", roleA:"담임", roleB:"부담임", roleBDay:"부담임 수업", roleADay:"담임 수업", subNoGb:"부담임 수업 · 골든벨 없음", back:"뒤로", today:"오늘", prevDay:"이전 날", nextDay:"다음 날", pickDate:"날짜 선택",
    classes:"오늘 수업", noClassDay:"이 날은 수업이 없어요", nextClassDay:"다음 수업일로", notToday:"오늘은 수업 없는 반", students:"{n}명",
    done:"출석 완료", notStarted:"시작 전", remaining:"{n}명 남음", noStudents:"학생 없음",
    present:"등원", online:"온라인", late:"지각", absent:"결석", none:"미체크",
    noteHint:"탭: 온라인 → 지각 → 결석 → 미체크 · 두 번 탭: 등원 · 길게 누르면 메모",
    hw:"숙제 확인", hwDone:"했어요", hwTodo:"안 했어요", hwAbsent:"결석", hwAllOn:"모두 했어요", hwAllOff:"모두 지우기", hwCount:"{a} / {n}명 완료", hwHint:"카드를 탭하면 체크 · ✎ 메모로 학생별 코멘트 · 등원·지각 학생만 확인해요", hwNone:"교실에 온 학생이 없어요. 출석에서 등원·지각으로 체크한 학생만 숙제를 확인해요.", hwOut:"온라인·결석·미체크 {n}명은 숙제 확인에서 빠져요", hwNoteBtn:"메모", hwNoteTitle:"숙제 메모", hwNotePh:"예: 3쪽만 풀어 옴, 다음 시간에 다시 확인", hwQuick:"빠른 입력", hwNoteCount:"메모 {n}", hwP:"연습", hwR:"리뷰", hwHint2:"연습 · 리뷰 칸을 각각 탭해서 체크 · 둘 다 체크하면 완료 · ✎ 메모로 학생별 코멘트 · 등원·지각 학생만 확인해요",
    emptyClass:"이 날짜에 등록된 학생이 없어요", rosterPending:"명단 준비 중", rosterPendingHint:"아직 학생 명단을 받지 않았어요. 명단이 등록되면 이 반에서 출석·숙제·골든벨을 쓸 수 있어요.", editingPast:"지난 날짜의 기록을 수정하고 있어요", expBanner:"미리 받은 출석 정보로 {n}명을 채웠어요. 수업 시작 때 바뀐 학생만 고쳐 주세요.", expConfirm:"이대로 확인", expDone:"출석을 확인했어요", expTag:"예정", futureDate:"아직 오지 않은 날짜예요",
    saved:"저장됨", note:"메모", notePh:"예: 감기로 결석, 보호자 연락함", save:"저장", cancel:"취소",
    gb:"골든벨", gbStart:"골든벨 시작", gbResume:"골든벨 이어서 하기", gbView:"골든벨 결과 보기", gbOnePerDay:"골든벨은 반마다 하루 한 번이에요", gbReset:"골든벨 리셋", gbResetAsk:"{cls} · {date} 골든벨을 처음부터 다시 할까요? 지금까지의 문제 {q}개와 표시 {m}개가 모두 지워져요. 출석·숙제·자리배치는 그대로예요.", gbResetDo:"리셋하고 Q1부터", gbResetDone:"골든벨을 리셋했어요 · Q1", gbResetNoPlayers:"골든벨을 리셋했어요. 출석 체크 후 다시 시작하세요", gbNeedAtt:"출석 체크 후 시작할 수 있어요 (등원·온라인·지각 학생이 참가)",
    gbPlayers:"참가 {n}명", gbSession:"골든벨 #{n}", gbQs:"{n}문제", gbLive:"진행 중", gbEnded:"종료",
    gbNoSess:"아직 진행한 골든벨이 없어요",
    ph_first:"진행 중", ph_hint:"진행 중", ph_closed:"종료",
    in_first:"탭할 때마다: 미표시 → <b>◎</b> → <b>O</b> → <b>△</b> → <b>X</b> → 미표시",
    in_hint:"탭: <b>X</b> ↔ <b>△</b> · ◎/O 학생은 잠김", in_closed:"종료된 문제예요 · 고치려면 길게 누르세요",
    unmarked:"미표시", revealHint:"힌트 공개", closeQ:"문제 종료", nextQ:"다음 문제", toCurrent:"Q{n}로 이동", endGb:"골든벨 종료",
    confirmEnd:"현재 문제를 종료하고 골든벨을 끝낼까요? (미표시 학생은 미표시로 남아요)", nextStarted:"Q{a} 종료 → Q{b}", confirmEndDo:"종료하기",
    lockedToast:"이전 단계에서 표시된 학생이에요 · 길게 눌러 수정", closedToast:"종료된 문제예요 · 길게 눌러 수정",
    closedDone:"미표시 {n}명 → X", addPlayer:"참가자 추가", addPlayerTitle:"늦게 온 학생 추가", addPlayerNote:"앞 문제는 '–'(미참가)로 표시돼요", added:"{name} 학생 추가",
    gbHelp:"수정·코멘트는 길게 누르세요",
    rankNow:"현재 순위 (Q{n}까지)", rankFinal:"최종 순위", rankQ:"이번 문제", ptsUnit:"점", rankCol:"순위", ptsCol:"점수", scoreKey:"◎ 5 · O 4 · △ 3 · X 2 · 미표시/미참가 1 · 문제 안 동점은 먼저 표시된 학생이 위, 합계 동점은 1위를 더 많이 한 학생이 위예요",
    results:"골든벨 결과", legendFirst:"첫 시도", legendRetry:"재도전", legendHint:"힌트 후", legendX:"오답", legendNa:"미참가", legendCm:"코멘트",
    nameCol:"이름", footRow:"힌트 전 정답", noComments:"코멘트 없음", tapHint:"칸을 탭하면 상세 · 이름을 탭하면 코멘트 모아보기",
    markLbl:"표시", noMark:"없음", comment:"코멘트", commentPh:"예: 분모끼리 더함", recorded:"기록 단계: {p}", overridden:"수정됨", notPlayed:"이 문제에 참가하지 않았어요",
    resume:"이어서 하기",
    prevLesson:"이전 수업", nextLesson:"다음 수업", noLessonDay:"이 반은 이 날 수업이 없어요",
    partnerBanner:"{name} 선생님 수업 · 보기 전용", partnerBannerB:"부담임 {name} 선생님 수업 · 보기 전용", partnerBannerA:"담임 {name} 선생님 수업 · 보기 전용", partnerHint:"다른 선생님 수업이라 수정할 수 없어요", partnerMeta:"{name} 선생님",
    exportBtn:"엑셀 내보내기", fmtLbl:"형식", fmtLog:"공식 출석부", fmtSum:"기록 요약", fmtLogHint:"수업마다 시트 1개 (날짜 · 반)", fmtSumHint:"요약 시트 + 반마다 시트 1개 (출석 · 숙제 · 골든벨 점수와 순위)", exportTooLong:"기간은 1년 이하로 선택해 주세요", exportTitle:"엑셀로 내보내기", exportRange:"기간", presetToday:"오늘", presetWeek:"이번 주", presetMonth:"이번 달", presetCustom:"직접 선택",
    exportClasses:"반", exportNoClasses:"이 기간에 수업이 없어요", exportSeating:"자리배치 포함 (골든벨 시트 위에 표시)", exportDo:"내보내기", exporting:"만드는 중…",
    exportSaved:"엑셀 파일을 저장했어요", exportDeclined:"저장을 취소했어요", exportBusy:"잠시 후 다시 눌러 주세요", exportUnavailable:"이 화면에서는 파일을 저장할 수 없어요",
    exportFailed:"파일을 만들지 못했어요. 다시 시도해 주세요", exportLoadFail:"엑셀 도구를 불러오지 못했어요. 인터넷 연결을 확인해 주세요",
    gb_xl_att:"출석", gb_xl_date:"날짜", gb_xl_class:"반", gb_xl_file:"출석_골든벨",
    seatViewLbl:"보는 위치", viewT:"🧑‍🏫 선생님 (앞)", viewA:"🧑‍🎓 보조교사 (뒤)", backAide:"뒤 · 🧑‍🎓 보조교사", teacherRef:"선생님 기준",
    seatBtn:"자리배치", seatCount:"배치 {a}/{b}", front:"앞 · 선생님", frontOnly:"앞", teacherDesk:"선생님", teacherSideLbl:"선생님 자리", sideL:"◀ 맨 왼쪽", sideR:"맨 오른쪽 ▶", teacherTapHint:"탭하면 반대쪽으로", teacherSwap:"바꾸기", emptySeat:"빈자리", unseated:"자리 없는 학생 ({n})", allSeated:"모두 자리에 앉았어요",
    seatIdle:"학생을 탭한 뒤 자리를 탭하세요", seatSel:"<b>{name}</b> → 자리를 탭하세요 · 앉은 자리를 탭하면 서로 바꿔요",
    unseat:"자리에서 빼기", clearSeats:"모두 빼기", clearConfirm:"모든 학생을 자리에서 뺄까요?", seatDone:"완료",
    onlineNote:"온라인 학생은 자리 없이 골든벨에 참가해요: {names}", prefilled:"지난 수업 자리로 채웠어요. 바뀐 학생만 고치면 돼요.", noSeatSec:"자리 없음",
    pickSeat:"{name} 학생의 자리를 고르세요 (지각으로 출석 처리돼요)", layout43:"4 × 3", layout34:"3 × 4", layout43s:"가로 4 · 세로 3", layout34s:"가로 3 · 세로 4", layoutConfirm:"배치를 바꾸면 모든 자리가 비워져요. 바꿀까요?", layoutDo:"바꾸기", addNoSeat:"자리 없이 추가", noPresent:"등원·지각 학생이 없어요. 출석 체크를 먼저 해주세요.",
    sample:"샘플", sampleNote:"예시 데이터예요. 이 기기에만 저장돼요.", reset:"이 선생님 기록 초기화", resetConfirm:"{name} 선생님의 이 기기 기록을 모두 지우고 처음 상태로 되돌릴까요? 다른 선생님 기록은 그대로예요.", resetDo:"초기화", resetDone:"초기화했어요",
    langBtn:"EN",
    saveFail:"저장하지 못했어요. 브라우저 저장 공간을 확인하고 백업을 저장해 주세요", storageOff:"이 브라우저에서는 기록을 저장할 수 없어요 (사생활 보호 모드인지 확인해 주세요)",
    lastBackup:"마지막 백업: {date}", noBackupYet:"아직 백업을 저장한 적이 없어요",
    restoreAsk:"{date} 백업으로 이 기기의 모든 기록을 바꿀까요? 지금 기록은 지워져요.", restoreCounts:"백업 내용: 출석 {a}건 · 숙제 {h}건 · 골든벨 {g}회", restoreNoDate:"날짜 모름",
    backupFirst:"지금 기록 먼저 백업", legacyAsk:"{name} 선생님의 예전 출석부 백업을 가져올까요? 같은 수업의 기록은 백업 내용으로 바뀌어요.", legacyDo:"가져오기",
    remoteReload:"다른 탭에서 바뀐 기록을 불러왔어요",
    sharedNote:"기록은 학원 공유 저장소에 저장돼요. 다른 기기에서도 같은 기록이 보여요.", sharedBackupHint:"기록은 공유 저장소에 저장돼요. 백업 파일은 만일을 위한 사본이에요. 예전 출석부(다른 주소에서 쓰던 앱)의 백업 파일은 ‘합치기’로 가져올 수 있어요.", syncSaving:"저장 중… {n}건", syncFailed:"⚠ 저장 안 됨 · {n}건 대기", syncImported:"이 기기에 있던 기록 {n}건을 공유 저장소로 옮겼어요",
    restoreAskShared:"{date} 백업으로 공유 저장소의 모든 기록을 바꿀까요? 모든 기기에서 지금 기록이 지워져요.", restoreMerge:"합치기", mergeHint:"합치기: 지금 기록은 그대로 두고, 백업에만 있거나 백업 쪽이 더 새로운 기록만 가져와요.", mergeDone:"백업에서 기록 {n}건을 가져왔어요", mergeNone:"새로 가져올 기록이 없어요", resetConfirmShared:"{name} 선생님의 기록을 모두 지우고 처음 상태로 되돌릴까요? 모든 기기에서 지워져요. 다른 선생님 기록은 그대로예요."
  },
  en: {
    appName:"Fields Attendance", teacherSuffix:"", pickTitle:"Who's using this device?", pickHint:"You can change this later in ⚙ Settings.", pickClasses:"{n} classes", pickCurrent:"Current",
    settings:"Settings", switchTeacher:"Switch teacher", pinTitle:"Enter password", pinHint:"Enter the 6-digit password to switch teachers", pinWrong:"Wrong password", pinDel:"Delete", setSeating:"Seating", on:"On", off:"Off",
    seatAttOpt:"Seat check-in", seatT_off:"Seating off", seatD_off:"Attendance uses name cards, and the seating button is hidden.", seatT_on:"Seating on", seatD_on:"As now: take attendance with name cards, then set seats separately in 🪑 Seating.", seatT_att:"Seat check-in", seatD_att:"Attendance and seating on one screen. Seating a student is the check-in. The name-card attendance screen is not shown.",
    saRuleBefore:"Starts {s} · seated before {l} = In person", saRuleGrace:"Class started · Late from {l} (in {n} min)", saRuleLate:"Past {l} · seated now = Late", saRulePast:"Past lesson · seated = In person (tap the seat for Late)", saRuleFuture:"Upcoming lesson · seated = In person (tap the seat for Late)", saClock:"Seoul time",
    saHelp:"Tap a student, then a seat · Tap a seated student: In person → Late → Unchecked · Long-press for a note or to move", saHelpSel:"<b>{name}</b> → tap a seat = {st} · or Online / Absent / Unchecked", saHelpMove:"<b>{name}</b> → tap the new seat · attendance stays as it is",
    saTray:"Not seated yet ({n})", saClose:"Close · mark the rest absent", saClosed:"{n} unchecked → Absent", saCloseNone:"No unchecked students", saHere:"Here", saLast:"Last seat", saMove:"🪑 Move seat", setHw:"Homework check", hwOne:"One check", hwTwoLbl:"Practice · Review", setHint:"Settings are saved per teacher. Changing them never deletes past records.",
    backup:"Backup", backupSave:"Save backup", backupLoad:"Load backup", backupHint:"Records live on this device only. Save a backup now and then. Backups from the old per-teacher apps can be loaded too.",
    backupSaved:"Backup saved", backupBad:"Couldn't read that backup file", legacyDone:"Imported {n} records for {name}", restoreConfirm:"Replace all records on this device with the backup from {date}?", restoreDo:"Replace", restoreDone:"Restored from backup", close:"Close", localNote:"Records are saved on this device only.", levelup:"Level-up", levelupNoGb:"Level-up class · no Golden Bell", subTag:"Sub", roleA:"Main", roleB:"Sub", roleBDay:"Sub-teacher day", roleADay:"Main-teacher day", subNoGb:"Sub-teacher class · no Golden Bell", back:"Back", today:"Today", prevDay:"Previous day", nextDay:"Next day", pickDate:"Pick a date",
    classes:"Today's classes", noClassDay:"No classes on this day", nextClassDay:"Next class day", notToday:"Not scheduled today", students:"{n} students",
    done:"Done", notStarted:"Not started", remaining:"{n} left", noStudents:"No students",
    present:"In person", online:"Online", late:"Late", absent:"Absent", none:"Unchecked",
    noteHint:"Tap: Online → Late → Absent → Unchecked · Double-tap: In person · Long-press for a note",
    hw:"Homework check", hwDone:"Done", hwTodo:"Not done", hwAbsent:"Absent", hwAllOn:"Mark all done", hwAllOff:"Clear all", hwCount:"{a} / {n} done", hwHint:"Tap a card to check it · ✎ Note adds a comment per student · students in the room (in person or late) only", hwNone:"Nobody is in the room yet. Only students marked In person or Late get a homework check.", hwOut:"{n} online / absent / unchecked students are left out of the homework check", hwNoteBtn:"Note", hwNoteTitle:"Homework note", hwNotePh:"e.g. only did page 3, check again next class", hwQuick:"Quick add", hwNoteCount:"{n} notes", hwP:"Practice", hwR:"Review", hwHint2:"Tap Practice and Review separately · both checked = done · ✎ Note adds a comment per student · students in the room (in person or late) only",
    emptyClass:"No students enrolled on this date", rosterPending:"Roster pending", rosterPendingHint:"The student list hasn't been added yet. Once it is, attendance, homework and Golden Bell work here.", editingPast:"You are editing a past date", expBanner:"Prefilled {n} students from the attendance info you received. Change only those who differ at the start of class.", expConfirm:"Confirm as is", expDone:"Attendance confirmed", expTag:"expected", futureDate:"This date is in the future",
    saved:"Saved", note:"Note", notePh:"e.g. Absent with a cold, parent contacted", save:"Save", cancel:"Cancel",
    gb:"Golden Bell", gbStart:"Start Golden Bell", gbResume:"Resume Golden Bell", gbView:"View Golden Bell results", gbOnePerDay:"One Golden Bell per class per day", gbReset:"Reset Golden Bell", gbResetAsk:"Restart Golden Bell for {cls} · {date}? All {q} questions and {m} marks so far will be deleted. Attendance, homework and seating stay.", gbResetDo:"Reset and start at Q1", gbResetDone:"Golden Bell reset · Q1", gbResetNoPlayers:"Golden Bell reset. Check attendance, then start again", gbNeedAtt:"Take attendance first (in-person, online and late students play)",
    gbPlayers:"{n} players", gbSession:"Golden Bell #{n}", gbQs:"{n} questions", gbLive:"Live", gbEnded:"Ended",
    gbNoSess:"No Golden Bell sessions yet",
    ph_first:"Open", ph_hint:"Open", ph_closed:"Closed",
    in_first:"Each tap: unmarked → <b>◎</b> → <b>O</b> → <b>△</b> → <b>X</b> → unmarked",
    in_hint:"Tap: <b>X</b> ↔ <b>△</b> · ◎/O are locked", in_closed:"Question closed · long-press to correct",
    unmarked:"Unmarked", revealHint:"Reveal hint", closeQ:"Close question", nextQ:"Next question", toCurrent:"Go to Q{n}", endGb:"End Golden Bell",
    confirmEnd:"Close the current question and end Golden Bell? (Unmarked students stay unmarked)", nextStarted:"Q{a} closed → Q{b}", confirmEndDo:"End",
    lockedToast:"Marked in an earlier step · long-press to correct", closedToast:"Question closed · long-press to correct",
    closedDone:"{n} unmarked → X", addPlayer:"Add player", addPlayerTitle:"Add a late student", addPlayerNote:"Earlier questions show '–' (not played)", added:"Added {name}",
    gbHelp:"Long-press to correct or comment",
    rankNow:"Standings (through Q{n})", rankFinal:"Final ranking", rankQ:"This question", ptsUnit:"pts", rankCol:"Rank", ptsCol:"Score", scoreKey:"◎ 5 · O 4 · △ 3 · X 2 · unmarked / not played 1 · tie on a question: marked first ranks higher · tie on the total: more 1st places ranks higher",
    results:"Golden Bell results", legendFirst:"1st try", legendRetry:"Retry", legendHint:"After hint", legendX:"Wrong", legendNa:"Not played", legendCm:"Comment",
    nameCol:"Name", footRow:"Correct before hint", noComments:"No comments", tapHint:"Tap a cell for details · Tap a name to see comments",
    markLbl:"Mark", noMark:"None", comment:"Comment", commentPh:"e.g. Added the denominators", recorded:"Recorded in: {p}", overridden:"edited", notPlayed:"Did not play this question",
    resume:"Resume",
    prevLesson:"Previous lesson", nextLesson:"Next lesson", noLessonDay:"This class doesn't meet on this day",
    partnerBanner:"{name}'s session · view only", partnerBannerB:"Sub teacher {name}'s session · view only", partnerBannerA:"Main teacher {name}'s session · view only", partnerHint:"Another teacher's session, so it can't be edited", partnerMeta:"{name}",
    exportBtn:"Export to Excel", fmtLbl:"Format", fmtLog:"Official attendance sheet", fmtSum:"Summary", fmtLogHint:"One sheet per lesson (date · class)", fmtSumHint:"Overview sheet + one sheet per class (attendance · homework · Golden Bell scores and ranks)", exportTooLong:"Choose a period of 1 year or less", exportTitle:"Export to Excel", exportRange:"Period", presetToday:"Today", presetWeek:"This week", presetMonth:"This month", presetCustom:"Custom",
    exportClasses:"Classes", exportNoClasses:"No classes in this period", exportSeating:"Include seating (above each Golden Bell sheet)", exportDo:"Export", exporting:"Building…",
    exportSaved:"Excel file saved", exportDeclined:"Save cancelled", exportBusy:"Please try again in a moment", exportUnavailable:"Saving files isn't available here",
    exportFailed:"Couldn't build the file. Please try again", exportLoadFail:"Couldn't load the Excel tool. Check the internet connection",
    gb_xl_att:"Attendance", gb_xl_date:"Date", gb_xl_class:"Class", gb_xl_file:"attendance_goldenbell",
    seatViewLbl:"View from", viewT:"🧑‍🏫 Teacher (front)", viewA:"🧑‍🎓 Assistant (back)", backAide:"Back · 🧑‍🎓 Assistant", teacherRef:"as the teacher sees it",
    seatBtn:"Seating", seatCount:"{a}/{b} seated", front:"Front · Teacher", frontOnly:"Front", teacherDesk:"Teacher", teacherSideLbl:"Teacher spot", sideL:"◀ Far left", sideR:"Far right ▶", teacherTapHint:"Tap to move", teacherSwap:"swap", emptySeat:"Empty", unseated:"Not seated ({n})", allSeated:"Everyone is seated",
    seatIdle:"Tap a student, then tap a seat", seatSel:"<b>{name}</b> → tap a seat · tapping a taken seat swaps them",
    unseat:"Remove from seat", clearSeats:"Clear all", clearConfirm:"Remove everyone from their seats?", seatDone:"Done",
    onlineNote:"Online students play Golden Bell without a seat: {names}", prefilled:"Filled from the last class. Just fix what changed.", noSeatSec:"No seat",
    pickSeat:"Pick a seat for {name} (marked late)", layout43:"4 × 3", layout34:"3 × 4", layout43s:"4 wide · 3 deep", layout34s:"3 wide · 4 deep", layoutConfirm:"Switching layout clears all seats. Switch?", layoutDo:"Switch", addNoSeat:"Add without a seat", noPresent:"No in-person or late students yet. Take attendance first.",
    sample:"SAMPLE", sampleNote:"Example data, saved on this device only.", reset:"Reset this teacher's records", resetConfirm:"Erase {name}'s records on this device and restore the original data? Other teachers are untouched.", resetDo:"Reset", resetDone:"Reset done",
    langBtn:"한국어",
    saveFail:"Couldn't save. Check the browser's storage space and save a backup", storageOff:"This browser can't save records (is private browsing on?)",
    lastBackup:"Last backup: {date}", noBackupYet:"No backup saved yet",
    restoreAsk:"Replace all records on this device with the backup from {date}? Current records will be erased.", restoreCounts:"In the backup: {a} attendance · {h} homework · {g} Golden Bell", restoreNoDate:"unknown date",
    backupFirst:"Back up current records first", legacyAsk:"Import {name}'s backup from the old app? Records for the same lessons are replaced by the backup.", legacyDo:"Import",
    remoteReload:"Loaded changes made in another tab",
    sharedNote:"Records are saved in the academy's shared storage and show on every device.", sharedBackupHint:"Records live in shared storage. A backup file is a spare copy. Backups from the earlier app (used at another address) can be brought in with Merge.", syncSaving:"Saving… {n}", syncFailed:"⚠ Not saved · {n} waiting", syncImported:"Moved {n} records from this device to shared storage",
    restoreAskShared:"Replace all records in shared storage with the backup from {date}? Current records are erased on every device.", restoreMerge:"Merge", mergeHint:"Merge: keeps current records and only brings in records that are missing here or newer in the backup.", mergeDone:"Brought in {n} records from the backup", mergeNone:"Nothing new to bring in", resetConfirmShared:"Erase {name}'s records and restore the original data? They are erased on every device. Other teachers are untouched."
  }
};
var locale = CONFIG.ENABLE_LANG_TOGGLE ? (store.get(LOCALE_KEY) || CONFIG.DEFAULT_LOCALE) : "ko";
if (!I18N[locale]) locale = "ko";
function t(k, v){
  var s = (I18N[locale][k] != null) ? I18N[locale][k] : (I18N.ko[k] != null ? I18N.ko[k] : k);
  if (v) for (var x in v) s = s.split("{"+x+"}").join(v[x]);
  return s;
}
