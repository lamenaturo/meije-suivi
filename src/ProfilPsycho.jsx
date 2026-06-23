import { useState, useEffect, useRef } from "react";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { db } from "./firebase";
import { ProfilDominantSummary, ProfilQuestCard, PROFILS_FEMME, PROFILS_HOMME } from "./BilansFonctionnels";

const C = {
  bg: "#E8DDD0", surface: "#F5EDE2", surface2: "#DDD0C0",
  border: "rgba(139,100,60,0.15)", border2: "rgba(139,100,60,0.25)",
  text: "#1C1008", textMid: "rgba(28,16,8,0.65)", textDim: "rgba(28,16,8,0.38)",
  terra: "#B5583A", terraDim: "rgba(181,88,58,0.1)", terraBorder: "rgba(181,88,58,0.25)",
  accent: "#8A5A2A", accentDim: "rgba(138,90,42,0.1)",
  sage: "#4A7A5A", sageDim: "rgba(74,122,90,0.12)",
};

const computeScore = (scores, items) => items.reduce((s, i) => s + ((scores || {})[i.key] ? i.pts : 0), 0);
const maxScore = items => items.reduce((s, i) => s + i.pts, 0);

const downloadPDF = (genre, scores, prenom) => {
  const profilsDef = genre === "Homme" ? PROFILS_HOMME : PROFILS_FEMME;
  const profilScores = profilsDef.map(p => ({ ...p, score: computeScore(scores, p.items), max: maxScore(p.items) }));
  const maxS = Math.max(...profilScores.map(p => p.score));
  const dominants = profilScores.filter(p => p.score >= maxS - 1 && p.score > 0);
  const sections = profilScores.map(p => {
    const checked = p.items.filter(i => scores[i.key]);
    if (checked.length === 0) return "";
    return `<div class="profil"><h2>${p.icon} ${p.label} — ${p.score}/${p.max}</h2><ul>${checked.map(i => `<li>${i.label}</li>`).join("")}</ul></div>`;
  }).join("");
  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Profil psycho-émotionnel — ${prenom}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Cormorant+Garamond:wght@500;600&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'DM Sans', sans-serif; color: #1C1008; background: #fff; padding: 40px 48px; font-size: 12px; line-height: 1.7; }
  .header { border-bottom: 2px solid #B5583A; padding-bottom: 16px; margin-bottom: 24px; }
  .header h1 { font-family: 'Cormorant Garamond', serif; font-size: 22px; color: #B5583A; font-weight: 600; }
  .dominant { background: rgba(181,88,58,0.08); border: 1px solid rgba(181,88,58,0.25); border-radius: 10px; padding: 14px 18px; margin-bottom: 20px; }
  .dominant p { font-size: 13px; font-weight: 600; color: #B5583A; }
  .profil { margin-bottom: 18px; }
  .profil h2 { font-family: 'Cormorant Garamond', serif; font-size: 16px; color: #8A5A2A; font-weight: 600; margin-bottom: 8px; }
  .profil ul { padding-left: 18px; }
  .profil li { font-size: 12px; line-height: 1.8; color: #1C1008; }
  @media print { body { padding: 20px 24px; } @page { margin: 1.5cm; size: A4; } }
</style>
</head>
<body>
<div class="header"><h1>Profil psycho-émotionnel</h1><p style="font-size:13px;color:rgba(28,16,8,0.6);margin-top:4px;">${prenom}</p></div>
<div class="dominant"><p>${dominants.length > 1 ? "Profils dominants" : "Profil dominant"} : ${dominants.map(p => `${p.icon} ${p.label} (${p.score}/${p.max})`).join(", ") || "Non évalué"}</p></div>
${sections}
</body>
</html>`;
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `profil_psycho_${(prenom || "moi").toLowerCase().replace(/\s+/g, "_")}_${new Date().toISOString().slice(0,10)}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export default function ProfilPsycho({ user, onDone, genreConnu }) {
  const [genre, setGenre] = useState(genreConnu || "");
  const [scores, setScores] = useState({});
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const docId = `profil_${user.uid}`;

  // Ref pour toujours avoir les dernières valeurs en closure
  const scoresRef = useRef(scores);
  const genreRef = useRef(genre);
  useEffect(() => { scoresRef.current = scores; }, [scores]);
  useEffect(() => { genreRef.current = genre; }, [genre]);

  // Chargement : essaie users/{uid} d'abord, puis profils_psycho en fallback
  useEffect(() => {
    (async () => {
      try {
        // Source 1 : users/{uid}.profilPsycho
        const userSnap = await getDoc(doc(db, "users", user.uid));
        const pp = userSnap.data()?.profilPsycho;
        if (pp && pp.scores && Object.keys(pp.scores).length > 0) {
          setScores(pp.scores);
          if (pp.genre) setGenre(pp.genre);
          else if (genreConnu) setGenre(genreConnu);
          setLoading(false);
          return;
        }
        // Source 2 : profils_psycho/{docId} (fallback)
        const profSnap = await getDoc(doc(db, "profils_psycho", docId));
        if (profSnap.exists()) {
          const data = profSnap.data();
          if (data.scores && Object.keys(data.scores).length > 0) {
            setScores(data.scores);
            if (data.genre) setGenre(data.genre);
            else if (genreConnu) setGenre(genreConnu);
            setLoading(false);
            return;
          }
        }
        // Rien trouvé
        if (genreConnu) setGenre(genreConnu);
      } catch (e) {
        console.error("ProfilPsycho load error:", e);
        if (genreConnu) setGenre(genreConnu);
      }
      setLoading(false);
    })();
  }, []);

  // Sauvegarde dans les deux collections
  const persist = async (g, s) => {
    if (!g || !s || !Object.values(s).some(Boolean)) return;
    const date = new Date().toISOString();
    const prenom = user.prénom || user.displayName || user.email?.split("@")[0] || "";
    // Toujours écrire dans profils_psycho (le client peut y écrire)
    setDoc(doc(db, "profils_psycho", docId), {
      userUid: user.uid, userEmail: user.email, userPrenom: prenom,
      genre: g, scores: s, date,
    }).catch(e => console.error("save profils_psycho:", e));
    // Essai dans users/{uid} pour la praticienne
    updateDoc(doc(db, "users", user.uid), {
      profilPsycho: { genre: g, scores: s, date },
    }).catch(e => console.error("save users profilPsycho:", e));
    setSaved(true);
  };

  // Sauvegarde à chaque changement de scores (immédiat, sans debounce)
  const handleScoreChange = (newScores) => {
    setScores(newScores);
    if (genreRef.current) {
      persist(genreRef.current, newScores);
    }
  };

  const handleRetour = () => {
    // Sauvegarde finale avec les refs (valeurs toujours à jour)
    persist(genreRef.current, scoresRef.current);
    onDone();
  };

  const profilsDef = genre === "Homme" ? PROFILS_HOMME : PROFILS_FEMME;
  const profilScores = profilsDef.map(p => ({
    key: p.key, label: p.label, icon: p.icon,
    score: computeScore(scores, p.items), max: maxScore(p.items),
  }));

  // Wrapper setScores pour intercepter les changements
  const setScoresIntercepted = (updater) => {
    setScores(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      if (genreRef.current) persist(genreRef.current, next);
      return next;
    });
  };

  return (
    <div style={{ background: C.bg, minHeight: "100vh", fontFamily: "DM Sans, sans-serif" }}>
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "16px 20px", position: "sticky", top: 0, zIndex: 5 }}>
        <div style={{ maxWidth: 600, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <button onClick={handleRetour} style={{ background: "none", border: "none", color: C.textMid, fontSize: 13, cursor: "pointer", fontFamily: "DM Sans, sans-serif" }}>← Retour</button>
          {saved && <span style={{ color: C.sage, fontSize: 11 }}>✓ Enregistré</span>}
        </div>
      </div>

      <div style={{ maxWidth: 600, margin: "0 auto", padding: "24px 20px 60px" }}>
        <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 26, color: C.text, fontWeight: 300, marginBottom: 8 }}>Ton profil psycho-émotionnel</p>
        <p style={{ color: C.textMid, fontSize: 13, lineHeight: 1.7, marginBottom: 24 }}>
          Le stress chronique ne s'exprime pas de la même façon chez tout le monde. Coche ce qui te parle dans chaque description ci-dessous — la plupart des gens se reconnaissent dans un mélange, avec une dominante. Il n'y a pas de bonne ou mauvaise réponse, et ça m'aide à adapter ma posture et le rythme de ton accompagnement.
        </p>

        {!genre && !loading && (
          <div style={{ background: C.terraDim, border: `1px solid ${C.terraBorder}`, borderRadius: 14, padding: "18px 20px", marginBottom: 20 }}>
            <p style={{ color: C.text, fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Avant de commencer, dis-moi :</p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => { setGenre("Femme"); genreRef.current = "Femme"; }} style={{ flex: 1, padding: "12px 16px", borderRadius: 10, border: `1px solid ${C.border2}`, background: C.surface, color: C.text, fontSize: 14, cursor: "pointer", fontFamily: "DM Sans, sans-serif" }}>Je suis une femme</button>
              <button onClick={() => { setGenre("Homme"); genreRef.current = "Homme"; }} style={{ flex: 1, padding: "12px 16px", borderRadius: 10, border: `1px solid ${C.border2}`, background: C.surface, color: C.text, fontSize: 14, cursor: "pointer", fontFamily: "DM Sans, sans-serif" }}>Je suis un homme</button>
            </div>
          </div>
        )}

        {genre && !loading && (
          <>
            <ProfilDominantSummary profils={profilScores} />
            {profilsDef.map(p => (
              <ProfilQuestCard key={p.key} title={p.label} icon={p.icon} items={p.items} scores={scores} setScores={setScoresIntercepted} />
            ))}
            {Object.values(scores).some(Boolean) && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
                <button onClick={() => downloadPDF(genre, scores, user.prénom || user.displayName || user.email?.split("@")[0] || "")} style={{ width: "100%", background: C.surface2, border: `1px solid ${C.border2}`, borderRadius: 30, padding: "12px 22px", color: C.textMid, fontFamily: "DM Sans, sans-serif", fontSize: 14, fontWeight: 500, cursor: "pointer" }}>⬇ Télécharger en PDF</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
