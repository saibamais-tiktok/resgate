/**
 * ADVANCED BOT DETECTION FINGERPRINT SCRIPT
 * Captura TODAS as informações possíveis do navegador/dispositivo
 * Especialmente otimizado para detectar bots do TikTok
 * Versão: 2.1.0
 */

(function() {
  'use strict';

  // Configuração
  const CONFIG = {
    API_ENDPOINT: 'https://api.fycloak.com/api/v2/bot-detection/collect-full',
    DEBUG: false,
    TRACKING_DURATION: 15000, // 15 segundos de tracking
    IDLE_GAP_THRESHOLD_MS: 500, // gaps >= 500ms contam como idle
    VIEWPORT_HEIGHT_ALERT_RATIO: 0.7,
    CLICK_SAMPLE_LIMIT: 60
  };

  const SCRIPT_BOOT_TIME = Date.now();
  const navigationTimeOrigin = (typeof performance !== 'undefined' && typeof performance.timeOrigin === 'number')
    ? performance.timeOrigin
    : SCRIPT_BOOT_TIME;
  const NAVIGATION_START = Math.round(navigationTimeOrigin);

  // Estado global
  const STATE = {
    fingerprint_id: null,
    session_id: null,
    start_time: NAVIGATION_START,
    script_boot_time: SCRIPT_BOOT_TIME,
    mouse_movements: [],
    mouse_clicks: 0,
    mouse_scrolls: 0,
    keyboard_events: 0,
    interactions_started: false,
    first_interaction_time: null,
    movement_sample_limit: 600,
    click_samples: [],
    click_sample_limit: CONFIG.CLICK_SAMPLE_LIMIT
  };

  // Gerar IDs únicos
  function generateId() {
    return 'fp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  STATE.fingerprint_id = generateId();
  STATE.session_id = sessionStorage.getItem('fp_session') || generateId();
  sessionStorage.setItem('fp_session', STATE.session_id);

  /**
   * ========================================================================
   * CANVAS FINGERPRINTING (múltiplos métodos)
   * ========================================================================
   */
  async function getCanvasFingerprints() {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 320;
      canvas.height = 160;
      const ctx = canvas.getContext('2d');

      // Teste 1: Canvas com texto e gradientes
      ctx.save();
      ctx.textBaseline = 'alphabetic';
      ctx.font = '16px "Arial"';
      const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
      gradient.addColorStop(0, '#f60');
      gradient.addColorStop(0.5, '#069');
      gradient.addColorStop(1, '#0ff');
      ctx.fillStyle = gradient;
      ctx.fillText('BrowserFP 🤖🎯', 10, 40);
      ctx.fillText('browserFp 🤖🎯', 12, 70);
      const canvasTextHash = await hashString(canvas.toDataURL());
      ctx.restore();

      // Teste 2: Canvas com emojis e sombras
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.font = '48px "Segoe UI Emoji"';
      ctx.shadowColor = 'rgba(0,0,0,0.2)';
      ctx.shadowBlur = 4;
      ctx.fillText('😀😃😄😁🤖🎯', 10, 64);
      const canvasEmojiHash = await hashString(canvas.toDataURL());

      // Teste 3: Canvas com geometria e blend
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = 'rgb(255,0,255)';
      ctx.beginPath();
      ctx.arc(90, 90, 70, 0, Math.PI * 2, true);
      ctx.fill();
      ctx.fillStyle = 'rgb(0,255,255)';
      ctx.beginPath();
      ctx.arc(150, 90, 70, 0, Math.PI * 2, true);
      ctx.fill();
      ctx.fillStyle = '#222';
      ctx.beginPath();
      ctx.rect(0, 120, canvas.width, 40);
      ctx.fill();
      const canvasGeometryHash = await hashString(canvas.toDataURL());

      // Hash geral do canvas
      const canvasHash = await hashString(`${canvasTextHash}:${canvasEmojiHash}:${canvasGeometryHash}`);

      return {
        canvas_hash: canvasHash,
        canvas_text_hash: canvasTextHash,
        canvas_emoji_hash: canvasEmojiHash,
        canvas_geometry_hash: canvasGeometryHash
      };
    } catch (e) {
      return {
        canvas_hash: '',
        canvas_text_hash: '',
        canvas_emoji_hash: '',
        canvas_geometry_hash: '',
        error: e.message
      };
    }
  }

  /**
   * ========================================================================
   * WEBGL FINGERPRINTING (informações detalhadas)
   * ========================================================================
   */
  async function getWebGLFingerprint() {
    try {
      const canvas = document.createElement('canvas');
      const webgl2Context = canvas.getContext('webgl2');
      const gl = webgl2Context || canvas.getContext('webgl') || canvas.getContext('experimental-webgl');

      if (!gl) {
        return { webgl_supported: false };
      }

      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');

      const rendererMasked = gl.getParameter(gl.RENDERER) || '';
      const rendererRaw = debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : null;
      const rendererEffective = rendererRaw || rendererMasked;
      const webgl_data = {
        webgl_vendor: debugInfo ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR),
        webgl_renderer: rendererMasked,
        webgl_renderer_raw: rendererRaw || rendererMasked,
        webgl_renderer_group: normalizeRendererGroup(rendererEffective),
        webgl_version: gl.getParameter(gl.VERSION),
        webgl_shading_language_version: gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
        webgl_max_texture_size: gl.getParameter(gl.MAX_TEXTURE_SIZE),
        webgl_max_vertex_attribs: gl.getParameter(gl.MAX_VERTEX_ATTRIBS),
        webgl_max_viewport_dims: gl.getParameter(gl.MAX_VIEWPORT_DIMS).join('x'),
        webgl_extensions: gl.getSupportedExtensions() || [],
        webgl2_supported: Boolean(webgl2Context)
      };
      const parsedVersion = parseWebGLVersion(webgl_data.webgl_version);
      webgl_data.webgl_version_major = parsedVersion.major;
      webgl_data.webgl_version_minor = parsedVersion.minor;

      // Criar hash dos parâmetros WebGL
      const params = [
        gl.getParameter(gl.ALPHA_BITS),
        gl.getParameter(gl.BLUE_BITS),
        gl.getParameter(gl.DEPTH_BITS),
        gl.getParameter(gl.GREEN_BITS),
        gl.getParameter(gl.MAX_COMBINED_TEXTURE_IMAGE_UNITS),
        gl.getParameter(gl.MAX_CUBE_MAP_TEXTURE_SIZE),
        gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS),
        gl.getParameter(gl.MAX_RENDERBUFFER_SIZE),
        gl.getParameter(gl.MAX_VARYING_VECTORS),
        gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS),
        gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS),
        gl.getParameter(gl.RED_BITS),
        gl.getParameter(gl.STENCIL_BITS)
      ].join(',');

      webgl_data.webgl_params_hash = await hashString(params);
      webgl_data.webgl_extensions_hash = await hashString(webgl_data.webgl_extensions.join(','));
      webgl_data.webgl_hash = await hashString(JSON.stringify(webgl_data));

      return webgl_data;
    } catch (e) {
      return {
        webgl_supported: false,
        error: e.message
      };
    }
  }

  /**
   * ========================================================================
   * AUDIO FINGERPRINTING
   * ========================================================================
   */
  async function getAudioFingerprint() {
    const codecs = detectAudioCodecs();
    try {
      const OfflineContext = window.OfflineAudioContext || window.webkitOfflineAudioContext;
      if (!OfflineContext) {
        return { audio_hash: '', audio_codecs: codecs };
      }

      const context = new OfflineContext(1, 44100, 44100);
      const oscillator = context.createOscillator();
      oscillator.type = 'triangle';
      oscillator.frequency.value = 10000;

      const compressor = context.createDynamicsCompressor();
      compressor.threshold.value = -50;
      compressor.knee.value = 40;
      compressor.ratio.value = 12;
      compressor.attack.value = 0;
      compressor.release.value = 0.25;

      oscillator.connect(compressor);
      compressor.connect(context.destination);
      oscillator.start(0);

      const buffer = await context.startRendering();
      oscillator.stop();

      const samples = buffer.getChannelData(0).slice(4500, 5000);
      const audio_hash = await hashString(Array.from(samples).map(n => n.toFixed(5)).join(','));

      return {
        audio_hash,
        audio_codecs: codecs
      };
    } catch (e) {
      return { audio_hash: '', audio_codecs: codecs, error: e.message };
    }
  }

  function detectAudioCodecs() {
    const audio = document.createElement('audio');
    if (!audio || typeof audio.canPlayType !== 'function') {
      return [];
    }
    const codecs = [
      'audio/ogg; codecs="vorbis"',
      'audio/mpeg',
      'audio/wav; codecs="1"',
      'audio/x-m4a',
      'audio/aac',
      'audio/webm; codecs="opus"'
    ];
    return codecs.filter(codec => audio.canPlayType(codec) !== '');
  }

  /**
   * ========================================================================
   * FONTS DETECTION
   * ========================================================================
   */
  async function getAvailableFonts() {
    const baseFonts = ['monospace', 'sans-serif', 'serif'];
    const testFonts = [
      'Arial', 'Verdana', 'Times New Roman', 'Courier New', 'Georgia',
      'Palatino', 'Garamond', 'Bookman', 'Comic Sans MS', 'Trebuchet MS',
      'Impact', 'Lucida Console', 'Tahoma', 'Helvetica', 'Century Gothic',
      'Calibri', 'Segoe UI', 'Roboto', 'Ubuntu', 'Monaco'
    ];

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx.font = '72px monospace';
    const baseWidths = {};

    baseFonts.forEach(font => {
      ctx.font = `72px ${font}`;
      baseWidths[font] = ctx.measureText('mmmmmmmmmmlli').width;
    });

    const availableFonts = [];
    testFonts.forEach(font => {
      baseFonts.forEach(baseFont => {
        ctx.font = `72px "${font}", ${baseFont}`;
        const width = ctx.measureText('mmmmmmmmmmlli').width;
        if (width !== baseWidths[baseFont]) {
          if (!availableFonts.includes(font)) {
            availableFonts.push(font);
          }
        }
      });
    });

    return {
      fonts_available: availableFonts,
      fonts_hash: await hashString(availableFonts.join(','))
    };
  }

  /**
   * ========================================================================
   * PLUGINS DETECTION
   * ========================================================================
   */
  async function getPlugins(browserInfo = {}) {
    const unsupported = {
      plugins_supported: false,
      plugins: null,
      plugins_count: null,
      plugins_hash: ''
    };

    try {
      if (!navigator.plugins) {
        return unsupported;
      }

      const rawPlugins = [];
      for (let i = 0; i < navigator.plugins.length; i++) {
        rawPlugins.push(navigator.plugins[i].name);
      }

      let filteredPlugins = rawPlugins;
      const isFirefoxFamily = (browserInfo.browser_name === 'Firefox') || (browserInfo.engine_name === 'Gecko');
      if (isFirefoxFamily) {
        const blocked = new Set([
          'Chrome PDF Viewer',
          'Chromium PDF Viewer',
          'Microsoft Edge PDF Viewer',
          'WebKit built-in PDF'
        ]);
        filteredPlugins = rawPlugins.filter(name => !blocked.has(name));
      }

      return {
        plugins_supported: true,
        plugins: filteredPlugins,
        plugins_count: filteredPlugins.length,
        plugins_hash: filteredPlugins.length ? await hashString(filteredPlugins.join(',')) : ''
      };
    } catch (e) {
      return unsupported;
    }
  }

  /**
   * ========================================================================
   * MEDIA DEVICES
   * ========================================================================
   */
  function getMediaDevices() {
    return new Promise((resolve) => {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
        return resolve({
          media_devices_supported: false,
          media_devices_permission: null,
          media_devices_permission_note: 'MediaDevices API not supported',
          media_devices: null,
          media_devices_count: null,
          has_camera: null,
          has_microphone: null,
          has_speaker: null
        });
      }

      navigator.mediaDevices.enumerateDevices()
        .then(devices => {
          const deviceTypes = devices.map(d => d.kind);
          const permissionGranted = devices.some(d => typeof d.label === 'string' && d.label.trim().length > 0);
          const hasCamera = deviceTypes.includes('videoinput');
          const hasMicrophone = deviceTypes.includes('audioinput');
          const hasSpeaker = deviceTypes.includes('audiooutput') ? true : null;
          const permissionNote = !permissionGranted && deviceTypes.length > 0
            ? 'Enumerated device kinds without label permission'
            : null;

          resolve({
            media_devices_supported: true,
            media_devices_permission: permissionGranted,
            media_devices_permission_note: permissionNote,
            media_devices: deviceTypes,
            media_devices_count: devices.length,
            has_camera: hasCamera,
            has_microphone: hasMicrophone,
            has_speaker: hasSpeaker
          });
        })
        .catch(error => {
          const denied = error && (error.name === 'NotAllowedError' || error.name === 'SecurityError');
          resolve({
            media_devices_supported: true,
            media_devices_permission: denied ? false : null,
            media_devices_permission_note: denied ? 'Permission denied while requesting devices' : null,
            media_devices: [],
            media_devices_count: 0,
            has_camera: null,
            has_microphone: null,
            has_speaker: null,
            media_devices_error: error?.name || 'unknown'
          });
        });
    });
  }

  /**
   * ========================================================================
   * BATTERY API
   * ========================================================================
   */
  function getBatteryInfo() {
    return new Promise((resolve) => {
      if (!navigator.getBattery) {
        return resolve({
          battery_supported: false,
          battery_charging: null,
          battery_level: null
        });
      }

      navigator.getBattery()
        .then(battery => {
          resolve({
            battery_supported: true,
            battery_charging: battery.charging,
            battery_level: battery.level
          });
        })
        .catch(() => {
          resolve({
            battery_supported: true,
            battery_charging: null,
            battery_level: null,
            battery_error: 'unavailable'
          });
        });
    });
  }

  /**
   * ========================================================================
   * NETWORK INFORMATION
   * ========================================================================
   */
  function getNetworkInfo() {
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (!connection) {
      return {
        network_info_supported: false,
        network_effective_type: null,
        network_downlink: null,
        network_rtt: null,
        network_save_data: null,
        connection_type: null
      };
    }

    return {
      network_info_supported: true,
      network_effective_type: connection.effectiveType || null,
      network_downlink: typeof connection.downlink === 'number' ? connection.downlink : null,
      network_rtt: typeof connection.rtt === 'number' ? connection.rtt : null,
      network_save_data: typeof connection.saveData === 'boolean' ? connection.saveData : null,
      connection_type: connection.type || null
    };
  }

  /**
   * ========================================================================
   * WEBRTC LOCAL IPs
   * ========================================================================
   */
  function getWebRTCIPs() {
    return new Promise((resolve) => {
      const RTCPeerConnection = window.RTCPeerConnection || window.mozRTCPeerConnection || window.webkitRTCPeerConnection;

      if (!RTCPeerConnection) {
        return resolve({
          webrtc_support: false,
          webrtc_permission: null,
          webrtc_public_ip: '',
          webrtc_local_ips: [],
          webrtc_ip_versions: [],
          webrtc_error: 'not_supported'
        });
      }

      const localIPs = new Set();
      const publicIPs = new Set();
      const ipVersions = new Set();

      let finished = false;
      let webrtcError = null;
      let webrtcPermission = null;

      const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });

      const finalize = () => {
        if (finished) return;
        finished = true;
        if (pc.signalingState !== 'closed') {
          try { pc.close(); } catch (_) {}
        }
        resolve({
          webrtc_support: true,
          webrtc_permission: webrtcPermission,
          webrtc_public_ip: Array.from(publicIPs)[0] || '',
          webrtc_local_ips: Array.from(localIPs),
          webrtc_ip_versions: Array.from(ipVersions),
          webrtc_error: webrtcError
        });
      };

      const finalizeImmediate = (result) => {
        if (finished) return;
        finished = true;
        try { pc.close(); } catch (_) {}
        resolve(result);
      };

      try {
        pc.createDataChannel('');
        pc.createOffer()
          .then(offer => pc.setLocalDescription(offer))
          .catch(error => {
            webrtcPermission = error?.name === 'NotAllowedError' ? false : null;
            webrtcError = error?.name === 'NotAllowedError' ? 'permission_denied' : 'unknown';
            finalizeImmediate({
              webrtc_support: true,
              webrtc_permission: webrtcPermission,
              webrtc_public_ip: '',
              webrtc_local_ips: [],
              webrtc_ip_versions: [],
              webrtc_error: webrtcError
            });
          });
      } catch (error) {
        return finalizeImmediate({
          webrtc_support: true,
          webrtc_permission: false,
          webrtc_public_ip: '',
          webrtc_local_ips: [],
          webrtc_ip_versions: [],
          webrtc_error: 'blocked'
        });
      }

      pc.onicecandidate = (event) => {
        if (!event || !event.candidate) {
          if (!localIPs.size && !publicIPs.size && !webrtcError) {
            webrtcError = 'timeout';
          }
          return finalize();
        }

        const ip = parseCandidateAddress(event.candidate.candidate);
        if (!ip) {
          return;
        }

        webrtcPermission = true;
        ipVersions.add(ip.includes(':') ? 'ipv6' : 'ipv4');
        if (isPrivateIp(ip)) {
          localIPs.add(ip);
        } else {
          publicIPs.add(ip);
        }
      };

      pc.onicecandidateerror = () => {
        webrtcError = 'blocked';
        webrtcPermission = false;
        finalize();
      };

      setTimeout(() => {
        if (!localIPs.size && !publicIPs.size && !webrtcError) {
          webrtcError = 'timeout';
        }
        finalize();
      }, 2000);
    });
  }

  function parseCandidateAddress(candidate) {
    if (!candidate || typeof candidate !== 'string') {
      return null;
    }
    const parts = candidate.trim().split(/\s+/);
    if (parts.length < 5) {
      return null;
    }
    const potentialAddress = parts[4];
    if (/^(\d{1,3}\.){3}\d{1,3}$/.test(potentialAddress)) {
      return potentialAddress;
    }
    if (/^[0-9a-fA-F:]+$/.test(potentialAddress)) {
      return potentialAddress;
    }
    return null;
  }

  function isPrivateIp(ip) {
    if (!ip) return false;
    if (ip.includes(':')) {
      const normalized = ip.toLowerCase();
      return normalized.startsWith('fd') || normalized.startsWith('fe80') || normalized === '::1';
    }
    return /^10\./.test(ip)
      || /^192\.168\./.test(ip)
      || /^172\.(1[6-9]|2\d|3[01])\./.test(ip)
      || /^127\./.test(ip);
  }

  /**
   * ========================================================================
   * HEADLESS/AUTOMATION DETECTION
   * ========================================================================
   */
  function detectAutomation() {
    const suspicions = [];
    const ua = navigator.userAgent || '';
    const uaBrands = navigator.userAgentData?.brands || [];
    const isMobile = navigator.userAgentData?.mobile || /Android|iPhone|iPad|Mobile/i.test(ua);
    const pluginCount = navigator.plugins ? navigator.plugins.length : 0;

    if (navigator.webdriver) suspicions.push('navigator.webdriver');
    if (window.callPhantom || window._phantom) suspicions.push('phantom');
    if (window.__nightmare) suspicions.push('nightmare');
    if (window.document.documentElement.getAttribute('webdriver')) suspicions.push('webdriver_attribute');
    if (window.document.$cdc_asdjflasutopfhvcZLmcfl_) suspicions.push('selenium_cdc');

    if (!isMobile && pluginCount === 0 && /Chrome|Firefox|Safari|Edge/.test(ua)) {
      suspicions.push('desktop_no_plugins');
    }

    if (/HeadlessChrome/i.test(ua) || uaBrands.some(brand => /headless/i.test(brand.brand))) {
      suspicions.push('headless_user_agent');
    }

    if (!isMobile && window.outerWidth && window.innerWidth &&
        Math.abs(window.outerWidth - window.innerWidth) < 2 &&
        Math.abs(window.outerHeight - window.innerHeight) < 2) {
      suspicions.push('no_window_chrome');
    }

    if (!navigator.languages || navigator.languages.length === 0) {
      suspicions.push('missing_languages');
    }

    return {
      headless_detected: suspicions.includes('headless_user_agent') || suspicions.includes('no_window_chrome'),
      automation_detected: suspicions.length > 0,
      webdriver_detected: suspicions.includes('navigator.webdriver') || suspicions.includes('webdriver_attribute'),
      phantom_detected: suspicions.includes('phantom'),
      selenium_detected: suspicions.includes('selenium_cdc') || suspicions.includes('webdriver_attribute'),
      puppeteer_detected: suspicions.includes('headless_user_agent') || suspicions.includes('desktop_no_plugins'),
      suspicion_reasons: Array.from(new Set(suspicions))
    };
  }

  /**
   * ========================================================================
   * TIKTOK DETECTION (específico)
   * ========================================================================
   */
  function detectTikTok() {
    const ua = navigator.userAgent || '';
    const lowerUA = ua.toLowerCase();
    const markers = [];

    if (/tiktok/i.test(ua)) markers.push('tiktok_string');
    if (/musical\.ly/i.test(ua)) markers.push('musically');
    if (/bytedance/i.test(ua)) markers.push('bytedance');

    const uaBrands = navigator.userAgentData?.brands || [];
    if (uaBrands.some(brand => /tiktok|bytedance/i.test(brand.brand))) {
      markers.push('ua_data_brand');
    }

    const hasTikTokBridge = !!(window?.webkit?.messageHandlers?.bytedanceWebview
      || window?.tiktok
      || window?.ttCollector);

    const isWebView = /\bwv\b/.test(lowerUA) || /; wv\)/.test(lowerUA) || hasTikTokBridge;
    const referrerMatches = /tiktok/i.test(document.referrer);
    const versionMatch = ua.match(/tiktok[\/\s]+([\d\.]+)/i);
    const appVersion = versionMatch ? versionMatch[1] : '';

    return {
      tiktok_webview_detected: Boolean((isWebView && markers.length > 0) || hasTikTokBridge || referrerMatches),
      tiktok_app_version: appVersion,
      tiktok_user_agent_markers: Array.from(new Set(markers)),
      tiktok_sdk_hooks: hasTikTokBridge
    };
  }

  /**
   * ========================================================================
   * USER-AGENT PARSING
   * ========================================================================
   */
  function parseUserAgent() {
    const ua = navigator.userAgent;
    const browserData = {
      browser_name: 'unknown',
      browser_version: '',
      browser_major_version: 0,
      engine_name: '',
      engine_version: '',
      os_name: 'unknown',
      os_version: '',
      device_type: 'unknown',
      device_vendor: '',
      device_model: ''
    };

    // Browser detection
    if (/Chrome/.test(ua) && !/Chromium/.test(ua) && !/Edg/.test(ua)) {
      browserData.browser_name = 'Chrome';
      browserData.browser_version = ua.match(/Chrome\/([\d.]+)/)?.[1] || '';
    } else if (/Safari/.test(ua) && !/Chrome/.test(ua)) {
      browserData.browser_name = 'Safari';
      browserData.browser_version = ua.match(/Version\/([\d.]+)/)?.[1] || '';
    } else if (/Firefox/.test(ua)) {
      browserData.browser_name = 'Firefox';
      browserData.browser_version = ua.match(/Firefox\/([\d.]+)/)?.[1] || '';
    } else if (/Edg/.test(ua)) {
      browserData.browser_name = 'Edge';
      browserData.browser_version = ua.match(/Edg\/([\d.]+)/)?.[1] || '';
    }

    browserData.browser_major_version = parseInt(browserData.browser_version.split('.')[0]) || 0;

    // Engine detection
    if (/AppleWebKit/.test(ua)) {
      browserData.engine_name = /Blink/.test(ua) ? 'Blink' : 'WebKit';
      browserData.engine_version = ua.match(/AppleWebKit\/([\d.]+)/)?.[1] || '';
    } else if (/Gecko/.test(ua)) {
      browserData.engine_name = 'Gecko';
      browserData.engine_version = ua.match(/rv:([\d.]+)/)?.[1] || '';
    }

    // OS detection
    if (/Windows/.test(ua)) {
      browserData.os_name = 'Windows';
      browserData.os_version = ua.match(/Windows NT ([\d.]+)/)?.[1] || '';
    } else if (/Mac OS/.test(ua)) {
      browserData.os_name = 'macOS';
      browserData.os_version = ua.match(/Mac OS X ([\d_]+)/)?.[1]?.replace(/_/g, '.') || '';
    } else if (/Android/.test(ua)) {
      browserData.os_name = 'Android';
      browserData.os_version = ua.match(/Android ([\d.]+)/)?.[1] || '';
    } else if (/iOS|iPhone|iPad/.test(ua)) {
      browserData.os_name = 'iOS';
      browserData.os_version = ua.match(/OS ([\d_]+)/)?.[1]?.replace(/_/g, '.') || '';
    } else if (/Linux/.test(ua)) {
      browserData.os_name = 'Linux';
    }

    // Device type
    if (/Mobile|Android|iPhone/.test(ua)) {
      browserData.device_type = 'mobile';
    } else if (/Tablet|iPad/.test(ua)) {
      browserData.device_type = 'tablet';
    } else {
      browserData.device_type = 'desktop';
    }

    return browserData;
  }

  /**
   * ========================================================================
   * PERFORMANCE METRICS
   * ========================================================================
   */
  function getPerformanceMetrics() {
    const defaultFlags = { unrealistic_load: false, no_performance_sample: true };
    if (!window.performance) {
      return {
        performance_navigation_type: 'unknown',
        performance_timing: {},
        page_load_time: 0,
        time_to_first_byte: 0,
        dom_complete_time: 0,
        performance_flags: defaultFlags,
        performance_notes: 'performance_api_unavailable'
      };
    }

    const navEntries = typeof window.performance.getEntriesByType === 'function'
      ? window.performance.getEntriesByType('navigation')
      : [];

    if (navEntries && navEntries.length > 0) {
      const nav = navEntries[0];
      const rawPageLoad = nav.loadEventEnd || nav.duration || nav.domComplete || 0;
      const pageLoad = normalizeDuration(rawPageLoad);
      const timing = {
        dns_lookup: diffInMs(nav.domainLookupEnd, nav.domainLookupStart),
        tcp_connection: diffInMs(nav.connectEnd, nav.connectStart),
        request_time: diffInMs(nav.responseStart, nav.requestStart),
        response_time: diffInMs(nav.responseEnd, nav.responseStart),
        dom_processing: diffInMs(nav.domComplete, nav.domInteractive),
        page_load: pageLoad
      };
      const note = normalizePerformanceTiming(timing);
      const networkNote = note ? null : flagNetworkSubtimings(timing);
      const timeToFirstByteRaw = nav.responseStart;
      const timeToFirstByte = normalizeDuration(timeToFirstByteRaw, null, { allowZero: false });
      const domComplete = normalizeDuration(nav.domComplete);
      const response = {
        performance_navigation_type: nav.type || 'navigate',
        performance_timing: timing,
        page_load_time: pageLoad,
        time_to_first_byte: timeToFirstByte,
        dom_complete_time: domComplete,
        performance_flags: {
          unrealistic_load: pageLoad > 0 && pageLoad < 80,
          no_performance_sample: false
        }
      };
      let performanceNotes = null;
      performanceNotes = mergePerformanceNotes(performanceNotes, note);
      performanceNotes = mergePerformanceNotes(performanceNotes, networkNote);
      if (timeToFirstByte === null) {
        performanceNotes = mergePerformanceNotes(performanceNotes, 'ttfb_unavailable');
      }
      if (performanceNotes) {
        response.performance_notes = performanceNotes;
      }
      return response;
    }

    if (window.performance.timing) {
      const timing = window.performance.timing;
      const pageLoad = normalizeDuration(timing.loadEventEnd - timing.navigationStart);
      const perfTiming = {
        dns_lookup: diffInMs(timing.domainLookupEnd, timing.domainLookupStart),
        tcp_connection: diffInMs(timing.connectEnd, timing.connectStart),
        request_time: diffInMs(timing.responseStart, timing.requestStart),
        response_time: diffInMs(timing.responseEnd, timing.responseStart),
        dom_processing: diffInMs(timing.domComplete, timing.domLoading),
        page_load: pageLoad
      };
      const note = normalizePerformanceTiming(perfTiming);
      const networkNote = note ? null : flagNetworkSubtimings(perfTiming);
      const timeToFirstByteRaw = timing.responseStart - timing.navigationStart;
      const timeToFirstByte = normalizeDuration(timeToFirstByteRaw, null, { allowZero: false });
      const domComplete = normalizeDuration(timing.domComplete - timing.navigationStart);
      const response = {
        performance_navigation_type: window.performance.navigation?.type || 'navigate',
        performance_timing: perfTiming,
        page_load_time: pageLoad,
        time_to_first_byte: timeToFirstByte,
        dom_complete_time: domComplete,
        performance_flags: {
          unrealistic_load: pageLoad > 0 && pageLoad < 80,
          no_performance_sample: false
        }
      };
      let performanceNotes = null;
      performanceNotes = mergePerformanceNotes(performanceNotes, note);
      performanceNotes = mergePerformanceNotes(performanceNotes, networkNote);
      if (timeToFirstByte === null) {
        performanceNotes = mergePerformanceNotes(performanceNotes, 'ttfb_unavailable');
      }
      if (performanceNotes) {
        response.performance_notes = performanceNotes;
      }
      return response;
    }

    return {
      performance_navigation_type: 'unknown',
      performance_timing: {},
      page_load_time: 0,
      time_to_first_byte: 0,
      dom_complete_time: 0,
      performance_flags: defaultFlags,
      performance_notes: 'performance_api_unavailable'
    };
  }

  /**
   * ========================================================================
   * HASH FUNCTION (simples e rápida)
   * ========================================================================
   */
  async function hashString(str) {
    const normalized = typeof str === 'string' ? str : JSON.stringify(str || '');
    try {
      if (window.crypto?.subtle && typeof TextEncoder !== 'undefined') {
        const encoder = new TextEncoder();
        const data = encoder.encode(normalized);
        const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      }
    } catch (err) {
      CONFIG.DEBUG && console.warn('[Fingerprint] hashString digest falhou, usando fallback', err);
    }
    return legacyHash(normalized);
  }

  function legacyHash(str) {
    let hash1 = 0x811c9dc5;
    let hash2 = 0x01000193;
    for (let i = 0; i < str.length; i++) {
      const code = str.charCodeAt(i);
      hash1 ^= code;
      hash1 = (hash1 * 0x01000193) >>> 0;
      hash2 += (code * (i + 1));
      hash2 = hash2 >>> 0;
    }
    return [
      hash1.toString(16).padStart(8, '0'),
      hash2.toString(16).padStart(8, '0')
    ].join('');
  }

  function normalizeDuration(value, fallback = 0, options = {}) {
    const { allowZero = true } = options;
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return fallback;
    }
    const rounded = Math.round(value);
    if (rounded < 0) {
      return fallback;
    }
    if (!allowZero && rounded <= 0) {
      return fallback;
    }
    return rounded;
  }

  function diffInMs(end, start, fallback = 0) {
    if (typeof end !== 'number' || typeof start !== 'number') {
      return fallback;
    }
    return normalizeDuration(end - start, fallback);
  }

  /**
   * ========================================================================
   * TRACKING DE COMPORTAMENTO DO USUÁRIO
   * ========================================================================
   */
  function setupBehaviorTracking() {
    const markInteraction = (timestamp = Date.now()) => {
      if (!STATE.interactions_started) {
        STATE.interactions_started = true;
        STATE.first_interaction_time = timestamp;
      }
    };

    const recordPointer = (x, y, timestamp = Date.now()) => {
      const relativeTime = Math.max(0, Math.round(timestamp - STATE.start_time));
      if (STATE.mouse_movements.length >= STATE.movement_sample_limit) {
        STATE.mouse_movements.shift();
      }
      STATE.mouse_movements.push({ x, y, t: relativeTime });
    };

    const recordClick = (x, y, timestamp = Date.now()) => {
      const relativeTime = Math.max(0, Math.round(timestamp - STATE.start_time));
      if (STATE.click_samples.length >= STATE.click_sample_limit) {
        STATE.click_samples.shift();
      }
      STATE.click_samples.push({ x, y, t: relativeTime });
    };

    // Mouse movements (amostragem a cada 90ms)
    let lastSample = 0;
    document.addEventListener('mousemove', (e) => {
      const now = Date.now();
      if (now - lastSample > 90) {
        recordPointer(e.clientX, e.clientY, now);
        lastSample = now;
        markInteraction(now);
      }
    }, { passive: true });

    // Touch movements
    document.addEventListener('touchmove', (e) => {
      const now = Date.now();
      const touch = e.touches[0];
      if (!touch) return;
      if (now - lastSample > 90) {
        recordPointer(touch.clientX, touch.clientY, now);
        lastSample = now;
      }
      markInteraction(now);
    }, { passive: true });

    // Mouse clicks
    document.addEventListener('click', (e) => {
      STATE.mouse_clicks++;
      recordClick(e.clientX, e.clientY, Date.now());
      markInteraction();
    }, { passive: true });

    // Scrolls
    document.addEventListener('scroll', () => {
      STATE.mouse_scrolls++;
      markInteraction();
    }, { passive: true });

    // Keyboard
    document.addEventListener('keydown', () => {
      STATE.keyboard_events++;
      markInteraction();
    }, { passive: true });

    document.addEventListener('touchstart', () => {
      markInteraction();
    }, { passive: true });

    document.addEventListener('pointerdown', () => {
      markInteraction();
    }, { passive: true });
  }

  function summarizeBehavior() {
    const movements = STATE.mouse_movements.slice();
    const clickSamplesRaw = STATE.click_samples.slice();
    const clickSamples = sampleClicks(clickSamplesRaw, STATE.click_sample_limit);
    const firstClickTs = clickSamplesRaw.length ? clickSamplesRaw[0].t : null;
    const lastClickTs = clickSamplesRaw.length ? clickSamplesRaw[clickSamplesRaw.length - 1].t : null;
    const interactionEvents = movements.length + STATE.mouse_clicks + STATE.keyboard_events + STATE.mouse_scrolls;
    const interactionRate = Math.min(1, interactionEvents / Math.max(1, CONFIG.TRACKING_DURATION / 120));

    if (movements.length === 0) {
      return {
        mouse_path_distance: 0,
        mouse_avg_speed: 0,
        micro_mouse_movements: 0,
        interaction_duration: 0,
        interaction_rate: STATE.interactions_started ? Number(interactionRate.toFixed(3)) : 0,
        idle_gap_ms: null,
        mouse_samples: [],
        click_samples_count: clickSamplesRaw.length,
        click_samples_recent: clickSamples,
        first_click_ts: firstClickTs,
        last_click_ts: lastClickTs,
        mouse_speed_units: 'px/ms',
        behavior_units: {
          mouse_path_distance: 'px',
          mouse_avg_speed: 'px/ms',
          interaction_duration: 'ms'
        }
      };
    }

    const sampledPoints = sampleMovements(movements, 60);
    if (sampledPoints.length === 1) {
      return {
        mouse_path_distance: 0,
        mouse_avg_speed: 0,
        micro_mouse_movements: 0,
        interaction_duration: 0,
        interaction_rate: Number(interactionRate.toFixed(3)),
        idle_gap_ms: null,
        mouse_samples: sampledPoints,
        click_samples_count: clickSamplesRaw.length,
        click_samples_recent: clickSamples,
        first_click_ts: firstClickTs,
        last_click_ts: lastClickTs,
        mouse_speed_units: 'px/ms',
        behavior_units: {
          mouse_path_distance: 'px',
          mouse_avg_speed: 'px/ms',
          interaction_duration: 'ms'
        }
      };
    }

    let distance = 0;
    let microMovements = 0;
    for (let i = 1; i < sampledPoints.length; i++) {
      const dx = sampledPoints[i].x - sampledPoints[i - 1].x;
      const dy = sampledPoints[i].y - sampledPoints[i - 1].y;
      const segment = Math.hypot(dx, dy);
      distance += segment;
      if (segment < 2) {
        microMovements++;
      }
    }

    const timestamps = sampledPoints.map(point => point.t);
    const minTime = Math.min(...timestamps);
    const maxTime = Math.max(...timestamps);
    const duration = Math.max(0, Math.round(maxTime - minTime));
    let idleGap = 0;
    for (let i = 1; i < timestamps.length; i++) {
      idleGap = Math.max(idleGap, Math.round(timestamps[i] - timestamps[i - 1]));
    }

    return {
      mouse_path_distance: Number(distance.toFixed(2)),
      mouse_avg_speed: duration > 0 ? Number((distance / duration).toFixed(4)) : 0,
      micro_mouse_movements: microMovements,
      interaction_duration: duration,
      interaction_rate: Number(interactionRate.toFixed(3)),
      idle_gap_ms: idleGap >= CONFIG.IDLE_GAP_THRESHOLD_MS ? idleGap : null,
      mouse_samples: sampledPoints,
      click_samples_count: clickSamplesRaw.length,
      click_samples_recent: clickSamples,
      first_click_ts: firstClickTs,
      last_click_ts: lastClickTs,
      mouse_speed_units: 'px/ms',
      behavior_units: {
        mouse_path_distance: 'px',
        mouse_avg_speed: 'px/ms',
        interaction_duration: 'ms'
      }
    };
  }

  function sampleMovements(points, limit) {
    if (points.length <= limit) {
      return points;
    }
    const sampled = [];
    const step = points.length / limit;
    for (let i = 0; i < limit; i++) {
      const index = Math.min(points.length - 1, Math.floor(i * step));
      sampled.push(points[index]);
    }
    return sampled;
  }

  function sampleClicks(points, limit) {
    if (points.length <= limit) {
      return points;
    }
    return points.slice(points.length - limit);
  }

  function normalizePerformanceTiming(timing) {
    if (!timing) return null;
    const values = Object.values(timing)
      .filter(value => typeof value === 'number' && Number.isFinite(value));
    const hasSample = values.some(value => value > 0);
    if (hasSample) {
      return null;
    }
    Object.keys(timing).forEach((key) => {
      timing[key] = null;
    });
    return 'navigation_subtimings_unavailable';
  }

  function flagNetworkSubtimings(timing) {
    if (!timing) return null;
    const keys = ['dns_lookup', 'tcp_connection', 'request_time', 'response_time'];
    const hasPositive = keys.some((key) => typeof timing[key] === 'number' && timing[key] > 0);
    if (hasPositive) {
      return null;
    }
    keys.forEach((key) => {
      if (key in timing) {
        timing[key] = null;
      }
    });
    return 'network_subtimings_unavailable';
  }

  function normalizeRendererGroup(renderer) {
    if (!renderer || typeof renderer !== 'string') {
      return '';
    }
    const value = renderer.toLowerCase();
    if (value.includes('nvidia')) return 'nvidia';
    if (value.includes('radeon') || value.includes('amd')) return 'amd';
    if (value.includes('intel')) return 'intel';
    if (value.includes('apple')) return 'apple';
    if (value.includes('qualcomm') || value.includes('adreno')) return 'qualcomm';
    return 'other';
  }

  function parseWebGLVersion(versionString) {
    if (!versionString || typeof versionString !== 'string') {
      return { major: null, minor: null };
    }
    const match = versionString.match(/(\d+)\.(\d+)/);
    if (!match) {
      return { major: null, minor: null };
    }
    return {
      major: parseInt(match[1], 10) || null,
      minor: parseInt(match[2], 10) || null
    };
  }

  function mergePerformanceNotes(currentNote, newNote) {
    if (!newNote) return currentNote;
    if (!currentNote) return newNote;
    if (typeof currentNote === 'string') {
      const existing = currentNote.split(';').map(part => part.trim());
      if (existing.includes(newNote)) {
        return currentNote;
      }
      return `${currentNote}; ${newNote}`;
    }
    return currentNote;
  }

  /**
   * ========================================================================
   * CALCULAR BOT SCORE
   * ========================================================================
   */
  function calculateBotScore(fingerprintData) {
    let probabilityComplement = 1;
    const reasons = new Set();
    const addSignal = (condition, weight, reason) => {
      if (!condition) return;
      probabilityComplement *= (1 - weight);
      reasons.add(reason);
    };

    const behaviorSummary = fingerprintData.behavior_summary || {};
    const interactionRate = typeof behaviorSummary.interaction_rate === 'number' ? behaviorSummary.interaction_rate : 0;
    const lowInteraction = interactionRate < 0.2 && fingerprintData.time_to_interact > 3000;
    const pointerless = fingerprintData.mouse_movements_count <= 1 && fingerprintData.touch_points === 0;
    const performanceFlags = fingerprintData.performance_flags || {};
    const unrealisticTiming = Boolean(performanceFlags.unrealistic_load);
    const isDesktop = fingerprintData.device_type === 'desktop' || (!fingerprintData.device_type && (navigator.maxTouchPoints || 0) === 0);

    addSignal(fingerprintData.webdriver_detected, 0.35, 'webdriver');
    addSignal(fingerprintData.headless_detected, 0.4, 'headless_runtime');
    addSignal(fingerprintData.automation_detected && !fingerprintData.headless_detected && !fingerprintData.webdriver_detected, 0.25, 'automation_indicators');
    addSignal(performanceFlags.no_performance_sample, 0.08, 'missing_performance_api');
    addSignal(unrealisticTiming, 0.12, 'timing_anomaly');
    addSignal(lowInteraction, 0.18, 'low_interaction');
    addSignal(pointerless, 0.15, 'no_pointer_activity');
    addSignal(isDesktop && fingerprintData.plugins_count === 0, 0.1, 'desktop_no_plugins');
    addSignal(fingerprintData.tiktok_webview_detected && lowInteraction, 0.2, 'tiktok_webview_low_interaction');

    const botScore = 1 - probabilityComplement;

    return {
      bot_score: Math.min(Number(botScore.toFixed(3)), 1.0),
      is_bot: botScore >= 0.65,
      suspicion_reasons: Array.from(reasons)
    };
  }

  /**
   * ========================================================================
   * COLETAR TODOS OS DADOS
   * ========================================================================
   */
  async function collectAllFingerprints() {
    CONFIG.DEBUG && console.log('[Fingerprint] Iniciando coleta completa...');

    const browserData = parseUserAgent();

    // Coletar dados síncronos/assíncronos
    const [
      canvasData,
      webglData,
      fontsData,
      pluginsData
    ] = await Promise.all([
      getCanvasFingerprints(),
      getWebGLFingerprint(),
      getAvailableFonts(),
      getPlugins(browserData)
    ]);

    const automationData = detectAutomation();
    const tiktokData = detectTikTok();
    const performanceData = getPerformanceMetrics();
    const networkData = getNetworkInfo();
    const behaviorSummary = summarizeBehavior();
    const clickSamples = behaviorSummary.click_samples_recent || [];
    delete behaviorSummary.click_samples_recent;
    const mouseSampleCount = behaviorSummary.mouse_samples.length;
    const mouseSegmentCount = mouseSampleCount > 0 ? Math.max(mouseSampleCount - 1, 0) : 0;
    const rawMouseMovementCount = STATE.mouse_movements.length;

    const [audioData, mediaDevices, batteryInfo, webrtcIPs] = await Promise.all([
      getAudioFingerprint(),
      getMediaDevices(),
      getBatteryInfo(),
      getWebRTCIPs()
    ]);

    // Coletar parâmetros da URL
    const urlParams = new URLSearchParams(window.location.search);
    const url_parameters = {};
    urlParams.forEach((value, key) => {
      url_parameters[key] = value;
    });

    // Calcular tempos
    const fallbackPageLoad = Math.max(0, STATE.script_boot_time - STATE.start_time);
    const page_load_time = normalizeDuration(
      typeof performanceData.page_load_time === 'number'
        ? performanceData.page_load_time
        : fallbackPageLoad
    );

    const rawTimeToInteract = STATE.first_interaction_time
      ? STATE.first_interaction_time - STATE.start_time
      : CONFIG.TRACKING_DURATION + page_load_time;
    const time_to_interact = normalizeDuration(rawTimeToInteract);

    const cookieNames = getCookieNames();
    const viewportHeightRatio = screen.height ? Number((window.innerHeight / screen.height).toFixed(3)) : 1;
    const viewportNotes = viewportHeightRatio < CONFIG.VIEWPORT_HEIGHT_ALERT_RATIO
      ? 'Viewport height significantly smaller than screen height; comum quando a janela não está maximizada ou há barras de UI.'
      : null;
    const deviceMemorySupported = typeof navigator.deviceMemory === 'number' && Number.isFinite(navigator.deviceMemory);
    const deviceMemoryValue = deviceMemorySupported && navigator.deviceMemory > 0 ? navigator.deviceMemory : null;

    // Montar objeto completo
    const fingerprintData = {
      fingerprint_id: STATE.fingerprint_id,
      session_id: STATE.session_id,

      // Timing
      page_load_time,
      time_to_interact,

      // Screen
      screen_width: screen.width,
      screen_height: screen.height,
      screen_color_depth: screen.colorDepth,
      screen_pixel_ratio: window.devicePixelRatio || 1,
      available_screen_width: screen.availWidth,
      available_screen_height: screen.availHeight,
      inner_width: window.innerWidth,
      inner_height: window.innerHeight,
      outer_width: window.outerWidth,
      outer_height: window.outerHeight,
      screen_orientation: screen.orientation?.type || '',
      viewport_height_ratio: viewportHeightRatio,
      viewport_notes: viewportNotes,

      // Navigator
      user_agent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      languages: navigator.languages || [navigator.language],
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      timezone_offset: new Date().getTimezoneOffset(),
      hardware_concurrency: navigator.hardwareConcurrency || 0,
      device_memory: deviceMemoryValue,
      device_memory_supported: deviceMemorySupported,
      max_touch_points: navigator.maxTouchPoints || 0,

      // JavaScript features
      javascript_enabled: true,
      javascript_version: detectJavaScriptVersion(),
      cookies_enabled: navigator.cookieEnabled,
      do_not_track: navigator.doNotTrack === '1',

      // Storage
      local_storage_enabled: testStorage('localStorage'),
      session_storage_enabled: testStorage('sessionStorage'),
      indexed_db_enabled: !!window.indexedDB,

      // Touch
      touch_support: 'ontouchstart' in window,
      touch_points: navigator.maxTouchPoints || 0,
      max_touch_points_device: navigator.maxTouchPoints || 0,

      // Comportamento
      mouse_movements_count: mouseSampleCount,
      mouse_segments_count: mouseSegmentCount,
      mouse_clicks_count: STATE.mouse_clicks,
      mouse_scroll_count: STATE.mouse_scrolls,
      keyboard_events_count: STATE.keyboard_events,
      keyboard_layout: detectKeyboardLayout(),
      behavior_summary: behaviorSummary,
      mouse_movements_total: rawMouseMovementCount,
      click_samples: clickSamples,
      click_samples_count: behaviorSummary.click_samples_count,

      // URL parameters
      url_parameters,
      click_id: url_parameters.click_id || '',
      fbclid: url_parameters.fbclid || '',
      ttclid: url_parameters.ttclid || '',
      gclid: url_parameters.gclid || '',

      // Headers (simulados)
      referer: document.referrer,
      accept_language: navigator.language,
      accept_encoding: 'gzip, deflate, br',
      upgrade_insecure_requests: 1,

      // Cookies
      cookies: cookieNames,
      cookie_count: cookieNames.length,

      // Merge de todos os dados coletados
      ...canvasData,
      ...webglData,
      ...audioData,
      ...fontsData,
      ...pluginsData,
      ...automationData,
      ...tiktokData,
      ...browserData,
      ...performanceData,
      performance_flags: performanceData.performance_flags,
      ...networkData,
      ...mediaDevices,
      ...batteryInfo,
      ...webrtcIPs
    };

    // Calcular bot score
    const botAnalysis = calculateBotScore(fingerprintData);
    Object.assign(fingerprintData, botAnalysis);

    CONFIG.DEBUG && console.log('[Fingerprint] Coleta completa:', fingerprintData);

    return fingerprintData;
  }

  /**
   * ========================================================================
   * HELPERS
   * ========================================================================
   */
  function detectJavaScriptVersion() {
    // Testar features ES6+
    try {
      eval('const x = () => {};');
      eval('async function test() {}');
      return 'ES2017+';
    } catch (e) {
      try {
        eval('const x = () => {};');
        return 'ES2015+';
      } catch (e) {
        return 'ES5';
      }
    }
  }

  function testStorage(type) {
    try {
      const storage = window[type];
      const test = '__test__';
      storage.setItem(test, test);
      storage.removeItem(test);
      return true;
    } catch (e) {
      return false;
    }
  }

  function detectKeyboardLayout() {
    // Simplificado - baseado no idioma
    const lang = navigator.language.split('-')[0];
    const layouts = {
      'en': 'QWERTY',
      'pt': 'QWERTY',
      'fr': 'AZERTY',
      'de': 'QWERTZ',
      'ru': 'ЙЦУКЕН'
    };
    return layouts[lang] || 'QWERTY';
  }

  function getCookieNames() {
    if (!document.cookie) {
      return [];
    }
    return document.cookie
      .split(';')
      .map(c => c.trim())
      .filter(Boolean)
      .map(cookie => cookie.split('=')[0] || '');
  }

  /**
   * ========================================================================
   * ENVIAR DADOS PARA O BACKEND
   * ========================================================================
   */
  async function sendFingerprintData(fingerprintData) {
    try {
      // Obter metadados da página
      const campaign_id = window.FYCLOAK_CAMPAIGN_ID || parseInt(document.querySelector('[data-campaign-id]')?.dataset.campaignId);
      const user_id = window.FYCLOAK_USER_ID || parseInt(document.querySelector('[data-user-id]')?.dataset.userId);
      const subdomain = window.location.hostname;

      if (!campaign_id) {
        CONFIG.DEBUG && console.warn('[Fingerprint] campaign_id não encontrado');
        return;
      }

      const payload = {
        campaign_id,
        user_id,
        subdomain,
        fingerprint_id: fingerprintData.fingerprint_id,
        fingerprint_data: fingerprintData
      };

      CONFIG.DEBUG && console.log('[Fingerprint] Enviando para:', CONFIG.API_ENDPOINT);

      const response = await fetch(CONFIG.API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      CONFIG.DEBUG && console.log('[Fingerprint] Resposta do servidor:', result);

      const storageMessage = result.storage_message
        ? String(result.storage_message)
        : (result.saved_to_clickhouse || result.saved_to_postgres)
          ? 'Fingerprint salvo em pelo menos um banco.'
          : 'Fingerprint não salvo em nenhum banco.';

      const fingerprintStatus = {
        success: Boolean(result.success),
        storage_status: result.storage_status || (result.saved_to_clickhouse || result.saved_to_postgres ? 'partial' : 'not_saved'),
        storage_details: result.storage_details || {},
        storage_message: storageMessage,
        fingerprint_id: result.fingerprint_id || fingerprintData.fingerprint_id
      };

      if (typeof window !== 'undefined') {
        window.FYCLOAK_LAST_FINGERPRINT_STATUS = fingerprintStatus;
        if (typeof window.CustomEvent === 'function') {
          window.dispatchEvent(new CustomEvent('fycloak:fingerprint-status', { detail: fingerprintStatus }));
        }
      }

      CONFIG.DEBUG && console.log('[Fingerprint] Status de armazenamento:', fingerprintStatus);

    } catch (error) {
      console.error('[Fingerprint] Erro ao enviar dados:', error);
    }
  }

  /**
   * ========================================================================
   * INICIALIZAÇÃO
   * ========================================================================
   */
  async function init() {
    CONFIG.DEBUG && console.log('[Fingerprint] Iniciando bot detection avançado v1.0.0');

    // Configurar tracking de comportamento
    setupBehaviorTracking();

    // Aguardar um tempo para coletar interações do usuário
    await new Promise(resolve => setTimeout(resolve, CONFIG.TRACKING_DURATION));

    // Coletar todos os fingerprints
    const fingerprintData = await collectAllFingerprints();

    // Enviar para o backend
    await sendFingerprintData(fingerprintData);

    CONFIG.DEBUG && console.log('[Fingerprint] Processo completo!');
  }

  // Iniciar quando a página carregar
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expor globalmente para debug
  if (CONFIG.DEBUG) {
    window.FYCLOAK_BOT_DETECTION = {
      collectAllFingerprints,
      STATE
    };
  }

})();
