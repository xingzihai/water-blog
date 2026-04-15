/*
 * WebGL Water - 页面边界水池
 * 使用完整渲染器，立方体边界=页面边界，只渲染水面
 */

function handleError(text) {
  console.error('Water error:', text);
  var control = document.querySelector('.water-control');
  if (control) control.style.display = 'none';
}

window.onerror = handleError;

var gl = GL.create();
var water;
var cubemap;
var renderer;

// 相机角度 - 俯视水面
var angleX = -89;  // 几乎完全俯视
var angleY = 0;

var waterDepth = 0.5;
var rippleStrength = 0.01;
var waterEnabled = true;

window.onload = function() {
  var ratio = Math.min(window.devicePixelRatio || 1, 2);
  
  function onresize() {
    var width = window.innerWidth;
    var height = window.innerHeight;
    gl.canvas.width = width * ratio;
    gl.canvas.height = height * ratio;
    gl.canvas.style.width = width + 'px';
    gl.canvas.style.height = height + 'px';
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.matrixMode(gl.PROJECTION);
    gl.loadIdentity();
    // 调整 FOV 让立方体填满视口
    gl.perspective(60, gl.canvas.width / gl.canvas.height, 0.01, 100);
    gl.matrixMode(gl.MODELVIEW);
    draw();
  }
  
  // Canvas 样式
  gl.canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:-1;pointer-events:none;opacity:0.75';
  document.body.insertBefore(gl.canvas, document.body.firstChild);
  
  gl.clearColor(0, 0, 0, 1);
  
  water = new Water();
  renderer = new Renderer();
  cubemap = new Cubemap({
    xneg: document.getElementById('xneg'),
    xpos: document.getElementById('xpos'),
    yneg: document.getElementById('ypos'),
    ypos: document.getElementById('ypos'),
    zneg: document.getElementById('zneg'),
    zpos: document.getElementById('zpos')
  });
  
  if (!water.textureA.canDrawTo() || !water.textureB.canDrawTo()) {
    throw new Error('Floating-point textures not supported');
  }
  
  // 初始涟漪
  for (var i = 0; i < 25; i++) {
    water.addDrop(Math.random() * 2 - 1, Math.random() * 2 - 1, 0.03, (i & 1) ? rippleStrength : -rippleStrength);
  }
  
  onresize();
  
  var requestAnimationFrame = window.requestAnimationFrame || window.webkitRequestAnimationFrame;
  var prevTime = Date.now();
  
  function animate() {
    var nextTime = Date.now();
    if (waterEnabled) {
      update((nextTime - prevTime) / 1000);
      draw();
    }
    prevTime = nextTime;
    requestAnimationFrame(animate);
  }
  requestAnimationFrame(animate);
  
  window.onresize = onresize;
  
  // 定期涟漪
  setInterval(function() {
    if (waterEnabled) {
      water.addDrop(Math.random() * 2 - 1, Math.random() * 2 - 1, 0.03, rippleStrength);
    }
  }, 2000);
  
  // 鼠标交互产生涟漪
  document.addEventListener('mousemove', function(e) {
    if (waterEnabled) {
      var x = (e.clientX / window.innerWidth) * 2 - 1;
      var y = -(e.clientY / window.innerHeight) * 2 + 1;
      water.addDrop(x, y, 0.02, rippleStrength * 0.5);
    }
  });
  
  document.addEventListener('click', function(e) {
    if (waterEnabled) {
      var x = (e.clientX / window.innerWidth) * 2 - 1;
      var y = -(e.clientY / window.innerHeight) * 2 + 1;
      water.addDrop(x, y, 0.04, rippleStrength);
    }
  });
  
  bindControls();
  console.log('Water pool initialized');
};

function update(seconds) {
  if (seconds > 1) return;
  water.stepSimulation();
  water.stepSimulation();
  water.updateNormals();
  renderer.updateCaustics(water);
}

function draw() {
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.loadIdentity();
  
  // 相机位置 - 从上方俯视，距离根据水层深度调整
  gl.translate(0, -waterDepth, -2.5);
  gl.rotate(-angleX, 1, 0, 0);
  gl.rotate(-angleY, 0, 1, 0);
  
  gl.enable(gl.DEPTH_TEST);
  
  // 设置球体位置（但不渲染）
  renderer.sphereCenter = new GL.Vector(0, 10, 0);  // 移到远处不可见
  renderer.sphereRadius = 0.01;  // 极小
  
  // 渲染水面（使用页面边界作为立方体边界）
  renderer.renderWater(water, cubemap);
  
  gl.disable(gl.DEPTH_TEST);
}

function bindControls() {
  var depthSlider = document.getElementById('water-depth');
  var depthValue = document.getElementById('depth-value');
  if (depthSlider) {
    depthSlider.addEventListener('input', function() {
      waterDepth = parseFloat(this.value);
      depthValue.textContent = waterDepth.toFixed(1);
    });
  }
  
  var rippleSlider = document.getElementById('ripple-strength');
  var rippleValue = document.getElementById('ripple-value');
  if (rippleSlider) {
    rippleSlider.addEventListener('input', function() {
      rippleStrength = parseFloat(this.value);
      rippleValue.textContent = rippleStrength.toFixed(3);
    });
  }
  
  var opacitySlider = document.getElementById('water-opacity');
  var opacityValue = document.getElementById('opacity-value');
  if (opacitySlider) {
    opacitySlider.addEventListener('input', function() {
      var op = parseFloat(this.value);
      opacityValue.textContent = Math.round(op * 100) + '%';
      gl.canvas.style.opacity = op;
    });
  }
  
  var toggleBtn = document.getElementById('toggle-water');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', function() {
      waterEnabled = !waterEnabled;
      this.textContent = waterEnabled ? '关闭水效果' : '开启水效果';
      gl.canvas.style.opacity = waterEnabled ? '0.75' : '0';
    });
  }
}