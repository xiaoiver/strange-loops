import { ShaderChunk } from 'three';

// PCSS for this scene's orthographic directional shadow cameras.
// Shadow cameras share a 10-unit width and a linear depth range of 19.9 units.
// The filter estimates a finite angular emitter: penumbra = blocker gap * tan(half-angle).
export const softShadowSettings = {
  enabled: { value: 1 },
  angularRadius: { value: .045 },
};

function pcssSource(mobile) {
  return /* glsl */`
uniform float uPcssEnabled;
uniform float uPcssAngularRadius;

vec2 gebDiskSample( int index, int count, float phase ) {
  float radius = sqrt( ( float( index ) + 0.5 ) / float( count ) );
  float angle = float( index ) * 2.39996323 + phase;
  return radius * vec2( cos( angle ), sin( angle ) );
}

float gebPCSS( sampler2D depths, vec2 mapSize, vec3 coord ) {
  // Receiver-plane depth correction reduces acne without detaching the shadow.
  vec3 dx = dFdx( coord );
  vec3 dy = dFdy( coord );
  float determinant = dx.x * dy.y - dx.y * dy.x;
  vec2 gradient = vec2( 0.0 );
  if ( abs( determinant ) > 1e-10 ) {
    gradient = vec2( dy.y * dx.z - dx.y * dy.z, dx.x * dy.z - dy.x * dx.z ) / determinant;
    gradient = clamp( gradient, vec2( -20.0 ), vec2( 20.0 ) );
  }

  // Rotation stays in light space, so grain does not crawl when the viewing camera moves.
  vec2 cell = floor( coord.xy * mapSize );
  float phase = fract( sin( dot( cell, vec2( 12.9898, 78.233 ) ) ) * 43758.5453 ) * 6.2831853;
  float searchRadius = max( 1.0 / mapSize.x, uPcssAngularRadius * 6.4 / 10.0 );
  float blockerSum = 0.0;
  float blockerCount = 0.0;
  for ( int i = 0; i < ${mobile ? 12 : 16}; i++ ) {
    vec2 offset = gebDiskSample( i, ${mobile ? 12 : 16}, phase ) * searchRadius;
    float planeOffset = dot( gradient, offset );
    float depth = unpackRGBAToDepth( texture2D( depths, coord.xy + offset ) );
    if ( depth < coord.z + planeOffset - 0.000025 ) {
      blockerSum += depth - planeOffset;
      blockerCount += 1.0;
    }
  }
  if ( blockerCount < 0.5 ) return 1.0;

  float averageBlocker = blockerSum / blockerCount;
  float separation = max( 0.0, coord.z - averageBlocker ) * 19.9;
  float penumbraUV = uPcssAngularRadius * separation / 10.0;
  float filterRadius = clamp( penumbraUV, 0.8 / mapSize.x, 0.045 );
  float visibility = 0.0;
  for ( int i = 0; i < ${mobile ? 24 : 48}; i++ ) {
    vec2 offset = gebDiskSample( i, ${mobile ? 24 : 48}, phase + 0.73 ) * filterRadius;
    float compareDepth = coord.z + dot( gradient, offset );
    visibility += texture2DCompare( depths, coord.xy + offset, compareDepth );
  }
  return visibility / ${mobile ? '24.0' : '48.0'};
}
`;
}

export function applySoftShadows(material, mobile) {
  material.onBeforeCompile = shader => {
    shader.uniforms.uPcssEnabled = softShadowSettings.enabled;
    shader.uniforms.uPcssAngularRadius = softShadowSettings.angularRadius;
    const original = ShaderChunk.shadowmap_pars_fragment;
    const start = original.indexOf('#elif defined( SHADOWMAP_TYPE_PCF_SOFT )');
    const end = original.indexOf('#elif defined( SHADOWMAP_TYPE_VSM )', start);
    if (start < 0 || end < 0) throw new Error('Unsupported Three.js shadow shader layout');
    const nativeFilter = original.slice(start, end).replace('#elif defined( SHADOWMAP_TYPE_PCF_SOFT )', '');
    let chunk = original.slice(0, start) + `#elif defined( SHADOWMAP_TYPE_PCF_SOFT )
      // The PCSS distance estimate is orthographic; perspective lights use native PCF.
      if ( uPcssEnabled > 0.5 && abs( shadowCoord.w - 1.0 ) < 0.0001 ) {
        shadow = gebPCSS( shadowMap, shadowMapSize, shadowCoord.xyz );
      } else {
        ${nativeFilter}
      }
      ` + original.slice(end);
    chunk = chunk.replace('float getShadow(', pcssSource(mobile) + '\nfloat getShadow(');
    shader.fragmentShader = shader.fragmentShader.replace('#include <shadowmap_pars_fragment>', chunk);
    // Perpendicular gallery walls receive just one of the three axial lights.
    const lights = ShaderChunk.lights_fragment_begin.replace(
      '( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap',
      '( directLight.visible && receiveShadow && dot( geometryNormal, directLight.direction ) > 0.0001 ) ? getShadow( directionalShadowMap'
    );
    shader.fragmentShader = shader.fragmentShader.replace('#include <lights_fragment_begin>', lights);
  };
  material.customProgramCacheKey = () => `geb-pcss-v1-${mobile ? 'mobile' : 'desktop'}`;
}
