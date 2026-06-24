// 自己完結の QR コード生成（byte モード・ECC レベル M・version 1–10・依存なし）。
// 短い URL（http://<ip>:<port>/display）を会場ネット非依存でその場に描く用途。
// 仕様 ISO/IEC 18004 準拠。出力モジュール行列は Python の `qrcode` と bit 一致で検証済み。
(function (root) {
  'use strict';

  // ---- GF(256) 算術（原始多項式 0x11d）----
  const EXP = new Array(512), LOG = new Array(256);
  (function initGF() {
    let x = 1;
    for (let i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11d; }
    for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
  })();
  const gfMul = (a, b) => (a === 0 || b === 0) ? 0 : EXP[LOG[a] + LOG[b]];

  // ---- Reed–Solomon ----
  function rsGenPoly(deg) {
    let poly = [1];
    for (let i = 0; i < deg; i++) {
      const next = new Array(poly.length + 1).fill(0);
      for (let j = 0; j < poly.length; j++) {
        next[j] ^= gfMul(poly[j], EXP[i]);
        next[j + 1] ^= poly[j];
      }
      poly = next;
    }
    return poly;
  }
  function rsRemainder(data, deg) {
    // rsGenPoly は定数項が index0・先頭(x^deg=1)が index deg の順。
    // 合成除算は「先頭を除いた下位係数を最高次から」並べる必要があるので reverse する。
    const full = rsGenPoly(deg);              // [x^0, x^1, ..., x^deg(=1)]
    const gen = full.slice(0, deg).reverse(); // [x^(deg-1), ..., x^0]
    const rem = new Array(deg).fill(0);
    for (let i = 0; i < data.length; i++) {
      const factor = data[i] ^ rem[0];
      rem.shift(); rem.push(0);
      for (let j = 0; j < deg; j++) rem[j] ^= gfMul(gen[j], factor);
    }
    return rem;
  }

  // ---- ECC レベル M のブロック表（version 1–10）----
  // ec = ブロック毎の EC コードワード数, blocks = [[ブロック数, ブロック毎データ数], ...]
  const ECM = {
    1:  { ec: 10, blocks: [[1, 16]] },
    2:  { ec: 16, blocks: [[1, 28]] },
    3:  { ec: 26, blocks: [[1, 44]] },
    4:  { ec: 18, blocks: [[2, 32]] },
    5:  { ec: 24, blocks: [[2, 43]] },
    6:  { ec: 16, blocks: [[4, 27]] },
    7:  { ec: 18, blocks: [[4, 31]] },
    8:  { ec: 22, blocks: [[2, 38], [2, 39]] },
    9:  { ec: 22, blocks: [[3, 36], [2, 37]] },
    10: { ec: 26, blocks: [[4, 43], [1, 44]] },
  };
  const REMAINDER_BITS = { 1:0,2:7,3:7,4:7,5:7,6:7,7:0,8:0,9:0,10:0 };
  const ALIGN = {
    1:[],2:[6,18],3:[6,22],4:[6,26],5:[6,30],6:[6,34],
    7:[6,22,38],8:[6,24,42],9:[6,26,46],10:[6,28,50],
  };

  const dataCapacity = (v) => ECM[v].blocks.reduce((s, [n, d]) => s + n * d, 0);

  function chooseVersion(byteLen) {
    for (let v = 1; v <= 10; v++) {
      const cci = v <= 9 ? 1 : 2;                 // 文字数指示子: 8bit=1byte / 16bit=2byte
      const need = 1 + cci + byteLen;             // モード4bit+文字数 を概算 byte で（4bit は端数で吸収）
      // 厳密にビットで判定
      const bits = 4 + (cci * 8) + byteLen * 8;
      if (Math.ceil(bits / 8) <= dataCapacity(v) && need >= 0) return v;
    }
    throw new Error('data too long for QR v1-10');
  }

  // ---- データコードワード列（モード/文字数/終端/パディング）----
  function buildDataCodewords(bytes, v) {
    const cap = dataCapacity(v);
    const cciBits = v <= 9 ? 8 : 16;
    const bitsArr = [];
    const push = (val, len) => { for (let i = len - 1; i >= 0; i--) bitsArr.push((val >> i) & 1); };
    push(0b0100, 4);                 // byte モード
    push(bytes.length, cciBits);     // 文字数
    for (const b of bytes) push(b, 8);
    // 終端 0（最大4・容量まで）
    const capBits = cap * 8;
    for (let i = 0; i < 4 && bitsArr.length < capBits; i++) bitsArr.push(0);
    // byte 境界まで 0
    while (bitsArr.length % 8 !== 0) bitsArr.push(0);
    // バイト化
    const cw = [];
    for (let i = 0; i < bitsArr.length; i += 8) {
      let b = 0; for (let j = 0; j < 8; j++) b = (b << 1) | bitsArr[i + j];
      cw.push(b);
    }
    // パディング 0xEC,0x11
    const pads = [0xEC, 0x11];
    let p = 0;
    while (cw.length < cap) cw.push(pads[p++ % 2]);
    return cw;
  }

  // ---- ブロック分割 → EC 計算 → インタリーブ ----
  function buildFinalCodewords(dataCw, v) {
    const { ec, blocks } = ECM[v];
    const dataBlocks = [], ecBlocks = [];
    let pos = 0;
    for (const [nBlk, dPer] of blocks) {
      for (let i = 0; i < nBlk; i++) {
        const blk = dataCw.slice(pos, pos + dPer); pos += dPer;
        dataBlocks.push(blk);
        ecBlocks.push(rsRemainder(blk, ec));
      }
    }
    const maxData = Math.max(...dataBlocks.map(b => b.length));
    const out = [];
    for (let i = 0; i < maxData; i++)
      for (const b of dataBlocks) if (i < b.length) out.push(b[i]);
    for (let i = 0; i < ec; i++)
      for (const b of ecBlocks) out.push(b[i]);
    return out;
  }

  // ---- モジュール行列の構築 ----
  function buildMatrix(finalCw, v, forcedMask) {
    const size = 17 + 4 * v;
    const m = Array.from({ length: size }, () => new Array(size).fill(null)); // null=未配置
    const fn = Array.from({ length: size }, () => new Array(size).fill(false)); // 機能パターン
    const set = (r, c, val) => { m[r][c] = val ? 1 : 0; fn[r][c] = true; };

    // ファインダ＋分離帯
    function finder(r0, c0) {
      for (let r = -1; r <= 7; r++) for (let c = -1; c <= 7; c++) {
        const rr = r0 + r, cc = c0 + c;
        if (rr < 0 || rr >= size || cc < 0 || cc >= size) continue;
        const onBorder = (r === 0 || r === 6) && c >= 0 && c <= 6;
        const onSide = (c === 0 || c === 6) && r >= 0 && r <= 6;
        const inCenter = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        set(rr, cc, onBorder || onSide || inCenter);
      }
    }
    finder(0, 0); finder(0, size - 7); finder(size - 7, 0);

    // タイミング
    for (let i = 8; i < size - 8; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }

    // 位置合わせ
    const centers = ALIGN[v];
    for (const r of centers) for (const c of centers) {
      if ((r === 6 && c === 6) || (r === 6 && c === size - 7) || (r === size - 7 && c === 6)) continue;
      for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) {
        const ring = Math.max(Math.abs(dr), Math.abs(dc));
        set(r + dr, c + dc, ring !== 1);
      }
    }

    // ダークモジュール
    set(4 * v + 9, 8, true);

    // フォーマット情報領域を予約（後で値を入れる）
    const reserveFormat = () => {
      for (let i = 0; i <= 8; i++) { if (!fn[8][i]) fn[8][i] = true; if (!fn[i][8]) fn[i][8] = true; }
      for (let i = 0; i < 8; i++) { fn[8][size - 1 - i] = true; fn[size - 1 - i][8] = true; }
    };
    reserveFormat();
    // バージョン情報領域（v7+）
    if (v >= 7) {
      for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) {
        fn[i][size - 11 + j] = true; fn[size - 11 + j][i] = true;
      }
    }

    // データ配置（ジグザグ・右下→）
    let bitIdx = 0;
    const totalBits = finalCw.length * 8;
    const getBit = () => {
      if (bitIdx >= totalBits) return 0; // 余り（remainder）は 0
      const byte = finalCw[bitIdx >> 3], bit = 7 - (bitIdx & 7); bitIdx++;
      return (byte >> bit) & 1;
    };
    let upward = true;
    for (let col = size - 1; col > 0; col -= 2) {
      if (col === 6) col = 5; // タイミング列を飛ばす
      for (let i = 0; i < size; i++) {
        const row = upward ? size - 1 - i : i;
        for (let k = 0; k < 2; k++) {
          const c = col - k;
          if (fn[row][c]) continue;
          m[row][c] = getBit();
        }
      }
      upward = !upward;
    }

    // マスク
    const maskFn = [
      (r, c) => (r + c) % 2 === 0,
      (r, c) => r % 2 === 0,
      (r, c) => c % 3 === 0,
      (r, c) => (r + c) % 3 === 0,
      (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
      (r, c) => (r * c) % 2 + (r * c) % 3 === 0,
      (r, c) => ((r * c) % 2 + (r * c) % 3) % 2 === 0,
      (r, c) => ((r + c) % 2 + (r * c) % 3) % 2 === 0,
    ];

    function applyMask(mat, maskNo) {
      const out = mat.map(row => row.slice());
      for (let r = 0; r < size; r++) for (let c = 0; c < size; c++)
        if (!fn[r][c] && maskFn[maskNo](r, c)) out[r][c] ^= 1;
      return out;
    }

    // フォーマット情報（EC=M=00）
    function formatBits(maskNo) {
      const data = (0b00 << 3) | maskNo;       // M=00
      let rem = data << 10;
      for (let i = 14; i >= 10; i--) if ((rem >> i) & 1) rem ^= 0x537 << (i - 10);
      const bits = ((data << 10) | rem) ^ 0x5412;
      return bits & 0x7fff;
    }
    function placeFormat(mat, maskNo) {
      const bits = formatBits(maskNo);
      const get = (i) => (bits >> i) & 1;
      // 左上縦＋横
      for (let i = 0; i <= 5; i++) mat[i][8] = get(i);
      mat[7][8] = get(6); mat[8][8] = get(7); mat[8][7] = get(8);
      for (let i = 9; i <= 14; i++) mat[8][14 - i] = get(i);
      // 右上＋左下（コピー）
      for (let i = 0; i <= 7; i++) mat[8][size - 1 - i] = get(i);
      for (let i = 8; i <= 14; i++) mat[size - 15 + i][8] = get(i);
      mat[size - 8][8] = 1; // ダークモジュール（再保証）
    }
    function versionBits(ver) {
      let rem = ver << 12;
      for (let i = 17; i >= 12; i--) if ((rem >> i) & 1) rem ^= 0x1f25 << (i - 12);
      return (ver << 12) | rem;
    }
    function placeVersion(mat) {
      if (v < 7) return;
      const bits = versionBits(v);
      for (let i = 0; i < 18; i++) {
        const b = (bits >> i) & 1;
        const r = Math.floor(i / 3), c = i % 3;
        mat[r][size - 11 + c] = b;
        mat[size - 11 + c][r] = b;
      }
    }

    // ペナルティ（マスク選択）
    function penalty(mat) {
      let p = 0;
      // 規則1: 連続同色
      for (let r = 0; r < size; r++) {
        let run = 1; for (let c = 1; c < size; c++) {
          if (mat[r][c] === mat[r][c - 1]) { run++; if (run === 5) p += 3; else if (run > 5) p++; }
          else run = 1;
        }
      }
      for (let c = 0; c < size; c++) {
        let run = 1; for (let r = 1; r < size; r++) {
          if (mat[r][c] === mat[r - 1][c]) { run++; if (run === 5) p += 3; else if (run > 5) p++; }
          else run = 1;
        }
      }
      // 規則2: 2x2 同色
      for (let r = 0; r < size - 1; r++) for (let c = 0; c < size - 1; c++) {
        const a = mat[r][c];
        if (a === mat[r][c + 1] && a === mat[r + 1][c] && a === mat[r + 1][c + 1]) p += 3;
      }
      // 規則3: 1:1:3:1:1 パターン（4 モジュールの余白付き）
      const pat1 = [1,0,1,1,1,0,1,0,0,0,0], pat2 = [0,0,0,0,1,0,1,1,1,0,1];
      const lineHas = (get) => {
        for (let i = 0; i + 11 <= size; i++) {
          let m1 = true, m2 = true;
          for (let k = 0; k < 11; k++) { const val = get(i + k); if (val !== pat1[k]) m1 = false; if (val !== pat2[k]) m2 = false; }
          if (m1 || m2) p += 40;
        }
      };
      for (let r = 0; r < size; r++) lineHas((i) => mat[r][i]);
      for (let c = 0; c < size; c++) lineHas((i) => mat[i][c]);
      // 規則4: 暗モジュール比率
      let dark = 0; for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) dark += mat[r][c];
      const ratio = (dark * 100) / (size * size);
      const k = Math.floor(Math.abs(ratio - 50) / 5);
      p += k * 10;
      return p;
    }

    let bestMask = 0, bestMat = null, bestPenalty = Infinity;
    const masks = forcedMask != null ? [forcedMask] : [0,1,2,3,4,5,6,7];
    for (const mk of masks) {
      const cand = applyMask(m, mk);
      placeFormat(cand, mk);
      placeVersion(cand);
      const pen = penalty(cand);
      if (pen < bestPenalty) { bestPenalty = pen; bestMask = mk; bestMat = cand; }
    }
    return { matrix: bestMat, mask: bestMask, size, version: v };
  }

  function encodeBytes(str) {
    if (typeof TextEncoder !== 'undefined') return Array.from(new TextEncoder().encode(str));
    const out = []; for (let i = 0; i < str.length; i++) { // ASCII フォールバック
      const c = str.charCodeAt(i); if (c < 128) out.push(c); else out.push(63); }
    return out;
  }

  // 公開: テキスト → モジュール行列（1=暗）
  function qrMatrix(text, opts) {
    opts = opts || {};
    const bytes = encodeBytes(text);
    const v = opts.version || chooseVersion(bytes.length);
    const dataCw = buildDataCodewords(bytes, v);
    const finalCw = buildFinalCodewords(dataCw, v);
    return buildMatrix(finalCw, v, opts.mask != null ? opts.mask : null);
  }

  // 公開: canvas へ描画
  function renderQR(canvas, text, scale, border) {
    scale = scale || 6; border = border == null ? 4 : border;
    const { matrix, size } = qrMatrix(text);
    const dim = (size + border * 2) * scale;
    canvas.width = dim; canvas.height = dim;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, dim, dim);
    ctx.fillStyle = '#000';
    for (let r = 0; r < size; r++) for (let c = 0; c < size; c++)
      if (matrix[r][c]) ctx.fillRect((c + border) * scale, (r + border) * scale, scale, scale);
    return { size };
  }

  // テスト用: 最終コードワード列（data+EC インタリーブ後）
  function _codewords(text, version) {
    const bytes = encodeBytes(text);
    const v = version || chooseVersion(bytes.length);
    return buildFinalCodewords(buildDataCodewords(bytes, v), v);
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { qrMatrix, renderQR, _codewords };
  if (root) { root.qrMatrix = qrMatrix; root.renderQR = renderQR; }
})(typeof window !== 'undefined' ? window : null);
