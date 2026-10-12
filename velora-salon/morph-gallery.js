/* Morph Gallery — dependency-free port of components/ui/morph-gallery.tsx.
 * Slides dissolve through fbm noise in a single WebGL pass. Falls back to a
 * DOM opacity cross-fade when WebGL is unavailable or a texture fails.
 * Exposes window.MorphGallery.create(root, options). */
(() => {
  const VERT = `
attribute vec2 a_position;
varying vec2 v_uv;
void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

  const FRAG = `
precision highp float;

uniform sampler2D u_from;
uniform sampler2D u_to;
uniform float u_progress;
uniform vec2 u_resolution;
uniform float u_fromAspect;
uniform float u_toAspect;
uniform float u_scale;
uniform float u_direction;
uniform float u_edge;
uniform float u_drift;

varying vec2 v_uv;

vec3 permute(vec3 x) {
  return mod(((x * 34.0) + 1.0) * x, 289.0);
}

float snoise(vec2 v) {
  const vec4 C = vec4(
    0.211324865405187,
    0.366025403784439,
   -0.577350269189626,
    0.024390243902439
  );
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute(
    permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0)
  );
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m;
  m = m * m;
  vec3 x  = 2.0 * fract(p * C.www) - 1.0;
  vec3 h  = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

float fbm(vec2 v) {
  float value = 0.0;
  float amplitude = 0.5;
  for (int i = 0; i < 5; i++) {
    value += amplitude * snoise(v);
    v *= 2.0;
    amplitude *= 0.5;
  }
  return value;
}

vec2 mirror(vec2 uv) {
  return 1.0 - abs(1.0 - mod(uv, 2.0));
}

vec2 coverUV(vec2 uv, float imgAspect) {
  float canvasAspect = u_resolution.x / u_resolution.y;
  vec2 scale = (canvasAspect > imgAspect)
    ? vec2(1.0, imgAspect / canvasAspect)
    : vec2(canvasAspect / imgAspect, 1.0);
  return mirror((uv - 0.5) * scale + 0.5);
}

void main() {
  float adjusted = u_progress * (1.0 + 2.0 * u_edge) - u_edge;

  float noise = fbm(v_uv * u_scale + vec2(0.0, u_progress * u_direction)) * 0.5 + 0.5;
  noise = smoothstep(
    0.0,
    2.0,
    length(texture2D(u_to, coverUV(v_uv, u_toAspect)).rgb) + noise
  );

  float mixFactor = 1.0 - smoothstep(adjusted - u_edge, adjusted + u_edge, noise);

  vec2 fromUV = coverUV(
    v_uv + vec2(0.0, noise * u_progress * u_drift * u_direction),
    u_fromAspect
  );
  vec2 toUV = coverUV(
    v_uv + vec2(0.0, noise * (1.0 - u_progress) * -0.5 * u_drift * u_direction),
    u_toAspect
  );

  gl_FragColor = mix(texture2D(u_from, fromUV), texture2D(u_to, toUV), mixFactor);
}
`;

  const wrapIndex = (i, n, loop) => {
    if (n <= 0) return 0;
    return loop ? ((i % n) + n) % n : Math.min(Math.max(i, 0), n - 1);
  };

  const easeInOutQuint = (t) => {
    const x = Math.min(Math.max(t, 0), 1);
    return x < 0.5 ? 16 * x ** 5 : 1 - (-2 * x + 2) ** 5 / 2;
  };

  const compile = (gl, type, src) => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error("shader compile failed: " + log);
    }
    return shader;
  };

  const link = (gl) => {
    const vert = compile(gl, gl.VERTEX_SHADER, VERT);
    const frag = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    const program = gl.createProgram();
    gl.attachShader(program, vert);
    gl.attachShader(program, frag);
    gl.linkProgram(program);
    gl.deleteShader(vert);
    gl.deleteShader(frag);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(program);
      gl.deleteProgram(program);
      throw new Error("program link failed: " + log);
    }
    return program;
  };

  /**
   * items: [{ source: HTMLImageElement | HTMLCanvasElement, alt, thumb? }]
   * Images must be same-origin or CORS-enabled to be uploaded to WebGL.
   */
  const create = (root, items, opts = {}) => {
    const cfg = {
      duration: 1500,
      noiseScale: 3.5,
      edge: 0.15,
      drift: 0.5,
      loop: true,
      autoplay: 0,
      defaultIndex: 0,
      onChange: null,
      ...opts,
    };
    const n = items.length;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let active = wrapIndex(cfg.defaultIndex, n, cfg.loop);
    let paused = false;
    let timer = 0;

    const canvas = root.querySelector("canvas");
    const fallback = root.querySelector(".morph-fallback");

    // ---- WebGL ---------------------------------------------------------------
    let gl = null;
    let program = null;
    let buffer = null;
    const textures = items.map(() => null);
    const aspects = items.map(() => 1);
    let uniforms = {};
    let raf = 0;
    let from = active;
    let to = active;
    let progress = 1;
    let startedAt = 0;
    let direction = 1;
    let request = null;
    let previous = active;

    const showFallback = () => {
      if (canvas) canvas.hidden = true;
      if (!fallback) return;
      fallback.hidden = false;
      fallback.innerHTML = "";
      items.forEach((item, i) => {
        const img = document.createElement("img");
        img.src = item.src || item.source.toDataURL();
        img.alt = item.alt || "";
        img.className = "morph-fallback-img";
        img.style.opacity = i === active ? "1" : "0";
        fallback.appendChild(img);
      });
      root.classList.add("is-fallback");
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.round(canvas.clientWidth * dpr);
      const h = Math.round(canvas.clientHeight * dpr);
      if (!w || !h || (canvas.width === w && canvas.height === h)) return;
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    };

    const pick = (i) => textures[i] || textures.find(Boolean) || null;

    const draw = () => {
      const pending = request;
      if (pending) {
        request = null;
        from = pending.from;
        to = pending.to;
        progress = 0;
        startedAt = performance.now();
        // The shortest way round, so a wrap drifts forward like any other step.
        const forward = cfg.loop
          ? ((pending.to - pending.from + n) % n) * 2 <= n
          : pending.to > pending.from;
        direction = forward ? 1 : -1;
      }

      if (progress < 1) {
        const span = reduced ? 0 : Math.max(cfg.duration, 1);
        const elapsed = performance.now() - startedAt;
        progress = span === 0 ? 1 : easeInOutQuint(Math.min(elapsed / span, 1));
      }

      const fromTex = pick(from);
      const toTex = pick(to);
      if (!fromTex || !toTex) return;

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, fromTex);
      gl.uniform1i(uniforms.from, 0);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, toTex);
      gl.uniform1i(uniforms.to, 1);

      gl.uniform1f(uniforms.progress, progress);
      gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);
      gl.uniform1f(uniforms.fromAspect, aspects[from] || 1);
      gl.uniform1f(uniforms.toAspect, aspects[to] || 1);
      gl.uniform1f(uniforms.scale, cfg.noiseScale);
      gl.uniform1f(uniforms.direction, direction);
      gl.uniform1f(uniforms.edge, Math.max(cfg.edge, 0.001));
      gl.uniform1f(uniforms.drift, cfg.drift);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };

    const frame = () => {
      if (!document.hidden) draw();
      raf = requestAnimationFrame(frame);
    };

    const initWebGL = () => {
      gl = canvas.getContext("webgl", { alpha: false, antialias: false });
      if (!gl) return false;

      program = link(gl);
      gl.useProgram(program);

      buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(program, "a_position");
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

      ["from", "to", "progress", "resolution", "fromAspect", "toAspect", "scale", "direction", "edge", "drift"]
        .forEach((name) => { uniforms[name] = gl.getUniformLocation(program, "u_" + name); });

      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

      // Upload each texture as it becomes available; the loop starts on the first one.
      let running = false;
      items.forEach((item, i) => {
        try {
          const tex = gl.createTexture();
          gl.bindTexture(gl.TEXTURE_2D, tex);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, item.source);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
          textures[i] = tex;
          aspects[i] = item.source.width / Math.max(item.source.height, 1);
          if (!running) {
            running = true;
            resize();
            canvas.classList.add("is-ready");
            raf = requestAnimationFrame(frame);
          }
        } catch (err) {
          // A tainted or undecodable source costs one slide, not the gallery.
          console.warn("morph: texture " + i + " skipped", err);
        }
      });
      return running;
    };

    const go = (next) => {
      const wrapped = wrapIndex(next, n, cfg.loop);
      if (wrapped === active) return;
      previous = active;
      active = wrapped;
      if (gl && textures.some(Boolean)) request = { from: previous, to: active };
      update();
      if (cfg.onChange) cfg.onChange(active);
      if (fallback && root.classList.contains("is-fallback")) {
        [...fallback.children].forEach((img, i) => { img.style.opacity = i === active ? "1" : "0"; });
      }
    };

    // Autoplay: pauses while hovered, focused, or when the tab is hidden.
    const restartTimer = () => {
      clearInterval(timer);
      if (!cfg.autoplay || reduced || paused || n < 2) return;
      timer = setInterval(() => go(active + 1), Math.max(cfg.autoplay, 600));
    };

    const update = () => {
      root.dispatchEvent(new CustomEvent("morphchange", { detail: { index: active } }));
      restartTimer();
    };

    // ---- start ------------------------------------------------------------------
    try {
      if (!initWebGL()) throw new Error("no webgl");
      const onLost = (e) => { e.preventDefault(); cancelAnimationFrame(raf); };
      canvas.addEventListener("webglcontextlost", onLost);
      new ResizeObserver(() => { if (gl) resize(); }).observe(canvas);
    } catch (err) {
      console.warn("morph: falling back to cross-fade", err);
      showFallback();
    }

    root.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft") { e.preventDefault(); go(active + 1); }
      if (e.key === "ArrowRight") { e.preventDefault(); go(active - 1); }
    });
    root.addEventListener("mouseenter", () => { paused = true; restartTimer(); });
    root.addEventListener("mouseleave", () => { paused = false; restartTimer(); });
    root.addEventListener("focusin", () => { paused = true; restartTimer(); });
    root.addEventListener("focusout", () => { paused = false; restartTimer(); });
    document.addEventListener("visibilitychange", () => {
      paused = document.hidden;
      restartTimer();
    });

    let swipeX = null;
    root.addEventListener("pointerdown", (e) => { swipeX = e.clientX; });
    root.addEventListener("pointerup", (e) => {
      if (swipeX === null) return;
      const dx = e.clientX - swipeX;
      swipeX = null;
      if (Math.abs(dx) > 48) go(active + (dx < 0 ? 1 : -1));
    });

    update();
    return { go, get index() { return active; } };
  };

  window.MorphGallery = { create, wrapIndex, easeInOutQuint };
})();
