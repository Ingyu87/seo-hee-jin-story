# 백설공주와 일곱 난쟁이 · 서희 & 서진의 동화 여행

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
1. 캐릭터 선택: 서희 / 서진 (둘 다 화면에 표시)
2. 숲속 길 (forest.glb): 백설공주를 만나 대화·선택 → 함께 오두막으로
3. 일곱 난쟁이 오두막 (cottage.glb): 문 열기(Door), 의자 앉기(Chair1~7), 사과 집기/먹기/거절(Apple), 난쟁이 7명과 대화, 할머니(왕비)
4. 엔딩 2종 (사과 거절 → 파티 / 사과 먹고 잠듦 → 톡톡 눌러 깨우기)

조작: 땅을 누르면 걸어가고, 사물·인물을 누르면 다가가서 상호작용합니다. 키보드 WASD/방향키도 지원.

## 실행
```bash
npm install
npm run dev        # 개발
npm run build      # out/ 정적 사이트 생성 (Vercel 무료 플랜에 그대로 배포 가능)
```
