import React from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skill } from '@/types/profile';

interface SkillModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: Skill;
  onSave: (data: Skill) => Promise<void>;
  mode: 'add' | 'edit';
}

const EMPTY_SKILL_FORM: Skill = {
  nombre: '',
  tipo: 'tecnica',
  nivel: 'Intermedio',
  descripcion: '',
};

const getInitialFormData = (mode: SkillModalProps['mode'], initialData?: Skill): Skill => {
  if (mode === 'edit' && initialData) {
    return {
      ...initialData,
      descripcion: initialData.descripcion || '',
    };
  }

  return { ...EMPTY_SKILL_FORM };
};

export function SkillModal({
  isOpen,
  onClose,
  initialData,
  onSave,
  mode,
}: SkillModalProps) {
  const [formData, setFormData] = React.useState<Skill>(() => getInitialFormData(mode, initialData));
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!isOpen) {
      return;
    }

    setFormData(getInitialFormData(mode, initialData));
    setError(null);
    setIsLoading(false);
  }, [isOpen, mode, initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      await onSave(mode === 'add' ? { ...formData, id: undefined } : formData);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-card rounded-lg shadow-xl max-w-md w-full mx-4 border border-border">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-xl font-semibold text-foreground">
            {mode === 'add' ? 'Agregar Habilidad' : 'Editar Habilidad'}
          </h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
              {error}
            </div>
          )}

          <div>
            <Label htmlFor="nombre">Nombre de la habilidad *</Label>
            <Input
              id="nombre"
              type="text"
              value={formData.nombre}
              onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
              placeholder="Ej: JavaScript, Comunicación, etc."
              required
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="tipo">Tipo de habilidad *</Label>
            <select
              id="tipo"
              value={formData.tipo}
              onChange={(e) =>
                setFormData({ ...formData, tipo: e.target.value as 'tecnica' | 'blanda' })
              }
              required
              aria-label="Tipo de habilidad"
              className="mt-1 w-full px-3 py-2 border border-border rounded-[var(--radius)] bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
            >
              <option value="tecnica">Técnica</option>
              <option value="blanda">Blanda</option>
            </select>
          </div>

          <div>
            <Label htmlFor="nivel">Nivel de dominio *</Label>
            <select
              id="nivel"
              value={formData.nivel}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  nivel: e.target.value as 'Basico' | 'Intermedio' | 'Avanzado',
                })
              }
              required
              aria-label="Nivel de dominio"
              className="mt-1 w-full px-3 py-2 border border-border rounded-[var(--radius)] bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
            >
              <option value="Basico">Básico</option>
              <option value="Intermedio">Intermedio</option>
              <option value="Avanzado">Avanzado</option>
            </select>
          </div>

          <div>
            <Label htmlFor="descripcion">Descripción (opcional)</Label>
            <textarea
              id="descripcion"
              value={formData.descripcion || ''}
              onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
              placeholder="Describe tu experiencia con esta habilidad..."
              rows={3}
              className="mt-1 w-full px-3 py-2 border border-border rounded-[var(--radius)] bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Guardando...' : mode === 'add' ? 'Agregar' : 'Guardar Cambios'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
