// Envoi d'e-mails via l'API REST d'EmailJS (aucun script externe à charger).
const EMAILJS_SERVICE = "service_5bi57sr";
const EMAILJS_PUBLIC = "zpxiv3rkIbtfdqAQ6";
// Modèle EmailJS dédié aux notifications pour Meije (ID personnalisé à créer dans EmailJS : template_notif)
export const EMAILJS_TEMPLATE_NOTIF = "template_notif";
const PRATICIENNE_EMAIL = process.env.REACT_APP_PRATICIENNE_EMAIL || "lamenaturo@gmail.com";

export const sendEmail = async (templateId, params) => {
  try {
    const res = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ service_id: EMAILJS_SERVICE, template_id: templateId, user_id: EMAILJS_PUBLIC, template_params: params }),
    });
    if (!res.ok) console.error("Email error:", res.status, await res.text().catch(() => ""));
  } catch (e) { console.error("Email error:", e); }
};

// Prévient Meije qu'une consultante a fait quelque chose sur la plateforme
export const notifierMeije = (prenom, action) =>
  sendEmail(EMAILJS_TEMPLATE_NOTIF, {
    prenom: prenom || "Une consultante",
    action,
    lien: "https://meije-suivi.vercel.app",
    to_email: PRATICIENNE_EMAIL,
  });
