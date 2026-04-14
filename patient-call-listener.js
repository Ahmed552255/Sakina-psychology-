// patient-call-listener.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, onValue, update, get } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyAx0wVqtIYHbFNgZ3_Wr6ViemAJ7BwMOkw",
    authDomain: "sakina-937c4.firebaseapp.com",
    databaseURL: "https://sakina-937c4-default-rtdb.firebaseio.com",
    projectId: "sakina-937c4",
    storageBucket: "sakina-937c4.firebasestorage.app",
    messagingSenderId: "25215790734",
    appId: "1:25215790734:web:46c5d893d5818530b3a3df"
};

let app;
try {
    app = initializeApp(firebaseConfig);
} catch (e) {
    console.log("Firebase already initialized.");
}

const db = getDatabase(app);
const auth = getAuth();

let currentPatientId = null;
let incomingCallDialog = null;
let ringtoneAudio = null;
let isListenerActive = false;

function createCallDialog() {
    if (incomingCallDialog) return;

    const dialog = document.createElement('div');
    dialog.id = 'sakoonIncomingCallDialog';
    dialog.style.cssText = `
        position: fixed; top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(15, 25, 25, 0.85); backdrop-filter: blur(12px);
        z-index: 99999; display: flex; align-items: center; justify-content: center;
        font-family: 'Cairo', sans-serif; direction: rtl;
    `;
    dialog.innerHTML = `
        <div style="background: #1f4f4f; border-radius: 32px; padding: 2rem 2rem 1.8rem;
                    max-width: 340px; width: 90%; text-align: center; box-shadow: 0 20px 40px rgba(0,0,0,0.5);
                    border: 1.5px solid #5aabab;">
            <div style="background: #3d8a8a; width: 80px; height: 80px; border-radius: 50%;
                        margin: 0 auto 1.2rem; display: flex; align-items: center; justify-content: center;
                        border: 3px solid #98D8D8;">
                <span id="sakoonCallerInitial" style="font-size: 2.5rem; font-weight: 900; color: white;">د</span>
            </div>
            <h3 id="sakoonCallerNameDisplay" style="color: white; font-size: 1.6rem; margin-bottom: 0.5rem;">طبيب</h3>
            <p style="color: #a8dede; margin-bottom: 2rem;">مكالمة واردة...</p>
            <div style="display: flex; gap: 1rem; justify-content: center;">
                <button id="sakoonDeclineCallBtn" style="background: #d94f4f; border: none; color: white;
                    padding: 0.8rem 1.5rem; border-radius: 60px; font-family: 'Cairo'; font-weight: bold;
                    font-size: 1rem; cursor: pointer; flex: 1; display: flex; align-items: center; justify-content: center;
                    gap: 8px;">
                    <i data-feather="phone-off" style="width: 18px; height: 18px;"></i> رفض
                </button>
                <button id="sakoonAcceptCallBtn" style="background: #38c08a; border: none; color: white;
                    padding: 0.8rem 1.5rem; border-radius: 60px; font-family: 'Cairo'; font-weight: bold;
                    font-size: 1rem; cursor: pointer; flex: 1; display: flex; align-items: center; justify-content: center;
                    gap: 8px;">
                    <i data-feather="phone" style="width: 18px; height: 18px;"></i> رد
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(dialog);
    
    dialog.addEventListener('click', (e) => {
        if (e.target === dialog) { /* منع الإغلاق */ }
    });

    incomingCallDialog = dialog;
    dialog.style.display = 'none';
}

// رفض المكالمة
async function declineCall() {
    const declineBtn = document.getElementById('sakoonDeclineCallBtn');
    const callId = declineBtn.dataset.callId;
    if (callId) {
        try {
            await update(ref(db, `calls/${callId}`), { status: 'rejected' });
        } catch (e) {}
    }
    hideCallDialog();
}

// قبول المكالمة
async function acceptCall() {
    const acceptBtn = document.getElementById('sakoonAcceptCallBtn');
    const callId = acceptBtn.dataset.callId;
    const callDataStr = acceptBtn.dataset.callData;
    
    console.log('[acceptCall] callId:', callId);
    console.log('[acceptCall] callDataStr:', callDataStr);
    
    if (!callId || !callDataStr) {
        alert('بيانات المكالمة غير مكتملة.');
        return;
    }
    
    let callData;
    try {
        callData = JSON.parse(callDataStr);
    } catch (e) {
        console.error('فشل تحليل بيانات المكالمة:', e);
        return;
    }
    
    const doctorId = callData.caller;
    const callType = callData.type || 'audio';
    
    // تحديث الحالة (غير مانع)
    update(ref(db, `calls/${callId}`), { status: 'answered' }).catch(e => {});
    
    const url = `call.html?type=${callType}&doctorId=${encodeURIComponent(doctorId)}&patientId=${encodeURIComponent(currentPatientId)}&role=callee`;
    console.log('[acceptCall] الانتقال إلى:', url);
    
    // إخفاء النافذة فوراً
    hideCallDialog();
    
    // الانتقال
    window.location.href = url;
}

function hideCallDialog() {
    if (incomingCallDialog) {
        incomingCallDialog.style.display = 'none';
    }
    if (ringtoneAudio) {
        ringtoneAudio.pause();
        ringtoneAudio.currentTime = 0;
    }
    // لا نمسح dataset هنا لأنه قد يكون مطلوبًا للرفض
}

async function showCallDialog(callData, callId) {
    createCallDialog();
    
    const doctorId = callData.caller;
    let callerName = doctorId;
    
    try {
        const snap = await get(ref(db, `doctors/${doctorId}`));
        if (snap.exists()) {
            const data = snap.val();
            callerName = data.name || doctorId;
        }
    } catch (e) {}
    
    document.getElementById('sakoonCallerNameDisplay').textContent = callerName;
    document.getElementById('sakoonCallerInitial').textContent = callerName.charAt(0);
    
    // تخزين البيانات في الأزرار
    const acceptBtn = document.getElementById('sakoonAcceptCallBtn');
    const declineBtn = document.getElementById('sakoonDeclineCallBtn');
    acceptBtn.dataset.callId = callId;
    acceptBtn.dataset.callData = JSON.stringify(callData);
    declineBtn.dataset.callId = callId;
    
    incomingCallDialog.style.display = 'flex';
    
    if (!ringtoneAudio) {
        ringtoneAudio = new Audio('https://cdn.pixabay.com/audio/2022/03/10/audio_6e1f3e0e2c.mp3');
        ringtoneAudio.loop = true;
    }
    ringtoneAudio.play().catch(e => {});
    
    if (typeof feather !== 'undefined') feather.replace();
}

function startListening(patientId) {
    if (isListenerActive) return;
    currentPatientId = patientId;
    
    const callsRef = ref(db, 'calls');
    onValue(callsRef, (snapshot) => {
        const calls = snapshot.val();
        if (!calls) {
            hideCallDialog();
            return;
        }
        
        let foundCallId = null;
        let foundCallData = null;
        
        for (const id in calls) {
            const call = calls[id];
            if (call.callee === patientId && call.status === 'ringing') {
                foundCallId = id;
                foundCallData = call;
                break;
            }
        }
        
        if (foundCallId) {
            // تحقق مما إذا كان الإشعار معروضًا بالفعل لنفس المكالمة
            const acceptBtn = document.getElementById('sakoonAcceptCallBtn');
            if (!acceptBtn || acceptBtn.dataset.callId !== foundCallId) {
                showCallDialog(foundCallData, foundCallId);
            }
        } else {
            hideCallDialog();
        }
    });
    
    isListenerActive = true;
}

onAuthStateChanged(auth, (user) => {
    if (user) {
        startListening(user.uid);
    } else {
        hideCallDialog();
        isListenerActive = false;
        currentPatientId = null;
    }
});

export const CallListener = {
    hide: hideCallDialog
};
