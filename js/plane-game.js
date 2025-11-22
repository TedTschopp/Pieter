window.addEventListener("DOMContentLoaded", () => {
  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  // UI Elements
  const startupPopup = document.getElementById("startupPopup");
  const startFlightBtn = document.getElementById("startFlightBtn");
  const startupPlaneSelect = document.getElementById("startupPlaneSelect");
  const startupAltInput = document.getElementById("startupAlt");
  const crashPopup = document.getElementById("crashPopup");
  const resetFlightBtn = document.getElementById("resetFlight");
  const spectateModeBtn = document.getElementById("spectateMode");
  const autopilotCheck = document.getElementById("autopilot");
  const unlimitedFuelCheck = document.getElementById("unlimitedFuel");
  const noCrashCheck = document.getElementById("noCrash");
  const optionsBtn = document.getElementById("optionsBtn");
  const optionsPanel = document.getElementById("optionsPanel");
  const planeSelect = document.getElementById("planeSelect");
  const infoBox = document.getElementById("infoBox");
  const hideBtn = document.getElementById("hideBtn");
  const showBtn = document.getElementById("showBtn");

  // Global variables
  let keys = {};
  let crashed = false;
  let spectateMode = false;
  let hasStarted = false;
  let throttle = 0;

  // Plane definitions
  const planesData = {
    jet: { src: "/img/plane.png", speed: 1800, scale: 1.7 },
    fighter: { src: "/img/fighter.png", speed: 3218, scale: 1.7 },
  };

  let planeImg = new Image();
  let plane = {};
  let cameraX = 0;
  let cameraY = 0;
  let buildings = [];

  function initPlane(type, startAlt = 1200) {
    const data = planesData[type];
    planeImg.src = data.src;
    plane = {
      x: 400,
      y: canvas.height - 120 - startAlt * 0.05,
      w: 80 * data.scale,
      h: 40 * data.scale,
      vx: 0,
      vy: 0,
      angle: 0,
      maxSpeed: data.speed / 200,
      fuel: 1,
    };
    planeSelect.value = type;
    startupPlaneSelect.value = type;
  }

  function initBuildings() {
    buildings = [];
    for (let i = 0; i < 50; i++) {
      const w = 60 + Math.random() * 100;
      const h = 100 + Math.random() * 150;
      const x = i * 400 + Math.random() * 100;
      const y = canvas.height - 120;
      buildings.push({ x, y, w, h });
    }
  }

  // Start flight
  startFlightBtn.addEventListener("click", () => {
    const startAlt = parseInt(startupAltInput.value) || 1200;
    initPlane(startupPlaneSelect.value, startAlt);
    initBuildings();
    startupPopup.classList.add("hidden");
    hasStarted = true;
  });

  // Options panel toggle
  optionsBtn.addEventListener("click", () => {
    optionsPanel.style.display =
      optionsPanel.style.display === "block" ? "none" : "block";
  });

  planeSelect.addEventListener("change", () => {
    const currentAlt = (canvas.height - 120 - plane.y) * 20;
    initPlane(planeSelect.value, currentAlt);
  });

  // Info box toggle
  hideBtn.addEventListener("click", () => {
    infoBox.classList.add("hidden");
    showBtn.classList.add("visible");
  });
  showBtn.addEventListener("click", () => {
    infoBox.classList.remove("hidden");
    showBtn.classList.remove("visible");
  });

  // Keyboard controls
  window.addEventListener("keydown", (e) => {
    keys[e.key.toLowerCase()] = true;
    if (e.key.toLowerCase() === "f") unlimitedFuelCheck.checked = !unlimitedFuelCheck.checked;
  });
  window.addEventListener("keyup", (e) => (keys[e.key.toLowerCase()] = false));

  function triggerCrash() {
    if (crashed || !hasStarted) return;
    crashed = true;
    crashPopup.classList.add("visible");
    spectateMode = false;
    plane.vx = plane.vy = 0;
  }

  function resetFlight() {
    crashed = false;
    spectateMode = false;
    crashPopup.classList.remove("visible");
    const startAlt = parseInt(startupAltInput.value) || 1200;
    initPlane(planeSelect.value, startAlt);
    initBuildings();
    throttle = 0;
  }

  resetFlightBtn.addEventListener("click", resetFlight);
  spectateModeBtn.addEventListener("click", () => {
    crashed = true;
    spectateMode = true;
    crashPopup.classList.remove("visible");
  });

  function update() {
    if (!planeImg.complete) return requestAnimationFrame(update);

    // Camera follows plane
    cameraX = plane.x - canvas.width / 2;
    cameraY = plane.y - canvas.height / 2;

    // Controls
    let roll = 0;
    throttle = 0;
    if (keys["a"]) roll = -1;
    if (keys["d"]) roll = 1;
    if (keys["w"] && (plane.fuel > 0 || unlimitedFuelCheck.checked)) throttle = 1;

    // Autopilot
    if (autopilotCheck.checked && !crashed) {
      const altTarget = parseInt(document.getElementById("altSlider")?.value) || 2000;
      const targetY = canvas.height - 120 - altTarget * 0.05;
      plane.vy += (targetY - plane.y) * 0.002; // Smooth autopilot
    }

    // Physics
    plane.angle += roll * 0.03;
    plane.vx += Math.cos(plane.angle) * throttle * 0.1;
    plane.vy += Math.sin(plane.angle) * throttle * 0.1 + 0.05;

    // Fuel consumption
    if (!unlimitedFuelCheck.checked && plane.fuel > 0) plane.fuel -= throttle * 0.002;
    if (!unlimitedFuelCheck.checked && plane.fuel <= 0) throttle = 0;

    // Move plane
    plane.x += plane.vx;
    plane.y += plane.vy;

    // Ground collision
    if (hasStarted && !noCrashCheck.checked && !crashed && plane.y + plane.h / 2 > canvas.height - 120) {
      plane.y = canvas.height - 120 - plane.h / 2;
      triggerCrash();
    }

    // Dynamic building generation
    const lastX = Math.max(...buildings.map((b) => b.x));
    if (plane.x + 800 > lastX) {
      const w = 60 + Math.random() * 100;
      const h = 100 + Math.random() * 150;
      const x = lastX + 300 + Math.random() * 100;
      const y = canvas.height - 120;
      buildings.push({ x, y, w, h });
    }

    draw();
    requestAnimationFrame(update);
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Sky gradient
    const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
    sky.addColorStop(0, "#6ec6ff");
    sky.addColorStop(1, "#e3f2fd");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Ground
    ctx.fillStyle = "green";
    ctx.fillRect(0, canvas.height - 130 - cameraY, canvas.width, 10);
    ctx.fillStyle = "#4e342e";
    ctx.fillRect(0, canvas.height - 120 - cameraY, canvas.width, 120);

    // Buildings
    buildings.forEach((b) => {
      const bx = b.x - cameraX;
      const by = b.y - cameraY - b.h;
      ctx.fillStyle = "#666";
      ctx.fillRect(bx, by, b.w, b.h);
      ctx.fillStyle = "yellow";
      for (let wx = 5; wx < b.w; wx += 15) {
        for (let wy = 5; wy < b.h; wy += 20) {
          ctx.fillRect(bx + wx, by + wy, 6, 10);
        }
      }
    });

    // Plane
    ctx.save();
    ctx.translate(plane.x - cameraX, plane.y - cameraY);
    ctx.rotate(plane.angle);
    ctx.drawImage(planeImg, -plane.w / 2, -plane.h / 2, plane.w, plane.h);
    ctx.restore();

    // Throttle & Fuel UI
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(canvas.width - 220, canvas.height - 100, 200, 100);
    ctx.fillStyle = "white";
    ctx.font = "16px monospace";
    ctx.fillText("Throttle", canvas.width - 200, canvas.height - 75);
    ctx.strokeRect(canvas.width - 200, canvas.height - 70, 160, 10);
    ctx.fillStyle = "lime";
    ctx.fillRect(canvas.width - 200, canvas.height - 70, 160 * throttle, 10);
    ctx.fillText("Fuel", canvas.width - 200, canvas.height - 40);
    ctx.strokeRect(canvas.width - 200, canvas.height - 35, 160, 10);
    ctx.fillStyle = plane.fuel > 0 ? "orange" : "red";
    ctx.fillRect(canvas.width - 200, canvas.height - 35, 160 * plane.fuel, 10);

    // Flight info
    const speedMPH = Math.sqrt(plane.vx ** 2 + plane.vy ** 2) * 200 * 0.621371;
    const vsFPM = -plane.vy * 200 * 196.85;
    const altFT = (canvas.height - 120 - plane.y - plane.h / 2) * 20;
    ctx.fillStyle = "white";
    ctx.fillText(`Speed: ${speedMPH.toFixed(0)} MPH`, 20, 30);
    ctx.fillText(`VS: ${vsFPM.toFixed(0)} FPM`, 20, 50);
    ctx.fillText(`Alt: ${altFT.toFixed(0)} ft`, 20, 70);
  }

  update();
});
