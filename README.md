# LingoLoop

每天 15 分鐘,把英文練成習慣。口說優先 + 單字間隔複習(FSRS)。

## 核心設計

- **單一資料源**:所有練習紀錄、錯誤、生字都進同一個 Supabase 資料庫,方便之後做跨技能關聯分析。
- **每日 15 分鐘**:首頁 = 今日任務,系統自動排程,避免 decision fatigue。
- **口說優先**:排程演算法給口說最高權重,其餘技能補強穿插。
- **招牌視覺**:首頁的「記憶保留曲線」,今日任務掛在曲線上。

## 技術棧(全部零成本)

| 項目 | 方案 | 費用 |
|---|---|---|
| 前端 | React + Vite | 免費 |
| 託管 | GitHub Pages | 免費 |
| 資料庫 / Auth | Supabase 免費層 | 免費 |
| AI 分析 | Gemini 免費層(經 Supabase Edge Function 代理,供應商解耦) | 免費 |
| 語音 | Web Speech API | 免費 |

> ⚠️ Claude / Gemini 的 API key 只放在 Edge Function 的 secret,**永遠不進 repo、不進前端**。

## 開發

```bash
npm install
npm run dev      # http://localhost:5174
npm run build    # 產出 dist/
```

## 進度

- [x] **階段 1** — Scaffold + 今日任務首頁(殼,資料為示意)
- [ ] **階段 2** — Supabase 接線 + Auth + 單字 SRS 端到端
- [ ] **階段 3** — Edge Function 代理(AI 供應商解耦)
- [ ] **階段 4** — 口說模組(Web Speech → AI 分析 → 錯誤/生字回寫)
- [ ] **階段 5** — 串起每日循環(streak、自動排程、完成回饋)

## 資料表(規劃)

`practice_sessions` · `speaking_prompts` · `errors` · `vocabulary`(含 FSRS 欄位)
