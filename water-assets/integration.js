/*
 * 简单水波涟漪背景效果
 * 不依赖复杂的 WebGL 库，纯原生实现
 */

var rippleCanvas, rippleGL;
var rippleProgram;
var rippleTexture;
var rippleData;
var rippleEnabled = true;
var rippleStrength = 0.02;
var rippleOpacity = 0.6;

var RIPPLE_SIZE = 128;

function initRipple() {
  // 创建 Canvas
  rippleCanvas = document.createElement('canvas');
  rippleCanvas.id = 'ripple-bg';
  rippleCanvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:-1;pointer-events:none;';
  document.body.insertBefore(rippleCanvas, document.body.firstChild);
  
  // 调整大小
  resizeRipple();
  window.addEventListener('resize', resizeRipple);
  
  // 初始化 WebGL
  try {
    rippleGL = rippleCanvas.getContext('webgl') || rippleCanvas.getContext('experimental-webgl');
    if (!rippleGL) {
      console.log('WebGL not supported, using CSS fallback');
      cssRippleFallback();
      return;
    }
    
    // 创建涟漪数据纹理
    rippleData = new Float32Array(RIPPLE_SIZE * RIPPLE_SIZE * 4);
    for (var i = 0; i < rippleData.length; i += 4) {
      rippleData[i] = 0;     // 高度
      rippleData[i+1] = 0;   // 速度
      rippleData[i+2] = 0;   // 未使用
      rippleData[i+3] = 1;   // 常量
    }
    
    rippleTexture = rippleGL.createTexture();
    rippleGL.bindTexture(rippleGL.TEXTURE_2D, rippleTexture);
    rippleGL.texImage2D(rippleGL.TEXTURE_2D, 0, rippleGL.RGBA, RIPPLE_SIZE, RIPPLE_SIZE, 0, rippleGL.RGBA, rippleGL.FLOAT, rippleData);
    rippleGL.texParameteri(rippleGL.TEXTURE_2D, rippleGL.TEXTURE_MIN_FILTER, rippleGL.LINEAR);
    rippleGL.texParameteri(rippleGL.TEXTURE_2D, rippleGL.TEXTURE_MAG_FILTER, rippleGL.LINEAR);
    rippleGL.texParameteri(rippleGL.TEXTURE_2D, rippleGL.TEXTURE_WRAP_S, rippleGL.REPEAT);
    rippleGL.texParameteri(rippleGL.TEXTURE_2D, rippleGL.TEXTURE_WRAP_T, rippleGL.REPEAT);
    
    // 简单的显示 shader
    var vs = 'attribute vec2 aPos; varying vec2 vUv; void main() { vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0, 1); }';
    var fs = 'precision lowp float; uniform sampler2D uRipple; uniform float uOpacity; varying vec2 vUv; void main() { float h = texture2D(uRipple, vUv).r; vec3 base = vec3(0.04, 0.07, 0.11); vec3 ripple = vec3(0.08, 0.12, 0.16) * abs(h); gl_FragColor = vec4(base + ripple, uOpacity); }';
    
    var vsObj = rippleGL.createShader(rippleGL.VERTEX_SHADER);
    rippleGL.shaderSource(vsObj, vs);
    rippleGL.compileShader(vsObj);
    
    var fsObj = rippleGL.createShader(rippleGL.FRAGMENT_SHADER);
    rippleGL.shaderSource(fsObj, fs);
    rippleGL.compileShader(fsObj);
    
    rippleProgram = rippleGL.createProgram();
    rippleGL.attachShader(rippleProgram, vsObj);
    rippleGL.attachShader(rippleProgram, fsObj);
    rippleGL.linkProgram(rippleProgram);
    rippleGL.useProgram(rippleProgram);
    
    // 创建顶点缓冲
    var buf = rippleGL.createBuffer();
    rippleGL.bindBuffer(rippleGL.ARRAY_BUFFER, buf);
    rippleGL.bufferData(rippleGL.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,1,1]), rippleGL.STATIC_DRAW);
    
    var aPos = rippleGL.getAttribLocation(rippleProgram, 'aPos');
    rippleGL.enableVertexAttribArray(aPos);
    rippleGL.vertexAttribPointer(aPos, 2, rippleGL.FLOAT, false, 0, 0);
    
    // 设置 uniform
    rippleGL.uniform1i(rippleGL.getUniformLocation(rippleProgram, 'uRipple'), 0);
    rippleGL.uniform1f(rippleGL.getUniformLocation(rippleProgram, 'uOpacity'), rippleOpacity);
    
    // 动画循环
    animateRipple();
    
    // 定期添加涟漪
    setInterval(function() {
      if (rippleEnabled) addRipple(Math.random(), Math.random(), rippleStrength);
    }, 3000);
    
    // 鼠标交互
    document.addEventListener('click', function(e) {
      if (rippleEnabled) {
        var x = e.clientX / window.innerWidth;
        var y = 1 - e.clientY / window.innerHeight;
        addRipple(x, y, rippleStrength * 2);
      }
    });
    
    document.addEventListener('mousemove', function(e) {
      if (rippleEnabled) {
        var x = e.clientX / window.innerWidth;
        var y = 1 - e.clientY / window.innerHeight;
        addRipple(x, y, rippleStrength * 0.3);
      }
    });
    
    bindRippleControls();
    console.log('Ripple background initialized');
    
  } catch (e) {
    console.log('WebGL ripple failed:', e);
    cssRippleFallback();
  }
}

function resizeRipple() {
  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  rippleCanvas.width = window.innerWidth * dpr;
  rippleCanvas.height = window.innerHeight * dpr;
  rippleCanvas.style.opacity = rippleOpacity;
  if (rippleGL) {
    rippleGL.viewport(0, 0, rippleCanvas.width, rippleCanvas.height);
  }
}

function addRipple(x, y, strength) {
  // 在纹理上添加涟漪
  var px = Math.floor(x * RIPPLE_SIZE);
  var py = Math.floor(y * RIPPLE_SIZE);
  
  // 添加高度扰动
  for (var dy = -2; dy <= 2; dy++) {
    for (var dx = -2; dx <= 2; dx++) {
      var idx = ((py + dy) * RIPPLE_SIZE + (px + dx)) * 4;
      if (idx >= 0 && idx < rippleData.length) {
        var dist = Math.sqrt(dx*dx + dy*dy);
        rippleData[idx] += strength * (1 - dist/3);
      }
    }
  }
  
  // 更新纹理
  rippleGL.bindTexture(rippleGL.TEXTURE_2D, rippleTexture);
  rippleGL.texSubImage2D(rippleGL.TEXTURE_2D, 0, 0, 0, RIPPLE_SIZE, RIPPLE_SIZE, rippleGL.RGBA, rippleGL.FLOAT, rippleData);
}

function animateRipple() {
  if (rippleEnabled) {
    // 模拟涟漪传播（简化版）
    var newData = new Float32Array(rippleData.length);
    for (var y = 1; y < RIPPLE_SIZE - 1; y++) {
      for (var x = 1; x < RIPPLE_SIZE - 1; x++) {
        var idx = (y * RIPPLE_SIZE + x) * 4;
        var h = rippleData[idx];
        var v = rippleData[idx + 1];
        
        // 从周围采样
        var h_avg = (rippleData[idx - 4] + rippleData[idx + 4] + rippleData[idx - RIPPLE_SIZE*4] + rippleData[idx + RIPPLE_SIZE*4]) / 4;
        
        // 更新速度和高度
        v += (h_avg - h) * 0.5;
        v *= 0.95; // 阻尼
        h += v;
        
        newData[idx] = h;
        newData[idx + 1] = v;
      }
    }
    rippleData = newData;
    
    // 更新纹理
    rippleGL.bindTexture(rippleGL.TEXTURE_2D, rippleTexture);
    rippleGL.texSubImage2D(rippleGL.TEXTURE_2D, 0, 0, 0, RIPPLE_SIZE, RIPPLE_SIZE, rippleGL.RGBA, rippleGL.FLOAT, rippleData);
    
    // 绘制
    rippleGL.clear(rippleGL.COLOR_BUFFER_BIT);
    rippleGL.activeTexture(rippleGL.TEXTURE0);
    rippleGL.bindTexture(rippleGL.TEXTURE_2D, rippleTexture);
    rippleGL.drawArrays(rippleGL.TRIANGLE_STRIP, 0, 4);
  }
  
  requestAnimationFrame(animateRipple);
}

function bindRippleControls() {
  var strengthSlider = document.getElementById('ripple-strength');
  var strengthValue = document.getElementById('ripple-value');
  if (strengthSlider) {
    strengthSlider.addEventListener('input', function() {
      rippleStrength = parseFloat(this.value);
      strengthValue.textContent = rippleStrength.toFixed(3);
    });
  }
  
  var opacitySlider = document.getElementById('water-opacity');
  var opacityValue = document.getElementById('opacity-value');
  if (opacitySlider) {
    opacitySlider.addEventListener('input', function() {
      rippleOpacity = parseFloat(this.value);
      opacityValue.textContent = Math.round(rippleOpacity * 100) + '%';
      rippleCanvas.style.opacity = rippleOpacity;
    });
  }
  
  var toggleBtn = document.getElementById('toggle-water');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', function() {
      rippleEnabled = !rippleEnabled;
      this.textContent = rippleEnabled ? '关闭水效果' : '开启水效果';
      rippleCanvas.style.opacity = rippleEnabled ? rippleOpacity : 0;
    });
  }
}

function cssRippleFallback() {
  // CSS 渐变动画作为后备
  rippleCanvas.style.background = 'linear-gradient(135deg, rgba(10,20,30,0.6), rgba(20,40,60,0.6))';
  rippleCanvas.style.animation = 'ripple-move 10s infinite';
  
  var style = document.createElement('style');
  style.textContent = '@keyframes ripple-move { 0%, 100% { opacity: 0.5; } 50% { opacity: 0.7; } }';
  document.head.appendChild(style);
}

// 隐藏不需要的控制
document.addEventListener('DOMContentLoaded', function() {
  var depthCtrl = document.querySelector('#water-depth');
  if (depthCtrl && depthCtrl.parentElement) {
    depthCtrl.parentElement.style.display = 'none';
  }
});

window.addEventListener('load', function() {
  setTimeout(initRipple, 300);
});