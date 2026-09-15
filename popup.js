(function () {
  'use strict';

  var MIN_SPEED = 0.1;
  var MAX_SPEED = 4;
  var STEP = 0.05;

  var statusEl = document.getElementById('status');
  var valueEl = document.getElementById('speedValue');
  var sliderEl = document.getElementById('speedRange');
  var inputEl = document.getElementById('speedInput');

  function clampSpeed(speed) {
    return Math.min(MAX_SPEED, Math.max(MIN_SPEED, Number(speed) || 1));
  }

  function formatSpeed(speed) {
    return parseFloat(clampSpeed(speed).toFixed(2));
  }

  function showStatus(message, isError) {
    statusEl.textContent = message;
    statusEl.className = isError ? 'error' : '';
  }

  function updateUI(speed) {
    var normalized = formatSpeed(speed);
    sliderEl.value = normalized;
    if (document.activeElement !== inputEl) inputEl.value = normalized;
    valueEl.textContent = normalized + 'x';
  }

  // ── 发送消息到 content script ──────────────────────────────

  function sendToTab(data, callback) {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      var tab = tabs[0];
      if (!tab || !tab.id) {
        callback(new Error('无法获取当前标签页'));
        return;
      }

      chrome.tabs.sendMessage(tab.id, data, function (response) {
        if (chrome.runtime.lastError) {
          callback(new Error(chrome.runtime.lastError.message));
          return;
        }
        callback(null, response);
      });
    });
  }

  // ── 程序化注入 content script（fallback）──────────────────

  function injectContentScript(callback) {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      var tab = tabs[0];
      if (!tab || !tab.id) {
        callback(new Error('无法获取当前标签页'));
        return;
      }

      // 先注入脚本
      chrome.scripting.executeScript(
        {
          target: { tabId: tab.id },
          files: ['content.js'],
        },
        function () {
          if (chrome.runtime.lastError) {
            callback(new Error(chrome.runtime.lastError.message));
            return;
          }
          // 注入成功后稍等让脚本初始化
          setTimeout(function () {
            callback(null);
          }, 150);
        }
      );
    });
  }

  // ── 发送速度（带 fallback 注入）───────────────────────────

  function applySpeed(speed) {
    var normalized = formatSpeed(speed);
    updateUI(normalized);

    sendToTab({ speed: normalized }, function (err, response) {
      if (err) {
        // 消息发送失败 → 尝试注入 content script
        injectContentScript(function (injectErr) {
          if (injectErr) {
            showStatus('请在视频页面使用', true);
            return;
          }
          // 注入成功后重试
          sendToTab({ speed: normalized }, function (retryErr, retryRes) {
            if (retryErr) {
              showStatus('请在视频页面使用', true);
              return;
            }
            if (retryRes && retryRes.ok) {
              showStatus('已设为 ' + normalized + 'x');
            } else {
              showStatus('未找到视频，请先播放视频', true);
            }
          });
        });
        return;
      }

      if (response && response.ok) {
        showStatus('已设为 ' + normalized + 'x');
      } else {
        showStatus('未找到视频，请先播放视频', true);
      }
    });
  }

  // ── 事件绑定 ──────────────────────────────────────────────

  sliderEl.addEventListener('input', function () {
    applySpeed(sliderEl.value);
  });

  inputEl.addEventListener('change', function () {
    applySpeed(inputEl.value);
  });
  inputEl.addEventListener('keydown', function (event) {
    if (event.key === 'Enter') {
      applySpeed(inputEl.value);
      inputEl.blur();
    }
  });

  document.getElementById('speedDown').addEventListener('click', function () {
    applySpeed(formatSpeed(inputEl.value) - STEP);
  });

  document.getElementById('speedUp').addEventListener('click', function () {
    applySpeed(formatSpeed(inputEl.value) + STEP);
  });

  // ── 恢复页面面板 ──────────────────────────────────────────

  document.getElementById('restorePanel').addEventListener('click', function () {
    sendToTab({ action: 'showPanel' }, function (err, response) {
      if (err) {
        // 消息失败 → 尝试注入
        injectContentScript(function (injectErr) {
          if (injectErr) {
            showStatus('请在视频页面使用', true);
            return;
          }
          sendToTab({ action: 'showPanel' }, function (retryErr, retryRes) {
            if (retryErr) {
              showStatus('请在视频页面使用', true);
              return;
            }
            if (retryRes && retryRes.ok) {
              showStatus('页面面板已恢复');
            }
          });
        });
        return;
      }

      if (response && response.ok) {
        showStatus('页面面板已恢复');
      }
    });
  });

  // ── 初始加载当前速度 ──────────────────────────────────────

  sendToTab({ action: 'getSpeed' }, function (err, response) {
    if (err || !response) {
      // 脚本未注入（页面未刷新 / 白名单外站点）→ 自动注入后重试一次
      injectContentScript(function (injectErr) {
        if (injectErr) return;
        sendToTab({ action: 'getSpeed' }, function (retryErr, retryRes) {
          if (retryErr || !retryRes) return;
          if (retryRes.speed != null) {
            updateUI(retryRes.speed);
          }
        });
      });
      return;
    }
    if (response.speed != null) {
      updateUI(response.speed);
    }
  });
})();
