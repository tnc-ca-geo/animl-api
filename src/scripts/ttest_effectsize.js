import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'csv-parse/sync';

// Helper functions
function mean(arr) {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}
function variance(arr, m) {
  return arr.reduce((a, b) => a + Math.pow(b - m, 2), 0) / (arr.length - 1);
}
function stddev(arr, m) {
  return Math.sqrt(variance(arr, m));
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

// Read CSV and group by targetClass
function getMetricArrays(records, metric, className) {
  return records
    .filter(r => r.targetClass === className && r[metric] !== '' && r[metric] !== undefined && r[metric] !== null && r.deploymentName !== 'total' && r.targetClass !== 'total')
    .map(r => parseFloat(r[metric]))
    .filter(v => !isNaN(v));
}

function main() {
  const csvPath = process.argv[2];
  if (!csvPath) {
    console.error('Usage: node ttest_effectsize.js <csvfile>');
    process.exit(1);
  }
  const csvData = fs.readFileSync(csvPath, 'utf8');
  const records = parse(csvData, { columns: true, skip_empty_lines: true });

  // Example: rodent vs skunk precision
  const class1 = 'rodent';
  const class2 = 'skunk';
  const metric = 'precision';
  const arr1 = getMetricArrays(records, metric, class1);
  const arr2 = getMetricArrays(records, metric, class2);

  console.log(`${class1} ${metric} values:`, arr1);
  console.log(`${class2} ${metric} values:`, arr2);

  const { t, df } = welchT(arr1, arr2);
  const d = cohensD(arr1, arr2);

  console.log(`Welch's t-test: t = ${t.toFixed(3)}, df = ${df.toFixed(2)}`);
  console.log(`Cohen's d (effect size): d = ${d.toFixed(3)}`);
  // For p-value, use a library or look up t and df in a table
}

main();
