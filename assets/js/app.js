const firebaseConfig={apiKey:"AIzaSyDOU1dpWdqTZjGMjQjX_V3Iv6JMvcIoa2I",authDomain:"pigeon-7a637.firebaseapp.com",projectId:"pigeon-7a637",storageBucket:"pigeon-7a637.firebasestorage.app",messagingSenderId:"560041972635",appId:"1:560041972635:web:e9dda41d8abbccfda8473e",measurementId:"G-Q01M0H0TFK"};
firebase.initializeApp(firebaseConfig);
const auth=firebase.auth(),db=firebase.firestore(),APP="pigeon-7a637";
const ROOT=()=>db.collection("artifacts").doc(APP).collection("public").doc("data");
const USERS=()=>ROOT().collection("users"),FRIENDS=()=>ROOT().collection("friends"),REQUESTS=()=>ROOT().collection("friendRequests"),MESSAGES=()=>ROOT().collection("messages");
const IMG_BB_KEY="1abc9f66636c45ace1d0952e080d153d";
const GOFILE_ENDPOINT="https://upload.gofile.io/uploadfile";
let me=null,profile=null,users=[],friends=[],requests=[],sentRequests=[],activeFriend=null,chatUnsubs=[],listUnsubs=[],typingUnsub=null,typingTimer=null,attachedImages=[],attachedFile=null,messageMap=new Map(),peopleTab="friends";
const $=id=>document.getElementById(id),esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
const avatar=u=>u?.photoURL||"https://placehold.co/120x120/e5e7eb/64748b?text=U";
const pair=(a,b)=>[a,b].sort().join("__");
const time=v=>{let n=v?.toMillis?v.toMillis():Number(v||0);if(!n)return"now";let d=new Date(n),now=new Date();if(d.toDateString()===now.toDateString())return d.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});return d.toLocaleDateString([],{day:"2-digit",month:"short"});};
const bytes=n=>{if(!n)return"0 B";const u=["B","KB","MB","GB"];let i=Math.floor(Math.log(n)/Math.log(1024));return`${(n/Math.pow(1024,i)).toFixed(i?1:0)} ${u[i]}`};
function toast(t){const e=$("toast");e.textContent=t;e.classList.add("show");clearTimeout(toast.t);toast.t=setTimeout(()=>e.classList.remove("show"),2400)}
function isFriend(uid){return friends.some(f=>f.friendUid===uid)}
function closeAllModals(){document.querySelectorAll(".modal").forEach(x=>x.classList.add("hidden"))}
function showView(id){document.querySelectorAll(".view").forEach(x=>x.classList.remove("active"));$(id).classList.add("active");document.querySelectorAll(".nav-item").forEach(x=>x.classList.toggle("active",x.dataset.view===id))}
function syncProfile(){if(!profile)return;const name=profile.displayName||me.displayName||me.email?.split("@")[0]||"User";$("headerAvatar").src=avatar(profile);$("profileAvatar").src=avatar(profile);$("profileName").textContent=name;$("profileEmail").textContent=profile.email||me.email||"";$("profileBio").textContent=profile.bio||"No bio added.";$("editName").value=name;$("editPhoto").value=profile.photoURL||"";$("editBio").value=profile.bio||""}
async function ensureUser(){const ref=USERS().doc(me.uid),snap=await ref.get();const base={uid:me.uid,displayName:me.displayName||me.email?.split("@")[0]||"User",email:me.email||"",photoURL:me.photoURL||null,lastSeen:firebase.firestore.FieldValue.serverTimestamp(),online:true};if(!snap.exists)await ref.set(base);else await ref.set({lastSeen:base.lastSeen,online:true},{merge:true});profile={...base,...(snap.exists?snap.data():{})};
  const googleName=me.displayName||profile.displayName||base.displayName;
  const googlePhoto=me.photoURL||profile.photoURL||null;
  const googleEmail=me.email||profile.email||"";
  profile={...profile,displayName:googleName,photoURL:googlePhoto,email:googleEmail};
  await ref.set({displayName:googleName,photoURL:googlePhoto,email:googleEmail},{merge:true});
  syncProfile();syncMenu()
}
function heartbeat(){if(!me)return;const ping=()=>USERS().doc(me.uid).set({online:true,lastSeen:firebase.firestore.FieldValue.serverTimestamp()},{merge:true}).catch(()=>{});ping();clearInterval(heartbeat.t);heartbeat.t=setInterval(ping,30000)}
window.addEventListener("beforeunload",()=>{if(me)USERS().doc(me.uid).set({online:false,lastSeen:firebase.firestore.FieldValue.serverTimestamp()},{merge:true}).catch(()=>{})});
function stopListeners(){listUnsubs.forEach(u=>u&&u());listUnsubs=[];closeChat()}
function startListeners(){stopListeners();listUnsubs.push(USERS().onSnapshot(s=>{users=s.docs.map(d=>({uid:d.id,...d.data()})).filter(x=>x.uid!==me.uid);renderPeople();renderChats()}));listUnsubs.push(FRIENDS().where("ownerUid","==",me.uid).onSnapshot(s=>{friends=s.docs.map(d=>({id:d.id,...d.data()}));renderPeople();renderChats();updateStats()}));listUnsubs.push(REQUESTS().where("receiverUid","==",me.uid).onSnapshot(s=>{requests=s.docs.map(d=>({id:d.id,...d.data()})).filter(x=>x.status==="pending");updateRequestBadge();renderPeople()}));listUnsubs.push(REQUESTS().where("senderUid","==",me.uid).onSnapshot(s=>{sentRequests=s.docs.map(d=>({id:d.id,...d.data()})).filter(x=>x.status==="pending");renderPeople()}));listUnsubs.push(MESSAGES().where("senderUid","==",me.uid).onSnapshot(()=>renderChats()));listUnsubs.push(MESSAGES().where("receiverUid","==",me.uid).onSnapshot(()=>renderChats()))}
async function getLatestMessages(){const[a,b]=await Promise.all([MESSAGES().where("senderUid","==",me.uid).get(),MESSAGES().where("receiverUid","==",me.uid).get()]);messageMap.clear();[...a.docs,...b.docs].forEach(d=>messageMap.set(d.id,{id:d.id,...d.data()}));return[...messageMap.values()].sort((a,b)=>(b.createdAt?.toMillis?.()||0)-(a.createdAt?.toMillis?.()||0))}
async function renderChats(){if(!me)return;const q=($("chatSearch")?.value||"").trim().toLowerCase(),all=await getLatestMessages(),by=new Map();for(const m of all){const uid=m.senderUid===me.uid?m.receiverUid:m.senderUid;if(!by.has(uid))by.set(uid,m)}let rows=[...by.entries()].map(([uid,m])=>({uid,m,u:users.find(x=>x.uid===uid)||friends.find(x=>x.friendUid===uid)||{uid,displayName:"User"}}));if(q)rows=rows.filter(r=>(r.u.displayName||"").toLowerCase().includes(q)||(r.u.email||"").toLowerCase().includes(q)||(r.m.text||"").toLowerCase().includes(q));const box=$("chatList");box.innerHTML=rows.length?rows.map(r=>`<button class="chat-item" onclick="openChat('${esc(r.uid)}')"><img class="avatar" src="${esc(avatar(r.u))}"><span class="item-copy"><strong>${esc(r.u.displayName||r.u.email||"User")}</strong><small>${esc(r.m.text||((r.m.imageUrls||[]).length?"📷 Image":r.m.fileName?"📎 "+r.m.fileName:"Message"))}</small></span><time class="item-meta">${time(r.m.createdAt)}</time></button>`).join(""):`<div class="empty"><i class="fa-regular fa-comments" style="font-size:28px;display:block;margin-bottom:10px"></i>কোনো conversation নেই। People থেকে একজনকে বেছে নিয়ে chat শুরু করুন।</div>`}
function renderPeople(){const q=($("peopleSearch")?.value||"").trim().toLowerCase();let rows=peopleTab==="friends"?friends.map(f=>users.find(u=>u.uid===f.friendUid)||{uid:f.friendUid,displayName:"User"}):peopleTab==="requests"?requests.map(r=>users.find(u=>u.uid===r.senderUid)||{uid:r.senderUid,displayName:"User"}):users;if(q)rows=rows.filter(u=>(u.displayName||"").toLowerCase().includes(q)||(u.email||"").toLowerCase().includes(q));const box=$("peopleList");box.innerHTML=rows.length?rows.map(u=>{const pending=requests.find(r=>r.senderUid===u.uid),sent=sentRequests.find(r=>r.receiverUid===u.uid),f=isFriend(u.uid);let actions=f?`<button class="small-btn primary" onclick="openChat('${u.uid}')">Message</button>`:(pending||sent)?`<button class="small-btn" disabled>Pending</button>`:`<button class="small-btn primary" onclick="sendRequest('${u.uid}')">Add friend</button>`;if(peopleTab==="requests"&&pending)actions=`<button class="small-btn primary" onclick="acceptRequest('${pending.id}','${u.uid}')">Accept</button><button class="small-btn danger" onclick="rejectRequest('${pending.id}')">Decline</button>`;return`<div class="person-item"><img class="avatar" src="${esc(avatar(u))}"><div class="item-copy" onclick="openUser('${u.uid}')"><strong>${esc(u.displayName||"User")}</strong><small>${esc(u.email||"")}</small></div><div class="person-actions">${actions}</div></div>`}).join(""):`<div class="empty">কোনো user পাওয়া যায়নি।</div>`}
async function sendRequest(uid){if(!me||uid===me.uid||isFriend(uid)||sentRequests.some(r=>r.receiverUid===uid))return toast("Request already sent");try{await REQUESTS().doc(pair(me.uid,uid)).set({senderUid:me.uid,receiverUid:uid,pairId:pair(me.uid,uid),status:"pending",createdAt:firebase.firestore.FieldValue.serverTimestamp()});toast("Friend request sent")}catch(e){console.error(e);toast("Request পাঠানো যায়নি")}}
async function acceptRequest(id,uid){try{const now=firebase.firestore.FieldValue.serverTimestamp(),batch=db.batch(),p=pair(me.uid,uid);batch.update(REQUESTS().doc(id),{status:"accepted",respondedAt:now});batch.set(FRIENDS().doc(p+"__"+me.uid),{pairId:p,ownerUid:me.uid,friendUid:uid,createdAt:now},{merge:true});batch.set(FRIENDS().doc(p+"__"+uid),{pairId:p,ownerUid:uid,friendUid:me.uid,createdAt:now},{merge:true});await batch.commit();toast("Friend added")}catch(e){console.error(e);toast("Accept করা যায়নি")}}
async function rejectRequest(id){try{await REQUESTS().doc(id).set({status:"rejected",respondedAt:firebase.firestore.FieldValue.serverTimestamp()},{merge:true});toast("Request declined")}catch(e){toast("কাজটি করা যায়নি")}}
function updateRequestBadge(){const n=requests.length;["requestBadge","navPeopleBadge"].forEach(id=>{const e=$(id);e.textContent=n;e.classList.toggle("hidden",!n)})}
async function updateStats(){if(!me)return;const msgs=await getLatestMessages();$("statChats").textContent=new Set(msgs.map(m=>m.senderUid===me.uid?m.receiverUid:m.senderUid)).size;$("statFriends").textContent=friends.length;$("statSent").textContent=msgs.filter(m=>m.senderUid===me.uid).length}
window.openUser=uid=>{const u=users.find(x=>x.uid===uid)||friends.find(x=>x.friendUid===uid);if(!u)return;$("userModalAvatar").src=avatar(u);$("userModalName").textContent=u.displayName||"User";$("userModalEmail").textContent=u.email||"";$("userModalBio").textContent=u.bio||"No bio added.";$("userModalChat").onclick=()=>{closeAllModals();openChat(uid)};$("userModal").classList.remove("hidden")};

function subscribeChat(uid){chatUnsubs.forEach(u=>u&&u());chatUnsubs=[];const ref=MESSAGES();chatUnsubs.push(ref.where("senderUid","==",me.uid).where("receiverUid","==",uid).onSnapshot(renderMessages));chatUnsubs.push(ref.where("senderUid","==",uid).where("receiverUid","==",me.uid).onSnapshot(renderMessages))}
async function renderMessages(){if(!activeFriend)return;const[a,b]=await Promise.all([MESSAGES().where("senderUid","==",me.uid).where("receiverUid","==",activeFriend.uid).get(),MESSAGES().where("senderUid","==",activeFriend.uid).where("receiverUid","==",me.uid).get()]);const arr=[...a.docs,...b.docs].map(d=>({id:d.id,...d.data()})).sort((x,y)=>(x.createdAt?.toMillis?.()||0)-(y.createdAt?.toMillis?.()||0));const box=$("messages");box.innerHTML=arr.length?arr.map(m=>{const mine=m.senderUid===me.uid,imgs=m.imageUrls||[],file=m.fileUrl?`<a class="file-card" href="${esc(m.fileUrl)}" target="_blank" rel="noopener"><span class="file-icon"><i class="fa-solid fa-file-arrow-down"></i></span><span class="file-copy"><b>${esc(m.fileName||"Shared file")}</b><small>${esc(m.fileSize?bytes(m.fileSize):"GoFile")}</small></span><i class="fa-solid fa-arrow-up-right-from-square file-download"></i></a>`:"";return`<div class="msg-row ${mine?"mine":"theirs"}"><div class="bubble">${m.text?`<div>${esc(m.text).replace(/\n/g,"<br>")}</div>`:""}${imgs.map(u=>`<img class="msg-img" src="${esc(u)}" onclick="showImage('${esc(u)}')">`).join("")}${file}<div class="msg-time">${time(m.createdAt)} ${mine?"✓":""}</div></div></div>`}).join(""):`<div class="empty" style="margin-top:30px">এখানে আপনার private conversation শুরু হবে।</div>`;box.scrollTop=box.scrollHeight}
window.showImage=url=>{$("lightboxImg").src=url;$("lightbox").classList.remove("hidden")};
function setChatHeader(u){$("chatName").textContent=u.displayName||"User";$("chatAvatar").src=avatar(u);$("chatStatus").textContent=u.online?"online":`last seen ${time(u.lastSeen)}`;$("chatPresence").classList.toggle("online",!!u.online)}
async function openChat(uid){
  await idbOpen();let u=users.find(x=>x.uid===uid)||friends.find(x=>x.friendUid===uid);if(!u)return;activeFriend=u;setChatHeader(u);$("chatPanel").classList.remove("hidden");document.body.style.overflow="hidden";subscribeChat(uid);watchTyping();await renderMessages()}
function closeChat(){chatUnsubs.forEach(u=>u&&u());chatUnsubs=[];if(typingUnsub)typingUnsub();typingUnsub=null;activeFriend=null;$("chatPanel")?.classList.add("hidden");document.body.style.overflow="";attachedImages=[];attachedFile=null;renderUploadQueue()}
function watchTyping(){if(!activeFriend)return;if(typingUnsub)typingUnsub();typingUnsub=USERS().doc(activeFriend.uid).onSnapshot(s=>{$("typing").classList.toggle("hidden",(s.data()||{}).typingTo!==me.uid)})}

async function uploadImage(file,onProgress){if(file.size>32*1024*1024)throw new Error("Image 32MB-এর বেশি হতে পারবে না");const fd=new FormData();fd.append("image",file);const r=await fetch(`https://api.imgbb.com/1/upload?key=${IMG_BB_KEY}`,{method:"POST",body:fd});const j=await r.json();if(!j.success)throw new Error("ImgBB upload failed");if(onProgress)onProgress(100);return j.data.url}

async function uploadGoFile(file,onProgress){
  const fd=new FormData();fd.append("file",file);
  const r=await fetch(GOFILE_ENDPOINT,{method:"POST",body:fd});
  const j=await r.json().catch(()=>null);
  if(!r.ok||!j||j.status!=="ok")throw new Error(j?.status||"GoFile upload failed");
  if(onProgress)onProgress(100);
  return j.data;
}

function renderUploadQueue(){
  const box=$("uploadQueue"),items=[...attachedImages.map((f,i)=>({f,type:"image",i})),...(attachedFile?[{f:attachedFile,type:"file",i:0}]:[])];
  box.classList.toggle("hidden",!items.length);
  box.innerHTML=items.map(x=>`<div class="queue-chip"><span class="queue-thumb">${x.type==="image"?`<img src="${URL.createObjectURL(x.f)}" style="width:34px;height:34px;border-radius:7px;object-fit:cover">`:`<i class="fa-solid fa-file-arrow-up"></i>`}</span><span class="queue-copy"><b>${esc(x.f.name)}</b><small>${bytes(x.f.size)}</small><span class="progress"><i></i></span></span></div>`).join("");
}
async function sendMessage(e){
  e.preventDefault();if(!activeFriend||!me)return;
  const input=$("messageInput"),text=input.value.trim();
  if(!text&&!attachedImages.length&&!attachedFile)return;
  const btn=document.querySelector(".send-btn");btn.disabled=true;
  try{
    const imageUrls=[];
    for(const f of attachedImages){toast("ImgBB-তে ছবি আপলোড হচ্ছে…");imageUrls.push(await uploadImage(f))}
    let fileData=null;
    if(attachedFile){toast("GoFile-এ ফাইল আপলোড হচ্ছে…");fileData=await uploadGoFile(attachedFile)}
    await MESSAGES().add({
      senderUid:me.uid,receiverUid:activeFriend.uid,text,imageUrls,
      imageUrl:imageUrls[0]||"",
      fileUrl:fileData?.downloadPage||"",
      fileId:fileData?.id||"",
      fileName:fileData?.name||attachedFile?.name||"",
      fileSize:fileData?.size||attachedFile?.size||0,
      fileMime:fileData?.mimetype||attachedFile?.type||"",
      fileHost:fileData?"gofile":"",
      createdAt:firebase.firestore.FieldValue.serverTimestamp(),seen:false
    });
    input.value="";input.style.height="auto";attachedImages=[];attachedFile=null;renderUploadQueue();$("attachMenu").classList.add("hidden");toast("Message sent");
  }catch(err){console.error(err);toast(err.message==="Failed to fetch"?"Upload service blocked or offline":(err.message||"Message পাঠানো যায়নি"))}
  finally{btn.disabled=false;input.focus()}
}
function handleTyping(){if(!activeFriend)return;clearTimeout(typingTimer);USERS().doc(me.uid).set({typingTo:activeFriend.uid,typingAt:firebase.firestore.FieldValue.serverTimestamp()},{merge:true}).catch(()=>{});typingTimer=setTimeout(()=>USERS().doc(me.uid).set({typingTo:null},{merge:true}).catch(()=>{}),1200)}
async function saveProfile(){const name=$("editName").value.trim();if(!name)return;try{const photo=$("editPhoto").value.trim()||null,bio=$("editBio").value.trim();await USERS().doc(me.uid).set({displayName:name,photoURL:photo,bio,profileUpdatedAt:firebase.firestore.FieldValue.serverTimestamp()},{merge:true});profile={...profile,displayName:name,photoURL:photo,bio};syncProfile();closeAllModals();toast("Profile updated")}catch(e){toast("Profile save হয়নি")}}



// ===== v4 Offline-first data layer =====
const FM_DB_NAME="fast-messenger-local";
const FM_DB_VERSION=1;
const FM_STORES={messages:"messages",meta:"meta"};
let fmDB=null;
let currentConversationId=null;
let messagePageSize=25;
let oldestLoadedCreatedAt=0;
let syncInProgress=false;

function idbOpen(){
  return new Promise((resolve,reject)=>{
    if(fmDB)return resolve(fmDB);
    const req=indexedDB.open(FM_DB_NAME,FM_DB_VERSION);
    req.onupgradeneeded=e=>{
      const db=e.target.result;
      const ms=db.createObjectStore(FM_STORES.messages,{keyPath:"id"});
      ms.createIndex("conversationCreatedAt",["conversationId","createdAtMs"],{unique:false});
      db.createObjectStore(FM_STORES.meta,{keyPath:"key"});
    };
    req.onsuccess=()=>{fmDB=req.result;resolve(fmDB)};
    req.onerror=()=>reject(req.error);
  });
}
async function idbPut(store,value){
  const db=await idbOpen();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(store,"readwrite");tx.objectStore(store).put(value);
    tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);
  });
}
async function idbGet(store,key){
  const db=await idbOpen();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(store,"readonly"),r=tx.objectStore(store).get(key);
    r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);
  });
}
async function idbMessages(conversationId,limit=25,beforeMs=Infinity){
  const db=await idbOpen();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(FM_STORES.messages,"readonly");
    const idx=tx.objectStore(FM_STORES.messages).index("conversationCreatedAt");
    const range=IDBKeyRange.bound([conversationId,0],[conversationId,beforeMs]);
    const req=idx.openCursor(range,"prev"),out=[];
    req.onsuccess=e=>{
      const c=e.target.result;
      if(!c||out.length>=limit){resolve(out.reverse());return}
      out.push(c.value);c.continue();
    };
    req.onerror=()=>reject(req.error);
  });
}
async function idbPutMessages(items){
  if(!items?.length)return;
  const db=await idbOpen();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(FM_STORES.messages,"readwrite"),st=tx.objectStore(FM_STORES.messages);
    items.forEach(m=>st.put(normalizeLocalMessage(m)));
    tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);
  });
}
async function idbSetMeta(key,value){return idbPut(FM_STORES.meta,{key,value})}
async function idbGetMeta(key){const x=await idbGet(FM_STORES.meta,key);return x?.value}
function normalizeLocalMessage(m){
  return {...m,
    createdAtMs:m.createdAtMs || (m.createdAt?.toMillis?m.createdAt.toMillis():Date.now()),
    conversationId:m.conversationId || pair(m.senderUid,m.receiverUid)
  };
}
async function cacheSnapshotMessages(snapshot){
  const items=snapshot.docs.map(d=>normalizeLocalMessage({id:d.id,...d.data()}));
  await idbPutMessages(items);
  return items;
}
async function renderLocalMessages(conversationId,limit=25,beforeMs=Infinity){
  const local=await idbMessages(conversationId,limit,beforeMs);
  if(conversationId!==currentConversationId)return local;
  oldestLoadedCreatedAt=local.length?local[0].createdAtMs:0;
  renderMessagesFromPlain(local);
  return local;
}
function renderMessagesFromPlain(items){
  const box=$("chatMessages");if(!box)return;
  if(!items.length){
    box.innerHTML='<div class="empty-state"><i class="fa-regular fa-comments"></i><b>No messages yet</b><span>Start the conversation.</span></div>';
    return;
  }
  box.innerHTML=items.map(m=>messageHTML(m)).join("");
  box.scrollTop=box.scrollHeight;
}
async function loadOlderLocalMessages(){
  if(!currentConversationId||!oldestLoadedCreatedAt)return;
  const older=await idbMessages(currentConversationId,messagePageSize,oldestLoadedCreatedAt-1);
  if(!older.length){toast("No more local messages");return}
  const box=$("chatMessages"),oldHeight=box.scrollHeight,oldTop=box.scrollTop;
  box.insertAdjacentHTML("afterbegin",older.map(m=>messageHTML(m)).join(""));
  oldestLoadedCreatedAt=older[0].createdAtMs;
  box.scrollTop=box.scrollHeight-oldHeight+oldTop;
}
async function deltaSync(){
  if(!me||!navigator.onLine||syncInProgress)return;
  syncInProgress=true;setSyncUI(true,"Syncing changes…");
  try{
    const last=Number(await idbGetMeta("lastSync_"+me.uid)||0);
    const cursor=firebase.firestore.Timestamp.fromMillis(last);
    const [s1,s2]=await Promise.all([
      MESSAGES().where("senderUid","==",me.uid).where("createdAt",">",cursor).get(),
      MESSAGES().where("receiverUid","==",me.uid).where("createdAt",">",cursor).get()
    ]);
    const map=new Map();
    s1.docs.forEach(d=>map.set(d.id,{id:d.id,...d.data()}));
    s2.docs.forEach(d=>map.set(d.id,{id:d.id,...d.data()}));
    await idbPutMessages(Array.from(map.values()));
    await idbSetMeta("lastSync_"+me.uid,Date.now());
    if(currentConversationId)await renderLocalMessages(currentConversationId,25);
  }catch(e){console.warn("Delta sync:",e)}
  finally{setSyncUI(false);syncInProgress=false}
}
function setSyncUI(show,text="Syncing…"){
  $("syncBar").classList.toggle("hidden",!show);$("syncText").textContent=text;
}
function updateConnectivity(){
  const off=!navigator.onLine;
  document.body.classList.toggle("offline",off);
  $("offlineBar").classList.toggle("hidden",!off);
  if(!off)deltaSync();
}
function installPullToRefresh(){
  const area=$("chatView")||document.body,indicator=$("pullRefresh");
  let startY=0,dist=0,tracking=false;
  area.addEventListener("touchstart",e=>{
    const target=$("chatMessages");
    if(target&&target.scrollTop<=0){startY=e.touches[0].clientY;tracking=true;dist=0}
  },{passive:true});
  area.addEventListener("touchmove",e=>{
    if(!tracking)return;dist=e.touches[0].clientY-startY;
    if(dist>0){
      const p=Math.min(1,dist/90);
      indicator.style.marginTop=(-48+p*54)+"px";
      indicator.style.transform=`translateX(-50%) rotate(${p*180}deg)`;
      indicator.classList.toggle("ready",dist>70);
    }
  },{passive:true});
  area.addEventListener("touchend",async()=>{
    if(!tracking)return;tracking=false;
    const refresh=dist>70;indicator.classList.remove("ready");
    if(refresh){
      indicator.classList.add("refreshing");indicator.style.marginTop="10px";
      await deltaSync();await new Promise(r=>setTimeout(r,250));
      indicator.classList.remove("refreshing");
    }
    indicator.style.marginTop="-48px";indicator.style.transform="translateX(-50%)";dist=0;
  });
}

const SUPPORT_EMAIL="YOUR_SUPPORT_EMAIL@example.com";
const DEFAULT_APP_URL=window.location.href.split("#")[0];

function syncMenu(){
  if(!profile)return;
  $("menuAvatar").src=avatar(profile);
  $("menuName").textContent=profile.displayName||me?.displayName||"User";
  $("menuEmail").textContent=profile.email||me?.email||"";
  $("supportEmailLabel").textContent=SUPPORT_EMAIL;
}
function applyTheme(dark,save=true){
  document.documentElement.classList.toggle("dark",dark);
  document.body.classList.toggle("dark",dark);
  $("themeToggle").checked=dark;
  if(save)localStorage.setItem("fm_theme",dark?"dark":"light");
}
function applyNotifications(on,save=true){
  $("notificationToggle").checked=on;
  if(save)localStorage.setItem("fm_notifications",on?"on":"off");
}
function playNotificationSound(){
  if(localStorage.getItem("fm_notifications")==="off")return;
  try{
    const C=window.AudioContext||window.webkitAudioContext;
    if(!C)return;
    const c=new C(),o=c.createOscillator(),g=c.createGain();
    o.frequency.value=880;g.gain.value=.035;o.connect(g);g.connect(c.destination);
    o.start();o.stop(c.currentTime+.08);
  }catch(_){}
}
async function shareApp(){
  const data={title:"Fast Messenger",text:"Fast Messenger-এ যোগ দিন",url:DEFAULT_APP_URL};
  try{
    if(navigator.share)await navigator.share(data);
    else{await navigator.clipboard.writeText(DEFAULT_APP_URL);toast("App link copied")}
  }catch(e){if(e?.name!=="AbortError")toast("Share করা যায়নি")}
}
function supportEmail(){
  if(!SUPPORT_EMAIL||SUPPORT_EMAIL.includes("YOUR_SUPPORT_EMAIL"))return toast("app.js-এ SUPPORT_EMAIL সেট করুন");
  const subject=encodeURIComponent("Fast Messenger Support / Feedback");
  const body=encodeURIComponent(`Hello Support,\n\nআমার সমস্যা / মতামত:\n\n\nUser: ${me?.email||""}`);
  location.href=`mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
}
function showSettings(){showView("settingsView");$("moreMenu").classList.add("hidden")}
function showProfile(){showView("profileView");$("moreMenu").classList.add("hidden")}
function confirmDeleteAccount(){
  if(!me)return;
  const ok=confirm("অ্যাকাউন্ট ডিলিট করলে এই অ্যাপের profile, friend list, friend request এবং আপনার messages মুছে যাবে। Google account মুছবে না।\n\nআপনি কি এগোতে চান?");
  if(ok)deleteAccount();
}
async function deleteAccount(){
  const btn=$("deleteAccountBtn");btn.disabled=true;
  try{
    const uid=me.uid;
    const collections=[USERS(),FRIENDS(),REQUESTS(),MESSAGES()];
    for(const col of collections){
      const qs=col.where("senderUid","==",uid);
      const qr=col.where("receiverUid","==",uid);
      const qo=col.where("ownerUid","==",uid);
      const docs=new Map();
      for(const q of [qs,qr,qo]){const s=await q.get();s.docs.forEach(d=>docs.set(d.id,d))}
      if(col===USERS()){const s=await col.doc(uid).get();if(s.exists)docs.set(s.id,s)}
      let batch=db.batch(),count=0;
      for(const d of docs.values()){batch.delete(d.ref);count++;if(count===450){await batch.commit();batch=db.batch();count=0}}
      if(count)await batch.commit();
    }
    await auth.currentUser.delete();
  }catch(e){
    console.error(e);
    if(e?.code==="auth/requires-recent-login")toast("নিরাপত্তার জন্য আবার Google login করে Delete Account চালান");
    else toast("Account delete করা যায়নি");
  }finally{btn.disabled=false}
}
async function clearCache(){
  try{
    localStorage.removeItem("fm_theme");
    localStorage.removeItem("fm_notifications");
    sessionStorage.clear();
    if("caches" in window){const ks=await caches.keys();await Promise.all(ks.map(k=>caches.delete(k)))}
    toast("Temporary cache cleared");
  }catch(e){toast("Cache clear সম্পূর্ণ হয়নি")}
}
function initPreferences(){
  applyTheme(localStorage.getItem("fm_theme")==="dark",false);
  applyNotifications(localStorage.getItem("fm_notifications")!=="off",false);
}

$("googleLogin").onclick=async()=>{const b=$("googleLogin");b.disabled=true;try{await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider())}catch(e){console.error(e);$("loginError").textContent=e.message||"Login failed"}finally{b.disabled=false}};
auth.onAuthStateChanged(async user=>{if(user){me=user;$("loginScreen").classList.add("hidden");$("app").classList.remove("hidden");await ensureUser();heartbeat();startListeners();syncProfile();syncMenu();watchIncomingNotifications()}else{$("app").classList.add("hidden");$("loginScreen").classList.remove("hidden")}});

document.querySelectorAll(".nav-item").forEach(b=>b.onclick=()=>showView(b.dataset.view));
document.querySelectorAll("[data-people-tab]").forEach(b=>b.onclick=()=>{peopleTab=b.dataset.peopleTab;document.querySelectorAll("[data-people-tab]").forEach(x=>x.classList.toggle("active",x===b));renderPeople()});
$("peopleSearch").oninput=renderPeople;$("chatSearch").oninput=renderChats;
$("refreshBtn").onclick=()=>{renderChats();renderPeople();toast("Refreshed")};
$("newChatBtn").onclick=()=>{showView("peopleView");peopleTab="all";document.querySelectorAll("[data-people-tab]").forEach(x=>x.classList.toggle("active",x.dataset.peopleTab==="all"));renderPeople();$("peopleSearch").focus()};
$("backChat").onclick=closeChat;$("composer").onsubmit=sendMessage;
$("messageInput").addEventListener("input",e=>{e.target.style.height="auto";e.target.style.height=Math.min(e.target.scrollHeight,120)+"px";handleTyping()});
$("attachBtn").onclick=()=>{$("attachMenu").classList.toggle("hidden")};
document.addEventListener("click",e=>{if(!$("attachMenu").contains(e.target)&&!$("attachBtn").contains(e.target))$("attachMenu").classList.add("hidden")});
$("pickImage").onclick=()=>{$("imageInput").click();$("attachMenu").classList.add("hidden")};
$("pickFile").onclick=()=>{$("fileInput").click();$("attachMenu").classList.add("hidden")};
$("imageInput").onchange=e=>{attachedImages=[...attachedImages,...Array.from(e.target.files||[]).filter(f=>f.type.startsWith("image/"))].slice(0,5);e.target.value="";renderUploadQueue()};
$("fileInput").onchange=e=>{attachedFile=e.target.files?.[0]||null;e.target.value="";renderUploadQueue()};
$("profileBtn").onclick=()=>showProfile();
$("settingsFromProfile").onclick=showSettings;

$("logoutBtn").onclick=async()=>{if(confirm("Log out করবেন?")){if(me)await USERS().doc(me.uid).set({online:false,lastSeen:firebase.firestore.FieldValue.serverTimestamp()},{merge:true});await auth.signOut()}};
document.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>$(b.dataset.close).classList.add("hidden"));
$("chatInfo").onclick=()=>{if(activeFriend)openUser(activeFriend.uid)};
$("closeLightbox").onclick=()=>{$("lightbox").classList.add("hidden");$("lightboxImg").src=""};


// ===== v3 UI wiring =====
initPreferences();

$("menuBtn").onclick=(e)=>{e.stopPropagation();syncMenu();$("moreMenu").classList.toggle("hidden")};
document.querySelectorAll("[data-menu-action]").forEach(b=>b.onclick=async()=>{
  const a=b.dataset.menuAction;
  if(a==="profile")showProfile();
  if(a==="settings")showSettings();
  if(a==="share"){ $("moreMenu").classList.add("hidden"); await shareApp(); }
  if(a==="support"){ $("moreMenu").classList.add("hidden"); supportEmail(); }
  if(a==="logout"){ $("moreMenu").classList.add("hidden"); $("logoutBtn").click(); }
});
document.addEventListener("click",e=>{
  if(!$("moreMenu").contains(e.target)&&!$("menuBtn").contains(e.target))$("moreMenu").classList.add("hidden");
});
$("navFab").onclick=()=>{$("newChatBtn").click()};
$("settingsBack").onclick=()=>showView("profileView");
$("themeToggle").onchange=e=>applyTheme(e.target.checked);
$("notificationToggle").onchange=e=>applyNotifications(e.target.checked);
$("privacyBtn").onclick=()=>$("privacyModal").classList.remove("hidden");
$("clearCacheBtn").onclick=clearCache;
$("supportBtn").onclick=supportEmail;
$("deleteAccountBtn").onclick=confirmDeleteAccount;

// In-app alert/sound for new incoming messages.
let lastKnownIncoming=0;
function watchIncomingNotifications(){
  if(!me)return;
  MESSAGES().where("receiverUid","==",me.uid).onSnapshot(s=>{
    const fresh=s.docChanges().filter(c=>c.type==="added").map(c=>c.doc.data()).filter(m=>m.createdAt?.toMillis);
    if(!fresh.length)return;
    const newest=Math.max(...fresh.map(m=>m.createdAt.toMillis()));
    if(lastKnownIncoming && newest>lastKnownIncoming && (!activeFriend || fresh.some(m=>m.senderUid!==activeFriend.uid))){
      playNotificationSound();
      toast("নতুন message এসেছে");
    }
    lastKnownIncoming=Math.max(lastKnownIncoming,newest);
  });
}
const originalAuthHandler = auth.currentUser;

// ===== v4 startup hooks =====
window.addEventListener("online",updateConnectivity);
window.addEventListener("offline",updateConnectivity);
document.addEventListener("DOMContentLoaded",async()=>{
  try{await idbOpen()}catch(e){console.warn("IndexedDB unavailable",e)}
  updateConnectivity();
  installPullToRefresh();
  const box=$("chatMessages");
  if(box)box.addEventListener("scroll",()=>{
    if(box.scrollTop<90 && currentConversationId&&!syncInProgress)loadOlderLocalMessages();
  });
});
