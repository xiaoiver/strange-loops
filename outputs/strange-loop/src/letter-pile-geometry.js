import { ShapeUtils } from 'three';

const cross = (a,b,c) => (b.x-a.x)*(c.y-b.y)-(b.y-a.y)*(c.x-b.x);
const area = points => points.reduce((sum,p,i)=>{const q=points[(i+1)%points.length];return sum+p.x*q.y-p.y*q.x;},0)/2;

function simplify(points, tolerance=.009) {
  const result=points.map(p=>p.clone());
  if(result[0].distanceTo(result.at(-1))<1e-8)result.pop();
  let changed=true;
  while(changed&&result.length>3){
    changed=false;
    for(let i=0;i<result.length;i++){
      const a=result[(i+result.length-1)%result.length],b=result[i],c=result[(i+1)%result.length];
      const length=a.distanceTo(c);
      if(length>1e-9&&Math.abs(cross(a,b,c))/length<tolerance&&b.clone().sub(a).dot(b.clone().sub(c))<=0){result.splice(i,1);changed=true;break;}
    }
  }
  return result;
}
// Merge adjacent triangles into convex pieces: preserve holes and gaps between strokes.
function convexPieces(points, triangles) {
  const polygons=triangles.map(t=>area(t.map(i=>points[i]))<0?[...t].reverse():[...t]);
  let changed=true;
  while(changed){
    changed=false;
    outer: for(let a=0;a<polygons.length;a++)for(let b=a+1;b<polygons.length;b++){
      const A=polygons[a],B=polygons[b];
      for(let i=0;i<A.length;i++)for(let j=0;j<B.length;j++){
        if(A[i]!==B[(j+1)%B.length]||A[(i+1)%A.length]!==B[j])continue;
        const merged=[];
        for(let k=1;k<=A.length;k++)merged.push(A[(i+k)%A.length]);
        for(let k=2;k<B.length;k++)merged.push(B[(j+k)%B.length]);
        if(merged.length>10||merged.some((v,k)=>cross(points[v],points[merged[(k+1)%merged.length]],points[merged[(k+2)%merged.length]]) < -1e-7))continue;
        polygons[a]=merged;polygons.splice(b,1);changed=true;break outer;
      }
    }
  }
  return polygons;
}
export function glyphCollider(font, letter, size=.64, depth=.18) {
  const shapes=font.generateShapes(letter,size), contours=shapes.map(shape=>{const p=shape.extractPoints(3);return {shape:simplify(p.shape),holes:p.holes.map(h=>simplify(h))};});
  const all=contours.flatMap(({shape,holes})=>[...shape,...holes.flat()]);
  const center={x:(Math.min(...all.map(p=>p.x))+Math.max(...all.map(p=>p.x)))/2,y:(Math.min(...all.map(p=>p.y))+Math.max(...all.map(p=>p.y)))/2};
  const pieces=[];
  for(const {shape,holes} of contours){
    if(ShapeUtils.isClockWise(shape))shape.reverse();
    for(const hole of holes)if(!ShapeUtils.isClockWise(hole))hole.reverse();
    const triangles=ShapeUtils.triangulateShape(shape,holes),points=[...shape,...holes.flat()];
    for(const polygon of convexPieces(points,triangles)){
      const poly=simplify(polygon.map(i=>points[i]),1e-6);if(Math.abs(area(poly))<1e-6)continue;
      const x=poly.reduce((n,p)=>n+p.x,0)/poly.length,y=poly.reduce((n,p)=>n+p.y,0)/poly.length,n=poly.length;
      const vertices=[-depth/2,depth/2].flatMap(z=>poly.map(p=>[p.x-x,p.y-y,z]));
      const faces=[Array.from({length:n},(_,i)=>n-1-i),Array.from({length:n},(_,i)=>n+i)];
      for(let i=0;i<n;i++){const j=(i+1)%n;faces.push([i,j,n+j,n+i]);}
      pieces.push({vertices,faces,offset:[x-center.x,y-center.y,0]});
    }
  }
  return {letter,size,depth,center,pieces};
}
