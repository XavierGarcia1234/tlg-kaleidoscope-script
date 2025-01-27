document.addEventListener("DOMContentLoaded", function () {
  const vertex = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

  const fragment = `
precision mediump float;
uniform sampler2D uTexture;
uniform vec4 resolution;
uniform float uOpacity;
varying vec2 vUv;
const float PI = 3.14159265359;
uniform float segments;
uniform vec2 uOffset;
uniform float uRotation;
uniform float uOffsetAmount;
uniform float uRotationAmount;
uniform float uScaleFactor;
uniform float uImageAspect;

vec2 adjustUV(vec2 uv, vec2 offset, float rotation) {
  vec2 uvOffset = uv + offset * uOffsetAmount;
  float cosRot = cos(rotation * uRotationAmount);
  float sinRot = sin(rotation * uRotationAmount);
  mat2 rotMat = mat2(cosRot, -sinRot, sinRot, cosRot);
  return rotMat * (uvOffset - vec2(0.5)) + vec2(0.5);
}

void main() {
  vec2 newUV = (vUv - vec2(0.5)) * resolution.zw + vec2(0.5);
  vec2 uv = newUV * 2.0 - 1.0;
  float angle = atan(uv.y, uv.x);
  float radius = length(uv);
  float segment = PI * 2.0 / segments;
  angle = mod(angle, segment);
  angle = segment - abs(segment / 2.0 - angle);
  uv = radius * vec2(cos(angle), sin(angle));
  float scale = 1.0 / uScaleFactor;
  vec2 adjustedUV = adjustUV(uv * scale + scale, uOffset, uRotation);
  vec2 aspectCorrectedUV = vec2(adjustedUV.x, adjustedUV.y * uImageAspect);
  vec2 tileIndex = floor(aspectCorrectedUV);
  vec2 oddTile = mod(tileIndex, 2.0);
  vec2 mirroredUV = mix(fract(aspectCorrectedUV), 1.0 - fract(aspectCorrectedUV), oddTile);
  vec4 color = texture2D(uTexture, mirroredUV);
  color.a *= uOpacity;
  gl_FragColor = color;
}`;

  class Sketch {
    constructor(options) {
      this.container = options.dom;
      this.container.style.position = "relative";

      // Attributes
      this.scaleFactor = parseFloat(this.container.getAttribute("tlg-kaleidoscope-scale")) || 1;
      this.motionFactor = parseFloat(this.container.getAttribute("tlg-kaleidoscope-motion")) || 1;
      this.mode = this.container.getAttribute("tlg-kaleidoscope-mode") || "static";

      this.width = this.container.offsetWidth;
      this.height = this.container.offsetHeight;

      this.renderer = new THREE.WebGLRenderer({ alpha: true }); // Transparency enabled
      this.renderer.setPixelRatio(window.devicePixelRatio);
      this.renderer.setSize(this.width, this.height);
      this.renderer.setClearColor(0x000000, 0); // Transparent background
      this.container.appendChild(this.renderer.domElement);

      const frustumSize = 1;
      this.camera = new THREE.OrthographicCamera(
        frustumSize / -2,
        frustumSize / 2,
        frustumSize / 2,
        frustumSize / -2,
        -1000,
        1000
      );
      this.camera.position.set(0, 0, 2);

      this.scene = new THREE.Scene();

      this.mouse = { x: 0, y: 0 };
      this.isPlaying = true;

      this.lastTime = performance.now();

      this.addObjects();
      this.resize();
      this.setupResize();
      this.render();

      if (this.mode === "mouse") this.mouseEvents();
      if (this.mode === "scroll") this.setupScroll();
    }

    setupScroll() {
      window.addEventListener("scroll", this.handleScroll.bind(this));
    }

    handleScroll() {
      const rect = this.container.getBoundingClientRect();
      const elemTop = rect.top;
      const elemBottom = rect.bottom;

      const isInViewport = elemTop < window.innerHeight && elemBottom >= 0;
      if (isInViewport) {
        const progress = (window.innerHeight - elemTop) / (window.innerHeight + this.container.offsetHeight);
        this.material.uniforms.uRotation.value = progress * Math.PI * 2 * this.motionFactor;
      }
    }

    mouseEvents() {
      this.container.addEventListener("mousemove", (e) => {
        const rect = this.container.getBoundingClientRect();
        this.mouse.x = ((e.clientX - rect.left) / this.width - 0.5) * 2;
        this.mouse.y = ((e.clientY - rect.top) / this.height - 0.5) * 2;
      });
    }

    setupResize() {
      window.addEventListener("resize", this.resize.bind(this));
    }

    resize() {
      this.width = this.container.offsetWidth;
      this.height = this.container.offsetHeight;

      this.renderer.setSize(this.width, this.height);
      this.camera.aspect = this.width / this.height;
      this.camera.updateProjectionMatrix();
    }

    addObjects() {
      const texture = new THREE.TextureLoader().load(
        this.container.querySelector("[tlg-kaleidoscope-image]").src
      );
      texture.minFilter = THREE.LinearFilter;

      this.material = new THREE.ShaderMaterial({
        vertexShader: vertex,
        fragmentShader: fragment,
        transparent: true, // Enables transparency
        uniforms: {
          uTexture: { value: texture },
          resolution: { value: new THREE.Vector4() },
          uOpacity: { value: 1 },
          uOffset: { value: new THREE.Vector2(0, 0) },
          uRotation: { value: 0 },
          segments: { value: parseInt(this.container.getAttribute("tlg-kaleidoscope-segments")) || 6 },
          uScaleFactor: { value: this.scaleFactor },
          uImageAspect: { value: 1 },
        },
      });

      const geometry = new THREE.PlaneGeometry(1, 1, 1, 1);
      const mesh = new THREE.Mesh(geometry, this.material);
      this.scene.add(mesh);
    }

    render(time = 0) {
      if (!this.isPlaying) return;

      if (this.mode === "mouse") {
        this.material.uniforms.uOffset.value.set(this.mouse.x * this.motionFactor, this.mouse.y * this.motionFactor);
      } else if (this.mode === "loop") {
        const delta = (time - this.lastTime) / 1000;
        this.material.uniforms.uRotation.value += delta * this.motionFactor;
        this.lastTime = time;
      }

      this.renderer.render(this.scene, this.camera);
      requestAnimationFrame(this.render.bind(this));
    }
  }

  document.querySelectorAll("[tlg-kaleidoscope-canvas]").forEach((container) => {
    new Sketch({ dom: container });
  });
});
