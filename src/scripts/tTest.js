// Calculates the t-statistic and p-value for two independent samples (Welch's t-test)
// Uses the t-distribution CDF for all sample sizes for statistical accuracy
function mean(arr) {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function variance(arr, arrMean) {
  if (arr.length < 2) return 0;
  return arr.reduce((a, b) => a + Math.pow(b - arrMean, 2), 0) / (arr.length - 1);
}

function tTest(arr1, arr2) {
  const n1 = arr1.length;
  const n2 = arr2.length;
  if (n1 < 2 || n2 < 2) {
    return { t: null, p: null };
  }
  const m1 = mean(arr1);
  const m2 = mean(arr2);
  const v1 = variance(arr1, m1);
  const v2 = variance(arr2, m2);
  const t = (m1 - m2) / Math.sqrt(v1 / n1 + v2 / n2);
  // Welch–Satterthwaite equation for degrees of freedom
  const df = Math.pow(v1 / n1 + v2 / n2, 2) /
    ((Math.pow(v1 / n1, 2) / (n1 - 1)) + (Math.pow(v2 / n2, 2) / (n2 - 1)));

  // Student's t-distribution CDF using the incomplete beta function
  // Adapted from https://github.com/errcw/gauss/blob/master/src/statistics/distributions/tdist.js
  function betacf(x, a, b) {
    let fpmin = 1e-30;
    let m = 1, qab = a + b, qap = a + 1, qam = a - 1, c = 1, d = 1 - qab * x / qap;
    if (Math.abs(d) < fpmin) d = fpmin;
    d = 1 / d;
    let h = d;
    for (; m <= 100; m++) {
      let m2 = 2 * m;
      let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
      d = 1 + aa * d;
      if (Math.abs(d) < fpmin) d = fpmin;
      c = 1 + aa / c;
      if (Math.abs(c) < fpmin) c = fpmin;
      d = 1 / d;
      h *= d * c;
      aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
      d = 1 + aa * d;
      if (Math.abs(d) < fpmin) d = fpmin;
      c = 1 + aa / c;
      if (Math.abs(c) < fpmin) c = fpmin;
      d = 1 / d;
      let del = d * c;
      h *= del;
      if (Math.abs(del - 1.0) < 3e-7) break;
    }
    return h;
  }

  function betai(x, a, b) {
    // Returns the regularized incomplete beta function I_x(a, b)
    let bt = (x === 0 || x === 1) ? 0 :
      Math.exp(
        a * Math.log(x) + b * Math.log(1 - x) -
        (lgamma(a) + lgamma(b) - lgamma(a + b))
      );
    if (x < 0 || x > 1) return 0;
    if (x < (a + 1) / (a + b + 2)) {
      return bt * betacf(x, a, b) / a;
    } else {
      return 1 - bt * betacf(1 - x, b, a) / b;
    }
  }

  // Log gamma function (Lanczos approximation)
  function lgamma(z) {
    const cof = [
      76.18009172947146, -86.50532032941677,
      24.01409824083091, -1.231739572450155,
      0.1208650973866179e-2, -0.5395239384953e-5
    ];
    let x = z, y = z, tmp = x + 5.5;
    tmp -= (x + 0.5) * Math.log(tmp);
    let ser = 1.000000000190015;
    for (let j = 0; j < 6; j++) ser += cof[j] / ++y;
    return Math.log(2.5066282746310005 * ser / x) - tmp;
  }

  // t-distribution CDF
  function tCDF(t, df) {
    const x = df / (df + t * t);
    const a = df / 2;
    const b = 0.5;
    const ib = betai(x, a, b);
    return 1 - 0.5 * ib;
  }

  const p = 2 * (1 - tCDF(Math.abs(t), df));
  return { t, p };
}
export { tTest };