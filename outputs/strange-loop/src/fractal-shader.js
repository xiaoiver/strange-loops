import {PORTAL_Z,INTERIOR_SCALE,BEND,PHASE_RATES} from './fractal-journey.js';

// Original shader implementation. Geometry is a finite CSG distance bound for
// a Menger sponge; the interior repeats those fields in independently tilted
// spatial layers. The front opening connects the two different spatial metrics.
export const vertexShader=/* glsl */`
precision highp float;
in vec3 position;
out vec2 vUv;
void main(){vUv=position.xy*.5+.5;gl_Position=vec4(position.xy,0.,1.);}
`;

export const fragmentShader=/* glsl */`
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform vec2 uResolution;
uniform float uAspect;
uniform float uFocus;
uniform float uFocal;
uniform vec3 uOrigin;
uniform vec3 uForward;
uniform vec3 uRight;
uniform vec3 uUp;
uniform vec3 uInteriorOrigin;
uniform vec3 uCellPhase;
uniform vec2 uBendPhase;
uniform int uSteps;
uniform int uDetail;
uniform bool uLinearOutput;
uniform bool uPortalView;
const float PORTAL=${PORTAL_Z.toFixed(3)};
const float METRIC=${INTERIOR_SCALE.toFixed(1)};
const vec3 LIGHT=vec3(.431,.862,.267);

float boxDistance(vec3 p,vec3 size){
  vec3 q=abs(p)-size;
  return length(max(q,0.))+min(max(q.x,max(q.y,q.z)),0.);
}
float sponge(vec3 p,float halfSize,int detail){
  float d=boxDistance(p,vec3(halfSize));
  float cell=2.*halfSize;
  for(int i=0;i<4;i++){
    if(i>=detail)break;
    vec3 q=abs(mod(p+.5*cell,cell)-.5*cell);
    // Remove the union of three infinite square tunnels. L-infinity cross
    // distances are conservative, so sphere tracing cannot overstep a corner.
    float crossDistance=min(max(q.x,q.y),min(max(q.x,q.z),max(q.y,q.z)))-cell/6.;
    d=max(d,-crossDistance);
    cell/=3.;
  }
  return d;
}
vec3 interiorCell(vec3 p){
  // The camera origin is rebased every cell. These bounded phase offsets keep
  // the very same geometry, curvature and cement after each coordinate wrap.
  p.xy-=vec2(${BEND.x.toFixed(2)}*sin(p.z*${BEND.kx.toFixed(3)}+uBendPhase.x),${BEND.y.toFixed(2)}*sin(p.z*${BEND.ky.toFixed(3)}+uBendPhase.y));
  float layer=floor((p.z+18.)/36.);
  float angle=uCellPhase.x+layer*${PHASE_RATES.angle.toFixed(2)}+.28*sin(uCellPhase.y+layer*${PHASE_RATES.spin.toFixed(2)});
  float c=cos(angle),s=sin(angle);
  p.xy=mat2(c,-s,s,c)*p.xy;
  return mod(p+18.,36.)-18.;
}
float field(vec3 p,bool inside){
  if(!inside)return sponge(p,1.5,3);
  float layer=floor((p.z+18.)/36.);
  float size=11.6*(1.+.12*sin(uCellPhase.z+layer*${PHASE_RATES.scale.toFixed(2)}));
  return sponge(interiorCell(p),size,uDetail);
}
vec2 interval(vec3 ro,vec3 rd){
  vec3 inv=1./(rd+vec3(.0000001));
  vec3 a=(-vec3(1.5)-ro)*inv,b=(vec3(1.5)-ro)*inv;
  vec3 lo=min(a,b),hi=max(a,b);
  return vec2(max(lo.x,max(lo.y,lo.z)),min(hi.x,min(hi.y,hi.z)));
}
vec3 normalAt(vec3 p,bool inside,float epsilon){
  vec2 e=vec2(1.,-1.)*epsilon;
  return normalize(e.xyy*field(p+e.xyy,inside)+e.yyx*field(p+e.yyx,inside)
    +e.yxy*field(p+e.yxy,inside)+e.xxx*field(p+e.xxx,inside));
}
float visibility(vec3 p,vec3 n,bool inside){
  float t=inside?.06:.012,result=1.;
  for(int i=0;i<20;i++){
    float d=field(p+n*(inside?.018:.004)+LIGHT*t,inside);
    if(d<.001)return .08;
    result=min(result,12.*d/t);
    t+=clamp(d,inside?.08:.018,inside?3.:.3);
    if(t>(inside?34.:8.))break;
  }
  return clamp(result,.08,1.);
}
float occlusion(vec3 p,vec3 n,bool inside){
  float sum=0.,weight=1.,unit=inside?.14:.018;
  for(int i=0;i<4;i++){
    float h=unit*pow(2.6,float(i));
    sum+=max(0.,h-field(p+n*h,inside))*weight/h;
    weight*=.48;
  }
  return clamp(1.-sum*.62,.2,1.);
}
float hash21(vec2 p){
  vec3 a=fract(vec3(p.xyx)*vec3(.1031,.1030,.0973));
  a+=dot(a,a.yzx+33.33);
  return fract((a.x+a.y)*a.z);
}
float noise(vec2 p){
  vec2 a=floor(p),b=fract(p);b=b*b*(3.-2.*b);
  return mix(mix(hash21(a),hash21(a+vec2(1,0)),b.x),mix(hash21(a+vec2(0,1)),hash21(a+1.),b.x),b.y);
}
vec3 concrete(vec3 p,vec3 n,bool inside,bool floorSurface){
  vec3 q=inside?interiorCell(p):p*3.;
  vec3 a=abs(n);vec2 uv=a.y>.6?q.xz:(a.x>a.z?q.zy:q.xy);
  vec2 warp=vec2(noise(uv*.3),noise(uv*.3+17.));
  float cloud=.65*noise((uv+warp*.8)*.55)+.35*noise(uv*1.7+8.);
  float slurry=noise(uv*vec2(6.,1.4));
  float tone=.88+(cloud-.5)*.2+(slurry-.5)*.035;
  vec2 tie=(fract(uv/3.2)-.5)*3.2;
  float pixel=max(length(fwidth(uv)),.001);
  float pit=1.-smoothstep(.022-pixel,.022+pixel,length(tie));
  if(!floorSurface)tone*=1.-pit*.32;
  return vec3(.45,.466,.445)*tone*(floorSurface?1.08:1.);
}
vec3 sky(vec3 rd,bool inside){
  float up=smoothstep(-.5,.7,rd.y);
  return inside?mix(vec3(.66,.69,.65),vec3(1.02,1.04,.99),up)
    :mix(vec3(.85,.88,.83),vec3(.96,.98,.93),up);
}
vec3 shade(vec3 p,vec3 n,vec3 rd,bool inside,bool floorSurface){
  vec3 albedo=concrete(p,n,inside,floorSurface);
  float ao=occlusion(p,n,inside),shadow=visibility(p,n,inside);
  float nl=max(0.,dot(n,LIGHT)),nv=max(.001,dot(n,-rd));
  vec3 h=normalize(LIGHT-rd);
  float nh=max(0.,dot(n,h)),vh=max(0.,dot(-rd,h));
  // Rough dielectric response: diffuse + GGX/Schlick, with no emissive surface.
  float rough=.88,a2=pow(rough,4.);
  float denom=nh*nh*(a2-1.)+1.;
  float distribution=a2/(3.141593*denom*denom);
  float k=(rough+1.)*(rough+1.)/8.;
  float geometry=(nv/(nv*(1.-k)+k))*(nl/(nl*(1.-k)+k));
  float fresnel=.035+.965*pow(1.-vh,5.);
  float spec=distribution*geometry*fresnel/max(.004,4.*nv*max(nl,.001));
  float ambient=(inside?.14:.52)+max(n.y,0.)*(inside?.18:.3);
  vec3 diffuse=albedo*(ambient*ao+nl*shadow*(inside?2.2:1.4));
  return diffuse+vec3(spec*nl*shadow*2.);
}
vec3 renderInside(vec3 ro,vec3 rd){
  float t=.015;bool hit=false;float epsilon=.004;
  for(int i=0;i<144;i++){
    if(i>=uSteps)break;
    epsilon=max(.003,t*1.1/uResolution.y);
    float d=field(ro+rd*t,true);
    if(d<epsilon){hit=true;break;}
    t+=clamp(d*.78,.002,2.4);
    if(t>185.)break;
  }
  vec3 background=sky(rd,true);
  if(!hit)return background;
  vec3 p=ro+rd*t,n=normalAt(p,true,epsilon*.7);
  vec3 color=shade(p,n,rd,true,false);
  float haze=1.-exp(-t*.006);
  return mix(color,background,haze);
}
vec3 throughPortal(vec3 p){return vec3(p.xy*METRIC,(p.z-PORTAL)*METRIC);}
vec3 renderOutside(vec3 ro,vec3 rd){
  vec3 background=sky(rd,false);
  float floorT=rd.y<-.00001?(-1.84-ro.y)/rd.y:1000.;
  bool floorHit=floorT>0.&&floorT<80.;
  vec3 floorColor=background;
  if(floorHit){
    vec3 p=ro+rd*floorT;
    floorColor=shade(p,vec3(0,1,0),rd,false,true);
    floorColor=mix(floorColor,background,1.-exp(-floorT*.035));
  }
  vec2 bounds=interval(ro,rd);
  if(bounds.y<max(bounds.x,0.))return floorColor;
  float portalT=rd.z<-.00001?(PORTAL-ro.z)/rd.z:1000.;
  vec3 entry=ro+rd*portalT;
  if(portalT>0.&&portalT<floorT&&max(abs(entry.x),abs(entry.y))<.499){
    return renderInside(throughPortal(entry),rd);
  }
  float t=max(0.,bounds.x),limit=min(bounds.y,floorHit?floorT:1000.);
  for(int i=0;i<96;i++){
    float d=field(ro+rd*t,false),epsilon=max(.0005,t*.7/uResolution.y);
    if(d<epsilon){
      vec3 p=ro+rd*t,n=normalAt(p,false,epsilon*.8);
      return mix(shade(p,n,rd,false,false),background,1.-exp(-t*.012));
    }
    t+=max(.0003,d*.8);
    if(t>limit)break;
  }
  return floorColor;
}
vec3 aces(vec3 x){return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.);}
void main(){
  vec2 p=vec2((vUv.x-uFocus)*uAspect,vUv.y-.5);
  vec3 rd=normalize(uForward*uFocal+uRight*p.x+uUp*p.y);
  bool inside=uOrigin.z<PORTAL;
  if(uPortalView){
    float t=(PORTAL-uOrigin.z)/min(rd.z,-.000001);
    vec3 entry=uOrigin+rd*t;
    if(rd.z>=0.||t<=0.||max(abs(entry.x),abs(entry.y))>.502){outColor=vec4(0.);return;}
    // The physical opening samples this bounded, screen-projected target.
    outColor=vec4(renderInside(throughPortal(entry),rd)*.67,1.);return;
  }
  vec3 color=inside?renderInside(uInteriorOrigin,rd):renderOutside(uOrigin,rd);
  if(inside)color*=.67;
  if(uLinearOutput){outColor=vec4(color,1.);return;}
  color=pow(aces(max(color,0.)),vec3(1./2.2));
  float grain=(hash21(gl_FragCoord.xy)-.5)/255.;
  outColor=vec4(color+grain,1.);
}
`;
