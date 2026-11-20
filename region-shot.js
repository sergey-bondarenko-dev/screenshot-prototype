/** Standalone integration: new RegionShot({comment: textarea, endpoint, onUploaded}). */
export class RegionShot {
  constructor({comment, endpoint='/api/screenshots', onUploaded=()=>{}, onCaptured=()=>{}}={}) {
    this.comment=comment; this.endpoint=endpoint; this.onUploaded=onUploaded; this.onCaptured=onCaptured; this.busy=false; this.destroyed=false;
    this.button=document.createElement('button'); this.button.textContent='Сделать скриншот';
    Object.assign(this.button.style,{position:'fixed',right:'24px',bottom:'24px',zIndex:2147483646,padding:'16px 22px',background:'#9bf1cf',color:'#102b25',border:'0',borderRadius:'40px',font:'600 16px system-ui',cursor:'pointer',boxShadow:'0 8px 32px #0007'});
    this.status=document.createElement('div'); this.status.setAttribute('role','status'); this.status.setAttribute('aria-live','polite');
    Object.assign(this.status.style,{position:'fixed',right:'24px',bottom:'88px',maxWidth:'360px',background:'#142331',color:'white',padding:'12px',borderRadius:'8px',zIndex:2147483646,font:'14px system-ui'});this.status.hidden=true;
    this.click=()=>this.capture();this.button.addEventListener('click',this.click);document.body.append(this.button,this.status);
  }
  message(text){this.status.textContent=text;this.status.hidden=!text;if(this.resultStatus)this.resultStatus.textContent=text;}
  showPreview(blob){
    this.closePreview?.();
    const previous=document.activeElement,objectUrl=URL.createObjectURL(blob);
    const host=document.createElement('div');
    Object.assign(host.style,{position:'fixed',inset:'0',zIndex:2147483647,background:'#000b',display:'grid',placeItems:'center',padding:'20px'});
    const shadow=host.attachShadow({mode:'open'});
    shadow.innerHTML=`<style>*{box-sizing:border-box}.panel{width:min(850px,calc(100vw - 40px));max-height:calc(100dvh - 40px);overflow:auto;border:1px solid #3c5066;border-radius:16px;background:#142331;color:#eef7ff;padding:20px;font:16px system-ui}.head,.actions{display:flex;align-items:center;justify-content:space-between;gap:16px}h2{margin:0;font-size:20px}img{display:block;max-width:100%;max-height:60vh;width:auto;height:auto;margin:20px auto;background:#0c1520;border-radius:6px}.save,button{font:600 16px system-ui;border:0;border-radius:8px;padding:12px 20px;cursor:pointer}.save{background:#9bf1cf;color:#102b25;text-decoration:none}button{background:#2a3c4e;color:white}p{color:#b6c9db;font-size:14px;margin:16px 0 0;line-height:1.5}</style><section class="panel" role="dialog" aria-modal="true" aria-labelledby="preview-title"><div class="head"><h2 id="preview-title">Скриншот готов</h2><button type="button" aria-label="Закрыть превью">Закрыть</button></div><img alt="Превью выбранной области"><div class="actions"><a class="save" download>Сохранить</a></div><p>Папка сохранения зависит от настроек скачивания браузера.</p><p class="state" role="status" aria-live="polite"></p></section>`;
    const image=shadow.querySelector('img'),save=shadow.querySelector('a'),close=shadow.querySelector('button');
    image.src=objectUrl;save.href=objectUrl;save.download=`screenshot-${Date.now()}.png`;
    this.resultStatus=shadow.querySelector('.state');
    const dismiss=()=>{
      window.removeEventListener('keydown',key,true);host.remove();this.resultStatus=null;this.closePreview=null;
      // Keep a clicked download alive briefly even if the modal is closed immediately.
      setTimeout(()=>URL.revokeObjectURL(objectUrl),60000);previous?.focus();
    };
    const key=e=>{
      if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();dismiss();}
      else if(e.key==='Tab'){e.preventDefault();(shadow.activeElement===save?close:save).focus();}
    };
    close.onclick=dismiss;host.onclick=e=>{if(e.target===host&&e.composedPath()[0]===host)dismiss();};
    this.closePreview=dismiss;document.body.append(host);window.addEventListener('keydown',key,true);save.focus();
  }
  async capture(){
    if(this.busy||this.destroyed)return;this.closePreview?.();this.busy=true;this.button.disabled=true;
    let stream,video,uploadStarted=false;
    try{
      if(!isSecureContext || !navigator.mediaDevices?.getDisplayMedia)throw Error('Нужен Chrome/Edge на компьютере и HTTPS либо localhost.');
      this.message('Выберите текущую вкладку в диалоге браузера.');
      stream=await navigator.mediaDevices.getDisplayMedia({video:{displaySurface:'browser'},audio:false,preferCurrentTab:true,selfBrowserSurface:'include',surfaceSwitching:'exclude'});
      if(this.destroyed)return;
      video=document.createElement('video');video.muted=true;video.srcObject=stream;
      this.button.style.visibility='hidden';this.status.style.visibility='hidden';
      await Promise.race([video.play(),new Promise((_,reject)=>{this.playTimer=setTimeout(()=>reject(Error('Не удалось начать чтение кадра.')),8000);})]);
      clearTimeout(this.playTimer);
      // Wait for a presented video frame, not merely loaded metadata.
      await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Не удалось получить кадр.')),8000);const done=()=>{clearTimeout(timer);resolve();};if(video.requestVideoFrameCallback)video.requestVideoFrameCallback(done);else setTimeout(done,250);});
      if(!video.videoWidth||!video.videoHeight)throw Error('Пустой кадр захвата.');
      const frame=document.createElement('canvas');frame.width=video.videoWidth;frame.height=video.videoHeight;frame.getContext('2d').drawImage(video,0,0);
      stream.getTracks().forEach(t=>t.stop());video.srcObject=null;
      if(this.destroyed)return;
      const crop=await this.select(frame);if(!crop){this.message('Выделение отменено. Ничего не отправлено.');return;}
      if(crop.width*crop.height>20_000_000)throw Error('Область больше 20 Мп. Выберите область поменьше.');
      this.status.style.visibility='visible';this.message('Сохранение PNG…');
      const blob=await new Promise(resolve=>crop.toBlob(resolve,'image/png'));
      if(!blob)throw Error('Не удалось создать PNG.');if(blob.size>8*1024*1024)throw Error('PNG больше 8 МБ. Выберите область поменьше.');
      if(this.destroyed)return;
      this.showPreview(blob);
      try{this.onCaptured({blob,width:crop.width,height:crop.height});}catch{ /* Optional host UI must not block saving. */ }
      if(!this.endpoint){this.message('PNG готов. Нажмите «Сохранить», чтобы скачать изображение.');return;}
      this.message('Загрузка копии на сервер… PNG уже можно скачать кнопкой «Сохранить».');
      uploadStarted=true;
      const response=await fetch(this.endpoint,{method:'POST',headers:{'Content-Type':'image/png'},body:blob,signal:AbortSignal.timeout(30000)});
      const result=await response.json();if(!response.ok)throw Error(result.error||'Ошибка загрузки.');
      const parsed=new URL(result.url,new URL(this.endpoint,location.href));
      if(!['http:','https:'].includes(parsed.protocol))throw Error('Сервер вернул некорректный URL.');
      const url=parsed.href;
      if(this.comment){this.comment.value+=(this.comment.value?'\n':'')+url;this.comment.dispatchEvent(new Event('input',{bubbles:true}));}
      this.message('Копия сохранена на сервере. Чтобы скачать PNG, нажмите «Сохранить».');
      try{this.onUploaded({...result,url,blob});}catch{this.message('Скриншот сохранён, но обработчик превью завершился с ошибкой.');}
    }catch(error){
      if(uploadStarted&&(error.name==='TypeError'||error.name==='TimeoutError'||error.name==='AbortError'))this.message('Нет ответа от сервера. Проверьте подключение и галерею: файл мог успеть сохраниться.');
      else this.message(error.name==='NotAllowedError'||error.name==='AbortError'?'Захват отменён или не разрешён. Ничего не сохранено.':error.message||'Ошибка захвата.');
    }
    finally{clearTimeout(this.playTimer);stream?.getTracks().forEach(t=>t.stop());if(video)video.srcObject=null;this.button.style.visibility='visible';this.status.style.visibility='visible';this.button.disabled=false;this.busy=false;}
  }
  select(frame){return new Promise(resolve=>{
    const host=document.createElement('div');Object.assign(host.style,{position:'fixed',inset:'0',zIndex:2147483647,background:'#080d14',touchAction:'none'});
    const shadow=host.attachShadow({mode:'open'});
    shadow.innerHTML=`<style>*{box-sizing:border-box}.stage{position:absolute;inset:64px 16px 16px;display:flex;align-items:center;justify-content:center}.image{position:relative;line-height:0;cursor:crosshair;touch-action:none}canvas{display:block;max-width:100%;max-height:100%}.box{position:absolute;border:2px solid #9bf1cf;background:#9bf1cf22;pointer-events:none}.bar{height:64px;display:flex;align-items:center;justify-content:space-between;padding:10px 20px;color:white;font:14px system-ui;gap:12px}button{padding:8px 14px;cursor:pointer}</style><div class="bar"><span>Выделите область на снимке · Escape — отмена</span><button>Отмена</button></div><div class="stage"><div class="image"><div class="box" hidden></div></div></div>`;
    host.setAttribute('role','dialog');host.setAttribute('aria-modal','true');host.setAttribute('aria-label','Выделение области скриншота');
    const image=shadow.querySelector('.image'),box=shadow.querySelector('.box'),stage=shadow.querySelector('.stage');image.prepend(frame);
    const previous=document.activeElement;let start=null,rect=null;
    const fit=()=>{const r=stage.getBoundingClientRect(),scale=Math.min(r.width/frame.width,r.height/frame.height);frame.style.width=`${frame.width*scale}px`;frame.style.height=`${frame.height*scale}px`;box.hidden=true;start=null;};
    let finished=false;
    const finish=value=>{if(finished)return;finished=true;this.cancelSelection=null;window.removeEventListener('keydown',key,true);window.removeEventListener('resize',fit);host.remove();previous?.focus();resolve(value);};
    this.cancelSelection=()=>finish(null);
    const key=e=>{if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();finish(null);}else if(e.key==='Tab'){e.preventDefault();shadow.querySelector('button').focus();}};
    const point=e=>{const r=frame.getBoundingClientRect();return {x:Math.max(0,Math.min(r.width,e.clientX-r.left)),y:Math.max(0,Math.min(r.height,e.clientY-r.top))};};
    image.onpointerdown=e=>{if(e.button!==0)return;e.preventDefault();start=point(e);rect=null;image.setPointerCapture(e.pointerId);box.hidden=false;Object.assign(box.style,{left:`${start.x}px`,top:`${start.y}px`,width:'0',height:'0'});};
    image.onpointermove=e=>{if(!start)return;const p=point(e);rect={x:Math.min(start.x,p.x),y:Math.min(start.y,p.y),w:Math.abs(start.x-p.x),h:Math.abs(start.y-p.y)};Object.assign(box.style,{left:`${rect.x}px`,top:`${rect.y}px`,width:`${rect.w}px`,height:`${rect.h}px`});};
    image.onpointerup=e=>{if(!start)return;image.onpointermove(e);start=null;if(!rect||rect.w<4||rect.h<4){box.hidden=true;return;}
      // Use actual frame/display ratios; DPR and browser zoom are already represented here.
      const r=frame.getBoundingClientRect(),pixel=pixelRect(rect,r,frame);
      const crop=document.createElement('canvas');crop.width=pixel.width;crop.height=pixel.height;crop.getContext('2d').drawImage(frame,pixel.x,pixel.y,crop.width,crop.height,0,0,crop.width,crop.height);finish(crop);
    };
    image.onpointercancel=()=>{start=null;box.hidden=true;};shadow.querySelector('button').onclick=()=>finish(null);
    document.body.append(host);fit();shadow.querySelector('button').focus();window.addEventListener('resize',fit);window.addEventListener('keydown',key,true);
  });}
  destroy(){this.destroyed=true;this.cancelSelection?.();this.closePreview?.();this.button.removeEventListener('click',this.click);this.button.remove();this.status.remove();}
}

export function pixelRect(rect,display,frame){
  const sx=frame.width/display.width,sy=frame.height/display.height;
  const x=Math.max(0,Math.min(frame.width-1,Math.floor(rect.x*sx))),y=Math.max(0,Math.min(frame.height-1,Math.floor(rect.y*sy)));
  const right=Math.min(frame.width,Math.ceil((rect.x+rect.w)*sx)),bottom=Math.min(frame.height,Math.ceil((rect.y+rect.h)*sy));
  return {x,y,width:Math.max(1,right-x),height:Math.max(1,bottom-y)};
}
