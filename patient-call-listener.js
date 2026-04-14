// patient-call-listener.js
// ضع هذا الملف في مجلد المشروع وأدرجه في صفحات المريض كالتالي:
// <script type="module" src="patient-call-listener.js"></script>

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, onValue, update } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// تكوين Firebase (نفس الإعدادات المستخدمة في باقي المشروع)
const firebaseConfig = {
    apiKey: "AIzaSyAx0wVqtIYHbFNgZ3_Wr6ViemAJ7BwMOkw",
    authDomain: "sakina-937c4.firebaseapp.com",
    databaseURL: "https://sakina-937c4-default-rtdb.firebaseio.com",
    projectId: "sakina-937c4",
    storageBucket: "sakina-937c4.firebasestorage.app",
    messagingSenderId: "25215790734",
    appId: "1:25215790734:web:46c5d893d5818530b3a3df"
};

// تهيئة Firebase (إذا لم تكن مهيأة مسبقًا في الصفحة)
let app;
try {
    app = initializeApp(firebaseConfig);
} catch (e) {
    // قد تكون Firebase مهيأة بالفعل، نستخدم الموجود
    console.log("Firebase already initialized, reusing existing app.");
}

const db = getDatabase(app);
const auth = getAuth();

// متغيرات داخلية
let currentPatientId = null;
let incomingCallDialog = null;
let currentCallId = null;
let currentCallData = null; // تخزين بيانات المكالمة الحالية
let ringtoneAudio = null;
let isListenerActive = false;

// إنشاء نافذة الإشعار (تُنشأ مرة واحدة فقط)
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
    
    // تعطيل الإغلاق بالنقر خارج الصندوق (يجب استخدام الأزرار فقط)
    dialog.addEventListener('click', (e) => {
        if (e.target === dialog) {
            // لا تفعل شيئًا – منع الإغلاق
        }
    });

    // ربط الأحداث
    document.getElementById('sakoonDeclineCallBtn').addEventListener('click', declineCall);
    document.getElementById('sakoonAcceptCallBtn').addEventListener('click', acceptCall);

    incomingCallDialog = dialog;
    dialog.style.display = 'none';
}

// دالة رفض المكالمة
async function declineCall() {
    if (currentCallId) {
        try {
            await update(ref(db, `calls/${currentCallId}`), { status: 'rejected' });
        } catch (e) {
            console.warn("فشل تحديث حالة الرفض:", e);
        }
    }
    hideCallDialog();
}

// دالة قبول المكالمة
function acceptCall() {
    if (!currentCallId || !currentPatientId || !currentCallData) return;
    
    // تحديث الحالة إلى answered
    update(ref(db, `calls/${currentCallId}`), { status: 'answered' });
    
    const doctorId = currentCallData.caller;
    const callType = currentCallData.type || 'audio';
    
    // الانتقال إلى صفحة المكالمة مع النوع الصحيح
    window.location.href = `call.html?type=${callType}&doctorId=${doctorId}&patientId=${currentPatientId}&role=callee`;
}

// إخفاء نافذة الإشعار وإيقاف الرنين
function hideCallDialog() {
    if (incomingCallDialog) {
        incomingCallDialog.style.display = 'none';
    }
    if (ringtoneAudio) {
        ringtoneAudio.pause();
        ringtoneAudio.currentTime = 0;
    }
    currentCallId = null;
    currentCallData = null;
}

// عرض نافذة الإشعار مع بيانات المتصل
async function showCallDialog(callData, callId) {
    createCallDialog();
    currentCallId = callId;
    currentCallData = callData; // تخزين البيانات لاستخدامها في الرد
    
    const doctorId = callData.caller;
    let callerName = doctorId; // افتراضيًا المعرف
    
    // محاولة جلب اسم الطبيب من قاعدة البيانات
    try {
        const { get } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js");
        const snap = await get(ref(db, `doctors/${doctorId}`));
        if (snap.exists()) {
            const data = snap.val();
            callerName = data.name || doctorId;
        }
    } catch (e) {
        console.warn("تعذر جلب اسم الطبيب:", e);
    }
    
    document.getElementById('sakoonCallerNameDisplay').textContent = callerName;
    document.getElementById('sakoonCallerInitial').textContent = callerName.charAt(0);
    
    incomingCallDialog.style.display = 'flex';
    
    // تشغيل صوت الرنين
    if (!ringtoneAudio) {
        ringtoneAudio = new Audio('https://cdn.pixabay.com/audio/2022/03/10/audio_6e1f3e0e2c.mp3');
        ringtoneAudio.loop = true;
    }
    ringtoneAudio.play().catch(e => console.warn('تعذر تشغيل الرنين:', e));
    
    // تحديث أيقونات Feather إذا كانت موجودة
    if (typeof feather !== 'undefined') feather.replace();
}

// بدء الاستماع للمكالمات الواردة
function startListening(patientId) {
    if (isListenerActive) return;
    currentPatientId = patientId;
    
    const callsRef = ref(db, 'calls');
    onValue(callsRef, (snapshot) => {
        const calls = snapshot.val();
        if (!calls) {
            // لا توجد مكالمات
            if (currentCallId) hideCallDialog();
            return;
        }
        
        // البحث عن مكالمة واردة حالية (status = ringing) والمستقبل هو المريض الحالي
        let foundCallId = null;
        let foundCallData = null;
        
        for (const id in calls) {
            const call = calls[id];
            if (call.callee === patientId && call.status === 'ringing') {
                foundCallId = id;
                foundCallData = call;
                break; // نأخذ أول مكالمة
            }
        }
        
        if (foundCallId) {
            // إذا وجدنا مكالمة نشطة ولم نعرضها بعد
            if (!currentCallId || currentCallId !== foundCallId) {
                showCallDialog(foundCallData, foundCallId);
            }
        } else {
            // إذا اختفت المكالمة (تم الرد أو الرفض) نغلق الإشعار
            if (currentCallId) {
                hideCallDialog();
            }
        }
    });
    
    isListenerActive = true;
}

// الانتظار حتى تسجيل الدخول
onAuthStateChanged(auth, (user) => {
    if (user) {
        // المريض مسجل الدخول
        startListening(user.uid);
    } else {
        // إذا خرج المستخدم، نوقف أي إشعار ظاهر
        if (currentCallId) hideCallDialog();
        isListenerActive = false;
        currentPatientId = null;
    }
});

// تصدير دوال للاستخدام الخارجي (اختياري)
export const CallListener = {
    hide: hideCallDialog
};
