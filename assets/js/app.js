
        const firebaseConfig = {
            apiKey: "AIzaSyDOU1dpWdqTZjGMjQjX_V3Iv6JMvcIoa2I",
            authDomain: "pigeon-7a637.firebaseapp.com",
            projectId: "pigeon-7a637",
            storageBucket: "pigeon-7a637.firebasestorage.app",
            messagingSenderId: "560041972635",
            appId: "1:560041972635:web:e9dda41d8abbccfda8473e",
            measurementId: "G-Q01M0H0TFK"
        };

        // Initialize Firebase
        firebase.initializeApp(firebaseConfig);
        // Analytics is optional. Do not let Analytics initialization prevent the
        // main Firebase Auth/Firestore application from starting (notably on file://).
        try {
            if (firebase.analytics) firebase.analytics();
        } catch (analyticsError) {
            console.warn('Firebase Analytics unavailable; continuing without Analytics.', analyticsError);
        }
        const auth = firebase.auth();
        const db = firebase.firestore();
        const appId = 'pigeon-7a637';

        let currentUser = null;
        let unsubscribePigeons = null;
        let unsubscribeUsers = null;
        let allUsersList = [];
        let selectedRecipientObj = null;
        let selectedFriendObj = null;
        let allFriendsList = [];
        let incomingFriendRequests = [];
        let outgoingFriendRequests = [];
        let unsubscribeFriendRequests = null;
        let unsubscribeAcceptedFriendRequestsA = null;
        let unsubscribeAcceptedFriendRequestsB = null;
        let unsubscribeFriends = null;
        let unsubscribeMessagesA = null;
        let unsubscribeMessagesB = null;
        let messageCache = [];
        let friendsListenersStarted = false;
        let unsubscribeChatRoomsA = null;
        let unsubscribeChatRoomsB = null;
        let chatRoomMessages = [];
        let unsubscribeActivity = null;
        let activityItems = [];
        let selectedChatImages = [];
        let selectedChatFiles = [];
        let selectedLetterFiles = [];


        // Keep the Firebase session locally so a page reload does not sign the user out.
        // IMPORTANT: do not show the login overlay until Firebase has finished restoring
        // the previous session. This prevents the brief login-screen flash on reload.
        let authStateResolved = false;
        auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(err => {
            console.error("Persistence setup error:", err);
        });

        // Auth: only real email/Google accounts are allowed. No anonymous access.
        auth.onAuthStateChanged((user) => {
            currentUser = user || null;
            authStateResolved = true;

            const overlay = document.getElementById('loginOverlay');
            if (user && !user.isAnonymous && user.email) {
                if (overlay) {
                    // It may already be hidden while Firebase restores the session.
                    overlay.classList.add('opacity-0', 'pointer-events-none');
                    setTimeout(() => overlay.classList.add('hidden'), 500);
                }

                const nameDisp = document.getElementById('senderNameDisplay');
                if (nameDisp) nameDisp.innerText = user.displayName || user.email.split('@')[0];
                const avatarDisp = document.getElementById('senderAvatar');
                if (avatarDisp && user.photoURL) avatarDisp.src = user.photoURL;
                currentUserProfile = {
                    ...(currentUserProfile || {}),
                    uid: user.uid,
                    displayName: user.displayName || user.email.split('@')[0],
                    email: user.email,
                    photoURL: user.photoURL || null
                };
                syncProfileUI();

                requestAndSaveLocation(user);
                listenToPigeons();
                listenToUsers();
                listenToActivity();
                listenToChatRooms();
                setTimeout(()=>{initComposeUI();renderSmartNotices();updateProfileStats();}, 200);
            } else {
                // Only show login after Firebase has definitively reported that there is
                // no valid persisted Google/email session. Never flash it during reload.
                if (overlay && authStateResolved) {
                    overlay.classList.remove('hidden');
                    requestAnimationFrame(() => overlay.classList.remove('opacity-0', 'pointer-events-none'));
                }
                if (unsubscribePigeons) { unsubscribePigeons(); unsubscribePigeons = null; }
                if (unsubscribeUsers) { unsubscribeUsers(); unsubscribeUsers = null; }
                window.pigeonsList = [];
            }
        });

        async function signInWithGoogle() {
            const btn = document.getElementById('googleLoginBtn');
            const errDiv = document.getElementById('loginErrorMsg');
            const originalBtnHTML = btn.innerHTML;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Authenticating...';
            btn.disabled = true;
            errDiv.classList.add('hidden');

            const provider = new firebase.auth.GoogleAuthProvider();
            try {
                await auth.signInWithPopup(provider);
            } catch (error) {
                console.error('Google Auth Error:', error);
                errDiv.innerText = error.message || 'Failed to authenticate.';
                errDiv.classList.remove('hidden');
                btn.innerHTML = originalBtnHTML;
                btn.disabled = false;
            }
        }


        function getProfileDisplayName() {
            const u = currentUser;
            const p = currentUserProfile || {};
            return p.displayName || u?.displayName || (u?.email ? u.email.split('@')[0] : 'User');
        }

        function getProfilePhoto() {
            const p = currentUserProfile || {};
            return p.photoURL || currentUser?.photoURL || 'https://placehold.co/200x200/3d2617/fdfbf7?text=?';
        }

        function getProfileBio() {
            const p = currentUserProfile || {};
            return String(p.bio || '').trim() || 'No bio added yet.';
        }

        function syncProfileUI() {
            const name = getProfileDisplayName();
            const photo = getProfilePhoto();
            const email = currentUserProfile?.email || currentUser?.email || '';
            const bio = getProfileBio();

            const headerAvatar = document.getElementById('headerProfileAvatar');
            if (headerAvatar) headerAvatar.src = photo;

            const profileAvatar = document.getElementById('profileModalAvatar');
            if (profileAvatar) profileAvatar.src = photo;

            const profileName = document.getElementById('profileModalName');
            if (profileName) profileName.textContent = name;

            const profileEmail = document.getElementById('profileModalEmail');
            if (profileEmail) profileEmail.textContent = email;

            const profileBio = document.getElementById('profileModalBio');
            if (profileBio) profileBio.textContent = bio;

            const senderName = document.getElementById('senderNameDisplay');
            if (senderName) senderName.textContent = name;

            const senderAvatar = document.getElementById('senderAvatar');
            if (senderAvatar) senderAvatar.src = photo;
        }

        function getActivityCollectionRef() {
            return getPublicDataCollection().collection('activities');
        }
        async function logActivity(type, title, body, meta={}) {
            if (!currentUser) return;
            try {
                await getActivityCollectionRef().add({uid:currentUser.uid,type,title,body,meta,createdAt:firebase.firestore.FieldValue.serverTimestamp()});
            } catch(e) { console.warn('Activity log unavailable:',e); }
        }
        function formatActivityTime(v) {
            try { const ms=v?.toMillis?v.toMillis():Number(v||0); if(!ms)return 'Just now'; return new Date(ms).toLocaleString([], {month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}); } catch(e){return '';}
        }
        function renderActivityList() {
            const box=document.getElementById('activityList'); if(!box)return;
            const virtual=[];
            (incomingFriendRequests||[]).forEach(r=>virtual.push({id:'req-'+r.id,type:'friend',title:'New friend request',body:'Someone sent you a friend request.',createdAt:r.createdAt||0}));
            (window.pigeonsList||[]).filter(p=>p.direction==='incoming').slice(0,20).forEach(p=>virtual.push({id:'pigeon-'+p.id,type:'pigeon',title:p.status==='delivered'?'Letter received':'Incoming pigeon',body:`${p.senderName||'A member'} sent you a pigeon letter.`,createdAt:p.dispatchTime||0}));
            const items=[...activityItems,...virtual].sort((a,b)=>(b.createdAt?.toMillis?b.createdAt.toMillis():Number(b.createdAt||0))-(a.createdAt?.toMillis?a.createdAt.toMillis():Number(a.createdAt||0))).slice(0,100);
            document.getElementById('profileStatActivity') && (document.getElementById('profileStatActivity').textContent=items.length);
            const badge=document.getElementById('profileActivityBadge'); if(badge){badge.textContent=items.length;badge.classList.toggle('hidden',items.length===0);}
            if(!items.length){box.innerHTML='<div class="activity-empty"><i class="fa-solid fa-bolt"></i><span>No activity yet.</span></div>';return;}
            const icons={message:'fa-message',pigeon:'fa-dove',friend:'fa-user-group',profile:'fa-user-pen',system:'fa-bell'};
            box.innerHTML=items.map(x=>`<div class="activity-item"><div class="activity-icon"><i class="fa-solid ${icons[x.type]||icons.system}"></i></div><div class="activity-copy"><strong>${escapeHtmlSafe(x.title||'Activity')}</strong><p>${escapeHtmlSafe(x.body||'')}</p><small>${escapeHtmlSafe(formatActivityTime(x.createdAt))}</small></div></div>`).join('');
        }
        function listenToActivity() {
            if(unsubscribeActivity) unsubscribeActivity();
            if(!currentUser) return;
            unsubscribeActivity=getActivityCollectionRef().where('uid','==',currentUser.uid).limit(100).onSnapshot(snap=>{activityItems=snap.docs.map(d=>({id:d.id,...d.data()}));renderActivityList();},err=>console.warn('Activity listener:',err));
        }
        window.openActivityPanel=function(){
            closeProfileModal();
            const m=document.getElementById('activityModal'); if(m){m.classList.remove('hidden');document.body.classList.add('overflow-hidden');renderActivityList();}
        };
        window.closeActivityPanel=function(){document.getElementById('activityModal')?.classList.add('hidden');if(document.getElementById('profileEditorModal')?.classList.contains('hidden'))document.body.classList.remove('overflow-hidden');};
        window.handleActivityBackdrop=function(e){if(e.target?.id==='activityModal')closeActivityPanel();};
        window.openProfileEditor=function(){
            const p=currentUserProfile||{}; document.getElementById('profileEditName').value=getProfileDisplayName();document.getElementById('profileEditPhoto').value=p.photoURL||'';document.getElementById('profileEditBio').value=p.bio||'';
            document.getElementById('profileEditorModal')?.classList.remove('hidden');document.body.classList.add('overflow-hidden');
        };
        window.closeProfileEditor=function(){document.getElementById('profileEditorModal')?.classList.add('hidden');if(document.getElementById('activityModal')?.classList.contains('hidden')&&document.getElementById('profileModal')?.classList.contains('hidden'))document.body.classList.remove('overflow-hidden');};
        window.handleProfileEditorBackdrop=function(e){if(e.target?.id==='profileEditorModal')closeProfileEditor();};
        window.saveProfile=async function(e){
            e.preventDefault(); if(!currentUser)return;
            const btn=document.getElementById('profileSaveBtn'); const name=document.getElementById('profileEditName').value.trim(); const photo=document.getElementById('profileEditPhoto').value.trim(); const bio=document.getElementById('profileEditBio').value.trim();
            if(!name)return; btn.disabled=true; btn.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
            try { await getUsersCollectionRef().doc(currentUser.uid).set({displayName:name,photoURL:photo||currentUser.photoURL||null,bio,profileUpdatedAt:firebase.firestore.FieldValue.serverTimestamp()},{merge:true}); currentUserProfile={...(currentUserProfile||{}),displayName:name,photoURL:photo||currentUser.photoURL||null,bio}; syncProfileUI(); await logActivity('profile','Profile updated','Your profile information was updated.'); closeProfileEditor(); } catch(err){console.error(err);alert('Profile could not be saved.');} finally{btn.disabled=false;btn.innerHTML='<i class="fa-solid fa-check"></i> Save Profile';}
        };
        function updateProfileStats(){
            const sent=(window.pigeonsList||[]).filter(x=>x.senderUid===currentUser?.uid).length, received=(window.pigeonsList||[]).filter(x=>x.receiverUid===currentUser?.uid).length;
            const a=document.getElementById('profileStatSent'),b=document.getElementById('profileStatReceived'),c=document.getElementById('profileStatFriends');if(a)a.textContent=sent;if(b)b.textContent=received;if(c)c.textContent=(allFriendsList||[]).length;
        }
        function renderSmartNotices() {
            const bar=document.getElementById('smartNoticeBar'),list=document.getElementById('smartNoticeList');if(!bar||!list)return;
            const notices=[];
            if(currentUser && currentUserProfile?.locationPermission==='denied') notices.push({key:'location',icon:'fa-location-dot',title:'Location access is off',body:'Location is needed for distance-based pigeon delivery.'});
            if(currentUser && !currentUserProfile?.bio) notices.push({key:'profile',icon:'fa-user-pen',title:'Complete your profile',body:'Add a bio and profile photo from your profile menu.'});
            if(!navigator.onLine) notices.push({key:'offline',icon:'fa-wifi',title:'You are offline',body:'Some realtime features may pause until you reconnect.'});
            const dismissed=JSON.parse(localStorage.getItem('pigeonDismissedNotices')||'[]'); const active=notices.filter(n=>!dismissed.includes(n.key));
            bar.classList.toggle('hidden',active.length===0); list.innerHTML=active.map(n=>`<div class="smart-notice"><i class="fa-solid ${n.icon}"></i><div><strong>${escapeHtmlSafe(n.title)}</strong><span>${escapeHtmlSafe(n.body)}</span></div></div>`).join('');
        }
        window.dismissSmartNotices=function(){const keys=Array.from(document.querySelectorAll('.smart-notice')).map(()=>null);const bar=document.getElementById('smartNoticeBar');if(bar)bar.classList.add('hidden');localStorage.setItem('pigeonDismissedNotices',JSON.stringify(['location','profile','offline']));};
        window.addEventListener('online',renderSmartNotices);window.addEventListener('offline',renderSmartNotices);

        window.openProfileModal = function() {
            if (!currentUser || currentUser.isAnonymous) return;
            syncProfileUI();
            const modal = document.getElementById('profileModal');
            if (modal) modal.classList.remove('hidden');
            document.body.classList.add('overflow-hidden');
        };

        window.closeProfileModal = function() {
            const modal = document.getElementById('profileModal');
            if (modal) modal.classList.add('hidden');
            if (document.getElementById('logoutModal')?.classList.contains('hidden')) {
                document.body.classList.remove('overflow-hidden');
            }
        };

        window.handleProfileBackdropClick = function(event) {
            if (event.target?.id === 'profileModal') closeProfileModal();
        };

        window.openLogoutModal = function() {
            const modal = document.getElementById('logoutModal');
            if (modal) modal.classList.remove('hidden');
            document.body.classList.add('overflow-hidden');
        };

        window.closeLogoutModal = function() {
            const modal = document.getElementById('logoutModal');
            if (modal) modal.classList.add('hidden');
            if (document.getElementById('profileModal')?.classList.contains('hidden')) {
                document.body.classList.remove('overflow-hidden');
            }
        };

        window.handleLogoutBackdropClick = function(event) {
            if (event.target?.id === 'logoutModal') closeLogoutModal();
        };

        window.performLogout = async function() {
            const confirmBtn = document.querySelector('.logout-confirm');
            if (confirmBtn) {
                confirmBtn.disabled = true;
                confirmBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Logging out...';
            }

            try {
                await auth.signOut();
                closeLogoutModal();
                closeProfileModal();
                switchTab('dispatch');
            } catch (error) {
                console.error('Logout error:', error);
                alert(error.message || 'Could not log out. Please try again.');
            } finally {
                if (confirmBtn) {
                    confirmBtn.disabled = false;
                    confirmBtn.textContent = 'Log Out';
                }
            }
        };

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                const logout = document.getElementById('logoutModal');
                const profile = document.getElementById('profileModal');
                const editor = document.getElementById('profileEditorModal'); const activity = document.getElementById('activityModal');
                if (logout && !logout.classList.contains('hidden')) {
                    closeLogoutModal();
                } else if (editor && !editor.classList.contains('hidden')) { closeProfileEditor();
                } else if (activity && !activity.classList.contains('hidden')) { closeActivityPanel();
                } else if (profile && !profile.classList.contains('hidden')) {
                    closeProfileModal();
                }
            }
        });

        let currentUserProfile = null;
        function requestAndSaveLocation(user) {
            const userRef=getUsersCollectionRef().doc(user.uid);
            const base={uid:user.uid,displayName:user.displayName||user.email.split('@')[0],email:user.email,photoURL:user.photoURL||null,lastLogin:firebase.firestore.FieldValue.serverTimestamp()};
            if(!navigator.geolocation){ userRef.set(base,{merge:true}).catch(console.error); return; }
            navigator.geolocation.getCurrentPosition(async pos=>{
                const coords={lat:Number(pos.coords.latitude.toFixed(6)),lng:Number(pos.coords.longitude.toFixed(6))};
                const profile={...base,coords,locationUpdatedAt:firebase.firestore.FieldValue.serverTimestamp(),locationAccuracy:pos.coords.accuracy||null,locationPermission:'granted'};
                currentUserProfile={...currentUserProfile,...profile,locationUpdatedAt:{toMillis:()=>Date.now()}};
                syncProfileUI();
                try{await userRef.set(profile,{merge:true});}catch(e){console.error('Could not save user location/profile:',e);}
                const latEl=document.getElementById('senderLat'),lngEl=document.getElementById('senderLng');
                if(latEl)latEl.value=coords.lat;if(lngEl)lngEl.value=coords.lng;calculateDistancePreview();renderFriendsUI();
            },async err=>{
                console.warn('Location not granted',err);
                currentUserProfile={...currentUserProfile,...base,locationPermission:err.code===1?'denied':'unavailable'};
                syncProfileUI(); renderSmartNotices();
                try{await userRef.set({...base,locationPermission:err.code===1?'denied':'unavailable'},{merge:true});}catch(e){console.error(e);}
                renderFriendsUI();
            },{enableHighAccuracy:true,maximumAge:300000,timeout:12000});
        }

        function listenToUsers() {
            if (unsubscribeUsers) unsubscribeUsers();
            const colRef = db.collection('artifacts').doc(appId).collection('public').doc('data').collection('users');
            
            unsubscribeUsers = colRef.onSnapshot((snapshot) => {
                const list = [];
                snapshot.forEach((docSnap) => {
                    if (docSnap.id === currentUser.uid) {
                        currentUserProfile = {uid: docSnap.id, ...docSnap.data()};
                        syncProfileUI(); renderSmartNotices(); updateProfileStats();
                    } else list.push({uid: docSnap.id, ...docSnap.data()});
                });
                allUsersList = list;
                renderUsersList(allUsersList);
            }, (error) => {
                console.error('Users subscription error:', error);
                allUsersList = [];
                renderUsersList([]);
            });
        }

        function getRecentRecipients() {
            try { return JSON.parse(localStorage.getItem(`pigeonRecent_${currentUser?.uid || 'guest'}`) || '[]'); } catch(e) { return []; }
        }
        function saveRecentRecipient(user) {
            if (!currentUser || !user) return;
            let list = getRecentRecipients().filter(x => x.uid !== user.uid);
            list.unshift({uid:user.uid,displayName:user.displayName,email:user.email,photoURL:user.photoURL});
            list = list.slice(0, 8);
            localStorage.setItem(`pigeonRecent_${currentUser.uid}`, JSON.stringify(list));
            renderRecentRecipients();
        }
        window.clearRecentRecipients = function() {
            if (currentUser) localStorage.removeItem(`pigeonRecent_${currentUser.uid}`);
            renderRecentRecipients();
        };
        function renderRecentRecipients() {
            const section=document.getElementById('recentRecipientsSection'), box=document.getElementById('recentRecipientsContainer');
            if(!section||!box) return;
            const recents=getRecentRecipients().filter(r=>allUsersList.some(u=>u.uid===r.uid));
            if(!recents.length){section.classList.add('hidden');box.innerHTML='';return;}
            section.classList.remove('hidden');
            box.innerHTML=recents.map(r=>`<button type="button" class="recent-recipient" onclick="selectRecipient('${r.uid}')">
                <img src="${r.photoURL||'https://placehold.co/100x100/3d2617/fdfbf7?text=?'}" alt="">
                <span>${escapeHtmlSafe(r.displayName||r.email||'Member')}</span>
            </button>`).join('');
        }

        function renderSelectedRecipient() {
            const chip=document.getElementById('selectedRecipientChip'), status=document.getElementById('selectedRecipientStatus');
            if(!chip||!status) return;
            if(!selectedRecipientObj){ chip.classList.add('hidden'); chip.innerHTML=''; status.textContent='Choose a member'; return; }
            chip.classList.remove('hidden');
            chip.innerHTML=`<div class="selected-recipient-chip">
                <img src="${selectedRecipientObj.photoURL||'https://placehold.co/100x100/3d2617/fdfbf7?text=?'}" alt="">
                <div class="min-w-0 flex-1"><strong>${escapeHtmlSafe(selectedRecipientObj.displayName||'Member')}</strong><small>${escapeHtmlSafe(selectedRecipientObj.email||'')}</small></div>
                <button type="button" onclick="clearSelectedRecipient()" aria-label="Remove recipient"><i class="fa-solid fa-xmark"></i></button>
            </div>`;
            status.textContent='Recipient selected';
        }
        window.clearSelectedRecipient=function(){selectedRecipientObj=null;renderSelectedRecipient();renderUsersList(allUsersList);};

        function renderUsersList(users) {
            const container = document.getElementById('usersListContainer');
            if (!container) return;
            const count=document.getElementById('directoryCount'); if(count) count.textContent=`${users.length} member${users.length===1?'':'s'}`;
            if (!users.length) { container.innerHTML='<div class="empty-directory">No matching member found.</div>'; return; }
            const recentIds=new Set(getRecentRecipients().map(r=>r.uid));
            const sorted=[...users].sort((a,b)=>{
                const ar=recentIds.has(a.uid)?1:0, br=recentIds.has(b.uid)?1:0;
                if(ar!==br)return br-ar;
                return String(a.displayName||a.email||'').localeCompare(String(b.displayName||b.email||''));
            });
            container.innerHTML=sorted.map(u=>`
                <div class="recipient-row ${selectedRecipientObj?.uid===u.uid?'selected':''}" onclick="selectRecipient('${u.uid}')">
                    <img src="${u.photoURL||'https://placehold.co/100x100/3d2617/fdfbf7?text=?'}" alt="">
                    <div class="recipient-meta"><strong>${escapeHtmlSafe(u.displayName||'Member')}</strong><span>${escapeHtmlSafe(u.email||'')}</span></div>
                    <button type="button" class="recipient-write-btn" onclick="event.stopPropagation();selectRecipient('${u.uid}')"><i class="fa-solid fa-pen"></i></button>
                </div>`).join('');
        }

        window.selectRecipient = function(uid) {
            const user = allUsersList.find(u => u.uid === uid);
            if (user) {
                selectedRecipientObj = user;
                saveRecentRecipient(user);
                renderSelectedRecipient();
                renderUsersList(allUsersList);
                if (user.coords) {
                    const rLat = document.getElementById('receiverLat'), rLng = document.getElementById('receiverLng');
                    if(rLat) rLat.value = Number(user.coords.lat).toFixed(6);
                    if(rLng) rLng.value = Number(user.coords.lng).toFixed(6);
                    calculateDistancePreview();
                }
            }
        };


window.filterUsers = function() {
            const query = (document.getElementById('searchUserInput')?.value || '').trim().toLowerCase();
            const filtered = allUsersList.filter(u =>
                String(u.displayName||'').toLowerCase().includes(query) ||
                String(u.email||'').toLowerCase().includes(query)
            );
            renderUsersList(filtered);
        };


        function getPublicDataCollection() {
            return db.collection('artifacts').doc(appId).collection('public').doc('data');
        }

        function getUsersCollectionRef() {
            return getPublicDataCollection().collection('users');
        }

        function getFriendRequestsCollectionRef() {
            return getPublicDataCollection().collection('friendRequests');
        }

        function getFriendsCollectionRef() {
            return getPublicDataCollection().collection('friends');
        }

        function getMessagesCollectionRef() {
            return getPublicDataCollection().collection('messages');
        }

        function normalizeFriendPair(a, b) {
            return [a, b].sort().join('__');
        }

        function escapeHtmlSafe(value) {
            return String(value ?? '').replace(/[&<>"']/g, ch => ({
                '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
            }[ch]));
        }

        // Friend requests use a deterministic pairId for new requests, but the
        // existence check does NOT read a possibly-nonexistent document directly.
        // A direct get() on friendRequests/{pairId} can fail with permission-denied
        // because Firestore Rules cannot authorize a missing document from
        // resource.data.senderUid / receiverUid. We therefore query only requests
        // belonging to the signed-in user, which matches the Firestore rules.
        window.sendFriendRequest = async function(targetUid) {
            if (!currentUser || !targetUid || targetUid === currentUser.uid) return;

            const uid = currentUser.uid;
            const pairId = normalizeFriendPair(uid, targetUid);
            const requestsRef = getFriendRequestsCollectionRef();

            try {
                // -------------------------------------------------------------
                // 1) Check existing outgoing requests.
                // Single-field query = no composite index required.
                // -------------------------------------------------------------
                const outgoingSnap = await requestsRef
                    .where('senderUid', '==', uid)
                    .get();

                // -------------------------------------------------------------
                // 2) Check existing incoming requests.
                // Single-field query = no composite index required.
                // -------------------------------------------------------------
                const incomingSnap = await requestsRef
                    .where('receiverUid', '==', uid)
                    .get();

                const relatedRequests = [];
                const seenRequestIds = new Set();

                outgoingSnap.forEach(doc => {
                    const data = doc.data() || {};
                    if (data.pairId === pairId ||
                        (data.senderUid === uid && data.receiverUid === targetUid)) {
                        if (!seenRequestIds.has(doc.id)) {
                            seenRequestIds.add(doc.id);
                            relatedRequests.push({ id: doc.id, data });
                        }
                    }
                });

                incomingSnap.forEach(doc => {
                    const data = doc.data() || {};
                    if (data.pairId === pairId ||
                        (data.senderUid === targetUid && data.receiverUid === uid)) {
                        if (!seenRequestIds.has(doc.id)) {
                            seenRequestIds.add(doc.id);
                            relatedRequests.push({ id: doc.id, data });
                        }
                    }
                });

                // -------------------------------------------------------------
                // 3) Check the existing Friends records.
                // This query is already constrained by ownerUid and therefore
                // matches the Firestore security rule.
                // -------------------------------------------------------------
                const friendExisting = await getFriendsCollectionRef()
                    .where('ownerUid', '==', uid)
                    .get();

                const alreadyFriend = friendExisting.docs.some(doc => {
                    const data = doc.data() || {};
                    return data.friendUid === targetUid || data.pairId === pairId;
                });

                if (alreadyFriend) {
                    alert('You are already friends.');
                    return;
                }

                // -------------------------------------------------------------
                // 4) Handle an existing request for this pair.
                // -------------------------------------------------------------
                const activeRequest = relatedRequests.find(item => {
                    const status = item.data.status;
                    return status === 'pending' || status === 'accepted';
                });

                if (activeRequest) {
                    if (activeRequest.data.status === 'accepted') {
                        alert('You are already friends.');
                    } else if (activeRequest.data.senderUid === uid) {
                        alert('A friend request is already pending.');
                    } else {
                        alert('This person has already sent you a friend request. Accept it from Friend Requests.');
                    }
                    return;
                }

                // -------------------------------------------------------------
                // 5) If an old request was rejected, reuse that document.
                // Otherwise create a new deterministic pairId document.
                // The Firestore Rules should allow sender -> rejected -> pending.
                // -------------------------------------------------------------
                const rejectedRequest = relatedRequests.find(item =>
                    item.data.status === 'rejected'
                );

                const requestRef = rejectedRequest
                    ? requestsRef.doc(rejectedRequest.id)
                    : requestsRef.doc(pairId);

                await requestRef.set({
                    senderUid: uid,
                    receiverUid: targetUid,
                    pairId,
                    status: 'pending',
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    respondedAt: null
                });

                await renderFriendsUI();
            } catch (err) {
                console.error('sendFriendRequest error:', err);

                if (err && err.code === 'permission-denied') {
                    alert('Friend request permission denied. Please check Firestore Rules.');
                } else if (err && err.code === 'failed-precondition') {
                    alert('Firestore index is required. Open the browser console for the Firebase index link.');
                } else if (err && err.code === 'unauthenticated') {
                    alert('Your login session has expired. Please log in again.');
                } else {
                    alert('Could not send friend request. Please try again.');
                }
            }
        };

        window.acceptFriendRequest = async function(requestId, senderUid) {
            if (!currentUser || !senderUid) return;
            const pairId = normalizeFriendPair(currentUser.uid, senderUid);
            try {
                // IMPORTANT: only the signed-in receiver creates their own friends
                // record. The previous version tried to create a second record owned
                // by the sender, which Firestore correctly rejected under owner-based
                // security rules. The sender's app derives the friendship from the
                // accepted request, so no privileged reverse write is required.
                const requestRef = getFriendRequestsCollectionRef().doc(requestId);
                const requestSnap = await requestRef.get();
                if (!requestSnap.exists) {
                    throw new Error('Friend request no longer exists.');
                }

                const requestData = requestSnap.data() || {};
                if (requestData.receiverUid !== currentUser.uid || requestData.senderUid !== senderUid) {
                    throw new Error('This friend request is not assigned to the signed-in user.');
                }
                if (requestData.status !== 'pending') {
                    throw new Error('This friend request is no longer pending.');
                }

                const batch = db.batch();
                batch.update(requestRef, {
                    status: 'accepted',
                    respondedAt: firebase.firestore.FieldValue.serverTimestamp()
                });

                const friendRef = getFriendsCollectionRef().doc(pairId + '__' + currentUser.uid);
                batch.set(friendRef, {
                    pairId,
                    requestId,
                    ownerUid: currentUser.uid,
                    friendUid: senderUid,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true });

                await batch.commit();
                await listenToFriends();
                await renderFriendsUI();
            } catch (err) {
                console.error('acceptFriendRequest error:', err);
                if (err && err.code === 'permission-denied') {
                    alert('Friend request accept permission denied. Please use the Firestore Rules supplied for this updated index.');
                } else if (err && err.code === 'failed-precondition') {
                    alert('Firestore precondition failed. Check the browser console for details.');
                } else {
                    alert('Could not accept the request: ' + (err && err.message ? err.message : 'Unknown error'));
                }
            }
        };

        window.rejectFriendRequest = async function(requestId) {
            try {
                await getFriendRequestsCollectionRef().doc(requestId).update({
                    status: 'rejected',
                    respondedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            } catch (err) {
                console.error(err);
                alert('Could not reject the request.');
            }
        };

        async function listenToFriends() {
            if (friendsListenersStarted) return;
            friendsListenersStarted = true;
            if (unsubscribeFriendRequests) unsubscribeFriendRequests();
            if (unsubscribeAcceptedFriendRequestsA) unsubscribeAcceptedFriendRequestsA();
            if (unsubscribeAcceptedFriendRequestsB) unsubscribeAcceptedFriendRequestsB();
            if (unsubscribeFriends) unsubscribeFriends();
            if (window.unsubscribeOutgoingFriendRequests) window.unsubscribeOutgoingFriendRequests();
            if (!currentUser || currentUser.isAnonymous) return;

            const uid = currentUser.uid;

            unsubscribeFriendRequests = getFriendRequestsCollectionRef()
                .where('receiverUid','==',uid)
                .where('status','==','pending')
                .onSnapshot(snapshot => {
                    incomingFriendRequests = [];
                    snapshot.forEach(d => incomingFriendRequests.push({id:d.id, ...d.data()}));
                    renderFriendsUI();
                }, err => {
                    console.error('Incoming friend request listener:', err);
                    const status = document.getElementById('friendConnectionStatus');
                    if (status) { status.textContent = 'REQUEST ERROR'; status.className = 'text-[10px] font-bold text-red-700 bg-red-100 px-2 py-1 rounded-full'; }
                });

            window.unsubscribeOutgoingFriendRequests = getFriendRequestsCollectionRef()
                .where('senderUid','==',uid)
                .where('status','==','pending')
                .onSnapshot(snapshot => {
                    outgoingFriendRequests = [];
                    snapshot.forEach(d => outgoingFriendRequests.push({id:d.id, ...d.data()}));
                    renderFriendsUI();
                }, err => console.error('Outgoing friend request listener:', err));

            // A user is always allowed to create their own friend record.
            // The accepted-request listeners below also make the friendship visible
            // to the sender without requiring the receiver to write a reverse-owned
            // friends document. This keeps the client compatible with strict rules.
            unsubscribeFriends = getFriendsCollectionRef()
                .where('ownerUid','==',uid)
                .onSnapshot(async snapshot => {
                    const ids = [];
                    snapshot.forEach(d => {
                        const data = d.data() || {};
                        if (data.friendUid) ids.push(data.friendUid);
                    });
                    await mergeFriendUsers(ids);
                }, err => console.error('Friends listener:', err));

            const refreshAccepted = async () => {
                try {
                    const [sentSnap, receivedSnap] = await Promise.all([
                        getFriendRequestsCollectionRef().where('senderUid','==',uid).where('status','==','accepted').get(),
                        getFriendRequestsCollectionRef().where('receiverUid','==',uid).where('status','==','accepted').get()
                    ]);
                    const ids = [];
                    sentSnap.forEach(d => { const x=d.data()||{}; if(x.receiverUid) ids.push(x.receiverUid); });
                    receivedSnap.forEach(d => { const x=d.data()||{}; if(x.senderUid) ids.push(x.senderUid); });
                    await mergeFriendUsers(ids);
                } catch (err) {
                    console.error('Accepted friend request listener:', err);
                }
            };

            unsubscribeAcceptedFriendRequestsA = getFriendRequestsCollectionRef()
                .where('senderUid','==',uid)
                .where('status','==','accepted')
                .onSnapshot(() => refreshAccepted(), err => console.error('Accepted outgoing friend listener:', err));

            unsubscribeAcceptedFriendRequestsB = getFriendRequestsCollectionRef()
                .where('receiverUid','==',uid)
                .where('status','==','accepted')
                .onSnapshot(() => refreshAccepted(), err => console.error('Accepted incoming friend listener:', err));

            await refreshAccepted();
        }

        async function mergeFriendUsers(friendIds) {
            const uniqueIds = [...new Set((friendIds || []).filter(id => id && id !== currentUser?.uid))];
            const existing = new Map((allFriendsList || []).map(u => [u.uid, u]));
            const result = [];

            for (const id of uniqueIds) {
                try {
                    const u = await getUsersCollectionRef().doc(id).get();
                    if (u.exists) {
                        const user = {uid:id, ...u.data()};
                        existing.set(id, user);
                    }
                } catch (e) {
                    console.error('Could not load friend user:', id, e);
                }
            }

            existing.forEach(user => {
                if (user?.uid && user.uid !== currentUser?.uid) result.push(user);
            });
            allFriendsList = result;
            await renderFriendsUI();
        }

        let activeFriendFilter = 'friends';

        window.setFriendFilter = function(mode) {
            activeFriendFilter = mode;
            ['friends','people','requests'].forEach(x => {
                const b = document.getElementById('friendFilter'+x.charAt(0).toUpperCase()+x.slice(1));
                if (b) {
                    b.className = x === mode
                        ? 'px-3 py-1.5 rounded-full bg-parchment-900 text-wax-gold text-[10px] font-bold whitespace-nowrap'
                        : 'px-3 py-1.5 rounded-full bg-parchment-200 text-parchment-900 text-[10px] font-bold whitespace-nowrap';
                }
            });
            const req = document.getElementById('friendRequestsContainer');
            if (req) req.classList.toggle('hidden', mode !== 'requests');
            renderFriendsUI();
        };

        window.openFindFriends = function() {
            setFriendFilter('people');
            document.getElementById('friendSearchInput')?.focus();
        };

        function userDistanceKm(a, b) {
            if (!a?.coords || !b?.coords) return null;
            const R=6371, toRad=x=>x*Math.PI/180;
            const dLat=toRad(b.coords.lat-a.coords.lat), dLng=toRad(b.coords.lng-a.coords.lng);
            const x=Math.sin(dLat/2)**2 + Math.cos(toRad(a.coords.lat))*Math.cos(toRad(b.coords.lat))*Math.sin(dLng/2)**2;
            return R*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));
        }

        function locationLabel(u) {
            if (!u?.coords) return 'Location not shared';
            const age = u.locationUpdatedAt?.toMillis ? Date.now()-u.locationUpdatedAt.toMillis() : null;
            const fresh = age != null && age < 24*60*60*1000;
            return fresh ? 'Location shared • recently updated' : 'Location shared • update may be older';
        }

        async function renderFriendsUI() {
            const requestBox = document.getElementById('friendRequestsContainer');
            const peopleBox = document.getElementById('friendsListContainer');
            const countBox = document.getElementById('friendRequestCount');
            const badge = document.getElementById('friendsBadge');
            const mobileBadge = document.getElementById('mobileFriendBadge');
            if (!currentUser) return;

            if (countBox) countBox.textContent = incomingFriendRequests.length;
            if (badge) { badge.textContent = incomingFriendRequests.length; badge.classList.toggle('hidden', incomingFriendRequests.length===0); }
            if (mobileBadge) { mobileBadge.textContent = incomingFriendRequests.length; mobileBadge.classList.toggle('hidden', incomingFriendRequests.length===0); }

            if (requestBox) {
                if (!incomingFriendRequests.length) requestBox.innerHTML='<div class="text-xs text-parchment-600 py-3 text-center">No pending requests.</div>';
                else {
                    const users=await Promise.all(incomingFriendRequests.map(async r=>{ try{const u=await getUsersCollectionRef().doc(r.senderUid).get(); return {req:r,user:u.exists?u.data():{uid:r.senderUid,displayName:'Unknown user'}}}catch(e){return {req:r,user:{uid:r.senderUid,displayName:'Unknown user'}}}}));
                    requestBox.innerHTML=users.map(({req:r,user:u})=>`
                        <div class="messenger-person flex items-center gap-2 p-2 rounded-xl border border-parchment-300 bg-parchment-100">
                            <img src="${escapeHtmlSafe(u.photoURL||'https://placehold.co/100x100/3d2617/fdfbf7?text=?')}" class="w-9 h-9 rounded-full object-cover border border-wax-gold">
                            <div class="flex-1 min-w-0"><div class="font-bold text-xs truncate">${escapeHtmlSafe(u.displayName||u.email||'User')}</div><div class="text-[9px] text-parchment-600 truncate">${escapeHtmlSafe(locationLabel(u))}</div></div>
                            <button onclick="acceptFriendRequest('${r.id}','${r.senderUid}')" class="w-8 h-8 rounded-lg bg-green-700 text-white" title="Accept"><i class="fa-solid fa-check"></i></button>
                            <button onclick="rejectFriendRequest('${r.id}')" class="w-8 h-8 rounded-lg bg-wax-red text-white" title="Reject"><i class="fa-solid fa-xmark"></i></button>
                        </div>`).join('');
                }
            }

            const q=(document.getElementById('friendSearchInput')?.value||'').toLowerCase().trim();
            let users=allUsersList.filter(u=>u.uid!==currentUser.uid).filter(u=>!q||(u.displayName||'').toLowerCase().includes(q)||(u.email||'').toLowerCase().includes(q));
            if(activeFriendFilter==='friends') users=users.filter(u=>allFriendsList.some(f=>f.uid===u.uid));
            if(activeFriendFilter==='requests') users=[];

            if(peopleBox){
                if(activeFriendFilter==='requests') { peopleBox.innerHTML=''; return; }
                peopleBox.innerHTML=users.map(u=>{
                    const isFriend=allFriendsList.some(f=>f.uid===u.uid), isSelected=selectedFriendObj?.uid===u.uid;
                    const distance=userDistanceKm(currentUserProfile||null,u);
                    const distText=distance!=null?(distance<1?Math.round(distance*1000)+' m away':distance.toFixed(1)+' km away'):'Distance unavailable';
                    const action=isFriend
                        ? '<span class="text-[9px] font-bold text-green-700 bg-green-100 px-2 py-1 rounded-full">FRIEND</span>'
                        : (outgoingFriendRequests.some(r=>r.receiverUid===u.uid&&r.status==='pending')
                            ? '<span class="text-[9px] font-bold text-amber-800 bg-amber-100 px-2 py-1 rounded-full">PENDING</span>'
                            : (incomingFriendRequests.some(r=>r.senderUid===u.uid&&r.status==='pending')
                                ? `<button onclick="event.stopPropagation();acceptFriendRequest('${incomingFriendRequests.find(r=>r.senderUid===u.uid).id}','${u.uid}')" class="px-2 py-1.5 rounded-lg bg-green-700 text-white text-[10px] font-bold">Accept</button>`
                                : `<button onclick="event.stopPropagation();sendFriendRequest('${u.uid}')" class="px-2 py-1.5 rounded-lg bg-wax-red text-white text-[10px] font-bold"><i class="fa-solid fa-user-plus"></i></button>`));
                    return `<div class="messenger-person ${isSelected?'active':''} flex items-center gap-2 p-2 rounded-xl border border-transparent">
                        <div class="relative shrink-0"><img src="${escapeHtmlSafe(u.photoURL||'https://placehold.co/100x100/3d2617/fdfbf7?text=?')}" class="w-10 h-10 rounded-full object-cover border border-parchment-400">${isFriend?'<span class="presence-dot"></span>':''}</div>
                        <button onclick="openFriendChat('${u.uid}')" class="flex-1 text-left min-w-0">
                            <div class="font-bold text-xs text-parchment-900 truncate">${escapeHtmlSafe(u.displayName||u.email||'User')}</div>
                            <div class="text-[9px] text-parchment-600 truncate">${escapeHtmlSafe(u.email||'')}</div>
                            <div class="mt-1 flex gap-1 flex-wrap"><span class="location-chip"><i class="fa-solid fa-location-dot"></i>${escapeHtmlSafe(distText)}</span>${u.coords?'<span class="location-chip"><i class="fa-solid fa-circle-check"></i>GPS</span>':''}</div>
                        </button>${action}</div>`;
                }).join('')||'<div class="text-xs text-center text-parchment-600 py-8">No people found. Try another search.</div>';
            }
        }

        window.filterFriends = function(){ renderFriendsUI(); };
        window.refreshFriends = async function(){ await renderFriendsUI(); };

        window.openFriendChat = async function(uid) {
            const friend=allFriendsList.find(f=>f.uid===uid)||allUsersList.find(u=>u.uid===uid);
            if(!friend) return;
            selectedFriendObj=friend;
            const layout=document.getElementById('friendLayout'); if(layout) layout.classList.add('chat-open');
            document.getElementById('friendChatName').textContent=friend.displayName||friend.email||'Friend';
            document.getElementById('friendChatAvatar').src=friend.photoURL||'https://placehold.co/100x100/3d2617/fdfbf7?text=?';
            const isFriend=allFriendsList.some(f=>f.uid===uid);
            document.getElementById('friendChatStatus').textContent=isFriend?'Friend • Private message room':'Profile preview • Add friend to unlock messaging';
            document.getElementById('chatPigeonBtn')?.classList.remove('hidden');
            document.getElementById('chatLocationBtn')?.classList.toggle('hidden',!friend.coords);
            document.getElementById('friendProfileStrip')?.classList.remove('hidden');
            document.getElementById('friendLocationText').textContent=locationLabel(friend);
            const distance=userDistanceKm(currentUserProfile||null,friend);
            document.getElementById('friendDistanceText').textContent=distance==null?'Distance unavailable':(distance<1?Math.round(distance*1000)+' m from your saved location':distance.toFixed(1)+' km from your saved location');

            const empty=document.getElementById('friendMessengerEmpty'), list=document.getElementById('friendMessageList'), composer=document.getElementById('friendComposer');
            if(isFriend){ empty?.classList.add('hidden'); list?.classList.remove('hidden'); composer?.classList.remove('hidden'); }
            else { empty?.classList.remove('hidden'); list?.classList.add('hidden'); composer?.classList.add('hidden'); }

            if(unsubscribeMessagesA) unsubscribeMessagesA(); if(unsubscribeMessagesB) unsubscribeMessagesB();
            if(!isFriend) return;
            const msgRef=getMessagesCollectionRef();
            const render=async()=>{
                const [a,b]=await Promise.all([msgRef.where('senderUid','==',currentUser.uid).where('receiverUid','==',uid).get(),msgRef.where('senderUid','==',uid).where('receiverUid','==',currentUser.uid).get()]);
                const messages=[]; a.forEach(d=>messages.push({id:d.id,...d.data()})); b.forEach(d=>messages.push({id:d.id,...d.data()}));
                messages.sort((x,y)=>{const tx=x.createdAt?.toMillis?x.createdAt.toMillis():(x.createdAt||0),ty=y.createdAt?.toMillis?y.createdAt.toMillis():(y.createdAt||0);return tx-ty;}); messageCache=messages;
                const box=document.getElementById('friendMessageList'); if(!box)return;
                box.innerHTML=messages.map(m=>{const mine=m.senderUid===currentUser.uid; const imgs=Array.isArray(m.imageUrls)?m.imageUrls:(m.imageUrl?[m.imageUrl]:[]); return `<div class="message-row ${mine?'mine':'theirs'}"><div class="message-bubble ${mine?'mine':'theirs'}">${m.text?`<div class="whitespace-pre-wrap break-words">${escapeHtmlSafe(m.text)}</div>`:''}${imgs.length?`<div class="chat-message-images">${imgs.map(u=>`<img src="${escapeHtmlSafe(u)}" alt="Shared image" loading="lazy" onclick="window.open(this.src,'_blank')">`).join('')}</div>`:''}${Array.isArray(m.fileAttachments)&&m.fileAttachments.length?`<div class="chat-file-list">${m.fileAttachments.map(f=>`<a class="chat-file-card" href="${escapeHtmlSafe(f.downloadPage||f.directLink||f.url||'#')}" target="_blank" rel="noopener"><i class="fa-solid fa-file-arrow-down"></i><span><strong>${escapeHtmlSafe(f.name||'File')}</strong><small>${escapeHtmlSafe(formatBytes(f.size||0))}</small></span></a>`).join('')}</div>`:''}<div class="message-meta"><span>${escapeHtmlSafe(formatMessageTime(m.createdAt))}</span>${mine?`<button type="button" onclick="deleteDirectMessage('${m.id}')" class="message-delete">Delete</button>`:''}</div></div></div>`}).join('')||'<div style="text-align:center;color:#aab7c4;font-size:12px;padding:32px 8px">No messages yet. Start the private conversation.</div>';
                box.scrollTop=box.scrollHeight;
            };
            unsubscribeMessagesA=msgRef.where('senderUid','==',currentUser.uid).where('receiverUid','==',uid).onSnapshot(render,console.error);
            unsubscribeMessagesB=msgRef.where('senderUid','==',uid).where('receiverUid','==',currentUser.uid).onSnapshot(render,console.error);
            await render();
        };

        function renderChatRooms() {
            const box=document.getElementById('chatRoomsList'),count=document.getElementById('chatRoomsCount'); if(!box)return;
            const byUid=new Map();
            for(const m of chatRoomMessages){const other=m.senderUid===currentUser?.uid?m.receiverUid:m.senderUid;if(!other)continue;const old=byUid.get(other);const mt=m.createdAt?.toMillis?m.createdAt.toMillis():Number(m.createdAt||0);const ot=old?.createdAt?.toMillis?old.createdAt.toMillis():Number(old?.createdAt||0);if(!old||mt>=ot)byUid.set(other,m);}
            const rooms=[...byUid.entries()].map(([uid,m])=>{const u=allFriendsList.find(x=>x.uid===uid)||allUsersList.find(x=>x.uid===uid)||{uid,displayName:'Member'};return {uid,m,u};}).sort((a,b)=>(b.m.createdAt?.toMillis?b.m.createdAt.toMillis():Number(b.m.createdAt||0))-(a.m.createdAt?.toMillis?a.m.createdAt.toMillis():Number(a.m.createdAt||0)));
            if(count)count.textContent=rooms.length;if(!rooms.length){box.innerHTML='<div class="chat-room-empty">No recent chats yet.</div>';return;}
            box.innerHTML=rooms.slice(0,12).map(r=>`<button type="button" class="chat-room-item" onclick="openFriendChat('${r.uid}')"><img src="${escapeHtmlSafe(r.u.photoURL||'https://placehold.co/80x80/3d2617/fdfbf7?text=?')}" alt=""><span class="chat-room-copy"><strong>${escapeHtmlSafe(r.u.displayName||r.u.email||'Member')}</strong><small>${escapeHtmlSafe(r.m.text||((r.m.imageUrls||r.m.imageUrl)?'📷 Image':'Message'))}</small></span><time>${escapeHtmlSafe(formatMessageTime(r.m.createdAt))}</time></button>`).join('');
        }
        function listenToChatRooms(){
            if(unsubscribeChatRoomsA)unsubscribeChatRoomsA();if(unsubscribeChatRoomsB)unsubscribeChatRoomsB();if(!currentUser)return;
            const ref=getMessagesCollectionRef(); const merge=(snap,side)=>{const incoming=snap.docs.map(d=>({id:d.id,...d.data()}));const ids=new Set(incoming.map(x=>x.id));chatRoomMessages=chatRoomMessages.filter(x=>!ids.has(x.id));chatRoomMessages.push(...incoming);renderChatRooms();};
            unsubscribeChatRoomsA=ref.where('senderUid','==',currentUser.uid).onSnapshot(s=>merge(s,'sent'),e=>console.warn('Chat rooms sent:',e));
            unsubscribeChatRoomsB=ref.where('receiverUid','==',currentUser.uid).onSnapshot(s=>merge(s,'received'),e=>console.warn('Chat rooms received:',e));
        }

        window.closeFriendChat=function(){document.getElementById('friendLayout')?.classList.remove('chat-open');document.getElementById('mobileBottomNav')?.classList.remove('mobile-nav-hidden');selectedFriendObj=null;selectedChatImages=[];selectedChatFiles=[];renderChatImagePreview();renderChatFilePreview();document.getElementById('friendMessengerEmpty')?.classList.remove('hidden');document.getElementById('friendMessageList')?.classList.add('hidden');document.getElementById('friendComposer')?.classList.add('hidden');};

        window.sendPigeonToSelectedFriend=function(){
            if(!selectedFriendObj) return alert('First select a person.');
            switchTab('dispatch');
            setTimeout(()=>{ if(typeof selectRecipient==='function') selectRecipient(selectedFriendObj.uid); const input=document.getElementById('inputLetterContent'); if(input) input.focus(); },120);
        };

        window.showSelectedFriendLocation=function(){
            if(!selectedFriendObj?.coords) return alert('This person has not shared a location.');
            switchTab('map');
            setTimeout(()=>{
                if(!leafletMap) initLeafletMap();
                if(leafletMap && selectedFriendObj?.coords){
                    leafletMap.stop();
                    leafletMap.flyTo({
                        center:[Number(selectedFriendObj.coords.lng),Number(selectedFriendObj.coords.lat)],
                        zoom:12, duration:1000, essential:true
                    });
                }
            },220);
        };

        window.currentUserProfile = null;

        function formatMessageTime(value) {
            try {
                const ms = value?.toMillis ? value.toMillis() : Number(value || 0);
                if (!ms) return 'Sending…';
                return new Date(ms).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
            } catch (_) { return ''; }
        }

        window.deleteDirectMessage = async function(messageId) {
            if (!currentUser || !messageId || !selectedFriendObj) return;
            const msg = messageCache.find(m => m.id === messageId);
            if (!msg || msg.senderUid !== currentUser.uid) {
                alert('You can delete only your own messages.');
                return;
            }
            if (!confirm('Delete this message for you and the other participant?')) return;
            try {
                await getMessagesCollectionRef().doc(messageId).delete();
            } catch (err) {
                console.error('deleteDirectMessage error:', err);
                alert('Message could not be deleted. Please check Firestore Rules.');
            }
        };

        window.sendDirectMessage = async function(event) {
            event.preventDefault();
            const input=document.getElementById('friendMessageInput'); const textValue=(input?.value||'').trim();
            if(!currentUser||!selectedFriendObj)return;
            const isFriend=allFriendsList.some(f=>f.uid===selectedFriendObj.uid); if(!isFriend){alert('Accept the friend request first to start direct messaging.');return;}
            if(!textValue && !selectedChatImages.length && !selectedChatFiles.length)return;
            const sendBtn=document.querySelector('#friendComposer .chat-send-button'); if(sendBtn){sendBtn.disabled=true;sendBtn.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i>';} 
            try{
                const imageUrls=[]; for(let i=0;i<selectedChatImages.length;i++){ if(sendBtn)sendBtn.innerHTML=`<i class="fa-solid fa-cloud-arrow-up fa-bounce"></i>`; imageUrls.push(await uploadToImgBB(selectedChatImages[i])); }
                const fileAttachments=[]; for(let i=0;i<selectedChatFiles.length;i++){ if(sendBtn)sendBtn.innerHTML=`<i class="fa-solid fa-cloud-arrow-up fa-bounce"></i><span>Uploading file ${i+1}/${selectedChatFiles.length}</span>`; fileAttachments.push(await uploadToGoFile(selectedChatFiles[i])); }
                await getMessagesCollectionRef().add({senderUid:currentUser.uid,receiverUid:selectedFriendObj.uid,text:textValue,imageUrls,imageUrl:imageUrls[0]||'',fileAttachments,createdAt:firebase.firestore.FieldValue.serverTimestamp()});
                await logActivity('message','Message sent',`You sent a private message to ${selectedFriendObj.displayName||selectedFriendObj.email||'a friend'}.`,{receiverUid:selectedFriendObj.uid});
                if(input)input.value=''; selectedChatImages=[]; selectedChatFiles=[]; renderChatImagePreview(); renderChatFilePreview(); renderChatRooms();
            }catch(err){console.error(err);alert('Message could not be sent. Please check your connection, upload settings and Firestore permissions.');}
            finally{if(sendBtn){sendBtn.disabled=false;sendBtn.innerHTML='<i class="fa-solid fa-paper-plane"></i><span>Send</span>';}}
        };
        window.handleChatImageSelect=function(e){selectedChatImages=[...selectedChatImages,...Array.from(e.target.files||[]).filter(f=>f.type.startsWith('image/'))].slice(0,6);e.target.value='';renderChatImagePreview();};
        window.removeChatImage=function(i){selectedChatImages.splice(i,1);renderChatImagePreview();};
        window.handleChatFileSelect=function(e){selectedChatFiles=[...selectedChatFiles,...Array.from(e.target.files||[])].slice(0,10);e.target.value='';renderChatFilePreview();};
        window.removeChatFile=function(i){selectedChatFiles.splice(i,1);renderChatFilePreview();};
        function renderChatFilePreview(){const box=document.getElementById('chatImagePreview');if(!box)return;const files=selectedChatFiles; const imgs=selectedChatImages; box.classList.toggle('hidden',!(files.length||imgs.length)); box.innerHTML=[...imgs.map((f,i)=>`<div class="chat-preview-chip"><i class="fa-solid fa-image"></i><span>${escapeHtmlSafe(f.name)}</span><button type="button" onclick="removeChatImage(${i})">×</button></div>`),...files.map((f,i)=>`<div class="chat-preview-chip"><i class="fa-solid fa-file"></i><span>${escapeHtmlSafe(f.name)}</span><button type="button" onclick="removeChatFile(${i})">×</button></div>`)].join('');}
        function renderChatImagePreview(){const box=document.getElementById('chatImagePreview');if(!box)return;box.classList.toggle('hidden',!selectedChatImages.length);box.innerHTML=selectedChatImages.map((f,i)=>{const u=URL.createObjectURL(f);return `<div><img src="${u}" alt=""><button type="button" onclick="removeChatImage(${i})"><i class="fa-solid fa-xmark"></i></button></div>`}).join('');}

        function getPigeonsCollectionRef() {
            return db.collection('artifacts').doc(appId).collection('public').doc('data').collection('pigeons');
        }

        function getLetterRef(pigeonId) {
            return getPigeonsCollectionRef().doc(pigeonId).collection('letter').doc('content');
        }

        // Save a flight and its private letter atomically. The letter is NOT stored in the public flight metadata.
        window.dbSavePigeon = async function(pigeonData, letterData) {
            if (!auth.currentUser || auth.currentUser.isAnonymous) throw new Error('Please sign in with Google/Gmail first.');

            const colRef = getPigeonsCollectionRef();
            const docRef = colRef.doc();
            const batch = db.batch();

            batch.set(docRef, { ...pigeonData, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
            batch.set(getLetterRef(docRef.id), {
                pigeonId: docRef.id,
                senderUid: pigeonData.senderUid,
                receiverUid: pigeonData.receiverUid,
                content: letterData.content,
                subject: letterData.subject || '',
                imageUrl: letterData.imageUrl || '',
                imageUrls: Array.isArray(letterData.imageUrls) ? letterData.imageUrls : (letterData.imageUrl ? [letterData.imageUrl] : []),
                fileAttachments: Array.isArray(letterData.fileAttachments) ? letterData.fileAttachments : [],
                senderName: letterData.senderName || pigeonData.senderName || '',
                estimatedArrival: pigeonData.estimatedArrival,
                read: false,
                readAt: null,
                replyToPigeonId: pigeonData.replyToPigeonId || null,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            await batch.commit();
            return docRef.id;
        };

        // Receiver-location changes are intentionally disabled after dispatch so a flight cannot be rewritten.
        window.dbUpdatePigeonReceiver = async function() {
            throw new Error('A dispatched pigeon is immutable. Receiver coordinates are locked after release.');
        };

        window.dbDeletePigeon = async function(pigeonId) {
            if (!auth.currentUser || auth.currentUser.isAnonymous) throw new Error('Please sign in first.');
            const pigeonRef = getPigeonsCollectionRef().doc(pigeonId);
            const letterRef = getLetterRef(pigeonId);
            const batch = db.batch();
            batch.delete(letterRef);
            batch.delete(pigeonRef);
            await batch.commit();
        };

        window.dbGetLetter = async function(pigeonId) {
            if (!auth.currentUser || auth.currentUser.isAnonymous) throw new Error('Please sign in first.');
            const snap = await getLetterRef(pigeonId).get();
            if (!snap.exists) throw new Error('Letter not found.');
            return snap.data();
        };

        // Read/unread state is kept in the private letter document.
        // The cache prevents repeated Firestore reads during the live 1-second UI refresh.
        const letterReadStateCache = new Map();
        const letterReadStateLoading = new Set();

        function isPigeonDelivered(pigeon) {
            return pigeon && Number(pigeon.estimatedArrival) <= Date.now();
        }

        async function ensureLetterReadStates(pigeons) {
            const uid = currentUser?.uid;
            if (!uid) return;

            const incomingDelivered = (pigeons || []).filter(p =>
                p.direction === 'incoming' &&
                p.receiverUid === uid &&
                isPigeonDelivered(p)
            );

            for (const pigeon of incomingDelivered) {
                if (letterReadStateCache.has(pigeon.id) || letterReadStateLoading.has(pigeon.id)) continue;

                letterReadStateLoading.add(pigeon.id);
                try {
                    const letter = await window.dbGetLetter(pigeon.id);
                    // Older letters without a read field are treated as unread.
                    letterReadStateCache.set(pigeon.id, letter?.read === true);
                } catch (err) {
                    console.warn('Unable to load letter read state:', err);
                } finally {
                    letterReadStateLoading.delete(pigeon.id);
                }
            }

            if (typeof renderNestInbox === 'function') {
                renderNestInbox(window.pigeonsList || pigeons || []);
            }
        }

        async function markLetterAsRead(pigeonId) {
            if (!pigeonId) return;
            if (letterReadStateCache.get(pigeonId) === true) return;

            // Update the UI immediately.
            letterReadStateCache.set(pigeonId, true);
            renderNestInbox(window.pigeonsList || []);

            try {
                await getLetterRef(pigeonId).update({
                    read: true,
                    readAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            } catch (err) {
                // The UI remains responsive. If Firestore rules do not yet allow
                // this metadata update, the visual state still changes for this session.
                console.warn('Could not persist read state:', err);
            }
        }

        window.getLetterReadState = pigeonId => letterReadStateCache.get(pigeonId) === true;
        window.markLetterAsRead = markLetterAsRead;


        function listenToPigeons() {
            if (unsubscribePigeons) unsubscribePigeons();
            if (!currentUser || currentUser.isAnonymous) return;

            const colRef = getPigeonsCollectionRef();
            const uid = currentUser.uid;
            let sent = [];
            let incoming = [];

            const publish = () => {
                const byId = new Map();
                [...sent, ...incoming].forEach(p => byId.set(p.id, p));
                const list = Array.from(byId.values()).sort((a,b) => (b.dispatchTime || 0) - (a.dispatchTime || 0));
                const fixedSpeedList = list.map(p => {
                    const distanceKm = Number(p.distanceKm) || 0;
                    const durationSec = Math.max(5, (distanceKm / (Number(p.pigeonSpeedKmh) || pigeonSpeedSetting)) * 3600);
                    const dispatchTime = Number(p.dispatchTime) || Date.now();
                    return {
                        ...p,
                        pigeonSpeedKmh: Number(p.pigeonSpeedKmh) || pigeonSpeedSetting,
                        flightDurationSeconds: durationSec,
                        estimatedArrival: dispatchTime + (durationSec * 1000)
                    };
                });
                window.pigeonsList = fixedSpeedList; updateProfileStats(); renderActivityList();
                if (typeof window.onPigeonsDataUpdated === 'function') window.onPigeonsDataUpdated(fixedSpeedList);
            };

            const unsubSent = colRef.where('senderUid', '==', uid).onSnapshot((snapshot) => {
                sent = snapshot.docs.map(d => ({ id: d.id, ...d.data(), direction: 'outgoing' }));
                publish();
            }, (error) => console.error('Sent pigeons subscription error:', error));

            const unsubIncoming = colRef.where('receiverUid', '==', uid).onSnapshot((snapshot) => {
                incoming = snapshot.docs.map(d => ({ id: d.id, ...d.data(), direction: 'incoming' }));
                publish();
            }, (error) => console.error('Incoming pigeons subscription error:', error));

            unsubscribePigeons = () => {
                unsubSent();
                unsubIncoming();
            };
        }

        // --- GLOBAL STATE ---
        window.pigeonsList = [];
        let activePigeonId = null;
        // Mapbox configuration. Replace with your PUBLIC Mapbox token.
        const MAPBOX_PUBLIC_TOKEN = 'pk.eyJ1Ijoic2R0MDA3IiwiYSI6ImNtdTRpb3d4aDAwajcyd3BueXBicmVsMGYifQ.V4hCEMUYpAqH1HYip-316g';
        const DEFAULT_PIGEON_SPEED_KMH = 50;
        let pigeonSpeedSetting = Number(localStorage.getItem('pigeonSpeedKmh') || DEFAULT_PIGEON_SPEED_KMH);
        pigeonSpeedSetting = Math.min(120, Math.max(10, pigeonSpeedSetting));

        let leafletMap = null; 
        let senderMarker = null;
        let receiverMarker = null;
        let pigeonMarker = null;
        let pigeon3DMarkerEl = null;
        let roadRouteCoordinates = [];
        let roadRouteKey = '';
        let roadRouteLoading = false;
        let audioEnabled = true;
        let audioCtx = null;
        let pigeonAnimationFrame = null;
        let lastTelemetryPaint = 0;
        let lastFollowCenter = 0;

        // Fetch / Refresh Pigeons
        function fetchPigeonsList() {
            if (window.pigeonsList) {
                renderNestInbox(window.pigeonsList);
            }
        }

        // Sound Synthesis using Web Audio API
        function playSound(type) {
            if (!audioEnabled) return;
            try {
                if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                if (audioCtx.state === 'suspended') audioCtx.resume();

                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.connect(gain);
                gain.connect(audioCtx.destination);

                if (type === 'flap') {
                    osc.type = 'triangle';
                    osc.frequency.setValueAtTime(150, audioCtx.currentTime);
                    osc.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 0.15);
                    gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
                    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
                    osc.start();
                    osc.stop(audioCtx.currentTime + 0.15);
                } else if (type === 'release') {
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(440, audioCtx.currentTime);
                    osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.3);
                    gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
                    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
                    osc.start();
                    osc.stop(audioCtx.currentTime + 0.3);
                } else if (type === 'unseal') {
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
                    osc.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.1); // E5
                    osc.frequency.setValueAtTime(783.99, audioCtx.currentTime + 0.2); // G5
                    gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
                    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
                    osc.start();
                    osc.stop(audioCtx.currentTime + 0.4);
                }
            } catch(e) { console.warn("Audio play error:", e); }
        }

        function toggleAudio() {
            audioEnabled = !audioEnabled;
            const icon = document.getElementById('soundIcon');
            const txt = document.getElementById('soundText');
            if (audioEnabled) {
                icon.className = 'fa-solid fa-volume-high text-wax-gold';
                txt.innerText = 'Sound On';
            } else {
                icon.className = 'fa-solid fa-volume-xmark text-parchment-400';
                txt.innerText = 'Muted';
            }
        }

        /**
         * Calculates the Great-Circle distance between two points in Kilometers using the Haversine formula
         */
        function haversineDistance(coords1, coords2) {
            const R = 6371;
            const dLat = (coords2.lat - coords1.lat) * Math.PI / 180;
            const dLon = (coords2.lng - coords1.lng) * Math.PI / 180;
            const lat1Rad = coords1.lat * Math.PI / 180;
            const lat2Rad = coords2.lat * Math.PI / 180;

            const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                      Math.cos(lat1Rad) * Math.cos(lat2Rad) *
                      Math.sin(dLon / 2) * Math.sin(dLon / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            return R * c;
        }

        function interpolateCoords(start, end, t) {
            const clampedT = Math.max(0, Math.min(1, t));
            return {
                lat: start.lat + (end.lat - start.lat) * clampedT,
                lng: start.lng + (end.lng - start.lng) * clampedT
            };
        }

        function calculateBearing(start, end) {
            const rad = Math.PI / 180;
            const lat1 = start.lat * rad, lat2 = end.lat * rad;
            const dLng = (end.lng - start.lng) * rad;
            const y = Math.sin(dLng) * Math.cos(lat2);
            const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
            return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
        }

        function formatDuration(seconds) {
            if (seconds <= 0) return "0s";
            const hrs = Math.floor(seconds / 3600);
            const mins = Math.floor((seconds % 3600) / 60);
            const secs = Math.floor(seconds % 60);

            if (hrs > 0) return `${hrs}h ${mins}m ${secs}s`;
            if (mins > 0) return `${mins}m ${secs}s`;
            return `${secs}s`;
        }

        function applyRoutePreset(val) {
            if (val === 'custom') return;
            const presets = {
                'paris_london': { sLat: 48.8566, sLng: 2.3522, rLat: 51.5074, rLng: -0.1278 },
                'ny_boston': { sLat: 40.7128, sLng: -74.0060, rLat: 42.3601, rLng: -71.0589 },
                'tokyo_kyoto': { sLat: 35.6762, sLng: 139.6503, rLat: 35.0116, rLng: 135.7681 },
                'local': { sLat: 37.7749, sLng: -122.4194, rLat: 37.8044, rLng: -122.2712 }
            };

            const route = presets[val];
            if (route) {
                document.getElementById('senderLat').value = route.sLat;
                document.getElementById('senderLng').value = route.sLng;
                document.getElementById('receiverLat').value = route.rLat;
                document.getElementById('receiverLng').value = route.rLng;
                calculateDistancePreview();
            }
        }

        function calculateDistancePreview() {
            const sLat = parseFloat(document.getElementById('senderLat').value) || 0;
            const sLng = parseFloat(document.getElementById('senderLng').value) || 0;
            const rLat = parseFloat(document.getElementById('receiverLat').value) || 0;
            const rLng = parseFloat(document.getElementById('receiverLng').value) || 0;

            const distKm = haversineDistance({ lat: sLat, lng: sLng }, { lat: rLat, lng: rLng });
            const speedKmh = pigeonSpeedSetting;
            const durationSec = Math.max(5, (distKm / speedKmh) * 3600);

            document.getElementById('previewDistance').innerText = `${distKm.toFixed(1)} km`;
            document.getElementById('previewDuration').innerText = formatDuration(durationSec);
        }

        function useCurrentLocationForSender() {
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    (pos) => {
                        document.getElementById('senderLat').value = pos.coords.latitude.toFixed(6);
                        document.getElementById('senderLng').value = pos.coords.longitude.toFixed(6);
                        calculateDistancePreview();
                    },
                    (err) => { alert("Geolocation error: " + err.message); }
                );
            } else {
                alert("Geolocation is not supported by your browser.");
            }
        }

        
        window.setPigeonSpeed = function(value) {
            pigeonSpeedSetting = Math.min(120, Math.max(10, Number(value)||50));
            localStorage.setItem('pigeonSpeedKmh', String(pigeonSpeedSetting));
            const out=document.getElementById('speedValue'); if(out) out.textContent=`${pigeonSpeedSetting} km/h`;
            calculateDistancePreview();
        };
        window.updateSenderPreview = function() {
            const hide=document.getElementById('hideSenderName')?.checked;
            const name=document.getElementById('senderNameDisplay'), email=document.getElementById('senderEmailDisplay');
            if(name) name.textContent=hide?'Hidden sender':(currentUser?.displayName||currentUser?.email?.split('@')[0]||'User');
            if(email) email.textContent=hide?'':(currentUser?.email||'');
        };
        function initComposeUI(){
            const slider=document.getElementById('pigeonSpeedSlider');
            if(slider){slider.value=pigeonSpeedSetting;window.setPigeonSpeed(slider.value);}
            const email=document.getElementById('senderEmailDisplay'); if(email&&currentUser) email.textContent=currentUser.email||'';
            renderRecentRecipients(); renderSelectedRecipient(); renderUsersList(allUsersList);
        }

let selectedFileBlobs = [];
        function renderAttachmentList() {
            const box=document.getElementById('imageUploadStatus'), count=document.getElementById('attachmentCount');
            if(!box) return;
            if(count) count.textContent=`${selectedFileBlobs.length} file${selectedFileBlobs.length===1?'':'s'}`;
            box.innerHTML=selectedFileBlobs.map((file,i)=>`
                <div class="attachment-item">
                    <div class="attachment-file-icon"><i class="fa-solid ${file.type.startsWith('image/')?'fa-image':'fa-file-lines'}"></i></div>
                    <div class="min-w-0 flex-1"><strong>${escapeHtmlSafe(file.name)}</strong><small>${formatBytes(file.size)} • ${escapeHtmlSafe(file.type||'Unknown type')}</small></div>
                    <button type="button" onclick="removeAttachment(${i})"><i class="fa-solid fa-xmark"></i></button>
                </div>`).join('');
        }
        window.handleFileSelect = function(event) {
            const files=Array.from(event.target.files||[]);
            selectedFileBlobs=[...selectedFileBlobs,...files].slice(0,10);
            selectedLetterFiles=selectedFileBlobs;
            event.target.value='';
            renderAttachmentList();
        };
        window.removeAttachment=function(i){selectedFileBlobs.splice(i,1);renderAttachmentList();};
        function clearImageAttachment() { selectedFileBlobs=[]; renderAttachmentList(); }
        window.clearImageAttachment=clearImageAttachment;

// Production ImgBB Upload with hardcoded API key
        async function uploadToImgBB(file) {
            const userApiKey = "1abc9f66636c45ace1d0952e080d153d"; 
            
            if (userApiKey) {
                try {
                    const formData = new FormData();
                    formData.append('image', file);
                    const response = await fetch(`https://api.imgbb.com/1/upload?key=${userApiKey}`, {
                        method: 'POST',
                        body: formData
                    });
                    const json = await response.json();
                    if (json.success) return json.data.url;
                } catch(e) { 
                    console.warn("ImgBB upload failed, falling back to data URL:", e); 
                }
            }

            // Fallback: Convert file directly to Data URL if API error
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.readAsDataURL(file);
            });
        }

        // GoFile upload: supports arbitrary file types. The API token was supplied by the owner.
        const GOFILE_API_TOKEN = "rMedVr2wX8qjKfhzo8JKtKiR3f2PC7kc";
        async function uploadToGoFile(file) {
            if (!file) throw new Error('No file selected.');
            const form = new FormData();
            form.append('file', file, file.name);
            const response = await fetch('https://upload.gofile.io/uploadfile', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${GOFILE_API_TOKEN}` },
                body: form
            });
            let json = {}; try { json = await response.json(); } catch (_) {}
            if (!response.ok || json.status !== 'ok') throw new Error(json.message || `GoFile upload failed (${response.status})`);
            const d = json.data || {};
            return { name:file.name, size:file.size, type:file.type || 'application/octet-stream', fileId:d.fileId || d.id || '', downloadPage:d.downloadPage || d.downloadPageUrl || '', directLink:d.directLink || d.link || '', url:d.directLink || d.downloadPage || '' };
        }
        function formatBytes(bytes){ const n=Number(bytes)||0; if(n<1024)return `${n} B`; if(n<1048576)return `${(n/1024).toFixed(1)} KB`; if(n<1073741824)return `${(n/1048576).toFixed(1)} MB`; return `${(n/1073741824).toFixed(2)} GB`; }

        async function releasePigeon() {
            if (!currentUser || currentUser.isAnonymous || !currentUser.email) { alert('Please sign in with your Gmail/Google account first.'); return; }
            if (!selectedRecipientObj?.uid) { alert('Please select a recipient from the member directory.'); return; }
            if (selectedRecipientObj.uid === currentUser.uid) { alert('You cannot send a pigeon to yourself.'); return; }
            const content = document.getElementById('inputLetterContent')?.value.trim();
            if (!content && !selectedFileBlobs.length) { alert('Please write a message or attach at least one file before sending.'); return; }
            if (!selectedRecipientObj.coords) { alert('This member has no saved location yet. Ask them to sign in and allow location access first.'); return; }

            const releaseBtn=document.getElementById('releaseBtn');
            const subject=(document.getElementById('inputLetterSubject')?.value||'').trim();
            const hideSender=!!document.getElementById('hideSenderName')?.checked;
            releaseBtn.disabled=true; releaseBtn.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i><span>Sending...</span>';
            try {
                const imageUrls=[]; const fileAttachments=[];
                for(let i=0;i<selectedFileBlobs.length;i++){
                    const file=selectedFileBlobs[i];
                    releaseBtn.innerHTML=`<i class="fa-solid fa-cloud-arrow-up fa-bounce"></i><span>Uploading ${i+1}/${selectedFileBlobs.length}...</span>`;
                    if(file.type && file.type.startsWith('image/')) imageUrls.push(await uploadToImgBB(file));
                    else fileAttachments.push(await uploadToGoFile(file));
                }

                const sLat=parseFloat(document.getElementById('senderLat').value), sLng=parseFloat(document.getElementById('senderLng').value);
                const rLat=Number(selectedRecipientObj.coords.lat), rLng=Number(selectedRecipientObj.coords.lng);
                if(![sLat,sLng,rLat,rLng].every(Number.isFinite)) throw new Error('Your location is not available. Please allow location access and try again.');

                const distanceKm=haversineDistance({lat:sLat,lng:sLng},{lat:rLat,lng:rLng});
                const pigeonSpeedKmh=pigeonSpeedSetting;
                const flightDurationSeconds=Math.max(5,(distanceKm/pigeonSpeedKmh)*3600);
                const now=Date.now();
                const visibleSenderName=hideSender?'Hidden Sender':(currentUser.displayName||currentUser.email.split('@')[0]);
                const pigeonPayload={
                    senderUid:currentUser.uid, receiverUid:selectedRecipientObj.uid,
                    senderName:visibleSenderName,
                    receiverName:selectedRecipientObj.displayName||selectedRecipientObj.email?.split('@')[0]||'Member',
                    senderCoords:{lat:sLat,lng:sLng}, receiverCoords:{lat:rLat,lng:rLng},
                    distanceKm,pigeonSpeedKmh,flightDurationSeconds,dispatchTime:now,
                    estimatedArrival:now+(flightDurationSeconds*1000),status:'in_flight'
                };
                releaseBtn.innerHTML='<i class="fa-solid fa-dove fa-bounce"></i><span>Releasing Pigeon...</span>';
                const docId=await window.dbSavePigeon(pigeonPayload,{content,imageUrl:imageUrls[0]||'',imageUrls,fileAttachments,subject,senderName:visibleSenderName});
                playSound('release'); await logActivity('pigeon','Pigeon letter sent',`Your letter was released to ${selectedRecipientObj.displayName||selectedRecipientObj.email||'a member'}.`,{receiverUid:selectedRecipientObj.uid,pigeonId:docId});
                document.getElementById('inputLetterContent').value='';
                document.getElementById('inputLetterSubject').value='';
                document.getElementById('hideSenderName').checked=false;
                clearImageAttachment(); selectedRecipientObj=null; renderSelectedRecipient(); renderUsersList(allUsersList);
                updateSenderPreview();
                releaseBtn.disabled=false; releaseBtn.innerHTML='<i class="fa-solid fa-paper-plane"></i><span>Send Letter</span>';
                activePigeonId=docId; switchTab('map');
            } catch(err) {
                console.error('Error dispatching pigeon:',err);
                alert('Message could not be sent. '+(err.message||'Please check Firebase connection and Firestore Rules.'));
                releaseBtn.disabled=false; releaseBtn.innerHTML='<i class="fa-solid fa-paper-plane"></i><span>Send Letter</span>';
            }
        }


        function createMapboxMarkerElement(html, width, height, className='mapbox-custom-marker') {
            const el = document.createElement('div');
            el.className = className;
            el.style.width = `${width}px`;
            el.style.height = `${height}px`;
            el.style.display = 'flex';
            el.style.alignItems = 'center';
            el.style.justifyContent = 'center';
            el.innerHTML = html;
            return el;
        }

        function getRoadRouteKey(pigeon) {
            return [
                pigeon.senderCoords?.lng, pigeon.senderCoords?.lat,
                pigeon.receiverCoords?.lng, pigeon.receiverCoords?.lat
            ].map(v => Number(v).toFixed(6)).join('|');
        }

        async function loadRoadRoute(pigeon) {
            if (!pigeon?.senderCoords || !pigeon?.receiverCoords || !leafletMap) return;

            const key = getRoadRouteKey(pigeon);
            if (key === roadRouteKey && roadRouteCoordinates.length > 1) {
                updateRoadRouteLine(pigeon);
                return;
            }
            if (roadRouteLoading) return;

            roadRouteLoading = true;
            try {
                // Visible route follows the real road network between sender and receiver.
                const start = `${Number(pigeon.senderCoords.lng)},${Number(pigeon.senderCoords.lat)}`;
                const end = `${Number(pigeon.receiverCoords.lng)},${Number(pigeon.receiverCoords.lat)}`;
                const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${start};${end}?alternatives=false&geometries=geojson&overview=full&steps=false&access_token=${encodeURIComponent(MAPBOX_PUBLIC_TOKEN)}`;
                const response = await fetch(url);
                if (!response.ok) throw new Error(`Mapbox Directions HTTP ${response.status}`);
                const data = await response.json();
                const coords = data?.routes?.[0]?.geometry?.coordinates;
                if (!Array.isArray(coords) || coords.length < 2) throw new Error('No road route returned');

                roadRouteCoordinates = coords.map(c => [Number(c[0]), Number(c[1])]);
                roadRouteKey = key;
                updateRoadRouteLine(pigeon);

                if (activePigeonId === pigeon.id) {
                    const bounds = roadRouteCoordinates.reduce(
                        (bnd, c) => bnd.extend(c),
                        new mapboxgl.LngLatBounds(roadRouteCoordinates[0], roadRouteCoordinates[0])
                    );
                    leafletMap.fitBounds(bounds, { padding: 90, maxZoom: 14, duration: 900 });
                }
            } catch (error) {
                // Keep a visible sender → receiver line even if the routing API is unavailable.
                console.warn('Road routing unavailable; using direct sender-to-receiver marking.', error);
                roadRouteCoordinates = [
                    [Number(pigeon.senderCoords.lng), Number(pigeon.senderCoords.lat)],
                    [Number(pigeon.receiverCoords.lng), Number(pigeon.receiverCoords.lat)]
                ];
                roadRouteKey = key;
                updateRoadRouteLine(pigeon);
            } finally {
                roadRouteLoading = false;
            }
        }

        function updateRoadRouteLine(pigeon) {
            if (!leafletMap || !pigeon) return;
            const routeSource = leafletMap.getSource('pigeon-route');
            if (!routeSource) return;
            const coordinates = roadRouteCoordinates.length > 1
                ? roadRouteCoordinates
                : [[pigeon.senderCoords.lng, pigeon.senderCoords.lat], [pigeon.receiverCoords.lng, pigeon.receiverCoords.lat]];
            routeSource.setData({
                type: 'Feature',
                properties: {},
                geometry: { type: 'LineString', coordinates }
            });
        }

        function getRoadPointAtFraction(fraction) {
            const coords = roadRouteCoordinates;
            if (!coords || coords.length < 2) return null;
            const f = Math.min(1, Math.max(0, fraction));
            const lengths = [];
            let total = 0;
            for (let i = 1; i < coords.length; i++) {
                const a = { lat: coords[i - 1][1], lng: coords[i - 1][0] };
                const b = { lat: coords[i][1], lng: coords[i][0] };
                const d = haversineDistance(a, b);
                lengths.push(d);
                total += d;
            }
            if (!total) return { lng: coords[0][0], lat: coords[0][1], bearing: 0 };

            const target = total * f;
            let travelled = 0;
            for (let i = 1; i < coords.length; i++) {
                const seg = lengths[i - 1];
                if (travelled + seg >= target) {
                    const local = seg ? (target - travelled) / seg : 0;
                    const lng = coords[i - 1][0] + (coords[i][0] - coords[i - 1][0]) * local;
                    const lat = coords[i - 1][1] + (coords[i][1] - coords[i - 1][1]) * local;
                    const bearing = calculateBearing(
                        { lat: coords[i - 1][1], lng: coords[i - 1][0] },
                        { lat: coords[i][1], lng: coords[i][0] }
                    );
                    return { lng, lat, bearing };
                }
                travelled += seg;
            }
            const last = coords[coords.length - 1];
            const prev = coords[coords.length - 2];
            return {
                lng: last[0], lat: last[1],
                bearing: calculateBearing({lat: prev[1], lng: prev[0]}, {lat: last[1], lng: last[0]})
            };
        }

        async function initLeafletMap() {
            if (leafletMap) return leafletMap;

            if (!MAPBOX_PUBLIC_TOKEN || MAPBOX_PUBLIC_TOKEN === 'YOUR_MAPBOX_PUBLIC_ACCESS_TOKEN') {
                const mapContainer = document.getElementById('leafletMap');
                mapContainer.innerHTML = `
                    <div class="w-full h-full flex items-center justify-center bg-parchment-200 p-6 text-center">
                        <div class="max-w-lg parchment-card rounded-xl border-2 border-wax-gold p-6 shadow-xl">
                            <i class="fa-solid fa-map-location-dot text-4xl text-wax-red mb-3"></i>
                            <h3 class="font-cinzel font-bold text-lg text-parchment-900">Mapbox Access Token Required</h3>
                            <p class="text-sm text-parchment-800 mt-2">Set your public Mapbox token in <code>MAPBOX_PUBLIC_TOKEN</code> to load the map.</p>
                        </div>
                    </div>`;
                return;
            }

            const mapContainer = document.getElementById('leafletMap');
            if (!window.mapboxgl) {
                if (mapContainer) mapContainer.innerHTML = '<div class="w-full h-full flex items-center justify-center bg-parchment-200 text-parchment-800"><div class="text-center p-6"><i class="fa-solid fa-spinner fa-spin text-2xl text-wax-gold mb-2"></i><div class="text-xs font-bold">Loading map…</div></div></div>';
                try { await window.loadMapbox(); } catch (e) { console.error(e); if (mapContainer) mapContainer.innerHTML = '<div class="w-full h-full flex items-center justify-center bg-parchment-200 p-6 text-center"><div><i class="fa-solid fa-triangle-exclamation text-3xl text-wax-red mb-2"></i><div class="text-sm font-bold">Mapbox could not be loaded.</div></div></div>'; return null; }
            }
            mapboxgl.accessToken = MAPBOX_PUBLIC_TOKEN;

            try {
                leafletMap = new mapboxgl.Map({
                    container: 'leafletMap',
                    style: 'mapbox://styles/mapbox/standard',
                    center: [90.4125, 23.8103],
                    zoom: 11,
                    pitch: 45,
                    antialias: true,
                    attributionControl: true,
                    projection: 'globe'
                });

                // Keep the map fully interactive during live tracking.
                // The pigeon marker moves independently, while the user can freely pan,
                // zoom, rotate and pitch the map in every direction.
                leafletMap.dragPan.enable();
                leafletMap.scrollZoom.enable();
                leafletMap.touchZoomRotate.enable();
                leafletMap.dragRotate.enable();
                leafletMap.keyboard.enable();

                leafletMap.addControl(new mapboxgl.NavigationControl({ showCompass: true }), 'top-right');

                const senderIcon = createMapboxMarkerElement(
                    `<div class="w-8 h-8 rounded-full bg-parchment-900 border-2 border-wax-gold text-wax-gold flex items-center justify-center shadow-lg text-xs"><i class="fa-solid fa-house-chimney"></i></div>`,
                    32, 32
                );
            const receiverIcon = createMapboxMarkerElement(
                `<div class="relative flex items-center justify-center w-9 h-9">
                    <div class="pulse-beacon"></div>
                    <div class="w-9 h-9 rounded-full bg-wax-red border-2 border-wax-gold text-white flex items-center justify-center shadow-xl text-sm z-10"><i class="fa-solid fa-location-dot"></i></div>
                </div>`,
                36, 36
            );

            const pigeonIcon = createMapboxMarkerElement(
                `<div id="pigeonIconContainer" class="pigeon-photo-marker" title="HD Carrier Pigeon">
                    <div class="pigeon-svg-wrap">
                        <svg class="pigeon-svg" viewBox="0 0 460 350" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                            <defs>
                                <linearGradient id="pBody" x1="0" y1="0" x2="1" y2="1">
                                    <stop offset="0" stop-color="#ffffff"/>
                                    <stop offset=".38" stop-color="#e9edf1"/>
                                    <stop offset=".72" stop-color="#aeb8c1"/>
                                    <stop offset="1" stop-color="#65717b"/>
                                </linearGradient>
                                <linearGradient id="pWing" x1="0" y1="0" x2=".9" y2="1">
                                    <stop offset="0" stop-color="#ffffff"/>
                                    <stop offset=".35" stop-color="#d9e0e6"/>
                                    <stop offset=".72" stop-color="#87939d"/>
                                    <stop offset="1" stop-color="#39444d"/>
                                </linearGradient>
                                <linearGradient id="pWingLight" x1="0" y1="0" x2="1" y2="1">
                                    <stop offset="0" stop-color="#ffffff"/>
                                    <stop offset=".55" stop-color="#cbd3da"/>
                                    <stop offset="1" stop-color="#707c86"/>
                                </linearGradient>
                                <linearGradient id="pNeck" x1="0" y1="0" x2="1" y2="1">
                                    <stop offset="0" stop-color="#485a83"/>
                                    <stop offset=".32" stop-color="#2e9a92"/>
                                    <stop offset=".58" stop-color="#7659a2"/>
                                    <stop offset=".82" stop-color="#385d89"/>
                                    <stop offset="1" stop-color="#313a58"/>
                                </linearGradient>
                                <linearGradient id="pBeak" x1="0" y1="0" x2="1" y2="1">
                                    <stop offset="0" stop-color="#e9a079"/>
                                    <stop offset="1" stop-color="#b95e46"/>
                                </linearGradient>
                                <linearGradient id="pLetter" x1="0" y1="0" x2="1" y2="1">
                                    <stop offset="0" stop-color="#fffdf5"/>
                                    <stop offset="1" stop-color="#d9c49e"/>
                                </linearGradient>
                                <filter id="pShadow" x="-30%" y="-30%" width="160%" height="180%">
                                    <feDropShadow dx="0" dy="12" stdDeviation="8" flood-color="#1c120d" flood-opacity=".42"/>
                                </filter>
                                <filter id="pSoft" x="-30%" y="-30%" width="160%" height="160%">
                                    <feGaussianBlur stdDeviation="2.5"/>
                                </filter>
                                <radialGradient id="pEye">
                                    <stop offset="0" stop-color="#ffffff"/>
                                    <stop offset=".15" stop-color="#d79b39"/>
                                    <stop offset=".38" stop-color="#5a3516"/>
                                    <stop offset="1" stop-color="#090909"/>
                                </radialGradient>
                            </defs>

                            <ellipse cx="213" cy="300" rx="92" ry="15" fill="#000" opacity=".18" filter="url(#pSoft)"/>

                            <!-- Rear wing: long primary feathers -->
                            <g class="pigeon-wing-back" filter="url(#pShadow)">
                                <path d="M177 174 C111 137 71 77 83 28 C90 4 111 8 127 29
                                         C150 59 177 105 202 154 Z"
                                      fill="url(#pWing)" stroke="#65717b" stroke-width="3"/>
                                <path d="M150 151 C107 107 88 61 91 30" fill="none" stroke="#ffffff" stroke-width="7" opacity=".72"/>
                                <path d="M165 151 C126 103 112 63 111 24" fill="none" stroke="#aeb8c1" stroke-width="8"/>
                                <path d="M180 151 C151 103 139 66 134 31" fill="none" stroke="#7d8993" stroke-width="7"/>
                            </g>

                            <!-- Tail -->
                            <g filter="url(#pShadow)">
                                <path d="M126 229 L39 257 L82 225 L35 226 L122 197 Z"
                                      fill="url(#pWingLight)" stroke="#67737d" stroke-width="3"/>
                                <path d="M112 214 L55 247" stroke="#8e9aa4" stroke-width="5" opacity=".8"/>
                                <path d="M111 207 L55 226" stroke="#ffffff" stroke-width="4" opacity=".65"/>
                            </g>

                            <!-- Main body -->
                            <g filter="url(#pShadow)">
                                <ellipse cx="224" cy="208" rx="113" ry="70" fill="url(#pBody)" stroke="#626e78" stroke-width="3"/>
                                <ellipse cx="174" cy="216" rx="61" ry="55" fill="#f8fafb" opacity=".68"/>
                                <path d="M126 198 C166 170 221 169 278 195 C248 188 207 195 174 224 C157 239 140 231 126 198Z"
                                      fill="#ffffff" opacity=".58"/>
                            </g>

                            <!-- Neck iridescence -->
                            <path d="M259 151 C285 139 316 148 332 173 C346 196 327 221 298 224
                                     C270 226 248 208 247 184 C246 169 251 158 259 151Z"
                                  fill="url(#pNeck)" opacity=".96"/>

                            <!-- Head -->
                            <g filter="url(#pShadow)">
                                <ellipse cx="326" cy="137" rx="57" ry="52" fill="url(#pBody)" stroke="#626e78" stroke-width="3"/>
                                <ellipse cx="346" cy="118" rx="22" ry="16" fill="#ffffff" opacity=".5"/>
                            </g>

                            <!-- Face -->
                            <path d="M355 151 C369 154 383 159 399 165 L367 176 L345 166 Z"
                                  fill="url(#pBeak)" stroke="#8d4d3b" stroke-width="2"/>
                            <path d="M356 151 C370 153 382 157 392 162 L367 164 Z"
                                  fill="#e9b08c"/>
                            <ellipse cx="346" cy="132" rx="13" ry="13" fill="url(#pEye)" stroke="#1b1b1b" stroke-width="2"/>
                            <circle class="pigeon-eye-glint" cx="350" cy="128" r="3.5" fill="#fff"/>

                            <!-- Front wing -->
                            <g class="pigeon-wing-front" filter="url(#pShadow)">
                                <path d="M178 170 C128 137 111 99 125 73 C134 56 153 66 171 88
                                         C202 125 231 163 254 196 C228 210 202 194 178 170Z"
                                      fill="url(#pWingLight)" stroke="#5f6b75" stroke-width="3"/>
                                <path class="pigeon-wing-feather" d="M139 82 C158 108 177 138 195 168" fill="none" stroke="#ffffff" stroke-width="9"/>
                                <path class="pigeon-wing-feather" d="M151 76 C173 106 193 137 210 169" fill="none" stroke="#9aa6b0" stroke-width="9"/>
                                <path class="pigeon-wing-feather" d="M165 78 C187 107 206 137 223 173" fill="none" stroke="#6f7b85" stroke-width="8"/>
                                <path d="M177 92 C192 119 208 143 228 166" fill="none" stroke="#ffffff" stroke-width="4" opacity=".65"/>
                            </g>

                            <!-- Breast highlight -->
                            <path d="M150 228 C176 253 216 268 255 253 C234 277 189 282 158 258 C145 248 140 237 150 228Z"
                                  fill="#ffffff" opacity=".42"/>

                            <!-- Feet and letter -->
                            <g class="pigeon-letter" filter="url(#pShadow)">
                                <path d="M237 254 L248 273 M258 252 L265 272" stroke="#bd704e" stroke-width="6" stroke-linecap="round"/>
                                <path d="M241 272 C231 278 226 278 220 275 M263 271 C271 277 278 278 284 274"
                                      fill="none" stroke="#bd704e" stroke-width="5" stroke-linecap="round"/>
                                <g transform="translate(226 267) rotate(3)">
                                    <rect x="0" y="0" width="72" height="49" rx="3" fill="url(#pLetter)" stroke="#a98c60" stroke-width="2"/>
                                    <path d="M2 3 L36 28 L70 3" fill="none" stroke="#b79b6d" stroke-width="2"/>
                                    <path d="M2 46 L27 25 M70 46 L45 25" fill="none" stroke="#c7ae82" stroke-width="1.5"/>
                                    <circle cx="36" cy="28" r="7" fill="#8b1e1e"/>
                                    <path d="M32 28 l4 4 7 -9" fill="none" stroke="#fff" stroke-width="2"/>
                                </g>
                            </g>

                            <!-- Tiny feather accents -->
                            <path d="M105 184 C128 174 148 171 168 175" fill="none" stroke="#7d8993" stroke-width="4" opacity=".55"/>
                            <path d="M108 194 C131 184 151 183 170 188" fill="none" stroke="#ffffff" stroke-width="3" opacity=".7"/>
                        </svg>
                    </div>
                    <div class="pigeon-flight-trail"></div>
                </div>`,
                230, 175
            );
            pigeon3DMarkerEl = pigeonIcon.querySelector('#pigeonIconContainer');
            if (pigeon3DMarkerEl) {
                pigeon3DMarkerEl.dataset.zoomScale = '1';
                pigeon3DMarkerEl.dataset.bearing = '0';
                pigeon3DMarkerEl.style.opacity = '1';
            }

            senderMarker = new mapboxgl.Marker({ element: senderIcon, anchor: 'center' })
                .setLngLat([0, 0]).addTo(leafletMap);

            receiverMarker = new mapboxgl.Marker({ element: receiverIcon, anchor: 'center' })
                .setLngLat([0, 0]).addTo(leafletMap);

                pigeonMarker = new mapboxgl.Marker({ element: pigeonIcon, anchor: 'center' })
                    .setLngLat([0, 0]).addTo(leafletMap);

                // Make the pigeon visually scale with Mapbox zoom.
                // Zoom in = larger pigeon, zoom out = smaller pigeon.
                const updatePigeonZoomScale = () => {
                    if (!pigeon3DMarkerEl || !leafletMap) return;
                    const zoom = leafletMap.getZoom();
                    const scale = Math.max(0.34, Math.min(2.10, Math.pow(1.16, zoom - 11)));
                    pigeon3DMarkerEl.dataset.zoomScale = scale.toFixed(3);
                    applyPigeonVisualTransform();
                };

                leafletMap.on('zoom', updatePigeonZoomScale);
                leafletMap.on('zoomend', updatePigeonZoomScale);

                leafletMap.on('load', () => {
                    // Give the map a more dimensional, sky-tracking presentation.
                    try {
                        if (!leafletMap.getSource('mapbox-dem')) {
                            leafletMap.addSource('mapbox-dem', {
                                type: 'raster-dem',
                                url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
                                tileSize: 512,
                                maxzoom: 14
                            });
                        }
                        leafletMap.setTerrain({ source: 'mapbox-dem', exaggeration: 1.15 });
                        leafletMap.setFog({ color: 'rgb(235, 238, 242)', 'high-color': 'rgb(180, 205, 235)', 'horizon-blend': 0.08, 'space-color': 'rgb(15, 24, 40)', 'star-intensity': 0.12 });
                    } catch (terrainError) {
                        console.warn('3D terrain enhancement unavailable; continuing with standard map.', terrainError);
                    }
                    if (leafletMap.getSource('pigeon-route')) return;
                    leafletMap.addSource('pigeon-route', {
                        type: 'geojson',
                        data: {
                            type: 'Feature',
                            geometry: { type: 'LineString', coordinates: [] }
                        }
                    });
                    leafletMap.addLayer({
                        id: 'pigeon-route-line',
                        type: 'line',
                        source: 'pigeon-route',
                        paint: {
                            'line-color': '#8b1e1e',
                            'line-width': 4,
                            'line-opacity': 0.88,
                            'line-gap-width': 0,
                            'line-dasharray': [1.5, 1.5]
                        }
                    });
                    if (activePigeonId && window.pigeonsList) {
                        const active = window.pigeonsList.find(p => p.id === activePigeonId);
                        if (active) updateRoadRouteLine(active);
                    }
                    updatePigeonZoomScale();
                    updateMapTelemetry();
                    startPigeonAnimation();
                });
            } catch (err) {
                console.error("Mapbox initialization failed:", err);
                const mapContainer = document.getElementById('leafletMap');
                mapContainer.innerHTML = `<div class="w-full h-full flex items-center justify-center text-wax-red bg-parchment-200 p-6 text-center font-bold">Failed to initialize map tracking. (Check console for errors, WebGL may be disabled).</div>`;
            }
        }

        async function onReceiverLocationMoved() {
            alert('Dispatched flight routes are locked and cannot be changed.');
        }

        function updateReceiverToCurrentGPS() {
            alert('Dispatched flight routes are locked and cannot be changed.');
        }

        function applyPigeonVisualTransform() {
            if (!pigeon3DMarkerEl) return;
            const zoomScale = Number(pigeon3DMarkerEl.dataset.zoomScale || 1);
            const currentRotation = Number(pigeon3DMarkerEl.dataset.bearing || 0);
            pigeon3DMarkerEl.style.transform =
                `rotate(${currentRotation}deg) scale(${zoomScale})`;
        }

        function getAnimatedPigeonState(pigeon, now = Date.now()) {
            if (!pigeon) return null;
            const totalDurationSec = Math.max(1, (Number(pigeon.distanceKm) || 0) / (Number(pigeon.pigeonSpeedKmh) || pigeonSpeedSetting) * 3600);
            const elapsedSec = Math.max(0, (now - Number(pigeon.dispatchTime || now)) / 1000);
            const progressFraction = Math.min(1, elapsedSec / totalDurationSec);
            const roadPoint = getRoadPointAtFraction(progressFraction);
            const currentPos = roadPoint
                ? { lat: roadPoint.lat, lng: roadPoint.lng }
                : interpolateCoords(pigeon.senderCoords, pigeon.receiverCoords, progressFraction);
            const bearing = roadPoint ? roadPoint.bearing : calculateBearing(currentPos, pigeon.receiverCoords);
            return {
                elapsedSec,
                progressFraction,
                currentPos,
                bearing,
                remainingSec: Math.max(0, totalDurationSec - elapsedSec),
                remainingDistKm: Math.max(0, Number(pigeon.distanceKm || 0) * (1 - progressFraction)),
                delivered: elapsedSec >= totalDurationSec
            };
        }

        function paintPigeonFrame(now = performance.now()) {
            if (!leafletMap || !activePigeonId || !window.pigeonsList) return;
            const pigeon = window.pigeonsList.find(p => p.id === activePigeonId);
            if (!pigeon) return;

            const state = getAnimatedPigeonState(pigeon, Date.now());
            if (!state) return;

            pigeonMarker.setLngLat([state.currentPos.lng, state.currentPos.lat]);
            pigeonMarker.getElement().style.display = 'block';
            if (pigeon3DMarkerEl) {
                // Map bearing: 0° = north. The pigeon is drawn facing north.
                const zoomScale = Number(pigeon3DMarkerEl.dataset.zoomScale || 1);
                pigeon3DMarkerEl.dataset.bearing = state.bearing.toFixed(2);
                pigeon3DMarkerEl.style.transform =
                    `rotate(${state.bearing}deg) scale(${zoomScale})`;
                pigeon3DMarkerEl.style.opacity = state.delivered ? '0.72' : '1';
            }

            if (now - lastTelemetryPaint > 120) {
                document.getElementById('telemetryDistance').innerText = `${state.remainingDistKm.toFixed(2)} km`;
                document.getElementById('telemetryEta').innerText = formatDuration(state.remainingSec);
                document.getElementById('telemetrySpeed').innerText = `${pigeon.pigeonSpeedKmh} km/h`;
                document.getElementById('telemetryCoords').innerText = `${state.currentPos.lat.toFixed(4)}, ${state.currentPos.lng.toFixed(4)}`;
                const badge = document.getElementById('telemetryStatusBadge');
                if (state.delivered) {
                    badge.innerText = 'ARRIVED / DELIVERED';
                    badge.className = 'text-[10px] bg-green-800 text-green-200 px-2 py-0.5 rounded font-mono font-bold';
                } else {
                    badge.innerText = 'EN ROUTE';
                    badge.className = 'text-[10px] bg-wax-red/40 text-wax-gold px-2 py-0.5 rounded font-mono';
                }
                lastTelemetryPaint = now;
            }

            if (roadRouteCoordinates.length > 1) updateRoadRouteLine(pigeon);
            pigeonAnimationFrame = requestAnimationFrame(paintPigeonFrame);
        }

        function startPigeonAnimation() {
            if (pigeonAnimationFrame) cancelAnimationFrame(pigeonAnimationFrame);
            pigeonAnimationFrame = requestAnimationFrame(paintPigeonFrame);
        }

        function updateMapTelemetry() {
            if (!leafletMap || !activePigeonId) return;
            const pigeon = window.pigeonsList.find(p => p.id === activePigeonId);

            if (!pigeon) {
                document.getElementById('trackerPigeonTitle').innerText = 'Select a Pigeon to Track';
                document.getElementById('trackerPigeonSub').innerText = 'Choose an active flight from The Nest';
                return;
            }

            document.getElementById('trackerPigeonTitle').innerText = `Flight of Epistle: ${pigeon.senderName} ➔ ${pigeon.receiverName}`;
            document.getElementById('trackerPigeonSub').innerText = `Distance: ${Number(pigeon.distanceKm || 0).toFixed(1)} km | Speed: ${pigeon.pigeonSpeedKmh} km/h`;

            loadRoadRoute(pigeon);
            startPigeonAnimation();
        }

        window.onPigeonsDataUpdated = function(pigeons) {
            if (!activePigeonId && pigeons.length > 0) {
                activePigeonId = pigeons[0].id;
            }

            const incomingIds = new Set(pigeons.filter(p => p.direction === 'incoming').map(p => p.id));
            if (knownIncomingIds.size > 0) {
                const newIncoming = pigeons.filter(p => p.direction === 'incoming' && !knownIncomingIds.has(p.id));
                if (newIncoming.length) {
                    playSound('release');
                    const names = newIncoming.map(p => p.senderName).join(', ');
                    console.info('New incoming pigeon:', names);
                }
            }
            knownIncomingIds = incomingIds;
            renderNestInbox(pigeons);
            updateMapTelemetry();
        };

        function renderNestInbox(pigeons) {
            const grid = document.getElementById('pigeonsGrid');
            const activeBadge = document.getElementById('activeBadge');
            const inboxBadge = document.getElementById('inboxBadge');
            const notice = document.getElementById('upcomingNotice');
            const noticeList = document.getElementById('upcomingNoticeList');
            const noticeCount = document.getElementById('upcomingCount');

            if (!grid || !activeBadge || !inboxBadge) return;

            if (!pigeons || pigeons.length === 0) {
                grid.innerHTML = `
                    <div class="col-span-full py-12 text-center text-parchment-800 space-y-2">
                        <i class="fa-solid fa-dove text-4xl text-parchment-400 animate-bounce"></i>
                        <p class="font-cinzel text-lg">No pigeons in your nest yet.</p>
                        <p class="text-xs">Send a letter or wait for another member to send one to you.</p>
                    </div>`;
                activeBadge.classList.add('hidden');
                inboxBadge.classList.add('hidden');
                notice?.classList.add('hidden');
                return;
            }

            const now = Date.now();
            const incomingUpcoming = pigeons.filter(
                p => p.direction === 'incoming' && Number(p.estimatedArrival) > now
            );
            const incomingDelivered = pigeons.filter(
                p => p.direction === 'incoming' &&
                     p.receiverUid === currentUser?.uid &&
                     Number(p.estimatedArrival) <= now
            );

            // Load each letter's read state once. No repeated reads on the live refresh.
            if (incomingDelivered.some(p => !letterReadStateCache.has(p.id))) {
                ensureLetterReadStates(pigeons);
            }

            const unreadCount = incomingDelivered.filter(
                p => letterReadStateCache.get(p.id) !== true
            ).length;

            if (incomingUpcoming.length) {
                notice?.classList.remove('hidden');
                if (noticeCount) noticeCount.innerText = incomingUpcoming.length;
                if (noticeList) {
                    noticeList.innerHTML = incomingUpcoming.map(p => `
                        <div class="flex items-center justify-between gap-3 bg-parchment-100/80 border border-parchment-300 rounded-lg p-2">
                            <div class="min-w-0">
                                <div class="font-bold truncate">${escapeHtml(p.senderName)} → You</div>
                                <div class="text-[10px]">Arrival in <span class="font-mono font-bold text-wax-red">${formatDuration(Math.max(0, (p.estimatedArrival - now) / 1000))}</span></div>
                            </div>
                            <button onclick="trackPigeonOnMap('${p.id}')" class="shrink-0 px-2 py-1 rounded bg-wax-red text-white font-bold text-[10px]">
                                <i class="fa-solid fa-map"></i> Track
                            </button>
                        </div>`).join('');
                }
            } else {
                notice?.classList.add('hidden');
            }

            const activeCount = pigeons.filter(p => Number(p.estimatedArrival) > now).length;

            grid.innerHTML = pigeons.map(p => {
                const isDelivered = Number(p.estimatedArrival) <= now;
                const remainingSec = Math.max(0, (Number(p.estimatedArrival) - now) / 1000);
                const incoming = p.direction === 'incoming';
                const isUnread = incoming && isDelivered && letterReadStateCache.get(p.id) !== true;
                const canOpen = isDelivered || !incoming;

                const cardBorder = isUnread ? 'border-wax-gold' : (isDelivered ? 'border-parchment-400' : 'border-parchment-400');
                const cardBg = isUnread ? 'bg-wax-gold/10' : '';
                const envelopeBg = isUnread ? 'bg-wax-red text-white' : (isDelivered ? 'bg-wax-gold text-parchment-900' : 'bg-wax-red text-parchment-100');
                const envelopeIcon = isUnread ? 'fa-envelope' : (isDelivered ? 'fa-envelope-open' : 'fa-lock');

                return `
                <div class="parchment-card rounded-xl p-5 border-2 ${cardBorder} ${cardBg} shadow-lg space-y-4 flex flex-col justify-between ${isUnread ? 'ring-2 ring-wax-gold/30' : ''}">
                    <div class="flex justify-between items-start gap-2">
                        <div class="flex items-center gap-2 min-w-0">
                            <span class="w-8 h-8 rounded-full ${envelopeBg} flex items-center justify-center font-bold text-xs shadow shrink-0">
                                <i class="fa-solid ${envelopeIcon}"></i>
                            </span>
                            <div class="min-w-0">
                                <div class="flex items-center gap-2 flex-wrap">
                                    <span class="text-[10px] uppercase font-bold tracking-wider ${isUnread ? 'text-wax-red' : (isDelivered ? 'text-wax-gold' : 'text-wax-red')} block">
                                        ${incoming ? (isDelivered ? 'Delivered To You' : 'Incoming Flight') : (isDelivered ? 'Sent & Delivered' : 'Your Pigeon In Flight')}
                                    </span>
                                    ${isUnread ? '<span class="text-[9px] px-2 py-0.5 rounded-full bg-wax-red text-white font-bold animate-pulse">UNREAD</span>' : (incoming && isDelivered ? '<span class="text-[9px] px-2 py-0.5 rounded-full bg-green-100 text-green-800 font-bold">READ</span>' : '')}
                                </div>
                                <h4 class="font-cinzel font-bold text-base text-parchment-900 leading-tight truncate">
                                    ${escapeHtml(p.senderName)} ➔ ${escapeHtml(p.receiverName)}
                                </h4>
                            </div>
                        </div>
                        ${incoming
                            ? '<span class="text-[9px] px-2 py-1 rounded-full bg-wax-gold/20 text-sepia-dark font-bold shrink-0">INCOMING</span>'
                            : '<span class="text-[9px] px-2 py-1 rounded-full bg-parchment-300 text-parchment-800 font-bold shrink-0">SENT</span>'}
                    </div>

                    <div class="bg-parchment-200/80 p-3 rounded-lg border border-parchment-300 space-y-2 text-xs">
                        <div class="flex justify-between items-center text-parchment-800">
                            <span><i class="fa-solid fa-route text-wax-gold"></i> Distance:</span>
                            <span class="font-mono font-bold">${Number(p.distanceKm || 0).toFixed(1)} km</span>
                        </div>
                        <div class="flex justify-between items-center text-parchment-800">
                            <span><i class="fa-solid fa-clock text-wax-red"></i> ${isDelivered ? 'Delivered:' : 'Arrival in:'}</span>
                            <span class="font-mono font-bold ${isDelivered ? 'text-green-700' : 'text-wax-red'}">
                                ${isDelivered ? new Date(Number(p.estimatedArrival)).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : formatDuration(remainingSec)}
                            </span>
                        </div>
                    </div>

                    <div class="flex items-center gap-2 pt-1">
                        <button onclick="trackPigeonOnMap('${p.id}')" class="flex-1 py-2 bg-parchment-300 hover:bg-parchment-400 text-parchment-900 text-xs font-bold rounded-lg border border-parchment-400 transition flex items-center justify-center gap-1.5">
                            <i class="fa-solid fa-map"></i> ${isDelivered ? 'View Route' : 'Track Flight'}
                        </button>
                        ${canOpen ? `
                            <button onclick="openLetterModal('${p.id}')" class="flex-1 py-2 ${isUnread ? 'bg-wax-red hover:bg-red-800' : 'wax-seal'} text-parchment-100 text-xs font-cinzel font-bold rounded-lg shadow transition flex items-center justify-center gap-1.5">
                                <i class="fa-solid fa-${isUnread ? 'envelope-open' : (incoming ? 'stamp' : 'envelope-open-text')}"></i>
                                ${isUnread ? 'Read New Letter' : (incoming ? 'Open Letter' : 'View Sent Letter')}
                            </button>` : `
                            <button disabled class="flex-1 py-2 bg-parchment-300/50 text-parchment-800/50 text-xs font-cinzel font-bold rounded-lg cursor-not-allowed flex items-center justify-center gap-1.5">
                                <i class="fa-solid fa-lock"></i> Locked Until Arrival
                            </button>`}
                    </div>

                    ${!incoming ? `
                    <button onclick="deletePigeon('${p.id}')" class="w-full py-2 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold rounded-lg border border-red-200 transition flex items-center justify-center gap-1.5">
                        <i class="fa-solid fa-trash"></i> Delete My Sent Message
                    </button>` : ''}
                </div>`;
            }).join('');

            activeBadge.innerText = activeCount;
            activeBadge.classList.toggle('hidden', activeCount === 0);

            // The Nest badge now means "unread letters", not total letters.
            inboxBadge.innerText = unreadCount;
            inboxBadge.classList.toggle('hidden', unreadCount === 0);

            const mobileInboxBadge = document.getElementById('mobileInboxBadge');
            if (mobileInboxBadge) {
                mobileInboxBadge.innerText = unreadCount;
                mobileInboxBadge.classList.toggle('hidden', unreadCount === 0);
            }
        }


        function escapeHtml(value) {
            return String(value ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','\"':'&quot;'}[ch]));
        }

        async function deletePigeon(pigeonId) {
            const pigeon = window.pigeonsList.find(p => p.id === pigeonId);
            if (!pigeon || pigeon.senderUid !== currentUser?.uid) return;
            if (!confirm('Delete this sent message? The pigeon and its letter will be removed for everyone.')) return;
            try {
                await window.dbDeletePigeon(pigeonId);
                if (activePigeonId === pigeonId) activePigeonId = null;
                playSound('flap');
            } catch (err) {
                console.error('Delete pigeon error:', err);
                alert('Could not delete the message: ' + (err.message || 'Permission denied.'));
            }
        }

        async function openLetterModal(pigeonId) {
            const pigeon = window.pigeonsList.find(p => p.id === pigeonId);
            if (!pigeon) return;

            const isIncoming = pigeon.receiverUid === currentUser?.uid;
            const isDelivered = Number(pigeon.estimatedArrival) <= Date.now();

            if (isIncoming && !isDelivered) {
                alert(`This letter is still in flight. It will be readable after arrival in ${formatDuration(Math.max(0, (Number(pigeon.estimatedArrival) - Date.now()) / 1000))}.`);
                return;
            }

            try {
                const letter = await window.dbGetLetter(pigeonId);
                playSound('unseal');

                document.getElementById('modalSender').innerText = pigeon.senderName || 'Unknown sender';
                document.getElementById('modalReceiver').innerText = pigeon.receiverName || 'Unknown receiver';
                document.getElementById('modalBody').innerText = letter.content || '';
                const subjectRow=document.getElementById('modalSubjectRow'), subjectEl=document.getElementById('modalSubject');
                if(subjectEl) subjectEl.innerText=letter.subject||'';
                if(subjectRow) subjectRow.classList.toggle('hidden',!(letter.subject||''));
                const modalGrid=document.getElementById('modalImagesGrid');
                const imageList=Array.isArray(letter.imageUrls)&&letter.imageUrls.length ? letter.imageUrls : (letter.imageUrl?[letter.imageUrl]:[]);
                if(modalGrid) modalGrid.innerHTML=imageList.map(url=>`<img src="${escapeHtmlSafe(url)}" alt="Attachment" class="w-full h-40 object-cover rounded-lg border border-parchment-300" loading="lazy">`).join('');
                const modalFiles=Array.isArray(letter.fileAttachments)?letter.fileAttachments:[]; const modalFileBox=document.getElementById('modalFilesGrid'); if(modalFileBox) modalFileBox.innerHTML=modalFiles.map(f=>`<a href="${escapeHtmlSafe(f.downloadPage||f.directLink||f.url||'#')}" target="_blank" rel="noopener" class="letter-file-card"><i class="fa-solid fa-file-arrow-down"></i><span><strong>${escapeHtmlSafe(f.name||'File')}</strong><small>${escapeHtmlSafe(formatBytes(f.size||0))} • ${escapeHtmlSafe(f.type||'')}</small></span></a>`).join('');
                document.getElementById('modalDistance').innerText = `${Number(pigeon.distanceKm || 0).toFixed(1)} km`;
                document.getElementById('modalSpeed').innerText = `${pigeon.pigeonSpeedKmh} km/h`;
                document.getElementById('modalDispatchTime').innerText =
                    new Date(Number(pigeon.dispatchTime)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                const imgContainer = document.getElementById('modalImageContainer');
                const imgEl = document.getElementById('modalImage');
                if (imageList.length) {
                    if(imgEl) imgEl.src = imageList[0];
                    imgContainer.classList.remove('hidden');
                } else {
                    if(imgEl) imgEl.src = '';
                    imgContainer.classList.add('hidden');
                }

                const modal = document.getElementById('letterModal');
                const container = document.getElementById('letterModalContainer');
                const modalDeleteBtn = document.getElementById('modalDeleteBtn');
                window.currentModalPigeonId = pigeonId;

                if (modalDeleteBtn) {
                    const canDelete = pigeon.senderUid === currentUser?.uid;
                    modalDeleteBtn.classList.toggle('hidden', !canDelete);
                    modalDeleteBtn.classList.toggle('flex', canDelete);
                }

                // Reply is available directly from the read page for received letters.
                const replySection = document.getElementById('letterReplySection');
                const replyInput = document.getElementById('letterReplyInput');
                const replyStatus = document.getElementById('letterReplyStatus');
                if (replySection) {
                    const canReply = isIncoming && pigeon.receiverUid === currentUser?.uid && isDelivered;
                    replySection.classList.toggle('hidden', !canReply);
                    if (canReply) {
                        if (replyInput) replyInput.value = '';
                        if (replyStatus) replyStatus.innerText = '';
                    }
                }

                modal.classList.remove('hidden');
                setTimeout(() => {
                    container.classList.remove('scale-95', 'opacity-0');
                    container.classList.add('scale-100', 'opacity-100');
                }, 10);

                // Opening an arrived incoming letter marks it read immediately.
                if (isIncoming) {
                    await markLetterAsRead(pigeonId);
                }
            } catch (err) {
                console.error('Open letter error:', err);
                alert('The letter cannot be opened yet or is no longer available.');
            }
        }


        function closeLetterModal() {
            const modal = document.getElementById('letterModal');
            const container = document.getElementById('letterModalContainer');
            if (!modal || !container) return;
            container.classList.remove('scale-100', 'opacity-100');
            container.classList.add('scale-95', 'opacity-0');
            setTimeout(() => {
                modal.classList.add('hidden');
                window.currentModalPigeonId = null;
            }, 200);
        }

        async function sendReplyFromLetter() {
            const pigeonId = window.currentModalPigeonId;
            const original = window.pigeonsList.find(p => p.id === pigeonId);
            const input = document.getElementById('letterReplyInput');
            const status = document.getElementById('letterReplyStatus');
            const button = document.getElementById('sendLetterReplyBtn');

            if (!pigeonId || !original || !input || !currentUser) return;

            const replyText = input.value.trim();
            if (!replyText) {
                alert('Please write your reply first.');
                input.focus();
                return;
            }

            if (original.receiverUid !== currentUser.uid) {
                alert('Only the recipient of this letter can reply from the read page.');
                return;
            }

            if (!original.senderCoords || !original.receiverCoords) {
                alert('Reply route information is unavailable for this letter.');
                return;
            }

            if (button) {
                button.disabled = true;
                button.classList.add('opacity-60', 'cursor-not-allowed');
            }
            if (status) status.innerText = 'Sending reply...';

            try {
                // For a reply, the original receiver becomes the sender and the
                // original sender becomes the new receiver.
                const senderCoords = original.receiverCoords;
                const receiverCoords = original.senderCoords;
                const distanceKm = haversineDistance(senderCoords, receiverCoords);
                const speedKmh = pigeonSpeedSetting;
                const flightDurationSeconds = Math.max(
                    5,
                    (distanceKm / speedKmh) * 3600
                );
                const dispatchTime = Date.now();
                const estimatedArrival = dispatchTime + (flightDurationSeconds * 1000);

                const replyPayload = {
                    senderUid: currentUser.uid,
                    receiverUid: original.senderUid,
                    senderName: currentUser.displayName || currentUser.email?.split('@')[0] || 'Sender',
                    receiverName: original.senderName || 'Original Sender',
                    senderCoords,
                    receiverCoords,
                    distanceKm,
                    pigeonSpeedKmh: speedKmh,
                    flightDurationSeconds,
                    dispatchTime,
                    estimatedArrival,
                    status: 'in_flight',
                    replyToPigeonId: pigeonId,
                    isReply: true
                };

                const replyId = await window.dbSavePigeon(replyPayload, {
                    content: replyText,
                    imageUrl: ''
                });

                input.value = '';
                if (status) status.innerText = 'Reply sent successfully.';
                playSound('release');

                // Keep the read page open and reset the status shortly afterward.
                setTimeout(() => {
                    if (status) status.innerText = '';
                }, 3000);

                console.info('Reply pigeon dispatched:', replyId);
            } catch (err) {
                console.error('Reply dispatch error:', err);
                if (status) status.innerText = '';
                alert('Reply could not be sent. ' + (err.message || 'Please check Firebase permissions.'));
            } finally {
                if (button) {
                    button.disabled = false;
                    button.classList.remove('opacity-60', 'cursor-not-allowed');
                }
            }
        }

        async function deletePigeonFromModal() {
            const pigeonId = window.currentModalPigeonId;
            if (!pigeonId) return;
            const pigeon = window.pigeonsList.find(p => p.id === pigeonId);
            if (!pigeon || pigeon.senderUid !== currentUser?.uid) return;
            closeLetterModal();
            setTimeout(() => deletePigeon(pigeonId), 220);
        }

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') closeLetterModal();
        });
        document.getElementById('letterModal')?.addEventListener('click', (event) => {
            if (event.target.id === 'letterModal') closeLetterModal();
        });

        function focusMapOnTrackedPigeon(pigeonId, options = {}) {
            if (!leafletMap) return;
            const pigeon = window.pigeonsList?.find(p => p.id === pigeonId);
            if (!pigeon) return;

            // Calculate the bird's current position without starting a follow mode.
            // This is intentionally a one-time camera move: after the camera arrives,
            // the user remains completely free to drag, zoom, rotate or pitch the map.
            const state = getAnimatedPigeonState(pigeon, Date.now());
            const pos = state?.currentPos || pigeon.senderCoords;
            if (!pos) return;

            const targetZoom = options.zoom ?? Math.max(5.5, Math.min(10.5, leafletMap.getZoom() || 7));

            leafletMap.stop();
            leafletMap.flyTo({
                center: [Number(pos.lng), Number(pos.lat)],
                zoom: targetZoom,
                duration: options.duration ?? 1100,
                essential: true,
                curve: 1.25,
                speed: 1.1
            });
        }

        function trackPigeonOnMap(pigeonId) {
            const pigeon = window.pigeonsList.find(p => p.id === pigeonId);
            if (!pigeon) return;
            activePigeonId = pigeonId;
            roadRouteCoordinates = [];
            roadRouteKey = '';
            switchTab('map');

            // Once the Map tab is visible and Mapbox has resized, move the camera
            // directly to the flying pigeon's current location. This is NOT a
            // continuous follow: the user can freely move the map afterwards.
            const focus = () => {
                if (!leafletMap) return;
                if (typeof leafletMap.resize === 'function') leafletMap.resize();
                focusMapOnTrackedPigeon(pigeonId);
            };

            // switchTab initializes the map when necessary, so wait for the next
            // frame and then focus. A second pass handles the first Mapbox render.
            requestAnimationFrame(() => {
                focus();
                setTimeout(focus, 180);
            });
        }

        function switchTab(tabName) {
            document.querySelectorAll('.tab-view').forEach(el => el.classList.add('hidden'));
            document.querySelectorAll('.tab-btn').forEach(btn => {
                btn.classList.remove('border-wax-red', 'text-wax-red');
                btn.classList.add('border-transparent', 'text-parchment-800');
            });
            document.querySelectorAll('.mobile-nav-btn').forEach(btn => btn.classList.remove('active'));

            const view = document.getElementById(`view-${tabName}`);
            if (!view) return;
            view.classList.remove('hidden');

            const activeBtn = document.getElementById(`tabBtn-${tabName}`);
            if (activeBtn) {
                activeBtn.classList.remove('border-transparent', 'text-parchment-800');
                activeBtn.classList.add('border-wax-red', 'text-wax-red');
            }

            const mobileBtn = document.getElementById(`mobileNav-${tabName}`);
            if (mobileBtn) mobileBtn.classList.add('active');

            if (tabName === 'map') {
                if (!leafletMap) initLeafletMap();
                setTimeout(() => {
                    if (leafletMap && typeof leafletMap.resize === 'function') leafletMap.resize();
                    updateMapTelemetry();
                }, 100);
            }

            if (tabName === 'friends') {
                if (currentUser && !friendsListenersStarted) listenToFriends();
                if (!selectedFriendObj) {
                    setFriendFilter(activeFriendFilter || 'friends');
                }
                renderFriendsUI(); renderChatRooms();
            }
        }


        window.addEventListener('resize', () => {
            if (leafletMap && typeof leafletMap.resize === 'function') {
                setTimeout(() => leafletMap.resize(), 120);
            }
        });

        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                if (leafletMap && typeof leafletMap.resize === 'function') leafletMap.resize();
            }, 350);
        });

        window.onload = function() {
            calculateDistancePreview();

            setInterval(() => {
                if (leafletMap && activePigeonId) updateMapTelemetry();

                    const activeBadge = document.getElementById('activeBadge');
                    const mobileMapBadge = document.getElementById('mobileMapBadge');
                    if (activeBadge && mobileMapBadge) {
                        const val = parseInt(activeBadge.textContent || '0', 10) || 0;
                        mobileMapBadge.textContent = val;
                        mobileMapBadge.classList.toggle('hidden', val === 0);
                    }
                    const inboxBadge = document.getElementById('inboxBadge');
                    const mobileInboxBadge = document.getElementById('mobileInboxBadge');
                    if (inboxBadge && mobileInboxBadge) {
                        const val = parseInt(inboxBadge.textContent || '0', 10) || 0;
                        mobileInboxBadge.textContent = val;
                        mobileInboxBadge.classList.toggle('hidden', val === 0);
                    }
            }, 1000);
        };
    
