import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Code2, Save, X, Lightbulb, Download, Upload } from 'lucide-react';
import { useRef } from 'react';
import { useI18n, getDefaultSkills } from '../lib/i18n';

export interface Skill {
  id: string;
  name: string;
  description: string;
  prompt: string;
  isActive?: boolean;
}

export default function SkillsGallery() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const { lang } = useI18n();
  const [isEditing, setIsEditing] = useState(false);
  const [currentSkill, setCurrentSkill] = useState<Partial<Skill>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(skills, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "letsxinet-skills.skill");
    document.body.appendChild(downloadAnchorNode); // required for firefox
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedSkills = JSON.parse(e.target?.result as string);
        if (Array.isArray(importedSkills)) {
          // Merge imported skills with existing ones or overwrite
          const confirmMerge = window.confirm('¿Deseas fusionar los skills (Aceptar) o reemplazar los actuales (Cancelar)?');
          if (confirmMerge) {
             const merged = [...skills];
             importedSkills.forEach(impSkill => {
                 if (!merged.find(s => s.id === impSkill.id)) {
                     // Ensure unique ID if conflict
                     if (merged.find(s => s.id === impSkill.id)) {
                         impSkill.id = Date.now().toString() + Math.random().toString(36).substring(7);
                     }
                     merged.push(impSkill);
                 }
             });
             saveToStorage(merged);
             alert('Skills fusionados exitosamente.');
          } else {
             saveToStorage(importedSkills);
             alert('Skills reemplazados exitosamente.');
          }
        } else {
          alert('El archivo no contiene un formato de skills válido.');
        }
      } catch (err) {
        console.error('Error importing skills', err);
        alert('Error al leer el archivo de skills.');
      }
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };


  useEffect(() => {
    const saved = localStorage.getItem('letsxinet-skills');
    const defaultSkills = getDefaultSkills(lang);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Skill[];
        let hasChanges = false;
        let updated = [...parsed];

        // Migration to deactivate all skills except 'Antecedentes APA 7' (id: '5') and 'LETXIPU DEEP SEARCH V12' (id: '7')
        const hasMigrated5And7Only = localStorage.getItem('letsxinet-skills-only-5-and-7-active-v1');
        if (!hasMigrated5And7Only) {
          updated = updated.map(s => {
            if (s.id === '5' || s.id === '7') {
              return { ...s, isActive: true };
            } else if (['1', '2', '3', '4', '6'].includes(s.id)) {
              return { ...s, isActive: false };
            }
            return s;
          });
          localStorage.setItem('letsxinet-skills-only-5-and-7-active-v1', 'true');
          hasChanges = true;
        }

        // Migration to update APA 7 (id: '5') prompt to be dynamic and depend on user input years
        const hasMigrated5DynamicYears = localStorage.getItem('letsxinet-skills-5-dynamic-years-v2');
        if (!hasMigrated5DynamicYears) {
          updated = updated.map(s => {
            if (s.id === '5') {
              const defSkill = defaultSkills.find(d => d.id === '5');
              if (defSkill) {
                return {
                  ...s,
                  description: defSkill.description,
                  prompt: defSkill.prompt
                };
              }
            }
            return s;
          });
          localStorage.setItem('letsxinet-skills-5-dynamic-years-v2', 'true');
          hasChanges = true;
        }

        // Migration for LetXipu V9 to deactivate all skills and enforce ONLY skill ID '7' with updated prompt
        const hasMigratedV9Only = localStorage.getItem('letsxinet-skills-only-7-active-v9');
        if (!hasMigratedV9Only) {
          updated = updated.map(s => {
            if (s.id === '7') {
              const defSkill = defaultSkills.find(d => d.id === '7');
              if (defSkill) {
                return {
                  ...s,
                  name: defSkill.name,
                  description: defSkill.description,
                  prompt: defSkill.prompt,
                  isActive: true
                };
              }
            }
            return { ...s, isActive: false };
          });
          localStorage.setItem('letsxinet-skills-only-7-active-v9', 'true');
          hasChanges = true;
        }

        // Migration to activate combined Letxipu + OSM skill (id: '9')
        const hasMigratedCombined = localStorage.getItem('letsxinet-skills-combined-v10');
        if (!hasMigratedCombined) {
          updated = updated.map(s => {
            if (s.id === '9') {
              const defSkill = defaultSkills.find(d => d.id === '9');
              if (defSkill) {
                return {
                  ...s,
                  name: defSkill.name,
                  description: defSkill.description,
                  prompt: defSkill.prompt,
                  isActive: true
                };
              }
            } else if (s.id === '7') {
              return { ...s, isActive: false };
            }
            return s;
          });
          localStorage.setItem('letsxinet-skills-combined-v10', 'true');
          hasChanges = true;
        }

        defaultSkills.forEach(def => {
          if (!updated.some(s => s.id === def.id || s.name === def.name)) {
            updated.push(def);
            hasChanges = true;
          }
        });
        if (hasChanges) {
          localStorage.setItem('letsxinet-skills', JSON.stringify(updated));
          setSkills(updated);
        } else {
          setSkills(parsed);
        }
      } catch (e) {
        console.error('Failed to parse skills from localStorage', e);
        setSkills(defaultSkills);
        localStorage.setItem('letsxinet-skills', JSON.stringify(defaultSkills));
      }
    } else {
      setSkills(defaultSkills);
      localStorage.setItem('letsxinet-skills', JSON.stringify(defaultSkills));
    }
  }, [lang]);

  const saveToStorage = (updatedSkills: Skill[]) => {
    setSkills(updatedSkills);
    localStorage.setItem('letsxinet-skills', JSON.stringify(updatedSkills));
    window.dispatchEvent(new Event('skills-updated'));
  };

  const toggleActive = (id: string) => {
    saveToStorage(skills.map(s => s.id === id ? { ...s, isActive: s.isActive === false ? true : false } : s));
  };

  const handleAddNew = () => {
    setCurrentSkill({
      id: Date.now().toString(),
      name: '',
      description: '',
      prompt: ''
    });
    setIsEditing(true);
  };

  const handleEdit = (skill: Skill) => {
    setCurrentSkill({ ...skill });
    setIsEditing(true);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('¿Seguro que deseas eliminar este skill?')) {
      saveToStorage(skills.filter(s => s.id !== id));
    }
  };

  const handleSave = () => {
    if (!currentSkill.name || !currentSkill.prompt) {
      alert('Error: "Nombre" y "Prompt" son campos obligatorios.');
      return;
    }
    
    // Check if it's an existing skill
    const exists = skills.findIndex(s => s.id === currentSkill.id);
    let newSkills = [...skills];
    
    if (exists >= 0) {
      newSkills[exists] = currentSkill as Skill;
    } else {
      newSkills.push(currentSkill as Skill);
    }
    
    saveToStorage(newSkills);
    setIsEditing(false);
    setCurrentSkill({});
  };

  if (isEditing) {
    return (
      <div className="flex flex-col h-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden p-6 gap-6">
        <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-4">
          <Code2 className="w-5 h-5 text-indigo-500" />
          {skills.some(s => s.id === currentSkill.id) ? 'Editar Skill' : 'Nuevo Skill'}
        </h2>
        
        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-semibold mb-1 text-zinc-700 dark:text-zinc-300">Nombre del Skill</label>
            <input 
              type="text" 
              value={currentSkill.name || ''}
              onChange={e => setCurrentSkill({...currentSkill, name: e.target.value})}
              placeholder="Ej. Mi Skill Analítico"
              className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-zinc-800 dark:text-zinc-100 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1 text-zinc-700 dark:text-zinc-300">Descripción Breve</label>
            <input 
              type="text" 
              value={currentSkill.description || ''}
              onChange={e => setCurrentSkill({...currentSkill, description: e.target.value})}
              placeholder="Ej. Funciona para analizar gráficos..."
              className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-zinc-800 dark:text-zinc-100 text-sm"
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-semibold mb-1 text-zinc-700 dark:text-zinc-300">Prompt / Instrucciones Base</label>
            <textarea 
              value={currentSkill.prompt || ''}
              onChange={e => setCurrentSkill({...currentSkill, prompt: e.target.value})}
              placeholder="Escribe el prompt o comportamiento detallado que el agente o herramienta usará. Ej: Actúa como experto en física cuántica..."
              className="w-full h-48 px-4 py-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-zinc-800 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 text-sm resize-none"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 justify-end pt-4 border-t border-zinc-200 dark:border-zinc-800">
          <button 
            onClick={() => setIsEditing(false)}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 transition-colors"
          >
            Cancelar
          </button>
          <button 
            onClick={handleSave}
            className="px-5 py-2 text-sm font-medium rounded-lg flex items-center gap-2 bg-indigo-600 text-white hover:bg-indigo-700 transition"
          >
            <Save className="w-4 h-4" />
            Guardar Skill
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden p-6 gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-4">
        <div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-indigo-500" />
            Galería de Skills
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Gana eficiencia creando y definiendo contextos reusables para tu agente e investigación.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="file"
            accept=".skill,application/json"
            className="hidden"
            ref={fileInputRef}
            onChange={handleImport}
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-2 shrink-0 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700/80 text-zinc-700 dark:text-zinc-200 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all shadow-sm"
          >
            <Upload className="w-4 h-4" />
            <span className="hidden sm:inline">Importar</span>
          </button>
          <button 
            onClick={handleExport}
            className="px-3 py-2 shrink-0 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700/80 text-zinc-700 dark:text-zinc-200 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all shadow-sm"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Exportar</span>
          </button>
          <button 
            onClick={handleAddNew}
            className="px-4 py-2 shrink-0 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Crear Nuevo Skill
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 min-h-0 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-zinc-300 dark:scrollbar-thumb-zinc-700 scrollbar-track-transparent">
        {skills.map(skill => (
          <div key={skill.id} className="group relative flex flex-col justify-between bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 hover:border-indigo-500/50 hover:shadow-md transition-all duration-300">
            <div>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => toggleActive(skill.id)}
                    className={`relative inline-flex h-4 w-7 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 ${skill.isActive !== false ? 'bg-indigo-500' : 'bg-zinc-300 dark:bg-zinc-700'}`}
                    role="switch"
                    aria-checked={skill.isActive !== false}
                  >
                    <span className="sr-only">Toggle skill</span>
                    <span className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${skill.isActive !== false ? 'translate-x-3' : 'translate-x-0'}`} />
                  </button>
                  <h3 className={`font-bold leading-tight ${skill.isActive !== false ? 'text-zinc-900 dark:text-white' : 'text-zinc-500 dark:text-zinc-500 line-through'}`}>{skill.name}</h3>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => handleEdit(skill)} className="p-1.5 rounded-md hover:bg-indigo-100 dark:hover:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400">
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleDelete(skill.id)} className="p-1.5 rounded-md hover:bg-red-100 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4 line-clamp-2">{skill.description}</p>
            </div>
            
            <div className="bg-white dark:bg-zinc-900 rounded-lg p-3 border border-zinc-200/60 dark:border-zinc-800/60 mt-auto">
              <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 dark:text-zinc-500 mb-1 block">Prompt Base:</span>
              <p className="text-xs font-mono text-zinc-700 dark:text-zinc-300 line-clamp-3">
                {skill.prompt}
              </p>
            </div>
          </div>
        ))}
        {skills.length === 0 && (
           <div className="col-span-full py-12 flex flex-col items-center justify-center text-center text-zinc-500 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl">
              <Code2 className="w-8 h-8 mb-3 opacity-50" />
              <p className="font-medium text-sm">No hay skills guardados.</p>
              <p className="text-xs mt-1">Crea tu primer skill para agilizar tus tareas repetitivas.</p>
           </div>
        )}
      </div>
    </div>
  );
}
