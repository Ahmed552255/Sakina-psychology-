// =================================================================
//  firebase-service.js
//  العقل المدبر لجميع عمليات Firebase في تطبيق "سُكُون"
// =================================================================

// 1. استيراد الدوال الأساسية من مكتبات Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, addDoc, query, where, getDocs, onSnapshot } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-storage.js";

// 2. إعدادات الاتصال الخاصة بمشروعك (من حساب Firebase الخاص بك )
const firebaseConfig = {
    apiKey: "AIzaSyDFyJXl40OXWNYCP3QBOdOAS0H6nVbYvgg",
    authDomain: "sokon-cacea.firebaseapp.com",
    projectId: "sokon-cacea",
    storageBucket: "sokon-cacea.appspot.com", // تم تصحيح الامتداد هنا
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

// تصدير الخدمات الأساسية
export { auth, db, storage };

// تصدير دوال المصادقة المساعدة
export {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    onAuthStateChanged,
    signOut
};

// تصدير دوال قاعدة البيانات المساعدة
export {
    doc,
    setDoc,
    getDoc,
    collection,
    addDoc,
    query,
    where,
    getDocs,
    onSnapshot
};

// تصدير دوال التخزين المساعدة
export {
    ref,
    uploadBytes,
    getDownloadURL
};


// مثال لدالة مخصصة تجمع عدة عمليات
/**
 * دالة لإنشاء حساب مستخدم جديد (مريض) وتخزين بياناته في Firestore
 * @param {string} email - البريد الإلكتروني للمستخدم
 * @param {string} password - كلمة المرور
 * @param {string} displayName - الاسم الذي سيظهر للمستخدم
 * @returns {Promise<UserCredential>}
 */
export async function createPatientAccount(email, password, displayName) {
    try {
        // الخطوة 1: إنشاء المستخدم في نظام المصادقة
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // الخطوة 2: إنشاء مستند لهذا المستخدم في قاعدة البيانات (Firestore)
        // سنخزن بيانات إضافية مثل الاسم ونوع الحساب (مريض)
        await setDoc(doc(db, "users", user.uid), {
            uid: user.uid,
            email: user.email,
            displayName: displayName,
            role: "patient", // تحديد دور المستخدم
            createdAt: new Date() // تاريخ إنشاء الحساب
        });

        console.log("User created and data stored in Firestore:", user.uid);
        return userCredential;

    } catch (error) {
        console.error("Error creating user account:", error);
        // يمكنك هنا التعامل مع الأخطاء، مثل عرض رسالة للمستخدم
        throw error; // إعادة رمي الخطأ لمعالجته في الواجهة
    }
}
