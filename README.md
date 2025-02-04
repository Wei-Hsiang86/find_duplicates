# Find Duplicates

一個用於檢測文字檔案重複內容的工具。可以設定相似度閾值，找出內容相近的檔案

## Feature
比較文字筆記有沒有重複的檔案

## Prerequisites
- Node.js (建議版本 >= 14)
- npm

# How to use?

1. Initialize
```
npm install
```

2. 執行
```
// n 為相似程度的百分比，這個值是介於 0 到 1 之間
node findDu_with_err_show_new_alog.js "比較檔案或是資料夾的路徑" n
```

3. 注意要點
- 可以自行設定要忽略的東西 (ignore 相關變數)
- 結果報告，默認放在 log 資料夾中，務必先建立!! 或是去 reportPath 變數調整