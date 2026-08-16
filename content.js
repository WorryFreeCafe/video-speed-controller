(function () {
  'use strict';

  const MIN_SPEED = 0.1;
  const MAX_SPEED = 4;
  const STEP = 0.05;
  const ROOT_ID = 'ysc-root';
  const STORAGE_KEY = 'ysc-panel-state';

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
      return localStorage.getItem(STORAGE_KEY) || 'minimized';
    } catch {
      return 'minimized';
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

    // 所有速度标签
    const labels = root.querySelectorAll('.ysc-speed-label');
    labels.forEach((el) => {
      el.textContent = normalized + 'x';
    });
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

  // ── 创建面板（完整面板 + 迷你面板）─────────────────────────

  function createPanel() {
    // 已有面板则只应用状态
    if (document.getElementById(ROOT_ID)) {
      applyPanelState();
      return;
    }

    const root = document.createElement('div');
    root.id = ROOT_ID;
    root.innerHTML =
      '<style>' +
      '#' + ROOT_ID + ' {' +
      '  position:fixed;right:16px;bottom:80px;z-index:9999;' +
      '  font:13px/1.4 system-ui,sans-serif;' +
      '}' +
      '#' + ROOT_ID + ' .ysc-panel {' +
      '  width:220px;background:rgba(28,28,28,0.95);color:#fff;' +
      '  border:1px solid rgba(255,255,255,0.15);border-radius:10px;' +
      '  padding:12px;box-shadow:0 4px 16px rgba(0,0,0,0.35);' +
      '}' +
      '#' + ROOT_ID + ' .ysc-header {' +
      '  display:flex;align-items:center;justify-content:space-between;' +
      '  margin-bottom:10px;' +
      '}' +
      '#' + ROOT_ID + ' .ysc-title {' +
      '  font-size:12px;font-weight:600;opacity:0.85;' +
      '}' +
      '#' + ROOT_ID + ' .ysc-header-actions {' +
      '  display:flex;gap:4px;' +
      '}' +
      '#' + ROOT_ID + ' .ysc-icon-btn {' +
      '  width:24px;height:24px;padding:0;border:none;border-radius:4px;' +
      '  background:transparent;color:#fff;font-size:14px;cursor:pointer;' +
      '}' +
      '#' + ROOT_ID + ' .ysc-icon-btn:hover {' +
      '  background:rgba(255,255,255,0.12);' +
      '}' +
      '#' + ROOT_ID + ' .ysc-value {' +
      '  text-align:center;font-size:22px;font-weight:700;margin-bottom:8px;' +
      '}' +
      '#' + ROOT_ID + ' .ysc-slider {' +
      '  width:100%;margin-bottom:10px;cursor:pointer;' +
      '}' +
      '#' + ROOT_ID + ' .ysc-row {' +
      '  display:flex;align-items:center;gap:6px;' +
      '}' +
      '#' + ROOT_ID + ' .ysc-btn {' +
      '  width:30px;height:30px;padding:0;' +
      '  border:1px solid rgba(255,255,255,0.2);border-radius:6px;' +
      '  background:rgba(255,255,255,0.08);color:#fff;' +
      '  font-size:16px;font-weight:700;cursor:pointer;' +
      '}' +
      '#' + ROOT_ID + ' .ysc-btn:hover {' +
      '  background:rgba(255,255,255,0.18);' +
      '}' +
      '#' + ROOT_ID + ' .ysc-input {' +
      '  flex:1;min-width:0;padding:6px 8px;' +
      '  border:1px solid rgba(255,255,255,0.2);border-radius:6px;' +
      '  background:rgba(0,0,0,0.3);color:#fff;' +
      '  font-size:14px;text-align:center;' +
      '}' +
      '#' + ROOT_ID + ' .ysc-hint {' +
      '  margin:8px 0 0;font-size:11px;opacity:0.6;line-height:1.5;' +
      '}' +
      '#' + ROOT_ID + ' .ysc-toast {' +
      '  position:absolute;bottom:calc(100% + 8px);left:0;right:0;' +
      '  padding:8px 12px;background:rgba(28,28,28,0.95);' +
      '  border:1px solid rgba(255,255,255,0.15);border-radius:8px;' +
      '  font-size:12px;line-height:1.5;' +
      '  opacity:0;pointer-events:none;transition:opacity 0.2s;' +
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
      '  display:none;align-items:center;gap:5px;' +
      '  background:rgba(28,28,28,0.92);' +
      '  border:1px solid rgba(255,255,255,0.15);border-radius:8px;' +
      '  padding:6px 8px;box-shadow:0 4px 16px rgba(0,0,0,0.35);' +
      '  cursor:default;user-select:none;' +
      '}' +
      '#' + ROOT_ID + ' .ysc-mini-btn {' +
      '  width:28px;height:28px;padding:0;display:flex;' +
      '  align-items:center;justify-content:center;' +
      '  border:1px solid rgba(255,255,255,0.2);border-radius:6px;' +
      '  background:rgba(255,255,255,0.08);color:#fff;' +
      '  font-size:16px;font-weight:700;cursor:pointer;' +
      '  transition:background 0.15s;flex-shrink:0;' +
      '}' +
      '#' + ROOT_ID + ' .ysc-mini-btn:hover {' +
      '  background:rgba(255,255,255,0.18);' +
      '}' +
      '#' + ROOT_ID + ' .ysc-mini-btn:active {' +
      '  background:rgba(255,255,255,0.25);' +
      '}' +
      '#' + ROOT_ID + ' .ysc-mini-input {' +
      '  width:58px;height:28px;padding:2px 4px;' +
      '  border:1px solid rgba(255,255,255,0.12);border-radius:5px;' +
      '  background:rgba(0,0,0,0.25);color:#fff;' +
      '  font-size:13px;font-weight:600;text-align:center;' +
      '  transition:border-color 0.15s,background 0.15s;' +
      '  -moz-appearance:textfield;' +
      '}' +
      '#' + ROOT_ID + ' .ysc-mini-input::-webkit-inner-spin-button,' +
      '#' + ROOT_ID + ' .ysc-mini-input::-webkit-outer-spin-button {' +
      '  -webkit-appearance:none;margin:0;' +
      '}' +
      '#' + ROOT_ID + ' .ysc-mini-input:hover {' +
      '  border-color:rgba(255,255,255,0.3);' +
      '}' +
      '#' + ROOT_ID + ' .ysc-mini-input:focus {' +
      '  border-color:rgba(255,255,255,0.5);' +
      '  background:rgba(0,0,0,0.45);outline:none;' +
      '}' +
      '#' + ROOT_ID + ' .ysc-mini-label {' +
      '  font-size:11px;font-weight:600;opacity:0.7;' +
      '  white-space:nowrap;flex-shrink:0;' +
      '  padding:0 2px;cursor:default;' +
      '}' +
      '#' + ROOT_ID + ' .ysc-mini-close {' +
      '  width:20px;height:28px;padding:0;border:none;border-radius:4px;' +
      '  background:transparent;color:rgba(255,255,255,0.45);' +
      '  font-size:14px;cursor:pointer;flex-shrink:0;' +
      '  transition:color 0.15s,background 0.15s;' +
      '  display:flex;align-items:center;justify-content:center;' +
      '}' +
      '#' + ROOT_ID + ' .ysc-mini-close:hover {' +
      '  color:#fff;background:rgba(255,255,255,0.12);' +
      '}' +
      '#' + ROOT_ID + ' .ysc-mini-expand {' +
      '  width:20px;height:28px;padding:0;border:none;border-radius:4px;' +
      '  background:transparent;color:rgba(255,255,255,0.45);' +
      '  font-size:10px;cursor:pointer;flex-shrink:0;' +
      '  transition:color 0.15s,background 0.15s;' +
      '  display:flex;align-items:center;justify-content:center;' +
      '}' +
      '#' + ROOT_ID + ' .ysc-mini-expand:hover {' +
      '  color:#fff;background:rgba(255,255,255,0.1);' +
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
      '  <div class="ysc-value ysc-speed-label">1x</div>' +
      '  <input class="ysc-slider" type="range" ' +
      '         min="' + MIN_SPEED + '" max="' + MAX_SPEED + '" ' +
      '         step="' + STEP + '" value="1">' +
      '  <div class="ysc-row">' +
      '    <button class="ysc-btn ysc-down" type="button">−</button>' +
      '    <input class="ysc-input" type="number" ' +
      '           min="' + MIN_SPEED + '" max="' + MAX_SPEED + '" ' +
      '           step="0.01" value="1">' +
      '    <button class="ysc-btn ysc-up" type="button">+</button>' +
      '  </div>' +
      '  <p class="ysc-hint">关闭或收起后，' +
      '    仍可点击浏览器右上角的' +
      '    扩展图标调节速度</p>' +
      '</div>' +

      // ── 迷你面板 ──
      '<div class="ysc-mini">' +
      '  <span class="ysc-mini-label">播放速度</span>' +
      '  <button class="ysc-mini-btn ysc-mini-down" type="button" ' +
      '          title="减速">−</button>' +
      '  <input class="ysc-mini-input" type="number" ' +
      '         min="' + MIN_SPEED + '" max="' + MAX_SPEED + '" ' +
      '         step="0.01" value="1" ' +
      '         title="当前速度，可直接输入">' +
      '  <button class="ysc-mini-btn ysc-mini-up" type="button" ' +
      '          title="加速">+</button>' +
      '  <button class="ysc-mini-expand" type="button" ' +
      '          title="展开完整面板">▲</button>' +
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
    document.body.appendChild(root);

    // 初始控件值
    const video = getVideo();
    updateControls(video ? video.playbackRate : 1);
    applyPanelState();
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
          createPanel();
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

  // ── 站点判断 ──────────────────────────────────────────────

  function isSupportedSite() {
    var host = location.hostname;
    return host.indexOf('youtube.com') !== -1 || host.indexOf('bilibili.com') !== -1;
  }

  // ── 初始化 ────────────────────────────────────────────────

  var initTimer = null;

  function init() {
    if (!isSupportedSite()) return;

    // 防抖：短时间内多次导航只执行最后一次
    clearTimeout(initTimer);
    initTimer = setTimeout(function () {
      createPanel();
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

  // Bilibili：劫持 pushState / replaceState + 监听 popstate
  if (location.hostname.indexOf('bilibili.com') !== -1) {
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
  }

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
      // 确保面板存在
      if (!getRoot()) createPanel();
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
