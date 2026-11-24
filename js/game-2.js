
(function(){
 const overlay=document.getElementById('storySceneOverlay');
 const frame=document.getElementById('storySceneFrame');
 let afterScene=null, scenePoll=null;
 // file:// でiframe内を直接操作できない場合に備え、子ページからの通知で閉じる
 window.addEventListener('message',function(ev){
   if(ev.source===frame.contentWindow && ev.data && ev.data.type==='story-scene-close'){
     window.closeStoryScene();
   }
 });
 window.openStoryScene=function(file,done){
   window.storySceneActive=true;
   afterScene=typeof done==='function'?done:null;
   const wasPlaying=(typeof state!=='undefined' && state==='PLAYING');
   if(wasPlaying) state='STORY_SCENE';
   if(typeof stopTrack==='function') stopTrack();
   overlay.style.display='block';
   frame.src=file;
   frame.onload=function(){
     try{
       const doc=frame.contentDocument;
       const candidates=[...doc.querySelectorAll('button')];
       const back=candidates.find(b=>/ゲームに戻る|戻る/.test(b.textContent||''));
       if(back){
         back.onclick=function(ev){ev.preventDefault();ev.stopImmediatePropagation();window.closeStoryScene();};
       }
     }catch(e){}
   };
   if(scenePoll) clearInterval(scenePoll);
   scenePoll=setInterval(()=>{
     try{
       const doc=frame.contentDocument;
       const back=[...doc.querySelectorAll('button')].find(b=>/ゲームに戻る|戻る/.test(b.textContent||''));
       if(back && !back.dataset.parentHook){back.dataset.parentHook='1';back.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();window.closeStoryScene();},true);}
     }catch(e){}
   },250);
 };
 window.cancelStoryScene=function(){
   window.storySceneActive=false;
   afterScene=null;
   if(scenePoll){clearInterval(scenePoll);scenePoll=null;}
   frame.onload=null;
   overlay.style.display='none';
   frame.src='about:blank';
 };
 window.closeStoryScene=function(){
   overlay.style.display='none'; frame.src='about:blank';
   window.storySceneActive=false;
   if(scenePoll){clearInterval(scenePoll);scenePoll=null;}
   const cb=afterScene;afterScene=null;
   if(cb) cb();
 };
})();
