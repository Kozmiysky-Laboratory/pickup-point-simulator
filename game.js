/* First-person pickup point. Classic script: expects the THREE global from vendor/three.min.js. No modules. */
(function () {
  "use strict";

  var SHIFT_SEC = 90;
  var CUSTOMER_SEC = 20;
  var REWARD = 10;
  var PENALTY = 5;
  var EYE = 1.62;
  var RADIUS = 0.32;
  var REACH = 2.35;

  var canvas = document.getElementById("view");
  var crosshair = document.getElementById("crosshair");
  var hud = document.getElementById("hud");
  var toastEl = document.getElementById("toast");
  var hint = document.getElementById("hint");
  var menu = document.getElementById("menu");
  var help = document.getElementById("help");
  var results = document.getElementById("results");

  if (typeof THREE === "undefined") {
    menu.querySelector(".lead").textContent = "Не найден vendor/three.min.js рядом с игрой.";
    return;
  }

  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
  } catch (err) {
    menu.querySelector(".lead").textContent = "В этом браузере нет WebGL, трёхмерная комната не запустится.";
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  if (THREE.SRGBColorSpace) renderer.outputColorSpace = THREE.SRGBColorSpace;
  if (THREE.ACESFilmicToneMapping) {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
  }

  var scene = new THREE.Scene();
  scene.background = new THREE.Color(0xd5d0c6);
  scene.fog = new THREE.Fog(0xd5d0c6, 14, 28);
  var camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.08, 80);

  var hemi = new THREE.HemisphereLight(0xfff6ea, 0x8d7a62, 0.72);
  scene.add(hemi);
  var sun = new THREE.DirectionalLight(0xfff8ee, 1.15);
  sun.position.set(4.5, 8.5, 3.5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -12;
  sun.shadow.camera.right = 12;
  sun.shadow.camera.top = 12;
  sun.shadow.camera.bottom = -12;
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 24;
  sun.shadow.bias = -0.0004;
  scene.add(sun);

  var FACING = {
    pz: { n: [0, 0, 1], r: [1, 0, 0] },
    px: { n: [1, 0, 0], r: [0, 0, -1] },
    nx: { n: [-1, 0, 0], r: [0, 0, 1] }
  };

  var blocks = [];
  var cells = [];
  var parcels = [];
  var parcelGeo = new THREE.BoxGeometry(0.3, 0.24, 0.26);
  var mode = "menu";
  var yaw = Math.PI;
  var pitch = 0;
  var player = { x: 0, z: 1.15 };
  var keys = {};
  var shiftLeft = SHIFT_SEC;
  var customer = null;
  var spawnAt = 0;
  var lockGive = 0;
  var coins = 0;
  var rating = 0;
  var stats = { served: 0, wrong: 0, late: 0 };
  var hovered = null;
  var toastUntil = 0;
  var menuT = 0;
  var bounds = { minX: -5.72, maxX: 5.72, minZ: -4.32, maxZ: 3.12 };
  var customerGroup = null;
  var customerSprite = null;
  var clockPrev = performance.now();

  function rand(n) { return Math.floor(Math.random() * n); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function paint(draw, w, h) {
    var c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    draw(c.getContext("2d"), w, h);
    var tex = new THREE.CanvasTexture(c);
    if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    tex.needsUpdate = true;
    return tex;
  }

  function mat(color, extra) {
    var opt = { color: color, roughness: 0.86, metalness: 0.04 };
    if (extra) {
      for (var k in extra) opt[k] = extra[k];
    }
    return new THREE.MeshStandardMaterial(opt);
  }

  var wood = mat(0xb08968, { roughness: 0.78 });
  var woodDark = mat(0x7a5536, { roughness: 0.8 });
  var wallMat = mat(0xe7e1d4, { roughness: 0.92 });
  var trimMat = mat(0xc8bfae, { roughness: 0.9 });
  var counterMat = mat(0x243e5c, { roughness: 0.55, metalness: 0.08 });
  var counterTop = mat(0xd7d1c6, { roughness: 0.45 });
  var metal = mat(0xc5ccd4, { roughness: 0.35, metalness: 0.55 });
  var rubber = mat(0x2c3138, { roughness: 0.95 });

  function addBox(x, y, z, sx, sy, sz, material, opt) {
    var mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = !opt || opt.cast !== false;
    mesh.receiveShadow = !opt || opt.receive !== false;
    scene.add(mesh);
    if (opt && opt.block) {
      blocks.push({
        minX: x - sx / 2,
        maxX: x + sx / 2,
        minZ: z - sz / 2,
        maxZ: z + sz / 2
      });
    }
    return mesh;
  }

  function floorTexture() {
    var tex = paint(function (ctx, w, h) {
      ctx.fillStyle = "#8a7862";
      ctx.fillRect(0, 0, w, h);
      var s = 64;
      for (var y = 0; y < h; y += s) {
        for (var x = 0; x < w; x += s) {
          var alt = ((x / s + y / s) % 2) === 0;
          ctx.fillStyle = alt ? "#95836c" : "#7e6d58";
          ctx.fillRect(x + 1, y + 1, s - 2, s - 2);
        }
      }
    }, 512, 512);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(9, 7);
    return tex;
  }

  function buildRoom() {
    var floor = new THREE.Mesh(
      new THREE.PlaneGeometry(14.4, 11.3),
      mat(0xffffff, { map: floorTexture(), roughness: 0.95 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    addBox(0, 1.6, -5.55, 14.4, 3.2, 0.18, wallMat);
    addBox(0, 1.6, 5.62, 14.4, 3.2, 0.18, wallMat);
    addBox(-7.15, 1.6, 0.05, 0.18, 3.2, 11.3, wallMat);
    addBox(7.15, 1.6, 0.05, 0.18, 3.2, 11.3, wallMat);
    addBox(0, 0.08, 0.05, 14.2, 0.16, 11.05, trimMat, { cast: false });

    var ceil = new THREE.Mesh(new THREE.PlaneGeometry(14.4, 11.3), mat(0xf4f0e7, { roughness: 1 }));
    ceil.rotation.x = Math.PI / 2;
    ceil.position.y = 3.2;
    scene.add(ceil);

    [-2.2, 2.2].forEach(function (x) {
      var lamp = addBox(x, 3.14, -1.2, 1.7, 0.06, 0.38, mat(0xfff4d2, {
        emissive: 0xfff1c9,
        emissiveIntensity: 0.7,
        roughness: 0.4
      }), { cast: false, receive: false });
      lamp.castShadow = false;
    });

    addBox(0, 0.52, 3.95, 4.6, 1.04, 0.9, counterMat, { block: true });
    addBox(0, 1.07, 3.95, 4.8, 0.08, 1.02, counterTop, { block: true });
    addBox(0, 0.02, 2.95, 4.2, 0.03, 0.9, rubber, { cast: false });
    addBox(-1.85, 1.16, 3.55, 0.16, 0.1, 0.16, mat(0xd4a017, { metalness: 0.6, roughness: 0.3 }), { cast: true });

    var sign = paint(function (ctx, w, h) {
      ctx.fillStyle = "#1f4b78";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#f6f0e6";
      ctx.font = "800 92px Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("ВЫДАЧА", w / 2, h / 2 - 8);
      ctx.font = "600 36px Arial, sans-serif";
      ctx.fillText("пункт выдачи заказов", w / 2, h / 2 + 58);
    }, 1024, 256);
    var signMesh = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.6), mat(0xffffff, { map: sign, roughness: 0.6 }));
    signMesh.position.set(0, 2.35, 5.5);
    signMesh.rotation.y = Math.PI;
    scene.add(signMesh);

    var door = addBox(4.55, 1.15, 5.5, 1.15, 2.2, 0.08, mat(0x6e543c, { roughness: 0.7 }));
    door.castShadow = false;
    addBox(4.15, 1.15, 5.42, 0.06, 0.06, 0.06, metal);

    buildCustomer();
  }

  function buildCustomer() {
    customerGroup = new THREE.Group();
    customerGroup.position.set(0.35, 0, 4.72);
    customerGroup.visible = false;
    scene.add(customerGroup);
    var skin = mat(0xe0b090, { roughness: 0.7 });
    var shirt = mat(0x2f6fad, { roughness: 0.75 });
    var pants = mat(0x2a3140, { roughness: 0.85 });
    var head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 20, 16), skin);
    head.position.y = 1.62;
    head.castShadow = true;
    customerGroup.add(head);
    var body = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.55, 0.24), shirt);
    body.position.y = 1.18;
    body.castShadow = true;
    customerGroup.add(body);
    var legL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.62, 0.16), pants);
    legL.position.set(-0.1, 0.42, 0);
    legL.castShadow = true;
    customerGroup.add(legL);
    var legR = legL.clone();
    legR.position.x = 0.1;
    customerGroup.add(legR);
    var eyeMat = mat(0x1b1b1b, { roughness: 0.4 });
    [-0.05, 0.05].forEach(function (x) {
      var eye = new THREE.Mesh(new THREE.SphereGeometry(0.02, 10, 8), eyeMat);
      eye.position.set(x, 1.64, -0.14);
      customerGroup.add(eye);
    });
    customerSprite = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthTest: false }));
    customerSprite.position.set(0, 2.08, 0);
    customerSprite.scale.set(0.95, 0.38, 1);
    customerSprite.visible = false;
    customerGroup.add(customerSprite);
  }

  function setCustomerColor(hex) {
    customerGroup.children[1].material.color.setHex(hex);
  }

  function setSprite(text) {
    var tex = paint(function (ctx, w, h) {
      ctx.clearRect(0, 0, w, h);
      roundRect(ctx, 8, 8, w - 16, h - 16, 28, "#f6f0e6");
      ctx.fillStyle = "#1c2430";
      ctx.font = "800 78px Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(text, w / 2, h / 2 + 4);
    }, 512, 192);
    if (customerSprite.material.map) customerSprite.material.map.dispose();
    customerSprite.material.map = tex;
    customerSprite.material.needsUpdate = true;
  }

  function roundRect(ctx, x, y, w, h, r, fill) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  }

  function numberTexture(text) {
    return paint(function (ctx, w, h) {
      ctx.fillStyle = "#f7f4ee";
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "#2a241c";
      ctx.lineWidth = 10;
      ctx.strokeRect(6, 6, w - 12, h - 12);
      ctx.fillStyle = "#1c2430";
      ctx.font = "800 78px Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(text, w / 2, h / 2 + 2);
    }, 256, 128);
  }

  function rangeTexture(text) {
    return paint(function (ctx, w, h) {
      ctx.fillStyle = "#1f4b78";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#f6f0e6";
      ctx.font = "800 86px Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(text, w / 2, h / 2 + 4);
    }, 512, 160);
  }

  function addShelfUnit(cx, cz, facing, cols, rows) {
    var f = FACING[facing];
    var nx = f.n[0], nz = f.n[2], rx = f.r[0], rz = f.r[2];
    var colW = 0.86;
    var width = cols * colW;
    var depth = 0.42;
    var rowH = 0.74;
    var base = 0.36;

    function put(localRight, localOut, y, alongRight, height, alongNormal, material) {
      var x = cx + rx * localRight + nx * localOut;
      var z = cz + rz * localRight + nz * localOut;
      var sx = Math.abs(nx) > 0.5 ? alongNormal : alongRight;
      var sz = Math.abs(nx) > 0.5 ? alongRight : alongNormal;
      return addBox(x, y, z, sx, height, sz, material);
    }

    var spanY = rows * rowH;
    put(0, -0.2, base + spanY / 2, width, spanY, 0.06, woodDark);
    put(-width / 2 + 0.04, 0, base + spanY / 2, 0.08, spanY, depth, woodDark);
    put(width / 2 - 0.04, 0, base + spanY / 2, 0.08, spanY, depth, woodDark);
    for (var d = 1; d < cols; d++) {
      put(d * colW - width / 2, 0, base + spanY / 2, 0.035, spanY - 0.08, depth * 0.92, wood);
    }

    var hx = Math.abs(rx) * (width / 2) + Math.abs(nx) * 0.24;
    var hz = Math.abs(rz) * (width / 2) + Math.abs(nz) * 0.24;
    blocks.push({ minX: cx - hx, maxX: cx + hx, minZ: cz - hz, maxZ: cz + hz });

    var first = cells.length + 1;
    for (var r = 0; r < rows; r++) {
      var fromBottom = rows - 1 - r;
      var surfaceY = base + fromBottom * rowH;
      put(0, 0, surfaceY - 0.025, width - 0.08, 0.05, depth, wood);
      for (var c = 0; c < cols; c++) {
        var rightOff = (c + 0.5) * colW - width / 2;
        var num = cells.length + 1;
        cells.push({
          n: num,
          x: cx + rx * rightOff + nx * 0.08,
          y: surfaceY + 0.145,
          z: cz + rz * rightOff + nz * 0.08,
          right: f.r,
          normal: f.n,
          parcels: []
        });
        var plate = new THREE.Mesh(
          new THREE.PlaneGeometry(0.28, 0.13),
          mat(0xffffff, { map: numberTexture(String(num)), roughness: 0.7 })
        );
        plate.position.set(
          cx + rx * rightOff + nx * (depth / 2 + 0.02),
          surfaceY - 0.1,
          cz + rz * rightOff + nz * (depth / 2 + 0.02)
        );
        if (facing === "px") plate.rotation.y = Math.PI / 2;
        if (facing === "nx") plate.rotation.y = -Math.PI / 2;
        scene.add(plate);
      }
    }
    var last = cells.length;
    var sign = new THREE.Mesh(
      new THREE.PlaneGeometry(1.15, 0.34),
      mat(0xffffff, { map: rangeTexture(first + "–" + last), roughness: 0.55 })
    );
    sign.position.set(
      cx + nx * (depth / 2 + 0.02),
      base + spanY + 0.18,
      cz + nz * (depth / 2 + 0.02)
    );
    if (facing === "px") sign.rotation.y = Math.PI / 2;
    if (facing === "nx") sign.rotation.y = -Math.PI / 2;
    scene.add(sign);
  }

  function buildShelves() {
    addShelfUnit(-2.15, -4.95, "pz", 4, 3);
    addShelfUnit(2.15, -4.95, "pz", 4, 3);
    addShelfUnit(-6.38, -0.15, "px", 4, 3);
    addShelfUnit(6.38, -0.15, "nx", 4, 3);
  }

  var BANDS = ["#c4523a", "#2f6fad", "#2f7d4a", "#b8860b", "#6d4c93", "#b05a28", "#1f6f78", "#8c3d55"];

  function parcelTexture(article, band) {
    return paint(function (ctx, w, h) {
      ctx.fillStyle = "#d7b48a";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = band;
      ctx.fillRect(0, 0, w, 64);
      ctx.fillStyle = "#2a2118";
      ctx.font = "800 64px Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(article, w / 2, h / 2 + 16);
      ctx.strokeStyle = "#8a6848";
      ctx.lineWidth = 10;
      ctx.strokeRect(8, 8, w - 16, h - 16);
    }, 256, 256);
  }

  function layoutCell(cell) {
    var count = cell.parcels.length;
    for (var i = 0; i < count; i++) {
      var side = count === 1 ? 0 : (i === 0 ? -0.17 : 0.17);
      var p = cell.parcels[i];
      p.mesh.position.set(
        cell.x + cell.right[0] * side,
        cell.y,
        cell.z + cell.right[2] * side
      );
    }
  }

  function addParcel(cell, article) {
    var band = BANDS[rand(BANDS.length)];
    var mesh = new THREE.Mesh(parcelGeo, mat(0xffffff, {
      map: parcelTexture(article, band),
      roughness: 0.72,
      emissive: 0x000000
    }));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    if (Math.abs(cell.normal[0]) > 0.5) mesh.rotation.y = Math.PI / 2;
    var parcel = { article: article, cell: cell, mesh: mesh };
    mesh.userData.parcel = parcel;
    cell.parcels.push(parcel);
    parcels.push(parcel);
    scene.add(mesh);
    layoutCell(cell);
    return parcel;
  }

  function freshArticle(used) {
    var letters = "ABCDEFGH";
    var article = "A-100";
    for (var i = 0; i < 40; i++) {
      article = letters[rand(letters.length)] + "-" + (100 + rand(900));
      if (!used[article]) break;
    }
    used[article] = true;
    return article;
  }

  function clearParcels() {
    for (var i = 0; i < parcels.length; i++) {
      var mesh = parcels[i].mesh;
      scene.remove(mesh);
      if (mesh.material.map) mesh.material.map.dispose();
      mesh.material.dispose();
    }
    parcels.length = 0;
    for (var c = 0; c < cells.length; c++) cells[c].parcels.length = 0;
    hovered = null;
  }

  function stock(count) {
    var used = {};
    for (var i = 0; i < parcels.length; i++) used[parcels[i].article] = true;
    var placed = 0;
    var guard = 0;
    while (placed < count && guard < 80) {
      guard++;
      var open = [];
      var empty = [];
      for (var c = 0; c < cells.length; c++) {
        if (cells[c].parcels.length < 2) open.push(cells[c]);
        if (cells[c].parcels.length === 0) empty.push(cells[c]);
      }
      if (!open.length) break;
      var pool = empty.length && Math.random() < 0.72 ? empty : open;
      addParcel(pool[rand(pool.length)], freshArticle(used));
      placed++;
    }
  }

  function removeParcel(parcel) {
    var cell = parcel.cell;
    scene.remove(parcel.mesh);
    if (parcel.mesh.material.map) parcel.mesh.material.map.dispose();
    parcel.mesh.material.dispose();
    parcels.splice(parcels.indexOf(parcel), 1);
    cell.parcels.splice(cell.parcels.indexOf(parcel), 1);
    layoutCell(cell);
    if (hovered === parcel) hovered = null;
  }

  function blocked(x, z) {
    if (x < bounds.minX || x > bounds.maxX || z < bounds.minZ || z > bounds.maxZ) return true;
    for (var i = 0; i < blocks.length; i++) {
      var b = blocks[i];
      if (x > b.minX - RADIUS && x < b.maxX + RADIUS && z > b.minZ - RADIUS && z < b.maxZ + RADIUS) return true;
    }
    return false;
  }

  function applyLook() {
    camera.rotation.order = "YXZ";
    camera.rotation.y = yaw;
    camera.rotation.x = pitch;
    camera.rotation.z = 0;
    camera.position.set(player.x, EYE, player.z);
  }

  function showToast(text, color) {
    toastEl.textContent = text;
    toastEl.style.color = color || "#fff8ee";
    toastEl.style.display = "block";
    toastUntil = performance.now() + 1400;
  }

  function beep(freq, dur) {
    try {
      var ctx = beep.ctx || (beep.ctx = new (window.AudioContext || window.webkitAudioContext)());
      if (ctx.state === "suspended") ctx.resume();
      var o = ctx.createOscillator();
      var g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = freq;
      g.gain.value = 0.035;
      o.connect(g);
      g.connect(ctx.destination);
      o.start();
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
      o.stop(ctx.currentTime + dur);
    } catch (e) { /* ignore */ }
  }

  function updateHud() {
    document.getElementById("hud-coins").textContent = String(coins);
    document.getElementById("hud-rating").textContent = String(rating);
    var left = Math.max(0, Math.ceil(shiftLeft));
    document.getElementById("hud-time").textContent = Math.floor(left / 60) + ":" + (left % 60 < 10 ? "0" : "") + (left % 60);
    var who = document.getElementById("hud-who");
    var article = document.getElementById("hud-article");
    var bar = document.getElementById("hud-bar");
    if (!customer) {
      who.textContent = "Стойка пустая";
      article.textContent = "Ждём клиента";
      bar.style.width = "0%";
      bar.style.background = "#b9b1a4";
    } else {
      who.textContent = "Клиент просит артикул";
      article.textContent = customer.article;
      var ratio = clamp((customer.deadline - performance.now()) / (CUSTOMER_SEC * 1000), 0, 1);
      bar.style.width = (ratio * 100) + "%";
      bar.style.background = ratio < 0.3 ? "#a33b32" : "#2f7d4a";
    }
  }

  function spawnCustomer() {
    if (mode !== "play" || customer || !parcels.length) return;
    var pick = parcels[rand(parcels.length)];
    customer = {
      article: pick.article,
      deadline: performance.now() + CUSTOMER_SEC * 1000
    };
    var colors = [0x2f6fad, 0xb05a28, 0x2f7d4a, 0x6d4c93, 0xa33b32];
    setCustomerColor(colors[rand(colors.length)]);
    customerGroup.visible = true;
    customerSprite.visible = true;
    customerGroup.position.x = (Math.random() * 2 - 1) * 1.15;
    setSprite(pick.article);
    updateHud();
  }

  function dismissCustomer() {
    customer = null;
    customerGroup.visible = false;
    customerSprite.visible = false;
    spawnAt = performance.now() + 1600 + Math.random() * 1200;
    updateHud();
  }

  function onCorrect(parcel) {
    coins += REWARD;
    rating += 1;
    stats.served += 1;
    removeParcel(parcel);
    showToast("+" + REWARD + " монет, +1 рейтинг", "#b7f0c8");
    beep(660, 0.08);
    setTimeout(function () { beep(880, 0.1); }, 90);
    if (parcels.length < 6) stock(4);
    dismissCustomer();
  }

  function onWrong() {
    coins = Math.max(0, coins - PENALTY);
    stats.wrong += 1;
    showToast("Неверная посылка, −" + PENALTY + " монет", "#ffb4ae");
    beep(196, 0.16);
    dismissCustomer();
  }

  function onLate() {
    rating = Math.max(0, rating - 1);
    stats.late += 1;
    showToast("Клиент ушёл, −1 рейтинг", "#ffd0a8");
    beep(150, 0.18);
    dismissCustomer();
  }

  var raycaster = new THREE.Raycaster();
  var center = new THREE.Vector2(0, 0);

  function pickParcel() {
    raycaster.far = REACH;
    raycaster.setFromCamera(center, camera);
    var meshes = [];
    for (var i = 0; i < parcels.length; i++) meshes.push(parcels[i].mesh);
    var hits = raycaster.intersectObjects(meshes, false);
    return hits.length ? hits[0].object.userData.parcel : null;
  }

  function setHover(parcel) {
    if (hovered === parcel) return;
    if (hovered) {
      hovered.mesh.material.emissive.setHex(0x000000);
      hovered.mesh.scale.set(1, 1, 1);
    }
    hovered = parcel;
    if (hovered) {
      hovered.mesh.material.emissive.setHex(0x3a2a16);
      hovered.mesh.scale.set(1.05, 1.05, 1.05);
    }
  }

  function tryGive() {
    if (mode !== "play" || !customer) return;
    if (performance.now() < lockGive) return;
    var parcel = pickParcel();
    if (!parcel) return;
    lockGive = performance.now() + 350;
    if (parcel.article === customer.article) onCorrect(parcel);
    else onWrong();
  }

  function startShift() {
    clearParcels();
    stock(13);
    coins = 0;
    rating = 0;
    stats.served = 0;
    stats.wrong = 0;
    stats.late = 0;
    customer = null;
    customerGroup.visible = false;
    customerSprite.visible = false;
    shiftLeft = SHIFT_SEC;
    player.x = 0;
    player.z = 1.15;
    yaw = Math.PI;
    pitch = -0.04;
    mode = "play";
    spawnAt = performance.now() + 700;
    menu.classList.add("hidden");
    help.classList.add("hidden");
    results.classList.add("hidden");
    hud.style.display = "block";
    crosshair.style.display = "block";
    applyLook();
    updateHud();
  }

  function endShift() {
    if (mode !== "play") return;
    mode = "results";
    if (document.pointerLockElement) document.exitPointerLock();
    crosshair.style.display = "none";
    hud.style.display = "none";
    hint.style.display = "none";
    toastEl.style.display = "none";
    setHover(null);
    document.getElementById("res-served").textContent = "Выдано верно: " + stats.served;
    document.getElementById("res-wrong").textContent = "Ошибок: " + stats.wrong;
    document.getElementById("res-late").textContent = "Не успели: " + stats.late;
    document.getElementById("res-coins").textContent = "Монеты: " + coins;
    document.getElementById("res-rating").textContent = "Рейтинг: " + rating;
    results.classList.remove("hidden");
  }

  function toMenu() {
    mode = "menu";
    if (document.pointerLockElement) document.exitPointerLock();
    customer = null;
    customerGroup.visible = false;
    customerSprite.visible = false;
    crosshair.style.display = "none";
    hud.style.display = "none";
    hint.style.display = "none";
    results.classList.add("hidden");
    help.classList.add("hidden");
    menu.classList.remove("hidden");
    setHover(null);
  }

  document.getElementById("btn-play").addEventListener("click", function () {
    startShift();
    var lock = canvas.requestPointerLock();
    if (lock && lock.catch) lock.catch(function () {});
  });
  document.getElementById("btn-help").addEventListener("click", function () {
    menu.classList.add("hidden");
    help.classList.remove("hidden");
  });
  document.getElementById("btn-help-back").addEventListener("click", function () {
    help.classList.add("hidden");
    menu.classList.remove("hidden");
  });
  document.getElementById("btn-menu").addEventListener("click", toMenu);

  canvas.addEventListener("click", function () {
    if (mode !== "play") return;
    if (document.pointerLockElement !== canvas) {
      var lock = canvas.requestPointerLock();
      if (lock && lock.catch) lock.catch(function () {});
    }
  });
  document.addEventListener("mousedown", function (e) {
    if (e.button !== 0) return;
    if (document.pointerLockElement !== canvas) return;
    tryGive();
  });
  document.addEventListener("mousemove", function (e) {
    if (document.pointerLockElement !== canvas || mode !== "play") return;
    yaw -= e.movementX * 0.0022;
    pitch -= e.movementY * 0.0022;
    pitch = clamp(pitch, -1.2, 1.2);
  });
  document.addEventListener("pointerlockchange", function () {
    if (mode !== "play") return;
    hint.style.display = document.pointerLockElement === canvas ? "none" : "block";
  });
  document.addEventListener("keydown", function (e) {
    keys[e.code] = true;
    if (mode === "play" && (e.code === "KeyW" || e.code === "KeyA" || e.code === "KeyS" || e.code === "KeyD")) {
      e.preventDefault();
    }
  });
  document.addEventListener("keyup", function (e) { keys[e.code] = false; });
  window.addEventListener("blur", function () {
    keys = {};
  });
  window.addEventListener("resize", function () {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
  canvas.addEventListener("contextmenu", function (e) { e.preventDefault(); });

  function tick(now) {
    var dt = Math.min(0.05, (now - clockPrev) / 1000);
    clockPrev = now;

    if (mode === "play") {
      var forwardX = -Math.sin(yaw);
      var forwardZ = -Math.cos(yaw);
      var rightX = Math.cos(yaw);
      var rightZ = -Math.sin(yaw);
      var mx = 0;
      var mz = 0;
      if (document.pointerLockElement === canvas) {
        if (keys.KeyW) { mx += forwardX; mz += forwardZ; }
        if (keys.KeyS) { mx -= forwardX; mz -= forwardZ; }
        if (keys.KeyD) { mx += rightX; mz += rightZ; }
        if (keys.KeyA) { mx -= rightX; mz -= rightZ; }
      }
      var len = Math.hypot(mx, mz);
      if (len > 0) {
        mx = mx / len * 3.35 * dt;
        mz = mz / len * 3.35 * dt;
        if (!blocked(player.x + mx, player.z)) player.x += mx;
        if (!blocked(player.x, player.z + mz)) player.z += mz;
      }
      applyLook();
      shiftLeft -= dt;
      if (customer && now >= customer.deadline) onLate();
      else if (!customer && now >= spawnAt && shiftLeft > 2) spawnCustomer();
      if (shiftLeft <= 0) endShift();
      else {
        setHover(document.pointerLockElement === canvas ? pickParcel() : null);
        updateHud();
        customerGroup.position.y = Math.sin(now * 0.003) * 0.015;
      }
    } else {
      menuT += dt;
      var ang = menuT * 0.18;
      camera.position.set(Math.sin(ang) * 1.4, 1.85, 2.15 + Math.cos(ang) * 0.35);
      camera.lookAt(0, 1.25, -2.2);
    }

    if (toastEl.style.display === "block" && now > toastUntil) toastEl.style.display = "none";
    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  }

  buildRoom();
  buildShelves();
  stock(13);
  requestAnimationFrame(tick);
})();
