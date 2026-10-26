import { BufferGeometry, Float32BufferAttribute, Group, Mesh } from 'three';

// The mathematical Menger construction, implemented here rather than importing
// a downloaded mesh: remove the center and all six face centers, then repeat.
export function mengerCells(depth=1){
  if(!Number.isInteger(depth)||depth<0||depth>3)throw new RangeError('Menger depth must be an integer from 0 to 3');
  let cells=[[0,0,0]];
  for(let step=0;step<depth;step++){
    const next=[];
    for(const parent of cells)for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(let z=-1;z<=1;z++){
      if(Number(x===0)+Number(y===0)+Number(z===0)<2)next.push([parent[0]*3+x,parent[1]*3+y,parent[2]*3+z]);
    }
    cells=next;
  }
  return cells;
}
const FACES=[
  [[1,0,0],[[1,-1,-1],[1,1,-1],[1,1,1],[1,-1,1]]],
  [[-1,0,0],[[-1,-1,1],[-1,1,1],[-1,1,-1],[-1,-1,-1]]],
  [[0,1,0],[[-1,1,1],[1,1,1],[1,1,-1],[-1,1,-1]]],
  [[0,-1,0],[[-1,-1,-1],[1,-1,-1],[1,-1,1],[-1,-1,1]]],
  [[0,0,1],[[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]]],
  [[0,0,-1],[[1,-1,-1],[-1,-1,-1],[-1,1,-1],[1,1,-1]]],
];
function chunkGeometry(branch,depth,size){
  const inner=mengerCells(depth-1),division=3**depth,cell=size/division,offset=3**(depth-1);
  const occupied=new Set(inner.map(p=>p.join(','))),positions=[],normals=[],indices=[];
  for(const p of inner)for(const [normal,corners] of FACES){
    if(occupied.has(p.map((n,i)=>n+normal[i]).join(',')))continue;
    const first=positions.length/3;
    for(const corner of corners){
      positions.push(...p.map((n,i)=>(branch[i]*offset+n+corner[i]/2)*cell));
      normals.push(...normal);
    }
    indices.push(first,first+1,first+2,first,first+2,first+3);
  }
  const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute(positions,3));
  geometry.setAttribute('normal',new Float32BufferAttribute(normals,3));geometry.setIndex(indices);
  geometry.computeBoundingSphere();return geometry;
}
export function createMengerArchitecture({depth=2,size=14,material,name='menger-architecture'}){
  // Each first-generation piece is a closed mesh, so separating the structure
  // never exposes missing internal faces. Coordinates stay baked in object space
  // for continuous concrete mottling, without instanced-material shader changes.
  if(depth!==1&&depth!==2)throw new RangeError('Architectural Menger depth must be 1 or 2');
  const group=new Group();group.name=name;
  const pieces=mengerCells(1).map((cell,index)=>{
    const object=new Mesh(chunkGeometry(cell,depth,size),material);
    object.name=`${name}-piece-${index}`;object.castShadow=object.receiveShadow=true;group.add(object);
    return {cell,object};
  });
  return {
    group,
    update(spread=0,time=0){
      for(const {cell,object} of pieces){
        // The body gently opens along its original subdivision axes. Its clock
        // is supplied by the active parent level, not by a global animation.
        const gap=spread*(.22+Math.sin(time*.22)*.035);
        object.position.set(cell[0]*gap,cell[1]*gap,cell[2]*gap);
      }
    },
    dispose(){for(const {object} of pieces)object.geometry.dispose();},
  };
}


// A finite diagram of repeated structure; it does not claim to render infinity.
export function mengerDiagram(depth){
  function face(size){
    const divisions=9,edge=4,cell=size/divisions;
    return mengerCells(2).filter(p=>p[2]===edge).map(([x,y])=>`<rect x="${320+(x-.5)*cell}" y="${200+(y-.5)*cell}" width="${cell}" height="${cell}"/>`).join('');
  }
  const sizes=depth===0?[280,62,14]:[900,280,62,14];
  return `<svg viewBox="0 0 640 400" role="presentation" aria-hidden="true">${sizes.map((size,i)=>`<g fill="currentColor" opacity="${1-i*.14}">${face(size)}</g>`).join('')}</svg>`;
}
