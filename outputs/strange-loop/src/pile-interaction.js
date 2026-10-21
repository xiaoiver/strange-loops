// Treat only a short, stationary primary-pointer gesture as a tap.
// The mobile garden panel scrolls over the scene, so never capture its pointer.
export function bindPileInteraction(root,{surface,enabled,pick,nudge}){
  let press=null;
  const clear=()=>{press=null;};
  function eligible(event){
    const target=event.target;
    return enabled()&&target?.closest?.('#world, #garden-intro')&&!target.closest('button,a,input,select,dialog,.garden-controls,.garden-conversation,.garden-heading>p,.garden-heading>h2');
  }
  function hit(event){
    const rect=surface.getBoundingClientRect();
    if(!rect.width||!rect.height)return null;
    return pick({x:(event.clientX-rect.left)/rect.width*2-1,y:1-(event.clientY-rect.top)/rect.height*2});
  }
  function down(event){
    clear();
    if(!event.isPrimary||event.button!==0||!eligible(event)||hit(event)===null)return;
    press={id:event.pointerId,x:event.clientX,y:event.clientY,time:event.timeStamp};
  }
  function move(event){
    if(press&&event.pointerId===press.id&&Math.hypot(event.clientX-press.x,event.clientY-press.y)>8)clear();
  }
  function up(event){
    const start=press;clear();
    if(!start||event.pointerId!==start.id||!eligible(event)||event.timeStamp-start.time>500||Math.hypot(event.clientX-start.x,event.clientY-start.y)>8)return;
    const index=hit(event);if(index!==null)nudge(index);
  }
  const handlers={pointerdown:down,pointermove:move,pointerup:up,pointercancel:clear,scroll:clear,visibilitychange:clear};
  for(const [type,handler] of Object.entries(handlers))root.addEventListener(type,handler,{capture:true,passive:true});
  return ()=>{for(const [type,handler] of Object.entries(handlers))root.removeEventListener(type,handler,true);};
}
