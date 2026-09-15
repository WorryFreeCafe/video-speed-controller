(function () {
  'use strict';

  const MIN_SPEED = 0.1;
  const MAX_SPEED = 4;
  const STEP = 0.05;
  const ROOT_ID = 'ysc-root';
  const STORAGE_KEY = 'ysc-panel-state';
  const POS_KEY = 'ysc-panel-pos';

  // ── 工具函数 ──────────────────────────────────────────────

  function clampSpeed(speed) {
    return Math.min(MAX_SPEED, Math.max(MIN_SPEED, Number(speed) || 1));
  }

  function formatSpeed(speed) {
    return parseFloat(clampSpeed(speed).toFixed(2));
  }

  function getVideo() {
    return document.querySelector('video');
  }

  function getRoot() {
    return document.getElementById(ROOT_ID);
  }

  function getPanelState() {
    try {
      return localStorage.getItem(STORAGE_KEY) || 'closed';
    } catch {
      return 'closed';
    }
  }

  function setPanelState(state, { showCloseToast = false } = {}) {
    try {
      localStorage.setItem(STORAGE_KEY, state);
    } catch { /* 隐私模式 / 存储满则忽略 */ }
    applyPanelState({ showCloseToast });
  }

  function setSpeed(speed) {
    const video = getVideo();
    if (!video) {
      // 没有视频时不报错，静默返回
      return false;
    }
    const normalized = formatSpeed(speed);
    video.playbackRate = normalized;
    updateControls(normalized);
    return true;
  }

  function updateControls(speed) {
    const root = getRoot();
    if (!root) return;

    const normalized = formatSpeed(speed);

    // 完整面板控件
    const slider = root.querySelector('.ysc-slider');
    const input = root.querySelector('.ysc-input');
    if (slider) slider.value = normalized;
    if (input && document.activeElement !== input) input.value = normalized;

    // 迷你面板控件
    const miniInput = root.querySelector('.ysc-mini-input');
    if (miniInput && document.activeElement !== miniInput) {
      miniInput.value = normalized;
    }
  }

  // ── Toast ──────────────────────────────────────────────────

  function showToast(message) {
    const root = getRoot();
    if (!root) return;

    let toast = root.querySelector('.ysc-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'ysc-toast';
      root.appendChild(toast);
    }

    toast.textContent = message;
    toast.classList.add('visible');

    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(function () {
      toast.classList.remove('visible');
    }, 5000);
  }

  // ── 面板状态应用 ──────────────────────────────────────────

  function applyPanelState({ showCloseToast = false } = {}) {
    const root = getRoot();
    if (!root) return;

    const state = getPanelState();
    root.dataset.state = state;

    if (state === 'closed' && showCloseToast) {
      showToast(
        '面板已关闭。点击浏览器右上角的扩展图标，可随时调节播放速度。'
      );
    }

    // 面板展开时同步当前视频速度
    if (state === 'expanded' || state === 'minimized') {
      const video = getVideo();
      if (video) updateControls(video.playbackRate);
    }
  }

  // 强制设置面板状态（页面加载/导航时忽略持久化记录，默认不显示）
  function forcePanelState(state) {
    const root = getRoot();
    if (!root) return;

    root.dataset.state = state;

    if (state === 'expanded' || state === 'minimized') {
      const video = getVideo();
      if (video) updateControls(video.playbackRate);
    }
  }

  // ── 面板位置（拖动持久化）─────────────────────────────────

  function getSavedPosition() {
    try {
      const raw = localStorage.getItem(POS_KEY);
      if (!raw) return null;
      const pos = JSON.parse(raw);
      if (pos && typeof pos.x === 'number' && typeof pos.y === 'number') {
        return pos;
      }
    } catch { /* 忽略 */ }
    return null;
  }

  function savePanelPosition() {
    const root = getRoot();
    if (!root) return;
    const rect = root.getBoundingClientRect();
    try {
      localStorage.setItem(
        POS_KEY,
        JSON.stringify({ x: Math.round(rect.left), y: Math.round(rect.top) })
      );
    } catch { /* 忽略 */ }
  }

  // ── 面板拖动 ──────────────────────────────────────────────

  function enableDrag(root) {
    let startX = 0;
    let startY = 0;
    let startLeft = 0;
    let startTop = 0;
    let dragging = false;
    let suppressClick = false;

    root.addEventListener('mousedown', function (e) {
      // 只在左键、且目标不是交互控件时开始拖动
      if (e.button !== 0) return;
      if (e.target.closest('button, input, a, .ysc-slider')) return;

      dragging = false;
      startX = e.clientX;
      startY = e.clientY;
      const rect = root.getBoundingClientRect();
      startLeft = rect.left;
      startTop = rect.top;

      function onMove(ev) {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;

        // 位移超过阈值才视为拖动（与点击区分）
        if (!dragging && Math.abs(dx) + Math.abs(dy) > 4) {
          dragging = true;
          root.classList.add('ysc-dragging');
          root.style.right = 'auto';
        }

        if (dragging) {
          const maxX = Math.max(0, window.innerWidth - root.offsetWidth);
          const maxY = Math.max(0, window.innerHeight - root.offsetHeight);
          const left = Math.min(Math.max(0, startLeft + dx), maxX);
          const top = Math.min(Math.max(0, startTop + dy), maxY);
          root.style.left = left + 'px';
          root.style.top = top + 'px';
        }
      }

      function onUp() {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        if (dragging) {
          root.classList.remove('ysc-dragging');
          savePanelPosition();
          // 抑制拖动结束后误触发的 click
          suppressClick = true;
          setTimeout(function () {
            suppressClick = false;
          }, 0);
        }
      }

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });

    // 捕获阶段拦截拖动后的误点击
    root.addEventListener(
      'click',
      function (e) {
        if (suppressClick) {
          e.stopPropagation();
          e.preventDefault();
        }
      },
      true
    );
  }

  // ── 创建面板（完整面板 + 迷你面板）─────────────────────────

  function createPanel(initialState) {
    // 已有面板则只应用状态
    if (document.getElementById(ROOT_ID)) {
      if (initialState) {
        forcePanelState(initialState);
      } else {
        applyPanelState();
      }
      return;
    }

    const root = document.createElement('div');
    root.id = ROOT_ID;
    root.innerHTML =
      '<style>' +
      '#' + ROOT_ID + ' {' +
      '  position:fixed;right:16px;bottom:80px;z-index:9999;' +
      '  font:12px/1.4 system-ui,-apple-system,sans-serif;' +
      '  color:#fff;user-select:none;' +
      '  opacity:.38;transition:opacity .22s ease;' +
      '}' +
      '#' + ROOT_ID + ':hover { opacity:1; }' +
      '#' + ROOT_ID + '.ysc-dragging { opacity:1; }' +
      '#' + ROOT_ID + '.ysc-dragging,' +
      '#' + ROOT_ID + '.ysc-dragging * { cursor:grabbing !important; }' +
      '#' + ROOT_ID + ' .ysc-panel {' +
      '  width:180px;padding:10px 12px;border-radius:14px;' +
      '  background:linear-gradient(160deg,rgba(38,40,52,.82),rgba(14,16,24,.76));' +
      '  border:1px solid rgba(255,255,255,.14);' +
      '  box-shadow:0 8px 24px rgba(0,0,0,.4);' +
      '  -webkit-backdrop-filter:blur(12px) saturate(1.2);' +
      '  backdrop-filter:blur(12px) saturate(1.2);' +
      '}' +
      '#' + ROOT_ID + ' .ysc-header {' +
      '  display:flex;align-items:center;justify-content:space-between;' +
      '  margin-bottom:8px;cursor:grab;' +
      '}' +
      '#' + ROOT_ID + ' .ysc-title {' +
      '  font-size:11px;font-weight:600;opacity:.8;letter-spacing:.3px;' +
      '}' +
      '#' + ROOT_ID + ' .ysc-header-actions {' +
      '  display:flex;gap:2px;' +
      '}' +
      '#' + ROOT_ID + ' .ysc-icon-btn {' +
      '  width:22px;height:22px;padding:0;border:none;border-radius:7px;' +
      '  background:transparent;color:rgba(255,255,255,.55);' +
      '  font-size:13px;cursor:pointer;' +
      '  transition:background .15s,color .15s;' +
      '}' +
      '#' + ROOT_ID + ' .ysc-icon-btn:hover {' +
      '  background:rgba(255,255,255,.14);color:#fff;' +
      '}' +
      '#' + ROOT_ID + ' .ysc-slider {' +
      '  -webkit-appearance:none;appearance:none;' +
      '  width:100%;height:4px;margin:0 0 10px;' +
      '  border-radius:2px;background:rgba(255,255,255,.16);' +
      '  outline:none;cursor:pointer;' +
      '}' +
      '#' + ROOT_ID + ' .ysc-slider::-webkit-slider-thumb {' +
      '  -webkit-appearance:none;width:13px;height:13px;border-radius:50%;' +
      '  background:#fff;border:2px solid #4f8cff;' +
      '  box-shadow:0 1px 4px rgba(0,0,0,.45);cursor:pointer;' +
      '  transition:transform .12s;' +
      '}' +
      '#' + ROOT_ID + ' .ysc-slider::-webkit-slider-thumb:hover {' +
      '  transform:scale(1.15);' +
      '}' +
      '#' + ROOT_ID + ' .ysc-slider::-moz-range-thumb {' +
      '  width:13px;height:13px;border-radius:50%;' +
      '  background:#fff;border:2px solid #4f8cff;cursor:pointer;' +
      '}' +
      '#' + ROOT_ID + ' .ysc-row {' +
      '  display:flex;align-items:center;gap:6px;' +
      '}' +
      '#' + ROOT_ID + ' .ysc-btn {' +
      '  width:28px;height:28px;padding:0;' +
      '  border:1px solid rgba(255,255,255,.16);border-radius:9px;' +
      '  background:rgba(255,255,255,.08);color:#fff;' +
      '  font-size:15px;font-weight:700;cursor:pointer;' +
      '  transition:background .15s,transform .1s;' +
      '}' +
      '#' + ROOT_ID + ' .ysc-btn:hover {' +
      '  background:rgba(255,255,255,.18);' +
      '}' +
      '#' + ROOT_ID + ' .ysc-btn:active {' +
      '  transform:scale(.92);' +
      '}' +
      '#' + ROOT_ID + ' .ysc-input {' +
      '  flex:1;min-width:0;height:30px;padding:0 6px;' +
      '  border:1px solid rgba(255,255,255,.16);border-radius:9px;' +
      '  background:rgba(0,0,0,.32);color:#fff;' +
      '  font-size:15px;font-weight:700;text-align:center;outline:none;' +
      '  -moz-appearance:textfield;' +
      '  transition:border-color .15s;' +
      '}' +
      '#' + ROOT_ID + ' .ysc-input::-webkit-inner-spin-button,' +
      '#' + ROOT_ID + ' .ysc-input::-webkit-outer-spin-button {' +
      '  -webkit-appearance:none;margin:0;' +
      '}' +
      '#' + ROOT_ID + ' .ysc-input:focus {' +
      '  border-color:rgba(79,140,255,.7);' +
      '}' +
      '#' + ROOT_ID + ' .ysc-hint {' +
      '  margin:8px 0 0;font-size:10px;opacity:.55;line-height:1.5;' +
      '}' +
      '#' + ROOT_ID + ' .ysc-toast {' +
      '  position:absolute;bottom:calc(100% + 8px);left:0;right:0;' +
      '  padding:7px 10px;background:rgba(22,24,32,.92);' +
      '  border:1px solid rgba(255,255,255,.14);border-radius:9px;' +
      '  font-size:11px;line-height:1.5;' +
      '  opacity:0;pointer-events:none;transition:opacity .2s;' +
      '}' +
      '#' + ROOT_ID + ' .ysc-toast.visible { opacity:1; }' +

      /* ── 状态切换 ── */
      '#' + ROOT_ID + '[data-state="expanded"] .ysc-panel { display:block; }' +
      '#' + ROOT_ID + '[data-state="expanded"] .ysc-mini { display:none; }' +
      '#' + ROOT_ID + '[data-state="minimized"] .ysc-panel { display:none; }' +
      '#' + ROOT_ID + '[data-state="minimized"] .ysc-mini { display:flex; }' +
      '#' + ROOT_ID + '[data-state="closed"] .ysc-panel { display:none; }' +
      '#' + ROOT_ID + '[data-state="closed"] .ysc-mini { display:none; }' +

      /* ── 迷你面板 ── */
      '#' + ROOT_ID + ' .ysc-mini {' +
      '  display:none;align-items:center;gap:4px;' +
      '  padding:4px 6px;border-radius:14px;' +
      '  background:linear-gradient(160deg,rgba(38,40,52,.78),rgba(14,16,24,.72));' +
      '  border:1px solid rgba(255,255,255,.14);' +
      '  box-shadow:0 6px 18px rgba(0,0,0,.35);' +
      '  -webkit-backdrop-filter:blur(10px) saturate(1.2);' +
      '  backdrop-filter:blur(10px) saturate(1.2);' +
      '  cursor:grab;user-select:none;' +
      '}' +
      '#' + ROOT_ID + ' .ysc-mini-dot {' +
      '  width:6px;height:6px;border-radius:50%;flex-shrink:0;' +
      '  background:#4f8cff;box-shadow:0 0 6px rgba(79,140,255,.8);' +
      '}' +
      '#' + ROOT_ID + ' .ysc-mini-btn {' +
      '  width:24px;height:24px;padding:0;display:flex;' +
      '  align-items:center;justify-content:center;' +
      '  border:1px solid rgba(255,255,255,.16);border-radius:8px;' +
      '  background:rgba(255,255,255,.08);color:#fff;' +
      '  font-size:15px;font-weight:600;cursor:pointer;' +
      '  transition:background .15s,transform .1s;flex-shrink:0;' +
      '}' +
      '#' + ROOT_ID + ' .ysc-mini-btn:hover {' +
      '  background:rgba(255,255,255,.18);' +
      '}' +
      '#' + ROOT_ID + ' .ysc-mini-btn:active {' +
      '  transform:scale(.92);' +
      '}' +
      '#' + ROOT_ID + ' .ysc-mini-input {' +
      '  width:52px;height:24px;padding:0 4px;' +
      '  border:1px solid rgba(255,255,255,.12);border-radius:8px;' +
      '  background:rgba(0,0,0,.3);color:#fff;' +
      '  font-size:12px;font-weight:600;text-align:center;' +
      '  transition:border-color .15s,background .15s;' +
      '  -moz-appearance:textfield;' +
      '}' +
      '#' + ROOT_ID + ' .ysc-mini-input::-webkit-inner-spin-button,' +
      '#' + ROOT_ID + ' .ysc-mini-input::-webkit-outer-spin-button {' +
      '  -webkit-appearance:none;margin:0;' +
      '}' +
      '#' + ROOT_ID + ' .ysc-mini-input:hover {' +
      '  border-color:rgba(255,255,255,.3);' +
      '}' +
      '#' + ROOT_ID + ' .ysc-mini-input:focus {' +
      '  border-color:rgba(79,140,255,.7);' +
      '  background:rgba(0,0,0,.45);outline:none;' +
      '}' +
      '#' + ROOT_ID + ' .ysc-mini-expand,' +
      '#' + ROOT_ID + ' .ysc-mini-close {' +
      '  width:20px;height:24px;padding:0;border:none;border-radius:7px;' +
      '  background:transparent;color:rgba(255,255,255,.5);' +
      '  font-size:11px;cursor:pointer;flex-shrink:0;' +
      '  display:flex;align-items:center;justify-content:center;' +
      '  transition:color .15s,background .15s;' +
      '}' +
      '#' + ROOT_ID + ' .ysc-mini-expand:hover,' +
      '#' + ROOT_ID + ' .ysc-mini-close:hover {' +
      '  color:#fff;background:rgba(255,255,255,.12);' +
      '}' +
      '</style>' +

      // Toast 容器
      '<div class="ysc-toast"></div>' +

      // ── 完整面板 ──
      '<div class="ysc-panel">' +
      '  <div class="ysc-header">' +
      '    <span class="ysc-title">播放速度</span>' +
      '    <div class="ysc-header-actions">' +
      '      <button class="ysc-icon-btn ysc-minimize" type="button" ' +
      '              title="收为迷你面板">–</button>' +
      '      <button class="ysc-icon-btn ysc-close" type="button" ' +
      '              title="关闭面板">&times;</button>' +
      '    </div>' +
      '  </div>' +
      '  <div class="ysc-row">' +
      '    <button class="ysc-btn ysc-down" type="button">−</button>' +
      '    <input class="ysc-input" type="number" ' +
      '           min="' + MIN_SPEED + '" max="' + MAX_SPEED + '" ' +
      '           step="0.01" value="1">' +
      '    <button class="ysc-btn ysc-up" type="button">+</button>' +
      '  </div>' +
      '  <input class="ysc-slider" type="range" ' +
      '         min="' + MIN_SPEED + '" max="' + MAX_SPEED + '" ' +
      '         step="' + STEP + '" value="1">' +
      '  <p class="ysc-hint">关闭或收起后，' +
      '    仍可点击浏览器右上角的' +
      '    扩展图标调节速度</p>' +
      '</div>' +

      // ── 迷你面板 ──
      '<div class="ysc-mini">' +
      '  <span class="ysc-mini-dot"></span>' +
      '  <button class="ysc-mini-btn ysc-mini-down" type="button" ' +
      '          title="减速">−</button>' +
      '  <input class="ysc-mini-input" type="number" ' +
      '         min="' + MIN_SPEED + '" max="' + MAX_SPEED + '" ' +
      '         step="0.01" value="1" ' +
      '         title="当前速度，可直接输入">' +
      '  <button class="ysc-mini-btn ysc-mini-up" type="button" ' +
      '          title="加速">+</button>' +
      '  <button class="ysc-mini-expand" type="button" ' +
      '          title="展开完整面板">' +
      '    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" ' +
      '         stroke="currentColor" stroke-width="2.4" ' +
      '         stroke-linecap="round" stroke-linejoin="round">' +
      '      <path d="M15 3h6v6"/><path d="M9 21H3v-6"/>' +
      '      <path d="M21 3l-7 7"/><path d="M3 21l7-7"/>' +
      '    </svg>' +
      '  </button>' +
      '  <button class="ysc-mini-close" type="button" ' +
      '          title="关闭面板">&times;</button>' +
      '</div>';

    // ── 事件绑定 ──

    // 完整面板 - 滑块
    root.querySelector('.ysc-slider').addEventListener('input', function () {
      setSpeed(this.value);
    });

    // 完整面板 - 输入框
    const fullInput = root.querySelector('.ysc-input');
    fullInput.addEventListener('change', function () {
      setSpeed(this.value);
    });
    fullInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        setSpeed(this.value);
        this.blur();
      }
    });

    // 完整面板 - 加减按钮
    root.querySelector('.ysc-down').addEventListener('click', function () {
      setSpeed(formatSpeed((getVideo() && getVideo().playbackRate) || 1) - STEP);
    });
    root.querySelector('.ysc-up').addEventListener('click', function () {
      setSpeed(formatSpeed((getVideo() && getVideo().playbackRate) || 1) + STEP);
    });

    // 完整面板 - 最小化
    root.querySelector('.ysc-minimize').addEventListener('click', function () {
      setPanelState('minimized');
    });

    // 完整面板 - 关闭
    root.querySelector('.ysc-close').addEventListener('click', function () {
      setPanelState('closed', { showCloseToast: true });
    });

    // ── 迷你面板事件 ──

    // 迷你面板 - 减按钮
    root.querySelector('.ysc-mini-down').addEventListener('click', function (e) {
      e.stopPropagation();
      setSpeed(formatSpeed((getVideo() && getVideo().playbackRate) || 1) - STEP);
    });

    // 迷你面板 - 加按钮
    root.querySelector('.ysc-mini-up').addEventListener('click', function (e) {
      e.stopPropagation();
      setSpeed(formatSpeed((getVideo() && getVideo().playbackRate) || 1) + STEP);
    });

    // 迷你面板 - 数字输入框
    const miniInput = root.querySelector('.ysc-mini-input');
    miniInput.addEventListener('change', function () {
      setSpeed(this.value);
    });
    miniInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        setSpeed(this.value);
        this.blur();
      }
    });
    // 点击输入框时全选，方便快速修改
    miniInput.addEventListener('focus', function () {
      this.select();
    });

    // 迷你面板 - 展开按钮
    root.querySelector('.ysc-mini-expand').addEventListener('click', function (e) {
      e.stopPropagation();
      setPanelState('expanded');
    });

    // 迷你面板 - 关闭按钮
    root.querySelector('.ysc-mini-close').addEventListener('click', function (e) {
      e.stopPropagation();
      setPanelState('closed', { showCloseToast: true });
    });

    // 迷你面板 - 双击空白区展开
    root.querySelector('.ysc-mini').addEventListener('dblclick', function (e) {
      // 如果双击的不是按钮或输入框，则展开
      if (e.target === this) {
        setPanelState('expanded');
      }
    });

    // ── 挂载到页面 ──

    // 恢复上次拖动的位置；无记录则使用 CSS 默认（右下角）
    const pos = getSavedPosition();
    if (pos) {
      root.style.left = pos.x + 'px';
      root.style.top = pos.y + 'px';
      root.style.right = 'auto';
    }

    document.body.appendChild(root);

    // 启用拖动
    enableDrag(root);

    // 初始控件值
    const video = getVideo();
    updateControls(video ? video.playbackRate : 1);

    if (initialState) {
      forcePanelState(initialState);
    } else {
      applyPanelState();
    }
  }

  // ── 视频监听（MutationObserver）────────────────────────────

  let videoObserver = null;

  function startVideoObserver() {
    // 先停止旧的观察器（SPA 导航时需要重新开始）
    stopVideoObserver();

    // 如果视频和面板都已就绪，无需监听
    if (getVideo() && getRoot()) return;

    const observeTarget = document.body || document.documentElement;
    if (!observeTarget) return;

    let pending = false;

    videoObserver = new MutationObserver(function (mutations) {
      // 已经就绪则停止监听
      if (getVideo() && getRoot()) {
        stopVideoObserver();
        return;
      }

      // 快速检查：这些 mutation 中是否有新增节点可能包含 video
      let hasAddedNodes = false;
      for (let i = 0; i < mutations.length; i++) {
        if (mutations[i].addedNodes.length > 0) {
          hasAddedNodes = true;
          break;
        }
      }
      if (!hasAddedNodes) return;

      // rAF 节流：同一帧内多次变化只执行一次回调
      if (pending) return;
      pending = true;
      requestAnimationFrame(function () {
        pending = false;

        const video = getVideo();
        const root = getRoot();

        if (video && !root) {
          createPanel('closed');
          stopVideoObserver();
          return;
        }

        if (video && root) {
          updateControls(video.playbackRate);
          stopVideoObserver();
        }
      });
    });

    videoObserver.observe(observeTarget, {
      childList: true,
      subtree: true,
    });
  }

  function stopVideoObserver() {
    if (videoObserver) {
      videoObserver.disconnect();
      videoObserver = null;
    }
  }

  // ── 初始化 ────────────────────────────────────────────────

  var initTimer = null;

  function init() {
    // 防抖：短时间内多次导航只执行最后一次
    clearTimeout(initTimer);
    initTimer = setTimeout(function () {
      // 页面加载/导航后面板默认隐藏，仅在用户点击扩展图标时显示
      createPanel('closed');
      startVideoObserver();
    }, 80);
  }

  // DOM 就绪后立即初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // ── SPA 导航适配 ──────────────────────────────────────────

  // 通用：劫持 pushState / replaceState + 监听 popstate，适配各站单页应用
  window.addEventListener('popstate', init);

  var origPush = history.pushState;
  history.pushState = function () {
    origPush.apply(this, arguments);
    init();
  };

  var origReplace = history.replaceState;
  history.replaceState = function () {
    origReplace.apply(this, arguments);
    init();
  };

  // YouTube：监听 yt-navigate-finish 事件
  document.addEventListener('yt-navigate-finish', init);

  // 通用：监听 URL 变化（hashchange）
  window.addEventListener('hashchange', init);

  // ── Chrome Runtime 消息 ───────────────────────────────────

  chrome.runtime.onMessage.addListener(function (request, _sender, sendResponse) {
    // 显示面板
    if (request.action === 'showPanel') {
      // 确保面板存在
      if (!getRoot()) createPanel();
      setPanelState('expanded');
      sendResponse({ ok: true });
      return true;
    }

    // 设置速度
    if (request.speed != null) {
      // 确保面板存在（保持隐藏，不打扰观看）
      if (!getRoot()) createPanel('closed');
      var ok = setSpeed(request.speed);
      sendResponse({ ok: ok });
      return true;
    }

    // 获取当前速度
    if (request.action === 'getSpeed') {
      var video = getVideo();
      sendResponse({ speed: video ? video.playbackRate : null });
      return true;
    }
  });
})();
