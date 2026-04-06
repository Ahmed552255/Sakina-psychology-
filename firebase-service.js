// =================================================================
//  firebase-service.js
//  العقل المدبر لجميع عمليات Firebase في تطبيق "سُكُون"
//  التركيز: الخصوصية التامة عبر تسجيل الدخول المجهول
// =================================================================

// 1. استيراد الدوال الأساسية (تم إضافة signInAnonymously)
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { 
    getAuth, 
    signInAnonymously, // مضاف للخصوصية
    onAuthStateChanged, 
    signOut 
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";

import { 
    getFirestore, doc, setDoc, getDoc, collection, 
    addDoc, query, where, getDocs, onSnapshot 
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-storage.js";

// 2. إعدادات الاتصال (المفتاح الوهمي للمراجعة)
const firebaseConfig = {
    apiKey: "AIzaSyDFyJXl40OXWNYCP3QBOdOAS0H6nVbYvgg",
    authDomain: "sokon-cacea.firebaseapp.com",
    projectId: "sokon-cacea",
    storageBucket: "sokon-cacea.appspot.com",
    messagingSenderId: "491910937298",
    appId: "1:491910937298:web:7852543ae60b76763f8b0b",
    measurementId: "G-LV0WG8KD1L"
};

// 3. تهيئة الاتصال وتجهيز الخدمات
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// =================================================================
//  4. تصدير الخدمات والدوال لتكون متاحة في باقي الصفحات
// =================================================================

export { auth, db, storage };

// تصدير دوال المصادقة المحدثة
export {
    signInAnonymously,
    onAuthStateChanged,
    signOut
};

// تصدير دوال قاعدة البيانات
export {
    doc, setDoc, getDoc, collection, 
    addDoc, query, where, getDocs, onSnapshot
};

// تصدير دوال التخزين
export { ref, uploadBytes, getDownloadURL };

// =================================================================
//  5. الدوال المخصصة لتطبيق سُكُون (الخصوصية أولاً)
// =================================================================

/**
 * إنشاء حساب مجهول وحفظ بيانات الأمان للاستعادة لاحقاً
 * @param {string} securityQuestion - السؤال السري الذي يختاره المستخدم
 * @param {string} securityAnswer - إجابة السؤال السري
 */
export async function createAnonymousPatientAccount(securityQuestion = null, securityAnswer = null) {
    try {
        // الخطوة 1: تسجيل الدخول مجهول الهوية (بدون إيميل أو اسم)
        const userCredential = await signInAnonymously(auth);
        const user = userCredential.user;

        // الخطوة 2: إنشاء مستند في Firestore باستخدام الـ UID كمعرف وحيد
        // سيتم تخزين السؤال والإجابة فقط لاستخدامهما في حال فقدان المعرف
        await setDoc(doc(db, "users", user.uid), {
            uid: user.uid,
            role: "patient",
            securityQuestion: securityQuestion,
            // تخزين الإجابة بحروف صغيرة وبدون فراغات لزيادة دقة الاستعادة لاحقاً
            securityAnswer: securityAnswer ? securityAnswer.toLowerCase().trim() : null,
            createdAt: new Date()
        });

        console.log("حساب مجهول جاهز! المعرف السري هو:", user.uid);
        return user; 

    } catch (error) {
        console.error("حدث خطأ أثناء إنشاء الحساب المجهول:", error);
        throw error;
    }
}

/**
 * دالة لاسترجاع المعرف السري (UID) باستخدام السؤال والإجابة السرية
 */
export async function recoverAccount(question, answer) {
    try {
        const q = query(
            collection(db, "users"), 
            where("securityQuestion", "==", question),
            where("securityAnswer", "==", answer.toLowerCase().trim())
        );

        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
            // نأخذ أول نتيجة مطابقة
            const userData = querySnapshot.docs[0].data();
            return userData.uid; // نرجع الـ UID ليتمكن المستخدم من استخدامه
        } else {
            throw new Error("لم يتم العثور على حساب بهذه البيانات.");
        }
    } catch (error) {
        console.error("خطأ في استعادة الحساب:", error);
        throw error;
    }
}
