// Pertinencia de una referencia: su titulo contiene al menos un termino de cada grupo de la consulta
// (benchmark\consultas.json, campo "pertinencia"). Misma regla para LetXinet y para la IA: solo el titulo.
'use strict';

const normal = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

function esPertinente(titulo, grupos) {
  if (!grupos || !grupos.length) return true;
  const t = normal(titulo);
  return grupos.every((g) => g.split('|').some((w) => t.includes(normal(w))));
}

module.exports = { esPertinente };
