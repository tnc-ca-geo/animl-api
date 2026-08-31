// Script to compare metrics between two confidence thresholds using t-tests and effect size
// Usage: node ttest_effectsize_compare_thresholds.js <csv1> <csv2> [metric]
// Example: node ttest_effectsize_compare_thresholds.js analysis1.csv analysis2.csv precision


import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'csv-parse/sync';
import jstat from 'jstat';
const { ttest, jStat } = jstat;

// --- Auto-detect most recent threshold CSVs ---
function findMostRecentThresholdCSVs(analysisDir) {
  const files = fs.readdirSync(analysisDir)
    .filter(f => f.endsWith('.csv') && f.includes('object-level_C-'))
    .map(f => ({
      name: f,
      time: fs.statSync(path.join(analysisDir, f)).mtime.getTime()
    }))
    .sort((a, b) => b.time - a.time);
  if (files.length < 2) {
    throw new Error('Not enough ...object-level_C-... .csv files found in analysis folder.');
  }
  return [files[0].name, files[1].name];
}

// Cohen's d calculation
function cohensD(arr1, arr2) {
  const mean1 = arr1.reduce((a, b) => a + b, 0) / arr1.length;
  const mean2 = arr2.reduce((a, b) => a + b, 0) / arr2.length;
  const s1 = Math.sqrt(arr1.reduce((a, b) => a + (b - mean1) ** 2, 0) / (arr1.length - 1));
  const s2 = Math.sqrt(arr2.reduce((a, b) => a + (b - mean2) ** 2, 0) / (arr2.length - 1));
  const sPooled = Math.sqrt(((arr1.length - 1) * s1 ** 2 + (arr2.length - 1) * s2 ** 2) / (arr1.length + arr2.length - 2));
  return (mean1 - mean2) / sPooled;
}

function getMetricArray(rows, targetClass, metric) {
  return rows.filter(r => r.targetClass === targetClass && r[metric] !== '' && r[metric] !== 'NaN')
    .map(r => parseFloat(r[metric]));
}



import { stringify } from 'csv-stringify/sync';

function compareMetric(rows1, rows2, classes, metric, outputRows, ci1, ci2) {
  for (const c of classes) {
    const arr1 = getMetricArray(rows1, c, metric);
    const arr2 = getMetricArray(rows2, c, metric);
    if (arr1.length > 1 && arr2.length > 1) {
      // Welch's t-test
      const n1 = arr1.length, n2 = arr2.length;
      const mean1 = arr1.reduce((a, b) => a + b, 0) / n1;
      const mean2 = arr2.reduce((a, b) => a + b, 0) / n2;
      const s1 = Math.sqrt(arr1.reduce((a, b) => a + (b - mean1) ** 2, 0) / (n1 - 1));
      const s2 = Math.sqrt(arr2.reduce((a, b) => a + (b - mean2) ** 2, 0) / (n2 - 1));
      const t = (mean1 - mean2) / Math.sqrt(s1 ** 2 / n1 + s2 ** 2 / n2);
      const df = Math.pow(s1 ** 2 / n1 + s2 ** 2 / n2, 2) /
        ((Math.pow(s1 ** 2 / n1, 2) / (n1 - 1)) + (Math.pow(s2 ** 2 / n2, 2) / (n2 - 1)));
      // Two-tailed p-value
      const p = 2 * (1 - jStat.studentt.cdf(Math.abs(t), df));
      const d = cohensD(arr1, arr2);
      outputRows.push({
        metric,
        class: c,
        [`CI${ci1}_mean`]: mean1.toFixed(2),
        [`CI${ci2}_mean`]: mean2.toFixed(2),
        t: t.toFixed(3),
        p: p.toFixed(6),
        d: d.toFixed(3),
        significant: p < 0.05 ? 'YES' : ''
      });
    } else {
      outputRows.push({
        metric,
        class: c,
        [`CI${ci1}_mean`]: 'NA',
        [`CI${ci2}_mean`]: 'NA',
        t: 'NA',
        p: 'NA',
        d: 'NA',
        significant: ''
      });
    }
  }
}

function main() {
  const [,, file1Arg, file2Arg, metric] = process.argv;
  let file1 = file1Arg, file2 = file2Arg;
  if (!file1 || !file2) {
    // Try to find the two most recent ...object-level_C-... .csv files in the analysis folder
    const analysisDir = path.resolve('analysis');
    try {
      const [recent1, recent2] = findMostRecentThresholdCSVs(analysisDir);
      file1 = path.join(analysisDir, recent1);
      file2 = path.join(analysisDir, recent2);
      console.log(`Auto-selected files:\n  1: ${file1}\n  2: ${file2}`);
    } catch (e) {
      console.error(e.message);
      process.exit(1);
    }
  }
  // Extract CI values from filenames
  function extractCI(filename) {
    const match = filename.match(/object-level_C-([\d.]+)/);
    return match ? match[1] : 'X';
  }
  const ci1 = extractCI(path.basename(file1));
  const ci2 = extractCI(path.basename(file2));
  const csv1 = fs.readFileSync(file1, 'utf8');
  const csv2 = fs.readFileSync(file2, 'utf8');
  const rows1 = parse(csv1, { columns: true });
  const rows2 = parse(csv2, { columns: true });
  const classes = Array.from(new Set([...rows1, ...rows2].map(r => r.targetClass)));
  const metrics = metric ? [metric] : ['precision','recall','f1','specificity','fpr'];
  const outputRows = [];
  for (const m of metrics) {
    compareMetric(rows1, rows2, classes, m, outputRows, ci1, ci2);
  }
  // Write results to CSV file
  const dt = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12);
  const outFile = path.join('analysis', `ttest_effectsize_compare_${dt}.csv`);
  const csvOut = stringify(outputRows, { header: true, columns: ['metric','class',`CI${ci1}_mean`, `CI${ci2}_mean`,'t','p','d','significant'] });
  fs.writeFileSync(outFile, csvOut, 'utf8');
  console.log(`\nResults written to: ${outFile}`);
}

main();
