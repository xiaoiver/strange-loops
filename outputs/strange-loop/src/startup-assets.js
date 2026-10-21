// A failed optional asset must not keep the first-visit screen open forever.
export function within(promise, milliseconds=20000){
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(Object.assign(new Error('Asset loading timed out'),{code:'asset-timeout'})),milliseconds);
    Promise.resolve(promise).then(value=>{clearTimeout(timer);resolve(value);},error=>{clearTimeout(timer);reject(error);});
  });
}
