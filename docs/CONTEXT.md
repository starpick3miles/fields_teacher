# Fields (필즈) — domain context

What an agent needs to know about the academy to work on this app. Source: Jay, the academy's 「필즈더클래식 S반 선발 규정」 (2025-07-16), the 대치 2611 진도표, and teacher feedback. The fuller originals live in the claude.ai Project "Fields" (`claude/fields-context.md`, `claude/general-app.md`, `claude/fields-app-scoring.md`, `claude/academy-app-prototype-spec.md`, `claude/mock-setup-*.md`).

## The academy

- Fields (필즈), brand 필즈더클래식: a Korean 사고력 수학 (thinking-skills math) academy with several branches. This app's data is the 대치 branch (1관 and 2관; 2관 class names carry ②).
- Students are 7세 (kindergarten, written 유7) through 초4.
- The teachers do not have claude.ai accounts, which is one reason the app left Claude artifacts.
- Jay builds the software and reviews anything AI-generated before it is used in class. The 원장 gives feedback directly.

## Classes

- Levels, lowest to highest: H → G → E2 → E1 → S (S1, S2, S3).
- H and G meet once a week; E2, E1 and S meet twice a week. A session is 3 hours (유7 classes: 2 hours), in 교시 of 1 hour. 골든벨 happens in 1교시.
- **Class names** read grade-level-number(days+slot), e.g. `초1-E1-6(월금6)`: 초1, level E1, class 6, Monday and Friday, slot 6 (18:00). Slot 3 = 15:00, slot 4 = 16:00, slot 6 = 18:00.
- **A/B teachers.** A twice-a-week E-level class is split between two teachers, one day each. **A = 담임** (main teacher, teaches 더클래식, the main textbook). **B = 부담임** (teaches the additional textbook or 필즈경시특강). In the 진도표 the same class appears as `1-E1-6A` and `1-E1-6B`. G and H classes have one teacher.
  - In the app each teacher sees her own day as editable and the partner's day as view only.
- **LV / 레벨업 특강**: a short special course (October 2026: 10/19–10/31). It has no 골든벨.
- **부담임 (B) days do have 골든벨.** An earlier version of the app turned it off on B days; that was a mistake, fixed 2026-11-11.
- Roster names come from the academy's system and carry disambiguating suffixes (강민재2, 박준우B, (신) for new students). The same roster name is assumed to be the same child across classes and teachers.

## 골든벨

The teacher asks concept questions aloud before the textbook work; students answer on mini whiteboards; the teacher records each student's result per question.

- App marks: ◎ correct on the first try · O correct after a wrong answer · △ correct after a hint · X wrong · 미표시 not marked.
- One 골든벨 per class per day. Players are the students marked 등원, 온라인 or 지각.
- **App scoring (Jay, 2026-11-11):** per question ◎ 5, O 4, △ 3, X 2, 미표시 or 미참가 1. Ranking is shown per question and at the end. It applies to every class except 레벨업 특강.
- **This is not the 규정's formula.** The official S반 rule scores each class out of 10: accuracy (percent correct × 5) plus rank points (1st 5, 2nd 4, 3rd 3 …), accumulated and scaled to 50 of the 100 selection points, averaged over the 담임 and 부담임 submissions. The official mark scale (◎ ○ ◐ △ ☆) also differs from the app's. Mapping the app's scores to the S반 score is undecided.

## S반 selection (why the records matter)

Total 100 points: 골든벨 50, 입학테스트 10, 권별테스트 20, 수업 성취도 10, 과제 10. Each item is rounded half-up to one decimal before summing. Tie-break: 태도 > 골든벨 > 권별테스트 > 입학테스트. S2 counts only scores after S1 selection, and S3 only those after S2. 과제 is judged from homework completion, which is what the app's 숙제 확인 records.

## How teachers work (constraints on the UI)

- On her own phone, portrait, often one-handed and standing, in the middle of a lesson. Interactions must be fast and forgiving.
- Classes are small (about 4 to 13 students); grids are designed for 12 seats.
- 숙제 확인 covers only students in the room (등원 and 지각), because the teacher checks the textbook pages in person.
- A 보조교사 (assistant) may sit at the back of the room, so 자리배치 and 골든벨 have a "보는 위치" switch that draws the room turned 180°.
- The academy keeps a 수업일지 (class log) sheet per lesson in a fixed Excel layout; the app's 수업일지 export reproduces that layout and prefills it. The weekly 진도표 plan per class is in `TEACHERS[].classes[].plan`.

## Related tools (separate artifacts, not in this repo)

대치 진도표 (dynamic progress table), 필즈 학부모 메시지 (parent message templates), 강재이 보조 (assistant-teacher briefing), 성대경시 Version B workbench. They share class codes and teacher names with this app but not code or storage.
