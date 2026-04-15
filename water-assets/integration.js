/*
 * Water Effect Integration for Personal Website
 * Based on WebGL Water by Evan Wallace
 * Modified for background use with custom depth control
 */

// 全局变量
var gl;
var water;
var cubemap;
var renderer;
var angleX = -25;
var angleY = -200.5;

// 水层深度（可通过控制面板调整）
var waterDepth = 0.2;
var rippleStrength = 0.01;
var waterOpacity = 0.7;
var waterEnabled = true;

// 球体物理
var center;
var oldCenter;
var velocity;
var gravity;
var radius = 0.25;
var paused = false;

// 初始化水效果
function initWaterEffect() {
  try {
    gl = GL.create();
    
    // 使用指定的 canvas
    var targetCanvas = document.getElementById('water-canvas');
    if (targetCanvas) {
      // 将 GL 的 canvas 内容渲染到目标 canvas
    }
    
    var ratio = window.devicePixelRatio || 1;
    
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
      gl.perspective(45, gl.canvas.width / gl.canvas.height, 0.01, 100);
      gl.matrixMode(gl.MODELVIEW);
      draw();
    }
    
    document.body.appendChild(gl.canvas);
    gl.canvas.style.position = 'fixed';
    gl.canvas.style.top = '0';
    gl.canvas.style.left = '0';
    gl.canvas.style.zIndex = '0';
    gl.canvas.style.pointerEvents = 'none';
    
    gl.clearColor(0.02, 0.04, 0.08, waterOpacity);
    
    water = new Water();
    renderer = new Renderer();
    
    // 使用隐藏的图片资源
    cubemap = new Cubemap({
      xneg: document.getElementById('xneg'),
      xpos: document.getElementById('xpos'),
      yneg: document.getElementById('ypos'),
      ypos: document.getElementById('ypos'),
      zneg: document.getElementById('zneg'),
      zpos: document.getElementById('zpos')
    });
    
    if (!water.textureA.canDrawTo() || !water.textureB.canDrawTo()) {
      console.log('Floating-point textures not fully supported, using fallback');
    }
    
    // 使用自定义深度初始化球体位置
    center = oldCenter = new GL.Vector(-0.4, waterDepth - 1, 0.2);
    velocity = new GL.Vector();
    gravity = new GL.Vector(0, -4, 0);
    
    // 初始涟漪
    for (var i = 0; i < 25; i++) {
      water.addDrop(Math.random() * 2 - 1, Math.random() * 2 - 1, 0.03, (i & 1) ? rippleStrength : -rippleStrength);
    }
    
    onresize();
    
    // 动画循环
    var requestAnimationFrame = window.requestAnimationFrame || window.webkitRequestAnimationFrame || function(callback) { setTimeout(callback, 0); };
    var prevTime = new Date().getTime();
    
    function animate() {
      if (waterEnabled) {
        var nextTime = new Date().getTime();
        if (!paused) {
          update((nextTime - prevTime) / 1000);
          draw();
        }
        prevTime = nextTime;
      }
      requestAnimationFrame(animate);
    }
    requestAnimationFrame(animate);
    
    window.onresize = onresize;
    
    // 绑定控制面板事件
    bindControls();
    
    // 定期添加随机涟漪保持水面活跃
    setInterval(function() {
      if (waterEnabled && !paused) {
        water.addDrop(Math.random() * 2 - 1, Math.random() * 2 - 1, 0.03, rippleStrength);
      }
    }, 2000);
    
    console.log('Water effect initialized successfully');
    
  } catch (e) {
    console.error('Water effect failed:', e.message);
    // 隐藏控制面板
    var control = document.querySelector('.water-control');
    if (control) control.style.display = 'none';
  }
}

function bindControls() {
  // 水层深度控制
  var depthSlider = document.getElementById('water-depth');
  var depthValue = document.getElementById('depth-value');
  if (depthSlider) {
    depthSlider.addEventListener('input', function() {
      waterDepth = parseFloat(this.value);
      depthValue.textContent = waterDepth.toFixed(1);
      // 更新球体位置（球体 y 值影响水面交互）
      center.y = waterDepth - 1;
      oldCenter.y = waterDepth - 1;
    });
  }
  
  // 涟漪强度控制
  var rippleSlider = document.getElementById('ripple-strength');
  var rippleValue = document.getElementById('ripple-value');
  if (rippleSlider) {
    rippleSlider.addEventListener('input', function() {
      rippleStrength = parseFloat(this.value);
      rippleValue.textContent = rippleStrength.toFixed(3);
    });
  }
  
  // 透明度控制
  var opacitySlider = document.getElementById('water-opacity');
  var opacityValue = document.getElementById('opacity-value');
  if (opacitySlider) {
    opacitySlider.addEventListener('input', function() {
      waterOpacity = parseFloat(this.value);
      opacityValue.textContent = Math.round(waterOpacity * 100) + '%';
      gl.clearColor(0.02, 0.04, 0.08, waterOpacity);
    });
  }
  
  // 开关按钮
  var toggleBtn = document.getElementById('toggle-water');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', function() {
      waterEnabled = !waterEnabled;
      this.textContent = waterEnabled ? '关闭水效果' : '开启水效果';
      gl.canvas.style.opacity = waterEnabled ? waterOpacity : 0;
    });
  }
}

function update(seconds) {
  if (seconds > 1) return;
  
  // 球体在水中的物理模拟
  if (true) { // 始终启用物理模拟
    var percentUnderWater = Math.max(0, Math.min(1, (radius - center.y) / (2 * radius)));
    velocity = velocity.add(gravity.multiply(seconds - 1.1 * seconds * percentUnderWater));
    velocity = velocity.subtract(velocity.unit().multiply(percentUnderWater * seconds * velocity.dot(velocity)));
    center = center.add(velocity.multiply(seconds));
    
    // 保持在水层深度范围内
    if (center.y < waterDepth - 1) {
      center.y = waterDepth - 1;
      velocity.y = Math.abs(velocity.y) * 0.5;
    }
    if (center.y > 2) {
      center.y = 2;
      velocity.y = -Math.abs(velocity.y) * 0.5;
    }
  }
  
  water.moveSphere(oldCenter, center, radius);
  oldCenter = center;
  
  water.stepSimulation();
  water.stepSimulation();
  water.updateNormals();
  renderer.updateCaustics(water);
}

function draw() {
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.loadIdentity();
  gl.translate(0, 0, -5); // 更远的视角，适合背景
  gl.rotate(-angleX, 1, 0, 0);
  gl.rotate(-angleY, 0, 1, 0);
  gl.translate(0, 0.3, 0); // 稍微上移
  
  gl.enable(gl.DEPTH_TEST);
  renderer.sphereCenter = center;
  renderer.sphereRadius = radius;
  renderer.renderCube();
  renderer.renderWater(water, cubemap);
  renderer.renderSphere();
  gl.disable(gl.DEPTH_TEST);
}

// 页面加载完成后初始化
window.addEventListener('load', function() {
  // 等待图片资源加载
  setTimeout(initWaterEffect, 500);
});