/**
 * 024 — El texto de la IA, sin formato, para los canales que no lo dibujan.
 *
 * El agente incluido y los cerebros externos escriben como si todo fuera
 * WhatsApp: `*negrita*`, `_cursiva_`, y a veces Markdown entero. WhatsApp lo
 * dibuja; Instagram, Messenger y TikTok enseñan los asteriscos tal cual. Aquí
 * se quitan las marcas y se deja el contenido limpio.
 *
 * Es conservador a propósito: una marca solo se quita si abre pegada a una
 * palabra y cierra pegada a otra. `2 * 3 * 4`, `mi_variable` o `5*3` no son
 * formato y se quedan intactos.
 */

const SIMPLE =
  /(^|[\s(¿¡"'«])([*_~`])(?=\S)([^\n]*?\S)\2(?=$|[\s.,!?;:)"'»…])/gm;

export function plainSocialText(text: string): string {
  const urls: string[] = [];
  const guardar = (url: string) => {
    urls.push(url);
    return `\u0000${urls.length - 1}\u0000`;
  };

  let out = text
    // [texto](https://…) → texto: https://… (si el texto ES la URL, solo la URL)
    .replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g, (_m, label: string, url: string) =>
      label.trim() === url ? guardar(url) : `${label}: ${guardar(url)}`
    )
    .replace(/https?:\/\/[^\s<>]+/g, guardar)
    // Bloques entre ``` → su contenido.
    .replace(/```[a-zA-Z0-9]*\n?([\s\S]*?)```/g, (_m, code: string) => code.replace(/\n$/, ""))
    // # Título → Título
    .replace(/^[ \t]{0,3}#{1,6}[ \t]+(.+?)[ \t]*#*[ \t]*$/gm, "$1")
    // - uno · * uno · + uno → • uno
    .replace(/^([ \t]*)[-*+][ \t]+(?=\S)/gm, "$1• ")
    // Marcadores dobles de Markdown.
    .replace(/\*\*(?=\S)([^\n]*?\S)\*\*/g, "$1")
    .replace(/__(?=\S)([^\n]*?\S)__/g, "$1")
    .replace(/~~(?=\S)([^\n]*?\S)~~/g, "$1");

  for (let i = 0; i < 4; i++) {
    const next = out.replace(SIMPLE, "$1$3");
    if (next === out) break;
    out = next;
  }

  return out.replace(/\u0000(\d+)\u0000/g, (_m, i: string) => urls[Number(i)] ?? "");
}
