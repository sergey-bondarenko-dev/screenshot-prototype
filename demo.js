import { RegionShot } from './region-shot.js?v=static-pages-1';
import { savePng } from './save-image.js';
const gallery = document.querySelector('#gallery');
function addImage(container, url, blob) {
  const card=document.createElement('div');card.className='screenshot-card';
  const a=document.createElement('a');a.href=url;a.target='_blank';a.rel='noopener';
  const img=new Image();img.src=url;img.alt='Сохранённый скриншот';a.append(img);
  const save=document.createElement('button');save.type='button';save.textContent='Сохранить на компьютер';
  const status=document.createElement('span');status.className='save-status';status.setAttribute('role','status');
  save.onclick=async()=>{
    save.disabled=true;status.textContent='';
    try {
      const result=await savePng({url,blob});
      status.textContent=result==='saved'?'Файл сохранён.':result==='cancelled'?'Сохранение отменено.':'Скачивание передано браузеру.';
    } catch { status.textContent='Не удалось сохранить файл. Попробуйте ещё раз.'; }
    finally { save.disabled=false; }
  };
  card.append(a,save,status);container.prepend(card);
}
new RegionShot({ endpoint:null, onCaptured: ({blob}) => {
  const url=URL.createObjectURL(blob);
  addImage(document.querySelector('#previews'),url,blob);addImage(gallery,url,blob);
} });
document.querySelector('#galleryStatus').textContent='Изображения хранятся только до обновления страницы. Чтобы оставить копию, скачайте PNG.';
document.querySelector('#foreignGame').src=new URL('./webgl.html',location.href).href;
const canvas=document.querySelector('#game'),ctx=canvas.getContext('2d');
function draw(t){ctx.fillStyle='#152638';ctx.fillRect(0,0,1000,320);for(let i=0;i<14;i++){ctx.beginPath();ctx.fillStyle=`hsl(${150+i*9} 70% 65%)`;ctx.arc((t*.06*(1+i*.06)+i*90)%1100-50,160+Math.sin(t/600+i)*100,12+i%4*6,0,Math.PI*2);ctx.fill();}ctx.fillStyle='white';ctx.font='22px monospace';ctx.fillText('CANVAS / '+(t/1000).toFixed(1)+' s',28,42);requestAnimationFrame(draw);}requestAnimationFrame(draw);
