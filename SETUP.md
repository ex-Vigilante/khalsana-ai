# إعداد خلّصانة للاستخدام الحقيقي | Setting up Khalsana for real use

[العربي](#العربي) | [English](#english)

---

## العربي

الدليل ده معمول لبياع مش تقني. هتحتاج حوالي ساعة، وكله بالمجان على الباقات المجانية. كل متجر ليه نسخة خاصة منه (مشروع Vercel واحد لكل متجر).

> من غير الخطوات دي، التطبيق بيشتغل كتجربة مفتوحة بس (بيانات تجريبية في المتصفح). الخطوات دي بتفعّل الشغل الحقيقي.

### أ) قاعدة البيانات والدخول (Supabase)

1. اعمل حساب مجاني على https://supabase.com واضغط **New project**. اختار اسم وكلمة سر لقاعدة البيانات (احتفظ بيها) وأقرب منطقة ليك.
2. من القايمة الشمال افتح **SQL Editor** ثم **New query**. افتح ملف `supabase/schema.sql` من المشروع، انسخ كل محتواه والصقه واضغط **Run**. تقدر تشغّله أكتر من مرة بأمان.
3. ضيف نفسك كأول مالك. في **SQL Editor** شغّل السطر ده (غيّر الإيميل بإيميلك بحروف صغيرة):

   ```sql
   insert into team_members (email, role)
   values ('you@example.com', 'owner');
   ```

   لإضافة موظف: نفس السطر بس بـ `'staff'` بدل `'owner'`.
4. اعمل حسابك للدخول: **Authentication → Users → Add user → Create new user**. اكتب نفس الإيميل وباسورد قوي، وفعّل **Auto Confirm User**. كرر ده لكل موظف. مفيش تسجيل جديد من التطبيق نفسه: صاحب المتجر بس هو اللي يعمل الحسابات.
5. **مهم للأمان:** افتح **Authentication → Sign In / Providers** (أو **Providers → Email**) وطفّي **Allow new users to sign up**، وسيب **Confirm email** شغّال. من غير كده أي حد غريب يقدر يسجّل حساب عندك. (لو عملت حساب من **Add user** فعّل **Auto Confirm User** عشان الإيميل يبقى مؤكد، لأن الحساب غير المؤكد مش بيدخل.)
6. من **Project Settings → API** انسخ التلاتة دول:
   - **Project URL**
   - **anon public key**
   - **service_role key** (سري جداً: ماتبعتهوش لحد وماتحطهوش في الكود أو في Git).

### ب) النشر على Vercel

1. في مشروعك على Vercel: **Settings → Environment Variables**، وضيف:

   | الاسم | القيمة |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | الـ Project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | الـ anon key |
   | `SUPABASE_SERVICE_ROLE_KEY` | الـ service_role key |
   | `GROQ_API_KEY` | مفتاح Groq المجاني (اختياري، من https://console.groq.com) |
   | `WHATSAPP_VERIFY_TOKEN` | أي كلمة سر طويلة من اختيارك (هتحطها في Meta كمان) |
   | `WHATSAPP_APP_SECRET` | من Meta (الخطوة ج) |
   | `WHATSAPP_TOKEN` | توكن Meta الدايم (الخطوة ج) |
   | `WHATSAPP_PHONE_NUMBER_ID` | الـ Phone number ID من Meta |
   | `AUTO_EXTRACT` | `true` لو عايز الأوردر يتستخرج لوحده من كل رسالة واتساب جديدة (اختياري) |

   كل المتغيرات مشروحة في ملف `.env.example`.
2. بعد ما تحط أو تغيّر أي متغير لازم **Redeploy**: **Deployments → اختار آخر Deployment → القايمة (⋯) → Redeploy**. من غير كده المتغيرات الجديدة ماتشتغلش.
3. افتح الموقع واضغط **دخول فريق المتجر** وادخل بحسابك. لو دخلت بحساب مش مضاف في `team_members` هتشوف صفحة «حسابك مش ضمن فريق المتجر».

**مين يعمل إيه؟**

| | مالك (owner) | موظف (staff) |
|---|---|---|
| يشوف الرسايل والأوردرات والأرقام والإعدادات | نعم | نعم |
| يضيف رسالة جديدة، يستخرج، يضيف أوردر، ينقله بين المراحل، يرد | نعم | نعم |
| يعدّل الإعدادات (المنتجات والشحن) | نعم | لا |
| يمسح أوردر أو رسالة | نعم | لا |
| يضيف أو يشيل أعضاء الفريق | من SQL Editor | لا |

وده متطبّق في قاعدة البيانات نفسها، مش بس في الشاشة.

بعد كده تقدر تشتغل فوراً: من شاشة **الرسايل** اضغط «رسالة جديدة» والصق أي رسالة زبون، حتى من غير واتساب.

### ج) ربط واتساب (Meta WhatsApp Cloud API)

1. ادخل https://developers.facebook.com بحساب فيسبوك، واضغط **Create App**، واختار نوع **Business**.
2. من لوحة التطبيق ضيف المنتج **WhatsApp** (Set up). Meta بتديك **رقم تجريبي** وبتسمحلك تبعت لعدد محدود من الأرقام بتضيفها بنفسك (Recipient phone numbers). ده كفاية للتجربة.
3. انسخ **Phone number ID** من صفحة **API Setup** وحطه في `WHATSAPP_PHONE_NUMBER_ID`.
4. **App Secret**: من **App settings → Basic → App secret → Show**. حطه في `WHATSAPP_APP_SECRET`.
5. **توكن دايم** (التوكن المؤقت بيخلص بعد 24 ساعة):
   - ادخل https://business.facebook.com/settings → **Users → System users → Add**، اعمل System User بصلاحية Admin.
   - **Add assets** واختار التطبيق بتاعك بتحكم كامل.
   - **Generate new token**، اختار التطبيق، وفعّل `whatsapp_business_messaging` و`whatsapp_business_management`، واختار مدة **Never**. انسخ التوكن وحطه في `WHATSAPP_TOKEN`.
6. اعمل **Redeploy** على Vercel بعد ما تحط المتغيرات (**Deployments → ⋯ → Redeploy**).
7. في Meta: **WhatsApp → Configuration → Webhook → Edit**:
   - **Callback URL**: `https://<دومين-موقعك>/api/webhooks/whatsapp` (الرابط ده بيظهر جاهز في خلّصانة: **الإعدادات → الربط**).
   - **Verify token**: نفس قيمة `WHATSAPP_VERIFY_TOKEN`.
   - اضغط **Verify and save**.
   - في **Webhook fields** اضغط **Subscribe** جنب **messages**.
8. للرقم الحقيقي (مش التجريبي): ضيف رقمك من **API Setup → Add phone number** وكمّل التحقق. الرقم ماينفعش يكون شغال على تطبيق واتساب العادي في نفس الوقت.

### د) اختبار من أول لآخر

1. افتح **الإعدادات → الربط** في خلّصانة. لازم تشوف ✓ جنب: قاعدة البيانات، استقبال واتساب، الرد من واتساب، والذكاء الاصطناعي (اللي ضفته).
2. من موبايلك ابعت رسالة للرقم التجريبي (لازم موبايلك يكون في قايمة الأرقام المسموحة في Meta). مثال: «عايزة طقم اسود مقاس L، العنوان مدينة نصر، رقمي 01012345678».
3. استنى حوالي ١٥ ثانية في شاشة **الرسايل** لحد ما الرسالة تظهر. اضغط عليها، ثم **استخرج الأوردر**، راجع، وضيفه للأوردرات.
4. اكتب الرد واضغط **ابعت على واتساب**. الرد لازم يوصل موبايلك.
5. افتح **الأوردرات**: اتأكد إن الأوردر موجود، حرّكه بين المراحل، واطبع الليبل أو صدّر CSV.

لو الرسالة ماظهرتش: راجع في Meta إن الـ webhook اتحفظ واشتركت في `messages`، وراجع **Logs** في Vercel. وفي Meta تقدر تعيد إرسال أي حدث.

**ملاحظات مهمة:**
- واتساب بيسمح بالرد النصي الحر خلال **٢٤ ساعة** من آخر رسالة من الزبون. بعد كده الرسالة هتترفض، وخلّصانة هتقولك تفتح المحادثة في واتساب وترد يدوي.
- ماسنجر وإنستجرام لسه بالنسخ واللصق (زر «رسالة جديدة»).
- الرسايل الصوتية والصور بتظهر كعلامة مكتوبة ([رسالة صوتية] / [صورة]) من غير تفريغ.

### هـ) التكلفة والحدود

- **Supabase** و**Vercel** و**Groq**: كلهم ليهم باقات مجانية كفاية لمتجر صغير، لكن لها حدود استخدام (مساحة قاعدة بيانات، عدد طلبات، وقت تشغيل، وإيقاف المشروع المجاني لو ماتستخدمش فترة). راجع الصفحات الرسمية: https://supabase.com/pricing و https://vercel.com/pricing و https://console.groq.com/docs/rate-limits
- **واتساب (Meta)**: استقبال رسايل الزباين مجاني. الرد خلال ٢٤ ساعة من رسالة الزبون (رسالة خدمة) مجاني حسب تسعير Meta الحالي. الرسايل اللي بتبدأها انت برا الـ ٢٤ ساعة (قوالب) بتتحاسب. تسعير Meta بيتغيّر، فاعتمد على صفحتهم الرسمية بس: https://developers.facebook.com/docs/whatsapp/pricing
- خلّصانة نفسها ما بتحاسبش على حاجة.

---

## English

This guide is for a non-technical seller. It takes about an hour and uses free tiers. Each store gets its own deployment (one Vercel project per store).

> Without these steps the app runs as the public sandbox only (sample data, kept in the browser). These steps turn on the real product.

### a) Database and login (Supabase)

1. Create a free account at https://supabase.com and click **New project**. Pick a name, a database password (keep it) and the nearest region.
2. Open **SQL Editor → New query**, paste the whole of `supabase/schema.sql` from this repo and click **Run**. It is safe to run again.
3. Add yourself as the first owner (use your own email, lowercase):

   ```sql
   insert into team_members (email, role)
   values ('you@example.com', 'owner');
   ```

   For staff, use `'staff'` instead of `'owner'`.
4. Create your login: **Authentication → Users → Add user → Create new user**. Use the same email and a strong password, and enable **Auto Confirm User**. Repeat for each staff member. There is no public sign-up in the app: only the owner creates accounts.
5. **Important for security:** open **Authentication → Sign In / Providers** (or **Providers → Email**), turn **OFF** "Allow new users to sign up", and keep **Confirm email** ON. Otherwise strangers can register on your project. (When you create a user with **Add user**, enable **Auto Confirm User** so the email counts as confirmed; unconfirmed accounts cannot get in.)
6. From **Project Settings → API** copy:
   - **Project URL**
   - **anon public key**
   - **service_role key** (very secret: never share it, never put it in code or Git).

### b) Deploy on Vercel

1. In your Vercel project open **Settings → Environment Variables** and add:

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | the Project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the anon key |
   | `SUPABASE_SERVICE_ROLE_KEY` | the service_role key |
   | `GROQ_API_KEY` | free Groq key (optional, https://console.groq.com) |
   | `WHATSAPP_VERIFY_TOKEN` | any long secret phrase you choose (you will enter it in Meta too) |
   | `WHATSAPP_APP_SECRET` | from Meta (step c) |
   | `WHATSAPP_TOKEN` | permanent Meta token (step c) |
   | `WHATSAPP_PHONE_NUMBER_ID` | Phone number ID from Meta |
   | `AUTO_EXTRACT` | `true` to extract orders automatically from every new WhatsApp text message (optional) |

   Every variable is described in `.env.example`.
2. After adding or changing any variable you must **redeploy**: **Deployments → pick the latest deployment → the ⋯ menu → Redeploy**. Without it the new variables have no effect.
3. Open the site, click **دخول فريق المتجر** (team login) and sign in. An account that is not in `team_members` sees «حسابك مش ضمن فريق المتجر» (your account is not on the store team).

**Who can do what?**

| | Owner | Staff |
|---|---|---|
| See messages, orders, numbers and settings | yes | yes |
| Add a message, extract, add an order, move it between stages, reply | yes | yes |
| Edit settings (products and shipping) | yes | no |
| Delete an order or a message | yes | no |
| Add or remove team members | from the SQL Editor | no |

This is enforced by the database itself, not only by the screens.

You can already work: on the **Messages** screen click «رسالة جديدة» (new message) and paste any customer message, no WhatsApp needed.

### c) Connect WhatsApp (Meta WhatsApp Cloud API)

1. Go to https://developers.facebook.com, click **Create App** and choose the **Business** type.
2. Add the **WhatsApp** product. Meta gives you a **test number** and lets you message a limited list of recipient numbers you add yourself. That is enough for testing.
3. Copy the **Phone number ID** from **API Setup** into `WHATSAPP_PHONE_NUMBER_ID`.
4. **App Secret**: **App settings → Basic → App secret → Show**. Put it in `WHATSAPP_APP_SECRET`.
5. **Permanent token** (the temporary one expires in 24 hours):
   - Go to https://business.facebook.com/settings → **Users → System users → Add** and create an Admin system user.
   - **Add assets**, choose your app with full control.
   - **Generate new token**, select the app, enable `whatsapp_business_messaging` and `whatsapp_business_management`, set expiry to **Never**. Put it in `WHATSAPP_TOKEN`.
6. **Redeploy** on Vercel after adding the variables (**Deployments → ⋯ → Redeploy**).
7. In Meta: **WhatsApp → Configuration → Webhook → Edit**:
   - **Callback URL**: `https://<your-domain>/api/webhooks/whatsapp` (Khalsana shows it ready to copy under **Settings → الربط / Integrations**).
   - **Verify token**: the same value as `WHATSAPP_VERIFY_TOKEN`.
   - Click **Verify and save**.
   - Under **Webhook fields** click **Subscribe** next to **messages**.
8. For your real number (not the test one): add it under **API Setup → Add phone number** and finish verification. The number cannot be in use on the regular WhatsApp app at the same time.

### d) Test end to end

1. Open **Settings → الربط** in Khalsana. You should see ✓ for database, WhatsApp receive, WhatsApp send and AI (the ones you configured).
2. From your phone send a message to the test number (your phone must be in Meta's allowed recipient list). Example: «عايزة طقم اسود مقاس L، العنوان مدينة نصر، رقمي 01012345678».
3. Wait up to about 15 seconds on the **Messages** screen. Open the message, click **استخرج الأوردر** (extract order), review and add it to orders.
4. Write the reply and click **ابعت على واتساب** (send on WhatsApp). It should arrive on your phone.
5. Open **Orders**: check the order is there, move it through the stages, print the label or export CSV.

If the message does not show up: check in Meta that the webhook was saved and `messages` is subscribed, and check **Logs** in Vercel.

**Good to know:**
- WhatsApp allows free-form replies only within **24 hours** of the customer's last message. After that the send is rejected and Khalsana tells you to open the chat in WhatsApp and reply manually.
- Messenger and Instagram are still copy and paste (the «رسالة جديدة» button).
- Voice notes and images appear as a text marker ([رسالة صوتية] / [صورة]); they are not transcribed.

### e) Costs and limits

- **Supabase**, **Vercel** and **Groq** all have free tiers that are enough for a small store, with usage limits (database size, requests, run time, and free Supabase projects can be paused after a period of inactivity). See the official pages: https://supabase.com/pricing, https://vercel.com/pricing, https://console.groq.com/docs/rate-limits
- **WhatsApp (Meta)**: receiving customer messages is free. Replying within 24 hours of the customer's message (a service message) is free under Meta's current pricing; messages you start outside that window (templates) are charged. Meta changes its pricing, so rely on their official page only: https://developers.facebook.com/docs/whatsapp/pricing
- Khalsana itself charges nothing.
