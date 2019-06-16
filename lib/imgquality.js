/**
 * @param {Number} nq
 * @returns {Number}
 */
function imageQuality (nq) {
  const map = {
    0: 35,
    25: 40,
    30: 40,
    35: 45,
    40: 45,
    45: 50,
    50: 50,
    55: 55,
    60: 60,
    65: 65,
    70: 70,
    75: 75,
    80: 80,
    100: 80
  };

  return (nq in map) ? map[nq] : 80;
}

module.exports = imageQuality;
