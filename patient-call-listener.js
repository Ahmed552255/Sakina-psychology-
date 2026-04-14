// patient-call-listener.js - نسخة محسّنة ومتوافقة مع call.html الجديد
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
let manualLink = null;
let currentCallId = null;
let dialogVisible = false;

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
            <div id="sakoonManualLinkContainer" style="margin-top: 1.5rem; display: none;">
                <a id="sakoonManualLink" href="#" style="color: #98D8D8; text-decoration: underline; font-size: 0.9rem;">إذا لم تفتح المكالمة، اضغط هنا</a>
            </div>
        </div>
    `;
    document.body.appendChild(dialog);
    
    dialog.addEventListener('click', (e) => {
        if (e.target === dialog) { /* منع الإغلاق */ }
    });

    document.getElementById('sakoonDeclineCallBtn').addEventListener('click', declineCall);
    document.getElementById('sakoonAcceptCallBtn').addEventListener('click', acceptCall);

    incomingCallDialog = dialog;
    manualLink = document.getElementById('sakoonManualLink');
    dialog.style.display = 'none';
}

async function declineCall() {
    const declineBtn = document.getElementById('sakoonDeclineCallBtn');
    const callId = declineBtn.dataset.callId;
    if (callId) {
        try {
            await update(ref(db, `calls/${callId}`), { status: 'rejected' });
        } catch (e) {
            console.error('فشل تحديث حالة المكالمة إلى مرفوضة:', e);
        }
    }
    hideCallDialog();
}

async function acceptCall() {
    const acceptBtn = document.getElementById('sakoonAcceptCallBtn');
    const callId = acceptBtn.dataset.callId;
    const callDataStr = acceptBtn.dataset.callData;
    
    console.log('[acceptCall] callId:', callId);
    
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

    // التحقق من أن المكالمة لا تزال قيد الرنين
    try {
        const snap = await get(ref(db, `calls/${callId}`));
        if (!snap.exists()) {
            alert('المكالمة لم تعد موجودة.');
            hideCallDialog();
            return;
        }
        const currentStatus = snap.val().status;
        if (currentStatus !== 'ringing') {
            alert('تم الرد على المكالمة بالفعل أو تم إلغاؤها.');
            hideCallDialog();
            return;
        }
    } catch (e) {
        console.error('فشل التحقق من حالة المكالمة:', e);
    }
    
    const doctorId = callData.caller;
    const callType = callData.type || 'audio';
    const url = `call.html?type=${callType}&doctorId=${encodeURIComponent(doctorId)}&patientId=${encodeURIComponent(currentPatientId)}&role=callee&callId=${encodeURIComponent(callId)}`;
    
    console.log('[acceptCall] الانتقال إلى:', url);
    
    // إظهار الرابط الاحتياطي
    const container = document.getElementById('sakoonManualLinkContainer');
    if (container) container.style.display = 'block';
    if (manualLink) {
        manualLink.href = url;
        manualLink.textContent = 'إذا لم تفتح المكالمة تلقائيًا، اضغط هنا';
    }
    
    // محاولة الانتقال التلقائي
    try {
        window.location.assign(url);
    } catch (e) {
        console.warn('فشل window.location.assign:', e);
    }
    
    // إخفاء النافذة بعد قليل مع إبقاء الرابط الاحتياطي ظاهراً
    setTimeout(() => {
        // لا نستخدم hideCallDialog بالكامل حتى لا نخفي الرابط الاحتياطي
        if (incomingCallDialog) {
            // نخفي فقط خلفية الحوار ونترك المحتوى مع الرابط
            const innerDiv = incomingCallDialog.querySelector('div');
            if (innerDiv) {
                // يمكننا تقليص الحوار إلى حجم أصغر يظهر فيه الرابط فقط
                innerDiv.style.padding = '1rem';
                // إخفاء عناصر الرد والرفض
                document.querySelector('[style*="display: flex; gap: 1rem; justify-content: center;"]').style.display = 'none';
                document.querySelector('p').style.display = 'none';
                // تغيير العنوان
                document.getElementById('sakoonCallerNameDisplay').textContent = 'جاري الاتصال...';
            }
            // لا نغير display: flex حتى يبقى الرابط ظاهرًا
        }
        if (ringtoneAudio) {
            ringtoneAudio.pause();
            ringtoneAudio.currentTime = 0;
        }
    }, 1000);
}

function hideCallDialog() {
    if (incomingCallDialog) {
        incomingCallDialog.style.display = 'none';
        dialogVisible = false;
    }
    if (ringtoneAudio) {
        ringtoneAudio.pause();
        ringtoneAudio.currentTime = 0;
    }
    const container = document.getElementById('sakoonManualLinkContainer');
    if (container) container.style.display = 'none';
    // إعادة تعيين حالة الأزرار
    const innerDiv = incomingCallDialog?.querySelector('div');
    if (innerDiv) {
        innerDiv.style.padding = '2rem 2rem 1.8rem';
        const btnContainer = document.querySelector('[style*="display: flex; gap: 1rem; justify-content: center;"]');
        if (btnContainer) btnContainer.style.display = 'flex';
        const statusP = incomingCallDialog.querySelector('p');
        if (statusP) statusP.style.display = 'block';
    }
    currentCallId = null;
}

async function showCallDialog(callData, callId) {
    createCallDialog();
    
    // إذا كان مربع الحوار معروضاً بالفعل لنفس المكالمة، لا نفعل شيئاً
    if (dialogVisible && currentCallId === callId) return;
    
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
    
    const acceptBtn = document.getElementById('sakoonAcceptCallBtn');
    const declineBtn = document.getElementById('sakoonDeclineCallBtn');
    acceptBtn.dataset.callId = callId;
    acceptBtn.dataset.callData = JSON.stringify(callData);
    declineBtn.dataset.callId = callId;
    
    incomingCallDialog.style.display = 'flex';
    dialogVisible = true;
    currentCallId = callId;
    
    // تشغيل نغمة الرنين مع التعامل مع سياسة التشغيل التلقائي
    if (!ringtoneAudio) {
        ringtoneAudio = new Audio('https://cdn.pixabay.com/audio/2022/03/10/audio_6e1f3e0e2c.mp3');
        ringtoneAudio.loop = true;
    }
    ringtoneAudio.play().catch(e => {
        console.warn('تعذر تشغيل نغمة الرنين تلقائياً. انتظار تفاعل المستخدم.');
        const playOnInteraction = () => {
            if (ringtoneAudio && incomingCallDialog && incomingCallDialog.style.display === 'flex') {
                ringtoneAudio.play().catch(() => {});
            }
            document.removeEventListener('click', playOnInteraction);
            document.removeEventListener('touchstart', playOnInteraction);
        };
        document.addEventListener('click', playOnInteraction);
        document.addEventListener('touchstart', playOnInteraction);
    });
    
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
            // إذا كان مربع الحوار معروضاً لنفس المكالمة، لا نعيد إنشائه
            if (currentCallId === foundCallId && dialogVisible) {
                return;
            }
            showCallDialog(foundCallData, foundCallId);
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
