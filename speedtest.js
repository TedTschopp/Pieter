
    // ----------------------------
    // CPU Stress Test + Graph
    // ----------------------------
    const cpuSpinner = document.getElementById('cpuSpinner');
    const cpuBtn = document.getElementById('toggleBtn');
    const cpuSlider = document.getElementById('cpuSlider');
    const cpuVal = document.getElementById('cpuVal');
    const cpuFPS = document.getElementById('cpuFPS');
    const cpuGraph = document.getElementById('cpuGraph');
    const ctx = cpuGraph.getContext('2d');

    let cpuRunning = false;
    let cpuIntensity = Number(cpuSlider.value);
    let frames = 0;
    let lastTime = performance.now();
    let fpsHistory = [];

    cpuSlider.oninput = () => {
      cpuIntensity = Number(cpuSlider.value);
      cpuVal.textContent = cpuIntensity;
    };

    function doHeavyWork(iterations) {
      let x = 0;
      for (let i = 0; i < iterations; i++) {
        x += Math.sin(i) * Math.cos(i);
        x += Math.sqrt(Math.abs(Math.tan(i % 100))) * Math.log(i + 1);
        x += Math.pow(Math.sin(i), 3) * Math.exp(Math.sin(i));
      }
      return x;
    }

    function drawGraph() {
      ctx.clearRect(0, 0, cpuGraph.width, cpuGraph.height);
      if (fpsHistory.length === 0) return;
      ctx.beginPath();
      ctx.moveTo(0, cpuGraph.height - fpsHistory[0]);
      for (let i = 1; i < fpsHistory.length; i++) {
        const x = (i / fpsHistory.length) * cpuGraph.width;
        const y = cpuGraph.height - fpsHistory[i];
        ctx.lineTo(x, y);
      }
      ctx.strokeStyle = '#0078d7';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    function cpuStressTest() {
      if (!cpuRunning) return;

      doHeavyWork(cpuIntensity * 1000);

      frames++;
      const now = performance.now();
      if (now - lastTime >= 1000) {
        cpuFPS.textContent = frames;
        fpsHistory.push(Math.min(frames, cpuGraph.height));
        if (fpsHistory.length > 100) fpsHistory.shift();
        drawGraph();
        frames = 0;
        lastTime = now;
      }
      requestAnimationFrame(cpuStressTest);
    }

    cpuBtn.onclick = () => {
      cpuRunning = !cpuRunning;
      if (cpuRunning) {
        cpuBtn.textContent = "Stop Test";
        cpuSpinner.classList.remove('hidden');
        frames = 0;
        lastTime = performance.now();
        fpsHistory = [];
        cpuStressTest();
      } else {
        cpuBtn.textContent = "Start Test";
        cpuSpinner.classList.add('hidden');
        cpuFPS.textContent = 0;
      }
    };

    // ----------------------------
    // GPU Stress Test using WebGL
    // ----------------------------
    const canvas = document.getElementById("gpuCanvas");
    const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    const gpuSpinner = document.getElementById("gpuSpinner");
    const gpuFPS = document.getElementById("gpuFPS");
    let gpuRunning = false;

    if (!gl) alert("WebGL not supported in your browser!");

    const vertices = [
      -0.05, -0.05, -0.05, 0.05, -0.05, -0.05, 0.05, 0.05, -0.05, -0.05, 0.05, -0.05,
      -0.05, -0.05, 0.05, 0.05, -0.05, 0.05, 0.05, 0.05, 0.05, -0.05, 0.05, 0.05
    ];

    const cubePositions = [];
    for (let i = 0; i < 40000000; i++) {
      cubePositions.push([Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * -2]);
    }

    const vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

    const vertCode = `
  attribute vec3 coordinates;
  uniform vec3 offset;
  uniform float angle;
  void main(void) {
    float c = cos(angle);
    float s = sin(angle);
    vec3 pos = coordinates;
    gl_Position = vec4(
      c*pos.x - s*pos.z + offset.x,
      pos.y + offset.y,
      s*pos.x + c*pos.z + offset.z,
      1.0
    );
  }`;

    const fragCode = `
  void main(void) {
    gl_FragColor = vec4(0.2, 0.8, 0.5, 1.0);
  }`;

    const vertShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vertShader, vertCode);
    gl.compileShader(vertShader);

    const fragShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fragShader, fragCode);
    gl.compileShader(fragShader);

    const shaderProgram = gl.createProgram();
    gl.attachShader(shaderProgram, vertShader);
    gl.attachShader(shaderProgram, fragShader);
    gl.linkProgram(shaderProgram);
    gl.useProgram(shaderProgram);

    const coord = gl.getAttribLocation(shaderProgram, "coordinates");
    gl.enableVertexAttribArray(coord);
    gl.vertexAttribPointer(coord, 3, gl.FLOAT, false, 0, 0);

    const offsetUniform = gl.getUniformLocation(shaderProgram, "offset");
    const angleUniform = gl.getUniformLocation(shaderProgram, "angle");

    let angle = 0;

    // GPU Slider
    const gpuSlider = document.getElementById("gpuSlider");
    const gpuVal = document.getElementById("gpuVal");
    let gpuIntensity = Number(gpuSlider.value);

    gpuSlider.oninput = () => {
      gpuIntensity = Number(gpuSlider.value);
      gpuVal.textContent = gpuIntensity;
    };

    let gpuFrames = 0;
    let gpuLastTime = performance.now();

    function drawGPU() {
      if (!gpuRunning) return;

      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      angle += 0.01;

      const count = Math.min(gpuIntensity, cubePositions.length);
      for (let i = 0; i < count; i++) {
        gl.uniform3fv(offsetUniform, cubePositions[i]);
        gl.uniform1f(angleUniform, angle);
        gl.drawArrays(gl.TRIANGLE_FAN, 0, vertices.length / 3);
      }

      gpuFrames++;
      const now = performance.now();
      if (now - gpuLastTime >= 1000) {
        gpuFPS.textContent = gpuFrames;
        gpuFrames = 0;
        gpuLastTime = now;
      }

      requestAnimationFrame(drawGPU);
    }

    document.getElementById("gpuToggleBtn").onclick = () => {
      gpuRunning = !gpuRunning;
      if (gpuRunning) {
        gpuSpinner.classList.remove('hidden');
        drawGPU();
      } else {
        gpuSpinner.classList.add('hidden');
        gpuFPS.textContent = 0;
      }
    };
