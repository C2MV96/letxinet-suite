// preload.cjs — Fase P10 Attachment / Extra Tools
// Expone webUtils.getPathForFile() al renderer via contextBridge para que el
// <input type="file"> HTML pueda obtener el path absoluto bajo Electron 32+
// con contextIsolation:true (donde File.path ya no expone).
const { contextBridge, webUtils } = require('electron');

contextBridge.exposeInMainWorld('letxipuDrops', {
  // Recibe un objeto File-like (de input.files o dataTransfer.files)
  // y devuelve el path absoluto como string. Si no es Electron, devuelve "".
  getPathForFile: (file) => {
    try {
      // webUtils.getPathForFile requiere el objeto File nativo (no un wrapper).
      // El renderer pasa el File original del input, así que debería funcionar.
      return webUtils.getPathForFile(file);
    } catch (e) {
      console.warn('[preload] getPathForFile falló:', e.message);
      return '';
    }
  },
  isElectron: true,
});
