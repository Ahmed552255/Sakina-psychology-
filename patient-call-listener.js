// patient-call-listener.js - نسخة احترافية كاملة
// تم تطويرها لتكون متناسقة مع تصميم سُكُون وتدعم جميع الميزات الحديثة

// استيراد إعدادات Firebase من ملف خارجي (أكثر أماناً)
import { firebaseConfig } from './firebase-config.js';

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-app.js";
import { getDatabase, ref, onValue, update, get, onDisconnect } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-database.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-auth.js";

// تهيئة Firebase باستخدام الإعدادات المستوردة
let app;
try {
    app = initializeApp(firebaseConfig);
} catch (e) {
    console.log("[CallListener] Firebase already initialized.");
}
const db = getDatabase(app);
const auth = getAuth();

// ==================== مدير المكالمات الرئيسي ====================
class CallManager {
    constructor() {
        this.currentUserId = null;
        this.dialogElement = null;
        this.ringtoneAudio = null;
        this.isDialogVisible = false;
        this.currentCallId = null;
        this.currentCallData = null;
        this.unsubscribeCalls = null;
        this.ringtoneUrl = 'https://cdn.pixabay.com/audio/2022/03/10/audio_6e1f3e0e2c.mp3'; // نغمة رنين لطيفة
        this.isAudioInitialized = false;
    }

    // ========== تهيئة نافذة المكالمة (بتصميم موحد مع بقية التطبيق) ==========
    createDialog() {
        if (this.dialogElement) return;

        const dialog = document.createElement('div');
        dialog.id = 'sakoonCallDialog';
        dialog.setAttribute('role', 'dialog');
        dialog.setAttribute('aria-modal', 'true');
        dialog.setAttribute('aria-label', 'مكالمة واردة');
        
        // استخدام نفس متغيرات الألوان والتصميم الزجاجي
        dialog.style.cssText = `
            position: fixed;
            inset: 0;
            background: rgba(10, 30, 30, 0.7);
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
            z-index: 99999;
            display: none;
            align-items: center;
            justify-content: center;
            font-family: 'Cairo', -apple-system, sans-serif;
            direction: rtl;
            padding: 16px;
            animation: fadeIn 0.25s ease;
        `;

        // إضافة أنيميشن fadeIn
        const styleSheet = document.createElement('style');
        styleSheet.textContent = `
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            @keyframes slideUp {
                from { transform: translateY(20px); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }
            .call-dialog-card {
                animation: slideUp 0.3s cubic-bezier(0.2, 0, 0, 1);
            }
        `;
        document.head.appendChild(styleSheet);

        dialog.innerHTML = `
            <div class="call-dialog-card" style="
                background: var(--surface-solid, #ffffff);
                border-radius: 32px;
                padding: 2rem 1.8rem 1.8rem;
                max-width: 360px;
                width: 100%;
                text-align: center;
                box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
                border: 1.5px solid var(--primary-100, #cce7e7);
            ">
                <div style="
                    background: linear-gradient(145deg, var(--primary-600, #1f6f6f), var(--primary-500, #2a8888));
                    width: 88px;
                    height: 88px;
                    border-radius: 50%;
                    margin: 0 auto 1.5rem;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border: 4px solid var(--surface-solid, #fff);
                    box-shadow: 0 8px 20px rgba(42, 136, 136, 0.25);
                ">
                    <span id="callerInitial" style="
                        font-size: 2.8rem;
                        font-weight: 800;
                        color: white;
                        text-transform: uppercase;
                    ">د</span>
                </div>
                
                <h3 id="callerName" style="
                    font-size: 1.8rem;
                    font-weight: 800;
                    color: var(--text-primary, #1a2e2e);
                    margin-bottom: 0.5rem;
                    line-height: 1.2;
                ">د. أحمد</h3>
                
                <p style="
                    color: var(--text-secondary, #3d5a5a);
                    margin-bottom: 2rem;
                    font-size: 1rem;
                    font-weight: 500;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                ">
                    <span id="callTypeIcon" style="display: flex;">📞</span>
                    <span id="callTypeText">مكالمة صوتية واردة...</span>
                </p>
                
                <div style="display: flex; gap: 16px; justify-content: center;">
                    <button id="declineCallBtn" style="
                        background: #fef2f2;
                        border: 1.5px solid #fecaca;
                        color: #dc2626;
                        padding: 14px 0;
                        border-radius: 60px;
                        font-family: 'Cairo', sans-serif;
                        font-weight: 700;
                        font-size: 1.1rem;
                        cursor: pointer;
                        flex: 1;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        gap: 8px;
                        transition: all 0.2s;
                        box-shadow: 0 2px 4px rgba(0,0,0,0.05);
                    ">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="7" y1="7" x2="17" y2="17"></line>
                            <line x1="17" y1="7" x2="7" y2="17"></line>
                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.362 1.903.7 2.81a2 2 0 0 1-.45 2.11L8 10a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.574 2.81.7A2 2 0 0 1 22 16.92z"></path>
                        </svg>
                        رفض
                    </button>
                    <button id="acceptCallBtn" style="
                        background: linear-gradient(145deg, var(--primary-600, #1f6f6f), var(--primary-500, #2a8888));
                        border: none;
                        color: white;
                        padding: 14px 0;
                        border-radius: 60px;
                        font-family: 'Cairo', sans-serif;
                        font-weight: 700;
                        font-size: 1.1rem;
                        cursor: pointer;
                        flex: 1;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        gap: 8px;
                        box-shadow: 0 8px 18px rgba(42, 136, 136, 0.25);
                        transition: all 0.2s;
                        border: 1px solid rgba(255,255,255,0.2);
                    ">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.362 1.903.7 2.81a2 2 0 0 1-.45 2.11L8 10a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.574 2.81.7A2 2 0 0 1 22 16.92z"></path>
                        </svg>
                        رد
                    </button>
                </div>
                
                <div id="manualLinkContainer" style="
                    margin-top: 20px;
                    display: none;
                    padding-top: 16px;
                    border-top: 1px dashed var(--primary-100, #cce7e7);
                ">
                    <a id="manualJoinLink" href="#" style="
                        color: var(--primary-500, #2a8888);
                        text-decoration: none;
                        font-weight: 600;
                        font-size: 0.95rem;
                        display: inline-flex;
                        align-items: center;
                        gap: 6px;
                    ">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                            <polyline points="15 3 21 3 21 9"></polyline>
                            <line x1="10" y1="14" x2="21" y2="3"></line>
                        </svg>
                        انقر هنا للانضمام يدوياً
                    </a>
                </div>
            </div>
        `;

        document.body.appendChild(dialog);
        this.dialogElement = dialog;

        // إضافة مستمعي الأحداث
        dialog.querySelector('#declineCallBtn').addEventListener('click', () => this.declineCall());
        dialog.querySelector('#acceptCallBtn').addEventListener('click', () => this.acceptCall());
        
        // منع إغلاق النافذة عند النقر على الخلفية (نريد إجبار المستخدم على الرد أو الرفض)
        dialog.addEventListener('click', (e) => {
            if (e.target === dialog) {
                // يمكن تفعيل الرفض بالنقر خارج البطاقة (اختياري)
                // this.declineCall();
            }
        });

        // تطبيق متغيرات CSS من الصفحة الرئيسية إن وجدت
        this.syncThemeWithPage();
    }

    syncThemeWithPage() {
        // محاولة مزامنة ألوان النافذة مع وضع الصفحة (داكن/فاتح)
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const card = this.dialogElement?.querySelector('.call-dialog-card');
        if (card) {
            if (isDark) {
                card.style.background = '#142424';
                card.style.borderColor = '#2a8888';
                this.dialogElement.querySelector('#callerName').style.color = '#e3f0f0';
            }
        }
    }

    // ========== تهيئة الصوت ==========
    initAudio() {
        if (this.isAudioInitialized) return;
        this.ringtoneAudio = new Audio(this.ringtoneUrl);
        this.ringtoneAudio.loop = true;
        this.ringtoneAudio.volume = 0.5; // صوت مريح
        this.isAudioInitialized = true;
    }

    async playRingtone() {
        if (!this.ringtoneAudio) this.initAudio();
        try {
            await this.ringtoneAudio.play();
        } catch (e) {
            console.warn('[CallListener] تشغيل الرنين تلقائياً فشل، في انتظار تفاعل المستخدم.');
            // انتظار أول لمسة من المستخدم لتشغيل الصوت
            const playOnUserGesture = async () => {
                try {
                    await this.ringtoneAudio.play();
                } catch (err) {}
                ['click', 'touchstart', 'keydown'].forEach(ev => 
                    document.removeEventListener(ev, playOnUserGesture)
                );
            };
            ['click', 'touchstart', 'keydown'].forEach(ev => 
                document.addEventListener(ev, playOnUserGesture, { once: true })
            );
        }
    }

    stopRingtone() {
        if (this.ringtoneAudio) {
            this.ringtoneAudio.pause();
            this.ringtoneAudio.currentTime = 0;
        }
    }

    // ========== عرض نافذة المكالمة ==========
    async showDialog(callData, callId) {
        this.createDialog();
        
        // إذا كانت النافذة معروضة لنفس المكالمة، لا نفعل شيئاً
        if (this.isDialogVisible && this.currentCallId === callId) return;

        const doctorId = callData.caller;
        let callerName = 'طبيب';
        let callerInitial = 'ط';
        
        try {
            const snap = await get(ref(db, `doctors/${doctorId}`));
            if (snap.exists()) {
                const data = snap.val();
                callerName = data.name || 'طبيب';
                callerInitial = callerName.charAt(0);
            }
        } catch (e) {
            console.warn('[CallListener] تعذر جلب اسم الطبيب:', e);
        }

        // تحديث محتوى النافذة
        const nameEl = this.dialogElement.querySelector('#callerName');
        const initialEl = this.dialogElement.querySelector('#callerInitial');
        const typeIcon = this.dialogElement.querySelector('#callTypeIcon');
        const typeText = this.dialogElement.querySelector('#callTypeText');
        
        nameEl.textContent = callerName;
        initialEl.textContent = callerInitial;
        
        const isVideo = callData.type === 'video';
        typeIcon.innerHTML = isVideo ? '🎥' : '📞';
        typeText.textContent = isVideo ? 'مكالمة فيديو واردة...' : 'مكالمة صوتية واردة...';

        // تخزين بيانات المكالمة في الأزرار
        const acceptBtn = this.dialogElement.querySelector('#acceptCallBtn');
        const declineBtn = this.dialogElement.querySelector('#declineCallBtn');
        acceptBtn.dataset.callId = callId;
        acceptBtn.dataset.callData = JSON.stringify(callData);
        declineBtn.dataset.callId = callId;

        // إظهار النافذة
        this.dialogElement.style.display = 'flex';
        this.isDialogVisible = true;
        this.currentCallId = callId;
        this.currentCallData = callData;

        // تشغيل الرنين
        this.playRingtone();

        // مزامنة المظهر
        this.syncThemeWithPage();
    }

    // ========== إخفاء النافذة ==========
    hideDialog(resetState = true) {
        if (this.dialogElement) {
            this.dialogElement.style.display = 'none';
            this.isDialogVisible = false;
            
            // إخفاء الرابط الاحتياطي
            const linkContainer = this.dialogElement.querySelector('#manualLinkContainer');
            if (linkContainer) linkContainer.style.display = 'none';
        }
        this.stopRingtone();
        if (resetState) {
            this.currentCallId = null;
            this.currentCallData = null;
        }
    }

    // ========== رفض المكالمة ==========
    async declineCall() {
        const callId = this.currentCallId;
        if (callId) {
            try {
                await update(ref(db, `calls/${callId}`), { 
                    status: 'rejected',
                    endTime: Date.now()
                });
                // إرسال حدث للمحادثة
                this.dispatchCallEvent('missed', this.currentCallData);
            } catch (e) {
                console.error('[CallListener] فشل تحديث حالة المكالمة إلى مرفوضة:', e);
            }
        }
        this.hideDialog();
    }

    // ========== قبول المكالمة ==========
    async acceptCall() {
        const callId = this.currentCallId;
        const callData = this.currentCallData;
        
        if (!callId || !callData) {
            alert('بيانات المكالمة غير مكتملة.');
            return;
        }

        // التحقق من أن المكالمة ما زالت قيد الرنين
        try {
            const snap = await get(ref(db, `calls/${callId}`));
            if (!snap.exists()) {
                alert('انتهت المكالمة.');
                this.hideDialog();
                return;
            }
            const currentStatus = snap.val().status;
            if (currentStatus !== 'ringing') {
                alert('تم الرد على المكالمة بالفعل.');
                this.hideDialog();
                return;
            }
        } catch (e) {
            console.error('[CallListener] فشل التحقق من حالة المكالمة:', e);
        }

        // تجهيز رابط المكالمة
        const doctorId = callData.caller;
        const callType = callData.type || 'audio';
        const url = `call.html?type=${callType}&doctorId=${encodeURIComponent(doctorId)}&patientId=${encodeURIComponent(this.currentUserId)}&role=callee&callId=${encodeURIComponent(callId)}`;
        
        // إظهار الرابط الاحتياطي
        const linkContainer = this.dialogElement.querySelector('#manualLinkContainer');
        const manualLink = this.dialogElement.querySelector('#manualJoinLink');
        if (linkContainer) linkContainer.style.display = 'block';
        if (manualLink) manualLink.href = url;

        // محاولة الانتقال التلقائي
        try {
            window.location.assign(url);
        } catch (e) {
            console.warn('[CallListener] فشل الانتقال التلقائي:', e);
        }

        // إخفاء أزرار الرد والرفض لتظهر واجهة "جاري الاتصال"
        const btnContainer = this.dialogElement.querySelector('[style*="display: flex; gap: 16px;"]');
        const statusP = this.dialogElement.querySelector('p');
        if (btnContainer) btnContainer.style.display = 'none';
        if (statusP) statusP.style.display = 'none';
        
        const nameEl = this.dialogElement.querySelector('#callerName');
        nameEl.textContent = 'جاري الاتصال...';
        
        // إبقاء النافذة ظاهرة مع الرابط الاحتياطي
        this.stopRingtone();
        
        // إرسال حدث للمحادثة (سيتم تسجيله لاحقاً عند انتهاء المكالمة الفعلي)
        // نكتفي الآن بتسجيل البدء
    }

    // ========== إرسال حدث مخصص لصفحة المحادثة ==========
    dispatchCallEvent(status, callData) {
        if (!callData) return;
        const event = new CustomEvent('callEvent', {
            detail: {
                type: callData.type || 'audio',
                status: status, // 'answered' أو 'missed'
                duration: callData.duration || 0,
                timestamp: Date.now()
            }
        });
        window.dispatchEvent(event);
    }

    // ========== بدء الاستماع للمكالمات ==========
    startListening(patientId) {
        if (this.unsubscribeCalls) {
            // مستمع نشط بالفعل
            return;
        }
        this.currentUserId = patientId;
        
        const callsRef = ref(db, 'calls');
        this.unsubscribeCalls = onValue(callsRef, (snapshot) => {
            const calls = snapshot.val();
            if (!calls) {
                this.hideDialog();
                return;
            }
            
            let foundCallId = null;
            let foundCallData = null;
            
            for (const id in calls) {
                const call = calls[id];
                // ابحث عن مكالمة موجهة لهذا المريض وحالتها "رنين"
                if (call.callee === patientId && call.status === 'ringing') {
                    foundCallId = id;
                    foundCallData = call;
                    break;
                }
            }
            
            if (foundCallId) {
                // إذا كانت النافذة معروضة لنفس المكالمة، لا شيء
                if (this.currentCallId === foundCallId && this.isDialogVisible) {
                    return;
                }
                this.showDialog(foundCallData, foundCallId);
            } else {
                this.hideDialog();
            }
        }, (error) => {
            console.error('[CallListener] خطأ في الاستماع:', error);
        });
    }

    // ========== إيقاف الاستماع ==========
    stopListening() {
        if (this.unsubscribeCalls) {
            this.unsubscribeCalls();
            this.unsubscribeCalls = null;
        }
        this.hideDialog();
    }

    // ========== تنظيف كامل ==========
    destroy() {
        this.stopListening();
        this.stopRingtone();
        if (this.dialogElement) {
            this.dialogElement.remove();
            this.dialogElement = null;
        }
    }
}

// ==================== تهيئة المدير والربط مع المصادقة ====================
const callManager = new CallManager();

onAuthStateChanged(auth, (user) => {
    if (user) {
        console.log('[CallListener] مستخدم مسجل الدخول، بدء الاستماع...');
        callManager.startListening(user.uid);
        
        // عند انقطاع الاتصال، نحرص على ألا تبقى حالة المكالمة معلقة
        onDisconnect(ref(db, '.info/connected')).then(() => {
            // يمكن إضافة منطق لتنظيف المكالمات المعلقة إذا لزم الأمر
        });
    } else {
        console.log('[CallListener] لم يسجل الدخول، إيقاف الاستماع.');
        callManager.stopListening();
    }
});

// تنظيف عند إغلاق الصفحة (اختياري)
window.addEventListener('beforeunload', () => {
    callManager.destroy();
});

// تصدير واجهة عامة للتحكم (إذا احتاجت صفحات أخرى)
export const CallListener = {
    hide: () => callManager.hideDialog(),
    show: (data, id) => callManager.showDialog(data, id)
};

// للتوافق مع الإصدارات السابقة، نضبط المتغير العام القديم (اختياري)
window.CallListener = CallListener;
