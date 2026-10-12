import { Box3, Color, ExtrudeGeometry, Group, Mesh, MeshStandardMaterial, Shape, Vector3 } from 'three';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
const configurations = new WeakMap();

export function createBrandModel(svg) {
  const root = new Group();
  root.name = 'DasturXona national geometry';
  const ivory = new MeshStandardMaterial({ color: '#fbf7ef', metalness: .2, roughness: .42 });
  const navy = new MeshStandardMaterial({ color: '#153254', metalness: .25, roughness: .4 });
  const orange = new MeshStandardMaterial({ color: '#eb8a35', metalness: .4, roughness: .29 });
  const orangeEdge = new MeshStandardMaterial({ color: '#a34b12', metalness: .3, roughness: .4 });
  const data = new SVGLoader().parse(svg);
  const leftCircuit = new Group(), rightCircuit = new Group();
  leftCircuit.name = 'left node and original trace';rightCircuit.name = 'right node and original trace';
  const units = [];
  let part = 0;
  for (const path of data.paths) {
    const accent = path.color.getHexString() !== '153254';
    for (const shape of SVGLoader.createShapes(path)) {
      const geometry = new ExtrudeGeometry(shape, {
        depth: 43, bevelEnabled: true, bevelSize: 3.5, bevelThickness: 5,
        bevelSegments: 3, curveSegments: 18, steps: 1
      });
      geometry.translate(-627, -563, -21.5);
      geometry.scale(.0064, -.0064, .0064);
      // Negative Y scale reflects SVG coordinates. Correct the winding before lighting.
      const positions = geometry.getAttribute('position');
      const normals = geometry.getAttribute('normal');
      const uv = geometry.getAttribute('uv');
      for (let i = 0; i < positions.count; i += 3) {
        for (const attr of [positions, normals, uv]) {
          if (!attr) continue;
          for (let c = 0; c < attr.itemSize; c++) {
            const a = (i + 1) * attr.itemSize + c, b = (i + 2) * attr.itemSize + c;
            const value = attr.array[a];attr.array[a] = attr.array[b];attr.array[b] = value;
          }
        }
      }
      geometry.computeVertexNormals();
      const mesh = new Mesh(geometry, accent ? [orange, orangeEdge] : [ivory, navy]);
      mesh.name = (accent ? 'orange-circuit-' : 'national-pattern-') + (++part);
      geometry.computeBoundingBox();
      const center = geometry.boundingBox.getCenter(new Vector3());
      if (accent && center.x < -1) leftCircuit.add(mesh);
      else if (accent && center.x > 1) rightCircuit.add(mesh);
      else { root.add(mesh);units.push(mesh); }
    }
  }
  root.add(leftCircuit, rightCircuit);units.push(leftCircuit, rightCircuit);
  const motionUnits = units.map(unit => ({ unit, base: unit.position.clone(), direction: new Box3().setFromObject(unit).getCenter(new Vector3()).normalize() }));
  const box = new Box3().setFromObject(root);
  const center = box.getCenter(new Vector3());
  root.position.sub(center);
  root.userData.bounds = box.getSize(new Vector3()).toArray();
  root.userData.parts = part;
  configurations.set(root,{motionUnits,circuits:[leftCircuit,rightCircuit],palette:{face:ivory,edge:navy,accent:orange,accentEdge:orangeEdge}});
  return root;
}

const lightFace = new Color('#153254'), darkFace = new Color('#fbf7ef');
const lightEdge = new Color('#0c2035'), darkEdge = new Color('#c8b79b');
const lightAccent = new Color('#bd550f'), darkAccent = new Color('#fa7c24');
const lightAccentEdge = new Color('#8c3e13'), darkAccentEdge = new Color('#b65e22');

export function updateBrandModel(root, {mix = 1, split = 0, phase = 0} = {}) {
  const {palette,motionUnits,circuits} = configurations.get(root);
  palette.face.color.copy(lightFace).lerp(darkFace, mix);
  palette.edge.color.copy(lightEdge).lerp(darkEdge, mix);
  palette.accent.color.copy(lightAccent).lerp(darkAccent, mix);
  palette.accentEdge.color.copy(lightAccentEdge).lerp(darkAccentEdge, mix);
  // Move complete pieces; never rewrite the SVG's geometry or stretch its lines.
  for (const {unit,base,direction} of motionUnits) {
    unit.position.copy(base).addScaledVector(direction, split * .62);
  }
  circuits.forEach((unit, index) => {
    const sign = index ? -1 : 1;
    unit.position.x += sign * Math.sin(phase) * .055;
    unit.position.y += sign * Math.sin(phase * .7) * .085;
  });
}

export function createStarModel() {
  const shape = new Shape();
  for (let i = 0; i < 10; i++) {
    const angle = Math.PI / 2 + i * Math.PI / 5;
    const radius = i % 2 ? .69 : 1.55;
    const x = Math.cos(angle) * radius, y = Math.sin(angle) * radius;
    if (!i) shape.moveTo(x, y); else shape.lineTo(x, y);
  }
  shape.closePath();
  const geometry = new ExtrudeGeometry(shape, { depth: .31, bevelEnabled: true, bevelSize: .08, bevelThickness: .1, bevelSegments: 4, curveSegments: 6 });
  geometry.translate(0, 0, -.155);
  const material = new MeshStandardMaterial({ color: '#ffbe5a', metalness: .62, roughness: .27 });
  const star = new Mesh(geometry, material);
  star.name = 'Telegram Stars campaign sculpture';
  star.scale.setScalar(1.65);
  return star;
}
