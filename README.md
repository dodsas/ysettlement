# ySettlement — 정산 시트

함께 쓴 비용을 시트에 입력하면, **정산기준 인원**에게 누가 얼마를 입금해야 하는지 자동으로 계산해 주는 웹 앱입니다.

## 화면

```
 항목   | 영희  | 유선  | 영준
 유류비 |       | 50000 | 0
 팝콘   | 300   | 0     |
```

- **열 = 사람**, **행 = 항목**. 헤더/항목명/금액 모두 클릭해서 바로 수정합니다.
- 빈 칸 = 그 항목에 **미참여**, `0` = 참여했지만 **0원 지불**.
- 각 항목 총액을 참여자 수로 **균등 분배**한 뒤, 사람별 순수지를 계산합니다.
- 헤더의 ⭐ 로 **정산기준** 인원을 지정하면, 나머지 인원이 기준에게 입금/환급할 금액이 표시됩니다.

## 기술 스택

- [Next.js 14](https://nextjs.org/) (App Router) + TypeScript
- [Turso](https://turso.tech/) / libSQL (`@libsql/client`)

## 시작하기

### 1. 환경변수 설정

`.env.example` 를 참고해 `.env` 를 만듭니다. (이미 로컬 파일 DB 기본값이 들어 있어 그대로도 실행됩니다.)

**로컬 파일 DB (계정 불필요, 기본값):**

```env
TURSO_DATABASE_URL=file:local.db
TURSO_AUTH_TOKEN=
```

**원격 Turso DB:**

```bash
turso db create ysettlement
turso db show ysettlement --url       # -> TURSO_DATABASE_URL
turso db tokens create ysettlement    # -> TURSO_AUTH_TOKEN
```

```env
TURSO_DATABASE_URL=libsql://ysettlement-xxxx.turso.io
TURSO_AUTH_TOKEN=eyJ...
```

### 2. 설치 & 실행

```bash
npm install
npm run dev      # http://localhost:3000
```

최초 실행 시 스키마가 자동 생성되고, 비어 있으면 위 예시 데이터(영희/유선/영준)가 시딩됩니다.

### 3. 프로덕션 빌드

```bash
npm run build
npm run start
```

## 배포 (Render Blueprint)

저장소 루트의 [`render.yaml`](./render.yaml) 이 Render Blueprint 입니다.

1. 이 저장소를 GitHub 에 push
2. [Render 대시보드](https://dashboard.render.com/) → **New +** → **Blueprint** → 저장소 선택
3. Blueprint 가 `render.yaml` 을 읽어 `ysettlement` 웹 서비스를 생성합니다.
4. 배포 직전 **환경변수 입력** 단계에서 아래 두 값을 넣습니다(비밀이라 blueprint 에 저장하지 않음):
   - `TURSO_DATABASE_URL` = `libsql://....turso.io`
   - `TURSO_AUTH_TOKEN` = `eyJ...`
5. **Apply** → 자동으로 `npm ci && npm run build` 후 `npm start` 로 기동됩니다.

이후 `main` 브랜치에 push 하면 자동 재배포됩니다(`autoDeploy: true`). `next start` 는
Render 가 주입하는 `PORT` 를 자동으로 사용합니다. (무료 플랜은 유휴 시 슬립되며, DB 는
Turso 에 그대로 보존됩니다.)

## 정산 계산 방식

각 항목에서 값이 있는 셀의 사람만 참여자로 보고:

```
항목 총액   = 참여자들이 낸 금액의 합
1인 부담액  = 항목 총액 / 참여자 수
사람별 순수지 net = (낸 돈 합계) - (부담액 합계)
기준에게 입금할 금액 = -net  (양수=입금, 음수=환급)
```

정산기준 인원을 허브로 삼아, 나머지 인원이 모두 기준 한 사람과만 주고받으면 정산이 끝납니다.

## API

| 메서드 | 경로 | 설명 |
| --- | --- | --- |
| GET | `/api/sheet` | 전체 시트 + 정산 결과 |
| POST / PATCH / DELETE | `/api/people[/:id]` | 사람(열) 추가·이름변경·삭제 |
| POST / PATCH / DELETE | `/api/items[/:id]` | 항목(행) 추가·이름변경·삭제 |
| PUT | `/api/cells` | 셀 금액 저장/삭제 |
| PUT | `/api/settings` | 정산기준 인원 지정 |
