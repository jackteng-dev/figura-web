# Figura AI 公仔圖片樣本

這是原創虛構商品的 **AI 點陣圖片**，不是實物攝影或真 3D 模型。兩款主圖、兩款側面試作、兩款背面提案、一張 Banner；沒有整批替換商品資料。

請先看 [製作規範](../../../docs/AI_FIGURE_IMAGE_STANDARD.md)、[驗收紀錄](../../../docs/AI_FIGURE_SAMPLE_REVIEW.md) 及 [獨立圖組頁](../../../docs/figure-render-samples.html)。側面尚有身份／姿勢漂移，背面是未定稿提案，不能把整組視為一致性驗收通過。

`manifest.json` 保存 built-in ImageGen 的完整實際 prompts、參考 hash、原圖 hash、裁切、驗收狀態、衍生圖的尺寸／大小／hash。原圖留在忽略的 `work/figure-render-samples/`，只有本機 archive 加上 FFmpeg／FFprobe 才能重新執行轉檔腳本；產圖不是可重現的 3D 渲染管線。

這些檔案未被應用程式 import，也不會因放入 `src/brand/` 就自動出現在正式商品或首頁。圖組頁是獨立本機評估文件，不是上線的商店功能。
