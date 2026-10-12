# לוח המשפחה

אפליקציה משפחתית למשימות, תזכורות וקניות: בית, גן ובית ספר.

- **אנדרואיד:** אפליקציה (APK) שמופיעה בתפריט "שתף" של וואטסאפ ושל הגלריה. משתפים הודעה או צילום מסך, והמשימות נשלפות אוטומטית. יש גם תזכורות.
- **אייפון ומחשב:** אותה אפליקציה כאתר, בכתובת GitHub Pages של המאגר. באייפון: שיתוף ← "הוספה למסך הבית".
- הנתונים נשמרים ב-Firebase ומסתנכרנים בזמן אמת בין כל המכשירים.

## הורדה

הגרסה האחרונה לאנדרואיד: `https://github.com/<user>/<repo>/releases/latest/download/family-board.apk`

## הגדרה (פעם אחת)

1. **Firebase** (console.firebase.google.com): יוצרים פרויקט.
   - Firestore Database ← Create database (production mode) ← מדביקים בלשונית Rules את התוכן של `firestore.rules`.
   - AI Logic ← Get started ← Gemini Developer API (בחינם).
   - Project settings ← Add app ← Web ← מעתיקים את `firebaseConfig` אל `src/config.ts`.
2. **GitHub:** המאגר צריך להיות ציבורי כדי ש-GitHub Pages יעבוד בחינם. בהגדרות: Settings ← Pages ← Source: **GitHub Actions**.
3. כל שינוי שנשמר ב-main בונה מחדש את ה-APK ואת האתר (Actions ← Build app).

## מבנה

- `App.tsx`: מסך ראשי ולשוניות
- `src/screens/`: משימות, קניות, הוספה מהודעה או תמונה, הגדרות
- `src/ai.ts`: חילוץ משימות מטקסט ומתמונות (Gemini דרך Firebase AI Logic)
- `src/share.native.tsx`: קבלת שיתוף מאפליקציות אחרות (אנדרואיד)
- `src/notify.native.ts`: תזכורות מקומיות
