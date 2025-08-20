diff --git a//dev/null b/js/editor.js
index 0000000000000000000000000000000000000000..7bd33a975c3bc5b0292628674b2e16922b68be04 100644
--- a//dev/null
+++ b/js/editor.js
@@ -0,0 +1,45 @@
+import { markers, buildingData, BASE_LEVELS, HOUSEEAT_LEVELS, DROVOSEKDOM_LEVELS, MINEHOUSE_LEVELS, FERMERVOM_LEVELS, iconSpecForType, makePopupHtml } from './game.js';
+import { updateDoc, doc } from './firebase.js';
+
+const editMenu=document.getElementById('editMenu');
+const canvas=document.getElementById('paintCanvas');
+const ctx=canvas.getContext('2d');
+const paletteDiv=document.getElementById('palette');
+const closeEditorBtn=document.getElementById('closeEditor');
+const canvasInfo=document.getElementById('canvasInfo');
+let editingMarker=null, logicalSize=60;
+const colors=['#000','#fff','#ff0000','#00ff00','#0000ff','#ffff00','#00ffff','#ff00ff','#888','#444','#ccc','#fa0','#0af','#f0a','#aaa','#555','#222','#111','#333','#666','#999','#b00','#0b0','#00b','#bb0','#0bb','#b0b'];
+let currentColor=colors[0];
+function setCanvasLogicalSize(s){ logicalSize=s; canvas.width=s; canvas.height=s; canvasInfo.textContent=`Логическое разрешение: ${s}×${s}`; ctx.imageSmoothingEnabled=false; }
+function drawPixel(x,y){ctx.fillStyle=currentColor; ctx.fillRect(x,y,1,1);}
+canvas.addEventListener('mousedown', e=>{
+  const r=canvas.getBoundingClientRect(); const x=Math.floor((e.clientX-r.left)*logicalSize/r.width); const y=Math.floor((e.clientY-r.top)*logicalSize/r.height);
+  const drag=(ev)=>{ const rr=canvas.getBoundingClientRect(); const xx=Math.floor((ev.clientX-rr.left)*logicalSize/rr.width); const yy=Math.floor((ev.clientY-rr.top)*logicalSize/rr.height); drawPixel(xx,yy); };
+  const up=()=>{document.removeEventListener('mousemove',drag); document.removeEventListener('mouseup',up);};
+  drawPixel(x,y); document.addEventListener('mousemove',drag); document.addEventListener('mouseup',up);
+});
+paletteDiv.innerHTML=''; colors.forEach(c=>{const d=document.createElement('div'); d.className='colorTile'; d.style.background=c; d.onclick=()=>currentColor=c; paletteDiv.appendChild(d);});
+window.editBuilding = function(id){
+  const m=markers.get(id); if(!m) return; editingMarker=m; editMenu.style.display='flex';
+  const b=buildingData.get(id);
+  let size;
+  if(b.type==='base') size = BASE_LEVELS[b.level].paint;
+  else if(b.type==='houseeat') size = HOUSEEAT_LEVELS[b.level].paint;
+  else {
+    const table = b.type==='drovosekdom'?DROVOSEKDOM_LEVELS: b.type==='minehouse'?MINEHOUSE_LEVELS: FERMERVOM_LEVELS;
+    size = table[b.level].paint;
+  }
+  setCanvasLogicalSize(size);
+  const img=new Image(); img.crossOrigin='anonymous'; img.src=m.currentIcon; img.onload=()=>{ ctx.clearRect(0,0,logicalSize,logicalSize); ctx.drawImage(img,0,0,logicalSize,logicalSize); };
+};
+document.getElementById('saveSprite').onclick= async ()=>{
+  if(!editingMarker) return;
+  const id = editingMarker.options.buildingId; const b=buildingData.get(id);
+  const dataUrl=canvas.toDataURL();
+  const spec = iconSpecForType(b?.type||'', b?.level||1);
+  editingMarker.setIcon(new L.Icon({iconUrl:dataUrl, iconSize:spec.size, iconAnchor:spec.anchor}));
+  editingMarker.currentIcon=dataUrl; editingMarker.bindPopup(makePopupHtml(b));
+  editMenu.style.display='none'; editingMarker=null;
+  try { await updateDoc(doc(db, 'buildings', id), { customIcon: dataUrl }); } catch (e) {}
+};
+closeEditorBtn.onclick=()=>{ editMenu.style.display='none'; editingMarker=null; };
