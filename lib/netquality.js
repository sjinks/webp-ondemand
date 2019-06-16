/**
 * @see https://github.com/malchata/client-hints-example/blob/master/includes/functions.php
 * @param {boolean} saveData
 * @param {Number} rtt
 * @param {string} ect
 * @param {Number} downlink
 * @returns {Number}
 */
function networkQuality (saveData, rtt, ect, downlink) {
  if (saveData) {
    return 0;
  }

  /*
   * ECT      Min RTT  Max DL     Quality
   * slow-2g  2000     50          25…40
   * 2g       1400     70          45…60
   * 3g        270     700         65…80
   * 4g          0     infinity     100
   */
  let q = 100;
  switch (ect) {
    case '3g':
      q -= 20;
      if (rtt > 835) {
        q -= 10;
      }
      if (downlink < 0.385) {
        q -= 5;
      }
      break;

    case '2g':
      q -= 40;
      if (rtt > 1700) {
        q -= 10;
      }
      if (downlink < 0.06) {
        q -= 5;
      }
      break;

    case 'slow-2g':
      q -= 60;
      if (rtt > 2400) {
        q -= 10;
      }
      if (downlink < 0.033) {
        q -= 5;
      }
      break;
  }

  return q;
}

module.exports = networkQuality;
