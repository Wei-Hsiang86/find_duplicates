const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
const cliProgress = require('cli-progress');
const { format } = require('date-fns');
const stringSimilarity = require('string-similarity');

// 平行處理
const { Worker } = require('worker_threads');
const os = require('os');

async function getAllFiles(dir) {
    const files = [];
    const ignoreDirs = ['.git', 'node_modules', '.vscode', '.obsidian', 'Pictures'];
    const ignoreFiles = ['.DS_Store', 'thumbs.db'];
    const ignoreExtensions = [
        '.jpg', '.jpeg', '.png', '.gif', '.bmp',
        '.mp4', '.avi', '.mov',
        '.pdf',
        '.zip', '.rar'
    ];


    async function scan(directory) {
        const entries = await fs.readdir(directory, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(directory, entry.name);
            if (ignoreDirs.includes(entry.name)) continue;
            if (ignoreFiles.includes(entry.name)) continue;

            // 檢查副檔名
            const ext = path.extname(entry.name).toLowerCase();
            if (ignoreExtensions.includes(ext)) continue;            

            if (entry.isDirectory()) {
                await scan(fullPath);
            } else {
                // 取得檔案資訊，包含檔案大小
                const stat = await fs.stat(fullPath);
                files.push({
                    path: fullPath,
                    size: stat.size
                });
            }
        }
    }
    
    await scan(dir);
    return files;
}

async function findDuplicateFiles(dirPath, similarityThreshold = 0.9) {
    const progressBar = new cliProgress.SingleBar({
        format: '檢查進度 |{bar}| {percentage}% | {value}/{total} 檔案',
        barCompleteChar: '\u2588',
        barIncompleteChar: '\u2591',
    });

    const fileHashes = new Map();
    const duplicates = {
        exact: [],
        similar: []
    };

    const allFiles = await getAllFiles(dirPath);
    progressBar.start(allFiles.length, 0);
    
    // 檔案大小相似度閾值（允許的差異百分比）
    const SIZE_THRESHOLD = 0.1; // 10%

    for (let i = 0; i < allFiles.length; i++) {
        const currentFile = allFiles[i];
        try {
            const fileContent = await fs.readFile(currentFile.path);
            const hash = crypto.createHash('sha256').update(fileContent).digest('hex');
            
            if (fileHashes.has(hash)) {
                duplicates.exact.push({
                    file1: fileHashes.get(hash),
                    file2: currentFile.path
                });
            } else {
                for (const [existingHash, existingPath] of fileHashes.entries()) {
                    try {
                        // 取得已存檔案的大小資訊
                        const existingStats = await fs.stat(existingPath);
                        
                        // 計算檔案大小差異的百分比
                        const sizeDiff = Math.abs(currentFile.size - existingStats.size) / 
                                       Math.max(currentFile.size, existingStats.size);
                        
                        // 只有當檔案大小相近時才進行內容比對
                        if (sizeDiff <= SIZE_THRESHOLD) {
                            const content1 = fileContent.toString('utf8');
                            const content2 = (await fs.readFile(existingPath)).toString('utf8');
                            const similarity = stringSimilarity.compareTwoStrings(content1, content2);
                            
                            if (similarity >= similarityThreshold && similarity < 1) {
                                duplicates.similar.push({
                                    file1: existingPath,
                                    file2: currentFile.path,
                                    similarity: similarity
                                });
                            }
                        }
                    } catch (err) {
                        // 忽略錯誤，繼續處理下一個檔案
                    }
                }
                fileHashes.set(hash, currentFile.path);
            }
        } catch (err) {
            // 忽略錯誤，繼續處理下一個檔案
        }
        progressBar.update(i + 1);
    }
    
    progressBar.stop();
    return duplicates;
}

// 加入中斷處理函數
async function generateReport(duplicates, directoryPath, threshold) {
    const timestamp = format(new Date(), 'yyyyMMdd_HHmmss');
    const reportPath = `log/duplicate_report_${timestamp}.txt`;
    
    let report = '重複檔案檢查報告\n';
    report += `檢查時間：${format(new Date(), 'yyyy-MM-dd HH:mm:ss')}\n`;
    report += `檢查路徑：${path.resolve(directoryPath)}\n`;
    report += `相似度閾值：${threshold}\n`;
    report += `註：此報告是在程式中斷時產生，可能不完整\n\n`;
    
    // ... 報告內容產生邏輯 ...

    await fs.writeFile(reportPath, report, 'utf8');
    console.log(`\n報告已輸出至：${reportPath}`);
}

async function main() {
    const directoryPath = process.argv[2] || '.';
    const threshold = process.argv[3] || 0.9;

    try {
        const duplicates = await findDuplicateFiles(directoryPath, threshold);
        
        console.log(`\n檢查結果：`);
        console.log(`相似：${duplicates.similar.length} 個`);
        console.log(`重複：${duplicates.exact.length} 個`);

        // 產生詳細報告
        const timestamp = format(new Date(), 'yyyyMMdd_HHmmss');
        const reportPath = `log/duplicate_report_${timestamp}.txt`;
        
        let report = '重複檔案檢查報告\n';
        report += `檢查時間：${format(new Date(), 'yyyy-MM-dd HH:mm:ss')}\n`;
        report += `檢查路徑：${path.resolve(directoryPath)}\n`;
        report += `相似度閾值：${threshold}\n\n`;
        
        report += '完全重複的檔案：\n';
        if (duplicates.exact.length === 0) {
            report += '沒有發現完全重複的檔案\n';
        } else {
            duplicates.exact.forEach(pair => {
                report += `\n${pair.file1}\n與\n${pair.file2}\n內容完全相同\n`;
                report += '-'.repeat(80) + '\n';
            });
        }
        
        report += '\n高度相似的檔案：\n';
        if (duplicates.similar.length === 0) {
            report += '沒有發現高度相似的檔案\n';
        } else {
            duplicates.similar.forEach(pair => {
                report += `\n${pair.file1}\n與\n${pair.file2}\n`;
                report += `相似度: ${(pair.similarity * 100).toFixed(2)}%\n`;
                report += '-'.repeat(80) + '\n';
            });
        }
        
        await fs.writeFile(reportPath, report, 'utf8');
        console.log(`\n詳細報告已輸出至：${reportPath}`);
        
    } catch (error) {
        console.error('發生錯誤：', error);
    }
}

main();