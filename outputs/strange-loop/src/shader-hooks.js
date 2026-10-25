// Stack material shader hooks. Three.js stores a single onBeforeCompile,
// and several exhibit materials need concrete, PCSS and passage AO together.
// Material.clone() does not copy those callbacks, so clones must opt in.
export function cloneWithHooks(material) {
  const clone = material.clone();
  clone.onBeforeCompile = material.onBeforeCompile;
  clone.customProgramCacheKey = material.customProgramCacheKey;
  return clone;
}

export function chainShaderHook(material, compile, cacheKey) {
  const previousCompile = material.onBeforeCompile;
  const previousKey = material.customProgramCacheKey;
  material.onBeforeCompile = function (shader, renderer) {
    previousCompile?.call(this, shader, renderer);
    compile.call(this, shader, renderer);
  };
  material.customProgramCacheKey = function () {
    const prev = previousKey ? previousKey.call(this) : '';
    return prev ? `${prev}|${cacheKey}` : cacheKey;
  };
}
