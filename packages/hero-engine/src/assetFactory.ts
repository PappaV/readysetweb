import * as THREE from "three";
import { glassMaterial, metalMaterial, satinMaterial, matteMaterial, woodMaterial, stoneMaterial, ceramicMaterial, emissiveMaterial } from "./materials";

export type ProceduralAssetId =
  | "serum-bottle"
  | "modern-house"
  | "luxury-development"
  | "boutique-hotel-lobby"
  | "mountain-lodge"
  | "landscape"
  | "sparkle"
  | "floating-orbs"
  | "laser-wand"
  | "facial-cleanser"
  | "spa-lotus"
  | "droplet-orb"
  | "townhouse-row"
  | "keys-home"
  | "neighborhood-scene"
  | "skyline-towers"
  | "gated-estate"
  | "hotel-suite"
  | "poolside-villa"
  | "safari-tent"
  | "campfire-cabin";

const palette = {
  gold: 0xd4af37,
  rose: 0xc4789e,
  deepRose: 0x9b4f6f,
  cream: 0xf5f0e8,
  stone: 0x8a8a8a,
  charcoal: 0x2b2b2b,
  warmWhite: 0xfdfaf5,
  glass: 0xd8e8f0,
  leaf: 0x5a7d5a,
  wood: 0x8b5e3c,
  terracotta: 0xc47a5a,
  sky: 0x9ec8e8,
  white: 0xffffff,
};

function applyMaterial(mesh: THREE.Mesh, material: THREE.Material) {
  mesh.material = material;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function roundedBox(w: number, h: number, d: number, seg = 1): THREE.Mesh {
  const geo = new THREE.BoxGeometry(w, h, d, seg, seg, seg);
  return new THREE.Mesh(geo);
}

export function buildSerumBottle(): THREE.Group {
  const group = new THREE.Group();

  const body = roundedBox(0.9, 1.7, 0.9, 2);
  applyMaterial(body, glassMaterial({ color: palette.rose, thickness: 1.4 }));
  body.position.y = 0;
  group.add(body);

  const neck = new THREE.CylinderGeometry(0.22, 0.26, 0.35, 24);
  const neckMesh = new THREE.Mesh(neck);
  applyMaterial(neckMesh, metalMaterial(palette.gold, 0.15));
  neckMesh.position.y = 1.02;
  group.add(neckMesh);

  const cap = new THREE.CylinderGeometry(0.28, 0.28, 0.22, 24);
  const capMesh = new THREE.Mesh(cap);
  applyMaterial(capMesh, satinMaterial(palette.charcoal, 0.3));
  capMesh.position.y = 1.3;
  group.add(capMesh);

  const liquid = roundedBox(0.75, 1.0, 0.75, 2);
  applyMaterial(liquid, glassMaterial({ color: palette.deepRose, thickness: 0.6, roughness: 0.02 }));
  liquid.position.y = -0.2;
  liquid.scale.setScalar(0.85);
  group.add(liquid);

  const droplet = new THREE.SphereGeometry(0.16, 32, 32);
  const dropletMesh = new THREE.Mesh(droplet);
  applyMaterial(dropletMesh, glassMaterial({ color: palette.glass, thickness: 0.4 }));
  dropletMesh.position.set(0.75, 0.9, 0);
  group.add(dropletMesh);

  const ring = new THREE.TorusGeometry(0.5, 0.03, 12, 48);
  const ringMesh = new THREE.Mesh(ring);
  applyMaterial(ringMesh, metalMaterial(palette.gold, 0.1));
  ringMesh.position.set(0, -1.05, 0);
  ringMesh.rotation.x = Math.PI / 2;
  group.add(ringMesh);

  const ring2 = ringMesh.clone();
  ring2.position.set(0, -0.2, 0);
  ring2.rotation.x = Math.PI / 2;
  ring2.rotation.z = 0.6;
  ring2.scale.setScalar(0.8);
  group.add(ring2);

  group.userData.autoRotate = 0.4;
  group.userData.floatAmount = 0.15;
  return group;
}

export function buildModernHouse(): THREE.Group {
  const group = new THREE.Group();

  const base = roundedBox(3.2, 1.6, 2.6, 1);
  applyMaterial(base, matteMaterial(palette.cream, 0.5));
  base.position.y = 0.8;
  group.add(base);

  const roof = new THREE.ConeGeometry(2.6, 1.4, 4);
  const roofMesh = new THREE.Mesh(roof);
  applyMaterial(roofMesh, stoneMaterial(palette.charcoal, 0.6));
  roofMesh.position.y = 2.3;
  roofMesh.rotation.y = Math.PI / 4;
  group.add(roofMesh);

  const window = roundedBox(0.6, 0.8, 0.1, 1);
  applyMaterial(window, glassMaterial({ color: palette.sky, thickness: 0.2 }));
  window.position.set(1.1, 1.2, 1.31);
  group.add(window);

  const window2 = window.clone();
  window2.position.set(-1.1, 1.2, 1.31);
  group.add(window2);

  const door = roundedBox(0.7, 1.1, 0.1, 1);
  applyMaterial(door, woodMaterial(palette.wood));
  door.position.set(0, 0.55, 1.31);
  group.add(door);

  const chimney = roundedBox(0.4, 0.9, 0.4, 1);
  applyMaterial(chimney, stoneMaterial(palette.stone, 0.7));
  chimney.position.set(1.2, 2.6, -0.7);
  group.add(chimney);

  const ground = new THREE.CylinderGeometry(3.4, 3.4, 0.1, 32);
  const groundMesh = new THREE.Mesh(ground);
  applyMaterial(groundMesh, matteMaterial(palette.leaf, 0.9));
  groundMesh.position.y = -0.05;
  groundMesh.rotation.x = Math.PI / 2;
  group.add(groundMesh);

  group.userData.autoRotate = 0.15;
  group.userData.floatAmount = 0.05;
  return group;
}

export function buildLuxuryDevelopment(): THREE.Group {
  const group = new THREE.Group();

  const tower1 = roundedBox(1.6, 4.4, 1.6, 2);
  applyMaterial(tower1, stoneMaterial(palette.stone, 0.25));
  tower1.position.set(-1.4, 2.2, 0);
  group.add(tower1);

  const tower2 = roundedBox(1.9, 5.2, 1.9, 2);
  applyMaterial(tower2, satinMaterial(palette.charcoal, 0.2));
  tower2.position.set(0.9, 2.6, 0);
  group.add(tower2);

  const podium = roundedBox(6.4, 0.8, 4.4, 1);
  applyMaterial(podium, matteMaterial(palette.warmWhite, 0.4));
  podium.position.y = 0.4;
  group.add(podium);

  const glassStrip1 = roundedBox(1.6, 0.3, 0.1, 1);
  applyMaterial(glassStrip1, glassMaterial({ color: palette.sky, thickness: 0.15 }));
  for (let i = 0; i < 5; i++) {
    const strip = glassStrip1.clone();
    strip.position.set(-1.4, 0.8 + i * 0.85, 0.81);
    group.add(strip);
  }

  const glassStrip2 = roundedBox(1.9, 0.3, 0.1, 1);
  applyMaterial(glassStrip2, glassMaterial({ color: palette.sky, thickness: 0.15 }));
  for (let i = 0; i < 6; i++) {
    const strip = glassStrip2.clone();
    strip.position.set(0.9, 0.9 + i * 0.85, 0.96);
    group.add(strip);
  }

  group.userData.autoRotate = 0.12;
  group.userData.floatAmount = 0.03;
  return group;
}

export function buildBoutiqueHotelLobby(): THREE.Group {
  const group = new THREE.Group();

  const floor = new THREE.CylinderGeometry(3, 3, 0.15, 32);
  const floorMesh = new THREE.Mesh(floor);
  applyMaterial(floorMesh, ceramicMaterial(palette.warmWhite));
  floorMesh.position.y = 0;
  floorMesh.rotation.x = Math.PI / 2;
  group.add(floorMesh);

  const column1 = new THREE.CylinderGeometry(0.18, 0.18, 3.6, 16);
  const columnMesh1 = new THREE.Mesh(column1);
  applyMaterial(columnMesh1, metalMaterial(palette.charcoal, 0.25));
  columnMesh1.position.set(-1.4, 1.8, -1.2);
  group.add(columnMesh1);

  const columnMesh2 = columnMesh1.clone();
  columnMesh2.position.set(1.4, 1.8, -1.2);
  group.add(columnMesh2);

  const arch = new THREE.TorusGeometry(0.9, 0.1, 12, 32, Math.PI);
  const archMesh = new THREE.Mesh(arch);
  applyMaterial(archMesh, metalMaterial(palette.gold, 0.15));
  archMesh.position.set(0, 1.9, 0);
  group.add(archMesh);

  const chandelier = new THREE.SphereGeometry(0.28, 24, 24);
  const chandelierMesh = new THREE.Mesh(chandelier);
  applyMaterial(chandelierMesh, emissiveMaterial(palette.gold, 1.5));
  chandelierMesh.position.set(0, 3.4, 0);
  group.add(chandelierMesh);

  const glowLight = new THREE.PointLight(0xffe9b0, 6, 6);
  glowLight.position.set(0, 3.4, 0);
  group.add(glowLight);

  const table = new THREE.CylinderGeometry(0.6, 0.7, 0.15, 24);
  const tableMesh = new THREE.Mesh(table);
  applyMaterial(tableMesh, woodMaterial(palette.wood));
  tableMesh.position.set(0, 0.6, 1.1);
  group.add(tableMesh);

  const vase = new THREE.CylinderGeometry(0.18, 0.24, 0.5, 16);
  const vaseMesh = new THREE.Mesh(vase);
  applyMaterial(vaseMesh, glassMaterial({ color: palette.glass, thickness: 0.3 }));
  vaseMesh.position.set(0, 0.95, 1.1);
  group.add(vaseMesh);

  group.userData.autoRotate = 0.18;
  group.userData.floatAmount = 0.03;
  return group;
}

export function buildMountainLodge(): THREE.Group {
  const group = new THREE.Group();

  const body = roundedBox(3, 1.7, 2.4, 1);
  applyMaterial(body, woodMaterial(palette.wood));
  body.position.y = 0.85;
  group.add(body);

  const roof = new THREE.ConeGeometry(2.5, 1.6, 4);
  const roofMesh = new THREE.Mesh(roof);
  applyMaterial(roofMesh, matteMaterial(palette.terracotta, 0.5));
  roofMesh.position.y = 2.5;
  roofMesh.rotation.y = Math.PI / 4;
  group.add(roofMesh);

  const chimney = roundedBox(0.35, 1.1, 0.35, 1);
  applyMaterial(chimney, stoneMaterial(palette.stone, 0.8));
  chimney.position.set(1.2, 2.6, -0.8);
  group.add(chimney);

  const mountain1 = new THREE.ConeGeometry(2.4, 3.2, 6);
  const mountainMesh1 = new THREE.Mesh(mountain1);
  applyMaterial(mountainMesh1, stoneMaterial(palette.charcoal, 0.9));
  mountainMesh1.position.set(-3.2, 1.6, -3);
  group.add(mountainMesh1);

  const mountain2 = new THREE.ConeGeometry(3.4, 4.2, 6);
  const mountainMesh2 = new THREE.Mesh(mountain2);
  applyMaterial(mountainMesh2, stoneMaterial(palette.stone, 0.9));
  mountainMesh2.position.set(3.6, 2.1, -3.5);
  group.add(mountainMesh2);

  const ground = new THREE.CylinderGeometry(4, 4, 0.12, 32);
  const groundMesh = new THREE.Mesh(ground);
  applyMaterial(groundMesh, matteMaterial(0xe8f0e8, 0.9));
  groundMesh.position.y = -0.06;
  groundMesh.rotation.x = Math.PI / 2;
  group.add(groundMesh);

  const fireLight = new THREE.PointLight(0xff9a3c, 4, 8);
  fireLight.position.set(0, 0.8, 1.6);
  group.add(fireLight);

  group.userData.autoRotate = 0.1;
  group.userData.floatAmount = 0.03;
  return group;
}

export function buildLaserWand(): THREE.Group {
  const group = new THREE.Group();
  const body = new THREE.CylinderGeometry(0.09, 0.09, 2.2, 24);
  const bodyMesh = new THREE.Mesh(body);
  applyMaterial(bodyMesh, metalMaterial(palette.charcoal, 0.3));
  bodyMesh.position.y = 0.3;
  bodyMesh.rotation.z = Math.PI / 2.4;
  group.add(bodyMesh);

  const tip = new THREE.ConeGeometry(0.14, 0.4, 24);
  const tipMesh = new THREE.Mesh(tip);
  applyMaterial(tipMesh, glassMaterial({ color: palette.sky, thickness: 0.5 }));
  tipMesh.position.set(1.15, -0.25, 0);
  tipMesh.rotation.z = Math.PI / 2;
  group.add(tipMesh);

  const beam = new THREE.CylinderGeometry(0.02, 0.02, 1.6, 12);
  const beamMesh = new THREE.Mesh(beam);
  applyMaterial(beamMesh, emissiveMaterial(0x9ec8ff, 2.5));
  beamMesh.position.set(2.0, -0.45, 0);
  group.add(beamMesh);

  const gripRing = new THREE.TorusGeometry(0.12, 0.02, 12, 32);
  const ringMesh = new THREE.Mesh(gripRing);
  applyMaterial(ringMesh, metalMaterial(palette.gold, 0.2));
  ringMesh.position.set(0.1, 0.4, 0);
  ringMesh.rotation.y = Math.PI / 2;
  group.add(ringMesh);

  group.userData.autoRotate = 0.5;
  group.userData.floatAmount = 0.18;
  return group;
}

export function buildFacialCleanser(): THREE.Group {
  const group = new THREE.Group();
  const pump = new THREE.CylinderGeometry(0.18, 0.18, 0.7, 24);
  const pumpMesh = new THREE.Mesh(pump);
  applyMaterial(pumpMesh, matteMaterial(palette.cream, 0.4));
  pumpMesh.position.y = 0.9;
  group.add(pumpMesh);

  const nozzle = new THREE.CylinderGeometry(0.06, 0.06, 0.4, 12);
  const nozzleMesh = new THREE.Mesh(nozzle);
  applyMaterial(nozzleMesh, metalMaterial(palette.gold, 0.2));
  nozzleMesh.position.set(0.12, 1.25, 0);
  nozzleMesh.rotation.z = Math.PI / 4;
  group.add(nozzleMesh);

  const bottle = roundedBox(0.8, 1.1, 0.8, 2);
  applyMaterial(bottle, glassMaterial({ color: palette.rose, thickness: 0.9 }));
  bottle.position.y = -0.1;
  group.add(bottle);

  const liquid = roundedBox(0.7, 0.75, 0.7, 2);
  applyMaterial(liquid, glassMaterial({ color: palette.deepRose, thickness: 0.4, roughness: 0.05 }));
  liquid.position.y = -0.25;
  liquid.scale.setScalar(0.92);
  group.add(liquid);

  const band = new THREE.TorusGeometry(0.42, 0.03, 12, 40);
  const bandMesh = new THREE.Mesh(band);
  applyMaterial(bandMesh, metalMaterial(palette.gold, 0.15));
  bandMesh.position.y = 0.1;
  bandMesh.rotation.x = Math.PI / 2;
  group.add(bandMesh);

  group.userData.autoRotate = 0.35;
  group.userData.floatAmount = 0.12;
  return group;
}

export function buildSpaLotus(): THREE.Group {
  const group = new THREE.Group();
  const base = new THREE.CylinderGeometry(1.4, 1.8, 0.18, 32);
  const baseMesh = new THREE.Mesh(base);
  applyMaterial(baseMesh, ceramicMaterial(palette.cream));
  baseMesh.position.y = -0.1;
  baseMesh.rotation.x = Math.PI / 2;
  group.add(baseMesh);

  const petalColors = [palette.rose, palette.deepRose, palette.rose];
  for (let i = 0; i < 12; i++) {
    const petal = new THREE.ConeGeometry(0.18, 0.9, 12);
    const petalMesh = new THREE.Mesh(petal);
    applyMaterial(petalMesh, satinMaterial(petalColors[i % petalColors.length], 0.35));
    const angle = (i / 12) * Math.PI * 2;
    petalMesh.position.set(Math.cos(angle) * 0.55, 0.28, Math.sin(angle) * 0.55);
    petalMesh.rotation.z = Math.PI / 2.4;
    petalMesh.rotation.y = -angle;
    petalMesh.scale.set(0.85, 1, 0.85);
    group.add(petalMesh);
  }

  const core = new THREE.SphereGeometry(0.28, 24, 24);
  const coreMesh = new THREE.Mesh(core);
  applyMaterial(coreMesh, emissiveMaterial(palette.gold, 0.6));
  coreMesh.position.y = 0.5;
  group.add(coreMesh);

  const steam1 = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.05, 12, 40));
  applyMaterial(steam1, glassMaterial({ color: 0xffffff, opacity: 0.25, thickness: 0.3 }));
  steam1.position.set(0, 0.85, 0);
  steam1.rotation.x = Math.PI / 2.6;
  group.add(steam1);

  const steam2 = steam1.clone();
  steam2.position.y = 1.05;
  steam2.scale.setScalar(0.6);
  group.add(steam2);

  group.userData.autoRotate = 0.25;
  group.userData.floatAmount = 0.1;
  return group;
}

export function buildDropletOrb(): THREE.Group {
  const group = new THREE.Group();
  const drop = new THREE.SphereGeometry(0.55, 32, 32);
  const dropMesh = new THREE.Mesh(drop);
  applyMaterial(dropMesh, glassMaterial({ color: palette.glass, thickness: 1.0 }));
  dropMesh.scale.y = 1.15;
  group.add(dropMesh);

  const point = new THREE.ConeGeometry(0.35, 0.7, 24);
  const pointMesh = new THREE.Mesh(point);
  applyMaterial(pointMesh, glassMaterial({ color: palette.glass, thickness: 0.5 }));
  pointMesh.position.y = 1.05;
  group.add(pointMesh);

  for (let i = 0; i < 6; i++) {
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.12, 20, 20));
    applyMaterial(orb, glassMaterial({ color: i % 2 ? palette.gold : palette.rose, thickness: 0.4 }));
    const angle = (i / 6) * Math.PI * 2;
    orb.position.set(Math.cos(angle) * 0.85, Math.sin(i) * 0.3, Math.sin(angle) * 0.85);
    group.add(orb);
  }

  group.userData.autoRotate = 0.4;
  group.userData.floatAmount = 0.2;
  return group;
}

export function buildTownhouseRow(): THREE.Group {
  const group = new THREE.Group();
  const facades = [palette.cream, 0xd9d2c8, palette.cream];
  for (let i = -1; i <= 1; i++) {
    const body = roundedBox(1.0, 2.4, 1.2, 1);
    applyMaterial(body, matteMaterial(facades[i + 1], 0.4));
    body.position.set(i * 1.05, 1.2, 0);
    group.add(body);

    const roof = new THREE.BoxGeometry(1.1, 0.2, 1.3);
    const roofMesh = new THREE.Mesh(roof);
    applyMaterial(roofMesh, stoneMaterial(palette.stone, 0.7));
    roofMesh.position.set(i * 1.05, 2.5, 0);
    group.add(roofMesh);

    for (let f = 0; f < 2; f++) {
      const win = roundedBox(0.3, 0.4, 0.1, 1);
      applyMaterial(win, glassMaterial({ color: palette.sky, thickness: 0.2 }));
      win.position.set(i * 1.05 + (f === 0 ? -0.25 : 0.25), 1.6, 0.61);
      group.add(win);
    }
    const door = roundedBox(0.4, 0.7, 0.1, 1);
    applyMaterial(door, woodMaterial(palette.wood));
    door.position.set(i * 1.05, 0.35, 0.61);
    group.add(door);
  }
  group.userData.autoRotate = 0.18;
  group.userData.floatAmount = 0.05;
  return group;
}

export function buildKeysHome(): THREE.Group {
  const group = new THREE.Group();
  const house = roundedBox(1.6, 1.3, 1.2, 1);
  applyMaterial(house, matteMaterial(palette.cream, 0.45));
  house.position.y = 0.65;
  group.add(house);

  const roof = new THREE.ConeGeometry(1.5, 1.0, 4);
  const roofMesh = new THREE.Mesh(roof);
  applyMaterial(roofMesh, stoneMaterial(palette.terracotta, 0.6));
  roofMesh.position.y = 1.8;
  roofMesh.rotation.y = Math.PI / 4;
  group.add(roofMesh);

  const head = new THREE.TorusGeometry(0.3, 0.1, 12, 24);
  const headMesh = new THREE.Mesh(head);
  applyMaterial(headMesh, metalMaterial(palette.gold, 0.25));
  headMesh.position.set(1.5, 0.8, 0.2);
  group.add(headMesh);

  const shaft = new THREE.CylinderGeometry(0.05, 0.05, 1.4, 12);
  const shaftMesh = new THREE.Mesh(shaft);
  applyMaterial(shaftMesh, metalMaterial(palette.gold, 0.25));
  shaftMesh.position.set(1.5, 0.35, 0.2);
  shaftMesh.rotation.z = 0.4;
  group.add(shaftMesh);

  const tooth = new THREE.BoxGeometry(0.3, 0.06, 0.05);
  const toothMesh = new THREE.Mesh(tooth);
  applyMaterial(toothMesh, metalMaterial(palette.gold, 0.25));
  toothMesh.position.set(1.35, 0.3, 0.2);
  toothMesh.rotation.z = 0.4;
  group.add(toothMesh);

  const keyring = new THREE.TorusGeometry(0.22, 0.03, 10, 24);
  const keyringMesh = new THREE.Mesh(keyring);
  applyMaterial(keyringMesh, metalMaterial(palette.charcoal, 0.3));
  keyringMesh.position.set(1.5, 1.3, 0.2);
  group.add(keyringMesh);

  group.userData.autoRotate = 0.3;
  group.userData.floatAmount = 0.12;
  return group;
}

export function buildNeighborhoodScene(): THREE.Group {
  const group = new THREE.Group();
  const ground = new THREE.CylinderGeometry(3, 3, 0.12, 32);
  const groundMesh = new THREE.Mesh(ground);
  applyMaterial(groundMesh, matteMaterial(palette.leaf, 0.85));
  groundMesh.position.y = -0.06;
  groundMesh.rotation.x = Math.PI / 2;
  group.add(groundMesh);

  const houses = [
    { x: -1.2, c: palette.cream, s: 0.9 },
    { x: 0.2, c: 0xe8ddd0, s: 1.1 },
    { x: 1.5, c: palette.cream, s: 0.75 },
  ];
  for (const h of houses) {
    const body = roundedBox(1.0 * h.s, 1.2 * h.s, 0.9 * h.s, 1);
    applyMaterial(body, matteMaterial(h.c, 0.4));
    body.position.set(h.x, 0.6 * h.s, 0);
    group.add(body);
    const roof = new THREE.ConeGeometry(0.9 * h.s, 0.7 * h.s, 4);
    const roofMesh = new THREE.Mesh(roof);
    applyMaterial(roofMesh, stoneMaterial(palette.terracotta, 0.6));
    roofMesh.position.set(h.x, 1.55 * h.s, 0);
    roofMesh.rotation.y = Math.PI / 4;
    group.add(roofMesh);
  }

  for (let i = 0; i < 6; i++) {
    const tree = new THREE.ConeGeometry(0.22, 0.6, 8);
    const treeMesh = new THREE.Mesh(tree);
    applyMaterial(treeMesh, matteMaterial(palette.leaf, 0.8));
    const angle = (i / 6) * Math.PI * 2;
    treeMesh.position.set(Math.cos(angle) * 2.3, 0.3, Math.sin(angle) * 2.3);
    group.add(treeMesh);
  }

  group.userData.autoRotate = 0.1;
  group.userData.floatAmount = 0.04;
  return group;
}

export function buildSkylineTowers(): THREE.Group {
  const group = new THREE.Group();
  const towers = [
    { x: -1.6, h: 4.6, w: 1.2, c: palette.stone },
    { x: 0.1, h: 6.2, w: 1.5, c: palette.charcoal },
    { x: 1.8, h: 3.8, w: 1.0, c: palette.stone },
  ];
  for (const t of towers) {
    const body = roundedBox(t.w, t.h, t.w, 2);
    applyMaterial(body, satinMaterial(t.c, 0.25));
    body.position.set(t.x, t.h / 2, 0);
    group.add(body);
    for (let i = 0; i < Math.floor(t.h / 0.7); i++) {
      const win = roundedBox(t.w - 0.35, 0.18, 0.08, 1);
      applyMaterial(win, glassMaterial({ color: 0xcfe8ff, thickness: 0.2 }));
      win.position.set(t.x, 0.5 + i * 0.7, t.w / 2 - 0.04);
      group.add(win);
    }
  }
  const podium = roundedBox(6, 0.6, 3.4, 1);
  applyMaterial(podium, matteMaterial(palette.warmWhite, 0.35));
  podium.position.y = 0.3;
  group.add(podium);

  group.userData.autoRotate = 0.12;
  group.userData.floatAmount = 0.03;
  return group;
}

export function buildGatedEstate(): THREE.Group {
  const group = new THREE.Group();
  const ground = new THREE.CylinderGeometry(3.4, 3.4, 0.1, 32);
  const groundMesh = new THREE.Mesh(ground);
  applyMaterial(groundMesh, matteMaterial(0xdbe8d0, 0.8));
  groundMesh.position.y = -0.05;
  groundMesh.rotation.x = Math.PI / 2;
  group.add(groundMesh);

  const body = roundedBox(2.4, 1.6, 1.8, 1);
  applyMaterial(body, matteMaterial(palette.cream, 0.4));
  body.position.y = 0.8;
  group.add(body);

  const roof = new THREE.ConeGeometry(2.0, 1.2, 4);
  const roofMesh = new THREE.Mesh(roof);
  applyMaterial(roofMesh, stoneMaterial(palette.terracotta, 0.55));
  roofMesh.position.y = 2.2;
  roofMesh.rotation.y = Math.PI / 4;
  group.add(roofMesh);

  for (const [x, z] of [[-1.6, -1.4], [1.6, -1.4], [-1.6, 1.4], [1.6, 1.4]]) {
    const gate = new THREE.BoxGeometry(0.5, 2.0, 0.1);
    const gateMesh = new THREE.Mesh(gate);
    applyMaterial(gateMesh, metalMaterial(palette.charcoal, 0.35));
    gateMesh.position.set(x, 1.0, z);
    group.add(gateMesh);
  }
  for (const [x, z] of [[-2.6, -2.2], [2.6, -2.2], [-2.6, 2.2], [2.6, 2.2]]) {
    const pillar = new THREE.BoxGeometry(0.3, 1.8, 0.3);
    const pillarMesh = new THREE.Mesh(pillar);
    applyMaterial(pillarMesh, stoneMaterial(palette.stone, 0.7));
    pillarMesh.position.set(x, 0.9, z);
    group.add(pillarMesh);
  }

  const drive = roundedBox(2.0, 0.04, 0.6, 1);
  applyMaterial(drive, matteMaterial(0x9a8c7a, 0.8));
  drive.position.y = -0.01;
  group.add(drive);

  group.userData.autoRotate = 0.14;
  group.userData.floatAmount = 0.04;
  return group;
}

export function buildHotelSuite(): THREE.Group {
  const group = new THREE.Group();
  const floor = new THREE.CylinderGeometry(3, 3, 0.12, 32);
  const floorMesh = new THREE.Mesh(floor);
  applyMaterial(floorMesh, ceramicMaterial(palette.warmWhite));
  floorMesh.position.y = 0;
  floorMesh.rotation.x = Math.PI / 2;
  group.add(floorMesh);

  const bedBase = roundedBox(2.2, 0.5, 1.6, 1);
  applyMaterial(bedBase, matteMaterial(0xf5efe6, 0.6));
  bedBase.position.set(0, 0.3, 0);
  group.add(bedBase);

  const pillow = roundedBox(0.7, 0.22, 0.9, 1);
  applyMaterial(pillow, satinMaterial(palette.cream, 0.7));
  pillow.position.set(-0.75, 0.65, 0);
  pillow.rotation.z = 0.08;
  group.add(pillow);

  const blanket = roundedBox(2.0, 0.18, 1.4, 1);
  applyMaterial(blanket, satinMaterial(0xb07a6a, 0.5));
  blanket.position.set(0.1, 0.58, 0);
  group.add(blanket);

  const headboard = roundedBox(2.3, 1.1, 0.15, 1);
  applyMaterial(headboard, woodMaterial(0x7a5a44));
  headboard.position.set(0, 0.9, -0.85);
  group.add(headboard);

  const lamp1 = new THREE.CylinderGeometry(0.06, 0.08, 0.5, 12);
  const lamp1Mesh = new THREE.Mesh(lamp1);
  applyMaterial(lamp1Mesh, metalMaterial(palette.gold, 0.3));
  lamp1Mesh.position.set(-1.4, 0.6, -0.5);
  group.add(lamp1Mesh);

  const shade1 = new THREE.CylinderGeometry(0.22, 0.26, 0.18, 16);
  const shade1Mesh = new THREE.Mesh(shade1);
  applyMaterial(shade1Mesh, emissiveMaterial(0xffd9a0, 0.9));
  shade1Mesh.position.set(-1.4, 0.9, -0.5);
  group.add(shade1Mesh);

  const lamp2 = lamp1Mesh.clone();
  lamp2.position.set(1.4, 0.6, -0.5);
  group.add(lamp2);
  const shade2 = shade1Mesh.clone();
  shade2.position.set(1.4, 0.9, -0.5);
  group.add(shade2);

  const light = new THREE.PointLight(0xffe3b0, 3, 6);
  light.position.set(0, 1.6, 0);
  group.add(light);

  group.userData.autoRotate = 0.15;
  group.userData.floatAmount = 0.03;
  return group;
}

export function buildPoolsideVilla(): THREE.Group {
  const group = new THREE.Group();
  const pool = new THREE.BoxGeometry(2.6, 0.1, 1.8);
  const poolMesh = new THREE.Mesh(pool);
  applyMaterial(poolMesh, glassMaterial({ color: 0x7fc4ff, thickness: 0.6, roughness: 0.1 }));
  poolMesh.position.y = 0.05;
  group.add(poolMesh);

  const poolEdge = new THREE.BoxGeometry(2.9, 0.12, 2.1);
  const poolEdgeMesh = new THREE.Mesh(poolEdge);
  applyMaterial(poolEdgeMesh, ceramicMaterial(palette.warmWhite));
  poolEdgeMesh.position.y = 0;
  group.add(poolEdgeMesh);

  const villa = roundedBox(1.6, 1.3, 1.4, 1);
  applyMaterial(villa, matteMaterial(palette.cream, 0.4));
  villa.position.set(2.4, 0.7, 0.4);
  group.add(villa);

  const roof = new THREE.ConeGeometry(1.3, 0.9, 4);
  const roofMesh = new THREE.Mesh(roof);
  applyMaterial(roofMesh, stoneMaterial(palette.terracotta, 0.6));
  roofMesh.position.set(2.4, 1.9, 0.4);
  roofMesh.rotation.y = Math.PI / 4;
  group.add(roofMesh);

  for (let i = 0; i < 4; i++) {
    const palm = new THREE.CylinderGeometry(0.06, 0.1, 1.6, 10);
    const palmMesh = new THREE.Mesh(palm);
    applyMaterial(palmMesh, woodMaterial(0x6d5230));
    const a = (i / 4) * Math.PI * 2 + 0.5;
    palmMesh.position.set(Math.cos(a) * 2.8, 0.8, Math.sin(a) * 2.8);
    palmMesh.rotation.z = 0.15;
    group.add(palmMesh);
    const frond = new THREE.ConeGeometry(0.7, 0.15, 6);
    const frondMesh = new THREE.Mesh(frond);
    applyMaterial(frondMesh, matteMaterial(palette.leaf, 0.8));
    frondMesh.position.set(Math.cos(a) * 3.2, 1.7, Math.sin(a) * 3.2);
    frondMesh.rotation.z = 1.2;
    group.add(frondMesh);
  }

  group.userData.autoRotate = 0.12;
  group.userData.floatAmount = 0.04;
  return group;
}

export function buildSafariTent(): THREE.Group {
  const group = new THREE.Group();
  const ground = new THREE.CylinderGeometry(3, 3, 0.1, 32);
  const groundMesh = new THREE.Mesh(ground);
  applyMaterial(groundMesh, matteMaterial(0xc8b99a, 0.85));
  groundMesh.position.y = -0.05;
  groundMesh.rotation.x = Math.PI / 2;
  group.add(groundMesh);

  const base = roundedBox(2.4, 0.5, 1.8, 1);
  applyMaterial(base, matteMaterial(0x8a6d4b, 0.7));
  base.position.y = 0.35;
  group.add(base);

  const wall1 = new THREE.PlaneGeometry(2.4, 1.2);
  const wallMesh1 = new THREE.Mesh(wall1);
  applyMaterial(wallMesh1, matteMaterial(0xd8c4a0, 0.9));
  wallMesh1.position.set(0, 1.1, -0.9);
  group.add(wallMesh1);

  const wall2 = wallMesh1.clone();
  wall2.position.set(0, 1.1, 0.9);
  wall2.rotation.y = Math.PI;
  group.add(wall2);

  const wall3 = wallMesh1.clone();
  wall3.rotation.y = Math.PI / 2;
  wall3.position.set(1.2, 1.1, 0);
  group.add(wall3);
  const wall4 = wallMesh1.clone();
  wall4.rotation.y = Math.PI / 2;
  wall4.position.set(-1.2, 1.1, 0);
  group.add(wall4);

  const roofA = new THREE.PlaneGeometry(2.6, 1.4);
  const roofAMesh = new THREE.Mesh(roofA);
  applyMaterial(roofAMesh, matteMaterial(0xb8986f, 0.9));
  roofAMesh.position.set(0, 1.9, 0.4);
  roofAMesh.rotation.x = Math.PI / 3.4;
  group.add(roofAMesh);

  const roofB = roofAMesh.clone();
  roofB.position.set(0, 1.9, -0.4);
  roofB.rotation.x = -Math.PI / 3.4;
  group.add(roofB);

  const lamp = new THREE.SphereGeometry(0.14, 16, 16);
  const lampMesh = new THREE.Mesh(lamp);
  applyMaterial(lampMesh, emissiveMaterial(0xffc66e, 1.6));
  lampMesh.position.set(0, 1.5, 0);
  group.add(lampMesh);

  const glow = new THREE.PointLight(0xffb45e, 4, 7);
  glow.position.set(0, 1.5, 0);
  group.add(glow);

  group.userData.autoRotate = 0.14;
  group.userData.floatAmount = 0.04;
  return group;
}

export function buildCampfireCabin(): THREE.Group {
  const group = new THREE.Group();
  const ground = new THREE.CylinderGeometry(3, 3, 0.1, 32);
  const groundMesh = new THREE.Mesh(ground);
  applyMaterial(groundMesh, matteMaterial(0x2f4630, 0.9));
  groundMesh.position.y = -0.05;
  groundMesh.rotation.x = Math.PI / 2;
  group.add(groundMesh);

  const cabin = roundedBox(1.8, 1.4, 1.5, 1);
  applyMaterial(cabin, woodMaterial(palette.wood));
  cabin.position.set(1.6, 0.75, 0.2);
  group.add(cabin);

  const roof = new THREE.ConeGeometry(1.6, 1.1, 4);
  const roofMesh = new THREE.Mesh(roof);
  applyMaterial(roofMesh, matteMaterial(palette.terracotta, 0.6));
  roofMesh.position.set(1.6, 2.0, 0.2);
  roofMesh.rotation.y = Math.PI / 4;
  group.add(roofMesh);

  for (let i = 0; i < 5; i++) {
    const log = new THREE.CylinderGeometry(0.06, 0.06, 0.9, 10);
    const logMesh = new THREE.Mesh(log);
    applyMaterial(logMesh, woodMaterial(0x5a3d24));
    logMesh.position.set(-1.2, 0.12 + i * 0.12, 0);
    logMesh.rotation.z = i % 2 ? 0.9 : -0.9;
    group.add(logMesh);
  }

  const flame = new THREE.ConeGeometry(0.25, 0.7, 10);
  const flameMesh = new THREE.Mesh(flame);
  applyMaterial(flameMesh, emissiveMaterial(0xff7a2d, 1.8));
  flameMesh.position.set(-1.2, 0.6, 0);
  group.add(flameMesh);

  const flame2 = flameMesh.clone();
  flame2.scale.setScalar(0.6);
  flame2.position.y = 0.8;
  applyMaterial(flame2, emissiveMaterial(0xffd24a, 2.2));
  group.add(flame2);

  const fireLight = new THREE.PointLight(0xff7a2d, 6, 10);
  fireLight.position.set(-1.2, 0.7, 0);
  group.add(fireLight);

  const smoke = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 12));
  applyMaterial(smoke, glassMaterial({ color: 0xaaaaaa, opacity: 0.35, thickness: 0.4 }));
  smoke.position.set(1.6, 2.8, 0.2);
  group.add(smoke);

  group.userData.autoRotate = 0.12;
  group.userData.floatAmount = 0.04;
  return group;
}

export function buildFloatingOrbs(): THREE.Group {  const group = new THREE.Group();
  const colors = [palette.rose, palette.gold, palette.sky, palette.cream, palette.leaf];
  for (let i = 0; i < 7; i++) {
    const radius = 0.12 + Math.random() * 0.3;
    const sphere = new THREE.SphereGeometry(radius, 32, 32);
    const mesh = new THREE.Mesh(sphere);
    applyMaterial(mesh, glassMaterial({ color: colors[i % colors.length], thickness: radius * 1.5 }));
    const angle = (i / 7) * Math.PI * 2;
    const r = 1.4 + Math.random() * 1.2;
    mesh.position.set(Math.cos(angle) * r, (Math.random() - 0.5) * 2.2, Math.sin(angle) * r);
    mesh.userData.baseY = mesh.position.y;
    mesh.userData.speed = 0.5 + Math.random();
    mesh.userData.floatPhase = Math.random() * Math.PI * 2;
    group.add(mesh);
  }
  group.userData.autoRotate = 0.2;
  group.userData.floatAmount = 0.25;
  return group;
}

export function buildAsset(assetId: string): THREE.Group | null {
  switch (assetId) {
    case "serum-bottle":
      return buildSerumBottle();
    case "modern-house":
      return buildModernHouse();
    case "luxury-development":
      return buildLuxuryDevelopment();
    case "boutique-hotel-lobby":
      return buildBoutiqueHotelLobby();
    case "mountain-lodge":
      return buildMountainLodge();
    case "landscape":
      return buildFloatingOrbs();
    case "floating-orbs":
      return buildFloatingOrbs();
    case "sparkle":
      return buildFloatingOrbs();
    case "laser-wand":
      return buildLaserWand();
    case "facial-cleanser":
      return buildFacialCleanser();
    case "spa-lotus":
      return buildSpaLotus();
    case "droplet-orb":
      return buildDropletOrb();
    case "townhouse-row":
      return buildTownhouseRow();
    case "keys-home":
      return buildKeysHome();
    case "neighborhood-scene":
      return buildNeighborhoodScene();
    case "skyline-towers":
      return buildSkylineTowers();
    case "gated-estate":
      return buildGatedEstate();
    case "hotel-suite":
      return buildHotelSuite();
    case "poolside-villa":
      return buildPoolsideVilla();
    case "safari-tent":
      return buildSafariTent();
    case "campfire-cabin":
      return buildCampfireCabin();
    default:
      return null;
  }
}

export { palette };
