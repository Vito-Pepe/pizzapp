// I vecchi indirizzi di Impasti (/#/diario, /#/farine, ...) ora stanno in /impasti/
function vaiAImpasti() {
  if (/^#\/./.test(location.hash)) location.replace(`/impasti/${location.hash}`);
}
vaiAImpasti();
window.addEventListener("hashchange", vaiAImpasti);
