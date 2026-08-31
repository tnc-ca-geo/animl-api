// ttest_effectsize_matrix.js
//
// This script compares multiple groups of metrics (e.g., from different model runs or confidence thresholds) using pairwise Welch's t-tests and Cohen's d effect size.
// It reads a CSV file containing metrics for different groups/classes, computes t-tests and effect sizes for all pairs, and outputs a matrix of results.
// The output helps identify which groups are statistically different for each metric and class, and the magnitude of those differences.
//
// Usage: node ttest_effectsize_matrix.js <input.csv> [metric]
// Example: node ttest_effectsize_matrix.js analysis.csv precision
//
// Columns in the output matrix include: group/class, means, t-statistic, p-value, effect size, and significance.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'url';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import jstat from 'jstat';

// ES module __dirname workaround
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function mean(arr) {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}
function variance(arr, m) {
  return arr.reduce((a, b) => a + Math.pow(b - m, 2), 0) / (arr.length - 1);
}
function pooledStdDev(arr1, arr2) {
  const n1 = arr1.length, n2 = arr2.length;
  const m1 = mean(arr1), m2 = mean(arr2);
  const v1 = variance(arr1, m1), v2 = variance(arr2, m2);
  return Math.sqrt(((n1 - 1) * v1 + (n2 - 1) * v2) / (n1 + n2 - 2));
}
function cohensD(arr1, arr2) {
  return (mean(arr1) - mean(arr2)) / pooledStdDev(arr1, arr2);
}
function welchT(arr1, arr2) {
  const m1 = mean(arr1), m2 = mean(arr2);
  const v1 = variance(arr1, m1), v2 = variance(arr2, m2);
  const n1 = arr1.length, n2 = arr2.length;
  const t = (m1 - m2) / Math.sqrt(v1 / n1 + v2 / n2);
  const df = Math.pow(v1 / n1 + v2 / n2, 2) /
    ((Math.pow(v1 / n1, 2) / (n1 - 1)) + (Math.pow(v2 / n2, 2) / (n2 - 1)));
  return { t, df };
}

function getMetricArrays(records, metric, className) {
  return records
    .filter(r => r.targetClass === className && r[metric] !== '' && r[metric] !== undefined && r[metric] !== null && r.deploymentName !== 'total' && r.targetClass !== 'total')
    .map(r => parseFloat(r[metric]))
    .filter(v => !isNaN(v));
}

function buildMatrix(records, metric, groupKey) {
  const groupNames = Array.from(new Set(records
    .filter(r => r[groupKey] !== 'total')
    .map(r => r[groupKey])
    .filter(Boolean)));
  const matrix = [];
  // Header row
  matrix.push(['', ...groupNames]);
  for (let i = 0; i < groupNames.length; i++) {
    const row = [groupNames[i]];
    for (let j = 0; j < groupNames.length; j++) {
      if (i === j) {
        row.push('—');
      } else {
        const arr1 = getMetricArrays(records, metric, groupNames[i]);
        const arr2 = getMetricArrays(records, metric, groupNames[j]);
        if (arr1.length > 1 && arr2.length > 1) {
          const { t, df } = welchT(arr1, arr2);
          const d = cohensD(arr1, arr2);
          // Two-tailed p-value
          const p = 2 * (1 - jstat.studentt.cdf(Math.abs(t), df));
          if (p < 0.05) {
            let cell = `t=${t.toFixed(2)}, d=${d.toFixed(2)}, p=${p.toFixed(6)}`;
            row.push(cell);
          } else {
            row.push('');
          }
        } else {
          row.push('');
        }
      }
    }
    matrix.push(row);
  }
  return matrix;
}

function main() {
  console.log('Starting ttest_effectsize_matrix.js');
  let csvPath = process.argv[2];
  if (!csvPath) {
    console.log('No CSV file argument provided. Searching for most recent analysis CSV...');
    const analysisDir = path.join(__dirname, '../../analysis');
    console.log(`Looking in directory: ${analysisDir}`);
    const files = fs.readdirSync(analysisDir)
      .filter(f => f.endsWith('.csv') && !f.toLowerCase().includes('matri'))
      .map(f => ({
        name: f,
        time: fs.statSync(path.join(analysisDir, f)).mtime.getTime()
      }))
      .sort((a, b) => b.time - a.time);
    if (files.length === 0) {
      console.error('No suitable .csv files found in analysis folder.');
      process.exit(1);
    }
    csvPath = path.join(analysisDir, files[0].name);
    console.log(`Auto-selected most recent CSV: ${csvPath}`);
  } else {
    console.log(`Using CSV file from argument: ${csvPath}`);
  }
  console.log('Reading CSV file...');
  const csvData = fs.readFileSync(csvPath, 'utf8');
  console.log('Parsing CSV data...');
  const records = parse(csvData, { columns: true, skip_empty_lines: true });

  // Build and write matrices for precision and recall by targetClass
  const metrics = ['precision', 'recall'];
  for (const metric of metrics) {
    console.log(`Building matrix for metric: ${metric}`);
    const matrix = buildMatrix(records, metric, 'targetClass');
    const outPath = csvPath.replace(/\.csv$/, `_${metric}_matrix.csv`);
    console.log(`Writing matrix to file: ${outPath}`);
    const csvOut = stringify(matrix);
    fs.writeFileSync(outPath, csvOut, 'utf8');
    console.log(`Wrote ${outPath}`);
  }
  console.log('All matrices written. Process complete.');
}

main();
