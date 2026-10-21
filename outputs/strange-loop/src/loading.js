import { supportedLocale as supported } from './languages.js';
import { LOADING_COPY as copy } from './loading-copy.js';
    (()=>{
      const screen=document.getElementById('loading-screen'),message=document.getElementById('loading-message'),retry=document.getElementById('loading-retry'),exhibit=document.getElementById('exhibit');
      let saved;try{saved=localStorage.getItem('geb.locale');}catch{}
      let language=supported(new URLSearchParams(location.search).get('lang'))||supported(document.documentElement.dataset.locale)||supported(saved)||'zh';
      let stage='app',slow=false,finished=false;
      const render=()=>{message.textContent=copy[language][screen.dataset.state==='failed'?'failed':slow?'slow':stage];retry.textContent=copy[language].retry;};
      retry.href=location.href;render();
      const timer=setTimeout(()=>{if(!finished){slow=true;retry.hidden=false;render();}},12000);
      window.exhibitLoading={
        setLocale(value){language=supported(value)||language;render();},
        setStage(value){if(!finished){stage=value;render();}},
        fail(){if(finished)return;clearTimeout(timer);screen.dataset.state='failed';retry.hidden=false;render();},
        finish(){
          if(finished)return;finished=true;clearTimeout(timer);slow=false;screen.dataset.state='ready';stage='ready';render();
          requestAnimationFrame(()=>{
            screen.classList.add('leaving');
            setTimeout(()=>{const hadFocus=screen.contains(document.activeElement);screen.hidden=true;exhibit.inert=false;exhibit.setAttribute('aria-busy','false');if(hadFocus)document.getElementById('enter').focus();},matchMedia('(prefers-reduced-motion: reduce)').matches?0:450);
          });
        },
      };
      document.addEventListener('error',event=>{if(event.target?.id==='app-script')window.exhibitLoading.fail();},true);
      window.addEventListener('error',event=>{if(event.filename?.includes('/assets/app.js'))window.exhibitLoading.fail();});
      window.addEventListener('unhandledrejection',()=>window.exhibitLoading.fail());
    })();
