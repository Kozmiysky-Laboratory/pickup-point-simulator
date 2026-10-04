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
  var SENS_KEY = "pps-mouse-sensitivity";

  var canvas = document.getElementById("view");
  var crosshair = document.getElementById("crosshair");
  var hud = document.getElementById("hud");
  var toastEl = document.getElementById("toast");
  var hint = document.getElementById("hint");
  var menu = document.getElementById("menu");
  var help = document.getElementById("help");
  var pauseEl = document.getElementById("pause");
  var results = document.getElementById("results");
  var sensMenu = document.getElementById("sens-menu");
  var sensPause = document.getElementById("sens-pause");

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
  scene.background = new THREE.Color(0xe7e1d6);
  scene.fog = new THREE.Fog(0xe7e1d6, 16, 30);
  var camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.08, 40);
  scene.add(camera);

  var carryAnchor = new THREE.Group();
  carryAnchor.position.set(0.34, -0.3, -0.68);
  camera.add(carryAnchor);

  var hemi = new THREE.HemisphereLight(0xfff6ea, 0x8d7a62, 0.78);
  scene.add(hemi);
  var sun = new THREE.DirectionalLight(0xfff8ee, 0.95);
  sun.position.set(3.5, 9.5, 2.5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -12;
  sun.shadow.camera.right = 12;
  sun.shadow.camera.top = 12;
  sun.shadow.camera.bottom = -12;
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 28;
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
  var player = { x: 0.15, z: 1.02 };
  var keys = {};
  var shiftLeft = SHIFT_SEC;
  var customer = null;
  var spawnAt = 0;
  var lockGive = 0;
  var coins = 0;
  var rating = 0;
  var stats = { served: 0, wrong: 0, late: 0 };
  var hovered = null;
  var carried = null;
  var toastUntil = 0;
  var menuT = 0;
  var pausedAt = 0;
  var mouseSens = 5;
  var customerGroup = null;
  var customerSprite = null;
  var doorPivot = null;
  var clockPrev = performance.now();

  function rand(n) { return Math.floor(Math.random() * n); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function lookSpeed() {
    return 0.00065 + (mouseSens - 1) * (0.0036 / 9);
  }

  function loadSens() {
    var v = 5;
    try { v = parseInt(localStorage.getItem(SENS_KEY), 10); } catch (e) { v = 5; }
    if (!(v >= 1 && v <= 10)) v = 5;
    applySens(v);
  }

  function applySens(v) {
    mouseSens = clamp(parseInt(v, 10) || 5, 1, 10);
    try { localStorage.setItem(SENS_KEY, String(mouseSens)); } catch (e) { /* private mode */ }
    sensMenu.value = String(mouseSens);
    sensPause.value = String(mouseSens);
    document.getElementById("sens-menu-val").textContent = String(mouseSens);
    document.getElementById("sens-pause-val").textContent = String(mouseSens);
  }

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
  var wallWarm = mat(0xefe6d6, { roughness: 0.9 });
  var trimMat = mat(0xc8bfae, { roughness: 0.9 });
  var counterMat = mat(0x243e5c, { roughness: 0.55, metalness: 0.08 });
  var counterTop = mat(0xd7d1c6, { roughness: 0.45 });
  var metal = mat(0xc5ccd4, { roughness: 0.35, metalness: 0.55 });
  var rubber = mat(0x2c3138, { roughness: 0.95 });
  var ceilMat = mat(0xf3efe6, { roughness: 1 });

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

  function floorTexture(c1, c2, tint) {
    var tex = paint(function (ctx, w, h) {
      ctx.fillStyle = tint;
      ctx.fillRect(0, 0, w, h);
      var s = 64;
      for (var y = 0; y < h; y += s) {
        for (var x = 0; x < w; x += s) {
          var alt = ((x / s + y / s) % 2) === 0;
          ctx.fillStyle = alt ? c1 : c2;
          ctx.fillRect(x, y, s, s);
        }
      }
    }, 512, 512);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1, 1);
    return tex;
  }

  // One mesh, rects meet at edges and never share area. Coplanar overlaps were the white floor stripes.
  function addSurface(rects, material, y, faceDown) {
    var positions = [];
    var uvs = [];
    var normals = [];
    var indices = [];
    var v = 0;
    var ny = faceDown ? -1 : 1;
    for (var i = 0; i < rects.length; i++) {
      var r = rects[i];
      var x0 = r.minX;
      var x1 = r.maxX;
      var z0 = r.minZ;
      var z1 = r.maxZ;
      positions.push(x0, y, z0, x1, y, z0, x1, y, z1, x0, y, z1);
      var tile = 3.2;
      uvs.push(x0 / tile, z0 / tile, x1 / tile, z0 / tile, x1 / tile, z1 / tile, x0 / tile, z1 / tile);
      normals.push(0, ny, 0, 0, ny, 0, 0, ny, 0, 0, ny, 0);
      if (faceDown) indices.push(v, v + 1, v + 2, v, v + 2, v + 3);
      else indices.push(v, v + 2, v + 1, v, v + 3, v + 2);
      v += 4;
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geo.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
    geo.setIndex(indices);
    var mesh = new THREE.Mesh(geo, material);
    mesh.castShadow = false;
    mesh.receiveShadow = !faceDown;
    scene.add(mesh);
    return mesh;
  }

  function wallX(x, z, lenZ) {
    return addBox(x, 1.6, z, 0.16, 3.2, lenZ, wallMat, { cast: false });
  }

  function wallZ(x, z, lenX, material) {
    return addBox(x, 1.6, z, lenX, 3.2, 0.16, material || wallMat, { cast: false });
  }

  function inPlayable(x, z) {
    if (x >= -6.45 && x <= 6.45 && z >= -6.85 && z <= -1.2) return true;
    if (x >= -5.25 && x <= -3.8 && z >= -1.35 && z <= 0.95) return true;
    if (x >= -5.25 && x <= 2.45 && z >= 0.86 && z <= 1.18) return true;
    return false;
  }

  function buildRoom() {
    var hallFloor = floorTexture("#d9d0c2", "#cfc4b4", "#c9bfb0");
    var storeFloor = floorTexture("#7d7268", "#6e655c", "#756b62");

    var storeRects = [
      { minX: -6.55, maxX: 6.55, minZ: -6.95, maxZ: -1.48 },
      { minX: -5.40, maxX: -3.80, minZ: -1.48, maxZ: 0.40 }
    ];
    var hallRects = [
      { minX: -6.45, maxX: 3.40, minZ: 0.40, maxZ: 1.52 },
      { minX: -6.45, maxX: -3.22, minZ: 1.52, maxZ: 5.50 },
      { minX: -3.22, maxX: 3.22, minZ: 1.52, maxZ: 5.50 },
      { minX: -0.98, maxX: 0.98, minZ: 5.50, maxZ: 7.05 },
      { minX: -3.80, maxX: 3.40, minZ: -1.48, maxZ: 0.40 }
    ];
    addSurface(storeRects, mat(0xffffff, { map: storeFloor, roughness: 0.95 }), 0, false);
    addSurface(hallRects, mat(0xffffff, {
      map: hallFloor,
      roughness: 0.95,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1
    }), 0, false);
    addSurface(storeRects.concat(hallRects), ceilMat, 3.18, true);

    function tall(box, material) {
      var sx = box.maxX - box.minX;
      var sz = box.maxZ - box.minZ;
      addBox((box.minX + box.maxX) / 2, 1.6, (box.minZ + box.maxZ) / 2, Math.max(sx, 0.02), 3.2, Math.max(sz, 0.02), material || wallMat, { cast: false });
      blocks.push(box);
    }

    var shell = [
      { minX: 3.22, maxX: 3.42, minZ: 1.5, maxZ: 5.65 },
      { minX: -6.7, maxX: -6.5, minZ: 1.52, maxZ: 5.7 },
      { minX: -6.7, maxX: -0.72, minZ: 5.5, maxZ: 5.7 },
      { minX: 0.72, maxX: 3.42, minZ: 5.5, maxZ: 5.7 },
      { minX: -1.18, maxX: -0.98, minZ: 5.65, maxZ: 7.2 },
      { minX: 0.98, maxX: 1.18, minZ: 5.65, maxZ: 7.2 },
      { minX: -1.18, maxX: 1.18, minZ: 7.05, maxZ: 7.25 },
      { minX: -6.5, maxX: -3.22, minZ: 1.52, maxZ: 1.72 },
      { minX: 3.22, maxX: 3.5, minZ: 1.52, maxZ: 1.72 },
      { minX: -6.7, maxX: -5.35, minZ: 0.3, maxZ: 0.5 },
      { minX: 3.40, maxX: 3.56, minZ: -1.48, maxZ: 1.52 },
      { minX: -5.55, maxX: -5.35, minZ: -1.45, maxZ: 0.5 },
      { minX: -3.9, maxX: -3.7, minZ: -0.35, maxZ: 0.5 },
      { minX: -4.55, maxX: -3.7, minZ: -1.25, maxZ: -1.05 },
      { minX: -4.6, maxX: -4.4, minZ: -2.35, maxZ: -1.05 },
      { minX: -6.75, maxX: -5.45, minZ: -1.48, maxZ: -1.28 },
      { minX: -4.22, maxX: 6.75, minZ: -1.48, maxZ: -1.28 },
      { minX: -6.75, maxX: 6.75, minZ: -7.15, maxZ: -6.95 },
      { minX: -6.75, maxX: -6.55, minZ: -7.15, maxZ: -1.28 },
      { minX: 6.55, maxX: 6.75, minZ: -7.15, maxZ: -1.28 }
    ];
    for (var i = 0; i < shell.length; i++) tall(shell[i], wallWarm);

    blocks.push({ minX: -1.48, maxX: 2.28, minZ: 1.52, maxZ: 1.92 });
    addBox(0.4, 0.52, 1.64, 3.6, 1.04, 0.36, counterMat);
    addBox(0.4, 1.06, 1.66, 3.76, 0.08, 0.48, counterTop);
    addBox(-1.48, 1.6, 1.62, 0.16, 3.2, 0.20, wallWarm, { cast: false });
    addBox(2.28, 1.6, 1.62, 0.16, 3.2, 0.20, wallWarm, { cast: false });
    addBox(0.4, 2.52, 1.62, 3.76, 0.48, 0.20, wallWarm, { cast: false });
    addBox(0.4, 0.012, 3.15, 2.1, 0.016, 0.85, rubber, { cast: false });
    addBox(-1.05, 1.12, 1.55, 0.12, 0.07, 0.12, mat(0xd4a017, { metalness: 0.6, roughness: 0.3 }));

    [-2.2, 2.1].forEach(function (x) {
      addBox(x, 3.12, -4.0, 1.5, 0.06, 0.34, mat(0xfff4d2, {
        emissive: 0xfff1c9,
        emissiveIntensity: 0.62,
        roughness: 0.4
      }), { cast: false, receive: false });
    });
    addBox(-4.7, 3.12, -0.2, 0.7, 0.05, 0.7, mat(0xfff4d2, {
      emissive: 0xfff1c9,
      emissiveIntensity: 0.5,
      roughness: 0.4
    }), { cast: false, receive: false });
    addBox(0.2, 3.12, 3.6, 1.7, 0.06, 0.34, mat(0xfff4d2, {
      emissive: 0xfff1c9,
      emissiveIntensity: 0.7,
      roughness: 0.4
    }), { cast: false, receive: false });

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
    var signMesh = new THREE.Mesh(new THREE.PlaneGeometry(2.05, 0.52), mat(0xffffff, { map: sign, roughness: 0.6 }));
    signMesh.position.set(0.4, 2.08, 1.92);
    scene.add(signMesh);

    var storeSign = paint(function (ctx, w, h) {
      ctx.fillStyle = "#1f4b78";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#f6f0e6";
      ctx.font = "800 78px Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("← СКЛАД", w / 2, h / 2 + 4);
    }, 640, 200);
    var storePlate = new THREE.Mesh(
      new THREE.PlaneGeometry(0.95, 0.3),
      mat(0xffffff, { map: storeSign, roughness: 0.55 })
    );
    storePlate.position.set(-2.15, 1.85, 1.5);
    storePlate.rotation.y = Math.PI;
    scene.add(storePlate);

    addBox(-0.86, 1.15, 5.6, 0.1, 2.3, 0.16, woodDark, { cast: false });
    addBox(0.86, 1.15, 5.6, 0.1, 2.3, 0.16, woodDark, { cast: false });
    addBox(0, 2.32, 5.6, 1.85, 0.14, 0.16, woodDark, { cast: false });

    doorPivot = new THREE.Group();
    doorPivot.position.set(-0.7, 0, 5.6);
    var door = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.15, 0.06), mat(0x6e543c, { roughness: 0.72 }));
    door.position.set(0.7, 1.1, 0);
    door.castShadow = true;
    doorPivot.add(door);
    var knob = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.06), metal);
    knob.position.set(1.22, 1.05, 0.05);
    doorPivot.add(knob);
    var glass = new THREE.Mesh(
      new THREE.BoxGeometry(0.36, 0.72, 0.02),
      mat(0xc9d7e4, { roughness: 0.15, metalness: 0.05, transparent: true, opacity: 0.55 })
    );
    glass.position.set(0.68, 1.45, 0);
    doorPivot.add(glass);
    scene.add(doorPivot);

    addBox(-2.55, 0.45, 4.55, 0.46, 0.9, 0.46, mat(0x8a5a32, { roughness: 0.85 }));
    addBox(-2.55, 1.15, 4.55, 0.72, 0.55, 0.72, mat(0x3d8a52, { roughness: 0.75 }));

    buildCustomer();
  }

  function buildCustomer() {
    customerGroup = new THREE.Group();
    customerGroup.position.set(0, 0, 6.5);
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
    customerSprite = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthTest: true }));
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
    addShelfUnit(-2.05, -6.35, "pz", 4, 3);
    addShelfUnit(2.15, -6.35, "pz", 4, 3);
    addShelfUnit(-6.05, -4.15, "px", 4, 3);
    addShelfUnit(6.05, -3.7, "nx", 4, 3);
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

  function destroyMesh(mesh) {
    if (!mesh) return;
    if (mesh.parent) mesh.parent.remove(mesh);
    scene.remove(mesh);
    if (mesh.material && mesh.material.map) mesh.material.map.dispose();
    if (mesh.material) mesh.material.dispose();
  }

  function clearParcels() {
    if (carried) {
      destroyMesh(carried.mesh);
      carried = null;
    }
    for (var i = 0; i < parcels.length; i++) destroyMesh(parcels[i].mesh);
    parcels.length = 0;
    for (var c = 0; c < cells.length; c++) cells[c].parcels.length = 0;
    hovered = null;
    carryAnchor.visible = false;
  }

  function stock(count) {
    var used = {};
    for (var i = 0; i < parcels.length; i++) used[parcels[i].article] = true;
    if (carried) used[carried.article] = true;
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

  function detachFromCell(parcel) {
    var cell = parcel.cell;
    var pi = parcels.indexOf(parcel);
    if (pi >= 0) parcels.splice(pi, 1);
    if (cell) {
      var ci = cell.parcels.indexOf(parcel);
      if (ci >= 0) cell.parcels.splice(ci, 1);
      layoutCell(cell);
    }
    if (hovered === parcel) hovered = null;
  }

  function pickup(parcel) {
    detachFromCell(parcel);
    if (parcel.mesh.parent) parcel.mesh.parent.remove(parcel.mesh);
    scene.remove(parcel.mesh);
    parcel.mesh.material.emissive.setHex(0x000000);
    parcel.mesh.scale.set(1, 1, 1);
    parcel.mesh.rotation.set(0.15, 0.5, 0.05);
    parcel.mesh.position.set(0, 0, 0);
    parcel.mesh.castShadow = false;
    carryAnchor.add(parcel.mesh);
    carryAnchor.visible = true;
    carried = parcel;
    showToast("Взяли " + parcel.article);
    beep(520, 0.06);
  }

  function returnCarried(silent) {
    if (!carried) return false;
    var cell = carried.cell;
    if (!cell || cell.parcels.length >= 2) {
      cell = null;
      for (var i = 0; i < cells.length; i++) {
        if (cells[i].parcels.length < 2) { cell = cells[i]; break; }
      }
    }
    if (!cell) {
      showToast("Нет места на полке");
      return false;
    }
    carryAnchor.remove(carried.mesh);
    scene.add(carried.mesh);
    carried.mesh.castShadow = true;
    carried.mesh.material.emissive.setHex(0x000000);
    carried.mesh.scale.set(1, 1, 1);
    carried.mesh.rotation.set(0, Math.abs(cell.normal[0]) > 0.5 ? Math.PI / 2 : 0, 0);
    carried.cell = cell;
    cell.parcels.push(carried);
    parcels.push(carried);
    layoutCell(cell);
    carried = null;
    carryAnchor.visible = false;
    if (!silent) showToast("Посылка снова на полке");
    return true;
  }

  function blocked(x, z) {
    if (!inPlayable(x, z)) return true;
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
    var carry = document.getElementById("hud-carry");
    if (!customer) {
      who.textContent = "Стойка пустая";
      article.textContent = "Ждём клиента";
      bar.style.width = "0%";
      bar.style.background = "#b9b1a4";
    } else if (customer.phase === "enter") {
      who.textContent = "Клиент заходит в зал";
      article.textContent = customer.article;
      bar.style.width = "100%";
      bar.style.background = "#1f4b78";
    } else if (customer.phase === "leave") {
      who.textContent = "Клиент уходит";
      article.textContent = "—";
      bar.style.width = "0%";
      bar.style.background = "#b9b1a4";
    } else {
      who.textContent = carried ? "Отнесите посылку клиенту" : "Найдите посылку на складе";
      article.textContent = customer.article;
      var ratio = clamp((customer.deadline - performance.now()) / (CUSTOMER_SEC * 1000), 0, 1);
      bar.style.width = (ratio * 100) + "%";
      bar.style.background = ratio < 0.3 ? "#a33b32" : "#2f7d4a";
    }
    if (!carried) {
      carry.textContent = "В руках: пусто";
      carry.style.color = "#5c5144";
    } else {
      carry.textContent = "В руках: " + carried.article;
      carry.style.color = customer && customer.phase === "wait" && carried.article === customer.article ? "#2f7d4a" : "#8a5a2a";
    }
  }

  function hideCustomer() {
    customer = null;
    customerGroup.visible = false;
    customerSprite.visible = false;
  }

  function spawnCustomer() {
    if (mode !== "play" || customer || !parcels.length) return;
    var pick = parcels[rand(parcels.length)];
    var spotX = (Math.random() * 1.5 - 0.75);
    customer = {
      article: pick.article,
      phase: "enter",
      deadline: 0,
      x: 0.05,
      z: 6.55,
      spot: { x: spotX, z: 3.2 },
      door: { x: 0.05, z: 6.55 }
    };
    var colors = [0x2f6fad, 0xb05a28, 0x2f7d4a, 0x6d4c93, 0xa33b32];
    setCustomerColor(colors[rand(colors.length)]);
    customerGroup.visible = true;
    customerGroup.position.set(customer.x, 0, customer.z);
    customerGroup.rotation.y = 0;
    customerSprite.visible = true;
    setSprite(pick.article);
    updateHud();
  }

  function beginLeave() {
    if (!customer) return;
    customer.phase = "leave";
    customer.deadline = 0;
    customerSprite.visible = false;
    updateHud();
  }

  function finishHandoff(correct) {
    var mesh = carried.mesh;
    carried = null;
    carryAnchor.visible = false;
    destroyMesh(mesh);
    if (correct) {
      coins += REWARD;
      rating += 1;
      stats.served += 1;
      showToast("+" + REWARD + " монет, +1 рейтинг", "#b7f0c8");
      beep(660, 0.08);
      setTimeout(function () { beep(880, 0.1); }, 90);
      if (parcels.length < 6) stock(4);
    } else {
      coins = Math.max(0, coins - PENALTY);
      stats.wrong += 1;
      showToast("Неверная посылка, −" + PENALTY + " монет", "#ffb4ae");
      beep(196, 0.16);
    }
    beginLeave();
  }

  function onLate() {
    rating = Math.max(0, rating - 1);
    stats.late += 1;
    showToast("Клиент ушёл, −1 рейтинг", "#ffd0a8");
    beep(150, 0.18);
    beginLeave();
  }

  function tickCustomer(dt, now) {
    if (!customer) return;
    var target = customer.phase === "leave" ? customer.door : customer.spot;
    var dx = target.x - customer.x;
    var dz = target.z - customer.z;
    var dist = Math.hypot(dx, dz);
    if (customer.phase !== "wait" && dist > 0.04) {
      var step = Math.min(dist, 1.65 * dt);
      customer.x += dx / dist * step;
      customer.z += dz / dist * step;
      customerGroup.rotation.y = Math.atan2(-dx, -dz);
    } else if (customer.phase === "enter") {
      customer.phase = "wait";
      customer.deadline = now + CUSTOMER_SEC * 1000;
      customerGroup.rotation.y = 0;
      updateHud();
    } else if (customer.phase === "leave") {
      hideCustomer();
      spawnAt = now + 900 + Math.random() * 700;
      updateHud();
      return;
    }
    customerGroup.position.set(customer.x, customer.phase === "wait" ? Math.sin(now * 0.003) * 0.012 : 0, customer.z);
    var open = customer && customer.z > 5.2;
    var angle = open ? 1.2 : 0;
    doorPivot.rotation.y += (angle - doorPivot.rotation.y) * Math.min(1, dt * 5);
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

  function customerMeshes() {
    var list = [];
    var ch = customerGroup.children;
    for (var i = 0; i < ch.length; i++) if (ch[i].isMesh) list.push(ch[i]);
    return list;
  }

  function nearCustomer() {
    if (!customer) return false;
    return Math.hypot(player.x - customer.x, player.z - customer.z) < 2.7;
  }

  function rayHitsCustomer() {
    if (!customerGroup.visible || !nearCustomer()) return false;
    raycaster.far = 3.4;
    raycaster.setFromCamera(center, camera);
    return raycaster.intersectObjects(customerMeshes(), false).length > 0;
  }

  function inServiceSpot() {
    if (player.z < 0.86 || player.z > 1.18) return false;
    if (player.x < -1.15 || player.x > 2.05) return false;
    var d = Math.atan2(Math.sin(yaw - Math.PI), Math.cos(yaw - Math.PI));
    return Math.abs(d) < 0.85 && pitch > -1.0 && pitch < 0.65;
  }

  function setHover(parcel) {
    if (hovered === parcel) return;
    if (hovered && hovered !== carried) {
      hovered.mesh.material.emissive.setHex(0x000000);
      hovered.mesh.scale.set(1, 1, 1);
    }
    hovered = parcel;
    if (hovered) {
      hovered.mesh.material.emissive.setHex(0x3a2a16);
      hovered.mesh.scale.set(1.05, 1.05, 1.05);
    }
  }

  function tryInteract() {
    if (mode !== "play") return;
    if (performance.now() < lockGive) return;
    var parcel = pickParcel();
    if (parcel) {
      lockGive = performance.now() + 250;
      if (carried) {
        var held = carried;
        if (!returnCarried(true)) return;
        if (parcel !== held) pickup(parcel);
      } else {
        pickup(parcel);
      }
      return;
    }
    var waiting = customer && customer.phase === "wait";
    if (waiting && (rayHitsCustomer() || (carried && inServiceSpot() && nearCustomer()))) {
      lockGive = performance.now() + 350;
      if (!carried) {
        showToast("Сначала возьмите посылку со склада");
        beep(240, 0.07);
        return;
      }
      finishHandoff(carried.article === customer.article);
    }
  }

  function showPlayChrome() {
    hud.style.display = "block";
    crosshair.style.display = "block";
  }

  function startShift() {
    clearParcels();
    stock(13);
    coins = 0;
    rating = 0;
    stats.served = 0;
    stats.wrong = 0;
    stats.late = 0;
    hideCustomer();
    if (doorPivot) doorPivot.rotation.y = 0;
    shiftLeft = SHIFT_SEC;
    player.x = 0.15;
    player.z = 1.02;
    yaw = Math.PI;
    pitch = -0.06;
    mode = "play";
    spawnAt = performance.now() + 600;
    menu.classList.add("hidden");
    help.classList.add("hidden");
    pauseEl.classList.add("hidden");
    results.classList.add("hidden");
    showPlayChrome();
    applyLook();
    updateHud();
  }

  function endShift() {
    if (mode !== "play" && mode !== "pause") return;
    mode = "results";
    if (document.pointerLockElement) document.exitPointerLock();
    crosshair.style.display = "none";
    hud.style.display = "none";
    hint.style.display = "none";
    toastEl.style.display = "none";
    pauseEl.classList.add("hidden");
    setHover(null);
    document.getElementById("res-served").textContent = "Выдано верно: " + stats.served;
    document.getElementById("res-wrong").textContent = "Ошибок: " + stats.wrong;
    document.getElementById("res-late").textContent = "Не успели: " + stats.late;
    document.getElementById("res-coins").textContent = "Монеты: " + coins;
    document.getElementById("res-rating").textContent = "Рейтинг: " + rating;
    results.classList.remove("hidden");
  }

  function openPause() {
    if (mode !== "play") return;
    mode = "pause";
    pausedAt = performance.now();
    keys = {};
    pauseEl.classList.remove("hidden");
    hint.style.display = "none";
    crosshair.style.display = "none";
  }

  function toMenu() {
    mode = "menu";
    if (document.pointerLockElement) document.exitPointerLock();
    hideCustomer();
    if (doorPivot) doorPivot.rotation.y = 0;
    crosshair.style.display = "none";
    hud.style.display = "none";
    hint.style.display = "none";
    results.classList.add("hidden");
    help.classList.add("hidden");
    pauseEl.classList.add("hidden");
    menu.classList.remove("hidden");
    setHover(null);
  }

  function updatePrompt() {
    if (mode !== "play") return;
    if (document.pointerLockElement !== canvas) {
      hint.textContent = "Кликните по экрану, чтобы смотреть мышью";
      hint.style.display = "block";
      return;
    }
    var parcel = pickParcel();
    if (parcel) {
      hint.textContent = carried ? ("Заменить на " + parcel.article) : ("Взять " + parcel.article);
      hint.style.display = "block";
      return;
    }
    if (customer && customer.phase === "wait" && (rayHitsCustomer() || (inServiceSpot() && nearCustomer()))) {
      hint.textContent = carried ? ("Отдать клиенту " + carried.article) : "Сначала возьмите посылку со склада";
      hint.style.display = "block";
      return;
    }
    if (carried) {
      hint.textContent = "В руках " + carried.article + ". Правая кнопка — на полку";
      hint.style.display = "block";
      return;
    }
    hint.style.display = "none";
  }

  sensMenu.addEventListener("input", function () { applySens(sensMenu.value); });
  sensPause.addEventListener("input", function () { applySens(sensPause.value); });
  loadSens();

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
  document.getElementById("btn-pause-menu").addEventListener("click", toMenu);
  document.getElementById("btn-resume").addEventListener("click", function () {
    if (mode !== "pause") return;
    var lock = canvas.requestPointerLock();
    if (lock && lock.catch) lock.catch(function () {});
  });

  canvas.addEventListener("click", function () {
    if (mode !== "play" && mode !== "pause") return;
    if (document.pointerLockElement !== canvas) {
      var lock = canvas.requestPointerLock();
      if (lock && lock.catch) lock.catch(function () {});
    }
  });
  document.addEventListener("mousedown", function (e) {
    if (document.pointerLockElement !== canvas || mode !== "play") return;
    if (e.button === 2) {
      returnCarried(false);
      return;
    }
    if (e.button !== 0) return;
    tryInteract();
  });
  document.addEventListener("mousemove", function (e) {
    if (document.pointerLockElement !== canvas || mode !== "play") return;
    var speed = lookSpeed();
    yaw -= e.movementX * speed;
    pitch -= e.movementY * speed;
    pitch = clamp(pitch, -1.2, 1.2);
  });
  document.addEventListener("pointerlockchange", function () {
    var locked = document.pointerLockElement === canvas;
    if (locked && mode === "pause") {
      var delta = performance.now() - pausedAt;
      spawnAt += delta;
      if (customer && customer.deadline) customer.deadline += delta;
      mode = "play";
      pauseEl.classList.add("hidden");
      showPlayChrome();
      hint.style.display = "none";
    } else if (!locked && mode === "play") {
      openPause();
    }
  });
  document.addEventListener("keydown", function (e) {
    keys[e.code] = true;
    if (mode === "play" && (e.code === "KeyW" || e.code === "KeyA" || e.code === "KeyS" || e.code === "KeyD" || e.code === "KeyR")) {
      e.preventDefault();
    }
    if (e.code === "KeyR" && mode === "play" && document.pointerLockElement === canvas) returnCarried(false);
  });
  document.addEventListener("keyup", function (e) { keys[e.code] = false; });
  window.addEventListener("blur", function () { keys = {}; });
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
        mx = mx / len * 3.15 * dt;
        mz = mz / len * 3.15 * dt;
        if (!blocked(player.x + mx, player.z)) player.x += mx;
        if (!blocked(player.x, player.z + mz)) player.z += mz;
      }
      applyLook();
      shiftLeft -= dt;
      tickCustomer(dt, now);
      if (customer && customer.phase === "wait" && now >= customer.deadline) onLate();
      else if (!customer && now >= spawnAt && shiftLeft > 2) spawnCustomer();
      if (shiftLeft <= 0) endShift();
      else {
        setHover(document.pointerLockElement === canvas ? pickParcel() : null);
        updateHud();
        updatePrompt();
      }
    } else if (mode === "pause") {
      applyLook();
      if (customer && customer.phase !== "wait") tickCustomer(0, now);
      if (doorPivot && (!customer || customer.z <= 5.2)) {
        doorPivot.rotation.y += (0 - doorPivot.rotation.y) * Math.min(1, dt * 5);
      }
    } else {
      menuT += dt;
      camera.position.set(Math.sin(menuT * 0.22) * 0.22, 1.7, 4.72);
      camera.lookAt(0.35, 1.2, 1.9);
      if (doorPivot) {
        var swing = (Math.sin(menuT * 0.7) > 0.55) ? 1.05 : 0;
        doorPivot.rotation.y += (swing - doorPivot.rotation.y) * Math.min(1, dt * 3);
      }
      if (!customer) {
        customerGroup.visible = true;
        customerGroup.position.set(0.05, 0, 3.2);
        customerGroup.rotation.y = 0;
      }
    }

    if (toastEl.style.display === "block" && now > toastUntil) toastEl.style.display = "none";
    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  }

  buildRoom();
  buildShelves();
  stock(13);
  if (!customer) {
    customerGroup.visible = true;
    customerGroup.position.set(0.05, 0, 3.2);
    customerSprite.visible = false;
  }
  requestAnimationFrame(tick);
})();
