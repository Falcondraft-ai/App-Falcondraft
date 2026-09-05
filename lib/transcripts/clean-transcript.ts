import "server-only";

import { logOpenAiUsage, type OpenAiUsage } from "@/lib/ai/usage";

const OPENAI_TRANSCRIPT_CLEANUP_MODEL =
  process.env.OPENAI_TRANSCRIPT_CLEANUP_MODEL || "gpt-4.1";

const OPENAI_TRANSCRIPT_CLEANUP_TEMPERATURE = Number(
  process.env.OPENAI_TRANSCRIPT_CLEANUP_TEMPERATURE || "0.15",
);

const LOOP_MARKER = "[passage répétitif inaudible]";

const SYSTEM_PROMPT = `Tu es un assistant expert de post-traitement de transcriptions d'appels commerciaux multilingues.

Tu reçois un transcript brut issu d'un système de reconnaissance vocale automatique. Le transcript peut être en français, en anglais, en espagnol, ou contenir plusieurs langues.

Ta mission est d'améliorer la lisibilité et la précision formelle du transcript, sans changer le sens, sans résumer et sans inventer.

Règle fondamentale :
Tu dois rester fidèle au transcript original. Tu peux corriger ce qui est évident à partir du contexte immédiat. Si une information est incertaine, incomplète ou inaudible, ne l'invente pas.

Langue :
- Conserve la langue utilisée par chaque intervenant.
- Ne traduis pas le transcript.
- Si une phrase est en français, garde-la en français.
- Si une phrase est en anglais, garde-la en anglais.
- Si une phrase est en espagnol, garde-la en espagnol.
- Si le transcript est multilingue, conserve le multilingue.
- Ne force jamais tout le transcript dans une seule langue.

Format de sortie :
- Conserve les labels de speakers existants, par exemple "Speaker 1:", "Jean Dupont:", "Client:".
- Tu peux corriger la casse des noms de speakers si c'est évident, par exemple "timeo marcopoulos:" → "Timeo Marcopoulos:".
- Garde l'ordre chronologique du transcript.
- Retourne uniquement le transcript nettoyé.
- Ne rajoute pas de titre.
- Ne rajoute pas de commentaire.
- Ne rajoute pas de markdown.
- Ne mets pas le résultat dans un bloc de code.

Règles générales de nettoyage :
- Corrige la ponctuation, les majuscules et la lisibilité générale.
- Corrige les erreurs manifestes de transcription uniquement quand la correction est évidente.
- Corrige les mots coupés ou les répétitions excessives quand cela ne change pas le sens.
- Conserve les hésitations utiles si elles ont une valeur dans l'échange.
- Ne transforme pas le transcript en compte-rendu.
- Ne réécris pas le style des intervenants de manière artificielle.
- Ne rends pas le discours plus professionnel qu'il ne l'est.
- Ne rends pas le discours plus vendeur qu'il ne l'est.
- Ne censure pas les propos informels, maladroits, familiers ou déplacés s'ils sont présents dans le transcript.
- Tu peux fusionner deux ou plusieurs lignes consécutives du même speaker si elles forment manifestement une seule phrase coupée par la transcription.
- Ne fusionne jamais des phrases de speakers différents.

Micro-reconstruction grammaticale autorisée :
Tu peux ajouter de petits mots manquants lorsque c'est évident, local et nécessaire à la lisibilité.

Tu peux ajouter ou restaurer :
- articles : "le", "la", "les", "un", "une", "des" ;
- prépositions : "de", "à", "avec", "pour", "dans", "sur" ;
- conjonctions : "que", "et", "mais", "donc", "parce que" ;
- pronoms ou petits mots grammaticaux évidents : "ça", "ce", "il", "elle", "vous", "nous" ;
- négations écrites évidentes : "ne", "n'" ;
- mots de liaison courts qui réparent une phrase clairement coupée.

Conditions strictes :
- Le mot ajouté doit être évident avec le contexte immédiat.
- Le mot ajouté ne doit pas ajouter une idée nouvelle.
- Le mot ajouté ne doit pas transformer une hésitation en affirmation certaine.
- Le mot ajouté ne doit pas changer le niveau d'engagement commercial.
- Le mot ajouté ne doit jamais créer un prix, une date, une durée, un engagement, une promesse ou une condition.
- Si plusieurs reconstructions sont possibles, conserve la formulation originale.
- Si une phrase est trop cassée pour être reconstruite avec certitude, ne l'invente pas.

Exemples de micro-reconstruction autorisée :
- "s'il vous / plaît" → "s'il vous plaît"
- "J'ai une question en anglais, ça / marche aussi ?" → "J'ai une question : en anglais, ça marche aussi ?"
- "Ça pose pas de problème que là, le client, il voit qu'il y a une / troisième personne ?" → "Ça ne pose pas de problème que là, le client voie qu'il y a une troisième personne ?"
- "Mais par contre, là, supposons, l'appel, ça sera ton client avec un autre client à / lui ?" → "Mais par contre, là, supposons que l'appel, ce soit ton client avec un autre client à lui ?"
- "Bon, que proposez-vous / de nous ?" → "Bon, que nous proposez-vous ?"

Exemples à ne pas inventer :
- "Bon alors, qu'en avez-vous / Réuni de votre première / cause de" → ne pas transformer en phrase commerciale inventée.
- "Si vous avez un / Copain, mais il a de la chanson" → ne pas inventer le sens.
- "Et / si / oui" → ne pas reconstruire une question complète si elle n'est pas claire.

Fragments, hésitations et phrases coupées :
- Garde les hésitations courtes utiles : "euh", "je pense", "je ne sais pas", "attendez", etc.
- Supprime ou corrige les répétitions simples quand elles sont clairement dues à la transcription automatique.
- Si une phrase est coupée mais que le sens est évident avec la ligne suivante du même speaker, restaure la phrase.
- Si une phrase est coupée et que le sens n'est pas clair, ne l'invente pas.
- Si deux lignes consécutives du même speaker forment clairement une seule phrase, tu peux les fusionner.
- Si deux lignes appartiennent à deux speakers différents, ne les fusionne pas.

Boucles et artefacts de reconnaissance vocale :
Les systèmes de transcription peuvent produire des boucles absurdes, par exemple :
- "Je... Je... Je... Je... Je..."
- "I... I... I... I..."
- "Euh... Euh... Euh..."
- "Oui... Oui... Oui... Oui..."
- plusieurs lignes consécutives contenant seulement le même fragment sans sens.

Dans ce cas :
- Ne conserve jamais des dizaines de répétitions identiques.
- Si le fragment répété n'apporte aucune information utile, remplace toute la boucle par : "[passage répétitif inaudible]".
- Si une partie utile précède la boucle, conserve la partie utile puis ajoute "[passage répétitif inaudible]".
- Si une seule hésitation courte est présente, conserve-la.
- Si une répétition semble volontaire et porte du sens, conserve-la.
- Si une même personne produit plusieurs lignes de boucles réparties autour de courtes interruptions d'un autre speaker, remplace chaque bloc répétitif par "[passage répétitif inaudible]" sans supprimer les interventions informatives de l'autre speaker.
- Ne supprime pas une information commerciale utile sous prétexte qu'elle est formulée maladroitement.

Exemples de boucles à nettoyer :
- "Je... Je... Je... Je... Je... Je..." → "[passage répétitif inaudible]"
- "I... I... I... I... I..." → "[passage répétitif inaudible]"
- "Oui, oui. Je... Je... Je... Je..." → "Oui, oui. [passage répétitif inaudible]"
- "Euh... euh... euh... euh..." → "[passage répétitif inaudible]"

Emails dictés :
Tu dois être très prudent avec les emails.

Règle principale :
- Si une adresse email est déjà écrite clairement avec "@" dans le transcript original, tu peux la conserver ou corriger uniquement la ponctuation évidente.
- Si tu dois reconstruire une adresse email à partir d'une dictée orale, elle doit toujours être marquée comme incertaine.
- Ne présente jamais une adresse reconstruite comme une adresse certaine.
- Une adresse reconstruite doit être écrite au format : "[email incertain : adresse@domaine.com]".
- Si l'adresse est trop incomplète pour proposer une adresse probable, écris : "[email incomplet : phrase originale]".
- Si tu n'es pas certain qu'il s'agisse vraiment d'une adresse email, conserve la formulation originale ou écris : "[email incertain : phrase originale]".

Quand reconstruire avec prudence :
- Si le speaker dicte explicitement "arrobase", "at", "arroba", "@", "point", "dot" ou "punto", tu peux reconstruire l'adresse, mais tu dois la marquer comme incertaine.
- Si le speaker dicte une adresse sous forme orale avec un fournisseur email clair, tu peux reconstruire l'adresse, mais tu dois la marquer comme incertaine.
- Si le fournisseur est clairement un service email connu, tu peux insérer "@" entre l'identifiant et le fournisseur, mais le résultat reste incertain.
- Fournisseurs email courants : gmail, g mail, outlook, hotmail, yahoo, icloud, proton, protonmail, live, campus, university, universidad.

Interdictions strictes sur les emails :
- Ne complète jamais un fournisseur, un domaine ou une extension si rien ne permet de les identifier.
- Ne transforme pas un simple site web en email.
- Ne crée jamais une partie manquante avant le "@" si elle n'est pas clairement dictée.
- Ne reconstruis pas une adresse email à partir d'une simple mention de Gmail, Outlook ou d'un outil email.
- Ne crée pas d'email quand le speaker parle seulement du concept d'adresse email, d'arobase ou de Gmail sans donner une adresse précise.
- Ne crée pas d'email à partir d'un nom de personne seul.
- Ne crée pas d'email à partir d'un nom d'entreprise seul.

Exemples :
- "margot arrobase falcondraft point fr" → "[email incertain : margot@falcondraft.fr]"
- "margot at falcondraft dot com" → "[email incertain : margot@falcondraft.com]"
- "margot arroba falcondraft punto es" → "[email incertain : margot@falcondraft.es]"
- "timeo point marcopoulos arobase falcondraft point fr" → "[email incertain : timeo.marcopoulos@falcondraft.fr]"
- "falcondraft gmail point com" → "[email incertain : falcondraft@gmail.com]"
- "falcon draft g mail point com" → "[email incertain : falcondraft@gmail.com]"
- "contact outlook point fr" → "[email incertain : contact@outlook.fr]"
- "support hotmail point com" → "[email incertain : support@hotmail.com]"
- "u1987800 campus point udg point edu" → "[email incertain : u1987800@campus.udg.edu]"

Exemples à traiter prudemment :
- "mon adresse email est falcondrafts.com" → "mon adresse email est [email incomplet : falcondrafts.com]"
- "son adresse email est amordelorme1806.com" → "son adresse email est [email incomplet : amordelorme1806.com]"
- "vous pouvez m'écrire à margot falcondraft point fr" → "vous pouvez m'écrire à [email incertain : margot falcondraft point fr]"
- "je vais tester les arrobases et les points" → ne pas créer d'adresse email.
- "quand je dis une adresse mail, ça doit bien la mettre" → ne pas créer d'adresse email.

Numéros de téléphone :
Convertis les numéros de téléphone dictés en format lisible uniquement lorsque c'est clair.

Exemples :
- "zéro six douze treize quatorze quinze" → "06 12 13 14 15"
- "zero six twelve thirty four fifty six seventy eight" → "06 12 34 56 78"

Montants :
Convertis les montants dictés en format lisible uniquement lorsque c'est clair.

Exemples :
- "trois mille euros hors taxes" → "3 000 € HT"
- "three thousand euros excluding VAT" → "€3,000 excluding VAT"
- "tres mil euros sin IVA" → "3.000 € sin IVA"

Noms propres et outils :
Normalise les noms de produits, entreprises et outils connus uniquement quand c'est évident.

Exemples :
- "falcon draft" → "FalconDraft"
- "g mail" → "Gmail"
- "google meet" → "Google Meet"
- "out look" → "Outlook"
- "n eight n" → "n8n"
- "sup a base" → "Supabase"
- "recall ai" → "Recall.ai"
- "zoom" → "Zoom"
- "teams" → "Teams"

Passages incertains :
- Si un mot est manifestement inaudible ou incomplet, tu peux indiquer "[inaudible]".
- Si un passage est manifestement une boucle de transcription sans contenu utile, utilise "[passage répétitif inaudible]".
- Si tu n'es pas certain d'une correction, conserve la formulation originale.
- Ne complète jamais un prix, une date, une durée, un engagement, une condition contractuelle ou une décision commerciale qui n'est pas clairement présente dans le transcript.

Interdictions strictes :
- Ne résume jamais.
- N'invente aucune information.
- Ne supprime aucune information utile.
- Ne change pas les intentions commerciales.
- Ne modifie pas les prix, délais, conditions ou engagements.
- Ne transforme pas des phrases incertaines en affirmations certaines.
- Ne transforme pas un échange informel en discours commercial propre.
- Ne rajoute pas de conclusion.
- Ne rajoute pas de commentaire.
- Ne rajoute pas de markdown.

Retourne uniquement le transcript nettoyé, sans commentaire ni explication.`;

type ChatCompletionResponse = {
  choices?: Array<{
    finish_reason?: string | null;
    message?: {
      content?: string | null;
    };
  }>;
  usage?: OpenAiUsage;
};

const FILLER_WORDS = new Set([
  "je",
  "j",
  "i",
  "yo",
  "euh",
  "heu",
  "uh",
  "um",
  "hum",
  "hmm",
  "oui",
  "ouais",
  "yes",
  "si",
  "sí",
  "non",
  "no",
  "ok",
  "okay",
  "ah",
  "oh",
]);

const FILLER_WORD_PATTERN =
  "(?:je|j|i|yo|euh|heu|uh|um|hum|hmm|oui|ouais|yes|si|sí|non|no|ok|okay|ah|oh)";

const LOOP_TAIL_REGEX = new RegExp(
  `(?:\\b${FILLER_WORD_PATTERN}\\b\\s*(?:\\.{3}|…|[.!?,;:\\-])?\\s*){5,}$`,
  "iu",
);

const EMAIL_REGEX = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/giu;

function normalizeBasicText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\u00A0/g, " ")
    .replace(/[ \t]+$/gm, "")
    .trim();
}

function normalizeForLoopDetection(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, " ")
    .replace(/[…]/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function isAsrLoopOnly(content: string): boolean {
  const tokens = normalizeForLoopDetection(content);

  if (tokens.length < 4) {
    return false;
  }

  const allFillers = tokens.every((token) => FILLER_WORDS.has(token));
  const uniqueTokens = new Set(tokens);

  return allFillers && uniqueTokens.size <= 2;
}

function collapseLoopContent(content: string): string {
  const trimmed = content.trim();

  if (!trimmed) {
    return trimmed;
  }

  if (isAsrLoopOnly(trimmed)) {
    return LOOP_MARKER;
  }

  const tailMatch = trimmed.match(LOOP_TAIL_REGEX);

  if (!tailMatch || typeof tailMatch.index !== "number") {
    return trimmed;
  }

  const prefix = trimmed.slice(0, tailMatch.index).trim();

  if (!prefix) {
    return LOOP_MARKER;
  }

  return `${prefix} ${LOOP_MARKER}`;
}

function collapseAsrLoopArtifacts(text: string): string {
  const normalized = normalizeBasicText(text);
  const lines = normalized.split("\n");

  const output: string[] = [];
  let lastLoopMarkerSpeaker: string | null = null;

  for (const originalLine of lines) {
    const line = originalLine.trimEnd();

    if (!line.trim()) {
      output.push("");
      continue;
    }

    const speakerMatch = line.match(/^([^:\n]{1,120}):\s*(.*)$/);

    if (!speakerMatch) {
      const collapsed = collapseLoopContent(line.trim());

      if (
        collapsed === LOOP_MARKER &&
        lastLoopMarkerSpeaker === "__no_speaker__"
      ) {
        continue;
      }

      output.push(collapsed);
      lastLoopMarkerSpeaker =
        collapsed === LOOP_MARKER ? "__no_speaker__" : null;
      continue;
    }

    const speaker = speakerMatch[1]?.trim();
    const content = speakerMatch[2]?.trim() || "";
    const collapsedContent = collapseLoopContent(content);

    if (!speaker) {
      output.push(line);
      lastLoopMarkerSpeaker = null;
      continue;
    }

    if (collapsedContent === LOOP_MARKER && lastLoopMarkerSpeaker === speaker) {
      continue;
    }

    output.push(`${speaker}: ${collapsedContent}`);
    lastLoopMarkerSpeaker =
      collapsedContent === LOOP_MARKER ? speaker : null;
  }

  return output
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function stripPossibleCodeFence(text: string): string {
  const trimmed = text.trim();

  return trimmed
    .replace(/^```(?:txt|text|transcript)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function countSpeakerLines(text: string): number {
  const matches = text.match(/^[^:\n]{1,120}:\s+/gm);
  return matches?.length || 0;
}

function isEmailAlreadyMarkedAsUncertain(text: string, emailStartIndex: number): boolean {
  const prefix = text
    .slice(Math.max(0, emailStartIndex - 80), emailStartIndex)
    .toLowerCase();

  return (
    prefix.includes("[email incertain") ||
    prefix.includes("[email incomplet") ||
    prefix.includes("[email à vérifier") ||
    prefix.includes("[email a verifier")
  );
}

function protectReconstructedEmails(rawText: string, cleanedText: string): string {
  const normalizedRaw = rawText.toLowerCase();

  return cleanedText.replace(EMAIL_REGEX, (email, offset: number, fullText: string) => {
    const normalizedEmail = email.toLowerCase();

    if (normalizedRaw.includes(normalizedEmail)) {
      return email;
    }

    if (isEmailAlreadyMarkedAsUncertain(fullText, offset)) {
      return email;
    }

    return `[email incertain : ${email}]`;
  });
}

function shouldRejectCleanedTranscript(
  rawText: string,
  cleanedText: string,
): boolean {
  const rawLength = rawText.length;
  const cleanedLength = cleanedText.length;

  if (!cleanedText.trim()) {
    return true;
  }

  // Si le modèle a énormément raccourci le transcript, il a probablement résumé
  // ou supprimé du contenu utile. On compare avec le texte déjà pré-nettoyé pour
  // éviter de rejeter une suppression légitime de boucles ASR.
  if (rawLength >= 1000 && cleanedLength < rawLength * 0.45) {
    return true;
  }

  const rawSpeakerLines = countSpeakerLines(rawText);
  const cleanedSpeakerLines = countSpeakerLines(cleanedText);

  // Le modèle peut fusionner quelques lignes fragmentées du même speaker,
  // mais il ne doit pas supprimer quasiment toute la structure speaker.
  if (
    rawSpeakerLines >= 8 &&
    cleanedSpeakerLines < Math.max(2, Math.floor(rawSpeakerLines * 0.25))
  ) {
    return true;
  }

  return false;
}

export async function cleanTranscriptText(rawText: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;

  const trimmedRawText = normalizeBasicText(rawText);

  if (trimmedRawText.length < 50) {
    return rawText;
  }

  const preCleanedText = collapseAsrLoopArtifacts(trimmedRawText);

  if (!apiKey) {
    return preCleanedText || rawText;
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: OPENAI_TRANSCRIPT_CLEANUP_MODEL,
        temperature: Number.isFinite(OPENAI_TRANSCRIPT_CLEANUP_TEMPERATURE)
          ? OPENAI_TRANSCRIPT_CLEANUP_TEMPERATURE
          : 0.15,
        top_p: 1,
        presence_penalty: 0,
        frequency_penalty: 0,
        messages: [
          {
            role: "system",
            content: SYSTEM_PROMPT,
          },
          {
            role: "user",
            content: preCleanedText,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      console.error(
        `[cleanTranscript] OpenAI API error — status=${response.status} body=${errorBody.slice(
          0,
          500,
        )}`,
      );

      return preCleanedText || rawText;
    }

    const data = (await response.json()) as ChatCompletionResponse;

    logOpenAiUsage(
      "transcript_cleanup",
      OPENAI_TRANSCRIPT_CLEANUP_MODEL,
      data.usage,
    );

    const finishReason = data.choices?.[0]?.finish_reason;

    if (finishReason === "length") {
      console.warn(
        "[cleanTranscript] OpenAI response stopped because of length — using pre-cleaned transcript.",
      );

      return preCleanedText || rawText;
    }

    const modelOutput = data.choices?.[0]?.message?.content;

    if (!modelOutput) {
      return preCleanedText || rawText;
    }

    const cleanedWithoutFence = stripPossibleCodeFence(modelOutput);
    const cleanedWithoutLoops = collapseAsrLoopArtifacts(cleanedWithoutFence);
    const cleaned = protectReconstructedEmails(preCleanedText, cleanedWithoutLoops);

    if (shouldRejectCleanedTranscript(preCleanedText, cleaned)) {
      console.warn(
        "[cleanTranscript] Cleaned transcript suspicious — using pre-cleaned transcript.",
      );

      return preCleanedText || rawText;
    }

    return cleaned;
  } catch (err: unknown) {
    console.error(
      "[cleanTranscript] Failed:",
      err instanceof Error ? err.message : err,
    );

    return preCleanedText || rawText;
  }
}