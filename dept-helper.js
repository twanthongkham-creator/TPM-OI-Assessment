/**
 * dept-helper.js
 * ──────────────────────────────────────────────────────────────
 * ไฟล์กลางสำหรับดึงรายชื่อแผนกจาก Google Sheet (DeptList)
 * ใช้งาน: include ไฟล์นี้ในทุกหน้า แล้วเรียก loadDepts()
 *
 * ฟังก์ชันหลัก:
 *   loadDepts(apiUrl)          → ดึงจาก API แล้วเก็บใน cache
 *   populateDeptSelect(elId)   → ใส่ <option> ลงใน <select> ที่ระบุ
 *   getDeptName(code)          → แปลง code → ชื่อเต็ม ("PD" → "แผนกผลิต")
 *   getDeptCode(name)          → แปลง ชื่อ → code ("แผนกผลิต" → "PD")
 *   getDepts()                 → ได้ array [{code, name}] ทั้งหมด
 *
 * ตัวอย่างใช้งาน:
 *   <script src="dept-helper.js"></script>
 *   <select id="f-dept"></select>
 *   ...
 *   await loadDepts(API_URL);
 *   populateDeptSelect('f-dept');
 * ──────────────────────────────────────────────────────────────
 */

(function(global) {
  'use strict';

  // ── Cache ────────────────────────────────────────────────────
  let _depts = [];          // [{code, name}]
  let _loaded = false;
  let _loadPromise = null;  // ป้องกัน fetch ซ้อนกัน

  // ── Fallback (ใช้เมื่อ API ใช้ไม่ได้ / ระหว่างโหลด) ──────
  // หน้าเว็บจะยังทำงานได้ ไม่ค้าง
  const FALLBACK_DEPTS = [
    { code: 'AC',  name: 'บัญชี' },
    { code: 'EN',  name: 'วิศวกรรม' },
    { code: 'HC',  name: 'ทรัพยากรบุคคล' },
    { code: 'MT',  name: 'วิศวกรรม/ซ่อมบำรุง' },
    { code: 'PD',  name: 'แผนกผลิต' },
    { code: 'QC',  name: 'แผนกควบคุมคุณภาพ' },
    { code: 'RW',  name: 'คลังวัตถุดิบ/อะไหล่' },
    { code: 'SE',  name: 'ความปลอดภัย' },
    { code: 'WH',  name: 'คลังสินค้า' },
  ];

  /**
   * loadDepts(apiUrl)
   * ดึงข้อมูลแผนกจาก Apps Script
   * @param {string} apiUrl  — URL ของ Apps Script (APPS_SCRIPT_URL)
   * @returns {Promise<Array>} — [{code, name}, ...]
   */
  async function loadDepts(apiUrl) {
    if (_loaded) return _depts;
    if (_loadPromise) return _loadPromise; // ถ้ากำลังโหลดอยู่ รอ Promise เดิม

    _loadPromise = (async () => {
      try {
        const res  = await fetch(apiUrl + '?action=getDeptList&t=' + Date.now(), { cache: 'no-store' });
        const data = await res.json();
        if (data.status === 'success' && Array.isArray(data.depts) && data.depts.length > 0) {
          _depts  = data.depts;
          _loaded = true;
          return _depts;
        }
        throw new Error('Empty or invalid depts response');
      } catch(e) {
        console.warn('[dept-helper] ใช้ fallback dept list เนื่องจาก:', e.message);
        _depts  = FALLBACK_DEPTS;
        _loaded = true;
        return _depts;
      }
    })();

    return _loadPromise;
  }

  /**
   * loadDeptsFromArray(arr)
   * ใช้เมื่อหน้านั้นดึง depts มาพร้อมกับ API อื่นแล้ว (เช่น getAllDashboardData)
   * เพื่อไม่ต้องเรียก API ซ้ำ
   * @param {Array} arr — [{code, name}, ...]
   */
  function loadDeptsFromArray(arr) {
    if (!Array.isArray(arr) || arr.length === 0) return;
    _depts  = arr;
    _loaded = true;
  }

  /**
   * populateDeptSelect(elementId, options)
   * ใส่ <option> ลงใน <select> ที่ระบุ
   * @param {string} elementId  — id ของ <select>
   * @param {object} options
   *   .placeholder  {string}  — ข้อความ default (default: "-- เลือกแผนก --")
   *   .selectedCode {string}  — code ที่ต้องการ pre-select
   *   .showCode     {boolean} — แสดง code ในวงเล็บหน้าชื่อ (default: true)
   */
  function populateDeptSelect(elementId, options = {}) {
    const el = document.getElementById(elementId);
    if (!el) return;

    const placeholder  = options.placeholder  ?? '-- เลือกแผนก --';
    const selectedCode = options.selectedCode ?? '';
    const showCode     = options.showCode     ?? true;

    const list = _loaded ? _depts : FALLBACK_DEPTS;

    el.innerHTML = `<option value="">${placeholder}</option>` +
      list.map(d => {
        const label    = showCode ? `${d.code} — ${d.name}` : d.name;
        const selected = (d.code === selectedCode) ? ' selected' : '';
        return `<option value="${d.code}"${selected}>${label}</option>`;
      }).join('');
  }

  /**
   * getDeptName(code)
   * แปลง code → ชื่อเต็ม
   * @param {string} code — เช่น "PD"
   * @returns {string} — เช่น "แผนกผลิต" หรือ code เดิมถ้าไม่พบ
   */
  function getDeptName(code) {
    if (!code) return '';
    const list = _loaded ? _depts : FALLBACK_DEPTS;
    const found = list.find(d => d.code === code);
    return found ? found.name : code;
  }

  /**
   * getDeptCode(name)
   * แปลงชื่อ → code (case-insensitive partial match)
   * @param {string} name — เช่น "แผนกผลิต"
   * @returns {string} — เช่น "PD" หรือ '' ถ้าไม่พบ
   */
  function getDeptCode(name) {
    if (!name) return '';
    const list = _loaded ? _depts : FALLBACK_DEPTS;
    const n    = name.trim().toLowerCase();
    const found = list.find(d => d.name.toLowerCase() === n || d.code.toLowerCase() === n);
    return found ? found.code : '';
  }

  /**
   * getDepts()
   * ได้ array ทั้งหมด
   * @returns {Array} [{code, name}, ...]
   */
  function getDepts() {
    return _loaded ? _depts : FALLBACK_DEPTS;
  }

  /**
   * isLoaded()
   * ตรวจว่าโหลดจาก API สำเร็จหรือยัง
   * @returns {boolean}
   */
  function isLoaded() {
    return _loaded;
  }

  // ── Export ────────────────────────────────────────────────────
  global.DeptHelper = {
    loadDepts,
    loadDeptsFromArray,
    populateDeptSelect,
    getDeptName,
    getDeptCode,
    getDepts,
    isLoaded,
  };

})(window);
