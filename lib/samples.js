// Simulated inbox. Every message is made up for the demo.
export const CHANNELS = [
  { id: "whatsapp", label: "واتساب" },
  { id: "messenger", label: "ماسنجر" },
  { id: "instagram", label: "إنستجرام" },
];
export const channelLabel = (id) => CHANNELS.find((c) => c.id === id)?.label || (id === "manual" ? "يدوي" : id);

export const SAMPLE_MESSAGES = [
  {
    id: "m1", channel: "whatsapp", from: "منى سمير", minsAgo: 4,
    text: "السلام عليكم عايزة الطقم الاسود مقاس L واحد و٢ من البيج M، العنوان مدينة نصر الحي السابع عمارة ١٢ الدور ٣، رقمي ٠١٠١٢٣٤٥٦٧٨",
  },
  {
    id: "m2", channel: "messenger", from: "هبة محمود", minsAgo: 11,
    text: "اهلا، انا هبه محمود. عايزه فستان زيتي مقاس M وبلوزه بيضا S\nالعنوان: 6 اكتوبر الحي الخامس فيلا 34\nموبايلي 01112223344",
  },
  {
    id: "m3", channel: "instagram", from: "karim_ahmed", minsAgo: 19,
    text: "3ayez 2 قميص ابيض L وقميص كحلي XL\nاسمي كريم احمد\nالاسكندرية سموحه شارع فوزي معاذ برج النور الدور 5\n01277778888",
  },
  {
    id: "m4", channel: "whatsapp", from: "نورهان", minsAgo: 27,
    text: "🎤 رسالة صوتية (٠:١٤) تفريغ تلقائي: ايوه يا فندم انا نورهان عبد الله عايزة جاكيت بيج مقاس لارج وشال رمادي، ساكنة في طنطا شارع البحر عمارة ٧ رقمي ٠١٥٠٣٣٣٤٤٥٥",
  },
  {
    id: "m5", channel: "messenger", from: "أحمد علي", minsAgo: 38,
    text: "السلام عليكم، البنطلون الواسع بكام؟ وفيه مقاس XXL؟",
  },
  {
    id: "m6", channel: "whatsapp", from: "ندى حسام", minsAgo: 52,
    text: "الاوردر وصلني امبارح والجلابية مقاسها غلط ومش زي الصورة، عايزة ارجعها. ده رقم الطلب 10231",
  },
  {
    id: "m7", channel: "instagram", from: "mariam.fashion", minsAgo: 64,
    text: "hi 3ayza abaya soda size 54 w shala beige",
  },
  {
    id: "m8", channel: "messenger", from: "Mona Samir", minsAgo: 71,
    text: "السلام عليكم عايزة الطقم الاسود مقاس L واحد و٢ من البيج M، العنوان مدينة نصر الحي السابع عمارة ١٢ الدور ٣، رقمي ٠١٠١٢٣٤٥٦٧٨ (بعتها على الواتس ومحدش رد)",
  },
  {
    id: "m9", channel: "instagram", from: "dina_shop", minsAgo: 95,
    text: "في عباية كحلي مقاس ٥٦؟ والشحن لأسوان بكام؟",
  },
  {
    id: "m10", channel: "whatsapp", from: "محمود حسن", minsAgo: 130,
    text: "عاوز ٣ قميص سماوى مقاس XL ،، اسمى محمود حسن ،، سوهاج جرجا شارع المحطه ،، ت ٠١١٠٠٩٩٨٨٧٧",
  },
];
