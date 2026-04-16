/**
 * ============================================================
 * سُكُون - إعدادات Firebase المركزية
 * ============================================================
 * 
 * هذا الملف يحتوي على إعدادات الاتصال بقاعدة بيانات Firebase.
 * يتم استيراده في جميع صفحات التطبيق لضمان الاتساق وسهولة الصيانة.
 * 
 * @version 1.0.0
 * @lastUpdate 2026-04-15
 * @author Sakoon Team
 * 
 * ملاحظات هامة:
 * - لا تقم بمشاركة هذا الملف علنًا إذا كان يحتوي على مفاتيح حقيقية.
 * - في بيئة الإنتاج، استخدم متغيرات بيئة (Environment Variables) إن أمكن.
 * - تم إعداد قاعدتي بيانات: Realtime Database للمحادثات و Firestore اختياري.
 */

// ==================== بيئة التشغيل ====================
// يمكن تغييرها يدويًا أو ربطها بمتغير بيئة أثناء البناء
const ENV = {
    DEVELOPMENT: 'development',
    PRODUCTION: 'production'
};

// اختر البيئة المناسبة (يمكن تعديلها حسب مرحلة النشر)
const CURRENT_ENV = ENV.DEVELOPMENT; // قم بتغييرها إلى PRODUCTION عند النشر النهائي

// ==================== إعدادات Firebase للمشروع ====================

/**
 * إعدادات بيئة التطوير (Development)
 * تستخدم قاعدة بيانات منفصلة للاختبار
 */
const devConfig = {
    apiKey: "AIzaSyAx0wVqtIYHbFNgZ3_Wr6ViemAJ7BwMOkw",
    authDomain: "sakina-937c4.firebaseapp.com",
    databaseURL: "https://sakina-937c4-default-rtdb.firebaseio.com",
    projectId: "sakina-937c4",
    storageBucket: "sakina-937c4.firebasestorage.app",
    messagingSenderId: "25215790734",
    appId: "1:25215790734:web:46c5d893d5818530b3a3df",
    measurementId: null // اختياري لـ Google Analytics
};

/**
 * إعدادات بيئة الإنتاج (Production)
 * في حال كان لديك مشروع Firebase منفصل للنشر الفعلي
 */
const prodConfig = {
    // عند الانتقال للإنتاج الفعلي، قم بتحديث هذه القيم بمشروع Firebase المخصص للإنتاج
    apiKey: "AIzaSyAx0wVqtIYHbFNgZ3_Wr6ViemAJ7BwMOkw", // استبدلها بمفتاح الإنتاج
    authDomain: "sakina-937c4.firebaseapp.com",
    databaseURL: "https://sakina-937c4-default-rtdb.firebaseio.com",
    projectId: "sakina-937c4",
    storageBucket: "sakina-937c4.firebasestorage.app",
    messagingSenderId: "25215790734",
    appId: "1:25215790734:web:46c5d893d5818530b3a3df",
    measurementId: null
};

// ==================== اختيار الإعدادات النشطة ====================
const activeConfig = (CURRENT_ENV === ENV.PRODUCTION) ? prodConfig : devConfig;

/**
 * كائن الإعدادات الرئيسي الذي يتم تصديره واستخدامه في التطبيق
 * @type {Object}
 */
export const firebaseConfig = {
    ...activeConfig,
    
    // إعدادات إضافية مخصصة للتطبيق
    appName: 'سُكُون',
    version: '1.0.0',
    
    // إعدادات Realtime Database (للمحادثات الفورية)
    database: {
        paths: {
            doctors: 'doctors',
            conversations: 'conversations',
            patients: 'patients',
            appointments: 'appointments'
        }
    },
    
    // إعدادات المصادقة
    auth: {
        providers: ['password', 'google'], // مزودي المصادقة المدعومين
        persistence: 'local' // تخزين جلسة المستخدم محليًا
    }
};

// ==================== دوال مساعدة ====================

/**
 * التحقق من صحة الإعدادات
 * @returns {boolean} true إذا كانت الإعدادات مكتملة
 */
export function validateConfig() {
    const requiredFields = ['apiKey', 'authDomain', 'databaseURL', 'projectId'];
    const missingFields = requiredFields.filter(field => !firebaseConfig[field]);
    
    if (missingFields.length > 0) {
        console.error('⚠️ إعدادات Firebase ناقصة:', missingFields.join(', '));
        return false;
    }
    
    if (firebaseConfig.apiKey === 'YOUR_API_KEY') {
        console.warn('⚠️ أنت تستخدم مفتاح API وهمي. قم بتحديثه في firebase-config.js');
        return false;
    }
    
    return true;
}

/**
 * الحصول على رابط قاعدة البيانات مع مسار محدد
 * @param {string} path - المسار المراد الوصول إليه
 * @returns {string} الرابط الكامل
 */
export function getDatabasePath(path = '') {
    const base = firebaseConfig.databaseURL;
    return path ? `${base}/${path}` : base;
}

/**
 * عرض معلومات الاتصال في وضع التطوير فقط
 */
export function logConfigInfo() {
    if (CURRENT_ENV === ENV.DEVELOPMENT) {
        console.log(`🔥 Firebase initialized [${CURRENT_ENV}]`);
        console.log(`📁 Project: ${firebaseConfig.projectId}`);
        console.log(`🌐 Database: ${firebaseConfig.databaseURL}`);
    }
}

// ==================== تصدير إضافي ====================
export { ENV, CURRENT_ENV };

// تنفيذ التحقق التلقائي عند استيراد الملف (في وضع التطوير)
if (CURRENT_ENV === ENV.DEVELOPMENT) {
    validateConfig();
    logConfigInfo();
}
