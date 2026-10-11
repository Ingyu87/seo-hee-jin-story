# seo hee jin story

서희(8살)와 서진(4살)이 3D 동화 속으로 들어가는 아이용 웹앱. 첫 번째 동화: **백설공주와 일곱 난쟁이**.
(브랜드/타이틀은 영문 "seo hee jin story", 게임 안 UI·대사는 한국어)

Next.js 15 (static export) + React Three Fiber 3D 동화 데모. 모든 3D 모델은 Blender 완성본에서 내보낸 것입니다.

| 모델 | 원본 (Blender 완성본) |
|---|---|
| public/models/seohui.glb (서희, 8살) | /workspace/blender/kid/kid_acnh.glb |
| public/models/seojin.glb (서진, 4살) | /workspace/blender/kid2/kid2_acnh.glb |
| public/models/forest.glb | /workspace/blender/story/forest.glb |
| public/models/cottage.glb (+ cottage_interactables.json) | /workspace/blender/story/cottage.glb |
| public/models/dwarfs.glb / queen.glb / snowwhite.glb | /workspace/blender/story/npc_*.glb |

웹용 용량을 줄이기 위해 `npm run optimize-models` (gltf-transform: meshopt + webp)로 다시 압축합니다. 전체 약 5MB.

## 흐름
0. **동화 고르기**: 지금은 백설공주만 열려 있고, 빨간 모자·아기 돼지 삼형제는 "준비 중"
1. 캐릭터 선택: 서희 / 서진 (둘 다 화면에 표시)
2. 숲속 길 (forest.glb): 백설공주를 만나 대화·선택 → 함께 오두막으로
3. 일곱 난쟁이 오두막 (cottage.glb): 문 열기(Door), 의자 앉기(Chair1~7), 사과 집기/먹기/거절(Apple), 난쟁이 7명과 대화, 할머니(왕비)
4. 엔딩 2종 (사과 거절 → 파티 / 사과 먹고 잠듦 → 톡톡 눌러 깨우기)

조작: 땅을 누르면 걸어가고, 사물·인물을 누르면 다가가서 상호작용합니다. 키보드 WASD/방향키도 지원. ❓ 버튼에 놀이 방법과 이야기 순서가 있습니다.

## 놀거리
- **미니게임**: 🌸 꽃 따기 (백설공주에게 "꽃 따서 주기", 15초에 10송이) · ✌️ 투덜이와 가위바위보 (3판 2선승) · 🍎 박사와 사과 피하기 (20초, 2번까지 맞아도 성공)
- **숨바꼭질**: 숲속 나무 사이에 덤벙이·수줍이·재채기가 숨어 있음 (🔍 0/3)
- **별 ⭐ / 스티커 북 📖**: 엔딩에서 별 5개(엔딩·꽃·숨바꼭질·가위바위보·사과 피하기) 확인, 스티커 8종은 브라우저(localStorage)에 저장

## 소리와 언어
- 배경음악·효과음(걷기, 대화, 문, 의자, 사과, 버튼 등)은 모두 Web Audio API로 실시간 합성 → 음원 파일·저작권 걱정 없음. 첫 터치 후 재생, 🔊 버튼으로 음소거 (저장됨)
- 한국어 / English 전환 버튼: UI와 모든 대사가 두 언어로 들어 있음 (`components/store.ts`의 `T(ko, en)`)

## 실행
```bash
npm install
npm run dev        # 개발
npm run build      # out/ 정적 사이트 생성 (Vercel 무료 플랜에 그대로 배포 가능)
```

## 공유 미리보기 (Open Graph)
`public/og.png` (1200×630) — Blender로 렌더한 서희·서진 + 숲 배경. `app/layout.tsx`의 `metadata.openGraph`에 연결되어 있습니다.
배포 후 절대 URL이 필요하면 `NEXT_PUBLIC_SITE_URL`을 지정하세요 (Vercel에선 `VERCEL_PROJECT_PRODUCTION_URL`을 자동 사용).

## 앞으로 동화 추가하기 (구조 메모)
지금은 백설공주 한 편이 `components/` 안에 직접 들어 있습니다. 동화가 늘어나면 이렇게 나누는 것을 권장합니다:

```
stories/
  snow-white/
    story.ts        # 장면 목록, 대사/선택지, 엔딩 (지금 store.ts의 say/choose 내용)
    scenes/         # ForestScene, CottageScene 같은 장면 컴포넌트
    models.ts       # 이 동화 전용 GLB 경로 (public/models/snow-white/...)
  red-riding-hood/  # 다음 동화 …
shared/             # Player, Npc, Lights, FollowCam, Hud, 서희·서진 캐릭터 (모든 동화 공통)
```
- 공통: 서희/서진 모델, 이동·대화·상호작용 시스템, HUD
- 동화별: 배경 GLB, NPC GLB, 상호작용 JSON (`*_interactables.json`), 대본
- 첫 화면에서 캐릭터 선택 후 동화 선택 단계를 추가하면 됩니다.
